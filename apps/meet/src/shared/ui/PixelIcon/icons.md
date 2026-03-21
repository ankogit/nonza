# PixelIcon — имена (`PixelIconName`)

Источник правды для имён: `icons.ts` (`PIXEL_ICON_NAMES`). Стили и координаты: `shared/styles/pixel-icons.css`. При добавлении иконки обновляй `icons.ts`, CSS и этот файл.

## Сетка спрайта

| | |
|---|---|
| Файл | `public/icons/pixel-icons.png` (в приложении URL `/icons/pixel-icons.png`) |
| Размер PNG | 640×640 px |
| Ячейка в исходнике | 15×15 px (шаг сетки при раскладке новых иконок) |
| Масштаб в CSS | `background-size: calc(640 * var(--pi-size) / 15)` — на экране одна «логическая» ячейка = `--pi-size` |
| Шаг `background-position` | по X и Y: кратно `var(--pi-size)` (колонка `n` → `calc(-n * var(--pi-size))`) |
| Базовый размер | `.pi` → `--pi-size: 50px`; модификаторы `.pi--small` → 20px, `.pi--large` → 32px; у `PixelIcon` можно задать `size` — пробрасывается в `--pi-size` |

Строки:

- **Строка 0** (`y = 0`): колонки `0` … `41` — от `fullscreen` до `open-internal` в CSS. В `icons.ts` после `download` сразу идёт `link`, но в PNG между ними три ячейки (`upload`, `open-external`, `open-internal`) — классы есть только в `pixel-icons.css`, в `PixelIconName` не входят.
- **Строка 1** (`y = calc(-1 * var(--pi-size))`): колонки `0` … `14` — `link` … `stop`.

Новая иконка в конце второй строки: колонка `15`, та же `y`, что у `stop`.

---

- `fullscreen`
- `mic-on`
- `mic-off`
- `mic-off-2`
- `headphones-on`
- `headphones-off`
- `video-on`
- `video-off`
- `logo`
- `up`
- `down`
- `right`
- `left`
- `close`
- `screen-on`
- `screen-off`
- `hangup`
- `leader`
- `hand`
- `connection-none`
- `connection-bad`
- `connection-medium`
- `connection-good`
- `conference`
- `round-table`
- `people`
- `volume-high`
- `volume-medium`
- `volume-off`
- `settings`
- `lock-closed`
- `lock-open`
- `burger`
- `refresh`
- `reload`
- `document`
- `message`
- `check`
- `download`
- `link`
- `dice`
- `settings-alt`
- `play`
- `play-hold`
- `notes`
- `one-on-one`
- `settings-extra`
- `film`
- `add`
- `edit`
- `delete`
- `cancel`
- `pause`
- `stop`
