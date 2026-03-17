<template>
  <div
    class="org-screen"
    :class="{
      'org-screen--mobile-list': isMobile && mobileView === 'list',
      'org-screen--mobile-room': isMobile && mobileView === 'room',
    }"
  >
    <div v-if="orgLoadError" class="org-screen__error">
      <div class="org-screen__error-card">
        <h2 class="org-screen__error-title">
          {{
            orgLoadError === "forbidden"
              ? "Нет доступа к организации"
              : "Организация не найдена"
          }}
        </h2>
        <p class="org-screen__error-text">
          {{
            orgLoadError === "forbidden"
              ? "У вас нет прав для просмотра этой организации. Запросите приглашение у участников."
              : "Возможно, ссылка устарела или организация была удалена."
          }}
        </p>
        <Button
          type="text"
          variant="secondary"
          size="medium"
          class="org-screen__error-action"
          @click="emit('back')"
        >
          К списку организаций
        </Button>
      </div>
    </div>
    <template v-else>
      <Transition name="room-ghost">
        <div
          v-if="dragGhostRoom"
          class="room-drag-ghost"
          :style="{
            left: `${dragGhostX}px`,
            top: `${dragGhostY + 24}px`,
          }"
        >
          <span class="room-drag-ghost__content">
            <span class="room-drag-ghost__head">
              <PixelIcon
                :name="roomTypeIcon(dragGhostRoom.room_type)"
                variant="small"
              />
              <span class="room-drag-ghost__name">{{
                dragGhostRoom.name
              }}</span>
            </span>
            <span
              v-if="dragGhostRoom.short_code"
              class="room-drag-ghost__code"
              >{{ dragGhostRoom.short_code }}</span
            >
          </span>
        </div>
      </Transition>
      <aside class="organization bg-dark-blur-90">
        <header class="organization-header font-bebas">
          <h2 class="organization-header-name">{{ org?.name ?? "…" }}</h2>
          <div class="organization-header-actions">
            <Button
              v-if="canManageOrg"
              type="text"
              variant="default"
              size="small"
              class="organization-header-settings"
              aria-label="Настройки организации"
              title="Настройки организации"
              @click="emit('org-settings')"
            >
              <PixelIcon name="settings" variant="small" />
            </Button>
            <Button
              v-if="canInvite"
              type="text"
              variant="primary"
              size="small"
              class="organization-header-invite"
              :disabled="inviteLoading"
              @click="openInviteModal"
            >
              {{ inviteLoading ? "…" : "Пригласить" }}
            </Button>
          </div>
        </header>

        <div class="rooms-list">
          <header class="rooms-list-header">
            <h5>Комнаты</h5>
            <button
              v-if="canEditRoom"
              type="button"
              class="rooms-list-header__add-group"
              aria-label="Создать группу"
              title="Создать группу"
              @click="showAddGroupInput = true"
            >
              + Группа
            </button>
          </header>
          <div v-if="loading" class="rooms-list-skeleton">
            <div v-for="i in 5" :key="i" class="room room-skeleton">
              <div class="room-button room-button-skeleton">
                <span class="room-button__content">
                  <span class="room-button__head">
                    <Skeleton variant="rect" :width="20" :height="20" />
                    <Skeleton variant="text" width="60%" :height="14" />
                  </span>
                  <Skeleton variant="text" width="40%" :height="12" />
                </span>
              </div>
            </div>
          </div>
          <div v-else class="rooms-list-scroll">
            <div
              v-if="canEditRoom && showAddGroupInput"
              class="room-group__create"
            >
              <div class="room-group__create-row">
                <input
                  v-model.trim="newGroupName"
                  type="text"
                  class="room-group__create-input"
                  placeholder="Название группы"
                  maxlength="100"
                  @keydown.enter="createGroup"
                  @keydown.escape="cancelAddGroup"
                />
                <div class="room-group__create-actions">
                  <Button
                    type="text"
                    variant="primary"
                    size="small"
                    :disabled="!newGroupName || groupCreateLoading"
                    @click="createGroup"
                  >
                    {{ groupCreateLoading ? "…" : "Создать" }}
                  </Button>
                  <Button
                    type="text"
                    variant="default"
                    size="small"
                    :disabled="groupCreateLoading"
                    @click="cancelAddGroup"
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            </div>
            <div
              v-if="
                canEditRoom && roomGroupsWithRooms.length > 0 && isDraggingRoom
              "
              class="rooms-list__drop-ungrouped"
              :class="{ 'rooms-list__drop-ungrouped--over': dragOverUngrouped }"
              data-drop-ungrouped
              @dragover.prevent="onUngroupedDragOver"
              @dragleave="onUngroupedDragLeave"
              @drop.prevent="onUngroupedDrop"
            >
              В общий список
            </div>
            <div v-if="ungroupedRooms.length" class="rooms-list__ungrouped">
              <template v-for="(room, index) in ungroupedRooms" :key="room.id">
                <div
                  v-if="canEditRoom && isDraggingRoom"
                  class="room-reorder-drop"
                  data-reorder-bucket=""
                  :data-reorder-index="index"
                ></div>
                <div
                  class="room"
                  :class="{
                    'room--active': joinedRoomShortCode === room.short_code,
                    'room--draggable': canEditRoom,
                  }"
                  @pointerdown="canEditRoom && onRoomPointerDown($event, room)"
                >
                  <div
                    class="room-button"
                    role="button"
                    tabindex="0"
                    @click="handleRoomCardClick($event, room)"
                    @keydown.enter="joinRoom(room)"
                    @keydown.space.prevent="joinRoom(room)"
                  >
                    <span class="room-button__content">
                      <span class="room-button__head">
                        <PixelIcon
                          :name="roomTypeIcon(room.room_type)"
                          variant="small"
                        />
                        <span class="room-name">{{ room.name }}</span>
                      </span>
                      <span
                        v-if="room.allow_anonymous_join && room.short_code"
                        class="room-code room-code--copyable"
                        role="button"
                        tabindex="0"
                        title="Копировать код"
                        @click.stop="copyRoomCode(room.short_code)"
                        @keydown.enter.prevent="copyRoomCode(room.short_code)"
                        @keydown.space.prevent="copyRoomCode(room.short_code)"
                        >{{ room.short_code }}</span
                      >
                    </span>
                    <span class="room-button__indicators">
                      <Button
                        v-if="joinedRoomShortCode === room.short_code"
                        type="icon"
                        variant="danger"
                        size="small"
                        class="room-button__hangup"
                        aria-label="Завершить звонок"
                        title="Завершить звонок"
                        @click.stop="leaveRoomOrCancelJoin()"
                      >
                        <PixelIcon name="hangup" variant="small" />
                      </Button>
                      <Button
                        v-if="canEditRoom || canDeleteRoom"
                        size="small"
                        variant="default"
                        aria-label="Настройки комнаты"
                        title="Настройки комнаты"
                        @click.stop="handleRoomSettingsClick($event, room)"
                      >
                        <PixelIcon name="settings" variant="small" />
                      </Button>
                    </span>
                  </div>
                  <div
                    v-if="roomParticipantsForRoom(room).length"
                    class="room-participants-list"
                  >
                    <RoomParticipantsList
                      :participants="roomParticipantsForRoom(room)"
                    />
                  </div>
                </div>
              </template>
              <div
                v-if="canEditRoom && isDraggingRoom"
                class="room-reorder-drop"
                data-reorder-bucket=""
                :data-reorder-index="ungroupedRooms.length"
              ></div>
            </div>
            <template v-for="group in roomGroupsWithRooms" :key="group.id">
              <div
                class="room-group"
                :data-drop-group-id="group.id"
                @dragover.prevent="onGroupDragOver($event, group.id)"
                @dragleave="onGroupDragLeave(group.id)"
                @drop.prevent="onGroupDrop($event, group.id)"
              >
                <div
                  class="room-group__header"
                  :class="{
                    'room-group__header--drop-over':
                      dragOverGroupId === group.id,
                  }"
                >
                  <button
                    type="button"
                    class="room-group__header-main"
                    :aria-expanded="!isGroupCollapsed(group.id)"
                    @click="
                      setGroupCollapsed(group.id, !isGroupCollapsed(group.id))
                    "
                  >
                    <PixelIcon
                      :name="isGroupCollapsed(group.id) ? 'right' : 'down'"
                      variant="small"
                      class="room-group__chevron"
                    />
                    <span
                      v-if="editingGroupId !== group.id"
                      class="room-group__name"
                      @dblclick.stop="
                        canEditRoom ? startEditGroup(group) : undefined
                      "
                    >
                      {{ group.name }}
                    </span>
                    <input
                      v-else
                      :ref="(el) => setGroupEditInputRef(el, group.id)"
                      v-model="editingGroupName"
                      type="text"
                      class="room-group__input"
                      @blur="saveEditGroup(group)"
                      @keydown.enter="saveEditGroup(group)"
                      @keydown.escape="editingGroupId = null"
                    />
                  </button>
                  <Button
                    v-if="canEditRoom"
                    type="icon"
                    size="small"
                    variant="danger"
                    class="room-group__delete"
                    aria-label="Удалить группу"
                    title="Удалить группу"
                    @click="deleteGroup(group)"
                  >
                    <PixelIcon name="close" variant="small" />
                  </Button>
                </div>
                <div
                  v-show="!isGroupCollapsed(group.id)"
                  class="room-group__rooms"
                >
                  <div v-for="(room, index) in group.rooms" :key="room.id">
                    <div
                      v-if="canEditRoom && isDraggingRoom"
                      class="room-reorder-drop"
                      :data-reorder-bucket="group.id"
                      :data-reorder-index="index"
                    ></div>
                    <div
                      class="room"
                      :class="{
                        'room--active': joinedRoomShortCode === room.short_code,
                        'room--draggable': canEditRoom,
                      }"
                      @pointerdown="
                        canEditRoom && onRoomPointerDown($event, room)
                      "
                    >
                      <div
                        class="room-button"
                        role="button"
                        tabindex="0"
                        @click="handleRoomCardClick($event, room)"
                        @keydown.enter="joinRoom(room)"
                        @keydown.space.prevent="joinRoom(room)"
                      >
                        <span class="room-button__content">
                          <span class="room-button__head">
                            <PixelIcon
                              :name="roomTypeIcon(room.room_type)"
                              variant="small"
                            />
                            <span class="room-name">{{ room.name }}</span>
                          </span>
                          <span
                            v-if="room.allow_anonymous_join && room.short_code"
                            class="room-code room-code--copyable"
                            role="button"
                            tabindex="0"
                            title="Копировать код"
                            @click.stop="copyRoomCode(room.short_code)"
                            @keydown.enter.prevent="
                              copyRoomCode(room.short_code)
                            "
                            @keydown.space.prevent="
                              copyRoomCode(room.short_code)
                            "
                            >{{ room.short_code }}</span
                          >
                        </span>
                        <span class="room-button__indicators">
                          <Button
                            v-if="joinedRoomShortCode === room.short_code"
                            type="icon"
                            variant="danger"
                            size="small"
                            class="room-button__hangup"
                            aria-label="Завершить звонок"
                            title="Завершить звонок"
                            @click.stop="leaveRoomOrCancelJoin()"
                          >
                            <PixelIcon name="hangup" variant="small" />
                          </Button>
                          <Button
                            v-if="canEditRoom || canDeleteRoom"
                            size="small"
                            variant="default"
                            aria-label="Настройки комнаты"
                            title="Настройки комнаты"
                            @click.stop="handleRoomSettingsClick($event, room)"
                          >
                            <PixelIcon name="settings" variant="small" />
                          </Button>
                        </span>
                      </div>
                      <div
                        v-if="roomParticipantsForRoom(room).length"
                        class="room-participants-list"
                      >
                        <RoomParticipantsList
                          :participants="roomParticipantsForRoom(room)"
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="canEditRoom && isDraggingRoom"
                    class="room-reorder-drop"
                    :data-reorder-bucket="group.id"
                    :data-reorder-index="group.rooms.length"
                  ></div>
                </div>
              </div>
            </template>
            <Button
              v-if="canCreateRoom"
              type="text"
              variant="default"
              size="small"
              class="room-button room-button--create button--scale-disabled"
              draggable="true"
              @click="openCreateRoom(null)"
              @dragstart="onCreateRoomDragStart"
              @dragend="onCreateRoomDragEnd"
            >
              + Создать комнату
            </Button>
          </div>
        </div>

        <section class="rooms-list">
          <header class="rooms-list-header">
            <h5>Участники</h5>
          </header>
          <div v-if="membersLoading" class="rooms-list-skeleton">
            <div
              v-for="i in 6"
              :key="i"
              class="room-participant room-participant-skeleton"
            >
              <span class="room-participant__main">
                <Skeleton variant="circle" :width="24" :height="24" />
                <span class="room-participant-skeleton__lines">
                  <Skeleton variant="text" width="100px" :height="14" />
                  <Skeleton variant="text" width="60px" :height="12" />
                </span>
              </span>
            </div>
          </div>
          <div v-else class="rooms-list-scroll">
            <ul class="rooms-list-members">
              <li
                v-for="member in membersSorted"
                :key="member.user_id"
                class="room-participant"
              >
                <span class="room-participant__main">
                  <span
                    class="room-participant__avatar"
                    :class="{
                      'room-participant__avatar--in-call':
                        isMemberInCall(member),
                      'room-participant__avatar--online':
                        !isMemberInCall(member) && isMemberOnline(member),
                      'room-participant__avatar--offline':
                        !isMemberInCall(member) && !isMemberOnline(member),
                    }"
                    :style="{
                      backgroundColor:
                        member.color ?? DEFAULT_PARTICIPANT_COLOR,
                    }"
                    :title="
                      isMemberInCall(member)
                        ? 'На созвоне'
                        : isMemberOnline(member)
                          ? 'В сети'
                          : 'Не в сети'
                    "
                    aria-hidden="true"
                  >
                    {{
                      (
                        member.name ||
                        member.email ||
                        displayMemberId(member.user_id) ||
                        "?"
                      )
                        .charAt(0)
                        .toUpperCase()
                    }}
                  </span>
                  <span class="player-name color-white font-bebas">{{
                    member.name ||
                    member.email ||
                    displayMemberId(member.user_id)
                  }}</span>
                </span>
                <span class="room-participant-role">{{
                  roleLabel(member.role)
                }}</span>
              </li>
            </ul>
          </div>
        </section>

        <footer
          class="organization-footer"
          :class="{
            'organization-footer--colors-expanded': footerColorsExpanded,
          }"
        >
          <button
            type="button"
            class="organization-footer-menu"
            aria-label="Меню"
            title="Меню"
            @click="openSidebarDrawer?.()"
          >
            <PixelIcon name="burger" variant="small" />
          </button>
          <div class="organization-footer-avatar-wrap">
            <button
              type="button"
              class="organization-footer-avatar"
              :style="{
                backgroundColor: footerColor,
                color: '#fff',
              }"
              title="Мой цвет в орге"
              aria-label="Развернуть палитру"
              :aria-expanded="footerColorsExpanded"
              :disabled="footerColorSaving"
              @click="footerColorsExpanded = !footerColorsExpanded"
            >
              {{ currentUserLetter }}
            </button>
            <div
              ref="footerColorsRef"
              class="organization-footer-colors"
              :class="{
                'organization-footer-colors--expanded': footerColorsExpanded,
              }"
            >
              <template v-if="footerColorsExpanded">
                <button
                  v-for="c in footerColorPalette"
                  :key="c"
                  type="button"
                  class="organization-footer-color"
                  :class="{
                    'organization-footer-color--active': footerColor === c,
                  }"
                  :style="{ backgroundColor: c }"
                  :title="c"
                  aria-label="Выбрать цвет"
                  :disabled="footerColorSaving"
                  @click="setFooterColor(c)"
                />
                <button
                  type="button"
                  class="organization-footer-color organization-footer-color--reset"
                  :class="{
                    'organization-footer-color--active': !currentMember?.color,
                  }"
                  title="Сбросить цвет"
                  aria-label="Сбросить цвет"
                  :disabled="footerColorSaving"
                  @click="setFooterColor(null)"
                >
                  −
                </button>
              </template>
            </div>
          </div>
          <div class="organization-footer-details">
            <span class="organization-footer-username">{{
              currentUserName
            }}</span>
          </div>
          <Button
            type="icon"
            variant="default"
            size="small"
            iconSize="32px"
            class="organization-footer-controls"
            aria-label="Настройки"
            title="Настройки"
            @click="openCallSettings()"
          >
            <PixelIcon name="settings" variant="small" />
          </Button>
        </footer>
      </aside>

      <div class="vert-container dashboard bg-dark-20">
        <header class="room-header bg-dark-20">
          <div class="room-info color-white font-bebas">
            <h2 class="room-info-title">
              {{ joinedRoomShortCode ? roomMenuName : "Выберите комнату" }}
            </h2>
          </div>
          <div class="room-indicators">
            <!-- Временно скрыто: открытие звонка в отдельном окне
            <Button
              v-if="joinedRoomShortCode && isTauriDesktop()"
              type="icon"
              variant="default"
              size="small"
              class="room-indicators__open-in-new-window"
              title="Открыть звонок в отдельном окне"
              aria-label="Открыть звонок в отдельном окне"
              @click="openCallInNewWindow(joinedRoomShortCode!)"
            >
              <PixelIcon name="link" variant="large" />
            </Button>
            -->
            <Button
              v-if="joinedRoomShortCode"
              type="text"
              variant="default"
              size="small"
              class="menu-back"
              :class="{
                'org-screen__back--mobile': isMobile && joinedRoomShortCode,
              }"
              @click="handleBackClick"
            >
              ← Назад
            </Button>
          </div>
        </header>

        <section
          class="nonza-widget"
          :class="{ 'nonza-widget--connected': !!joinedRoomShortCode }"
        >
          <NonzaWidget
            ref="nonzaWidgetRef"
            v-if="joinedRoomShortCode"
            :key="joinedRoomShortCode"
            :api-client="apiClient"
            :api-base-u-r-l="apiBaseURL"
            :livekit-u-r-l="livekitURL"
            :default-short-code="joinedRoomShortCode"
            :room="joinedRoom"
            :room-type-hint="joinedRoom?.room_type"
            :default-participant-name="defaultParticipantName"
            :get-participant-info="getParticipantInfoFromAuth"
            :hide-sidebar="true"
            entry-mode="by_selection"
            connect-on-mount
            @update:participants="onWidgetParticipantsUpdate"
            @disconnect="handleWidgetDisconnect"
          />
          <div v-else class="chat__empty">
            <p>Выберите комнату из списка — вы сразу подключитесь</p>
          </div>
        </section>
      </div>

      <Modal
        v-model="showCreateRoom"
        title="Создать комнату"
        :close-on-overlay-click="false"
      >
        <CreateRoomForm
          v-if="showCreateRoom"
          :org-id="orgId"
          :room-groups="roomGroups"
          :initial-group-id="createRoomPreselectedGroupId"
          hide-header
          @created="handleRoomCreated"
          @cancel="showCreateRoom = false"
        />
      </Modal>
      <Modal v-model="showInviteModal" title="Ссылка для приглашения">
        <p v-if="inviteError" class="org-screen__invite-error">
          {{ inviteError }}
        </p>
        <template v-else-if="inviteLink">
          <input
            :value="inviteLink"
            readonly
            class="org-screen__invite-input"
          />
        </template>
        <p v-else-if="inviteLoading" class="org-screen__invite-loading">
          Создание ссылки…
        </p>

        <template #footer>
          <Button
            v-if="inviteLink"
            type="text"
            size="small"
            @click="copyInviteLink"
          >
            Копировать
          </Button>
          <Button
            type="text"
            variant="default"
            size="small"
            @click="showInviteModal = false"
          >
            Закрыть
          </Button>
        </template>
      </Modal>
      <Modal
        v-model="showCallSettingsModal"
        title="Настройки"
        :close-on-overlay-click="!hasUnsavedCallSettingsChanges"
        @close="handleCallSettingsModalClose"
      >
        <div class="settings-content">
          <div v-if="isAnonymousForCallSettings" class="settings-section">
            <h3 class="settings-section-title">Участник</h3>
            <div class="settings-item">
              <label class="settings-label">Ваше имя</label>
              <div class="settings-input-group">
                <input
                  v-model="callSettingsParticipantName"
                  type="text"
                  class="settings-input"
                  placeholder="Введите ваше имя"
                />
              </div>
            </div>
          </div>
          <AudioSettings ref="callSettingsAudioRef" />
          <div class="settings-section">
            <h3 class="settings-section-title">Озвучивание реплик</h3>
            <div class="settings-item settings-item--row">
              <Switch
                :model-value="callSettingsReplicaTts"
                @update:model-value="callSettingsReplicaTts = $event"
              >
                <span>Озвучивать реплики (TTS)</span>
              </Switch>
            </div>
          </div>
          <div v-if="isTauriDesktop()" class="settings-section">
            <h3 class="settings-section-title">Горячие клавиши</h3>
            <div class="settings-item settings-item--row settings-hotkeys">
              <span class="settings-hotkeys__label">Микрофон</span>
              <button
                type="button"
                class="settings-hotkeys__key settings-hotkeys__key--editable"
                @click="recordingShortcut = 'audio'"
              >
                <template v-if="recordingShortcut === 'audio'">
                  Нажмите комбинацию…
                </template>
                <template v-else>
                  {{ shortcutToDisplay(callSettingsAudioShortcut) }}
                </template>
              </button>
            </div>
            <div class="settings-item settings-item--row settings-hotkeys">
              <span class="settings-hotkeys__label">Видео</span>
              <button
                type="button"
                class="settings-hotkeys__key settings-hotkeys__key--editable"
                @click="recordingShortcut = 'video'"
              >
                <template v-if="recordingShortcut === 'video'">
                  Нажмите комбинацию…
                </template>
                <template v-else>
                  {{ shortcutToDisplay(callSettingsVideoShortcut) }}
                </template>
              </button>
            </div>
            <div class="settings-item settings-item--row settings-hotkeys">
              <span class="settings-hotkeys__label">Отключить звук</span>
              <button
                type="button"
                class="settings-hotkeys__key settings-hotkeys__key--editable"
                @click="recordingShortcut = 'sound'"
              >
                <template v-if="recordingShortcut === 'sound'">
                  Нажмите комбинацию…
                </template>
                <template v-else>
                  {{ shortcutToDisplay(callSettingsSoundShortcut) }}
                </template>
              </button>
            </div>
            <div class="settings-item settings-item--row settings-hotkeys">
              <span class="settings-hotkeys__label">Завершить звонок</span>
              <button
                type="button"
                class="settings-hotkeys__key settings-hotkeys__key--editable"
                @click="recordingShortcut = 'leave'"
              >
                <template v-if="recordingShortcut === 'leave'">
                  Нажмите комбинацию…
                </template>
                <template v-else>
                  {{ shortcutToDisplay(callSettingsLeaveShortcut) }}
                </template>
              </button>
            </div>
          </div>
        </div>
        <template #footer>
          <Button
            type="text"
            variant="default"
            @click="handleCancelCallSettings"
          >
            Отмена
          </Button>
          <Button
            type="text"
            variant="accent"
            :class="{ 'button--has-changes': hasUnsavedCallSettingsChanges }"
            @click="handleSaveCallSettings"
          >
            Сохранить
          </Button>
        </template>
      </Modal>
      <Modal
        :model-value="!!roomSettingsRoom"
        :title="
          roomSettingsRoom ? `Настройки комнаты ${roomSettingsRoom.name}` : ''
        "
        @update:model-value="
          (v) => {
            if (!v) {
              roomSettingsRoom = null;
              showRoomDeleteConfirm = false;
            }
          }
        "
      >
        <template v-if="roomSettingsRoom">
          <FormSection label="Название комнаты">
            <Input
              v-model="roomSettingsName"
              placeholder="Введите название"
              aria-label="Название комнаты"
              :disabled="!canEditRoom"
            />
          </FormSection>
          <hr class="HR" />
          <FormSection
            label="Тип комнаты"
            hint="Конференц-зал — один спикер, остальные в сетке. Круглый стол — все равны в сетке."
          >
            <RadioButtonGroup
              v-model="roomSettingsRoomType"
              :options="roomTypeOptions"
              aria-label="Тип комнаты"
            />
          </FormSection>
          <hr class="HR" />
          <FormSection
            label="Разрешить подключение по коду (анонимно)"
            hint="Если включено, по коду комнаты смогут подключаться и из приложения meets, и по ссылке в rooms без входа в организацию."
          >
            <PixelSelect
              :model-value="roomSettingsAllowAnonymousSelect"
              :options="allowAnonymousOptions"
              :disabled="!canEditRoom"
              aria-label="Разрешить подключение по коду"
              @update:model-value="roomSettingsAllowAnonymousSelect = $event"
            />
          </FormSection>
          <template v-if="roomSettingsAllowAnonymous">
            <hr class="HR" />
            <FormSection
              label="Пароль комнаты"
              hint="Необязательно. Если задан, при входе по коду потребуется ввести пароль. Оставьте пустым, чтобы убрать пароль."
            >
              <Input
                v-model="roomSettingsPassword"
                type="password"
                placeholder="Новый пароль или пусто"
                aria-label="Пароль комнаты"
                :disabled="!canEditRoom"
                autocomplete="new-password"
              />
            </FormSection>
          </template>
          <template v-if="canEditRoom">
            <hr class="HR" />
            <FormSection label="Группа">
              <PixelSelect
                :model-value="roomSettingsGroupId"
                :options="roomGroupSelectOptions"
                aria-label="Группа комнаты"
                @update:model-value="roomSettingsGroupId = $event"
              />
            </FormSection>
          </template>
          <template v-if="canDeleteRoom">
            <hr class="HR" />
            <div class="room-settings-danger">
              <h3 class="room-settings-danger__title">Удалить комнату</h3>
              <p class="room-settings-danger__hint">
                Комната «{{ roomSettingsRoom.name }}» будет удалена без
                возможности восстановления.
              </p>
              <Button
                type="text"
                variant="danger"
                size="small"
                :disabled="roomDeleteDeleting"
                @click="showRoomDeleteConfirm = true"
              >
                {{ roomDeleteDeleting ? "Удаление…" : "Удалить комнату" }}
              </Button>
            </div>
          </template>
        </template>
        <template #footer>
          <Button
            v-if="canEditRoom"
            type="text"
            variant="primary"
            size="small"
            :disabled="roomSettingsSaving"
            @click="saveRoomSettings"
          >
            {{ roomSettingsSaving ? "Сохранение…" : "Сохранить" }}
          </Button>
          <Button
            type="text"
            variant="default"
            size="small"
            @click="roomSettingsRoom = null"
          >
            Закрыть
          </Button>
        </template>
      </Modal>
      <Modal
        :model-value="showRoomDeleteConfirm"
        title="Удалить комнату?"
        @update:model-value="showRoomDeleteConfirm = $event"
      >
        <p class="room-settings-danger__confirm-text">
          Комната «{{ roomSettingsRoom?.name }}» будет удалена без возможности
          восстановления. Продолжить?
        </p>
        <template #footer>
          <Button
            type="text"
            variant="danger"
            size="small"
            :disabled="roomDeleteDeleting"
            @click="confirmDeleteRoom"
          >
            Удалить
          </Button>
          <Button
            type="text"
            variant="secondary"
            size="small"
            @click="showRoomDeleteConfirm = false"
          >
            Отмена
          </Button>
        </template>
      </Modal>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  nextTick,
  inject,
} from "vue";
import {
  RoomApi,
  OrganizationApi,
  InviteApi,
  RoomGroupApi,
} from "@shared/entities";
import { useApiClient } from "@shared/api";
import type {
  Room,
  RoomWithParticipants,
  Organization,
  OrganizationMember,
  RoomGroup,
} from "@shared/entities";
import {
  canRole,
  ORG_ROLE_LABELS,
  ORG_PERMISSION_MANAGE_ORG,
  ORG_PERMISSION_CREATE_ROOM,
  ORG_PERMISSION_EDIT_ROOM,
  ORG_PERMISSION_DELETE_ROOM,
  ORG_PERMISSION_INVITE,
} from "@shared/entities/organization/model/org-roles";
import type { RoomType } from "@shared/lib";
import {
  Button,
  Modal,
  PixelIcon,
  FormSection,
  PixelSelect,
  Input,
  AudioSettings,
  Skeleton,
  Switch,
} from "@shared/ui";
import type { PixelSelectOption } from "@shared/ui";
import RadioButtonGroup from "@shared/ui/RadioButtonGroup/RadioButtonGroup.vue";
import type { RadioButtonOption } from "@shared/ui/RadioButtonGroup/RadioButtonGroup.vue";
import CreateRoomForm from "@rooms/features/create-room/ui/CreateRoomForm.vue";
import NonzaWidget from "@app/NonzaWidget.vue";
import {
  RoomParticipantsList,
  type RoomParticipantListItem,
} from "@widgets/room-participants-list";
import {
  getAuthState,
  getParticipantInfoFromAuth,
  getParticipantName,
  setParticipantName,
  getReplicaTtsEnabled,
  setReplicaTtsEnabled,
  showToast,
  useAppConfig,
  DEFAULT_PARTICIPANT_COLOR,
  PARTICIPANT_COLOR_PALETTE,
  // openCallInNewWindow, // временно скрыта кнопка "открыть в отдельном окне"
  isTauriDesktop,
  getStoredShortcuts,
  storeShortcuts,
  shortcutToDisplay,
  keyEventToShortcut,
  isModifierOnlyKey,
  type ShortcutBindings,
} from "@shared/lib";

