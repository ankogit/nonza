class PhaseVocoderProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "pitchFactor", defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: "k-rate" },
      { name: "playbackRate", defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: "k-rate" },
    ];
  }

  constructor() {
    super();
    this.lastPlaybackRate = 1;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const outL = output[0];
    const outR = output[1] || output[0];
    const inL = input && input[0] ? input[0] : null;
    const inR = input && input[1] ? input[1] : inL;

    const speed = parameters.playbackRate[0] ?? 1;
    if (Math.abs(speed - this.lastPlaybackRate) > 0.0001) {
      this.lastPlaybackRate = speed;
      this.port.postMessage({ type: "updatePlaybackRate", rate: speed });
    }

    for (let i = 0; i < outL.length; i++) {
      const sL = inL ? inL[i] : 0;
      const sR = inR ? inR[i] : sL;
      outL[i] = sL;
      outR[i] = sR;
    }
    return true;
  }
}

registerProcessor("phase-vocoder-processor", PhaseVocoderProcessor);
