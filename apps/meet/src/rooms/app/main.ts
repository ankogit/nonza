import { createApp } from "vue";
import { createPinia } from "pinia";
import { setLogLevel, LogLevel } from "livekit-client";
import App from "./App.vue";
import "@shared/styles/main.css";
import {
  setupExternalLinks,
  dismissBootSplash,
  setBootProgress,
} from "@shared/lib";

setBootProgress(68, "Стили");
setLogLevel(LogLevel.warn);
setupExternalLinks();

setBootProgress(78, "Интерфейс");
const app = createApp(App);
app.use(createPinia());
const el = document.getElementById("app");
if (el) el.classList.add("app-rooms");

setBootProgress(92, "Монтирование");
app.mount("#app");
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    dismissBootSplash();
  });
});
