import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPhasesWithTasks,
  getGetPhasesWithTasksQueryKey,
  useUpdateTask,
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
import { AlertTriangle, Pencil, AlertCircle, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export default function ProjectPage() {
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState<LaunchTask | null>(null);

  // Parse ?taskId= deep-link from optimisation page
  const highlightedTaskId = (() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("taskId");
    return raw ? parseInt(raw) : null;
  })();

  const { data: phases, isLoading: isPhasesLoading } = useGetPhasesWithTasks(PROJECT_ID, {
    query: { queryKey: getGetPhasesWithTasksQueryKey(PROJECT_ID), enabled: true },
  });

  const { data: risks } = useGetRiskFlags(PROJECT_ID, {
    query: { queryKey: getGetRiskFlagsQueryKey(PROJECT_ID), enabled: true },
  });

  const [openPhases, setOpenPhases] = useState<string[]>([]);

  // Once phases load, auto-open the relevant phase and scroll to the task
  useEffect(() => {
    if (!highlightedTaskId || !phases) return;
    const phase = phases.find(p => p.tasks?.some(t => t.id === highlightedTaskId));
    if (phase) {
      setOpenPhases(prev => {
        const key = `phase-${phase.id}`;
        return prev.includes(key) ? prev : [...prev, key];
      });
      // Scroll after accordion opens
      setTimeout(() => {
        const el = document.getElementById(`task-${highlightedTaskId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Project Plan</h2>
        <p className="text-muted-foreground mt-1">Detailed phase and task management.</p>
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

      <Card className="shadow-sm border-border/60">
        <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Total Project Selected Cost
            </p>
            <p className="text-3xl font-bold">{formatGBP(totalSelectedCost)}</p>
          </div>
        </CardContent>
      </Card>

      <Accordion
        type="multiple"
        value={openPhases}
        onValueChange={setOpenPhases}
        className="space-y-4"
      >
        {phases?.map((phase) => (
          <AccordionItem
            key={phase.id}
            value={`phase-${phase.id}`}
            className="border bg-card rounded-lg overflow-hidden shadow-sm"
          >
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
              <div className="flex flex-col md:flex-row md:items-center gap-4 w-full pr-4 text-left">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-lg">{phase.name}</span>
                    <Badge variant="secondary" className={STATUS_COLORS[phase.status] || ""}>
                      {phase.status.replace("_", " ")}
                    </Badge>
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
                      <TableHead className="w-[50px]"></TableHead>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingTask(task)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
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
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <TaskEditSheet
        task={editingTask}
        allPhases={phases ?? []}
        onClose={() => setEditingTask(null)}
      />
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
