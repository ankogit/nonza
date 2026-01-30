<template>
  <div class="ui-kit">
    <header class="ui-kit__header">
      <h1 class="ui-kit__title">Nonza UI Kit</h1>
      <p class="ui-kit__subtitle">Компоненты интерфейса</p>
      <a href="/" class="ui-kit__back">← Назад в приложение</a>
    </header>

    <nav class="ui-kit__nav">
      <a
        v-for="section in sections"
        :key="section.id"
        :href="`#${section.id}`"
        class="ui-kit__nav-link"
      >
        {{ section.title }}
      </a>
    </nav>

    <main class="ui-kit__main">
      <!-- Typography -->
      <section id="typography" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Typography</h2>
        <p class="ui-kit__section-desc">
          Заголовки и текст: h1, h2, h3, body, caption, label.
        </p>
        <div class="ui-kit__block">
          <Typography variant="h1">Заголовок H1</Typography>
          <Typography variant="h2">Заголовок H2</Typography>
          <Typography variant="h3">Заголовок H3</Typography>
          <Typography variant="body">Основной текст. Body — для параграфов и контента.</Typography>
          <Typography variant="caption">Caption — подпись или вторичный текст.</Typography>
          <Typography variant="label">Label — подпись к полям.</Typography>
        </div>
      </section>

      <!-- Button -->
      <section id="button" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Button</h2>
        <p class="ui-kit__section-desc">
          Кнопки: иконки и текстовые. Варианты: primary, danger, warning, default, active, secondary, accent. Размеры: small, medium, large.
        </p>

        <div class="ui-kit__block">
          <h3 class="ui-kit__block-title">Иконки (варианты)</h3>
          <div class="ui-kit__row ui-kit__row--wrap">
            <Button type="icon" variant="primary" title="Primary">🎤</Button>
            <Button type="icon" variant="danger" title="Danger">✕</Button>
            <Button type="icon" variant="warning" title="Warning">⚠</Button>
            <Button type="icon" variant="default" title="Default">⚙</Button>
            <Button type="icon" variant="active" title="Active">●</Button>
            <Button type="icon" variant="secondary" title="Secondary">📹</Button>
            <Button type="icon" variant="accent" title="Accent">🔊</Button>
          </div>
        </div>

        <div class="ui-kit__block">
          <h3 class="ui-kit__block-title">Размеры (icon)</h3>
          <div class="ui-kit__row ui-kit__row--wrap">
            <Button type="icon" variant="primary" size="small">S</Button>
            <Button type="icon" variant="primary" size="medium">M</Button>
            <Button type="icon" variant="primary" size="large">L</Button>
          </div>
        </div>

        <div class="ui-kit__block">
          <h3 class="ui-kit__block-title">Текстовые кнопки</h3>
          <div class="ui-kit__row ui-kit__row--wrap">
            <Button type="text" variant="primary" size="small">Маленькая</Button>
            <Button type="text" variant="primary" size="medium">Средняя</Button>
            <Button type="text" variant="primary" size="large">Большая</Button>
            <Button type="text" variant="danger" size="medium">Отмена</Button>
            <Button type="text" variant="default" size="medium">Вторичная</Button>
          </div>
        </div>

        <div class="ui-kit__block">
          <h3 class="ui-kit__block-title">Disabled</h3>
          <div class="ui-kit__row ui-kit__row--wrap">
            <Button type="icon" variant="primary" disabled>🎤</Button>
            <Button type="text" variant="primary" size="medium" disabled>Недоступно</Button>
          </div>
        </div>
      </section>

      <!-- Input -->
      <section id="input" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Input</h2>
        <p class="ui-kit__section-desc">
          Текстовое поле. Типы: text, email, password, number, search. Поддержка error, disabled, readonly.
        </p>
        <div class="ui-kit__block">
          <div class="ui-kit__col">
            <label class="ui-kit__label">Обычный</label>
            <Input v-model="inputValue" placeholder="Введите текст" />
            <label class="ui-kit__label" style="margin-top: 16px;">С ошибкой</label>
            <Input v-model="inputValue" placeholder="Ошибка валидации" :error="true" />
            <label class="ui-kit__label" style="margin-top: 16px;">Disabled</label>
            <Input model-value="Недоступно" disabled />
          </div>
        </div>
      </section>

      <!-- Textarea -->
      <section id="textarea" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Textarea</h2>
        <p class="ui-kit__section-desc">
          Многострочное поле. rows, placeholder, error, disabled, readonly.
        </p>
        <div class="ui-kit__block">
          <div class="ui-kit__col">
            <label class="ui-kit__label">Обычный</label>
            <Textarea v-model="textareaValue" placeholder="Введите текст..." :rows="4" />
          </div>
        </div>
      </section>

      <!-- Checkbox -->
      <section id="checkbox" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Checkbox</h2>
        <p class="ui-kit__section-desc">
          Чекбокс с опциональной подписью.
        </p>
        <div class="ui-kit__block">
          <div class="ui-kit__row ui-kit__row--wrap" style="gap: 16px;">
            <Checkbox v-model="checkboxValue">Согласен с условиями</Checkbox>
            <Checkbox :model-value="true" disabled>Disabled отмечен</Checkbox>
            <Checkbox :model-value="false" disabled>Disabled не отмечен</Checkbox>
          </div>
        </div>
      </section>

      <!-- Radio -->
      <section id="radio" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Radio</h2>
        <p class="ui-kit__section-desc">
          Группа радиокнопок (общий modelValue и name).
        </p>
        <div class="ui-kit__block">
          <div class="ui-kit__col" style="gap: 12px;">
            <Radio v-model="radioValue" name="demo" value="a">Вариант A</Radio>
            <Radio v-model="radioValue" name="demo" value="b">Вариант B</Radio>
            <Radio v-model="radioValue" name="demo" value="c">Вариант C</Radio>
          </div>
        </div>
      </section>

      <!-- Switch -->
      <section id="switch" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Switch</h2>
        <p class="ui-kit__section-desc">
          Переключатель вкл/выкл.
        </p>
        <div class="ui-kit__block">
          <div class="ui-kit__row ui-kit__row--wrap" style="gap: 16px;">
            <Switch v-model="switchValue">Уведомления</Switch>
            <Switch :model-value="true" disabled>Disabled вкл</Switch>
          </div>
        </div>
      </section>

      <!-- PixelSelect -->
      <section id="pixel-select" class="ui-kit__section">
        <h2 class="ui-kit__section-title">PixelSelect</h2>
        <p class="ui-kit__section-desc">
          Модальное окно с заголовком, контентом и футером. Закрытие по клику на оверлей и по Escape.
        </p>
        <div class="ui-kit__block">
          <Button type="text" variant="primary" size="medium" @click="modalOpen = true">
            Открыть модалку
          </Button>
        </div>
        <Modal
          v-model="modalOpen"
          title="Пример модального окна"
          :close-on-overlay-click="true"
        >
          <p>Здесь может быть любой контент. Закройте по крестику, клику вне окна или Escape.</p>
          <template #footer>
            <Button type="text" variant="default" size="medium" @click="modalOpen = false">
              Закрыть
            </Button>
            <Button type="text" variant="primary" size="medium" @click="modalOpen = false">
              Готово
            </Button>
          </template>
        </Modal>
      </section>

      <!-- PixelSelect -->
      <section id="pixel-select" class="ui-kit__section">
        <h2 class="ui-kit__section-title">PixelSelect</h2>
        <p class="ui-kit__section-desc">
          Выпадающий список в пиксельном стиле. Поддержка клавиатуры и placeholder.
        </p>
        <div class="ui-kit__block">
          <div class="ui-kit__row" style="flex-direction: column; align-items: flex-start; gap: 16px;">
            <div style="width: 100%; max-width: 320px;">
              <label class="ui-kit__label">Выберите значение</label>
              <PixelSelect
                v-model="selectValue"
                placeholder="Выберите..."
                :options="selectOptions"
                aria-label="Выберите значение"
              />
            </div>
            <p class="ui-kit__hint">Выбрано: <strong>{{ selectValue || '—' }}</strong></p>
          </div>
        </div>
        <div class="ui-kit__block">
          <h3 class="ui-kit__block-title">Disabled</h3>
          <div style="max-width: 320px;">
            <PixelSelect
              v-model="selectValue"
              placeholder="Disabled"
              :options="selectOptions"
              disabled
            />
          </div>
        </div>
      </section>

      <!-- Badge -->
      <section id="badge" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Badge</h2>
        <p class="ui-kit__section-desc">
          Метка/тег. Варианты: default, primary, danger, warning, success. Размер: small, medium.
        </p>
        <div class="ui-kit__block">
          <div class="ui-kit__row ui-kit__row--wrap" style="gap: 12px;">
            <Badge variant="default">Default</Badge>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="primary" size="small">Small</Badge>
          </div>
        </div>
      </section>

      <!-- Divider -->
      <section id="divider" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Divider</h2>
        <p class="ui-kit__section-desc">
          Разделитель горизонтальный или вертикальный.
        </p>
        <div class="ui-kit__block">
          <p>Текст сверху</p>
          <Divider />
          <p>Текст снизу</p>
          <div class="ui-kit__row" style="height: 60px;">
            <span>Слева</span>
            <Divider :vertical="true" />
            <span>Справа</span>
          </div>
        </div>
      </section>

      <!-- Spinner -->
      <section id="spinner" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Spinner</h2>
        <p class="ui-kit__section-desc">
          Индикатор загрузки. Размеры: small, medium.
        </p>
        <div class="ui-kit__block">
          <div class="ui-kit__row ui-kit__row--wrap" style="gap: 24px;">
            <Spinner size="medium" />
            <Spinner size="small" />
          </div>
        </div>
      </section>

      <!-- Alert -->
      <section id="alert" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Alert</h2>
        <p class="ui-kit__section-desc">
          Уведомление. Варианты: info, success, warning, danger. Опционально dismissible.
        </p>
        <div class="ui-kit__block ui-kit__col" style="gap: 12px;">
          <Alert variant="info">Информационное сообщение.</Alert>
          <Alert variant="success">
            <template #title>Готово</template>
            Операция выполнена успешно.
          </Alert>
          <Alert variant="warning">Предупреждение: проверьте данные.</Alert>
          <Alert variant="danger" dismissible @close="() => {}">
            Ошибка. Можно закрыть по крестику.
          </Alert>
        </div>
      </section>

      <!-- Card -->
      <section id="card" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Card</h2>
        <p class="ui-kit__section-desc">
          Карточка с опциональными header и footer.
        </p>
        <div class="ui-kit__block">
          <Card style="max-width: 360px;">
            <template #header>Заголовок карточки</template>
            Содержимое карточки. Можно размещать любой контент.
            <template #footer>
              <Button type="text" variant="primary" size="small">Действие</Button>
            </template>
          </Card>
        </div>
      </section>

      <!-- Modal -->
      <section id="modal" class="ui-kit__section">
        <h2 class="ui-kit__section-title">Modal</h2>
        <p class="ui-kit__section-desc">
          Модальное окно с заголовком, контентом и футером. Закрытие по клику на оверлей и по Escape.
        </p>
        <div class="ui-kit__block">
          <Button type="text" variant="primary" size="medium" @click="modalOpen = true">
            Открыть модалку
          </Button>
        </div>
        <Modal
          v-model="modalOpen"
          title="Пример модального окна"
          :close-on-overlay-click="true"
        >
          <p>Здесь может быть любой контент. Закройте по крестику, клику вне окна или Escape.</p>
          <template #footer>
            <Button type="text" variant="default" size="medium" @click="modalOpen = false">
              Закрыть
            </Button>
            <Button type="text" variant="primary" size="medium" @click="modalOpen = false">
              Готово
            </Button>
          </template>
        </Modal>
      </section>

      <!-- AudioSettings -->
      <section id="audio-settings" class="ui-kit__section">
        <h2 class="ui-kit__section-title">AudioSettings</h2>
        <p class="ui-kit__section-desc">
          Блок настроек аудио: выбор микрофона и устройства вывода, тест микрофона.
        </p>
        <div class="ui-kit__block ui-kit__block--wide">
          <AudioSettings @change="onAudioChange" />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  Button,
  Modal,
  PixelSelect,
  AudioSettings,
  Input,
  Textarea,
  Checkbox,
  Radio,
  Switch,
  Badge,
  Divider,
  Spinner,
  Alert,
  Card,
  Typography,
} from "@shared/ui";

