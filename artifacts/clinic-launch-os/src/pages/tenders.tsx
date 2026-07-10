import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, FileText, Loader2, Printer, Plus, Trash2, Upload,
  Scale, CheckCircle2, AlertTriangle, RefreshCw, MessageSquare, Paperclip,
} from "lucide-react";

const PROJECT_ID = 1;

// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateSection = { key: string; label: string; detail: string };
type Section = { key: string; label: string; included: boolean; questions: { q: string; answer: string }[] };

type PackSummary = {
  id: number; title: string; status: string; reference: string | null; deadline: string | null;
  hasDocuments: boolean; responseCount: number; createdAt: string;
};

type Extracted = {
  totalPriceGbp?: number | null; vatTreatment?: string; programmeWeeks?: number | null;
  exclusions?: string[]; qualifications?: string[]; redFlags?: string[]; summary?: string;
};
type ScoreRow = {
  responseId: number; contractorName: string;
  scores: { price: number; programme: number; completeness: number; experience: number; risk: number; engagement: number };
  weightedTotal: number; headline: string; strengths?: string[]; concerns?: string[];
};
type ContractorNote = { id: string; category: string; note: string; loggedAt: string };
const NOTE_CATEGORIES = ["Responsiveness", "Communication", "Site visit", "Professionalism", "Other"] as const;
type Evaluation = {
  matrix?: ScoreRow[]; ranking?: number[]; notLikeForLike?: string[];
  clarificationsNeeded?: { contractorName: string; questions: string[] }[];
  recommendation?: string; weightsUsed?: Record<string, number>;
};
type PackResponse = {
  id: number; contractorName: string; fileUrl: string | null; fileName: string | null;
  notes: string; extracted: Extracted | null; score: ScoreRow | null; receivedAt: string;
  notesLog: ContractorNote[];
};
type Documents = {
  invitationLetter?: string; instructionsToTenderers?: string; formOfTender?: string;
  preliminaries?: string; preConstructionInfo?: string; programmeRequirements?: string;
  insurancesAndWarranties?: string;
  scopeOfWorks?: { section: string; items: { item: string; detail: string }[] }[];
  pricingSchedule?: { ref: string; description: string }[];
  drawingsRegister?: string[]; contractorQuestions?: string[];
};
type PackFile = { name: string; label: string; url: string; mimetype: string; sizeBytes: number };
type PackDetail = {
  id: number; title: string; status: string; reference: string | null; deadline: string | null;
  sections: Section[]; files: PackFile[]; documents: Documents | null; evaluation: Evaluation | null; responses: PackResponse[];
};

const DOC_ORDER: { key: keyof Documents; title: string }[] = [
  { key: "invitationLetter", title: "1 · Invitation to Tender letter" },
  { key: "instructionsToTenderers", title: "2 · Instructions to tenderers" },
  { key: "formOfTender", title: "3 · Form of Tender" },
  { key: "preliminaries", title: "4 · Preliminaries" },
  { key: "scopeOfWorks", title: "5 · Scope of Works" },
  { key: "pricingSchedule", title: "6 · Pricing schedule" },
  { key: "programmeRequirements", title: "7 · Programme requirements" },
  { key: "preConstructionInfo", title: "8 · Pre-construction information (CDM 2015)" },
  { key: "insurancesAndWarranties", title: "9 · Insurances & warranties" },
  { key: "drawingsRegister", title: "10 · Documents to attach" },
];

