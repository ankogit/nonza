<template>
  <div class="replica-input">
    <input
      v-model="inputText"
      type="text"
      class="replica-input__field"
      placeholder="Реплика..."
      :maxlength="props.maxLength ?? REPLICA_TEXT_MAX_LENGTH"
      @keydown.enter="submit"
    />
    <Button
      variant="default"
      class="replica-input__btn"
      title="Отправить реплику"
      @click="submit"
    >
      <PixelIcon name="message" variant="large" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Button, PixelIcon } from "@shared/ui";
import { REPLICA_TEXT_MAX_LENGTH } from "../lib/replica-limits";

const props = defineProps<{
  maxLength?: number;
}>();

const emit = defineEmits<{
  submit: [payload: { text: string; accept: () => void }];
}>();

const inputText = ref("");

function submit() {
  emit("submit", {
    text: inputText.value,
    accept: () => {
      inputText.value = "";
    },
  });
}
</script>

<style scoped>
.replica-input {
  display: inline-flex;
  align-items: stretch;
  flex-shrink: 0;
  vertical-align: middle;
}

.replica-input__field {
  width: 140px;
  height: 48px;
  padding: 6px 10px;
  border: 3px solid #444;
  border-right: none;
  border-radius: 0;
  appearance: none;
  -webkit-appearance: none;
  background: #1a1a1a;
  color: #bab1a8;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  font-family: "Bebas Neue", sans-serif;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.25);
}

.replica-input__field::placeholder {
  color: #666;
  font-family: "Bebas Neue", sans-serif;
}

.replica-input__field:focus {
  border-color: #2980b9;
  z-index: 1;
}

.replica-input__btn {
  flex-shrink: 0;
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  min-height: 48px !important;
  box-sizing: border-box;
}

@media (max-width: 768px) {
  .replica-input__field {
    width: 88px;
    height: 44px;
    padding: 4px 8px;
    font-size: 12px;
    box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.25);
  }

  .replica-input__btn {
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    min-height: 44px !important;
  }
}

@media (max-width: 480px) {
  .replica-input__field {
    width: 72px;
    height: 42px;
    padding: 4px 6px;
    font-size: 11px;
  }

  .replica-input__btn {
    width: 42px !important;
    height: 42px !important;
    min-width: 42px !important;
    min-height: 42px !important;
  }
}
</style>
