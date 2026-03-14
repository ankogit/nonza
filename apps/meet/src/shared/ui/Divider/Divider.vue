<template>
  <hr
    class="pixel-divider"
    :class="{ 'pixel-divider--vertical': vertical }"
    :aria-orientation="vertical ? 'vertical' : 'horizontal'"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    vertical?: boolean;
  }>(),
  {
    vertical: false,
  },
);
</script>

<style scoped>
.pixel-divider {
  background-color: var(--mc-core-grey-4, #444);
  box-shadow: 0 -0.125rem #00000040;
  height: 0.125rem;
  width: 100%;
  margin-top: 1rem;
  margin-bottom: 1rem;
  border: none;
}

.pixel-divider--vertical {
  width: 0.125rem;
  height: 100%;
  margin: 0 1rem;
  box-shadow: -0.125rem 0 #00000040;
}
</style>
