import { Router } from "express";
import { db } from "@workspace/db";
import { gameSessionsTable, playersTable, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { StartGameBody, CompleteLevelParams, CompleteLevelBody } from "@workspace/api-zod";

const router = Router();

// ── In-memory team death events ───────────────────────────────
// teamId → { playerId, timestamp }
const teamDeaths = new Map<number, { playerId: number; timestamp: number }>();

// ── In-memory team advance events ─────────────────────────────
// teamId → { playerId, level, parcours, timestamp }
const teamAdvances = new Map<number, { playerId: number; level: number; parcours: number; timestamp: number }>();

// ── In-memory team positions ───────────────────────────────────
// teamId → Map<playerId, { x, y, color, level, parcours, facingRight, timestamp }>
interface PlayerPosition { x: number; y: number; color: string; level: number; parcours: number; facingRight: boolean; timestamp: number; }
const teamPositions = new Map<number, Map<number, PlayerPosition>>();

router.post("/game/start", async (req, res) => {
  const parsed = StartGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { playerId, mode, teamId } = parsed.data;

  // Team mode always starts at level 1 so all players are on the same map
  let startLevel = 1;
  if (mode !== "team") {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId)).limit(1);
    startLevel = player?.level ?? 1;
  }

  // Reset any previous advance state so everyone starts fresh from level 1 parcours 1
  if (mode === "team" && teamId) {
    teamAdvances.delete(teamId);
  }

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

// ── Team position sync ────────────────────────────────────────
// POST /game/team-position  { teamId, playerId, x, y, color, level, parcours, facingRight }
router.post("/game/team-position", (req, res) => {
  const { teamId, playerId, x, y, color, level, parcours, facingRight } = req.body as {
    teamId: number; playerId: number; x: number; y: number;
    color: string; level: number; parcours: number; facingRight: boolean;
  };
  if (!teamId || !playerId) { res.status(400).json({ error: "teamId and playerId required" }); return; }
  if (!teamPositions.has(teamId)) teamPositions.set(teamId, new Map());
  teamPositions.get(teamId)!.set(playerId, { x, y, color, level, parcours, facingRight, timestamp: Date.now() });
  res.json({ ok: true });
});

// GET /game/team-positions/:teamId?playerId=<self>
// Returns all teammates' positions (excludes self, removes stale > 8s)
router.get("/game/team-positions/:teamId", (req, res) => {
  const teamId = Number(req.params.teamId);
  const selfId = Number(req.query.playerId ?? 0);
  const now = Date.now();
  const map = teamPositions.get(teamId);
  if (!map) { res.json([]); return; }
  const result: Array<PlayerPosition & { playerId: number }> = [];
  for (const [pid, pos] of map.entries()) {
    if (pid === selfId) continue;
    if (now - pos.timestamp > 8000) { map.delete(pid); continue; } // stale — remove
    result.push({ playerId: pid, ...pos });
  }
  res.json(result);
});

// ── Team advance notification ─────────────────────────────────
// POST /game/team-advance  { teamId, playerId, level, parcours }
router.post("/game/team-advance", (req, res) => {
  const { teamId, playerId, level, parcours } = req.body as { teamId: number; playerId: number; level: number; parcours: number };
  if (!teamId || !playerId || !level || !parcours) {
    res.status(400).json({ error: "teamId, playerId, level and parcours required" });
    return;
  }
  const existing = teamAdvances.get(teamId);
  // Only record if this is an equal or more advanced position (newest timestamp wins ties)
  if (!existing || level > existing.level || (level === existing.level && parcours >= existing.parcours)) {
    teamAdvances.set(teamId, { playerId, level, parcours, timestamp: Date.now() });
  }
  res.json({ ok: true });
});

// GET /game/team-advance/:teamId?since=<timestamp>
router.get("/game/team-advance/:teamId", (req, res) => {
  const teamId = Number(req.params.teamId);
  const since = Number(req.query.since ?? 0);
  const advance = teamAdvances.get(teamId);
  if (advance && advance.timestamp > since) {
    res.json({ advanced: true, level: advance.level, parcours: advance.parcours, playerId: advance.playerId, timestamp: advance.timestamp });
  } else {
    res.json({ advanced: false });
  }
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
