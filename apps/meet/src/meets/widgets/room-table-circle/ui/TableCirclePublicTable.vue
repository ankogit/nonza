<template>
  <div class="public-table meet-scroll">
    <div class="public-table__controls">
      <div class="public-table__roll-row">
        <input
          v-model="expression"
          type="text"
          class="public-table__roll-field"
          placeholder="d20, 2d6+3, 1d100"
          maxlength="64"
          :disabled="!canRoll"
          @keydown.enter.exact.prevent="doRoll"
        />
        <Button
          variant="default"
          class="public-table__roll-btn"
          title="Бросить"
          :disabled="!canRoll || !expression.trim()"
          @click="doRoll"
        >
          <PixelIcon name="dice" variant="large" />
        </Button>
      </div>

      <div class="public-table__presets">
        <Button
          v-for="p in presets"
          :key="p"
          class="public-table__btn"
          type="text"
          variant="default"
          size="small"
          @click="expression = p"
        >
          {{ p }}
        </Button>
      </div>

      <div class="public-table__modes">
        <Button
          class="public-table__btn"
          type="text"
          variant="default"
          size="small"
          :class="{ active: d20Mode === 'normal' }"
          @click="d20Mode = 'normal'"
        >
          Normal
        </Button>
        <Button
          class="public-table__btn"
          type="text"
          variant="default"
          size="small"
          :class="{ active: d20Mode === 'advantage' }"
          @click="d20Mode = 'advantage'"
        >
          Adv
        </Button>
        <Button
          class="public-table__btn"
          type="text"
          variant="default"
          size="small"
          :class="{ active: d20Mode === 'disadvantage' }"
          @click="d20Mode = 'disadvantage'"
        >
          Dis
        </Button>
      </div>
    </div>

    <div class="public-table__latest" v-if="latestRoll">
      <div class="public-table__latest-total">
        <span class="public-table__latest-label">Итого</span>
        <span class="public-table__latest-value">{{ latestRoll.total }}</span>
      </div>
      <div class="public-table__latest-meta">
        <span class="public-table__latest-expr">{{
          latestRoll.expression
        }}</span>
        <span class="public-table__latest-who">
          {{ resolveName(latestRoll.rollerIdentity) }}
        </span>
      </div>
    </div>
    <div v-else class="public-table__empty color-white-60">
      Пока нет бросков
    </div>

    <div class="public-table__history">
      <div class="public-table__history-head">
        <div class="public-table__history-title">Лог</div>
      </div>
      <div
        v-if="rolls.length === 0"
        class="public-table__history-empty color-white-60"
      >
        ---
      </div>
      <div v-else class="public-table__history-list">
        <div v-for="r in rolls" :key="r.id" class="public-table__history-item">
          <div class="public-table__history-main">
            <div class="public-table__history-expr">{{ r.expression }}</div>
            <div class="public-table__history-total">{{ r.total }}</div>
          </div>
          <div class="public-table__history-sub">
            <span class="public-table__history-who">{{
              resolveName(r.rollerIdentity)
            }}</span>
            <span class="public-table__history-ts">{{ formatTs(r.ts) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type {
  LocalParticipant,
  RemoteParticipant,
  Room as LiveKitRoom,
} from "livekit-client";
import type { DiceRollMode } from "@shared/lib";
import { Button } from "@shared/ui";
import PixelIcon from "@shared/ui/PixelIcon/PixelIcon.vue";
import { useTableCircleDice } from "@features/table-circle";

const props = defineProps<{
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[];
  participantName: string;
  getDisplayName?: (p: RemoteParticipant | LocalParticipant) => string;
  livekitRoom: LiveKitRoom | null;
}>();

const expression = ref("d20");
const d20Mode = ref<DiceRollMode>("normal");

const { rolls, canRoll, roll } = useTableCircleDice(
  () => props.localParticipant,
  () => props.livekitRoom,
);

const latestRoll = computed(() => rolls.value[0] ?? null);
const presets = ["d4", "d6", "d8", "d10", "d12", "d20", "d100", "2d6+3"];

const remoteById = computed(() => {
  const m = new Map<string, RemoteParticipant>();
  for (const p of props.remoteParticipants) m.set(p.identity, p);
  return m;
});

function resolveName(identity: string) {
  if (props.localParticipant?.identity === identity)
    return props.participantName;
  const p = remoteById.value.get(identity);
  if (!p) return identity;
  return props.getDisplayName?.(p) ?? p.name ?? p.identity;
}

function doRoll() {
  const expr = expression.value.trim();
  if (!expr) return;
  roll(expr, d20Mode.value);
}

function formatTs(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
</script>

<style scoped>
.public-table {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.public-table__controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.public-table__roll-row {
  display: flex;
  align-items: center;
}

.public-table__roll-field {
  flex: 1;
  min-width: 0;
  height: 48px;
  padding: 6px 10px;
  border: 3px solid #444;
  border-right: none;
  border-radius: 0;
  appearance: none;
  -webkit-appearance: none;
  background: #1a1a1a;
  color: #bab1a8;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  font-family: "Bebas Neue", sans-serif;
  filter: drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.25));
}

.public-table__roll-field::placeholder {
  color: #666;
  font-family: "Bebas Neue", sans-serif;
}

.public-table__roll-field:focus {
  border-color: #2980b9;
}

.public-table__roll-field:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.public-table__roll-btn {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .public-table__roll-field {
    height: 40px;
    padding: 4px 8px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .public-table__roll-field {
    height: 36px;
    padding: 4px 6px;
    font-size: 11px;
  }
}

.public-table__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.public-table__modes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.public-table__btn {
  min-height: 36px;
  height: 36px;
  padding: 0 10px;
  font-size: 14px;
  line-height: 1;
}

.public-table__latest {
  border: 2px solid #444;
  background: #1a1a1a;
  padding: 10px;
  border-radius: 10px;
}

.public-table__latest-total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.public-table__latest-label {
  color: #ccc;
  font-size: 12px;
  font-weight: 600;
}

.public-table__latest-value {
  color: white;
  font-size: 24px;
  font-weight: 800;
}

.public-table__latest-meta {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.public-table__latest-expr {
  color: #ffc866;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.public-table__latest-who {
  color: #ccc;
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
}

.public-table__empty {
  border: 2px dashed #333;
  padding: 14px;
  text-align: center;
}

.public-table__history {
  min-height: 0;
  flex: 1;
  border-top: 1px solid #333;
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.public-table__history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.public-table__history-title {
  color: #ccc;
  font-size: 12px;
  font-weight: 700;
}

.public-table__history-empty {
  color: #aaa;
  text-align: center;
  padding: 14px 0;
}

.public-table__history-list {
  min-height: 0;
  flex: 1;
  overflow: visible;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.public-table__history-item {
  border: 1px solid #333;
  background: #111;
  padding: 10px;
  border-radius: 10px;
}

.public-table__history-main {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.public-table__history-expr {
  color: #ccc;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}

.public-table__history-total {
  color: white;
  font-weight: 900;
}

.public-table__history-sub {
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #aaa;
  font-size: 12px;
}

.public-table__history-who {
  color: #ccc;
  font-weight: 600;
}
</style>
