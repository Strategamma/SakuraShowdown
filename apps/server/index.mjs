import http from "node:http";
import express from "express";
import cors from "cors";
import colyseus from "colyseus";
const { Server, Room, matchMaker } = colyseus;
import { createInitialState, applyMove, listLegalMoves, loadConfig } from "./rules.mjs";

const PORT = Number(process.env.PORT ?? 2567);

class GameRoom extends Room {
  maxClients = 20;
  config;
  stateData;
  playerByClient = new Map();
  reservedPlayerIds = new Set();
  maxPlayers = 2;
  seatsLocked = false;
  rematchVotes = new Set();
  roomCode = "";

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
      code: this.roomCode
    });
  }

  onCreate() {
    this.roomCode = generateRoomCode();
    this.config = loadConfig();
    this.stateData = createInitialState(this.config);
    this.maxPlayers = this.config.players.length;
    this.updateMetadata();

    this.onMessage("move", (client, move) => {
      const playerId = this.playerByClient.get(client.sessionId);
      if (!playerId) return;
      if (this.stateData.winnerId) return;
      if (move.playerId !== playerId) return;

      try {
        if (!this.seatsLocked) this.seatsLocked = true;
        this.stateData = applyMove(this.stateData, move, this.config);
        this.broadcast("state", this.stateData);
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

    this.onMessage("rematch_request", (client) => {
      if (!this.stateData.winnerId) return;
      const playerId = this.playerByClient.get(client.sessionId);
      if (!playerId) return;
      this.rematchVotes.add(playerId);
      const name = this.config.players.find((p) => p.id === playerId)?.name ?? "Player";
      this.broadcast("rematch_pending", { playerId, name }, { except: client });
      if (this.rematchVotes.size >= this.maxPlayers) {
        this.rematchVotes.clear();
        this.stateData = createInitialState(this.config, Date.now());
        this.broadcast("state", this.stateData);
        this.broadcast("rematch_start", {});
      }
    });

    this.onMessage("rematch_cancel", (client) => {
      if (!this.rematchVotes.size) return;
      this.rematchVotes.clear();
      this.broadcast("rematch_cancelled", { reason: "cancelled" }, { except: client });
    });
  }

  onJoin(client, options = {}) {
    let assigned = this.playerByClient.get(client.sessionId);
    const wantsSpectate = Boolean(options?.spectator);
    const isReconnect = Boolean(options?.reconnectionToken);
    if (!assigned && !wantsSpectate) {
      if (this.seatsLocked) {
        assigned = undefined;
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

    if (assigned && !this.seatsLocked) {
      const rawName = typeof options?.name === "string" ? options.name : "";
      const name = rawName.trim().slice(0, 30);
      if (name) {
        const player = this.config.players.find((p) => p.id === assigned);
        if (player) player.name = name;
      }
    }

    client.send("player", { playerId: assigned, spectator: !assigned });
    client.send("room_info", { roomId: this.roomId, code: this.roomCode });
    client.send("config", this.config);
    client.send("state", this.stateData);
    this.updateMetadata();

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
    if (this.stateData.winnerId && this.rematchVotes.size) {
      this.rematchVotes.clear();
      this.broadcast("rematch_cancelled", { reason: "left" }, { except: client });
    }
    if (this.seatsLocked) {
      this.reservedPlayerIds.add(playerId);
      this.updateMetadata();
      try {
        await this.allowReconnection(client, 300);
        this.reservedPlayerIds.delete(playerId);
        this.updateMetadata();
      } catch {
        this.updateMetadata();
      }
      return;
    }

    if (consented) {
      this.playerByClient.delete(client.sessionId);
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
      this.updateMetadata();
    }
  }
}

const ROOM_WORDS = [
  "sakura",
  "garden",
  "temple",
  "crimson",
  "embered",
  "shadow",
  "blossom",
  "misty",
  "harmony",
  "lantern",
  "cascade",
  "dawnlight",
  "silkroad",
  "rainbow",
  "meadow",
  "starlit",
  "citadel",
  "orchard",
  "harvest",
  "thunder",
  "crescent",
  "rubyred",
  "topaz",
  "cobalt",
  "ivory",
  "onyx",
  "zephyr",
  "voyage",
  "harbor",
  "summit",
  "prairie",
  "monarch",
  "valiant",
  "serene",
  "silent",
  "glimmer",
  "embers",
  "mistveil",
  "drifted",
  "feather",
  "cinder",
  "jasmine",
  "maple",
  "redwood",
  "everest",
  "morning",
  "twilight",
  "marigold",
  "onyxstone",
  "luminous",
  "saffron",
  "cascade",
  "tempest",
  "aurora",
  "solstice",
  "alloyed",
  "mezzina",
  "seaborn",
  "verdant",
  "mythic",
  "citrine",
  "orchid",
  "gravity",
  "sapphire",
  "tundra",
  "embered",
  "glacier",
  "sunrise",
  "seaglass",
  "constel",
  "opaline",
  "silvers",
  "midnight",
  "horizon",
  "seraph",
  "tangram",
  "mariner",
  "isotope",
  "crystal",
  "citron",
  "embered",
  "harvest",
  "snowfall",
  "tangelo",
  "bonfire",
  "wisteria",
  "zenith",
  "sandbar",
  "sundial",
  "sequoia",
  "vintage",
  "lullaby",
  "mariner",
  "opaline",
  "silvana",
  "veritas",
  "whisper",
  "windmill",
  "moonrise"
].filter((word) => word.length >= 6);

function generateRoomCode() {
  if (!ROOM_WORDS.length) return `room-${Math.random().toString(36).slice(2, 8)}`;
  const index = Math.floor(Math.random() * ROOM_WORDS.length);
  return ROOM_WORDS[index];
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
    res.json({
      rooms: rooms.map((room) => ({
        roomId: room.roomId,
        clients: room.clients,
        maxClients: room.maxClients,
        players: room.metadata?.players ?? 0,
        maxPlayers: room.metadata?.maxPlayers ?? 2,
        open:
          room.metadata?.open ??
          (room.metadata?.players ?? 0) < (room.metadata?.maxPlayers ?? 2),
        code: room.metadata?.code
      }))
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch lobby." });
  }
});

const server = http.createServer(app);
const gameServer = new Server({ server });

gameServer.define("onitama", GameRoom);

gameServer.listen(PORT);
console.log(`Game server listening on ws/http://localhost:${PORT}`);
