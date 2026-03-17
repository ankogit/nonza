import { createApp } from "vue";
import { createPinia } from "pinia";
import { setLogLevel, LogLevel } from "livekit-client";
import App from "./App.vue";
import "@shared/styles/main.css";

setLogLevel(LogLevel.warn);

const app = createApp(App);
app.use(createPinia());
const el = document.getElementById("app");
if (el) el.classList.add("app-rooms");
app.mount("#app");
