declare module "soundtouchjs" {
  export class PitchShifter {
    constructor(
      context: AudioContext,
      buffer: AudioBuffer,
      bufferSize?: number,
      onEnd?: () => void,
    );
    tempo: number;
    pitch: number;
    rate: number;
    /** Seconds of source buffer consumed (for gate / sync). */
    timePlayed: number;
    duration: number;
    sampleRate: number;
    connect(toNode: AudioNode): void;
    disconnect(): void;
  }
}
