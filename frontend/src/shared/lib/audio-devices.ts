import { ref, onMounted, onUnmounted } from "vue";
import { getDefaultAudioConstraints } from "./audio-constraints";

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

const STORAGE_KEY_AUDIO_INPUT = "nonza_audio_input_device";
const STORAGE_KEY_AUDIO_OUTPUT = "nonza_audio_output_device";

export function getStoredAudioInputDevice(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_AUDIO_INPUT);
  } catch {
    return null;
  }
}

export function setStoredAudioInputDevice(deviceId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_AUDIO_INPUT, deviceId);
  } catch {
    /* ignore */
  }
}

export function getStoredAudioOutputDevice(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_AUDIO_OUTPUT);
  } catch {
    return null;
  }
}

export function setStoredAudioOutputDevice(deviceId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_AUDIO_OUTPUT, deviceId);
  } catch {
    /* ignore */
  }
}

export function useAudioDevices() {
  const audioInputDevices = ref<AudioDevice[]>([]);
  const audioOutputDevices = ref<AudioDevice[]>([]);
  const isLoading = ref(false);
  const hasPermission = ref(false);

  const refreshDevices = async () => {
    isLoading.value = true;
    try {
      // Запрашиваем разрешение на доступ к микрофону для получения меток устройств
      try {
        await navigator.mediaDevices.getUserMedia({ audio: getDefaultAudioConstraints() });
        hasPermission.value = true;
      } catch (err) {
        console.warn("Permission denied for audio devices:", err);
        hasPermission.value = false;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      
      audioInputDevices.value = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Микрофон ${d.deviceId.slice(0, 8)}`,
          kind: d.kind,
        }));

      audioOutputDevices.value = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Динамики ${d.deviceId.slice(0, 8)}`,
          kind: d.kind,
        }));
    } catch (err) {
      console.error("Failed to enumerate devices:", err);
    } finally {
      isLoading.value = false;
    }
  };

  // Обновляем список при изменении устройств
  const handleDeviceChange = () => {
    refreshDevices();
  };

  onMounted(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
  });

  onUnmounted(() => {
    navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
  });

  return {
    audioInputDevices,
    audioOutputDevices,
    isLoading,
    hasPermission,
    refreshDevices,
  };
}

/**
 * Применяет сохраненное устройство вывода к аудио элементу
 */
export async function applyStoredOutputDevice(audioElement: HTMLAudioElement): Promise<void> {
  const deviceId = getStoredAudioOutputDevice();
  return applyOutputDevice(audioElement, deviceId);
}

/**
 * Применяет конкретное устройство вывода к аудио элементу
 */
export async function applyOutputDevice(audioElement: HTMLAudioElement, deviceId: string | null): Promise<void> {
  // Если setSinkId не поддерживается браузером, ничего не делаем
  if (!("setSinkId" in audioElement) || typeof audioElement.setSinkId !== "function") {
    return;
  }

  try {
    // Если deviceId не задан, используем устройство по умолчанию (пустая строка)
    const sinkId = deviceId || "";
    await (audioElement as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(sinkId);
  } catch (err) {
    console.warn("Failed to set sink ID:", err);
  }
}
