import { Track } from "livekit-client";
import type { LocalParticipant, RemoteParticipant } from "livekit-client";

export function isFullscreenPipDebugEnabled(): boolean {
  if (typeof localStorage === "undefined") return import.meta.env.DEV;
  try {
    const v = localStorage.getItem("nonza_debug_fullscreen_pip");
    if (v === "0") return false;
    if (v === "1") return true;
    return import.meta.env.DEV;
  } catch {
    return import.meta.env.DEV;
  }
}

export function logFullscreenPip(message: string, payload?: unknown): void {
  if (!isFullscreenPipDebugEnabled()) return;
  if (payload !== undefined) {
    console.log("[fullscreen-pip]", message, payload);
  } else {
    console.log("[fullscreen-pip]", message);
  }
}

type VideoPubLike = {
  source?: Track.Source;
  track?: { mediaStreamTrack: MediaStreamTrack };
  isSubscribed?: boolean;
  isMuted?: boolean;
};

function summarizePub(pub: VideoPubLike | undefined) {
  if (!pub) return null;
  return {
    source: pub.source,
    isSubscribed: pub.isSubscribed,
    isMuted: pub.isMuted,
    hasTrack: Boolean(pub.track),
    readyState: pub.track?.mediaStreamTrack?.readyState,
  };
}

export type FullscreenCameraPipEval = {
  show: boolean;
  reason: string;
  screenLive: boolean;
  cameraAllowed: boolean;
  screenPub: ReturnType<typeof summarizePub>;
  cameraPub: ReturnType<typeof summarizePub>;
  videoSources: ReturnType<typeof listVideoPublications>;
};

function listVideoPublications(
  participant: LocalParticipant | RemoteParticipant,
) {
  if (!participant.videoTrackPublications) return [];
  return Array.from(
    participant.videoTrackPublications.values() as Iterable<VideoPubLike>,
  ).map((pub) => summarizePub(pub));
}

export function evaluateFullscreenCameraPip(
  participant: LocalParticipant | RemoteParticipant | null,
  localIdentity: string | undefined,
): FullscreenCameraPipEval {
  if (!participant) {
    return {
      show: false,
      reason: "no_participant",
      screenLive: false,
      cameraAllowed: false,
      screenPub: null,
      cameraPub: null,
      videoSources: [],
    };
  }

  const isLocalP = localIdentity === participant.identity;
  const screenPub = participant.getTrackPublication?.(
    Track.Source.ScreenShare,
  ) as VideoPubLike | undefined;
  const cameraPub = participant.getTrackPublication?.(
    Track.Source.Camera,
  ) as VideoPubLike | undefined;

  const videoSources = listVideoPublications(participant);

  if (!screenPub || !cameraPub) {
    return {
      show: false,
      reason: !screenPub
        ? "missing_screen_publication"
        : "missing_camera_publication",
      screenLive: false,
      cameraAllowed: false,
      screenPub: summarizePub(screenPub),
      cameraPub: summarizePub(cameraPub),
      videoSources,
    };
  }

  const screenLive = Boolean(
    screenPub.track &&
      screenPub.track.mediaStreamTrack?.readyState !== "ended" &&
      (isLocalP || screenPub.isSubscribed !== false),
  );

  const cameraAllowed = isLocalP || cameraPub.isSubscribed !== false;
  const show = Boolean(screenLive && cameraAllowed);

  let reason = "ok";
  if (!show) {
    if (!screenLive) reason = "screen_not_live";
    else if (!cameraAllowed) reason = "camera_not_allowed";
  }

  return {
    show,
    reason,
    screenLive,
    cameraAllowed,
    screenPub: summarizePub(screenPub),
    cameraPub: summarizePub(cameraPub),
    videoSources,
  };
}

let lastLoggedGateJson: string | null = null;

export function logFullscreenPipGateIfChanged(
  identity: string | undefined,
  ev: FullscreenCameraPipEval,
): void {
  if (!isFullscreenPipDebugEnabled()) return;
  const key = `${identity ?? "?"}:${JSON.stringify(ev)}`;
  if (key === lastLoggedGateJson) return;
  lastLoggedGateJson = key;
  logFullscreenPip("gate", { identity, ...ev });
}

export function resetFullscreenPipGateLog(): void {
  lastLoggedGateJson = null;
}
