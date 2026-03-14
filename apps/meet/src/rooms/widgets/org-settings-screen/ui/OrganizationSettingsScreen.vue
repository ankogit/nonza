<template>
  <ScreenLayout narrow>
    <div v-if="loadError" class="org-settings-screen__error">
      <p>{{ loadError === "forbidden" ? "Нет доступа" : "Организация не найдена" }}</p>
      <Button type="text" variant="secondary" size="small" @click="emit('back')">
        Назад
      </Button>
    </div>
    <div v-else class="org-settings-screen org-settings-screen--page">
      <header class="org-settings-screen__header">
        <h2 class="org-settings-screen__title">{{ org?.name ?? "Настройки организации" }}</h2>
        <Button
          type="icon"
          variant="default"
          :icon-size="'32px'"
          title="Назад"
          aria-label="Назад"
          @click="emit('back')"
        >
          ✕
        </Button>
      </header>
      <div class="org-settings-screen__body">
        <FormSection label="Название">
          <Input
            v-if="canManageOrg"
            v-model="nameEdit"
            placeholder="Название организации"
            aria-label="Название организации"
          />
          <span v-else class="org-settings-screen__readonly">{{ org?.name }}</span>
        </FormSection>

        <hr class="HR" />

        <FormSection label="Участники">
          <div v-if="membersLoading" class="org-settings-screen__loading">Загрузка…</div>
          <div v-else class="org-settings-screen__members-wrap">
            <ul class="org-settings-screen__members">
              <li
                v-for="member in members"
                :key="member.user_id"
                class="org-settings-screen__member"
                :class="{ 'org-settings-screen__member--contextable': canManageMembers && canRemoveMember(member) }"
                @contextmenu.prevent="onMemberContextMenu($event, member)"
              >
                <div class="org-settings-screen__member-info">
                  <span
                    class="org-settings-screen__member-avatar"
                    :class="avatarClass(member.role)"
                    :style="memberAvatarStyle(member)"
                    aria-hidden="true"
                  >
                    {{ memberInitial(member) }}
                  </span>
                  <span class="org-settings-screen__member-name">{{
                    member.name || member.email || member.user_id
                  }}</span>
                </div>
                <div class="org-settings-screen__member-role-cell">
                  <Badge
                    v-if="!canManageRoles || member.role === ORG_ROLE_OWNER"
                    :variant="roleBadgeVariant(member.role)"
                  >
                    {{ roleLabel(member.role) }}
                  </Badge>
                  <PillGroup
                    v-else
                    :model-value="member.role"
                    :options="memberRoleOptions"
                    :disabled="roleChangingId === member.user_id"
                    aria-label="Роль"
                    @update:model-value="(v) => setMemberRole(member, v)"
                  />
                </div>
              </li>
            </ul>
          </div>
        </FormSection>

        <hr class="HR" />
        <FormSection label="Мой цвет в орге">
          <div class="org-settings-screen__colors">
            <button
              v-for="c in colorPalette"
              :key="c"
              type="button"
              class="org-settings-screen__color-btn"
              :class="{ 'org-settings-screen__color-btn--active': myColorEdit === c }"
              :style="{ backgroundColor: c }"
              :title="c"
              aria-label="Выбрать цвет"
              @click="myColorEdit = myColorEdit === c ? null : c"
            />
            <Button
              type="text"
              variant="default"
              size="small"
              class="org-settings-screen__color-skip"
              @click.prevent="myColorEdit = null"
            >
              Сбросить
            </Button>
          </div>
          <Button
            v-if="myColorDirty"
            type="text"
            variant="primary"
            size="small"
            class="org-settings-screen__color-save"
            :disabled="savingColor"
            @click="saveMyColor"
          >
            {{ savingColor ? "Сохранение…" : "Сохранить цвет" }}
          </Button>
        </FormSection>

        <template v-if="!isOwner">
          <hr class="HR" />
          <div class="org-settings-screen__danger">
            <h3 class="org-settings-screen__danger-title">Покинуть организацию</h3>
            <p class="org-settings-screen__danger-hint">
              Вы больше не будете иметь доступа к комнатам и данным организации.
            </p>
            <Button
              type="text"
              variant="danger"
              size="small"
              :disabled="leaving"
              @click="showLeaveConfirm = true"
            >
              {{ leaving ? "Выход…" : "Покинуть организацию" }}
            </Button>
          </div>
        </template>

        <template v-if="isOwner">
          <hr class="HR" />
          <div class="org-settings-screen__danger">
            <h3 class="org-settings-screen__danger-title">Удалить организацию</h3>
            <p class="org-settings-screen__danger-hint">
              Все комнаты и данные организации будут удалены без возможности восстановления.
            </p>
            <Button
              type="text"
              variant="danger"
              size="small"
              :disabled="deleting"
              @click="showDeleteConfirm = true"
            >
              {{ deleting ? "Удаление…" : "Удалить организацию" }}
            </Button>
          </div>
        </template>
      </div>
      <footer class="org-settings-screen__footer">
        <Button
          v-if="canManageOrg"
          type="text"
          variant="primary"
          size="small"
          :disabled="savingName || !nameDirty"
          @click="saveName"
        >
          {{ savingName ? "Сохранение…" : "Сохранить" }}
        </Button>
        <Button type="text" variant="default" size="small" @click="emit('back')">
          Закрыть
        </Button>
      </footer>

      <Modal
        :model-value="showDeleteConfirm"
        title="Удалить организацию?"
        @update:model-value="showDeleteConfirm = $event"
      >
        <p class="org-settings-screen__confirm-text">
          Организация «{{ org?.name }}» и все её комнаты будут удалены без возможности восстановления.
        </p>
        <template #footer>
          <Button type="text" variant="danger" size="small" :disabled="deleting" @click="confirmDelete">
            Удалить
          </Button>
          <Button type="text" variant="secondary" size="small" @click="showDeleteConfirm = false">
            Отмена
          </Button>
        </template>
      </Modal>

      <Modal
        :model-value="showLeaveConfirm"
        title="Покинуть организацию?"
        @update:model-value="showLeaveConfirm = $event"
      >
        <p class="org-settings-screen__confirm-text">
          Вы покинете организацию «{{ org?.name }}» и потеряете доступ к её комнатам.
        </p>
        <template #footer>
          <Button type="text" variant="danger" size="small" :disabled="leaving" @click="confirmLeave">
            Покинуть
          </Button>
          <Button type="text" variant="secondary" size="small" @click="showLeaveConfirm = false">
            Отмена
          </Button>
        </template>
      </Modal>

      <Modal
        :model-value="!!memberToRemove"
        title="Удалить участника?"
        @update:model-value="(v) => !v && (memberToRemove = null)"
      >
        <p v-if="memberToRemove" class="org-settings-screen__confirm-text">
          {{ memberToRemove.name || memberToRemove.email || memberToRemove.user_id }} будет удалён из организации.
        </p>
        <template #footer>
          <Button
            type="text"
            variant="danger"
            size="small"
            :disabled="removingMemberId !== null"
            @click="confirmRemoveMember"
          >
            {{ removingMemberId ? "…" : "Удалить" }}
          </Button>
          <Button type="text" variant="secondary" size="small" @click="memberToRemove = null">
            Отмена
          </Button>
        </template>
      </Modal>

      <ContextMenu
        :model-value="!!contextMenu"
        :position="contextMenu ? { x: contextMenu.x, y: contextMenu.y } : undefined"
        :items="contextMenuItems"
        @update:model-value="(v) => !v && (contextMenu = null)"
        @select="onContextMenuSelect"
      />
    </div>
  </ScreenLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { OrganizationApi } from "@shared/entities";
