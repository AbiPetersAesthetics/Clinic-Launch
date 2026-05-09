import { useState, useMemo, useEffect } from "react";
import {
  useListComplianceItems,
  getListComplianceItemsQueryKey,
  useUpdateComplianceItem,
  useGetComplianceSummary,
  getGetComplianceSummaryQueryKey,
  useListCqcMilestones,
  getListCqcMilestonesQueryKey,
  useUpdateCqcMilestone,
  useGetProjectDashboard,
  getGetProjectDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  BookOpen,
  ClipboardList,
  Calendar,
} from "lucide-react";

const PROJECT_ID = 1;

const SECTION_ORDER = [
  "CQC Registration",
  "Clinical Governance",
  "Infection Control",
  "Prescriber Arrangements",
  "Staff Training",
  "Insurance & Indemnity",
  "Opening Requirements",
  "Policy Library",
];

const SECTION_ICONS: Record<string, React.ElementType> = {
  "CQC Registration": ShieldCheck,
  "Clinical Governance": ClipboardList,
  "Infection Control": AlertTriangle,
  "Prescriber Arrangements": FileText,
  "Staff Training": BookOpen,
  "Insurance & Indemnity": ShieldCheck,
  "Opening Requirements": CheckCircle2,
  "Policy Library": FileText,
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
  not_applicable: "N/A",
};

const POLICY_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  signed_off: "Signed Off",
};

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
};

function statusBadge(status: string) {
  if (status === "complete") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200";
  if (status === "in_progress") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200";
  if (status === "not_applicable") return "bg-muted text-muted-foreground border-border";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200";
}

function policyStatusBadge(status: string | null) {
  if (status === "signed_off") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200";
  if (status === "reviewed") return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200";
  return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200";
}

