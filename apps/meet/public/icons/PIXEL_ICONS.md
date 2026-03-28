# Спрайт `pixel-icons.png` (Meet)

Документ для людей и для ИИ: как устроен файл, где править код, как добавлять иконки.

## Файл и URL

| | |
|---|---|
| Путь в репозитории | `apps/meet/public/icons/pixel-icons.png` |
| URL в приложении | `/icons/pixel-icons.png` |

Размер **640×640 px**. Ячейка сетки **15×15 px** (одна «клетка» = одна иконка в исходнике).

## Подход в коде

1. **Стили** — `apps/meet/src/shared/styles/pixel-icons.css`  
   Базовый класс `.pi`: фон со спрайтом, `background-size` масштабирует лист так, что **15 px исходника соответствуют `--pi-size` на экране**:

   `background-size: calc(640 * var(--pi-size) / 15)` (ширина и высота одинаковые).

2. **Позиция кадра** — сдвиг `background-position` кратно `var(--pi-size)` по X и Y (не в пикселях PNG, а в «логических» размерах иконки на экране).

3. **Компонент** — `apps/meet/src/shared/ui/PixelIcon/PixelIcon.vue`  
   Ренерит `<i class="pi pi-<name>" …>`. Размер: `variant` (`pi--small` / `pi--medium` / `pi--large`) или проп `size` → CSS-переменная `--pi-size`.

4. **Имена для TypeScript** — `apps/meet/src/shared/ui/PixelIcon/icons.ts`  
   Массив `PIXEL_ICON_NAMES`, тип `PixelIconName`. Любое имя из компонента должно быть здесь и иметь класс `.pi-<name>` в CSS.

## Сетка (индексы колонок и строк)

- **Строка 0** (`y = 0` в формуле позиции): колонки **0 … 41** (42 ячейки в ряд по горизонтали в PNG).
- **Строка 1** (`y = -1 * var(--pi-size)`): колонки **0 … 16** — статичные иконки; колонки **17 … 26** — **10 кадров** анимации `loading`.

В CSS: колонка `n`, строка `r` (0 — верхний ряд, 1 — второй):

```text
background-position: calc(-n * var(--pi-size)) calc(-r * var(--pi-size));
```

## Таблица: имя → (колонка, строка)

Строка **0**:

| Имя | col |
|-----|-----|
| fullscreen | 0 |
| mic-on | 1 |
| mic-off | 2 |
| mic-off-2 | 3 |
| headphones-on | 4 |
| headphones-off | 5 |
| video-on | 6 |
| video-off | 7 |
| logo | 8 |
| up | 9 |
| down | 10 |
| right | 11 |
| left | 12 |
| close | 13 |
| screen-on | 14 |
| screen-off | 15 |
| hangup | 16 |
| leader | 17 |
| hand | 18 |
| connection-none | 19 |
| connection-bad | 20 |
| connection-medium | 21 |
| connection-good | 22 |
| conference | 23 |
| round-table | 24 |
| people | 25 |
| volume-high | 26 |
| volume-medium | 27 |
| volume-off | 28 |
| settings | 29 |
| lock-closed | 30 |
| lock-open | 31 |
| burger | 32 |
| refresh | 33 |
| reload | 34 |
| document | 35 |
| message | 36 |
| check | 37 |
| download | 38 |
| upload | 39 |
| open-external | 40 |
| open-internal | 41 |

Классы **upload**, **open-external**, **open-internal** есть в CSS, но **не** входят в `PIXEL_ICON_NAMES` (через `PixelIcon` по имени не вызываются).

Строка **1**:

| Имя | col |
|-----|-----|
| link | 0 |
| dice | 1 |
| settings-alt | 2 |
| play | 3 |
| play-hold | 4 |
| notes | 5 |
| one-on-one | 6 |
| settings-extra | 7 |
| film | 8 |
| add | 9 |
| edit | 10 |
| delete | 11 |
| cancel | 12 |
| pause | 13 |
| stop | 14 |
| undo | 15 |
| redo | 16 |
| loading (кадры 0–9) | 17 … 26 |

## Анимация `loading`

Один логический значок `name="loading"`: CSS-класс `.pi-loading` крутит `background-position` по X на **строке 1**: кадры в колонках **17–26** (10 штук). В `@keyframes` конечная позиция **колонка 27** (пустая/за пределами кадров) — так `steps(10)` не «съедает» последний кадр из‑за `jump-end`. Длительность: свойство `animation` в `.pi-loading` в `pixel-icons.css`.

Если кадры в PNG переехали — обновить `from`, `to` и число в `steps(...)` согласованно.

## Чеклист: новая статичная иконка

1. Занять следующую свободную ячейку в `pixel-icons.png` (не ломая существующую сетку 15×15).
2. Добавить имя в `PIXEL_ICON_NAMES` в `icons.ts`.
3. Добавить `.pi-<name> { background-position: … }` в `pixel-icons.css`.
4. При необходимости обновить этот файл и `apps/meet/src/shared/ui/PixelIcon/icons.md`.

## Чеклист: новая анимация из нескольких клеток

1. Разместить кадры в **последовательных** колонках (и одной строке, если так принято в проекте).
2. Добавить/править `@keyframes` и класс `.pi-<name>` с `animation: … steps(N-1)` для **N** кадров (между первым и последним индексом **N − 1** шагов).
3. Имя в `icons.ts` и класс в CSS согласованы с `pi-<name>`.

## Размеры на экране (напоминание)

| Модификатор / контекст | `--pi-size` (по умолчанию) |
|------------------------|----------------------------|
| `.pi` без variant | 50px |
| `.pi--small` | 20px |
| `.pi--medium` | 26px |
| `.pi--large` | 32px |
| проп `size` у `PixelIcon` | задаётся явно |

`image-rendering: pixelated` / crisp-edges сохраняет пиксельный вид при масштабе.
