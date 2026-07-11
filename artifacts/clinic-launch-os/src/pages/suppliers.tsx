import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useListSuppliers,
  useGetSuppliersSummary,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useCreateQuote,
  useUpdateQuote,
  useDeleteQuote,
  getListSuppliersQueryKey,
  getGetSuppliersSummaryQueryKey,
  useGetPhasesWithTasks,
} from "@workspace/api-client-react";
import type { Supplier, SupplierQuote, PhaseWithTasks } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingBag, Plus, Search, Star, StarOff, Trash2, ChevronDown,
  ChevronUp, Phone, Mail, Globe, Edit2, PoundSterling, Check, X,
  Building2, Package, Scale, ShieldCheck, Megaphone, Cpu, Palette,
  Zap, HelpCircle, FileText, AlertTriangle, TrendingUp, Loader2,
} from "lucide-react";

const PROJECT_ID = 1;

// New tender-tracking + AI-credentials fields (served by the API but not yet in
// the generated client type, so augmented locally).
type SupplierExtra = {
  responded?: boolean | null;
  tenderAccepted?: boolean | null;
  visitBooked?: boolean | null;
  visited?: boolean | null;
  visitDate?: string | null;
  credentialsReview?: string | null;
  credentialsScore?: number | null;
  credentialsReviewedAt?: string | null;
};
function scoreColor(n: number) {
  return n >= 75 ? "bg-emerald-100 text-emerald-800"
    : n >= 50 ? "bg-amber-100 text-amber-800"
    : "bg-red-100 text-red-700";
}

const SUPPLIER_CATEGORIES = [
  "Fit-Out & Construction",
  "Medical Equipment",
  "IT & Software",
  "Legal & Professional",
  "Insurance",
  "Marketing & Branding",
  "Consumables & Products",
  "Furniture & Interiors",
  "Utilities & Services",
  "Other",
] as const;

const SUPPLIER_STATUSES = ["Researching", "Contacted", "Quoted", "Tender", "Contracted", "Rejected"] as const;
const QUOTE_STATUSES = ["Requested", "Received", "Shortlisted", "Accepted", "Rejected"] as const;

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Fit-Out & Construction": Building2,
  "Medical Equipment": Cpu,
  "IT & Software": Zap,
  "Legal & Professional": Scale,
  "Insurance": ShieldCheck,
  "Marketing & Branding": Megaphone,
  "Consumables & Products": Package,
  "Furniture & Interiors": Palette,
  "Utilities & Services": Zap,
  "Other": HelpCircle,
};

const STATUS_COLORS: Record<string, string> = {
  Researching: "bg-slate-100 text-slate-700",
  Contacted: "bg-blue-50 text-blue-700",
  Quoted: "bg-amber-50 text-amber-700",
  Tender: "bg-purple-50 text-purple-700",
  Contracted: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-600",
};

