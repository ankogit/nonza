<template>
  <div class="audio-settings">
    <div class="settings-section">
      <h3 class="settings-section-title">Устройство ввода (микрофон)</h3>

      <div class="settings-item">
        <label class="settings-label">Выберите микрофон</label>
        <div class="settings-select-wrap">
          <PixelSelect
            v-model="selectedInputDevice"
            class="settings-select"
            placeholder="По умолчанию"
            :options="inputDeviceOptions"
            :disabled="isLoadingDevices"
            aria-label="Выберите микрофон"
            @update:model-value="handleInputDeviceChange"
          />
          <Button
            type="icon"
            variant="default"
            icon-size="44px"
            :disabled="isLoadingDevices"
            title="Обновить список устройств"
            @click="refreshDevices"
          >
            <PixelIcon name="refresh" variant="large" />
          </Button>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-test-group">
          <button
            type="button"
            class="settings-test-button"
            :class="{ active: isTestingInput }"
            :disabled="!hasPermission"
            @click="handleTestToggle"
          >
            {{ isTestingInput ? "⏹️ Остановить тест" : "▶️ Тест микрофона" }}
          </button>
          <div v-if="isTestingInput" class="settings-level-indicator">
            <div
              class="settings-level-bar"
              :style="{ width: `${audioInputLevel}%` }"
              :class="{
                low: audioInputLevel < 30,
                medium: audioInputLevel >= 30 && audioInputLevel < 70,
                high: audioInputLevel >= 70,
              }"
            />
            <span class="settings-level-text">{{ audioInputLevel }}%</span>
          </div>
        </div>
        <p v-if="!hasPermission" class="settings-hint">
          Разрешите доступ к микрофону для тестирования
        </p>
      </div>
    </div>

    <div class="settings-section">
      <h3 class="settings-section-title">Устройство вывода (динамики)</h3>

      <div class="settings-item">
        <label class="settings-label">Выберите устройство вывода</label>
        <PixelSelect
          v-model="selectedOutputDevice"
          class="settings-select"
          placeholder="По умолчанию"
          :options="outputDeviceOptions"
          :disabled="
            isLoadingDevices ||
            audioOutputDevices.length === 0 ||
            !isOutputSupported
          "
          aria-label="Выберите устройство вывода"
          @update:model-value="handleOutputDeviceChange"
        />
        <p
          v-if="!isOutputSupported"
          class="settings-hint settings-hint--warning"
        >
          ⚠️ Выбор устройства вывода не поддерживается в этом браузере
          (требуется Chrome/Edge)
        </p>
        <p v-else-if="audioOutputDevices.length === 0" class="settings-hint">
          Устройства вывода не обнаружены (может потребоваться разрешение)
        </p>
      </div>
    </div>

    <div class="settings-section">
      <h3 class="settings-section-title">Звуковые уведомления</h3>
      <div class="settings-item">
        <label class="settings-label">Общая громкость</label>
        <div class="settings-master-volume-row">
          <input
            type="range"
            class="volume-slider settings-master-volume"
            min="0"
            max="100"
            step="5"
            :value="Math.round(notificationSounds.masterVolume.value * 100)"
            aria-label="Общая громкость уведомлений"
            @input="
              notificationSounds.setMasterVolume(
                Number(($event.target as HTMLInputElement).value) / 100
              )
            "
          />
          <span class="settings-master-volume-value">
            {{ Math.round(notificationSounds.masterVolume.value * 100) }}%
          </span>
        </div>
      </div>
      <div
        v-for="eventId in notificationSounds.eventIds"
        :key="eventId"
        class="settings-item settings-item--row"
      >
        <div class="settings-notification-row">
          <Switch
            :model-value="getEventConfig(eventId).enabled"
            @update:model-value="notificationSounds.setEventEnabled(eventId, $event)"
          >
            {{ eventLabels[eventId] }}
          </Switch>
          <Button
            type="icon"
            variant="default"
            icon-size="36px"
            :disabled="!getEventConfig(eventId).enabled"
            :title="`Проверить: ${eventLabels[eventId]}`"
            @click="notificationSounds.play(eventId)"
          >
            <PixelIcon name="volume-high" variant="small" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import {
  useAudioDevices,
  getStoredAudioInputDevice,
  setStoredAudioInputDevice,
  getStoredAudioOutputDevice,
  setStoredAudioOutputDevice,
  applyOutputDevice,
  useNotificationSounds,
} from "@shared/lib";
import type { NotificationSoundEventId } from "@shared/lib";
import { useAudioInputTest } from "@shared/lib";
import { Button, PixelSelect, PixelIcon, Switch } from "@shared/ui";

const notificationSounds = useNotificationSounds();
function getEventConfig(id: NotificationSoundEventId) {
  return notificationSounds.eventsConfig.value[id];
}
const eventLabels: Record<NotificationSoundEventId, string> = {
  participant_joined: "Участник вошёл в комнату",
  participant_left: "Участник вышел из комнаты",
  message: "Новое сообщение",
  mic_on: "Микрофон включён",
  mic_off: "Микрофон выключен",
};

const emit = defineEmits<{
  change: [settings: { inputDevice: string; outputDevice: string }];
}>();

const {
  audioInputDevices,
  audioOutputDevices,
  isLoading: isLoadingDevices,
  hasPermission,
  refreshDevices,
} = useAudioDevices();

const {
  isTesting: isTestingInput,
  audioLevel: audioInputLevel,
  startTest: startInputTest,
  stopTest: stopInputTest,
} = useAudioInputTest();

