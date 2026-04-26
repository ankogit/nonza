<template>
  <div class="dice-roller">
    <div class="dice-roller__row">
      <Input
        v-model.trim="expr"
        placeholder="Например: d20, 2d6+3, 1d100"
        maxlength="64"
        @keydown.enter.prevent="doRoll()"
      />
      <Button type="text" variant="primary" size="small" :disabled="!expr" @click="doRoll()">
        Бросить
      </Button>
    </div>

    <div class="dice-roller__presets">
      <Button
        v-for="p in presets"
        :key="p"
        type="text"
        variant="default"
        size="small"
        @click="expr = p"
      >
        {{ p }}
      </Button>
      <div class="dice-roller__mode">
        <Button
          type="text"
          variant="default"
          size="small"
          :class="{ active: d20Mode === 'advantage' }"
          @click="toggleMode('advantage')"
        >
          Adv
        </Button>
        <Button
          type="text"
          variant="default"
          size="small"
          :class="{ active: d20Mode === 'disadvantage' }"
          @click="toggleMode('disadvantage')"
        >
          Dis
        </Button>
      </div>
    </div>

    <div v-if="last" class="dice-roller__result">
      <div class="dice-roller__total">
        <span class="dice-roller__total-label">Итого</span>
        <span class="dice-roller__total-value">{{ last.total }}</span>
      </div>
      <div class="dice-roller__details">
        <div class="dice-roller__expr">{{ last.expression }}</div>
        <div v-for="(t, i) in last.terms" :key="i" class="dice-roller__term">
          <span class="dice-roller__term-head">{{ t.count }}d{{ t.sides }}</span>
          <span class="dice-roller__term-rolls">
            [{{ t.rolls.join(", ") }}]{{ t.kept ? ` → ${t.kept[0]}` : "" }}
          </span>
        </div>
        <div v-if="last.modifier" class="dice-roller__modifier">
          Модификатор: {{ last.modifier > 0 ? `+${last.modifier}` : last.modifier }}
        </div>
      </div>
    </div>

    <div v-if="history.length" class="dice-roller__history">
      <div class="dice-roller__history-head">
        <div class="dice-roller__history-title">История</div>
        <Button type="text" variant="default" size="small" @click="history = []">Очистить</Button>
      </div>
      <div class="dice-roller__history-list">
        <button
          v-for="(h, idx) in history"
          :key="idx"
          type="button"
          class="dice-roller__history-item"
          @click="last = h"
        >
          <span class="dice-roller__history-expr">{{ h.expression }}</span>
          <span class="dice-roller__history-total">{{ h.total }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { rollDiceExpression, type DiceRollMode, type DiceRollResult } from "@shared/lib";
import { Button, Input } from "@shared/ui";

const expr = ref("d20");
const d20Mode = ref<DiceRollMode>("normal");
const last = ref<DiceRollResult | null>(null);
const history = ref<DiceRollResult[]>([]);

const presets = ["d4", "d6", "d8", "d10", "d12", "d20", "d100", "2d6+3"];

function toggleMode(mode: Exclude<DiceRollMode, "normal">) {
  d20Mode.value = d20Mode.value === mode ? "normal" : mode;
}

function doRoll() {
  const res = rollDiceExpression(expr.value, { d20Mode: d20Mode.value });
  if (!res) return;
  last.value = res;
  history.value = [res, ...history.value].slice(0, 12);
}
</script>

<style scoped>
.dice-roller {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dice-roller__row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
}

.dice-roller__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.dice-roller__mode {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.dice-roller__result {
  border: 2px solid #444;
  background: #1a1a1a;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.25);
  padding: 12px;
  display: grid;
  gap: 10px;
}

.dice-roller__total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.dice-roller__total-label {
  color: #ccc;
  font-size: 12px;
  font-weight: 600;
}

.dice-roller__total-value {
  font-size: 24px;
  font-weight: 700;
  color: white;
}

.dice-roller__expr {
  color: #ffc866;
  font-weight: 600;
  margin-bottom: 6px;
}

.dice-roller__term {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  color: #ddd;
  font-size: 13px;
}

.dice-roller__term-head {
  color: #fff;
  font-weight: 600;
}

.dice-roller__modifier {
  color: #ccc;
  font-size: 12px;
  margin-top: 6px;
}

.dice-roller__history {
  border-top: 1px solid #333;
  padding-top: 12px;
}

.dice-roller__history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dice-roller__history-title {
  color: #ccc;
  font-size: 12px;
  font-weight: 600;
}

.dice-roller__history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dice-roller__history-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid #333;
  background: #111;
  color: #ddd;
  cursor: pointer;
  text-align: left;
}

.dice-roller__history-item:hover {
  border-color: #444;
}

.dice-roller__history-expr {
  color: #ccc;
}

.dice-roller__history-total {
  color: white;
  font-weight: 700;
}
</style>

