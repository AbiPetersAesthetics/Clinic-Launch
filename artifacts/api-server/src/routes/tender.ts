import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import {
  phasesTable, tasksTable, propertiesTable, projectsTable,
  suppliersTable, supplierQuotesTable,
  tenderPacksTable, tenderResponsesTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { anthropic, claudeComplete } from "@workspace/integrations-anthropic-ai";

const router = Router();

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// ─── Standard fit-out scope sections (principal-contractor ITT) ──────────────

const SCOPE_TEMPLATE = [
  { key: "prelims", label: "Site setup & preliminaries", detail: "Welfare, protection of retained finishes, waste management, scaffolding/access, site security." },
  { key: "stripout", label: "Strip-out & demolition", detail: "Removal of existing fittings, finishes, partitions; make-good ready for fit-out." },
  { key: "partitions", label: "Partitions & wall build-ups", detail: "New stud partitions, acoustic performance between treatment rooms, doorsets." },
  { key: "joinery", label: "Joinery & fitted furniture", detail: "Reception desk, clinical cabinetry, storage, window seating." },
  { key: "electrical", label: "Electrical installation", detail: "Rewiring/alterations, sockets & switching, consumer unit, BS 7671 certification, emergency lighting." },
  { key: "lighting", label: "Lighting", detail: "Treatment-room task lighting, ambient/feature lighting, dimming." },
  { key: "plumbing", label: "Plumbing & drainage", detail: "Clinical hand-wash basins per treatment room, hot water, drainage routes, water regs compliance." },
  { key: "hvac", label: "Heating, ventilation & air conditioning", detail: "Comfort cooling/heating to treatment rooms, ventilation/air changes suitable for clinical use." },
  { key: "flooring", label: "Floor coverings", detail: "Hygienic seamless flooring in clinical rooms, feature flooring front-of-house, thresholds." },
  { key: "decoration", label: "Decoration & finishes", detail: "Preparation, mist coats, final finishes; wipeable/scrubbable paints in clinical areas." },
  { key: "clinical", label: "Clinical room fit-out", detail: "Hygienic wall cladding/splashbacks, couch zones, medical fridge point, sharps/waste positions." },
  { key: "shopfront", label: "Shopfront & external", detail: "Shopfront repairs/repaint, external decoration, signage fixing points (consent-dependent)." },
  { key: "security", label: "Security & access control", detail: "Intruder alarm, CCTV, door entry, CQC-compliant medicines storage room security." },
  { key: "data", label: "Data, Wi-Fi & AV", detail: "Structured cabling, Wi-Fi access points, music/AV, card terminal points." },
  { key: "fire", label: "Fire safety works", detail: "Detection & alarm, fire doors, compartmentation, extinguishers, signage." },
  { key: "access", label: "Building control & accessibility", detail: "Part M/accessibility adjustments, building-regs items, approved-inspector coordination." },
] as const;

const EVALUATION_WEIGHTS = [
  { key: "price", label: "Price & value", weight: 35 },
  { key: "programme", label: "Programme & availability", weight: 15 },
  { key: "completeness", label: "Completeness & compliance with the tender", weight: 20 },
  { key: "experience", label: "Relevant experience & references", weight: 15 },
  { key: "risk", label: "Risk (exclusions, qualifications, provisional sums)", weight: 15 },
];

type Section = { key: string; label: string; included: boolean; questions: { q: string; answer: string }[] };

async function projectContext(projectId: number) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const [property] = await db.select().from(propertiesTable)
    .where(and(eq(propertiesTable.projectId, projectId), eq(propertiesTable.isActiveForProject, true)))
    .limit(1);
  return {
    address: `${property?.address ?? "9a Jewry Street, Winchester"}${property?.postcode ? ", " + property.postcode : ""}`,
    sqFt: property?.sqFootage ?? null,
    leaseStart: project?.startDate ?? null,
    openDate: project?.targetOpeningDate ?? null,
  };
}

const CLIENT_BLURB = `The client is Abi Peters Aesthetics Ltd, fitting out a premium aesthetics clinic (nurse-led; CQC-regulated activities planned, so clinical hygiene standards apply). The premises is in Winchester city-centre conservation area.`;

// ─── Scope template ───────────────────────────────────────────────────────────

router.get("/projects/:projectId/tender-scope-template", (_req, res) => {
  res.json({ sections: SCOPE_TEMPLATE, evaluationWeights: EVALUATION_WEIGHTS });
});

