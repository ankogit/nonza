# Nonza Video Call Widget

Vue 3 виджет для встраивания видеозвонков на сайты.

## Технологии

- Vue 3 + TypeScript
- LiveKit Client SDK
- FSD (Feature-Sliced Design) архитектура
- Vite для сборки

## Структура проекта (FSD)

```
src/
├── app/              # Инициализация приложения, главный компонент
├── widgets/          # Крупные составные блоки (комнаты разных типов)
├── features/         # Функциональные возможности (подключение, медиа, E2EE)
├── entities/         # Бизнес-сущности (Room, Organization, Document)
└── shared/           # Переиспользуемые модули (UI, API, утилиты)
```

## Установка

```bash
npm install
```

## Разработка

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

### Режим превью (без бэкенда)

Для разработки UI без подключения к бэкенду используйте режим превью:

**Вариант 1: Через URL параметр**

```
http://localhost:3000?preview=true
```

или

```
http://localhost:3000?mode=preview
```

**Вариант 2: Автоматически**
Если бэкенд недоступен, режим превью включится автоматически.

В режиме превью доступно:

- Переключение между типами комнат (Conference Hall / Round Table)
- Просмотр UI с мок-данными участников
- Тестирование компонентов документа встречи
- Проверка всех UI элементов без реального подключения к LiveKit

## Сборка

```bash
npm run build
```

Собранные файлы будут в папке `dist/`

## Использование

### Как библиотека

```typescript
import { NonzaWidget } from "@nonza/video-widget";
import "@nonza/video-widget/style.css";

app.component("NonzaWidget", NonzaWidget);
```

### В HTML

```html
<div id="nonza-widget"></div>
<script type="module">
  import { createApp } from "vue";
  import { NonzaWidget } from "@nonza/video-widget";
  import "@nonza/video-widget/style.css";

  createApp(NonzaWidget, {
    apiBaseURL: "http://localhost:8000",
    livekitURL: "ws://localhost:7880",
  }).mount("#nonza-widget");
</script>
```

## Конфигурация

### Переменные окружения

Создайте файл `.env`:

```env
# API URL - REST API бэкенда для управления данными
VITE_API_BASE_URL=http://localhost:8000

# LiveKit URL - WebSocket сервер для WebRTC (видео/аудио)
# Это НЕ API URL, а отдельный сервер LiveKit
VITE_LIVEKIT_URL=ws://localhost:7880
```

### Разница между API URL и LiveKit URL

**API URL (VITE_API_BASE_URL):**

- REST API бэкенда (Go приложение)
- Используется для: создания комнат, получения токенов, управления данными
- Протокол: HTTP/HTTPS
- Порт: 8000 (по умолчанию)

**LiveKit URL (VITE_LIVEKIT_URL):**

- WebSocket сервер LiveKit
- Используется для: WebRTC соединений, видео/аудио потоков
- Протокол: WS/WSS (WebSocket)
- Порт: 7880 (по умолчанию)

**Как это работает:**

1. Фронтенд обращается к API (`http://localhost:8000`) для создания комнаты и получения токена
2. Бэкенд генерирует токен и возвращает URL LiveKit сервера
3. Фронтенд подключается напрямую к LiveKit (`ws://localhost:7880`) с полученным токеном
4. LiveKit обрабатывает WebRTC соединения для видео/аудио

## Особенности

- Поддержка разных типов комнат (conference_hall, round_table)
- E2EE (End-to-End Encryption) индикатор
- Управление медиа (видео, аудио, демонстрация экрана)
- Документ встречи для совместных заметок
- Адаптивный дизайн
- Квадратный минималистичный дизайн в стиле пиксель-арт

## Брендовые цвета

- Primary: `#e74c3c`
- Secondary: `#2980B9`
- Accent: `#FFBE53`
