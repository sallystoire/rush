import { Router } from "express";
import { db } from "@workspace/db";
import { gameSessionsTable, playersTable, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { StartGameBody, CompleteLevelParams, CompleteLevelBody } from "@workspace/api-zod";

const router = Router();

// ── In-memory team death events ───────────────────────────────
// teamId → { playerId, timestamp }
const teamDeaths = new Map<number, { playerId: number; timestamp: number }>();

router.post("/game/start", async (req, res) => {
  const parsed = StartGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { playerId, mode, teamId } = parsed.data;

  // Resume at the player's current level (so progress persists across sessions)
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId)).limit(1);
  const startLevel = (player?.level ?? 1);

  const [session] = await db.insert(gameSessionsTable).values({
    playerId,
    mode,
    teamId: teamId || null,
    currentLevel: startLevel,
    status: "active",
  }).returning();

  res.json(session);
});

router.post("/game/:sessionId/complete", async (req, res) => {
  const paramsParsed = CompleteLevelParams.safeParse({ sessionId: Number(req.params.sessionId) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }

  const bodyParsed = CompleteLevelBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const { sessionId } = paramsParsed.data;
  const { level, time } = bodyParsed.data;

  const [session] = await db.select().from(gameSessionsTable).where(eq(gameSessionsTable.id, sessionId)).limit(1);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const nextLevel = level + 1;
  const newStatus = level >= 100 ? "completed" : "active";

  const [updated] = await db.update(gameSessionsTable)
    .set({ currentLevel: nextLevel, status: newStatus })
    .where(eq(gameSessionsTable.id, sessionId))
    .returning();

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, session.playerId)).limit(1);
  if (player) {
    const updateData: Record<string, unknown> = {};
    if (nextLevel > (player.level || 1)) {
      updateData.level = nextLevel;
    }
    if (player.bestTime === null || time < player.bestTime) {
      updateData.bestTime = time;
    }
    if (Object.keys(updateData).length > 0) {
      await db.update(playersTable).set(updateData).where(eq(playersTable.id, player.id));
    }
  }

  if (session.mode === "team" && session.teamId) {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, session.teamId)).limit(1);
    if (team) {
      const teamUpdate: Record<string, unknown> = {};
      if (nextLevel > (team.level || 1)) {
        teamUpdate.level = nextLevel;
      }
      if (team.bestTime === null || time < team.bestTime) {
        teamUpdate.bestTime = time;
      }
      if (Object.keys(teamUpdate).length > 0) {
        await db.update(teamsTable).set(teamUpdate).where(eq(teamsTable.id, team.id));
      }
    }
  }

  res.json(updated);
});

// ── Team death notification ───────────────────────────────────
// POST /game/team-death  { teamId, playerId }
router.post("/game/team-death", (req, res) => {
  const { teamId, playerId } = req.body as { teamId: number; playerId: number };
  if (!teamId || !playerId) {
    res.status(400).json({ error: "teamId and playerId required" });
    return;
  }
  teamDeaths.set(teamId, { playerId, timestamp: Date.now() });
  res.json({ ok: true });
});

// GET /game/team-state/:teamId?since=<timestamp>
// Returns whether a death happened after the given timestamp
router.get("/game/team-state/:teamId", (req, res) => {
  const teamId = Number(req.params.teamId);
  const since = Number(req.query.since ?? 0);
  const death = teamDeaths.get(teamId);
  if (death && death.timestamp > since) {
    res.json({ died: true, playerId: death.playerId, timestamp: death.timestamp });
  } else {
    res.json({ died: false });
  }
});

export default router;
