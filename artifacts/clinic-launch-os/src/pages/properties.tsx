import { useState, useRef } from "react";
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
} from "@workspace/api-client-react";
import type {
  ClinicProperty,
  UpdatePropertyBodyStatus,
  PropertyIntelligenceResult,
  PropertyExtraction,
  ManualCompetitor,
} from "@workspace/api-client-react";
import { formatGBP } from "@/lib/format";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
} from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

const PROJECT_ID = 1;

const STATUS_COLORS: Record<string, string> = {
  viewing: "bg-muted text-muted-foreground",
  shortlisted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  offer_made: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  under_offer: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  rejected: "bg-muted text-muted-foreground line-through opacity-70",
  active: "bg-primary/20 text-primary",
};

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

function ScoreCard({ score, title, icon }: { score: { total: number; maxTotal: number; grade: string; summary: string; factors: { name: string; score: number; maxScore: number; weight: number; explanation: string }[] }; title: string; icon: React.ReactNode }) {
  const pct = Math.round((score.total / score.maxTotal) * 100);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-semibold">{title}</h4>
        </div>
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

function ManualCompetitorForm({
  propertyId,
  initialCompetitors,
  onSaved,
}: {
  propertyId: number;
  initialCompetitors: ManualCompetitor[];
  onSaved: (updated: ManualCompetitor[]) => void;
}) {
  const [competitors, setCompetitors] = useState<ManualCompetitor[]>(initialCompetitors);
  const [name, setName] = useState("");
  const [type, setType] = useState("aesthetics clinic");
  const [notes, setNotes] = useState("");
  const setPropertyCompetitors = useSetPropertyCompetitors();

  const handleAdd = () => {
    if (!name.trim()) return;
    const updated = [...competitors, { name: name.trim(), type, notes: notes.trim() || null }];
    setCompetitors(updated);
    setName(""); setType("aesthetics clinic"); setNotes("");
    setPropertyCompetitors.mutate({ id: propertyId, data: updated }, { onSuccess: onSaved });
  };

  const handleRemove = (idx: number) => {
    const updated = competitors.filter((_, i) => i !== idx);
    setCompetitors(updated);
    setPropertyCompetitors.mutate({ id: propertyId, data: updated }, { onSuccess: onSaved });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <h5 className="text-sm font-semibold flex items-center gap-2">
        <Building className="w-4 h-4 text-primary" />
        Add Known Competitors
      </h5>
      <p className="text-xs text-muted-foreground">Manually enter nearby competitors. They'll be used to score competition when AI Analysis is re-run.</p>

      {competitors.length > 0 && (
        <ul className="space-y-1.5">
          {competitors.map((c, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm p-2 rounded bg-card border">
              <span className="flex-1 min-w-0 truncate font-medium">{c.name}<span className="text-muted-foreground font-normal ml-2 text-xs capitalize">{c.type}</span></span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0" onClick={() => handleRemove(i)}>
                <XCircle className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Competitor name" className="text-xs h-8" onKeyDown={e => e.key === "Enter" && handleAdd()} />
        <select value={type} onChange={e => setType(e.target.value)} className="text-xs h-8 rounded-md border bg-background px-2">
          <option value="aesthetics clinic">Aesthetics clinic</option>
          <option value="beauty salon">Beauty salon</option>
          <option value="medispa">Medispa</option>
          <option value="skin clinic">Skin clinic</option>
          <option value="cosmetic clinic">Cosmetic clinic</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" className="text-xs h-8 flex-1" />
        <Button size="sm" onClick={handleAdd} disabled={!name.trim() || setPropertyCompetitors.isPending} className="h-8 shrink-0">Add</Button>
      </div>
    </div>
  );
}

function IntelligencePanel({ result, property, onCompetitorsSaved }: { result: PropertyIntelligenceResult; property: ClinicProperty; onCompetitorsSaved: (updated: ManualCompetitor[]) => void }) {
  const overallScore = Math.round(
    (result.locationScore.total + result.commercialViabilityScore.total + result.clinicSuitabilityScore.total) / 3
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Location</p>
          <p className="text-3xl font-bold">{result.locationScore.total}</p>
          <p className={`text-lg font-bold ${gradeColor(result.locationScore.grade)}`}>{result.locationScore.grade}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Viability</p>
          <p className="text-3xl font-bold">{result.commercialViabilityScore.total}</p>
          <p className={`text-lg font-bold ${gradeColor(result.commercialViabilityScore.grade)}`}>{result.commercialViabilityScore.grade}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Clinic Fit</p>
          <p className="text-3xl font-bold">{result.clinicSuitabilityScore.total}</p>
          <p className={`text-lg font-bold ${gradeColor(result.clinicSuitabilityScore.grade)}`}>{result.clinicSuitabilityScore.grade}</p>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="w-full">
          <TabsTrigger value="summary" className="flex-1 text-xs">Executive Summary</TabsTrigger>
          <TabsTrigger value="location" className="flex-1 text-xs">Location</TabsTrigger>
          <TabsTrigger value="viability" className="flex-1 text-xs">Viability</TabsTrigger>
          <TabsTrigger value="clinic" className="flex-1 text-xs">Clinic Fit</TabsTrigger>
          <TabsTrigger value="competition" className="flex-1 text-xs">Competition</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-5 mt-4">
          <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
            <p className="text-sm leading-relaxed">{result.executiveSummary.overallVerdict}</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <h5 className="text-sm font-semibold text-primary">Strengths</h5>
              </div>
              <ul className="space-y-1">
                {result.executiveSummary.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-destructive" />
                <h5 className="text-sm font-semibold text-destructive">Weaknesses</h5>
              </div>
              <ul className="space-y-1">
                {result.executiveSummary.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-destructive" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h5 className="text-sm font-semibold text-amber-600 dark:text-amber-400">Risks</h5>
              </div>
              <ul className="space-y-1">
                {result.executiveSummary.risks.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <h5 className="text-sm font-semibold text-blue-600 dark:text-blue-400">Hidden Opportunities</h5>
              </div>
              <ul className="space-y-1">
                {result.executiveSummary.hiddenOpportunities.map((o, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-blue-500" />
                    {o}
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Likely Revenue Ceiling</p>
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
          </div>
        </TabsContent>

        <TabsContent value="location" className="mt-4">
          <ScoreCard
            score={result.locationScore}
            title="Location Score"
            icon={<MapPin className="w-4 h-4 text-primary" />}
          />
        </TabsContent>

        <TabsContent value="viability" className="mt-4">
          <ScoreCard
            score={result.commercialViabilityScore}
            title="Commercial Viability"
            icon={<PoundSterling className="w-4 h-4 text-primary" />}
          />
        </TabsContent>

        <TabsContent value="clinic" className="mt-4">
          <ScoreCard
            score={result.clinicSuitabilityScore}
            title="Clinic Suitability"
            icon={<Building className="w-4 h-4 text-primary" />}
          />
        </TabsContent>

        <TabsContent value="competition" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Competition Analysis</h4>
            <Badge variant="outline" className={`text-xs gap-1.5 ${
              result.competition.dataSource === "google_places"
                ? "border-primary/40 text-primary"
                : result.competition.dataSource === "manual"
                  ? "border-amber-500/40 text-amber-600"
                  : "border-muted-foreground/40 text-muted-foreground"
            }`}>
              {result.competition.dataSource === "google_places"
                ? <><MapPin className="w-3 h-3" /> Live Google Places data</>
                : result.competition.dataSource === "manual"
                  ? <><Building className="w-3 h-3" /> Manual competitor data</>
                  : <><Brain className="w-3 h-3" /> AI estimate</>
              }
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

          {result.competition.competitors.length > 0 && (
            <div className="space-y-3">
              <h5 className="text-sm font-semibold">Nearby Competitors</h5>
              {result.competition.competitors.map((c, i) => (
                <div key={i} className="flex items-start justify-between p-3 rounded-lg border bg-card gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.type}{c.distanceMeters ? ` · ${Math.round(c.distanceMeters)}m away` : ""}</p>
                    {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                  </div>
                  {"rating" in c && c.rating != null && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-medium">{c.rating}</span>
                      {"reviewCount" in c && c.reviewCount != null && <span className="text-xs text-muted-foreground">({c.reviewCount})</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {(result.competition.dataSource === "ai_estimate" || result.competition.dataSource === "manual") && (
            <ManualCompetitorForm
              propertyId={property.id}
              initialCompetitors={(property.manualCompetitors as ManualCompetitor[] | null) ?? []}
              onSaved={onCompetitorsSaved}
            />
          )}

          {result.competition.competitors.length === 0 && result.competition.dataSource === "google_places" && (
            <p className="text-sm text-muted-foreground text-center py-4">No competitors found within the search radius via Google Places.</p>
          )}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-right">
        Generated {new Date(result.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}

export default function PropertiesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<ClinicProperty | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [intelligenceTarget, setIntelligenceTarget] = useState<ClinicProperty | null>(null);
  const [intelligenceResult, setIntelligenceResult] = useState<PropertyIntelligenceResult | null>(null);
  const [extractionFlags, setExtractionFlags] = useState<string[]>([]);
  const [searchRadiusMeters, setSearchRadiusMeters] = useState(600);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);

  const { data: properties, isLoading } = useListProperties(PROJECT_ID, {
    query: { queryKey: getListPropertiesQueryKey(PROJECT_ID), enabled: true },
  });

  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  const uploadDocument = useUploadPropertyDocument();
  const analyseProperty = useAnalyseProperty();

  const handleOpenCreate = () => {
    setEditingProperty(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (prop: ClinicProperty) => {
    setEditingProperty(prop);
    setIsFormOpen(true);
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteProperty.mutate(
      { id: deletingId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
          setDeletingId(null);
        },
      }
    );
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      address: formData.get("address") as string,
      postcode: formData.get("postcode") as string,
      sqFootage: Number(formData.get("sqFootage") || 0),
      annualRentGbp: Number(formData.get("annualRentGbp") || 0),
      monthlyRentGbp: Number(formData.get("monthlyRentGbp") || 0),
      vatOnRent: formData.get("vatOnRent") === "on",
      businessRatesGbp: Number(formData.get("businessRatesGbp") || 0),
      serviceChargeGbp: Number(formData.get("serviceChargeGbp") || 0),
      leaseLength: formData.get("leaseLength") as string,
      useClass: formData.get("useClass") as string,
      availabilityDate: formData.get("availabilityDate") as string || undefined,
      parkingSpaces: Number(formData.get("parkingSpaces") || 0),
      frontageMeters: Number(formData.get("frontageMeters") || 0),
      agentName: formData.get("agentName") as string,
      agentPhone: formData.get("agentPhone") as string,
      agentEmail: formData.get("agentEmail") as string,
      status: formData.get("status") as UpdatePropertyBodyStatus,
      notes: formData.get("notes") as string,
    };

    if (editingProperty) {
      updateProperty.mutate(
        { id: editingProperty.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
            setIsFormOpen(false);
          },
        }
      );
    } else {
      createProperty.mutate(
        { projectId: PROJECT_ID, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
            setIsFormOpen(false);
          },
        }
      );
    }
  };

  const handleUploadClick = (propId: number) => {
    setUploadTargetId(propId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;
    e.target.value = "";

    uploadDocument.mutate(
      { id: uploadTargetId, data: { file } },
      {
        onSuccess: (data: PropertyExtraction) => {
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
          const flags = data.flags ?? [];
          setExtractionFlags(flags);
          toast({
            title: "Document processed",
            description: flags.length > 0
              ? `Fields extracted. ${flags.length} flag(s): ${flags[0]}`
              : "Property fields have been auto-populated from the document.",
          });
          setUploadTargetId(null);
        },
        onError: () => {
          toast({ title: "Upload failed", description: "Could not extract data from the document.", variant: "destructive" });
          setUploadTargetId(null);
        },
      }
    );
  };

  const handleAnalyse = (prop: ClinicProperty) => {
    setIntelligenceTarget(prop);
    setIntelligenceResult(null);

    analyseProperty.mutate(
      { id: prop.id, data: { searchRadiusMeters } },
      {
        onSuccess: (data) => {
          setIntelligenceResult(data);
        },
        onError: () => {
          toast({ title: "Analysis failed", description: "Could not run property analysis. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
        <div className="h-80 bg-card rounded-lg"></div>
        <div className="h-80 bg-card rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Property Intelligence</h2>
          <p className="text-muted-foreground mt-1">Evaluate and score potential clinic locations with AI.</p>
        </div>
        <Button onClick={handleOpenCreate}>Add Property</Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {properties?.map((prop) => (
          <Card key={prop.id} className={`shadow-sm flex flex-col ${prop.status === "rejected" ? "opacity-75 bg-muted/30" : ""}`}>
            <CardHeader className="pb-4 border-b">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold text-lg flex items-start gap-2">
                    <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <span className={prop.status === "rejected" ? "line-through" : ""}>{prop.address}</span>
                  </h3>
                  <p className="text-muted-foreground text-sm ml-7">{prop.postcode}</p>
                </div>
                <Badge variant="secondary" className={STATUS_COLORS[prop.status] || ""}>
                  {prop.status.replace("_", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 flex-1">
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <PoundSterling className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Monthly Rent</span>
                  </div>
                  <p className="font-medium text-lg">{formatGBP(prop.monthlyRentGbp)} {prop.vatOnRent && <span className="text-xs text-muted-foreground">+VAT</span>}</p>
                  <p className="text-xs text-muted-foreground">{formatGBP(prop.annualRentGbp)} / year</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Maximize2 className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Size</span>
                  </div>
                  <p className="font-medium text-lg">{prop.sqFootage?.toLocaleString()} sq ft</p>
                  <p className="text-xs text-muted-foreground">Class: {prop.useClass || "Unknown"}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Lease Details</span>
                  </div>
                  <p className="font-medium">{prop.leaseLength || "Negotiable"}</p>
                  <p className="text-xs text-muted-foreground">Avail: {prop.availabilityDate ? new Date(prop.availabilityDate).toLocaleDateString() : "TBD"}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Car className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Parking</span>
                  </div>
                  <p className="font-medium">{prop.parkingSpaces ? `${prop.parkingSpaces} spaces` : "None specified"}</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{prop.agentName || "Agent Unknown"}</span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground ml-6">
                  {prop.agentPhone && (
                    <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {prop.agentPhone}</div>
                  )}
                  {prop.agentEmail && (
                    <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {prop.agentEmail}</div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t p-4 flex justify-between items-center gap-2">
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleAnalyse(prop)}
                  disabled={analyseProperty.isPending && intelligenceTarget?.id === prop.id}
                  className="gap-1.5"
                >
                  {analyseProperty.isPending && intelligenceTarget?.id === prop.id
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing...</>
                    : <><Brain className="w-3.5 h-3.5" /> AI Analysis</>
                  }
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUploadClick(prop.id)}
                  disabled={uploadDocument.isPending && uploadTargetId === prop.id}
                  className="gap-1.5"
                >
                  {uploadDocument.isPending && uploadTargetId === prop.id
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                    : <><FileText className="w-3.5 h-3.5" /> Upload Doc</>
                  }
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleOpenEdit(prop)}>
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeletingId(prop.id)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}

        {(!properties || properties.length === 0) && (
          <div className="col-span-full py-12 text-center border border-dashed rounded-lg">
            <h3 className="text-lg font-medium">No properties added yet</h3>
            <p className="text-muted-foreground mt-1 mb-4">Start building your property pipeline.</p>
            <Button onClick={handleOpenCreate}>Add First Property</Button>
          </div>
        )}
      </div>

      {/* Intelligence Sheet */}
      <Sheet open={!!intelligenceTarget} onOpenChange={(open) => { if (!open) { setIntelligenceTarget(null); setIntelligenceResult(null); setExtractionFlags([]); } }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Property Intelligence Report
            </SheetTitle>
            <SheetDescription>
              {intelligenceTarget?.address} · {intelligenceTarget?.postcode}
            </SheetDescription>
          </SheetHeader>

          {!analyseProperty.isPending && !intelligenceResult && (
            <div className="rounded-lg border bg-muted/20 p-4 mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Competition search radius</p>
                  <p className="text-xs text-muted-foreground">Used for Google Places competitor mapping</p>
                </div>
                <span className="text-sm font-semibold text-primary">{searchRadiusMeters}m</span>
              </div>
              <div className="flex gap-2">
                {[200, 400, 600, 1000, 1500, 2000].map(r => (
                  <button
                    key={r}
                    onClick={() => setSearchRadiusMeters(r)}
                    className={`flex-1 text-xs py-1.5 rounded border transition-colors ${searchRadiusMeters === r ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"}`}
                  >
                    {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {extractionFlags.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 mb-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Extraction notes from document analysis</p>
              </div>
              <ul className="space-y-1 ml-6">
                {extractionFlags.map((flag, i) => (
                  <li key={i} className="text-xs text-amber-700 dark:text-amber-400 list-disc">{flag}</li>
                ))}
              </ul>
            </div>
          )}

          {analyseProperty.isPending && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Running AI analysis… this takes 10–20 seconds</p>
            </div>
          )}

          {analyseProperty.isError && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <XCircle className="w-10 h-10 text-destructive" />
              <p className="text-sm text-muted-foreground">Analysis failed. Please try again.</p>
              <Button onClick={() => intelligenceTarget && handleAnalyse(intelligenceTarget)}>Retry</Button>
            </div>
          )}

          {intelligenceResult && intelligenceTarget && (
            <IntelligencePanel
              result={intelligenceResult}
              property={intelligenceTarget}
              onCompetitorsSaved={(updated) => {
                setIntelligenceTarget(prev =>
                  prev ? { ...prev, manualCompetitors: updated } : prev
                );
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProperty ? "Edit Property" : "Add Property"}</DialogTitle>
            <DialogDescription>Enter the property details and agent contact information.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" defaultValue={editingProperty?.address || ""} required className="mt-1" />
              </div>

              <div>
                <Label htmlFor="postcode">Postcode</Label>
                <Input id="postcode" name="postcode" defaultValue={editingProperty?.postcode || ""} required className="mt-1" />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={editingProperty?.status || "viewing"}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewing">Viewing</SelectItem>
                    <SelectItem value="shortlisted">Shortlisted</SelectItem>
                    <SelectItem value="offer_made">Offer Made</SelectItem>
                    <SelectItem value="under_offer">Under Offer</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="active">Active (Secured)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
              <h4 className="font-semibold text-sm">Financials & Specs</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="monthlyRentGbp">Monthly Rent (£)</Label>
                  <Input id="monthlyRentGbp" name="monthlyRentGbp" type="number" defaultValue={editingProperty?.monthlyRentGbp || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="annualRentGbp">Annual Rent (£)</Label>
                  <Input id="annualRentGbp" name="annualRentGbp" type="number" defaultValue={editingProperty?.annualRentGbp || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="businessRatesGbp">Business Rates (£/yr)</Label>
                  <Input id="businessRatesGbp" name="businessRatesGbp" type="number" defaultValue={editingProperty?.businessRatesGbp || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="serviceChargeGbp">Service Charge (£/yr)</Label>
                  <Input id="serviceChargeGbp" name="serviceChargeGbp" type="number" defaultValue={editingProperty?.serviceChargeGbp || ""} className="mt-1" />
                </div>
                <div className="col-span-2 flex items-center justify-between p-3 border rounded bg-card mt-2">
                  <Label htmlFor="vatOnRent" className="mb-0">VAT applicable on rent?</Label>
                  <Switch id="vatOnRent" name="vatOnRent" defaultChecked={editingProperty?.vatOnRent || false} />
                </div>

                <div>
                  <Label htmlFor="sqFootage">Square Footage</Label>
                  <Input id="sqFootage" name="sqFootage" type="number" defaultValue={editingProperty?.sqFootage || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="useClass">Use Class (e.g. E)</Label>
                  <Input id="useClass" name="useClass" defaultValue={editingProperty?.useClass || ""} className="mt-1" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="leaseLength">Lease Length</Label>
                <Input id="leaseLength" name="leaseLength" defaultValue={editingProperty?.leaseLength || ""} placeholder="e.g. 5 years with 3 yr break" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="availabilityDate">Availability Date</Label>
                <Input id="availabilityDate" name="availabilityDate" type="date" defaultValue={editingProperty?.availabilityDate ? new Date(editingProperty.availabilityDate).toISOString().split("T")[0] : ""} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="parkingSpaces">Parking Spaces</Label>
                <Input id="parkingSpaces" name="parkingSpaces" type="number" defaultValue={editingProperty?.parkingSpaces || ""} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="frontageMeters">Frontage (meters)</Label>
                <Input id="frontageMeters" name="frontageMeters" type="number" step="0.1" defaultValue={editingProperty?.frontageMeters || ""} className="mt-1" />
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
              <h4 className="font-semibold text-sm">Agent Contact</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="agentName">Agent/Agency Name</Label>
                  <Input id="agentName" name="agentName" defaultValue={editingProperty?.agentName || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="agentPhone">Phone</Label>
                  <Input id="agentPhone" name="agentPhone" defaultValue={editingProperty?.agentPhone || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="agentEmail">Email</Label>
                  <Input id="agentEmail" name="agentEmail" type="email" defaultValue={editingProperty?.agentEmail || ""} className="mt-1" />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={editingProperty?.notes || ""} className="mt-1 h-24" placeholder="Condition, potential layout issues, negotiation status..." />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createProperty.isPending || updateProperty.isPending}>
                {editingProperty ? "Save Changes" : "Add Property"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the property record from your pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Property
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
