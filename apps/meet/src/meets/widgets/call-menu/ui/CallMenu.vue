<template>
  <div class="call-menu menu bg-dark-20" :class="menuClass">
    <div class="left">
      <slot name="left" />
    </div>
    <div class="center">
      <slot name="center">
        <Button
          variant="danger"
          title="Закончить разговор"
          @click="$emit('disconnect')"
        >
          <PixelIcon name="hangup" variant="large" />
        </Button>
      </slot>
    </div>
    <div class="right">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button, PixelIcon } from "@shared/ui";

defineProps<{ menuClass?: string }>();
defineEmits<{ disconnect: [] }>();
</script>
