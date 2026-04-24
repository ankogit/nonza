type CreateWorkletParams = {
  ctx: AudioContext;
  bufferSource?: AudioBufferSourceNode;
  modulePath?: string;
  opts?: AudioWorkletNodeOptions;
  pitch?: number;
};

const DEFAULT_MODULE_PATH = "/audio-worklets/phase-vocoder-processor.js";

/** Один fetch на приложение; addModule по URL каждый раз бил dev-сервер. */
let defaultWorkletBlobUrlPromise: Promise<string> | null = null;

function getDefaultWorkletModuleUrl(): Promise<string> {
  if (!defaultWorkletBlobUrlPromise) {
    defaultWorkletBlobUrlPromise = fetch(DEFAULT_MODULE_PATH)
      .then((r) => {
        if (!r.ok) throw new Error(`worklet fetch ${r.status}`);
        return r.text();
      })
      .then((code) => {
        const blob = new Blob([code], { type: "application/javascript" });
        return URL.createObjectURL(blob);
      });
  }
  return defaultWorkletBlobUrlPromise;
}

const loadedByContext = new WeakMap<AudioContext, Promise<void>>();
const readyByContext = new WeakSet<AudioContext>();

export class TimestretchWorklet {
  bufferSource: AudioBufferSourceNode | null;
  ctx: AudioContext;
  pitch: number;
  playbackRate: number;
  workletNode: AudioWorkletNode | null;

  private static setupWorklet(
    ctx: AudioContext,
    bufferSource: AudioBufferSourceNode | undefined,
    opts: AudioWorkletNodeOptions,
    pitch: number | undefined,
  ): TimestretchWorklet {
    const worklet = new TimestretchWorklet(ctx);
    worklet.workletNode = new AudioWorkletNode(ctx, "phase-vocoder-processor", opts);

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

  static async ensureModuleLoaded(
    ctx: AudioContext,
    modulePath?: string,
  ): Promise<void> {
    if (readyByContext.has(ctx)) return;
    let modulePromise = loadedByContext.get(ctx);
    if (!modulePromise) {
      const url =
        modulePath && modulePath !== DEFAULT_MODULE_PATH
          ? modulePath
          : await getDefaultWorkletModuleUrl();
      modulePromise = ctx.audioWorklet.addModule(url);
      loadedByContext.set(ctx, modulePromise);
    }
    await modulePromise;
    readyByContext.add(ctx);
  }

  static createWorkletSync({
    ctx,
    bufferSource,
    opts = {},
    pitch,
  }: Omit<CreateWorkletParams, "modulePath">): TimestretchWorklet {
    if (!readyByContext.has(ctx)) {
      throw new Error("Worklet module is not loaded. Call ensureModuleLoaded first.");
    }
    return TimestretchWorklet.setupWorklet(ctx, bufferSource, opts, pitch);
  }

  static async createWorklet({
    ctx,
    bufferSource,
    modulePath,
    opts = {},
    pitch,
  }: CreateWorkletParams): Promise<TimestretchWorklet> {
    await TimestretchWorklet.ensureModuleLoaded(ctx, modulePath);
    return TimestretchWorklet.setupWorklet(ctx, bufferSource, opts, pitch);
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