const QUOTE_STATUS_COLORS: Record<string, string> = {
  Requested: "bg-slate-100 text-slate-600",
  Received: "bg-blue-50 text-blue-700",
  Shortlisted: "bg-amber-50 text-amber-700",
  Accepted: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-600",
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function parseAmount(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─── Supplier Form ────────────────────────────────────────────────────────────

interface SupplierFormData {
  name: string;
  category: string;
  contactName: string;
  phone: string;
  email: string;
  website: string;
  notes: string;
  status: string;
}

const BLANK_SUPPLIER: SupplierFormData = {
  name: "", category: "Other", contactName: "", phone: "", email: "",
  website: "", notes: "", status: "Researching",
};

interface SupplierModalProps {
  open: boolean;
  onClose: () => void;
  existing?: Supplier;
  projectId: number;
}

function SupplierModal({ open, onClose, existing, projectId }: SupplierModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<SupplierFormData>(
    existing
      ? {
          name: existing.name,
          category: existing.category,
          contactName: existing.contactName ?? "",
          phone: existing.phone ?? "",
          email: existing.email ?? "",
          website: existing.website ?? "",
          notes: existing.notes ?? "",
          status: existing.status,
        }
      : BLANK_SUPPLIER
  );

  const createMut = useCreateSupplier({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSuppliersQueryKey(projectId) });
        qc.invalidateQueries({ queryKey: getGetSuppliersSummaryQueryKey(projectId) });
        toast({ title: "Supplier added" });
        onClose();
      },
    },
  });

  const updateMut = useUpdateSupplier({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSuppliersQueryKey(projectId) });
        qc.invalidateQueries({ queryKey: getGetSuppliersSummaryQueryKey(projectId) });
        toast({ title: "Supplier updated" });
        onClose();
      },
    },
  });

  const isLoading = createMut.isPending || updateMut.isPending;

  function handleSave() {
    if (!form.name.trim()) return;
    if (existing) {
      updateMut.mutate({ id: existing.id, data: form });
    } else {
      createMut.mutate({ projectId, data: form });
    }
  }

  const set = (key: keyof SupplierFormData, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Supplier / Company Name *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Winchester Shopfitters Ltd" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPLIER_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPLIER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contact Name</Label>
              <Input value={form.contactName} onChange={e => set("contactName", e.target.value)} placeholder="Name" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="07..." />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://..." />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any notes about this supplier..." rows={3} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLoading || !form.name.trim()}>
            {isLoading ? "Saving..." : existing ? "Save Changes" : "Add Supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Quote Form ───────────────────────────────────────────────────────────────

interface QuoteFormData {
  description: string;
  amountGbp: string;
  vatIncluded: boolean;
  validUntil: string;
  status: string;
  notes: string;
  receivedAt: string;
  taskId: number | null;
}

const BLANK_QUOTE: QuoteFormData = {
  description: "", amountGbp: "", vatIncluded: false,
  validUntil: "", status: "Received", notes: "", receivedAt: "", taskId: null,
};

interface QuoteModalProps {
  open: boolean;
  onClose: () => void;
  supplierId: number;
  projectId: number;
  existing?: SupplierQuote;
  allTasks?: { id: number; title: string; phaseName: string }[];
}

function QuoteModal({ open, onClose, supplierId, projectId, existing, allTasks = [] }: QuoteModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<QuoteFormData>(
    existing
      ? {
          description: existing.description,
          amountGbp: existing.amountGbp ?? "",
          vatIncluded: existing.vatIncluded,
          validUntil: existing.validUntil ?? "",
          status: existing.status,
          notes: existing.notes ?? "",
          receivedAt: existing.receivedAt ?? "",
          taskId: (existing as SupplierQuote & { taskId?: number | null }).taskId ?? null,
        }
      : BLANK_QUOTE
  );

  const createMut = useCreateQuote({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSuppliersQueryKey(projectId) });
        qc.invalidateQueries({ queryKey: getGetSuppliersSummaryQueryKey(projectId) });
        toast({ title: "Quote added" });
        onClose();
      },
    },
  });

  const updateMut = useUpdateQuote({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSuppliersQueryKey(projectId) });
        qc.invalidateQueries({ queryKey: getGetSuppliersSummaryQueryKey(projectId) });
        toast({ title: "Quote updated" });
        onClose();
      },
    },
  });

  const isLoading = createMut.isPending || updateMut.isPending;

  function handleSave() {
    if (!form.description.trim()) return;
    const payload = {
      description: form.description.trim(),
      amountGbp: form.amountGbp ? parseFloat(form.amountGbp) : null,
      vatIncluded: form.vatIncluded,
      validUntil: form.validUntil || null,
      status: form.status,
      notes: form.notes,
      receivedAt: form.receivedAt || null,
      taskId: form.taskId ?? null,
    };
    if (existing) {
      updateMut.mutate({ id: existing.id, data: payload });
    } else {
      createMut.mutate({ id: supplierId, data: payload });
    }
  }

  const set = (key: keyof QuoteFormData, value: string | boolean) =>
    setForm(f => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Quote" : "Add Quote"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Description *</Label>
            <Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="e.g. Full fit-out inc. electrics and plumbing" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount (£)</Label>
              <Input type="number" value={form.amountGbp} onChange={e => set("amountGbp", e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUOTE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date Received</Label>
              <Input type="date" value={form.receivedAt} onChange={e => set("receivedAt", e.target.value)} />
            </div>
            <div>
              <Label>Valid Until</Label>
              <Input type="date" value={form.validUntil} onChange={e => set("validUntil", e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="vatIncluded"
              checked={form.vatIncluded}
              onChange={e => set("vatIncluded", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="vatIncluded" className="cursor-pointer">Amount includes VAT</Label>
          </div>
          {allTasks.length > 0 && (
            <div>
              <Label>Link to Project Task (optional)</Label>
              <Select
                value={form.taskId?.toString() ?? "none"}
                onValueChange={v => setForm(f => ({ ...f, taskId: v === "none" ? null : parseInt(v) }))}
              >
                <SelectTrigger><SelectValue placeholder="No task linked" /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="none">No task linked</SelectItem>
                  {allTasks.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      <span className="text-xs text-muted-foreground mr-1">{t.phaseName} ·</span>{t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any notes about this quote..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLoading || !form.description.trim()}>
            {isLoading ? "Saving..." : existing ? "Save Changes" : "Add Quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Quote Row ────────────────────────────────────────────────────────────────

function QuoteRow({ quote, projectId, onEdit, allTasks = [] }: { quote: SupplierQuote; projectId: number; onEdit: (q: SupplierQuote) => void; allTasks?: { id: number; title: string; phaseName: string }[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const delMut = useDeleteQuote({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSuppliersQueryKey(projectId) });
        qc.invalidateQueries({ queryKey: getGetSuppliersSummaryQueryKey(projectId) });
        toast({ title: "Quote removed" });
      },
    },
  });

  const amount = parseAmount(quote.amountGbp);

  return (
    <div className="flex items-start gap-3 py-2 px-3 rounded bg-slate-50 border border-slate-100">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800 truncate">{quote.description}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${QUOTE_STATUS_COLORS[quote.status] ?? "bg-slate-100 text-slate-600"}`}>
            {quote.status}
          </span>
          {quote.vatIncluded && (
            <span className="text-xs text-slate-400">inc. VAT</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {amount != null && (
            <span className="text-sm font-semibold text-slate-900">{fmt(amount)}</span>
          )}
          {quote.receivedAt && (
            <span className="text-xs text-slate-400">Received {new Date(quote.receivedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}</span>
          )}
          {quote.validUntil && (
            <span className="text-xs text-slate-400">Valid until {new Date(quote.validUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}</span>
          )}
        </div>
        {(quote as SupplierQuote & { taskId?: number | null }).taskId != null && (() => {
          const linkedTask = allTasks.find(t => t.id === (quote as SupplierQuote & { taskId?: number | null }).taskId);
          return linkedTask ? (
            <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
              <span className="text-slate-400">→</span> Project: {linkedTask.title}
            </p>
          ) : null;
        })()}
        {quote.notes && <p className="text-xs text-slate-500 mt-0.5">{quote.notes}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600" onClick={() => onEdit(quote)}>
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost" size="sm"
          className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
          onClick={() => delMut.mutate({ id: quote.id })}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Supplier Card ────────────────────────────────────────────────────────────

function SupplierCard({
  supplier, projectId, onEdit, allTasks = [],
}: { supplier: Supplier; projectId: number; onEdit: (s: Supplier) => void; allTasks?: { id: number; title: string; phaseName: string }[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [addingQuote, setAddingQuote] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [editingQuote, setEditingQuote] = useState<SupplierQuote | null>(null);
  const sx = supplier as Supplier & SupplierExtra;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewErr, setReviewErr] = useState<string | null>(null);

  const patchSupplier = async (data: Record<string, unknown>) => {
    const r = await fetch(`/api/suppliers/${supplier.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (r.ok) qc.invalidateQueries({ queryKey: getListSuppliersQueryKey(projectId) });
  };
  const runCredentials = async (force = false) => {
    setReviewing(true); setReviewErr(null);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 300_000);
      const r = await fetch(`/api/suppliers/${supplier.id}/review-credentials`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }), signal: ctrl.signal,
      });
      clearTimeout(timer);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Review failed");
      await qc.invalidateQueries({ queryKey: getListSuppliersQueryKey(projectId) });
      setReviewOpen(true);
    } catch (e) {
      setReviewErr(e instanceof Error ? (e.name === "AbortError" ? "Timed out — try again." : e.message) : "Review failed");
    } finally { setReviewing(false); }
  };

  const delMut = useDeleteSupplier({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSuppliersQueryKey(projectId) });
        qc.invalidateQueries({ queryKey: getGetSuppliersSummaryQueryKey(projectId) });
        toast({ title: "Supplier removed" });
      },
    },
  });

  const toggleFavMut = useUpdateSupplier({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListSuppliersQueryKey(projectId) }),
    },
  });

  const Icon = CATEGORY_ICONS[supplier.category] ?? HelpCircle;
  const quotes = supplier.quotes ?? [];
  const acceptedQuote = quotes.find(q => q.status === "Accepted");
  const totalAmount = quotes.filter(q => q.status !== "Rejected").reduce((s, q) => s + (parseAmount(q.amountGbp) ?? 0), 0);
  const acceptedAmount = parseAmount(acceptedQuote?.amountGbp ?? null);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Icon className="w-4.5 h-4.5 text-slate-600" style={{ width: 18, height: 18 }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900 text-sm leading-tight">{supplier.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[supplier.status] ?? "bg-slate-100 text-slate-600"}`}>
                {supplier.status}
              </span>
              {supplier.status === "Contracted" && (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{supplier.category}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost" size="sm"
              className={`h-7 w-7 p-0 ${supplier.isFavourited ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}
              onClick={() => toggleFavMut.mutate({ id: supplier.id, data: { isFavourited: !supplier.isFavourited } })}
            >
              {supplier.isFavourited ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600" onClick={() => onEdit(supplier)}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-slate-300 hover:text-red-500"
              onClick={() => { if (confirm(`Remove ${supplier.name}?`)) delMut.mutate({ id: supplier.id }); }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Contact row */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {supplier.contactName && (
            <span className="text-xs text-slate-600">{supplier.contactName}</span>
          )}
          {supplier.phone && (
            <a href={`tel:${supplier.phone}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
              <Phone className="w-3 h-3" />{supplier.phone}
            </a>
          )}
          {supplier.email && (
            <a href={`mailto:${supplier.email}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
              <Mail className="w-3 h-3" />{supplier.email}
            </a>
          )}
          {supplier.website && (
            <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
              <Globe className="w-3 h-3" />Website
            </a>
          )}
        </div>

        {supplier.notes && (
          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{supplier.notes}</p>
        )}

        {/* Quote summary row */}
        <div className="flex items-center gap-3 mt-2.5">
          {acceptedAmount != null ? (
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">{fmt(acceptedAmount)} accepted</span>
            </div>
          ) : totalAmount > 0 ? (
            <div className="flex items-center gap-1.5">
              <PoundSterling className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">{fmt(totalAmount)} in pipeline</span>
            </div>
          ) : null}
          {quotes.length > 0 && (
            <button
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-0.5 ml-auto"
              onClick={() => setExpanded(e => !e)}
            >
              {quotes.length} quote{quotes.length !== 1 ? "s" : ""}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {quotes.length >= 2 && (
            <Button
              variant="ghost" size="sm"
              className="h-6 text-xs gap-1 text-slate-500 hover:text-slate-700"
              onClick={() => setComparing(true)}
            >
              <Zap className="w-3 h-3" />Compare
            </Button>
          )}
          <Button
            variant="ghost" size="sm"
            className="h-6 text-xs gap-1 text-slate-500 hover:text-slate-700 ml-auto"
            onClick={() => { setExpanded(true); setAddingQuote(true); }}
          >
            <Plus className="w-3 h-3" />Quote
          </Button>
        </div>

        {/* Tender tracking: responded, visit, AI credentials */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2">
          {([
            ["responded", "Responded"],
            ["tenderAccepted", "Tender accepted"],
            ["visitBooked", "Visit booked"],
            ["visited", "Visited"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input type="checkbox" className="rounded border-slate-300" checked={!!sx[key]}
                onChange={e => patchSupplier({ [key]: e.target.checked })} />
              {label}
            </label>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>Visit date</span>
            <Input type="date" className="h-7 text-xs w-[9.5rem]" value={sx.visitDate ?? ""}
              onChange={e => patchSupplier({ visitDate: e.target.value || null })} />
          </label>
          <div className="ml-auto flex items-center gap-2">
            {sx.credentialsScore != null && (
              <button onClick={() => setReviewOpen(o => !o)}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${scoreColor(sx.credentialsScore)}`}>
                Credentials {sx.credentialsScore}/100
              </button>
            )}
            {!sx.credentialsReview ? (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={reviewing} onClick={() => runCredentials(false)}>
                {reviewing ? <><Loader2 className="w-3 h-3 animate-spin" />Researching…</> : <><ShieldCheck className="w-3 h-3" />Review credentials</>}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-slate-500" onClick={() => setReviewOpen(o => !o)}>
                {reviewOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}Review
              </Button>
            )}
          </div>
        </div>
        {reviewErr && <p className="text-xs text-red-600 mt-1">{reviewErr}</p>}
        {reviewOpen && sx.credentialsReview && (
          <div className="mt-2 bg-slate-50 border border-slate-200 rounded-md p-3">
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                AI credentials review{sx.credentialsReviewedAt ? ` · ${new Date(sx.credentialsReviewedAt).toLocaleDateString("en-GB")}` : ""}
              </span>
              <button className="text-[11px] text-slate-400 hover:text-slate-600 disabled:opacity-50" disabled={reviewing} onClick={() => runCredentials(true)}>
                {reviewing ? "…" : "Refresh"}
              </button>
            </div>
            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{sx.credentialsReview}</p>
          </div>
        )}
      </div>

      {/* Quotes list */}
      {expanded && quotes.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-slate-100 pt-3">
          {quotes.map(q => (
            <QuoteRow key={q.id} quote={q} projectId={projectId} onEdit={setEditingQuote} allTasks={allTasks} />
          ))}
        </div>
      )}

      {/* Modals */}
      {addingQuote && (
        <QuoteModal
          open
          onClose={() => setAddingQuote(false)}
          supplierId={supplier.id}
          projectId={projectId}
          allTasks={allTasks}
        />
      )}
      {editingQuote && (
        <QuoteModal
          open
          onClose={() => setEditingQuote(null)}
          supplierId={supplier.id}
          projectId={projectId}
          existing={editingQuote}
          allTasks={allTasks}
        />
      )}
      {comparing && (
        <QuoteCompareDialog
          supplier={supplier}
          quotes={quotes}
          projectId={projectId}
          onClose={() => setComparing(false)}
        />
      )}
    </div>
  );
}

// ─── Quote comparison dialog (AI review) ─────────────────────────────────────

type QuoteReview = {
  summary?: string;
  perQuote?: { id?: number; label?: string; read?: string; concerns?: string[] }[];
  outliers?: string[];
  missingInfo?: string[];
  questionsToAsk?: string[];
  negotiationAngles?: string[];
  suggestedNextStep?: string;
};

function QuoteCompareDialog({ supplier, quotes, projectId, onClose }: {
  supplier: Supplier & { quotes?: SupplierQuote[] };
  quotes: SupplierQuote[];
  projectId: number;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<QuoteReview | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 300_000);
      const r = await fetch(`/api/projects/${projectId}/suppliers/${supplier.id}/quote-review`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      });
      clearTimeout(timer);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Review failed");
      setReview(j.review as QuoteReview);
    } catch (e) {
      setError(e instanceof Error ? (e.name === "AbortError" ? "Review timed out — please try again." : e.message) : "Review failed");
    } finally {
      setLoading(false);
    }
  };

  const ReviewList = ({ heading, items }: { heading: string; items?: string[] }) =>
    items?.length ? (
      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{heading}</h4>
        <ul className="list-disc pl-5 mt-1.5 space-y-1 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </div>
    ) : null;

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare quotes — {supplier.name}</DialogTitle>
        </DialogHeader>

        <div className="border border-border rounded-md divide-y divide-border">
          {quotes.map(q => (
            <div key={q.id} className="px-3 py-2 flex items-center gap-3 text-sm">
              <span className="flex-1 min-w-0 truncate">{q.description}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">{q.status}</Badge>
              <span className="font-semibold tabular-nums shrink-0">
                {q.amountGbp != null ? `£${Number(q.amountGbp).toLocaleString()}` : "—"}
              </span>
            </div>
          ))}
        </div>

        {!review && (
          <div className="mt-2">
            {error && <p className="text-sm text-destructive mb-2">{error}</p>}
            <Button onClick={run} disabled={loading} className="w-full">
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reviewing quotes… (1–2 minutes)</>
                : <><Zap className="w-4 h-4 mr-2" />Run AI review</>}
            </Button>
          </div>
        )}

        {review && (
          <div>
            {review.summary && <p className="text-sm leading-relaxed">{review.summary}</p>}

            {!!review.perQuote?.length && (
              <div className="mt-4 space-y-2.5">
                {review.perQuote.map((pq, i) => (
                  <div key={i} className="border border-border rounded-md p-3">
                    <p className="text-sm font-semibold">{pq.label}</p>
                    {pq.read && <p className="text-sm text-muted-foreground mt-0.5">{pq.read}</p>}
                    {!!pq.concerns?.length && (
                      <ul className="list-disc pl-5 mt-1 text-xs text-destructive space-y-0.5">
                        {pq.concerns.map((c, j) => <li key={j}>{c}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            <ReviewList heading="Outliers" items={review.outliers} />
            <ReviewList heading="Missing information" items={review.missingInfo} />
            <ReviewList heading="Questions to ask" items={review.questionsToAsk} />
            <ReviewList heading="Negotiation angles" items={review.negotiationAngles} />

            {review.suggestedNextStep && (
              <div className="mt-4 bg-accent rounded-md p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider">Suggested next step</h4>
                <p className="text-sm mt-1">{review.suggestedNextStep}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [bulkReviewing, setBulkReviewing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const qc = useQueryClient();

  const { data: suppliers = [], isLoading } = useListSuppliers(PROJECT_ID);
  const { data: summary } = useGetSuppliersSummary(PROJECT_ID);
  const { data: phases = [] } = useGetPhasesWithTasks(PROJECT_ID);
  const allTasks = useMemo(() =>
    (phases as PhaseWithTasks[]).flatMap(p =>
      (p.tasks ?? []).map(t => ({ id: t.id, title: t.title, phaseName: p.name }))
    ),
    [phases],
  );

  const categories = useMemo(() => {
    const cats = new Set(suppliers.map(s => s.category));
    return ["All", ...SUPPLIER_CATEGORIES.filter(c => cats.has(c))];
  }, [suppliers]);

  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      if (showFavOnly && !s.isFavourited) return false;
      if (selectedCategory !== "All" && s.category !== selectedCategory) return false;
      if (selectedStatus !== "All" && s.status !== selectedStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.contactName?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.notes?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [suppliers, search, selectedCategory, selectedStatus, showFavOnly]);

  // Group by category for display
  const grouped = useMemo(() => {
    if (selectedCategory !== "All") return { [selectedCategory]: filtered };
    const g: Record<string, Supplier[]> = {};
    for (const s of filtered) {
      if (!g[s.category]) g[s.category] = [];
      g[s.category].push(s);
    }
    return g;
  }, [filtered, selectedCategory]);

  const categoryOrder = SUPPLIER_CATEGORIES as readonly string[];
  const sortedGroupKeys = Object.keys(grouped).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  const committedGbp = summary?.totalCommittedGbp ?? 0;
  const pipelineGbp = summary?.totalPipelineGbp ?? 0;

  const pendingReview = (suppliers as (Supplier & SupplierExtra)[]).filter(s => !s.credentialsReview);
  const reviewAll = async () => {
    if (!pendingReview.length) return;
    setBulkReviewing(true);
    setBulkProgress({ done: 0, total: pendingReview.length });
    for (let i = 0; i < pendingReview.length; i++) {
      try {
        await fetch(`/api/suppliers/${pendingReview[i].id}/review-credentials`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
        });
      } catch { /* keep going — each result is saved server-side as it completes */ }
      setBulkProgress({ done: i + 1, total: pendingReview.length });
      await qc.invalidateQueries({ queryKey: getListSuppliersQueryKey(PROJECT_ID) });
    }
    setBulkReviewing(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <ShoppingBag className="w-7 h-7 text-slate-600" />
            Suppliers & Procurement
          </h1>
          <p className="text-sm text-slate-500 mt-1 uppercase tracking-wide font-medium">
            Track quotes, contractors, and procurement for the clinic launch
          </p>
        </div>
        <div className="shrink-0 flex gap-2 flex-wrap justify-end">
          {pendingReview.length > 0 && (
            <Button variant="outline" className="gap-2" disabled={bulkReviewing} onClick={reviewAll}>
              {bulkReviewing
                ? <><Loader2 className="w-4 h-4 animate-spin" />Reviewing {bulkProgress?.done ?? 0}/{bulkProgress?.total ?? 0}</>
                : <><ShieldCheck className="w-4 h-4" />AI review all ({pendingReview.length})</>}
            </Button>
          )}
          <Link href="/tenders">
            <Button variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />Tender Pack
            </Button>
          </Link>
          <Button onClick={() => setAddingSupplier(true)} className="gap-2">
            <Plus className="w-4 h-4" />Add Supplier
          </Button>
        </div>
      </div>

      {/* KPI bar */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Suppliers</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalSuppliers}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Contracted</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.contractedCount}</p>
          </div>
          <div className={`rounded-xl p-4 border ${committedGbp > 0 ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Committed Spend</p>
            <p className={`text-2xl font-bold mt-1 ${committedGbp > 0 ? "text-emerald-700" : "text-slate-900"}`}>{fmt(committedGbp)}</p>
          </div>
          <div className={`rounded-xl p-4 border ${pipelineGbp > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Pipeline (Quoted)</p>
            <p className={`text-2xl font-bold mt-1 ${pipelineGbp > 0 ? "text-amber-700" : "text-slate-900"}`}>{fmt(pipelineGbp)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search suppliers..."
            className="pl-9"
          />
        </div>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All statuses</SelectItem>
            {SUPPLIER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={showFavOnly ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setShowFavOnly(f => !f)}
        >
          <Star className="w-3.5 h-3.5" />Starred
        </Button>
      </div>

      {/* Category tabs */}
      {categories.length > 2 && (
        <div className="flex gap-1 flex-wrap mb-5">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {cat}
              {cat !== "All" && summary?.byCategory[cat] && (
                <span className="ml-1 opacity-60">({summary.byCategory[cat].count})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Supplier list */}
      {isLoading ? (
        <div className="text-center py-20 text-slate-400">Loading suppliers...</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl">
          <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 text-lg mb-1">No suppliers yet</h3>
          <p className="text-slate-500 text-sm mb-4 max-w-sm mx-auto">
            Add suppliers and contractors to track quotes, compare costs, and manage your procurement for the clinic launch.
          </p>
          <Button onClick={() => setAddingSupplier(true)} className="gap-2">
            <Plus className="w-4 h-4" />Add First Supplier
          </Button>
          <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
            {[
              "Fit-out contractor",
              "Solicitor",
              "Interior designer",
              "Equipment supplier",
              "Insurance broker",
              "IT / booking system",
            ].map(hint => (
              <span key={hint} className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">{hint}</span>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No suppliers match your filters.</div>
      ) : (
        <div className="space-y-6">
          {sortedGroupKeys.map(cat => (
            <div key={cat}>
              {selectedCategory === "All" && (
                <div className="flex items-center gap-2 mb-3">
                  {(() => {
                    const Icon = CATEGORY_ICONS[cat] ?? HelpCircle;
                    return <Icon className="w-4 h-4 text-slate-500" />;
                  })()}
                  <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{cat}</h2>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400">{grouped[cat].length}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {grouped[cat].map(s => (
                  <SupplierCard key={s.id} supplier={s} projectId={PROJECT_ID} onEdit={setEditingSupplier} allTasks={allTasks} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category quick-add hints (when there are some suppliers but empty category) */}
      {suppliers.length > 0 && suppliers.length < 5 && (
        <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Suggested supplier categories to add</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUPPLIER_CATEGORIES
              .filter(c => !suppliers.some(s => s.category === c))
              .map(cat => (
                <button
                  key={cat}
                  onClick={() => { setSelectedCategory("All"); setAddingSupplier(true); }}
                  className="text-xs px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-full hover:border-slate-400 transition-colors"
                >
                  + {cat}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {addingSupplier && (
        <SupplierModal open onClose={() => setAddingSupplier(false)} projectId={PROJECT_ID} />
      )}
      {editingSupplier && (
        <SupplierModal open onClose={() => setEditingSupplier(null)} existing={editingSupplier} projectId={PROJECT_ID} />
      )}
    </div>
  );
}
