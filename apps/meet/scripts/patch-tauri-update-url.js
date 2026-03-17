import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, "..");
let baseUrl = "http://127.0.0.1:8000";
const envVars = {};

function run() {
  try {
    try {
      const envPath = join(root, ".env");
      const env = readFileSync(envPath, "utf8");
      for (const line of env.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i <= 0) continue;
        const key = t.slice(0, i).trim();
        let value = t.slice(i + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        envVars[key] = value;
      }
      const url = envVars.TAURI_UPDATE_BASE_URL || envVars.VITE_API_BASE_URL;
      if (url) baseUrl = url.replace(/\/$/, "");
    } catch {
      // .env missing or unreadable — use default
    }
    const envUrl = process.env.TAURI_UPDATE_BASE_URL || process.env.VITE_API_BASE_URL;
    if (envUrl) baseUrl = String(envUrl).replace(/\/$/, "");

    const configPath = join(root, "src-tauri", "tauri.conf.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    const endpointPath = "/api/v1/desktop-update/{{target}}/{{arch}}/{{current_version}}";
    config.plugins.updater.endpoints = [baseUrl + endpointPath];
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

    if (!envVars.TAURI_SIGNING_PRIVATE_KEY && envVars.TAURI_SIGNING_PRIVATE_KEY_PATH) {
      const home = process.env.HOME || process.env.USERPROFILE || "";
      const rawPath = envVars.TAURI_SIGNING_PRIVATE_KEY_PATH.replace(/^~/, home);
      const keyPath = rawPath.startsWith("/") || /^[A-Za-z]:[/\\]/.test(rawPath) ? rawPath : join(root, rawPath);
      try {
        envVars.TAURI_SIGNING_PRIVATE_KEY = readFileSync(keyPath, "utf8");
      } catch {}
    }

    const buildEnv = { ...process.env, ...envVars };
    const useShell = process.platform === "win32";
    const result = spawnSync("npx", ["tauri", "build"], {
      stdio: "inherit",
      env: buildEnv,
      cwd: root,
      shell: useShell,
    });
    if (result.error) {
      console.error(result.error);
      process.exit(1);
    }
    process.exit(result.status ?? 1);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
