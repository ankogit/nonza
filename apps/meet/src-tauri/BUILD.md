# Сборка десктопного приложения (macOS и Windows)

## Быстрый старт

Из папки **apps/meet**:

```bash
npm run build:desktop   # собирает фронт в ../dist
npm run build:tauri     # собирает нативное приложение под текущую ОС
```

- **На macOS** артефакты: `src-tauri/target/release/bundle/macos/` (.app, .dmg при включённом bundle).
- **На Windows** артефакты: `src-tauri/target/release/bundle/msi/` (.msi), exe в `target/release/`.

Кросс-сборки (с Mac под Windows и наоборот) нет — собирать нужно на целевой ОС или в CI (GitHub Actions и т.п.).

---

## Переменные окружения

Фронт подхватывает при сборке только переменные с префиксом **`VITE_`** (см. `config.ts`): `VITE_API_BASE_URL`, `VITE_LIVEKIT_URL`.

Перед `tauri build` Tauri запускает `npm run build:desktop`, то есть `vite build --mode rooms`. Vite в режиме `rooms` читает из корня **apps/meet** файлы в таком порядке (позже перезаписывают):

- `.env`
- `.env.local`
- **`.env.rooms`**
- `.env.rooms.local`

**Варианты:**

1. **Файл под режим rooms (удобно для боевой сборки)**  
   В **apps/meet** создай `.env.rooms` или `.env.rooms.local` (как правило, в git не коммитится) и пропиши:
   ```bash
   VITE_API_BASE_URL=https://api.yourapp.com
   VITE_LIVEKIT_URL=wss://livekit.yourapp.com
   ```
   Затем просто:
   ```bash
   npm run build:tauri
   ```

2. **Проброс в команду**  
   Можно не трогать файлы и передать переменные в момент сборки:
   ```bash
   VITE_API_BASE_URL=https://api.yourapp.com VITE_LIVEKIT_URL=wss://livekit.yourapp.com npm run build:tauri
   ```

3. **В CI**  
   Задай `VITE_*` в настройках секретов/переменных пайплайна и убедись, что перед `npm run build:tauri` они доступны в окружении (часто через `env:` в job’е).

Значения из env подставляются в бандл на этапе сборки; в уже собранном приложении их поменять нельзя без пересборки.

---

## Перед первым релизом

1. **Иконки**
   - Сейчас в конфиге только `.ico` (Windows). Для macOS нужен `.icns`.
   - Сгенерировать все форматы из одного PNG (1024×1024):
     ```bash
     npm run tauri icon ../public/images/icon.png
     ```
   - В `tauri.conf.json` в `bundle.icon` добавь сгенерированный `icons/icon.icns` (или положи свой `nonza-icon-m.icns` и укажи его).

2. **Updater** (опционально)
   - В `tauri.conf.json` → `plugins.updater`: замени `REPLACE_WITH_PUBLIC_KEY` на публичный ключ подписи обновлений и `OWNER/REPO` на свой репозиторий с релизами.
   - Если автообновления не нужны — можно отключить плагин или не настраивать endpoints.

3. **Версия и имя**
   - `tauri.conf.json`: `version`, `productName`, `identifier` (например `com.nonza.meet`).
   - Для установщика Windows можно задать `bundle.windows.wix` и т.д., если нужна кастомизация.

4. **Права macOS**
   - `entitlements.plist` уже есть (sandbox, network). Для доступа к камере/микрофону могут понадобиться дополнительные ключи — смотри [Tauri macOS entitlements](https://v2.tauri.app/distribute/macos-application-bundle).

---

## Релизная сборка (режим release)

По умолчанию `tauri build` уже идёт в release (оптимизация, без dev-инструментов). Явно:

```bash
npm run build:tauri
```

Проверить установщик/приложение на целевой машине перед распространением.

---

## Раздача скачивания через бэкенд

Бэкенд отдаёт артефакты по GET `/api/v1/desktop-download/:platform` (`windows` | `macos`), если задана переменная **`DESKTOP_DOWNLOAD_DIR`** (путь к каталогу).

1. Собери приложение под macOS и при необходимости под Windows (на соответствующей ОС).
2. Положи в один каталог файлы:
   - любой `.msi` (для Windows) — бэкенд отдаёт первый найденный;
   - любой `.dmg` (для macOS) — бэкенд отдаёт первый найденный.
3. В `.env` бэкенда задай `DESKTOP_DOWNLOAD_DIR=/путь/к/этому/каталогу`.
4. На главной (экран организаций) ссылки «Windows» и «macOS» ведут на `{API_BASE_URL}/api/v1/desktop-download/windows` и `.../macos` и скачивают файл через бэкенд.
