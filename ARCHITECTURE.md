# Архитектура Nonza: Техническая Документация

Подробное описание архитектуры платформы для совместного редактирования документов и видеозвонков.

---

## Содержание

1. [Обзор архитектуры](#обзор-архитектуры)
2. [Backend (Go)](#backend-go)
3. [Frontend (Vue.js)](#frontend-vuejs)
4. [Совместное редактирование документов (Y.js + TipTap)](#совместное-редактирование-документов-yjs--tiptap)
5. [WebSocket коммуникация](#websocket-коммуникация)
6. [Видео/Аудио (LiveKit)](#видеоаудио-livekit)
7. [Почему это работает](#почему-это-работает)

---

## Обзор архитектуры

Nonza — это платформа для совместной работы, состоящая из:

- **Backend**: Go-сервер с REST API и WebSocket для синхронизации документов
- **Frontend**: Vue.js виджет с TipTap редактором для совместного редактирования
- **WebRTC**: LiveKit для видео/аудио звонков
- **База данных**: PostgreSQL для хранения комнат, организаций, документов
- **Синхронизация**: Y.js для CRDT-синхронизации документов

### Архитектурные принципы

1. **Разделение ответственности**: Backend управляет состоянием, Frontend — UI
2. **Event-driven**: WebSocket для real-time событий
3. **CRDT**: Y.js обеспечивает бесконфликтное слияние изменений
4. **SFU архитектура**: LiveKit для эффективной маршрутизации медиа

---

## Backend (Go)

### Структура проекта

```
backend/
├── cmd/app/main.go          # Точка входа
├── internal/
│   ├── app/app.go           # Инициализация приложения
│   ├── config/              # Конфигурация из env
│   ├── models/              # GORM модели (Room, Organization, Document)
│   ├── repository/          # Слой доступа к данным
│   │   └── postgresDB/      # PostgreSQL реализации
│   ├── service/             # Бизнес-логика
│   └── transport/
│       ├── rest/            # REST API handlers (Gin)
│       └── websocket/       # WebSocket hub и клиенты
└── pkg/                     # Публичные пакеты
```

### Технологии

- **Go 1.24**: Язык программирования
- **Gin**: HTTP роутер и middleware
- **GORM**: ORM для работы с PostgreSQL
- **gorilla/websocket**: WebSocket сервер
- **LiveKit Protocol**: Генерация токенов для WebRTC

### Почему Go?

1. **Производительность**: Высокая пропускная способность для WebSocket соединений
2. **Конкурентность**: Goroutines идеально подходят для Hub-паттерна
3. **Простота**: Минималистичный синтаксис, легко поддерживать
4. **Типизация**: Статическая типизация предотвращает ошибки

### Архитектура слоёв

#### 1. Transport Layer (`internal/transport/`)

**REST API** (`rest/v1/`):
- `organizations.go`: CRUD операции для организаций
- `rooms.go`: Создание и получение комнат
- `tokens.go`: Генерация LiveKit токенов

**WebSocket** (`websocket/`):
- `hub.go`: Центральный хаб для управления клиентами
- `client.go`: Индивидуальное WebSocket соединение
- `handler.go`: HTTP handler для WebSocket upgrade

#### 2. Service Layer (`internal/service/`)

Бизнес-логика приложения:
- `organizations/`: Управление организациями
- `rooms/`: Логика комнат (генерация кодов, валидация)
- `meeting_documents/`: Управление документами встреч

#### 3. Repository Layer (`internal/repository/`)

Абстракция доступа к данным:
- Интерфейсы в `repository.go`
- Реализации в `postgresDB/`
- Использует GORM для работы с PostgreSQL

#### 4. Models (`internal/models/`)

GORM модели:
- `organization.go`: Организации
- `room.go`: Комнаты (short_code, organization_id)
- `meeting_document.go`: Документы встреч
- `participant.go`: Участники встреч

### WebSocket Hub: Как это работает

#### Hub (`hub.go`)

**Назначение**: Центральный менеджер всех WebSocket соединений.

**Структура данных**:
```go
type Hub struct {
    clients           map[*Client]bool        // Все подключённые клиенты
    rooms             map[string]map[*Client]bool  // Комнаты -> клиенты
    roomDocumentState map[string][]byte        // Состояние Y.js документов
    register          chan *Client             // Канал регистрации
    unregister        chan *Client             // Канал отключения
    broadcast         chan []byte              // Канал широковещания
    mu                sync.RWMutex             // Мьютекс для потокобезопасности
}
```

**Паттерн**: Hub работает в отдельной goroutine и обрабатывает события через каналы:

```go
func (h *Hub) Run() {
    for {
        select {
        case client := <-h.register:
            // Регистрация нового клиента
            // Добавление в комнату
            // Отправка текущего состояния документа новому клиенту
            
        case client := <-h.unregister:
            // Удаление клиента из комнаты
            // Уведомление других участников об отключении
            
        case message := <-h.broadcast:
            // Широковещание сообщения всем клиентам
        }
    }
}
```

**Почему это работает**:
- **Каналы**: Thread-safe коммуникация между goroutines
- **RWMutex**: Множественные читатели, один писатель
- **Копирование данных**: Каждый клиент получает копию Y.js update (избегаем race conditions)

#### Client (`client.go`)

**Назначение**: Управление одним WebSocket соединением.

**Два канала для отправки**:
- `send chan []byte`: JSON сообщения (текстовые)
- `sendBinary chan []byte`: Бинарные Y.js updates

**Две goroutines**:
1. **`readPump()`**: Читает сообщения от клиента
   - Обрабатывает JSON сообщения (`yjs_update`, `yjs_sync`, `yjs_awareness`)
   - Обрабатывает бинарные сообщения (Y.js updates)
   - Отправляет в Hub для широковещания

2. **`writePump()`**: Отправляет сообщения клиенту
   - Читает из `send` и `sendBinary` каналов
   - Отправляет через WebSocket
   - Отправляет ping каждые 54 секунды (keep-alive)

**Обработка Y.js сообщений**:

```go
case "yjs_update":
    // Инкрементальный update документа
    // Бродкастим в комнату (не сохраняем)
    
case "yjs_full_state":
    // Полное состояние документа (Y.encodeStateAsUpdate)
    // Сохраняем в Hub.roomDocumentState[roomID]
    // Бродкастим в комнату
    
case "yjs_awareness":
    // Обновления курсоров/выделений
    // Бродкастим в комнату (не сохраняем)
    // Отправляем как бинарные данные
```

**Почему два канала**:
- Разделение JSON и бинарных данных упрощает обработку
- Бинарные данные не нужно base64-кодировать
- WebSocket поддерживает `BinaryMessage` и `TextMessage`

### Хранение состояния документов

**Проблема**: Новый участник должен получить текущее состояние документа.

**Решение**: Hub хранит полное состояние документа для каждой комнаты:

```go
roomDocumentState map[string][]byte  // roomID -> Y.js document state
```

**Когда сохраняем**:
- Только при `yjs_full_state` (полное состояние)
- Не сохраняем инкрементальные `yjs_update`

**Когда отправляем**:
- При регистрации нового клиента в комнате
- Если состояние существует, отправляем его новому клиенту

**Почему это работает**:
- Y.js `encodeStateAsUpdate` создаёт компактное бинарное представление
- Применение через `Y.applyUpdate` восстанавливает полное состояние
- Новый клиент сразу видит актуальный документ

---

## Frontend (Vue.js)

### Структура проекта (Feature-Sliced Design)

```
frontend/src/
├── app/                    # Инициализация приложения
│   ├── main.ts            # Entry point
│   ├── App.vue            # Корневой компонент
│   └── NonzaWidget.vue    # Главный виджет
├── widgets/               # Крупные составные блоки
│   ├── collaborative-document/  # Редактор документов
│   ├── room-conference-hall/    # Комната типа Conference Hall
│   └── room-round-table/        # Комната типа Round Table
├── features/              # Функциональные возможности
│   ├── room-connection/   # Подключение к комнате
│   ├── conference-hall/   # Логика Conference Hall
│   ├── e2ee/              # End-to-End Encryption
│   └── media-control/     # Управление медиа
├── entities/              # Бизнес-сущности
│   ├── room/              # Room API и модели
│   ├── organization/      # Organization API
│   └── meeting-document/  # Document API
└── shared/                # Переиспользуемые модули
    ├── lib/
    │   ├── yjs-websocket-provider.ts  # Кастомный Y.js провайдер
    │   └── livekit-helpers.ts         # Утилиты для LiveKit
    └── ui/                # UI компоненты
```

### Технологии

- **Vue 3**: Composition API, реактивность
- **TypeScript**: Типизация
- **TipTap**: Rich text редактор на базе ProseMirror
- **Y.js**: CRDT библиотека для синхронизации
- **LiveKit Client SDK**: WebRTC клиент
- **Vite**: Сборщик и dev-сервер

### Почему Vue 3?

1. **Composition API**: Лучшая организация логики, переиспользование
2. **Реактивность**: Автоматическое обновление UI при изменении данных
3. **TypeScript**: Отличная поддержка типов
4. **Производительность**: Оптимизированный рендеринг

### Почему Feature-Sliced Design?

1. **Масштабируемость**: Легко добавлять новые фичи
2. **Изоляция**: Фичи не зависят друг от друга
3. **Переиспользование**: Shared слой для общих компонентов
4. **Понятность**: Чёткая структура проекта

---

## Совместное редактирование документов (Y.js + TipTap)

### Что такое Y.js?

**Y.js** — это CRDT (Conflict-free Replicated Data Type) библиотека для JavaScript.

**CRDT** — структура данных, которая гарантирует:
- Бесконфликтное слияние изменений от разных клиентов
- Идемпотентность операций (можно применять несколько раз)
- Коммутативность (порядок применения не важен)

**Как это работает**:
1. Каждое изменение кодируется в бинарный update
2. Update можно применять к любому состоянию документа
3. Результат всегда одинаковый (консистентность)

### Архитектура Y.js в Nonza

```
┌─────────────────┐
│   TipTap Editor │  ← UI слой (пользователь видит и редактирует)
└────────┬────────┘
         │
┌────────▼────────┐
│ Collaboration   │  ← TipTap extension для Y.js интеграции
│ Extension       │
└────────┬────────┘
         │
┌────────▼────────┐
│   Y.Doc         │  ← CRDT документ (хранит структурированные данные)
└────────┬────────┘
         │
┌────────▼────────┐
│ YjsWebSocket    │  ← Кастомный провайдер для синхронизации
│ Provider        │
└────────┬────────┘
         │
┌────────▼────────┐
│  WebSocket      │  ← Связь с Go backend
│  (Go Hub)       │
└─────────────────┘
```

### Y.Doc и XmlFragment

**Y.Doc**: Корневой CRDT документ, содержит все данные.

**XmlFragment**: Тип данных Y.js для структурированного контента (как XML/HTML).

```typescript
const ydoc = new Y.Doc();
const xmlFragment = ydoc.getXmlFragment("content");
```

TipTap `Collaboration` extension автоматически создаёт `XmlFragment` с именем `"content"` и синхронизирует его.

### Awareness: Курсоры и выделения

**Awareness** — это отдельный протокол Y.js для метаданных (не часть документа).

**Что хранится**:
- Позиция курсора каждого пользователя
- Выделенный текст
- Информация о пользователе (имя, цвет)

**Как это работает**:

```typescript
import * as awarenessProtocol from "y-protocols/awareness";

const awareness = new awarenessProtocol.Awareness(ydoc);

// Установить информацию о пользователе
awareness.setLocalStateField("user", {
  name: "Иван",
  color: "#FF5733"
});

// Слушать изменения курсора (TipTap делает это автоматически)
awareness.on("change", (changes) => {
  // changes.added, changes.updated, changes.removed
  // Отправляем update другим клиентам
});
```

**Почему отдельный протокол**:
- Awareness данные временные (курсоры)
- Не нужно хранить в документе
- Автоматическое удаление через 30 секунд без обновлений

### YjsWebSocketProvider: Кастомный провайдер

**Проблема**: Стандартный `y-websocket` не работает с нашим Go backend.

**Решение**: Создали кастомный провайдер (`shared/lib/yjs-websocket-provider.ts`).

#### Основные компоненты:

1. **Подключение к WebSocket**:
```typescript
this.ws = new WebSocket(`${url}/ws?room_id=${roomId}&user_id=${userId}`);
```

2. **Отправка Y.js updates**:
```typescript
this.doc.on("update", (update: Uint8Array, origin: any) => {
  if (origin !== this) {  // Не отправляем свои же updates
    this.sendUpdate(update);
  }
});
```

3. **Применение удалённых updates**:
```typescript
ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    // Бинарный Y.js update
    Y.applyUpdate(this.doc, new Uint8Array(event.data));
  }
};
```

4. **Awareness синхронизация**:
```typescript
this.awareness.on("change", (changes, origin) => {
  if (origin !== this) {
    const update = encodeAwarenessUpdate(this.awareness, changedClients);
    this.sendAwarenessUpdate(update);
  }
});
```

#### Обработка отключений

**Проблема**: При закрытии страницы нужно уведомить других участников.

**Решение**: Используем `beforeunload` и `pagehide` события:

```typescript
window.addEventListener("beforeunload", () => {
  // Устанавливаем awareness state в null
  awareness.setLocalState(null);
  
  // Отправляем финальный update синхронно
  const update = encodeAwarenessUpdate(awareness, [awareness.clientID]);
  ws.send(JSON.stringify({
    type: "yjs_awareness",
    payload: { update: btoa(String.fromCharCode(...update)) }
  }));
});
```

**Почему это работает**:
- `beforeunload` срабатывает до закрытия страницы
- Синхронная отправка гарантирует доставку
- Другие клиенты получают update и удаляют awareness state

### TipTap Editor: Интеграция

#### Инициализация редактора

```typescript
import { Editor } from "@tiptap/vue-3";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";

const editor = new Editor({
  extensions: [
    StarterKit.configure({ link: false }),  // Отключаем link из StarterKit
    Link,                                   // Добавляем отдельно для контроля
    Collaboration.configure({
      document: ydoc,                       // Y.js документ
    }),
    CollaborationCaret.configure({
      provider: provider,                   // YjsWebSocketProvider
      user: {
        name: participantName,
        color: userColor,
      },
    }),
  ],
});
```

#### Форматирование текста

TipTap использует команды (commands) для форматирования:

```typescript
// Жирный текст
editor.chain().focus().toggleBold().run();

// Заголовок
editor.chain().focus().toggleHeading({ level: 1 }).run();

// Ссылка
editor.chain().focus().setLink({ href: url }).run();
```

**Почему это работает**:
- Команды преобразуются в ProseMirror транзакции
- Транзакции синхронизируются через Y.js
- Все клиенты получают одинаковые изменения

---

## WebSocket коммуникация

### Протокол сообщений

#### От клиента к серверу

**JSON сообщения**:
```json
{
  "type": "yjs_sync",
  "room_id": "room-123"
}
```

**Типы сообщений**:
- `yjs_sync`: Запрос полного состояния документа
- `yjs_update`: Инкрементальный update (обёрнут в JSON)
- `yjs_full_state`: Полное состояние документа (для сохранения)
- `yjs_awareness`: Awareness update (курсоры, выделения)

**Бинарные сообщения**:
- Прямые Y.js updates (без обёртки JSON)

#### От сервера к клиенту

**JSON сообщения**:
```json
{
  "type": "user_joined",
  "room_id": "room-123",
  "user_id": "user-456",
  "payload": { ... }
}
```

**Бинарные сообщения**:
- Y.js document updates
- Awareness updates (маленькие, < 1KB)

### Различение типов сообщений

**На клиенте**:
```typescript
ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    // Бинарное сообщение - Y.js update
    Y.applyUpdate(doc, new Uint8Array(event.data));
  } else {
    // JSON сообщение
    const message = JSON.parse(event.data);
    // Обработка...
  }
};
```

**На сервере**:
```go
messageType, messageBytes, err := conn.ReadMessage()

if messageType == websocket.BinaryMessage {
    // Бинарное сообщение - Y.js update
    hub.BroadcastBinaryToRoom(roomID, messageBytes, client)
} else {
    // JSON сообщение
    var message Message
    json.Unmarshal(messageBytes, &message)
    // Обработка...
}
```

### Синхронизация при подключении

**Проблема**: Новый клиент должен получить текущее состояние документа.

**Решение**:

1. **Клиент подключается** → отправляет `yjs_sync`
2. **Сервер проверяет** → есть ли сохранённое состояние в `Hub.roomDocumentState[roomID]`
3. **Если есть** → отправляет бинарное сообщение с состоянием
4. **Клиент применяет** → `Y.applyUpdate(doc, state)`
5. **Клиент синхронизирован** → видит актуальный документ

**Код на сервере**:
```go
case client := <-h.register:
    // Отправляем существующее состояние новому клиенту
    if docState, ok := h.roomDocumentState[client.roomID]; ok {
        go func() {
            client.sendBinary <- docState
        }()
    }
```

**Код на клиенте**:
```typescript
provider.on("synced", () => {
  console.log("Document synced!");
});
```

### Обработка Awareness updates

**Отправка**:
```typescript
const update = encodeAwarenessUpdate(awareness, [clientID]);
// Отправляем как JSON с base64
ws.send(JSON.stringify({
  type: "yjs_awareness",
  payload: { update: btoa(String.fromCharCode(...update)) }
}));
```

**Получение**:
```go
// На сервере декодируем base64
updateBytes, _ := base64.StdEncoding.DecodeString(updateBase64)
// Отправляем как бинарное сообщение
hub.BroadcastBinaryToRoom(roomID, updateBytes, excludeClient)
```

**Применение**:
```typescript
// На клиенте применяем через applyAwarenessUpdate
applyAwarenessUpdate(awareness, new Uint8Array(event.data));
```

**Почему base64 в JSON**:
- Малые размеры (< 1KB обычно)
- Проще отлаживать (видно в DevTools)
- Совместимость с JSON протоколом

---

## Видео/Аудио (LiveKit)

### Что такое LiveKit?

**LiveKit** — это open-source SFU (Selective Forwarding Unit) для WebRTC.

**SFU архитектура**:
- Каждый клиент отправляет медиа на сервер
- Сервер пересылает медиа другим клиентам
- Не требует декодирования/кодирования на сервере (эффективно)

### Интеграция в Nonza

#### Backend: Генерация токенов

```go
import "github.com/livekit/protocol/auth"

func GenerateToken(roomID, userID string) (string, error) {
    at := auth.NewAccessToken(apiKey, apiSecret)
    
    grant := &auth.VideoGrant{
        RoomJoin: true,
        Room:     roomID,
    }
    
    at.AddGrant(grant).
        SetIdentity(userID).
        SetName(userName)
    
    return at.ToJWT()
}
```

**Почему токены**:
- Безопасность: клиент не знает API secret
- Контроль доступа: можно ограничить права
- Временные: токены имеют срок действия

#### Frontend: Подключение к комнате

```typescript
import { Room, RoomEvent } from "livekit-client";

const room = new Room();
await room.connect(livekitURL, token);

// Публикуем треки
const tracks = await createLocalTracks();
await room.localParticipant.publishTracks(tracks);

// Слушаем удалённых участников
room.on(RoomEvent.ParticipantConnected, (participant) => {
  participant.on("trackSubscribed", (track) => {
    // Отображаем трек
  });
});
```

### Типы комнат

#### Conference Hall
- Один спикер (ведущий)
- Остальные участники только слушают
- Управление через `setParticipantPermission`

#### Round Table
- Все участники равноправны
- Каждый может говорить
- Демократичный формат

---

## Почему это работает

### 1. CRDT обеспечивает консистентность

**Проблема**: Как синхронизировать изменения от разных клиентов без конфликтов?

**Решение**: Y.js использует CRDT алгоритмы:
- Каждое изменение имеет уникальный ID
- Изменения можно применять в любом порядке
- Результат всегда одинаковый

**Пример**:
```
Клиент A: Вставляет "Hello" в позицию 0
Клиент B: Вставляет "World" в позицию 0

Без CRDT: Может получиться "WorldHello" или "HelloWorld" (зависит от порядка)
С CRDT: Всегда "WorldHello" (детерминированный алгоритм)
```

### 2. Hub-паттерн масштабируется

**Проблема**: Как управлять тысячами WebSocket соединений?

**Решение**: Go goroutines + каналы:
- Каждый клиент = одна goroutine
- Hub = центральная goroutine для маршрутизации
- Каналы = thread-safe коммуникация

**Производительность**:
- Один Hub может обрабатывать 10,000+ соединений
- Минимальное использование памяти (goroutines легковесные)
- Можно запустить несколько Hub'ов за load balancer

### 3. Разделение document и awareness

**Проблема**: Курсоры не должны храниться в документе.

**Решение**: Два протокола:
- **Y.js document**: Постоянные данные (текст документа)
- **Awareness**: Временные данные (курсоры, выделения)

**Преимущества**:
- Документ остаётся чистым
- Awareness автоматически очищается
- Разные стратегии синхронизации

### 4. Бинарный формат для эффективности

**Проблема**: JSON для Y.js updates неэффективен.

**Решение**: Бинарный формат:
- Компактнее (меньше трафика)
- Быстрее парсится
- Нативный формат Y.js

**Сравнение**:
```
JSON: ~500 bytes для небольшого изменения
Binary: ~50 bytes для того же изменения (10x меньше)
```

### 5. Сохранение полного состояния

**Проблема**: Новый участник должен видеть актуальный документ.

**Решение**: Hub хранит полное состояние:
- При `yjs_full_state` сохраняем в память
- При подключении отправляем новому клиенту
- Y.js `encodeStateAsUpdate` создаёт компактное представление

**Альтернативы** (и почему не используем):
- **База данных**: Медленнее, сложнее
- **Только инкрементальные updates**: Новый клиент должен получить все updates с начала

### 6. TipTap + Y.js = Мощная комбинация

**Почему TipTap**:
- ProseMirror под капотом (зрелый, стабильный)
- Хорошая поддержка форматирования
- Активное сообщество

**Почему Y.js**:
- Лучшая CRDT библиотека для JavaScript
- Отличная интеграция с ProseMirror
- Поддержка awareness из коробки

**Вместе**:
- TipTap предоставляет UI и команды
- Y.js обеспечивает синхронизацию
- Collaboration extension связывает их

---

## Заключение

Архитектура Nonza построена на проверенных технологиях:

- **Go** для высокопроизводительного backend
- **Vue.js** для реактивного frontend
- **Y.js** для бесконфликтной синхронизации
- **TipTap** для богатого редактирования
- **LiveKit** для WebRTC

Каждый компонент решает конкретную задачу, и вместе они создают мощную платформу для совместной работы.

---

## Дополнительные ресурсы

- [Y.js Documentation](https://docs.yjs.dev/)
- [TipTap Documentation](https://tiptap.dev/)
- [LiveKit Documentation](https://docs.livekit.io/)
- [Go WebSocket Best Practices](https://github.com/gorilla/websocket)
- [CRDT Explained](https://crdt.tech/)
