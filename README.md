# Nonza - Audio-Video Call Platform

Платформа для аудио-видео звонков с уникальными фичами. Виджет для встраивания на сайты.

## Архитектура

- **Backend**: Go (Gin, GORM, PostgreSQL, Redis, LiveKit)
- **Frontend**: Vue.js 3 (Composition API, TypeScript, Feature-Sliced Design)
- **WebRTC**: LiveKit (SFU архитектура)
- **Database**: PostgreSQL
- **Cache**: Redis

## Быстрый старт

### Запуск через Docker Compose

1. **Запустить инфраструктуру (PostgreSQL, Redis, LiveKit):**

```bash
make dev-up
# или
docker-compose -f docker-compose.dev.yml up -d
```

2. **Настроить backend:**

```bash
cd backend
cp .env.example .env
# Отредактировать .env файл (для локальной разработки используйте localhost)
```

3. **Запустить backend локально:**

```bash
cd backend
go run cmd/app/main.go
```

4. **Настроить frontend:**

```bash
cd frontend
cp .env.example .env
# Настроить .env файл (VITE_API_BASE_URL, VITE_LIVEKIT_URL)
npm install
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

### Запуск всего стека в Docker

```bash
# Собрать и запустить все сервисы
make build
make up

# Просмотр логов
make logs

# Остановка
make down
```

## Структура проекта

```
nonza/
├── backend/          # Go backend
│   ├── cmd/app/     # Точка входа
│   ├── internal/    # Внутренние пакеты
│   └── pkg/         # Публичные пакеты
├── frontend/        # Vue.js виджет
│   └── src/
│       ├── app/     # Инициализация приложения
│       ├── widgets/ # Виджеты (FSD)
│       ├── features/ # Фичи (FSD)
│       ├── entities/ # Сущности (FSD)
│       └── shared/  # Общие компоненты (FSD)
├── deploy/          # Конфигурации для деплоя
└── docker-compose.yml
```

## API Endpoints

### Organizations

- `POST /api/v1/organizations` - Создать организацию
- `GET /api/v1/organizations/:id` - Получить организацию
- `PUT /api/v1/organizations/:id` - Обновить организацию
- `DELETE /api/v1/organizations/:id` - Удалить организацию

### Rooms

- `POST /api/v1/organizations/:orgId/rooms` - Создать комнату
- `GET /api/v1/organizations/:orgId/rooms` - Список комнат организации
- `GET /api/v1/rooms/:shortCode` - Получить комнату по коду
- `GET /api/v1/rooms/id/:id` - Получить комнату по ID

### Tokens

- `POST /api/v1/tokens` - Сгенерировать LiveKit токен

## Конфигурация

### Backend (.env)

```bash
HTTP_PORT=8000
DB_HOST=localhost  # или postgres для Docker
DB_PORT=5432
DB_USERNAME=nonza
DB_PASSWORD=nonza_password
DB_DATABASE=nonza
REDIS_HOST=localhost  # или redis для Docker
REDIS_PORT=6379
WEBRTC_URL=wss://localhost:7880
WEBRTC_API_KEY=devkey
WEBRTC_API_SECRET=devsecret
```

### Frontend (.env)

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_LIVEKIT_URL=wss://localhost:7880
```

## LiveKit

LiveKit запускается в Docker и доступен на:

- WebSocket: `ws://localhost:7880`
- HTTP API: `http://localhost:7880`
- TURN: `localhost:7882` (UDP)

Для production настройте внешний IP и домен в `deploy/livekit-config.yaml`.

## Разработка

### Backend

```bash
cd backend
go mod download
go run cmd/app/main.go
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Тесты

```bash
cd backend
go test ./...
```

## Полезные команды

```bash
# Docker Compose
make up          # Запустить все сервисы
make down        # Остановить все сервисы
make logs        # Просмотр логов
make build       # Пересобрать образы
make clean       # Очистить volumes и контейнеры

# Только инфраструктура (для локальной разработки)
make dev-up      # Запустить postgres, redis, livekit
make dev-down    # Остановить инфраструктуру
```

## Минимальные требования к железу

Для развёртывания всего стека (PostgreSQL, Redis, LiveKit, backend) на одном сервере:

| Нагрузка              | CPU   | RAM   | Примечание |
|-----------------------|-------|-------|------------|
| Разработка / тесты    | 1–2   | 2 GB  | `make dev-up` + локальный backend/frontend |
| Небольшая продукция   | 2–4   | 4 GB  | До ~10–20 одновременных участников в комнатах |
| Средняя нагрузка      | 4+    | 8 GB  | Много комнат, стабильный TURN |

- **LiveKit Server**: явного минимума в документации нет; в dev-режиме работает на скромном железе. Для продакшена обычно 2–4 CPU, 2–4 GB RAM в зависимости от числа участников и видео.
- **PostgreSQL и Redis**: достаточно 512 MB–1 GB RAM каждый при небольшой нагрузке.
- **Backend (Go)**: малые требования, 256–512 MB RAM обычно достаточно.

Рекомендуется отдельный сервер или VPS с **2 vCPU и 4 GB RAM** как минимальная комфортная конфигурация для небольшой продуктивной установки.

## Качество звука и шумоподавление

- **Клиент (браузер):** при захвате микрофона включены стандартные ограничения: шумоподавление (`noiseSuppression`), эхоподавление (`echoCancellation`), автоусиление (`autoGainControl`) и желаемая частота дискретизации 48 kHz. Поддержка зависит от браузера.
- **Backend:** в `.env` можно задать параметры кодирования (используются при необходимости серверной обработки): `AUDIO_CODEC=opus`, `AUDIO_BITRATE=32000`, `AUDIO_SAMPLE_RATE=48000`, `AUDIO_USE_INBAND_FEC=true`. Для лучшего качества голоса можно поднять `AUDIO_BITRATE` до 48000–64000.

## Особенности

- **E2EE**: End-to-End Encryption для медиа-потоков
- **Типы комнат**: Conference Hall (основной спикер), Round Table (равноправные участники)
- **Meeting Documents**: Совместное редактирование документов вместо чата
- **Временные комнаты**: Автоматическая генерация коротких кодов (формат: abc-defg-hij)
- **Widget API**: REST API для программного управления виджетом с сайта
