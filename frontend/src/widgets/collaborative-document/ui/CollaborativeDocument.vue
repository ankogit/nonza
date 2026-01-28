<template>
  <div class="collaborative-document">
    <div class="collaborative-document__header">
      <h3 class="collaborative-document__title">Совместный документ</h3>
      <div class="collaborative-document__actions">
        <button
          class="collaborative-document__button"
          title="Копировать"
          @click="handleCopy"
        >
          📋
        </button>
        <button
          class="collaborative-document__button"
          title="Скачать"
          @click="handleDownload"
        >
          💾
        </button>
        <div
          v-if="connectionStatus !== 'connected'"
          class="collaborative-document__status"
          :class="{
            'collaborative-document__status--connecting':
              connectionStatus === 'connecting',
            'collaborative-document__status--disconnected':
              connectionStatus === 'disconnected',
          }"
        >
          {{
            connectionStatus === "connecting" ? "Подключение..." : "Отключено"
          }}
        </div>
      </div>
    </div>
    <div v-if="editor" class="collaborative-document__toolbar">
      <button
        class="collaborative-document__toolbar-button"
        :class="{
          'collaborative-document__toolbar-button--active':
            editor.isActive('bold'),
        }"
        @click="editor.chain().focus().toggleBold().run()"
        title="Жирный"
      >
        <strong>B</strong>
      </button>
      <button
        class="collaborative-document__toolbar-button"
        :class="{
          'collaborative-document__toolbar-button--active':
            editor.isActive('italic'),
        }"
        @click="editor.chain().focus().toggleItalic().run()"
        title="Курсив"
      >
        <em>I</em>
      </button>
      <button
        class="collaborative-document__toolbar-button"
        :class="{
          'collaborative-document__toolbar-button--active':
            editor.isActive('strike'),
        }"
        @click="editor.chain().focus().toggleStrike().run()"
        title="Зачеркнутый"
      >
        <s>S</s>
      </button>
      <div class="collaborative-document__toolbar-separator"></div>
      <button
        class="collaborative-document__toolbar-button"
        :class="{
          'collaborative-document__toolbar-button--active': editor.isActive(
            'heading',
            { level: 1 },
          ),
        }"
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        title="Заголовок 1"
      >
        H1
      </button>
      <button
        class="collaborative-document__toolbar-button"
        :class="{
          'collaborative-document__toolbar-button--active': editor.isActive(
            'heading',
            { level: 2 },
          ),
        }"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        title="Заголовок 2"
      >
        H2
      </button>
      <button
        class="collaborative-document__toolbar-button"
        :class="{
          'collaborative-document__toolbar-button--active': editor.isActive(
            'heading',
            { level: 3 },
          ),
        }"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        title="Заголовок 3"
      >
        H3
      </button>
      <div class="collaborative-document__toolbar-separator"></div>
      <button
        class="collaborative-document__toolbar-button"
        :class="{
          'collaborative-document__toolbar-button--active':
            editor.isActive('bulletList'),
        }"
        @click="editor.chain().focus().toggleBulletList().run()"
        title="Маркированный список"
      >
        •
      </button>
      <button
        class="collaborative-document__toolbar-button"
        :class="{
          'collaborative-document__toolbar-button--active':
            editor.isActive('orderedList'),
        }"
        @click="editor.chain().focus().toggleOrderedList().run()"
        title="Нумерованный список"
      >
        1.
      </button>
      <button
        class="collaborative-document__toolbar-button"
        :class="{
          'collaborative-document__toolbar-button--active':
            editor.isActive('blockquote'),
        }"
        @click="editor.chain().focus().toggleBlockquote().run()"
        title="Цитата"
      >
        "
      </button>
      <button
        class="collaborative-document__toolbar-button"
        :class="{
          'collaborative-document__toolbar-button--active':
            editor.isActive('code'),
        }"
        @click="editor.chain().focus().toggleCode().run()"
        title="Код"
      >
        &lt;/&gt;
      </button>
      <div class="collaborative-document__toolbar-separator"></div>
      <button
        class="collaborative-document__toolbar-button"
        :class="{
          'collaborative-document__toolbar-button--active':
            editor.isActive('link'),
        }"
        @click="handleLink"
        title="Ссылка"
      >
        🔗
      </button>
    </div>
    <div class="collaborative-document__editor-wrapper">
      <EditorContent
        v-if="editor"
        :editor="editor"
        class="collaborative-document__editor"
      />
      <div v-else class="collaborative-document__loading">
        Загрузка редактора...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { Editor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Link from "@tiptap/extension-link";
import { Markdown } from "@tiptap/markdown";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { encodeAwarenessUpdate } from "y-protocols/awareness";
import { YjsWebSocketProvider } from "@shared/lib";
import type { Room as RoomEntity } from "@entities/room";

const props = defineProps<{
  room: RoomEntity | null;
  apiBaseURL: string;
  participantName: string;
}>();

// Y.js document
// TipTap Collaboration will create the "content" XmlFragment automatically
const ydoc = new Y.Doc();

// Create awareness for tracking cursor positions and user info
const awareness = new awarenessProtocol.Awareness(ydoc);

// Editor instance
const editor = ref<Editor>();
const provider = ref<YjsWebSocketProvider | null>(null);
const connectionStatus = ref<"connecting" | "connected" | "disconnected">(
  "disconnected",
);

const initializeEditor = () => {
  if (!props.room || !props.apiBaseURL) {
    console.warn("[CollaborativeDocument] Missing room or apiBaseURL");
    return;
  }

  // Convert http:// to ws:// and https:// to wss://
  const wsProtocol = props.apiBaseURL.startsWith("https://")
    ? "wss://"
    : "ws://";
  const wsHost = props.apiBaseURL.replace(/^https?:\/\//, "");
  const wsUrl = `${wsProtocol}${wsHost}`;

  console.log(
    "[CollaborativeDocument] Initializing editor for room:",
    props.room.id,
  );

  // Clean up existing provider if it exists
  if (provider.value) {
    provider.value.destroy();
    provider.value = null;
  }

  // Set awareness user info
  const userColor = getColorForUser(props.participantName);
  awareness.setLocalStateField("user", {
    name: props.participantName,
    color: userColor,
  });

  console.log("[CollaborativeDocument] Set awareness user:", {
    name: props.participantName,
    color: userColor,
  });

  // Create WebSocket provider with awareness
  provider.value = new YjsWebSocketProvider({
    url: wsUrl,
    roomId: props.room.id,
    userId: props.participantName,
    doc: ydoc,
    awareness: awareness,
  });

  console.log(
    "[CollaborativeDocument] Provider created, awareness:",
    provider.value.awareness,
  );

  // Listen to connection status
  provider.value.onStatus((status) => {
    connectionStatus.value = status;
    console.log("[CollaborativeDocument] Connection status:", status);
  });

  // Initialize TipTap editor with Y.js collaboration
  // Only create editor if it doesn't exist
  if (!editor.value) {
    try {
      editor.value = new Editor({
        onCreate: ({ editor: currentEditor }) => {
          console.log("[CollaborativeDocument] Editor onCreate called");
          console.log(
            "[CollaborativeDocument] Provider awareness:",
            provider.value?.awareness,
          );

          // Set initial user info when editor is created
          const userColor = getColorForUser(props.participantName);
          currentEditor
            .chain()
            .focus()
            .updateUser({
              name: props.participantName,
              color: userColor,
            })
            .run();

          console.log("[CollaborativeDocument] updateUser called with:", {
            name: props.participantName,
            color: userColor,
          });

          // Check collaboration caret storage once on creation (for debugging)
          nextTick(() => {
            const users = currentEditor.storage.collaborationCaret?.users || [];
            if (users.length > 0) {
              console.log(
                "[CollaborativeDocument] CollaborationCaret users on init:",
                users.length,
              );
            }
          });

          // Handle synced event
          if (
            provider.value &&
            typeof (provider.value as any).on === "function"
          ) {
            (provider.value as any).on("synced", () => {
              console.log("[CollaborativeDocument] Document synced");
              // Don't set default content - empty document is valid state
            });
          }

          // Monitor awareness changes (only log when users change, not on every cursor movement)
          if (provider.value?.awareness) {
            let lastUserCount = 0;
            provider.value.awareness.on(
              "change",
              (changes: {
                added: number[];
                updated: number[];
                removed: number[];
              }) => {
                const statesMap = provider.value!.awareness.getStates() as Map<
                  number,
                  any
                >;
                const currentUserCount = statesMap.size;
                // Only log when the number of users changes (user joined/left)
                if (currentUserCount !== lastUserCount) {
                  console.log(
                    "[CollaborativeDocument] Awareness users changed:",
                    lastUserCount,
                    "->",
                    currentUserCount,
                    "changes:",
                    changes,
                  );
                  lastUserCount = currentUserCount;
                }
              },
            );
          }
        },
        extensions: [
          StarterKit.configure({
            // Disable undoRedo as Collaboration extension provides its own history
            undoRedo: false,
            // Disable Link in StarterKit since we configure it separately
            link: false,
          }),
          Link.configure({
            openOnClick: false,
            HTMLAttributes: {
              class: "collaborative-document__link",
            },
          }),
          Collaboration.extend().configure({
            document: ydoc,
          }),
          CollaborationCaret.extend().configure({
            provider: provider.value as any,
            user: {
              name: props.participantName,
              color: userColor,
            },
          }),
          Markdown.configure({
            // Enable GitHub Flavored Markdown for better support
            markedOptions: {
              gfm: true,
            },
          }),
        ],
        editorProps: {
          attributes: {
            class: "collaborative-document__editor-content",
            spellcheck: "false",
          },
        },
      });

      console.log("[CollaborativeDocument] Editor initialized successfully");
    } catch (error) {
      console.error(
        "[CollaborativeDocument] Error initializing editor:",
        error,
      );
    }
  }
};

const handleCopy = async () => {
  if (!editor.value) return;

  try {
    // Get text content from editor
    const text = editor.value.getText();
    await navigator.clipboard.writeText(text);
    // Можно добавить уведомление об успешном копировании
    console.log("Text copied to clipboard");
  } catch (error) {
    console.error("Failed to copy text:", error);
  }
};

const handleDownload = () => {
  if (!editor.value) return;

  try {
    // Use built-in TipTap getMarkdown() method
    const markdown = editor.value.getMarkdown();

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `document-${props.room?.short_code || "untitled"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to download document:", error);
  }
};

const handleLink = () => {
  if (!editor.value) return;

  const previousUrl = editor.value.getAttributes("link").href;
  const url = window.prompt("Введите URL:", previousUrl || "");

  // cancelled
  if (url === null) {
    return;
  }

  // empty
  if (url === "") {
    editor.value.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  // update link
  editor.value
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({ href: url })
    .run();
};

// Track if component is mounted
const isMounted = ref(false);

watch(
  () => [props.room?.id, props.apiBaseURL],
  () => {
    // Only reinitialize if component is mounted
    if (!isMounted.value) return;

    // Clean up existing editor and provider
    if (editor.value) {
      editor.value.destroy();
      editor.value = undefined;
    }
    if (provider.value) {
      provider.value.destroy();
      provider.value = null;
    }

    // Initialize new editor only if room and apiBaseURL are available
    if (props.room && props.apiBaseURL) {
      // Use nextTick to ensure DOM is ready
      setTimeout(() => {
        initializeEditor();
      }, 0);
    }
  },
  { immediate: false },
);

onMounted(async () => {
  isMounted.value = true;
  // Initialize editor after component is mounted
  if (props.room && props.apiBaseURL) {
    // Wait for next tick to ensure DOM is fully ready
    await nextTick();
    initializeEditor();
  }

  // Send final awareness update before page unloads
  // This ensures other clients are notified immediately when user closes the page
  const handleBeforeUnload = () => {
    if (awareness && provider.value?.connected) {
      try {
        // Set local state to null to mark client as offline
        awareness.setLocalState(null);

        // Send final awareness update synchronously via WebSocket
        // This must be synchronous because page is closing
        if (
          provider.value &&
          (provider.value as any).ws &&
          (provider.value as any).ws.readyState === WebSocket.OPEN
        ) {
          const update = encodeAwarenessUpdate(awareness, [awareness.clientID]);
          if (update.length > 0) {
            const base64 = btoa(
              String.fromCharCode.apply(null, Array.from(update)),
            );
            const message = JSON.stringify({
              type: "yjs_awareness",
              room_id: (provider.value as any).roomId,
              payload: { update: base64 },
            });
            // Send synchronously - this is the last chance before page closes
            (provider.value as any).ws.send(message);
          }
        }
      } catch (error) {
        console.error(
          "[CollaborativeDocument] Error sending final awareness update:",
          error,
        );
      }
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("pagehide", handleBeforeUnload);

  // Cleanup listeners on unmount
  onBeforeUnmount(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
    window.removeEventListener("pagehide", handleBeforeUnload);
  });
});

// Generate a consistent color for a user based on their name
function getColorForUser(name: string): string {
  const colors = [
    "#958DF1",
    "#F98181",
    "#FBBC88",
    "#FAF594",
    "#70CFF8",
    "#94FADB",
    "#B9F18D",
    "#FFBE53",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

onBeforeUnmount(() => {
  // Disconnect provider first - this will send final awareness update
  // setLocalState(null) marks the client as offline and notifies others
  if (provider.value) {
    provider.value.destroy(); // This calls disconnect() which handles awareness cleanup
  }

  editor.value?.destroy();
  if (awareness && typeof awareness.destroy === "function") {
    awareness.destroy();
  }
  ydoc.destroy();
});
</script>

<style scoped>
.collaborative-document {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1f1f1f;
  border: 2px solid #444;
  overflow: hidden;
}

.collaborative-document__header {
  padding: 12px 16px;
  border-bottom: 2px solid #444;
  background: #2a2a2a;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.collaborative-document__toolbar {
  padding: 8px 16px;
  border-bottom: 1px solid #444;
  background: #2a2a2a;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.collaborative-document__toolbar-button {
  background: transparent;
  border: 1px solid #444;
  color: #bab1a8;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  border-radius: 2px;
  min-width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.collaborative-document__toolbar-button:hover {
  border-color: #2980b9;
  background: #2980b920;
  color: #fff;
}

.collaborative-document__toolbar-button--active {
  background: #2980b9;
  border-color: #2980b9;
  color: #fff;
}

.collaborative-document__toolbar-separator {
  width: 1px;
  height: 20px;
  background: #444;
  margin: 0 4px;
}

.collaborative-document__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #bab1a8;
  font-family: "Bebas Neue", sans-serif;
  letter-spacing: 0.02em;
}

.collaborative-document__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.collaborative-document__button {
  background: transparent;
  border: 2px solid #444;
  color: #bab1a8;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  border-radius: 0;
}

.collaborative-document__button:hover {
  border-color: #2980b9;
  background: #2980b920;
}

.collaborative-document__button:active {
  transform: scale(0.95);
}

.collaborative-document__status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  color: #999;
}

.collaborative-document__status--connecting {
  color: #ffbe53;
}

.collaborative-document__status--disconnected {
  color: #e2534b;
}

.collaborative-document__loading {
  padding: 20px;
  text-align: center;
  color: #999;
}

.collaborative-document__editor-wrapper {
  flex: 1;
  overflow: auto;
  background: #1f1f1f;
  position: relative;
}

.collaborative-document__editor {
  height: 100%;
  width: 100%;
}

/* ProseMirror editor styles */
:deep(.ProseMirror) {
  padding: 16px;
  min-height: 100%;
  outline: none;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #bab1a8;
  background: #1f1f1f;
}

:deep(.ProseMirror:focus) {
  outline: none;
}

:deep(.collaborative-document__editor-content) {
  padding: 16px;
  min-height: 100%;
  outline: none;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #bab1a8;
  background: #1f1f1f;
}

:deep(.collaborative-document__editor-content p) {
  margin: 0 0 12px 0;
}

:deep(.collaborative-document__editor-content p:last-child) {
  margin-bottom: 0;
}

:deep(.collaborative-document__editor-content h1) {
  font-size: 24px;
  font-weight: 600;
  margin: 24px 0 16px 0;
  color: #fff;
}

:deep(.collaborative-document__editor-content h2) {
  font-size: 20px;
  font-weight: 600;
  margin: 20px 0 12px 0;
  color: #fff;
}

:deep(.collaborative-document__editor-content h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 16px 0 10px 0;
  color: #fff;
}

:deep(.collaborative-document__editor-content ul),
:deep(.collaborative-document__editor-content ol) {
  margin: 12px 0;
  padding-left: 24px;
}

:deep(.collaborative-document__editor-content li) {
  margin: 6px 0;
}

:deep(.collaborative-document__editor-content code) {
  background: #2a2a2a;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "Courier New", monospace;
  font-size: 13px;
  color: #2980b9;
}

:deep(.collaborative-document__editor-content pre) {
  background: #2a2a2a;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 12px 0;
}

:deep(.collaborative-document__editor-content pre code) {
  background: transparent;
  padding: 0;
  color: #bab1a8;
}

:deep(.collaborative-document__editor-content blockquote) {
  border-left: 4px solid #2980b9;
  padding-left: 16px;
  margin: 12px 0;
  color: #999;
  font-style: italic;
}

/* Collaboration cursor styles - CollaborationCaret extension */
/* Correct class names: collaboration-carets__caret, collaboration-carets__label, collaboration-carets__selection */
:deep(.collaboration-carets__caret) {
  border-left: 2px solid;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  position: relative;
  word-break: normal;
  height: 1.2em;
}

:deep(.collaboration-carets__label) {
  border-radius: 3px 3px 3px 0;
  color: #fff;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  left: -1px;
  line-height: normal;
  padding: 2px 6px;
  position: absolute;
  top: -1.4em;
  user-select: none;
  white-space: nowrap;
  z-index: 1000;
  opacity: 0.5;
  backdrop-filter: blur(4px);
}

:deep(.collaboration-carets__selection) {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  pointer-events: none;
}

/* Legacy class names for compatibility */
:deep(.collaboration-cursor__caret),
:deep(.collaboration-caret__caret) {
  border-left: 2px solid;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  position: relative;
  word-break: normal;
  height: 1.2em;
}

:deep(.collaboration-cursor__label),
:deep(.collaboration-caret__label) {
  border-radius: 3px 3px 3px 0;
  color: #fff;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  left: -1px;
  line-height: normal;
  padding: 2px 6px;
  position: absolute;
  top: -1.4em;
  user-select: none;
  white-space: nowrap;
  z-index: 1000;
  opacity: 0.8;
  backdrop-filter: blur(4px);
}

:deep(.collaboration-cursor__selection),
:deep(.collaboration-caret__selection) {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  pointer-events: none;
}

/* Link styles */
:deep(.collaborative-document__link) {
  color: #2980b9;
  text-decoration: underline;
  cursor: pointer;
  transition: color 0.2s;
}

:deep(.collaborative-document__link:hover) {
  color: #3498db;
}

:deep(.collaborative-document__editor-content a) {
  color: #2980b9;
  text-decoration: underline;
  cursor: pointer;
  transition: color 0.2s;
}

:deep(.collaborative-document__editor-content a:hover) {
  color: #3498db;
}

/* Bold, Italic, Strike styles */
:deep(.collaborative-document__editor-content strong) {
  font-weight: 600;
  color: #fff;
}

:deep(.collaborative-document__editor-content em) {
  font-style: italic;
}

:deep(.collaborative-document__editor-content s) {
  text-decoration: line-through;
  opacity: 0.8;
}
</style>
