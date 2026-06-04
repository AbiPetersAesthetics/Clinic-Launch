import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useUpdateTask,
  useCreateTask,
  useDeleteTask,
  useGetProject,
  useUpdateProject,
  useGetRiskFlags,
  getGetRiskFlagsQueryKey,
  useGetProjectDashboard,
  getGetProjectDashboardQueryKey,
  getGetOptimisationAnalysisQueryKey,
  useListProperties,
  getListPropertiesQueryKey,
  useListTaskSupplierQuotes,
  getListTaskSupplierQuotesQueryKey,
  useCreateQuote,
  useListSuppliers,
  getListSuppliersQueryKey,
  useGetProjectTimeline,
  getGetProjectTimelineQueryKey,
  getGetProjectQueryKey,
} from "@workspace/api-client-react";
import type { LaunchTask, UpdateTaskBodyStatus, UpdateTaskBodyRiskLevel, PhaseWithTasks, TaskQuote, PhaseTimeline, ProjectTimeline } from "@workspace/api-client-react";
import { formatGBP } from "@/lib/format";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Pencil, AlertCircle, Plus, X, Trash2, CalendarDays, Save, List, GanttChartSquare, ChevronRight, ChevronDown, RotateCcw, Loader2, ZoomIn, ZoomOut, FileText, Copy, Check, Sparkles, Send, Building2, Phone, Mail, Receipt, PoundSterling, Search, CheckCircle2, Clock, Tag, ArrowRightLeft, Calendar, Flag, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

const PROJECT_ID = 1;

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  complete: "bg-primary/20 text-primary",
  blocked: "bg-destructive/20 text-destructive",
  deferred: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  critical: "bg-destructive/20 text-destructive",
};

const PHASE_PALETTE = [
  { bar: "#6d28d9", bg: "#f5f3ff", border: "#c4b5fd" },
  { bar: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" },
  { bar: "#0e7490", bg: "#ecfeff", border: "#67e8f9" },
  { bar: "#059669", bg: "#ecfdf5", border: "#6ee7b7" },
  { bar: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  { bar: "#be123c", bg: "#fff1f2", border: "#fda4af" },
  { bar: "#4338ca", bg: "#eef2ff", border: "#a5b4fc" },
];

const GANTT_NAME_W = 264;
const GANTT_ROW_H = 34;

const VAT_LABEL: Record<string, string> = {
  inc_vat: "Inc. VAT (20% included)",
  ex_vat: "Ex. VAT (+20% on top)",
  vat_na: "No VAT applicable",
  vat_unknown: "VAT unclear — needs confirmation",
};
const SCOPE_LABEL: Record<string, string> = {
  client_supplied: "Client supplied",
  contractor_supplied: "Contractor supplied",
  included_in_package: "Included in package",
  excluded: "Excluded from budget",
  to_confirm: "To confirm",
};
const PROC_LABEL: Record<string, string> = {
  not_required: "Not required",
  approved: "Approved",
  quote_received: "Quote received",
  to_quote: "To quote",
  to_specify: "To specify",
  included_in_contractor_pkg: "Included in contractor pkg",
};

function TRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-[11px] text-muted-foreground col-span-1 whitespace-nowrap">{label}</span>
      <span className="text-[11px] font-medium col-span-1">{value}</span>
    </>
  );
}

