# Инвентарь компонентов (`vue-ui/`)

Импорты внутри компонентов используют алиасы `@shared/ui` и `@shared/lib`, как в meet.

## Только Vue / внутри `@shared/ui`

Без кода из meet-lib (кроме циклических импортов `@shared/ui` — настройте alias на эту папку):

`Alert`, `AppLogo`, `Badge`, `Button`, `Card`, `CardTile`, `Checkbox`, `ContextMenu`, `Divider`, `FormSection`, `Indicator`, `Input`, `Knob`, `ListEmpty`, `MeetCollabPanel`, `Modal`, `PageHeader`, `PillGroup`, `PixelIcon`, `PixelSelect`, `Radio`, `RadioButtonGroup`, `ScreenLayout`, `Skeleton`, `Spinner`, `SubmitCancelActions`, `Switch`, `Textarea`, `Typography`

## Нужен `@shared/lib` (частично в `lib-peerdeps/`)

| Компонент | Зависимости |
|-----------|-------------|
| `ParticipantColorPalette` | `participant-color.ts` → импортирует `constants.ts` (`BRAND_COLORS`) |
| `DiceRoller` | `dice.ts` (`rollDiceExpression`, типы) |
| `Toast` | тип `ToastVariant` из `useToasts.ts` |
| `ToastContainer` | `useToasts`, `dismissToast` из `useToasts.ts` |

Для этих четырёх достаточно файлов в `lib-peerdeps/`, если в целевом проекте `@shared/lib` реэкспортирует их с теми же путями/именами.

## Тяжёлая интеграция (лучше копировать цепочку из meet или выкинуть из переноса)

| Компонент | Примечание |
|-----------|------------|
| `AudioSettings` | `useAudioDevices`, storage-хелперы устройств, `useNotificationSounds`, `useAudioInputTest`, типы уведомлений — десятки файлов в `shared/lib` и окружении |

## Внутренние ссылки `@shared/ui`

`Modal`, `Toast`, `Checkbox`, `RadioButtonGroup`, `Alert`, `AudioSettings`, `DiceRoller` — импортируют другие UI-компоненты через `@shared/ui`. Alias должен указывать на одну и ту же папку `vue-ui/`.

## Точка входа экспорта

В meet: `apps/meet/src/shared/ui/index.ts` — дублируется логикой папки `vue-ui/` (там же лежит `index.ts`).
