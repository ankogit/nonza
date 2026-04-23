function sliceAudioBuffer(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): AudioBuffer {
  const sr = buffer.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sr));
  const endSample = Math.min(buffer.length, Math.ceil(endSec * sr));
  const len = Math.max(0, endSample - startSample);
  const out = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: len,
    sampleRate: sr,
  });
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    out.getChannelData(c).set(src.subarray(startSample, endSample));
  }
  return out;
}

function encodeWavPcm16(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const out = new ArrayBuffer(44 + dataLength);
  const view = new DataView(out);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(off + i, s.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
      const v = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, v, true);
      offset += 2;
    }
  }

  return new Blob([out], { type: "audio/wav" });
}

export async function renderSoundBarClipForUpload(params: {
  file: File;
  startSec: number;
  endSec: number;
  volume: number;
  speed: number;
}): Promise<File> {
  const { file, startSec, endSec } = params;
  const volume = Math.max(0, Math.min(500, params.volume)) / 100;
  const rate = Math.max(0.25, Math.min(4, params.speed / 100));

  if (endSec <= startSec) {
    throw new Error("invalid segment");
  }

  const ab = await file.arrayBuffer();
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(ab.slice(0));
  } finally {
    await ctx.close();
  }

  const sliced = sliceAudioBuffer(decoded, startSec, endSec);
  if (sliced.length === 0) {
    throw new Error("empty segment");
  }

  const sr = sliced.sampleRate;
  const segmentSec = endSec - startSec;
  const outFrames = Math.max(1, Math.ceil((segmentSec / rate) * sr));

  const offline = new OfflineAudioContext(
    sliced.numberOfChannels,
    outFrames,
    sr,
  );
  const source = offline.createBufferSource();
  source.buffer = sliced;
  source.playbackRate.value = rate;
  const gain = offline.createGain();
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  const wavBlob = encodeWavPcm16(rendered);
  return new File([wavBlob], "soundbar-clip.wav", { type: "audio/wav" });
}
