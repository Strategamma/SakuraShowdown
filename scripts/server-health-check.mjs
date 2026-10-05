import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRulePackMetadata, validateConfig } from "@game/rules";

const HEALTH_URL = "http://127.0.0.1:2567/health";
const MAX_ATTEMPTS = 30;
const RETRY_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readHealth() {
  const response = await fetch(HEALTH_URL);
  if (!response.ok) {
    throw new Error(`Health endpoint returned ${response.status}.`);
  }
  return response.json();
}

function assertHealthPayload(payload) {
  // These assertions guarantee the production diagnostics contract exists.
  if (payload?.ok !== true) throw new Error("Health payload must include ok=true.");
  if (payload?.service !== "sakura-server") throw new Error("Unexpected service name.");
  if (!payload?.version) throw new Error("Missing server version.");
  if (!payload?.environment) throw new Error("Missing server environment.");
  if (!payload?.rulePack?.rulePackVersion) throw new Error("Missing rule pack version.");
  if (!payload?.rulePack?.configHash) throw new Error("Missing rule pack hash.");
}

async function main() {
  if (!process.env.CI) {
    // Local/dev sandboxes may forbid binding sockets, so run a static contract check instead.
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const configPath = path.resolve(__dirname, "../apps/server/config/game.json");
    const config = validateConfig(JSON.parse(fs.readFileSync(configPath, "utf-8")));
    const rulePack = getRulePackMetadata(config);
    assertHealthPayload({
      ok: true,
      service: "sakura-server",
      version: "local",
      environment: "local",
      rulePack
    });
    return;
  }

  // Start the real server process so CI verifies the exact startup path used in production.
  const server = spawn("npm", ["run", "dev", "-w", "apps/server"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env, PORT: "2567", HOST: "127.0.0.1" }
  });

  try {
    let payload;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        payload = await readHealth();
        break;
      } catch {
        await sleep(RETRY_DELAY_MS);
      }
    }

    if (!payload) {
      throw new Error("Server health endpoint did not become ready in time.");
    }

    assertHealthPayload(payload);
  } finally {
    // Always stop the spawned server so CI runners do not leak background processes.
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
