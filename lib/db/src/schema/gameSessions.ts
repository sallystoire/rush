import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gameSessionsTable = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  mode: text("mode").notNull(),
  teamId: integer("team_id"),
  currentLevel: integer("current_level").notNull().default(1),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  status: text("status").notNull().default("active"),
});

export const insertGameSessionSchema = createInsertSchema(gameSessionsTable).omit({ id: true, startedAt: true });
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessionsTable.$inferSelect;
