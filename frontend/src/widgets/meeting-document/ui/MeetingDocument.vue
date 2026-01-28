<template>
  <div class="meeting-document">
    <div class="meeting-document__header">
      <h3 class="meeting-document__title">
        {{ document?.title || "Заметки встречи" }}
      </h3>
    </div>
    <div class="meeting-document__content">
      <textarea
        v-model="content"
        class="meeting-document__editor"
        placeholder="Начните делать заметки..."
        @input="handleInput"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, withDefaults } from "vue";
import type { MeetingDocument } from "@entities/meeting-document";

const props = withDefaults(
  defineProps<{
    document: MeetingDocument | null;
  }>(),
  {
    document: null,
  },
);

const emit = defineEmits<{
  update: [content: string];
}>();

const content = ref(
  props.document?.content ||
    "# Заметки встречи\n\nНачните делать заметки здесь...",
);

watch(
  () => props.document,
  (newDoc) => {
    if (newDoc) {
      content.value = newDoc.content;
    }
  },
  { immediate: true },
);

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit("update", target.value);
};
</script>

<style scoped>
.meeting-document {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 0;
  border: 2px solid #444;
  overflow: hidden;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
}

.meeting-document__header {
  padding: 16px;
  border-bottom: 2px solid #e0e0e0;
  background: #f5f5f5;
}

.meeting-document__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.meeting-document__content {
  flex: 1;
  overflow: hidden;
}

.meeting-document__editor {
  width: 100%;
  height: 100%;
  padding: 16px;
  border: none;
  outline: none;
  resize: none;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  background: white;
  border-radius: 0;
}

.meeting-document__editor:focus {
  outline: 2px solid #2980b9;
  outline-offset: -2px;
}
</style>
