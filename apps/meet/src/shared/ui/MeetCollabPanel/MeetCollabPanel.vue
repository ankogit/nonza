<template>
  <div class="meet-collab-panel">
    <div class="meet-collab-panel__header">
      <h3 class="meet-collab-panel__title">{{ title }}</h3>
    </div>
    <div class="meet-collab-panel__body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<style scoped>
.meet-collab-panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  max-height: 100%;
  background: #1f1f1f;
  border: 2px solid #444;
  box-sizing: border-box;
  overflow: hidden;
}

.meet-collab-panel__header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 2px solid #444;
  background: #2a2a2a;
  flex-shrink: 0;
}

.meet-collab-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #bab1a8;
  font-family: "Bebas Neue", sans-serif;
  letter-spacing: 0.02em;
}

.meet-collab-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
