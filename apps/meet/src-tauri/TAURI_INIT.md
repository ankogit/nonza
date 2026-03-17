# Проверка инициализации Tauri

## 1. Конфиг (tauri.conf.json)

- **build.frontendDist**: `../dist` — папка для prod-сборки (npm run build:desktop).
- **build.devUrl**: `http://localhost:3000` — URL, который грузит WebView в dev.
- **build.beforeDevCommand**: `npm run dev:rooms` — перед запуском окна поднимается Vite в режиме `rooms` (загружается `.env.rooms` → `VITE_APP=rooms`).
- **build.beforeBuildCommand**: `npm run build:desktop` — перед сборкой бинарника собирается фронт в `dist`.
- **app.windows[0].label**: `main` — метка окна, с ней согласованы `emit_to("main", ...)` в Rust и capabilities.
- **app.security.csp**: `null` — ограничения по контенту не мешают скриптам.

## 2. Цепочка загрузки фронта

1. `tauri dev` → запускает `beforeDevCommand` → `npm run dev:rooms` → Vite с `--mode rooms` на :3000.
2. Tauri открывает окно и грузит в WebView `devUrl` = http://localhost:3000.
3. Отдаётся `index.html` → `<script type="module" src="/src/main.ts">`.
4. `main.ts`: `import.meta.env.VITE_APP` из `.env.rooms` = `"rooms"` → динамический импорт `./rooms/app/main.ts`.
5. Rooms App монтируется, вызывается `useMeetingShortcutListener()` в корне.

Итог: в WebView всегда грузится приложение **rooms** (не meets), т.к. beforeDevCommand задаёт режим rooms.

## 3. Связка фронт ↔ Rust

- **Инжект**: Tauri при загрузке страницы в WebView подмешивает свой скрипт (IPC). Он создаёт глобалы и мост для вызовов в Rust.
- **Определение Tauri на фронте** (`useTauriGlobalShortcuts.ts`):
  - `window.__TAURI__` или `window.__TAURI_INTERNALS__`, или
  - `import.meta.env.TAURI_ENV_PLATFORM` (подставляется при сборке/запуске Tauri).
- Если в логах было `isTauri: false` при отсутствии глобалов — срабатывает проверка по `TAURI_ENV_PLATFORM` (Vite передаёт `TAURI_ENV_*` в клиент при `tauri dev`).

## 4. Rust (lib.rs)

- Плагин `tauri_plugin_global_shortcut` подключается только для desktop: `#[cfg(desktop)]`.
- Команда `reregister_global_shortcuts` объявлена только для desktop; для mobile в `invoke_handler` передаётся пустой список команд, чтобы сборка не падала.
- В `setup` вызывается `register_global_shortcuts(&app.handle())` только на desktop.
- Окно с `label: "main"` совпадает с `emit_to("main", ...)` и с `windows: ["main"]` в capabilities.
- **Горячие клавиши звонка** (глобальные, работают когда приложение в фоне): **⇧⌘M** — микрофон, **⇧⌘V** — видео, **⇧⌘H** — завершить звонок. То же доступно из меню «Nonza Meet» (пункты с акселераторами). События `meeting-shortcut` обрабатываются в `RoomConferenceHall` / `RoomRoundTable` через `useTauriGlobalShortcuts`.

## 5. Capabilities

- **default.json**: окно `main`, в permissions — `core:default`, `core:event:allow-listen`, права на window, `global-shortcut:*`. Вызов кастомных команд приложения по умолчанию разрешён, отдельный permission для `reregister_global_shortcuts` не нужен.
- **desktop.json**: те же окна и доп. права для desktop (в т.ч. `core:window:allow-set-focus` для video/screen).

Если вызов `reregister_global_shortcuts` из фронта падает с ошибкой прав — в Tauri 2 для кастомных команд может понадобиться явный permission в формате, описанном в документации (например, через build.rs или capability).

## 6. Проверка открытия комнат через редиректы (чек-лист)

При загрузке приложения с нужными query-параметрами должен показываться корректный экран. В `rooms/app/App.vue` `parseRoute()` вызывается в `onMounted` и по `popstate`.

- **`?code=XXX`** (XXX — валидный short_code): при залогиненном пользователе показывается только NonzaWidget (звонок), виджет подключается с `connect-on-mount`. При невалидном code — виджет показывает «Комната не найдена».
- **`?page=invite&token=...`**: показ InviteScreen. Без token редирект на login.
- **`?page=login`** / **`?page=register`**: экран логина или регистрации.
- **Навигация назад/вперёд**: `popstate` вызывает `parseRoute()` — состояние должно соответствовать URL.

Для перехода в приложение по ссылке из браузера (например, из письма) потребуется отдельно настроить custom protocol (например, `nonza://meet?code=XXX`).

## 7. Подготовка к продакшену

- **Сборка**: `npm run build:desktop` (собирает фронт в режиме `rooms` в `dist`) и `tauri build`. При сборке подставляются `VITE_API_BASE_URL` и `VITE_LIVEKIT_URL` из окружения — задать их перед `tauri build` для прод-бэкенда и LiveKit.
- **Иконки**: в `tauri.conf.json` указан `bundle.icon: ["nonza-icon-m.ico"]`; файл должен лежать в `src-tauri/icons/`. Для всех платформ при необходимости добавить остальные форматы (см. документацию Tauri).
- **Полный флоу перед релизом**: логин → организации → выбор орги → вход в комнату / создание → звонок (в т.ч. «Открыть в новом окне») → выход; ссылки `?code=XXX` и `?page=invite&token=...` (см. п.6). При ошибках сети показывается экран «Переподключиться».
- **CSP** (опционально): в продакшене можно задать `app.security.csp` в `tauri.conf.json`, разрешив только нужные источники (API, LiveKit, скрипты приложения), чтобы снизить риски XSS.
- **Single instance** (опционально): при повторном запуске можно фокусировать уже открытое окно вместо второго процесса — настраивается на стороне Rust.

## 8. Типичные проблемы

- **Шорткаты не срабатывают после долгого фона**: перерегистрация по событию фокуса окна (`tauri://focus` → `invoke("reregister_global_shortcuts")`).
- **isTauri === false**: нет глобалов и/или `TAURI_ENV_PLATFORM` в клиенте — проверять, что запуск идёт через `tauri dev`/сборку Tauri и что в Vite `envPrefix` включает `TAURI_ENV_` (в vite.app.config.ts уже есть).
- **События из Rust не доходят до фронта**: подписка на `meeting-shortcut` в корне приложения (useMeetingShortcutListener), шина через provide/inject; окно должно быть с label `main` и в capabilities.