const USER_ID_KEY = "nonza_user_id";

function getOrCreateUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

function getPresenceUserId(): string {
  const auth = getAuthState();
  if (auth?.user?.id) return auth.user.id;
  return getOrCreateUserId();
}

const props = defineProps<{
  orgId: string;
  apiClient?: import("@shared/api").ApiClient;
}>();

const emit = defineEmits<{ settings: []; "org-settings": []; back: [] }>();

const openSidebarDrawer = inject<(() => void) | undefined>("openSidebarDrawer");

const { apiBaseURL, livekitURL } = useAppConfig();
const apiClient = props.apiClient ?? useApiClient();
const roomApi = new RoomApi(apiClient);
const roomGroupApi = new RoomGroupApi(apiClient);
const organizationApi = new OrganizationApi(apiClient);
const inviteApi = new InviteApi(apiClient);

const org = ref<Organization | null>(null);
const orgLoadError = ref<"not_found" | "forbidden" | null>(null);
const rooms = ref<RoomWithParticipants[]>([]);
const roomGroups = ref<RoomGroup[]>([]);
const loading = ref(true);
const showCreateRoom = ref(false);
const createRoomPreselectedGroupId = ref<string | null>(null);
const dragOverGroupId = ref<string | null>(null);
const dragOverUngrouped = ref(false);
const isDraggingRoom = ref(false);
const justDropped = ref(false);
const ROOM_DRAG_THRESHOLD_PX = 8;

