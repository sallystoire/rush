import type { Request, Response, NextFunction } from "express";
import { db, playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const ADMIN_DISCORD_ID =
  process.env["ADMIN_DISCORD_ID"] ?? "989611084073799731";

// Optional: comma-separated list of player IDs that are admins regardless of Discord ID
// e.g. ADMIN_PLAYER_IDS=1,2,3
const ADMIN_PLAYER_IDS: Set<number> = new Set(
  (process.env["ADMIN_PLAYER_IDS"] ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !isNaN(n) && n > 0),
);

export interface AdminAuthedRequest extends Request {
  adminPlayerId?: number;
}

export async function requireAdmin(
  req: AdminAuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const headerVal = req.header("x-player-id");
  const playerId = headerVal ? Number(headerVal) : NaN;
  if (!playerId || Number.isNaN(playerId)) {
    res.status(401).json({ error: "Authentication requise" });
    return;
  }

  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, playerId))
    .limit(1);

  if (!player) {
    res.status(401).json({ error: "Joueur introuvable" });
    return;
  }

  const isDiscordAdmin = !!player.discordId && player.discordId === ADMIN_DISCORD_ID;
  const isPlayerIdAdmin = ADMIN_PLAYER_IDS.has(player.id);

  if (!isDiscordAdmin && !isPlayerIdAdmin) {
    res.status(403).json({ error: "Accès admin refusé" });
    return;
  }

  req.adminPlayerId = player.id;
  next();
}

export function isAdminDiscordId(discordId: string | null | undefined): boolean {
  return !!discordId && discordId === ADMIN_DISCORD_ID;
}