function milestoneStatusColor(status: string) {
  if (status === "complete") return { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" };
  if (status === "in_progress") return { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" };
  return { dot: "bg-muted-foreground/30", text: "text-muted-foreground", bg: "bg-muted/30 border-border" };
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={10} className="text-muted/40" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.7s ease" }}
      />
    </svg>
  );
}

export default function CompliancePage() {
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["CQC Registration"]));
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editAttachmentUrl, setEditAttachmentUrl] = useState("");
  const [targetOpenDate, setTargetOpenDate] = useState("");
  const [editingMilestone, setEditingMilestone] = useState<number | null>(null);
  const [editMilestoneNotes, setEditMilestoneNotes] = useState("");
  const [editMilestoneDate, setEditMilestoneDate] = useState("");

  const { data: dashboard } = useGetProjectDashboard(PROJECT_ID, {
    query: { queryKey: getGetProjectDashboardQueryKey(PROJECT_ID) },
  });

  // Seed targetOpenDate from project's configured opening date (user can still override locally)
  useEffect(() => {
    if (dashboard?.targetOpeningDate && !targetOpenDate) {
      setTargetOpenDate(dashboard.targetOpeningDate.slice(0, 10));
    }
  }, [dashboard?.targetOpeningDate]);

  const { data: items = [] } = useListComplianceItems(PROJECT_ID, {
    query: { queryKey: getListComplianceItemsQueryKey(PROJECT_ID) },
  });

  const { data: summary } = useGetComplianceSummary(PROJECT_ID, {
    query: { queryKey: getGetComplianceSummaryQueryKey(PROJECT_ID) },
  });

  const { data: milestones = [] } = useListCqcMilestones(PROJECT_ID, {
    query: { queryKey: getListCqcMilestonesQueryKey(PROJECT_ID) },
  });

  const { mutate: updateItem } = useUpdateComplianceItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListComplianceItemsQueryKey(PROJECT_ID) });
        queryClient.invalidateQueries({ queryKey: getGetComplianceSummaryQueryKey(PROJECT_ID) });
      },
    },
  });

  const { mutate: updateMilestone } = useUpdateCqcMilestone({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCqcMilestonesQueryKey(PROJECT_ID) });
        queryClient.invalidateQueries({ queryKey: getGetComplianceSummaryQueryKey(PROJECT_ID) });
      },
    },
  });

  const itemsBySection = useMemo(() => {
    const map: Record<string, typeof items> = {};
    for (const item of items) {
      if (!map[item.section]) map[item.section] = [];
      map[item.section].push(item);
    }
    return map;
  }, [items]);

  const sections = SECTION_ORDER.filter(s => itemsBySection[s]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const cycleStatus = (item: (typeof items)[0]) => {
    if (item.policyStatus !== null && item.policyStatus !== undefined) {
      const order = ["draft", "reviewed", "signed_off"];
      const current = item.policyStatus ?? "draft";
      const next = order[(order.indexOf(current) + 1) % order.length];
      updateItem({ id: item.id, data: { policyStatus: next as "draft" | "reviewed" | "signed_off" } });
    } else {
      const order = ["not_started", "in_progress", "complete", "not_applicable"];
      const next = order[(order.indexOf(item.status) + 1) % order.length];
      updateItem({ id: item.id, data: { status: next as "not_started" | "in_progress" | "complete" | "not_applicable" } });
    }
  };

  const cycleMilestoneStatus = (m: (typeof milestones)[0]) => {
    const order = ["not_started", "in_progress", "complete"];
    const next = order[(order.indexOf(m.status) + 1) % order.length];
    updateMilestone({ id: m.id, data: { status: next as "not_started" | "in_progress" | "complete" } });
  };

  const saveItemEdit = (item: (typeof items)[0]) => {
    updateItem({ id: item.id, data: { notes: editNotes || null, requiredByDate: editDate || null, attachmentUrl: editAttachmentUrl || null } });
    setEditingItem(null);
  };

  const saveMilestoneEdit = (m: (typeof milestones)[0]) => {
    updateMilestone({ id: m.id, data: { notes: editMilestoneNotes || null, dueDate: editMilestoneDate || null } });
    setEditingMilestone(null);
  };

  // CQC timeline warning: sum of all lead times = minimum weeks needed
  const totalCqcWeeks = milestones.reduce((sum, m) => sum + m.leadTimeWeeks, 0);
  const cqcAtRisk = useMemo(() => {
    if (!targetOpenDate) return false;
    const target = new Date(targetOpenDate);
    const weeksToOpen = (target.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7);
    return weeksToOpen < totalCqcWeeks && summary?.cqcNotStarted;
  }, [targetOpenDate, totalCqcWeeks, summary]);

  const score = summary?.overallScore ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">CQC & Clinical Compliance</h2>
        <p className="text-muted-foreground mt-1">Track every regulatory requirement before the clinic can legally open.</p>
      </div>

      {/* Score + CQC Warning */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score Ring */}
        <Card className="shadow-sm border-border/60 flex flex-col items-center justify-center py-6">
          <div className="relative">
            <ScoreRing score={score} size={120} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{score}%</span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Compliant</span>
            </div>
          </div>
          <p className="text-sm font-medium mt-3">Compliance Readiness</p>
          <p className="text-xs text-muted-foreground mt-1 text-center px-4">
            {summary ? `${summary.totalItems} items tracked across ${summary.sectionSummaries.length} sections` : "Loading…"}
          </p>
        </Card>

        {/* Section Scores */}
        <Card className="shadow-sm border-border/60 col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Section Readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {(summary?.sectionSummaries ?? []).map(s => (
                <div key={s.section} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-40 shrink-0 truncate">{s.section}</span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        s.percentComplete >= 75 ? "bg-emerald-500" :
                        s.percentComplete >= 40 ? "bg-amber-500" : "bg-red-400"
                      }`}
                      style={{ width: `${s.percentComplete}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold w-8 text-right shrink-0 ${
                    s.percentComplete >= 75 ? "text-emerald-600 dark:text-emerald-400" :
                    s.percentComplete >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                  }`}>{s.percentComplete}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CQC Registration Timeline */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                CQC Registration Timeline
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Minimum {totalCqcWeeks} weeks from start to registration granted. Click any step to cycle its status.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">Target open date</label>
                <Input
                  type="date"
                  value={targetOpenDate}
                  onChange={e => setTargetOpenDate(e.target.value)}
                  className="h-8 text-xs w-36"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* CQC warning banner */}
          {cqcAtRisk && (
            <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">CQC Registration at risk</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  CQC registration hasn't started and requires at least {totalCqcWeeks} weeks — your target opening date may not allow enough time. Start the registration process immediately.
                </p>
              </div>
            </div>
          )}

          {/* Timeline strip */}
          <div className="overflow-x-auto pb-2">
            <div className="flex items-start gap-2 min-w-max">
              {milestones.map((m, i) => {
                const c = milestoneStatusColor(m.status);
                return (
                  <div key={m.id} className="flex items-start shrink-0">
                    <div className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm w-36 ${c.bg}`}
                      onClick={() => cycleMilestoneStatus(m)}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        m.status === "complete" ? "bg-emerald-500" :
                        m.status === "in_progress" ? "bg-amber-500" : "bg-muted"
                      }`}>
                        {m.status === "complete" ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : m.status === "in_progress" ? (
                          <Clock className="w-4 h-4 text-white" />
                        ) : (
                          <span className="text-xs text-muted-foreground font-bold">{m.step}</span>
                        )}
                      </div>
                      <span className={`text-[11px] font-semibold text-center leading-tight ${c.text}`}>{m.title}</span>
                      <span className="text-[10px] text-muted-foreground">~{m.leadTimeWeeks}w</span>
                      <Badge className={`text-[9px] px-1.5 py-0 h-4 border ${statusBadge(m.status)}`}>
                        {MILESTONE_STATUS_LABELS[m.status]}
                      </Badge>
                      {m.dueDate && (
                        <span className="text-[9px] text-muted-foreground">Due: {m.dueDate}</span>
                      )}
                    </div>
                    {/* Edit button */}
                    <button
                      className="ml-1 mt-1 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => {
                        if (editingMilestone === m.id) { setEditingMilestone(null); return; }
                        setEditingMilestone(m.id);
                        setEditMilestoneNotes(m.notes ?? "");
                        setEditMilestoneDate(m.dueDate ?? "");
                      }}
                      title="Edit notes / due date"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    {i < milestones.length - 1 && (
                      <div className={`w-4 h-px mt-[2.2rem] mx-1 ${m.status === "complete" ? "bg-emerald-400" : "bg-border"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Milestone inline editor */}
          {editingMilestone !== null && (() => {
            const m = milestones.find(x => x.id === editingMilestone);
            if (!m) return null;
            return (
              <div className="mt-4 border rounded-lg p-4 bg-muted/30 space-y-3">
                <p className="text-sm font-semibold">{m.title}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Due date</label>
                    <Input type="date" value={editMilestoneDate} onChange={e => setEditMilestoneDate(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                  <Textarea value={editMilestoneNotes} onChange={e => setEditMilestoneNotes(e.target.value)} rows={2} className="text-xs" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveMilestoneEdit(m)}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingMilestone(null)}>Cancel</Button>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Checklist Sections */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Compliance Checklist</h3>
        {sections.map(section => {
          const sectionItems = itemsBySection[section] ?? [];
          const isExpanded = expandedSections.has(section);
          const Icon = SECTION_ICONS[section] ?? ShieldCheck;
          const sectionSummary = summary?.sectionSummaries.find(s => s.section === section);
          const pct = sectionSummary?.percentComplete ?? 0;
          const isPolicy = section === "Policy Library";

          return (
            <Card key={section} className="shadow-sm border-border/60 overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => toggleSection(section)}
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{section}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 h-4 border ${
                        pct >= 75 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                        pct >= 40 ? "bg-amber-100 text-amber-700 border-amber-200" :
                        "bg-red-100 text-red-700 border-red-200"
                      }`}>{pct}%</Badge>
                      <span className="text-xs text-muted-foreground">{sectionSummary?.complete ?? 0} / {sectionSummary?.applicable ?? sectionItems.length} complete</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border/60">
                  {sectionItems.map(item => (
                    <div key={item.id} className="border-b border-border/40 last:border-0">
                      <div className="flex items-start gap-3 p-4 hover:bg-muted/20 transition-colors">
                        {/* Status toggle */}
                        <button
                          className="mt-0.5 shrink-0"
                          onClick={() => cycleStatus(item)}
                          title="Click to cycle status"
                        >
                          {isPolicy ? (
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                              item.policyStatus === "signed_off" ? "bg-emerald-500 border-emerald-500" :
                              item.policyStatus === "reviewed" ? "bg-blue-500 border-blue-500" :
                              "border-muted-foreground/40"
                            }`}>
                              {(item.policyStatus === "signed_off" || item.policyStatus === "reviewed") && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              )}
                            </div>
                          ) : (
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              item.status === "complete" ? "bg-emerald-500 border-emerald-500" :
                              item.status === "in_progress" ? "border-amber-500" :
                              item.status === "not_applicable" ? "border-muted-foreground/30 bg-muted" :
                              "border-muted-foreground/40"
                            }`}>
                              {item.status === "complete" && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                              {item.status === "in_progress" && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                              {item.status === "not_applicable" && <XCircle className="w-3.5 h-3.5 text-muted-foreground/50" />}
                            </div>
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 flex-wrap mb-1">
                            <span className={`text-sm font-medium leading-snug ${item.status === "complete" || item.policyStatus === "signed_off" ? "line-through text-muted-foreground" : ""}`}>
                              {item.title}
                            </span>
                            {isPolicy ? (
                              <Badge className={`text-[9px] px-1.5 py-0 h-4 border ${policyStatusBadge(item.policyStatus ?? null)}`}>
                                {POLICY_STATUS_LABELS[item.policyStatus ?? "draft"]}
                              </Badge>
                            ) : (
                              <Badge className={`text-[9px] px-1.5 py-0 h-4 border ${statusBadge(item.status)}`}>
                                {STATUS_LABELS[item.status]}
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                          )}
                          {item.requiredByDate && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Required by: {item.requiredByDate}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
                          )}
                          {item.attachmentUrl && (
                            <a
                              href={item.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
                              onClick={e => e.stopPropagation()}
                            >
                              <FileText className="w-3 h-3" /> Open document
                            </a>
                          )}
                        </div>

                        {/* Edit button */}
                        <button
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
                          onClick={() => {
                            if (editingItem === item.id) { setEditingItem(null); return; }
                            setEditingItem(item.id);
                            setEditNotes(item.notes ?? "");
                            setEditDate(item.requiredByDate ?? "");
                            setEditAttachmentUrl(item.attachmentUrl ?? "");
                          }}
                          title="Edit notes / attachment"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Inline editor */}
                      {editingItem === item.id && (
                        <div className="mx-4 mb-4 border rounded-lg p-3 bg-muted/30 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Required by date</label>
                              <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-8 text-xs" />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                            <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className="text-xs" placeholder="Add notes or context…" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Document / policy link (URL)</label>
                            <Input
                              type="url"
                              value={editAttachmentUrl}
                              onChange={e => setEditAttachmentUrl(e.target.value)}
                              className="h-8 text-xs"
                              placeholder="https://docs.google.com/… or any link"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveItemEdit(item)}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingItem(null)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
