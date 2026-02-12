import http from "node:http";
import express from "express";
import cors from "cors";
import colyseus from "colyseus";
const { Server, Room, matchMaker } = colyseus;
import { createInitialState, applyMove, listLegalMoves, loadConfig } from "./rules.mjs";

const PORT = Number(process.env.PORT ?? 2567);
const ACTIVE_CODES = new Set();
const PRIVATE_CODES = new Map();

class GameRoom extends Room {
  maxClients = 20;
  config;
  stateData;
  playerByClient = new Map();
  reservedPlayerIds = new Set();
  maxPlayers = 2;
  seatsLocked = false;
  gameStarted = false;
  readyByPlayer = new Set();
  rematchVotes = new Set();
  roomCode = "";
  isPrivate = false;
  ownerId;
  rematchTimer;
  sandboxName;
  isSandbox = false;

  updateMetadata() {
    const active = new Set();
    for (const client of this.clients) {
      const playerId = this.playerByClient.get(client.sessionId);
      if (playerId) active.add(playerId);
    }
    const reserved = new Set(this.reservedPlayerIds);
    const total = new Set([...active, ...reserved]);
    this.setMetadata({
      players: total.size,
      maxPlayers: this.maxPlayers,
      open: !this.seatsLocked && total.size < this.maxPlayers,
      started: this.gameStarted,
      ready: this.readyByPlayer.size,
      public: !this.isPrivate,
      code: this.isPrivate ? undefined : this.roomCode,
      sandbox: this.isSandbox || undefined,
      sandboxName: this.sandboxName
    });
  }

  onCreate(options = {}) {
    this.isPrivate = Boolean(options?.private);
    this.roomCode = generateRoomCode().toLowerCase();
    ACTIVE_CODES.add(this.roomCode);
    if (this.isPrivate) {
      PRIVATE_CODES.set(this.roomCode, this.roomId);
    }
    const rawSandboxName = typeof options?.sandboxName === "string" ? options.sandboxName : "";
    const trimmedSandboxName = rawSandboxName.trim().slice(0, 30);
    if (trimmedSandboxName) {
      this.sandboxName = trimmedSandboxName;
    }
    const customConfig = normalizeCustomConfig(options?.config);
    if (customConfig) {
      this.config = customConfig;
      this.isSandbox = true;
    } else {
      this.config = loadConfig();
      this.isSandbox = false;
    }
    this.stateData = createInitialState(this.config);
    this.maxPlayers = this.config.players.length;
    this.updateMetadata();

    this.onMessage("move", (client, move) => {
      const playerId = this.playerByClient.get(client.sessionId);
      if (!playerId) return;
      if (!this.gameStarted) return;
      if (this.stateData.winnerId) return;
      if (move.playerId !== playerId) return;

      try {
        this.stateData = applyMove(this.stateData, move, this.config);
        if (!this.seatsLocked) this.seatsLocked = true;
        this.broadcast("state", this.stateData);
        if (this.stateData.winnerId) {
          this.scheduleRematchTimeout();
        }
      } catch {
        client.send("error", { message: "Illegal move." });
      }
    });

    this.onMessage("request_legal_moves", (client) => {
      const playerId = this.playerByClient.get(client.sessionId);
      if (!playerId) return;
      if (this.stateData.activePlayerId !== playerId) return;
      const moves = listLegalMoves(this.stateData, this.config);
      client.send("legal_moves", moves);
    });

    this.onMessage("set_name", (client, payload) => {
      if (this.seatsLocked) return;
      const playerId = this.playerByClient.get(client.sessionId);
      if (!playerId) return;
      const rawName = typeof payload === "string" ? payload : payload?.name;
      if (typeof rawName !== "string") return;
      const name = rawName.trim().slice(0, 30);
      if (!name) return;
      const player = this.config.players.find((p) => p.id === playerId);
      if (!player) return;
      if (player.name === name) return;
      player.name = name;
      this.broadcast("config", this.config);
    });

    this.onMessage("config_update", (client, payload) => {
      if (this.gameStarted) return;
      if (!this.isPrivate) return;
      const playerId = this.playerByClient.get(client.sessionId);
      if (!playerId) return;
      const configPayload = payload?.config ?? payload;
      const nextConfig = normalizeCustomConfig(configPayload);
      if (!nextConfig) {
        client.send("error", { message: "Invalid card configuration." });
        return;
      }
      this.config = nextConfig;
      this.stateData = createInitialState(this.config, Date.now());
      this.maxPlayers = this.config.players.length;
      this.readyByPlayer.clear();
      this.isSandbox = true;
      const rawSandboxName = typeof payload?.sandboxName === "string" ? payload.sandboxName : "";
      const trimmedSandboxName = rawSandboxName.trim().slice(0, 30);
      if (trimmedSandboxName) {
        this.sandboxName = trimmedSandboxName;
      }
      this.broadcast("config", this.config);
      this.broadcast("state", this.stateData);
      this.broadcastReadyState();
    });

    this.onMessage("rematch_request", (client) => {
      if (!this.stateData.winnerId) return;
      const playerId = this.playerByClient.get(client.sessionId);
      if (!playerId) return;
      this.rematchVotes.add(playerId);
      const name = this.config.players.find((p) => p.id === playerId)?.name ?? "Player";
      this.broadcast("rematch_pending", { playerId, name }, { except: client });
      if (this.rematchVotes.size >= this.maxPlayers) {
        this.rematchVotes.clear();
        this.clearRematchTimer();
        this.stateData = createInitialState(this.config, Date.now());
        this.broadcast("state", this.stateData);
        this.broadcast("rematch_start", {});
      }
    });

    this.onMessage("rematch_cancel", (client) => {
      if (!this.rematchVotes.size) return;
      this.rematchVotes.clear();
      this.broadcast("rematch_cancelled", { reason: "cancelled" }, { except: client });
      if (this.stateData.winnerId) {
        this.clearRematchTimer();
        this.disconnect();
      }
    });

    this.onMessage("ready", (client, payload) => {
      if (this.gameStarted) return;
      const playerId = this.playerByClient.get(client.sessionId);
      if (!playerId) return;
      const ready = Boolean(payload?.ready);
      if (ready) {
        this.readyByPlayer.add(playerId);
      } else {
        this.readyByPlayer.delete(playerId);
      }
      this.broadcastReadyState();
      this.maybeStartGame();
    });
  }

