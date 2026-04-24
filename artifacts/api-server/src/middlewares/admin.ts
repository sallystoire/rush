import type { Request, Response, NextFunction } from "express";
import { db, playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const ADMIN_DISCORD_ID =
  process.env["ADMIN_DISCORD_ID"] ?? "989611084073799731";

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

  if (!player.discordId || player.discordId !== ADMIN_DISCORD_ID) {
    res.status(403).json({ error: "Accès admin refusé" });
    return;
  }

  req.adminPlayerId = player.id;
  next();
}

export function isAdminDiscordId(discordId: string | null | undefined): boolean {
  return !!discordId && discordId === ADMIN_DISCORD_ID;
}
