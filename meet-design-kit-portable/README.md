# Meet — переносимый UI-кит (стили, компоненты, иконки)

Снимок из `apps/meet`: общие Vue-компоненты, глобальные стили, спрайт пиксель-иконок, шрифт и логотипы для переноса в другой проект.

## Структура

| Путь | Назначение |
|------|------------|
| `STYLEGUIDE.md` | Сводный стайл-гайд (токены, шрифты, ссылки на детали) |
| `styleguides/` | Доп. документация по `PixelIcon` |
| `styles/` | `main.css` (+ импорты `design.css`, `pixel-icons.css`, `room-fullscreen.css`) |
| `fonts/` | `bebasneuecyrillic.ttf` — положите в `public/fonts/` целевого приложения |
| `icons/` | `pixel-icons.png`, `PIXEL_ICONS.md` — положите PNG в `public/icons/` |
| `images/` | `nonza-icon-*.png` для `AppLogo` — в `public/images/` |
| `vue-ui/` | Копия `apps/meet/src/shared/ui/` (все экспортируемые из `@shared/ui` компоненты) |
| `lib-peerdeps/` | Минимальные модули из `@shared/lib`, которые реально тянут отдельные UI-компоненты |

## Подключение в новом проекте (Vue 3)

1. **Статика**  
   - `fonts/bebasneuecyrillic.ttf` → `public/fonts/`  
   - `icons/pixel-icons.png` → `public/icons/`  
   - `images/*.png` → `public/images/` (если используете `AppLogo`)

2. **Стили**  
   Импортируйте один раз в точке входа (как в meet):

   ```ts
   import "./path/to/meet-design-kit-portable/styles/main.css";
   ```

   Убедитесь, что URL в CSS совпадают с вашим `public`: `/fonts/...`, `/icons/pixel-icons.png`.

3. **Алиасы** (пример Vite `resolve.alias`):

   - `@shared/ui` → абсолютный путь на `vue-ui/`
   - `@shared/lib` → либо путь на `lib-peerdeps/`, либо на ваш общий пакет, куда вы скопировали недостающие файлы из meet

4. **Зависимости npm**  
   Только Vue 3 и TypeScript для большинства компонентов. Смотрите `COMPONENTS.md` по компонентам с внешней логикой.

## Компоненты и `@shared/lib`

Файл **`COMPONENTS.md`** перечисляет каждый компонент и нужен ли ему код из `lib-peerdeps/` или из полного `apps/meet/src/shared/lib/`.

Кратко:

- **`lib-peerdeps/`** хватает для: `Toast` / `ToastContainer`, `DiceRoller`, `ParticipantColorPalette` (плюс правильный `index`/`package` экспорт `@shared/lib` с этими файлами — проще скопировать папку и добавить `index.ts`, реэкспортирующий только нужное).
- **`AudioSettings`** тянет устройства и звуки (`audio-devices`, `notification-sounds`, `audio-input-test`, …). Для переноса либо скопируйте соответствующие файлы из meet вместе с их цепочкой импортов, либо не включайте этот компонент в новый проект.

## Исходные пути в монорепо

Всё собрано из `apps/meet`:

- Стили: `src/shared/styles/`
- UI: `src/shared/ui/`
- Иконки: `public/icons/`
- Шрифт: `public/fonts/bebasneuecyrillic.ttf`
