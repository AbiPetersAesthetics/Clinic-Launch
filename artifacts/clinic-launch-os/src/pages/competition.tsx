import { useState, useEffect, useMemo } from "react";
import {
  Target, Plus, Edit, Trash2, Star, MapPin, Globe, Phone, Instagram,
  Shield, ChevronDown, ChevronUp, X, Bookmark, BookmarkCheck, ExternalLink,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, BarChart3,
  Eye, Search, Info, Users,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Leaflet icon fix ────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PROJECT_ID = 1;
const API_BASE = "/api";
const CLINIC_LAT = 51.0638;
const CLINIC_LNG = -1.3082;

// ── Types ───────────────────────────────────────────────────────────────────
interface Competitor {
  id: number; projectId: number;
  name: string; address: string; lat: string; lng: string; distanceMiles: string;
  website: string; bookingLink: string; phone: string; instagram: string; facebook: string;
  googleRating: string; googleReviewCount: number;
  premisesType: string; clinicType: string; practitionerType: string;
  positioningCategory: string; targetAudience: string;
  saveFace: boolean; jccp: boolean; independentPrescriber: boolean; nhsBackground: boolean;
  yearsExperience: number; credentialsNotes: string;
  clinicalAuthorityScore: number; trustScore: number; brandStrengthScore: number; premisesStrengthScore: number;
  instagramFollowers: number; postingFrequency: string; contentQualityScore: number; beforeAfterUse: boolean;
  pricingJson: string; treatmentsJson: string; heroTreatments: string;
  strengthsJson: string; weaknessesJson: string;
  reviewSentimentSummary: string; commonPraiseJson: string; commonComplaintsJson: string;
  googleKeywordsJson: string;
  manuallyVerified: boolean; confidenceLevel: string; sourceLinks: string; lastChecked: string;
  onWatchlist: boolean; watchlistChangesJson: string; notes: string;
  createdAt: string; updatedAt: string;
}

type FormData = Partial<Omit<Competitor, "id" | "projectId" | "createdAt" | "updatedAt">>;

// ── Constants ────────────────────────────────────────────────────────────────
const TREATMENT_KEYS = [
  { key: "antiWrinkle1", label: "Anti-wrinkle (1 area)", cat: "Injectables", apaPrice: 200 },
  { key: "antiWrinkle2", label: "Anti-wrinkle (2 areas)", cat: "Injectables", apaPrice: 280 },
  { key: "antiWrinkle3", label: "Anti-wrinkle (3 areas)", cat: "Injectables", apaPrice: 350 },
  { key: "lipFiller05", label: "Lip filler 0.5ml", cat: "Injectables", apaPrice: 280 },
  { key: "lipFiller1", label: "Lip filler 1ml", cat: "Injectables", apaPrice: 350 },
  { key: "cheekFiller", label: "Cheek filler 1ml", cat: "Injectables", apaPrice: 350 },
  { key: "jawChin", label: "Jaw/chin filler", cat: "Injectables", apaPrice: 380 },
  { key: "tearTrough", label: "Tear trough", cat: "Injectables", apaPrice: 400 },
  { key: "skinBooster", label: "Skin booster", cat: "Skin", apaPrice: 300 },
  { key: "profhilo", label: "Profhilo (2 sessions)", cat: "Skin", apaPrice: 650 },
  { key: "polynucleotides", label: "Polynucleotides", cat: "Skin", apaPrice: 350 },
  { key: "microneedling", label: "Microneedling", cat: "Skin", apaPrice: 200 },
  { key: "chemicalPeel", label: "Chemical peel", cat: "Skin", apaPrice: 150 },
  { key: "laser", label: "Laser treatment", cat: "Laser", apaPrice: 0 },
  { key: "consultation", label: "Consultation", cat: "Admin", apaPrice: 0 },
  { key: "membership", label: "Membership / package", cat: "Admin", apaPrice: 0 },
];

const APA_PROFILE = {
  name: "Abi Peters Aesthetics",
  clinicType: "nurse-led", premisesType: "high street shopfront",
  positioningCategory: "natural-results nurse-led clinic",
  googleRating: 4.9, googleReviewCount: 127,
  clinicalAuthorityScore: 92, trustScore: 88, brandStrengthScore: 75, premisesStrengthScore: 80,
  instagramFollowers: 2400, saveFace: true, jccp: true, independentPrescriber: true, nhsBackground: true,
  yearsExperience: 12,
};

const PREMISES_TYPES = [
  "high street shopfront","medical clinic","rented room","beauty salon room",
  "home clinic","dental clinic","chain clinic","destination clinic","unknown",
];
const CLINIC_TYPES = [
  "nurse-led","doctor-led","dentist-led","beautician-led","mixed practitioner",
  "laser/skin specialist","injectables-only","salon-led aesthetics","chain/brand clinic","unknown",
];
const POSITIONING_CATEGORIES = [
  "luxury medical clinic","natural-results nurse-led clinic","doctor-led premium clinic",
  "beauty salon aesthetics","budget injector","skin/laser specialist","holistic wellness clinic",
  "chain clinic","home-based trusted local","social-media-led injector",
];
const POSTING_FREQS = ["daily","several times/week","weekly","fortnightly","monthly","rarely","unknown"];
const CONFIDENCE_LEVELS = ["Verified","Likely","Unclear","Not found"];
const GOOGLE_KEYWORDS = [
  "Botox Winchester","anti-wrinkle injections Winchester","lip filler Winchester",
  "dermal filler Winchester","Profhilo Winchester","polynucleotides Winchester",
  "microneedling Winchester","skin clinic Winchester","aesthetics clinic Winchester",
  "nurse injector Winchester",
];

// ── Score utilities ──────────────────────────────────────────────────────────
function parseJson<T>(s: string | null | undefined, fallback: T): T {
  try { return JSON.parse(s || "") ?? fallback; } catch { return fallback; }
}

function computeThreatScore(c: Competitor): number {
  const dist = parseFloat(c.distanceMiles) || 5;
  const proxScore = dist <= 0.25 ? 100 : dist <= 0.5 ? 88 : dist <= 1 ? 76 : dist <= 2 ? 62 : dist <= 3 ? 48 : dist <= 5 ? 32 : 18;
  const credScore = c.clinicalAuthorityScore;
  const rating = parseFloat(c.googleRating) || 0;
  const reviewScore = Math.min(((rating / 5) * 60 + Math.min((c.googleReviewCount || 0) / 300, 1) * 40), 100);
  const theirTreatments: string[] = parseJson(c.treatmentsJson, []);
  const overlapScore = TREATMENT_KEYS.length > 0 ? (theirTreatments.filter(t => TREATMENT_KEYS.find(tk => tk.key === t)).length / TREATMENT_KEYS.length) * 100 : 50;
  const brandScore = c.brandStrengthScore;
  const pricing: Record<string, number> = parseJson(c.pricingJson, {});
  let pricingThreat = 50;
  if (pricing.antiWrinkle1 && pricing.antiWrinkle1 > 0) {
    const r = pricing.antiWrinkle1 / 200;
    pricingThreat = r < 0.75 ? 90 : r < 0.9 ? 70 : r < 1.0 ? 55 : r > 1.15 ? 20 : 40;
  }
  const premScore = c.premisesStrengthScore;
  const socialScore = Math.min((c.instagramFollowers || 0) / 5000, 1) * 100;
  return Math.round(proxScore * 0.15 + credScore * 0.15 + reviewScore * 0.15 + overlapScore * 0.15 + brandScore * 0.15 + pricingThreat * 0.10 + premScore * 0.10 + socialScore * 0.05);
}

function getRAG(score: number) {
  if (score >= 68) return { label: "High Threat", color: "#ef4444", bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-500" };
  if (score >= 42) return { label: "Moderate", color: "#f59e0b", bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-500" };
  return { label: "Low Threat", color: "#22c55e", bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-500" };
}

function competitorPos(c: Competitor, i: number): [number, number] {
  if (c.lat && c.lng && parseFloat(c.lat)) return [parseFloat(c.lat), parseFloat(c.lng)];
  const dist = parseFloat(c.distanceMiles) || 2;
  const angle = ((i * 137.508) % 360) * (Math.PI / 180);
  return [CLINIC_LAT + (dist / 69) * Math.cos(angle), CLINIC_LNG + (dist / (69 * Math.cos(CLINIC_LAT * Math.PI / 180))) * Math.sin(angle)];
}

function createThreatIcon(score: number) {
  const rag = getRAG(score);
  return L.divIcon({
    html: `<div style="background:${rag.color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7], className: "",
  });
}
const APA_ICON = L.divIcon({
  html: `<div style="background:#0d9488;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;color:white">A</div>`,
  iconSize: [20, 20], iconAnchor: [10, 10], className: "",
});

// ── Market gap signals ───────────────────────────────────────────────────────
const GAP_SIGNALS = [
  { id: "nurse_ip", label: "Nurse-led ANP/IP authority", cat: "Opportunity", icon: "🏥",
    desc: "Independent Prescriber-led clinical authority — rare in aesthetics",
    eval: (cs: Competitor[]) => { const n = cs.filter(c => c.clinicType === "nurse-led" && c.independentPrescriber).length; const s = Math.round((1 - n / Math.max(cs.length,1)) * 100); return { gap: s > 60, score: s, detail: `${n} of ${cs.length} competitors are nurse-led prescribers` }; } },
  { id: "save_face", label: "Save Face accreditation", cat: "Trust", icon: "🛡️",
    desc: "Save Face is the gold standard trust signal in medical aesthetics",
    eval: (cs: Competitor[]) => { const n = cs.filter(c => c.saveFace).length; const s = Math.round((1 - n / Math.max(cs.length,1)) * 100); return { gap: s > 55, score: s, detail: `${n} of ${cs.length} competitors are Save Face registered` }; } },
  { id: "polynucleotides", label: "Polynucleotides specialist", cat: "Treatment",  icon: "💉",
    desc: "Polynucleotides appear under-marketed locally — education-led content opportunity",
    eval: (cs: Competitor[]) => { const n = cs.filter(c => parseJson<string[]>(c.treatmentsJson,[]).includes("polynucleotides")).length; const s = Math.round((1 - n / Math.max(cs.length,1)) * 100); return { gap: s > 55, score: s, detail: `${n} of ${cs.length} competitors offer polynucleotides` }; } },
  { id: "premium_price", label: "Premium pricing headroom", cat: "Pricing", icon: "💷",
    desc: "If competitors are cheap, APA has clear room to command premium rates",
    eval: (cs: Competitor[]) => { const priced = cs.filter(c => parseJson<Record<string,number>>(c.pricingJson,{}).antiWrinkle1 > 0); if (!priced.length) return { gap: true, score: 70, detail: "No competitor pricing entered yet" }; const avg = priced.reduce((s,c) => s + (parseJson<Record<string,number>>(c.pricingJson,{}).antiWrinkle1||0),0)/priced.length; const score = avg < 150 ? 90 : avg < 175 ? 70 : avg < 200 ? 45 : 25; return { gap: score > 50, score, detail: `Avg competitor anti-wrinkle 1 area: £${Math.round(avg)} vs APA target £200` }; } },
  { id: "review_volume", label: "Google review dominance", cat: "Trust", icon: "⭐",
    desc: "APA can bring 127 reviews from Bedhampton — instant local authority",
    eval: (cs: Competitor[]) => { const n = cs.filter(c => c.googleReviewCount > 100).length; const s = Math.round((1 - n / Math.max(cs.length,1)) * 100); return { gap: s > 55, score: s, detail: `${n} of ${cs.length} competitors have 100+ Google reviews` }; } },
  { id: "natural_results", label: "Natural-results positioning", cat: "Opportunity", icon: "🌿",
    desc: "Safety-conscious clients seeking natural results are underserved by discount injectors",
    eval: (cs: Competitor[]) => { const n = cs.filter(c => c.positioningCategory === "natural-results nurse-led clinic").length; const s = Math.round((1 - n / Math.max(cs.length,1)) * 100); return { gap: s > 70, score: s, detail: `${n} of ${cs.length} competitors hold this positioning` }; } },
  { id: "male_aesthetics", label: "Male aesthetics offering", cat: "Treatment", icon: "👨",
    desc: "Male aesthetics is an underserved, fast-growing segment rarely marketed locally",
    eval: (_cs: Competitor[]) => ({ gap: true, score: 80, detail: "Male aesthetics marketing is rarely prominent locally" }) },
];

// ── Empty form defaults ──────────────────────────────────────────────────────
const EMPTY_FORM: FormData = {
  name:"", address:"", lat:"", lng:"", distanceMiles:"", website:"", bookingLink:"",
  phone:"", instagram:"", facebook:"", googleRating:"", googleReviewCount:0,
  premisesType:"unknown", clinicType:"unknown", practitionerType:"", positioningCategory:"",
  targetAudience:"", saveFace:false, jccp:false, independentPrescriber:false, nhsBackground:false,
  yearsExperience:0, credentialsNotes:"",
  clinicalAuthorityScore:50, trustScore:50, brandStrengthScore:50, premisesStrengthScore:50,
  instagramFollowers:0, postingFrequency:"unknown", contentQualityScore:3, beforeAfterUse:false,
  pricingJson:"{}", treatmentsJson:"[]", heroTreatments:"",
  strengthsJson:"[]", weaknessesJson:"[]",
  reviewSentimentSummary:"", commonPraiseJson:"[]", commonComplaintsJson:"[]",
  googleKeywordsJson:"[]",
  manuallyVerified:false, confidenceLevel:"Unclear", sourceLinks:"", lastChecked:"",
  onWatchlist:false, watchlistChangesJson:"[]", notes:"",
};

// ── Competitor Form Modal ────────────────────────────────────────────────────
function CompetitorModal({ competitor, onClose, onSave }: {
  competitor: Competitor | null; onClose: () => void; onSave: (data: FormData) => Promise<void>;
}) {
  const [form, setForm] = useState<FormData>(competitor ? { ...competitor } : { ...EMPTY_FORM });
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormData, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const pricing: Record<string,number> = parseJson(form.pricingJson as string, {});
  const treatments: string[] = parseJson(form.treatmentsJson as string, []);
  const strengths: string[] = parseJson(form.strengthsJson as string, []);
  const weaknesses: string[] = parseJson(form.weaknessesJson as string, []);
  const praise: string[] = parseJson(form.commonPraiseJson as string, []);
  const complaints: string[] = parseJson(form.commonComplaintsJson as string, []);
  const keywords: string[] = parseJson(form.googleKeywordsJson as string, []);

  const setPricing = (k: string, v: number) => set("pricingJson", JSON.stringify({ ...pricing, [k]: v }));
  const toggleTreatment = (k: string) => set("treatmentsJson", JSON.stringify(treatments.includes(k) ? treatments.filter(t=>t!==k) : [...treatments, k]));
  const addTag = (field: "strengthsJson"|"weaknessesJson"|"commonPraiseJson"|"commonComplaintsJson", val: string) => {
    if (!val.trim()) return; const arr = parseJson(form[field] as string,[]); set(field, JSON.stringify([...arr, val.trim()]));
  };
  const removeTag = (field: "strengthsJson"|"weaknessesJson"|"commonPraiseJson"|"commonComplaintsJson", idx: number) => {
    const arr = parseJson(form[field] as string,[]); arr.splice(idx,1); set(field, JSON.stringify(arr));
  };
  const toggleKeyword = (k: string) => set("googleKeywordsJson", JSON.stringify(keywords.includes(k) ? keywords.filter(kw=>kw!==k) : [...keywords, k]));

  const handleSave = async () => { setSaving(true); try { await onSave(form); } finally { setSaving(false); } };

  const TABS = ["Identity","Profile","Reviews","Pricing","Analysis","Data Quality"];
  const inputCls = "w-full text-sm bg-muted border border-border rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "block text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1";
  const checkCls = "w-4 h-4 accent-teal-600 cursor-pointer";
  const scoreCls = "w-full accent-teal-600 cursor-pointer";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8">
      <div className="relative bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">{competitor ? "Edit Competitor" : "Add Competitor"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">All information is for internal strategic use only</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex border-b border-border overflow-x-auto">
          {TABS.map((t,i) => (
            <button key={t} onClick={() => setTab(i)} className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${tab===i ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {tab === 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className={labelCls}>Clinic Name *</label><input className={inputCls} value={form.name||""} onChange={e=>set("name",e.target.value)} placeholder="e.g. Winchester Aesthetics Clinic" /></div>
              <div className="col-span-2"><label className={labelCls}>Address</label><input className={inputCls} value={form.address||""} onChange={e=>set("address",e.target.value)} placeholder="Full address" /></div>
              <div><label className={labelCls}>Distance (miles)</label><input type="number" step="0.1" className={inputCls} value={form.distanceMiles||""} onChange={e=>set("distanceMiles",e.target.value)} placeholder="e.g. 0.5" /></div>
              <div><label className={labelCls}>Google Rating</label><input type="number" step="0.1" min="1" max="5" className={inputCls} value={form.googleRating||""} onChange={e=>set("googleRating",e.target.value)} placeholder="4.8" /></div>
              <div><label className={labelCls}>Website</label><input className={inputCls} value={form.website||""} onChange={e=>set("website",e.target.value)} placeholder="https://..." /></div>
              <div><label className={labelCls}>Booking Link</label><input className={inputCls} value={form.bookingLink||""} onChange={e=>set("bookingLink",e.target.value)} placeholder="Fresha / Timely / etc." /></div>
              <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.phone||""} onChange={e=>set("phone",e.target.value)} /></div>
              <div><label className={labelCls}>Instagram</label><input className={inputCls} value={form.instagram||""} onChange={e=>set("instagram",e.target.value)} placeholder="@handle" /></div>
              <div><label className={labelCls}>Instagram Followers</label><input type="number" className={inputCls} value={form.instagramFollowers||0} onChange={e=>set("instagramFollowers",parseInt(e.target.value)||0)} /></div>
              <div><label className={labelCls}>Lat / Lng (optional)</label><div className="flex gap-2"><input className={inputCls} value={form.lat||""} onChange={e=>set("lat",e.target.value)} placeholder="51.063" /><input className={inputCls} value={form.lng||""} onChange={e=>set("lng",e.target.value)} placeholder="-1.308" /></div></div>
            </div>
          )}
          {tab === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Premises Type</label><select className={inputCls} value={form.premisesType||"unknown"} onChange={e=>set("premisesType",e.target.value)}>{PREMISES_TYPES.map(p=><option key={p}>{p}</option>)}</select></div>
                <div><label className={labelCls}>Clinic Type</label><select className={inputCls} value={form.clinicType||"unknown"} onChange={e=>set("clinicType",e.target.value)}>{CLINIC_TYPES.map(p=><option key={p}>{p}</option>)}</select></div>
                <div><label className={labelCls}>Positioning</label><select className={inputCls} value={form.positioningCategory||""} onChange={e=>set("positioningCategory",e.target.value)}><option value="">Select...</option>{POSITIONING_CATEGORIES.map(p=><option key={p}>{p}</option>)}</select></div>
                <div><label className={labelCls}>Practitioner Type</label><input className={inputCls} value={form.practitionerType||""} onChange={e=>set("practitionerType",e.target.value)} placeholder="e.g. RGN, ANP, Doctor" /></div>
                <div><label className={labelCls}>Years Experience</label><input type="number" className={inputCls} value={form.yearsExperience||0} onChange={e=>set("yearsExperience",parseInt(e.target.value)||0)} /></div>
                <div><label className={labelCls}>Target Audience</label><input className={inputCls} value={form.targetAudience||""} onChange={e=>set("targetAudience",e.target.value)} placeholder="e.g. 30s-50s professional females" /></div>
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Credentials & Accreditations</label>
                {[["saveFace","Save Face registered"],["jccp","JCCP registered"],["independentPrescriber","Independent Prescriber"],["nhsBackground","NHS / medical background"]].map(([k,l]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" className={checkCls} checked={!!(form[k as keyof FormData])} onChange={e=>set(k as keyof FormData, e.target.checked)} />{l}</label>
                ))}
              </div>
              <div><label className={labelCls}>Credentials Notes</label><textarea className={inputCls} rows={2} value={form.credentialsNotes||""} onChange={e=>set("credentialsNotes",e.target.value)} placeholder="Any notes about qualifications or governance — use 'Not clearly evidenced online' if uncertain" /></div>
            </div>
          )}
          {tab === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Google Reviews Count</label><input type="number" className={inputCls} value={form.googleReviewCount||0} onChange={e=>set("googleReviewCount",parseInt(e.target.value)||0)} /></div>
                <div><label className={labelCls}>Posting Frequency</label><select className={inputCls} value={form.postingFrequency||"unknown"} onChange={e=>set("postingFrequency",e.target.value)}>{POSTING_FREQS.map(f=><option key={f}>{f}</option>)}</select></div>
                <div><label className={labelCls}>Content Quality (1–5)</label><input type="range" min={1} max={5} className={scoreCls} value={form.contentQualityScore||3} onChange={e=>set("contentQualityScore",parseInt(e.target.value))} /><p className="text-xs text-muted-foreground mt-1 text-center">{form.contentQualityScore}/5</p></div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" className={checkCls} checked={!!(form.beforeAfterUse)} onChange={e=>set("beforeAfterUse",e.target.checked)} />Uses before/after content on social</label>
              <div><label className={labelCls}>Review Sentiment Summary</label><textarea className={inputCls} rows={2} value={form.reviewSentimentSummary||""} onChange={e=>set("reviewSentimentSummary",e.target.value)} placeholder="e.g. Clients praise natural results and friendly service..." /></div>
              <TagField label="Common Praise Themes" items={praise} onAdd={v=>addTag("commonPraiseJson",v)} onRemove={i=>removeTag("commonPraiseJson",i)} placeholder="e.g. natural results" />
              <TagField label="Common Complaint Themes" items={complaints} onAdd={v=>addTag("commonComplaintsJson",v)} onRemove={i=>removeTag("commonComplaintsJson",i)} placeholder="e.g. hard to book" />
              <div>
                <label className={labelCls}>Google Search Visibility</label>
                <div className="flex flex-wrap gap-2 mt-1">{GOOGLE_KEYWORDS.map(k=>(
                  <button key={k} onClick={()=>toggleKeyword(k)} className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${keywords.includes(k) ? "bg-primary/20 border-primary/50 text-primary" : "bg-muted border-border text-muted-foreground hover:border-primary/30"}`}>{k}</button>
                ))}</div>
              </div>
            </div>
          )}
          {tab === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Enter prices where known. Leave blank / 0 if not offered or unknown.</p>
              {["Injectables","Skin","Laser","Admin"].map(cat => (
                <div key={cat}>
                  <label className={labelCls}>{cat}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TREATMENT_KEYS.filter(t=>t.cat===cat).map(t=>(
                      <div key={t.key} className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground w-5 cursor-pointer shrink-0">
                          <input type="checkbox" className={checkCls} checked={treatments.includes(t.key)} onChange={()=>toggleTreatment(t.key)} />
                        </label>
                        <span className="text-xs flex-1 leading-tight">{t.label}</span>
                        <div className="relative w-24 shrink-0">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span>
                          <input type="number" className="w-full text-xs bg-muted border border-border rounded-md pl-5 pr-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" value={pricing[t.key]||""} onChange={e=>setPricing(t.key, parseFloat(e.target.value)||0)} placeholder={t.apaPrice > 0 ? String(t.apaPrice) : "—"} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div><label className={labelCls}>Hero / Lead Treatments</label><input className={inputCls} value={form.heroTreatments||""} onChange={e=>set("heroTreatments",e.target.value)} placeholder="e.g. Lip filler, anti-wrinkle, skin boosters" /></div>
            </div>
          )}
          {tab === 4 && (
            <div className="space-y-4">
              {[
                {k:"clinicalAuthorityScore" as const, label:"Clinical Authority Score"},
                {k:"trustScore" as const, label:"Trust Score"},
                {k:"brandStrengthScore" as const, label:"Brand Strength Score"},
                {k:"premisesStrengthScore" as const, label:"Premises Strength Score"},
              ].map(({k,label}) => (
                <div key={k}><label className={labelCls}>{label} (0–100)</label><input type="range" min={0} max={100} className={scoreCls} value={(form[k] as number)||50} onChange={e=>set(k,parseInt(e.target.value))} /><p className="text-xs text-muted-foreground text-center mt-0.5">{(form[k] as number)||50}/100</p></div>
              ))}
              <TagField label="Key Strengths" items={strengths} onAdd={v=>addTag("strengthsJson",v)} onRemove={i=>removeTag("strengthsJson",i)} placeholder="e.g. Strong Instagram presence" />
              <TagField label="Key Weaknesses" items={weaknesses} onAdd={v=>addTag("weaknessesJson",v)} onRemove={i=>removeTag("weaknessesJson",i)} placeholder="e.g. No Save Face accreditation" />
            </div>
          )}
          {tab === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Confidence Level</label><select className={inputCls} value={form.confidenceLevel||"Unclear"} onChange={e=>set("confidenceLevel",e.target.value)}>{CONFIDENCE_LEVELS.map(l=><option key={l}>{l}</option>)}</select></div>
                <div><label className={labelCls}>Last Checked</label><input type="date" className={inputCls} value={form.lastChecked||""} onChange={e=>set("lastChecked",e.target.value)} /></div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" className={checkCls} checked={!!(form.manuallyVerified)} onChange={e=>set("manuallyVerified",e.target.checked)} />Manually verified</label>
              <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" className={checkCls} checked={!!(form.onWatchlist)} onChange={e=>set("onWatchlist",e.target.checked)} />Add to watchlist</label>
              <div><label className={labelCls}>Source Links</label><textarea className={inputCls} rows={2} value={form.sourceLinks||""} onChange={e=>set("sourceLinks",e.target.value)} placeholder="Website URL, Instagram link, Google Maps link..." /></div>
              <div><label className={labelCls}>Internal Notes</label><textarea className={inputCls} rows={3} value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Any additional strategic notes..." /></div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border gap-3">
          <div className="flex gap-2">
            {tab > 0 && <button onClick={()=>setTab(t=>t-1)} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border">← Back</button>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-1.5 rounded-md border border-border">Cancel</button>
            {tab < TABS.length - 1
              ? <button onClick={()=>setTab(t=>t+1)} className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-md font-medium hover:bg-primary/90">Next →</button>
              : <button onClick={handleSave} disabled={saving || !form.name} className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50">{saving?"Saving…":"Save Competitor"}</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tag field helper ─────────────────────────────────────────────────────────
function TagField({ label, items, onAdd, onRemove, placeholder }: { label: string; items: string[]; onAdd:(v:string)=>void; onRemove:(i:number)=>void; placeholder: string; }) {
  const [input, setInput] = useState("");
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">{items.map((item,i)=>(
        <span key={i} className="flex items-center gap-1 text-xs bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded-full">
          {item}<button onClick={()=>onRemove(i)} className="ml-0.5 hover:text-red-400"><X className="w-3 h-3" /></button>
        </span>
      ))}</div>
      <div className="flex gap-2"><input className="flex-1 text-sm bg-muted border border-border rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ onAdd(input); setInput(""); }}} placeholder={placeholder} /><button onClick={()=>{ onAdd(input); setInput(""); }} className="text-xs bg-muted border border-border px-3 py-1.5 rounded-md hover:bg-muted/70">+ Add</button></div>
    </div>
  );
}

// ── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score, max=100, color }: { score: number; max?: number; color: string }) {
  return <div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width:`${(score/max)*100}%`, background:color }} /></div><span className="text-xs font-medium tabular-nums w-8 text-right">{score}</span></div>;
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ competitors, onEdit, onAdd }: { competitors: Competitor[]; onEdit:(c:Competitor)=>void; onAdd:()=>void; }) {
  const scored = useMemo(() => [...competitors].map(c=>({...c, score: computeThreatScore(c)})).sort((a,b)=>b.score-a.score), [competitors]);
  const avgGoogle = competitors.length ? (competitors.reduce((s,c)=>s+(parseFloat(c.googleRating)||0),0)/competitors.length).toFixed(1) : "—";
  const topThreat = scored[0];
  const gapResults = GAP_SIGNALS.map(g=>({ ...g, result: g.eval(competitors) })).sort((a,b)=>b.result.score-a.result.score);
  const topOpps = gapResults.filter(g=>g.result.gap).slice(0,3);
  const marketSpaceScore = competitors.length ? Math.round(gapResults.reduce((s,g)=>s+g.result.score,0)/gapResults.length) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:"Competitors Mapped", value:competitors.length, sub:"manual entries" },
          { label:"Market Space Score", value:competitors.length ? `${marketSpaceScore}/100` : "—", sub:"higher = more opportunity" },
          { label:"Avg Competitor Rating", value:avgGoogle, sub:"Google stars" },
          { label:"Top Threat", value:topThreat ? (topThreat.name.split(" ")[0]) : "None yet", sub:topThreat ? `${topThreat.score}/100` : "add competitors" },
        ].map(stat=>(
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{stat.label}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {competitors.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No competitors mapped yet</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">Start by adding the clinics and practitioners you've identified around Winchester.</p>
          <button onClick={onAdd} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-primary/90">+ Add First Competitor</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Threat Ranking</h3>
            <div className="space-y-2">
              {scored.map((c,i)=>{ const rag = getRAG(c.score); return (
                <button key={c.id} onClick={()=>onEdit(c)} className="w-full text-left bg-card border border-border hover:border-primary/40 rounded-xl p-3.5 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${i===0?"bg-red-500/15 text-red-500":i===1?"bg-amber-500/15 text-amber-500":"bg-muted text-muted-foreground"}`}>#{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.clinicType} · {c.distanceMiles ? `${c.distanceMiles}mi` : "dist. unknown"}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${rag.bg} ${rag.border} ${rag.text}`}>{c.score}</span>
                  </div>
                  <div className="mt-2"><ScoreBar score={c.score} color={rag.color} /></div>
                </button>
              );})}
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" />Top Market Opportunities</h3>
            <div className="space-y-2">
              {topOpps.map(g=>(
                <div key={g.id} className="bg-card border border-emerald-500/20 rounded-xl p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="text-lg leading-none mt-0.5">{g.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{g.label}</p>
                        <span className="text-xs font-bold text-emerald-500 shrink-0">{g.result.score}/100</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{g.desc}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 italic">{g.result.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
              {topOpps.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Add more competitors to compute gap analysis</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Competitors Tab ───────────────────────────────────────────────────────────
function CompetitorsTab({ competitors, onEdit, onDelete, onToggleWatchlist, onAdd }: {
  competitors: Competitor[]; onEdit:(c:Competitor)=>void; onDelete:(id:number)=>void; onToggleWatchlist:(c:Competitor)=>void; onAdd:()=>void;
}) {
  const [search, setSearch] = useState("");
  const filtered = competitors.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.address.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input className="w-full pl-9 pr-4 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search competitors…" /></div>
        <button onClick={onAdd} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"><Plus className="w-4 h-4" />Add</button>
      </div>
      {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No competitors found.</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(c=>{ const score = computeThreatScore(c); const rag = getRAG(score); const strengths = parseJson<string[]>(c.strengthsJson,[]); const weaknesses = parseJson<string[]>(c.weaknessesJson,[]); return (
          <div key={c.id} className={`bg-card border rounded-xl overflow-hidden ${rag.border}`}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm truncate">{c.name}</h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${rag.bg} ${rag.border} ${rag.text}`}>{rag.label}</span>
                    {c.manuallyVerified && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">Verified</span>}
                    {!c.manuallyVerified && <span className="text-[10px] bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-full">{c.confidenceLevel}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.address || "Address unknown"}{c.distanceMiles ? ` · ${c.distanceMiles}mi` : ""}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-lg font-bold ${rag.text}`}>{score}</span>
                  <span className="text-[10px] text-muted-foreground">threat</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {c.clinicType !== "unknown" && <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">{c.clinicType}</span>}
                {c.premisesType !== "unknown" && <span className="text-[10px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">{c.premisesType}</span>}
                {c.saveFace && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full">Save Face ✓</span>}
                {c.jccp && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full">JCCP ✓</span>}
                {c.independentPrescriber && <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">IP ✓</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {c.googleRating && <div className="text-center"><p className="text-xs text-muted-foreground">Rating</p><p className="font-semibold text-sm flex items-center justify-center gap-0.5"><Star className="w-3 h-3 text-amber-400 fill-amber-400" />{c.googleRating}</p></div>}
                {c.googleReviewCount > 0 && <div className="text-center"><p className="text-xs text-muted-foreground">Reviews</p><p className="font-semibold text-sm">{c.googleReviewCount}</p></div>}
                {c.instagramFollowers > 0 && <div className="text-center"><p className="text-xs text-muted-foreground">IG Followers</p><p className="font-semibold text-sm">{c.instagramFollowers >= 1000 ? `${(c.instagramFollowers/1000).toFixed(1)}k` : c.instagramFollowers}</p></div>}
              </div>
              {(strengths.length > 0 || weaknesses.length > 0) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {strengths.slice(0,2).map((s,i)=><div key={i} className="text-emerald-600 dark:text-emerald-400 truncate">+ {s}</div>)}
                  {weaknesses.slice(0,2).map((w,i)=><div key={i} className="text-red-500 truncate">− {w}</div>)}
                </div>
              )}
            </div>
            <div className="border-t border-border px-4 py-2 flex items-center gap-2 bg-muted/30">
              <button onClick={()=>onEdit(c)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><Edit className="w-3.5 h-3.5" />Edit</button>
              <button onClick={()=>onToggleWatchlist(c)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors ml-2">{c.onWatchlist ? <BookmarkCheck className="w-3.5 h-3.5 text-primary" /> : <Bookmark className="w-3.5 h-3.5" />}{c.onWatchlist?"Watching":"Watch"}</button>
              <div className="flex-1" />
              {c.website && <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground"><Globe className="w-3.5 h-3.5" /></a>}
              {c.instagram && <a href={`https://instagram.com/${c.instagram.replace("@","")}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground"><Instagram className="w-3.5 h-3.5" /></a>}
              <button onClick={()=>onDelete(c.id)} className="text-xs text-muted-foreground hover:text-red-500 transition-colors ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        );})}
      </div>
    </div>
  );
}

// ── Pricing Tab ───────────────────────────────────────────────────────────────
function PricingTab({ competitors }: { competitors: Competitor[] }) {
  const [catFilter, setCatFilter] = useState("all");
  const cats = ["all","Injectables","Skin","Laser"];
  const treatments = catFilter === "all" ? TREATMENT_KEYS.filter(t=>t.apaPrice>0) : TREATMENT_KEYS.filter(t=>t.cat===catFilter&&t.apaPrice>0);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {cats.map(c=><button key={c} onClick={()=>setCatFilter(c)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${catFilter===c?"bg-primary/20 border-primary/50 text-primary":"bg-muted border-border text-muted-foreground hover:border-primary/30"}`}>{c}</button>)}
      </div>
      {competitors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Add competitors to see pricing comparison.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 pr-4 text-xs text-muted-foreground font-medium uppercase tracking-wider w-40">Treatment</th>
                <th className="text-right py-3 px-3 text-xs font-bold text-primary uppercase tracking-wider whitespace-nowrap">APA (target)</th>
                {competitors.map(c=><th key={c.id} className="text-right py-3 px-3 text-xs text-muted-foreground font-medium uppercase tracking-wider whitespace-nowrap max-w-24">{c.name.split(" ")[0]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {treatments.map(t=>{
                const compPrices = competitors.map(c=>({ id:c.id, name:c.name, price: parseJson<Record<string,number>>(c.pricingJson,{})[t.key]||0 }));
                const validPrices = compPrices.filter(p=>p.price>0).map(p=>p.price);
                const minPrice = validPrices.length ? Math.min(...validPrices) : 0;
                const maxPrice = validPrices.length ? Math.max(...validPrices) : 0;
                return (
                  <tr key={t.key} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-sm">{t.label}</p>
                      {validPrices.length > 0 && <p className="text-[10px] text-muted-foreground">Market: £{minPrice}–£{maxPrice}</p>}
                    </td>
                    <td className="text-right py-3 px-3 font-bold text-primary">£{t.apaPrice}</td>
                    {competitors.map(c=>{ const p = parseJson<Record<string,number>>(c.pricingJson,{})[t.key]||0; const offered = parseJson<string[]>(c.treatmentsJson,[]).includes(t.key); return (
                      <td key={c.id} className="text-right py-3 px-3">
                        {p > 0 ? (
                          <span className={`font-medium ${p < t.apaPrice*0.85 ? "text-red-500" : p > t.apaPrice*1.1 ? "text-emerald-500" : "text-foreground"}`}>£{p}</span>
                        ) : offered ? <span className="text-xs text-muted-foreground">Offered</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                    );})}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center gap-6 text-xs text-muted-foreground pt-2 border-t border-border">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500/60 shrink-0" />Red = significantly cheaper than APA target</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500/60 shrink-0" />Green = more expensive than APA</div>
      </div>
    </div>
  );
}

// ── Comparison Tab ────────────────────────────────────────────────────────────
function ComparisonTab({ competitors }: { competitors: Competitor[] }) {
  const [selectedId, setSelectedId] = useState<number|null>(null);
  const selected = competitors.find(c=>c.id===selectedId) ?? (competitors[0] || null);

  if (!selected) return <div className="text-center py-12 text-muted-foreground text-sm">Add competitors to compare against APA.</div>;

  const dims = [
    { label:"Clinical Authority", apa:APA_PROFILE.clinicalAuthorityScore, comp:selected.clinicalAuthorityScore },
    { label:"Trust Score", apa:APA_PROFILE.trustScore, comp:selected.trustScore },
    { label:"Brand Strength", apa:APA_PROFILE.brandStrengthScore, comp:selected.brandStrengthScore },
    { label:"Premises Strength", apa:APA_PROFILE.premisesStrengthScore, comp:selected.premisesStrengthScore },
    { label:"Google Rating", apa:Math.round(APA_PROFILE.googleRating*20), comp:parseFloat(selected.googleRating)*20||0 },
    { label:"Review Volume", apa:Math.min(APA_PROFILE.googleReviewCount/3,100), comp:Math.min(selected.googleReviewCount/3,100) },
    { label:"Social Reach", apa:Math.min(APA_PROFILE.instagramFollowers/50,100), comp:Math.min((selected.instagramFollowers||0)/50,100) },
  ];
  const apaWins = dims.filter(d=>d.apa>=d.comp).length;
  const strengths = parseJson<string[]>(selected.strengthsJson,[]);
  const weaknesses = parseJson<string[]>(selected.weaknessesJson,[]);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Compare Against</label>
        <select className="text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" value={selected.id} onChange={e=>setSelectedId(parseInt(e.target.value))}>
          {competitors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center mb-2">
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4"><p className="text-xs text-muted-foreground mb-1">Abi Peters Aesthetics</p><p className="font-bold text-primary text-lg">APA</p></div>
        <div className="flex items-center justify-center"><p className="text-sm font-bold text-muted-foreground bg-card border border-border rounded-full w-12 h-12 flex items-center justify-center">{apaWins}/{dims.length}</p></div>
        <div className="bg-card border border-border rounded-xl p-4"><p className="text-xs text-muted-foreground mb-1 truncate">{selected.name}</p><p className="font-bold text-foreground text-lg">{computeThreatScore(selected)}</p></div>
      </div>
      <div className="space-y-3">
        {dims.map(d=>{ const apaWins = d.apa >= d.comp; return (
          <div key={d.label} className="flex items-center gap-3">
            <div className="w-36 text-right"><span className={`text-sm font-medium ${apaWins ? "text-primary":"text-muted-foreground"}`}>{Math.round(d.apa)}</span></div>
            <div className="flex-1">
              <p className="text-xs text-center text-muted-foreground mb-1">{d.label}</p>
              <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                <div className="flex-1 flex justify-end"><div className="h-full bg-primary rounded-l-full" style={{ width:`${Math.min(d.apa,100)}%` }} /></div>
                <div className="flex-1"><div className="h-full bg-border rounded-r-full" style={{ width:`${Math.min(d.comp,100)}%` }} /></div>
              </div>
            </div>
            <div className="w-36"><span className={`text-sm font-medium ${!apaWins ? "text-amber-500":"text-muted-foreground"}`}>{Math.round(d.comp)}</span></div>
          </div>
        );})}
      </div>
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Their Strengths</p>
          {strengths.length ? strengths.map((s,i)=><p key={i} className="text-sm text-amber-600 dark:text-amber-400 mb-1.5">⚠ {s}</p>) : <p className="text-sm text-muted-foreground italic">None recorded</p>}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Their Weaknesses</p>
          {weaknesses.length ? weaknesses.map((w,i)=><p key={i} className="text-sm text-emerald-600 dark:text-emerald-400 mb-1.5">✓ {w}</p>) : <p className="text-sm text-muted-foreground italic">None recorded</p>}
        </div>
      </div>
      {selected.reviewSentimentSummary && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">What Their Clients Value</p>
          <p className="text-sm italic text-muted-foreground">"{selected.reviewSentimentSummary}"</p>
        </div>
      )}
    </div>
  );
}

// ── Market Gap Tab ────────────────────────────────────────────────────────────
function MarketGapTab({ competitors }: { competitors: Competitor[] }) {
  const results = GAP_SIGNALS.map(g=>({ ...g, result: g.eval(competitors) }));
  const opportunities = results.filter(r=>r.result.gap);
  const crowded = results.filter(r=>!r.result.gap);
  const overallSpace = results.length ? Math.round(results.reduce((s,r)=>s+r.result.score,0)/results.length) : 0;

  const catColors: Record<string, string> = { "Opportunity":"bg-emerald-500/10 text-emerald-600 border-emerald-500/20","Trust":"bg-blue-500/10 text-blue-600 border-blue-500/20","Treatment":"bg-purple-500/10 text-purple-600 border-purple-500/20","Pricing":"bg-amber-500/10 text-amber-600 border-amber-500/20" };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-6">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" strokeDasharray={`${overallSpace} ${100-overallSpace}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center"><span className="text-lg font-bold">{overallSpace}</span></div>
        </div>
        <div>
          <p className="text-lg font-bold">Market Space Score</p>
          <p className="text-sm text-muted-foreground mt-1">{overallSpace >= 70 ? "Strong opportunity — market has clear gaps for APA to fill" : overallSpace >= 50 ? "Moderate opportunity — several differentiation paths available" : "Competitive market — APA must position very precisely"}</p>
          <p className="text-xs text-muted-foreground mt-1">{competitors.length === 0 ? "Add competitors to compute accurately" : `Based on ${competitors.length} competitor${competitors.length!==1?"s":""} mapped`}</p>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-600"><CheckCircle className="w-4 h-4" />Open Gaps — Where APA Can Win</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(opportunities.length ? opportunities : results).map(g=>(
            <div key={g.id} className="bg-card border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5">{g.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 justify-between flex-wrap mb-1">
                    <p className="font-medium text-sm">{g.label}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${catColors[g.cat]||""}`}>{g.cat}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{g.desc}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 italic">{g.result.detail}</p>
                  <div className="mt-2"><ScoreBar score={g.result.score} color="#22c55e" /></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {crowded.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-500"><AlertTriangle className="w-4 h-4" />Crowded Areas — Tread Carefully</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {crowded.map(g=>(
              <div key={g.id} className="bg-card border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none mt-0.5">{g.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm mb-1">{g.label}</p>
                    <p className="text-xs text-muted-foreground">{g.result.detail}</p>
                    <div className="mt-2"><ScoreBar score={100-g.result.score} color="#f59e0b" /></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">APA Recommended Positioning</p>
        <p className="text-sm leading-relaxed">Premium nurse-led medical aesthetics clinic with ANP/Independent Prescriber authority, natural-results focus, and strong clinical governance signals (Save Face, JCCP). Lead with medical credibility and social proof — not price. Own polynucleotides, skin quality, and under-eye ageing as education-led categories. Target safety-conscious professional clients who have been let down by budget injectors.</p>
      </div>
    </div>
  );
}

// ── Map Tab ───────────────────────────────────────────────────────────────────
function MapTab({ competitors }: { competitors: Competitor[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-teal-600 shrink-0 flex items-center justify-center text-white font-bold" style={{fontSize:8}}>A</span>9A Jewry Street (APA target)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />High threat (&gt;68)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />Moderate (42–68)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />Low (&lt;42)</div>
      </div>
      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 460 }}>
        <MapContainer center={[CLINIC_LAT, CLINIC_LNG]} zoom={13} style={{ height:"100%", width:"100%" }} scrollWheelZoom={false}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {[1, 3, 5].map(mi=>(
            <Circle key={mi} center={[CLINIC_LAT, CLINIC_LNG]} radius={mi * 1609.34} pathOptions={{ color:"#0d9488", weight:1, opacity:0.3, fillOpacity:0.04 }} />
          ))}
          <Marker position={[CLINIC_LAT, CLINIC_LNG]} icon={APA_ICON}>
            <Popup><div className="text-sm font-bold text-teal-700">APA Target Clinic</div><div className="text-xs text-gray-600 mt-1">9A Jewry Street, Winchester</div></Popup>
          </Marker>
          {competitors.map((c,i)=>{ const score = computeThreatScore(c); const pos = competitorPos(c,i); return (
            <Marker key={c.id} position={pos} icon={createThreatIcon(score)}>
              <Popup>
                <div className="text-sm font-bold">{c.name}</div>
                <div className="text-xs text-gray-600 mt-0.5">{c.clinicType}</div>
                {c.distanceMiles && <div className="text-xs mt-0.5">{c.distanceMiles} miles away</div>}
                <div className="text-xs font-semibold mt-1" style={{ color: getRAG(score).color }}>Threat score: {score} — {getRAG(score).label}</div>
                {c.googleRating && <div className="text-xs mt-0.5">⭐ {c.googleRating} ({c.googleReviewCount} reviews)</div>}
              </Popup>
            </Marker>
          );})}
        </MapContainer>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
        {[1,3,5].map(mi=>{
          const count = competitors.filter(c=>(parseFloat(c.distanceMiles)||99)<=mi).length;
          return <div key={mi} className="bg-card border border-border rounded-lg py-2"><p className="font-bold text-foreground text-base">{count}</p><p>within {mi} mile{mi!==1?"s":""}</p></div>;
        })}
      </div>
    </div>
  );
}

// ── Watchlist Tab ─────────────────────────────────────────────────────────────
function WatchlistTab({ competitors, onEdit, onToggle }: { competitors: Competitor[]; onEdit:(c:Competitor)=>void; onToggle:(c:Competitor)=>void; }) {
  const watched = competitors.filter(c=>c.onWatchlist);
  if (!watched.length) return (
    <div className="text-center py-12">
      <Bookmark className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
      <p className="font-semibold mb-2">No competitors on watchlist</p>
      <p className="text-sm text-muted-foreground">Add competitors to the watchlist to track them over time.</p>
    </div>
  );
  return (
    <div className="space-y-3">
      {watched.map(c=>{ const score = computeThreatScore(c); const rag = getRAG(score); return (
        <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{c.name}</h3>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${rag.bg} ${rag.border} ${rag.text}`}>{rag.label} · {score}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{c.clinicType} · {c.distanceMiles ? `${c.distanceMiles}mi` : "distance unknown"}</p>
            {c.lastChecked && <p className="text-xs text-muted-foreground mt-0.5">Last checked: {c.lastChecked}</p>}
            {c.notes && <p className="text-xs text-muted-foreground italic mt-1">"{c.notes}"</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={()=>onEdit(c)} className="text-xs text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted"><Edit className="w-4 h-4" /></button>
            <button onClick={()=>onToggle(c)} className="text-xs text-primary hover:text-primary/80 p-1.5 rounded-md hover:bg-muted"><BookmarkCheck className="w-4 h-4" /></button>
          </div>
        </div>
      );})}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CompetitionPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Competitor|null>(null);

  useEffect(() => { fetchCompetitors(); }, []);

  const fetchCompetitors = async () => {
    try {
      const r = await fetch(`${API_BASE}/projects/${PROJECT_ID}/competitors`);
      const d = await r.json();
      setCompetitors(d.competitors ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c: Competitor) => { setEditing(c); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSave = async (data: FormData) => {
    if (editing) {
      await fetch(`${API_BASE}/projects/${PROJECT_ID}/competitors/${editing.id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data) });
    } else {
      await fetch(`${API_BASE}/projects/${PROJECT_ID}/competitors`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data) });
    }
    await fetchCompetitors();
    closeModal();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this competitor?")) return;
    await fetch(`${API_BASE}/projects/${PROJECT_ID}/competitors/${id}`, { method:"DELETE" });
    setCompetitors(cs=>cs.filter(c=>c.id!==id));
  };

  const handleToggleWatchlist = async (c: Competitor) => {
    await fetch(`${API_BASE}/projects/${PROJECT_ID}/competitors/${c.id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ onWatchlist:!c.onWatchlist }) });
    setCompetitors(cs=>cs.map(x=>x.id===c.id ? {...x, onWatchlist:!c.onWatchlist} : x));
  };

  const TABS = ["Overview","Competitors","Pricing","Comparison","Market Gap","Map","Watchlist"];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Target className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Competition Intelligence</h1>
          </div>
          <p className="text-muted-foreground text-sm">Is there genuinely room for Abi Peters Aesthetics in Winchester? Who are the biggest threats?</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 shrink-0"><Plus className="w-4 h-4" />Add Competitor</button>
      </div>

      <div className="flex border-b border-border overflow-x-auto gap-0 -mb-0">
        {TABS.map((t,i)=>(
          <button key={t} onClick={()=>setTab(i)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab===i ? "border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`}>{t}{t==="Watchlist" && competitors.filter(c=>c.onWatchlist).length > 0 && <span className="ml-1.5 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{competitors.filter(c=>c.onWatchlist).length}</span>}</button>
        ))}
      </div>

      <div className="pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>
        ) : (
          <>
            {tab === 0 && <OverviewTab competitors={competitors} onEdit={openEdit} onAdd={openAdd} />}
            {tab === 1 && <CompetitorsTab competitors={competitors} onEdit={openEdit} onDelete={handleDelete} onToggleWatchlist={handleToggleWatchlist} onAdd={openAdd} />}
            {tab === 2 && <PricingTab competitors={competitors} />}
            {tab === 3 && <ComparisonTab competitors={competitors} />}
            {tab === 4 && <MarketGapTab competitors={competitors} />}
            {tab === 5 && <MapTab competitors={competitors} />}
            {tab === 6 && <WatchlistTab competitors={competitors} onEdit={openEdit} onToggle={handleToggleWatchlist} />}
          </>
        )}
      </div>

      {modalOpen && <CompetitorModal competitor={editing} onClose={closeModal} onSave={handleSave} />}
    </div>
  );
}
