<template>
  <component
    :is="tag"
    class="metro-tile"
    :class="[
      `metro-tile--${variant}`,
      `metro-tile--${size}`,
      {
        'metro-tile--clickable': clickable,
        'metro-tile--has-mark': !!mark || !!$slots.mark,
      },
    ]"
    :href="tag === 'a' ? href : undefined"
    :target="tag === 'a' ? target : undefined"
    :rel="tag === 'a' ? rel : undefined"
    :type="tag === 'button' ? nativeType : undefined"
    :disabled="tag === 'button' ? disabled : undefined"
    @click="onClick"
  >
    <span v-if="mark || $slots.mark" class="metro-tile__mark" aria-hidden="true">
      <slot name="mark">{{ mark }}</slot>
    </span>
    <div class="metro-tile__inner">
      <div v-if="kicker || $slots.kicker" class="metro-tile__kicker">
        <slot name="kicker">{{ kicker }}</slot>
      </div>
      <div v-if="$slots.media" class="metro-tile__media">
        <slot name="media" />
      </div>
      <div v-if="title || $slots.title" class="metro-tile__title">
        <slot name="title">{{ title }}</slot>
      </div>
      <p v-if="subtitle || $slots.subtitle" class="metro-tile__sub">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
      <div v-if="$slots.default" class="metro-tile__body">
        <slot />
      </div>
      <div v-if="foot || $slots.foot" class="metro-tile__foot">
        <slot name="foot">{{ foot }}</slot>
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";

export type MetroTileVariant =
  | "blue"
  | "green"
  | "gold"
  | "red"
  | "purple"
  | "dark"
  | "neutral";

export type MetroTileSize = "default" | "nav" | "rect" | "hero" | "wide";

const props = withDefaults(
  defineProps<{
    variant?: MetroTileVariant;
    size?: MetroTileSize;
    kicker?: string;
    title?: string;
    subtitle?: string;
    foot?: string;
    mark?: string;
    clickable?: boolean;
    href?: string;
    target?: string;
    rel?: string;
    tag?: "div" | "button" | "a";
    nativeType?: "button" | "submit" | "reset";
    disabled?: boolean;
  }>(),
  {
    variant: "dark",
    size: "rect",
    clickable: false,
    tag: undefined,
    nativeType: "button",
    disabled: false,
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const tag = computed(() => {
  if (props.tag) return props.tag;
  if (props.href) return "a";
  if (props.clickable) return "button";
  return "div";
});

const rel = computed(() => {
  if (props.rel) return props.rel;
  if (props.target === "_blank") return "noopener noreferrer";
  return undefined;
});

function onClick(event: MouseEvent) {
  if (props.disabled) {
    event.preventDefault();
    return;
  }
  emit("click", event);
}
</script>

<style scoped>
.metro-tile {
  --metro-tile-w: 248px;
  --metro-tile-h: 108px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: stretch;
  padding: 0;
  width: var(--metro-tile-w);
  min-width: 0;
  height: var(--metro-tile-h);
  min-height: var(--metro-tile-h);
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-radius: 0;
  background: #2a2a2a;
  color: #fff;
  text-decoration: none;
  text-align: left;
  font: inherit;
  overflow: hidden;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  outline: 3px solid transparent;
  outline-offset: 2px;
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    outline-color 0.12s ease;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
  isolation: isolate;
}

.metro-tile::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.05) 0%,
    transparent 45%,
    rgba(0, 0, 0, 0.08) 100%
  );
  pointer-events: none;
  z-index: 0;
}

.metro-tile--blue {
  background: #2980b9;
}

.metro-tile--green {
  background: #1f6b4a;
}

.metro-tile--gold {
  background: #8a5a12;
  color: #fff7e8;
}

.metro-tile--red {
  background: #6b2f2f;
}

.metro-tile--purple {
  background: #3d2a5c;
}

.metro-tile--dark {
  background: #222222;
}

.metro-tile--neutral {
  background: #2a2a2a;
}

.metro-tile--default,
.metro-tile--rect {
  width: var(--metro-tile-w);
  height: var(--metro-tile-h);
}

.metro-tile--nav {
  --metro-tile-w: 148px;
  --metro-tile-h: 148px;
  width: var(--metro-tile-w);
  height: var(--metro-tile-h);
}