const sections = [
  { id: "typography", title: "Typography" },
  { id: "button", title: "Button" },
  { id: "input", title: "Input" },
  { id: "textarea", title: "Textarea" },
  { id: "checkbox", title: "Checkbox" },
  { id: "radio", title: "Radio" },
  { id: "switch", title: "Switch" },
  { id: "pixel-select", title: "PixelSelect" },
  { id: "badge", title: "Badge" },
  { id: "divider", title: "Divider" },
  { id: "spinner", title: "Spinner" },
  { id: "alert", title: "Alert" },
  { id: "card", title: "Card" },
  { id: "modal", title: "Modal" },
  { id: "audio-settings", title: "AudioSettings" },
];

const modalOpen = ref(false);
const selectValue = ref("");
const inputValue = ref("");
const textareaValue = ref("");
const checkboxValue = ref(false);
const radioValue = ref("a");
const switchValue = ref(false);
const selectOptions = [
  { value: "", label: "— Не выбрано" },
  { value: "a", label: "Вариант A" },
  { value: "b", label: "Вариант B" },
  { value: "c", label: "Вариант C" },
];

const onAudioChange = (settings: { inputDevice: string; outputDevice: string }) => {
  console.log("Audio settings:", settings);
};
</script>

<style scoped>
.ui-kit {
  min-height: 100vh;
  background: #1a1a1a;
  color: #bab1a8;
  padding: 24px;
  padding-top: 80px;
}