  onDispose() {
    if (this.roomCode) {
      ACTIVE_CODES.delete(this.roomCode);
      if (this.isPrivate && PRIVATE_CODES.get(this.roomCode) === this.roomId) {
        PRIVATE_CODES.delete(this.roomCode);
      }
    }
  }

  onJoin(client, options = {}) {
    let assigned = this.playerByClient.get(client.sessionId);
    const wantsSpectate = Boolean(options?.spectator);
    const isReconnect = Boolean(options?.reconnectionToken);
    const rawName = typeof options?.name === "string" ? options.name : "";
    const requestedName = rawName.trim().slice(0, 30);
    const requestedKey = requestedName.toLowerCase();
    if (wantsSpectate && !this.gameStarted) {
      client.send("error", { message: "Spectator mode opens once the match starts." });
      client.leave(4000);
      return;
    }
    if (!assigned && !wantsSpectate) {
      if (this.seatsLocked) {
        if (requestedKey) {
          const active = new Set(this.playerByClient.values());
          const candidate = this.config.players.find(
            (p) => p.name.trim().toLowerCase() === requestedKey
          );
          if (candidate && !active.has(candidate.id)) {
            assigned = candidate.id;
            this.playerByClient.set(client.sessionId, assigned);
            this.reservedPlayerIds.delete(assigned);
          }
        }
      } else {
        const taken = new Set(this.playerByClient.values());
        for (const reserved of this.reservedPlayerIds) taken.add(reserved);
        const available = this.config.players.find((p) => !taken.has(p.id));
        if (available) {
          assigned = available.id;
          this.playerByClient.set(client.sessionId, assigned);
          this.reservedPlayerIds.delete(assigned);
        }
      }
    }

    if (!this.ownerId && assigned) {
      this.ownerId = assigned;
    }

    if (assigned && !this.seatsLocked) {
      if (requestedName) {
        const player = this.config.players.find((p) => p.id === assigned);
        if (player && player.name !== requestedName) {
          player.name = requestedName;
        }
      }
    }

    client.send("player", { playerId: assigned, spectator: !assigned });
    const showCode = !this.isPrivate || assigned === this.ownerId;
    client.send("room_info", {
      roomId: this.roomId,
      code: showCode ? this.roomCode : undefined,
      private: this.isPrivate,
      started: this.gameStarted
    });
    client.send("config", this.config);
    client.send("state", this.stateData);
    client.send("ready_state", {
      ready: Array.from(this.readyByPlayer),
      started: this.gameStarted
    });
    this.updateMetadata();

    if (assigned && !isReconnect) {
      this.broadcast("config", this.config, { except: client });
    }

    if (!isReconnect) {
      if (assigned) {
        const name = this.config.players.find((p) => p.id === assigned)?.name ?? "Player";
        this.broadcast("player_joined", { playerId: assigned, name }, { except: client });
      } else {
        this.broadcast("spectator_joined", { name: "Spectator" }, { except: client });
      }
    }
  }

