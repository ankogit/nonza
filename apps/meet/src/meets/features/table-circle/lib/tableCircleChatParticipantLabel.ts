import type { LocalParticipant, RemoteParticipant } from "livekit-client";

export function tableCircleParticipantDisplayName(
  p: LocalParticipant | RemoteParticipant,
  ctx: {
    localIdentity: string | undefined;
    participantName: string;
    getDisplayName?: (p: LocalParticipant | RemoteParticipant) => string;
  },
): string {
  if (p.identity === ctx.localIdentity) {
    const self = ctx.participantName.trim();
    if (self) return self;
  }
  const fromFn = ctx.getDisplayName?.(p)?.trim();
  if (fromFn) return fromFn;
  const fromLiveKit = (p.name ?? "").trim();
  if (fromLiveKit) return fromLiveKit;
  return p.identity;
}