import type { Organization, OrganizationMember } from "@shared/entities";
import { useApiClient } from "@shared/api";
import {
  canRole,
  assignableRoles,
  ORG_ROLE_LABELS,
  ORG_ROLE_OWNER,
  ORG_PERMISSION_MANAGE_ORG,
  ORG_PERMISSION_MANAGE_ROLES,
  ORG_PERMISSION_MANAGE_MEMBERS,
} from "@shared/entities/organization/model/org-roles";
import type { OrgRole } from "@shared/entities/organization/model/org-roles";
import {
  getAuthState,
  PARTICIPANT_COLOR_PALETTE,
  DEFAULT_PARTICIPANT_COLOR,
} from "@shared/lib";
import {
  ScreenLayout,
  Button,
  Input,
  FormSection,
  Modal,
  PillGroup,
  Badge,
  ContextMenu,
} from "@shared/ui";
import type { PillOption } from "@shared/ui";
import type { ContextMenuItem } from "@shared/ui";

const props = defineProps<{ orgId: string }>();
const emit = defineEmits<{ back: []; deleted: [] }>();

const apiClient = useApiClient();
const organizationApi = new OrganizationApi(apiClient);

const org = ref<Organization | null>(null);
const members = ref<OrganizationMember[]>([]);
const loadError = ref<string | null>(null);
const membersLoading = ref(false);
const nameEdit = ref("");
const savingName = ref(false);
const showDeleteConfirm = ref(false);
const deleting = ref(false);
const roleChangingId = ref<string | null>(null);
const showLeaveConfirm = ref(false);
const leaving = ref(false);
const memberToRemove = ref<OrganizationMember | null>(null);
const removingMemberId = ref<string | null>(null);
const myColorEdit = ref<string | null>(null);
const savingColor = ref(false);