  async onLeave(client, consented) {
    const playerId = this.playerByClient.get(client.sessionId);
    if (!playerId) {
      this.updateMetadata();
      return;
    }
    if (!this.gameStarted) {
      this.readyByPlayer.delete(playerId);
      this.broadcastReadyState();
    }
    if (this.stateData.winnerId && this.rematchVotes.size) {
      this.rematchVotes.clear();
      this.broadcast("rematch_cancelled", { reason: "left" }, { except: client });
      this.clearRematchTimer();
      this.disconnect();
      return;
    }
    if (this.stateData.winnerId) {
      this.clearRematchTimer();
      this.disconnect();
      return;
    }
    if (this.seatsLocked) {
      this.reservedPlayerIds.add(playerId);
      this.updateMetadata();
      try {
        await this.allowReconnection(client, 300);
        this.reservedPlayerIds.delete(playerId);
        this.updateMetadata();
      } catch {
        const name = this.config.players.find((p) => p.id === playerId)?.name ?? "Player";
        this.broadcast("player_left", { playerId, name });
        this.updateMetadata();
      }
      return;
    }

    if (consented) {
      this.playerByClient.delete(client.sessionId);
      const name = this.config.players.find((p) => p.id === playerId)?.name ?? "Player";
      this.broadcast("player_left", { playerId, name });
      this.updateMetadata();
      return;
    }

    this.reservedPlayerIds.add(playerId);
    this.updateMetadata();
    try {
      await this.allowReconnection(client, 60);
      this.reservedPlayerIds.delete(playerId);
      this.updateMetadata();
    } catch {
      this.reservedPlayerIds.delete(playerId);
      this.playerByClient.delete(client.sessionId);
      const name = this.config.players.find((p) => p.id === playerId)?.name ?? "Player";
      this.broadcast("player_left", { playerId, name });
      this.updateMetadata();
    }
  }

  broadcastReadyState() {
    this.broadcast("ready_state", {
      ready: Array.from(this.readyByPlayer),
      started: this.gameStarted
    });
    this.updateMetadata();
  }

  maybeStartGame() {
    if (this.gameStarted) return;
    const active = new Set(this.playerByClient.values());
    if (active.size < this.maxPlayers) return;
    if (this.readyByPlayer.size < this.maxPlayers) return;
    this.gameStarted = true;
    this.seatsLocked = true;
    this.broadcastReadyState();
    this.broadcast("game_start", {});
  }

  scheduleRematchTimeout() {
    this.clearRematchTimer();
    this.rematchTimer = setTimeout(() => {
      this.rematchVotes.clear();
      this.broadcast("rematch_cancelled", { reason: "timeout" });
      this.disconnect();
    }, 120000);
  }

  clearRematchTimer() {
    if (this.rematchTimer) {
      clearTimeout(this.rematchTimer);
      this.rematchTimer = undefined;
    }
  }
}

const ROOM_WORDS_6 = [
  "sakura",
  "temple",
  "garden",
  "shadow",
  "blossm",
  "harmony",
  "lantern",
  "orchid",
  "cobalt",
  "onyxie",
  "zephyr",
  "voyage",
  "summit",
  "monarch",
  "serene",
  "glimmer",
  "cinder",
  "jasmine",
  "redwood",
  "saffrn",
  "aurora",
  "solstc",
  "verdnt",
  "tundra",
  "glacir",
  "sunris",
  "marner",
  "crystl",
  "citron",
  "bonfir",
  "zenith",
  "sundal",
  "sequoia",
  "vintag",
  "lullby",
  "verita",
  "whispr",
  "moonrs"
].map((word) => word.replace(/[^a-z]/g, "").slice(0, 6));

