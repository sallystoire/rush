import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable } from "@workspace/db";
import { eq, ilike, desc, asc } from "drizzle-orm";
import {
  ListTeamsQueryParams,
  CreateTeamBody,
  GetTeamParams,
  UpdateTeamParams,
  UpdateTeamBody,
  JoinTeamParams,
  JoinTeamBody,
  LeaveTeamParams,
  LeaveTeamBody,
} from "@workspace/api-zod";

const router = Router();

async function getTeamWithMembers(teamId: number) {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team) return null;

  const members = await db.select().from(playersTable).where(eq(playersTable.teamId, teamId));
  return { ...team, members };
}

router.get("/teams", async (req, res) => {
  const parsed = ListTeamsQueryParams.safeParse(req.query);
  const search = parsed.success ? parsed.data.search : undefined;
  const sortBy = parsed.success ? parsed.data.sortBy : "level";

  let query = db.select().from(teamsTable);

  if (search) {
    query = query.where(ilike(teamsTable.name, `%${search}%`)) as typeof query;
  }

  if (sortBy === "level") {
    query = query.orderBy(desc(teamsTable.level)) as typeof query;
  } else {
    query = query.orderBy(asc(teamsTable.name)) as typeof query;
  }

  const teams = await query;

  const teamsWithMembers = await Promise.all(
    teams.map(async (team) => {
      const members = await db.select().from(playersTable).where(eq(playersTable.teamId, team.id));
      return { ...team, members };
    })
  );

  res.json(teamsWithMembers);
});

router.post("/teams", async (req, res) => {
  const parsed = CreateTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, captainId, maxMembers, minLevelRequired } = parsed.data;

  const [captain] = await db.select().from(playersTable).where(eq(playersTable.id, captainId)).limit(1);
  if (!captain) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  if ((captain.level || 1) < 4) {
    res.status(403).json({ error: "Tu dois etre de niveau 4 pour debloquer" });
    return;
  }

  const existing = await db.select().from(teamsTable).where(eq(teamsTable.name, name)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Ce nom de team est deja pris" });
    return;
  }

  const [team] = await db.insert(teamsTable).values({
    name,
    captainId,
    maxMembers: maxMembers || 4,
    minLevelRequired: minLevelRequired || 1,
  }).returning();

  await db.update(playersTable).set({ teamId: team.id }).where(eq(playersTable.id, captainId));

  const result = await getTeamWithMembers(team.id);
  res.json(result);
});

router.get("/teams/:teamId", async (req, res) => {
  const parsed = GetTeamParams.safeParse({ teamId: Number(req.params.teamId) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await getTeamWithMembers(parsed.data.teamId);
  if (!result) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  res.json(result);
});

router.put("/teams/:teamId", async (req, res) => {
  const paramsParsed = UpdateTeamParams.safeParse({ teamId: Number(req.params.teamId) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }

  const bodyParsed = UpdateTeamBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (bodyParsed.data.maxMembers !== undefined) updateData.maxMembers = bodyParsed.data.maxMembers;
  if (bodyParsed.data.minLevelRequired !== undefined) updateData.minLevelRequired = bodyParsed.data.minLevelRequired;

  await db.update(teamsTable).set(updateData).where(eq(teamsTable.id, paramsParsed.data.teamId));

  const result = await getTeamWithMembers(paramsParsed.data.teamId);
  res.json(result);
});

router.post("/teams/:teamId/join", async (req, res) => {
  const paramsParsed = JoinTeamParams.safeParse({ teamId: Number(req.params.teamId) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }

  const bodyParsed = JoinTeamBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const { teamId } = paramsParsed.data;
  const { playerId } = bodyParsed.data;

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId)).limit(1);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  if ((player.level || 1) < team.minLevelRequired) {
    res.status(403).json({ error: `Niveau ${team.minLevelRequired} requis pour rejoindre` });
    return;
  }

  const members = await db.select().from(playersTable).where(eq(playersTable.teamId, teamId));
  if (members.length >= team.maxMembers) {
    res.status(403).json({ error: "Team pleine" });
    return;
  }

  await db.update(playersTable).set({ teamId }).where(eq(playersTable.id, playerId));

  const result = await getTeamWithMembers(teamId);
  res.json(result);
});

router.post("/teams/:teamId/leave", async (req, res) => {
  const paramsParsed = LeaveTeamParams.safeParse({ teamId: Number(req.params.teamId) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }

  const bodyParsed = LeaveTeamBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  await db.update(playersTable).set({ teamId: null }).where(eq(playersTable.id, bodyParsed.data.playerId));

  res.json({ success: true });
});

export default router;
