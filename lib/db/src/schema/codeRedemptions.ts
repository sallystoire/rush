import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const codeRedemptionsTable = pgTable("code_redemptions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  codeId: integer("code_id").notNull(),
  redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
});
