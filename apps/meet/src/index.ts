import NonzaWidget from "./meets/app/NonzaWidget.vue";
import type { App } from "vue";

export { NonzaWidget };

export function install(app: App) {
  app.component("NonzaWidget", NonzaWidget);
}

export default {
  install,
  NonzaWidget,
};
