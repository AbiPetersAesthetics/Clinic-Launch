// Shared types and calls for ALFRED's brief, board summaries, proposals and activity, and the
// handedness setting (left by default: Today at bottom left, Approve at the left of each card).
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";

export const PROJECT_ID = 1;

export type FreshState = "fresh" | "ageing" | "stale" | "failed" | "unknown";
export interface Chip { source: string; label: string; asOf: string | null; state: FreshState; text: string; by: string }
export type Tone = "good" | "watch" | "act" | "stale";
export interface Kpi { label: string; value: string | null; compare?: string; notMeasured?: { reason: string; from?: string }; source?: Chip; tone?: "good" | "watch" | "act" }
export interface Alert { id: string; area: string; level: "act" | "watch"; title: string; detail?: string; sources: Chip[]; href?: string }
export interface Summary { key: string; area: string; title: string; state: Tone; verdict: string; detail?: string; kpis: Kpi[]; sources: Chip[]; alerts: Alert[]; keeper: string; extra?: any }
export interface Proposal {
  id: number; area: string; kind: string; agent: string; title: string; why: string | null; risk: string | null; on_approval: string | null;
  guard: string | null; sources: { source: string; asOf: string }[]; chips?: Chip[]; expires_at: string | null; status: string; reason: string | null;
  question: string | null; answer: string | null; result: string | null; snooze_until: string | null; decided_at: string | null; created_at: string; updated_at: string;
}
export interface FundingOption { id: number; label: string; month: string; amount: number }
export interface BankLite { balanceGbp: number; asAt: string; inBalance: number[] }
export type BriefItem =
  | { kind: "proposal"; id: string; proposal: Proposal }
  | { kind: "alert"; id: string; alert: Alert }
  | { kind: "stale"; id: string; area: string; title: string; detail: string; sources: Chip[]; href: string }
  | { kind: "bank"; id: string; title: string; detail: string; bank: BankLite | null; fundingOptions: FundingOption[]; sources: Chip[] };
export interface Brief {
  asOf: string; state: Tone; verdict: string; items: BriefItem[]; more: number; total: number; vitals: Kpi[];
  runs: { line: string; count: number; since: string }; areas: { key: string; title: string; state: Tone; verdict: string; href: string; sources?: Chip[]; extra?: any }[];
  dates: { date: string; label: string; area: string; what: string; href: string }[];
}
export interface Run { id: number; agent: string; status: string; summary: string | null; sources: { source: string; to?: string }[]; wrote: string[]; proposed: number; alerts: number; started_at: string | null; finished_at: string }

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `Could not load ${url}`);
  return r.json() as Promise<T>;
}

export const useBrief = () => useQuery({ queryKey: ["alfred", "brief"], queryFn: () => getJson<Brief>(`/api/projects/${PROJECT_ID}/brief`), refetchInterval: 5 * 60_000 });
export const useSummary = (board: string) => useQuery({ queryKey: ["alfred", "summary", board], queryFn: () => getJson<Summary>(`/api/projects/${PROJECT_ID}/boards/${board}/summary`), enabled: board !== "none" });
export const useProposals = () => useQuery({ queryKey: ["alfred", "proposals"], queryFn: () => getJson<{ open: Proposal[]; queued: Proposal[]; snoozed: Proposal[]; decided: Proposal[] }>(`/api/projects/${PROJECT_ID}/proposals`) });
export const useActivity = () => useQuery({ queryKey: ["alfred", "activity"], queryFn: () => getJson<{ runs: Run[] }>(`/api/projects/${PROJECT_ID}/activity`) });

export async function decide(id: number, action: "approve" | "reject" | "ask" | "snooze" | "undo" | "unqueue", extra: { reason?: string; question?: string; until?: string } = {}) {
  const r = await fetch(`/api/projects/${PROJECT_ID}/proposals/${id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Could not record that");
  return j.proposal as Proposal;
}

// ── Handedness ──
export type Hand = "left" | "right";
const KEY = "alfred.hand";
const listeners = new Set<() => void>();
function readHand(): Hand { try { return localStorage.getItem(KEY) === "right" ? "right" : "left"; } catch { return "left"; } }
export function setHand(h: Hand) { try { localStorage.setItem(KEY, h); } catch { /* the default stays */ } listeners.forEach((l) => l()); }
export function useHand(): Hand {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, readHand, () => "left");
}

export const toneWord: Record<Tone, string> = { good: "On track", watch: "Watch", act: "Act", stale: "Stale" };
export const dayMonth = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
export const dayTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

// Any ALFRED page's data, from /api/projects/1/pages/<name>.
export function usePage<T = any>(name: string) {
  return useQuery({ queryKey: ["alfred", "page", name], queryFn: () => getJson<T>(`/api/projects/${PROJECT_ID}/pages/${name}`) });
}
