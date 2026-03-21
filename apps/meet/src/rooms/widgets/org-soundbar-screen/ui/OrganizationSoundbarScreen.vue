<template>
  <ScreenLayout narrow>
    <div class="org-soundbar-screen">
      <header class="org-soundbar-screen__header">
        <h2 class="org-soundbar-screen__title">Soundbar</h2>
        <Button
          type="icon"
          variant="default"
          :icon-size="'32px'"
          title="Назад"
          aria-label="Назад"
          @click="emit('back')"
        >
          <PixelIcon name="close" :size="22" />
        </Button>
      </header>
      <div class="org-soundbar-screen__body">
        <OrganizationSoundBarSettings :org-id="orgId" :can-edit="canEdit" />
      </div>
    </div>
  </ScreenLayout>
</template>

<script setup lang="ts">
import { OrganizationSoundBarSettings } from "@features/sound-bar";
import { Button, PixelIcon, ScreenLayout } from "@shared/ui";

defineProps<{
  orgId: string;
  canEdit: boolean;
}>();

const emit = defineEmits<{
  back: [];
}>();
</script>

<style scoped>
.org-soundbar-screen {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.org-soundbar-screen__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.org-soundbar-screen__title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #e8e4dc;
}

.org-soundbar-screen__body {
  min-height: 0;
}
</style>
