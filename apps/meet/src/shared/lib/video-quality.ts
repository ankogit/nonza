export type VideoQualityLevel = "360p" | "720p" | "1080p";

export interface VideoQualityConstraintsConfig {
  width?: number;
  height?: number;
  frameRate?: number;
}

const STORAGE_KEY_DEFAULT_VIDEO_QUALITY = "nonza_default_video_quality";

export const DEFAULT_VIDEO_QUALITY_LEVEL: VideoQualityLevel = "1080p";

export function getStoredDefaultVideoQuality(): VideoQualityLevel {
  try {
    const v = localStorage.getItem(STORAGE_KEY_DEFAULT_VIDEO_QUALITY);
    if (v === "360p" || v === "720p" || v === "1080p") return v;
  } catch {}
  return DEFAULT_VIDEO_QUALITY_LEVEL;
}

export function setStoredDefaultVideoQuality(level: VideoQualityLevel): void {
  try {
    localStorage.setItem(STORAGE_KEY_DEFAULT_VIDEO_QUALITY, level);
  } catch {}
}

export function getVideoConstraintsForQuality(
  level: VideoQualityLevel,
): MediaTrackConstraints {
  const base: VideoQualityConstraintsConfig =
    level === "1080p"
      ? { width: 1920, height: 1080, frameRate: 30 }
      : level === "720p"
        ? { width: 1280, height: 720, frameRate: 30 }
        : { width: 640, height: 360, frameRate: 24 };

  if (level === "1080p") {
    return {
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
      frameRate: { ideal: 30, min: 24 },
    };
  }
  return {
    width: { ideal: base.width },
    height: { ideal: base.height },
    frameRate: { ideal: base.frameRate },
  };
}

export function getDisplayMediaVideoConstraints(
  level: VideoQualityLevel = getStoredDefaultVideoQuality(),
): MediaTrackConstraints {
  const base =
    level === "1080p"
      ? { width: 1920, height: 1080, frameRate: 30 }
      : level === "720p"
        ? { width: 1280, height: 720, frameRate: 30 }
        : { width: 640, height: 360, frameRate: 24 };
  return {
    width: { ideal: base.width },
    height: { ideal: base.height },
    frameRate: { ideal: base.frameRate },
  };
}

