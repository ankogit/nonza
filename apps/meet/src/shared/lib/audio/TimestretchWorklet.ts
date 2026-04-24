type CreateWorkletParams = {
  ctx: AudioContext;
  bufferSource?: AudioBufferSourceNode;
  modulePath?: string;
  opts?: AudioWorkletNodeOptions;
  pitch?: number;
};

const DEFAULT_MODULE_PATH = "/audio-worklets/phase-vocoder-processor.js";
const loadedByContext = new WeakMap<AudioContext, Promise<void>>();

export class TimestretchWorklet {
  bufferSource: AudioBufferSourceNode | null;
  ctx: AudioContext;
  pitch: number;
  playbackRate: number;
  workletNode: AudioWorkletNode | null;

  static async createWorklet({
    ctx,
    bufferSource,
    modulePath,
    opts = {},
    pitch,
  }: CreateWorkletParams): Promise<TimestretchWorklet> {
    const worklet = new TimestretchWorklet(ctx);

    let modulePromise = loadedByContext.get(ctx);
    if (!modulePromise) {
      modulePromise = ctx.audioWorklet.addModule(modulePath || DEFAULT_MODULE_PATH);
      loadedByContext.set(ctx, modulePromise);
    }
    await modulePromise;

    worklet.workletNode = new AudioWorkletNode(
      ctx,
      "phase-vocoder-processor",
      opts,
    );

    if (pitch != null) {
      worklet.updatePitch(pitch);
    }

    if (bufferSource) {
      worklet.connectBufferSource(bufferSource);
    }

    worklet.workletNode.port.onmessage = (e) => {
      const data = e.data as { type?: string; rate?: number } | undefined;
      if (data?.type === "updatePlaybackRate" && worklet.bufferSource && data.rate) {
        const t = ctx.currentTime;
        const param = worklet.bufferSource.playbackRate;
        param.cancelScheduledValues(t);
        param.setTargetAtTime(data.rate, t, 0.05);
      }
    };

    return worklet;
  }

  constructor(ctx: AudioContext) {
    this.bufferSource = null;
    this.ctx = ctx;
    this.pitch = 1;
    this.playbackRate = 1;
    this.workletNode = null;
  }

  connectBufferSource(bufferSource: AudioBufferSourceNode): void {
    if (!this.workletNode) {
      throw new Error("No worklet created. Call createWorklet() first");
    }
    this.workletNode.parameters.get("playbackRate")!.value =
      bufferSource.playbackRate.value;
    bufferSource.connect(this.workletNode);
    this.bufferSource = bufferSource;
  }

  updatePitch(pitch: number): void {
    this.pitch = pitch;
    this.workletNode?.parameters.get("pitchFactor")?.setValueAtTime(
      pitch,
      this.ctx.currentTime,
    );
  }

  updateSpeed(rate: number): void {
    this.playbackRate = rate;
    this.workletNode?.parameters.get("playbackRate")?.setValueAtTime(
      rate,
      this.ctx.currentTime,
    );
  }
}
