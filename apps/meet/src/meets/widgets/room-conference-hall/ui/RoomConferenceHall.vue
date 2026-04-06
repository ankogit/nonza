<template>
  <div class="conference-hall dashboard bg-dark">
    <header
      v-if="settingsInUpperMenu"
      class="conference-hall__top-menu room-header bg-dark-20"
    >
      <div class="room-info color-white font-bebas">
        <h2 class="room-info-title">{{ room?.name ?? "Созвон" }}</h2>
      </div>
      <div class="room-indicators">
        <Indicator
          v-if="
            !previewMode &&
            connectionIndicatorVisible &&
            connectionStatus !== 'good'
          "
          :trigger="false"
          :variant="connectionVariant"
          :title="connectionLabel"
          :aria-label="connectionLabel"
          role="status"
        >
          <PixelIcon :name="connectionIconName" variant="small" />
        </Indicator>
        <Button
          variant="default"
          size="small"
          title="Настройки"
          @click="handleSettings"
        >
          <PixelIcon name="settings" variant="small" />
        </Button>
      </div>
    </header>
    <div class="conference-hall__content">
      <div class="conference-hall__main">
        <div
          v-if="conferenceHall.stateSynced && leaderParticipant"
          class="conference-hall__leader"
        >
          <VideoParticipant
            :participant="resolveParticipant(leaderParticipant)"
            :participant-name="
              isLocal(leaderParticipant)
                ? props.participantName
                : (props.getDisplayName?.(leaderParticipant) ??
                  leaderParticipant.name ??
                  leaderParticipant.identity)
            "
            :participant-color="leaderParticipantColor"
            :is-speaking="
              leaderParticipant
                ? speakingIdentitySet.has(leaderParticipant.identity)
                : false
            "
            :is-leader="true"
            :show-full-size="true"
            :replica-text="
              leaderParticipant
                ? replicaByParticipant[leaderParticipant.identity]?.text
                : undefined
            "
            @full-size="
              () =>
                leaderParticipant && handleFullSize(leaderParticipant.identity)
            "
          />
          <div class="conference-hall__leader-label">
            <PixelIcon name="leader" variant="small" /> Main Speaker
          </div>
        </div>
        <div v-else class="conference-hall__placeholder">
          <span class="conference-hall__placeholder-text font-bebas"
            >Ожидание лидера...</span
          >
        </div>
      </div>

      <template v-if="hideSidebar">
        <Teleport to="body">
          <Transition name="conference-hall-panel">
            <div
              v-if="showParticipantsPanel"
              class="conference-hall__panel-overlay"
              @click.self="showParticipantsPanel = false"
            >
              <aside
                class="conference-hall__sidebar conference-hall__sidebar--panel"
              >
                <header class="conference-hall__panel-header">
                  <h2 class="conference-hall__sidebar-title font-bebas">
                    Участники
                  </h2>
                  <Button
                    variant="default"
                    size="small"
                    title="Закрыть"
                    @click="showParticipantsPanel = false"
                  >
                    <PixelIcon name="close" variant="small" />
                  </Button>
                </header>
                <section
                  v-if="
                    !previewMode &&
                    conferenceHall.isLeader.value &&
                    conferenceHall.participantsWithRaisedHands.value.length > 0
                  "
                  class="conference-hall__raised"
                >
                  <h3 class="conference-hall__sidebar-title font-bebas">
                    <PixelIcon name="hand" variant="small" /> Поднятые руки
                  </h3>
                  <div
                    v-for="participant in conferenceHall
                      .participantsWithRaisedHands.value"
                    :key="participant.identity"
                    class="conference-hall__raised-item"
                  >
                    <span
                      class="conference-hall__participant-name font-bebas"
                      >{{
                        getParticipantState(participant.identity)?.name ??
                        participant.name ??
                        participant.identity
                      }}</span
                    >
                    <div class="conference-hall__raised-actions">
                      <Indicator
                        variant="success"
                        title="Разрешить говорить"
                        aria-label="Разрешить говорить"
                        @click="handleGrantSpeaking(participant.identity)"
                      >
                        <PixelIcon name="check" variant="small" />
                      </Indicator>
                      <Indicator
                        variant="default"
                        title="Передать лидерство"
                        aria-label="Передать лидерство"
                        @click="handleTransferLeadership(participant.identity)"
                      >
                        <PixelIcon name="leader" variant="small" />
                      </Indicator>
                    </div>
                  </div>
                </section>
                <section class="conference-hall__others">
                  <hr class="HR" />
                  <div class="conference-hall__others-grid">
                    <RoomParticipantsList
                      :key="sidebarParticipantsListKey"
                      :participants="sidebarParticipantList"
                    >
                      <template #actions="{ participant: item }">
                        <Indicator
                          v-if="
                            !previewMode &&
                            conferenceHall.isLeader.value &&
                            getParticipantState(item.identity)?.hasRaisedHand &&
                            !getParticipantState(item.identity)
                              ?.hasSpeakingPermission &&
                            !getParticipantState(item.identity)?.isLeader
                          "
                          variant="success"
                          title="Дать право голоса"
                          aria-label="Дать право голоса"
                          @click="handleGrantSpeaking(item.identity)"
                        >
                          <PixelIcon name="check" variant="small" />
                        </Indicator>
                        <Indicator
                          v-if="
                            !previewMode &&
                            conferenceHall.isLeader.value &&
                            getParticipantState(item.identity)
                              ?.hasSpeakingPermission &&
                            !getParticipantState(item.identity)?.isLeader
                          "
                          variant="success"
                          title="Забрать право голоса"
                          aria-label="Забрать право голоса"
                          @click="handleRevokeSpeaking(item.identity)"
                        >
                          <PixelIcon name="mic-on" variant="small" />
                        </Indicator>
                        <Indicator
                          v-else-if="
                            !previewMode &&
                            !conferenceHall.isLeader.value &&
                            getParticipantState(item.identity)
                              ?.hasSpeakingPermission &&
                            !getParticipantState(item.identity)?.isLeader
                          "
                          :trigger="false"
                          variant="success"
                          title="Право голоса"
                          aria-label="Право голоса"
                        >
                          <PixelIcon name="mic-on" variant="small" />
                        </Indicator>
                      </template>
                    </RoomParticipantsList>
                  </div>
                </section>
              </aside>
            </div>
          </Transition>
        </Teleport>
      </template>

      <aside v-if="!hideSidebar" class="conference-hall__sidebar">
        <section
          v-if="
            !previewMode &&
            conferenceHall.isLeader.value &&
            conferenceHall.participantsWithRaisedHands.value.length > 0
          "
          class="conference-hall__raised"
        >
          <h3 class="conference-hall__sidebar-title font-bebas">
            <PixelIcon name="hand" variant="small" /> Поднятые руки
          </h3>
          <div
            v-for="participant in conferenceHall.participantsWithRaisedHands
              .value"
            :key="participant.identity"
            class="conference-hall__raised-item"
          >
            <span class="conference-hall__participant-name font-bebas">{{
              getParticipantState(participant.identity)?.name ??
              participant.name ??
              participant.identity
            }}</span>
            <div class="conference-hall__raised-actions">
              <Indicator
                variant="success"
                title="Разрешить говорить"
                aria-label="Разрешить говорить"
                @click="handleGrantSpeaking(participant.identity)"
              >
                <PixelIcon name="check" variant="small" />
              </Indicator>
              <Indicator
                variant="default"
                title="Передать лидерство"
                aria-label="Передать лидерство"
                @click="handleTransferLeadership(participant.identity)"
              >
                <PixelIcon name="leader" variant="small" />
              </Indicator>
            </div>
          </div>
        </section>

        <section class="conference-hall__others">
          <h2 class="conference-hall__sidebar-title font-bebas">Участники</h2>
          <hr class="HR" />

          <div class="conference-hall__others-grid">
            <RoomParticipantsList
              :key="sidebarParticipantsListKey"
              :participants="sidebarParticipantList"
            >
              <template #actions="{ participant: item }">
                <Indicator
                  v-if="
                    !previewMode &&
                    conferenceHall.isLeader.value &&
                    getParticipantState(item.identity)?.hasRaisedHand &&
                    !getParticipantState(item.identity)
                      ?.hasSpeakingPermission &&
                    !getParticipantState(item.identity)?.isLeader
                  "
                  variant="success"
                  title="Дать право голоса"
                  aria-label="Дать право голоса"
                  @click="handleGrantSpeaking(item.identity)"
                >
                  <PixelIcon name="check" variant="small" />
                </Indicator>
                <Indicator
                  v-if="
                    !previewMode &&
                    conferenceHall.isLeader.value &&
                    getParticipantState(item.identity)?.hasSpeakingPermission &&
                    !getParticipantState(item.identity)?.isLeader
                  "
                  variant="success"
                  title="Забрать право голоса"
                  aria-label="Забрать право голоса"
                  @click="handleRevokeSpeaking(item.identity)"
                >
                  <PixelIcon name="mic-on" variant="small" />
                </Indicator>
                <Indicator
                  v-else-if="
                    !previewMode &&
                    !conferenceHall.isLeader.value &&
                    getParticipantState(item.identity)?.hasSpeakingPermission &&
                    !getParticipantState(item.identity)?.isLeader
                  "
                  :trigger="false"
                  variant="success"
                  title="Право голоса"
                  aria-label="Право голоса"
                >
                  <PixelIcon name="mic-on" variant="small" />
                </Indicator>
              </template>
            </RoomParticipantsList>
          </div>
        </section>
      </aside>
    </div>

    <div
      v-if="extrasCollabVisible"
      class="conference-hall__extras"
      aria-label="Дополнительно"
    >
      <div
        v-if="collaborationEnabled && isDocumentOpen"
        class="conference-hall__extra conference-hall__extra--document"
        aria-label="Совместный документ"
      >
        <CollaborativeDocument
          :room="props.room"
          :participant-name="props.participantName"
          :participant-color="participantColorForDocument"
        />
      </div>
      <div
        v-if="collaborationEnabled && isWhiteboardOpen && !whiteboardFullscreen"
        class="conference-hall__extra conference-hall__extra--whiteboard"
        aria-label="Совместная доска"
      >
        <CollaborativeWhiteboardShell
          :participant-color="participantColorForDocument"
          :room-id="props.room?.id ?? null"
        />
      </div>
      <div
        v-if="isTableChatOpen"
        class="conference-hall__extra conference-hall__extra--chat"
        aria-label="Чат стола"
      >
        <TableCirclePublicChat
          :local-participant="localParticipant"
          :remote-participants="remoteParticipants"
          :participant-name="props.participantName"
          :get-display-name="props.getDisplayName"
          :livekit-room="props.livekitRoom"
        />
      </div>
      <div
        v-if="isTableDiceOpen"
        class="conference-hall__extra conference-hall__extra--dice"
        aria-label="Кости"
      >
        <TableCirclePublicTable
          :local-participant="localParticipant"
          :remote-participants="remoteParticipants"
          :participant-name="props.participantName"
          :get-display-name="props.getDisplayName"
          :livekit-room="props.livekitRoom"
        />
      </div>
      <div
        v-if="isTableStreamOpen"
        class="conference-hall__extra conference-hall__extra--stream"
        aria-label="Стрим ведущего"
      >
        <div
          v-if="leaderParticipant"
          class="conference-hall__stream-video"
        >
          <VideoParticipant
            :participant="resolveParticipant(leaderParticipant)"
            :participant-name="
              isLocal(leaderParticipant)
                ? props.participantName
                : (props.getDisplayName?.(leaderParticipant) ??
                  leaderParticipant.name ??
                  leaderParticipant.identity)
            "
            :participant-color="leaderParticipantColor"
            :is-speaking="
              leaderParticipant
                ? speakingIdentitySet.has(leaderParticipant.identity)
                : false
            "
            :is-leader="true"
            :show-full-size="true"
            preferred-video-source="screen-share"
            :replica-text="
              leaderParticipant
                ? replicaByParticipant[leaderParticipant.identity]?.text
                : undefined
            "
          />
        </div>
        <div
          v-else
          class="conference-hall__stream-placeholder color-white-60 font-bebas"
        >
          Ожидание лидера…
        </div>
      </div>
    </div>

    <div
      v-show="isSoundBarPanelOpen"
      class="conference-hall__sound-collab"
      aria-label="Звуки организации"
    >
      <SoundBar
        layout="panel"
        :org-id="props.room?.organization_id ?? null"
        :livekit-room="props.livekitRoom"
        :preview-mode="previewMode"
      />
    </div>

    <CallMenu
      display-room-type="conference_hall"
      :room-id="props.room?.id ?? null"
      :enabled-widget-ids="enabledConferenceCallWidgets"
      :active-call-widget-ids="activeCallWidgetIds"
      @disconnect="handleDisconnect"
      @activate-call-widget="activateCallWidgetFromMenu"
    >
      <template #left>
        <Button
          v-if="!previewMode && !conferenceHall.isLeader.value"
          :class="{ warning: hasRaisedHand, default: !hasRaisedHand }"
          :title="hasRaisedHand ? 'Опустить руку' : 'Поднять руку'"
          @click="handleRaiseHand"
        >
          <PixelIcon name="hand" variant="large" />
        </Button>
        <Button
          :class="{
            active: mediaState.isAudioEnabled,
            danger: !mediaState.isAudioEnabled,
          }"
          :disabled="!canSpeak"
          :title="
            canSpeak
              ? mediaState.isAudioEnabled
                ? 'Выключить микрофон'
                : 'Включить микрофон'
              : 'Дождитесь разрешения от лидера говорить'
          "
          @click="handleToggleAudio"
        >
          <PixelIcon
            :name="mediaState.isAudioEnabled ? 'mic-on' : 'mic-off'"
            variant="large"
          />
        </Button>
        <Button
          v-if="!previewMode && conferenceHall.isLeader.value"
          :class="{
            active: mediaState.isVideoEnabled,
            danger: !mediaState.isVideoEnabled,
          }"
          :title="
            mediaState.isVideoEnabled ? 'Выключить видео' : 'Включить видео'
          "
          @click="toggleVideo"
        >
          <PixelIcon
            :name="mediaState.isVideoEnabled ? 'video-on' : 'video-off'"
            variant="large"
          />
        </Button>
        <Button
          v-if="!previewMode && conferenceHall.isLeader.value"
          :class="{
            active: mediaState.isScreenSharing,
            danger: !mediaState.isScreenSharing,
          }"
          title="Трансляция экрана"
          @click="toggleScreenShare"
        >
          <PixelIcon
            :name="mediaState.isScreenSharing ? 'screen-on' : 'screen-off'"
            variant="large"
          />
        </Button>
        <ReplicaInput v-if="!previewMode" @submit="handleReplicaSubmit" />
      </template>
      <template #right>
        <ParticipantsTrigger
          v-if="hideSidebar"
          :panel-open="showParticipantsPanel"
          :raised-count="raisedHandsSet.size"
          @toggle="showParticipantsPanel = !showParticipantsPanel"
        />
      </template>
      <template #widget-document>
        <Button
          variant="default"
          :class="{ active: isDocumentOpen }"
          :title="isDocumentOpen ? 'Скрыть документ' : 'Совместный документ'"
          @click="toggleDocument"
        >
          <PixelIcon name="document" variant="large" />
        </Button>
      </template>
      <template #widget-whiteboard>
        <Button
          variant="default"
          :class="{ active: isWhiteboardOpen }"
          :title="isWhiteboardOpen ? 'Скрыть доску' : 'Совместная доска'"
          @click="toggleWhiteboard"
        >
          <PixelIcon name="edit" variant="large" />
        </Button>
      </template>
      <template #widget-table_chat>
        <Button
          variant="default"
          :class="{ active: isTableChatOpen }"
          :title="isTableChatOpen ? 'Скрыть чат стола' : 'Чат стола'"
          @click="toggleTableChat"
        >
          <PixelIcon name="message" variant="large" />
        </Button>
      </template>
      <template #widget-table_dice>
        <Button
          variant="default"
          :class="{ active: isTableDiceOpen }"
          :title="isTableDiceOpen ? 'Скрыть кости' : 'Кости'"
          @click="toggleTableDice"
        >
          <PixelIcon name="dice" variant="large" />
        </Button>
      </template>
      <template #widget-table_stream>
        <Button
          variant="default"
          :class="{ active: isTableStreamOpen }"
          :title="
            isTableStreamOpen ? 'Скрыть стрим ведущего' : 'Стрим ведущего'
          "
          @click="toggleTableStream"
        >
          <PixelIcon name="screen-on" variant="large" />
        </Button>
      </template>
      <template #widget-soundbar>
        <Button
          variant="default"
          :class="{ active: isSoundBarPanelOpen }"
          :title="
            isSoundBarPanelOpen
              ? 'Скрыть звуки организации'
              : 'Звуки организации'
          "
          @click="isSoundBarPanelOpen = !isSoundBarPanelOpen"
        >
          <PixelIcon name="notes" variant="large" />
        </Button>
      </template>
      <template #widget-settings>
        <Button
          v-if="settingsInCallMenu"
          variant="default"
          size="small"
          title="Настройки"
          @click="handleSettings"
        >
          <PixelIcon name="settings" variant="large" />
        </Button>
      </template>
    </CallMenu>

    <Teleport to="body">
      <div
        v-if="collaborationEnabled && isWhiteboardOpen && whiteboardFullscreen"
        class="room-fullscreen"
        role="dialog"
        aria-label="Совместная доска"
      >
        <Button
          variant="default"
          size="small"
          class="room-fullscreen__close"
          title="Закрыть доску"
          aria-label="Закрыть доску"
          @click="toggleWhiteboard"
        >
          <PixelIcon name="close" variant="large" />
        </Button>
        <div class="room-fullscreen__editor">
          <CollaborativeWhiteboardShell
            :participant-color="participantColorForDocument"
            :room-id="props.room?.id ?? null"
          />
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="fullscreenParticipant"
        class="room-fullscreen"
        role="dialog"
        aria-label="Во весь экран"
        @click.self="closeFullscreen"
      >
        <Button
          variant="default"
          class="room-fullscreen__close"
          title="Закрыть полноэкранный режим"
          aria-label="Закрыть"
          @click="closeFullscreen"
        >
          <PixelIcon name="close" variant="large" />
        </Button>
        <div class="room-fullscreen__video">
          <VideoParticipant
            :participant="resolveParticipant(fullscreenParticipant)"
            :participant-name="
              isLocal(fullscreenParticipant)
                ? props.participantName
                : (props.getDisplayName?.(fullscreenParticipant) ??
                  fullscreenParticipant.name ??
                  fullscreenParticipant.identity)
            "
            :participant-color="fullscreenParticipantColor"
            :is-speaking="
              speakingIdentitySet.has(fullscreenParticipant.identity)
            "
            :is-leader="
              conferenceHall.stateSynced &&
              conferenceHall.leader.value?.identity ===
                fullscreenParticipant.identity
            "
            :replica-text="
              replicaByParticipant[fullscreenParticipant.identity]?.text
            "
            :preferred-video-source="
              showFullscreenCameraPiP ? 'screen-share' : undefined
            "
            :on-tracks-updated="() => fullscreenTracksVersion++"
          />
        </div>
        <div
          v-if="showFullscreenCameraPiP && fullscreenResolvedParticipant"
          class="room-fullscreen__pip room-fullscreen__pip--remote-camera"
          :style="fullscreenCameraPiPStyle"
          @pointerdown="fullscreenCameraPiPDraggable.handlePointerDown"
        >
          <VideoParticipant
            :participant="fullscreenResolvedParticipant"
            :participant-name="
              fullscreenParticipant &&
              isLocal(fullscreenParticipant)
                ? props.participantName
                : (fullscreenParticipant &&
                    (props.getDisplayName?.(fullscreenParticipant) ??
                      fullscreenParticipant.name ??
                      fullscreenParticipant.identity)) ??
                  ''
            "
            :participant-color="fullscreenParticipantColor"
            :is-speaking="
              fullscreenParticipant
                ? speakingIdentitySet.has(fullscreenParticipant.identity)
                : false
            "
            :is-leader="
              conferenceHall.stateSynced &&
              conferenceHall.leader.value?.identity ===
                fullscreenParticipant?.identity
            "
            :replica-text="
              fullscreenParticipant
                ? replicaByParticipant[fullscreenParticipant.identity]?.text
                : undefined
            "
            preferred-video-source="camera"
            :on-tracks-updated="() => fullscreenTracksVersion++"
          />
          <div
            data-pip-resize-handle
            class="room-fullscreen__pip-resize"
            title="Изменить размер"
            @pointerdown.stop="
              fullscreenCameraPiPDraggable.handleResizePointerDown
            "
          />
        </div>
        <CallMenu
          display-room-type="conference_hall"
          :room-id="props.room?.id ?? null"
          :enabled-widget-ids="[]"
          storage-suffix="fullscreen"
          menu-class="room-fullscreen__menu"
          @disconnect="handleDisconnect"
        >
          <template #left>
            <Button
              v-if="!previewMode && !conferenceHall.isLeader.value"
              :class="{ warning: hasRaisedHand, default: !hasRaisedHand }"
              :title="hasRaisedHand ? 'Опустить руку' : 'Поднять руку'"
              @click="handleRaiseHand"
            >
              <PixelIcon name="hand" variant="large" />
            </Button>
            <Button
              :class="{
                active: mediaState.isAudioEnabled,
                danger: !mediaState.isAudioEnabled,
              }"
              :disabled="!canSpeak"
              :title="
                canSpeak
                  ? mediaState.isAudioEnabled
                    ? 'Выключить микрофон (M)'
                    : 'Включить микрофон (M)'
                  : 'Дождитесь разрешения от лидера говорить'
              "
              @click="handleToggleAudio"
            >
              <PixelIcon
                :name="mediaState.isAudioEnabled ? 'mic-on' : 'mic-off'"
                variant="large"
              />
            </Button>
            <Button
              v-if="!previewMode && conferenceHall.isLeader.value"
              :class="{
                active: mediaState.isVideoEnabled,
                danger: !mediaState.isVideoEnabled,
              }"
              :title="
                mediaState.isVideoEnabled ? 'Выключить видео' : 'Включить видео'
              "
              @click="toggleVideo"
            >
              <PixelIcon
                :name="mediaState.isVideoEnabled ? 'video-on' : 'video-off'"
                variant="large"
              />
            </Button>
            <Button
              v-if="!previewMode && conferenceHall.isLeader.value"
              :class="{
                active: mediaState.isScreenSharing,
                danger: !mediaState.isScreenSharing,
              }"
              title="Трансляция экрана"
              @click="toggleScreenShare"
            >
              <PixelIcon
                :name="mediaState.isScreenSharing ? 'screen-on' : 'screen-off'"
                variant="large"
              />
            </Button>
            <ReplicaInput v-if="!previewMode" @submit="handleReplicaSubmit" />
          </template>
          <template #right>
            <ParticipantsTrigger
              v-if="hideSidebar"
              :panel-open="showParticipantsPanel"
              :raised-count="raisedHandsSet.size"
              @toggle="showParticipantsPanel = !showParticipantsPanel"
            />
          </template>
        </CallMenu>
      </div>
    </Teleport>

    <Modal
      v-model="isSettingsOpen"
      title="Настройки"
      :close-on-overlay-click="!hasUnsavedSettingsChanges"
      @close="handleModalClose"
    >
      <div class="settings-content">
        <div v-if="isAnonymousForSettings" class="settings-section">
          <h3 class="settings-section-title">Участник</h3>
          <div class="settings-item">
            <label class="settings-label">Ваше имя</label>
            <div class="settings-input-group">
              <input
                v-model="settingsParticipantName"
                type="text"
                class="settings-input"
                placeholder="Введите ваше имя"
              />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Безопасность</h3>
          <div class="settings-item">
            <div class="settings-checkbox-group">
              <label class="settings-checkbox-label">
                <input
                  type="checkbox"
                  class="settings-checkbox checkbox-pixel"
                  :checked="e2eeState.isActive"
                  disabled
                />
                <span>End-to-End Encryption (E2EE)</span>
                <span
                  class="settings-status"
                  :class="{ active: e2eeState.isActive }"
                >
                  {{ e2eeState.isActive ? "Включено" : "Выключено" }}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div v-if="room?.allow_anonymous_join" class="settings-section">
          <h3 class="settings-section-title">Комната</h3>
          <div class="settings-item">
            <label class="settings-label">Код комнаты</label>
            <div class="settings-code">{{ room?.short_code || "—" }}</div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Видео</h3>
          <div class="settings-item">
            <label class="settings-label">Качество по умолчанию</label>
            <PixelSelect
              v-model="settingsDefaultVideoQuality"
              :options="[
                { value: '360p', label: '360p (экономный трафик)' },
                { value: '720p', label: '720p' },
                { value: '1080p', label: '1080p (максимум)' },
              ]"
              class="settings-quality-select"
              aria-label="Качество видео"
            />
          </div>
        </div>
        <AudioSettings ref="audioSettingsRef" />
        <div class="settings-section">
          <h3 class="settings-section-title">Звуковые уведомления</h3>
          <div class="settings-item">
            <Switch
              v-model="replicaTtsEnabled"
              aria-label="Озвучивать реплики (TTS)"
            >
              <span>Озвучивать реплики (TTS)</span>
            </Switch>
          </div>
        </div>
      </div>

      <template #footer>
        <Button type="text" variant="default" @click="handleCancelSettings">
          Отмена
        </Button>
        <Button
          type="text"
          variant="accent"
          :class="{ 'button--has-changes': hasUnsavedSettingsChanges }"
          @click="handleSaveSettings"
        >
          <PixelIcon
            v-if="hasUnsavedSettingsChanges"
            name="document"
            variant="small"
          />
          Сохранить
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, toRef, provide } from "vue";
import { useMediaControl } from "@features/media-control";
import { useConferenceHall } from "@features/conference-hall";
import { useE2EE } from "@features/e2ee";
import { useConnectionIndicator } from "@features/room-connection";
import { SoundBar } from "@features/sound-bar";
import {
  MEET_ROOM_COLLABORATION_KEY,
  useMeetRoomYCollaboration,
} from "@features/room-collaboration";
import { CollaborativeDocument } from "@widgets/collaborative-document";
import { CollaborativeWhiteboardShell } from "@widgets/collaborative-whiteboard";
import TableCirclePublicChat from "@widgets/room-table-circle/ui/TableCirclePublicChat.vue";
import TableCirclePublicTable from "@widgets/room-table-circle/ui/TableCirclePublicTable.vue";
import {
  useParticipantReplica,
  ReplicaInput,
} from "@features/participant-replica";
import {
  Button,
  Modal,
  AudioSettings,
  PixelIcon,
  Indicator,
  PixelSelect,
  Switch,
} from "@shared/ui";
import { VideoParticipant } from "@widgets/video-participant";
import { RoomParticipantsList } from "@widgets/room-participants-list";
import type { RoomParticipantListItem } from "@widgets/room-participants-list";
import { CallMenu } from "@widgets/call-menu";
import type { CallWidgetId } from "@features/call-widgets";
import ParticipantsTrigger from "./ParticipantsTrigger.vue";
import {
  getAuthState,
  setParticipantName,
  getStoredAudioInputDevice,
  getStoredVideoInputDevice,
  getStoredMediaState,
  setStoredMediaState,
  useMeetingHotkeys,
  useTauriGlobalShortcuts,
  playNotificationSound,
  getReplicaTtsEnabled,
  setReplicaTtsEnabled,
  speakReplicaTextWithVoice,
  parseParticipantColorFromMetadata,
  DEFAULT_PARTICIPANT_COLOR,
  getStoredDefaultVideoQuality,
  setStoredDefaultVideoQuality,
  type VideoQualityLevel,
  useDraggablePiP,
  evaluateFullscreenCameraPip,
  logFullscreenPipGateIfChanged,
  resetFullscreenPipGateLog,
  logFullscreenPip,
  toggleOutputMuted,
  readTableChatOpenForRoom,
  writeTableChatOpenForRoom,
  readTableDiceOpenForRoom,
  writeTableDiceOpenForRoom,
  readSoundBarPanelOpenForRoom,
  writeSoundBarPanelOpenForRoom,
} from "@shared/lib";
import type { ComponentPublicInstance } from "vue";
import type { Room as RoomEntity, RoomApi } from "@shared/entities";
import { RoomEvent, Track } from "livekit-client";
import type {
  Room as LiveKitRoom,
  RemoteParticipant,
  LocalParticipant,
} from "livekit-client";