.ui-kit__header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 2px solid #333;
}

.ui-kit__title {
  font-family: "Bebas Neue", sans-serif;
  font-size: 2.5rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: #bab1a8;
  margin: 0 0 8px 0;
}

.ui-kit__subtitle {
  font-size: 1rem;
  color: #888;
  margin: 0 0 16px 0;
}

.ui-kit__back {
  font-size: 14px;
  color: #2980b9;
  text-decoration: none;
}

.ui-kit__back:hover {
  text-decoration: underline;
}

.ui-kit__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 40px;
}

.ui-kit__nav-link {
  padding: 8px 16px;
  background: #2a2a2a;
  border: 2px solid #444;
  color: #bab1a8;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}

.ui-kit__nav-link:hover {
  border-color: #2980b9;
  background: #333;
}

.ui-kit__main {
  max-width: 900px;
}

.ui-kit__section {
  scroll-margin-top: 24px;
  margin-bottom: 48px;
}

.ui-kit__section-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.75rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: #bab1a8;
  margin: 0 0 8px 0;
}

.ui-kit__section-desc {
  font-size: 14px;
  color: #888;
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.ui-kit__block {
  background: #1f1f1f;
  border: 2px solid #333;
  padding: 24px;
  margin-bottom: 24px;
}

.ui-kit__block--wide {
  max-width: 100%;
}

.ui-kit__block-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #ccc;
  margin: 0 0 16px 0;
}

.ui-kit__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ui-kit__row--wrap {
  flex-wrap: wrap;
}

.ui-kit__col {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.ui-kit__label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #ccc;
  margin-bottom: 8px;
}

.ui-kit__hint {
  font-size: 14px;
  color: #888;
  margin: 0;
}
</style>