// Загружаем сохраненные значения как начальные
const initialInputDevice = getStoredAudioInputDevice() || "";
const initialOutputDevice = getStoredAudioOutputDevice() || "";

const selectedInputDevice = ref<string>(initialInputDevice);
const selectedOutputDevice = ref<string>(initialOutputDevice);

const inputDeviceOptions = computed(() => [
  { value: "", label: "По умолчанию" },
  ...audioInputDevices.value.map((d) => ({
    value: d.deviceId,
    label: d.label,
  })),
]);

const outputDeviceOptions = computed(() => [
  { value: "", label: "По умолчанию" },
  ...audioOutputDevices.value.map((d) => ({
    value: d.deviceId,
    label: d.label,
  })),
]);

// Проверяем поддержку setSinkId для выбора устройства вывода
const isOutputSupported = ref(false);
if (typeof HTMLAudioElement !== "undefined") {
  const testAudio = document.createElement("audio");
  isOutputSupported.value =
    "setSinkId" in testAudio && typeof testAudio.setSinkId === "function";
}

watch([selectedInputDevice, selectedOutputDevice], () => {
  emit("change", {
    inputDevice: selectedInputDevice.value,
    outputDevice: selectedOutputDevice.value,
  });
});

const handleInputDeviceChange = () => {
  // Если идет тест, перезапускаем с новым устройством
  if (isTestingInput.value) {
    stopInputTest();
    nextTick(() => {
      startInputTest(selectedInputDevice.value || undefined);
    });
  }
};

const handleTestToggle = () => {
  if (isTestingInput.value) {
    stopInputTest();
  } else {
    startInputTest(selectedInputDevice.value || undefined);
  }
};

const handleOutputDeviceChange = async () => {
  // Ничего не делаем здесь, просто уведомляем родителя через watch
};

// Метод для сохранения настроек (вызывается извне)
const saveSettings = async () => {
  // Сохраняем в localStorage
  if (selectedInputDevice.value) {
    setStoredAudioInputDevice(selectedInputDevice.value);
  } else {
    localStorage.removeItem("nonza_audio_input_device");
  }

  if (selectedOutputDevice.value) {
    setStoredAudioOutputDevice(selectedOutputDevice.value);
  } else {
    localStorage.removeItem("nonza_audio_output_device");
  }

  const audioElements = document.querySelectorAll("audio");
  for (const audio of audioElements) {
    try {
      await applyOutputDevice(
        audio as HTMLAudioElement,
        selectedOutputDevice.value,
      );
    } catch (err) {
      console.warn("Failed to set sink ID:", err);
    }
  }
};

const hasUnsavedChanges = () => {
  const savedInput = getStoredAudioInputDevice() || "";
  const savedOutput = getStoredAudioOutputDevice() || "";
  return (
    selectedInputDevice.value !== savedInput ||
    selectedOutputDevice.value !== savedOutput
  );
};

const getSettings = () => ({
  inputDevice: selectedInputDevice.value,
  outputDevice: selectedOutputDevice.value,
});

const resetSettings = () => {
  selectedInputDevice.value = getStoredAudioInputDevice() || "";
  selectedOutputDevice.value = getStoredAudioOutputDevice() || "";
};

// Экспортируем методы для использования извне
defineExpose({
  saveSettings,
  getSettings,
  resetSettings,
  hasUnsavedChanges,
});

onMounted(() => {
  refreshDevices();
});

onUnmounted(() => {
  stopInputTest();
});
</script>

<style scoped>
.audio-settings {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-section-title {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.2rem;
  font-weight: 400;
  color: #bab1a8;
  letter-spacing: 0.02em;
  border-bottom: 2px solid #333;
  padding-bottom: 8px;
}

.settings-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-label {
  font-size: 14px;
  font-weight: 500;
  color: #ccc;
}

.settings-select-wrap {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.settings-select-wrap .settings-select {
  flex: 1;
  min-width: 0;
}

.settings-select {
  width: 100%;
}

.settings-test-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-test-button {
  padding: 12px 24px;
  border: 2px solid #444;
  background: #333;
  color: #bab1a8;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: none;
  font-family: inherit;
}

.settings-test-button:hover:not(:disabled) {
  background: #444;
  border-color: #2980b9;
}

.settings-test-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-test-button.active {
  background: #e2534b;
  border-color: #e2534b;
  color: white;
}

.settings-test-button.active:hover {
  background: #f0645a;
  border-color: #f0645a;
}

.settings-level-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: #1a1a1a;
  border: 2px solid #444;
}

.settings-level-bar {
  flex: 1;
  height: 20px;
  background: #333;
  position: relative;
  transition: width 0.1s ease;
}

.settings-level-bar::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  background: currentColor;
}

.settings-level-bar.low {
  color: #0ead61;
}

.settings-level-bar.medium {
  color: #ffbe53;
}

.settings-level-bar.high {
  color: #e2534b;
}

.settings-level-text {
  font-size: 12px;
  font-weight: 600;
  color: #bab1a8;
  min-width: 40px;
  text-align: right;
}

.settings-hint {
  margin: 0;
  font-size: 12px;
  color: #888;
  font-style: italic;
}

.settings-hint--warning {
  color: #ffbe53;
  font-style: normal;
}

.settings-item--row {
  gap: 0;
}

.settings-notification-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.settings-notification-row .pixel-switch {
  flex: 1;
}

.settings-master-volume-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-master-volume {
  flex: 1;
}

.settings-master-volume-value {
  font-size: 14px;
  font-weight: 600;
  color: #bab1a8;
  min-width: 40px;
  text-align: right;
}
</style>
