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

export default router;
