import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import propertiesRouter from "./properties";
import phasesRouter from "./phases";
import tasksRouter from "./tasks";
import costItemsRouter from "./cost_items";
import scenarioConfigsRouter from "./scenario_configs";
import financialsRouter from "./financials";
import dashboardRouter from "./dashboard";
import intelligenceRouter from "./intelligence";
import decisionsRouter from "./decisions";
import optimisationRouter from "./optimisation";
import costOptimisationRulesRouter from "./cost_optimisation_rules";
import complianceRouter from "./compliance";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(propertiesRouter);
router.use(phasesRouter);
router.use(tasksRouter);
router.use(costItemsRouter);
router.use(scenarioConfigsRouter);
router.use(financialsRouter);
router.use(dashboardRouter);
router.use(intelligenceRouter);
router.use(decisionsRouter);
router.use(optimisationRouter);
router.use(costOptimisationRulesRouter);
router.use(complianceRouter);
router.use(aiRouter);

export default router;
