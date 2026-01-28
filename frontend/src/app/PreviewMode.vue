<template>
  <div class="preview-mode">
    <div class="preview-mode__header">
      <h1>Nonza Widget Preview</h1>
      <div class="preview-mode__controls">
        <label>
          <input type="radio" v-model="roomType" value="conference_hall" />
          Conference Hall
        </label>
        <label>
          <input type="radio" v-model="roomType" value="round_table" />
          Round Table
        </label>
        <button @click="toggleConnected" class="preview-button">
          {{ isConnected ? "Disconnect" : "Connect" }}
        </button>
      </div>
    </div>

    <div class="preview-mode__content">
      <RoomConferenceHall
        v-if="roomType === 'conference_hall' && isConnected"
        :room="mockRoom"
        :livekit-room="null"
        :participant-name="participantName"
        :api-base-u-r-l="''"
        :show-document="true"
        :preview-mode="true"
        @disconnect="handleDisconnect"
      />
      <RoomRoundTable
        v-else-if="roomType === 'round_table' && isConnected"
        :room="mockRoom"
        :livekit-room="null"
        :participant-name="participantName"
        :api-base-u-r-l="''"
        :show-document="true"
        :preview-mode="true"
        @disconnect="handleDisconnect"
      />
      <div v-else class="preview-mode__placeholder">
        <div class="preview-mode__placeholder-content">
          <h2>Preview Mode</h2>
          <p>Select room type and click "Connect" to see the UI</p>
          <div class="preview-mode__info">
            <p><strong>Room Type:</strong> {{ roomType }}</p>
            <p><strong>Participant:</strong> {{ participantName }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { RoomConferenceHall } from "@widgets/room-conference-hall";
import { RoomRoundTable } from "@widgets/room-round-table";
import type { Room } from "@entities/room";

const roomType = ref<"conference_hall" | "round_table">("conference_hall");
const isConnected = ref(false);
const participantName = ref("Preview User");

const mockRoom = computed<Room>(() => ({
  id: "mock-room-id",
  organization_id: "mock-org-id",
  name: "Preview Room",
  short_code: "abc-defg-hij",
  room_type: roomType.value,
  is_temporary: true,
  expires_at: null,
  livekit_room_name: "preview-room",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));

const toggleConnected = () => {
  isConnected.value = !isConnected.value;
};

const handleDisconnect = () => {
  isConnected.value = false;
};
</script>

<style scoped>
.preview-mode {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  color: white;
}

.preview-mode__header {
  padding: 16px;
  border-bottom: 2px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #2a2a2a;
}

.preview-mode__header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.preview-mode__controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.preview-mode__controls label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.preview-mode__controls input[type="radio"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.preview-button {
  padding: 8px 16px;
  border: 2px solid #2980b9;
  border-radius: 0;
  background: #2980b9;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  transition: none;
}

.preview-button:hover {
  background: #21618c;
}

.preview-button:active {
  box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 0.3);
  transform: translate(1px, 1px);
}

.preview-mode__content {
  flex: 1;
  overflow: hidden;
}

.preview-mode__placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.preview-mode__placeholder-content {
  text-align: center;
  max-width: 500px;
  padding: 32px;
  border: 2px solid #444;
  background: #2a2a2a;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
}

.preview-mode__placeholder-content h2 {
  margin: 0 0 16px 0;
  font-size: 28px;
  font-weight: 600;
}

.preview-mode__placeholder-content p {
  margin: 0 0 24px 0;
  font-size: 16px;
  color: #ccc;
}

.preview-mode__info {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 2px solid #444;
  text-align: left;
}

.preview-mode__info p {
  margin: 8px 0;
  font-size: 14px;
}

.preview-mode__info strong {
  color: #2980b9;
}
</style>
