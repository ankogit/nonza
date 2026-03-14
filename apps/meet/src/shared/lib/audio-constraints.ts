/**
 * Стандартные ограничения для захвата микрофона:
 * - шумоподавление (noiseSuppression)
 * - эхоподавление (echoCancellation)
 * - автоусиление (autoGainControl)
 * - желаемая частота дискретизации 48 kHz для лучшего качества голоса
 *
 * Используются как ideal/необязательные, чтобы не падать в браузерах без поддержки.
 */
export function getDefaultAudioConstraints(deviceId?: string): MediaTrackConstraints {
  const base: MediaTrackConstraints = {
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    sampleRate: { ideal: 48000 },
  };
  if (deviceId) {
    return { ...base, deviceId: { exact: deviceId } };
  }
  return base;
}