.metro-tile--hero {
  --metro-tile-w: 100%;
  --metro-tile-h: 180px;
  width: 100%;
  height: auto;
  min-height: 180px;
}

.metro-tile--wide {
  --metro-tile-w: 100%;
  --metro-tile-h: auto;
  width: 100%;
  height: auto;
  min-height: 0;
}

.metro-tile__inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 12px 14px 10px;
  box-sizing: border-box;
}

.metro-tile--has-mark .metro-tile__inner {
  padding-right: 56px;
}

.metro-tile__mark {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 0;
  max-width: calc(100% - 8px);
  max-height: 85%;
  overflow: hidden;
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(3.2rem, 7vw, 4.4rem);
  line-height: 0.8;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.1);
  pointer-events: none;
  user-select: none;
  transform: rotate(-3deg);
  transform-origin: bottom right;
  transition: color 0.12s ease;
  white-space: nowrap;
  text-align: right;
  padding: 0 6px 2px 0;
  box-sizing: border-box;
}

.metro-tile--clickable,
a.metro-tile,
button.metro-tile {
  cursor: pointer;
}

.metro-tile--clickable:hover,
a.metro-tile:hover,
button.metro-tile:hover:not(:disabled) {
  transform: scale(1.015);
  outline-color: #fff;
  z-index: 2;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.4);
}

.metro-tile--clickable:hover .metro-tile__mark,
a.metro-tile:hover .metro-tile__mark,
button.metro-tile:hover:not(:disabled) .metro-tile__mark {
  color: rgba(255, 255, 255, 0.16);
}

.metro-tile--clickable:active,
a.metro-tile:active,
button.metro-tile:active:not(:disabled) {
  transform: scale(0.99);
}

.metro-tile--clickable:focus-visible,
a.metro-tile:focus-visible,
button.metro-tile:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
  z-index: 3;
  transform: scale(1.015);
}

button.metro-tile:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.metro-tile__kicker {
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 7px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.8;
  line-height: 1.35;
  max-width: 100%;
}

.metro-tile__title {
  font-family: "Bebas Neue", sans-serif;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: clamp(1.35rem, 2.2vw, 1.75rem);
  line-height: 0.95;
  margin: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
  width: 100%;
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.metro-tile--nav .metro-tile__title {
  margin-top: auto;
  max-width: 100%;
  font-size: clamp(1.25rem, 2vw, 1.55rem);
}

.metro-tile--rect .metro-tile__title,
.metro-tile--default .metro-tile__title {
  margin-top: auto;
}

.metro-tile__sub {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.3;
  margin: 0;
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.metro-tile__media {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
  min-width: 0;
  max-width: 100%;
}

.metro-tile__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  width: 100%;
  margin-top: auto;
}

.metro-tile__foot {
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 7px;
  opacity: 0.72;
  line-height: 1.35;
  margin-top: 2px;
  max-width: 100%;
}

.metro-tile--wide .metro-tile__inner,
.metro-tile--hero .metro-tile__inner {
  gap: 10px;
  padding: 16px 18px 14px;
}

.metro-tile--wide .metro-tile__title,
.metro-tile--hero .metro-tile__title {
  max-width: 100%;
  margin-top: 0;
}

@media (max-width: 640px) {
  .metro-tile--default,
  .metro-tile--rect {
    --metro-tile-w: min(100%, 248px);
    --metro-tile-h: 100px;
  }

  .metro-tile--nav {
    --metro-tile-w: 140px;
    --metro-tile-h: 140px;
  }

  .metro-tile--wide,
  .metro-tile--hero {
    --metro-tile-w: 100%;
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .metro-tile {
    transition: none;
  }

  .metro-tile--clickable:hover,
  a.metro-tile:hover,
  button.metro-tile:hover:not(:disabled),
  .metro-tile--clickable:active,
  a.metro-tile:active,
  button.metro-tile:active:not(:disabled),
  .metro-tile--clickable:focus-visible,
  a.metro-tile:focus-visible,
  button.metro-tile:focus-visible {
    transform: none;
  }

  .metro-tile__mark {
    transition: none;
  }
}
</style>