const dragGhostRoom = ref<RoomWithParticipants | null>(null);
const dragGhostX = ref(0);
const dragGhostY = ref(0);

let roomPointerRoom: RoomWithParticipants | null = null;
let roomPointerStartX = 0;
let roomPointerStartY = 0;
let roomDragStarted = false;
let unbindRoomPointer: (() => void) | null = null;

function getDropTargetAt(
  clientX: number,
  clientY: number,
):
  | {
      type: "group";
      groupId: string;
    }
  | { type: "ungrouped" }
  | { type: "reorder"; bucket: string; index: number }
  | null {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;
  const reorderEl = el.closest("[data-reorder-index]");
  if (
    reorderEl instanceof HTMLElement &&
    reorderEl.dataset.reorderIndex != null
  ) {
    const index = parseInt(reorderEl.dataset.reorderIndex, 10);
    if (!Number.isNaN(index)) {
      return {
        type: "reorder",
        bucket: reorderEl.dataset.reorderBucket ?? "",
        index,
      };
    }
  }
  const withGroup = el.closest("[data-drop-group-id]");
  if (withGroup instanceof HTMLElement && withGroup.dataset.dropGroupId) {
    return { type: "group", groupId: withGroup.dataset.dropGroupId };
  }
  if (el.closest("[data-drop-ungrouped]")) return { type: "ungrouped" };
  return null;
}