// ─── Packs CRUD ───────────────────────────────────────────────────────────────

router.get("/projects/:projectId/tender-packs", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const packs = await db.select().from(tenderPacksTable)
    .where(eq(tenderPacksTable.projectId, projectId))
    .orderBy(desc(tenderPacksTable.id));
  const responses = await db.select({ id: tenderResponsesTable.id, tenderPackId: tenderResponsesTable.tenderPackId })
    .from(tenderResponsesTable).where(eq(tenderResponsesTable.projectId, projectId));
  res.json(packs.map(p => ({
    id: p.id, title: p.title, status: p.status, reference: p.reference, deadline: p.deadline,
    createdAt: p.createdAt, hasDocuments: !!p.documentsJson,
    responseCount: responses.filter(r => r.tenderPackId === p.id).length,
  })));
});

router.post("/projects/:projectId/tender-packs", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const { title, deadline, sectionKeys } = req.body as { title?: string; deadline?: string; sectionKeys: string[] };
  if (!Array.isArray(sectionKeys) || sectionKeys.length === 0) {
    return res.status(400).json({ error: "Select at least one scope section." });
  }
  const sections: Section[] = SCOPE_TEMPLATE
    .filter(s => sectionKeys.includes(s.key))
    .map(s => ({ key: s.key, label: s.label, included: true, questions: [] }));
  const [pack] = await db.insert(tenderPacksTable).values({
    projectId,
    title: title?.trim() || "Principal Contractor — Fit-Out Tender",
    deadline: deadline || null,
    sectionsJson: JSON.stringify(sections),
    reference: `APA-ITT-${String(Date.now()).slice(-5)}`,
  }).returning();
  res.json(pack);
});

router.get("/tender-packs/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [pack] = await db.select().from(tenderPacksTable).where(eq(tenderPacksTable.id, id));
  if (!pack) return res.status(404).json({ error: "Not found" });
  const responses = await db.select().from(tenderResponsesTable)
    .where(eq(tenderResponsesTable.tenderPackId, id))
    .orderBy(desc(tenderResponsesTable.id));
  res.json({
    ...pack,
    sections: JSON.parse(pack.sectionsJson || "[]"),
    files: JSON.parse(pack.filesJson || "[]"),
    documents: pack.documentsJson ? JSON.parse(pack.documentsJson) : null,
    evaluation: pack.evaluationJson ? JSON.parse(pack.evaluationJson) : null,
    responses: responses.map(r => ({
      ...r,
      extracted: r.extractedJson ? JSON.parse(r.extractedJson) : null,
      score: r.scoreJson ? JSON.parse(r.scoreJson) : null,
    })),
  });
});

router.patch("/tender-packs/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { sections, status, title, deadline } = req.body as {
    sections?: Section[]; status?: string; title?: string; deadline?: string;
  };
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (sections) patch.sectionsJson = JSON.stringify(sections);
  if (status) patch.status = status;
  if (title !== undefined) patch.title = title;
  if (deadline !== undefined) patch.deadline = deadline || null;
  const [pack] = await db.update(tenderPacksTable).set(patch).where(eq(tenderPacksTable.id, id)).returning();
  res.json(pack);
});

router.delete("/tender-packs/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(tenderResponsesTable).where(eq(tenderResponsesTable.tenderPackId, id));
  await db.delete(tenderPacksTable).where(eq(tenderPacksTable.id, id));
  res.json({ ok: true });
});

// ─── Reference documents (schedule of condition, floor plans, renders…) ─────

type PackFile = { name: string; label: string; url: string; mimetype: string; sizeBytes: number };
const FILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