const colorPalette = [...PARTICIPANT_COLOR_PALETTE];

interface ContextMenuState {
  x: number;
  y: number;
  member: OrganizationMember;
}
const contextMenu = ref<ContextMenuState | null>(null);

const contextMenuItems: ContextMenuItem[] = [
  { id: "remove", label: "Удалить", danger: true },
];

const currentMember = computed(() => {
  const id = getAuthState()?.user?.id?.toLowerCase();
  if (!id) return null;
  return members.value.find((m) => m.user_id?.toLowerCase() === id) ?? null;
});

const canManageOrg = computed(() =>
  canRole(currentMember.value?.role ?? "", ORG_PERMISSION_MANAGE_ORG),
);
const canManageRoles = computed(() =>
  canRole(currentMember.value?.role ?? "", ORG_PERMISSION_MANAGE_ROLES),
);
const canManageMembers = computed(() =>
  canRole(currentMember.value?.role ?? "", ORG_PERMISSION_MANAGE_MEMBERS),
);
const isOwner = computed(
  () => (currentMember.value?.role?.toLowerCase() ?? "") === ORG_ROLE_OWNER,
);

const nameDirty = computed(
  () => (org.value?.name ?? "").trim() !== nameEdit.value.trim(),
);

const myColorDirty = computed(
  () => (currentMember.value?.color ?? null) !== myColorEdit.value,
);

const memberRoleOptions = computed<PillOption[]>(() =>
  assignableRoles(currentMember.value?.role ?? "").map((r) => ({
    value: r,
    label: ORG_ROLE_LABELS[r as OrgRole],
  })),
);

function roleLabel(role: string): string {
  const r = role?.toLowerCase() as keyof typeof ORG_ROLE_LABELS | undefined;
  return (r && ORG_ROLE_LABELS[r]) ?? role ?? "";
}

function memberInitial(member: OrganizationMember): string {
  const name = (member.name || member.email || "").trim();
  if (name) return name.charAt(0).toUpperCase();
  const id = member.user_id ?? "";
  return id.charAt(0).toUpperCase() || "?";
}

function avatarClass(role: string): string {
  const r = role?.toLowerCase();
  if (r === ORG_ROLE_OWNER) return "org-settings-screen__member-avatar--owner";
  if (r === "admin") return "org-settings-screen__member-avatar--admin";
  return "";
}

