<template>
  <svg
    v-if="name === 'google'"
    class="social-provider-icon social-provider-icon--google"
    viewBox="0 0 24 24"
    width="28"
    height="28"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
  <img
    v-else-if="name === 'mandarinshow'"
    class="social-provider-icon social-provider-icon--mandarinshow"
    :src="mandarinshowIconUrl"
    alt=""
    decoding="async"
  />
  <svg
    v-else-if="name === 'keycloak'"
    class="social-provider-icon social-provider-icon--keycloak"
    viewBox="0 0 24 24"
    width="28"
    height="28"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="#00B8E3"
      d="M12 2 4 6v12l8 4 8-4V6l-8-4Zm0 2.2 5.5 2.75L12 9.7 6.5 6.95 12 4.2Zm-6 4.55 5.5 2.75v5.5L6 14.25V8.75Zm7 8.25 5.5-2.75v-5.5L13 11.5v5.5Z"
    />
    <path fill="#4D4D4D" d="M12 4.2v5.5l6 3v-5.5L12 4.2Zm0 5.5-6 3v5.5l6-3v-5.5Z" opacity="0.35" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    name: "google" | "mandarinshow" | "keycloak";
    mandarinshowIconUrl?: string;
  }>(),
  {
    mandarinshowIconUrl:
      "https://mandarinshow.ru/assets/img/main_iconv2_op.png",
  },
);
</script>

<style scoped>
.social-provider-icon {
  display: block;
  flex-shrink: 0;
}

.social-provider-icon--mandarinshow {
  display: block;
  height: 28px;
  width: auto;
  max-width: 32px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  object-fit: contain;
}
</style>