function TaskDetailTooltip({ task, children }: { task: LaunchTask; children: React.ReactNode }) {
  const t = task as any;
  const hasCosts = (task.costLow ?? 0) > 0 || (task.costMid ?? 0) > 0 || (task.costHigh ?? 0) > 0;
  return (
    <TooltipProvider delayDuration={350}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={8}
          className="max-w-[300px] p-0 bg-popover text-popover-foreground border border-border shadow-xl rounded-lg z-50"
        >
          <div className="p-3 space-y-2 text-left">
            <p className="font-semibold text-[13px] leading-snug">{task.title}</p>
            {task.description && (
              <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border pt-2">{task.description}</p>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-2">
              {t.costVatStatus && t.costVatStatus !== "vat_unknown" && <TRow label="VAT" value={VAT_LABEL[t.costVatStatus] ?? t.costVatStatus} />}
              {t.costVatStatus === "vat_unknown" && <TRow label="VAT" value="⚠ Needs clarification" />}
              {t.supplyScope && t.supplyScope !== "to_confirm" && <TRow label="Supply" value={SCOPE_LABEL[t.supplyScope] ?? t.supplyScope} />}
              {t.procurementStatus && t.procurementStatus !== "to_specify" && <TRow label="Procurement" value={PROC_LABEL[t.procurementStatus] ?? t.procurementStatus} />}
              {task.owner && <TRow label="Owner" value={task.owner} />}
              {task.durationDays ? <TRow label="Duration" value={`${task.durationDays} day${task.durationDays !== 1 ? "s" : ""}`} /> : null}
              {task.riskLevel && task.riskLevel !== "low" && <TRow label="Risk" value={task.riskLevel.charAt(0).toUpperCase() + task.riskLevel.slice(1)} />}
            </div>
            {hasCosts && (
              <div className="border-t border-border pt-2 flex gap-4 text-xs">
                {(task.costLow ?? 0) > 0 && <span><span className="text-muted-foreground">Low </span><span className="font-medium">{formatGBP(task.costLow)}</span></span>}
                {(task.costMid ?? 0) > 0 && <span><span className="text-muted-foreground">Mid </span><span className="font-medium">{formatGBP(task.costMid)}</span></span>}
                {(task.costHigh ?? 0) > 0 && <span><span className="text-muted-foreground">High </span><span className="font-medium">{formatGBP(task.costHigh)}</span></span>}
              </div>
            )}
            {(task.isNonNegotiable || task.isCriticalRisk) && (
              <div className="border-t border-border pt-2 flex gap-1.5 flex-wrap">
                {task.isNonNegotiable && <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">Must Do</span>}
                {task.isCriticalRisk && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">⚠ Critical Risk</span>}
              </div>
            )}
            {task.notes && (
              <p className="text-[11px] text-muted-foreground border-t border-border pt-2 italic leading-relaxed">{task.notes}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
const GANTT_PHASE_H = 30;
const GANTT_HEADER_H = 42;
const GANTT_LS_KEY = "clinic_gantt_offsets_v1";

interface GanttProps {
  phases: PhaseWithTasks[];
  startDateObj: Date | null;
  updateTask: ReturnType<typeof useUpdateTask>;
  invalidateAfterTaskChange: () => void;
  onTaskClick: (task: LaunchTask) => void;
}

function GanttView({ phases, startDateObj, updateTask, invalidateAfterTaskChange, onTaskClick }: GanttProps) {
  const [dayWidth, setDayWidth] = useState(9);
  // taskOffsets: absolute day offset from project day-0 for each task (overrides computed phase start)
  const [taskOffsets, setTaskOffsets] = useState<Record<number, number>>({});
  // localDurations: optimistic duration updates before API confirms
  const [localDurations, setLocalDurations] = useState<Record<number, number>>({});
  const [collapsedPhases, setCollapsedPhases] = useState<Set<number>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [groupByPhase, setGroupByPhase] = useState(true);

  // Gantt visible date range — user-controlled
  const [ganttViewStartStr, setGanttViewStartStr] = useState<string>(() => {
    let earliest = "2026-05-07";
    for (const phase of phases) {
      for (const t of phase.tasks ?? []) {
        if (t.startDate && t.startDate < earliest) earliest = t.startDate;
      }
    }
    return earliest;
  });
  const [ganttViewEndStr, setGanttViewEndStr] = useState<string>("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    taskId: number;
    task: LaunchTask;
    type: "move" | "resize";
    startX: number;
    origValue: number;
    phaseStart: number;
    hasDragged: boolean;
  } | null>(null);

  // Load offsets from localStorage on mount
  useEffect(() => {
    try {
      const s = localStorage.getItem(GANTT_LS_KEY);
      if (s) setTaskOffsets(JSON.parse(s));
    } catch { /* ignore */ }
  }, []);

  // Persist offsets whenever they change
  useEffect(() => {
    try { localStorage.setItem(GANTT_LS_KEY, JSON.stringify(taskOffsets)); } catch { /* ignore */ }
  }, [taskOffsets]);

  const sortedPhases = useMemo(
    () => [...phases].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [phases],
  );

  const getTaskDuration = useCallback(
    (t: LaunchTask) => localDurations[t.id] ?? t.durationDays ?? 1,
    [localDurations],
  );

  // Resolve absolute start day for a task relative to the user-selected ganttViewStartStr.
  const getTaskAbsStart = useCallback(
    (t: LaunchTask, phaseStart: number): number => {
      if (t.startDate && ganttViewStartStr) {
        const s = new Date(t.startDate + "T00:00:00");
        const b = new Date(ganttViewStartStr + "T00:00:00");
        return Math.round((s.getTime() - b.getTime()) / 86400000);
      }
      return taskOffsets[t.id] ?? phaseStart;
    },
    [ganttViewStartStr, taskOffsets],
  );

  // Phase start day = sum of max-duration of all preceding phases.
  // A task's position within the Gantt = taskOffsets[id] if set, else phaseStartDay[phaseId].
  const phaseStartDays = useMemo<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    let cursor = 0;
    for (const phase of sortedPhases) {
      map[phase.id] = cursor;
      // phase duration = max end-day of any of its tasks (relative to cursor)
      const phaseEnd = phase.tasks?.reduce((maxEnd, t) => {
        const tAbsStart = getTaskAbsStart(t, cursor);
        const tEnd = tAbsStart + getTaskDuration(t) - cursor;
        return Math.max(maxEnd, tEnd);
      }, 0) ?? 0;
      cursor += Math.max(1, phaseEnd);
    }
    return map;
  }, [sortedPhases, getTaskAbsStart, getTaskDuration]);

  const totalDays = useMemo(() => {
    if (ganttViewEndStr) {
      const end = new Date(ganttViewEndStr + "T00:00:00");
      const start = new Date((ganttViewStartStr || "2026-05-07") + "T00:00:00");
      const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
      return Math.max(90, diff + 14);
    }
    let max = 90;
    for (const phase of sortedPhases) {
      const phaseStart = phaseStartDays[phase.id] ?? 0;
      for (const t of phase.tasks ?? []) {
        max = Math.max(max, getTaskAbsStart(t, phaseStart) + getTaskDuration(t));
      }
    }
    return max + 28;
  }, [ganttViewStartStr, ganttViewEndStr, sortedPhases, phaseStartDays, getTaskAbsStart, getTaskDuration]);

  const baseDate = new Date((ganttViewStartStr || "2026-05-07") + "T00:00:00");

  // How many days from baseDate to today (for the "today" marker line)
  const todayDay = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const base = new Date(baseDate);
    base.setHours(0, 0, 0, 0);
    return Math.round((now.getTime() - base.getTime()) / 86400000);
  }, [baseDate]);

  // Scroll to today on mount (and whenever the view first opens)
  useEffect(() => {
    if (!scrollRef.current) return;
    const scrollTarget = Math.max(0, todayDay * dayWidth - 180);
    scrollRef.current.scrollLeft = scrollTarget;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekMarkers = useMemo(() => {
    const marks: { day: number; label: string }[] = [];
    for (let d = 0; d <= totalDays; d += 7) {
      const date = addDays(baseDate, d);
      marks.push({
        day: d,
        label: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      });
    }
    return marks;
  }, [totalDays, baseDate]);

  const monthMarkers = useMemo(() => {
    const marks: { day: number; label: string }[] = [];
    const start = new Date(baseDate);
    start.setDate(1); // rewind to 1st of the current month
    let d = Math.ceil((start.getTime() - baseDate.getTime()) / 86400000);
    // If the 1st of the month is before baseDate (e.g. project starts on the 11th),
    // clamp to 0 so the current month label still appears at the left edge.
    if (d < 0) d = 0;
    while (d <= totalDays) {
      const date = addDays(baseDate, d);
      marks.push({
        day: d,
        label: date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      });
      // Advance to the 1st of the next month
      const next = new Date(date);
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      d = Math.round((next.getTime() - baseDate.getTime()) / 86400000);
    }
    return marks;
  }, [totalDays, baseDate]);

  // ─── Drag handling ───────────────────────────────────────────────
  const handleBarMouseDown = useCallback((
    e: React.MouseEvent,
    task: LaunchTask,
    type: "move" | "resize",
    origValue: number,
    phaseStart: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { taskId: task.id, task, type, startX: e.clientX, origValue, phaseStart, hasDragged: false };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      if (Math.abs(dx) > 4) dragRef.current.hasDragged = true;
      const daysDelta = Math.round(dx / dayWidth);
      const { taskId, type, origValue, phaseStart } = dragRef.current;

      if (type === "resize") {
        setLocalDurations(prev => ({ ...prev, [taskId]: Math.max(1, origValue + daysDelta) }));
      } else {
        setTaskOffsets(prev => ({ ...prev, [taskId]: Math.max(phaseStart, origValue + daysDelta) }));
      }
    };

    const onUp = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const { taskId, task, type, origValue, hasDragged } = dragRef.current;
      const dx = ev.clientX - dragRef.current.startX;
      const daysDelta = Math.round(dx / dayWidth);

      // Click without drag → open task editor
      if (!hasDragged && type === "move") {
        dragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        onTaskClick(task);
        return;
      }

      if (type === "resize") {
        const newDur = Math.max(1, origValue + daysDelta);
        setSavingIds(s => new Set([...s, taskId]));
        // If task has a startDate, derive the new dueDate from startDate + newDur
        const resizePatch: Record<string, unknown> = { durationDays: newDur };
        if (task.startDate) {
          const newDue = addDays(new Date(task.startDate), newDur);
          resizePatch.dueDate = newDue.toISOString().split("T")[0];
        }
        updateTask.mutate(
          { id: taskId, data: resizePatch as Parameters<typeof updateTask.mutate>[0]["data"] },
          {
            onSuccess: () => {
              invalidateAfterTaskChange();
              setLocalDurations(prev => { const n = { ...prev }; delete n[taskId]; return n; });
              setSavingIds(s => { const n = new Set(s); n.delete(taskId); return n; });
            },
            onError: () => {
              setLocalDurations(prev => { const n = { ...prev }; delete n[taskId]; return n; });
              setSavingIds(s => { const n = new Set(s); n.delete(taskId); return n; });
            },
          },
        );
      } else if (hasDragged) {
        // Move drag: save startDate to DB (replaces localStorage-only approach)
        const newAbsStart = Math.max(phaseStart, origValue + daysDelta);
        const newStartDate = addDays(new Date(baseDate), newAbsStart);
        const startDateStr = newStartDate.toISOString().split("T")[0];
        const movePatch: Record<string, unknown> = { startDate: startDateStr };
        // Also update dueDate to keep duration intact
        const dur = task.durationDays ?? 0;
        if (dur > 0) {
          movePatch.dueDate = addDays(newStartDate, dur).toISOString().split("T")[0];
        }
        setSavingIds(s => new Set([...s, taskId]));
        updateTask.mutate(
          { id: taskId, data: movePatch as Parameters<typeof updateTask.mutate>[0]["data"] },
          {
            onSuccess: () => {
              invalidateAfterTaskChange();
              // Remove the localStorage offset since DB now holds the position
              setTaskOffsets(prev => { const n = { ...prev }; delete n[taskId]; return n; });
              setSavingIds(s => { const n = new Set(s); n.delete(taskId); return n; });
            },
            onError: () => {
              setSavingIds(s => { const n = new Set(s); n.delete(taskId); return n; });
            },
          },
        );
      }

      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [dayWidth, baseDate, updateTask, invalidateAfterTaskChange, onTaskClick]);

  const totalWidth = totalDays * dayWidth;

  // Phase-colour-based bar opacity by status (bars always use phase colour)
  const statusBarOpacity: Record<string, number> = {
    complete:    0.92,
    in_progress: 0.80,
    blocked:     0.80,
    deferred:    0.28,
    not_started: 0.58,
  };
  // Left-edge accent colour to indicate status on top of phase colour
  const statusAccent: Record<string, string | null> = {
    complete:    "rgba(255,255,255,0.55)",
    in_progress: null,
    blocked:     "#ef4444",
    deferred:    null,
    not_started: null,
  };

  // Flat view: all tasks across phases sorted by absolute start day
  const flatTasks = useMemo(() => {
    const rows: { task: LaunchTask; phase: PhaseWithTasks; phaseIdx: number; phaseStart: number; color: typeof PHASE_PALETTE[0] }[] = [];
    for (let i = 0; i < sortedPhases.length; i++) {
      const phase = sortedPhases[i];
      const phaseStart = phaseStartDays[phase.id] ?? 0;
      const color = PHASE_PALETTE[i % PHASE_PALETTE.length];
      for (const task of phase.tasks ?? []) {
        rows.push({ task, phase, phaseIdx: i, phaseStart, color });
      }
    }
    return rows.sort((a, b) => {
      const aStart = getTaskAbsStart(a.task, a.phaseStart);
      const bStart = getTaskAbsStart(b.task, b.phaseStart);
      return aStart - bStart;
    });
  }, [sortedPhases, phaseStartDays, getTaskAbsStart]);

  return (
    <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/30 flex-wrap">
        <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
        <Slider
          value={[dayWidth]}
          onValueChange={([v]) => setDayWidth(v)}
          min={4} max={28} step={1}
          className="w-32"
        />
        <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{dayWidth}px / day</span>
        <div className="h-4 w-px bg-border mx-1" />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          <span className="shrink-0">From</span>
          <input
            type="date"
            value={ganttViewStartStr}
            onChange={e => setGanttViewStartStr(e.target.value)}
            className="rounded border border-input bg-background px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0">To</span>
          <input
            type="date"
            value={ganttViewEndStr}
            onChange={e => setGanttViewEndStr(e.target.value)}
            className="rounded border border-input bg-background px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="hidden lg:inline">Drag bar to move · drag right edge to resize</span>
          <button
            onClick={() => setGroupByPhase(v => !v)}
            className={`flex items-center gap-1 border rounded px-2 py-0.5 transition-colors ${groupByPhase ? "hover:text-foreground" : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"}`}
            title={groupByPhase ? "Switch to flat chronological view" : "Switch to grouped by phase view"}
          >
            {groupByPhase
              ? <><svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="9" x2="11" y2="9"/></svg> Flat view</>
              : <><svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="4" height="3" rx="0.5"/><line x1="7" y1="2.5" x2="11" y2="2.5"/><rect x="1" y="5" width="4" height="3" rx="0.5"/><line x1="7" y1="6.5" x2="11" y2="6.5"/></svg> Group by phase</>
            }
          </button>
          <button
            onClick={() => {
              setTaskOffsets({});
              try { localStorage.removeItem(GANTT_LS_KEY); } catch { /* ignore */ }
            }}
            className="flex items-center gap-1 hover:text-foreground transition-colors border rounded px-2 py-0.5"
          >
            <RotateCcw className="w-3 h-3" /> Reset positions
          </button>
        </div>
      </div>

      {/* Chart */}
      <div ref={scrollRef} style={{ overflowX: "auto", overflowY: "auto", maxHeight: "68vh" }}>
        <div style={{ width: GANTT_NAME_W + totalWidth, minWidth: "100%" }}>

          {/* ── Header row ── */}
          <div style={{
            display: "flex",
            position: "sticky", top: 0, zIndex: 30,
            borderBottom: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            height: GANTT_HEADER_H,
          }}>
            {/* Corner cell */}
            <div style={{
              width: GANTT_NAME_W, flexShrink: 0,
              position: "sticky", left: 0, zIndex: 31,
              background: "hsl(var(--card))",
              borderRight: "1px solid hsl(var(--border))",
              display: "flex", alignItems: "center", padding: "0 14px",
            }}>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Task</span>
            </div>
            {/* Month + week markers */}
            <div style={{ flex: 1, position: "relative", background: "hsl(var(--muted)/0.5)" }}>
              {/* Month bands */}
              {monthMarkers.map((m, i) => {
                const nextDay = monthMarkers[i + 1]?.day ?? totalDays;
                const w = (nextDay - m.day) * dayWidth;
                return (
                  <div key={m.day} style={{
                    position: "absolute", left: m.day * dayWidth, top: 0,
                    width: w, height: "50%",
                    borderLeft: "1px solid hsl(var(--border))",
                    display: "flex", alignItems: "center", paddingLeft: 6,
                  }}>
                    <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 600, whiteSpace: "nowrap" }}>{m.label}</span>
                  </div>
                );
              })}
              {/* Week ticks */}
              {weekMarkers.map(wk => (
                <div key={wk.day} style={{
                  position: "absolute", left: wk.day * dayWidth,
                  top: "50%", height: "50%",
                  borderLeft: "1px solid hsl(var(--border)/0.6)",
                  display: "flex", alignItems: "center", paddingLeft: 4,
                }}>
                  <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>{wk.label}</span>
                </div>
              ))}
              {/* Today marker line in header */}
              {todayDay >= 0 && todayDay <= totalDays && (
                <div style={{
                  position: "absolute", left: todayDay * dayWidth,
                  top: 0, bottom: 0, width: 2,
                  background: "#dc2626", opacity: 0.85,
                  pointerEvents: "none", zIndex: 5,
                }} />
              )}
            </div>
          </div>

          {/* ── Phase + task rows ── */}
          {!groupByPhase && flatTasks.map(({ task, phase, phaseIdx, phaseStart, color }) => {
            const absStart = getTaskAbsStart(task, phaseStart);
            const dur = getTaskDuration(task);
            const barW = Math.max(8, dur * dayWidth);
            const isSaving = savingIds.has(task.id);
            const barOpacity = statusBarOpacity[task.status] ?? 0.65;
            const accent = statusAccent[task.status];

            return (
              <div key={task.id} style={{ display: "flex", height: GANTT_ROW_H, borderBottom: "1px solid hsl(var(--border)/0.35)" }}>
                {/* Task name (sticky) */}
                <div
                  style={{
                    width: GANTT_NAME_W, flexShrink: 0,
                    position: "sticky", left: 0, zIndex: 10,
                    background: "hsl(var(--card))",
                    borderRight: "1px solid hsl(var(--border)/0.5)",
                    borderLeft: `3px solid ${color.bar}`,
                    display: "flex", alignItems: "center",
                    padding: "0 10px 0 10px", gap: 6,
                    cursor: "pointer",
                  }}
                  onClick={() => onTaskClick(task)}
                  title={`${phase.name} · Click to edit`}
                >
                  <span style={{ fontSize: 10, color: color.bar, fontWeight: 700, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 56 }}
                    title={phase.name}>{phase.name.replace(/^Phase \d+[\s:–-]*/i, "").trim() || phase.name}</span>
                  <span style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, color: "hsl(var(--foreground))" }} title={task.title}>
                    {task.title}
                  </span>
                  {isSaving && <Loader2 className="w-3 h-3 animate-spin shrink-0 text-muted-foreground" />}
                </div>
                {/* Timeline area */}
                <div style={{ flex: 1, position: "relative", background: "hsl(var(--background))" }}>
                  {weekMarkers.map(wk => (
                    <div key={wk.day} style={{ position: "absolute", left: wk.day * dayWidth, top: 0, bottom: 0, borderLeft: "1px solid hsl(var(--border)/0.2)", pointerEvents: "none" }} />
                  ))}
                  {todayDay >= 0 && todayDay <= totalDays && (
                    <div style={{ position: "absolute", left: todayDay * dayWidth, top: 0, bottom: 0, width: 2, background: "#dc2626", opacity: 0.35, pointerEvents: "none" }} />
                  )}
                  <div
                    title={`${task.title}\n${task.startDate ? `${task.startDate} → ${task.dueDate?.split("T")[0] ?? "?"}` : `Day ${absStart}–${absStart + dur}`} · ${dur} day${dur !== 1 ? "s" : ""}`}
                    style={{
                      position: "absolute",
                      left: absStart * dayWidth,
                      top: 4, height: GANTT_ROW_H - 8,
                      width: barW,
                      background: color.bar,
                      opacity: barOpacity,
                      borderRadius: 4,
                      cursor: "grab",
                      display: "flex", alignItems: "center",
                      paddingLeft: 7, paddingRight: 10,
                      overflow: "hidden",
                      userSelect: "none",
                      boxShadow: isSaving ? `0 0 0 2px ${color.bar}` : "0 1px 3px rgba(0,0,0,0.15)",
                    }}
                    onMouseDown={e => handleBarMouseDown(e, task, "move", absStart, phaseStart)}
                  >
                    {accent && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent, borderRadius: "4px 0 0 4px" }} />}
                    {barW > 36 && (
                      <span style={{ color: "white", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, pointerEvents: "none", paddingLeft: accent ? 4 : 0 }}>
                        {task.status === "complete" ? "✓ " : task.status === "blocked" ? "! " : ""}{task.title}
                      </span>
                    )}
                    {barW > 70 && (
                      <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, flexShrink: 0, marginLeft: 4, pointerEvents: "none" }}>{dur}d</span>
                    )}
                    <div
                      style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 9, cursor: "ew-resize", background: "rgba(0,0,0,0.18)", borderRadius: "0 4px 4px 0", display: "flex", alignItems: "center", justifyContent: "center" }}
                      onMouseDown={e => { e.stopPropagation(); handleBarMouseDown(e, task, "resize", dur, phaseStart); }}
                    >
                      <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.5)" }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {groupByPhase && sortedPhases.map((phase, phaseIdx) => {
            const color = PHASE_PALETTE[phaseIdx % PHASE_PALETTE.length];
            const phaseStart = phaseStartDays[phase.id] ?? 0;
            const isCollapsed = collapsedPhases.has(phase.id);

            // Phase bar: from phaseStart to latest task end
            const phaseEndDay = (phase.tasks ?? []).reduce((maxEnd, t) => {
              const absStart = getTaskAbsStart(t, phaseStart);
              return Math.max(maxEnd, absStart + getTaskDuration(t));
            }, phaseStart);
            const phaseBarW = Math.max(dayWidth, (phaseEndDay - phaseStart) * dayWidth);

            return (
              <div key={phase.id}>
                {/* Phase header row */}
                <div
                  style={{
                    display: "flex", height: GANTT_PHASE_H, cursor: "pointer",
                    borderBottom: "1px solid hsl(var(--border))",
                    background: color.bg,
                  }}
                  onClick={() => setCollapsedPhases(prev => {
                    const n = new Set(prev);
                    if (n.has(phase.id)) n.delete(phase.id); else n.add(phase.id);
                    return n;
                  })}
                >
                  {/* Phase name (sticky) */}
                  <div style={{
                    width: GANTT_NAME_W, flexShrink: 0,
                    position: "sticky", left: 0, zIndex: 10,
                    background: color.bg,
                    borderRight: `2px solid ${color.bar}`,
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "0 10px 0 12px",
                  }}>
                    {isCollapsed
                      ? <ChevronRight className="w-3 h-3 shrink-0" style={{ color: color.bar }} />
                      : <ChevronDown className="w-3 h-3 shrink-0" style={{ color: color.bar }} />
                    }
                    <span style={{ fontSize: 11, fontWeight: 700, color: color.bar, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {phase.name}
                    </span>
                    <span style={{ fontSize: 10, color: color.bar, opacity: 0.65, marginLeft: "auto", flexShrink: 0 }}>
                      {phase.completedTaskCount}/{phase.taskCount}
                    </span>
                  </div>
                  {/* Phase timeline bar */}
                  <div style={{ flex: 1, position: "relative" }}>
                    {weekMarkers.map(wk => (
                      <div key={wk.day} style={{ position: "absolute", left: wk.day * dayWidth, top: 0, bottom: 0, borderLeft: "1px solid hsl(var(--border)/0.25)", pointerEvents: "none" }} />
                    ))}
                    <div style={{
                      position: "absolute",
                      left: phaseStart * dayWidth,
                      top: 5, height: GANTT_PHASE_H - 10,
                      width: phaseBarW,
                      background: color.bar, opacity: 0.18,
                      borderRadius: 4,
                    }} />
                  </div>
                </div>

                {/* Task rows */}
                {!isCollapsed && (phase.tasks ?? []).map(task => {
                  const absStart = getTaskAbsStart(task, phaseStart);
                  const dur = getTaskDuration(task);
                  const barW = Math.max(8, dur * dayWidth);
                  const isSaving = savingIds.has(task.id);
                  const barColor = color.bar;
                  const barOpacity = statusBarOpacity[task.status] ?? 0.65;
                  const accent = statusAccent[task.status];

                  return (
                    <div key={task.id} style={{ display: "flex", height: GANTT_ROW_H, borderBottom: "1px solid hsl(var(--border)/0.35)" }}>
                      {/* Task name (sticky) — click to open editor */}
                      <div
                        style={{
                          width: GANTT_NAME_W, flexShrink: 0,
                          position: "sticky", left: 0, zIndex: 10,
                          background: "hsl(var(--card))",
                          borderRight: "1px solid hsl(var(--border)/0.5)",
                          display: "flex", alignItems: "center",
                          padding: "0 10px 0 28px", gap: 4,
                          cursor: "pointer",
                        }}
                        onClick={() => onTaskClick(task)}
                        title="Click to edit task"
                      >
                        <span style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={task.title}>
                          {task.title}
                        </span>
                        {isSaving && <Loader2 className="w-3 h-3 animate-spin shrink-0 text-muted-foreground" />}
                      </div>

                      {/* Timeline area */}
                      <div style={{ flex: 1, position: "relative", background: "hsl(var(--background))" }}>
                        {/* Grid lines */}
                        {weekMarkers.map(wk => (
                          <div key={wk.day} style={{ position: "absolute", left: wk.day * dayWidth, top: 0, bottom: 0, borderLeft: "1px solid hsl(var(--border)/0.2)", pointerEvents: "none" }} />
                        ))}
                        {/* Today marker */}
                        {todayDay >= 0 && todayDay <= totalDays && (
                          <div style={{ position: "absolute", left: todayDay * dayWidth, top: 0, bottom: 0, width: 2, background: "#dc2626", opacity: 0.35, pointerEvents: "none" }} />
                        )}

                        {/* Task bar */}
                        <div
                          title={`${task.title}\n${task.startDate ? `${task.startDate} → ${task.dueDate?.split("T")[0] ?? "?"}` : `Day ${absStart}–${absStart + dur}`} · ${dur} day${dur !== 1 ? "s" : ""}\nDrag to reposition, drag right edge to resize`}
                          style={{
                            position: "absolute",
                            left: absStart * dayWidth,
                            top: 4, height: GANTT_ROW_H - 8,
                            width: barW,
                            background: barColor,
                            opacity: barOpacity,
                            borderRadius: 4,
                            cursor: "grab",
                            display: "flex", alignItems: "center",
                            paddingLeft: 7, paddingRight: 10,
                            overflow: "hidden",
                            userSelect: "none",
                            boxShadow: isSaving ? `0 0 0 2px ${barColor}` : "0 1px 3px rgba(0,0,0,0.15)",
                          }}
                          onMouseDown={e => handleBarMouseDown(e, task, "move", absStart, phaseStart)}
                        >
                          {accent && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent, borderRadius: "4px 0 0 4px" }} />}
                          {barW > 36 && (
                            <span style={{ color: "white", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, pointerEvents: "none", paddingLeft: accent ? 4 : 0 }}>
                              {task.status === "complete" ? "✓ " : task.status === "blocked" ? "! " : ""}{task.title}
                            </span>
                          )}
                          {barW > 70 && (
                            <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, flexShrink: 0, marginLeft: 4, pointerEvents: "none" }}>
                              {dur}d
                            </span>
                          )}
                          {/* Resize handle */}
                          <div
                            title="Drag to resize duration"
                            style={{
                              position: "absolute", right: 0, top: 0, bottom: 0, width: 9,
                              cursor: "ew-resize",
                              background: "rgba(0,0,0,0.18)",
                              borderRadius: "0 4px 4px 0",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                            onMouseDown={e => { e.stopPropagation(); handleBarMouseDown(e, task, "resize", dur, phaseStart); }}
                          >
                            <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.5)" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-x-4 gap-y-1.5 px-4 py-2 border-t bg-muted/20 flex-wrap">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mr-1">Phases:</span>
        {sortedPhases.map((phase, i) => {
          const c = PHASE_PALETTE[i % PHASE_PALETTE.length];
          return (
            <div key={phase.id} className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c.bar }} />
              <span className="text-[10px] text-muted-foreground">{phase.name}</span>
            </div>
          );
        })}
        <div className="w-px h-3 bg-border mx-1" />
        <span className="text-[10px] text-muted-foreground">Opacity: <b>full</b> = complete · <b>mid</b> = in progress/blocked · <b>faint</b> = deferred</span>
        <span className="text-[10px] text-muted-foreground">· ✓ complete · ! blocked</span>
      </div>
    </div>
  );
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface PhaseWindow {
  mustEndBy: Date;
  mustStartBy: Date;
  estimatedEnd: Date;
  totalDays: number;
  status: "on_track" | "tight" | "overdue" | "unknown";
}

// Phases 1–3 (by sortOrder) form the sequential property/legal track.
// Phases 4+ run in parallel from Day 1 — they don't depend on the property track finishing.
const SEQUENTIAL_PHASE_COUNT = 3;

function computePhaseWindows(
  phases: PhaseWithTasks[],
  startDate: Date | null,
  openDate: Date | null,
): Map<number, PhaseWindow> {
  const sorted = [...phases].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const map = new Map<number, PhaseWindow>();

  // Use the longest task per phase as the phase duration — tasks run in parallel within a phase.
  const phaseDays = (phase: PhaseWithTasks) =>
    Math.max(0, ...(phase.tasks?.map(t => t.durationDays ?? 0) ?? [0]));

  // Backward pass: sequential phases (1–3) chain backwards from open date.
  // Parallel phases (4+) each must finish by open date but can start from Day 1.
  const backward = new Map<number, { mustEndBy: Date; mustStartBy: Date; totalDays: number }>();
  if (openDate) {
    let deadline = new Date(openDate);
    for (const phase of [...sorted.slice(0, SEQUENTIAL_PHASE_COUNT)].reverse()) {
      const totalDays = phaseDays(phase);
      const mustEndBy = new Date(deadline);
      const mustStartBy = addDays(deadline, -totalDays);
      backward.set(phase.id, { mustEndBy, mustStartBy, totalDays });
      deadline = new Date(mustStartBy);
    }
    for (const phase of sorted.slice(SEQUENTIAL_PHASE_COUNT)) {
      const totalDays = phaseDays(phase);
      const mustEndBy = new Date(openDate);
      const mustStartBy = startDate ? new Date(startDate) : addDays(openDate, -totalDays);
      backward.set(phase.id, { mustEndBy, mustStartBy, totalDays });
    }
  }

  // Forward pass: sequential phases chain from start date; parallel phases start from Day 1.
  const forward = new Map<number, { estimatedEnd: Date }>();
  if (startDate) {
    let cursor = new Date(startDate);
    for (let i = 0; i < sorted.length; i++) {
      const phase = sorted[i];
      const totalDays = phaseDays(phase);
      if (i < SEQUENTIAL_PHASE_COUNT) {
        const estimatedEnd = addDays(cursor, totalDays);
        forward.set(phase.id, { estimatedEnd });
        cursor = estimatedEnd;
      } else {
        // Parallel track: starts from Day 1 (startDate), ends after its own duration
        forward.set(phase.id, { estimatedEnd: addDays(startDate, totalDays) });
      }
    }
  }

  for (const phase of sorted) {
    const bw = backward.get(phase.id);
    const fw = forward.get(phase.id);
    const totalDays = phaseDays(phase);

    let status: PhaseWindow["status"] = "unknown";
    if (bw && fw) {
      const diffDays = Math.floor((bw.mustEndBy.getTime() - fw.estimatedEnd.getTime()) / 86400000);
      if (diffDays < 0) status = "overdue";
      else if (diffDays < 14) status = "tight";
      else status = "on_track";
    }

    map.set(phase.id, {
      mustEndBy: bw?.mustEndBy ?? new Date(),
      mustStartBy: bw?.mustStartBy ?? new Date(),
      estimatedEnd: fw?.estimatedEnd ?? new Date(),
      totalDays,
      status,
    });
  }
  return map;
}

// ─── Timeline view components ────────────────────────────────────────────────

const PHASE_BAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
];
const PHASE_BAR_COLORS_LIGHT = [
  "#e0e7ff", "#ede9fe", "#fce7f3", "#fef3c7",
  "#d1fae5", "#dbeafe", "#fee2e2", "#ccfbf1",
];

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000,
  );
}