function memberAvatarStyle(member: OrganizationMember): Record<string, string> {
  const r = member.role?.toLowerCase();
  const color =
    member.color ??
    (r !== ORG_ROLE_OWNER && r !== "admin" ? DEFAULT_PARTICIPANT_COLOR : undefined);
  if (!color) return {};
  return { backgroundColor: color, color: "#fff" };
}

function roleBadgeVariant(
  role: string,
): "warning" | "primary" | "default" {
  const r = role?.toLowerCase();
  if (r === ORG_ROLE_OWNER) return "warning";
  if (r === "admin") return "primary";
  return "default";
}

async function loadOrg() {
  loadError.value = null;
  try {
    org.value = await organizationApi.getById(props.orgId);
    nameEdit.value = org.value.name ?? "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    loadError.value = /403|forbidden|доступ/i.test(msg) ? "forbidden" : "not_found";
  }
}

async function loadMembers() {
  if (!props.orgId) return;
  membersLoading.value = true;
  try {
    members.value = await organizationApi.getMembers(props.orgId);
  } catch {
    members.value = [];
  } finally {
    membersLoading.value = false;
  }
}

watch(
  () => props.orgId,
  () => {
    loadOrg();
    loadMembers();
  },
  { immediate: true },
);

watch(
  currentMember,
  (m) => {
    myColorEdit.value = m?.color ?? null;
  },
  { immediate: true },
);

async function saveName() {
  if (!org.value || !nameDirty.value || savingName.value) return;
  savingName.value = true;
  try {
    org.value = await organizationApi.update(props.orgId, {
      name: nameEdit.value.trim(),
      description: org.value.description ?? undefined,
    });
  } catch (e) {
    console.error("Failed to update org name:", e);
  } finally {
    savingName.value = false;
  }
}

async function saveMyColor() {
  if (!props.orgId || !myColorDirty.value || savingColor.value) return;
  savingColor.value = true;
  try {
    await organizationApi.updateMyMemberColor(props.orgId, {
      color: myColorEdit.value,
    });
    await loadMembers();
  } catch {
    // ignore
  } finally {
    savingColor.value = false;
  }
}

async function setMemberRole(member: OrganizationMember, newRole: string) {
  if (member.role === newRole) return;
  roleChangingId.value = member.user_id;
  try {
    await organizationApi.updateMemberRole(props.orgId, member.user_id, newRole);
    const idx = members.value.findIndex((m) => m.user_id === member.user_id);
    if (idx !== -1) {
      members.value = [
        ...members.value.slice(0, idx),
        { ...members.value[idx], role: newRole },
        ...members.value.slice(idx + 1),
      ];
    }
  } catch (e) {
    console.error("Failed to update member role:", e);
  } finally {
    roleChangingId.value = null;
  }
}

async function confirmDelete() {
  if (!props.orgId || deleting.value) return;
  deleting.value = true;
  try {
    await organizationApi.delete(props.orgId);
    showDeleteConfirm.value = false;
    emit("deleted");
  } catch (e) {
    console.error("Failed to delete organization:", e);
  } finally {
    deleting.value = false;
  }
}

function canRemoveMember(member: OrganizationMember): boolean {
  if (!canManageMembers.value) return false;
  const currentId = getAuthState()?.user?.id?.toLowerCase();
  if (!currentId || member.user_id?.toLowerCase() === currentId) return false;
  return (member.role?.toLowerCase() ?? "") !== ORG_ROLE_OWNER;
}

function openRemoveMemberConfirm(member: OrganizationMember) {
  memberToRemove.value = member;
}

function onMemberContextMenu(e: MouseEvent, member: OrganizationMember) {
  if (!canRemoveMember(member)) return;
  contextMenu.value = { x: e.clientX, y: e.clientY, member };
}

