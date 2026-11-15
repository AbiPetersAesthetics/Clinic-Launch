// Today, the brief ALFRED opens on (UX plan 2.1 b): composed by plain rules from what the agents
// already wrote, never by an extra AI pass, so it is never late and cannot invent a figure.
// Ranking: red before amber; proposals before stale sources; money and patients before marketing.
// A stale source is never used in the verdict and is itself an item.
import { Router } from "express";
import { summaryFor } from "../lib/board-data";
import { openProposals, recentActivity } from "./proposals";
import { missedRuns } from "../lib/heartbeat";
import type { Summary, Alert, Kpi } from "../boards/summaries";
import type { ProposalRow, ActivityRow } from "../lib/agent-tables";

const router = Router();

export type BriefItem =
  | { kind: "proposal"; id: string; proposal: ProposalRow }
  | { kind: "alert"; id: string; alert: Alert }
  | { kind: "stale"; id: string; area: string; title: string; detail: string; sources: Summary["sources"]; href: string }
  | { kind: "bank"; id: string; title: string; detail: string; bank: unknown; fundingOptions: unknown; sources: Summary["sources"] };

const words = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things", "Six things", "Seven things"];
const HREF: Record<string, string> = { ads: "/growth/ads", clinic: "/clinic/board", money: "/money" };

function runsLine(runs: ActivityRow[], missed: { agent: string; due: string }[]) {
  const fine = runs.filter((r) => r.status === "ok").length;
  const partial = runs.filter((r) => r.status === "partial");
  const failed = runs.filter((r) => r.status === "failed");
  if (!runs.length && !missed.length) return "No runs logged in the last 24 hours.";
  const bits = [`${runs.length} ${runs.length === 1 ? "run" : "runs"}`];
  if (fine === runs.length && runs.length) bits.push(runs.length === 1 ? "fine" : "all fine");
  else {
    if (fine) bits.push(`${fine} fine`);
    if (partial.length) bits.push(`${partial.length} partial${partial[0].summary ? ` (${partial[0].summary.split(/[.;]/)[0]})` : ""}`);
    if (failed.length) bits.push(`${failed.length} failed`);
  }
  if (missed.length) bits.push(`${missed.length} missed (${missed.map((m) => m.agent).join(", ")})`);
  return `Last 24 hours: ${bits.join(", ")}.`;
}

export async function composeBrief(projectId: number) {
  const now = new Date();
  const [ads, clinic, money, open, runs, missed] = await Promise.all([
    summaryFor(projectId, "ads"), summaryFor(projectId, "clinic"), summaryFor(projectId, "money"),
    openProposals(projectId), recentActivity(projectId, new Date(now.getTime() - 24 * 3600000).toISOString()),
    missedRuns(projectId, now).catch(() => []),
  ]);
  const summaries = [money, clinic, ads];
  const fresh = (s: Summary) => s.state !== "stale";
  const alerts = summaries.flatMap((s) => (fresh(s) ? s.alerts : []));

  const items: BriefItem[] = [];
  for (const a of alerts.filter((a) => a.level === "act")) items.push({ kind: "alert", id: a.id, alert: a });
  for (const m of missed) items.push({ kind: "alert", id: `missed-${m.agent}`, alert: { id: `missed-${m.agent}`, area: "growth", level: "act", title: `${m.agent} did not run`, detail: `It was due ${m.due} and has not logged a run since. See Activity.`, sources: [], href: "/activity" } });
  for (const p of open) items.push({ kind: "proposal", id: `p${p.id}`, proposal: p });
  const mx = money.extra as any;
  if (mx?.bankStale) items.push({ kind: "bank", id: "bank", title: mx.bank ? "The bank balance is out of date" : "Type the bank balance", detail: money.verdict, bank: mx.bank, fundingOptions: mx.fundingOptions, sources: [money.sources[0]] });
  for (const s of summaries) if (!fresh(s) && s.key !== "money") items.push({ kind: "stale", id: `stale-${s.key}`, area: s.key, title: `${s.title} figures are stale`, detail: s.verdict, sources: s.sources.filter((c) => c.state === "stale"), href: HREF[s.key] });
  for (const a of alerts.filter((a) => a.level === "watch")) items.push({ kind: "alert", id: a.id, alert: a });

  const anyAct = items.some((i) => i.kind === "alert" && i.alert.level === "act");
  const state = anyAct ? "act" : items.length ? "watch" : "good";
  const toOpen = Math.ceil((Date.parse("2026-12-08T00:00:00Z") - now.getTime()) / 86400000);
  const ax = ads.extra as any;
  const parts: string[] = [];
  if (fresh(ads) && ax?.leads) parts.push(`${ax.booked} of ${ax.leads} ad leads have booked a consultation`);
  if (toOpen > 0) parts.push(`Winchester opens in ${toOpen} ${toOpen === 1 ? "day" : "days"}`);
  const lead = state === "good" ? "On track." : state === "watch" ? "Watch." : "Act.";
  const needs = items.length ? `${words[Math.min(items.length, 7)]} ${items.length === 1 ? "needs" : "need"} you.` : "Nothing needs you.";
  const verdict = `${lead} ${parts.length ? parts.join("; ") + ". " : ""}${needs}`;

  const pick = (s: Summary, label: string): Kpi | undefined => s.kpis.find((k) => k.label === label);
  const vitals = [pick(money, "Bank"), pick(ads, "Leads, 7 days"), pick(ads, "Booked, 7 days"), pick(clinic, "Diary, next 7 days")].filter(Boolean) as Kpi[];

  return {
    asOf: now.toISOString(),
    state, verdict,
    items: items.slice(0, 5), more: Math.max(0, items.length - 5), total: items.length,
    vitals,
    runs: { line: runsLine(runs, missed), count: runs.length, since: new Date(now.getTime() - 24 * 3600000).toISOString() },
    areas: summaries.map((s) => ({ key: s.key, title: s.title, state: s.state, verdict: s.verdict })),
  };
}

router.get("/projects/:projectId/brief", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(await composeBrief(parseInt(req.params.projectId)));
  } catch (err) {
    console.error("[brief]", err);
    res.status(500).json({ error: "Could not build today's brief" });
  }
});

export default router;
