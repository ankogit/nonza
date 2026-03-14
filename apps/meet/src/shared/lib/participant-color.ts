import { BRAND_COLORS } from "./constants";

export const DEFAULT_PARTICIPANT_COLOR = BRAND_COLORS.primary;

const TURTLE_COLORS = [
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
];

export function getColorForUser(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TURTLE_COLORS[Math.abs(hash) % TURTLE_COLORS.length];
}

export const PARTICIPANT_COLOR_PALETTE = [
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
] as const;

export function parseParticipantColorFromMetadata(
  metadata: string | undefined,
  _fallbackName: string,
): string {
  if (!metadata?.trim()) return DEFAULT_PARTICIPANT_COLOR;
  try {
    const parsed = JSON.parse(metadata) as { color?: string };
    if (typeof parsed?.color === "string" && parsed.color.trim() !== "") {
      return parsed.color.trim();
    }
  } catch {
    // ignore
  }
  return DEFAULT_PARTICIPANT_COLOR;
}
