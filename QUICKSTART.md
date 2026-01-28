# Быстрый старт Nonza

## Вариант 1: Локальная разработка (рекомендуется)

### 1. Запустить инфраструктуру (PostgreSQL, Redis, LiveKit)

```bash
make dev-up
# или
docker-compose -f docker-compose.dev.yml up -d
```

Проверить, что все запустилось:

```bash
docker-compose -f docker-compose.dev.yml ps
```

### 2. Настроить и запустить Backend

```bash
cd backend
cp .env.example .env
```

В `.env` файле используйте:

```bash
DB_HOST=localhost
REDIS_HOST=localhost
WEBRTC_URL=wss://localhost:7880
```

Запустить:

```bash
go run cmd/app/main.go
```

Backend будет доступен на `http://localhost:8000`

### 3. Настроить и запустить Frontend

```bash
cd frontend
cp .env.example .env
```

В `.env` файле:

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_LIVEKIT_URL=wss://localhost:7880
```

Запустить:

```bash
npm install
npm run dev
```

Frontend будет доступен на `http://localhost:3000`

## Вариант 2: Полный запуск в Docker

### Запустить все сервисы

```bash
make build
make up
```

Проверить статус:

```bash
docker-compose ps
```

Просмотр логов:

```bash
make logs
# или для конкретного сервиса
make backend-logs
make livekit-logs
```

### Остановка

```bash
make down
```

## Проверка работы

### 1. Проверить Backend API

```bash
curl http://localhost:8000/api/v1/organizations
```

### 2. Проверить LiveKit

LiveKit доступен на:

- WebSocket: `ws://localhost:7880`
- HTTP: `http://localhost:7880`

### 3. Проверить PostgreSQL

```bash
docker exec -it nonza-postgres psql -U nonza -d nonza
```

### 4. Проверить Redis

```bash
docker exec -it nonza-redis redis-cli ping
```

## Полезные команды

```bash
# Просмотр логов конкретного сервиса
make backend-logs
make livekit-logs
make postgres-logs
make redis-logs

# Перезапуск сервиса
docker-compose restart backend

# Очистка (удалит все данные!)
make clean
```

## Troubleshooting

### Backend не может подключиться к БД

Проверьте, что в `.env` файле backend указан правильный `DB_HOST`:

- Для локального запуска: `DB_HOST=localhost`
- Для Docker: `DB_HOST=postgres`

### LiveKit не работает

1. Проверьте, что LiveKit запущен: `docker-compose ps`
2. Проверьте логи: `make livekit-logs`
3. Убедитесь, что порты 7880-7882 и 50000-60000 не заняты

### Проблемы с портами

Если порты заняты, измените их в `docker-compose.yml`:

```yaml
ports:
  - "8001:8000" # вместо 8000:8000
```
