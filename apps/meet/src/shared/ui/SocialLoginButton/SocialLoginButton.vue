<template>
  <button
    type="button"
    class="social-login-btn"
    :class="`social-login-btn--${provider}`"
    :disabled="disabled"
    :aria-label="ariaLabel || label"
    @click="emit('click', $event)"
  >
    <span class="social-login-btn__icon" aria-hidden="true">
      <SocialProviderIcon :name="provider" />
    </span>
    <span class="social-login-btn__label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import SocialProviderIcon from "../SocialProviderIcon/SocialProviderIcon.vue";

withDefaults(
  defineProps<{
    provider: "google" | "mandarinshow" | "keycloak";
    label: string;
    ariaLabel?: string;
    disabled?: boolean;
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<style scoped>
.social-login-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 56px;
  padding: 12px 16px;
  box-sizing: border-box;
  cursor: pointer;
  text-align: left;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.35rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
  color: #fff;
  background: rgba(0, 0, 0, 0.28);
  border: 3px solid #ffffff22;
  border-top-color: #ffffff38;
  border-left-color: #ffffff38;
  box-shadow: none;
  transition: background 0.12s ease;
}

.social-login-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.36);
}

.social-login-btn:active:not(:disabled) {
  background: rgba(0, 0, 0, 0.42);
}

.social-login-btn:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 2px;
}

.social-login-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.social-login-btn__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
}

.social-login-btn__icon :deep(.social-provider-icon--google) {
  width: 28px;
  height: 28px;
}

.social-login-btn__icon :deep(.social-provider-icon--mandarinshow) {
  width: auto;
  height: 28px;
  max-width: 32px;
  object-fit: contain;
}

.social-login-btn__icon :deep(.social-provider-icon--keycloak) {
  width: 28px;
  height: 28px;
}

.social-login-btn__label {
  flex: 1;
  min-width: 0;
}
</style>
