<template>
  <div
    v-if="state.isSupported"
    class="indicator"
    :class="{ success: state.isActive, default: !state.isActive }"
    :title="state.isActive ? 'E2EE включено' : 'E2EE выключено'"
  />
</template>

<script setup lang="ts">
import { useE2EE } from "../lib/useE2EE";
import type { Room } from "livekit-client";

const props = defineProps<{
  room: Room | null;
}>();

const { state } = useE2EE(props.room);
</script>
