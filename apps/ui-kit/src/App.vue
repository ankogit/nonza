<template>
  <div class="ui-kit">
    <header class="ui-kit__header">
      <AppLogo size="compact" />
      <h1 class="ui-kit__title">UI Kit</h1>
    </header>
    <main class="ui-kit__main">
      <section class="ui-kit__section">
        <h2 class="ui-kit__section-title">Button</h2>
        <div class="ui-kit__row">
          <Button type="text" variant="primary">Primary</Button>
          <Button type="text" variant="secondary">Secondary</Button>
          <Button type="text" variant="accent">Accent</Button>
          <Button type="text" variant="danger">Danger</Button>
        </div>
      </section>
      <section class="ui-kit__section">
        <h2 class="ui-kit__section-title">Input</h2>
        <div class="ui-kit__column">
          <Input v-model="sample" placeholder="Placeholder" />
        </div>
      </section>
      <section class="ui-kit__section">
        <h2 class="ui-kit__section-title">Checkbox & Switch</h2>
        <div class="ui-kit__row ui-kit__row--align-center">
          <Checkbox v-model="checked">Label</Checkbox>
          <Switch v-model="on" />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { AppLogo, Button, Checkbox, Input, Switch } from "@shared/ui";

const sample = ref("");
const checked = ref(false);
const on = ref(false);
</script>

<style scoped>
.ui-kit {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  gap: 1.5rem;
}

.ui-kit__header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.ui-kit__title {
  font-family: "Bebas Neue", sans-serif;
  font-size: 2rem;
  font-weight: 400;
  letter-spacing: 0.04em;
}

.ui-kit__main {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 56rem;
}

.ui-kit__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ui-kit__section-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-secondary);
  font-weight: 600;
}

.ui-kit__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.ui-kit__row--align-center {
  align-items: center;
}

.ui-kit__column {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 20rem;
}
</style>
