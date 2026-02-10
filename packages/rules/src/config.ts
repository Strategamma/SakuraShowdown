import { z } from "zod";
import type { GameConfig } from "./types.js";

export const Vec2Schema = z.object({
  x: z.number().int(),
  y: z.number().int()
});

export const BoardConfigSchema = z.object({
  width: z.number().int().min(2),
  height: z.number().int().min(2)
});

export const PlayerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  forward: z.union([z.literal(1), z.literal(-1)]),
  temple: Vec2Schema
});

export const PieceTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tag: z.string().optional()
});

export const StartingPieceSchema = z.object({
  typeId: z.string().min(1),
  ownerId: z.string().min(1),
  x: z.number().int(),
  y: z.number().int()
});

export const CardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  moves: z.array(Vec2Schema).min(1),
  allowCapture: z.boolean().optional(),
  allowNonCapture: z.boolean().optional(),
  tags: z.array(z.string()).optional()
});

export const MechanicConfigSchema = z.object({
  id: z.string().min(1),
  params: z.record(z.unknown()).optional()
});

export const GameConfigSchema = z.object({
  board: BoardConfigSchema,
  players: z.array(PlayerConfigSchema).min(2),
  pieceTypes: z.array(PieceTypeSchema).min(1),
  startingPieces: z.array(StartingPieceSchema).min(1),
  cards: z.array(CardSchema).min(1),
  deck: z.array(z.string()).min(3),
  handSize: z.number().int().min(1),
  mechanics: z.array(MechanicConfigSchema)
});

export function validateConfig(config: unknown): GameConfig {
  return GameConfigSchema.parse(config);
}
