// Brand colors
export const BRAND_COLORS = {
  primary: "#2980b9",
  secondary: "#191919",
  accent: "#ffc866",
  danger: "#e2534b",
  warning: "#ffc866",
  surfaceAlt: "#282741",
  success: "#0ead61",
} as const;

// Room types
export const ROOM_TYPES = {
  CONFERENCE_HALL: "conference_hall",
  ROUND_TABLE: "round_table",
  TABLE_CIRCLE: "table_circle",
  MUSIC_LESSON: "music_lesson",
  STREAMING: "streaming",
} as const;

export type RoomType = (typeof ROOM_TYPES)[keyof typeof ROOM_TYPES];

// E2EE support
export const E2EE_SUPPORTED = "crypto" in window && "subtle" in window.crypto;
