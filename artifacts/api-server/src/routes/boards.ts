// The Winchester Build Cash Board and The Winchester Money Plan, built from the live plan
// each time they are opened, for the Build Cash Board and Money Plan tabs. The pages are the
// ones published on 11 October 2026; only their figures and dates follow Launch OS.
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { buildCashModel } from "./cash-model";
import { PATIENT_MODEL, PRICES, WINC_SCENARIOS } from "../lib/cash-model-defaults";
import { monthsFrom, wincForecast } from "../lib/growth-model";
import BOARD_TEMPLATE from "../boards/board-template.html";
import ENGINE from "../boards/engine.gen.txt";
import { boardRefresh } from "../boards/board-refresh";
import { boardLines } from "../boards/board-lines";
import { embedBoard } from "../boards/board-embed";
import { makeRun } from "../boards/plan-run";
import { planData } from "../boards/plan-data";
import { renderMoneyPlan } from "../boards/money-plan";

const router = Router();

// Today in the clinic's time zone, as yyyy-mm-dd.
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// Every live plan line in an active phase, with the active property's figures where it has them.
async function planLines(projectId: number) {
  const r = await db.execute(sql`
    SELECT t.id, p.name AS phase, p.sort_order, t.title,
      coalesce(o.selected_cost, t.selected_cost) AS sel, coalesce(o.committed_cost, t.committed_cost) AS com,
      coalesce(o.actual_cost, t.actual_cost) AS act, coalesce(o.amount_paid_gbp, t.amount_paid_gbp) AS amt,
      coalesce(o.paid_status, t.paid_status) AS paid
    FROM launch_tasks t
    JOIN launch_phases p ON p.id = t.phase_id AND p.status = 'active' AND p.project_id = ${projectId}
    LEFT JOIN property_task_overrides o ON o.task_id = t.id
      AND o.property_id = (SELECT id FROM clinic_properties WHERE project_id = ${projectId} AND is_active_for_project = TRUE LIMIT 1)
    WHERE NOT t.archived
    ORDER BY p.sort_order, t.id`);
  return (r as any).rows ?? r;
}

// What each plan line is made of, for the hover on the board's line chart: the items on Abi's
// Rooms & Kit board under it, and what the card register holds against it.
async function lineDetail(projectId: number) {
  const items = await db.execute(sql`SELECT task_id, name, amount_gbp, status FROM kit_items WHERE project_id = ${projectId} AND task_id IS NOT NULL ORDER BY task_id, id`);
  const card = await db.execute(sql`SELECT e.task_id, e.date, e.description, e.amount_gbp, e.kind, c.name AS card FROM card_entries e JOIN credit_cards c ON c.id = e.card_id WHERE e.project_id = ${projectId} AND e.task_id IS NOT NULL ORDER BY e.task_id, e.date, e.id`);
  return { items: ((items as any).rows ?? items) as any[], card: ((card as any).rows ?? card) as any[] };
}

const page = (res: any, html: string) => { res.setHeader("Cache-Control", "no-store"); res.type("html").send(html); };
const failed = (res: any, what: string, err: unknown) => {
  console.error(`[boards ${what}]`, err);
  const msg = String(err instanceof Error ? err.message : err).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  res.status(500).type("html").send(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${what}</title></head><body style="font-family: system-ui, sans-serif; padding: 24px; color: #1F2A44"><h1 style="font-size: 18px">The ${what} could not be built from the plan</h1><p>${msg}</p></body></html>`);
};

router.get("/projects/:projectId/boards/build-cash", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const asOf = today();
    const J = await buildCashModel(projectId, { months: 36 });
    let html = boardRefresh(BOARD_TEMPLATE, J, asOf);
    html = boardLines(html, await planLines(projectId), J.projectLines, asOf, await lineDetail(projectId));
    page(res, embedBoard(html));
  } catch (err) { failed(res, "Build Cash Board", err); }
});

router.get("/projects/:projectId/boards/money-plan", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const asOf = today();
    const J = await buildCashModel(projectId, { months: 36 });
    const D = planData(makeRun(J));
    const html = renderMoneyPlan({ D, LIVE: J, ENGINE, lib: { PATIENT_MODEL, PRICES, WINC_SCENARIOS, monthsFrom, wincForecast }, asOf });
    // The same page frame the plan was published in, pinned light as Launch OS is.
    page(res, `<!doctype html><html lang="en-GB" data-theme="light"><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>${html}</body></html>`);
  } catch (err) { failed(res, "Money Plan", err); }
});

export default router;
