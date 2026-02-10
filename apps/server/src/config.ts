import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateConfig } from "@game/rules";
import type { GameConfig } from "@game/rules";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadConfig(): GameConfig {
  const overridePath = process.env.GAME_CONFIG_PATH;
  const configPath = overridePath
    ? path.resolve(overridePath)
    : path.resolve(__dirname, "../config/game.json");

  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  return validateConfig(parsed);
}
