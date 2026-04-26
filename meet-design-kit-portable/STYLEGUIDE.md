# Сводный стайл-гайд Meet (переносимый кит)

Документ объединяет правила из глобальных стилей meet и отдельных markdown-гайдов по иконкам. Полные тексты спрайта и имён иконок лежат рядом: `icons/PIXEL_ICONS.md`, `styleguides/PixelIcon-icons.md`.

---

## 1. CSS-переменные (`styles/main.css`, `:root`)

| Переменная | Значение | Назначение |
|------------|----------|------------|
| `--color-primary` | `#2980b9` | Основной акцент, кнопки, активные состояния |
| `--color-secondary` | `#282741` | Поверхности / альтернативный тёмный |
| `--color-accent` | `#ffc866` | Акцент, предупреждения (светлый жёлтый) |
| `--color-danger` | `#e2534b` | Ошибка, опасные действия |
| `--color-warning` | `#ffc866` | Предупреждение |
| `--color-success` | `#0ead61` | Успех |
| `--color-surface-alt` | `#282741` | Альтернативная поверхность |
| `--color-background` | `#1a1a1a` | Фон приложения |
| `--color-surface` | `#2a2a2a` | Карточки, панели |
| `--color-text` | `#ffffff` | Основной текст |
| `--color-text-secondary` | `#cccccc` | Вторичный текст |
| `--border-width` | `2px` | Толщина рамок в духе «пиксельного» UI |

Глобально: сброс `* { box-sizing }`, `html`/`body` на всю высоту без скролла у корня, `#app` — flex-колонка. Для пиксельной графики на `body`: `image-rendering: crisp-edges` и `pixelated`.

Класс **`html.nonza-desktop`** отключает выделение текста везде, кроме `input`, `textarea`, `[contenteditable]` — при переносе можно не подключать, если не нужен desktop-shell.

---

## 2. Шрифты

- **Основной UI-текст** (из `main.css`): `'Open Sans'`, system stack.
- **Заголовки / meet-стиль** (`design.css`): `@font-face` **Bebas Neue** — файл в этом ките: `fonts/bebasneuecyrillic.ttf`, в CSS путь **`/fonts/bebasneuecyrillic.ttf`**. Класс утилиты: **`.font-bebas`**.

---

## 3. Фоны и атмосфера (`design.css`)

- **`.bg-dark`**, **`.bg-darker`** — вертикальный градиент с анимацией смены `--hue` (`@property --hue`, keyframes `bg-dark-flow`).
- **`.meet-scroll`** — тонкий тёмный скроллбар (Firefox + WebKit).
- **`.grain-overlay`** — псевдоэлемент с внешним URL текстуры (в проде может понадобиться заменить URL на свой ассет).
- Утилиты: **`.bg-dark-20`**, **`.bg-dark-40`**, **`.color-white`** (`#bab1a8`), **`.bg-dark-blur-90`**.

---

## 4. Компонентные стили vs Vue

Часть того, что раньше было только классами, перенесено в компоненты:

- **Кнопки** — в основном **`vue-ui/Button/Button.vue`** (в `design.css` осталась пометка, что стили меню перенесены туда).
- **Чекбоксы** — классы **`.checkbox-pixel`**, **`.check-box`** и компонент **`Checkbox`**.
- **Селекты** — класс **`.select-pixel`** и компонент **`PixelSelect`**.
- **Индикаторы точек** — **`.indicator`** + варианты `.danger`, `.warning`, `.default`, `.success` и компонент **`Indicator`**.

Остальное в `design.css`: layout комнаты (`.dashboard`, `.room-header`, `.menu`, `.call-grid`), списки комнат (`.organization`, `.room-button`, …), плеер, тайлы и т.д. — смотрите файл целиком при переносе экранов «как в meet».

---

## 5. Полноэкранная комната

Файл **`styles/room-fullscreen.css`** — оверлеи, полноэкранный режим, взаимодействие с чекбоксами из `design.css`.

---

## 6. Пиксель-иконки (спрайт)

Источник правды по сетке, именам и чеклистам добавления:

- **`icons/PIXEL_ICONS.md`** — полная таблица имя → колонка, анимация `loading`, размеры `--pi-size`.
- **`styleguides/PixelIcon-icons.md`** — список имён `PixelIconName` в порядке сетки.

Технически:

- PNG: **`icons/pixel-icons.png`** (в приложении обычно `/icons/pixel-icons.png`), 640×640, ячейка 15×15 px.
- Стили: **`styles/pixel-icons.css`** — класс `.pi`, модификаторы размера, `.pi-<name>`, `background-size` через `var(--pi-size)`.
- Компонент: **`vue-ui/PixelIcon/PixelIcon.vue`** + **`vue-ui/PixelIcon/icons.ts`** (`PIXEL_ICON_NAMES`, `pixelIconClass`).

---

## 7. Кнопка (`Button`)

Реализация: **`vue-ui/Button/Button.vue`**. Типы: обычная / иконка, варианты, размер иконки через пропы — смотрите исходник при переносе поведения.

---

## 8. Что лежит в этом ките (чеклист переноса)

- [x] Все четыре глобальных CSS-файла  
- [x] Спрайт и документация по иконкам  
- [x] Шрифт Bebas  
- [x] PNG для `AppLogo`  
- [x] Все компоненты из `shared/ui`  
- [x] Минимальный набор `shared/lib` для тостов, кубиков и палитры цветов  

Для полного повторения meet-приложения дополнительно понадобятся остальные шрифты/картинки из `apps/meet/public/` и бизнес-логика вне этого кита.
