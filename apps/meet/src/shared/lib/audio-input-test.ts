import { ref, onUnmounted } from "vue";
import { getDefaultAudioConstraints } from "./audio-constraints";

export function useAudioInputTest() {
  const isTesting = ref(false);
  const audioLevel = ref(0); // 0-100
  const streamRef = ref<MediaStream | null>(null);
  const audioContextRef = ref<AudioContext | null>(null);
  const analyserRef = ref<AnalyserNode | null>(null);
  const animationFrameRef = ref<number | null>(null);

  const startTest = async (deviceId?: string) => {
    if (isTesting.value) return;

    try {
      const constraints: MediaStreamConstraints = {
        audio: getDefaultAudioConstraints(deviceId),
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.value = stream;

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.value = audioContext;
      analyserRef.value = analyser;

      isTesting.value = true;
      audioLevel.value = 0;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.value || !isTesting.value) return;

        // Используем getByteTimeDomainData для более точного отображения уровня входного сигнала
        analyserRef.value.getByteTimeDomainData(dataArray);
        
        // Вычисляем RMS (Root Mean Square) для более точного определения уровня
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        
        // Конвертируем RMS в проценты (0-100)
        // RMS обычно в диапазоне 0-1, умножаем на 100 и ограничиваем
        audioLevel.value = Math.min(100, Math.round(rms * 100 * 2)); // *2 для более чувствительной шкалы

        if (isTesting.value) {
          animationFrameRef.value = requestAnimationFrame(updateLevel);
        }
      };

      updateLevel();
    } catch (err) {
      console.error("Failed to start audio test:", err);
      stopTest();
    }
  };

  const stopTest = () => {
    isTesting.value = false;

    if (animationFrameRef.value !== null) {
      cancelAnimationFrame(animationFrameRef.value);
      animationFrameRef.value = null;
    }

    if (streamRef.value) {
      streamRef.value.getTracks().forEach((track) => track.stop());
      streamRef.value = null;
    }

    if (audioContextRef.value && audioContextRef.value.state !== "closed") {
      audioContextRef.value.close();
      audioContextRef.value = null;
    }

    analyserRef.value = null;
    audioLevel.value = 0;
  };

  onUnmounted(() => {
    stopTest();
  });

  return {
    isTesting,
    audioLevel,
    startTest,
    stopTest,
  };
}