async function api<T>(url: string, init?: RequestInit, timeoutMs = 300_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j as { error?: string }).error ?? "Request failed");
    return j as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TendersPage() {
  const [packs, setPacks] = useState<PackSummary[] | null>(null);
  const [openPackId, setOpenPackId] = useState<number | null>(null);

  const loadPacks = () =>
    api<PackSummary[]>(`/api/projects/${PROJECT_ID}/tender-packs`).then(setPacks).catch(() => setPacks([]));
  useEffect(() => { loadPacks(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 no-print">
        <div>
          <h1 className="font-serif text-4xl text-foreground">Tenders</h1>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mt-2">
            Principal-contractor invitation to tender · responses · evaluation
          </p>
        </div>
        <Link href="/suppliers">
          <Button variant="outline" size="sm"><ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Suppliers</Button>
        </Link>
      </div>

      {openPackId == null
        ? <PackList packs={packs} onOpen={setOpenPackId} onChanged={loadPacks} />
        : <PackDetailView packId={openPackId} onBack={() => { setOpenPackId(null); loadPacks(); }} />}
    </div>
  );
}

// ── Pack list + create ────────────────────────────────────────────────────────

function PackList({ packs, onOpen, onChanged }: {
  packs: PackSummary[] | null; onOpen: (id: number) => void; onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [template, setTemplate] = useState<TemplateSection[]>([]);
  const [title, setTitle] = useState("Principal Contractor — Fit-Out Tender");
  const [deadline, setDeadline] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (creating && template.length === 0) {
      api<{ sections: TemplateSection[] }>(`/api/projects/${PROJECT_ID}/tender-scope-template`)
        .then(j => {
          setTemplate(j.sections);
          setSelected(new Set(j.sections.map(s => s.key))); // sensible default: everything on
        })
        .catch(() => setError("Could not load the scope template."));
    }
  }, [creating]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const pack = await api<{ id: number }>(`/api/projects/${PROJECT_ID}/tender-packs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, deadline: deadline || undefined, sectionKeys: [...selected] }),
      });
      onChanged();
      onOpen(pack.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the pack");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!creating && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1.5" />New tender pack</Button>
        </div>
      )}

      {creating && (
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
                <Input className="mt-1.5" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tender returns due</label>
                <Input className="mt-1.5" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Scope — untick anything not in this tender
              </label>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {template.map(s => (
                  <label key={s.key} className={`flex items-start gap-2.5 border rounded-md px-3 py-2 cursor-pointer ${selected.has(s.key) ? "border-ring bg-accent/40" : "border-border"}`}>
                    <Checkbox
                      className="mt-0.5"
                      checked={selected.has(s.key)}
                      onCheckedChange={() => setSelected(prev => {
                        const n = new Set(prev);
                        n.has(s.key) ? n.delete(s.key) : n.add(s.key);
                        return n;
                      })}
                    />
                    <span>
                      <span className="text-sm font-medium block">{s.label}</span>
                      <span className="text-xs text-muted-foreground">{s.detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={create} disabled={busy || selected.size === 0}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Create & continue to detail questions
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {packs == null
        ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
        : packs.length === 0 && !creating
          ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              No tender packs yet. Create one to build your principal-contractor ITT.
            </CardContent></Card>
          : packs.map(p => (
              <Card key={p.id} className="cursor-pointer hover:border-ring transition-colors" onClick={() => onOpen(p.id)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.reference}{p.deadline ? ` · returns due ${new Date(p.deadline).toLocaleDateString("en-GB")}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">{p.status}</Badge>
                  {p.hasDocuments && <Badge variant="secondary">pack ready</Badge>}
                  <Badge variant="secondary">{p.responseCount} response{p.responseCount === 1 ? "" : "s"}</Badge>
                  <button
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`Delete "${p.title}" and its responses?`)) {
                        api(`/api/tender-packs/${p.id}`, { method: "DELETE" }).then(onChanged);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
    </>
  );
}

// ── Pack detail: questions → documents → responses → evaluation ─────────────

function PackDetailView({ packId, onBack }: { packId: number; onBack: () => void }) {
  const [pack, setPack] = useState<PackDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"detail" | "pack" | "responses">("detail");

  const load = () => api<PackDetail>(`/api/tender-packs/${packId}`).then(p => {
    setPack(p);
    if (p.documents) setTab(t => (t === "detail" ? "pack" : t));
  }).catch(e => setError(e.message));
  useEffect(() => { load(); }, [packId]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try { await fn(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  if (!pack) return <Card><CardContent className="p-6 text-sm text-muted-foreground">{error ?? "Loading…"}</CardContent></Card>;

  const hasQuestions = pack.sections.some(s => s.questions.length > 0);
  const answeredCount = pack.sections.reduce((n, s) => n + s.questions.filter(q => q.answer.trim()).length, 0);
  const questionCount = pack.sections.reduce((n, s) => n + s.questions.length, 0);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap no-print">
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="w-3.5 h-3.5 mr-1.5" />All packs</Button>
        <p className="text-sm font-semibold flex-1 min-w-0 truncate">{pack.title} <span className="text-muted-foreground font-normal">· {pack.reference}</span></p>
        <div className="flex gap-1 border border-border rounded-md p-0.5">
          {(["detail", "pack", "responses"] as const).map(t => (
            <button
              key={t}
              className={`px-3 py-1 rounded text-xs font-semibold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setTab(t)}
            >
              {t === "detail" ? "1 · Scope detail" : t === "pack" ? "2 · The pack" : `3 · Responses (${pack.responses.length})`}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive no-print">{error}</p>}

      {tab === "detail" && (
        <ReferenceDocsCard pack={pack} busy={busy} run={run} packId={packId} hasQuestions={hasQuestions} />
      )}

      {tab === "detail" && (
        <Card>
          <CardContent className="p-6 space-y-5">
            {!hasQuestions ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Next, the AI asks you targeted questions for each scope section so the pack captures
                  everything a contractor needs — quantities, spec level, existing conditions.
                </p>
                <Button className="mt-4" disabled={busy != null} onClick={() => run("questions", () => api(`/api/tender-packs/${packId}/questions`, { method: "POST" }))}>
                  {busy === "questions" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Preparing questions… (~1 min)</> : "Get my questions"}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-muted-foreground">
                    Answer what you can — skip anything unknown and the pack will state an assumption instead.
                    <span className="font-semibold text-foreground"> {answeredCount}/{questionCount} answered.</span>
                  </p>
                  <Button variant="outline" size="sm" disabled={busy != null} onClick={() => run("questions", () => api(`/api/tender-packs/${packId}/questions`, { method: "POST" }))}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${busy === "questions" ? "animate-spin" : ""}`} />Regenerate questions
                  </Button>
                </div>
                {pack.sections.map((s, si) => (
                  <div key={s.key} className="border border-border rounded-md p-4">
                    <h3 className="font-serif text-lg">{s.label}</h3>
                    <div className="mt-3 space-y-3">
                      {s.questions.map((q, qi) => (
                        <div key={qi}>
                          <label className="text-sm font-medium leading-snug block">{q.q}</label>
                          <Textarea
                            className="mt-1"
                            rows={2}
                            placeholder="Leave blank if unknown — the pack will flag it as an assumption"
                            value={q.answer}
                            onChange={e => {
                              const next = structuredClone(pack.sections);
                              next[si].questions[qi].answer = e.target.value;
                              setPack({ ...pack, sections: next });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" disabled={busy != null} onClick={() => run("save", () => api(`/api/tender-packs/${packId}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sections: pack.sections }),
                  }))}>
                    {busy === "save" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Save answers
                  </Button>
                  <Button disabled={busy != null} onClick={() => run("generate", async () => {
                    await api(`/api/tender-packs/${packId}`, {
                      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sections: pack.sections }),
                    });
                    await api(`/api/tender-packs/${packId}/generate`, { method: "POST" });
                    setTab("pack");
                  })}>
                    {busy === "generate"
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Drafting the full pack… (3–5 minutes)</>
                      : <><FileText className="w-4 h-4 mr-2" />{pack.documents ? "Regenerate pack" : "Generate the full pack"}</>}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "pack" && (
        !pack.documents
          ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              No pack generated yet — complete step 1 first.
            </CardContent></Card>
          : <PackDocuments pack={pack} busy={busy} onIssue={() => run("issue", () => api(`/api/tender-packs/${packId}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "issued" }),
            }))} />
      )}

      {tab === "responses" && (
        <ResponsesView pack={pack} busy={busy} run={run} packId={packId} />
      )}
    </>
  );
}

// ── Reference documents + AI pre-fill ────────────────────────────────────────

function ReferenceDocsCard({ pack, busy, run, packId, hasQuestions }: {
  pack: PackDetail; busy: string | null;
  run: (label: string, fn: () => Promise<unknown>) => Promise<void>;
  packId: number; hasQuestions: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [prefillNote, setPrefillNote] = useState<string | null>(null);

  const upload = () => run("docupload", async () => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    if (label.trim()) form.append("label", label.trim());
    await api(`/api/tender-packs/${packId}/files`, { method: "POST", body: form });
    setFile(null); setLabel("");
  });

  const prefill = () => run("prefill", async () => {
    const r = await api<{ filled: number; documentsUsed: string[]; documentsSkipped: string[] }>(
      `/api/tender-packs/${packId}/prefill`, { method: "POST" },
    );
    setPrefillNote(
      `${r.filled} answer${r.filled === 1 ? "" : "s"} pre-filled from: ${r.documentsUsed.join(", ")}.` +
      (r.documentsSkipped.length ? ` Skipped: ${r.documentsSkipped.join(", ")}.` : "") +
      " Review them — sources are shown in [brackets].",
    );
  });

  return (
    <Card className="no-print">
      <CardContent className="p-5">
        <h3 className="font-serif text-lg">Reference documents</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Upload the schedule of condition, floor plan, design renders, asbestos survey and anything else useful.
          The AI reads them to pre-fill your scope answers and grounds the final pack in them.
        </p>

        {pack.files.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {pack.files.map(f => (
              <li key={f.url} className="flex items-center gap-2 text-sm border border-border rounded-md px-3 py-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 truncate hover:underline">{f.label}</a>
                <span className="text-xs text-muted-foreground shrink-0">{(f.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                <button
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => { if (confirm(`Remove "${f.label}"?`)) run("docdel", () => api(`/api/tender-packs/${packId}/files?url=${encodeURIComponent(f.url)}`, { method: "DELETE" })); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 mt-3">
          <label className="flex items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground cursor-pointer hover:border-foreground/40">
            <Upload className="w-4 h-4 shrink-0" />
            <span className="truncate">{file ? file.name : "Choose file (PDF/photo)…"}</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Input placeholder="Label, e.g. Schedule of Condition" value={label} onChange={e => setLabel(e.target.value)} />
          <Button variant="outline" disabled={busy != null || !file} onClick={upload}>
            {busy === "docupload" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
          </Button>
        </div>

        {pack.files.length > 0 && hasQuestions && (
          <div className="mt-3">
            <Button disabled={busy != null} onClick={prefill}>
              {busy === "prefill"
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reading documents & drafting answers… (2–5 min)</>
                : <><FileText className="w-4 h-4 mr-2" />Pre-fill answers from documents</>}
            </Button>
            {prefillNote && <p className="text-xs text-muted-foreground mt-2">{prefillNote}</p>}
            <p className="text-[11px] text-muted-foreground mt-1">Only blank answers are filled — anything you've typed is never overwritten.</p>
          </div>
        )}
        {pack.files.length > 0 && !hasQuestions && (
          <p className="text-xs text-muted-foreground mt-2">Get your questions below first, then you can pre-fill answers from these documents.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── The generated documents ───────────────────────────────────────────────────

function PackDocuments({ pack, busy, onIssue }: { pack: PackDetail; busy: string | null; onIssue: () => void }) {
  const d = pack.documents!;
  return (
    <>
      <div className="flex gap-2 no-print">
        <Button size="sm" onClick={() => window.print()}><Printer className="w-3.5 h-3.5 mr-1.5" />Print / Save PDF</Button>
        {pack.status === "draft" && (
          <Button size="sm" variant="outline" disabled={busy != null} onClick={onIssue}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Mark as issued
          </Button>
        )}
      </div>

      {!!d.contractorQuestions?.length && (
        <Card className="border-amber-300 no-print">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Assumptions to check before sending</p>
            <ul className="list-disc pl-5 mt-2 text-sm space-y-1">{d.contractorQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </CardContent>
        </Card>
      )}

      {DOC_ORDER.map(({ key, title }) => {
        const content = d[key];
        if (!content) return null;
        return (
          <Card key={key} className="print:shadow-none" style={{ breakInside: "avoid-page" }}>
            <CardContent className="p-6 md:p-8">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Abi Peters Aesthetics Ltd · {pack.reference}</p>
              <h2 className="font-serif text-2xl mt-1.5">{title}</h2>
              {typeof content === "string" && (
                <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
              )}
              {key === "scopeOfWorks" && Array.isArray(content) && (
                <div className="mt-4 space-y-4">
                  {(content as NonNullable<Documents["scopeOfWorks"]>).map((s, i) => (
                    <div key={i}>
                      <h3 className="text-sm font-semibold">{i + 1}. {s.section}</h3>
                      <ul className="mt-1.5 space-y-1.5">
                        {s.items.map((it, j) => (
                          <li key={j} className="text-sm leading-relaxed pl-4">
                            <span className="font-medium">{it.item}</span>
                            {it.detail && <span className="text-muted-foreground"> — {it.detail}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {key === "pricingSchedule" && Array.isArray(content) && (
                <table className="mt-4 w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-1.5 pr-3 w-14">Ref</th>
                      <th className="py-1.5 pr-3">Description</th>
                      <th className="py-1.5 w-32 text-right">£ (ex VAT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(content as NonNullable<Documents["pricingSchedule"]>).map((row, i) => (
                      <tr key={i} className="border-b border-border/60 align-top">
                        <td className="py-1.5 pr-3 text-muted-foreground">{row.ref}</td>
                        <td className="py-1.5 pr-3">{row.description}</td>
                        <td className="py-1.5 border-b border-dotted" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {key === "drawingsRegister" && Array.isArray(content) && (
                <ul className="list-disc pl-5 mt-4 text-sm space-y-1">
                  {(content as string[]).map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

// ── Responses + evaluation ────────────────────────────────────────────────────

function ResponsesView({ pack, busy, run, packId }: {
  pack: PackDetail; busy: string | null;
  run: (label: string, fn: () => Promise<unknown>) => Promise<void>;
  packId: number;
}) {
  const [contractorName, setContractorName] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const upload = () => run("upload", async () => {
    const form = new FormData();
    form.append("contractorName", contractorName);
    form.append("notes", notes);
    if (file) form.append("file", file);
    await api(`/api/tender-packs/${packId}/responses`, { method: "POST", body: form });
    setContractorName(""); setNotes(""); setFile(null);
  });

  const ev = pack.evaluation;
  const ranked = ev?.matrix?.slice().sort((a, b) => b.weightedTotal - a.weightedTotal);

  return (
    <>
      <Card className="no-print">
        <CardContent className="p-5">
          <h3 className="font-serif text-lg">Add a contractor</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Log them as soon as you're in touch — you don't need their priced bid yet. Add engagement
            notes (responsiveness, communication, site visit) as you go, then attach their tender return
            when it arrives.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <Input placeholder="Contractor name *" value={contractorName} onChange={e => setContractorName(e.target.value)} />
            <label className="flex items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground cursor-pointer hover:border-foreground/40">
              <Upload className="w-4 h-4 shrink-0" />
              <span className="truncate">{file ? file.name : "Their tender return, if already in (optional)…"}</span>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <Textarea className="mt-3" rows={2} placeholder="Notes on adding them (optional) — you can log ongoing observations after" value={notes} onChange={e => setNotes(e.target.value)} />
          <Button className="mt-3" disabled={busy != null || !contractorName.trim()} onClick={upload}>
            {busy === "upload"
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{file ? "Uploading & reading the bid… (1–2 min)" : "Saving…"}</>
              : <><Plus className="w-4 h-4 mr-2" />Add contractor</>}
          </Button>
        </CardContent>
      </Card>

      {pack.responses.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-serif text-lg">Contractors ({pack.responses.length})</h3>
              <Button disabled={busy != null} onClick={() => run("evaluate", () => api(`/api/tender-packs/${packId}/evaluate`, { method: "POST" }))}>
                {busy === "evaluate"
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scoring… (2–3 min)</>
                  : <><Scale className="w-4 h-4 mr-2" />{ev ? "Re-evaluate & rank" : "Evaluate & rank"}</>}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              You can evaluate before any bids arrive — with only engagement notes logged, it gives you an early read on who's proving reliable.
            </p>
            {pack.responses.map(r => (
              <ContractorCard key={r.id} r={r} busy={busy} run={run} />
            ))}
          </CardContent>
        </Card>
      )}

      {ev && ranked && (
        <Card>
          <CardContent className="p-5">
            <h3 className="font-serif text-lg">Evaluation</h3>
            {ev.weightsUsed && (
              <p className="text-xs text-muted-foreground mt-1">
                Weights: {Object.entries(ev.weightsUsed).map(([k, v]) => `${k} ${v}%`).join(" · ")}
              </p>
            )}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[560px]">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-1.5 pr-3">#</th>
                    <th className="py-1.5 pr-3">Contractor</th>
                    <th className="py-1.5 pr-2 text-right">Price</th>
                    <th className="py-1.5 pr-2 text-right">Prog.</th>
                    <th className="py-1.5 pr-2 text-right">Compl.</th>
                    <th className="py-1.5 pr-2 text-right">Exp.</th>
                    <th className="py-1.5 pr-2 text-right">Risk</th>
                    <th className="py-1.5 pr-2 text-right">Engage.</th>
                    <th className="py-1.5 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((m, i) => (
                    <tr key={m.responseId} className="border-b border-border/60">
                      <td className="py-1.5 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-1.5 pr-3 font-medium">{m.contractorName}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{m.scores.price}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{m.scores.programme}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{m.scores.completeness}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{m.scores.experience}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{m.scores.risk}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{m.scores.engagement}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{Math.round(m.weightedTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {ranked.map(m => (
              <div key={m.responseId} className="mt-3 border border-border rounded-md p-3">
                <p className="text-sm font-semibold">{m.contractorName} — {m.headline}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1.5">
                  {!!m.strengths?.length && (
                    <ul className="list-disc pl-5 text-xs space-y-0.5">{m.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  )}
                  {!!m.concerns?.length && (
                    <ul className="list-disc pl-5 text-xs text-destructive space-y-0.5">{m.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
                  )}
                </div>
              </div>
            ))}

            {!!ev.notLikeForLike?.length && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Not like-for-like</p>
                <ul className="list-disc pl-5 mt-1 text-sm space-y-0.5">{ev.notLikeForLike.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            )}
            {!!ev.clarificationsNeeded?.length && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clarifications to request</p>
                {ev.clarificationsNeeded.map((c, i) => (
                  <div key={i} className="mt-1.5">
                    <p className="text-sm font-medium">{c.contractorName}</p>
                    <ul className="list-disc pl-5 text-sm space-y-0.5">{c.questions.map((q, j) => <li key={j}>{q}</li>)}</ul>
                  </div>
                ))}
              </div>
            )}
            {ev.recommendation && (
              <div className="mt-4 bg-accent rounded-md p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider">Recommendation</p>
                <p className="text-sm mt-1 leading-relaxed">{ev.recommendation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ── One contractor: bid summary, engagement notes log, attach-bid-later ─────

function ContractorCard({ r, busy, run }: {
  r: PackResponse; busy: string | null;
  run: (label: string, fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteCategory, setNoteCategory] = useState<string>(NOTE_CATEGORIES[0]);
  const [noteText, setNoteText] = useState("");

  const addNote = () => run(`note-${r.id}`, async () => {
    await api(`/api/tender-responses/${r.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: noteCategory, note: noteText }),
    });
    setNoteText(""); setShowAddNote(false);
  });

  const attachBid = (file: File) => run(`attach-${r.id}`, async () => {
    const form = new FormData();
    form.append("file", file);
    await api(`/api/tender-responses/${r.id}/attach`, { method: "POST", body: form });
  });

  return (
    <div className="border border-border rounded-md p-3.5">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-semibold flex-1 min-w-0">{r.contractorName}</p>
        {r.extracted?.totalPriceGbp != null && (
          <Badge variant="secondary">£{Number(r.extracted.totalPriceGbp).toLocaleString()} {r.extracted.vatTreatment === "exc" ? "ex" : r.extracted.vatTreatment === "inc" ? "inc" : ""} VAT</Badge>
        )}
        {r.extracted?.programmeWeeks != null && <Badge variant="outline">{r.extracted.programmeWeeks} wks</Badge>}
        {r.score && <Badge>{Math.round(r.score.weightedTotal)}/100</Badge>}
        {r.fileUrl && <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-xs underline text-muted-foreground">{r.fileName ?? "file"}</a>}
        <button
          className="text-muted-foreground hover:text-destructive"
          onClick={() => { if (confirm(`Remove ${r.contractorName}?`)) run("del", () => api(`/api/tender-responses/${r.id}`, { method: "DELETE" })); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {r.extracted?.summary && <p className="text-sm text-muted-foreground mt-1.5">{r.extracted.summary}</p>}
      {!!r.extracted?.redFlags?.length && (
        <ul className="list-disc pl-5 mt-1 text-xs text-destructive space-y-0.5">
          {r.extracted.redFlags.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}
      {r.notes && <p className="text-xs text-muted-foreground mt-1">Notes: {r.notes}</p>}

      {!r.fileUrl && (
        <label className="mt-2.5 flex items-center gap-2 rounded-md border border-dashed border-input px-3 py-1.5 text-xs text-muted-foreground cursor-pointer hover:border-foreground/40 w-fit">
          <Paperclip className="w-3.5 h-3.5 shrink-0" />
          {busy === `attach-${r.id}` ? "Uploading & reading…" : "Attach their tender return once it's in"}
          <input
            type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) attachBid(f); }}
          />
        </label>
      )}

      {/* Engagement notes log */}
      <div className="mt-3 pt-3 border-t border-border/60">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />Engagement notes {r.notesLog.length > 0 && `(${r.notesLog.length})`}
          </p>
          <button className="text-xs text-primary hover:underline" onClick={() => setShowAddNote(s => !s)}>
            {showAddNote ? "Cancel" : "+ Add note"}
          </button>
        </div>

        {r.notesLog.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {r.notesLog.map(n => (
              <li key={n.id} className="flex items-start gap-2 text-sm">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">{n.category}</Badge>
                <span className="flex-1">{n.note}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{new Date(n.loggedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                <button
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => run(`delnote-${n.id}`, () => api(`/api/tender-responses/${r.id}/notes/${n.id}`, { method: "DELETE" }))}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {showAddNote && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap">
              {NOTE_CATEGORIES.map(c => (
                <button
                  key={c}
                  className={`text-xs px-2 py-1 rounded-full border ${noteCategory === c ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground"}`}
                  onClick={() => setNoteCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              placeholder={
                noteCategory === "Site visit" ? "How did they come across on site — punctual, thorough, confident?"
                : noteCategory === "Responsiveness" ? "How quickly did they reply?"
                : noteCategory === "Communication" ? "Clear? Professional? Any red flags?"
                : "What did you notice?"
              }
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />
            <Button size="sm" className="w-fit" disabled={busy != null || !noteText.trim()} onClick={addNote}>
              {busy === `note-${r.id}` ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}Save note
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
