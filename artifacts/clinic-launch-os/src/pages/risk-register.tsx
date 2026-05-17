import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Star, StarOff, ChevronDown, ChevronUp, Plus, Eye,
  TrendingUp, TrendingDown, Minus, Shield, Clock, User, Calendar,
  ArrowRight, CheckCircle2, Link2, Flame, RefreshCw
} from "lucide-react";

const PROJECT_ID = 1;
const API = `/api`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Risk {
  id: number;
  projectId: number;
  riskId: string;
  title: string;
  description?: string;
  category: string;
  likelihood: number;
  impact: number;
  residualLikelihood?: number;
  residualImpact?: number;
  treatment?: string;
  treatmentAction?: string;
  owner?: string;
  dueDate?: string;
  status: string;
  pipelineStage?: string;
  linkedModelSection?: string;
  linkedRiskIds?: string[];
  isWatchList: boolean;
  scoreHistory?: Array<{ date: string; score: number; likelihood: number; impact: number; note?: string }>;
  lastReviewedAt?: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const score = (l: number, i: number) => l * i;

const scoreColor = (s: number) => {
  if (s >= 15) return "bg-red-600 text-white";
  if (s >= 10) return "bg-orange-500 text-white";
  if (s >= 5) return "bg-amber-400 text-black";
  return "bg-emerald-500 text-white";
};

const scoreBadgeVariant = (s: number): string => {
  if (s >= 15) return "destructive";
  if (s >= 10) return "outline";
  if (s >= 5) return "secondary";
  return "outline";
};

const scoreLabel = (s: number) => {
  if (s >= 15) return "Critical";
  if (s >= 10) return "High";
  if (s >= 5) return "Medium";
  return "Low";
};

const scoreBg = (s: number) => {
  if (s >= 15) return "border-red-200 bg-red-50";
  if (s >= 10) return "border-orange-200 bg-orange-50";
  if (s >= 5) return "border-amber-200 bg-amber-50";
  return "border-emerald-200 bg-emerald-50";
};

const CATEGORIES = ["Financial", "Legal & Lease", "Clinical & Compliance", "Operational", "Life Design", "Market & Competition", "Strategic"];
const PIPELINE_STAGES = ["Pre-Lease", "Lease Signing", "Fit-Out", "Pre-Opening", "Month 1-3", "Month 4-6", "Month 7-12", "Ongoing"];
const OWNERS = ["Abi", "David", "Solicitor", "Accountant", "Agent", "Contractor", "Insurer", "External"];
const STATUSES = ["Not Started", "In Progress", "Mitigated", "Closed"];
const TREATMENTS = ["Treat", "Tolerate", "Transfer", "Terminate"];

const TREATMENT_GUIDANCE: Record<string, string> = {
  Treat: "Define specific actions to reduce likelihood or impact. Assign an owner and due date.",
  Tolerate: "Accept this risk as within appetite. Document why and review at next milestone.",
  Transfer: "Identify who takes this risk — insurer, solicitor, landlord, contractor. Document the mechanism.",
  Terminate: "This activity or decision is abandoned to eliminate the risk entirely. Document the decision.",
};

const CATEGORY_ICONS: Record<string, string> = {
  Financial: "£",
  "Legal & Lease": "⚖",
  "Clinical & Compliance": "🏥",
  Operational: "⚙",
  "Life Design": "🌱",
  "Market & Competition": "🎯",
  Strategic: "♟",
};

function fmt(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

// ─── 5×5 Risk Matrix ─────────────────────────────────────────────────────────
function RiskMatrix({ risks, onCellClick }: { risks: Risk[]; onCellClick: (l: number, i: number) => void }) {
  const countAt = (l: number, i: number) => risks.filter(r => r.likelihood === l && r.impact === i).length;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">5×5 Risk Matrix</p>
      <div className="overflow-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-16 text-right pr-2 text-muted-foreground font-normal">Likelihood ↓ Impact →</th>
              {[1, 2, 3, 4, 5].map(i => (
                <th key={i} className="w-10 h-8 text-center text-muted-foreground font-normal">{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map(l => (
              <tr key={l}>
                <td className="text-right pr-2 text-muted-foreground">{l}</td>
                {[1, 2, 3, 4, 5].map(i => {
                  const s = l * i;
                  const count = countAt(l, i);
                  return (
                    <td
                      key={i}
                      className={`w-10 h-10 text-center cursor-pointer border border-white/40 rounded transition-opacity hover:opacity-80 ${scoreColor(s)}`}
                      onClick={() => count > 0 && onCellClick(l, i)}
                    >
                      {count > 0 ? <span className="font-bold">{count}</span> : <span className="opacity-30">·</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-3 mt-2 flex-wrap">
          {[["bg-emerald-500","Low 1-4"],["bg-amber-400","Medium 5-9"],["bg-orange-500","High 10-14"],["bg-red-600","Critical 15-25"]].map(([c, l]) => (
            <div key={l} className="flex items-center gap-1"><div className={`w-3 h-3 rounded ${c}`}/><span className="text-xs text-muted-foreground">{l}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Score Badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ l, i, size = "sm" }: { l: number; i: number; size?: "sm" | "lg" }) {
  const s = l * i;
  const cls = size === "lg" ? "text-sm px-2 py-0.5 font-bold" : "text-xs px-1.5 py-0.5 font-semibold";
  return (
    <span className={`inline-flex items-center rounded ${scoreColor(s)} ${cls}`}>
      {s}
    </span>
  );
}

// ─── Trend indicator ─────────────────────────────────────────────────────────
function TrendIcon({ risk }: { risk: Risk }) {
  const history = risk.scoreHistory;
  if (!history || history.length === 0) return <Minus className="w-3 h-3 text-muted-foreground" />;
  const last = history[history.length - 1];
  const current = risk.likelihood * risk.impact;
  if (current > last.score) return <TrendingUp className="w-3 h-3 text-red-500" />;
  if (current < last.score) return <TrendingDown className="w-3 h-3 text-emerald-500" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
}

// ─── Add Risk Modal ───────────────────────────────────────────────────────────
function AddRiskModal({ onAdd }: { onAdd: (data: Partial<Risk>) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Risk>>({ likelihood: 3, impact: 3, category: "Operational", pipelineStage: "Pre-Lease", status: "Not Started" });
  const set = (k: keyof Risk, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" />Add Risk</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Custom Risk</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium">Title *</label>
            <Input value={form.title || ""} onChange={e => set("title", e.target.value)} placeholder="Short plain-English title" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium">Description</label>
            <Textarea value={form.description || ""} onChange={e => set("description", e.target.value)} placeholder="What could go wrong, when, and what triggers it" rows={3} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Category</label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Pipeline Stage</label>
              <Select value={form.pipelineStage} onValueChange={v => set("pipelineStage", v)}>
                <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{PIPELINE_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Likelihood (1–5)</label>
              <Input type="number" min={1} max={5} value={form.likelihood} onChange={e => set("likelihood", parseInt(e.target.value))} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium">Impact (1–5)</label>
              <Input type="number" min={1} max={5} value={form.impact} onChange={e => set("impact", parseInt(e.target.value))} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { onAdd(form); setOpen(false); }} disabled={!form.title}>Add to Register</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline editable cell ─────────────────────────────────────────────────────
function EditableSelect({ value, options, onChange }: { value?: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs border-dashed hover:border-solid min-w-[90px]">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>{options.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

// ─── Expanded Risk Row ────────────────────────────────────────────────────────
function ExpandedRow({ risk, allRisks, onPatch, onReview }: {
  risk: Risk;
  allRisks: Risk[];
  onPatch: (id: string, data: Partial<Risk>) => void;
  onReview: (id: string) => void;
}) {
  const s = score(risk.likelihood, risk.impact);
  const rl = risk.residualLikelihood ?? risk.likelihood;
  const ri = risk.residualImpact ?? risk.impact;
  const rs = risk.treatment === "Terminate" ? 0 : score(rl, ri);
  const reduction = s > 0 ? Math.round(((s - rs) / s) * 100) : 0;
  const escalate = rs >= 12 && risk.treatment && risk.treatment !== "Terminate";
  const linkedRisks = (risk.linkedRiskIds || []).map(id => allRisks.find(r => r.riskId === id)).filter(Boolean) as Risk[];

  return (
    <div className="bg-muted/30 border-t border-border p-4 space-y-4">
      {/* Description */}
      {risk.description && (
        <div className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{risk.description}</div>
      )}

      {/* Treatment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Treatment</p>
          <div className="flex flex-wrap gap-1.5">
            {TREATMENTS.map(t => (
              <button
                key={t}
                onClick={() => onPatch(risk.riskId, { treatment: t })}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  risk.treatment === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {risk.treatment && (
            <p className="text-xs text-muted-foreground italic">{TREATMENT_GUIDANCE[risk.treatment]}</p>
          )}
          <div>
            <label className="text-xs font-medium">Treatment Action</label>
            <Textarea
              defaultValue={risk.treatmentAction || ""}
              onBlur={e => onPatch(risk.riskId, { treatmentAction: e.target.value })}
              placeholder="What specifically, by whom, by when…"
              rows={3}
              className="mt-1 text-xs"
            />
          </div>
        </div>

        {/* Residual scoring */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Residual Risk — after mitigation</p>
          {risk.treatment === "Terminate" ? (
            <div className="rounded bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 font-medium">
              ✓ Risk eliminated — activity abandoned. Residual score: 0.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Residual Likelihood</label>
                <Input
                  type="number" min={1} max={5}
                  defaultValue={risk.residualLikelihood ?? risk.likelihood}
                  onBlur={e => onPatch(risk.riskId, { residualLikelihood: parseInt(e.target.value) })}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Residual Impact</label>
                <Input
                  type="number" min={1} max={5}
                  defaultValue={risk.residualImpact ?? risk.impact}
                  onBlur={e => onPatch(risk.riskId, { residualImpact: parseInt(e.target.value) })}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <ScoreBadge l={rl} i={ri} size="lg" />
                <span className="text-xs text-muted-foreground">
                  {s > 0 && rs < s ? `Score reduced from ${s} to ${rs} — ${reduction}% reduction` : rs === s ? "No mitigation taken yet" : ""}
                </span>
              </div>
            </div>
          )}
          {escalate && (
            <div className="flex items-center gap-2 rounded bg-red-50 border border-red-200 px-3 py-2">
              <Flame className="w-4 h-4 text-red-600 shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Residual risk remains high after treatment — re-treat or escalate to decision maker.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Details row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Owner</label>
          <EditableSelect value={risk.owner} options={OWNERS} onChange={v => onPatch(risk.riskId, { owner: v })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Due Date</label>
          <Input
            type="date"
            defaultValue={risk.dueDate || ""}
            onBlur={e => onPatch(risk.riskId, { dueDate: e.target.value })}
            className="h-7 text-xs mt-0.5"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <EditableSelect value={risk.status} options={STATUSES} onChange={v => onPatch(risk.riskId, { status: v })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Pipeline Stage</label>
          <EditableSelect value={risk.pipelineStage} options={PIPELINE_STAGES} onChange={v => onPatch(risk.riskId, { pipelineStage: v })} />
        </div>
      </div>

      {/* Linked risks */}
      {linkedRisks.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Linked Risks</p>
          <div className="flex flex-wrap gap-1.5">
            {linkedRisks.map(lr => (
              <Tooltip key={lr.riskId}>
                <TooltipTrigger asChild>
                  <button
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border cursor-pointer hover:opacity-80 ${scoreBg(score(lr.likelihood, lr.impact))}`}
                    onClick={() => document.getElementById(`risk-${lr.riskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  >
                    <Link2 className="w-2.5 h-2.5" />
                    {lr.riskId}
                    <ScoreBadge l={lr.likelihood} i={lr.impact} />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p className="max-w-xs text-xs">{lr.title}</p></TooltipContent>
              </Tooltip>
            ))}
          </div>
          {linkedRisks.some(lr => score(lr.likelihood, lr.impact) >= 12) && (
            <div className="mt-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              <strong>Cascade Warning:</strong> If this risk materialises, the following linked risks may also be triggered:{" "}
              {linkedRisks.filter(lr => score(lr.likelihood, lr.impact) >= 12).map(lr => lr.riskId).join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Score history */}
      {risk.scoreHistory && risk.scoreHistory.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Score History</p>
          <div className="flex flex-wrap gap-2">
            {risk.scoreHistory.map((h, i) => (
              <div key={i} className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">
                {fmt(h.date)}: L{h.likelihood}×I{h.impact} = <strong>{h.score}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-xs text-muted-foreground">
          {risk.linkedModelSection && <span className="mr-3">📍 {risk.linkedModelSection}</span>}
          Last reviewed: {fmt(risk.lastReviewedAt)}
        </div>
        <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => onReview(risk.riskId)}>
          <CheckCircle2 className="w-3 h-3" />Mark as Reviewed
        </Button>
      </div>
    </div>
  );
}

// ─── Risk Row ─────────────────────────────────────────────────────────────────
function RiskRow({ risk, rank, allRisks, onPatch, onReview, onToggleWatch }: {
  risk: Risk;
  rank: number;
  allRisks: Risk[];
  onPatch: (id: string, data: Partial<Risk>) => void;
  onReview: (id: string) => void;
  onToggleWatch: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = score(risk.likelihood, risk.impact);
  const rl = risk.residualLikelihood ?? risk.likelihood;
  const ri = risk.residualImpact ?? risk.impact;
  const rs = risk.treatment === "Terminate" ? 0 : score(rl, ri);
  const days = daysUntil(risk.dueDate);
  const isOverdue = days !== null && days < 0 && !["Mitigated", "Closed"].includes(risk.status);
  const isDueSoon = days !== null && days >= 0 && days <= 7 && !["Mitigated", "Closed"].includes(risk.status);

  return (
    <div id={`risk-${risk.riskId}`} className={`border-b border-border last:border-0 ${expanded ? "bg-muted/10" : ""}`}>
      <div
        className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Rank */}
        <span className="text-xs text-muted-foreground w-6 text-center shrink-0">#{rank}</span>

        {/* Risk ID */}
        <span className="text-xs font-mono font-semibold text-muted-foreground w-10 shrink-0">{risk.riskId}</span>

        {/* Title */}
        <span className="text-sm font-medium flex-1 min-w-0 truncate">{risk.title}</span>

        {/* Category */}
        <span className="text-xs text-muted-foreground hidden md:block w-28 shrink-0 truncate">
          {CATEGORY_ICONS[risk.category]} {risk.category}
        </span>

        {/* Inherent score */}
        <div className="shrink-0 flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <ScoreBadge l={risk.likelihood} i={risk.impact} />
        </div>

        {/* Residual score */}
        {risk.residualLikelihood || risk.residualImpact ? (
          <div className="shrink-0 hidden md:flex items-center gap-1">
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <ScoreBadge l={rl} i={ri} />
          </div>
        ) : <div className="w-12 hidden md:block" />}

        {/* Trend */}
        <div className="shrink-0 hidden md:block"><TrendIcon risk={risk} /></div>

        {/* Treatment */}
        <div className="shrink-0 hidden md:block" onClick={e => e.stopPropagation()}>
          <EditableSelect value={risk.treatment} options={TREATMENTS} onChange={v => onPatch(risk.riskId, { treatment: v })} />
        </div>

        {/* Owner */}
        <div className="shrink-0 hidden md:block" onClick={e => e.stopPropagation()}>
          <EditableSelect value={risk.owner} options={OWNERS} onChange={v => onPatch(risk.riskId, { owner: v })} />
        </div>

        {/* Due date */}
        <div className="shrink-0 hidden md:block w-24">
          {risk.dueDate ? (
            <span className={`text-xs ${isOverdue ? "text-red-600 font-semibold" : isDueSoon ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
              {fmt(risk.dueDate)}{isOverdue ? " ⚠" : ""}
            </span>
          ) : <span className="text-xs text-muted-foreground/50">No date</span>}
        </div>

        {/* Status */}
        <div className="shrink-0 hidden lg:block" onClick={e => e.stopPropagation()}>
          <EditableSelect value={risk.status} options={STATUSES} onChange={v => onPatch(risk.riskId, { status: v })} />
        </div>

        {/* Watch star */}
        <button
          className="shrink-0 text-muted-foreground hover:text-amber-500 transition-colors"
          onClick={e => { e.stopPropagation(); onToggleWatch(risk.riskId); }}
        >
          {risk.isWatchList ? <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> : <StarOff className="w-4 h-4" />}
        </button>

        {/* Expand toggle */}
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <ExpandedRow risk={risk} allRisks={allRisks} onPatch={onPatch} onReview={onReview} />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RiskRegisterPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [appetite, setAppetite] = useState<"Conservative" | "Moderate" | "Aggressive">("Conservative");
  const [matrixFilter, setMatrixFilter] = useState<{ l: number; i: number } | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [search, setSearch] = useState("");

  const appetiteThreshold = appetite === "Conservative" ? 6 : appetite === "Moderate" ? 9 : 12;

  // ── Data fetching ────────────────────────────────────────────────────────────
  const { data: risks = [], isLoading } = useQuery<Risk[]>({
    queryKey: ["risks", PROJECT_ID],
    queryFn: () => fetch(`${API}/projects/${PROJECT_ID}/risks`).then(r => r.json()),
    refetchInterval: 30000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const patchMutation = useMutation({
    mutationFn: ({ riskId, data }: { riskId: string; data: Partial<Risk> }) =>
      fetch(`${API}/projects/${PROJECT_ID}/risks/${riskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risks", PROJECT_ID] }),
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: (data: Partial<Risk>) =>
      fetch(`${API}/projects/${PROJECT_ID}/risks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["risks", PROJECT_ID] }); toast({ title: "Risk added" }); },
  });

  const reviewMutation = useMutation({
    mutationFn: (riskId: string) =>
      fetch(`${API}/projects/${PROJECT_ID}/risks/${riskId}/review`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risks", PROJECT_ID] }),
  });

  const onPatch = useCallback((riskId: string, data: Partial<Risk>) => {
    patchMutation.mutate({ riskId, data });
  }, [patchMutation]);

  const onToggleWatch = useCallback((riskId: string) => {
    const risk = risks.find(r => r.riskId === riskId);
    if (!risk) return;
    patchMutation.mutate({ riskId, data: { isWatchList: !risk.isWatchList } });
  }, [risks, patchMutation]);

  // ── Derived data ──────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...risks].sort((a, b) => {
      const sa = score(a.likelihood, a.impact);
      const sb = score(b.likelihood, b.impact);
      if (sb !== sa) return sb - sa;
      const stageA = PIPELINE_STAGES.indexOf(a.pipelineStage || "");
      const stageB = PIPELINE_STAGES.indexOf(b.pipelineStage || "");
      if (stageA !== stageB) return stageA - stageB;
      return b.impact - a.impact;
    });
  }, [risks]);

  const filtered = useMemo(() => {
    return sorted.filter(r => {
      if (matrixFilter && !(r.likelihood === matrixFilter.l && r.impact === matrixFilter.i)) return false;
      if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !r.riskId.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory !== "all" && r.category !== filterCategory) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterOwner !== "all" && r.owner !== filterOwner) return false;
      if (activeTab === "watchlist") return r.isWatchList;
      if (activeTab !== "all") {
        const tabMap: Record<string, string> = {
          financial: "Financial",
          legal: "Legal & Lease",
          clinical: "Clinical & Compliance",
          operational: "Operational",
          lifedesign: "Life Design",
          market: "Market & Competition",
          strategic: "Strategic",
        };
        return r.category === tabMap[activeTab];
      }
      return true;
    });
  }, [sorted, matrixFilter, search, filterCategory, filterStatus, filterOwner, activeTab]);

  // ── Dashboard stats ───────────────────────────────────────────────────────────
  const criticalCount = risks.filter(r => score(r.likelihood, r.impact) >= 15).length;
  const noOwnerCount = risks.filter(r => !r.owner).length;
  const now = Date.now();
  const dueSoon30 = risks.filter(r => {
    const d = daysUntil(r.dueDate);
    return d !== null && d >= 0 && d <= 30 && !["Mitigated","Closed"].includes(r.status) && !r.treatmentAction;
  }).length;
  const overdue = risks.filter(r => {
    const d = daysUntil(r.dueDate);
    return d !== null && d < 0 && !["Mitigated","Closed"].includes(r.status);
  }).length;
  const totalInherent = risks.reduce((s, r) => s + score(r.likelihood, r.impact), 0);
  const totalResidual = risks.reduce((s, r) => {
    if (r.treatment === "Terminate") return s;
    const rl = r.residualLikelihood ?? r.likelihood;
    const ri = r.residualImpact ?? r.impact;
    return s + score(rl, ri);
  }, 0);
  const mitigationPct = totalInherent > 0 ? Math.round(((totalInherent - totalResidual) / totalInherent) * 100) : 0;
  const noMitigation = risks.filter(r => r.treatment === "Terminate" ? false : score((r.residualLikelihood ?? r.likelihood), (r.residualImpact ?? r.impact)) === score(r.likelihood, r.impact)).length;
  const watchList = risks.filter(r => r.isWatchList);
  const watchNeedReview = watchList.filter(r => {
    if (!r.lastReviewedAt) return true;
    return Date.now() - new Date(r.lastReviewedAt).getTime() > 14 * 86400000;
  }).length;

  // Tab categories
  const actionTasks = risks.filter(r => r.treatmentAction && r.treatmentAction.trim().length > 0 && !["Mitigated", "Closed"].includes(r.status));
  const actionTasksSorted = [...actionTasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
  const actionByOwner: Record<string, Risk[]> = {};
  for (const r of actionTasksSorted) {
    const key = r.owner || "Unassigned";
    if (!actionByOwner[key]) actionByOwner[key] = [];
    actionByOwner[key].push(r);
  }
  const actionOwnerGroups = Object.entries(actionByOwner).sort(([a], [b]) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b);
  });
  const actionOverdue = actionTasks.filter(r => { const d = daysUntil(r.dueDate); return d !== null && d < 0; });
  const actionDueSoon = actionTasks.filter(r => { const d = daysUntil(r.dueDate); return d !== null && d >= 0 && d <= 7; });
  const actionNoDate = actionTasks.filter(r => !r.dueDate);

  const tabDefs = [
    { key: "all", label: "All Risks" },
    { key: "actions", label: `✓ Action Tasks (${actionTasks.length})` },
    { key: "financial", label: "Financial" },
    { key: "legal", label: "Legal & Lease" },
    { key: "clinical", label: "Clinical & Compliance" },
    { key: "operational", label: "Operational" },
    { key: "lifedesign", label: "Life Design" },
    { key: "market", label: "Market & Competition" },
    { key: "strategic", label: "Strategic" },
    { key: "watchlist", label: `★ Watch List (${watchList.length})` },
  ];

  const tabMap: Record<string, string | null> = {
    all: null, financial: "Financial", legal: "Legal & Lease",
    clinical: "Clinical & Compliance", operational: "Operational",
    lifedesign: "Life Design", market: "Market & Competition", strategic: "Strategic",
    watchlist: null,
  };

  const getTabStats = (tab: string) => {
    const cat = tabMap[tab];
    let subset = risks;
    if (tab === "watchlist") subset = risks.filter(r => r.isWatchList);
    else if (cat) subset = risks.filter(r => r.category === cat);
    const highest = subset.reduce((m, r) => Math.max(m, score(r.likelihood, r.impact)), 0);
    const unaddressed = subset.filter(r => !r.treatment).length;
    return { count: subset.length, highest, unaddressed };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Risk Register</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{risks.length} risks tracked · Abi Peters Aesthetics · Winchester Launch</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => qc.invalidateQueries({ queryKey: ["risks", PROJECT_ID] })}>
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </Button>
          <AddRiskModal onAdd={data => addMutation.mutate(data)} />
        </div>
      </div>

      {/* ── Dashboard tiles ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Risks</p>
            <p className="text-3xl font-bold mt-1">{risks.length}</p>
          </CardContent>
        </Card>
        <Card className={`border ${criticalCount > 0 ? "border-red-200 bg-red-50" : "border-0 bg-muted/40"}`}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="w-3 h-3 text-red-500" />Critical (15–25)</p>
            <p className={`text-3xl font-bold mt-1 ${criticalCount > 0 ? "text-red-600" : ""}`}>{criticalCount}</p>
          </CardContent>
        </Card>
        <Card className={`border ${noOwnerCount > 0 ? "border-amber-200 bg-amber-50" : "border-0 bg-muted/40"}`}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />No Owner</p>
            <p className={`text-3xl font-bold mt-1 ${noOwnerCount > 0 ? "text-amber-600" : ""}`}>{noOwnerCount}</p>
          </CardContent>
        </Card>
        <Card className={`border ${overdue > 0 ? "border-red-200 bg-red-50" : "border-0 bg-muted/40"}`}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Overdue Actions</p>
            <p className={`text-3xl font-bold mt-1 ${overdue > 0 ? "text-red-600" : ""}`}>{overdue}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Mitigation summary + Matrix row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Mitigation value */}
        <Card className="border-0 bg-muted/40">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Mitigation Value</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total inherent score</span>
              <span className="font-semibold">{totalInherent}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total residual score</span>
              <span className="font-semibold">{totalResidual}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Overall reduction</span>
              <span className={`font-bold ${mitigationPct > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>{mitigationPct}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-1">
              <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${mitigationPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{noMitigation} risks with no mitigation taken</p>
          </CardContent>
        </Card>

        {/* Risk matrix */}
        <Card className="border-0 bg-muted/40 md:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <RiskMatrix risks={risks} onCellClick={(l, i) => setMatrixFilter(f => f?.l === l && f?.i === i ? null : { l, i })} />
              <div className="space-y-2 min-w-[160px]">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risk Appetite</p>
                <div className="flex flex-col gap-1">
                  {(["Conservative", "Moderate", "Aggressive"] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => setAppetite(a)}
                      className={`text-xs px-3 py-1.5 rounded text-left border transition-colors ${
                        appetite === a ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                      }`}
                    >
                      {a} <span className="opacity-70">(flag {a === "Conservative" ? "6+" : a === "Moderate" ? "9+" : "12+"})</span>
                    </button>
                  ))}
                </div>
                {matrixFilter && (
                  <button onClick={() => setMatrixFilter(null)} className="text-xs text-muted-foreground underline mt-2">
                    Clear matrix filter (L{matrixFilter.l}×I{matrixFilter.i})
                  </button>
                )}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground">Watch List</p>
                  <p className="text-xs mt-1">{watchList.length} risks starred</p>
                  {watchNeedReview > 0 && (
                    <p className="text-xs text-amber-600 font-medium">{watchNeedReview} need review</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Action Required panel ────────────────────────────────────────────── */}
      {(overdue > 0 || dueSoon30 > 0 || noOwnerCount > 0) && (
        <Card className="border border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-amber-900 mb-2">Action Required</p>
            <div className="space-y-1">
              {sorted.filter(r => { const d = daysUntil(r.dueDate); return d !== null && d < 0 && !["Mitigated","Closed"].includes(r.status); }).map(r => (
                <div key={r.riskId} className="flex items-center gap-2 text-xs text-red-700">
                  <span className="font-mono">{r.riskId}</span>
                  <span>{r.title}</span>
                  <Badge variant="destructive" className="text-xs">Overdue</Badge>
                </div>
              ))}
              {sorted.filter(r => !r.owner).slice(0, 5).map(r => (
                <div key={r.riskId} className="flex items-center gap-2 text-xs text-amber-800">
                  <span className="font-mono">{r.riskId}</span>
                  <span>{r.title}</span>
                  <Badge variant="outline" className="text-xs border-amber-400">No owner</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/50 p-1 w-auto">
            {tabDefs.map(t => {
              const stats = getTabStats(t.key);
              return (
                <TabsTrigger key={t.key} value={t.key} className="text-xs px-2.5 py-1.5 data-[state=active]:bg-background">
                  {t.label}
                  {t.key !== "all" && stats.count > 0 && (
                    <span className={`ml-1.5 text-[10px] rounded px-1 ${stats.highest >= 15 ? "bg-red-100 text-red-700" : stats.highest >= 10 ? "bg-orange-100 text-orange-700" : stats.highest >= 5 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {stats.count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* ── Action Tasks view ────────────────────────────────────────────────── */}
      {activeTab === "actions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">{actionTasks.length} open actions</span>
            {actionOverdue.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 text-red-700 px-3 py-1 text-xs font-medium">⚠ {actionOverdue.length} overdue</span>}
            {actionDueSoon.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-medium">⏰ {actionDueSoon.length} due this week</span>}
            {actionNoDate.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground px-3 py-1 text-xs font-medium">{actionNoDate.length} no date set</span>}
          </div>
          {actionTasks.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                No open treatment actions yet. Expand any risk and fill in the Treatment Action field to add tasks here.
              </CardContent>
            </Card>
          ) : actionOwnerGroups.map(([owner, ownerRisks]) => (
            <Card key={owner} className="border-0 shadow-sm overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-4 py-2 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold">{owner}</span>
                <span className="text-xs text-muted-foreground ml-1">({ownerRisks.length} action{ownerRisks.length !== 1 ? "s" : ""})</span>
              </div>
              <div className="divide-y divide-border">
                {ownerRisks.map(r => {
                  const d = daysUntil(r.dueDate);
                  const isOv = d !== null && d < 0;
                  const isSoon = d !== null && d >= 0 && d <= 7;
                  return (
                    <div key={r.riskId} className={`px-4 py-3 flex items-start gap-3 ${isOv ? "bg-red-50" : isSoon ? "bg-amber-50/50" : ""}`}>
                      <div className="mt-0.5 shrink-0"><ScoreBadge l={r.likelihood} i={r.impact} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{r.riskId}</span>
                          <span className="text-sm font-medium">{r.title}</span>
                          {r.treatment && <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">{r.treatment}</span>}
                          {r.status && <span className={`text-xs px-1.5 py-0.5 rounded border ${r.status === "Mitigated" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : r.status === "Open" ? "bg-blue-50 border-blue-200 text-blue-700" : "border-border text-muted-foreground"}`}>{r.status}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.treatmentAction}</p>
                      </div>
                      <div className="shrink-0 text-right min-w-[80px]">
                        {r.dueDate ? (
                          <span className={`text-xs font-medium ${isOv ? "text-red-600" : isSoon ? "text-amber-600" : "text-muted-foreground"}`}>
                            {isOv ? "Overdue" : isSoon ? "Due soon" : fmt(r.dueDate)}
                            {(isOv || isSoon) && <><br /><span className="font-normal">{fmt(r.dueDate)}</span></>}
                          </span>
                        ) : <span className="text-xs text-muted-foreground/50">No date</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      {activeTab !== "actions" && <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search risks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs w-48"
        />
        {activeTab === "all" && (
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {OWNERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || filterCategory !== "all" || filterStatus !== "all" || filterOwner !== "all" || matrixFilter) && (
          <button className="text-xs text-muted-foreground underline" onClick={() => { setSearch(""); setFilterCategory("all"); setFilterStatus("all"); setFilterOwner("all"); setMatrixFilter(null); }}>
            Clear filters
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} risks</span>
      </div>}

      {/* ── Table header ─────────────────────────────────────────────────────── */}
      {activeTab !== "actions" && <Card className="border-0 shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/30 flex items-center gap-2 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground w-6 text-center">#</span>
          <span className="text-xs font-medium text-muted-foreground w-10">ID</span>
          <span className="text-xs font-medium text-muted-foreground flex-1">Risk Title</span>
          <span className="text-xs font-medium text-muted-foreground hidden md:block w-28">Category</span>
          <span className="text-xs font-medium text-muted-foreground w-10 text-center">Score</span>
          <span className="text-xs font-medium text-muted-foreground hidden md:block w-12 text-center">Resid.</span>
          <span className="text-xs font-medium text-muted-foreground hidden md:block w-5">↕</span>
          <span className="text-xs font-medium text-muted-foreground hidden md:block w-24">Treatment</span>
          <span className="text-xs font-medium text-muted-foreground hidden md:block w-24">Owner</span>
          <span className="text-xs font-medium text-muted-foreground hidden md:block w-24">Due</span>
          <span className="text-xs font-medium text-muted-foreground hidden lg:block w-28">Status</span>
          <span className="text-xs font-medium text-muted-foreground w-6 text-center">★</span>
          <span className="w-4" />
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No risks match the current filters.
          </div>
        ) : (
          <div>
            {filtered.map((risk, idx) => (
              <RiskRow
                key={risk.id}
                risk={risk}
                rank={sorted.indexOf(risk) + 1}
                allRisks={risks}
                onPatch={onPatch}
                onReview={(id) => reviewMutation.mutate(id)}
                onToggleWatch={onToggleWatch}
              />
            ))}
          </div>
        )}
      </Card>}

      {/* ── Pipeline view ────────────────────────────────────────────────────── */}
      <Card className="border-0 bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Pipeline View</CardTitle>
          <p className="text-xs text-muted-foreground">Risks grouped by stage from today through month 12 post-opening</p>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PIPELINE_STAGES.map(stage => {
              const stageRisks = risks.filter(r => r.pipelineStage === stage);
              const highest = stageRisks.reduce((m, r) => Math.max(m, score(r.likelihood, r.impact)), 0);
              const unaddressed = stageRisks.filter(r => !r.treatment).length;
              const rag = highest >= 15 ? "red" : highest >= 10 ? "orange" : highest >= 5 ? "amber" : "green";
              const ragStyle = rag === "red" ? "border-red-200 bg-red-50" : rag === "orange" ? "border-orange-200 bg-orange-50" : rag === "amber" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50";
              return (
                <div key={stage} className={`rounded border p-3 ${ragStyle}`}>
                  <p className="text-xs font-semibold truncate">{stage}</p>
                  <p className="text-2xl font-bold mt-1">{stageRisks.length}</p>
                  <p className="text-xs text-muted-foreground">{unaddressed} unaddressed</p>
                  {highest > 0 && <div className="mt-1"><ScoreBadge l={1} i={highest} /></div>}
                </div>
              );
            })}
          </div>

          {/* Horizon scan */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Horizon Scan — Coming Up the Pipeline, Act Before These Become Active
            </p>
            <div className="space-y-1">
              {PIPELINE_STAGES.slice(1).flatMap(stage => {
                const top = risks
                  .filter(r => r.pipelineStage === stage && !r.treatment)
                  .sort((a, b) => score(b.likelihood, b.impact) - score(a.likelihood, a.impact))
                  .slice(0, 3);
                return top.map(r => (
                  <div key={r.riskId} className="flex items-center gap-2 text-xs py-0.5">
                    <span className="text-muted-foreground w-24 shrink-0">{stage}</span>
                    <span className="font-mono text-muted-foreground w-10">{r.riskId}</span>
                    <span className="flex-1 truncate">{r.title}</span>
                    <ScoreBadge l={r.likelihood} i={r.impact} />
                  </div>
                ));
              }).slice(0, 9)}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
