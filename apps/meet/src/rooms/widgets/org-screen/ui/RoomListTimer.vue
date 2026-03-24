<template>
  <span
    v-if="label"
    class="room-session-timer"
    aria-label="Время в комнате"
    >{{ label }}</span
  >
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";

const props = defineProps<{
  enabled?: boolean;
  startedAt?: string | null;
}>();

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const tick = ref(0);
let intervalId: ReturnType<typeof setInterval> | null = null;

watch(
  () => [props.enabled, props.startedAt] as const,
  () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    tick.value = 0;
    if (props.enabled && props.startedAt) {
      intervalId = setInterval(() => {
        tick.value++;
      }, 1000);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
});

const label = computed(() => {
  void tick.value;
  if (!props.enabled || !props.startedAt) return "";
  const t = Date.parse(props.startedAt);
  if (Number.isNaN(t)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000));
  return formatHMS(secs);
});
</script>
