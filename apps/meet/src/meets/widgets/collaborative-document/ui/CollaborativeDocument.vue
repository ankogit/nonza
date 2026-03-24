<template>
  <div class="collaborative-document">
    <div class="collaborative-document__header">
      <h3 class="collaborative-document__title">Совместный документ</h3>
      <div class="collaborative-document__actions">
        <Button
          type="icon"
          size="small"
          class="collaborative-document__button"
          title="Копировать"
          aria-label="Копировать"
          @click="handleCopy"
        >
          <PixelIcon name="document" variant="small" />
        </Button>
        <Button
          type="icon"
          size="small"
          class="collaborative-document__button"
          title="Скачать"
          aria-label="Скачать"
          @click="handleDownload"
        >
          <PixelIcon name="download" variant="small" />
        </Button>
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
      <Button
        type="icon"
        size="small"
        class="collaborative-document__toolbar-button"
        :variant="editor.isActive('bold') ? 'active' : 'default'"
        title="Жирный"
        aria-label="Жирный"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <strong>B</strong>
      </Button>
      <Button
        type="icon"
        size="small"
        class="collaborative-document__toolbar-button"
        :variant="editor.isActive('italic') ? 'active' : 'default'"
        title="Курсив"
        aria-label="Курсив"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <em>I</em>
      </Button>
      <Button
        type="icon"
        size="small"
        class="collaborative-document__toolbar-button"
        :variant="editor.isActive('strike') ? 'active' : 'default'"
        title="Зачеркнутый"
        aria-label="Зачеркнутый"
        @click="editor.chain().focus().toggleStrike().run()"
      >
        <s>S</s>
      </Button>
      <div class="collaborative-document__toolbar-separator"></div>
      <Button
        type="icon"
        size="small"
        class="collaborative-document__toolbar-button"
        :variant="editor.isActive('heading', { level: 1 }) ? 'active' : 'default'"
        title="Заголовок 1"
        aria-label="Заголовок 1"
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
      >
        H1
      </Button>
      <Button
        type="icon"
        size="small"
        class="collaborative-document__toolbar-button"
        :variant="editor.isActive('heading', { level: 2 }) ? 'active' : 'default'"
        title="Заголовок 2"
        aria-label="Заголовок 2"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        H2
      </Button>
      <Button
        type="icon"
        size="small"
        class="collaborative-document__toolbar-button"
        :variant="editor.isActive('heading', { level: 3 }) ? 'active' : 'default'"
        title="Заголовок 3"
        aria-label="Заголовок 3"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
      >
        H3
      </Button>
      <div class="collaborative-document__toolbar-separator"></div>
      <Button
        type="icon"
        size="small"
        class="collaborative-document__toolbar-button"
        :variant="editor.isActive('bulletList') ? 'active' : 'default'"
        title="Маркированный список"
        aria-label="Маркированный список"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        •
      </Button>
      <Button
        type="icon"
        size="small"
        class="collaborative-document__toolbar-button"
        :variant="editor.isActive('orderedList') ? 'active' : 'default'"
        title="Нумерованный список"
        aria-label="Нумерованный список"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        1.
      </Button>
      <Button
        type="icon"
        size="small"
        class="collaborative-document__toolbar-button"
        :variant="editor.isActive('blockquote') ? 'active' : 'default'"
        title="Цитата"
        aria-label="Цитата"
        @click="editor.chain().focus().toggleBlockquote().run()"
      >
        "
      </Button>
      <Button
        type="icon"
        size="small"
        class="collaborative-document__toolbar-button"
        :variant="editor.isActive('code') ? 'active' : 'default'"
        title="Код"
        aria-label="Код"
        @click="editor.chain().focus().toggleCode().run()"
      >
        &lt;/&gt;
      </Button>
      <div class="collaborative-document__toolbar-separator"></div>
      <Button
        type="icon"
        size="small"
        class="collaborative-document__toolbar-button"
        :variant="editor.isActive('link') ? 'active' : 'default'"
        title="Ссылка"
        aria-label="Ссылка"
        @click="handleLink"
      >
        <PixelIcon name="link" variant="small" />
      </Button>
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
import { ref, onMounted, onBeforeUnmount, watch, nextTick, inject, computed } from "vue";
import { PixelIcon, Button } from "@shared/ui";
import { Editor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Link from "@tiptap/extension-link";
import { Markdown } from "@tiptap/markdown";
import * as Y from "yjs";
import { DEFAULT_PARTICIPANT_COLOR, type YjsWebSocketProvider } from "@shared/lib";
import type { Room as RoomEntity } from "@shared/entities";
import { MEET_ROOM_COLLABORATION_KEY } from "@features/room-collaboration";

const props = defineProps<{
  room: RoomEntity | null;
  participantName: string;
  participantColor?: string | null;
}>();

const collab = inject(MEET_ROOM_COLLABORATION_KEY, null);

if (!collab && import.meta.env.DEV) {
  console.error(
    "[CollaborativeDocument] Missing MEET_ROOM_COLLABORATION_KEY — wrap with RoomRoundTable provide",
  );
}

const connectionStatus = computed(() => {
  if (!collab) return "disconnected" as const;
  return collab.connectionStatus.value;
});

const editor = ref<Editor>();
const mounted = ref(false);

function destroyEditor() {
  editor.value?.destroy();
  editor.value = undefined;
}

function createEditor(doc: Y.Doc, prov: YjsWebSocketProvider) {
  if (editor.value) return;
  const userColor =
    props.participantColor?.trim() || DEFAULT_PARTICIPANT_COLOR;
  try {
    editor.value = new Editor({
      onCreate: ({ editor: currentEditor }) => {
        currentEditor
          .chain()
          .focus()
          .updateUser({
            name: props.participantName,
            color: userColor,
          })
          .run();
      },
      extensions: [
        StarterKit.configure({
          undoRedo: false,
          link: false,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: "collaborative-document__link",
          },
        }),
        Collaboration.extend().configure({
          document: doc,
        }),
        CollaborationCaret.extend().configure({
          provider: prov as never,
          user: {
            name: props.participantName,
            color: userColor,
          },
        }),
        Markdown.configure({
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
  } catch (error) {
    console.error(
      "[CollaborativeDocument] Error initializing editor:",
      error,
    );
  }
}

const handleCopy = async () => {
  if (!editor.value) return;

  try {
    // Get text content from editor
    const text = editor.value.getText();
    await navigator.clipboard.writeText(text);
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

watch(
  () =>
    [
      mounted.value,
      collab?.ydoc.value ?? null,
      collab?.provider.value ?? null,
    ] as const,
  ([ready, doc, prov]) => {
    destroyEditor();
    if (!ready || !doc || !prov) return;
    void nextTick(() => {
      createEditor(doc, prov);
    });
  },
  { immediate: true },
);

watch(
  () => [props.participantName, props.participantColor] as const,
  () => {
    const userColor =
      props.participantColor?.trim() || DEFAULT_PARTICIPANT_COLOR;
    editor.value
      ?.chain()
      .updateUser({
        name: props.participantName,
        color: userColor,
      })
      .run();
  },
);

onMounted(() => {
  mounted.value = true;
});

onBeforeUnmount(() => {
  destroyEditor();
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

.collaborative-document__status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  color: #999;
}

.collaborative-document__status--connecting {
  color: #ffc866;
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