const props = defineProps<{
  room: RoomEntity | null;
  roomApi?: RoomApi | null;
  livekitRoom: LiveKitRoom | null;
  localParticipant?: LocalParticipant | null;
  remoteParticipants?: RemoteParticipant[];
  getDisplayName?: (p: RemoteParticipant | LocalParticipant) => string;
  participantName: string;
  apiBaseURL: string;
  showDocument?: boolean;
  previewMode?: boolean;
  hideSidebar?: boolean;
  settingsInCallMenu?: boolean;
  settingsInUpperMenu?: boolean;
  updateParticipantName?: (name: string) => void;
}>();

const emit = defineEmits<{
  disconnect: [];
  "update:participantName": [name: string];
  "update:participants": [RoomParticipantListItem[]];
}>();

const enabledConferenceCallWidgets = computed<CallWidgetId[]>(() => {
  const ids: CallWidgetId[] = [
    "document",
    "whiteboard",
    "table_chat",
    "table_dice",
    "table_stream",
    "soundbar",
  ];
  if (props.settingsInCallMenu) ids.push("settings");
  return ids;
});

defineExpose({
  openCallSettings: handleSettings,
});

const { state: e2eeState } = useE2EE(() => props.livekitRoom);

const livekitRoomRef = toRef(props, "livekitRoom");
const {
  connectionStatus,
  connectionLabel,
  connectionVariant,
  connectionIconName,
  connectionIndicatorVisible,
} = useConnectionIndicator(livekitRoomRef);

