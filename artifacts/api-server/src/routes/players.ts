import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreatePlayerBody, GetPlayerParams, UpdatePlayerProgressParams, UpdatePlayerProgressBody, GetPlayerBoostsParams } from "@workspace/api-zod";
import { playerBoostsTable } from "@workspace/db";

const router = Router();

interface DiscordUserResponse {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

async function fetchDiscordUser(accessToken: string): Promise<DiscordUserResponse | null> {
  try {
    const r = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    return (await r.json()) as DiscordUserResponse;
  } catch {
    return null;
  }
}

router.post("/players", async (req, res) => {
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, avatarUrl, color, discordAccessToken } = parsed.data;

  // If a Discord access token was provided, verify it server-side and capture
  // the snowflake ID so we can store it on the player record. This is the
  // ONLY way the server trusts a Discord identity (and gates admin access).
  let verifiedDiscordId: string | null = null;
  if (discordAccessToken) {
    const discordUser = await fetchDiscordUser(discordAccessToken);
    if (discordUser?.id) {
      verifiedDiscordId = discordUser.id;
    }
  }

  // Prefer match by Discord snowflake (stable identity); fall back to username.
  let existing: typeof playersTable.$inferSelect | undefined;
  if (verifiedDiscordId) {
    [existing] = await db.select().from(playersTable).where(eq(playersTable.discordId, verifiedDiscordId)).limit(1);
  }
  if (!existing) {
    [existing] = await db.select().from(playersTable).where(eq(playersTable.username, username)).limit(1);
  }

  if (existing) {
    // Backfill Discord ID on first authenticated visit so existing players
    // can become admin without losing their progress.
    if (verifiedDiscordId && !existing.discordId) {
      const [updated] = await db.update(playersTable)
        .set({ discordId: verifiedDiscordId })
        .where(eq(playersTable.id, existing.id))
        .returning();
      res.json(updated);
      return;
    }
    res.json(existing);
    return;
  }

  const [player] = await db.insert(playersTable).values({
    username,
    avatarUrl: avatarUrl || null,
    color: color || "#FF5733",
    discordId: verifiedDiscordId,
  }).returning();

  res.json(player);
});

router.get("/players/:playerId", async (req, res) => {
  const parsed = GetPlayerParams.safeParse({ playerId: Number(req.params.playerId) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, parsed.data.playerId)).limit(1);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.json(player);
});

router.put("/players/:playerId/progress", async (req, res) => {
  const paramsParsed = UpdatePlayerProgressParams.safeParse({ playerId: Number(req.params.playerId) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }

  const bodyParsed = UpdatePlayerProgressBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const { playerId } = paramsParsed.data;
  const { level, bestTime } = bodyParsed.data;

  const [existing] = await db.select().from(playersTable).where(eq(playersTable.id, playerId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  // Admins (and code-skip flows) may go down a level too — accept any level
  // change when it differs, but keep "best progress wins" for ordinary play.
  if (level !== existing.level) {
    updateData.level = level;
  }
  if (bestTime !== undefined && (existing.bestTime === null || bestTime < existing.bestTime)) {
    updateData.bestTime = bestTime;
  }

  if (Object.keys(updateData).length > 0) {
    const [updated] = await db.update(playersTable).set(updateData).where(eq(playersTable.id, playerId)).returning();
    res.json(updated);
    return;
  }

  res.json(existing);
});

router.get("/players/:playerId/boosts", async (req, res) => {
  const parsed = GetPlayerBoostsParams.safeParse({ playerId: Number(req.params.playerId) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const boosts = await db.select().from(playerBoostsTable)
    .where(eq(playerBoostsTable.playerId, parsed.data.playerId));

  res.json(boosts);
});

export default router;
