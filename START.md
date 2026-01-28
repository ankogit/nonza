# Инструкция по запуску Nonza

## Вариант 1: Локальная разработка (рекомендуется)

### Шаг 1: Запустить инфраструктуру

```bash
docker compose -f docker-compose.dev.yml up -d
```

Это запустит:

- PostgreSQL на порту 5432
- Redis на порту 6379
- LiveKit на портах 7880 (HTTP/WS), 7881 (TCP), 7882 (UDP), 50000-60000 (UDP для RTC)

Проверить статус:

```bash
docker compose -f docker-compose.dev.yml ps
```

### Шаг 2: Настроить и запустить Backend

```bash
cd backend
cp .env.example .env
```

В `.env` файле используйте:

```bash
DB_HOST=localhost
REDIS_HOST=localhost
WEBRTC_URL=wss://localhost:7880
WEBRTC_API_KEY=devkey
WEBRTC_API_SECRET=devsecret
```

Запустить:

```bash
go run cmd/app/main.go
```

Backend будет доступен на `http://localhost:8000`

### Шаг 3: Настроить и запустить Frontend

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

## Проверка работы

### Проверить сервисы

```bash
# PostgreSQL
docker exec -it nonza-postgres-dev psql -U nonza -d nonza -c "SELECT 1;"

# Redis
docker exec -it nonza-redis-dev redis-cli ping

# LiveKit (должен отвечать на HTTP)
curl http://localhost:7880
```

### Проверить Backend API

```bash
curl http://localhost:8000/api/v1/organizations
```

## Остановка

```bash
docker compose -f docker-compose.dev.yml down
```

## Troubleshooting

### Порты заняты

Если порты заняты, измените их в `docker-compose.dev.yml`:

```yaml
ports:
  - "5433:5432" # вместо 5432:5432
```

### LiveKit не запускается

Проверьте логи:

```bash
docker compose -f docker-compose.dev.yml logs livekit
```

Убедитесь, что порты 50000-60000 не заняты (это большой диапазон UDP портов для WebRTC).

### Первый запуск может занять время

При первом запуске Docker загружает образы (PostgreSQL, Redis, LiveKit). Это может занять несколько минут.