const localParticipant = computed<LocalParticipant | null>(() => {
  return props.localParticipant ?? props.livekitRoom?.localParticipant ?? null;
});

const remoteParticipants = computed<RemoteParticipant[]>(() => {
  // Приоритет: используем props.remoteParticipants из useRoomConnection (уже реактивный)
  if (props.remoteParticipants) {
    // Создаем новый массив для принудительной реактивности при изменении имен
    return props.remoteParticipants.map((p) => {
      // Принудительно читаем имя для реактивности
      const name = p.name;
      void name;
      return p;
    });
  }
  if (!props.livekitRoom) return [];
  // Fallback: используем напрямую из livekitRoom
  return Array.from(props.livekitRoom.remoteParticipants.values());
});

watch(
  () => props.remoteParticipants,
  () => remoteParticipants.value,
  { deep: true, immediate: true },
);

const conferenceHall = useConferenceHall(
  () => localParticipant.value,
  () => remoteParticipants.value,
  () => props.participantName,
  () => props.livekitRoom,
  undefined,
  {
    initialLeaderIdentity: () => props.room?.conference_hall_leader_id ?? null,
    onLeaderChange: (leaderIdentity) => {
      const code = props.room?.short_code;
      const currentOnServer = props.room?.conference_hall_leader_id ?? null;
      if (!code || !props.roomApi || leaderIdentity === currentOnServer) {
        return;
      }
      props.roomApi
        .updateConferenceHallLeader(code, leaderIdentity)
        .catch(() => {});
    },
  },
);

