# Сборка и обновление десктопного приложения (Tauri)

## Как устроено

- Артефакты и `latest.json` публикуются в **GitHub Releases** репо `ankogit/nonza`.
- Клиент проверяет обновления по  
  `https://github.com/ankogit/nonza/releases/latest/download/latest.json`.
- Релиз собирается в **GitHub Actions** по тегу `desktop-vX.Y.Z`.
- Кнопки «Windows» / «macOS» на экране организаций ведут на стабильные имена:
  - `Nonza-windows.msi`
  - `Nonza-macos.dmg`

Ассеты релиза должны быть **публично** скачиваемыми (public repo или отдельный public-репо под релизы). Иначе updater и первая установка не заработают без auth.

Не публикуйте в этом репо обычные GitHub Releases «мимо» desktop-workflow: `/releases/latest` должен указывать на десктопный релиз.

---

## Локальная разработка

Из корня монорепы или из `apps/meet`:

```bash
npm run dev:tauri
```

Фронт: `VITE_*` из `.env` / `.env.rooms` в `apps/meet`.

---

## Локальная релизная сборка

Нужен private key updater (тот же, чей pubkey в `tauri.conf.json`):

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat /path/to/nonza.key)"
# если ключ с паролем:
# export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=...

export VITE_API_BASE_URL=https://api.nonza.ru
export VITE_LIVEKIT_URL=wss://livekit.example.com

npm run build:tauri   # из apps/meet или npm run build:tauri из корня
```

Артефакты: `apps/meet/src-tauri/target/release/bundle/` (и `target/<triple>/release/bundle/` при `--target`).

Кросс-сборки нет — macOS и Windows собираются на своей ОС (или в CI).

---

## Чеклист первого / очередного релиза

1. **Ключи updater** (один раз)  
   ```bash
   cd apps/meet && npm run tauri signer generate -w ~/.tauri/nonza.key
   ```  
   Публичный ключ — в `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.  
   Private key — только в секретах, не в git.

2. **GitHub Secrets** (Settings → Secrets and variables → Actions)  
   - `TAURI_SIGNING_PRIVATE_KEY` — содержимое private key  
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — если задавали при генерации (иначе пусто)

3. **GitHub Variables**  
   - `VITE_API_BASE_URL`  
   - `VITE_LIVEKIT_URL`

4. **Тег и пуш** (версия из тега подставится в `tauri.conf.json` / `package.json` на CI):  
   ```bash
   git tag desktop-v0.1.1
   git push origin desktop-v0.1.1
   ```

5. Дождаться workflow **Desktop release**, проверить Assets: установщики, `.sig`, `latest.json`, алиасы `Nonza-windows.msi` / `Nonza-macos.dmg`.

6. В установленном клиенте: Настройки → Приложение → «Проверить обновления» (при старте тоже тихая проверка + toast).

---

## Версия

Источник правды для релиза — тег `desktop-v*`. Локально `version` в `tauri.conf.json` можно держать синхронно с последним тегом.

---

## macOS / Windows code signing

Сейчас macOS собирается с ad-hoc (`signingIdentity: "-"`). Apple notarization и Windows Authenticode — отдельный этап (нужны сертификаты). Updater-подписи (minisign) для автообновлений уже обязательны.

---

## Deprecated: раздача через бэкенд

Эндпоинты `/api/v1/desktop-update/...`, `/api/v1/desktop-download/...` и env `DESKTOP_APP_UPDATE_JSON` / `DESKTOP_DOWNLOAD_DIR` больше не используются новым клиентом. Оставлены для старых деплоев; новые сборки смотрят только на GitHub Releases.
