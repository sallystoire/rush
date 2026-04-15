import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const boostCodesTable = pgTable("boost_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  boostType: text("boost_type").notNull(),
  value: integer("value").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBoostCodeSchema = createInsertSchema(boostCodesTable).omit({ id: true, createdAt: true });
export type InsertBoostCode = z.infer<typeof insertBoostCodeSchema>;
export type BoostCode = typeof boostCodesTable.$inferSelect;
