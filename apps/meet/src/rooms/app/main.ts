import { createApp } from "vue";
import { createPinia } from "pinia";
import { setLogLevel, LogLevel } from "livekit-client";
import App from "./App.vue";
import "@shared/styles/main.css";
import { setupExternalLinks } from "@shared/lib";

setLogLevel(LogLevel.warn);
setupExternalLinks();

const app = createApp(App);
app.use(createPinia());
const el = document.getElementById("app");
if (el) el.classList.add("app-rooms");
app.mount("#app");
