import { ref } from "vue";

const CHANNEL_NAME = "nonza-org-sounds";

const orgSoundsEpoch = ref<Record<string, number>>({});

let channel: BroadcastChannel | null = null;

function bumpLocal(orgId: string) {
  orgSoundsEpoch.value = {
    ...orgSoundsEpoch.value,
    [orgId]: (orgSoundsEpoch.value[orgId] ?? 0) + 1,
  };
}

function getOrCreateChannel(): BroadcastChannel {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (ev: MessageEvent<{ orgId?: string }>) => {
      const id = ev.data?.orgId;
      if (typeof id !== "string" || !id) return;
      bumpLocal(id);
    };
    channel = ch;
  }
  if (!channel) {
    throw new Error("BroadcastChannel unavailable");
  }
  return channel;
}

export function getOrganizationSoundsEpoch() {
  return orgSoundsEpoch;
}

export function notifyOrganizationSoundsChanged(orgId: string) {
  if (typeof BroadcastChannel !== "undefined") {
    try {
      getOrCreateChannel().postMessage({ orgId });
      return;
    } catch {
      /* fall through */
    }
  }
  bumpLocal(orgId);
}