function onRoomPointerDown(e: PointerEvent, room: RoomWithParticipants) {
  if (e.button !== 0 || roomPointerRoom !== null) return;
  roomPointerRoom = room;
  roomPointerStartX = e.clientX;
  roomPointerStartY = e.clientY;
  roomDragStarted = false;

  const onMove = (e: PointerEvent) => {
    if (roomPointerRoom === null) return;
    if (!roomDragStarted) {
      const dx = e.clientX - roomPointerStartX;
      const dy = e.clientY - roomPointerStartY;
      if (Math.sqrt(dx * dx + dy * dy) > ROOM_DRAG_THRESHOLD_PX) {
        roomDragStarted = true;
        isDraggingRoom.value = true;
        dragGhostRoom.value = roomPointerRoom;
        dragGhostX.value = e.clientX;
        dragGhostY.value = e.clientY;
      } else return;
    }
    e.preventDefault();
    dragGhostX.value = e.clientX;
    dragGhostY.value = e.clientY;
    const target = getDropTargetAt(e.clientX, e.clientY);
    if (target?.type === "group") {
      dragOverGroupId.value = target.groupId;
      dragOverUngrouped.value = false;
    } else if (target?.type === "ungrouped") {
      dragOverGroupId.value = null;
      dragOverUngrouped.value = true;
    } else {
      dragOverGroupId.value = null;
      dragOverUngrouped.value = false;
    }
  };

  const onUp = async (e: PointerEvent) => {
    if (roomPointerRoom === null) return;
    const wasDrag = roomDragStarted;
    const roomId = roomPointerRoom.id;
    const fromBucket = roomPointerRoom.room_group_id ?? "";
    const target = wasDrag ? getDropTargetAt(e.clientX, e.clientY) : null;

    roomPointerRoom = null;
    roomDragStarted = false;
    isDraggingRoom.value = false;
    dragGhostRoom.value = null;
    dragOverGroupId.value = null;
    dragOverUngrouped.value = false;
    if (unbindRoomPointer) {
      unbindRoomPointer();
      unbindRoomPointer = null;
    }

    if (wasDrag && target) {
      e.preventDefault();
      e.stopPropagation();
      if (target.type === "group") {
        await moveRoomToGroup(roomId, target.groupId);
      } else if (target.type === "ungrouped") {
        await moveRoomToGroup(roomId, null);
      } else if (target.type === "reorder") {
        const targetBucket = target.bucket;
        if (targetBucket !== fromBucket) {
          await moveRoomToGroup(roomId, targetBucket || null);
          await applyReorder(roomId, targetBucket, targetBucket, target.index);
        } else {
          await applyReorder(roomId, fromBucket, targetBucket, target.index);
        }
      }
      justDropped.value = true;
      nextTick(() => {
        justDropped.value = false;
      });
    }
  };

  unbindRoomPointer = () => {
    document.removeEventListener("pointermove", onMove, true);
    document.removeEventListener("pointerup", onUp, true);
    document.removeEventListener("pointercancel", onUp, true);
  };
  document.addEventListener("pointermove", onMove, {
    capture: true,
    passive: false,
  });
  document.addEventListener("pointerup", onUp, { capture: true });
  document.addEventListener("pointercancel", onUp, { capture: true });
}

function handleRoomCardClick(e: MouseEvent, room: RoomWithParticipants) {
  if (justDropped.value) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  joinRoom(room);
}

function handleRoomSettingsClick(e: MouseEvent, room: RoomWithParticipants) {
  if (justDropped.value) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  openRoomSettings(room);
}
const showInviteModal = ref(false);
const roomSettingsRoom = ref<Room | null>(null);
const roomSettingsName = ref("");
const roomSettingsAllowAnonymous = ref(false);
const roomSettingsRoomType = ref<RoomType>("conference_hall");
const roomSettingsPassword = ref("");
const roomSettingsGroupId = ref<string>("");
const roomSettingsSaving = ref(false);
const showRoomDeleteConfirm = ref(false);
const roomDeleteDeleting = ref(false);
const inviteLink = ref<string | null>(null);
const inviteLoading = ref(false);
const inviteError = ref<string | null>(null);
const joinedRoomShortCode = ref<string | null>(null);

const isMobile = ref(false);
const mobileView = ref<"list" | "room">("list");
const nonzaWidgetRef = ref<InstanceType<typeof NonzaWidget> | null>(null);
const showCallSettingsModal = ref(false);
const callSettingsParticipantName = ref("");
const initialCallSettingsParticipantName = ref("");
const callSettingsReplicaTts = ref(false);
const initialCallSettingsReplicaTts = ref(false);
const callSettingsAudioShortcut = ref("");
const callSettingsVideoShortcut = ref("");
const callSettingsSoundShortcut = ref("");
const callSettingsLeaveShortcut = ref("");
const initialCallSettingsShortcuts = ref<ShortcutBindings | null>(null);
const recordingShortcut = ref<"audio" | "video" | "sound" | "leave" | null>(null);

watch(recordingShortcut, (key) => {
  if (!key) return;
  const handler = (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isModifierOnlyKey(e.key)) return;
    const s = keyEventToShortcut(e);
    if (!s) return;
    if (key === "audio") callSettingsAudioShortcut.value = s;
    else if (key === "video") callSettingsVideoShortcut.value = s;
    else if (key === "sound") callSettingsSoundShortcut.value = s;
    else callSettingsLeaveShortcut.value = s;
    recordingShortcut.value = null;
    cleanup();
  };
  function cleanup() {
    window.removeEventListener("keydown", handler, true);
  }
  window.addEventListener("keydown", handler, true);
  return cleanup;
});

const callSettingsAudioRef = ref<InstanceType<typeof AudioSettings> | null>(
  null,
);
const widgetParticipants = ref<RoomParticipantListItem[]>([]);
const widgetParticipantsRoomCode = ref<string | null>(null);
const members = ref<OrganizationMember[]>([]);
const membersLoading = ref(false);
const previousMembersCount = ref(0);
const previousMembersCountOrgId = ref<string | null>(null);

const collapsedStorageKey = (orgId: string) =>
  `org-screen-room-groups-collapsed-${orgId}`;
const groupsCollapsed = ref<Record<string, boolean>>({});
const showAddGroupInput = ref(false);
const newGroupName = ref("");
const groupCreateLoading = ref(false);
const editingGroupId = ref<string | null>(null);
const editingGroupName = ref("");
let groupEditInputRef: HTMLInputElement | null = null;

function setGroupEditInputRef(el: unknown, _groupId: string) {
  groupEditInputRef = el as HTMLInputElement | null;
  if (groupEditInputRef) {
    nextTick(() => groupEditInputRef?.focus());
  }
}

function loadCollapsedState() {
  try {
    const raw = localStorage.getItem(collapsedStorageKey(props.orgId));
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      groupsCollapsed.value = { ...parsed };
    } else {
      groupsCollapsed.value = {};
    }
  } catch {
    groupsCollapsed.value = {};
  }
}