function onContextMenuSelect(item: ContextMenuItem) {
  if (item.id === "remove" && contextMenu.value) {
    openRemoveMemberConfirm(contextMenu.value.member);
  }
  contextMenu.value = null;
}

async function confirmRemoveMember() {
  if (!memberToRemove.value || removingMemberId.value) return;
  removingMemberId.value = memberToRemove.value.user_id;
  try {
    await organizationApi.removeMember(props.orgId, memberToRemove.value.user_id);
    members.value = members.value.filter((m) => m.user_id !== memberToRemove.value!.user_id);
    memberToRemove.value = null;
  } catch (e) {
    console.error("Failed to remove member:", e);
  } finally {
    removingMemberId.value = null;
  }
}

async function confirmLeave() {
  if (!props.orgId || leaving.value) return;
  const currentId = getAuthState()?.user?.id;
  if (!currentId) return;
  leaving.value = true;
  try {
    await organizationApi.removeMember(props.orgId, currentId);
    showLeaveConfirm.value = false;
    emit("deleted");
  } catch (e) {
    console.error("Failed to leave organization:", e);
  } finally {
    leaving.value = false;
  }
}

</script>

<style scoped>
.org-settings-screen__error {
  padding: 24px;
  text-align: center;
  color: #bab1a8;
}

.org-settings-screen__error p {
  margin-bottom: 16px;
}

.org-settings-screen--page {
  background: #1f1f1f;
  border: 3px solid #444;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.5), 8px 8px 0 0 rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.org-settings-screen__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 2px solid #333;
  background: #2a2a2a;
  gap: 16px;
}

.org-settings-screen__title {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.5rem;
  font-weight: 400;
  color: #bab1a8;
  letter-spacing: 0.02em;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-settings-screen__body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  color: #bab1a8;
}

.org-settings-screen__readonly {
  font-size: 16px;
  color: #bab1a8;
}

.org-settings-screen__loading {
  color: #999;
  font-size: 14px;
}

.org-settings-screen__members-wrap {
  border: 2px solid #444;
  background: #1a1a1a;
  overflow: hidden;
}

.org-settings-screen__members {
  list-style: none;
  margin: 0;
  padding: 0;
}

.org-settings-screen__member {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
  min-height: 48px;
  padding: 0 14px;
  border-bottom: 1px solid #333;
  transition: background 0.12s ease;
}

.org-settings-screen__member:last-child {
  border-bottom: none;
}

.org-settings-screen__member:hover {
  background: rgba(255, 255, 255, 0.03);
}

.org-settings-screen__member--contextable {
  cursor: context-menu;
}

.org-settings-screen__member-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.org-settings-screen__member-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  font-family: "Bebas Neue", sans-serif;
  color: #fff;
  background: #444;
}

.org-settings-screen__member-avatar--owner {
  background: linear-gradient(135deg, #c9a227 0%, #a67c00 100%);
  color: #1a1a1a;
}

.org-settings-screen__member-avatar--admin {
  background: #2980b9;
  color: #fff;
}

.org-settings-screen__member-name {
  color: #bab1a8;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-settings-screen__member-role-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 120px;
}

.org-settings-screen__colors {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.org-settings-screen__color-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid #444;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.org-settings-screen__color-btn:hover {
  filter: brightness(1.15);
}

.org-settings-screen__color-btn--active {
  border-color: #fff;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.4);
}

.org-settings-screen__color-skip {
  margin-left: 4px;
}

.org-settings-screen__color-save {
  margin-top: 12px;
}

.org-settings-screen__danger {
  padding-top: 8px;
}

.org-settings-screen__danger-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #999;
}

.org-settings-screen__danger-hint {
  margin: 0 0 12px 0;
  color: #999;
  font-size: 14px;
  line-height: 1.4;
}

.org-settings-screen__footer {
  padding: 20px;
  border-top: 2px solid #333;
  background: #2a2a2a;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.org-settings-screen__confirm-text {
  margin: 0 0 16px 0;
  color: #bab1a8;
  line-height: 1.5;
}
</style>