function TimelineGanttChart({ phases }: { phases: PhaseTimeline[] }) {
  if (!phases.length) return null;

  const allStart = phases.map((p) => p.startDate).sort()[0];
  const allEnd = phases.map((p) => p.endDate).sort().reverse()[0];
  const totalDays = Math.max(1, daysBetween(allStart, allEnd));

  return (
    <div className="space-y-2">
      {/* Header: month markers */}
      <div className="relative h-6 ml-40 border-b border-border">
        {(() => {
          const markers: React.ReactNode[] = [];
          const start = new Date(allStart + "T00:00:00");
          const d = new Date(start.getFullYear(), start.getMonth(), 1);
          while (d <= new Date(allEnd + "T00:00:00")) {
            const offset = Math.max(0, Math.round((d.getTime() - start.getTime()) / 86400000));
            const pct = (offset / totalDays) * 100;
            if (pct <= 100) {
              markers.push(
                <span
                  key={d.toISOString()}
                  className="absolute text-[10px] text-muted-foreground whitespace-nowrap"
                  style={{ left: `${pct}%` }}
                >
                  {d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
                </span>,
              );
            }
            d.setMonth(d.getMonth() + 1);
          }
          return markers;
        })()}
      </div>

      {/* Phase rows */}
      {phases.map((phase, idx) => {
        const barStart = Math.max(0, daysBetween(allStart, phase.startDate));
        const barLen = Math.max(1, daysBetween(phase.startDate, phase.endDate));
        const leftPct = (barStart / totalDays) * 100;
        const widthPct = Math.min(100 - leftPct, (barLen / totalDays) * 100);
        const color = PHASE_BAR_COLORS[idx % PHASE_BAR_COLORS.length];
        const colorLight = PHASE_BAR_COLORS_LIGHT[idx % PHASE_BAR_COLORS_LIGHT.length];

        return (
          <div key={phase.id} className="flex items-center gap-2">
            <div className="w-40 shrink-0 text-right pr-2">
              <span className="text-xs font-medium text-foreground leading-tight line-clamp-2">
                {phase.name}
              </span>
            </div>
            <div className="flex-1 relative h-7 bg-muted/40 rounded">
              <div
                className="absolute top-1 bottom-1 rounded flex items-center px-2"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: colorLight,
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <span className="text-[10px] font-medium whitespace-nowrap overflow-hidden" style={{ color }}>
                  {formatDateShort(phase.startDate)} – {formatDateShort(phase.endDate)}
                </span>
              </div>
            </div>
            <div className="w-16 shrink-0 text-right text-[10px] text-muted-foreground">
              {phase.durationDays}d
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CriticalTaskList({ phases }: { phases: PhaseTimeline[] }) {
  const criticalPhases = phases.filter((p) => p.criticalTasks.length > 0);
  if (criticalPhases.length === 0) return null;

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-4">
      <p className="text-sm font-semibold flex items-center gap-2 text-destructive">
        <AlertTriangle className="w-4 h-4" />
        Critical Path Tasks
      </p>
      {criticalPhases.map((phase) => (
        <div key={phase.id}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {phase.name} — due by {formatDateShort(phase.endDate)}
          </p>
          <div className="space-y-1">
            {phase.criticalTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 text-sm py-1.5 px-3 bg-background rounded-md border border-destructive/20"
              >
                <Flag className="w-3 h-3 text-destructive shrink-0" />
                <span className="flex-1">{task.title}</span>
                {task.dueDate && (
                  <span className="text-[10px] text-muted-foreground">
                    Due {formatDateShort(task.dueDate)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineView({ projectId }: { projectId: number }) {
  const updateProject = useUpdateProject();
  const queryClient = useQueryClient();

  const { data: project, isLoading: isProjectLoading } = useGetProject(projectId, {
    query: { queryKey: getGetProjectQueryKey(projectId) },
  });

  const { data: timeline, isLoading: isTimelineLoading } = useGetProjectTimeline(projectId, {
    query: { queryKey: getGetProjectTimelineQueryKey(projectId) },
  });

  const [dateInput, setDateInput] = useState("");

  useEffect(() => {
    if (project?.targetOpeningDate) setDateInput(project.targetOpeningDate);
  }, [project?.targetOpeningDate]);

  const handleSaveDate = () => {
    if (!dateInput) return;
    updateProject.mutate(
      {
        id: projectId,
        data: {
          name: project?.name ?? "Winchester Clinic Opening Plan",
          targetOpeningDate: dateInput,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectTimelineQueryKey(projectId) });
        },
      },
    );
  };

  const isLoading = isProjectLoading || isTimelineLoading;

  return (
    <div className="space-y-6">
      {/* Target opening date editor */}
      <div className="flex items-center gap-3 p-4 rounded-xl border bg-card">
        <Calendar className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">Target Opening Date</p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
            />
            <button
              onClick={handleSaveDate}
              disabled={updateProject.isPending || dateInput === project?.targetOpeningDate}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
            >
              {updateProject.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        {timeline && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total timeline</p>
            <p className="text-sm font-semibold">{timeline.totalDays} days</p>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading timeline…</span>
        </div>
      )}

      {!isLoading && !timeline && (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Set a target opening date above to generate the timeline.</p>
        </div>
      )}

      {!isLoading && timeline && (
        <>
          {/* Gantt chart */}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold mb-4">Phase Schedule</p>
            <TimelineGanttChart phases={timeline.phases} />
          </div>

          {/* Phase summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {timeline.phases.map((phase, idx) => {
              const color = PHASE_BAR_COLORS[idx % PHASE_BAR_COLORS.length];
              return (
                <div key={phase.id} className="rounded-xl border bg-card p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <p className="text-xs font-semibold leading-snug">{phase.name}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDateShort(phase.startDate)} → {formatDateShort(phase.endDate)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {phase.durationDays} days · {phase.taskCount} task{phase.taskCount !== 1 ? "s" : ""}
                    {phase.criticalTasks.length > 0 && (
                      <span className="ml-2 text-destructive font-medium">
                        {phase.criticalTasks.length} critical
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Critical tasks */}
          <CriticalTaskList phases={timeline.phases} />
        </>
      )}
    </div>
  );
}

export default function ProjectPage() {
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState<LaunchTask | null>(null);
  const [addingTaskPhaseId, setAddingTaskPhaseId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ganttKey, setGanttKey] = useState(0);

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importApplying, setImportApplying] = useState(false);
  const [importApplied, setImportApplied] = useState(0);

  type ImportDiff = {
    taskId: number;
    title: string;
    changes: { field: string; from: string; to: string }[];
    patch: Record<string, unknown>;
    ganttOffset?: number;
  };
  const [importDiffs, setImportDiffs] = useState<ImportDiff[] | null>(null);
  const [importError, setImportError] = useState("");

  const [viewMode, setViewMode] = useState<"list" | "gantt" | "vat" | "timeline">("list");
  const [listGrouped, setListGrouped] = useState(true);
  const [listSortBy, setListSortBy] = useState<"startDate" | "dueDate">("startDate");
  const [localStartDate, setLocalStartDate] = useState("");
  const [localOpenDate, setLocalOpenDate] = useState("");
  const [datesDirty, setDatesDirty] = useState(false);
  const [viewMasterPlan, setViewMasterPlan] = useState(false);
  const [showRecordSpend, setShowRecordSpend] = useState(false);
  const [recordSpendData, setRecordSpendData] = useState({
    taskId: null as number | null,
    actualCost: "",
    committedCost: "",
    paidStatus: "paid",
    vatInclusive: "inc",
    invoiceRef: "",
    invoiceDate: "",
    varianceNote: "",
    invoiceFile: null as File | null,
    invoiceFileUrl: "",
    uploading: false,
  });

  const highlightedTaskId = (() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("taskId");
    return raw ? parseInt(raw) : null;
  })();

  const { data: project } = useGetProject(PROJECT_ID);
  const updateProject = useUpdateProject();
  const deleteTask = useDeleteTask();

  useEffect(() => {
    if (project) {
      setLocalStartDate(project.startDate ?? "");
      setLocalOpenDate(project.targetOpeningDate ?? "");
      setDatesDirty(false);
    }
  }, [project?.startDate, project?.targetOpeningDate]);

  const handleSaveDates = () => {
    updateProject.mutate(
      {
        id: PROJECT_ID,
        data: {
          name: project?.name ?? "Winchester Clinic Opening Plan",
          startDate: localStartDate || null,
          targetOpeningDate: localOpenDate || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}`] });
          queryClient.invalidateQueries({ queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) });
          setDatesDirty(false);
        },
      }
    );
  };

  const handleDeleteTask = (taskId: number) => {
    deleteTask.mutate(
      { id: taskId },
      {
        onSuccess: () => {
          queryClient.removeQueries({ queryKey: [phasesUrl] });
          queryClient.invalidateQueries({ queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) });
          queryClient.invalidateQueries({ queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID) });
          setConfirmDeleteId(null);
        },
      }
    );
  };

  const { data: properties } = useListProperties(PROJECT_ID, {
    query: { queryKey: getListPropertiesQueryKey(PROJECT_ID) },
  });
  const activeProperty = properties?.find((p) => p.isActiveForProject) ?? null;
  const activePropertyId = !viewMasterPlan && activeProperty ? activeProperty.id : null;

  const phasesUrl = activePropertyId
    ? `/api/projects/${PROJECT_ID}/phases-with-tasks?propertyId=${activePropertyId}`
    : `/api/projects/${PROJECT_ID}/phases-with-tasks`;

  const { data: phases, isLoading: isPhasesLoading } = useQuery<PhaseWithTasks[]>({
    queryKey: [phasesUrl],
    queryFn: async () => {
      const res = await fetch(phasesUrl);
      if (!res.ok) throw new Error(`phases-with-tasks fetch failed: ${res.status}`);
      return res.json() as Promise<PhaseWithTasks[]>;
    },
  });

  const pcUrl = `/api/projects/${PROJECT_ID}/project-controls`;
  const { data: projectControls } = useQuery({
    queryKey: [pcUrl],
    queryFn: async () => { const r = await fetch(pcUrl); if (!r.ok) throw new Error("project-controls failed"); return r.json(); },
    staleTime: 30000,
  });

  const { data: risks } = useGetRiskFlags(PROJECT_ID, {
    query: { queryKey: getGetRiskFlagsQueryKey(PROJECT_ID), enabled: true },
  });

  const [openPhases, setOpenPhases] = useState<string[]>([]);

  useEffect(() => {
    if (!highlightedTaskId || !phases) return;
    const phase = phases.find(p => p.tasks?.some(t => t.id === highlightedTaskId));
    if (phase) {
      setOpenPhases(prev => {
        const key = `phase-${phase.id}`;
        return prev.includes(key) ? prev : [...prev, key];
      });
      setTimeout(() => {
        const el = document.getElementById(`task-${highlightedTaskId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  }, [highlightedTaskId, phases]);

  const updateTask = useUpdateTask();

  const invalidateAfterTaskChange = () => {
    queryClient.removeQueries({ queryKey: [phasesUrl] });
    queryClient.removeQueries({ queryKey: [`/api/projects/${PROJECT_ID}/phases-with-tasks`] });
    queryClient.invalidateQueries({ queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) });
    queryClient.invalidateQueries({ queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID) });
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}/project-controls`] });
  };

  const handleCostTierChange = (task: LaunchTask, newTier: "low" | "mid" | "high") => {
    updateTask.mutate(
      { id: task.id, data: { costTier: newTier, ...(activePropertyId ? { propertyId: activePropertyId } : {}) } },
      { onSuccess: invalidateAfterTaskChange }
    );
  };

  const handleStatusChange = (task: LaunchTask, newStatus: UpdateTaskBodyStatus) => {
    updateTask.mutate(
      { id: task.id, data: { status: newStatus, ...(activePropertyId ? { propertyId: activePropertyId } : {}) } },
      { onSuccess: invalidateAfterTaskChange }
    );
  };

  const openDateObj = localOpenDate ? new Date(localOpenDate) : null;
  const startDateObj = localStartDate ? new Date(localStartDate) : null;
  const phaseWindows = phases && (openDateObj || startDateObj)
    ? computePhaseWindows(phases, startDateObj, openDateObj)
    : null;

  // Critical path = the longer of:
  //   A) Sequential property/legal track (Phases 1–3 chain, each = longest task)
  //   B) Longest single parallel track (Phases 4–7, each starts Day 1)
  // This correctly models the reality that regulatory/marketing/finance work in parallel.
  const sortedForCritPath = phases
    ? [...phases].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];
  const phaseMaxDur = (p: PhaseWithTasks) => Math.max(0, ...(p.tasks?.map(t => t.durationDays ?? 0) ?? [0]));
  const propertyTrackDays = sortedForCritPath.slice(0, SEQUENTIAL_PHASE_COUNT).reduce((s, p) => s + phaseMaxDur(p), 0);
  const parallelTrackDays = sortedForCritPath.slice(SEQUENTIAL_PHASE_COUNT).reduce((mx, p) => Math.max(mx, phaseMaxDur(p)), 0);
  const totalProjectDays = Math.max(propertyTrackDays, parallelTrackDays);
  const availableDays = openDateObj && startDateObj
    ? Math.max(0, Math.floor((openDateObj.getTime() - startDateObj.getTime()) / 86400000))
    : null;

  const totalSelectedCost = phases?.reduce((sum, phase) => sum + phase.selectedCostTotal, 0) || 0;
  const criticalRiskCount = risks?.filter((r) => r.level === "critical").length || 0;

  const defaultTab = highlightedTaskId ? "plan" : "plan";

  if (isPhasesLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-card rounded-lg"></div>
        <div className="h-12 bg-card rounded-lg"></div>
        <div className="h-32 bg-card rounded-lg"></div>
        <div className="h-32 bg-card rounded-lg"></div>
      </div>
    );
  }

  const generateExportText = (): string => {
    const lines: string[] = [];
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    lines.push("# Abi Peters Aesthetics — Winchester Clinic Project Plan");
    lines.push(`Generated: ${today}`);
    lines.push(`Start Date: ${localStartDate || "TBD"} | Target Open: ${localOpenDate || "TBD"}`);
    lines.push(`Available: ${availableDays ?? "?"} days (${availableDays ? Math.round(availableDays / 7) : "?"} wks) | Critical Path: ~${Math.round(totalProjectDays / 7)} wks (${totalProjectDays} days)`);
    lines.push(`Total Selected Cost: ${formatGBP(totalSelectedCost)}`);
    lines.push("");
    lines.push("## Scheduling Model");
    lines.push("Phases 1–3 are SEQUENTIAL (property/legal track — must complete in order).");
    lines.push("Phases 4–7 run IN PARALLEL from Day 1 (regulatory, clinical governance, finance, marketing).");
    lines.push(`True critical path = max(Phase 1+2+3 chain = ${propertyTrackDays}d, longest parallel track = ${parallelTrackDays}d) = ${totalProjectDays} days.`);
    lines.push("");

    const sorted = phases ? [...phases].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : [];
    const SEQUENTIAL = SEQUENTIAL_PHASE_COUNT;
    const fmtD = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    // Compute phase start dates using the same forward-pass as computePhaseWindows.
    // Sequential phases (0–2) chain from startDate; parallel phases (3+) all start from startDate.
    const phaseStartDates: Date[] = [];
    const origin = startDateObj ?? new Date();
    let cursor = new Date(origin);
    for (let i = 0; i < sorted.length; i++) {
      const phase = sorted[i];
      if (i < SEQUENTIAL) {
        phaseStartDates.push(new Date(cursor));
        const phaseMax = Math.max(0, ...(phase.tasks?.map(t => t.durationDays ?? 0) ?? [0]));
        cursor = addDays(cursor, phaseMax);
      } else {
        phaseStartDates.push(new Date(origin));
      }
    }

    sorted.forEach((phase, idx) => {
      const track = idx < SEQUENTIAL ? "SEQUENTIAL — Property/Legal Track" : "PARALLEL — runs from Day 1";
      const phaseStart = phaseStartDates[idx];
      const phaseMax = Math.max(0, ...(phase.tasks?.map(t => t.durationDays ?? 0) ?? [0]));
      const phaseEnd = addDays(phaseStart, phaseMax);
      lines.push("---");
      lines.push(`## Phase ${idx + 1}: ${phase.name} [${track}]`);
      lines.push(`Window: ${startDateObj ? fmtD(phaseStart) : "TBD"} → ${startDateObj ? fmtD(phaseEnd) : "TBD"} (${phaseMax}d) | Status: ${phase.status.replace("_", " ")} | Tasks: ${phase.completedTaskCount}/${phase.taskCount} complete | Selected Cost: ${formatGBP(phase.selectedCostTotal)}`);
      lines.push("");

      const tasks = phase.tasks ?? [];
      if (tasks.length === 0) {
        lines.push("_(no tasks)_");
      } else {
        for (const task of tasks) {
          const done = task.status === "complete" ? "[x]" : "[ ]";
          const dur = task.durationDays ?? 0;
          const taskStart = phaseStart;
          const taskEnd = addDays(phaseStart, dur);
          const startStr = startDateObj ? fmtD(taskStart) : "TBD";
          const endStr = startDateObj && dur > 0 ? fmtD(taskEnd) : "TBD";
          const owner = task.owner || "—";
          const priority = task.riskLevel || "low";
          const costStr = task.selectedCost > 0 ? `${formatGBP(task.selectedCost)} (${task.costTier})` : "£0";
          const flags = [
            task.isNonNegotiable ? "NON-NEGOTIABLE" : "",
            task.isCriticalRisk ? "RISK FLAG" : "",
          ].filter(Boolean).join(", ");

          lines.push(`${done} **${task.title}**`);
          lines.push(`   ${startStr} → ${endStr} (${dur}d) | Status: ${task.status.replace("_", " ")} | Owner: ${owner} | Priority: ${priority} | Cost: ${costStr}${flags ? ` | ⚠ ${flags}` : ""}`);
          if (task.notes) lines.push(`   Notes: ${task.notes}`);
        }
      }
      lines.push("");
    });

    lines.push("---");
    lines.push("## HOW TO RESPOND WITH UPDATES (read carefully)");
    lines.push("");
    lines.push("When you have assessed this plan, respond with your analysis, then include a JSON block");
    lines.push("in EXACTLY this format so the user can paste your full response into the Import modal:");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify({
      summary: "Brief description of what you have changed and why",
      task_updates: [
        {
          title: "Exact task title as shown above — used for matching",
          duration_days: 14,
          start_date: "2026-06-15",
          end_date: "2026-06-29",
          status: "not_started",
          owner: "Solicitor",
          risk_level: "medium",
          notes: "Your reasoning or updated notes",
          cost_tier: "mid",
          cost_low: 5000,
          cost_mid: 8000,
          cost_high: 12000,
        }
      ]
    }, null, 2));
    lines.push("```");
    lines.push("");
    lines.push("RULES:");
    lines.push("- Only include tasks you want to change — omit tasks with no changes.");
    lines.push("- title must match EXACTLY as shown above (it is the lookup key).");
    lines.push("- Only include the fields you want to update — omit fields you do not want to change.");
    lines.push("- start_date and end_date must be ISO format (YYYY-MM-DD). start_date moves the task bar on the Gantt chart.");
    lines.push("- end_date is informational — the Gantt uses start_date + duration_days. Include both for clarity.");
    lines.push(`- Project start date is ${localStartDate || "not yet set"}. Dates before this will clamp to day 0.`);
    lines.push("- status must be one of: not_started, in_progress, complete, blocked, deferred");
    lines.push("- risk_level must be one of: low, medium, high, critical");
    lines.push("- cost_tier must be one of: low, mid, high");
    lines.push("- cost_low, cost_mid, cost_high are numbers in pounds sterling (integers, no currency symbol).");
    lines.push("- duration_days must be a positive whole number (calendar days).");
    lines.push("- The user will paste your FULL response into the Import modal — it auto-extracts the JSON.");

    return lines.join("\n");
  };

  const handleCopy = async () => {
    const text = generateExportText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintText = () => {
    const text = generateExportText();
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Project Plan — Abi Peters Aesthetics</title>
<style>
  body { font-family: monospace; font-size: 11pt; line-height: 1.6; margin: 15mm; color: #111; white-space: pre-wrap; }
  @page { size: A4 portrait; margin: 15mm; }
</style></head><body>${text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</body></html>`);
    win.document.close();
    win.print();
  };

  const parseClaudeResponse = () => {
    setImportError("");
    setImportDiffs(null);
    setImportApplied(0);

    // Extract JSON from code fence or raw text
    let jsonStr = importText;
    const fence = importText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1];

    let parsed: { summary?: string; task_updates?: unknown[] };
    try {
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      setImportError("Could not find valid JSON in the pasted text. Make sure you have copied Claude's full response including the ```json block.");
      return;
    }

    if (!Array.isArray(parsed.task_updates)) {
      setImportError("JSON found but missing a `task_updates` array. Check Claude followed the format instructions.");
      return;
    }

    // Build lookup: normalised title → task
    const allTasks = new Map<string, LaunchTask>();
    for (const phase of phases ?? []) {
      for (const t of phase.tasks ?? []) {
        allTasks.set(t.title.trim().toLowerCase(), t);
      }
    }

    const diffs: ImportDiff[] = [];
    const unmatched: string[] = [];

    for (const update of parsed.task_updates as Record<string, unknown>[]) {
      const titleKey = String(update.title ?? "").trim().toLowerCase();
      const task = allTasks.get(titleKey);
      if (!task) {
        unmatched.push(String(update.title ?? "(unknown)"));
        continue;
      }

      const patch: Record<string, unknown> = {};
      const changes: { field: string; from: string; to: string }[] = [];

      const maybeSet = (field: string, newVal: unknown, display: string, currentDisplay: string) => {
        if (newVal === undefined || newVal === null) return;
        if (String(newVal) !== String(currentDisplay).toLowerCase().replace(/ /g, "_")) {
          patch[field] = newVal;
          changes.push({ field: display, from: currentDisplay || "—", to: String(newVal) });
        }
      };

      if (update.duration_days !== undefined && Number(update.duration_days) !== (task.durationDays ?? 0)) {
        patch.durationDays = Number(update.duration_days);
        changes.push({ field: "Duration", from: `${task.durationDays ?? 0}d`, to: `${update.duration_days}d` });
      }
      maybeSet("status", update.status, "Status", task.status);
      maybeSet("owner", update.owner, "Owner", task.owner ?? "");
      maybeSet("riskLevel", update.risk_level, "Priority", task.riskLevel ?? "low");
      maybeSet("costTier", update.cost_tier, "Cost tier", task.costTier ?? "");

      if (update.notes !== undefined && String(update.notes) !== (task.notes ?? "")) {
        patch.notes = String(update.notes);
        changes.push({ field: "Notes", from: task.notes ? task.notes.slice(0, 60) + "…" : "—", to: String(update.notes).slice(0, 60) + "…" });
      }

      if (update.cost_low !== undefined && Number(update.cost_low) !== (task.costLow ?? 0)) {
        patch.costLow = Number(update.cost_low);
        changes.push({ field: "Cost low", from: `£${task.costLow ?? 0}`, to: `£${update.cost_low}` });
      }
      if (update.cost_mid !== undefined && Number(update.cost_mid) !== (task.costMid ?? 0)) {
        patch.costMid = Number(update.cost_mid);
        changes.push({ field: "Cost mid", from: `£${task.costMid ?? 0}`, to: `£${update.cost_mid}` });
      }
      if (update.cost_high !== undefined && Number(update.cost_high) !== (task.costHigh ?? 0)) {
        patch.costHigh = Number(update.cost_high);
        changes.push({ field: "Cost high", from: `£${task.costHigh ?? 0}`, to: `£${update.cost_high}` });
      }

      if (update.end_date !== undefined) {
        const endDate = new Date(String(update.end_date));
        if (!isNaN(endDate.getTime())) {
          const isoEnd = endDate.toISOString().split("T")[0];
          const currentDue = task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "";
          if (isoEnd !== currentDue) {
            patch.dueDate = endDate.toISOString();
            changes.push({ field: "Due date", from: currentDue || "—", to: isoEnd });
          }
        }
      }

      let ganttOffset: number | undefined;
      if (update.start_date && localStartDate) {
        const taskDate = new Date(String(update.start_date));
        const originDate = new Date(localStartDate);
        if (!isNaN(taskDate.getTime()) && !isNaN(originDate.getTime())) {
          const offset = Math.max(0, Math.round((taskDate.getTime() - originDate.getTime()) / 86400000));
          ganttOffset = offset;
          const currentOffsets: Record<number, number> = (() => {
            try { return JSON.parse(localStorage.getItem(GANTT_LS_KEY) ?? "{}"); } catch { return {}; }
          })();
          const currentOffset = currentOffsets[task.id];
          if (currentOffset !== offset) {
            changes.push({ field: "Gantt start", from: currentOffset !== undefined ? `day ${currentOffset}` : "auto", to: `day ${offset} (${taskDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })})` });
          }
        }
      }

      if (changes.length > 0) diffs.push({ taskId: task.id, title: task.title, changes, patch, ganttOffset });
    }

    if (unmatched.length > 0) {
      setImportError(`Warning: ${unmatched.length} task(s) not matched by title: ${unmatched.slice(0, 3).join(", ")}${unmatched.length > 3 ? " …" : ""}. These were skipped. Other matches are shown below.`);
    }
    if (diffs.length === 0 && unmatched.length === 0) {
      setImportError("No changes detected — Claude's updates already match current values.");
      return;
    }
    setImportDiffs(diffs);
  };

  const applyImport = async () => {
    if (!importDiffs) return;
    setImportApplying(true);
    let count = 0;
    for (const diff of importDiffs) {
      // Only call API if there are non-Gantt fields to update
      const apiPatch = { ...diff.patch };
      if (Object.keys(apiPatch).length > 0) {
        await new Promise<void>((resolve) => {
          updateTask.mutate(
            { id: diff.taskId, data: apiPatch as Parameters<typeof updateTask.mutate>[0]["data"] },
            { onSettled: () => resolve() }
          );
        });
      }
      count++;
      setImportApplied(count);
    }

    // Write any Gantt offsets (start_date overrides) to localStorage then remount GanttView
    const ganttDiffs = importDiffs.filter(d => d.ganttOffset !== undefined);
    if (ganttDiffs.length > 0) {
      try {
        const existing: Record<number, number> = JSON.parse(localStorage.getItem(GANTT_LS_KEY) ?? "{}");
        for (const d of ganttDiffs) {
          existing[d.taskId] = d.ganttOffset!;
        }
        localStorage.setItem(GANTT_LS_KEY, JSON.stringify(existing));
      } catch { /* ignore */ }
      setGanttKey(k => k + 1);
    }

    setImportApplying(false);
    invalidateAfterTaskChange();
    setImportDiffs(null);
    setImportText("");
    setShowImport(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <PageHeader
            title="Project Plan"
            subtitle="Set your key dates, then manage phases and tasks."
          />
          <div className="flex items-center gap-1.5 shrink-0 mt-1 no-print">
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium border bg-card shadow-sm text-muted-foreground hover:text-foreground transition-colors"
              title="Export plan for Claude"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => { setShowImport(true); setImportDiffs(null); setImportError(""); setImportText(""); setImportApplied(0); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium border bg-card shadow-sm text-muted-foreground hover:text-foreground transition-colors"
              title="Import Claude's response"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <div className="flex items-center gap-1 border rounded-lg p-1 bg-card shadow-sm">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode("gantt")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === "gantt"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GanttChartSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Gantt</span>
              </button>
              <button
                onClick={() => setViewMode("vat")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === "vat"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">VAT Reclaim</span>
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === "timeline"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Timeline</span>
              </button>
            </div>
          </div>
        </div>
        {activeProperty && (
          <div className={`no-print flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${viewMasterPlan ? "bg-muted/50 border-muted-foreground/20 text-muted-foreground" : "bg-primary/8 border-primary/25 text-foreground"}`}>
            <Building2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${viewMasterPlan ? "text-muted-foreground" : "text-primary"}`} />
            <span className="flex-1 min-w-0">
              {viewMasterPlan
                ? <span>Viewing <strong>master plan</strong> — changes here update the shared baseline for all properties.</span>
                : <span>Viewing plan for <strong className="text-primary">{activeProperty.address}</strong> — task updates are saved for this property only.</span>
              }
            </span>
            <button
              onClick={() => setViewMasterPlan(v => !v)}
              className="shrink-0 text-xs font-medium underline underline-offset-2 hover:no-underline whitespace-nowrap"
            >
              {viewMasterPlan ? "Switch to property" : "Master plan"}
            </button>
          </div>
        )}
      </div>

      {criticalRiskCount > 0 && (
        <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-destructive">Critical Risks Detected</h3>
            <p className="text-sm text-destructive/80 mt-1">
              There are {criticalRiskCount} critical risk flags that require immediate attention.
            </p>
          </div>
        </div>
      )}

      {/* Date settings + timeline */}
      <Card className="shadow-sm border-border/60">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Project Timeline</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-sm">Available From</Label>
              <Input
                id="startDate"
                type="date"
                value={localStartDate}
                onChange={(e) => { setLocalStartDate(e.target.value); setDatesDirty(true); }}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">When work can begin (lease start, today, etc.)</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="openDate" className="text-sm">
                Target Open Date <span className="text-destructive font-semibold">(hard right)</span>
              </Label>
              <Input
                id="openDate"
                type="date"
                value={localOpenDate}
                onChange={(e) => { setLocalOpenDate(e.target.value); setDatesDirty(true); }}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">CQC floats independently — not tied to this date.</p>
            </div>
            <div>
              <Button
                onClick={handleSaveDates}
                disabled={!datesDirty || updateProject.isPending}
                size="sm"
                className="w-full md:w-auto no-print"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {updateProject.isPending ? "Saving…" : "Save Dates"}
              </Button>
            </div>
          </div>

          {/* Timeline health */}
          {availableDays !== null && totalProjectDays > 0 && (
            <div className="pt-2 border-t border-border/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Critical path: <span className="font-semibold text-foreground">~{Math.round(totalProjectDays / 7)} wks</span>
                  <span className="text-xs"> (Phases 1–3 sequential · Phases 4–7 run from Day 1)</span>
                </span>
                <span className="text-muted-foreground">
                  Available: <span className={`font-semibold ${availableDays < totalProjectDays ? "text-destructive" : "text-primary"}`}>
                    {Math.round(availableDays / 7)} wks
                  </span>
                  {" "}({availableDays} days)
                </span>
              </div>
              <Progress
                value={Math.min(100, (availableDays / totalProjectDays) * 100)}
                className={`h-2 ${availableDays < totalProjectDays ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
              />
              {availableDays < totalProjectDays ? (
                <p className="text-xs text-destructive font-medium">
                  ⚠ Timeline is {Math.round((totalProjectDays - availableDays) / 7)} weeks short — review task durations or move the open date.
                </p>
              ) : (
                <p className="text-xs text-primary font-medium">
                  ✓ Enough time to complete all phases before the open date.
                </p>
              )}
            </div>
          )}

          {/* Budget Summary */}
          <div className="pt-2 border-t border-border/50 space-y-3">
            {/* Grand total */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Total Project Selected Cost</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">Active tasks only · inc VAT planning allowances · deferred &amp; superseded excluded</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-bold">{formatGBP(totalSelectedCost)}</p>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0 no-print" onClick={() => setShowRecordSpend(true)}>
                  <Receipt className="w-3.5 h-3.5" />
                  Record Spend
                </Button>
              </div>
            </div>

            {/* Traffic-light budget cap — threshold from project-controls (davidApprovedCapGbp) */}
            {(() => {
              const davidCap = (projectControls as any)?.davidApprovedCapGbp ?? 60000;
              const outerLimit = Math.round(davidCap * 7 / 6);
              const isGreen = totalSelectedCost <= davidCap;
              const isAmber = !isGreen && totalSelectedCost <= outerLimit;
              const borderCls = isGreen
                ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700"
                : isAmber
                ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700"
                : "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-700";
              const headCls = isGreen
                ? "text-emerald-800 dark:text-emerald-300"
                : isAmber ? "text-amber-800 dark:text-amber-300"
                : "text-red-800 dark:text-red-300";
              const bodyCls = isGreen
                ? "text-emerald-700 dark:text-emerald-400"
                : isAmber ? "text-amber-700 dark:text-amber-400"
                : "text-red-700 dark:text-red-400";
              const icon = isGreen ? "✓" : isAmber ? "⚠" : "✕";
              const headline = isGreen
                ? `Within ${formatGBP(davidCap)} approved launch cap`
                : isAmber
                ? `STRETCH / RISK — above ${formatGBP(davidCap)} target, within ${formatGBP(outerLimit)} outer limit`
                : `RED FLAG — above ${formatGBP(outerLimit)}. Not approved without David's sign-off.`;
              return (
                <div className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 ${borderCls}`}>
                  <span className={`text-base shrink-0 font-bold ${headCls}`}>{icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${headCls}`}>{headline}</p>
                    <p className={`text-xs mt-0.5 ${bodyCls}`}>
                      David's approved launch cap is <strong>{formatGBP(davidCap)} inc VAT</strong>. Stretch / risk range: {formatGBP(davidCap)}–{formatGBP(outerLimit)}. Anything above {formatGBP(outerLimit)} is unapproved — use deferrals to control the selected total.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* ── Actuals KPI strip — visible once spend is recorded ─────────── */}
            {projectControls && ((projectControls as any).actualSpend > 0 || (projectControls as any).committedCosts > 0) && (() => {
              const pc = projectControls as any;
              const davidCap = pc.davidApprovedCapGbp ?? 60000;
              const statusMap: Record<string, { border: string; head: string; icon: string; msg: string }> = {
                on_track: { border: "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700", head: "text-emerald-800 dark:text-emerald-300", icon: "✓", msg: "On track — spend is within approved budget" },
                stretch: { border: "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700", head: "text-amber-800 dark:text-amber-300", icon: "⚠", msg: `Stretch — forecast exceeds ${formatGBP(davidCap)} approved cap` },
                slight_overspend: { border: "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700", head: "text-amber-800 dark:text-amber-300", icon: "⚠", msg: "Slight overspend — forecast is above plan" },
                over_approved_cap: { border: "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-700", head: "text-red-800 dark:text-red-300", icon: "✕", msg: "RED FLAG — forecast exceeds outer limit. David's approval required." },
                no_actuals: { border: "border-muted bg-muted/30", head: "text-muted-foreground", icon: "—", msg: "No actuals recorded yet" },
              };
              const cfg = statusMap[pc.budgetStatus] ?? statusMap.no_actuals;
              const allTasksFlat = phases?.flatMap(p => p.tasks ?? []) ?? [];
              return (
                <div className="space-y-3">
                  {/* 5-card KPI strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {([
                      { label: "Planned Budget", value: pc.plannedBudget, cls: "text-foreground", sub: "selected total", isVariance: false },
                      { label: "Actual Paid", value: pc.actualSpend, cls: "text-emerald-600 dark:text-emerald-400", sub: "invoices paid", isVariance: false },
                      { label: "Committed", value: pc.committedCosts, cls: "text-blue-600 dark:text-blue-400", sub: "orders placed", isVariance: false },
                      { label: "Forecast Final", value: pc.forecastFinalCost, cls: pc.forecastFinalCost > davidCap * 1.167 ? "text-destructive" : pc.forecastFinalCost > davidCap ? "text-amber-600 dark:text-amber-400" : "text-foreground", sub: "best estimate", isVariance: false },
                      { label: "Variance", value: pc.varianceGbp, cls: pc.varianceGbp > 0 ? "text-destructive" : pc.varianceGbp < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground", sub: `${pc.variancePct >= 0 ? "+" : ""}${pc.variancePct.toFixed(1)}% vs plan`, isVariance: true },
                    ] as { label: string; value: number; cls: string; sub: string; isVariance: boolean }[]).map(c => (
                      <div key={c.label} className="rounded-lg border bg-card px-3 py-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-medium">{c.label}</p>
                        <p className={`text-base font-bold tabular-nums ${c.cls}`}>
                          {c.isVariance
                            ? (pc.varianceGbp >= 0 ? "+" : "") + formatGBP(Math.abs(c.value))
                            : formatGBP(c.value)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Budget health badge */}
                  <div className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${cfg.border}`}>
                    <span className={`font-bold shrink-0 ${cfg.head}`}>{cfg.icon}</span>
                    <span className={`text-sm font-semibold ${cfg.head}`}>Budget health: </span>
                    <span className={`text-sm ${cfg.head}`}>{cfg.msg}</span>
                  </div>

                  {/* Completion metrics */}
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { label: "Tasks complete", value: pc.taskCompletionPct, sub: `${allTasksFlat.filter((t: any) => t.status === "complete").length} of ${allTasksFlat.length}` },
                      { label: "Spend recorded", value: pc.spendCompletionPct, sub: formatGBP(pc.actualSpend) + " paid" },
                      { label: "Budget earned", value: pc.weightedCompletionPct, sub: "cost-weighted %" },
                    ] as { label: string; value: number; sub: string }[]).map(m => (
                      <div key={m.label} className="rounded-md border bg-muted/30 px-3 py-2 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{m.label}</p>
                        <p className="text-xl font-bold">{m.value}%</p>
                        <Progress value={m.value} className="h-1 mt-1.5 mb-1" />
                        <p className="text-[10px] text-muted-foreground">{m.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Cost Performance chart — cumulative planned vs actual vs forecast */}
                  {pc.monthlySpend?.length > 0 && (
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-3 py-2 bg-muted/40 border-b flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cost Performance — Cumulative</span>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-violet-600 rounded" />Planned</span>
                          <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-emerald-600 rounded" />Actual</span>
                          <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-blue-600" />Forecast</span>
                        </div>
                      </div>
                      <div className="p-2 bg-background">
                        <ResponsiveContainer width="100%" height={140}>
                          <AreaChart data={pc.monthlySpend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => v === 0 ? "£0" : `£${Math.round(v / 1000)}k`} width={36} />
                            <Area type="monotone" dataKey="cumPlanned" stroke="#7c3aed" fill="#f5f3ff" strokeWidth={2} dot={false} name="Planned" />
                            <Area type="monotone" dataKey="cumActual" stroke="#059669" fill="#ecfdf5" strokeWidth={2} dot={false} name="Actual" />
                            <Area type="monotone" dataKey="cumForecast" stroke="#1d4ed8" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Forecast" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Recorded spend table */}
                  {pc.taskActuals?.length > 0 && (
                    <div className="rounded-lg border overflow-hidden text-xs">
                      <div className="bg-muted/50 px-3 py-1.5 border-b flex items-center justify-between">
                        <span className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">Recorded Spend</span>
                        <span className="text-muted-foreground text-[10px]">{pc.taskActuals.length} task{pc.taskActuals.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="divide-y">
                        {(pc.taskActuals as any[]).slice(0, 12).map((ta: any) => {
                          const effectiveCost = ta.paidStatus === "paid" ? ta.actualCost : ta.committedCost;
                          return (
                            <div key={ta.taskId} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 items-center">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{ta.taskTitle}</p>
                                {ta.invoiceRef && <p className="text-muted-foreground/70 text-[10px]">{ta.invoiceRef}{ta.invoiceDate ? ` · ${ta.invoiceDate}` : ""}</p>}
                              </div>
                              <span className="tabular-nums text-muted-foreground text-right">{formatGBP(ta.plannedCost)}</span>
                              <span className={`tabular-nums font-medium text-right ${ta.varianceGbp > 0 ? "text-destructive" : ta.varianceGbp < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                                {formatGBP(effectiveCost)}
                                {ta.varianceGbp !== 0 && <span className="text-[10px] ml-1 opacity-70">({ta.varianceGbp > 0 ? "+" : ""}{formatGBP(ta.varianceGbp)})</span>}
                              </span>
                              <Badge variant="outline" className={`text-[10px] h-4 py-0 shrink-0 ${
                                ta.paidStatus === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700"
                                : ta.paidStatus === "committed" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700"
                                : "text-muted-foreground"
                              }`}>
                                {ta.paidStatus === "paid" ? "Paid" : ta.paidStatus === "committed" ? "Committed" : "Unpaid"}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Category breakdown — with variance columns when actuals exist */}
            {(() => {
              const ph = (id: number) => phases?.find(p => p.id === id);
              const catCtrl = (ids: number[]) => ids.reduce((s, id) => {
                const c = (projectControls as any)?.categoryBreakdown?.find((x: any) => x.phaseId === id);
                return { actual: s.actual + (c?.actualSpend ?? 0), committed: s.committed + (c?.committed ?? 0), forecast: s.forecast + (c?.forecastFinal ?? 0) };
              }, { actual: 0, committed: 0, forecast: 0 });
              const hasActuals = ((projectControls as any)?.actualSpend ?? 0) > 0 || ((projectControls as any)?.committedCosts ?? 0) > 0;
              const cats = [
                { label: "Design / statutory / building works", note: "Phases 3–4", phaseIds: [21, 22], selected: (ph(21)?.selectedCostTotal ?? 0) + (ph(22)?.selectedCostTotal ?? 0), high: (ph(21)?.totalCostHigh ?? 0) + (ph(22)?.totalCostHigh ?? 0) },
                { label: "Legal / lease / RICS / deposit", note: "Phase 2", phaseIds: [20], selected: ph(20)?.selectedCostTotal ?? 0, high: ph(20)?.totalCostHigh ?? 0 },
                { label: "FF&E / equipment / styling", note: "Phase 5", phaseIds: [23], selected: ph(23)?.selectedCostTotal ?? 0, high: ph(23)?.totalCostHigh ?? 0 },
                { label: "Clinical / compliance / stock", note: "Phases 6–7", phaseIds: [24, 25], selected: (ph(24)?.selectedCostTotal ?? 0) + (ph(25)?.selectedCostTotal ?? 0), high: (ph(24)?.totalCostHigh ?? 0) + (ph(25)?.totalCostHigh ?? 0) },
                { label: "Finance / insurance / admin", note: "Phase 8", phaseIds: [26], selected: ph(26)?.selectedCostTotal ?? 0, high: ph(26)?.totalCostHigh ?? 0 },
                { label: "Marketing / launch / handover", note: "Phases 9–10", phaseIds: [27, 28], selected: (ph(27)?.selectedCostTotal ?? 0) + (ph(28)?.selectedCostTotal ?? 0), high: (ph(27)?.totalCostHigh ?? 0) + (ph(28)?.totalCostHigh ?? 0) },
                { label: "Contingency reserve", note: "Phase 12", phaseIds: [30], selected: ph(30)?.selectedCostTotal ?? 0, high: ph(30)?.totalCostHigh ?? 0 },
              ].map(c => ({ ...c, ...catCtrl(c.phaseIds) }));
              const grandHigh = cats.reduce((s, c) => s + c.high, 0);
              const colCls = hasActuals ? "grid-cols-[1fr_auto_auto_auto_auto]" : "grid-cols-[1fr_auto_auto]";
              return (
                <div className="rounded-lg border border-border/60 overflow-hidden text-xs">
                  <div className={`bg-muted/50 px-3 py-1.5 grid ${colCls} gap-4`}>
                    <span className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">Category</span>
                    {hasActuals && <span className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px] w-20 text-right">Actual</span>}
                    {hasActuals && <span className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px] w-20 text-right">Forecast</span>}
                    <span className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px] w-20 text-right">Selected</span>
                    <span className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px] w-20 text-right">High risk</span>
                  </div>
                  {cats.map((c, i) => (
                    <div key={i} className={`grid ${colCls} gap-4 px-3 py-2 ${i % 2 !== 0 ? "bg-muted/20" : ""}`}>
                      <div>
                        <span className="text-foreground">{c.label}</span>
                        <span className="text-muted-foreground/60 ml-1.5">{c.note}</span>
                      </div>
                      {hasActuals && <span className="w-20 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{(c.actual + c.committed) > 0 ? formatGBP(c.actual + c.committed) : "—"}</span>}
                      {hasActuals && <span className={`w-20 text-right tabular-nums font-medium ${c.forecast > c.selected ? "text-destructive" : "text-foreground"}`}>{c.forecast > 0 ? formatGBP(c.forecast) : "—"}</span>}
                      <span className="font-semibold w-20 text-right tabular-nums">{formatGBP(c.selected)}</span>
                      <span className="text-muted-foreground w-20 text-right tabular-nums">{formatGBP(c.high)}</span>
                    </div>
                  ))}
                  <div className={`grid ${colCls} gap-4 px-3 py-2 border-t bg-muted/40 font-bold`}>
                    <span>Grand total</span>
                    {hasActuals && <span className="w-20 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatGBP((projectControls as any)?.actualSpend ?? 0)}</span>}
                    {hasActuals && <span className={`w-20 text-right tabular-nums ${((projectControls as any)?.forecastFinalCost ?? 0) > totalSelectedCost ? "text-destructive" : ""}`}>{formatGBP((projectControls as any)?.forecastFinalCost ?? 0)}</span>}
                    <span className={`w-20 text-right tabular-nums ${totalSelectedCost > 70000 ? "text-destructive" : totalSelectedCost > 60000 ? "text-amber-600 dark:text-amber-400" : ""}`}>{formatGBP(totalSelectedCost)}</span>
                    <span className="text-muted-foreground w-20 text-right tabular-nums">{formatGBP(grandHigh)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Deferred / stretch row */}
            {(() => {
              const ph = (id: number) => phases?.find(p => p.id === id);
              const deferredHigh = ph(29)?.totalCostHigh ?? 0;
              if (deferredHigh === 0) return null;
              return (
                <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
                  <span>Deferred / stretch items <span className="text-muted-foreground/60">(Phase 11 — excluded from cap)</span></span>
                  <span className="tabular-nums font-medium">{formatGBP(deferredHigh)} high-risk</span>
                </div>
              );
            })()}

            {/* True all-in note */}
            <div className="flex items-start gap-2.5 rounded-lg border border-muted bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground text-sm shrink-0">ℹ</span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                David's target launch cap is <strong>£60,000 inc VAT</strong>. The full clean tracker includes all known legal, build, FF&amp;E, compliance, stock, marketing and contingency lines. If all core lines are included, the true cash requirement may sit closer to <strong>£65k–£70k</strong>. Anything above £70k is unapproved. Use the deferred/stretch toggles to protect the £60k working cap.
              </p>
            </div>

            {/* Warning: tasks with unknown VAT status */}
            {(() => {
              const vatUnknownCount = phases?.flatMap(p => p.tasks ?? []).filter(t => !(t as any).costVatStatus || (t as any).costVatStatus === "vat_unknown").length ?? 0;
              return vatUnknownCount > 0 ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-3">
                  <span className="text-amber-600 dark:text-amber-400 text-base shrink-0">⚠</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{vatUnknownCount} task{vatUnknownCount !== 1 ? "s" : ""} with unknown VAT status</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">The selected total above may be understated if some costs are ex-VAT. Open each task and confirm VAT status before finalising the budget.</p>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </CardContent>
      </Card>

      {/* ── VAT RECLAIM VIEW ──────────────────────────────────────────────────── */}
      {viewMode === "vat" && phases && (() => {
        const VAT_STATUS_LABEL: Record<string, string> = {
          inc_vat: "Inc. VAT",
          ex_vat: "Ex. VAT (+20%)",
          vat_na: "No VAT",
          vat_unknown: "Unknown",
          mixed: "Mixed / partial",
        };
        const VAT_STATUS_COLOR: Record<string, string> = {
          inc_vat: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700",
          ex_vat: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700",
          vat_na: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
          vat_unknown: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
          mixed: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-700",
        };

        // Flatten all tasks that have any cost set
        const allRows = phases.flatMap((ph, phIdx) =>
          (ph.tasks ?? [])
            .filter((t) => (t.selectedCost ?? 0) > 0 || (t.costMid ?? 0) > 0)
            .map((task) => {
              const cost = task.selectedCost > 0 ? task.selectedCost : (task.costMid ?? 0);
              const status: string = (task as any).costVatStatus || "vat_unknown";
              let vatElement: number | null = null;
              let claimable: number | null = null;
              if (status === "inc_vat") {
                vatElement = cost / 6; // 20/120
                claimable = vatElement;
              } else if (status === "ex_vat") {
                vatElement = cost * 0.2;
                claimable = vatElement;
              } else if (status === "vat_na") {
                vatElement = 0;
                claimable = 0;
              }
              // vat_unknown / mixed → null (uncertain)
              return { task, phase: ph, phIdx, cost, status, vatElement, claimable };
            })
        );

        const confirmedClaimable = allRows.reduce((s, r) => s + (r.claimable ?? 0), 0);
        const uncertainRows = allRows.filter((r) => r.claimable === null);
        const uncertainMaxClaimable = uncertainRows.reduce((s, r) => s + r.cost / 6, 0); // max if all inc_vat
        const unknownCount = uncertainRows.length;

        // Group by phase, preserving phase order
        const byPhase = new Map<number, typeof allRows>();
        for (const row of allRows) {
          if (!byPhase.has(row.phase.id)) byPhase.set(row.phase.id, []);
          byPhase.get(row.phase.id)!.push(row);
        }

        return (
          <div className="space-y-5">
            {/* ── Summary KPI cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-4">
                <div className="text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-semibold mb-1.5">Confirmed reclaimable</div>
                <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">{formatGBP(confirmedClaimable)}</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-500 mt-1.5">{allRows.filter((r) => (r.claimable ?? 0) > 0).length} tasks confirmed</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4">
                <div className="text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-400 font-semibold mb-1.5">Potential additional</div>
                <div className="text-2xl font-bold text-amber-800 dark:text-amber-300 tabular-nums">+{formatGBP(uncertainMaxClaimable)}</div>
                <div className="text-xs text-amber-600 dark:text-amber-500 mt-1.5">If {unknownCount} unknown tasks are taxable</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Best-case total</div>
                <div className="text-2xl font-bold text-foreground tabular-nums">{formatGBP(confirmedClaimable + uncertainMaxClaimable)}</div>
                <div className="text-xs text-muted-foreground mt-1.5">Confirmed + all unknowns taxable</div>
              </div>
              <div className={`rounded-xl border p-4 ${unknownCount > 0 ? "border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700" : "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800"}`}>
                <div className={`text-[10px] uppercase tracking-widest font-semibold mb-1.5 ${unknownCount > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>Needs clarifying</div>
                <div className={`text-2xl font-bold tabular-nums ${unknownCount > 0 ? "text-amber-800 dark:text-amber-300" : "text-emerald-800 dark:text-emerald-300"}`}>{unknownCount}</div>
                <div className={`text-xs mt-1.5 ${unknownCount > 0 ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-500"}`}>
                  {unknownCount > 0 ? "tasks with unknown VAT status" : "All VAT statuses confirmed ✓"}
                </div>
              </div>
            </div>

            {/* ── Guidance banner ── */}
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <Receipt className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">
                  Likely VAT reclaim: {formatGBP(confirmedClaimable)}
                  {unknownCount > 0 && <span className="font-normal text-muted-foreground"> — up to {formatGBP(confirmedClaimable + uncertainMaxClaimable)} if all unknowns are VAT-bearing</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Figures are based on the selected cost for each task and the VAT status you have recorded.
                  Inc. VAT costs: the VAT element is 1/6th of the total. Ex. VAT costs: 20% is added on top.
                  Open any task to update its VAT status — it will recalculate here immediately.
                  A valid HMRC VAT invoice is required for every line claimed.
                </p>
              </div>
            </div>

            {/* ── Per-task table ── */}
            <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
                <PoundSterling className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">VAT Reclaim by Task</span>
                <span className="text-xs text-muted-foreground ml-auto hidden sm:block">Click any task to update its VAT status</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Task</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Selected cost</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">VAT status</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">VAT element</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Claimable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phases
                      .filter((ph) => byPhase.has(ph.id))
                      .map((ph, phIdx) => {
                        const phaseRows = byPhase.get(ph.id)!;
                        const phaseConfirmed = phaseRows.reduce((s, r) => s + (r.claimable ?? 0), 0);
                        const phaseHasUncertain = phaseRows.some((r) => r.claimable === null);
                        const color = PHASE_PALETTE[phIdx % PHASE_PALETTE.length];
                        return (
                          <>
                            {/* Phase header row */}
                            <tr key={`hdr-${ph.id}`} className="bg-muted/30 border-b border-t">
                              <td className="px-4 py-2" colSpan={4}>
                                <div className="flex items-center gap-2">
                                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color.bar, display: "inline-block", flexShrink: 0 }} />
                                  <span className="text-xs font-bold" style={{ color: color.bar }}>{ph.name}</span>
                                  <span className="text-xs text-muted-foreground">· {phaseRows.length} item{phaseRows.length !== 1 ? "s" : ""}</span>
                                </div>
                              </td>
                              <td className="text-right px-4 py-2 text-xs font-bold">
                                {phaseHasUncertain
                                  ? <span className="text-amber-700 dark:text-amber-400">{formatGBP(phaseConfirmed)} + ?</span>
                                  : <span className={phaseConfirmed > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>{formatGBP(phaseConfirmed)}</span>}
                              </td>
                            </tr>
                            {/* Task rows */}
                            {phaseRows.map(({ task, cost, status, vatElement, claimable }) => (
                              <tr
                                key={task.id}
                                className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                                onClick={() => setEditingTask(task)}
                              >
                                <td className="px-4 py-2.5 pl-8">
                                  <div className="font-medium text-sm leading-snug">{task.title}</div>
                                  {task.costTier === "quoted" && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5">quoted price</div>
                                  )}
                                </td>
                                <td className="text-right px-4 py-2.5 tabular-nums font-medium">{formatGBP(cost)}</td>
                                <td className="text-center px-4 py-2.5">
                                  <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${VAT_STATUS_COLOR[status] ?? VAT_STATUS_COLOR.vat_unknown}`}>
                                    {VAT_STATUS_LABEL[status] ?? "Unknown"}
                                  </span>
                                </td>
                                <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground">
                                  {vatElement === null
                                    ? <span className="text-amber-500">?</span>
                                    : vatElement === 0
                                    ? <span className="text-muted-foreground/40">—</span>
                                    : formatGBP(vatElement)}
                                </td>
                                <td className="text-right px-4 py-2.5 tabular-nums font-semibold">
                                  {claimable === null
                                    ? <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">unclear</span>
                                    : claimable === 0
                                    ? <span className="text-muted-foreground/40">—</span>
                                    : <span className="text-emerald-700 dark:text-emerald-400">{formatGBP(claimable)}</span>}
                                </td>
                              </tr>
                            ))}
                          </>
                        );
                      })}
                  </tbody>
                  <tfoot className="border-t-2 border-border">
                    <tr className="bg-muted/40">
                      <td className="px-4 py-3 font-bold">Total</td>
                      <td className="text-right px-4 py-3 font-bold tabular-nums">{formatGBP(allRows.reduce((s, r) => s + r.cost, 0))}</td>
                      <td />
                      <td className="text-right px-4 py-3 font-bold tabular-nums text-muted-foreground">
                        {formatGBP(allRows.filter((r) => r.vatElement !== null).reduce((s, r) => s + (r.vatElement ?? 0), 0))}
                      </td>
                      <td className="text-right px-4 py-3">
                        <div className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatGBP(confirmedClaimable)}</div>
                        {unknownCount > 0 && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 whitespace-nowrap">+{formatGBP(uncertainMaxClaimable)} potential</div>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ── HMRC rules callout ── */}
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">HMRC Input Tax Recovery — Key Rules</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs text-muted-foreground">
                {([
                  ["Pre-registration recovery", "Goods: input tax reclaimable for up to 4 years before VAT registration if the goods are still held. Services: up to 6 months before registration. A valid VAT invoice is required for every line."],
                  ["Registration threshold", "Mandatory registration when rolling 12-month turnover exceeds £90,000. The VAT Horizon indicator on the dashboard shows your projected threshold date."],
                  ["Valid VAT invoice required", "Every claim must be supported by a supplier VAT invoice showing: supplier VAT number, supply date, description, net amount, VAT rate, and VAT amount. Retain all invoices indefinitely."],
                  ["Aesthetics & VAT exemption", "Standard aesthetic treatments (injectables, laser, facials) are generally standard-rated at 20%. CQC-registered clinical services may be exempt — confirm with a specialist VAT adviser before registering."],
                  ["Capital Goods Scheme", "Fixtures, fit-out, or equipment over £50,000 (ex-VAT) may fall into the Capital Goods Scheme — HMRC can claw back input tax over 5–10 years if the use of the asset changes."],
                  ["Professional advice required", "This is a planning estimate only. Confirm the reclaim position with a qualified accountant before submitting any VAT return. Incorrect claims carry penalties and interest."],
                ] as [string, string][]).map(([title, body]) => (
                  <div key={title} className="flex gap-2">
                    <span className="text-primary font-bold shrink-0 mt-0.5">→</span>
                    <div><span className="font-semibold text-foreground">{title}:</span> {body}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {viewMode === "gantt" && phases && (
        <>
          <div className="block sm:hidden rounded-xl border bg-muted/40 p-6 text-center space-y-2">
            <GanttChartSquare className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="font-semibold text-sm">Gantt chart is best on desktop</p>
            <p className="text-xs text-muted-foreground">Switch to List view to manage tasks on iPhone, or open on a larger screen to use the drag-and-drop Gantt.</p>
            <button onClick={() => setViewMode("list")} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium">
              <List className="w-3.5 h-3.5" />Switch to List
            </button>
          </div>
          <div className="hidden sm:block">
            <GanttView
              key={ganttKey}
              phases={phases}
              startDateObj={startDateObj}
              updateTask={updateTask}
              invalidateAfterTaskChange={invalidateAfterTaskChange}
              onTaskClick={setEditingTask}
            />
          </div>
        </>
      )}

      {viewMode === "timeline" && (
        <TimelineView projectId={PROJECT_ID} />
      )}

      {viewMode === "list" && (
        <div className="no-print flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sort by</span>
          <div className="flex items-center gap-1 border rounded-md overflow-hidden text-xs">
            <button
              onClick={() => setListSortBy("startDate")}
              className={`px-3 py-1.5 font-medium transition-colors ${listSortBy === "startDate" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Start date
            </button>
            <button
              onClick={() => setListSortBy("dueDate")}
              className={`px-3 py-1.5 font-medium transition-colors ${listSortBy === "dueDate" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Due date
            </button>
          </div>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={() => setListGrouped(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${listGrouped ? "text-muted-foreground hover:text-foreground hover:bg-muted" : "bg-primary/10 text-primary border-primary/30"}`}
          >
            {listGrouped ? "Flat list" : "Group by phase"}
          </button>
        </div>
      )}

      {/* Flat list view */}
      {viewMode === "list" && !listGrouped && (() => {
        const getDate = (t: LaunchTask) => {
          const ta = t as any;
          return listSortBy === "startDate"
            ? (ta.startDate || t.dueDate || null)
            : (t.dueDate || ta.startDate || null);
        };
        const allTasks = (phases ?? [])
          .flatMap((ph, phIdx) =>
            (ph.tasks ?? []).map((t, taskIdx) => ({ task: t, phase: ph, phIdx, taskIdx }))
          )
          .sort((a, b) => {
            const aDate = getDate(a.task);
            const bDate = getDate(b.task);
            if (aDate && bDate) return aDate.localeCompare(bDate);
            if (aDate && !bDate) return -1;   // dated before undated
            if (!aDate && bDate) return 1;    // undated after dated
            // both undated: preserve original phase/task order
            if (a.phIdx !== b.phIdx) return a.phIdx - b.phIdx;
            return a.taskIdx - b.taskIdx;
          });
        const phaseColors = PHASE_PALETTE;

        return (
          <div className="border bg-card rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[260px]">Task</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Cost Tier</TableHead>
                    <TableHead>Actuals</TableHead>
                    <TableHead>
                      <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => setListSortBy(s => s === "startDate" ? "dueDate" : "startDate")}>
                        {listSortBy === "startDate" ? "Start date ↑" : "Due date ↑"}
                      </button>
                    </TableHead>
                    <TableHead className="w-[80px] no-print" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTasks.map(({ task, phase, phIdx }) => {
                    const color = phaseColors[phIdx % phaseColors.length];
                    return (
                      <TableRow
                        key={task.id}
                        id={`task-${task.id}`}
                        className={`cursor-pointer hover:bg-muted/40 transition-colors ${highlightedTaskId === task.id ? "ring-2 ring-primary ring-inset bg-primary/5" : ""}`}
                        onClick={() => setEditingTask(task)}
                      >
                        <TableCell>
                          <TaskDetailTooltip task={task}>
                            <div>
                              <div className="font-medium text-foreground">{task.title}</div>
                              <div className="flex gap-2 mt-1 flex-wrap">
                                {task.isNonNegotiable && <Badge variant="outline" className="text-[10px] h-4 py-0">Must Do</Badge>}
                                {task.isCriticalRisk && <Badge variant="destructive" className="text-[10px] h-4 py-0 bg-destructive/10 text-destructive border-transparent">⚠ Risk</Badge>}
                                {((task as any).costVatStatus === "vat_unknown" || !(task as any).costVatStatus) && (task.costMid ?? 0) > 0 && <Badge variant="outline" className="text-[10px] h-4 py-0 border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30">VAT?</Badge>}
                                {(task as any).costVatStatus === "ex_vat" && (task.costMid ?? 0) > 0 && <Badge variant="outline" className="text-[10px] h-4 py-0 border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/20">+VAT</Badge>}
                              </div>
                            </div>
                          </TaskDetailTooltip>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap" style={{ color: color.bar }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: color.bar, flexShrink: 0, display: "inline-block" }} />
                            {phase.name.replace(/^Phase \d+[\s:–-]*/i, "").trim() || phase.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{task.owner || "—"}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select value={task.status} onValueChange={(val) => handleStatusChange(task, val as UpdateTaskBodyStatus)}>
                            <SelectTrigger className={`w-[130px] h-8 text-xs ${STATUS_COLORS[task.status] || ""}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_started">Not Started</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="complete">Complete</SelectItem>
                              <SelectItem value="blocked">Blocked</SelectItem>
                              <SelectItem value="deferred">Deferred</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={RISK_COLORS[task.riskLevel] || ""}>{task.riskLevel}</Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {task.costTier === "quoted" ? (
                            <div className="flex items-center gap-1">
                              <span className="px-2 py-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
                                Quoted: {formatGBP(task.selectedCost)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex rounded-md overflow-hidden border border-border/60 w-max">
                              {(["low", "mid", "high"] as const).map((tier, i) => (
                                <button key={tier}
                                  onClick={() => handleCostTierChange(task, tier)}
                                  className={`px-2 py-1 text-[10px] font-medium transition-colors ${i > 0 ? "border-l border-border/60" : ""} ${task.costTier === tier ? tier === "low" ? "bg-primary/20 text-primary" : tier === "mid" ? "bg-amber-500/20 text-amber-700 dark:text-amber-400" : "bg-destructive/20 text-destructive" : "bg-card text-muted-foreground hover:bg-muted"}`}
                                >
                                  {tier[0].toUpperCase()}: {formatGBP(tier === "low" ? task.costLow : tier === "mid" ? task.costMid : task.costHigh)}
                                </button>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {(() => {
                            const ac = (task as any).actualCost;
                            const cc = (task as any).committedCost;
                            if (!ac && !cc) return <span className="text-muted-foreground/30">—</span>;
                            return (
                              <div className="flex flex-col gap-0.5">
                                {ac > 0 && <Badge variant="outline" className="text-[10px] h-4 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700 w-max">✓ {formatGBP(ac)}</Badge>}
                                {cc > 0 && !ac && <Badge variant="outline" className="text-[10px] h-4 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700 w-max">{formatGBP(cc)}</Badge>}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {task.startDate ? (
                            <div className="flex flex-col gap-0.5">
                              <span><span className="text-[10px] uppercase tracking-wide mr-1 text-muted-foreground/60">Start</span>{new Date(task.startDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                              <span><span className="text-[10px] uppercase tracking-wide mr-1 text-muted-foreground/60">Due</span>{task.dueDate ? new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</span>
                            </div>
                          ) : task.dueDate ? (
                            <span><span className="text-[10px] uppercase tracking-wide mr-1 text-muted-foreground/60">Due</span>{new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell className="no-print" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTask(task)}><Pencil className="w-4 h-4" /></Button>
                            {confirmDeleteId === task.id ? (
                              <Button variant="destructive" size="icon" className="h-8 w-8 relative z-10" onClick={() => handleDeleteTask(task.id)}><Trash2 className="w-4 h-4" /></Button>
                            ) : (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDeleteId(task.id)}><Trash2 className="w-4 h-4" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {allTasks.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No tasks found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })()}

      <Accordion
        type="multiple"
        value={openPhases}
        onValueChange={setOpenPhases}
        className={`space-y-4 ${viewMode === "gantt" || !listGrouped ? "hidden" : ""}`}
      >
        {phases?.map((phase) => {
          const win = phaseWindows?.get(phase.id);
          const windowBadgeClass =
            !win || win.status === "unknown" ? "bg-muted text-muted-foreground" :
            win.status === "on_track" ? "bg-primary/15 text-primary" :
            win.status === "tight" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300" :
            "bg-destructive/15 text-destructive";

          const getTaskDate = (t: LaunchTask) => {
            const ta = t as any;
            return listSortBy === "startDate"
              ? (ta.startDate || t.dueDate || null)
              : (t.dueDate || ta.startDate || null);
          };
          const sortedTasks = [...(phase.tasks ?? [])].sort((a, b) => {
            const aDate = getTaskDate(a);
            const bDate = getTaskDate(b);
            if (aDate && bDate) return aDate.localeCompare(bDate);
            if (aDate && !bDate) return -1;
            if (!aDate && bDate) return 1;
            return 0; // both undated: keep original order
          });

          return (
            <AccordionItem
              key={phase.id}
              value={`phase-${phase.id}`}
              className="border bg-card rounded-lg overflow-hidden shadow-sm"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center gap-4 w-full pr-4 text-left">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-lg">{phase.name}</span>
                      <Badge variant="secondary" className={STATUS_COLORS[phase.status] || ""}>
                        {phase.status.replace("_", " ")}
                      </Badge>
                      {win && localOpenDate && (
                        <Badge variant="secondary" className={`text-[11px] ${windowBadgeClass}`}>
                          Complete by {fmtDate(win.mustEndBy)}
                          {win.totalDays > 0 && ` · ${win.totalDays}d`}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-muted-foreground">
                        Tasks: {phase.completedTaskCount} / {phase.taskCount}
                      </span>
                      <Progress
                        value={phase.taskCount > 0 ? (phase.completedTaskCount / phase.taskCount) * 100 : 0}
                        className="h-2 w-32"
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Selected Cost
                    </p>
                    <p className="font-semibold">{formatGBP(phase.selectedCostTotal)}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 py-4 bg-background">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[300px]">Task</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Cost Tier Selection</TableHead>
                        <TableHead>Actuals</TableHead>
                        <TableHead>
                          <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={(e) => { e.stopPropagation(); setListSortBy(s => s === "startDate" ? "dueDate" : "startDate"); }}>
                            {listSortBy === "startDate" ? "Start date ↑" : "Due date ↑"}
                          </button>
                        </TableHead>
                        <TableHead className="w-[80px] no-print"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTasks.map((task) => (
                        <TableRow
                          key={task.id}
                          id={`task-${task.id}`}
                          className={`cursor-pointer hover:bg-muted/40 transition-colors ${highlightedTaskId === task.id ? "ring-2 ring-primary ring-inset bg-primary/5" : ""}`}
                          onClick={() => setEditingTask(task)}
                        >
                          <TableCell>
                            <TaskDetailTooltip task={task}>
                              <div>
                                <div className="font-medium text-foreground">{task.title}</div>
                                <div className="flex gap-2 mt-1.5 flex-wrap">
                                  {task.isNonNegotiable && (
                                    <Badge variant="outline" className="text-[10px] h-4 py-0">
                                      Must Do
                                    </Badge>
                                  )}
                                  {task.isCriticalRisk && (
                                    <Badge variant="destructive" className="text-[10px] h-4 py-0 bg-destructive/10 text-destructive border-transparent">
                                      ⚠ Risk
                                    </Badge>
                                  )}
                                  {task.files && (
                                    <Badge variant="outline" className="text-[10px] h-4 py-0 text-muted-foreground">
                                      Files attached
                                    </Badge>
                                  )}
                                  {task.dependencies && task.dependencies.length > 0 && (
                                    <Badge variant="outline" className="text-[10px] h-4 py-0 text-muted-foreground">
                                      {task.dependencies.length} dep{task.dependencies.length !== 1 ? "s" : ""}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </TaskDetailTooltip>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{task.owner || "-"}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={task.status}
                              onValueChange={(val) => handleStatusChange(task, val as UpdateTaskBodyStatus)}
                            >
                              <SelectTrigger className={`w-[130px] h-8 text-xs ${STATUS_COLORS[task.status] || ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not_started">Not Started</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="complete">Complete</SelectItem>
                                <SelectItem value="blocked">Blocked</SelectItem>
                                <SelectItem value="deferred">Deferred</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={RISK_COLORS[task.riskLevel] || ""}>
                              {task.riskLevel}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {task.costTier === "quoted" ? (
                              <div className="flex flex-col gap-1 w-max">
                                <span className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  Quoted: {formatGBP(task.selectedCost)}
                                </span>
                                <div className="text-[10px] text-muted-foreground">
                                  Est: L {formatGBP(task.costLow)} / M {formatGBP(task.costMid)} / H {formatGBP(task.costHigh)}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 w-max">
                                <div className="flex rounded-md overflow-hidden border border-border/60">
                                  <button
                                    onClick={() => handleCostTierChange(task, "low")}
                                    className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                                      task.costTier === "low"
                                        ? "bg-primary/20 text-primary"
                                        : "bg-card text-muted-foreground hover:bg-muted"
                                    }`}
                                  >
                                    Low: {formatGBP(task.costLow)}
                                  </button>
                                  <div className="w-px bg-border/60"></div>
                                  <button
                                    onClick={() => handleCostTierChange(task, "mid")}
                                    className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                                      task.costTier === "mid"
                                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                                        : "bg-card text-muted-foreground hover:bg-muted"
                                    }`}
                                  >
                                    Mid: {formatGBP(task.costMid)}
                                  </button>
                                  <div className="w-px bg-border/60"></div>
                                  <button
                                    onClick={() => handleCostTierChange(task, "high")}
                                    className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                                      task.costTier === "high"
                                        ? "bg-destructive/20 text-destructive"
                                        : "bg-card text-muted-foreground hover:bg-muted"
                                    }`}
                                  >
                                    High: {formatGBP(task.costHigh)}
                                  </button>
                                </div>
                                {task.costLow === 0 && task.costHigh === 0 && task.costMid === 0 ? null : (
                                  <div className="text-[10px] text-muted-foreground text-right mt-0.5">
                                    Selected: <span className="font-semibold text-foreground">{formatGBP(task.selectedCost)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {(() => {
                              const ac = (task as any).actualCost;
                              const cc = (task as any).committedCost;
                              if (!ac && !cc) return <span className="text-muted-foreground/30">—</span>;
                              return (
                                <div className="flex flex-col gap-0.5">
                                  {ac > 0 && <Badge variant="outline" className="text-[10px] h-4 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700 w-max">✓ {formatGBP(ac)}</Badge>}
                                  {cc > 0 && !ac && <Badge variant="outline" className="text-[10px] h-4 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700 w-max">{formatGBP(cc)}</Badge>}
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {task.startDate ? (
                              <div className="flex flex-col gap-0.5">
                                <span><span className="text-[10px] uppercase tracking-wide mr-1 text-muted-foreground/60">Start</span>{new Date(task.startDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                                <span><span className="text-[10px] uppercase tracking-wide mr-1 text-muted-foreground/60">Due</span>{task.dueDate ? new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</span>
                              </div>
                            ) : task.dueDate ? (
                              <span><span className="text-[10px] uppercase tracking-wide mr-1 text-muted-foreground/60">Due</span>{new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell className="no-print" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {/* Quick move to phase */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    title="Move to phase"
                                  >
                                    <ArrowRightLeft className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuLabel className="text-xs text-muted-foreground">Move to phase</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {phases?.map((p) => (
                                    <DropdownMenuItem
                                      key={p.id}
                                      disabled={p.id === task.phaseId}
                                      className={p.id === task.phaseId ? "font-semibold text-primary" : ""}
                                      onClick={() => {
                                        updateTask.mutate(
                                          { id: task.id, data: { phaseId: p.id, ...(activePropertyId ? { propertyId: activePropertyId } as any : {}) } },
                                          { onSuccess: invalidateAfterTaskChange }
                                        );
                                      }}
                                    >
                                      {p.id === task.phaseId && <Check className="w-3 h-3 mr-1.5 shrink-0" />}
                                      <span className={p.id === task.phaseId ? "ml-0" : "ml-4.5"}>{p.name}</span>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditingTask(task)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {confirmDeleteId === task.id ? (
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8 relative z-10"
                                  onClick={() => handleDeleteTask(task.id)}
                                  title="Click again to confirm delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => setConfirmDeleteId(task.id)}
                                  title="Delete task"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!phase.tasks || phase.tasks.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                            No tasks in this phase yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 flex no-print">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 gap-1.5"
                    onClick={() => setAddingTaskPhaseId(phase.id)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Task
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* ── Export for Claude modal ── */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="text-base font-semibold">Export Project Plan</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Copy this into Claude to assess timeline, gaps, or sequencing. All 113 tasks, phases, durations, costs, and flags included.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={handleCopy} className="gap-1.5 h-8">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy to clipboard"}
              </Button>
              <Button size="sm" variant="outline" onClick={handlePrintText} className="gap-1.5 h-8">
                Print as plain text
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                {generateExportText().split("\n").length} lines · {Math.round(generateExportText().length / 1000)}k chars
              </span>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 py-4">
            <pre className="text-[11px] leading-relaxed font-mono text-foreground whitespace-pre-wrap break-words">
              {generateExportText()}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import from Claude modal ── */}
      <Dialog open={showImport} onOpenChange={(open) => { setShowImport(open); if (!open) { setImportDiffs(null); setImportError(""); } }}>
        <DialogContent className="max-w-2xl h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="text-base font-semibold">Import Claude's Response</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Paste Claude's full response below. The JSON block will be extracted automatically, changes previewed, and applied to your tasks.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-6 py-4 flex flex-col gap-4">
            {!importDiffs && (
              <>
                <Textarea
                  className="flex-1 font-mono text-xs min-h-[260px] resize-none"
                  placeholder={"Paste Claude's full response here — including analysis and the ```json block at the end…"}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                {importError && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
                  <Button onClick={parseClaudeResponse} disabled={!importText.trim()}>
                    Preview changes
                  </Button>
                </div>
              </>
            )}

            {importDiffs && (
              <>
                {importError && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-2 text-sm">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}
                <p className="text-sm font-medium">
                  {importDiffs.length === 0
                    ? "No changes to apply."
                    : `${importDiffs.length} task${importDiffs.length !== 1 ? "s" : ""} will be updated:`}
                </p>
                <div className="flex-1 overflow-auto space-y-3">
                  {importDiffs.map((diff) => (
                    <div key={diff.taskId} className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
                      <p className="font-medium mb-2">{diff.title}</p>
                      <div className="space-y-1">
                        {diff.changes.map((ch) => (
                          <div key={ch.field} className="flex items-baseline gap-2 text-xs text-muted-foreground">
                            <span className="w-20 shrink-0 font-medium text-foreground">{ch.field}</span>
                            <span className="line-through opacity-60">{ch.from}</span>
                            <ChevronRight className="w-3 h-3 shrink-0" />
                            <span className="text-primary font-medium">{ch.to}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-1 border-t gap-2">
                  <button
                    onClick={() => { setImportDiffs(null); setImportError(""); }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Back
                  </button>
                  <div className="flex items-center gap-3">
                    {importApplying && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Applying {importApplied}/{importDiffs.length}…
                      </span>
                    )}
                    <Button
                      onClick={applyImport}
                      disabled={importApplying || importDiffs.length === 0}
                    >
                      {importApplying ? "Applying…" : `Apply ${importDiffs.length} update${importDiffs.length !== 1 ? "s" : ""}`}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <TaskEditSheet
        task={editingTask}
        allPhases={phases ?? []}
        activePropertyId={activePropertyId}
        onClose={() => setEditingTask(null)}
      />

      <AddTaskSheet
        phaseId={addingTaskPhaseId}
        onClose={() => setAddingTaskPhaseId(null)}
        onCreated={(task) => {
          invalidateAfterTaskChange();
          setAddingTaskPhaseId(null);
          setEditingTask(task as LaunchTask);
        }}
      />

      {/* Click-away dismiss for delete confirm */}
      {confirmDeleteId !== null && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setConfirmDeleteId(null)}
        />
      )}

      {/* ── Record Spend Dialog ────────────────────────────────────────────── */}
      <Dialog open={showRecordSpend} onOpenChange={setShowRecordSpend}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Record Spend
            </DialogTitle>
            <DialogDescription>
              Record actual or committed spend against a task. Updates the project controls tracker.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Task</label>
              <Select
                value={recordSpendData.taskId ? String(recordSpendData.taskId) : ""}
                onValueChange={(v) => setRecordSpendData(d => ({ ...d, taskId: parseInt(v) }))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Select a task…" /></SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  {phases?.flatMap(p =>
                    (p.tasks ?? []).map(t => ({
                      id: t.id,
                      title: t.title,
                      phaseName: p.name.replace(/^Phase \d+[\s:–-]*/i, "").trim() || p.name,
                    }))
                  ).map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      <span className="text-[10px] text-muted-foreground mr-1.5">{t.phaseName}</span>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Actual cost paid <span className="text-muted-foreground font-normal">£</span></label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={recordSpendData.actualCost}
                  onChange={(e) => setRecordSpendData(d => ({ ...d, actualCost: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Committed cost <span className="text-muted-foreground font-normal">£</span></label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={recordSpendData.committedCost}
                  onChange={(e) => setRecordSpendData(d => ({ ...d, committedCost: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">VAT</label>
              <Select
                value={recordSpendData.vatInclusive}
                onValueChange={(v) => setRecordSpendData(d => ({ ...d, vatInclusive: v }))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inc">Inc VAT — amount already includes VAT</SelectItem>
                  <SelectItem value="exc">Ex VAT — VAT not included in this figure</SelectItem>
                  <SelectItem value="exempt">VAT exempt / not applicable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Payment status</label>
              <Select
                value={recordSpendData.paidStatus}
                onValueChange={(v) => setRecordSpendData(d => ({ ...d, paidStatus: v }))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">✓ Paid — invoice settled</SelectItem>
                  <SelectItem value="committed">Committed — order placed</SelectItem>
                  <SelectItem value="unpaid">Unpaid / accrued</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Invoice ref</label>
                <Input
                  placeholder="INV-001"
                  value={recordSpendData.invoiceRef}
                  onChange={(e) => setRecordSpendData(d => ({ ...d, invoiceRef: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Invoice date</label>
                <Input
                  type="date"
                  value={recordSpendData.invoiceDate}
                  onChange={(e) => setRecordSpendData(d => ({ ...d, invoiceDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Invoice file <span className="text-muted-foreground font-normal text-xs">(PDF, JPG, PNG — optional)</span>
              </label>
              {recordSpendData.invoiceFileUrl ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate flex-1 text-emerald-700 dark:text-emerald-400">
                    {recordSpendData.invoiceFile?.name ?? "Invoice uploaded"}
                  </span>
                  <button
                    className="text-muted-foreground hover:text-destructive text-xs shrink-0"
                    onClick={() => setRecordSpendData(d => ({ ...d, invoiceFile: null, invoiceFileUrl: "" }))}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground cursor-pointer hover:border-foreground/40 hover:text-foreground transition-colors">
                  <Receipt className="w-4 h-4 shrink-0" />
                  <span>{recordSpendData.invoiceFile ? recordSpendData.invoiceFile.name : "Click to attach invoice…"}</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setRecordSpendData(d => ({ ...d, invoiceFile: file, invoiceFileUrl: "" }));
                    }}
                  />
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Variance note <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </label>
              <Input
                placeholder="Reason if cost differs from plan…"
                value={recordSpendData.varianceNote}
                onChange={(e) => setRecordSpendData(d => ({ ...d, varianceNote: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRecordSpend(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!recordSpendData.taskId || updateTask.isPending || recordSpendData.uploading}
              onClick={async () => {
                if (!recordSpendData.taskId) return;

                let fileUrl = recordSpendData.invoiceFileUrl;

                // Upload file first if one is selected and not yet uploaded
                if (recordSpendData.invoiceFile && !fileUrl) {
                  setRecordSpendData(d => ({ ...d, uploading: true }));
                  try {
                    const form = new FormData();
                    form.append("file", recordSpendData.invoiceFile);
                    const apiBase = (import.meta as any).env?.VITE_API_URL ?? "/api";
                    const res = await fetch(`${apiBase}/tasks/${recordSpendData.taskId}/upload-invoice`, {
                      method: "POST",
                      body: form,
                    });
                    if (res.ok) {
                      const data = await res.json();
                      fileUrl = data.invoiceFileUrl;
                      setRecordSpendData(d => ({ ...d, invoiceFileUrl: fileUrl ?? "", uploading: false }));
                    } else {
                      setRecordSpendData(d => ({ ...d, uploading: false }));
                    }
                  } catch {
                    setRecordSpendData(d => ({ ...d, uploading: false }));
                  }
                }

                const patch: Record<string, unknown> = {
                  paidStatus: recordSpendData.paidStatus,
                };
                if (recordSpendData.actualCost) patch.actualCost = parseFloat(recordSpendData.actualCost);
                if (recordSpendData.committedCost) patch.committedCost = parseFloat(recordSpendData.committedCost);
                patch.vatInclusive = recordSpendData.vatInclusive === "inc";
                if (recordSpendData.invoiceRef) patch.invoiceRef = recordSpendData.invoiceRef;
                if (recordSpendData.invoiceDate) patch.invoiceDate = recordSpendData.invoiceDate;
                if (recordSpendData.varianceNote) patch.varianceNote = recordSpendData.varianceNote;
                if (fileUrl) patch.invoiceFileUrl = fileUrl;
                if (activePropertyId) patch.propertyId = activePropertyId;
                updateTask.mutate(
                  { id: recordSpendData.taskId, data: patch as any },
                  {
                    onSuccess: () => {
                      invalidateAfterTaskChange();
                      setShowRecordSpend(false);
                      setRecordSpendData({ taskId: null, actualCost: "", committedCost: "", paidStatus: "paid", vatInclusive: "inc", invoiceRef: "", invoiceDate: "", varianceNote: "", invoiceFile: null, invoiceFileUrl: "", uploading: false });
                    },
                  }
                );
              }}
            >
              {recordSpendData.uploading ? "Uploading…" : updateTask.isPending ? "Saving…" : "Record Spend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseFiles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((f: unknown) => (typeof f === "string" ? f : (f as { name?: string }).name ?? String(f)));
    }
  } catch {
    // ignore malformed JSON
  }
  return [];
}

function AddTaskSheet({
  phaseId,
  onClose,
  onCreated,
}: {
  phaseId: number | null;
  onClose: () => void;
  onCreated: (task: unknown) => void;
}) {
  const createTask = useCreateTask();
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [riskLevel, setRiskLevel] = useState<string>("low");

  useEffect(() => {
    if (phaseId) {
      setTitle("");
      setOwner("");
      setDurationDays("");
      setRiskLevel("low");
    }
  }, [phaseId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phaseId || !title.trim()) return;
    createTask.mutate(
      {
        phaseId,
        data: {
          title: title.trim(),
          owner: owner.trim() || undefined,
          durationDays: durationDays ? Number(durationDays) : undefined,
          riskLevel: riskLevel as "low" | "medium" | "high" | "critical",
          status: "not_started",
          costTier: "mid",
          costLow: 0,
          costMid: 0,
          costHigh: 0,
        },
      },
      { onSuccess: (task) => onCreated(task) }
    );
  };

  return (
    <Sheet open={phaseId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>Add Task</SheetTitle>
          <SheetDescription>Create a new task. You can fill in full details afterwards.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="newTitle">Task Title *</Label>
            <Input
              id="newTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Book fire risk assessor"
              required
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="newOwner">Owner</Label>
            <Input
              id="newOwner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="e.g. David, Abi, Solicitor"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="newDuration">Duration (Days)</Label>
              <Input
                id="newDuration"
                type="number"
                min="0"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="newRisk">Priority Level</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger id="newRisk" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!title.trim() || createTask.isPending}>
              {createTask.isPending ? "Adding…" : "Add Task"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function TaskEditSheet({
  task,
  allPhases,
  activePropertyId,
  onClose,
}: {
  task: LaunchTask | null;
  allPhases: PhaseWithTasks[];
  activePropertyId: number | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const updateTask = useUpdateTask();
  const { toast } = useToast();

  const [files, setFiles] = useState<string[]>([]);
  const [newFile, setNewFile] = useState("");
  const [dependencies, setDependencies] = useState<number[]>([]);
  const [depSearch, setDepSearch] = useState("");
  const [costTier, setCostTier] = useState<"low" | "mid" | "high" | "quoted">("mid");
  const [costLow, setCostLow] = useState(0);
  const [costMid, setCostMid] = useState(0);
  const [costHigh, setCostHigh] = useState(0);
  const [targetPhaseId, setTargetPhaseId] = useState<number | null>(null);
  const [taskStartDate, setTaskStartDate] = useState("");
  const [taskEndDate, setTaskEndDate] = useState("");
  const [quotes, setQuotes] = useState<TaskQuote[]>([]);
  const [addingQuote, setAddingQuote] = useState(false);
  const [newQuote, setNewQuote] = useState<Partial<TaskQuote>>({ status: "pending" });
  const [addingSupplierQuote, setAddingSupplierQuote] = useState(false);
  const [newSQ, setNewSQ] = useState<{
    supplierId: number | null;
    description: string;
    amountGbp: string;
    status: string;
    notes: string;
  }>({ supplierId: null, description: "", amountGbp: "", status: "Received", notes: "" });

  const [taskStatus, setTaskStatus] = useState<UpdateTaskBodyStatus>("not_started");
  const [taskRiskLevel, setTaskRiskLevel] = useState<UpdateTaskBodyRiskLevel>("low");
  const [taskIsNonNegotiable, setTaskIsNonNegotiable] = useState(false);
  const [taskIsCriticalRisk, setTaskIsCriticalRisk] = useState(false);
  const [costVatStatus, setCostVatStatus] = useState("vat_unknown");
  const [supplyScope, setSupplyScope] = useState("to_confirm");
  const [procurementStatus, setProcurementStatus] = useState("to_specify");

  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiResultRef = useRef<HTMLDivElement>(null);

  const { data: allSuppliers = [] } = useListSuppliers(PROJECT_ID);
  const { data: taskSupplierQuotes = [] } = useListTaskSupplierQuotes(
    PROJECT_ID,
    task?.id ?? 0,
    { query: { enabled: !!task?.id } },
  );
  const createSQMut = useCreateQuote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTaskSupplierQuotesQueryKey(PROJECT_ID, task?.id ?? 0) });
        queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey(PROJECT_ID) });
        setAddingSupplierQuote(false);
        setNewSQ({ supplierId: null, description: "", amountGbp: "", status: "Received", notes: "" });
      },
    },
  });

  const QUICK_PROMPTS = [
    "Find Winchester suppliers",
    "Typical UK cost range",
    "Who to contact for quotes?",
    "Key risks & mitigation",
    "CQC requirements",
  ];

  const runAiResearch = async (query: string) => {
    if (!query.trim() || aiLoading) return;
    setAiOpen(true);
    setAiResult("");
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/task-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: task?.title ?? "",
          taskDescription: task?.description ?? "",
          taskPhase: allPhases.find((p) => p.id === task?.phaseId)?.name ?? "",
          query,
        }),
      });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.error) throw new Error(payload.error);
            if (payload.content) {
              setAiResult((prev) => {
                const next = prev + payload.content;
                requestAnimationFrame(() => {
                  if (aiResultRef.current) {
                    aiResultRef.current.scrollTop = aiResultRef.current.scrollHeight;
                  }
                });
                return next;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      setAiResult(`Error: ${err instanceof Error ? err.message : "Request failed"}`);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (task) {
      setFiles(parseFiles(task.files));
      setDependencies(task.dependencies ?? []);
      setDepSearch("");
      setCostTier((task.costTier as "low" | "mid" | "high" | "quoted") ?? "mid");
      setCostLow(task.costLow ?? 0);
      setCostMid(task.costMid ?? 0);
      setCostHigh(task.costHigh ?? 0);
      setTargetPhaseId(task.phaseId);
      setTaskStartDate((task as any).startDate ? new Date((task as any).startDate).toISOString().split("T")[0] : "");
      setTaskEndDate(task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "");
      setQuotes(Array.isArray((task as any).quotes) ? (task as any).quotes : []);
      setAddingQuote(false);
      setNewQuote({ status: "pending" });
      setTaskStatus(task.status as UpdateTaskBodyStatus);
      setTaskRiskLevel(task.riskLevel as UpdateTaskBodyRiskLevel);
      setTaskIsNonNegotiable(task.isNonNegotiable ?? false);
      setTaskIsCriticalRisk(task.isCriticalRisk ?? false);
      setCostVatStatus((task as any).costVatStatus ?? "vat_unknown");
      setSupplyScope((task as any).supplyScope ?? "to_confirm");
      setProcurementStatus((task as any).procurementStatus ?? "to_specify");
    }
  }, [task?.id]);

  const previewSelectedCost = costTier === "quoted" ? (task?.selectedCost ?? 0) : costTier === "low" ? costLow : costTier === "high" ? costHigh : costMid;

  const taskPhaseIndex = allPhases.findIndex((p) => (p.tasks ?? []).some((t) => t.id === task?.id));
  const depPhases = allPhases
    .map((p, i) => ({
      ...p,
      tasks: (p.tasks ?? [])
        .filter((t) => t.id !== task?.id)
        .filter((t) => {
          const q = depSearch.trim().toLowerCase();
          return !q || t.title.toLowerCase().includes(q);
        }),
      isFuture: taskPhaseIndex >= 0 && i > taskPhaseIndex,
    }))
    .filter((p) => p.tasks.length > 0);

  const handleAddFile = () => {
    const trimmed = newFile.trim();
    if (trimmed && !files.includes(trimmed)) {
      setFiles((prev) => [...prev, trimmed]);
    }
    setNewFile("");
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleDependency = (taskId: number) => {
    setDependencies((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!task) return;

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      owner: formData.get("owner") as string,
      contractor: formData.get("contractor") as string,
      supplier: formData.get("supplier") as string,
      notes: formData.get("notes") as string,
      costTier,
      costLow,
      costMid,
      costHigh,
      startDate: (formData.get("startDate") as string) || null,
      dueDate: (formData.get("dueDate") as string) || null,
      durationDays: (() => {
        const s = formData.get("startDate") as string;
        const e = formData.get("dueDate") as string;
        if (s && e) {
          const days = Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000);
          return days > 0 ? days : (Number(formData.get("durationDays") || 0));
        }
        return Number(formData.get("durationDays") || 0);
      })(),
      riskLevel: taskRiskLevel,
      status: taskStatus,
      isNonNegotiable: taskIsNonNegotiable,
      isCriticalRisk: taskIsCriticalRisk,
      files: files.length > 0 ? JSON.stringify(files) : null,
      dependencies: dependencies.length > 0 ? dependencies : null,
      quotes,
      costVatStatus,
      supplyScope,
      procurementStatus,
      ...(targetPhaseId !== null ? { phaseId: targetPhaseId } : {}),
      ...(activePropertyId ? { propertyId: activePropertyId } : {}),
    };

    updateTask.mutate(
      { id: task.id, data: data as any },
      {
        onSuccess: () => {
          const baseUrl = `/api/projects/${PROJECT_ID}/phases-with-tasks`;
          queryClient.removeQueries({ queryKey: [activePropertyId ? `${baseUrl}?propertyId=${activePropertyId}` : baseUrl] });
          queryClient.removeQueries({ queryKey: [baseUrl] });
          queryClient.invalidateQueries({ queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) });
          queryClient.invalidateQueries({ queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID) });
          queryClient.invalidateQueries({ queryKey: getGetProjectTimelineQueryKey(PROJECT_ID) });
          toast({ title: "Task saved" });
          onClose();
        },
        onError: (err: any) => {
          const msg = err?.message ?? err?.data?.error ?? "Unknown error";
          toast({ title: "Save failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Edit Task</SheetTitle>
          <SheetDescription>Update task details, costs, files, and dependencies.</SheetDescription>
        </SheetHeader>

        {task && (
          <form onSubmit={handleSubmit} className="space-y-6 pb-10">
            <div className="space-y-4">
              {/* Move to phase */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border border-border/60">
                <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground block mb-1">Phase</Label>
                  <Select
                    value={String(targetPhaseId ?? task.phaseId)}
                    onValueChange={(v) => setTargetPhaseId(Number(v))}
                  >
                    <SelectTrigger className="h-8 text-sm border-0 bg-transparent p-0 shadow-none focus:ring-0 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allPhases.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {targetPhaseId !== null && targetPhaseId !== task.phaseId && (
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">Moving</span>
                )}
              </div>

              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue={task.title} required className="mt-1" />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" defaultValue={task.description || ""} className="mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={taskStatus} onValueChange={(v) => setTaskStatus(v as UpdateTaskBodyStatus)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="deferred">Deferred</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="riskLevel">Priority Level</Label>
                  <Select value={taskRiskLevel} onValueChange={(v) => setTaskRiskLevel(v as UpdateTaskBodyRiskLevel)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Cost Tier</Label>
                {costTier === "quoted" && (
                  <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
                    <div>
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Quoted / Actual</span>
                      <span className="text-xs text-emerald-600 dark:text-emerald-500 ml-2">{formatGBP(task?.selectedCost ?? 0)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCostTier("mid")}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                    >
                      Revert to estimate
                    </button>
                  </div>
                )}
                <div className="flex rounded-md overflow-hidden border border-border/60">
                  {(["low", "mid", "high"] as const).map((tier, i) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setCostTier(tier)}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors capitalize ${i > 0 ? "border-l border-border/60" : ""} ${
                        costTier === tier
                          ? tier === "low"
                            ? "bg-primary/20 text-primary"
                            : tier === "mid"
                            ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                            : "bg-destructive/20 text-destructive"
                          : "bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {tier.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="costLow" className="text-xs text-muted-foreground">Low (£)</Label>
                    <Input
                      id="costLow"
                      type="number"
                      value={costLow}
                      onChange={(e) => setCostLow(Number(e.target.value))}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="costMid" className="text-xs text-muted-foreground">Mid (£)</Label>
                    <Input
                      id="costMid"
                      type="number"
                      value={costMid}
                      onChange={(e) => setCostMid(Number(e.target.value))}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="costHigh" className="text-xs text-muted-foreground">High (£)</Label>
                    <Input
                      id="costHigh"
                      type="number"
                      value={costHigh}
                      onChange={(e) => setCostHigh(Number(e.target.value))}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                </div>
                {(costLow > 0 || costMid > 0 || costHigh > 0) && (
                  <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground">Selected cost preview</span>
                    <span className="text-sm font-semibold">{formatGBP(previewSelectedCost)}</span>
                  </div>
                )}
              </div>

              {/* Schedule: start + end dates with auto-computed duration */}
              <div className="space-y-2">
                <Label>Schedule</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="taskStartDate" className="text-xs text-muted-foreground">Start Date</Label>
                    <Input
                      id="taskStartDate"
                      name="startDate"
                      type="date"
                      value={taskStartDate}
                      onChange={e => setTaskStartDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="taskEndDate" className="text-xs text-muted-foreground">End Date</Label>
                    <Input
                      id="taskEndDate"
                      name="dueDate"
                      type="date"
                      value={taskEndDate}
                      onChange={e => setTaskEndDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                {/* Duration row: auto-computed or manual */}
                {taskStartDate && taskEndDate ? (() => {
                  const days = Math.round((new Date(taskEndDate).getTime() - new Date(taskStartDate).getTime()) / 86400000);
                  return (
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-md">
                      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {days > 0
                        ? <span className="text-sm"><span className="font-semibold">{days}</span> <span className="text-muted-foreground">days duration (auto)</span></span>
                        : <span className="text-xs text-destructive">End date must be after start date</span>
                      }
                    </div>
                  );
                })() : (
                  <div className="flex items-center gap-3">
                    <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <Label htmlFor="durationDays" className="text-xs text-muted-foreground shrink-0">Manual duration (days)</Label>
                    <Input id="durationDays" name="durationDays" type="number" defaultValue={task.durationDays || ""} className="h-7 w-24 text-sm" />
                  </div>
                )}
              </div>

              {/* Cost metadata: VAT status, supply scope, procurement status */}
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost &amp; Procurement</p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">VAT Status</Label>
                    <Select value={costVatStatus} onValueChange={setCostVatStatus}>
                      <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vat_unknown">⚠ Unknown — needs clarification</SelectItem>
                        <SelectItem value="inc_vat">Inc. VAT — price includes 20% VAT</SelectItem>
                        <SelectItem value="ex_vat">Ex. VAT — add 20% on top</SelectItem>
                        <SelectItem value="vat_na">N/A — no VAT applicable</SelectItem>
                        <SelectItem value="mixed">Mixed — partially VAT-bearing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Supply Scope</Label>
                    <Select value={supplyScope} onValueChange={setSupplyScope}>
                      <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="to_confirm">To Confirm</SelectItem>
                        <SelectItem value="included">Included in package</SelectItem>
                        <SelectItem value="excluded">Excluded</SelectItem>
                        <SelectItem value="client_supplied">Client supplied</SelectItem>
                        <SelectItem value="contractor_supplied">Contractor supplied</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Procurement Status</Label>
                    <Select value={procurementStatus} onValueChange={setProcurementStatus}>
                      <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_required">Not Required</SelectItem>
                        <SelectItem value="to_specify">To Specify</SelectItem>
                        <SelectItem value="to_quote">To Quote</SelectItem>
                        <SelectItem value="quote_received">Quote Received</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="ordered">Ordered</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="installed">Installed</SelectItem>
                        <SelectItem value="included_in_contractor">Included in contractor pkg</SelectItem>
                        <SelectItem value="excluded_client_direct">Excluded — client direct</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="owner">Owner</Label>
                  <Input id="owner" name="owner" defaultValue={task.owner || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="contractor">Contractor</Label>
                  <Input id="contractor" name="contractor" defaultValue={task.contractor || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input id="supplier" name="supplier" defaultValue={task.supplier || ""} className="mt-1" />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" defaultValue={task.notes || ""} className="mt-1" />
              </div>

              {/* Files */}
              <div className="space-y-2">
                <Label>Attached Files</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="File name or URL"
                    value={newFile}
                    onChange={(e) => setNewFile(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddFile(); } }}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleAddFile}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {files.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted rounded px-3 py-1.5 text-sm">
                        <span className="truncate flex-1 mr-2">{file}</span>
                        <button type="button" onClick={() => handleRemoveFile(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {files.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">No files attached. Add a file name or URL above.</p>
                )}
              </div>

              {/* Dependencies */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Task Dependencies</Label>
                  {dependencies.length > 0 && (
                    <span className="text-xs text-primary font-medium">{dependencies.length} selected</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Select tasks that must be completed before this one can start.</p>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={depSearch}
                    onChange={e => setDepSearch(e.target.value)}
                    placeholder="Search tasks…"
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                {depPhases.length > 0 ? (
                  <ScrollArea className="h-48 border rounded-md mt-1">
                    <div className="p-2 space-y-3">
                      {depPhases.map((phase) => (
                        <div key={phase.id}>
                          <p className={`text-[10px] font-semibold uppercase tracking-wider px-1 mb-1 ${phase.isFuture ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                            {phase.name}{phase.isFuture && " (later phase)"}
                          </p>
                          <div className="space-y-0.5">
                            {phase.tasks.map((t) => (
                              <label
                                key={t.id}
                                className="flex items-start gap-2.5 cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1.5 transition-colors"
                              >
                                <Checkbox
                                  checked={dependencies.includes(t.id)}
                                  onCheckedChange={() => toggleDependency(t.id)}
                                  className="mt-0.5 shrink-0"
                                />
                                <span className="text-sm leading-snug">{t.title}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1 border rounded-md p-3">
                    {depSearch ? "No tasks match your search." : "No other tasks available."}
                  </p>
                )}
              </div>

              {/* Quotes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" />Quotes</Label>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => { setAddingSupplierQuote(true); setNewSQ({ supplierId: null, description: "", amountGbp: "", status: "Received", notes: "" }); }}
                    >
                      <Tag className="w-3 h-3" />From Supplier
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => { setAddingQuote(true); setNewQuote({ status: "pending" }); }}
                    >
                      <Plus className="w-3 h-3" />Add Quote
                    </Button>
                  </div>
                </div>

                {/* Linked supplier quotes for this task */}
                {taskSupplierQuotes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Building2 className="w-3 h-3" />From Suppliers
                    </p>
                    {taskSupplierQuotes.map(q => (
                      <div key={q.id} className={`border rounded-lg p-2.5 text-sm ${q.status === "Accepted" ? "border-primary/30 bg-primary/5" : q.status === "Rejected" ? "opacity-60 bg-muted/30" : "bg-muted/20"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-semibold">
                              <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{q.supplierName}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{q.description}</p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${q.status === "Accepted" ? "bg-primary/15 text-primary" : q.status === "Rejected" ? "bg-red-100 text-red-600" : q.status === "Shortlisted" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{q.status}</span>
                        </div>
                        {q.amountGbp != null && (
                          <p className="text-primary font-semibold text-xs mt-1">{formatGBP(parseFloat(q.amountGbp))}</p>
                        )}
                        {q.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{q.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* "From Supplier" add form */}
                {addingSupplierQuote && (
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link Supplier Quote</p>
                    <div>
                      <Label className="text-xs">Supplier *</Label>
                      <Select
                        value={newSQ.supplierId?.toString() ?? ""}
                        onValueChange={v => setNewSQ(q => ({ ...q, supplierId: parseInt(v) }))}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs">
                          <SelectValue placeholder="Select supplier…" />
                        </SelectTrigger>
                        <SelectContent>
                          {allSuppliers.length === 0 ? (
                            <SelectItem value="__none" disabled>No suppliers yet — add one in Suppliers</SelectItem>
                          ) : (
                            allSuppliers.map(s => (
                              <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs">Description *</Label>
                        <Input
                          value={newSQ.description}
                          onChange={e => setNewSQ(q => ({ ...q, description: e.target.value }))}
                          placeholder="e.g. Full fit-out quote"
                          className="mt-1 h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Amount (£)</Label>
                        <div className="relative mt-1">
                          <PoundSterling className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                          <Input
                            type="number"
                            value={newSQ.amountGbp}
                            onChange={e => setNewSQ(q => ({ ...q, amountGbp: e.target.value }))}
                            placeholder="0"
                            className="pl-8 h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Status</Label>
                        <Select value={newSQ.status} onValueChange={v => setNewSQ(q => ({ ...q, status: v }))}>
                          <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Requested", "Received", "Shortlisted", "Accepted", "Rejected"].map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Notes</Label>
                        <Textarea
                          value={newSQ.notes}
                          onChange={e => setNewSQ(q => ({ ...q, notes: e.target.value }))}
                          placeholder="Optional notes…"
                          className="mt-1 h-12 resize-none text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingSupplierQuote(false)}>Cancel</Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={!newSQ.supplierId || !newSQ.description.trim() || createSQMut.isPending}
                        onClick={() => {
                          if (!newSQ.supplierId || !newSQ.description.trim()) return;
                          createSQMut.mutate({
                            id: newSQ.supplierId,
                            data: {
                              description: newSQ.description.trim(),
                              amountGbp: newSQ.amountGbp ? parseFloat(newSQ.amountGbp) : null,
                              status: newSQ.status,
                              notes: newSQ.notes,
                              taskId: task?.id ?? null,
                            },
                          });
                        }}
                      >
                        {createSQMut.isPending ? "Saving…" : "Save Quote"}
                      </Button>
                    </div>
                  </div>
                )}

                {addingQuote && (
                  <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Quote</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs">Company *</Label>
                        <div className="relative mt-1">
                          <Building2 className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                          <Input
                            value={newQuote.company ?? ""}
                            onChange={e => setNewQuote(q => ({ ...q, company: e.target.value }))}
                            placeholder="Company name"
                            className="pl-8 h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Contact</Label>
                        <Input value={newQuote.contact ?? ""} onChange={e => setNewQuote(q => ({ ...q, contact: e.target.value }))} placeholder="Name" className="mt-1 h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">Amount (£)</Label>
                        <div className="relative mt-1">
                          <PoundSterling className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                          <Input
                            type="number"
                            value={newQuote.amount ?? ""}
                            onChange={e => setNewQuote(q => ({ ...q, amount: parseFloat(e.target.value) || undefined }))}
                            placeholder="0"
                            className="pl-8 h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Phone</Label>
                        <div className="relative mt-1">
                          <Phone className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                          <Input value={newQuote.phone ?? ""} onChange={e => setNewQuote(q => ({ ...q, phone: e.target.value }))} placeholder="Phone" className="pl-8 h-8 text-sm" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Email</Label>
                        <div className="relative mt-1">
                          <Mail className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                          <Input type="email" value={newQuote.email ?? ""} onChange={e => setNewQuote(q => ({ ...q, email: e.target.value }))} placeholder="Email" className="pl-8 h-8 text-sm" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Date received</Label>
                        <Input type="date" value={newQuote.date ?? ""} onChange={e => setNewQuote(q => ({ ...q, date: e.target.value }))} className="mt-1 h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">Status</Label>
                        <Select value={newQuote.status ?? "pending"} onValueChange={v => setNewQuote(q => ({ ...q, status: v as TaskQuote["status"] }))}>
                          <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Notes</Label>
                        <Textarea value={newQuote.notes ?? ""} onChange={e => setNewQuote(q => ({ ...q, notes: e.target.value }))} placeholder="Any additional notes…" className="mt-1 h-16 resize-none text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingQuote(false)}>Cancel</Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={!newQuote.company?.trim()}
                        onClick={() => {
                          if (!newQuote.company?.trim()) return;
                          const quote: TaskQuote = {
                            id: `q_${Date.now()}`,
                            company: newQuote.company.trim(),
                            contact: newQuote.contact || null,
                            phone: newQuote.phone || null,
                            email: newQuote.email || null,
                            amount: newQuote.amount ?? null,
                            notes: newQuote.notes || null,
                            date: newQuote.date || null,
                            status: newQuote.status ?? "pending",
                          };
                          setQuotes(prev => [...prev, quote]);
                          setAddingQuote(false);
                          setNewQuote({ status: "pending" });
                        }}
                      >
                        Save Quote
                      </Button>
                    </div>
                  </div>
                )}

                {quotes.length > 0 ? (
                  <div className="space-y-2">
                    {quotes.map((q) => (
                      <div key={q.id} className={`border rounded-lg p-3 space-y-1.5 text-sm ${q.status === "accepted" ? "border-primary/30 bg-primary/5" : q.status === "rejected" ? "opacity-60" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            {q.company}
                            {q.status === "accepted" && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                            {q.status === "pending" && <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1">
                            <Select value={q.status} onValueChange={v => setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, status: v as TaskQuote["status"] } : x))}>
                              <SelectTrigger className="h-6 text-[10px] w-24 shrink-0"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="accepted">Accepted</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setQuotes(prev => prev.filter(x => x.id !== q.id))}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {q.amount != null && (
                          <p className="text-primary font-semibold">{formatGBP(q.amount)}</p>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {q.contact && <span>{q.contact}</span>}
                          {q.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{q.phone}</span>}
                          {q.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{q.email}</span>}
                          {q.date && <span>{new Date(q.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                        </div>
                        {q.notes && <p className="text-xs text-muted-foreground italic">{q.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : !addingQuote && (
                  <p className="text-xs text-muted-foreground border rounded-md p-3">No quotes logged yet. Click "Add Quote" to record a supplier quote.</p>
                )}
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div>
                  <Label htmlFor="isNonNegotiable" className="text-base">Non-Negotiable (Must Do)</Label>
                  <p className="text-sm text-muted-foreground">This task is required for launch.</p>
                </div>
                <Switch
                  id="isNonNegotiable"
                  checked={taskIsNonNegotiable}
                  onCheckedChange={setTaskIsNonNegotiable}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div>
                  <Label htmlFor="isCriticalRisk" className="text-base text-destructive">Risk Flag</Label>
                  <p className="text-sm text-muted-foreground">Manually flag this task as a risk to the project.</p>
                </div>
                <Switch
                  id="isCriticalRisk"
                  checked={taskIsCriticalRisk}
                  onCheckedChange={setTaskIsCriticalRisk}
                />
              </div>
            </div>

            {/* AI Research Panel */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setAiOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/15 hover:to-primary/8 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">AI Research Assistant</span>
                </div>
                {aiOpen ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-primary" />}
              </button>

              {aiOpen && (
                <div className="p-4 space-y-3 bg-card">
                  <p className="text-xs text-muted-foreground">Ask for Winchester-specific supplier contacts, UK cost benchmarks, CQC guidance, or risk advice for this task.</p>

                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => runAiResearch(prompt)}
                        disabled={aiLoading}
                        className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Ask a custom question…"
                      value={aiQuery}
                      onChange={(e) => setAiQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          runAiResearch(aiQuery);
                          setAiQuery("");
                        }
                      }}
                      disabled={aiLoading}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      type="button"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      disabled={aiLoading || !aiQuery.trim()}
                      onClick={() => { runAiResearch(aiQuery); setAiQuery(""); }}
                    >
                      {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </Button>
                  </div>

                  {(aiResult || aiLoading) && (
                    <div
                      ref={aiResultRef}
                      className="max-h-64 overflow-y-auto rounded-md bg-muted/60 p-3 text-xs leading-relaxed whitespace-pre-wrap font-sans border border-border/40"
                    >
                      {aiResult || <span className="text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin inline" /> Researching…</span>}
                      {aiLoading && aiResult && <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-0.5 align-middle" />}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={updateTask.isPending}>
                {updateTask.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
