<template>
  <ScreenLayout narrow>
    <div class="create-organization-screen__card">
      <PageHeader title="Создать организацию" />
      <form @submit.prevent="submit" class="create-organization-screen__form">
        <FormSection label="Название">
          <Input
            id="org-name"
            v-model="name"
            type="text"
            placeholder="Название организации"
          />
        </FormSection>
        <FormSection label="Описание (необязательно)">
          <Input
            id="org-desc"
            v-model="description"
            type="text"
            placeholder="Краткое описание"
          />
        </FormSection>
        <div v-if="error" class="create-organization-screen__error">{{ error }}</div>
        <div class="create-organization-screen__actions">
          <Button
            type="text"
            variant="default"
            size="medium"
            native-type="button"
            @click="$emit('cancel')"
          >
            Отмена
          </Button>
          <Button
            type="text"
            variant="primary"
            size="medium"
            native-type="submit"
            :disabled="!name.trim() || submitting"
          >
            {{ submitting ? "Создание..." : "Создать" }}
          </Button>
        </div>
      </form>
    </div>
  </ScreenLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ScreenLayout, PageHeader, FormSection, Input, Button } from "@shared/ui";
import { OrganizationApi } from "@shared/entities";
import { useApiClient } from "@shared/api";
import type { Organization } from "@shared/entities";

const emit = defineEmits<{
  created: [org: Organization];
  cancel: [];
}>();

const apiClient = useApiClient();
const organizationApi = new OrganizationApi(apiClient);

const name = ref("");
const description = ref("");
const error = ref<string | null>(null);
const submitting = ref(false);

async function submit() {
  if (!name.value.trim()) return;
  error.value = null;
  submitting.value = true;
  try {
    const org = await organizationApi.create({
      name: name.value.trim(),
      description: description.value.trim() || undefined,
    });
    emit("created", org);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Не удалось создать организацию";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.create-organization-screen__card {
  background: #2a2a2a;
  border: 2px solid #444;
  padding: 24px;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
}

.create-organization-screen__form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.create-organization-screen__actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 2px solid #444;
}

.create-organization-screen__error {
  padding: 12px;
  background: rgba(231, 76, 60, 0.2);
  border: 2px solid #e2534b;
  color: #e2534b;
  font-size: 14px;
}
</style>