function setGroupCollapsed(id: string, collapsed: boolean) {
  const next = { ...groupsCollapsed.value, [id]: collapsed };
  groupsCollapsed.value = next;
  try {
    localStorage.setItem(
      collapsedStorageKey(props.orgId),
      JSON.stringify(next),
    );
  } catch {
    /* ignore */
  }
}

function isGroupCollapsed(id: string): boolean {
  return !!groupsCollapsed.value[id];
}

async function createGroup() {
  const name = newGroupName.value.trim();
  if (!name || groupCreateLoading.value) return;
  groupCreateLoading.value = true;
  try {
    const created = await roomGroupApi.create(props.orgId, {
      name,
      position: roomGroups.value?.length ?? 0,
    });
    roomGroups.value = [...(roomGroups.value ?? []), created];
    showAddGroupInput.value = false;
    newGroupName.value = "";
  } catch (e) {
    console.error("Failed to create group:", e);
  } finally {
    groupCreateLoading.value = false;
  }
}

function cancelAddGroup() {
  showAddGroupInput.value = false;
  newGroupName.value = "";
}

function startEditGroup(group: RoomGroup) {
  editingGroupId.value = group.id;
  editingGroupName.value = group.name;
}

async function saveEditGroup(group: RoomGroup) {
  const name = editingGroupName.value.trim();
  if (name && name !== group.name) {
    try {
      const updated = await roomGroupApi.update(props.orgId, group.id, {
        name,
      });
      const list = roomGroups.value ?? [];
      const idx = list.findIndex((g) => g.id === group.id);
      if (idx !== -1) {
        const next = [...list];
        next[idx] = updated;
        roomGroups.value = next;
      }
    } catch (e) {
      console.error("Failed to update group:", e);
    }
  }
  editingGroupId.value = null;
  editingGroupName.value = "";
}

async function deleteGroup(group: RoomGroup) {
  try {
    await roomGroupApi.delete(props.orgId, group.id);
    if (editingGroupId.value === group.id) {
      editingGroupId.value = null;
      editingGroupName.value = "";
    }
    roomGroups.value = (roomGroups.value ?? []).filter(
      (g) => g.id !== group.id,
    );
    const list = rooms.value ?? [];
    const next = list.map((r) =>
      r.room_group_id === group.id ? { ...r, room_group_id: null } : r,
    );
    rooms.value = next;
  } catch (e) {
    console.error("Failed to delete group:", e);
  }
}

const sortedRooms = computed(() => {
  const list = rooms.value ?? [];
  const groups = roomGroups.value ?? [];
  const groupPosition = (r: RoomWithParticipants) => {
    if (!r.room_group_id) return -1;
    const g = groups.find((gr) => gr.id === r.room_group_id);
    return g?.position ?? 0;
  };
  return [...list].sort((a, b) => {
    const gpA = groupPosition(a);
    const gpB = groupPosition(b);
    if (gpA !== gpB) return gpA - gpB;
    return (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id);
  });
});

const roomGroupsWithRooms = computed(() => {
  const sorted = sortedRooms.value;
  const groups = (roomGroups.value ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);
  return groups.map((g) => ({
    ...g,
    rooms: sorted.filter((r) => r.room_group_id === g.id),
  }));
});

const ungroupedRooms = computed(() => {
  return sortedRooms.value.filter((r) => !r.room_group_id);
});

function buildOrderAfterReorder(
  draggedId: string,
  fromBucket: string,
  toBucket: string,
  toIndex: number,
): string[] {
  const ungroupedIds = ungroupedRooms.value.map((r) => r.id);
  const groupBuckets = roomGroupsWithRooms.value.map((gr) => ({
    key: gr.id,
    ids: gr.rooms.map((r) => r.id),
  }));
  const getBucketIds = (bucket: string) =>
    bucket === ""
      ? ungroupedIds
      : (groupBuckets.find((b) => b.key === bucket)?.ids ?? []);
  const fromIds = getBucketIds(fromBucket);
  const toIds = getBucketIds(toBucket);
  const source = fromBucket === toBucket ? fromIds : toIds;
  const idxInSource = source.indexOf(draggedId);
  const fromIdx = idxInSource === -1 ? toIndex : idxInSource;
  const without = source.filter((id) => id !== draggedId);
  const insertIdx = fromIdx < toIndex ? toIndex - 1 : toIndex;
  const newBucketIds = [...without];
  newBucketIds.splice(Math.min(insertIdx, newBucketIds.length), 0, draggedId);
  const result: string[] = [];
  if (fromBucket === "") {
    result.push(...newBucketIds);
    for (const b of groupBuckets) result.push(...b.ids);
  } else {
    result.push(...ungroupedIds);
    for (const b of groupBuckets) {
      result.push(...(b.key === fromBucket ? newBucketIds : b.ids));
    }
  }
  return result;
}

async function applyReorder(
  draggedId: string,
  fromBucket: string,
  toBucket: string,
  toIndex: number,
) {
  const newOrder = buildOrderAfterReorder(
    draggedId,
    fromBucket,
    toBucket,
    toIndex,
  );
  if (newOrder.length === 0) return;
  try {
    await roomApi.updateOrder(props.orgId!, newOrder);
    await loadRooms();
  } catch (e) {
    console.error("Failed to reorder rooms:", e);
  }
}

const orgOnlineUserIds = ref<Set<string>>(new Set());
const orgWsOpen = ref(false);

const inCallUserIds = computed(() => {
  const set = new Set<string>();
  for (const room of rooms.value ?? []) {
    for (const p of room.participants ?? []) {
      const id = p.identity?.toLowerCase?.() ?? p.identity;
      if (id) set.add(id);
    }
  }
  return set;
});

const effectiveOnlineUserIds = computed(() => {
  const set = new Set(
    Array.from(orgOnlineUserIds.value).map((x) => x?.toLowerCase?.() ?? x),
  );
  if (orgWsOpen.value) {
    const self = getPresenceUserId()?.toLowerCase?.();
    if (self) set.add(self);
  }
  return set;
});

function isMemberOnline(member: OrganizationMember): boolean {
  const id = member.user_id?.toLowerCase();
  if (!id) return false;
  return effectiveOnlineUserIds.value.has(id);
}

function isMemberInCall(member: OrganizationMember): boolean {
  return inCallUserIds.value.has(member.user_id);
}

const defaultParticipantName = computed(() => {
  const user = getAuthState()?.user;
  return (user?.name || user?.email || "").trim() || undefined;
});

const isAnonymousForCallSettings = computed(() => !getAuthState()?.user);

const hasUnsavedCallSettingsChanges = computed(() => {
  const nameChanged =
    isAnonymousForCallSettings.value &&
    callSettingsParticipantName.value.trim() !==
      initialCallSettingsParticipantName.value.trim();
  let audioChanged = false;
  const audioRef = callSettingsAudioRef.value as {
    hasUnsavedChanges?: () => boolean;
  } | null;
  if (audioRef?.hasUnsavedChanges) {
    audioChanged = audioRef.hasUnsavedChanges();
  }
  const ttsChanged =
    callSettingsReplicaTts.value !== initialCallSettingsReplicaTts.value;
  const prev = initialCallSettingsShortcuts.value;
  const shortcutsChanged =
    isTauriDesktop() &&
    prev &&
    (callSettingsAudioShortcut.value !== prev.audio ||
      callSettingsVideoShortcut.value !== prev.video ||
      callSettingsSoundShortcut.value !== prev.sound ||
      callSettingsLeaveShortcut.value !== prev.leave);
  return nameChanged || audioChanged || ttsChanged || shortcutsChanged;
});

const currentUserLetter = computed(() => {
  const user = getAuthState()?.user;
  const name = (user?.name || user?.email || "").trim();
  return name ? name.charAt(0).toUpperCase() : "?";
});

const currentUserName = computed(() => {
  const user = getAuthState()?.user;
  return (user?.name || user?.email || "").trim() || "Гость";
});

const currentUserId = computed(() => getPresenceUserId());

const currentMember = computed(() => {
  const id = currentUserId.value?.toLowerCase();
  if (!id) return null;
  const list = members.value ?? [];
  return list.find((m) => m.user_id?.toLowerCase() === id) ?? null;
});

const membersSorted = computed(() => {
  const list = [...(members.value ?? [])];
  list.sort((a, b) => {
    const aInCall = isMemberInCall(a);
    const bInCall = isMemberInCall(b);
    if (aInCall !== bInCall) return aInCall ? -1 : 1;
    const aOnline = isMemberOnline(a);
    const bOnline = isMemberOnline(b);
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    return 0;
  });
  return list;
});

const footerColorPalette = [...PARTICIPANT_COLOR_PALETTE];
const footerColor = computed(
  () =>
    currentMember.value?.color ??
    getAuthState()?.user?.color ??
    DEFAULT_PARTICIPANT_COLOR,
);
const footerColorSaving = ref(false);
const footerColorsExpanded = ref(false);
const footerColorsRef = ref<HTMLElement | null>(null);

async function setFooterColor(color: string | null) {
  if (!props.orgId) return;
  const current = currentMember.value?.color ?? null;
  if (current === color) return;
  footerColorSaving.value = true;
  try {
    await organizationApi.updateMyMemberColor(props.orgId, {
      color: color ?? undefined,
    });
    await loadMembers();
    footerColorsExpanded.value = false;
    nonzaWidgetRef.value?.updateParticipantColor?.(color);
  } finally {
    footerColorSaving.value = false;
  }
}

let footerColorsClose: ((e: MouseEvent) => void) | null = null;
watch(footerColorsExpanded, (expanded) => {
  if (footerColorsClose) {
    document.removeEventListener("click", footerColorsClose);
    footerColorsClose = null;
  }
  if (!expanded) return;
  footerColorsClose = (e: MouseEvent) => {
    const el = footerColorsRef.value;
    if (el?.contains(e.target as Node)) return;
    footerColorsExpanded.value = false;
  };
  requestAnimationFrame(() =>
    document.addEventListener("click", footerColorsClose!),
  );
});

