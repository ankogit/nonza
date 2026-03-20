# Global Shortcuts + Mouse Listener (Tauri) - Learning Guide

Этот документ помогает “вкатиться” в технологии проекта:
- `tauri-plugin-global-shortcut` (глобальные клавиатурные хоткеи)
- системный mouse listener на уровне ОС (macOS `CGEventTap`, Windows `SetWindowsHookExW`)
- связка Rust backend <-> Vue frontend (IPC через `invoke` + события через `emit_to`)
- предотвращение конфликтов (дедупликация срабатываний)

---

## 0) Карта архитектуры (как это всё связано)

Есть два независимых источника событий:
- Клавиатура:
  - работает через `tauri-plugin-global-shortcut`
  - Rust ловит хоткей всегда (когда активен desktop scope), и вызывает `emit_to("main", "meeting-shortcut", ...)`
- Мышь (доп. кнопки):
  - работает через OS-level listener (`mouse_listener`)
  - Rust при нужных событиях вызывает тот же event в frontend

Frontend делает две вещи:
- слушает `meeting-shortcut` и диспатчит “действие” (audio/video/sound/leave)
- для mouse-shortcut добавляет guard, чтобы DOM-события в WebView не триггерили дубликаты, когда Rust listener активен

---

## 1) Где смотреть код (точки входа)

1. Оркестрация приложения
   - `apps/meet/src-tauri/src/lib.rs`
   - что там:
     - подключение `invoke_handler![]`
     - `setup`: инициализация state, старт `mouse_listener` на macOS/Windows, init меню/аксессоров

2. Хоткеи/меню/команды
   - `apps/meet/src-tauri/src/shortcuts.rs`
   - что там:
     - `ShortcutBindings` (keyboard-модуль для global-shortcut и меню, mouse-модуль для OS listener)
     - команды `set_shortcut_bindings`, `reregister_global_shortcuts`, `trigger_meeting_shortcut`, `update_app_menu`
     - `init_menu_and_shortcuts(...)` (меню плюс регистрация keyboard хоткеев)

3. Системный listener (OS)
   - `apps/meet/src-tauri/src/mouse_listener/mod.rs` (дирижёр)
   - `apps/meet/src-tauri/src/mouse_listener/macos.rs` (CGEventTap)
   - `apps/meet/src-tauri/src/mouse_listener/windows.rs` (Windows hook)
   - ключевое:
     - `is_mouse_listener_active` - команда, чтобы frontend знал, когда Rust listener в работе

4. Frontend диспетчер и guard
   - `apps/meet/src/shared/lib/useTauriGlobalShortcuts.ts`
   - ключевое:
     - обработчики DOM (`pointerdown`, `mousedown`, `keydown`) в WebView
     - guard: если `mouseListenerActive == true` и shortcut мыши, то DOM-обработчик возвращается раньше, чтобы не было дублей

---

## 2) Понимание “источника правды” и предотвращение конфликтов

Цель: не чтобы “все выключить”, а чтобы было очевидно, кто и когда триггерит действие.

Правило для мыши:
- Когда Rust OS listener активен, frontend DOM mouse-события игнорируются для mouse-shortcuts.

Правило для клавиатуры:
- Keyboard hotkeys приходят из Rust через `tauri-plugin-global-shortcut`.
- DOM `keydown` в WebView может срабатывать только если окно в фокусе (это зависит от сценария использования).
- Если понадобится довести “дедуп до идеала” и для клавиатуры тоже, это делается добавлением аналогичного guard на фронте.

---

## 3) Блок “learn by reading”: что выучить в каждом файле

### 3.1 `shortcuts.rs`
1. `ShortcutBindings`
   - keyboard fields (`*_keyboard`) используются для:
     - `tauri-plugin-global-shortcut`
     - меню (accelerators)
   - mouse fields (`*_mouse`) используются для OS listener

2. `set_shortcut_bindings(...)`
   - фронт шлёт 4 строки: `audio/video/leave/sound`
   - эти строки одновременно могут быть “keyboard format” или “mouse format”
   - функция разделяет их на:
     - `*_keyboard` - только валидные keyboard акселераторы
     - `*_mouse` - только `Mouse4/Mouse5` формат
   - после этого:
     - регистрируются keyboard global shortcuts (mouse-строки не используются для плагина)

3. `reregister_global_shortcuts(...)`
   - нужна, когда хотите обновить регистрацию после изменения настроек

4. `update_app_menu(...)` и `init_menu_and_shortcuts(...)`
   - формируют меню “Nonza Meet”
   - задают accelerators, которые совпадают с теми keyboard хоткеями, что зарегистрированы в Rust

### 3.2 `mouse_listener/mod.rs`
1. `start(app)`
   - создаёт `active` флаг
   - `app.manage(...)` хранит состояние
   - запускает `macos::start` или `windows::start` в зависимости от платформы

2. `is_mouse_listener_active(app)`
   - возвращает boolean, который читает frontend

### 3.3 macOS: `mouse_listener/macos.rs`
Сфокусироваться на 3 вещах:
1. Почему `CGEventTap` может не ставиться (обычно permissions)
2. Как делается фильтрация по типу события (какие event types вообще интересны для доп. кнопок)
3. Что логировать, когда “ничего не ловится”:
   - попытки установки tap в разные locations
   - `Accessibility trusted` статус

### 3.4 Windows: `mouse_listener/windows.rs`
Сфокусироваться на 3 вещах:
1. Как callback получает информацию о событии и где фильтровать нужные окна/типы
2. Как достается `XBUTTON1/XBUTTON2` и маппится на `Mouse4/Mouse5`
3. Почему важно message loop / чтобы hook жил (в коде обычно это реализовано через цикл обработки сообщений)

---

## 4) Практика: “починить и убедиться” (чеклист)

1. Базовая проверка связки IPC
   - убедись, что frontend подписан на `meeting-shortcut`
   - проверь, что `emit_to("main", "meeting-shortcut", ...)` летит с правильной строкой: `audio/video/sound/leave`

2. Проверка регистрации keyboard хоткеев
   - в `shortcuts.rs` смотри `register_global_shortcuts_with(...)`
   - меняй хоткей в UI (если есть настройки) и убеждайся, что вызывается re-register

3. Проверка мыши на macOS (самое частое)
   - если `CGEventTap install failed`:
     - обязательно проверить `Input Monitoring` и `Accessibility`
     - в логах найти строку про `Accessibility trusted=false`

4. Проверка мыши на Windows
   - если hook “не активен”:
     - проверь логи установки хука
     - убедись, что в callback действительно приходит `WM_*` нужного типа

5. Проверка дублей
   - если действие вызывается дважды:
     - проверь guard на фронте по `mouseListenerActive`
     - убедись, что `mouseListenerActive` реально переключается (команда работает)

---

## 5) План обучения “как рыбо-вводте” (короткий)

День 1 (чтение кода + mental model):
1. `lib.rs` -> где стартует всё
2. `shortcuts.rs` -> откуда берутся keyboard хоткеи и меню
3. `mouse_listener/mod.rs` -> как фронт узнает, что OS listener активен

День 2 (отладка на реальных событиях):
1. macOS:
   - добиться “tap ставится”
   - добить маппинг side buttons до нужной строки `Mouse4/Mouse5`
2. Windows:
   - проверить callback и маппинг XButtons
3. Сверить, что дублей нет при смене фокуса окна

---

## 6) Если хочешь расширить документ (что добавить)

Я могу дописать отдельный раздел:
- “типовые логи и что они означают” (примерно как таблица)
- “как улучшить дедуп для клавиатуры на фронте”
- “какие capability/permissions обычно нужны и где проверять”

