# Минимальные peer-зависимости для UI

Скопировано из `apps/meet/src/shared/lib/`:

- `useToasts.ts` — тосты (`Toast`, `ToastContainer`)
- `dice.ts` — кубики (`DiceRoller`)
- `constants.ts` — брендовые цвета (для `participant-color.ts`)
- `participant-color.ts` — палитра (`ParticipantColorPalette`)

В целевом проекте сделайте, например, `src/shared/lib/index.ts`:

```ts
export * from "./useToasts";
export * from "./dice";
export * from "./constants";
export * from "./participant-color";
```

И настройте `@shared/lib` на эту папку.

Для **`AudioSettings`** эти файлы не подходят — копируйте из исходного репозитория модули `audio-devices`, `audio-constraints`, `audio-input-test`, `notification-sounds` и всё, что они импортируют (см. импорты в `vue-ui/AudioSettings/AudioSettings.vue`).
