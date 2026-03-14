import { createApp } from "vue";
import { setLogLevel, LogLevel } from "livekit-client";
import App from "./App.vue";
import "@shared/styles/main.css";

setLogLevel(LogLevel.warn);

const app = createApp(App);
app.mount("#app");