const canCreateRoom = computed(() =>
  canRole(currentMember.value?.role ?? "", ORG_PERMISSION_CREATE_ROOM),
);
const canManageOrg = computed(() =>
  canRole(currentMember.value?.role ?? "", ORG_PERMISSION_MANAGE_ORG),
);
const canInvite = computed(() =>
  canRole(currentMember.value?.role ?? "", ORG_PERMISSION_INVITE),
);
const canEditRoom = computed(() =>
  canRole(currentMember.value?.role ?? "", ORG_PERMISSION_EDIT_ROOM),
);
const canDeleteRoom = computed(() =>
  canRole(currentMember.value?.role ?? "", ORG_PERMISSION_DELETE_ROOM),
);

function roleLabel(role: string): string {
  const r = role?.toLowerCase();
  return (
    (r && ORG_ROLE_LABELS[r as keyof typeof ORG_ROLE_LABELS]) ?? role ?? ""
  );
}

const roomMenuName = computed(() => {
  if (!joinedRoomShortCode.value) return "";
  const list = rooms.value ?? [];
  const r = list.find((x) => x.short_code === joinedRoomShortCode.value);
  return r?.name ?? joinedRoomShortCode.value;
});

const joinedRoom = computed(() => {
  if (!joinedRoomShortCode.value) return null;
  const list = rooms.value ?? [];
  return list.find((x) => x.short_code === joinedRoomShortCode.value) ?? null;
});

function roomTypeIcon(roomType: RoomType): "conference" | "round-table" {
  return roomType === "conference_hall" ? "conference" : "round-table";
}

const roomTypeOptions: RadioButtonOption[] = [
  { value: "conference_hall", label: "Конференц-зал", icon: "conference" },
  { value: "round_table", label: "Круглый стол", icon: "round-table" },
];

const allowAnonymousOptions: PixelSelectOption[] = [
  { value: "true", label: "Разрешить" },
  { value: "false", label: "Запретить" },
];

const roomGroupSelectOptions = computed<PixelSelectOption[]>(() => {
  const groups = roomGroups.value ?? [];
  const options: PixelSelectOption[] = [
    { value: "", label: "Без группы" },
    ...groups.map((g) => ({ value: g.id, label: g.name })),
  ];
  return options;
});

const roomSettingsAllowAnonymousSelect = computed<string>({
  get: () => (roomSettingsAllowAnonymous.value ? "true" : "false"),
  set: (v: string) => {
    roomSettingsAllowAnonymous.value = v === "true";
  },
});

function roomParticipantsForRoom(
  room: RoomWithParticipants,
): RoomParticipantListItem[] {
  const code = room.short_code ?? null;
  const isActiveRoom = code !== null && code === joinedRoomShortCode.value;
  const useWidgetList =
    isActiveRoom && code === widgetParticipantsRoomCode.value;
  if (useWidgetList) {
    return widgetParticipants.value as RoomParticipantListItem[];
  }
  const memberById = new Map(
    (members.value ?? []).map((m) => [m.user_id?.toLowerCase() ?? "", m]),
  );
  return (room.participants ?? []).map((p) => {
    const member = p.identity
      ? memberById.get(p.identity.toLowerCase())
      : undefined;
    return {
      identity: p.identity,
      participantName: p.name || p.identity,
      participantColor: member?.color ?? DEFAULT_PARTICIPANT_COLOR,
    };
  });
}

function onWidgetParticipantsUpdate(list: RoomParticipantListItem[]) {
  const code = joinedRoomShortCode.value;
  if (code === null) return;
  widgetParticipantsRoomCode.value = code;
  widgetParticipants.value = list;
}

function handleWidgetDisconnect() {
  widgetParticipants.value = [];
  widgetParticipantsRoomCode.value = null;
  joinedRoomShortCode.value = null;
}

async function leaveRoomOrCancelJoin() {
  await nonzaWidgetRef.value?.disconnect?.();
  widgetParticipants.value = [];
  widgetParticipantsRoomCode.value = null;
  joinedRoomShortCode.value = null;
  if (isMobile.value) {
    mobileView.value = "list";
  }
}

function handleBackClick() {
  if (isMobile.value) {
    mobileView.value = "list";
  } else {
    leaveRoomOrCancelJoin();
  }
}

function openCallSettings() {
  if (
    joinedRoomShortCode.value &&
    nonzaWidgetRef.value?.openCallSettings &&
    !isTauriDesktop()
  ) {
    nonzaWidgetRef.value.openCallSettings();
    return;
  }
  callSettingsParticipantName.value =
    defaultParticipantName.value ?? getParticipantName() ?? "";
  initialCallSettingsParticipantName.value = callSettingsParticipantName.value;
  callSettingsReplicaTts.value = getReplicaTtsEnabled();
  initialCallSettingsReplicaTts.value = callSettingsReplicaTts.value;
  const stored = getStoredShortcuts();
  callSettingsAudioShortcut.value = stored.audio;
  callSettingsVideoShortcut.value = stored.video;
  callSettingsSoundShortcut.value = stored.sound;
  callSettingsLeaveShortcut.value = stored.leave;
  initialCallSettingsShortcuts.value = { ...stored };
  recordingShortcut.value = null;
  nextTick(() => {
    (
      callSettingsAudioRef.value as { resetSettings?: () => void }
    )?.resetSettings?.();
  });
  showCallSettingsModal.value = true;
}

async function handleSaveCallSettings() {
  if (
    isAnonymousForCallSettings.value &&
    callSettingsParticipantName.value.trim()
  ) {
    setParticipantName(callSettingsParticipantName.value);
    initialCallSettingsParticipantName.value =
      callSettingsParticipantName.value;
  }
  const save = (
    callSettingsAudioRef.value as { saveSettings?: () => Promise<void> }
  )?.saveSettings;
  if (save) await save();
  setReplicaTtsEnabled(callSettingsReplicaTts.value);
  initialCallSettingsReplicaTts.value = callSettingsReplicaTts.value;
  const newShortcuts: ShortcutBindings = {
    audio: callSettingsAudioShortcut.value,
    video: callSettingsVideoShortcut.value,
    sound: callSettingsSoundShortcut.value,
    leave: callSettingsLeaveShortcut.value,
  };
  if (hasShortcutsChanged(newShortcuts)) {
    storeShortcuts(newShortcuts);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_shortcut_bindings", newShortcuts);
      await invoke("update_app_menu", {
        logoutVisible: !!getAuthState(),
        audioShortcut: newShortcuts.audio,
        videoShortcut: newShortcuts.video,
        leaveShortcut: newShortcuts.leave,
        soundShortcut: newShortcuts.sound,
      });
    } catch (err) {
      console.error("[shortcuts] set_shortcut_bindings / update_app_menu failed:", err);
    }
    initialCallSettingsShortcuts.value = { ...newShortcuts };
  }
  showCallSettingsModal.value = false;
}

function hasShortcutsChanged(next: ShortcutBindings): boolean {
  const prev = initialCallSettingsShortcuts.value;
  if (!prev) return false;
  return (
    next.audio !== prev.audio ||
    next.video !== prev.video ||
    next.sound !== prev.sound ||
    next.leave !== prev.leave
  );
}

function handleCancelCallSettings() {
  if (isAnonymousForCallSettings.value) {
    callSettingsParticipantName.value =
      initialCallSettingsParticipantName.value;
  }
  callSettingsReplicaTts.value = initialCallSettingsReplicaTts.value;
  if (initialCallSettingsShortcuts.value) {
    callSettingsAudioShortcut.value =
      initialCallSettingsShortcuts.value.audio;
    callSettingsVideoShortcut.value =
      initialCallSettingsShortcuts.value.video;
    callSettingsSoundShortcut.value =
      initialCallSettingsShortcuts.value.sound;
    callSettingsLeaveShortcut.value =
      initialCallSettingsShortcuts.value.leave;
  }
  recordingShortcut.value = null;
  (
    callSettingsAudioRef.value as { resetSettings?: () => void }
  )?.resetSettings?.();
  showCallSettingsModal.value = false;
}

function handleCallSettingsModalClose() {
  if (hasUnsavedCallSettingsChanges.value) {
    if (
      confirm("У вас есть несохранённые изменения. Закрыть без сохранения?")
    ) {
      handleCancelCallSettings();
    }
  } else {
    showCallSettingsModal.value = false;
  }
}

async function loadOrg() {
  orgLoadError.value = null;
  try {
    org.value = await organizationApi.getById(props.orgId);
  } catch (e) {
    console.error("Failed to load org:", e);
    const msg = e instanceof Error ? e.message : String(e);
    orgLoadError.value = /403|forbidden|доступ/i.test(msg)
      ? "forbidden"
      : "not_found";
  }
}

async function loadRooms() {
  loading.value = true;
  loadCollapsedState();
  try {
    const [roomsList, groupsList] = await Promise.all([
      roomApi.listByOrganizationId(props.orgId, {
        include: "participants",
      }),
      roomGroupApi.listByOrganizationId(props.orgId),
    ]);
    rooms.value = roomsList;
    roomGroups.value = groupsList;
  } catch (e) {
    console.error("Failed to load rooms:", e);
  } finally {
    loading.value = false;
  }
}

async function loadMembers() {
  if (!props.orgId) return;
  const loadingOrgId = props.orgId;
  membersLoading.value = true;
  try {
    const data = await organizationApi.getMembers(loadingOrgId);
    if (loadingOrgId !== props.orgId) return;
    const prev = previousMembersCount.value;
    const prevOrgId = previousMembersCountOrgId.value;
    const isRefetchSameOrg = prevOrgId === loadingOrgId && prev > 0;
    if (isRefetchSameOrg && data.length > prev) {
      showToast("В организацию добавлен новый участник", { variant: "info" });
    }
    previousMembersCount.value = data.length;
    previousMembersCountOrgId.value = loadingOrgId;
    members.value = data;
  } catch (e) {
    console.error("Failed to load members:", e);
    if (loadingOrgId === props.orgId) members.value = [];
  } finally {
    if (loadingOrgId === props.orgId) membersLoading.value = false;
  }
}

