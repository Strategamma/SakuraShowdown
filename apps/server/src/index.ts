import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom";
import { loadConfig } from "./config";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.use(cors());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/config", (_req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: "Failed to load config." });
  }
});

const server = http.createServer(app);
const gameServer = new Server({ server });

gameServer.define("onitama", GameRoom);

gameServer.listen(PORT);
console.log(`Game server listening on ws/http://localhost:${PORT}`);
