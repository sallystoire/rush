import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ── In-memory lobby state ─────────────────────────────────────
// teamId → { ready: Set<playerId>, countdownStart: ms timestamp | null }
interface LobbyState {
  ready: Set<number>;
  countdownStart: number | null;
  inviteTimestamp: number | null; // when the last invite was sent
  gameStartedAt: number | null;   // when the game actually started (after countdown)
}
const teamLobbies = new Map<number, LobbyState>();

const COUNTDOWN_MS = 10_000;
const GAME_STARTED_GRACE_MS = 60_000;

function getLobby(teamId: number): LobbyState {
  if (!teamLobbies.has(teamId)) {
    teamLobbies.set(teamId, { ready: new Set(), countdownStart: null, inviteTimestamp: null, gameStartedAt: null });
  }
  return teamLobbies.get(teamId)!;
}

function serializeLobby(teamId: number) {
  const lobby = getLobby(teamId);
  const now = Date.now();

  // Auto-transition: countdown elapsed -> mark game as started (one-time)
  if (lobby.countdownStart !== null && lobby.gameStartedAt === null) {
    if (now - lobby.countdownStart >= COUNTDOWN_MS) {
      lobby.gameStartedAt = now;
    }
  }

  // Auto-clear: after the grace window everyone has had time to navigate, reset
  if (lobby.gameStartedAt !== null && now - lobby.gameStartedAt > GAME_STARTED_GRACE_MS) {
    lobby.ready.clear();
    lobby.countdownStart = null;
    lobby.gameStartedAt = null;
    lobby.inviteTimestamp = null;
  }

  return {
    ready: Array.from(lobby.ready),
    countdownStart: lobby.countdownStart,
    inviteTimestamp: lobby.inviteTimestamp,
    gameStartedAt: lobby.gameStartedAt,
  };
}

// GET /teams/:teamId/lobby
router.get("/teams/:teamId/lobby", (req, res) => {
  const teamId = Number(req.params.teamId);
  res.json(serializeLobby(teamId));
});

// POST /teams/:teamId/ready  { playerId }
router.post("/teams/:teamId/ready", (req, res) => {
  const teamId = Number(req.params.teamId);
  const { playerId } = req.body as { playerId: number };
  if (!playerId) { res.status(400).json({ error: "playerId required" }); return; }

  const lobby = getLobby(teamId);
  lobby.ready.add(playerId);

  // Start countdown when >= 2 ready and countdown not already running
  if (lobby.ready.size >= 2 && lobby.countdownStart === null) {
    lobby.countdownStart = Date.now();
  }

  res.json(serializeLobby(teamId));
});

// POST /teams/:teamId/cancel-ready  { playerId }
router.post("/teams/:teamId/cancel-ready", (req, res) => {
  const teamId = Number(req.params.teamId);
  const { playerId } = req.body as { playerId: number };
  if (!playerId) { res.status(400).json({ error: "playerId required" }); return; }

  const lobby = getLobby(teamId);
  lobby.ready.delete(playerId);

  // Cancel countdown if fewer than 2 ready
  if (lobby.ready.size < 2) {
    lobby.countdownStart = null;
  }

  res.json(serializeLobby(teamId));
});

// POST /teams/:teamId/reset-lobby  { playerId }
// Called when game actually starts to clear readiness
router.post("/teams/:teamId/reset-lobby", (req, res) => {
  const teamId = Number(req.params.teamId);
  teamLobbies.set(teamId, { ready: new Set(), countdownStart: null, inviteTimestamp: null, gameStartedAt: null });
  res.json({ ok: true });
});

// POST /teams/:teamId/invite  { playerId } — sends invite notification to team
router.post("/teams/:teamId/invite", (req, res) => {
  const teamId = Number(req.params.teamId);
  const lobby = getLobby(teamId);
  lobby.inviteTimestamp = Date.now();
  res.json(serializeLobby(teamId));
});

// POST /teams/:teamId/kick  { captainId, memberId }
router.post("/teams/:teamId/kick", async (req, res) => {
  const teamId = Number(req.params.teamId);
  const { captainId, memberId } = req.body as { captainId: number; memberId: number };
  if (!captainId || !memberId) { res.status(400).json({ error: "captainId and memberId required" }); return; }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  if (team.captainId !== captainId) { res.status(403).json({ error: "Only the captain can kick members" }); return; }
  if (captainId === memberId) { res.status(400).json({ error: "Cannot kick yourself" }); return; }

  await db.update(playersTable).set({ teamId: null }).where(eq(playersTable.id, memberId));

  // Remove from lobby too
  const lobby = getLobby(teamId);
  lobby.ready.delete(memberId);

  const members = await db.select().from(playersTable).where(eq(playersTable.teamId, teamId));
  res.json({ ok: true, members });
});

// POST /teams/:teamId/transfer  { captainId, newCaptainId }
router.post("/teams/:teamId/transfer", async (req, res) => {
  const teamId = Number(req.params.teamId);
  const { captainId, newCaptainId } = req.body as { captainId: number; newCaptainId: number };
  if (!captainId || !newCaptainId) { res.status(400).json({ error: "captainId and newCaptainId required" }); return; }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  if (team.captainId !== captainId) { res.status(403).json({ error: "Only the captain can transfer ownership" }); return; }

  await db.update(teamsTable).set({ captainId: newCaptainId }).where(eq(teamsTable.id, teamId));
  const members = await db.select().from(playersTable).where(eq(playersTable.teamId, teamId));
  const updatedTeam = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  res.json({ ...updatedTeam[0], members });
});

export default router;
