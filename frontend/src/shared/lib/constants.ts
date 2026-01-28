// Brand colors
export const BRAND_COLORS = {
  primary: "#e74c3c",
  secondary: "#2980B9",
  accent: "#FFBE53",
} as const;

// Room types
export const ROOM_TYPES = {
  CONFERENCE_HALL: "conference_hall",
  ROUND_TABLE: "round_table",
  MUSIC_LESSON: "music_lesson",
  STREAMING: "streaming",
} as const;

export type RoomType = (typeof ROOM_TYPES)[keyof typeof ROOM_TYPES];

// E2EE support
export const E2EE_SUPPORTED = "crypto" in window && "subtle" in window.crypto;
