<template>
  <div class="replica-input">
    <input
      v-model="inputText"
      type="text"
      class="replica-input__field"
      placeholder="Реплика..."
      :maxlength="props.maxLength ?? 100"
      @keydown.enter="submit"
    />
    <Button
      variant="default"
      class="replica-input__btn"
      title="Отправить реплику"
      @click="submit"
    >
      💬
    </Button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@shared/ui";

const props = defineProps<{
  maxLength?: number;
}>();

const emit = defineEmits<{
  submit: [text: string];
}>();

const inputText = ref("");

function submit() {
  emit("submit", inputText.value);
  inputText.value = "";
}
</script>

<style scoped>
.replica-input {
  display: inline-flex;
  align-items: center;
}

.replica-input__field {
  width: 140px;
  height: 48px;
  padding: 6px 10px;
  border: 3px solid #444;
  border-right: none;
  background: #1a1a1a;
  color: #bab1a8;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  font-family: "Bebas Neue", sans-serif;
}

.replica-input__field::placeholder {
  color: #666;
  font-family: "Bebas Neue", sans-serif;
}

.replica-input__field:focus {
  border-color: #2980b9;
}

.replica-input__btn {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .replica-input__field {
    width: 100px;
    height: 40px;
    padding: 4px 8px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .replica-input__field {
    width: 84px;
    height: 36px;
    padding: 4px 6px;
    font-size: 11px;
  }
}
</style>
