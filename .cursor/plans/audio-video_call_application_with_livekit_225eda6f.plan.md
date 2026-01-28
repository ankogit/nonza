---
name: Audio-Video Call Application with LiveKit
overview: Создание приложения для аудио-видео звонков с виджетом для встраивания на сайты. Backend на Go с LiveKit, frontend на Vue.js, PostgreSQL для хранения данных. Поддержка спейсов, каналов, конференций с видео/аудио, трансляцией экрана и совместным текстовым редактором.
todos: []
isProject: false
---

# Архитектура приложения для аудио-видео звонков

## Технологический стек

### Backend

- **Go** - основной язык бэкенда
- **LiveKit Server SDK** (`github.com/livekit/server-sdk-go`) - для управления комнатами и участниками
- **LiveKit Server** - отдельный сервис (self-hosted или cloud) для WebRTC медиа-транспорта
- **PostgreSQL** - база данных для спейсов, каналов, пользователей, комнат
- **Gin/Echo** - HTTP фреймворк для REST API
- **WebSocket** - для real-time обновлений (спейсы, каналы, уведомления)

### Frontend

- **Vue.js 3** - основной фреймворк
- **LiveKit Client SDK** (`livekit-client`) - для WebRTC соединений
- **TypeScript** - для типобезопасности
- **Vite** - сборщик и dev server
- **Pinia** - state management

### Виджет

- **Vue.js библиотека** - отдельный пакет для встраивания на сторонние сайты
- **UMD build** - для подключения через script tag
- **npm package** - для установки через npm

## Структура проекта

```
nonza/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go              # Точка входа
│   ├── internal/
│   │   ├── api/                     # HTTP handlers
│   │   │   ├── spaces.go            # CRUD спейсов
│   │   │   ├── channels.go          # CRUD каналов
│   │   │   ├── rooms.go             # Управление конференциями
│   │   │   ├── auth.go              # Аутентификация
│   │   │   └── tokens.go            # Генерация LiveKit токенов
│   │   ├── service/                 # Бизнес-логика
│   │   │   ├── space_service.go
│   │   │   ├── channel_service.go
│   │   │   ├── room_service.go
│   │   │   └── livekit_service.go   # Интеграция с LiveKit
│   │   ├── repository/              # Доступ к БД
│   │   │   ├── space_repo.go
│   │   │   ├── channel_repo.go
│   │   │   ├── room_repo.go
│   │   │   └── user_repo.go
│   │   ├── models/                  # Модели данных
│   │   │   ├── space.go
│   │   │   ├── channel.go
│   │   │   ├── room.go
│   │   │   └── user.go
│   │   └── websocket/               # WebSocket handlers
│   │       └── hub.go
│   ├── pkg/
│   │   ├── database/                # DB connection
│   │   └── livekit/                 # LiveKit клиент wrapper
│   ├── migrations/                  # SQL миграции
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SpaceList.vue
│   │   │   ├── ChannelList.vue
│   │   │   ├── ConferenceRoom.vue   # Основной компонент конференции
│   │   │   ├── VideoGrid.vue        # Сетка видео участников
│   │   │   ├── AudioControls.vue    # Управление звуком участников
│   │   │   ├── ScreenShare.vue      # Трансляция экрана
│   │   │   ├── CollaborativeEditor.vue # Совместный редактор
│   │   │   └── SettingsPanel.vue    # Настройки микрофона/громкости
│   │   ├── composables/
│   │   │   ├── useLiveKit.ts        # LiveKit connection logic
│   │   │   ├── useRoom.ts           # Управление комнатой
│   │   │   ├── useCollaborativeEditor.ts # Логика совместного редактора
│   │   │   └── useAudioControls.ts  # Управление звуком
│   │   ├── stores/
│   │   │   ├── spaces.ts
│   │   │   ├── channels.ts
│   │   │   ├── room.ts
│   │   │   └── user.ts
│   │   ├── services/
│   │   │   ├── api.ts               # HTTP клиент
│   │   │   └── websocket.ts         # WebSocket клиент
│   │   ├── types/
│   │   │   ├── space.ts
│   │   │   ├── channel.ts
│   │   │   └── room.ts
│   │   ├── App.vue
│   │   └── main.ts
│   ├── package.json
│   └── vite.config.ts
├── widget/
│   ├── src/
│   │   ├── components/
│   │   │   ├── WidgetContainer.vue  # Обертка виджета
│   │   │   └── ConferenceWidget.vue # Компонент конференции
│   │   ├── composables/
│   │   │   └── useWidget.ts         # Логика виджета
│   │   ├── index.ts                 # Точка входа библиотеки
│   │   └── types.ts
│   ├── package.json
│   └── vite.config.ts               # Конфиг для UMD build
├── docker-compose.yml               # LiveKit server, PostgreSQL
└── README.md
```

## Схема базы данных

### Таблицы

**spaces** - Спейсы (аналог серверов в Discord)

- id (UUID, PK)
- name (string)
- description (text, nullable)
- owner_id (UUID, FK -> users)
- created_at, updated_at

**channels** - Каналы внутри спейсов

- id (UUID, PK)
- space_id (UUID, FK -> spaces)
- name (string)
- type (enum: 'text', 'voice', 'video')
- created_at, updated_at

**rooms** - Конференции (LiveKit комнаты)

- id (UUID
