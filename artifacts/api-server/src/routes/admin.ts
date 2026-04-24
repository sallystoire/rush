import { Router } from "express";
import { db, playersTable, teamsTable, boostCodesTable, codeRedemptionsTable, playerBoostsTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { requireAdmin, ADMIN_DISCORD_ID } from "../middlewares/admin";

const router = Router();

// ── Admin self-check (no x-player-id header check; just returns config) ──
router.get("/admin/config", (_req, res) => {
  res.json({ adminDiscordId: ADMIN_DISCORD_ID });
});

// ── List all teams (with members) ─────────────────────────────
router.get("/admin/teams", requireAdmin, async (_req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(asc(teamsTable.name));
  const result = await Promise.all(
    teams.map(async (t) => {
      const members = await db.select().from(playersTable).where(eq(playersTable.teamId, t.id));
      return { ...t, members };
    }),
  );
  res.json(result);
});

// ── Delete team (and clear members' teamId) ───────────────────
router.delete("/admin/teams/:teamId", requireAdmin, async (req, res) => {
  const teamId = Number(req.params.teamId);
  if (!teamId) {
    res.status(400).json({ error: "teamId invalide" });
    return;
  }
  await db.update(playersTable).set({ teamId: null }).where(eq(playersTable.teamId, teamId));
  await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
  res.json({ success: true });
});

// ── Rename a team ─────────────────────────────────────────────
router.patch("/admin/teams/:teamId/rename", requireAdmin, async (req, res) => {
  const teamId = Number(req.params.teamId);
  const body = req.body as { name?: string };
  const name = (body.name ?? "").trim();
  if (!teamId || !name) {
    res.status(400).json({ error: "teamId et name requis" });
    return;
  }
  const existing = await db.select().from(teamsTable).where(eq(teamsTable.name, name)).limit(1);
  if (existing.length > 0 && existing[0].id !== teamId) {
    res.status(409).json({ error: "Ce nom de team est déjà pris" });
    return;
  }
  const [updated] = await db.update(teamsTable).set({ name }).where(eq(teamsTable.id, teamId)).returning();
  res.json(updated);
});

// ── List all players ──────────────────────────────────────────
router.get("/admin/players", requireAdmin, async (_req, res) => {
  const players = await db.select().from(playersTable).orderBy(asc(playersTable.username));
  res.json(players);
});

// ── Ban / unban a player ──────────────────────────────────────
router.post("/admin/players/:playerId/ban", requireAdmin, async (req, res) => {
  const playerId = Number(req.params.playerId);
  if (!playerId) {
    res.status(400).json({ error: "playerId invalide" });
    return;
  }
  const [updated] = await db.update(playersTable).set({ banned: true }).where(eq(playersTable.id, playerId)).returning();
  if (!updated) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  res.json(updated);
});

router.post("/admin/players/:playerId/unban", requireAdmin, async (req, res) => {
  const playerId = Number(req.params.playerId);
  if (!playerId) {
    res.status(400).json({ error: "playerId invalide" });
    return;
  }
  const [updated] = await db.update(playersTable).set({ banned: false }).where(eq(playersTable.id, playerId)).returning();
  if (!updated) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  res.json(updated);
});

// ── List all boost codes (with redemption count) ─────────────
router.get("/admin/codes", requireAdmin, async (_req, res) => {
  const codes = await db.select().from(boostCodesTable).orderBy(asc(boostCodesTable.code));
  const codesWithCount = await Promise.all(
    codes.map(async (c) => {
      const [{ count }] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(codeRedemptionsTable)
        .where(eq(codeRedemptionsTable.codeId, c.id));
      return { ...c, redemptionCount: count ?? 0 };
    }),
  );
  res.json(codesWithCount);
});

// ── Delete a boost code (also wipes redemptions/granted boosts) ──
router.delete("/admin/codes/:codeId", requireAdmin, async (req, res) => {
  const codeId = Number(req.params.codeId);
  if (!codeId) {
    res.status(400).json({ error: "codeId invalide" });
    return;
  }
  await db.delete(playerBoostsTable).where(eq(playerBoostsTable.codeId, codeId));
  await db.delete(codeRedemptionsTable).where(eq(codeRedemptionsTable.codeId, codeId));
  await db.delete(boostCodesTable).where(eq(boostCodesTable.id, codeId));
  res.json({ success: true });
});

export default router;
