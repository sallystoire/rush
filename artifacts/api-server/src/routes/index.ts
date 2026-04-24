import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import teamsRouter from "./teams";
import teamLobbyRouter from "./team-lobby";
import leaderboardRouter from "./leaderboard";
import codesRouter from "./codes";
import gameRouter from "./game";
import discordRouter from "./discord";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(teamsRouter);
router.use(teamLobbyRouter);
router.use(leaderboardRouter);
router.use(codesRouter);
router.use(gameRouter);
router.use(discordRouter);
router.use(adminRouter);

export default router;