const replicaTtsEnabled = ref(getReplicaTtsEnabled());
const initialReplicaTtsEnabled = ref(replicaTtsEnabled.value);

const { replicaByParticipant, sendReplica } = useParticipantReplica(
  computed(() => props.livekitRoom),
  {
    raisedHands: () => conferenceHall.state.value.raisedHands,
    speakReplica: (text, meta) => {
      if (replicaTtsEnabled.value) {
        speakReplicaTextWithVoice(text, meta);
      }
    },
  },
);

function handleReplicaSubmit(payload: {
  text: string;
  accept: () => void;
}): void {
  if (sendReplica(payload.text)) payload.accept();
}

watch(
  [localParticipant, remoteParticipants, () => props.participantName],
  () => {
    conferenceHall.updateParticipants();
  },
  {
    deep: true,
    immediate: true,
  },
);

const prevRaisedHands = ref<string[]>([]);
watch(
  () => conferenceHall.state.value.raisedHands,
  (raisedHands) => {
    if (!conferenceHall.isLeader.value || props.previewMode) {
      prevRaisedHands.value = raisedHands;
      return;
    }
    const prev = new Set(prevRaisedHands.value);
    const hasNewRaisedHand = raisedHands.some((id) => !prev.has(id));
    if (hasNewRaisedHand) {
      playNotificationSound("hand_raised").catch(() => {});
      if (props.hideSidebar) {
        showParticipantsPanel.value = true;
      }
    }
    prevRaisedHands.value = raisedHands;
  },
  { immediate: true },
);

