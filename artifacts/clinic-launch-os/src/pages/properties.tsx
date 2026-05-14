import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProperties,
  getListPropertiesQueryKey,
  useCreateProperty,
  useUpdateProperty,
  useDeleteProperty,
  useUploadPropertyDocument,
  useAnalyseProperty,
  useSetPropertyCompetitors,
  useSetPropertyActive,
  useUnsetPropertyActive,
  useGetPropertyRanking,
  useListPropertyAnalyses,
  usePropertyAdvisorAction,
  useImportPropertyFromUrl,
  useConfirmPropertyUpload,
  useGetProjectScoringWeights,
  useUpdateProjectScoringWeights,
  useGetPropertyScoringWeights,
  useUpdatePropertyScoringWeights,
  useComparePropertyAnalyses,
  getGetProjectScoringWeightsQueryKey,
  getGetPropertyScoringWeightsQueryKey,
  useGetLatestPropertyAnalysis,
  getGetLatestPropertyAnalysisQueryKey,
  useAnalyseBrochure,
  getGetFinancialModelQueryKey,
  getListFixedCostItemsQueryKey,
} from "@workspace/api-client-react";
import type {
  ClinicProperty,
  PropertyIntelligenceResult,
  PropertyExtraction,
  ManualCompetitor,
  PropertyAiAnalysis,
  PropertyRankingItem,
  AdvisorActionBodyAction,
  CreatePropertyBodyPipelineStatus,
  ScoringWeights,
  RiskAnalysis,
  NegotiationLeverage,
  LaunchStrategy,
  BrochureVisualAnalysis,
} from "@workspace/api-client-react";
import { formatGBP } from "@/lib/format";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MapPin,
  Maximize2,
  PoundSterling,
  Clock,
  User,
  Phone,
  Mail,
  Car,
  Pencil,
  Trash2,
  Upload,
  Brain,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Building,
  Star,
  ChevronRight,
  FileText,
  Loader2,
  Sparkles,
  Link2,
  Trophy,
  Heart,
  Target,
  BarChart3,
  History,
  ArrowLeftRight,
  X,
  Lightbulb,
  ArrowUpDown,
  Plus,
  ExternalLink,
  RefreshCw,
  Gavel,
  LayoutGrid,
  ListFilter,
  Map,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";

const PropertyMapView = lazy(() => import("@/components/property-map-view"));

// ─── Viewing Checklist ────────────────────────────────────────────────────────

type ChecklistItem = { id: string; label: string; helpText?: string };
type ChecklistCategory = { id: string; label: string; items: ChecklistItem[] };

const VIEWING_CHECKLIST: ChecklistCategory[] = [
  {
    id: "exterior",
    label: "Exterior & Street Presence",
    items: [
      { id: "ext_visibility", label: "Clearly visible from street (50m+)", helpText: "Can a passing client see the frontage from a distance?" },
      { id: "ext_frontage", label: "Frontage condition — windows, entrance, signage potential" },
      { id: "ext_neighbours", label: "Neighbouring businesses are complementary (not detrimental)", helpText: "e.g. hair salon, pharmacy, optician — not a bookmaker or off-licence" },
      { id: "ext_footfall", label: "Street footfall feels appropriate for the target clientele" },
      { id: "ext_kerb", label: "Kerb appeal — premium clients would feel proud to visit here" },
    ],
  },
  {
    id: "access",
    label: "Access & Parking",
    items: [
      { id: "acc_parking", label: "Parking on-site or within easy walking distance (5 min max)" },
      { id: "acc_walk", label: "Walk from parking to door feels safe and pleasant" },
      { id: "acc_disabled", label: "Step-free / disabled access at entrance" },
      { id: "acc_door", label: "Door wide enough for equipment delivery" },
      { id: "acc_waste", label: "Refuse / clinical waste collection access at rear" },
    ],
  },
  {
    id: "layout",
    label: "Internal Layout & Space",
    items: [
      { id: "lay_size", label: "Overall size feels right for your planned treatment room count" },
      { id: "lay_reception", label: "Reception / waiting area can be carved out" },
      { id: "lay_consultation", label: "Consultation / private room is possible" },
      { id: "lay_light", label: "Natural light in planned treatment rooms" },
      { id: "lay_ceiling", label: "Ceiling height adequate (minimum 2.4m ideally 2.7m+)" },
      { id: "lay_storage", label: "Storage room or utility space available" },
      { id: "lay_staff_wc", label: "Staff toilet separate from client-facing areas" },
      { id: "lay_client_wc", label: "Client toilet accessible without crossing treatment rooms" },
    ],
  },
  {
    id: "services",
    label: "Services & Infrastructure",
    items: [
      { id: "svc_water", label: "Hot & cold running water in each treatment room (or can be plumbed)", helpText: "Essential for aesthetics treatments — ask the agent or check pipework" },
      { id: "svc_electric", label: "Electrical supply appears adequate — ask about amperage", helpText: "Aesthetic devices, lighting, HVAC can be power-hungry; 3-phase is ideal" },
      { id: "svc_ventilation", label: "Ventilation / openable windows in treatment rooms" },
      { id: "svc_broadband", label: "Full-fibre broadband available to the building" },
      { id: "svc_hvac", label: "Air conditioning present or conduit for easy installation" },
    ],
  },
  {
    id: "condition",
    label: "Condition & Fit-Out",
    items: [
      { id: "con_damp", label: "No visible damp, mould, or water staining" },
      { id: "con_structure", label: "No obvious structural cracks or subsidence" },
      { id: "con_flooring", label: "Flooring in good condition or within budget to replace" },
      { id: "con_existing", label: "Any existing fit-out (desk, sinks, units) is usable or easy to strip" },
      { id: "con_asbestos", label: "If pre-2000 building, asbestos survey arranged / budgeted for" },
      { id: "con_smell", label: "No unexplained odours suggesting hidden issues" },
    ],
  },
  {
    id: "legal",
    label: "Lease & Legals",
    items: [
      { id: "leg_useclass", label: "Use class confirmed as E (formerly D1) — suitable for clinic use", helpText: "Must be E class to operate a medical / aesthetics clinic without planning permission" },
      { id: "leg_norestrict", label: "No restrictions on medical/aesthetic clinic use in heads of terms", helpText: "Some leases restrict the type of professional services — check with solicitor" },
      { id: "leg_landlord", label: "Met or spoken to the landlord (or their direct representative)" },
      { id: "leg_agent", label: "Agent is professional and responsive" },
      { id: "leg_epc", label: "EPC rating known and acceptable (C or better preferred)" },
      { id: "leg_fire", label: "Fire safety / sprinklers / emergency lighting confirmed in building" },
    ],
  },
  {
    id: "gutfeel",
    label: "Gut Feel",
    items: [
      { id: "gut_client", label: "Clients would feel proud and excited to visit here" },
      { id: "gut_brand", label: "The space feels on-brand for Abi Peters Aesthetics" },
      { id: "gut_you", label: "You would feel excited and energised to work here every day" },
    ],
  },
];

type ChecklistData = Record<string, { checked: boolean; note?: string }>;