const ROOM_WORDS_3 = [
  "sun",
  "fox",
  "owl",
  "zen",
  "sky",
  "ash",
  "kai",
  "red",
  "ink",
  "gem",
  "ivy",
  "oak",
  "map",
  "fog",
  "run",
  "sea",
  "bay",
  "lot",
  "hay",
  "rim",
  "den",
  "mar",
  "sil",
  "leo",
  "rio",
  "aur",
  "glo",
  "pet",
  "daw",
  "mir",
  "san",
  "rai",
  "ame",
  "obi",
  "kim",
  "tor"
];

function generateRoomCode() {
  const useSix = Math.random() < 0.5 && ROOM_WORDS_6.length > 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = useSix
      ? ROOM_WORDS_6[Math.floor(Math.random() * ROOM_WORDS_6.length)]
      : `${ROOM_WORDS_3[Math.floor(Math.random() * ROOM_WORDS_3.length)]}${
          ROOM_WORDS_3[Math.floor(Math.random() * ROOM_WORDS_3.length)]
        }`;
    if (candidate && candidate.length === 6 && !ACTIVE_CODES.has(candidate)) {
      return candidate;
    }
  }
  let fallback = `room-${Math.random().toString(36).slice(2, 8)}`;
  while (ACTIVE_CODES.has(fallback)) {
    fallback = `room-${Math.random().toString(36).slice(2, 8)}`;
  }
  return fallback;
}

function normalizeCustomConfig(raw) {
  if (!raw || typeof raw !== "object") return null;
  try {
    const cloned = structuredClone(raw);
    createInitialState(cloned, Date.now());
    return cloned;
  } catch {
    return null;
  }
}

const app = express();
app.use(cors());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/config", (_req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch {
    res.status(500).json({ error: "Failed to load config." });
  }
});

app.get("/lobby", async (_req, res) => {
  try {
    const rooms = await matchMaker.query({ name: "onitama" });
    const publicRooms = rooms.filter((room) => room.metadata?.public !== false);
    res.json({
      rooms: publicRooms.map((room) => ({
        roomId: room.roomId,
        clients: room.clients,
        maxClients: room.maxClients,
        players: room.metadata?.players ?? 0,
        maxPlayers: room.metadata?.maxPlayers ?? 2,
        open:
          room.metadata?.open ??
          (room.metadata?.players ?? 0) < (room.metadata?.maxPlayers ?? 2),
        started: room.metadata?.started ?? false,
        ready: room.metadata?.ready ?? 0,
        code: room.metadata?.code,
        sandbox: room.metadata?.sandbox,
        sandboxName: room.metadata?.sandboxName
      }))
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch lobby." });
  }
});

app.get("/private", async (req, res) => {
  const rawCode = typeof req.query.code === "string" ? req.query.code : "";
  const code = rawCode.trim().toLowerCase();
  if (!code) {
    res.status(400).json({ error: "Missing code." });
    return;
  }
  const roomId = PRIVATE_CODES.get(code);
  if (!roomId) {
    res.status(404).json({ error: "Private room not found." });
    return;
  }
  try {
    const rooms = await matchMaker.query({ name: "onitama" });
    const room = rooms.find((entry) => entry.roomId === roomId);
    if (!room) {
      PRIVATE_CODES.delete(code);
      res.status(404).json({ error: "Private room not found." });
      return;
    }
    const players = room.metadata?.players ?? room.clients;
    const maxPlayers = room.metadata?.maxPlayers ?? room.maxClients ?? 2;
    const open =
      room.metadata?.open ??
      (room.metadata?.players ?? players) < (room.metadata?.maxPlayers ?? maxPlayers);
    if (!open) {
      res.status(409).json({ error: "Room is full." });
      return;
    }
    res.json({
      roomId,
      open,
      players,
      maxPlayers,
      started: room.metadata?.started ?? false
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch private room." });
  }
});

const server = http.createServer(app);
const gameServer = new Server({ server });

gameServer.define("onitama", GameRoom);

gameServer.listen(PORT);
console.log(`Game server listening on ws/http://localhost:${PORT}`);