function displayMemberId(userId: string): string {
  if (userId.length <= 12) return userId;
  return userId.slice(0, 8) + "…";
}

function refreshRoomsParticipants() {
  roomApi
    .listByOrganizationId(props.orgId, { include: "participants" })
    .then((list) => {
      rooms.value = list.map((r) => ({
        ...r,
        participants: r.participants ? [...r.participants] : [],
      }));
    })
    .catch((err) => {
      console.error("[org-ws] refreshRoomsParticipants failed:", err);
    });
}

let refreshParticipantsTimeout: ReturnType<typeof setTimeout> | null = null;
const INITIAL_PARTICIPANTS_REFRESH_DELAY_MS = 2500;
let initialParticipantsRefreshTimeout: ReturnType<typeof setTimeout> | null =
  null;

function scheduleRefreshRoomsParticipants() {
  if (refreshParticipantsTimeout) clearTimeout(refreshParticipantsTimeout);
  refreshParticipantsTimeout = setTimeout(() => {
    refreshParticipantsTimeout = null;
    refreshRoomsParticipants();
  }, 100);
}

let loadRoomsTimeout: ReturnType<typeof setTimeout> | null = null;
function scheduleLoadRooms() {
  if (loadRoomsTimeout) clearTimeout(loadRoomsTimeout);
  loadRoomsTimeout = setTimeout(() => {
    loadRoomsTimeout = null;
    loadRooms();
  }, 150);
}

function getOrgWsUrl(): string {
  const base = apiBaseURL.replace(/^http/, "ws");
  return `${base}${base.endsWith("/") ? "" : "/"}ws/org`;
}

let orgWs: WebSocket | null = null;
let orgWsSubscribedOrgId: string | null = null;

function connectOrgWs() {
  if (!props.orgId) return;
  orgWsSubscribedOrgId = props.orgId;
  const url = `${getOrgWsUrl()}?org_id=${encodeURIComponent(props.orgId)}&user_id=${encodeURIComponent(getPresenceUserId())}`;
  console.log("[org-ws] connect", url);
  orgWs = new WebSocket(url);
  orgWs.onopen = () => {
    console.log("[org-ws] open");
    orgWsOpen.value = true;
  };
  orgWs.onmessage = (event) => {
    const raw = typeof event.data === "string" ? event.data : "";
    const lines = raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        console.log("[org-ws] message type=", msg?.type, msg);
        if (msg?.type === "participants_changed") {
          scheduleRefreshRoomsParticipants();
        } else if (msg?.type === "rooms_changed") {
          scheduleLoadRooms();
        } else if (msg?.type === "org_members_changed") {
          loadMembers();
        } else if (
          msg?.type === "connected" &&
          msg?.payload?.channel === "org_participants"
        ) {
          const selfId = getPresenceUserId()?.toLowerCase?.();
          if (selfId) {
            orgOnlineUserIds.value = new Set(orgOnlineUserIds.value).add(
              selfId,
            );
          }
        } else if (msg?.type === "org_online_users") {
          const ids = ((msg?.payload?.user_ids as string[]) ?? []).map(
            (id) => id?.toLowerCase?.() ?? id,
          );
          orgOnlineUserIds.value = new Set(ids);
        } else if (msg?.type === "org_user_online") {
          const id = msg?.payload?.user_id as string | undefined;
          if (id) {
            orgOnlineUserIds.value = new Set(orgOnlineUserIds.value).add(
              id.toLowerCase(),
            );
          }
        } else if (msg?.type === "org_user_offline") {
          const id = (
            msg?.payload?.user_id as string | undefined
          )?.toLowerCase?.();
          if (id) {
            const next = new Set(
              Array.from(orgOnlineUserIds.value).map(
                (x) => x?.toLowerCase?.() ?? x,
              ),
            );
            next.delete(id);
            orgOnlineUserIds.value = next;
          }
        }
      } catch {
        // ignore parse error for this line
      }
    }
  };
  orgWs.onclose = () => {
    console.log("[org-ws] close");
    orgWsOpen.value = false;
    orgWs = null;
    if (orgWsSubscribedOrgId) {
      const orgId = orgWsSubscribedOrgId;
      setTimeout(() => {
        if (orgWsSubscribedOrgId === orgId && !orgWs) {
          console.log("[org-ws] reconnecting…");
          connectOrgWs();
        }
      }, 2000);
    }
  };
  orgWs.onerror = () => {
    console.log("[org-ws] error");
    orgWsOpen.value = false;
    orgWs?.close();
    orgWs = null;
  };
}

function disconnectOrgWs() {
  orgWsSubscribedOrgId = null;
  orgWsOpen.value = false;
  if (orgWs) {
    orgWs.close();
    orgWs = null;
  }
}

function joinRoom(room: Room) {
  if (room.short_code) {
    joinedRoomShortCode.value = room.short_code;
    if (isMobile.value) {
      mobileView.value = "room";
    }
  }
}

function openRoomSettings(room: Room) {
  roomSettingsRoom.value = room;
  roomSettingsName.value = room.name;
  roomSettingsAllowAnonymous.value = room.allow_anonymous_join ?? false;
  roomSettingsRoomType.value =
    room.room_type === "conference_hall" || room.room_type === "round_table"
      ? room.room_type
      : "conference_hall";
  roomSettingsPassword.value = "";
}

async function saveRoomSettings() {
  const room = roomSettingsRoom.value;
  if (!room?.short_code) return;
  roomSettingsSaving.value = true;
  try {
    const payload: {
      allow_anonymous_join: boolean;
      room_type: RoomType;
      name?: string;
      room_group_id?: string | null;
      password?: string | null;
    } = {
      allow_anonymous_join: roomSettingsAllowAnonymous.value,
      room_type: roomSettingsRoomType.value,
    };
    const nameTrimmed = roomSettingsName.value.trim();
    if (nameTrimmed && nameTrimmed !== room.name) payload.name = nameTrimmed;
    if (roomSettingsGroupId.value !== (room.room_group_id ?? "")) {
      payload.room_group_id = roomSettingsGroupId.value || null;
    }
    if (roomSettingsAllowAnonymous.value) {
      payload.password = roomSettingsPassword.value.trim();
    }
    const updated = await roomApi.updateSettings(room.short_code, payload);
    const idx = rooms.value.findIndex((r) => r.id === updated.id);
    if (idx !== -1) {
      const next = [...rooms.value];
      next[idx] = { ...next[idx], ...updated };
      rooms.value = next;
    }
    roomSettingsRoom.value = null;
  } catch (e) {
    console.error("Failed to update room settings:", e);
  } finally {
    roomSettingsSaving.value = false;
  }
}

async function confirmDeleteRoom() {
  const room = roomSettingsRoom.value;
  if (!room?.short_code) return;
  roomDeleteDeleting.value = true;
  try {
    await roomApi.delete(room.short_code);
    showRoomDeleteConfirm.value = false;
    roomSettingsRoom.value = null;
    if (joinedRoomShortCode.value === room.short_code) {
      await leaveRoomOrCancelJoin();
    }
    rooms.value = rooms.value.filter((r) => r.id !== room.id);
  } catch (e) {
    console.error("Failed to delete room:", e);
  } finally {
    roomDeleteDeleting.value = false;
  }
}

function handleRoomCreated(room: Room) {
  rooms.value = [...rooms.value, room as RoomWithParticipants];
  showCreateRoom.value = false;
  createRoomPreselectedGroupId.value = null;
}

const CREATE_ROOM_DRAG_TYPE = "application/x-nonza-create-room";
const ROOM_DRAG_TYPE = "application/x-nonza-room-id";

function openCreateRoom(preselectedGroupId: string | null) {
  createRoomPreselectedGroupId.value = preselectedGroupId;
  showCreateRoom.value = true;
}

function onCreateRoomDragStart(e: DragEvent) {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData(CREATE_ROOM_DRAG_TYPE, "1");
  e.dataTransfer.effectAllowed = "copy";
}

function onCreateRoomDragEnd() {
  dragOverGroupId.value = null;
  dragOverUngrouped.value = false;
}

function onGroupDragOver(_e: DragEvent, groupId: string) {
  dragOverGroupId.value = groupId;
}

function onGroupDragLeave(groupId: string) {
  if (dragOverGroupId.value === groupId) {
    dragOverGroupId.value = null;
  }
}

function onGroupDrop(e: DragEvent, groupId: string) {
  dragOverGroupId.value = null;
  if (e.dataTransfer?.types.includes(CREATE_ROOM_DRAG_TYPE)) {
    createRoomPreselectedGroupId.value = groupId;
    showCreateRoom.value = true;
    return;
  }
  if (e.dataTransfer?.types.includes(ROOM_DRAG_TYPE)) {
    const roomId = e.dataTransfer.getData(ROOM_DRAG_TYPE);
    moveRoomToGroup(roomId, groupId);
  }
}

function onUngroupedDragOver(e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer?.types.includes(ROOM_DRAG_TYPE)) {
    dragOverUngrouped.value = true;
  }
}

function onUngroupedDragLeave() {
  dragOverUngrouped.value = false;
}

function onUngroupedDrop(e: DragEvent) {
  dragOverUngrouped.value = false;
  if (!e.dataTransfer?.types.includes(ROOM_DRAG_TYPE)) return;
  const roomId = e.dataTransfer.getData(ROOM_DRAG_TYPE);
  moveRoomToGroup(roomId, null);
}

async function moveRoomToGroup(roomId: string, groupId: string | null) {
  const room = (rooms.value ?? []).find((r) => r.id === roomId);
  if (!room?.short_code) return;
  try {
    const updated = await roomApi.updateSettings(room.short_code, {
      room_group_id: groupId ?? "",
    });
    const list = rooms.value ?? [];
    const idx = list.findIndex((r) => r.id === updated.id);
    if (idx !== -1) {
      const next = [...list];
      next[idx] = {
        ...next[idx],
        ...updated,
        room_group_id: updated.room_group_id ?? null,
      };
      rooms.value = next;
    }
  } catch (err) {
    console.error("Failed to move room to group:", err);
  }
}

