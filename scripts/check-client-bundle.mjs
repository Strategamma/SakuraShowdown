import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const assetDir = new URL("../apps/client/dist/assets/", import.meta.url);
const files = (await readdir(assetDir)).filter((file) => file.endsWith(".js"));
const budgets = [
  { prefix: "index-", gzipKb: 55 },
  { prefix: "network-", gzipKb: 28 },
  { prefix: "three-", gzipKb: 165 }
];

for (const budget of budgets) {
  const file = files.find((candidate) => candidate.startsWith(budget.prefix));
  if (!file) throw new Error(`Missing expected ${budget.prefix} JavaScript chunk.`);
  const gzipKb = gzipSync(await readFile(new URL(file, assetDir))).byteLength / 1024;
  if (gzipKb > budget.gzipKb) {
    throw new Error(`${file} is ${gzipKb.toFixed(1)} kB gzip; budget is ${budget.gzipKb} kB.`);
  }
}

console.log("Client JavaScript bundle budgets passed.");
