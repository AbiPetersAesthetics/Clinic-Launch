// How far the ALFRED build has got (owner, 15 Nov 2026): the checklist in build-status.json, kept
// current with every commit, and the real build time and commit stamped in by build.mjs.
import { Router } from "express";
import STATUS from "../build-status.json";

declare const __BUILD_TIME__: string;
declare const __BUILD_COMMIT__: string;

const router = Router();

router.get("/build-status", (_req, res) => {
  const items = (STATUS as { items: { status: string }[] }).items;
  const done = items.filter((i) => i.status === "done").length;
  const partial = items.filter((i) => i.status === "partial").length;
  const todo = items.length - done - partial;
  res.setHeader("Cache-Control", "no-store");
  res.json({
    percent: Math.round((100 * (done + partial / 2)) / Math.max(1, items.length)),
    counts: { done, partial, todo, total: items.length },
    builtIso: typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : null,
    commit: typeof __BUILD_COMMIT__ === "string" ? __BUILD_COMMIT__ : null,
    checklistUpdatedIso: (STATUS as { updatedIso: string }).updatedIso,
    items,
  });
});

export default router;
