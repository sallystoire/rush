import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, teamsTable } from "@workspace/db";
import { desc, asc } from "drizzle-orm";
import { GetIndividualLeaderboardQueryParams, GetTeamLeaderboardQueryParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/leaderboard/individual", async (req, res) => {
  const parsed = GetIndividualLeaderboardQueryParams.safeParse(req.query);
  const sortBy = parsed.success ? parsed.data.sortBy : "level";

  let query = db.select().from(playersTable);

  if (sortBy === "time") {
    query = query.orderBy(asc(playersTable.bestTime)) as typeof query;
  } else {
    query = query.orderBy(desc(playersTable.level)) as typeof query;
  }

  const players = await query.limit(50);

  const leaderboard = players.map((p, i) => ({
    rank: i + 1,
    playerId: p.id,
    username: p.username,
    level: p.level,
    bestTime: p.bestTime,
    color: p.color,
  }));

  res.json(leaderboard);
});

router.get("/leaderboard/teams", async (req, res) => {
  const parsed = GetTeamLeaderboardQueryParams.safeParse(req.query);
  const sortBy = parsed.success ? parsed.data.sortBy : "level";

  let query = db.select().from(teamsTable);

  if (sortBy === "time") {
    query = query.orderBy(asc(teamsTable.bestTime)) as typeof query;
  } else {
    query = query.orderBy(desc(teamsTable.level)) as typeof query;
  }

  const teams = await query.limit(50);

  const leaderboard = await Promise.all(
    teams.map(async (t, i) => {
      const members = await db.select().from(playersTable).where(eq(playersTable.teamId, t.id));
      return {
        rank: i + 1,
        teamId: t.id,
        teamName: t.name,
        level: t.level,
        bestTime: t.bestTime,
        memberCount: members.length,
      };
    })
  );

  res.json(leaderboard);
});

export default router;
