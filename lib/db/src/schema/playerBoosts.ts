import { pgTable, serial, integer, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playerBoostsTable = pgTable("player_boosts", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  boostType: text("boost_type").notNull(),
  value: integer("value").notNull().default(1),
  used: boolean("used").notNull().default(false),
  codeId: integer("code_id").notNull(),
});

export const insertPlayerBoostSchema = createInsertSchema(playerBoostsTable).omit({ id: true });
export type InsertPlayerBoost = z.infer<typeof insertPlayerBoostSchema>;
export type PlayerBoost = typeof playerBoostsTable.$inferSelect;
