<template>
  <Modal
    :model-value="modelValue"
    title="Сообщить о проблеме"
    @update:model-value="emit('update:modelValue', $event)"
    @close="resetForm"
  >
    <form class="report-bug-modal" @submit.prevent="submit">
      <FormSection label="Описание" hint="Что сломалось и как повторить">
        <Textarea
          id="bug-description"
          v-model="description"
          placeholder="Кратко опиши баг…"
          :rows="5"
          :disabled="submitting"
          aria-label="Описание проблемы"
        />
      </FormSection>

      <FormSection label="Скриншот" hint="PNG, JPG или WebP, до 8 МБ">
        <div
          class="report-bug-modal__drop"
          :class="{
            'report-bug-modal__drop--has-file': !!previewUrl,
            'report-bug-modal__drop--dragging': dragging,
          }"
          @dragenter.prevent="onDragEnter"
          @dragover.prevent
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
        >
          <input
            ref="fileInputRef"
            class="report-bug-modal__file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            :disabled="submitting"
            @change="onFileChange"
          />

          <template v-if="previewUrl && screenshot">
            <img
              :src="previewUrl"
              :alt="screenshot.name"
              class="report-bug-modal__preview"
            />
            <div class="report-bug-modal__preview-meta">
              <span class="report-bug-modal__file-name">{{ screenshot.name }}</span>
              <div class="report-bug-modal__preview-actions">
                <Button
                  type="text"
                  variant="secondary"
                  size="small"
                  native-type="button"
                  :disabled="submitting"
                  @click="fileInputRef?.click()"
                >
                  Заменить
                </Button>
                <Button
                  type="text"
                  variant="secondary"
                  size="small"
                  native-type="button"
                  :disabled="submitting"
                  @click="clearScreenshot"
                >
                  Убрать
                </Button>
              </div>
            </div>
          </template>
          <div v-else class="report-bug-modal__pick">
            <span class="report-bug-modal__pick-title">Загрузить скрин</span>
            <span class="report-bug-modal__pick-sub">нажми или перетащи сюда</span>
          </div>
        </div>
        <p v-if="fileError" class="report-bug-modal__error">{{ fileError }}</p>
      </FormSection>
    </form>

    <template #footer>
      <Button
        type="text"
        variant="secondary"
        size="small"
        native-type="button"
        :disabled="submitting"
        @click="close"
      >
        Отмена
      </Button>
      <Button
        type="text"
        variant="primary"
        size="small"
        native-type="button"
        :disabled="!canSubmit || submitting"
        @click="submit"
      >
        {{ submitting ? "…" : "Отправить" }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Modal, Textarea, FormSection, Button } from "@shared/ui";
import { showToast } from "@shared/lib";

const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const description = ref("");
const screenshot = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const fileError = ref("");
const submitting = ref(false);
const dragging = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
let dragDepth = 0;

const canSubmit = computed(
  () => description.value.trim().length > 0 && !fileError.value,
);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) resetForm();
  },
);

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }
}

function resetForm() {
  description.value = "";
  clearScreenshot();
  fileError.value = "";
  submitting.value = false;
  dragging.value = false;
  dragDepth = 0;
}

function clearScreenshot() {
  screenshot.value = null;
  revokePreview();
  fileError.value = "";
  if (fileInputRef.value) fileInputRef.value.value = "";
}

function setScreenshot(file: File | null) {
  fileError.value = "";
  if (!file) {
    clearScreenshot();
    return;
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    fileError.value = "Нужен PNG, JPG или WebP";
    clearScreenshot();
    return;
  }
  if (file.size > MAX_SCREENSHOT_BYTES) {
    fileError.value = "Файл больше 8 МБ";
    clearScreenshot();
    return;
  }
  revokePreview();
  screenshot.value = file;
  previewUrl.value = URL.createObjectURL(file);
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  setScreenshot(input.files?.[0] ?? null);
}

function onDragEnter() {
  if (submitting.value) return;
  dragDepth += 1;
  dragging.value = true;
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dragging.value = false;
}

function onDrop(event: DragEvent) {
  dragDepth = 0;
  dragging.value = false;
  if (submitting.value) return;
  const file = event.dataTransfer?.files?.[0] ?? null;
  setScreenshot(file);
}

function close() {
  emit("update:modelValue", false);
}

async function submit() {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    void description.value.trim();
    void screenshot.value;
    showToast("Спасибо, разберёмся с багом", { variant: "success" });
    close();
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.report-bug-modal {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.report-bug-modal__drop {
  position: relative;
  border: 3px dashed #555;
  background: #1a1a1a;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  overflow: hidden;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.report-bug-modal__drop--dragging {
  border-color: #2980b9;
  background: #1a2430;
}

.report-bug-modal__drop--has-file {
  border-style: solid;
  border-color: #444;
  padding: 10px;
  gap: 10px;
}

.report-bug-modal__file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.report-bug-modal__drop--has-file .report-bug-modal__file-input {
  pointer-events: none;
}

.report-bug-modal__pick {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 140px;
  padding: 16px;
  color: #bab1a8;
  pointer-events: none;
}

.report-bug-modal__pick-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.35rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #fff;
}

.report-bug-modal__pick-sub {
  font-size: 0.82rem;
  color: #888;
}

.report-bug-modal__preview {
  display: block;
  width: 100%;
  max-height: 220px;
  object-fit: contain;
  background: #111;
  border: 2px solid #333;
}

.report-bug-modal__preview-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  position: relative;
  z-index: 2;
}

.report-bug-modal__preview-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.report-bug-modal__file-name {
  font-size: 0.82rem;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.report-bug-modal__error {
  margin: 8px 0 0;
  font-size: 0.82rem;
  color: #e2534b;
}
</style>
