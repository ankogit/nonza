<template>
  <SoundBarUploadPanel :org-id="orgId" :can-edit="canEdit" variant="page" />
</template>

<script setup lang="ts">
import SoundBarUploadPanel from "./SoundBarUploadPanel.vue";

defineProps<{
  orgId: string;
  canEdit: boolean;
}>();
</script>