// Слушаем изменения метаданных участников (включая имя)
watch(
  () => props.livekitRoom,
  (room) => {
    if (!room) return;

    const handleMetadataChanged = () => {
      conferenceHall.updateParticipants();
    };

    room.on(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);

    return () => {
      room.off(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    };
  },
  { immediate: true },
);

// Voice Activity Detection (VAD) from LiveKit: server detects who is speaking and sends
// updates via RoomEvent.ActiveSpeakersChanged; we map identities for the speaking border.
const speakingIdentitySet = ref<Set<string>>(new Set());
watch(
  () => props.livekitRoom,
  (room) => {
    speakingIdentitySet.value = new Set();
    if (!room) return;
    const handler = (speakers: Array<{ identity: string }>) => {
      speakingIdentitySet.value = new Set(speakers.map((s) => s.identity));
    };
    room.on(RoomEvent.ActiveSpeakersChanged, handler);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handler);
    };
  },
  { immediate: true },
);

const participantColorForDocument = computed(() => {
  const c = getAuthState()?.user?.color;
  if (c && c.trim() !== "") return c;
  return DEFAULT_PARTICIPANT_COLOR;
});

const collaborationEnabled = computed(() =>
  Boolean(props.room?.id && props.apiBaseURL),
);

const meetCollab = useMeetRoomYCollaboration({
  room: toRef(props, "room"),
  apiBaseURL: toRef(props, "apiBaseURL"),
  userId: toRef(props, "participantName"),
  userName: toRef(props, "participantName"),
  userColor: participantColorForDocument,
  enabled: collaborationEnabled,
});

provide(MEET_ROOM_COLLABORATION_KEY, meetCollab);

const WB_ROOM_OPEN_PREFIX = "nonza_meet_wb_open_";

function readStoredWhiteboardOpen(roomId: string | undefined): boolean {
  if (!roomId) return false;
  try {
    return localStorage.getItem(WB_ROOM_OPEN_PREFIX + roomId) === "1";
  } catch {
    return false;
  }
}

