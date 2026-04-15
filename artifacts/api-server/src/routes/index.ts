import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import teamsRouter from "./teams";
import leaderboardRouter from "./leaderboard";
import codesRouter from "./codes";
import gameRouter from "./game";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(teamsRouter);
router.use(leaderboardRouter);
router.use(codesRouter);
router.use(gameRouter);

export default router;
