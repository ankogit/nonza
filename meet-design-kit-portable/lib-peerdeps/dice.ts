export type DiceRollMode = "normal" | "advantage" | "disadvantage";

export type DiceRollResult = {
  expression: string;
  total: number;
  terms: Array<{
    count: number;
    sides: number;
    rolls: number[];
    kept?: number[];
    mode?: DiceRollMode;
  }>;
  modifier: number;
};

function randIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollDie(sides: number): number {
  return randIntInclusive(1, sides);
}

export function rollD20(mode: DiceRollMode = "normal") {
  const a = rollDie(20);
  if (mode === "normal") return { rolls: [a], kept: [a], total: a };
  const b = rollDie(20);
  const kept = mode === "advantage" ? Math.max(a, b) : Math.min(a, b);
  return { rolls: [a, b], kept: [kept], total: kept };
}

type ParsedTerm = { count: number; sides: number };

function parseExpression(expr: string): {
  terms: ParsedTerm[];
  modifier: number;
  normalized: string;
} {
  const raw = expr.trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) {
    return { terms: [], modifier: 0, normalized: "" };
  }

  const cleaned = raw.replace(/−/g, "-");
  const normalized = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

  const parts = normalized.split(/(?=[+-])/g).filter(Boolean);
  const terms: ParsedTerm[] = [];
  let modifier = 0;

  for (const part of parts) {
    const sign = part.startsWith("-") ? -1 : 1;
    const token = part.replace(/^[+-]/, "");
    if (!token) continue;

    const diceMatch = token.match(/^(\d*)d(\d+)$/);
    if (diceMatch) {
      const count = Math.max(1, Number(diceMatch[1] || "1"));
      const sides = Number(diceMatch[2]);
      if (!Number.isFinite(sides) || sides <= 1) continue;
      if (sign === -1) {
        modifier += -count;
        terms.push({ count: 0, sides });
      } else {
        terms.push({ count, sides });
      }
      continue;
    }

    const num = Number(token);
    if (Number.isFinite(num)) modifier += sign * num;
  }

  return { terms: terms.filter((t) => t.count > 0), modifier, normalized };
}

export function rollDiceExpression(
  expression: string,
  opts?: { d20Mode?: DiceRollMode },
): DiceRollResult | null {
  const parsed = parseExpression(expression);
  if (!parsed.normalized) return null;

  const resultTerms: DiceRollResult["terms"] = [];
  let total = parsed.modifier;

  for (const term of parsed.terms) {
    if (term.sides === 20 && opts?.d20Mode && opts.d20Mode !== "normal" && term.count === 1) {
      const r = rollD20(opts.d20Mode);
      total += r.total;
      resultTerms.push({
        count: 1,
        sides: 20,
        rolls: r.rolls,
        kept: r.kept,
        mode: opts.d20Mode,
      });
      continue;
    }

    const rolls: number[] = [];
    for (let i = 0; i < term.count; i++) rolls.push(rollDie(term.sides));
    const sum = rolls.reduce((a, b) => a + b, 0);
    total += sum;
    resultTerms.push({ count: term.count, sides: term.sides, rolls });
  }

  return {
    expression: parsed.normalized,
    total,
    terms: resultTerms,
    modifier: parsed.modifier,
  };
}