async function openInviteModal() {
  showInviteModal.value = true;
  inviteLink.value = null;
  inviteError.value = null;
  inviteLoading.value = true;
  try {
    const inv = await inviteApi.create(props.orgId);
    inviteLink.value = `${window.location.origin}${window.location.pathname}?page=invite&token=${encodeURIComponent(inv.token)}`;
  } catch (e) {
    inviteError.value =
      e instanceof Error ? e.message : "Не удалось создать приглашение";
  } finally {
    inviteLoading.value = false;
  }
}

async function copyInviteLink() {
  if (!inviteLink.value) return;
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    showToast("Ссылка скопирована", { variant: "success" });
  } catch {
    inviteError.value = "Не удалось скопировать";
  }
}

async function copyRoomCode(code: string | null | undefined) {
  const text = code?.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Код комнаты скопирован", { variant: "success" });
  } catch {
    // ignore
  }
}

watch(
  () => props.orgId,
  async () => {
    if (refreshParticipantsTimeout) {
      clearTimeout(refreshParticipantsTimeout);
      refreshParticipantsTimeout = null;
    }
    joinedRoomShortCode.value = null;
    disconnectOrgWs();
    previousMembersCount.value = 0;
    previousMembersCountOrgId.value = null;
    await loadOrg();
    if (orgLoadError.value) return;
    loadRooms();
    loadMembers();
    if (props.orgId) {
      connectOrgWs();
    }
  },
);

watch(joinedRoomShortCode, (code) => {
  widgetParticipants.value = [];
  widgetParticipantsRoomCode.value = null;
  refreshRoomsParticipants();
  if (isMobile.value) {
    mobileView.value = code ? "room" : "list";
  }
});

watch(roomSettingsRoom, (room) => {
  roomSettingsName.value = room?.name ?? "";
  roomSettingsAllowAnonymous.value = room?.allow_anonymous_join ?? false;
  roomSettingsRoomType.value =
    room?.room_type === "conference_hall" || room?.room_type === "round_table"
      ? room.room_type
      : "conference_hall";
  roomSettingsGroupId.value = room?.room_group_id ?? "";
  roomSettingsPassword.value = "";
});

let mobileQuery: MediaQueryList | null = null;
let mobileQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;

onMounted(async () => {
  mobileQuery = window.matchMedia("(max-width: 1000px)");
  isMobile.value = mobileQuery.matches;
  mobileQueryHandler = (e: MediaQueryListEvent) => {
    isMobile.value = e.matches;
  };
  mobileQuery.addEventListener("change", mobileQueryHandler);
  if (joinedRoomShortCode.value && mobileQuery.matches) {
    mobileView.value = "room";
  }

  await loadOrg();
  if (orgLoadError.value) return;
  loadRooms();
  loadMembers();
  if (props.orgId) {
    connectOrgWs();
    if (initialParticipantsRefreshTimeout)
      clearTimeout(initialParticipantsRefreshTimeout);
    initialParticipantsRefreshTimeout = setTimeout(() => {
      initialParticipantsRefreshTimeout = null;
      refreshRoomsParticipants();
    }, INITIAL_PARTICIPANTS_REFRESH_DELAY_MS);
  }
});

onUnmounted(() => {
  if (mobileQuery && mobileQueryHandler) {
    mobileQuery.removeEventListener("change", mobileQueryHandler);
  }
  if (refreshParticipantsTimeout) {
    clearTimeout(refreshParticipantsTimeout);
    refreshParticipantsTimeout = null;
  }
  if (initialParticipantsRefreshTimeout) {
    clearTimeout(initialParticipantsRefreshTimeout);
    initialParticipantsRefreshTimeout = null;
  }
  disconnectOrgWs();
});
</script>

<style scoped>
.org-screen {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.org-screen__error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  min-width: 0;
}

.org-screen__error-card {
  max-width: 400px;
  background: #2a2a2a;
  border: 2px solid #444;
  padding: 24px;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
  text-align: center;
}

.org-screen__error-title {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  font-family: "Bebas Neue", sans-serif;
  letter-spacing: 0.02em;
}

.org-screen__error-text {
  margin: 0 0 20px 0;
  color: #bab1a8;
  font-size: 14px;
  line-height: 1.5;
}

.org-screen__error-action {
  width: 100%;
}

.vert-container.dashboard {
  border-radius: 0 5px 5px 0;
}

@media (max-width: 1000px) {
  .org-screen--mobile-list .organization {
    flex: 1;
    width: 100%;
    max-width: none;
  }

  .org-screen--mobile-list .vert-container.dashboard {
    display: none;
  }

  .org-screen--mobile-room .organization {
    display: none;
  }

  .org-screen--mobile-room .vert-container.dashboard {
    flex: 1;
    width: 100%;
    min-width: 0;
  }

  .org-screen__back--mobile {
    min-height: 44px;
    padding: 10px 16px;
    font-size: 1rem;
  }
}

.nonza-widget {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.nonza-widget--connected {
  padding-bottom: 0;
}

.chat__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  padding: 24px;
}

.org-screen__invite-error {
  margin: 0 0 16px 0;
  color: #e2534b;
  font-size: 14px;
}

.org-screen__invite-loading {
  margin: 0 0 16px 0;
  color: #999;
  font-size: 14px;
}

.org-screen__invite-input {
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 2px solid #444;
  background: #1a1a1a;
  color: #fff;
  font-size: 14px;
  box-sizing: border-box;
}

.room-settings-danger {
  padding-top: 8px;
}

.room-settings-danger__title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #999;
}

.room-settings-danger__hint {
  margin: 0 0 12px 0;
  color: #999;
  font-size: 14px;
  line-height: 1.4;
}

.room-settings-danger__confirm-text {
  margin: 0 0 16px 0;
  color: #bab1a8;
  line-height: 1.5;
}

.rooms-list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
}

.rooms-list-header__add-group {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.15s ease;
}

.rooms-list-header__add-group:hover {
  color: rgba(255, 255, 255, 0.7);
  text-decoration: underline;
}

.rooms-list__ungrouped {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rooms-list__drop-ungrouped {
  padding: 6px 10px;
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 2px dashed rgba(255, 255, 255, 0.15);
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}

.rooms-list__drop-ungrouped--over {
  border-color: #2980b9;
  color: rgba(255, 255, 255, 0.7);
}

.room--draggable {
  cursor: grab;
  user-select: none;
}

.room--draggable:active {
  cursor: grabbing;
}

.room-reorder-drop {
  min-height: 8px;
  margin: 4px 0;
  border-radius: 2px;
  border: 2px dashed rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.2);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.room-reorder-drop:hover {
  border-color: #2980b9;
  background: rgba(41, 128, 185, 0.2);
}

.room-drag-ghost {
  position: fixed;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 10000;
  box-sizing: border-box;
  min-width: 260px;
  max-width: 420px;
  width: max-content;
  padding: 8px 12px 10px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  background: #333333;
  color: #e0e0e0;
  font: inherit;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  opacity: 0.9;
  transition: box-shadow 0.2s ease;
}

.room-ghost-enter-active {
  transition:
    opacity 0.18s ease-out,
    transform 0.18s ease-out;
}

.room-ghost-leave-active {
  transition: opacity 0.12s ease-in;
}

.room-ghost-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.94);
}

.room-ghost-leave-to {
  opacity: 0;
}

.room-drag-ghost__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.room-drag-ghost__head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.room-drag-ghost__name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.room-drag-ghost__code {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.45);
}

.room-group {
  margin-top: 4px;
  margin-bottom: 2px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.room-group__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 10px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  background: #333333;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.3;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
  box-sizing: border-box;
  min-width: 0;
}

.room-group__header:hover {
  background-color: #444444;
  border-color: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.5);
}

.room-group__header--drop-over {
  background-color: rgba(41, 128, 185, 0.25);
  border-color: #2980b9;
  color: #fff;
}

.room-group__header-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: inherit;
  font-weight: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  line-height: inherit;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}

.room-group__chevron {
  flex-shrink: 0;
}

.room-group__chevron--placeholder {
  opacity: 0.5;
}

.room-group__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-group__name--muted {
  color: rgba(255, 255, 255, 0.5);
  text-transform: none;
  letter-spacing: 0;
  font-size: 14px;
}

.room-group__delete {
  flex-shrink: 0;
  align-self: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.room-group:hover .room-group__delete {
  opacity: 1;
}

.room-group__rooms {
  padding-left: 0;
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-group__create {
  padding: 8px 12px 10px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  border-top: none;
  background: #2a2a2a;
}

.rooms-list-scroll > .room-group__create {
  border-top: 3px solid rgba(255, 255, 255, 0.08);
}

.room-group__create-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.room-group__create-input {
  width: 100%;
  padding: 8px 10px;
  border: 3px solid rgba(255, 255, 255, 0.12);
  background: #1a1a1a;
  color: #fff;
  font-size: 14px;
  box-sizing: border-box;
}

.room-group__create-input:focus {
  outline: none;
  border-color: #2980b9;
}

.room-group__create-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.room-group__input {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  border: 3px solid rgba(255, 255, 255, 0.12);
  background: #1a1a1a;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  box-sizing: border-box;
}

.room-group__input:focus {
  outline: none;
  border-color: #2980b9;
}

.room-code--copyable {
  cursor: pointer;
}

.room-button--create {
  cursor: grab;
}

.room-button--create:active {
  cursor: grabbing;
}

.rooms-list-skeleton {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.room-skeleton {
  display: flex;
  flex-direction: column;
}

.room-button-skeleton {
  width: 100%;
  padding: 8px 12px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  min-width: 0;
}

.room-button-skeleton .room-button__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.room-button-skeleton .room-button__head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.room-participant-skeleton {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}

.room-participant-skeleton .room-participant__main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.room-participant-skeleton__lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
