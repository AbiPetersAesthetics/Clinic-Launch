import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDecisions,
  getListDecisionsQueryKey,
  useCreateDecision,
  useUpdateDecision,
  useDeleteDecision,
} from "@workspace/api-client-react";
import type { Decision, CreateDecisionBody } from "@workspace/api-client-react";
import { formatGBP } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, TrendingUp, TrendingDown, Minus, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";

const PROJECT_ID = 1;

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "property", label: "Property" },
  { value: "financial", label: "Financial" },
  { value: "build", label: "Build" },
  { value: "clinical", label: "Clinical" },
  { value: "marketing", label: "Marketing" },
  { value: "general", label: "General" },
];

const CATEGORY_COLORS: Record<string, string> = {
  property: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  financial: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  build: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  clinical: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  marketing: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
  general: "bg-muted text-muted-foreground",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const EMPTY_FORM: CreateDecisionBody = {
  title: "",
  reasoning: "",
  expectedImpact: "",
  financialImpactGbp: 0,
  category: "general",
};

export default function DecisionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null);
  const [form, setForm] = useState<CreateDecisionBody>({ ...EMPTY_FORM });
  const [deleteTarget, setDeleteTarget] = useState<Decision | null>(null);

  const params = {
    ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };

  const { data: decisions = [], isLoading } = useListDecisions(PROJECT_ID, params, {
    query: {
      queryKey: getListDecisionsQueryKey(PROJECT_ID, params),
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListDecisionsQueryKey(PROJECT_ID, {}) });
    queryClient.invalidateQueries({ queryKey: ["/projects", PROJECT_ID, "decisions"] });
    // Invalidate all potential list-decision cache variations
    queryClient.invalidateQueries({ predicate: (q) => JSON.stringify(q.queryKey).includes("decisions") });
  };

  const createMutation = useCreateDecision({
    mutation: {
      onSuccess: () => {
        invalidate();
        setSheetOpen(false);
        toast({ title: "Decision logged" });
      },
    },
  });

  const updateMutation = useUpdateDecision({
    mutation: {
      onSuccess: () => {
        invalidate();
        setSheetOpen(false);
        setEditingDecision(null);
        toast({ title: "Decision updated" });
      },
    },
  });

  const deleteMutation = useDeleteDecision({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeleteTarget(null);
        toast({ title: "Decision removed" });
      },
    },
  });

  function openNew() {
    setEditingDecision(null);
    setForm({ ...EMPTY_FORM });
    setSheetOpen(true);
  }

  function openEdit(d: Decision) {
    setEditingDecision(d);
    setForm({
      title: d.title,
      reasoning: d.reasoning,
      expectedImpact: d.expectedImpact ?? "",
      financialImpactGbp: d.financialImpactGbp,
      category: d.category as CreateDecisionBody["category"],
    });
    setSheetOpen(true);
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.reasoning.trim()) {
      toast({ title: "Title and reasoning are required", variant: "destructive" });
      return;
    }
    if (editingDecision) {
      updateMutation.mutate({ id: editingDecision.id, data: form });
    } else {
      createMutation.mutate({ projectId: PROJECT_ID, data: form });
    }
  }

  const totalFinancialImpact = decisions.reduce((sum, d) => sum + d.financialImpactGbp, 0);
  const positiveDecisions = decisions.filter(d => d.financialImpactGbp > 0).length;
  const negativeDecisions = decisions.filter(d => d.financialImpactGbp < 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decision Log"
        subtitle="Record and track strategic decisions throughout your clinic launch."
        action={
          <Button onClick={openNew} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Log Decision
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Decisions</p>
            <p className="text-2xl font-semibold mt-1 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {decisions.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Net Financial Impact</p>
            <p className={`text-2xl font-semibold mt-1 ${totalFinancialImpact >= 0 ? "text-primary" : "text-destructive"}`}>
              {totalFinancialImpact >= 0 ? "+" : ""}{formatGBP(totalFinancialImpact)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Positive Impact</p>
            <p className="text-2xl font-semibold mt-1 flex items-center gap-2 text-primary">
              <TrendingUp className="w-5 h-5" />
              {positiveDecisions}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Negative Impact</p>
            <p className="text-2xl font-semibold mt-1 flex items-center gap-2 text-destructive">
              <TrendingDown className="w-5 h-5" />
              {negativeDecisions}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search decisions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : decisions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No decisions logged yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Click "Log Decision" to start recording your strategic decisions.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[18px] top-6 bottom-6 w-px bg-border hidden sm:block" />
          <div className="space-y-3">
            {decisions.map((d) => (
              <div key={d.id} className="flex gap-4 group">
                {/* Timeline dot */}
                <div className="hidden sm:flex items-start pt-4 shrink-0">
                  <div className="w-[9px] h-[9px] rounded-full bg-primary border-2 border-background ring-1 ring-primary mt-1" />
                </div>
                <Card className="flex-1 transition-shadow hover:shadow-md">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[d.category] ?? CATEGORY_COLORS.general}`}>
                            {d.category}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">{formatDate(d.createdAt)}</span>
                          {d.financialImpactGbp !== 0 && (
                            <span className={`text-[11px] font-medium flex items-center gap-0.5 ${d.financialImpactGbp > 0 ? "text-primary" : "text-destructive"}`}>
                              {d.financialImpactGbp > 0 ? <TrendingUp className="w-3 h-3" /> : d.financialImpactGbp < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                              {d.financialImpactGbp > 0 ? "+" : ""}{formatGBP(d.financialImpactGbp)}
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium text-sm leading-snug">{d.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{d.reasoning}</p>
                        {d.expectedImpact && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            <span className="font-medium text-foreground">Expected:</span> {d.expectedImpact}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(d)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingDecision ? "Edit Decision" : "Log a Decision"}</SheetTitle>
            <SheetDescription>
              {editingDecision
                ? "Update this strategic decision."
                : "Record a key decision and the reasoning behind it."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Selected Unit 4 Harley Street for clinic build"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div>
              <Label>Category</Label>
              <Select
                value={form.category ?? "general"}
                onValueChange={v => setForm(f => ({ ...f, category: v as CreateDecisionBody["category"] }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter(c => c.value !== "all").map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reasoning *</Label>
              <Textarea
                className="mt-1"
                rows={4}
                placeholder="Why was this decision made? What factors were considered?"
                value={form.reasoning}
                onChange={e => setForm(f => ({ ...f, reasoning: e.target.value }))}
              />
            </div>

            <div>
              <Label>Expected Impact</Label>
              <Textarea
                className="mt-1"
                rows={2}
                placeholder="What outcome do you expect from this decision?"
                value={form.expectedImpact ?? ""}
                onChange={e => setForm(f => ({ ...f, expectedImpact: e.target.value }))}
              />
            </div>

            <div>
              <Label>Financial Impact (£)</Label>
              <Input
                className="mt-1"
                type="number"
                step="100"
                placeholder="0"
                value={form.financialImpactGbp ?? 0}
                onChange={e => setForm(f => ({ ...f, financialImpactGbp: parseFloat(e.target.value) || 0 }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Positive = saving or revenue, Negative = additional cost</p>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingDecision ? "Save Changes" : "Log Decision"}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Decision?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.title}" from the decision log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