function writeStoredWhiteboardOpen(roomId: string | undefined, open: boolean) {
  if (!roomId) return;
  try {
    localStorage.setItem(WB_ROOM_OPEN_PREFIX + roomId, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const isDocumentOpen = ref(false);
function toggleDocument() {
  isDocumentOpen.value = !isDocumentOpen.value;
}

const isWhiteboardOpen = ref(false);

watch(
  () => [props.room?.id, collaborationEnabled.value] as const,
  ([id, collab]) => {
    if (!id || !collab) return;
    isWhiteboardOpen.value = readStoredWhiteboardOpen(id);
  },
  { immediate: true },
);

watch(
  () => [props.room?.id, isWhiteboardOpen.value] as const,
  () => {
    writeStoredWhiteboardOpen(props.room?.id, isWhiteboardOpen.value);
  },
);

function toggleWhiteboard() {
  isWhiteboardOpen.value = !isWhiteboardOpen.value;
}

const WB_FULLSCREEN_KEY = "nonza_settings_wb_fullscreen";

function readWbFullscreen(): boolean {
  try {
    const v = localStorage.getItem(WB_FULLSCREEN_KEY);
    if (v === null) return false;
    return v === "1";
  } catch {
    return false;
  }
}

const whiteboardFullscreen = ref(readWbFullscreen());

const isTableChatOpen = ref(false);
function toggleTableChat() {
  isTableChatOpen.value = !isTableChatOpen.value;
}

const isTableDiceOpen = ref(false);
function toggleTableDice() {
  isTableDiceOpen.value = !isTableDiceOpen.value;
}

const isTableStreamOpen = ref(false);
function toggleTableStream() {
  isTableStreamOpen.value = !isTableStreamOpen.value;
}

watch(
  () => props.room?.id,
  (id) => {
    if (!id) {
      isTableChatOpen.value = false;
      isTableDiceOpen.value = false;
      return;
    }
    isTableChatOpen.value = readTableChatOpenForRoom(id);
    isTableDiceOpen.value = readTableDiceOpenForRoom(id);
  },
  { immediate: true },
);

watch(
  () => [props.room?.id, isTableChatOpen.value] as const,
  () => {
    writeTableChatOpenForRoom(props.room?.id, isTableChatOpen.value);
  },
);

watch(
  () => [props.room?.id, isTableDiceOpen.value] as const,
  () => {
    writeTableDiceOpenForRoom(props.room?.id, isTableDiceOpen.value);
  },
);

const extrasCollabVisible = computed(
  () =>
    (collaborationEnabled.value &&
      (isDocumentOpen.value ||
        (isWhiteboardOpen.value && !whiteboardFullscreen.value))) ||
    isTableChatOpen.value ||
    isTableDiceOpen.value ||
    isTableStreamOpen.value,
);

const leaderParticipant = computed(() => {
  if (!conferenceHall.leader.value) return null;
  const id = conferenceHall.leader.value.identity;
  if (localParticipant.value?.identity === id) return localParticipant.value;
  return remoteParticipants.value.find((p) => p.identity === id) || null;
});

/** Единый список участников: лидер показывается и в этом списке, и отдельно в главном окне. */
const allParticipants = computed(() => {
  const list: (LocalParticipant | RemoteParticipant)[] = [];
  if (localParticipant.value) list.push(localParticipant.value);
  return [...list, ...remoteParticipants.value];
});

/** Прямая подписка на список поднятых рук, чтобы список участников гарантированно перерисовывался. */
const raisedHandsSet = ref<Set<string>>(new Set());
watch(
  () => conferenceHall.state.value.raisedHands,
  (raised) => {
    const next = new Set(Array.isArray(raised) ? raised : []);
    raisedHandsSet.value = next;
  },
  { immediate: true },
);

const sidebarParticipantsListKey = computed(() => {
  const r = raisedHandsSet.value;
  return Array.from(r).sort().join(",") || "none";
});

const isLocal = (p: LocalParticipant | RemoteParticipant) =>
  localParticipant.value?.identity === p.identity;

function resolveParticipant(
  p: LocalParticipant | RemoteParticipant | null,
): LocalParticipant | RemoteParticipant | null {
  if (!p) return null;
  const room = props.livekitRoom;
  const fromRoom =
    room?.getParticipantByIdentity?.(p.identity) ??
    room?.remoteParticipants?.get?.(p.identity);
  return (fromRoom ?? p) as LocalParticipant | RemoteParticipant | null;
}

function isParticipantMicOn(
  p: LocalParticipant | RemoteParticipant | null,
): boolean {
  if (!p) return false;
  const participant = resolveParticipant(p);
  const micPub = participant?.getTrackPublication?.(Track.Source.Microphone) as
    | { isMuted?: boolean }
    | undefined;
  return Boolean(micPub && micPub.isMuted === false);
}

const sidebarParticipantList = computed<RoomParticipantListItem[]>(() => {
  const raised = raisedHandsSet.value;
  const participantsMap = conferenceHall.state.value.participants;
  if (props.previewMode && allParticipants.value.length === 0) {
    return [
      { identity: "preview-alice", participantName: "Alice" },
      { identity: "preview-bob", participantName: "Bob" },
    ];
  }
  return allParticipants.value.map((p) => {
    const state = participantsMap.get(p.identity);
    const hasRaised = raised.has(p.identity) || (state?.hasRaisedHand ?? false);
    const name = isLocal(p)
      ? props.participantName
      : (props.getDisplayName?.(p) ?? p.name ?? p.identity);
    return {
      identity: p.identity,
      participantName: name,
      participantColor: parseParticipantColorFromMetadata(
        (p as { metadata?: string }).metadata,
        name,
      ),
      participant: resolveParticipant(p),
      isSpeaking: speakingIdentitySet.value.has(p.identity),
      isLeader: conferenceHall.stateSynced && (state?.isLeader ?? false),
      hasRaisedHand: hasRaised,
      hasSpeakingPermission: state?.hasSpeakingPermission ?? false,
      isAudioEnabled: isParticipantMicOn(p),
      replicaText: replicaByParticipant.value[p.identity]?.text,
    };
  });
});

watch(sidebarParticipantList, (list) => emit("update:participants", list), {
  immediate: true,
  deep: true,
});

const fullscreenIdentity = ref<string | null>(null);

const fullscreenParticipant = computed(() => {
  const id = fullscreenIdentity.value;
  if (!id) return null;
  const leader = leaderParticipant.value;
  if (leader?.identity === id) return leader;
  return allParticipants.value.find((p) => p.identity === id) ?? null;
});

const leaderParticipantColor = computed(() => {
  const p = leaderParticipant.value;
  if (!p) return undefined;
  const name = isLocal(p)
    ? props.participantName
    : (props.getDisplayName?.(p) ?? p.name ?? p.identity);
  return parseParticipantColorFromMetadata(
    (p as { metadata?: string }).metadata,
    name,
  );
});

const fullscreenParticipantColor = computed(() => {
  const p = fullscreenParticipant.value;
  if (!p) return undefined;
  const name = isLocal(p)
    ? props.participantName
    : (props.getDisplayName?.(p) ?? p.name ?? p.identity);
  return parseParticipantColorFromMetadata(
    (p as { metadata?: string }).metadata,
    name,
  );
});

function handleFullSize(identity: string) {
  fullscreenIdentity.value = identity;
  resetFullscreenPipGateLog();
  void nextTick(() => {
    const part = fullscreenParticipant.value;
    if (!part) return;
    const ev = evaluateFullscreenCameraPip(
      part,
      localParticipant.value?.identity,
    );
    logFullscreenPip("opened fullscreen", { identity, ...ev });
  });
}

function closeFullscreen() {
  fullscreenIdentity.value = null;
  resetFullscreenPipGateLog();
}

function participantHasBothCameraAndScreen(
  p: LocalParticipant | RemoteParticipant | null,
): boolean {
  if (!p) return false;
  const participant = resolveParticipant(p);
  const ev = evaluateFullscreenCameraPip(
    participant,
    localParticipant.value?.identity,
  );
  logFullscreenPipGateIfChanged(participant?.identity ?? undefined, ev);
  return ev.show;
}

const fullscreenTracksVersion = ref(0);

watch(
  () => [props.livekitRoom, fullscreenIdentity.value] as const,
  ([room, identity]) => {
    if (!room || !identity) return;
    const bump = () => {
      fullscreenTracksVersion.value++;
    };
    const onTrackPublished = (
      _pub: unknown,
      participant: { identity: string },
    ) => {
      if (participant.identity === identity) bump();
    };
    const onTrackUnpublished = (
      _pub: unknown,
      participant: { identity: string },
    ) => {
      if (participant.identity === identity) bump();
    };
    room.on(RoomEvent.TrackPublished, onTrackPublished);
    room.on(RoomEvent.TrackUnpublished, onTrackUnpublished);
    return () => {
      room.off(RoomEvent.TrackPublished, onTrackPublished);
      room.off(RoomEvent.TrackUnpublished, onTrackUnpublished);
    };
  },
);

const fullscreenCameraPiPDraggable = useDraggablePiP(undefined, undefined, {
  getBottomOffset: () => 88,
  defaultSide: "left",
  defaultVertical: "top",
});
const fullscreenCameraPiPStyle = computed(() => ({
  left: fullscreenCameraPiPDraggable.position.value.x + "px",
  top: fullscreenCameraPiPDraggable.position.value.y + "px",
  width: fullscreenCameraPiPDraggable.size.value.width + "px",
  height: fullscreenCameraPiPDraggable.size.value.height + "px",
}));
const showFullscreenCameraPiP = computed(() => {
  const tracksVersion = fullscreenTracksVersion.value;
  const p = fullscreenParticipant.value;
  return tracksVersion >= 0 && p !== null && participantHasBothCameraAndScreen(p);
});
const fullscreenResolvedParticipant = computed(() =>
  resolveParticipant(fullscreenParticipant.value),
);

const getParticipantState = (identity: string) =>
  conferenceHall.state.value.participants.get(identity);

const hasRaisedHand = computed(() => {
  if (!localParticipant.value) return false;
  return (
    getParticipantState(localParticipant.value.identity)?.hasRaisedHand ?? false
  );
});

const hasSpeakingPermission = computed(() => {
  if (!localParticipant.value) return false;
  return (
    getParticipantState(localParticipant.value.identity)
      ?.hasSpeakingPermission ?? false
  );
});

/** Говорить может только лидер или участник, которому лидер выдал право голоса (поднятая рука — только заявка). */
const canSpeak = computed(
  () => conferenceHall.isLeader.value || hasSpeakingPermission.value,
);

const {
  state: mediaState,
  toggleVideo,
  toggleAudio,
  toggleScreenShare,
  switchAudioInputDevice,
  switchVideoInputDevice,
} = useMediaControl(
  localParticipant,
  computed(() => props.livekitRoom),
);

/** При потере права говорить — выключаем микрофон */
const prevCanSpeak = ref(canSpeak.value);
watch(canSpeak, (speak) => {
  if (prevCanSpeak.value && !speak && mediaState.value.isAudioEnabled) {
    toggleAudio();
  }
  prevCanSpeak.value = speak;
});

const handleToggleAudio = () => {
  if (!canSpeak.value) return;
  toggleAudio();
};

const handleDisconnect = () => emit("disconnect");

useMeetingHotkeys({
  toggleAudio: handleToggleAudio,
  toggleVideo: () => {
    if (!props.previewMode && conferenceHall.isLeader.value) toggleVideo();
  },
  toggleScreenShare: () => {
    if (!props.previewMode && conferenceHall.isLeader.value)
      toggleScreenShare();
  },
  leaveRoom: handleDisconnect,
  enabled: () => !!props.livekitRoom,
});
useTauriGlobalShortcuts({
  toggleAudio: handleToggleAudio,
  toggleVideo,
  toggleScreenShare,
  leaveRoom: handleDisconnect,
  toggleOutputMute: toggleOutputMuted,
  enabled: () => !!props.livekitRoom,
});

const initialMediaStateApplied = ref(false);
watch(
  [() => props.livekitRoom, () => props.room?.short_code],
  ([room, shortCode]) => {
    if (!room || !shortCode) {
      initialMediaStateApplied.value = false;
      return;
    }
    if (initialMediaStateApplied.value) return;
    initialMediaStateApplied.value = true;
    const stored = getStoredMediaState(shortCode);
    nextTick(() => {
      if (stored.micEnabled && !mediaState.value.isAudioEnabled) {
        handleToggleAudio();
      }
      if (stored.videoEnabled && !mediaState.value.isVideoEnabled) {
        toggleVideo();
      }
    });
  },
  { immediate: true },
);

watch(
  [() => mediaState.value.isAudioEnabled, () => mediaState.value.isVideoEnabled],
  () => {
    const code = props.room?.short_code;
    if (code) {
      setStoredMediaState(code, {
        micEnabled: mediaState.value.isAudioEnabled,
        videoEnabled: mediaState.value.isVideoEnabled,
      });
    }
  },
);

const handleRaiseHand = () => {
  hasRaisedHand.value ? conferenceHall.lowerHand() : conferenceHall.raiseHand();
};

const handleGrantSpeaking = (participantIdentity: string) => {
  conferenceHall.grantSpeakingPermission(participantIdentity);
};

const handleRevokeSpeaking = (participantIdentity: string) => {
  conferenceHall.revokeSpeakingPermission(participantIdentity);
};

const handleTransferLeadership = (participantIdentity: string) => {
  if (confirm("Передать лидерство этому участнику?")) {
    conferenceHall.transferLeadership(participantIdentity);
  }
};

const isSettingsOpen = ref(false);
const showParticipantsPanel = ref(false);
const isSoundBarPanelOpen = ref(false);

watch(
  () => props.room?.id,
  (id) => {
    if (!id) {
      isSoundBarPanelOpen.value = false;
      return;
    }
    isSoundBarPanelOpen.value = readSoundBarPanelOpenForRoom(
      "conference_hall",
      id,
    );
  },
  { immediate: true },
);

watch(
  () => [props.room?.id, isSoundBarPanelOpen.value] as const,
  ([id]) => {
    if (!id) return;
    writeSoundBarPanelOpenForRoom(
      "conference_hall",
      id,
      isSoundBarPanelOpen.value,
    );
  },
);

const audioSettingsRef = ref<ComponentPublicInstance | null>(null);
const initialParticipantName = ref(props.participantName);
const settingsParticipantName = ref(props.participantName);
const initialDefaultVideoQuality = ref<VideoQualityLevel>(
  getStoredDefaultVideoQuality(),
);
const settingsDefaultVideoQuality = ref<VideoQualityLevel>(
  getStoredDefaultVideoQuality(),
);

const isAnonymousForSettings = computed(() => !getAuthState()?.user);

const hasUnsavedSettingsChanges = computed(() => {
  const nameChanged =
    isAnonymousForSettings.value &&
    settingsParticipantName.value.trim() !==
      initialParticipantName.value.trim();

  let audioChanged = false;
  if (
    audioSettingsRef.value &&
    typeof (audioSettingsRef.value as any).hasUnsavedChanges === "function"
  ) {
    audioChanged = (audioSettingsRef.value as any).hasUnsavedChanges();
  }

  const ttsChanged =
    replicaTtsEnabled.value !== initialReplicaTtsEnabled.value;
  const videoQualityChanged =
    settingsDefaultVideoQuality.value !== initialDefaultVideoQuality.value;

  return nameChanged || audioChanged || ttsChanged || videoQualityChanged;
});

watch(
  () => props.participantName,
  (name) => {
    if (name) {
      settingsParticipantName.value = name;
      initialParticipantName.value = name;
    }
  },
  { immediate: true },
);

function handleSettings() {
  settingsParticipantName.value = initialParticipantName.value;
  replicaTtsEnabled.value = initialReplicaTtsEnabled.value;
  settingsDefaultVideoQuality.value = initialDefaultVideoQuality.value;
  if (
    audioSettingsRef.value &&
    typeof (audioSettingsRef.value as any).resetSettings === "function"
  ) {
    (audioSettingsRef.value as any).resetSettings();
  }
  isSettingsOpen.value = true;
}

const activeCallWidgetIds = computed<CallWidgetId[]>(() => {
  const ids: CallWidgetId[] = [];
  if (isDocumentOpen.value) ids.push("document");
  if (isWhiteboardOpen.value) ids.push("whiteboard");
  if (isTableChatOpen.value) ids.push("table_chat");
  if (isTableDiceOpen.value) ids.push("table_dice");
  if (isTableStreamOpen.value) ids.push("table_stream");
  if (isSoundBarPanelOpen.value) ids.push("soundbar");
  return ids;
});

function activateCallWidgetFromMenu(id: CallWidgetId): void {
  switch (id) {
    case "document":
      toggleDocument();
      break;
    case "whiteboard":
      toggleWhiteboard();
      break;
    case "table_chat":
      toggleTableChat();
      break;
    case "table_dice":
      toggleTableDice();
      break;
    case "table_stream":
      toggleTableStream();
      break;
    case "soundbar":
      isSoundBarPanelOpen.value = !isSoundBarPanelOpen.value;
      break;
    case "settings":
      handleSettings();
      break;
    default:
      break;
  }
}

async function handleSaveSettings() {
  try {
    if (
      isAnonymousForSettings.value &&
      settingsParticipantName.value.trim()
    ) {
      const newName = settingsParticipantName.value.trim();
      setParticipantName(newName);
      initialParticipantName.value = newName;

      emit("update:participantName", newName);

      nextTick(() => {
        if (props.updateParticipantName) {
          props.updateParticipantName(newName);
        } else if (localParticipant.value) {
          try {
            localParticipant.value.setName(newName);
          } catch (err) {
            console.error("Failed to update name in LiveKit:", err);
          }
        }
      });
    }

    let audioSettingsChanged = false;
    let videoSettingsChanged = false;
    if (
      audioSettingsRef.value &&
      typeof (audioSettingsRef.value as any).getSettings === "function"
    ) {
      const currentSettings = (audioSettingsRef.value as any).getSettings();
      const savedInput = getStoredAudioInputDevice() || "";
      const savedVideo = getStoredVideoInputDevice() || "";
      audioSettingsChanged = currentSettings.inputDevice !== savedInput;
      videoSettingsChanged =
        (currentSettings.videoDevice ?? "") !== (savedVideo ?? "");
    }

    if (
      audioSettingsRef.value &&
      typeof (audioSettingsRef.value as any).saveSettings === "function"
    ) {
      await (audioSettingsRef.value as any).saveSettings();
    }

    if (audioSettingsChanged && mediaState.value.isAudioEnabled) {
      try {
        await switchAudioInputDevice();
      } catch (error) {
        console.error("Failed to switch audio device:", error);
      }
    }

    if (videoSettingsChanged && mediaState.value.isVideoEnabled) {
      try {
        await switchVideoInputDevice();
      } catch (error) {
        console.error("Failed to switch video device:", error);
      }
    }

    if (replicaTtsEnabled.value !== initialReplicaTtsEnabled.value) {
      setReplicaTtsEnabled(replicaTtsEnabled.value);
      initialReplicaTtsEnabled.value = replicaTtsEnabled.value;
    }

    if (settingsDefaultVideoQuality.value !== initialDefaultVideoQuality.value) {
      setStoredDefaultVideoQuality(settingsDefaultVideoQuality.value);
      initialDefaultVideoQuality.value = settingsDefaultVideoQuality.value;
    }

    isSettingsOpen.value = false;
  } catch (error) {
    console.error("Failed to save settings:", error);
    // Можно показать уведомление об ошибке
  }
}

function handleCancelSettings() {
  if (isAnonymousForSettings.value) {
    settingsParticipantName.value = initialParticipantName.value;
  }
  replicaTtsEnabled.value = initialReplicaTtsEnabled.value;
  settingsDefaultVideoQuality.value = initialDefaultVideoQuality.value;
  if (
    audioSettingsRef.value &&
    typeof (audioSettingsRef.value as any).resetSettings === "function"
  ) {
    (audioSettingsRef.value as any).resetSettings();
  }
  isSettingsOpen.value = false;
}

function handleModalClose() {
  // Если есть несохраненные изменения, спрашиваем подтверждение
  if (hasUnsavedSettingsChanges.value) {
    if (
      confirm(
        "У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?",
      )
    ) {
      handleCancelSettings();
    }
  } else {
    isSettingsOpen.value = false;
  }
}
</script>

<style scoped>
.room-info h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: 0.02em;
}

.conference-hall__sound-collab {
  flex-shrink: 0;
  max-height: min(42vh, 400px);
  min-height: 0;
  overflow: auto;
  padding: 0 16px 10px;
  -webkit-overflow-scrolling: touch;
}

.conference-hall__extras {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: min(52vh, 520px);
  min-height: 0;
  overflow: auto;
  padding: 0 16px 10px;
  -webkit-overflow-scrolling: touch;
}

.conference-hall__extra {
  flex-shrink: 0;
  min-height: 0;
}

.conference-hall__extra--document {
  min-height: 280px;
}

.conference-hall__extra--whiteboard {
  min-height: 240px;
}

.conference-hall__extra--chat,
.conference-hall__extra--dice {
  min-height: 260px;
}

.conference-hall__extra--stream {
  min-height: 200px;
}

.conference-hall__stream-video {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  aspect-ratio: 16 / 9;
}

.conference-hall__stream-placeholder {
  padding: 20px;
  text-align: center;
  font-size: 14px;
}

.conference-hall__content {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
  min-height: 0;
  padding-bottom: 100px;
}

@media (max-width: 768px) {
  .conference-hall__content {
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .conference-hall__main,
  .conference-hall__sidebar {
    flex-shrink: 0;
  }

  .conference-hall__sidebar {
    width: 100%;
    min-width: 0;
  }
}

.conference-hall__main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.conference-hall__leader {
  width: 100%;
  max-width: 800px;
  position: relative;
  aspect-ratio: 16/9;
}

.conference-hall__leader :deep(.player) {
  width: 100%;
  height: 100%;
}

.conference-hall__leader-label {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 6px 12px;
  background: var(--color-surface, #2a2a2a);
  font-size: 14px;
  font-weight: 600;
  z-index: 2;
}

.conference-hall__placeholder {
  width: 100%;
  max-width: 800px;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #00000020;
  border: 2px solid #333;
}

.conference-hall__placeholder-text {
  color: #888;
  font-size: 1.125rem;
}

.conference-hall__sidebar {
  width: 340px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.conference-hall__sidebar-title {
  margin: 0 0 8px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #bab1a8;
}

.conference-hall__raised {
  padding: 12px;
  background: #00000020;
  border: 2px solid #333;
}

.conference-hall__raised-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  gap: 8px;
  border-bottom: 1px solid #333;
}

.conference-hall__raised-item:last-child {
  border-bottom: none;
}

.conference-hall__participant-name {
  flex: 1;
  font-size: 14px;
  min-width: 0;
}

.conference-hall__raised-actions {
  display: flex;
  gap: 4px;
}

.conference-hall__others {
  padding: 16px 8px 8px 8px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.conference-hall__others-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.button--small {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  font-size: 0.875rem;
}

.conference-hall__panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 100001;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: flex-end;
}

.conference-hall__sidebar--panel {
  width: 340px;
  max-width: 100vw;
  height: 100%;
  background: var(--color-surface, #1f1f1f);
  border-left: 2px solid #444;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
  padding: 16px;
  overflow-y: auto;
}

.conference-hall__panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.conference-hall-panel-enter-active,
.conference-hall-panel-leave-active {
  transition: opacity 0.2s ease;
}
.conference-hall-panel-enter-active .conference-hall__sidebar--panel,
.conference-hall-panel-leave-active .conference-hall__sidebar--panel {
  transition: transform 0.2s ease;
}
.conference-hall-panel-enter-from,
.conference-hall-panel-leave-to {
  opacity: 0;
}
.conference-hall-panel-enter-from .conference-hall__sidebar--panel,
.conference-hall-panel-leave-to .conference-hall__sidebar--panel {
  transform: translateX(100%);
}
</style>