function ViewingChecklist({ property }: { property: ClinicProperty }) {
  const queryClient = useQueryClient();
  const updateProperty = useUpdateProperty();
  const { toast } = useToast();

  const [data, setData] = useState<ChecklistData>(() => {
    const raw = property.viewingChecklistData;
    return (raw && typeof raw === "object" ? raw : {}) as ChecklistData;
  });
  const [dirty, setDirty] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const raw = property.viewingChecklistData;
    setData((raw && typeof raw === "object" ? raw : {}) as ChecklistData);
    setDirty(false);
  }, [property.id]);

  const totalItems = VIEWING_CHECKLIST.reduce((s, c) => s + c.items.length, 0);
  const checkedCount = Object.values(data).filter(v => v.checked).length;

  const toggle = (id: string) => {
    setData(prev => {
      const cur = prev[id];
      return { ...prev, [id]: { ...cur, checked: !cur?.checked } };
    });
    setDirty(true);
  };

  const setNote = (id: string, note: string) => {
    setData(prev => ({ ...prev, [id]: { ...prev[id], checked: prev[id]?.checked ?? false, note } }));
    setDirty(true);
  };

  const toggleNoteOpen = (id: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    updateProperty.mutate(
      { id: property.id, data: { viewingChecklistData: data as Record<string, { checked?: boolean; note?: string | null }> } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
          setDirty(false);
          toast({ title: "Checklist saved", description: "Viewing notes saved for this property." });
        },
      }
    );
  };

  const categoryProgress = (cat: ChecklistCategory) => {
    const checked = cat.items.filter(i => data[i.id]?.checked).length;
    return { checked, total: cat.items.length };
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Property Viewing Checklist</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {checkedCount} of {totalItems} items checked
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || updateProperty.isPending}
          className="h-8 gap-1.5 text-xs"
        >
          {updateProperty.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {updateProperty.isPending ? "Saving…" : dirty ? "Save Checklist" : "Saved"}
        </Button>
      </div>

      {/* Overall progress bar */}
      <div className="space-y-1.5">
        <Progress
          value={totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}
          className="h-2"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Overall completion</span>
          <span>{totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0}%</span>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {VIEWING_CHECKLIST.map((category) => {
          const prog = categoryProgress(category);
          const allDone = prog.checked === prog.total;
          return (
            <div key={category.id} className="border rounded-lg overflow-hidden">
              {/* Category header */}
              <div className={`flex items-center justify-between px-4 py-2.5 ${allDone ? "bg-primary/8 border-b border-primary/15" : "bg-muted/40 border-b border-border/50"}`}>
                <div className="flex items-center gap-2">
                  {allDone ? (
                    <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                  )}
                  <span className={`text-xs font-semibold uppercase tracking-wider ${allDone ? "text-primary" : "text-muted-foreground"}`}>
                    {category.label}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {prog.checked}/{prog.total}
                </span>
              </div>

              {/* Items */}
              <div className="divide-y divide-border/50">
                {category.items.map((item) => {
                  const checked = !!data[item.id]?.checked;
                  const note = data[item.id]?.note ?? "";
                  const noteOpen = expandedNotes.has(item.id);
                  return (
                    <div key={item.id} className={`px-4 py-3 transition-colors ${checked ? "bg-primary/4" : "bg-card"}`}>
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggle(item.id)}
                          className={`shrink-0 w-4.5 h-4.5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors ${
                            checked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/40 hover:border-primary/60"
                          }`}
                          style={{ width: "18px", height: "18px", minWidth: "18px" }}
                        >
                          {checked && <CheckCircle className="w-3 h-3" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${checked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {item.label}
                          </p>
                          {item.helpText && !checked && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{item.helpText}</p>
                          )}
                          {noteOpen && (
                            <Textarea
                              value={note}
                              onChange={e => setNote(item.id, e.target.value)}
                              placeholder="Add a note about this item…"
                              className="mt-2 text-xs h-16 resize-none"
                              onClick={e => e.stopPropagation()}
                            />
                          )}
                          {!noteOpen && note && (
                            <p className="text-[11px] text-muted-foreground mt-1 italic">"{note}"</p>
                          )}
                        </div>
                        <button
                          onClick={() => toggleNoteOpen(item.id)}
                          className={`shrink-0 text-muted-foreground hover:text-foreground transition-colors ${noteOpen ? "text-foreground" : ""}`}
                          title={noteOpen ? "Close note" : "Add note"}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center pb-2">
        Tick items as you walk around, add notes with the pencil icon, then hit Save.
      </p>
    </div>
  );
}

const PROJECT_ID = 1;

const PIPELINE_STAGES = [
  { key: "found", label: "Found", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { key: "interesting", label: "Interesting", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  { key: "brochure_requested", label: "Brochure", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" },
  { key: "viewing_booked", label: "Viewing Booked", color: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300" },
  { key: "viewed", label: "Viewed", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  { key: "under_review", label: "Under Review", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  { key: "due_diligence", label: "Due Diligence", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  { key: "heads_of_terms", label: "Heads of Terms", color: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300" },
  { key: "negotiating", label: "Negotiating", color: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300" },
  { key: "selected", label: "Selected", color: "bg-primary/15 text-primary" },
  { key: "rejected", label: "Rejected", color: "bg-muted text-muted-foreground opacity-60" },
] as const;

const RANKING_MODES = [
  { key: "overall", label: "Overall", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "safest", label: "Safest", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  { key: "highest-revenue", label: "Highest Revenue", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: "premium-brand", label: "Premium Brand", icon: <Star className="w-3.5 h-3.5" /> },
  { key: "lowest-risk", label: "Lowest Risk", icon: <Target className="w-3.5 h-3.5" /> },
  { key: "fastest-launch", label: "Fastest Launch", icon: <Sparkles className="w-3.5 h-3.5" /> },
] as const;

const ADVISOR_ACTIONS = [
  { key: "suggest-offer", label: "Suggest Offer", icon: <Gavel className="w-4 h-4" />, description: "Get a recommended opening offer and negotiation strategy" },
  { key: "identify-risks", label: "Identify Risks", icon: <AlertTriangle className="w-4 h-4" />, description: "Uncover hidden risks, lease traps, and red flags" },
  { key: "recommend-layout", label: "Layout Plan", icon: <LayoutGrid className="w-4 h-4" />, description: "Optimal treatment room layout and flow recommendations" },
  { key: "estimate-fitout", label: "Estimate Fit-Out", icon: <Building className="w-4 h-4" />, description: "Fit-out complexity, cost range, and timeline estimate" },
  { key: "estimate-revenue", label: "Revenue Estimate", icon: <PoundSterling className="w-4 h-4" />, description: "First-year revenue potential and ramp-up timeline" },
  { key: "suggest-clinic-model", label: "Clinic Model", icon: <Lightbulb className="w-4 h-4" />, description: "Optimal service mix, pricing, and positioning" },
  { key: "suggest-negotiation", label: "Negotiation Guide", icon: <ArrowUpDown className="w-4 h-4" />, description: "Detailed lease negotiation strategy and leverage points" },
  { key: "suggest-launch", label: "Launch Strategy", icon: <Sparkles className="w-4 h-4" />, description: "90-day pre-opening and launch strategy" },
] as const;

function pipelineStageInfo(key: string) {
  return PIPELINE_STAGES.find(s => s.key === key) ?? PIPELINE_STAGES[0];
}

function gradeColor(grade: string) {
  if (grade === "A") return "text-green-600 dark:text-green-400";
  if (grade === "B") return "text-primary";
  if (grade === "C") return "text-amber-600 dark:text-amber-400";
  if (grade === "D") return "text-orange-600 dark:text-orange-400";
  return "text-destructive";
}

function scoreBarColor(pct: number) {
  if (pct >= 75) return "bg-primary";
  if (pct >= 50) return "bg-amber-500";
  return "bg-destructive";
}

// ─── Score Card Component ─────────────────────────────────────────────────────

type ScoreData = {
  total: number;
  maxTotal: number;
  grade: string;
  summary: string;
  factors: { name: string; score: number; maxScore: number; weight: number; explanation: string }[];
};

function ScoreCard({ score, title, icon }: { score: ScoreData; title: string; icon: React.ReactNode }) {
  const pct = Math.round((score.total / score.maxTotal) * 100);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">{icon}<h4 className="font-semibold">{title}</h4></div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">{score.total}<span className="text-sm font-normal text-muted-foreground">/{score.maxTotal}</span></span>
          <span className={`text-2xl font-bold ${gradeColor(score.grade)}`}>{score.grade}</span>
        </div>
      </div>
      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-muted-foreground italic">{score.summary}</p>
      <div className="space-y-3">
        {score.factors.map((f) => {
          const fPct = Math.round((f.score / f.maxScore) * 100);
          return (
            <div key={f.name} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">{f.name}</span>
                <span className="font-semibold">{f.score}/{f.maxScore}</span>
              </div>
              <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${scoreBarColor(fPct)}`} style={{ width: `${fPct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{f.explanation}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Intelligence Panel ───────────────────────────────────────────────────────

function IntelligencePanel({ result, property, onCompetitorsSaved }: {
  result: PropertyIntelligenceResult;
  property: ClinicProperty;
  onCompetitorsSaved: (updated: ManualCompetitor[]) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("aesthetics clinic");
  const [notes, setNotes] = useState("");
  const [competitors, setCompetitors] = useState<ManualCompetitor[]>((property.manualCompetitors as ManualCompetitor[] | null) ?? []);
  const setPropertyCompetitors = useSetPropertyCompetitors();

  const handleAdd = () => {
    if (!name.trim()) return;
    const updated = [...competitors, { name: name.trim(), type, notes: notes.trim() || null }];
    setCompetitors(updated);
    setName(""); setType("aesthetics clinic"); setNotes("");
    setPropertyCompetitors.mutate({ id: property.id, data: updated }, { onSuccess: () => onCompetitorsSaved(updated) });
  };

  const handleRemove = (idx: number) => {
    const updated = competitors.filter((_, i) => i !== idx);
    setCompetitors(updated);
    setPropertyCompetitors.mutate({ id: property.id, data: updated }, { onSuccess: () => onCompetitorsSaved(updated) });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Location", score: result.locationScore },
          { label: "Viability", score: result.commercialViabilityScore },
          { label: "Clinic Fit", score: result.clinicSuitabilityScore },
        ].map(({ label, score }) => (
          <div key={label} className="rounded-lg border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-3xl font-bold">{score.total}</p>
            <p className={`text-lg font-bold ${gradeColor(score.grade)}`}>{score.grade}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="summary" className="text-xs px-2 py-1">Summary</TabsTrigger>
          <TabsTrigger value="location" className="text-xs px-2 py-1">Location</TabsTrigger>
          <TabsTrigger value="viability" className="text-xs px-2 py-1">Viability</TabsTrigger>
          <TabsTrigger value="clinic" className="text-xs px-2 py-1">Clinic Fit</TabsTrigger>
          <TabsTrigger value="competition" className="text-xs px-2 py-1">Competition</TabsTrigger>
          {result.riskAnalysis && <TabsTrigger value="risk" className="text-xs px-2 py-1">Risk</TabsTrigger>}
          {result.negotiationLeverage && <TabsTrigger value="negotiation" className="text-xs px-2 py-1">Negotiation</TabsTrigger>}
          {result.launchStrategy && <TabsTrigger value="launch" className="text-xs px-2 py-1">Launch Plan</TabsTrigger>}
        </TabsList>

        <TabsContent value="summary" className="space-y-5 mt-4">
          <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
            <p className="text-sm leading-relaxed">{result.executiveSummary.overallVerdict}</p>
          </div>
          {[
            { label: "Strengths", icon: <CheckCircle className="w-4 h-4 text-primary" />, cls: "text-primary", items: result.executiveSummary.strengths },
            { label: "Weaknesses", icon: <XCircle className="w-4 h-4 text-destructive" />, cls: "text-destructive", items: result.executiveSummary.weaknesses },
            { label: "Risks", icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, cls: "text-amber-600 dark:text-amber-400", items: result.executiveSummary.risks },
            { label: "Hidden Opportunities", icon: <TrendingUp className="w-4 h-4 text-blue-500" />, cls: "text-blue-600 dark:text-blue-400", items: result.executiveSummary.hiddenOpportunities },
          ].map(({ label, icon, cls, items }, si) => (
            <div key={label}>
              {si > 0 && <Separator className="mb-4" />}
              <div className="flex items-center gap-2 mb-2">{icon}<h5 className={`text-sm font-semibold ${cls}`}>{label}</h5></div>
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Separator />
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Revenue Ceiling</p>
              <p className="font-semibold text-sm">{result.executiveSummary.likelyRevenueCeiling}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Suggested Positioning</p>
              <p className="font-semibold text-sm">{result.executiveSummary.suggestedPositioning}</p>
            </div>
          </div>
          <div>
            <h5 className="text-sm font-semibold mb-2">Launch Recommendations</h5>
            <ol className="space-y-1.5">
              {result.executiveSummary.launchRecommendations.map((r, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
                  {r}
                </li>
              ))}
            </ol>
          </div>
        </TabsContent>

        <TabsContent value="location" className="mt-4">
          <ScoreCard score={result.locationScore} title="Location Score" icon={<MapPin className="w-4 h-4 text-primary" />} />
        </TabsContent>
        <TabsContent value="viability" className="mt-4">
          <ScoreCard score={result.commercialViabilityScore} title="Commercial Viability" icon={<PoundSterling className="w-4 h-4 text-primary" />} />
        </TabsContent>
        <TabsContent value="clinic" className="mt-4">
          <ScoreCard score={result.clinicSuitabilityScore} title="Clinic Suitability" icon={<Building className="w-4 h-4 text-primary" />} />
        </TabsContent>

        {result.riskAnalysis && (
        <TabsContent value="risk" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
              result.riskAnalysis.overall === "low" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" :
              result.riskAnalysis.overall === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" :
              "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            }`}>{result.riskAnalysis.overall} risk</div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{result.riskAnalysis.verdict}</p>
          <div className="space-y-3">
            {result.riskAnalysis.risks.map((r, i) => (
              <div key={i} className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{r.risk}</p>
                  <Badge className={`text-xs shrink-0 ${
                    r.severity === "low" ? "bg-green-100 text-green-700" :
                    r.severity === "medium" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>{r.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.mitigation}</p>
              </div>
            ))}
          </div>
        </TabsContent>
        )}

        {result.negotiationLeverage && (
        <TabsContent value="negotiation" className="mt-4 space-y-4">
          <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
            <p className="text-sm leading-relaxed">{result.negotiationLeverage.verdict}</p>
          </div>
          <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-500/30 p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Suggested Opening Offer</p>
            <p className="text-sm font-medium">{result.negotiationLeverage.suggestedOpeningOffer}</p>
          </div>
          {[
            { label: "Your Strengths", items: result.negotiationLeverage.strengths, cls: "text-primary" },
            { label: "Landlord Motivators", items: result.negotiationLeverage.landlordMotivators, cls: "text-amber-600 dark:text-amber-400" },
            { label: "Tactics", items: result.negotiationLeverage.tactics, cls: "text-blue-600 dark:text-blue-400" },
            { label: "Red Lines", items: result.negotiationLeverage.redLines, cls: "text-destructive" },
          ].map(({ label, items, cls }) => (
            <div key={label}>
              <h5 className={`text-sm font-semibold mb-2 ${cls}`}>{label}</h5>
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </TabsContent>
        )}

        {result.launchStrategy && (
        <TabsContent value="launch" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Time to Launch</p>
              <p className="font-semibold text-sm">{result.launchStrategy.estimatedTimeToLaunch}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Year 1 Revenue</p>
              <p className="font-semibold text-sm">{result.launchStrategy.firstYearRevenueForecast}</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: "Phase 1", text: result.launchStrategy.phase1 },
              { label: "Phase 2", text: result.launchStrategy.phase2 },
              { label: "Phase 3", text: result.launchStrategy.phase3 },
            ].map(({ label, text }) => (
              <div key={label} className="rounded-lg border bg-card p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
          <div>
            <h5 className="text-sm font-semibold mb-2">Key Milestones</h5>
            <ol className="space-y-1.5">
              {result.launchStrategy.keyMilestones.map((m, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
                  {m}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h5 className="text-sm font-semibold mb-2">Critical Success Factors</h5>
            <ul className="space-y-1">
              {result.launchStrategy.criticalSuccessFactors.map((f, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />{f}
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
        )}

        <TabsContent value="competition" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Competition Analysis</h4>
            <Badge variant="outline" className="text-xs gap-1.5">
              {result.competition.dataSource === "google_places" ? <><MapPin className="w-3 h-3" /> Live Google Places</> :
               result.competition.dataSource === "manual" ? <><Building className="w-3 h-3" /> Manual data</> :
               <><Brain className="w-3 h-3" /> AI estimate</>}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Saturation</p>
              <p className="text-3xl font-bold">{result.competition.saturationScore}</p>
              <p className="text-xs text-muted-foreground mt-1">{result.competition.saturationVerdict}</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Opportunity</p>
              <p className="text-3xl font-bold text-primary">{result.competition.opportunityScore}</p>
              <p className="text-xs text-muted-foreground mt-1">{result.competition.opportunityVerdict}</p>
            </div>
          </div>
          {Array.isArray(result.competition.competitors) && result.competition.competitors.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold">Nearby Competitors</h5>
              {result.competition.competitors.map((c, i) => (
                <div key={i} className="flex items-start justify-between p-3 rounded-lg border bg-card gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.type}{c.distanceMeters ? ` · ${Math.round(c.distanceMeters)}m` : ""}</p>
                  </div>
                  {c.rating != null && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-medium">{c.rating}</span>
                      {c.reviewCount != null && <span className="text-xs text-muted-foreground">({c.reviewCount})</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {(result.competition.dataSource === "ai_estimate" || result.competition.dataSource === "manual") && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <h5 className="text-sm font-semibold">Add Known Competitors</h5>
              <p className="text-xs text-muted-foreground">They'll be used next time you run AI Analysis.</p>
              {competitors.length > 0 && (
                <ul className="space-y-1.5">
                  {competitors.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-sm p-2 rounded bg-card border">
                      <span className="flex-1 min-w-0 truncate font-medium">{c.name}<span className="text-muted-foreground font-normal ml-2 text-xs">{c.type}</span></span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0" onClick={() => handleRemove(i)}>
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="text-xs h-8" onKeyDown={e => e.key === "Enter" && handleAdd()} />
                <select value={type} onChange={e => setType(e.target.value)} className="text-xs h-8 rounded-md border bg-background px-2">
                  {["aesthetics clinic","beauty salon","medispa","skin clinic","cosmetic clinic","other"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="text-xs h-8 flex-1" />
                <Button size="sm" onClick={handleAdd} disabled={!name.trim() || setPropertyCompetitors.isPending} className="h-8 shrink-0">Add</Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between pt-2 border-t">
        <p className="text-xs text-muted-foreground">Generated {new Date(result.generatedAt).toLocaleString("en-GB")}</p>
        {result.version != null && <Badge variant="outline" className="text-xs">v{result.version}</Badge>}
      </div>
    </div>
  );
}

// ─── Advisor Panel ────────────────────────────────────────────────────────────

function AdvisorPanel({ property }: { property: ClinicProperty }) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const advisorAction = usePropertyAdvisorAction();

  const handleRun = (action: string) => {
    setSelectedAction(action);
    setResult(null);
    advisorAction.mutate(
      { id: property.id, data: { action: action as AdvisorActionBodyAction, prompt: customPrompt || undefined } },
      { onSuccess: (data) => setResult(data.response) }
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Choose an AI advisor action to get expert guidance specific to this property.</p>
      <div className="grid grid-cols-1 gap-2">
        {ADVISOR_ACTIONS.map(({ key, label, icon, description }) => (
          <button
            key={key}
            onClick={() => handleRun(key)}
            disabled={advisorAction.isPending}
            className={`flex items-start gap-3 w-full rounded-lg border p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5 ${
              selectedAction === key ? "border-primary bg-primary/5" : "bg-card"
            }`}
          >
            <div className={`mt-0.5 shrink-0 ${selectedAction === key ? "text-primary" : "text-muted-foreground"}`}>{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
            </div>
            {advisorAction.isPending && selectedAction === key && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-primary mt-0.5" />}
          </button>
        ))}
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Additional context (optional)</Label>
        <Textarea
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          placeholder="e.g. 'The landlord seems eager to let quickly' or 'We have a £50k fit-out budget'"
          className="text-sm mt-1 h-20 resize-none"
        />
      </div>

      {result && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-4 h-4" />
            <h5 className="text-sm font-semibold capitalize">{selectedAction?.replace(/-/g, " ")} — AI Advice</h5>
          </div>
          <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{result}</div>
        </div>
      )}
    </div>
  );
}

// ─── Analysis History Panel ───────────────────────────────────────────────────

type ScoreSummary = { total: number; grade: string };

function VersionScoreDiff({ a, b, label }: { a?: ScoreSummary; b?: ScoreSummary; label: string }) {
  if (!a || !b) return null;
  const diff = b.total - a.total;
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-bold text-sm">{b.total} <span className={gradeColor(b.grade)}>{b.grade}</span></p>
      {diff !== 0 && (
        <p className={`text-xs font-medium ${diff > 0 ? "text-green-600" : "text-red-500"}`}>
          {diff > 0 ? `+${diff}` : diff}
        </p>
      )}
    </div>
  );
}

function HistoryPanel({ propertyId, currentResult, onSelect }: {
  propertyId: number;
  currentResult: PropertyIntelligenceResult | null;
  onSelect: (analysis: PropertyAiAnalysis) => void;
}) {
  const { data: analyses, isLoading } = useListPropertyAnalyses(propertyId);
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const { data: diffResult, isFetching: isDiffLoading } = useComparePropertyAnalyses(
    propertyId,
    { v1: compareA ?? 1, v2: compareB ?? 1 },
    { query: { enabled: showDiff && compareA != null && compareB != null, queryKey: ["compare-analyses", propertyId, compareA, compareB] } }
  );

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!analyses || analyses.length === 0) return (
    <div className="text-center py-8 space-y-2">
      <History className="w-8 h-8 text-muted-foreground mx-auto" />
      <p className="text-sm text-muted-foreground">No analyses yet. Run AI analysis to get started.</p>
    </div>
  );

  const canCompare = analyses.length >= 2;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{analyses.length} version{analyses.length !== 1 ? "s" : ""} saved.</p>
        {canCompare && !showDiff && (
          <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5"
            onClick={() => {
              setCompareA(analyses[0].version);
              setCompareB(analyses[1].version);
              setShowDiff(true);
            }}>
            <ArrowLeftRight className="w-3.5 h-3.5" />Compare Versions
          </Button>
        )}
        {showDiff && (
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowDiff(false)}>
            <X className="w-3.5 h-3.5" />Close Diff
          </Button>
        )}
      </div>

      {showDiff && (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <h5 className="text-sm font-semibold flex items-center gap-2"><ArrowLeftRight className="w-4 h-4 text-primary" />Version Comparison</h5>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Version A (baseline)</Label>
              <Select value={String(compareA)} onValueChange={v => setCompareA(Number(v))}>
                <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {analyses.map(a => (
                    <SelectItem key={a.version} value={String(a.version)}>v{a.version} — {new Date(a.createdAt).toLocaleDateString("en-GB")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Version B (compare to)</Label>
              <Select value={String(compareB)} onValueChange={v => setCompareB(Number(v))}>
                <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {analyses.map(a => (
                    <SelectItem key={a.version} value={String(a.version)}>v{a.version} — {new Date(a.createdAt).toLocaleDateString("en-GB")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isDiffLoading && <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
          {diffResult && !isDiffLoading && (() => {
            const a1 = diffResult.v1?.analysisJson as { locationScore?: ScoreSummary; commercialViabilityScore?: ScoreSummary; clinicSuitabilityScore?: ScoreSummary } | null;
            const a2 = diffResult.v2?.analysisJson as { locationScore?: ScoreSummary; commercialViabilityScore?: ScoreSummary; clinicSuitabilityScore?: ScoreSummary } | null;
            return (
              <div className="space-y-3">
                <div className="flex gap-6 justify-around">
                  <VersionScoreDiff a={a1?.locationScore} b={a2?.locationScore} label="Location" />
                  <VersionScoreDiff a={a1?.commercialViabilityScore} b={a2?.commercialViabilityScore} label="Viability" />
                  <VersionScoreDiff a={a1?.clinicSuitabilityScore} b={a2?.clinicSuitabilityScore} label="Clinic Fit" />
                </div>
                <p className="text-xs text-center text-muted-foreground">Numbers and arrows show change from v{compareA} → v{compareB}</p>
              </div>
            );
          })()}
        </div>
      )}

      {analyses.map((analysis) => {
        const aj = analysis.analysisJson as {
          locationScore?: ScoreSummary;
          commercialViabilityScore?: ScoreSummary;
          clinicSuitabilityScore?: ScoreSummary;
        };
        const snap = analysis.sourceDataSnapshot as { address?: string; competitorCount?: number } | null;
        return (
          <div key={analysis.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">v{analysis.version}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(analysis.createdAt).toLocaleString("en-GB")}</span>
              </div>
              <Badge variant="outline" className={`text-xs ${
                analysis.confidenceLevel === "high" ? "border-green-500/50 text-green-600" :
                analysis.confidenceLevel === "medium" ? "border-amber-500/50 text-amber-600" :
                "border-muted-foreground/40 text-muted-foreground"
              }`}>{analysis.confidenceLevel} confidence</Badge>
            </div>
            {aj.locationScore && (
              <div className="flex gap-4">
                {[
                  { l: "Location", s: aj.locationScore },
                  { l: "Viability", s: aj.commercialViabilityScore },
                  { l: "Clinic Fit", s: aj.clinicSuitabilityScore },
                ].map(({ l, s }) => s ? (
                  <div key={l} className="text-center">
                    <p className="text-xs text-muted-foreground">{l}</p>
                    <p className="font-bold">{s.total} <span className={`text-sm ${gradeColor(s.grade)}`}>{s.grade}</span></p>
                  </div>
                ) : null)}
              </div>
            )}
            {snap && (
              <p className="text-xs text-muted-foreground">
                {snap.address && `${snap.address} · `}{snap.competitorCount != null ? `${snap.competitorCount} competitors` : ""}
              </p>
            )}
            <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => onSelect(analysis)}>
              View This Version
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Property Form ────────────────────────────────────────────────────────────

type PropertyFormData = {
  address?: string;
  postcode?: string;
  sqFootage?: number;
  annualRentGbp?: number;
  monthlyRentGbp?: number;
  vatOnRent?: boolean;
  businessRatesGbp?: number;
  serviceChargeGbp?: number;
  leaseLength?: string;
  useClass?: string;
  availabilityDate?: string;
  parkingSpaces?: number;
  frontageMeters?: number;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  pipelineStatus?: string;
  notes?: string;
  viewingNotes?: string;
  negotiationNotes?: string;
  landlordConcessions?: string;
  isFavourited?: boolean;
  sourceUrl?: string;
  photoUrl?: string;
};

function PropertyForm({
  initial,
  onSubmit,
  isLoading,
  submitLabel,
}: {
  initial?: PropertyFormData;
  onSubmit: (data: PropertyFormData) => void;
  isLoading: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState<PropertyFormData>(initial ?? {});

  const set = (k: keyof PropertyFormData, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Address</Label>
          <Input value={form.address ?? ""} onChange={e => set("address", e.target.value)} placeholder="123 High Street, London" className="mt-1" />
        </div>
        <div>
          <Label>Postcode</Label>
          <Input value={form.postcode ?? ""} onChange={e => set("postcode", e.target.value)} placeholder="SW1A 1AA" className="mt-1" />
        </div>
        <div>
          <Label>Pipeline Stage</Label>
          <Select value={form.pipelineStatus ?? "found"} onValueChange={v => set("pipelineStatus", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.filter(s => s.key !== "selected" && s.key !== "rejected").map(s => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Financials</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Monthly Rent (£)</Label>
          <Input type="number" value={form.monthlyRentGbp ?? ""} onChange={e => set("monthlyRentGbp", parseFloat(e.target.value) || 0)} className="mt-1" />
        </div>
        <div>
          <Label>Annual Rent (£)</Label>
          <Input type="number" value={form.annualRentGbp ?? ""} onChange={e => set("annualRentGbp", parseFloat(e.target.value) || 0)} className="mt-1" />
        </div>
        <div>
          <Label>Business Rates (£/yr)</Label>
          <Input type="number" value={form.businessRatesGbp ?? ""} onChange={e => set("businessRatesGbp", parseFloat(e.target.value) || 0)} className="mt-1" />
        </div>
        <div>
          <Label>Service Charge (£/yr)</Label>
          <Input type="number" value={form.serviceChargeGbp ?? ""} onChange={e => set("serviceChargeGbp", parseFloat(e.target.value) || 0)} className="mt-1" />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Switch checked={form.vatOnRent ?? false} onCheckedChange={v => set("vatOnRent", v)} />
          <Label>VAT on Rent</Label>
        </div>
      </div>

      <Separator />
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Property Details</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Sq Footage</Label>
          <Input type="number" value={form.sqFootage ?? ""} onChange={e => set("sqFootage", parseFloat(e.target.value) || 0)} className="mt-1" />
        </div>
        <div>
          <Label>Parking Spaces</Label>
          <Input type="number" value={form.parkingSpaces ?? ""} onChange={e => set("parkingSpaces", parseInt(e.target.value) || 0)} className="mt-1" />
        </div>
        <div>
          <Label>Frontage (m)</Label>
          <Input type="number" value={form.frontageMeters ?? ""} onChange={e => set("frontageMeters", parseFloat(e.target.value) || 0)} className="mt-1" />
        </div>
        <div>
          <Label>Use Class</Label>
          <Input value={form.useClass ?? ""} onChange={e => set("useClass", e.target.value)} placeholder="E" className="mt-1" />
        </div>
        <div>
          <Label>Lease Length</Label>
          <Input value={form.leaseLength ?? ""} onChange={e => set("leaseLength", e.target.value)} placeholder="10 years" className="mt-1" />
        </div>
        <div>
          <Label>Available From</Label>
          <Input type="date" value={form.availabilityDate ?? ""} onChange={e => set("availabilityDate", e.target.value)} className="mt-1" />
        </div>
      </div>

      <Separator />
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Agent</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Agent Name</Label>
          <Input value={form.agentName ?? ""} onChange={e => set("agentName", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Agent Phone</Label>
          <Input value={form.agentPhone ?? ""} onChange={e => set("agentPhone", e.target.value)} className="mt-1" />
        </div>
        <div className="col-span-2">
          <Label>Agent Email</Label>
          <Input type="email" value={form.agentEmail ?? ""} onChange={e => set("agentEmail", e.target.value)} className="mt-1" />
        </div>
      </div>

      <Separator />
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes & Negotiations</h4>
      <div className="space-y-3">
        <div>
          <Label>General Notes</Label>
          <Textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} placeholder="Any general notes about this property" className="mt-1 h-20 resize-none text-sm" />
        </div>
        <div>
          <Label>Viewing Notes</Label>
          <Textarea value={form.viewingNotes ?? ""} onChange={e => set("viewingNotes", e.target.value)} placeholder="Observations from viewing" className="mt-1 h-20 resize-none text-sm" />
        </div>
        <div>
          <Label>Negotiation Notes</Label>
          <Textarea value={form.negotiationNotes ?? ""} onChange={e => set("negotiationNotes", e.target.value)} placeholder="Negotiation progress and decisions" className="mt-1 h-20 resize-none text-sm" />
        </div>
        <div>
          <Label>Landlord Concessions</Label>
          <Textarea value={form.landlordConcessions ?? ""} onChange={e => set("landlordConcessions", e.target.value)} placeholder="Agreed concessions, rent-free periods, contributions" className="mt-1 h-20 resize-none text-sm" />
        </div>
      </div>

      <Separator />
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Links & Media</h4>
      <div className="space-y-3">
        <div>
          <Label>Listing / Brochure URL</Label>
          <Input value={form.sourceUrl ?? ""} onChange={e => set("sourceUrl", e.target.value)} placeholder="https://rightmove.co.uk/... or S3 brochure link" className="mt-1 text-sm" />
        </div>
        <div>
          <Label>Photo URL</Label>
          <Input value={form.photoUrl ?? ""} onChange={e => set("photoUrl", e.target.value)} placeholder="https://... (paste a direct image URL)" className="mt-1 text-sm" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={form.isFavourited ?? false} onCheckedChange={v => set("isFavourited", v)} />
        <Label>Mark as Favourite</Label>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : submitLabel}
      </Button>
    </form>
  );
}

// ─── Extraction Review Dialog ─────────────────────────────────────────────────

function ExtractionReviewDialog({
  open, onClose, extraction, propertyId, onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  extraction: PropertyExtraction & { fileName?: string; fileSizeBytes?: number; tempFileId?: string; tempFileName?: string; fileType?: "pdf" | "image" } | null;
  propertyId: number | null;
  onConfirmed: () => void;
}) {
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const confirmUpload = useConfirmPropertyUpload();
  const { toast } = useToast();

  useEffect(() => {
    if (extraction) {
      const f: Record<string, unknown> = {};
      const keys = ["address","postcode","sqFootage","annualRentGbp","monthlyRentGbp","vatOnRent","businessRatesGbp","serviceChargeGbp","leaseLength","useClass","availabilityDate","parkingSpaces","frontageMeters","agentName","agentPhone","agentEmail"] as const;
      for (const k of keys) {
        if (extraction[k] != null) f[k] = extraction[k];
      }
      setFields(f);
    }
  }, [extraction]);

  const set = (k: string, v: unknown) => setFields(f => ({ ...f, [k]: v }));

  const handleConfirm = () => {
    if (!propertyId) return;
    confirmUpload.mutate(
      { id: propertyId, data: { fields, fileName: extraction?.fileName, fileSizeBytes: extraction?.fileSizeBytes, tempFileId: extraction?.tempFileId, tempFileName: extraction?.tempFileName, fileType: extraction?.fileType ?? "pdf" } },
      {
        onSuccess: () => {
          toast({ title: "Document saved", description: "Property details have been updated from the brochure." });
          onConfirmed();
          onClose();
        },
        onError: () => toast({ title: "Save failed", variant: "destructive" }),
      }
    );
  };

  if (!extraction) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />Review Extracted Data</DialogTitle>
          <DialogDescription>
            AI extracted these fields from <strong>{extraction.fileName ?? "the document"}</strong>. Review and edit before saving.
          </DialogDescription>
        </DialogHeader>

        {extraction.flags && extraction.flags.length > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
            {extraction.flags.map((flag, i) => (
              <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{flag}
              </p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {[
            { k: "address", l: "Address", type: "text", col: 2 },
            { k: "postcode", l: "Postcode", type: "text" },
            { k: "sqFootage", l: "Sq Footage", type: "number" },
            { k: "monthlyRentGbp", l: "Monthly Rent (£)", type: "number" },
            { k: "annualRentGbp", l: "Annual Rent (£)", type: "number" },
            { k: "businessRatesGbp", l: "Business Rates (£/yr)", type: "number" },
            { k: "serviceChargeGbp", l: "Service Charge (£/yr)", type: "number" },
            { k: "leaseLength", l: "Lease Length", type: "text" },
            { k: "useClass", l: "Use Class", type: "text" },
            { k: "availabilityDate", l: "Available From", type: "date" },
            { k: "parkingSpaces", l: "Parking Spaces", type: "number" },
            { k: "frontageMeters", l: "Frontage (m)", type: "number" },
            { k: "agentName", l: "Agent Name", type: "text" },
            { k: "agentPhone", l: "Agent Phone", type: "text" },
            { k: "agentEmail", l: "Agent Email", type: "email" },
          ].map(({ k, l, type, col }) => (
            <div key={k} className={col === 2 ? "col-span-2" : ""}>
              <Label className="text-xs">{l}</Label>
              <Input
                type={type}
                value={String(fields[k] ?? "")}
                onChange={e => set(k, type === "number" ? (parseFloat(e.target.value) || null) : e.target.value)}
                className="mt-1 text-sm h-8"
              />
            </div>
          ))}
          <div className="col-span-2 flex items-center gap-3">
            <Switch checked={Boolean(fields.vatOnRent)} onCheckedChange={v => set("vatOnRent", v)} />
            <Label className="text-xs">VAT on Rent</Label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Discard</Button>
          <Button onClick={handleConfirm} disabled={confirmUpload.isPending} className="flex-1">
            {confirmUpload.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Confirm & Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── URL Import Dialog ────────────────────────────────────────────────────────

function UrlImportDialog({ open, onClose, onCreateProperty }: {
  open: boolean;
  onClose: () => void;
  onCreateProperty: (data: PropertyFormData) => void;
}) {
  const [url, setUrl] = useState("");
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null);
  const [flags, setFlags] = useState<string[]>([]);
  const [editFields, setEditFields] = useState<PropertyFormData>({});
  const importUrl = useImportPropertyFromUrl();

  const handleImport = () => {
    if (!url.trim()) return;
    setExtracted(null);
    importUrl.mutate(
      { projectId: PROJECT_ID, data: { url: url.trim() } },
      {
        onSuccess: (data) => {
          const ef: PropertyFormData = {
            address: data.address ?? undefined,
            postcode: data.postcode ?? undefined,
            sqFootage: data.sqFootage ?? undefined,
            annualRentGbp: data.annualRentGbp ?? undefined,
            monthlyRentGbp: data.monthlyRentGbp ?? undefined,
            vatOnRent: data.vatOnRent ?? undefined,
            businessRatesGbp: data.businessRatesGbp ?? undefined,
            serviceChargeGbp: data.serviceChargeGbp ?? undefined,
            leaseLength: data.leaseLength ?? undefined,
            useClass: data.useClass ?? undefined,
            availabilityDate: data.availabilityDate ?? undefined,
            parkingSpaces: data.parkingSpaces ?? undefined,
            frontageMeters: data.frontageMeters ?? undefined,
            agentName: data.agentName ?? undefined,
            agentPhone: data.agentPhone ?? undefined,
            agentEmail: data.agentEmail ?? undefined,
          };
          setExtracted(data as unknown as Record<string, unknown>);
          setEditFields(ef);
          setFlags(data.flags ?? []);
        },
        onError: () => {
          setFlags(["Could not extract data from this URL. Try adding the property manually."]);
        },
      }
    );
  };

  const handleCreate = () => {
    onCreateProperty({ ...editFields, pipelineStatus: "found", sourceUrl: url.trim() || undefined });
    onClose();
    setUrl(""); setExtracted(null); setFlags([]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="w-5 h-5 text-primary" />Import from Listing URL</DialogTitle>
          <DialogDescription>Paste a property listing URL (Rightmove, Zoopla, etc.) or a direct PDF brochure link — AI will extract the details automatically.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://rightmove.co.uk/commercial-property/..." className="flex-1 text-sm" onKeyDown={e => e.key === "Enter" && handleImport()} />
          <Button onClick={handleImport} disabled={importUrl.isPending || !url.trim()} className="shrink-0">
            {importUrl.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          </Button>
        </div>

        {flags.length > 0 && !extracted && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
            {flags.map((flag, i) => (
              <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{flag}
              </p>
            ))}
          </div>
        )}

        {extracted && (
          <>
            {flags.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
                {flags.map((flag, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{flag}
                  </p>
                ))}
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />Data extracted — review before adding
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: "address" as const, l: "Address", col: 2 },
                { k: "postcode" as const, l: "Postcode" },
                { k: "sqFootage" as const, l: "Sq Footage" },
                { k: "monthlyRentGbp" as const, l: "Monthly Rent (£)" },
                { k: "annualRentGbp" as const, l: "Annual Rent (£)" },
                { k: "leaseLength" as const, l: "Lease Length" },
                { k: "useClass" as const, l: "Use Class" },
                { k: "agentName" as const, l: "Agent" },
              ].map(({ k, l, col }) => (
                <div key={k} className={col === 2 ? "col-span-2" : ""}>
                  <Label className="text-xs">{l}</Label>
                  <Input
                    value={String(editFields[k] ?? "")}
                    onChange={e => setEditFields(f => ({ ...f, [k]: e.target.value }))}
                    className="mt-1 text-sm h-8"
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleCreate} className="w-full">Add Property to Pipeline</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Brochure Visual Analysis Section ────────────────────────────────────────

function conditionColor(v: string) {
  if (v === "excellent" || v === "high" || v === "minimal") return "text-emerald-600";
  if (v === "good" || v === "moderate") return "text-amber-600";
  return "text-red-600";
}

function complexityColor(v: string) {
  if (v === "low") return "bg-emerald-100 text-emerald-700";
  if (v === "medium") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function BrochureAnalysisSection({ propertyId }: { propertyId: number }) {
  const { toast } = useToast();
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [result, setResult] = useState<BrochureVisualAnalysis | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const analyseBrochure = useAnalyseBrochure();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 5);
    e.target.value = "";
    if (files.length === 0) return;
    setSelectedImages(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
    setResult(null);
  };

  const handleRemoveImage = (idx: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => {
      URL.revokeObjectURL(prev[idx] ?? "");
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleRunAnalysis = () => {
    if (selectedImages.length === 0) return;
    analyseBrochure.mutate(
      { id: propertyId, data: { images: selectedImages } },
      {
        onSuccess: (data) => {
          setResult(data);
          setSelectedImages([]);
          setPreviews([]);
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Visual analysis failed. Please try again.";
          toast({ title: "Analysis failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const gradeClr = (g: string) =>
    g === "A" ? "bg-emerald-100 text-emerald-700" :
    g === "B" ? "bg-green-100 text-green-700" :
    g === "C" ? "bg-amber-100 text-amber-700" :
    g === "D" ? "bg-orange-100 text-orange-700" :
    "bg-red-100 text-red-700";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" />Visual Brochure Analysis</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Upload floor plans or photos — AI assesses layout, condition and fit-out requirements.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0" onClick={() => imageInputRef.current?.click()} disabled={analyseBrochure.isPending}>
          <Upload className="w-3.5 h-3.5" />Add Images
        </Button>
      </div>

      <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleImageSelect} />

      {selectedImages.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {previews.map((src, idx) => (
              <div key={idx} className="relative group">
                <img src={src} alt={selectedImages[idx]?.name} className="w-20 h-20 object-cover rounded-lg border" />
                <button
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="text-xs text-muted-foreground mt-1 w-20 truncate text-center">{selectedImages[idx]?.name}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{selectedImages.length} image{selectedImages.length !== 1 ? "s" : ""} selected (max 5). Include the floor plan for best results.</p>
          <Button size="sm" className="gap-1.5 w-full" onClick={handleRunAnalysis} disabled={analyseBrochure.isPending}>
            {analyseBrochure.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analysing images…</> : <><Sparkles className="w-3.5 h-3.5" />Run Visual Analysis</>}
          </Button>
        </div>
      )}

      {analyseBrochure.isPending && selectedImages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <div className="text-center">
            <p className="text-sm font-medium">Analysing images…</p>
            <p className="text-xs text-muted-foreground">GPT-4o Vision is assessing the floor plan and photos. This takes 15–30 seconds.</p>
          </div>
        </div>
      )}

      {result && !analyseBrochure.isPending && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{result.imageCount} image{result.imageCount !== 1 ? "s" : ""} analysed · {new Date(result.generatedAt ?? "").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
            <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={() => imageInputRef.current?.click()}>
              <RefreshCw className="w-3 h-3" />Re-analyse
            </Button>
          </div>

          {/* Suitability score */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-semibold">Visual Clinic Suitability</h5>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gradeClr(result.clinicSuitabilityFromImages.grade)}`}>
                Grade {result.clinicSuitabilityFromImages.grade} · {result.clinicSuitabilityFromImages.score}/100
              </span>
            </div>
            <Progress value={result.clinicSuitabilityFromImages.score} className="h-2" />
            <p className="text-xs text-muted-foreground">{result.clinicSuitabilityFromImages.verdict}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div>
                <p className="text-xs font-medium text-emerald-700 mb-1">Strengths</p>
                <ul className="space-y-0.5">
                  {result.clinicSuitabilityFromImages.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5 items-start"><CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-amber-700 mb-1">Concerns</p>
                <ul className="space-y-0.5">
                  {result.clinicSuitabilityFromImages.concerns.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5 items-start"><AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Layout & Condition row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layout</h5>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Treatment rooms</span>
                  <span className="text-sm font-bold">{result.layoutAssessment.estimatedRoomCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Reception</span>
                  <span className={`text-xs font-medium capitalize ${conditionColor(result.layoutAssessment.receptionViability)}`}>{result.layoutAssessment.receptionViability}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Client flow</span>
                  <span className={`text-xs font-medium capitalize ${conditionColor(result.layoutAssessment.clientFlowRating)}`}>{result.layoutAssessment.clientFlowRating}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Fit-out complexity</span>
                  <Badge className={`text-xs capitalize ${complexityColor(result.layoutAssessment.fitoutComplexity)}`}>{result.layoutAssessment.fitoutComplexity}</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground border-t pt-2">{result.layoutAssessment.floorPlanNotes}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Condition</h5>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Overall</span>
                  <span className={`text-xs font-medium capitalize ${conditionColor(result.conditionAssessment.overallCondition)}`}>{result.conditionAssessment.overallCondition}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Decorative standard</span>
                  <span className={`text-xs font-medium capitalize ${conditionColor(result.conditionAssessment.decorativeStandard)}`}>{result.conditionAssessment.decorativeStandard}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Maintenance needed</span>
                  <span className={`text-xs font-medium capitalize ${conditionColor(result.conditionAssessment.maintenanceEstimate)}`}>{result.conditionAssessment.maintenanceEstimate}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground border-t pt-2">{result.conditionAssessment.interiorNotes}</p>
            </div>
          </div>

          {/* Fit-out estimate */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-semibold">Fit-Out Estimate</h5>
              <Badge className={`text-xs capitalize ${complexityColor(result.fitOutEstimate.complexityRating)}`}>{result.fitOutEstimate.complexityRating} complexity</Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">{formatGBP(result.fitOutEstimate.estimatedCostRangeLow)}</span>
              <span className="text-muted-foreground">–</span>
              <span className="text-lg font-bold">{formatGBP(result.fitOutEstimate.estimatedCostRangeHigh)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Timeline: {result.fitOutEstimate.timelineWeeks}</p>
            <div>
              <p className="text-xs font-medium mb-1">Key work required:</p>
              <ul className="space-y-0.5">
                {result.fitOutEstimate.keyWorkRequired.map((w, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5 items-start"><ChevronRight className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />{w}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* CQC observations */}
          {result.cqcObservations.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2">
              <h5 className="text-sm font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" />CQC / Compliance Observations</h5>
              <ul className="space-y-1">
                {result.cqcObservations.map((obs, i) => (
                  <li key={i} className="text-xs text-amber-800 dark:text-amber-300 flex gap-1.5 items-start"><span className="shrink-0">·</span>{obs}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Visual summary */}
          <div className="rounded-xl border bg-card p-4">
            <h5 className="text-sm font-semibold mb-1.5 flex items-center gap-1.5"><Brain className="w-3.5 h-3.5 text-primary" />Overall Assessment</h5>
            <p className="text-xs text-muted-foreground leading-relaxed">{result.visualSummary}</p>
          </div>
        </div>
      )}

      {!result && !analyseBrochure.isPending && selectedImages.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center space-y-2">
          <Sparkles className="w-7 h-7 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Upload floor plans or interior photos from the brochure to get an AI assessment of layout, condition, and fit-out requirements.</p>
          <p className="text-xs text-muted-foreground">Accepts JPEG, PNG, WebP — up to 5 images. Screenshots from a PDF brochure work perfectly.</p>
        </div>
      )}
    </div>
  );
}

// ─── Property Detail Sheet ────────────────────────────────────────────────────

function PropertyDetailSheet({ property, onClose, onUpdated, onDeleted }: {
  property: ClinicProperty | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("details");
  const [intelligenceResult, setIntelligenceResult] = useState<PropertyIntelligenceResult | null>(null);
  const [searchRadiusMeters, setSearchRadiusMeters] = useState(600);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showActiveConfirm, setShowActiveConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extraction, setExtraction] = useState<(PropertyExtraction & { fileName?: string; fileSizeBytes?: number; tempFileName?: string; fileType?: "pdf" | "image" }) | null>(null);
  const [showExtractionReview, setShowExtractionReview] = useState(false);

  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  const setPropertyActive = useSetPropertyActive();
  const unsetPropertyActive = useUnsetPropertyActive();
  const uploadDocument = useUploadPropertyDocument();
  const analyseProperty = useAnalyseProperty();

  const { data: latestAnalysisData } = useGetLatestPropertyAnalysis(
    property?.id ?? 0,
    { query: { enabled: !!property, queryKey: getGetLatestPropertyAnalysisQueryKey(property?.id ?? 0) } }
  );

  // Reset tab when switching properties
  useEffect(() => {
    if (property) setActiveTab("details");
  }, [property?.id]);

  // Pre-populate intelligenceResult from the latest persisted analysis on open
  useEffect(() => {
    if (!property) return;
    if (!latestAnalysisData) { setIntelligenceResult(null); return; }
    const aj = latestAnalysisData.analysisJson as unknown as PropertyIntelligenceResult & { generatedAt?: string };
    if (aj?.locationScore && aj?.commercialViabilityScore && aj?.clinicSuitabilityScore) {
      setIntelligenceResult({
        ...aj,
        propertyId: property.id,
        generatedAt: aj.generatedAt ?? latestAnalysisData.createdAt,
        version: latestAnalysisData.version,
        isStale: new Date(property.updatedAt) > new Date(latestAnalysisData.createdAt),
      });
    } else {
      setIntelligenceResult(null);
    }
  }, [property?.id, latestAnalysisData]);

  if (!property) return null;

  const stage = pipelineStageInfo(property.pipelineStatus ?? "found");
  const isActive = property.isActiveForProject;

  const handleUpdate = (data: PropertyFormData) => {
    updateProperty.mutate(
      { id: property.id, data: data as Record<string, unknown> },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
          toast({ title: "Property updated" });
          onUpdated();
        },
      }
    );
  };

  const handleDelete = () => {
    deleteProperty.mutate({ id: property.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
        onDeleted();
        onClose();
      },
    });
  };

  const handleSetActive = () => {
    setPropertyActive.mutate({ id: property.id }, {
      onSuccess: async () => {
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
        queryClient.invalidateQueries({ queryKey: getGetFinancialModelQueryKey(PROJECT_ID) });
        queryClient.invalidateQueries({ queryKey: getListFixedCostItemsQueryKey(PROJECT_ID) });
        toast({ title: "Property selected", description: "Assumptions cleared. Generating financial model with AI…" });
        setShowActiveConfirm(false);
        onUpdated();
        // Navigate to financials with ?generate=1 so the AI runs automatically
        window.location.href = `/clinic-launch-os/financials?generate=1`;
      },
      onError: () => toast({ title: "Failed to set active property", variant: "destructive" }),
    });
  };

  const handleAnalyse = () => {
    setIntelligenceResult(null);
    setActiveTab("intelligence");
    analyseProperty.mutate(
      { id: property.id, data: { searchRadiusMeters } },
      {
        onSuccess: (data) => setIntelligenceResult(data),
        onError: () => toast({ title: "Analysis failed", description: "Could not run AI analysis. Please try again.", variant: "destructive" }),
      }
    );
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    uploadDocument.mutate(
      { id: property.id, data: { file } },
      {
        onSuccess: (data) => {
          const fileType = (data as { fileType?: "pdf" | "image" }).fileType ?? "pdf";
          const tempFileName = (data as { tempFileName?: string }).tempFileName;
          setExtraction({ ...data, fileName: file.name, fileSizeBytes: file.size, fileType, tempFileName });
          setShowExtractionReview(true);
        },
        onError: () => toast({ title: "Upload failed", description: "Could not process file.", variant: "destructive" }),
      }
    );
  };

  const handleHistorySelect = (analysis: PropertyAiAnalysis) => {
    const aj = analysis.analysisJson as unknown as PropertyIntelligenceResult & { generatedAt?: string };
    if (aj.locationScore && aj.commercialViabilityScore && aj.clinicSuitabilityScore) {
      setIntelligenceResult({
        ...aj,
        propertyId: property.id,
        generatedAt: aj.generatedAt ?? analysis.createdAt,
        version: analysis.version,
        isStale: true,
      });
      setActiveTab("intelligence");
    }
  };

  return (
    <>
      <Sheet open={!!property} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {/* Header */}
          <div className={`p-6 border-b ${isActive ? "bg-primary/5 border-primary/20" : ""}`}>
            <SheetHeader>
              <SheetTitle className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge className={`text-xs ${stage.color}`}>{stage.label}</Badge>
                    {isActive && <Badge className="text-xs bg-primary text-primary-foreground gap-1"><Target className="w-3 h-3" />Active Property</Badge>}
                    {property.isFavourited && <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />}
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold leading-tight">{property.address ?? "Unnamed Property"}</p>
                      {property.postcode && <p className="text-sm text-muted-foreground font-normal">{property.postcode}</p>}
                      {property.sourceUrl && (
                        <a
                          href={property.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          View listing
                        </a>
                      )}
                      {latestAnalysisData && (
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>Last analysed {new Date(latestAnalysisData.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                          {intelligenceResult?.isStale && <Badge className="text-xs bg-amber-100 text-amber-700">Stale — property updated since analysis</Badge>}
                        </div>
                      )}
                    </div>
                    {property.photoUrl && (
                      <img
                        src={property.photoUrl}
                        alt={property.address ?? "Property photo"}
                        className="w-20 h-16 rounded-lg object-cover shrink-0 border"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                  </div>
                </div>
              </SheetTitle>
            </SheetHeader>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-3 mt-4">
              {property.monthlyRentGbp != null && property.monthlyRentGbp > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <PoundSterling className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-semibold">{formatGBP(property.monthlyRentGbp)}/mo</span>
                </div>
              )}
              {property.sqFootage != null && property.sqFootage > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{property.sqFootage.toFixed(0)} sq ft</span>
                </div>
              )}
              {property.parkingSpaces != null && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Car className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{property.parkingSpaces} parking</span>
                </div>
              )}
            </div>

            {/* Action row */}
            <div className="flex flex-wrap gap-2 mt-4">
              {!isActive && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/5" onClick={() => setShowActiveConfirm(true)}>
                  <Target className="w-3.5 h-3.5" />Set as Active
                </Button>
              )}
              {isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs border-muted-foreground/40 text-muted-foreground hover:bg-muted/40"
                  disabled={unsetPropertyActive.isPending}
                  onClick={() => {
                    unsetPropertyActive.mutate({ id: property.id }, {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
                        toast({ title: "Property deselected", description: "No active property is set." });
                        onUpdated();
                      },
                    });
                  }}
                >
                  {unsetPropertyActive.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  Deselect
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleUploadClick} disabled={uploadDocument.isPending}>
                {uploadDocument.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload PDF
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleAnalyse} disabled={analyseProperty.isPending}>
                {analyseProperty.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                {analyseProperty.isPending ? "Analysing…" : "Analyse"}
              </Button>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Radius selector */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">Analysis radius:</span>
              <Select value={String(searchRadiusMeters)} onValueChange={v => setSearchRadiusMeters(Number(v))}>
                <SelectTrigger className="h-6 text-xs w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[300, 400, 500, 600, 750, 1000, 1500, 2000].map(r => <SelectItem key={r} value={String(r)}>{r}m</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabs */}
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full mb-6 grid grid-cols-3 sm:grid-cols-6 h-auto gap-0.5 p-1">
                <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                <TabsTrigger value="checklist" className="text-xs">Checklist</TabsTrigger>
                <TabsTrigger value="intelligence" className="text-xs">AI Analysis</TabsTrigger>
                <TabsTrigger value="advisor" className="text-xs">Advisor</TabsTrigger>
                <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
                <TabsTrigger value="media" className="text-xs">Media</TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <PropertyForm
                  key={property.id}
                  initial={{
                    address: property.address ?? undefined,
                    postcode: property.postcode ?? undefined,
                    sqFootage: property.sqFootage ?? undefined,
                    annualRentGbp: property.annualRentGbp ?? undefined,
                    monthlyRentGbp: property.monthlyRentGbp ?? undefined,
                    vatOnRent: property.vatOnRent ?? false,
                    businessRatesGbp: property.businessRatesGbp ?? undefined,
                    serviceChargeGbp: property.serviceChargeGbp ?? undefined,
                    leaseLength: property.leaseLength ?? undefined,
                    useClass: property.useClass ?? undefined,
                    availabilityDate: property.availabilityDate ?? undefined,
                    parkingSpaces: property.parkingSpaces ?? undefined,
                    frontageMeters: property.frontageMeters ?? undefined,
                    agentName: property.agentName ?? undefined,
                    agentPhone: property.agentPhone ?? undefined,
                    agentEmail: property.agentEmail ?? undefined,
                    pipelineStatus: property.pipelineStatus ?? "found",
                    notes: property.notes ?? undefined,
                    viewingNotes: property.viewingNotes ?? undefined,
                    negotiationNotes: property.negotiationNotes ?? undefined,
                    landlordConcessions: property.landlordConcessions ?? undefined,
                    isFavourited: property.isFavourited ?? false,
                  }}
                  onSubmit={handleUpdate}
                  isLoading={updateProperty.isPending}
                  submitLabel="Save Changes"
                />

                <Separator className="my-4" />
                <PropertyScoringWeightsOverride propertyId={property.id} />
              </TabsContent>

              <TabsContent value="checklist">
                <ViewingChecklist property={property} />
              </TabsContent>

              <TabsContent value="intelligence" className="space-y-4">
                {analyseProperty.isPending && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <div className="text-center">
                      <p className="font-medium">Running AI Analysis…</p>
                      <p className="text-sm text-muted-foreground">This takes 15–30 seconds</p>
                    </div>
                  </div>
                )}
                {!analyseProperty.isPending && !intelligenceResult && (
                  <div className="text-center py-12 space-y-4">
                    <Brain className="w-10 h-10 text-muted-foreground mx-auto" />
                    <div>
                      <p className="font-medium">No analysis yet</p>
                      <p className="text-sm text-muted-foreground">Click "Analyse" above to run the full AI property intelligence report.</p>
                    </div>
                    <Button onClick={handleAnalyse} className="gap-2">
                      <Brain className="w-4 h-4" />Run AI Analysis
                    </Button>
                  </div>
                )}
                {!analyseProperty.isPending && intelligenceResult && (
                  <>
                    {intelligenceResult.isStale && (
                      <div className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400">Viewing historical version v{intelligenceResult.version}.</p>
                        <Button size="sm" variant="ghost" className="text-xs h-6 gap-1 text-amber-700" onClick={handleAnalyse}>
                          <RefreshCw className="w-3 h-3" />Re-analyse
                        </Button>
                      </div>
                    )}
                    <IntelligencePanel
                      result={intelligenceResult}
                      property={property}
                      onCompetitorsSaved={(updated) => {
                        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
                      }}
                    />
                    <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={handleAnalyse}>
                      <RefreshCw className="w-3.5 h-3.5" />Re-run Analysis
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="advisor">
                <AdvisorPanel property={property} />
              </TabsContent>

              <TabsContent value="history">
                <HistoryPanel propertyId={property.id} currentResult={intelligenceResult} onSelect={handleHistorySelect} />
              </TabsContent>

              <TabsContent value="media" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Documents & Media</h4>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleUploadClick} disabled={uploadDocument.isPending}>
                    {uploadDocument.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}Upload File
                  </Button>
                </div>
                {Array.isArray(property.mediaFiles) && property.mediaFiles.length > 0 ? (
                  <div className="space-y-2">
                    {property.mediaFiles.map((file) => {
                      const mf = file as { id: string; name: string; type: "pdf" | "image"; url: string; uploadedAt: string; sizeBytes?: number };
                      const isImg = mf.type === "image";
                      const fullUrl = mf.url.startsWith("/") ? `${window.location.origin}${mf.url}` : mf.url;
                      return (
                        <div key={mf.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                          {isImg ? (
                            <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <img src={fullUrl} alt={mf.name} className="w-14 h-14 object-cover rounded-md border" />
                            </a>
                          ) : (
                            <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <div className="w-14 h-14 rounded-md border bg-muted flex items-center justify-center">
                                <FileText className="w-6 h-6 text-muted-foreground" />
                              </div>
                            </a>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{mf.name}</p>
                            <p className="text-xs text-muted-foreground">{new Date(mf.uploadedAt).toLocaleDateString("en-GB")}{mf.sizeBytes ? ` · ${(mf.sizeBytes / 1024).toFixed(0)} KB` : ""}</p>
                          </div>
                          <Badge variant="outline" className="text-xs capitalize shrink-0">{mf.type}</Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-2">
                    <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">No documents or images uploaded yet.</p>
                    <p className="text-xs text-muted-foreground">Upload a PDF brochure or photos — AI will extract property details from PDFs.</p>
                  </div>
                )}

                <Separator />

                <BrochureAnalysisSection propertyId={property.id} />

                <Separator />
                <div className="space-y-1.5">
                  <h4 className="text-sm font-semibold">Property Notes</h4>
                  <p className="text-xs text-muted-foreground">General notes about this property (viewing impressions, questions for agent, etc.).</p>
                  <Textarea
                    value={property.notes ?? ""}
                    readOnly
                    rows={4}
                    className="text-sm resize-none bg-muted/40"
                    placeholder="No notes yet. Edit property details to add notes."
                  />
                  <p className="text-xs text-muted-foreground">Edit notes in the Details tab.</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif" className="hidden" onChange={handleFileChange} />

      {/* Extraction review */}
      <ExtractionReviewDialog
        open={showExtractionReview}
        onClose={() => setShowExtractionReview(false)}
        extraction={extraction}
        propertyId={property.id}
        onConfirmed={() => {
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
          onUpdated();
        }}
      />

      {/* Delete confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this property?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove {property.address ?? "this property"} from the pipeline. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set active confirm */}
      <AlertDialog open={showActiveConfirm} onOpenChange={setShowActiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set as active property?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark <strong>{property.address ?? "this property"}</strong> as your selected location.
              The monthly rent ({formatGBP(property.monthlyRentGbp ?? 0)}) and business rates will be automatically synced into your financial model, and a decision log entry will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSetActive} disabled={setPropertyActive.isPending}>
              {setPropertyActive.isPending ? "Setting…" : "Set as Active"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Mini Property Card ───────────────────────────────────────────────────────

function PropertyCard({
  property, onOpen, compareMode = false, isSelected = false, onToggleSelect, rank,
}: {
  property: ClinicProperty;
  onOpen: () => void;
  compareMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  rank?: number;
}) {
  const queryClient = useQueryClient();
  const setPropertyActive = useSetPropertyActive();
  const stage = pipelineStageInfo(property.pipelineStatus ?? "found");

  const handleClick = () => {
    if (compareMode) onToggleSelect?.();
    else onOpen();
  };

  const handleSetActive = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPropertyActive.mutate({ id: property.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
        queryClient.invalidateQueries({ queryKey: getGetFinancialModelQueryKey(PROJECT_ID) });
        queryClient.invalidateQueries({ queryKey: getListFixedCostItemsQueryKey(PROJECT_ID) });
        window.location.href = `/clinic-launch-os/financials?generate=1`;
      },
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
      className={`w-full text-left rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all space-y-3 cursor-pointer ${
        property.isActiveForProject ? "border-primary/50 ring-1 ring-primary/20" : ""
      } ${isSelected ? "border-primary ring-2 ring-primary/30 bg-primary/5" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        {rank != null && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mr-1 ${
            rank === 1 ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" :
            rank === 2 ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" :
            rank === 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
            "bg-muted text-muted-foreground"
          }`}>#{rank}</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {compareMode && (
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                {isSelected && <CheckCircle className="w-3 h-3 text-primary-foreground" />}
              </div>
            )}
            {property.isActiveForProject && <Target className="w-3.5 h-3.5 text-primary shrink-0" />}
            {property.isFavourited && <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />}
            <Badge className={`text-xs ${stage.color} shrink-0`}>{stage.label}</Badge>
            {property.isAnalysisStale && (
              <Badge className="text-xs bg-amber-100 text-amber-700 shrink-0">Analysis stale</Badge>
            )}
          </div>
          <p className="text-sm font-semibold leading-tight truncate">{property.address ?? "Unnamed"}</p>
          {property.postcode && <p className="text-xs text-muted-foreground">{property.postcode}</p>}
          {property.latestAnalysisAt && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Analysed {new Date(property.latestAnalysisAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {property.monthlyRentGbp != null && property.monthlyRentGbp > 0 && (
          <span className="text-xs flex items-center gap-1 text-muted-foreground">
            <PoundSterling className="w-3 h-3" />{formatGBP(property.monthlyRentGbp)}/mo
          </span>
        )}
        {property.sqFootage != null && property.sqFootage > 0 && (
          <span className="text-xs flex items-center gap-1 text-muted-foreground">
            <Maximize2 className="w-3 h-3" />{property.sqFootage.toFixed(0)} sq ft
          </span>
        )}
        {property.parkingSpaces != null && (
          <span className="text-xs flex items-center gap-1 text-muted-foreground">
            <Car className="w-3 h-3" />{property.parkingSpaces}
          </span>
        )}
      </div>
      {!compareMode && !property.isActiveForProject && property.pipelineStatus !== "rejected" && (
        <div className="pt-1 border-t border-border/50">
          <button
            onClick={handleSetActive}
            disabled={setPropertyActive.isPending}
            className="text-xs text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
          >
            <Target className="w-3 h-3" />
            {setPropertyActive.isPending ? "Setting…" : "Use this property for project"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Comparison Dialog ────────────────────────────────────────────────────────

function ComparisonDialog({
  properties, selectedIds, open, onClose, onOpen,
}: {
  properties: ClinicProperty[];
  selectedIds: Set<number>;
  open: boolean;
  onClose: () => void;
  onOpen: (p: ClinicProperty) => void;
}) {
  const selected = properties.filter(p => selectedIds.has(p.id));
  if (selected.length < 2) return null;

  type Row = {
    label: string;
    getValue: (p: ClinicProperty) => string;
    numericValue?: (p: ClinicProperty) => number | null;
    higherIsBetter?: boolean;
    lowerIsBetter?: boolean;
  };

  const rows: Row[] = [
    { label: "Address", getValue: p => p.address ?? "—" },
    { label: "Postcode", getValue: p => p.postcode ?? "—" },
    { label: "Pipeline Stage", getValue: p => pipelineStageInfo(p.pipelineStatus ?? "found").label },
    { label: "Size (sq ft)", getValue: p => p.sqFootage != null ? `${p.sqFootage.toFixed(0)} sq ft` : "—", numericValue: p => p.sqFootage ?? null, higherIsBetter: true },
    { label: "Monthly Rent", getValue: p => p.monthlyRentGbp != null ? formatGBP(p.monthlyRentGbp) : "—", numericValue: p => p.monthlyRentGbp ?? null, lowerIsBetter: true },
    { label: "Annual Rent", getValue: p => p.annualRentGbp != null ? formatGBP(p.annualRentGbp) : "—", numericValue: p => p.annualRentGbp ?? null, lowerIsBetter: true },
    { label: "Rent/sq ft/yr", getValue: p => (p.annualRentGbp && p.sqFootage) ? `${formatGBP(p.annualRentGbp / p.sqFootage)}/sq ft` : "—", numericValue: p => (p.annualRentGbp && p.sqFootage && p.sqFootage > 0) ? p.annualRentGbp / p.sqFootage : null, lowerIsBetter: true },
    { label: "Business Rates (annual)", getValue: p => p.businessRatesGbp != null ? formatGBP(p.businessRatesGbp) : "—", numericValue: p => p.businessRatesGbp ?? null, lowerIsBetter: true },
    { label: "Service Charge (annual)", getValue: p => p.serviceChargeGbp != null ? formatGBP(p.serviceChargeGbp) : "—", numericValue: p => p.serviceChargeGbp ?? null, lowerIsBetter: true },
    { label: "Parking Spaces", getValue: p => p.parkingSpaces != null ? String(p.parkingSpaces) : "—", numericValue: p => p.parkingSpaces ?? null, higherIsBetter: true },
    { label: "Frontage (m)", getValue: p => p.frontageMeters != null ? `${p.frontageMeters}m` : "—", numericValue: p => p.frontageMeters ?? null, higherIsBetter: true },
    { label: "Lease Length", getValue: p => p.leaseLength ?? "—" },
    { label: "Use Class", getValue: p => p.useClass ?? "—" },
    { label: "Availability", getValue: p => p.availabilityDate ? new Date(p.availabilityDate).toLocaleDateString("en-GB") : "—" },
    { label: "VAT on Rent", getValue: p => p.vatOnRent ? "Yes" : "No" },
    { label: "Agent", getValue: p => p.agentName ?? "—" },
  ];

  // Compute winner for each row
  function getWinnerId(row: Row): number | null {
    if (!row.numericValue) return null;
    const vals = selected.map(p => ({ id: p.id, v: row.numericValue!(p) })).filter(x => x.v != null) as { id: number; v: number }[];
    if (vals.length !== selected.length) return null;
    if (row.higherIsBetter) {
      const best = Math.max(...vals.map(x => x.v));
      const winners = vals.filter(x => x.v === best);
      return winners.length === 1 ? winners[0].id : null;
    }
    if (row.lowerIsBetter) {
      const best = Math.min(...vals.map(x => x.v));
      const winners = vals.filter(x => x.v === best);
      return winners.length === 1 ? winners[0].id : null;
    }
    return null;
  }

  // Summary: count wins per property
  const winCounts: Record<number, number> = {};
  for (const row of rows) {
    const wid = getWinnerId(row);
    if (wid != null) winCounts[wid] = (winCounts[wid] ?? 0) + 1;
  }
  const sortedByWins = (Object.entries(winCounts) as [string, number][]).sort((a, b) => b[1] - a[1]);
  const overallWinnerId = sortedByWins.length > 0 ? parseInt(sortedByWins[0][0]) : null;

  // Derive recommendation summaries
  const lowestRentId = (() => {
    const vals = selected.map(p => ({ id: p.id, v: p.annualRentGbp ?? p.monthlyRentGbp ?? null })).filter(x => x.v != null) as { id: number; v: number }[];
    if (vals.length < 2) return null;
    const best = Math.min(...vals.map(x => x.v));
    const w = vals.filter(x => x.v === best);
    return w.length === 1 ? w[0].id : null;
  })();
  const largestId = (() => {
    const vals = selected.map(p => ({ id: p.id, v: p.sqFootage ?? null })).filter(x => x.v != null) as { id: number; v: number }[];
    if (vals.length < 2) return null;
    const best = Math.max(...vals.map(x => x.v));
    const w = vals.filter(x => x.v === best);
    return w.length === 1 ? w[0].id : null;
  })();
  const mostParkingId = (() => {
    const vals = selected.map(p => ({ id: p.id, v: p.parkingSpaces ?? null })).filter(x => x.v != null) as { id: number; v: number }[];
    if (vals.length < 2) return null;
    const best = Math.max(...vals.map(x => x.v));
    const w = vals.filter(x => x.v === best);
    return w.length === 1 ? w[0].id : null;
  })();

  // Best premium / frontage (highest frontage = most visible shopfront)
  const bestFrontageId = (() => {
    const vals = selected.map(p => ({ id: p.id, v: p.frontageMeters ?? null })).filter(x => x.v != null) as { id: number; v: number }[];
    if (vals.length < 2) return null;
    const best = Math.max(...vals.map(x => x.v));
    const w = vals.filter(x => x.v === best);
    return w.length === 1 ? w[0].id : null;
  })();
  // Best cost efficiency (lowest rent per sq ft)
  const bestEfficiencyId = (() => {
    const vals = selected.map(p => {
      const rent = p.annualRentGbp ?? (p.monthlyRentGbp ? p.monthlyRentGbp * 12 : null);
      if (!rent || !p.sqFootage || p.sqFootage === 0) return null;
      return { id: p.id, v: rent / p.sqFootage };
    }).filter(Boolean) as { id: number; v: number }[];
    if (vals.length < 2) return null;
    const best = Math.min(...vals.map(x => x.v));
    const w = vals.filter(x => x.v === best);
    return w.length === 1 ? w[0].id : null;
  })();
  // Earliest available (fastest to launch)
  const earliestAvailableId = (() => {
    const vals = selected.map(p => p.availabilityDate ? { id: p.id, v: new Date(p.availabilityDate).getTime() } : null).filter(Boolean) as { id: number; v: number }[];
    if (vals.length < 2) return null;
    const best = Math.min(...vals.map(x => x.v));
    const w = vals.filter(x => x.v === best);
    return w.length === 1 ? w[0].id : null;
  })();
  // Lowest risk: most complete data (most non-null key fields)
  const lowestRiskId = (() => {
    const keyFields = (p: ClinicProperty) => [p.address, p.postcode, p.monthlyRentGbp, p.sqFootage, p.agentName, p.leaseLength, p.useClass, p.businessRatesGbp].filter(Boolean).length;
    const vals = selected.map(p => ({ id: p.id, v: keyFields(p) }));
    const best = Math.max(...vals.map(x => x.v));
    const w = vals.filter(x => x.v === best);
    return w.length === 1 ? w[0].id : null;
  })();

  const recommendations: { label: string; icon: React.ReactNode; text: string }[] = [];
  if (overallWinnerId) recommendations.push({ label: "Best Overall", icon: <Trophy className="w-4 h-4 text-amber-500" />, text: selected.find(p => p.id === overallWinnerId)?.address ?? "Unnamed" });
  if (lowestRentId) recommendations.push({ label: "Lowest Cost", icon: <PoundSterling className="w-4 h-4 text-green-500" />, text: selected.find(p => p.id === lowestRentId)?.address ?? "Unnamed" });
  if (bestFrontageId) recommendations.push({ label: "Premium Location", icon: <Maximize2 className="w-4 h-4 text-rose-500" />, text: selected.find(p => p.id === bestFrontageId)?.address ?? "Unnamed" });
  if (largestId) recommendations.push({ label: "Biggest Space", icon: <Building className="w-4 h-4 text-blue-500" />, text: selected.find(p => p.id === largestId)?.address ?? "Unnamed" });
  if (mostParkingId) recommendations.push({ label: "Best Parking", icon: <Car className="w-4 h-4 text-violet-500" />, text: selected.find(p => p.id === mostParkingId)?.address ?? "Unnamed" });
  if (bestEfficiencyId) recommendations.push({ label: "Best Value / sq ft", icon: <PoundSterling className="w-4 h-4 text-teal-500" />, text: selected.find(p => p.id === bestEfficiencyId)?.address ?? "Unnamed" });
  if (earliestAvailableId) recommendations.push({ label: "Fastest to Launch", icon: <Target className="w-4 h-4 text-indigo-500" />, text: selected.find(p => p.id === earliestAvailableId)?.address ?? "Unnamed" });
  if (lowestRiskId) recommendations.push({ label: "Lowest Risk", icon: <CheckCircle className="w-4 h-4 text-emerald-500" />, text: selected.find(p => p.id === lowestRiskId)?.address ?? "Unnamed" });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            Comparing {selected.length} Properties
          </DialogTitle>
          <DialogDescription>Green highlights show the winner for each comparable metric. Select 2–4 properties to compare.</DialogDescription>
        </DialogHeader>

        {/* Recommendation summaries */}
        {recommendations.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {recommendations.map(rec => (
              <div key={rec.label} className="rounded-lg border bg-card p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">{rec.icon}{rec.label}</div>
                <p className="text-xs font-semibold leading-snug">{rec.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 text-xs text-muted-foreground uppercase tracking-wider font-medium w-40">Field</th>
                {selected.map(p => (
                  <th key={p.id} className="text-left py-2 px-3 min-w-[160px]">
                    <button
                      className="text-left hover:text-primary transition-colors"
                      onClick={() => { onClose(); setTimeout(() => onOpen(p), 100); }}
                    >
                      <p className="font-semibold leading-tight">{p.address ?? "Unnamed"}</p>
                      {p.postcode && <p className="text-xs text-muted-foreground font-normal">{p.postcode}</p>}
                      {p.isActiveForProject && (
                        <Badge className="text-xs bg-primary/15 text-primary mt-0.5">Active</Badge>
                      )}
                      {overallWinnerId === p.id && (
                        <Badge className="text-xs bg-amber-100 text-amber-700 mt-0.5 ml-1">
                          <Trophy className="w-2.5 h-2.5 mr-0.5" />Leader
                        </Badge>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const winnerId = getWinnerId(row);
                return (
                  <tr key={row.label} className={ri % 2 === 0 ? "bg-muted/20" : ""}>
                    <td className="py-2 pr-4 text-xs text-muted-foreground font-medium">{row.label}</td>
                    {selected.map(p => {
                      const isWinner = winnerId === p.id;
                      return (
                        <td key={p.id} className={`py-2 px-3 text-sm ${isWinner ? "text-green-700 dark:text-green-400 font-semibold" : ""}`}>
                          {isWinner && <CheckCircle className="w-3 h-3 inline mr-1 text-green-600" />}
                          {row.getValue(p)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Per-Property Scoring Weight Override ─────────────────────────────────────

function PropertyScoringWeightsOverride({ propertyId }: { propertyId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data: weights } = useGetPropertyScoringWeights(propertyId, {
    query: { queryKey: getGetPropertyScoringWeightsQueryKey(propertyId) },
  });
  const updateWeights = useUpdatePropertyScoringWeights();
  const [local, setLocal] = useState<ScoringWeights | null>(null);

  useEffect(() => {
    if (weights && !local) setLocal(weights as ScoringWeights);
  }, [weights]);

  const WEIGHT_KEYS: { key: keyof ScoringWeights; label: string }[] = [
    { key: "affordability", label: "Affordability" },
    { key: "size", label: "Size" },
    { key: "parking", label: "Parking" },
    { key: "frontage", label: "Frontage" },
    { key: "location", label: "Location Score" },
    { key: "competition", label: "Competition" },
    { key: "fitoutComplexity", label: "Fit-Out Simplicity" },
    { key: "demographics", label: "Demographics" },
  ];
  const defaultWeights: ScoringWeights = { affordability: 1, size: 1, parking: 1, frontage: 1, location: 1, competition: 1, fitoutComplexity: 1, demographics: 1 };

  const handleSave = () => {
    if (!local) return;
    updateWeights.mutate(
      { id: propertyId, data: local },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPropertyScoringWeightsQueryKey(propertyId) });
          queryClient.invalidateQueries({ queryKey: ["property-ranking"] });
          toast({ title: "Per-property scoring override saved" });
          setOpen(false);
        },
      }
    );
  };

  const handleClear = () => {
    updateWeights.mutate(
      { id: propertyId, data: {} as ScoringWeights },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPropertyScoringWeightsQueryKey(propertyId) });
          queryClient.invalidateQueries({ queryKey: ["property-ranking"] });
          setLocal(null);
          toast({ title: "Per-property override cleared — using project defaults" });
          setOpen(false);
        },
      }
    );
  };

  if (!open) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Scoring Weight Override</p>
          <p className="text-xs text-muted-foreground">
            {weights ? "Custom weights active — overrides project defaults for this property." : "Using project-level scoring weights."}
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { if (!local) setLocal(defaultWeights); setOpen(true); }}>
          <Sparkles className="w-3.5 h-3.5" />{weights ? "Edit Override" : "Set Override"}
        </Button>
      </div>
    );
  }

  const display = local ?? defaultWeights;
  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Scoring Weight Override</h4>
        <div className="flex gap-2">
          {weights && <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive hover:text-destructive" onClick={handleClear} disabled={updateWeights.isPending}>Clear</Button>}
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setOpen(false)}><X className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Override how dimensions are weighted for this property only. Leave cleared to use project-wide weights.</p>
      <div className="space-y-3">
        {WEIGHT_KEYS.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">{label}</span>
              <span className="font-semibold w-8 text-right">{((display[key] ?? 1) * 100).toFixed(0)}%</span>
            </div>
            <Slider
              min={0} max={3} step={0.1}
              value={[display[key] ?? 1]}
              onValueChange={([v]) => setLocal(l => ({ ...(l ?? defaultWeights), [key]: v }))}
              className="w-full"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button size="sm" className="text-xs gap-1.5" onClick={handleSave} disabled={updateWeights.isPending}>
          {updateWeights.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}Save Override
        </Button>
      </div>
    </div>
  );
}

// ─── Rankings View ────────────────────────────────────────────────────────────

const WEIGHT_LABELS: { key: keyof ScoringWeights; label: string }[] = [
  { key: "affordability", label: "Affordability" },
  { key: "size", label: "Size" },
  { key: "parking", label: "Parking" },
  { key: "frontage", label: "Frontage" },
  { key: "location", label: "Location Score" },
  { key: "competition", label: "Competition" },
  { key: "fitoutComplexity", label: "Fit-Out Simplicity" },
  { key: "demographics", label: "Demographics" },
];

function ScoringWeightsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data: weights } = useGetProjectScoringWeights(PROJECT_ID, {
    query: { queryKey: getGetProjectScoringWeightsQueryKey(PROJECT_ID) },
  });
  const updateWeights = useUpdateProjectScoringWeights();
  const [local, setLocal] = useState<ScoringWeights | null>(null);

  useEffect(() => { if (weights && !local) setLocal(weights); }, [weights]);

  const handleSave = () => {
    if (!local) return;
    updateWeights.mutate(
      { projectId: PROJECT_ID, data: local },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectScoringWeightsQueryKey(PROJECT_ID) });
          queryClient.invalidateQueries({ queryKey: ["property-ranking"] });
          toast({ title: "Scoring weights saved", description: "Rankings will update on next load." });
          setOpen(false);
        },
      }
    );
  };

  const handleReset = () => {
    const defaults: ScoringWeights = { affordability: 1, size: 1, parking: 1, frontage: 1, location: 1, competition: 1, fitoutComplexity: 1, demographics: 1 };
    setLocal(defaults);
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => setOpen(true)}>
        <Sparkles className="w-3.5 h-3.5" />Scoring Weights
      </Button>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Scoring Weights</h4>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={handleReset}>Reset</Button>
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setOpen(false)}><X className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Adjust how much each dimension influences the overall ranking score. Higher = more impact.</p>
      {local && (
        <div className="space-y-3">
          {WEIGHT_LABELS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">{label}</span>
                <span className="font-semibold w-8 text-right">{((local[key] ?? 1) * 100).toFixed(0)}%</span>
              </div>
              <Slider
                min={0}
                max={3}
                step={0.1}
                value={[local[key] ?? 1]}
                onValueChange={([v]) => setLocal(l => l ? { ...l, [key]: v } : l)}
                className="w-full"
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Button size="sm" className="text-xs gap-1.5" onClick={handleSave} disabled={updateWeights.isPending}>
          {updateWeights.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          Save & Rerank
        </Button>
      </div>
    </div>
  );
}

function RankingsView({ properties, onOpen }: { properties: ClinicProperty[]; onOpen: (p: ClinicProperty) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [mode, setMode] = useState<"overall" | "safest" | "highest-revenue" | "premium-brand" | "lowest-risk" | "fastest-launch">("overall");
  const [overridePropertyId, setOverridePropertyId] = useState<number | null>(null);
  const [overrideRank, setOverrideRank] = useState<string>("");
  const { data: ranking, isLoading } = useGetPropertyRanking(PROJECT_ID, { mode }, {
    query: { enabled: true, queryKey: ["property-ranking", PROJECT_ID, mode] },
  });
  const updateProperty = useUpdateProperty();

  const findProperty = (id: number) => properties.find(p => p.id === id);

  const handleSetOverride = (propertyId: number, rank: number | null) => {
    updateProperty.mutate(
      { id: propertyId, data: { manualRankOverride: rank } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["property-ranking"] });
          toast({ title: rank != null ? `Manual rank #${rank} set` : "Override cleared" });
          setOverridePropertyId(null);
          setOverrideRank("");
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">Ranking mode:</span>
          <div className="flex flex-wrap gap-2">
            {RANKING_MODES.map(({ key, label, icon }) => (
              <Button
                key={key}
                size="sm"
                variant={mode === key ? "default" : "outline"}
                className="gap-1.5 text-xs h-7"
                onClick={() => setMode(key as typeof mode)}
              >
                {icon}{label}
              </Button>
            ))}
          </div>
        </div>
        <ScoringWeightsPanel />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {ranking && (
        <div className="space-y-3">
          {ranking.rankings.map((item: PropertyRankingItem) => {
            const prop = findProperty(item.propertyId);
            const stage = pipelineStageInfo(item.pipelineStatus ?? "found");
            const isSettingOverride = overridePropertyId === item.propertyId;
            return (
              <div
                key={item.propertyId}
                className={`rounded-xl border bg-card p-4 space-y-3 transition-all hover:border-primary/40 hover:shadow-sm ${item.isActiveForProject ? "border-primary/50 ring-1 ring-primary/20" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 cursor-pointer ${
                    item.rank === 1 ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" :
                    item.rank === 2 ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" :
                    item.rank === 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                    "bg-muted text-muted-foreground"
                  }`}
                    title="Click to set manual rank override"
                    onClick={e => { e.stopPropagation(); setOverridePropertyId(isSettingOverride ? null : item.propertyId); setOverrideRank(""); }}
                  >
                    {item.manualRankOverride != null ? "★" : `#${item.rank}`}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => prop && onOpen(prop)}>
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-semibold truncate">{item.address ?? "Unnamed"}</p>
                      {item.isFavourited && <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />}
                      {item.isActiveForProject && <Badge className="text-xs bg-primary/15 text-primary shrink-0 gap-1"><Target className="w-2.5 h-2.5" />Active</Badge>}
                      {item.manualRankOverride != null && <Badge className="text-xs bg-amber-100 text-amber-700 shrink-0">Manual #{ item.manualRankOverride}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.postcode && <span className="text-xs text-muted-foreground">{item.postcode}</span>}
                      <Badge className={`text-xs ${stage.color}`}>{stage.label}</Badge>
                      {!item.hasAnalysis && <span className="text-xs text-muted-foreground italic">No AI analysis</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold">{item.score}</p>
                    <p className="text-xs text-muted-foreground">score</p>
                  </div>
                </div>
                {isSettingOverride && (
                  <div className="flex items-center gap-2 pt-1 border-t" onClick={e => e.stopPropagation()}>
                    <p className="text-xs text-muted-foreground shrink-0">Manual rank:</p>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={overrideRank}
                      onChange={e => setOverrideRank(e.target.value)}
                      placeholder={`Current: #${item.rank}`}
                      className="h-7 text-xs w-28"
                    />
                    <Button size="sm" className="h-7 text-xs" disabled={updateProperty.isPending} onClick={() => handleSetOverride(item.propertyId, overrideRank ? parseInt(overrideRank) : null)}>
                      Set
                    </Button>
                    {item.manualRankOverride != null && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleSetOverride(item.propertyId, null)}>
                        Clear
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOverridePropertyId(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
                <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.rank === 1 ? "bg-primary" : item.rank <= 3 ? "bg-primary/70" : "bg-muted-foreground/40"}`}
                    style={{ width: `${Math.min(100, item.score)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{item.rationale}</p>
              </div>
            );
          })}
          {ranking.rankings.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">No properties to rank yet.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PropertiesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<ClinicProperty | null>(null);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [pageTab, setPageTab] = useState("pipeline");
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelected, setCompareSelected] = useState<Set<number>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  const MAX_COMPARE = 4;

  const toggleCompareSelect = (id: number) => {
    setCompareSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_COMPARE) {
        next.add(id);
      }
      return next;
    });
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setCompareSelected(new Set());
    setShowComparison(false);
  };

  const { data: properties, isLoading } = useListProperties(PROJECT_ID, {
    query: { queryKey: getListPropertiesQueryKey(PROJECT_ID), enabled: true },
  });

  // Fetch overall ranking once at page level to power rank badges on all PropertyCards
  const { data: overallRanking } = useGetPropertyRanking(PROJECT_ID, { mode: "overall" }, {
    query: { queryKey: ["property-ranking", PROJECT_ID, "overall"] },
  });
  const rankMap: Record<number, number> = {};
  overallRanking?.rankings.forEach((item: PropertyRankingItem) => { rankMap[item.propertyId] = item.rank; });

  const createProperty = useCreateProperty();

  const handleCreateProperty = (data: PropertyFormData) => {
    createProperty.mutate(
      { projectId: PROJECT_ID, data: { ...data, status: "viewing" as const, pipelineStatus: (data.pipelineStatus ?? "found") as CreatePropertyBodyPipelineStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
          setIsFormOpen(false);
          toast({ title: "Property added" });
        },
      }
    );
  };

  const activeProperty = properties?.find(p => p.isActiveForProject);
  const nonRejected = properties?.filter(p => p.pipelineStatus !== "rejected") ?? [];
  const rejected = properties?.filter(p => p.pipelineStatus === "rejected") ?? [];

  // Group by pipeline stage for pipeline view
  const byStage = PIPELINE_STAGES.reduce<Record<string, ClinicProperty[]>>((acc, stage) => {
    if (stage.key !== "rejected") {
      acc[stage.key] = properties?.filter(p => p.pipelineStatus === stage.key) ?? [];
    }
    return acc;
  }, {});
  const activeStages = PIPELINE_STAGES.filter(s => s.key !== "rejected" && (byStage[s.key]?.length ?? 0) > 0);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 bg-card rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-48 bg-card rounded-lg" />
          <div className="h-48 bg-card rounded-lg" />
          <div className="h-48 bg-card rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Property Pipeline"
        subtitle={`${nonRejected.length} active · ${rejected.length} rejected${activeProperty ? ` · Active: ${activeProperty.address ?? "Property selected"}` : ""}`}
        action={
          <div className="flex gap-2 flex-wrap">
          {compareMode ? (
            <>
              {compareSelected.size >= 2 && (
                <Button size="sm" className="gap-2 text-xs" onClick={() => setShowComparison(true)}>
                  <ArrowLeftRight className="w-3.5 h-3.5" />Compare {compareSelected.size}
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={exitCompareMode}>
                <X className="w-3.5 h-3.5" />Exit Compare
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setCompareMode(true)}>
                <ArrowLeftRight className="w-3.5 h-3.5" />Compare
              </Button>
              <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setShowUrlImport(true)}>
                <Link2 className="w-3.5 h-3.5" />Import URL
              </Button>
              <Button size="sm" className="gap-2 text-xs" onClick={() => setIsFormOpen(true)}>
                <Plus className="w-3.5 h-3.5" />Add Property
              </Button>
            </>
          )}
        </div>
        }
      />

      {/* Active Property Banner */}
      {activeProperty && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Active Clinic Location</p>
            <p className="font-semibold truncate">{activeProperty.address}</p>
            <div className="flex flex-wrap gap-3 mt-0.5">
              {activeProperty.monthlyRentGbp != null && <span className="text-xs text-muted-foreground">{formatGBP(activeProperty.monthlyRentGbp)}/mo rent</span>}
              {activeProperty.sqFootage != null && <span className="text-xs text-muted-foreground">{activeProperty.sqFootage.toFixed(0)} sq ft</span>}
            </div>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 text-xs gap-1.5" onClick={() => setSelectedProperty(activeProperty)}>
            <Pencil className="w-3.5 h-3.5" />View
          </Button>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={pageTab} onValueChange={setPageTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pipeline" className="gap-1.5 text-xs"><ListFilter className="w-3.5 h-3.5" /><span className="hidden sm:inline">Pipeline</span></TabsTrigger>
          <TabsTrigger value="rankings" className="gap-1.5 text-xs"><Trophy className="w-3.5 h-3.5" /><span className="hidden sm:inline">Rankings</span></TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5 text-xs"><LayoutGrid className="w-3.5 h-3.5" /><span className="hidden sm:inline">All Properties</span></TabsTrigger>
          <TabsTrigger value="map" className="gap-1.5 text-xs"><Map className="w-3.5 h-3.5" /><span className="hidden sm:inline">Map View</span></TabsTrigger>
        </TabsList>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="mt-6">
          {(properties?.length ?? 0) === 0 ? (
            <div className="text-center py-16 space-y-4">
              <Building className="w-12 h-12 text-muted-foreground mx-auto" />
              <div>
                <p className="font-semibold text-lg">No properties yet</p>
                <p className="text-sm text-muted-foreground">Add your first property or import from a listing URL to get started.</p>
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => setShowUrlImport(true)} className="gap-2"><Link2 className="w-4 h-4" />Import from URL</Button>
                <Button onClick={() => setIsFormOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Add Manually</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {activeStages.map(stage => (
                <div key={stage.key}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={`text-xs ${stage.color}`}>{stage.label}</Badge>
                    <span className="text-xs text-muted-foreground">({byStage[stage.key]?.length ?? 0})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {byStage[stage.key]?.map(prop => (
                      <PropertyCard
                        key={prop.id}
                        property={prop}
                        onOpen={() => setSelectedProperty(prop)}
                        compareMode={compareMode}
                        isSelected={compareSelected.has(prop.id)}
                        onToggleSelect={() => toggleCompareSelect(prop.id)}
                        rank={rankMap[prop.id]}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {rejected.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="text-xs bg-muted text-muted-foreground opacity-60">Rejected</Badge>
                    <span className="text-xs text-muted-foreground">({rejected.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 opacity-60">
                    {rejected.map(prop => (
                      <PropertyCard
                        key={prop.id}
                        property={prop}
                        onOpen={() => setSelectedProperty(prop)}
                        compareMode={compareMode}
                        isSelected={compareSelected.has(prop.id)}
                        onToggleSelect={() => toggleCompareSelect(prop.id)}
                        rank={rankMap[prop.id]}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Rankings Tab */}
        <TabsContent value="rankings" className="mt-6">
          {(properties?.length ?? 0) === 0 ? (
            <div className="text-center py-16 space-y-2">
              <Trophy className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="font-semibold">No properties to rank yet</p>
              <p className="text-sm text-muted-foreground">Add properties first, then use Rankings to compare them.</p>
            </div>
          ) : (
            <RankingsView properties={properties ?? []} onOpen={setSelectedProperty} />
          )}
        </TabsContent>

        {/* All Properties Tab */}
        <TabsContent value="all" className="mt-6">
          {(properties?.length ?? 0) === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">No properties yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties?.map(prop => (
                <PropertyCard
                  key={prop.id}
                  property={prop}
                  onOpen={() => setSelectedProperty(prop)}
                  compareMode={compareMode}
                  isSelected={compareSelected.has(prop.id)}
                  onToggleSelect={() => toggleCompareSelect(prop.id)}
                  rank={rankMap[prop.id]}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Map View Tab */}
        <TabsContent value="map" className="mt-4">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />Loading map…
            </div>
          }>
            <PropertyMapView
              properties={properties ?? []}
              onOpen={setSelectedProperty}
            />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Add Property Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building className="w-5 h-5 text-primary" />Add Property</DialogTitle>
            <DialogDescription>Manually add a property to your pipeline.</DialogDescription>
          </DialogHeader>
          <PropertyForm
            onSubmit={handleCreateProperty}
            isLoading={createProperty.isPending}
            submitLabel="Add to Pipeline"
          />
        </DialogContent>
      </Dialog>

      {/* URL Import Dialog */}
      <UrlImportDialog
        open={showUrlImport}
        onClose={() => setShowUrlImport(false)}
        onCreateProperty={handleCreateProperty}
      />

      {/* Property Detail Sheet */}
      <PropertyDetailSheet
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) })}
        onDeleted={() => setSelectedProperty(null)}
      />

      {/* Comparison Dialog */}
      {properties && (
        <ComparisonDialog
          properties={properties}
          selectedIds={compareSelected}
          open={showComparison}
          onClose={() => setShowComparison(false)}
          onOpen={(p) => { exitCompareMode(); setSelectedProperty(p); }}
        />
      )}
    </div>
  );
}
