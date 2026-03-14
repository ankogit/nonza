const app = import.meta.env.VITE_APP;
if (app === "rooms") {
  import("./rooms/app/main.ts");
} else {
  import("./meets/app/main.ts");
}
