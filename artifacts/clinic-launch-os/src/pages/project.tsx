import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPhasesWithTasks,
  getGetPhasesWithTasksQueryKey,
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
} from "@workspace/api-client-react";
import type { LaunchTask, UpdateTaskBodyStatus, UpdateTaskBodyRiskLevel, PhaseWithTasks } from "@workspace/api-client-react";
import { formatGBP } from "@/lib/format";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
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
import { AlertTriangle, Pencil, AlertCircle, Plus, X, Trash2, CalendarDays, Save, List, GanttChartSquare, ChevronRight, ChevronDown, RotateCcw, Loader2, ZoomIn, ZoomOut, FileText, Copy, Check, Sparkles, Send } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  // Phase start day = sum of max-duration of all preceding phases.
  // A task's position within the Gantt = taskOffsets[id] if set, else phaseStartDay[phaseId].
  const phaseStartDays = useMemo<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    let cursor = 0;
    for (const phase of sortedPhases) {
      map[phase.id] = cursor;
      // phase duration = max end-day of any of its tasks (relative to cursor)
      const phaseEnd = phase.tasks?.reduce((maxEnd, t) => {
        const tAbsStart = taskOffsets[t.id] ?? cursor;
        const tEnd = tAbsStart + getTaskDuration(t) - cursor;
        return Math.max(maxEnd, tEnd);
      }, 0) ?? 0;
      cursor += Math.max(1, phaseEnd);
    }
    return map;
  }, [sortedPhases, taskOffsets, getTaskDuration]);

  const totalDays = useMemo(() => {
    let max = 90;
    for (const phase of sortedPhases) {
      const phaseStart = phaseStartDays[phase.id] ?? 0;
      for (const t of phase.tasks ?? []) {
        const absStart = taskOffsets[t.id] ?? phaseStart;
        max = Math.max(max, absStart + getTaskDuration(t));
      }
    }
    return max + 28;
  }, [sortedPhases, phaseStartDays, taskOffsets, getTaskDuration]);

  const baseDate = startDateObj ?? new Date();

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
    start.setDate(1);
    let d = Math.ceil((start.getTime() - baseDate.getTime()) / 86400000);
    while (d <= totalDays) {
      const date = addDays(baseDate, d);
      marks.push({
        day: d,
        label: date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      });
      date.setMonth(date.getMonth() + 1);
      d = Math.round((date.getTime() - baseDate.getTime()) / 86400000);
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
        updateTask.mutate(
          { id: taskId, data: { durationDays: newDur } },
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
      }
      // move: already persisted to localStorage via useEffect

      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [dayWidth, updateTask, invalidateAfterTaskChange, onTaskClick]);

  const totalWidth = totalDays * dayWidth;

  const statusBarColor: Record<string, string> = {
    complete:    "#059669",
    in_progress: "#2563eb",
    blocked:     "#dc2626",
    deferred:    "#9ca3af",
    not_started: "",
  };

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
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>Drag bar to move · drag right edge to resize</span>
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
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "68vh" }}>
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
            </div>
          </div>

          {/* ── Phase + task rows ── */}
          {sortedPhases.map((phase, phaseIdx) => {
            const color = PHASE_PALETTE[phaseIdx % PHASE_PALETTE.length];
            const phaseStart = phaseStartDays[phase.id] ?? 0;
            const isCollapsed = collapsedPhases.has(phase.id);

            // Phase bar: from phaseStart to latest task end
            const phaseEndDay = (phase.tasks ?? []).reduce((maxEnd, t) => {
              const absStart = taskOffsets[t.id] ?? phaseStart;
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
                  const absStart = taskOffsets[task.id] ?? phaseStart;
                  const dur = getTaskDuration(task);
                  const barW = Math.max(8, dur * dayWidth);
                  const isSaving = savingIds.has(task.id);
                  const barColor = statusBarColor[task.status] || color.bar;
                  const barOpacity = task.status === "deferred" ? 0.4 : task.status === "not_started" ? 0.65 : 0.88;

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

                        {/* Task bar */}
                        <div
                          title={`${task.title}\nDay ${absStart}–${absStart + dur} · ${dur} day${dur !== 1 ? "s" : ""}\nDrag to reposition, drag right edge to resize`}
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
                          {barW > 36 && (
                            <span style={{ color: "white", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, pointerEvents: "none" }}>
                              {task.title}
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
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-muted/20 flex-wrap">
        {[
          { color: "#059669", label: "Complete" },
          { color: "#2563eb", label: "In progress" },
          { color: "#dc2626", label: "Blocked" },
          { color: "#9ca3af", label: "Deferred" },
          { color: "#6d28d9", label: "Not started (phase colour)" },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
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

  const [viewMode, setViewMode] = useState<"list" | "gantt">("list");
  const [localStartDate, setLocalStartDate] = useState("");
  const [localOpenDate, setLocalOpenDate] = useState("");
  const [datesDirty, setDatesDirty] = useState(false);

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
          queryClient.invalidateQueries({ queryKey: getGetPhasesWithTasksQueryKey(PROJECT_ID) });
          queryClient.invalidateQueries({ queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) });
          queryClient.invalidateQueries({ queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID) });
          setConfirmDeleteId(null);
        },
      }
    );
  };

  const { data: phases, isLoading: isPhasesLoading } = useGetPhasesWithTasks(PROJECT_ID, {
    query: { queryKey: getGetPhasesWithTasksQueryKey(PROJECT_ID), enabled: true },
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
    queryClient.invalidateQueries({ queryKey: getGetPhasesWithTasksQueryKey(PROJECT_ID) });
    queryClient.invalidateQueries({ queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) });
    queryClient.invalidateQueries({ queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID) });
  };

  const handleCostTierChange = (task: LaunchTask, newTier: "low" | "mid" | "high") => {
    updateTask.mutate(
      { id: task.id, data: { costTier: newTier } },
      { onSuccess: invalidateAfterTaskChange }
    );
  };

  const handleStatusChange = (task: LaunchTask, newStatus: UpdateTaskBodyStatus) => {
    updateTask.mutate(
      { id: task.id, data: { status: newStatus } },
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
          const risk = task.riskLevel || "low";
          const costStr = task.selectedCost > 0 ? `${formatGBP(task.selectedCost)} (${task.costTier})` : "£0";
          const flags = [
            task.isNonNegotiable ? "NON-NEGOTIABLE" : "",
            task.isCriticalRisk ? "CRITICAL RISK" : "",
          ].filter(Boolean).join(", ");

          lines.push(`${done} **${task.title}**`);
          lines.push(`   ${startStr} → ${endStr} (${dur}d) | Status: ${task.status.replace("_", " ")} | Owner: ${owner} | Risk: ${risk} | Cost: ${costStr}${flags ? ` | ⚠ ${flags}` : ""}`);
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
      maybeSet("riskLevel", update.risk_level, "Risk", task.riskLevel ?? "low");
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
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Project Plan"
          subtitle="Set your key dates, then manage phases and tasks."
        />
        <div className="flex items-center gap-2 shrink-0 mt-1">
        <button
          onClick={() => setShowExport(true)}
          className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium border bg-card shadow-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Export plan for Claude"
        >
          <FileText className="w-3.5 h-3.5" />
          Export
        </button>
        <button
          onClick={() => { setShowImport(true); setImportDiffs(null); setImportError(""); setImportText(""); setImportApplied(0); }}
          className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium border bg-card shadow-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Import Claude's response"
        >
          <Copy className="w-3.5 h-3.5" />
          Import
        </button>
        <div className="flex items-center gap-1 border rounded-lg p-1 bg-card shadow-sm no-print">
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === "list"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
          <button
            onClick={() => setViewMode("gantt")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === "gantt"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GanttChartSquare className="w-3.5 h-3.5" />
            Gantt
          </button>
        </div>
        </div>
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

          {/* Cost summary */}
          <div className="pt-2 border-t border-border/50 flex items-center justify-between">
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Total Project Selected Cost</p>
            <p className="text-2xl font-bold">{formatGBP(totalSelectedCost)}</p>
          </div>
        </CardContent>
      </Card>

      {viewMode === "gantt" && phases && (
        <GanttView
          key={ganttKey}
          phases={phases}
          startDateObj={startDateObj}
          updateTask={updateTask}
          invalidateAfterTaskChange={invalidateAfterTaskChange}
          onTaskClick={setEditingTask}
        />
      )}

      <Accordion
        type="multiple"
        value={openPhases}
        onValueChange={setOpenPhases}
        className={`space-y-4 ${viewMode === "gantt" ? "hidden" : ""}`}
      >
        {phases?.map((phase) => {
          const win = phaseWindows?.get(phase.id);
          const windowBadgeClass =
            !win || win.status === "unknown" ? "bg-muted text-muted-foreground" :
            win.status === "on_track" ? "bg-primary/15 text-primary" :
            win.status === "tight" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300" :
            "bg-destructive/15 text-destructive";

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
                        <TableHead>Risk</TableHead>
                        <TableHead>Cost Tier Selection</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="w-[80px] no-print"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phase.tasks?.map((task) => (
                        <TableRow
                          key={task.id}
                          id={`task-${task.id}`}
                          className={`cursor-pointer hover:bg-muted/40 transition-colors ${highlightedTaskId === task.id ? "ring-2 ring-primary ring-inset bg-primary/5" : ""}`}
                          onClick={() => setEditingTask(task)}
                        >
                          <TableCell>
                            <div className="font-medium text-foreground">{task.title}</div>
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              {task.isNonNegotiable && (
                                <Badge variant="outline" className="text-[10px] h-4 py-0">
                                  Must Do
                                </Badge>
                              )}
                              {task.isCriticalRisk && (
                                <Badge variant="destructive" className="text-[10px] h-4 py-0 bg-destructive/10 text-destructive border-transparent">
                                  Critical
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
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className="no-print" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
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
                                  className="h-8 w-8"
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
                          <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
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
              <Label htmlFor="newRisk">Risk Level</Label>
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
  onClose,
}: {
  task: LaunchTask | null;
  allPhases: PhaseWithTasks[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const updateTask = useUpdateTask();

  const [files, setFiles] = useState<string[]>([]);
  const [newFile, setNewFile] = useState("");
  const [dependencies, setDependencies] = useState<number[]>([]);
  const [costTier, setCostTier] = useState<"low" | "mid" | "high">("mid");
  const [costLow, setCostLow] = useState(0);
  const [costMid, setCostMid] = useState(0);
  const [costHigh, setCostHigh] = useState(0);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiResultRef = useRef<HTMLDivElement>(null);

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
      setCostTier((task.costTier as "low" | "mid" | "high") ?? "mid");
      setCostLow(task.costLow ?? 0);
      setCostMid(task.costMid ?? 0);
      setCostHigh(task.costHigh ?? 0);
    }
  }, [task?.id]);

  const previewSelectedCost = costTier === "low" ? costLow : costTier === "high" ? costHigh : costMid;

  const allTasks = allPhases.flatMap((p) =>
    (p.tasks ?? []).filter((t) => t.id !== task?.id).map((t) => ({ id: t.id, title: t.title, phaseName: p.name }))
  );

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
      dueDate: (formData.get("dueDate") as string) || undefined,
      durationDays: Number(formData.get("durationDays") || 0),
      riskLevel: formData.get("riskLevel") as UpdateTaskBodyRiskLevel,
      status: formData.get("status") as UpdateTaskBodyStatus,
      isNonNegotiable: formData.get("isNonNegotiable") === "on",
      isCriticalRisk: formData.get("isCriticalRisk") === "on",
      files: files.length > 0 ? JSON.stringify(files) : null,
      dependencies: dependencies.length > 0 ? dependencies : null,
    };

    updateTask.mutate(
      { id: task.id, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPhasesWithTasksQueryKey(PROJECT_ID) });
          queryClient.invalidateQueries({ queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) });
          queryClient.invalidateQueries({ queryKey: getGetOptimisationAnalysisQueryKey(PROJECT_ID) });
          onClose();
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
                  <Select name="status" defaultValue={task.status}>
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
                  <Label htmlFor="riskLevel">Risk Level</Label>
                  <Select name="riskLevel" defaultValue={task.riskLevel}>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="durationDays">Duration (Days)</Label>
                  <Input id="durationDays" name="durationDays" type="number" defaultValue={task.durationDays || ""} className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                <Label>Task Dependencies</Label>
                <p className="text-xs text-muted-foreground">Select tasks that must complete before this one.</p>
                {allTasks.length > 0 ? (
                  <ScrollArea className="h-44 border rounded-md p-3 mt-1">
                    <div className="space-y-1">
                      {allTasks.map((t) => (
                        <label
                          key={t.id}
                          className="flex items-start gap-2.5 cursor-pointer hover:bg-muted/50 rounded px-1 py-1.5 transition-colors"
                        >
                          <Checkbox
                            checked={dependencies.includes(t.id)}
                            onCheckedChange={() => toggleDependency(t.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm leading-snug">{t.title}</span>
                            <span className="block text-[11px] text-muted-foreground">{t.phaseName}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1 border rounded-md p-3">No other tasks available.</p>
                )}
                {dependencies.length > 0 && (
                  <p className="text-xs text-primary mt-1">{dependencies.length} task{dependencies.length !== 1 ? "s" : ""} selected as dependencies.</p>
                )}
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div>
                  <Label htmlFor="isNonNegotiable" className="text-base">Non-Negotiable (Must Do)</Label>
                  <p className="text-sm text-muted-foreground">This task is required for launch.</p>
                </div>
                <Switch id="isNonNegotiable" name="isNonNegotiable" defaultChecked={task.isNonNegotiable} />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div>
                  <Label htmlFor="isCriticalRisk" className="text-base text-destructive">Critical Risk Flag</Label>
                  <p className="text-sm text-muted-foreground">Flag this task as a critical risk to the project.</p>
                </div>
                <Switch id="isCriticalRisk" name="isCriticalRisk" defaultChecked={task.isCriticalRisk} />
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
                      className="max-h-64 overflow-y-auto rounded-md bg-muted/60 p-3 text-xs leading-relaxed whitespace-pre-wrap font-mono border border-border/40"
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