router.post("/tender-packs/:id/files", memUpload.single("file"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [pack] = await db.select().from(tenderPacksTable).where(eq(tenderPacksTable.id, id));
  if (!pack) return res.status(404).json({ error: "Not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  const isPdf = req.file.mimetype === "application/pdf";
  if (!isPdf && !FILE_IMAGE_TYPES.has(req.file.mimetype)) {
    return res.status(400).json({ error: "Accepted types: PDF, JPG, PNG, WebP, GIF." });
  }
  const dir = path.join(process.cwd(), "uploads", "tenders", String(id), "docs");
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(req.file.originalname) || (isPdf ? ".pdf" : ".png");
  const stored = `doc_${Date.now()}${ext}`;
  fs.writeFileSync(path.join(dir, stored), req.file.buffer);

  const files: PackFile[] = JSON.parse(pack.filesJson || "[]");
  files.push({
    name: req.file.originalname,
    label: ((req.body.label as string | undefined)?.trim()) || req.file.originalname,
    url: `/uploads/tenders/${id}/docs/${stored}`,
    mimetype: req.file.mimetype,
    sizeBytes: req.file.size,
  });
  await db.update(tenderPacksTable)
    .set({ filesJson: JSON.stringify(files), updatedAt: new Date() })
    .where(eq(tenderPacksTable.id, id));
  res.json({ files });
});

router.delete("/tender-packs/:id/files", async (req, res) => {
  const id = parseInt(req.params.id);
  const url = req.query.url as string | undefined;
  const [pack] = await db.select().from(tenderPacksTable).where(eq(tenderPacksTable.id, id));
  if (!pack) return res.status(404).json({ error: "Not found" });
  const files: PackFile[] = JSON.parse(pack.filesJson || "[]");
  const remaining = files.filter(f => f.url !== url);
  const removed = files.find(f => f.url === url);
  if (removed) {
    try { fs.unlinkSync(path.join(process.cwd(), removed.url.replace(/^\//, ""))); } catch { /* already gone */ }
  }
  await db.update(tenderPacksTable)
    .set({ filesJson: JSON.stringify(remaining), updatedAt: new Date() })
    .where(eq(tenderPacksTable.id, id));
  res.json({ files: remaining });
});

// Turn the pack's uploaded documents into Claude content blocks (capped so the
// request stays well under the API's size limit).
function loadPackFileBlocks(pack: { filesJson: string }): { blocks: unknown[]; used: string[]; skipped: string[] } {
  const files: PackFile[] = JSON.parse(pack.filesJson || "[]");
  const blocks: unknown[] = [];
  const used: string[] = [];
  const skipped: string[] = [];
  let budget = 22 * 1024 * 1024; // total bytes of raw file data across blocks
  for (const f of files) {
    const abs = path.join(process.cwd(), f.url.replace(/^\//, ""));
    if (!fs.existsSync(abs)) { skipped.push(`${f.label} (file missing)`); continue; }
    const buf = fs.readFileSync(abs);
    if (buf.length > budget) { skipped.push(`${f.label} (too large for this request)`); continue; }
    budget -= buf.length;
    const source = { type: "base64" as const, data: buf.toString("base64") };
    blocks.push({ type: "text", text: `--- Attached document: "${f.label}" (${f.name}) ---` });
    blocks.push(
      f.mimetype === "application/pdf"
        ? { type: "document", source: { ...source, media_type: "application/pdf" } }
        : { type: "image", source: { ...source, media_type: f.mimetype } },
    );
    used.push(f.label);
  }
  return { blocks, used, skipped };
}

// ─── Pre-fill answers from the uploaded documents ────────────────────────────

router.post("/tender-packs/:id/prefill", async (req, res) => {
  const id = parseInt(req.params.id);
  const [pack] = await db.select().from(tenderPacksTable).where(eq(tenderPacksTable.id, id));
  if (!pack) return res.status(404).json({ error: "Not found" });
  const sections: Section[] = JSON.parse(pack.sectionsJson || "[]");
  if (!sections.some(s => s.questions.length > 0)) {
    return res.status(400).json({ error: "Generate the questions first." });
  }
  const { blocks, used, skipped } = loadPackFileBlocks(pack);
  if (blocks.length === 0) {
    return res.status(400).json({ error: "Upload at least one reference document first." });
  }
  const ctx = await projectContext(pack.projectId);

  const questionList = sections.map(s =>
    `SECTION ${s.key} — ${s.label}:\n${s.questions.map((q, i) => `  ${i}: ${q.q}`).join("\n")}`,
  ).join("\n\n");

  const promptText = `${CLIENT_BLURB}
Site: ${ctx.address}. The documents above are the owner's reference material (may include schedule of condition, floor plans, design renders, asbestos survey).

Below are the scope-detail questions for the tender pack. Using ONLY what the documents actually show or state, draft a baseline answer for each question you can. Rules:
- Answer only where the documents give real evidence (measurements from plans, condition notes, materials visible in renders, asbestos findings).
- Prefix every answer with the source in square brackets, e.g. "[floor plan] ...".
- If the documents don't cover a question, return an empty string for it — do NOT guess.
- Keep answers short and factual (1-3 sentences).

QUESTIONS:
${questionList}

Return ONLY valid JSON:
{ "sections": [ { "key": "<section key>", "answers": ["answer or empty string per question, same order and count as listed"] } ] }`;

  try {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 480_000);
    const response = await anthropic.messages.stream(
      {
        model: "claude-opus-4-8",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        messages: [{ role: "user", content: [...(blocks as never[]), { type: "text", text: promptText }] }],
      },
      { signal: abort.signal },
    ).finalMessage();
    clearTimeout(timeout);
    const text = response.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map(b => b.text).join("");
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const s0 = clean.indexOf("{");
    const e0 = clean.lastIndexOf("}");
    const parsed = JSON.parse(s0 !== -1 && e0 > s0 ? clean.slice(s0, e0 + 1) : clean) as {
      sections?: { key: string; answers: string[] }[];
    };
    const aMap = new Map((parsed.sections ?? []).map(s => [s.key, s.answers ?? []]));
    let filled = 0;
    const updated = sections.map(s => ({
      ...s,
      questions: s.questions.map((q, i) => {
        const suggestion = (aMap.get(s.key) ?? [])[i] ?? "";
        // Only fill blanks — never overwrite what the owner typed.
        if (!q.answer.trim() && suggestion.trim()) { filled++; return { ...q, answer: suggestion.trim() }; }
        return q;
      }),
    }));
    await db.update(tenderPacksTable)
      .set({ sectionsJson: JSON.stringify(updated), updatedAt: new Date() })
      .where(eq(tenderPacksTable.id, id));
    res.json({ sections: updated, filled, documentsUsed: used, documentsSkipped: skipped });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Pre-fill failed";
    res.status(msg.includes("ANTHROPIC_API_KEY") ? 503 : 500).json({ error: msg });
  }
});

// ─── Step 2: AI questions per selected section ───────────────────────────────

router.post("/tender-packs/:id/questions", async (req, res) => {
  const id = parseInt(req.params.id);
  const [pack] = await db.select().from(tenderPacksTable).where(eq(tenderPacksTable.id, id));
  if (!pack) return res.status(404).json({ error: "Not found" });
  const sections: Section[] = JSON.parse(pack.sectionsJson || "[]");
  const ctx = await projectContext(pack.projectId);

  const prompt = `${CLIENT_BLURB}
Site: ${ctx.address}${ctx.sqFt ? ` (~${ctx.sqFt} sq ft)` : ""}. Lease/possession expected ${ctx.leaseStart ?? "TBC"}; clinic must open ${ctx.openDate ?? "TBC"}.

The owner is preparing a principal-contractor Invitation to Tender and has selected these scope sections:
${sections.map(s => `- ${s.key}: ${s.label}`).join("\n")}

For EACH section, write the 3-5 most important clarifying questions the owner must answer so a contractor can price the work without guessing. Questions must be specific and answerable by a non-construction owner (plain English, offer examples in brackets where helpful). Cover quantities, locations, quality/spec level, existing conditions, and anything a clinic/CQC context makes special. Do not ask things a site visit obviously answers.

Return ONLY valid JSON:
{ "sections": [ { "key": "<section key>", "questions": ["...", "..."] } ] }`;

  try {
    const raw = await claudeComplete({ messages: [{ role: "user", content: prompt }], maxTokens: 5000, jsonOnly: true });
    const parsed = JSON.parse(raw) as { sections?: { key: string; questions: string[] }[] };
    const qMap = new Map((parsed.sections ?? []).map(s => [s.key, s.questions ?? []]));
    const updated = sections.map(s => ({
      ...s,
      questions: (qMap.get(s.key) ?? []).map(q => {
        const existing = s.questions.find(x => x.q === q);
        return { q, answer: existing?.answer ?? "" };
      }),
    }));
    await db.update(tenderPacksTable)
      .set({ sectionsJson: JSON.stringify(updated), updatedAt: new Date() })
      .where(eq(tenderPacksTable.id, id));
    res.json({ sections: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Question generation failed";
    res.status(msg.includes("ANTHROPIC_API_KEY") ? 503 : 500).json({ error: msg });
  }
});

// ─── Step 3: generate the full ITT document set ──────────────────────────────

router.post("/tender-packs/:id/generate", async (req, res) => {
  const id = parseInt(req.params.id);
  const [pack] = await db.select().from(tenderPacksTable).where(eq(tenderPacksTable.id, id));
  if (!pack) return res.status(404).json({ error: "Not found" });
  const sections: Section[] = JSON.parse(pack.sectionsJson || "[]");
  const ctx = await projectContext(pack.projectId);

  const sectionDetail = sections.map(s => {
    const qa = s.questions.filter(q => q.answer.trim())
      .map(q => `  Q: ${q.q}\n  A: ${q.answer.trim()}`).join("\n");
    return `SECTION: ${s.label}\n${qa || "  (no further detail provided — write a sensible baseline spec and flag assumptions)"}`;
  }).join("\n\n");

  const { blocks: fileBlocks, used: docLabels } = loadPackFileBlocks(pack);

  const prompt = `${CLIENT_BLURB}
Site: ${ctx.address}${ctx.sqFt ? ` (~${ctx.sqFt} sq ft)` : ""}. Lease/possession expected ${ctx.leaseStart ?? "TBC"}. The clinic must open ${ctx.openDate ?? "TBC"} — the programme works back from that date. Tender reference: ${pack.reference}. ${pack.deadline ? `Tender returns due ${pack.deadline}.` : ""}

Produce a complete, professional UK Invitation to Tender pack for a PRINCIPAL CONTRACTOR (single point of responsibility for the whole fit-out, JCT Minor Works Building Contract assumed). Ground every scope item in the owner's answers below${docLabels.length ? " AND the attached reference documents (cite them where relevant, e.g. 'refer to schedule of condition')" : ""}; where detail is missing, state a clear assumption and add it to the contractor questions. Do NOT invent prices.
${docLabels.length ? `\nATTACHED REFERENCE DOCUMENTS (list these in drawingsRegister as issued documents): ${docLabels.join("; ")}` : ""}

OWNER'S SCOPE AND ANSWERS:
${sectionDetail}

Return ONLY valid JSON with ALL of these documents. Document bodies must be PLAIN TEXT (no markdown syntax — no #, no **, no backticks): use UPPERCASE side-headings, numbered or dashed lists, and blank lines between paragraphs. UK conventions throughout.
{
  "invitationLetter": "formal ITT covering letter: who we are, what is tendered, key dates, how to respond",
  "instructionsToTenderers": "submission requirements: format, deadline, validity period (90 days), queries process, site visit arrangements, basis of contract (JCT Minor Works), evaluation criteria summary (price 35%, programme 15%, completeness 20%, experience 15%, risk 15%), right not to accept lowest/any tender",
  "formOfTender": "one-page form the contractor signs: offer sum in words+figures, programme duration, validity, declarations (no collusion, insurances held)",
  "preliminaries": "site particulars, access & working hours (city-centre conservation area), welfare, protection, waste, client obligations, neighbouring premises, deliveries/parking constraints",
  "scopeOfWorks": [ { "section": "name", "items": [ { "item": "short title", "detail": "clear 1-3 sentence spec grounded in the answers" } ] } ],
  "pricingSchedule": [ { "ref": "1.0", "description": "line the contractor must price (mirror scope sections; include prelims, OH&P, and a contingency line)" } ],
  "preConstructionInfo": "CDM 2015 pre-construction information summary: duty holders, known hazards (asbestos R&D survey completed — refer to report), existing services, welfare",
  "programmeRequirements": "key dates and expectations: possession, sectional needs, completion in time for CQC prep and the opening date, working-hours constraints, lead-in items to flag",
  "insurancesAndWarranties": "required insurances with typical minimums (public liability £5m, employer's liability £10m, contract works), collateral warranty/guarantees expectations, defects liability 12 months",
  "drawingsRegister": ["list of documents the owner should attach — architect/CAD drawing pack, asbestos R&D survey report, etc."],
  "contractorQuestions": ["assumptions made that the contractor or owner must confirm"]
}`;

  try {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 540_000);
    const response = await anthropic.messages.stream(
      {
        model: "claude-opus-4-8",
        max_tokens: 24000,
        thinking: { type: "adaptive" },
        messages: [{ role: "user", content: [...(fileBlocks as never[]), { type: "text", text: prompt }] }],
      },
      { signal: abort.signal },
    ).finalMessage();
    clearTimeout(timeout);
    const text = response.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map(b => b.text).join("");
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const s0 = clean.indexOf("{");
    const e0 = clean.lastIndexOf("}");
    const documents = JSON.parse(s0 !== -1 && e0 > s0 ? clean.slice(s0, e0 + 1) : clean);
    await db.update(tenderPacksTable)
      .set({ documentsJson: JSON.stringify(documents), updatedAt: new Date() })
      .where(eq(tenderPacksTable.id, id));
    res.json({ documents });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Pack generation failed";
    res.status(msg.includes("ANTHROPIC_API_KEY") ? 503 : 500).json({ error: msg });
  }
});

// ─── Responses: upload + AI extraction ───────────────────────────────────────

router.post("/tender-packs/:id/responses", memUpload.single("file"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [pack] = await db.select().from(tenderPacksTable).where(eq(tenderPacksTable.id, id));
  if (!pack) return res.status(404).json({ error: "Not found" });
  const contractorName = (req.body.contractorName as string | undefined)?.trim();
  const notes = (req.body.notes as string | undefined)?.trim() ?? "";
  if (!contractorName) return res.status(400).json({ error: "contractorName is required." });

  let fileUrl: string | null = null;
  let fileName: string | null = null;
  let extractedJson: string | null = null;

  if (req.file) {
    const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    const isPdf = req.file.mimetype === "application/pdf";
    if (!isPdf && !IMAGE_TYPES.has(req.file.mimetype)) {
      return res.status(400).json({ error: "Accepted types: PDF, JPG, PNG, WebP, GIF." });
    }
    const dir = path.join(process.cwd(), "uploads", "tenders", String(id));
    fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(req.file.originalname) || (isPdf ? ".pdf" : ".png");
    fileName = req.file.originalname;
    const stored = `response_${Date.now()}${ext}`;
    fs.writeFileSync(path.join(dir, stored), req.file.buffer);
    fileUrl = `/uploads/tenders/${id}/${stored}`;

    // AI extraction of the submission
    try {
      const source = { type: "base64" as const, data: req.file.buffer.toString("base64") };
      const block = isPdf
        ? { type: "document" as const, source: { ...source, media_type: "application/pdf" as const } }
        : { type: "image" as const, source: { ...source, media_type: req.file.mimetype as never } };
      const extractPrompt = `This is a contractor's tender return for a clinic fit-out ITT (reference ${pack.reference}). Extract what is actually stated — use null where absent, never invent.

Return ONLY valid JSON:
{
  "totalPriceGbp": number or null,
  "vatTreatment": "inc | exc | unclear",
  "priceBreakdownPresent": true/false,
  "programmeWeeks": number or null,
  "startAvailability": "what they say about start dates, or null",
  "validityDays": number or null,
  "exclusions": ["..."],
  "provisionalSums": ["items and amounts"],
  "qualifications": ["caveats/qualifications to the tender"],
  "insurancesConfirmed": "what insurance cover they state, or null",
  "paymentTerms": "or null",
  "experienceNotes": "relevant experience/references they cite, or null",
  "redFlags": ["anything concerning"],
  "summary": "3-sentence plain-English summary of this bid"
}`;
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 240_000);
      const response = await anthropic.messages.create(
        {
          model: "claude-opus-4-8",
          max_tokens: 10000,
          thinking: { type: "adaptive" },
          messages: [{ role: "user", content: [block as never, { type: "text", text: extractPrompt }] }],
        },
        { signal: abort.signal },
      );
      clearTimeout(timeout);
      const text = response.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map(b => b.text).join("");
      const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const s = clean.indexOf("{");
      const e = clean.lastIndexOf("}");
      extractedJson = JSON.stringify(JSON.parse(s !== -1 && e > s ? clean.slice(s, e + 1) : clean));
    } catch {
      extractedJson = null; // upload still succeeds; extraction can be retried by re-upload
    }
  }

  const [row] = await db.insert(tenderResponsesTable).values({
    tenderPackId: id,
    projectId: pack.projectId,
    contractorName,
    notes,
    fileUrl,
    fileName,
    extractedJson,
  }).returning();
  res.json({ ...row, extracted: extractedJson ? JSON.parse(extractedJson) : null });
});

router.delete("/tender-responses/:id", async (req, res) => {
  await db.delete(tenderResponsesTable).where(eq(tenderResponsesTable.id, parseInt(req.params.id)));
  res.json({ ok: true });
});

// ─── Evaluation: weighted scoring across all responses ──────────────────────

router.post("/tender-packs/:id/evaluate", async (req, res) => {
  const id = parseInt(req.params.id);
  const [pack] = await db.select().from(tenderPacksTable).where(eq(tenderPacksTable.id, id));
  if (!pack) return res.status(404).json({ error: "Not found" });
  const responses = await db.select().from(tenderResponsesTable).where(eq(tenderResponsesTable.tenderPackId, id));
  if (responses.length < 1) return res.status(400).json({ error: "Upload at least one tender response first." });

  const bids = responses.map(r => ({
    id: r.id,
    contractorName: r.contractorName,
    notes: r.notes,
    extracted: r.extractedJson ? JSON.parse(r.extractedJson) : null,
  }));

  const prompt = `${CLIENT_BLURB}
You are evaluating principal-contractor tender returns for ITT ${pack.reference} ("${pack.title}"). Clinic must open ${(await projectContext(pack.projectId)).openDate ?? "TBC"}.

WEIGHTED CRITERIA (score each 0-10 per bid, then weight):
${EVALUATION_WEIGHTS.map(w => `- ${w.key}: ${w.label} — ${w.weight}%`).join("\n")}

THE BIDS (AI-extracted from submissions; null = not stated):
${JSON.stringify(bids, null, 1)}

Rules: be honest and evidence-based. A bid missing key information scores LOW on completeness — do not give benefit of the doubt. Cheapest is not automatically best on price if scope coverage differs. Note where bids are not like-for-like. If only one bid exists, evaluate it on its own merits and say what benchmark is missing.

Return ONLY valid JSON:
{
  "matrix": [ { "responseId": <id>, "contractorName": "", "scores": { "price": 0-10, "programme": 0-10, "completeness": 0-10, "experience": 0-10, "risk": 0-10 }, "weightedTotal": 0-100, "headline": "1-sentence verdict", "strengths": ["..."], "concerns": ["..."] } ],
  "ranking": [responseId in order, best first],
  "notLikeForLike": ["differences that skew comparison"],
  "clarificationsNeeded": [ { "contractorName": "", "questions": ["..."] } ],
  "recommendation": "3-5 sentence recommendation incl. next step",
  "weightsUsed": { "price": 35, "programme": 15, "completeness": 20, "experience": 15, "risk": 15 }
}`;

  try {
    const raw = await claudeComplete({ messages: [{ role: "user", content: prompt }], maxTokens: 8000, jsonOnly: true });
    const evaluation = JSON.parse(raw);
    await db.update(tenderPacksTable)
      .set({ evaluationJson: JSON.stringify(evaluation), status: "evaluated", updatedAt: new Date() })
      .where(eq(tenderPacksTable.id, id));
    // store each response's score
    const matrix: { responseId: number }[] = evaluation.matrix ?? [];
    for (const m of matrix) {
      await db.update(tenderResponsesTable)
        .set({ scoreJson: JSON.stringify(m), updatedAt: new Date() })
        .where(eq(tenderResponsesTable.id, m.responseId));
    }
    res.json({ evaluation });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Evaluation failed";
    res.status(msg.includes("ANTHROPIC_API_KEY") ? 503 : 500).json({ error: msg });
  }
});

// ─── Quote comparison (per-supplier) ─────────────────────────────────────────

router.post("/projects/:projectId/suppliers/:supplierId/quote-review", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const supplierId = parseInt(req.params.supplierId);

  const [supplier] = await db
    .select()
    .from(suppliersTable)
    .where(and(eq(suppliersTable.id, supplierId), eq(suppliersTable.projectId, projectId)));
  if (!supplier) return res.status(404).json({ error: "Supplier not found." });

  const quotes = await db
    .select()
    .from(supplierQuotesTable)
    .where(eq(supplierQuotesTable.supplierId, supplierId));
  if (quotes.length < 2) {
    return res.status(400).json({ error: "Need at least 2 quotes to compare." });
  }

  const quoteLines = quotes
    .map((q, i) => `QUOTE ${i + 1} [id ${q.id}] — "${q.description ?? "no description"}"
  Amount: £${q.amountGbp ?? "?"} ${q.vatIncluded ? "(VAT included)" : "(VAT treatment not stated)"}
  Status: ${q.status}${q.validUntil ? ` · valid until ${q.validUntil}` : ""}${q.receivedAt ? ` · received ${q.receivedAt}` : ""}
  Notes: ${q.notes ?? "—"}`)
    .join("\n\n");

  const prompt = `You are a hard-nosed UK procurement adviser helping a small business owner compare contractor quotes for a clinic fit-out in Winchester. Package: "${supplier.name}" (category: ${supplier.category}). Client budget-conscious but quality matters (premium clinic, CQC-regulated activities planned).

THE QUOTES HELD FOR THIS PACKAGE:
${quoteLines}

Compare them honestly. Watch for: quotes that aren't like-for-like, missing VAT treatment, suspiciously low/high pricing vs the others, vague descriptions hiding scope gaps, expired validity. Do not invent details not present. Where information is missing, say so.

Return ONLY valid JSON:
{
  "summary": "3-4 sentence plain-English comparison verdict",
  "perQuote": [ { "id": <quote id>, "label": "short label", "read": "1-2 sentence honest read", "concerns": ["..."] } ],
  "outliers": ["which quotes look out of line and why"],
  "missingInfo": ["information missing across the quotes that prevents a fair comparison"],
  "questionsToAsk": ["specific questions, worded ready to send"],
  "negotiationAngles": ["realistic levers"],
  "suggestedNextStep": "single clearest next action"
}`;

  try {
    const raw = await claudeComplete({ messages: [{ role: "user", content: prompt }], maxTokens: 5000, jsonOnly: true });
    let review: Record<string, unknown>;
    try {
      review = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "AI returned an unreadable review. Please try again." });
    }
    return res.json({ review, quoteCount: quotes.length, generatedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Quote review failed";
    const status = msg.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return res.status(status).json({ error: msg });
  }
});

// ─── Invoice extraction (Record Spend prefill) ───────────────────────────────

router.post("/projects/:projectId/invoice-extract", memUpload.single("file"), async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded." });

  const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const isPdf = file.mimetype === "application/pdf";
  if (!isPdf && !IMAGE_TYPES.has(file.mimetype)) {
    return res.status(400).json({ error: "Accepted types: PDF, JPG, PNG, WebP, GIF." });
  }

  const tasks = await db
    .select({ id: tasksTable.id, title: tasksTable.title, phaseName: phasesTable.name })
    .from(tasksTable)
    .innerJoin(phasesTable, eq(phasesTable.id, tasksTable.phaseId))
    .where(and(eq(phasesTable.projectId, projectId), eq(phasesTable.status, "active")));
  const taskList = tasks.map(t => `${t.id}: ${t.title} (${t.phaseName})`).join("\n");

  const promptText = `Extract the key details from this invoice/receipt for a clinic fit-out project's spend tracker.

PROJECT TASKS (for matching — pick the single most likely task this invoice belongs to):
${taskList}

Rules: extract only what is visibly on the document; use null for anything not present. Amounts as plain numbers (no £, no commas). Dates as YYYY-MM-DD. For suggestedTaskId choose from the ids above or null if no reasonable match.

Return ONLY valid JSON:
{
  "supplierName": "who issued the invoice, or null",
  "invoiceRef": "invoice/receipt number, or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "totalGbp": number or null,
  "vatGbp": number or null,
  "vatIncluded": true if the total includes VAT, false if ex-VAT, null if unclear,
  "description": "1 sentence: what was bought/done",
  "suggestedTaskId": number or null,
  "matchReason": "why that task, or null",
  "confidence": "high | medium | low"
}`;

  const source = { type: "base64" as const, media_type: file.mimetype as never, data: file.buffer.toString("base64") };
  const docBlock = isPdf
    ? { type: "document" as const, source: { ...source, media_type: "application/pdf" as const } }
    : { type: "image" as const, source };

  try {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 240_000);
    const response = await anthropic.messages.create(
      {
        model: "claude-opus-4-8",
        max_tokens: 9000,
        thinking: { type: "adaptive" },
        messages: [{ role: "user", content: [docBlock as never, { type: "text", text: promptText }] }],
      },
      { signal: abort.signal },
    );
    clearTimeout(timeout);
    const text = response.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map(b => b.text)
      .join("");
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    const extracted = JSON.parse(start !== -1 && end > start ? clean.slice(start, end + 1) : clean);
    return res.json({ extracted, filename: file.originalname });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invoice extraction failed";
    const status = msg.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return res.status(status).json({ error: msg });
  }
});

export default router;
