import { registerPwa } from "./shared/lib/registerPwa";
import { setBootProgress } from "./shared/lib/bootSplash";

async function boot() {
  setBootProgress(32, "Инициализация");
  registerPwa();
  setBootProgress(42, "Модули");

  const app = import.meta.env.VITE_APP;
  if (app === "rooms") {
    setBootProgress(52, "Комнаты");
    await import("./rooms/app/main.ts");
  } else {
    setBootProgress(52, "Виджет");
    await import("./meets/app/main.ts");
  }
}

void boot();
