// The Winchester Clinic Board: the operations command board. Takings, the diary for the next 14
// days, the Winchester consultations booked from the ads, and (from opening) attendance, no-shows,
// consultation to treatment and new against returning patients. Built from the latest "clinic"
// board snapshot (abi-peters-skin-clinic/ops/clinic/clinic.json, refreshed daily from ANS) and the
// latest Ads Pathway snapshot for the ad-booked consultations.
import HEAD from "./ads-board-head.html";

interface Day { date: string; clinic: string; appts: number; bookedMins: number; blockedMins: number; online: number; consults: number; first: string | null; last: string | null }
interface Clinic {
  updated: string; updatedIso?: string; openingDate: string;
  takings: { source: string; rows: { period: string; total: number; treatments: number; retail: number; avgPerAppointment: number }[]; byClinicNote?: string };
  diary: { source: string; clinicDayHours: number; days: Day[] };
  attendance: null | { period: string; attended: number; noShows: number; cancelled: number };
  conversion: null | { period: string; consultations: number; paidWithin30: number };
  patients: null | { period: string; newPatients: number; returning: number };
}
interface AdLead { name: string; status: string; apptIso?: string; what?: string }

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const gbp0 = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const dayLabel = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function renderClinicBoard(c: Clinic | null, ads: { leads?: AdLead[] } | null): string {
  if (!c) return page(`<div class="board"><h1>Winchester Clinic Board</h1><p>No clinic snapshot yet; the 07:30 refresh saves one each morning.</p></div>`);
  const ageH = c.updatedIso ? (Date.now() - Date.parse(c.updatedIso)) / 3600000 : null;
  const fresh = ageH == null ? "" : `<span class="pill ${ageH < 26 ? "good" : ageH < 50 ? "warn" : "bad"}">Figures ${ageH < 1 ? "under an hour" : Math.round(ageH) + " hours"} old</span>`;
  const toOpen = Math.ceil((Date.parse(c.openingDate + "T00:00:00Z") - Date.now()) / 86400000);

  const k = c.takings.rows;
  const kpi = (label: string, value: string, note: string) => `<div class="kpi"><span>${esc(label)}</span><b>${esc(value)}</b><em>${esc(note)}</em></div>`;
  const kpis = k.slice(0, 4).map((r) => kpi(r.period, gbp0(r.total), `${gbp0(r.treatments)} treatments, ${gbp0(r.retail)} skincare; ${gbp(r.avgPerAppointment)} per appointment`)).join("");

  // Diary: booked hours against a clinic day, per day
  const H = c.diary.clinicDayHours;
  const days = c.diary.days;
  const W = 1000, L = 120, rowH = 30;
  const bars = days.map((d, i) => {
    const y = 10 + i * rowH;
    const open = Math.max(0, H * 60 - d.blockedMins);
    const fill = open ? d.bookedMins / open : 0;
    const bw = ((W - L - 160) * Math.min(1, d.bookedMins / (H * 60)));
    const blw = ((W - L - 160) * Math.min(1, d.blockedMins / (H * 60)));
    const label = d.appts === 0 && d.blockedMins >= H * 60 - 30 ? "blocked out" : `${d.appts} appts, ${(d.bookedMins / 60).toFixed(1)} h${open ? `, ${Math.round(fill * 100)}% of open time` : ""}`;
    return `<text x="0" y="${y + 18}" class="tick" font-weight="700">${esc(dayLabel(d.date))}</text>
      <rect x="${L}" y="${y + 4}" width="${W - L - 160}" height="${rowH - 10}" class="p-box"/>
      <rect x="${L}" y="${y + 4}" width="${bw.toFixed(1)}" height="${rowH - 10}" class="bar-spend"><title>${esc(dayLabel(d.date) + ": " + label)}</title></rect>
      ${blw ? `<rect x="${(L + (W - L - 160) - blw).toFixed(1)}" y="${y + 4}" width="${blw.toFixed(1)}" height="${rowH - 10}" fill="url(#blk)"><title>${esc((d.blockedMins / 60).toFixed(1) + " h blocked")}</title></rect>` : ""}
      <text x="${W - 150}" y="${y + 18}" class="tick">${esc(label)}</text>`;
  }).join("");
  const diarySvg = `<svg viewBox="0 0 ${W} ${10 + days.length * rowH + 6}" role="img" aria-label="Booked hours per day, next 14 days"><defs><pattern id="blk" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--panel)"/><line x1="0" y1="0" x2="0" y2="8" stroke="var(--line)" stroke-width="3"/></pattern></defs>${bars}</svg>`;
  const totAppts = days.reduce((s, d) => s + d.appts, 0), totMins = days.reduce((s, d) => s + d.bookedMins, 0), totOnline = days.reduce((s, d) => s + d.online, 0);

  // Winchester consultations booked from the ads
  const adBooked = (ads?.leads ?? []).filter((l) => l.status === "booked" && l.apptIso).sort((a, b) => (a.apptIso ?? "").localeCompare(b.apptIso ?? ""));
  const byDay = new Map<string, number>();
  for (const l of adBooked) { const d = l.apptIso!.slice(0, 10); byDay.set(d, (byDay.get(d) ?? 0) + 1); }
  const adRows = [...byDay.entries()].map(([d, n]) => `<li><span>${esc(dayLabel(d))}</span><b>${n} ${n === 1 ? "consultation" : "consultations"}</b></li>`).join("");

  const later = (title: string, what: string, v: unknown) => `<div class="kpi"><span>${esc(title)}</span><b>${v == null ? "from 8 Dec" : esc(v)}</b><em>${esc(what)}</em></div>`;

  const body = `<div class="board">
  <div class="head"><div style="display:grid;gap:6px"><span class="eyebrow">Abi Peters Skin Clinic &middot; Clinic Board &middot; figures ${esc(c.updated)}</span>
    <h1>Winchester Clinic Board</h1>
    <p>How the clinics are running: takings, the diary ahead, and from opening, who turns up, who goes on to treatment and who comes back.</p></div>
    <div class="tag" style="display:grid;gap:6px;justify-items:end">${toOpen > 0 ? `<span class="verdict"><i class="dot"></i>Winchester opens in ${toOpen} ${toOpen === 1 ? "day" : "days"}</span>` : `<span class="verdict"><i class="dot"></i>Winchester open</span>`}${fresh}</div></div>
  <span class="eyebrow">Takings, all clinics</span>
  <div class="kpis">${kpis}</div>
  <p class="muted-s">${esc(c.takings.byClinicNote ?? "")} Year to date: ${gbp0(k[k.length - 1]?.total ?? 0)}.</p>
  <div class="row">
    <div class="card"><span class="q">The diary ahead</span><h2>Next 14 days</h2>
      <div class="svgwrap">${diarySvg}</div>
      <p class="muted-s">${totAppts} appointments, ${(totMins / 60).toFixed(1)} hours booked, ${totAppts ? Math.round((100 * totOnline) / totAppts) : 0}% booked online. Bars show booked time against a ${H} hour clinic day; hatching is time blocked out. ${esc(c.diary.source)}.</p></div>
    <div class="card"><span class="q">Winchester, from the ads</span><h2>Consultations already in the diary</h2>
      <ul class="steps">${adRows || "<li><span>None yet</span></li>"}</ul>
      <p class="muted-s">Booked through the Meta lead forms; each is followed to attended and paying on the Ads Board.</p></div>
  </div>
  <div class="card"><span class="q">From opening</span><h2>Who turns up, who goes on to treatment, who comes back</h2>
    <div class="kpis">
      ${later("Attended", "of booked appointments, last 4 weeks", c.attendance ? `${Math.round((100 * c.attendance.attended) / Math.max(1, c.attendance.attended + c.attendance.noShows))}%` : null)}
      ${later("No-shows", "last 4 weeks", c.attendance ? String(c.attendance.noShows) : null)}
      ${later("Consultation to treatment", "paid within 30 days", c.conversion ? `${c.conversion.paidWithin30} of ${c.conversion.consultations}` : null)}
      ${later("New and returning", "patients seen, last 4 weeks", c.patients ? `${c.patients.newPatients} new, ${c.patients.returning} back` : null)}
    </div>
    <p class="muted-s">These read from ANS each morning once Winchester is seeing patients. Only real figures are shown; nothing is estimated.</p></div>
  <p class="muted-s">Refreshed daily at 07:30 from ANS (Reports, Financial, and the calendar). No patient names are kept.</p>
</div>`;
  return page(body);
}

function page(body: string) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${HEAD.replace("<title>Winchester Ads Board</title>", "<title>Winchester Clinic Board</title>")}</head><body>${body}</body></html>`;
}
