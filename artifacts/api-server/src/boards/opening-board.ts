// The Winchester opening board: decisions, offers, dates and the owner's to-do list, with the
// ad figures filled from the latest Ads Pathway snapshot, so it stays current without a
// redeploy each time the twice-daily pathway check runs. Prose sections live in the template.
import TEMPLATE from "./opening-board.html";

interface Lead { status: string }
interface Snapshot {
  updated: string;
  windowFrom: string;
  spend: { total: number; leadForms: number; bookingAd: number };
  leadForms: { clicks: number };
  bookingAd: { clicks: number; toBookingPage: number; toLandingPage: number; traced: number };
  followUp: { sent: number; replies: number };
  adsets: { frequency: number }[];
  leads: Lead[];
  summary: string;
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const gbp = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;
const today = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" }).format(new Date());

const kpi = (label: string, value: string, note: string) =>
  `<div class="kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong><em>${esc(note)}</em></div>`;
const stage = (label: string, value: string, note: string, cls = "") =>
  `<div class="stage ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b><span>${esc(note)}</span></div>`;

export function renderOpeningBoard(p: Snapshot | null): string {
  let html = TEMPLATE;
  if (!p) {
    html = html.replace("<!--UPDATED-->", esc(today()))
      .replace("<!--KPIS-->", `<p class="muted" style="margin-top:1.5rem">No ads snapshot yet; the pathway check saves one twice a day.</p>`)
      .replace("<!--ADS-->", "");
  } else {
    const leads = p.leads.length;
    const booked = p.leads.filter((l) => l.status === "booked").length;
    const open = p.leads.filter((l) => l.status === "open").length;
    const maxFreq = Math.max(0, ...p.adsets.map((a) => a.frequency));
    const fatigue = maxFreq < 2 ? "no fatigue" : maxFreq <= 3 ? "watch" : "refresh creative";
    html = html.replace("<!--UPDATED-->", esc(p.updated))
      .replace("<!--KPIS-->", `<div class="kpis" aria-label="Headline numbers">
    ${kpi(`Meta ads since ${p.windowFrom}`, `£${Math.round(p.spend.total)}`, "spent across three campaigns")}
    ${kpi("Leads", String(leads), "all in GHL with the ad they came from")}
    ${kpi("Cost per lead", leads ? gbp(p.spend.total / leads) : "n/a", "all Meta spend")}
    ${kpi("Booked consultations", String(booked), `${booked} of ${leads} leads booked themselves`)}
    ${kpi("Per booked consultation", booked ? gbp(p.spend.total / booked) : "n/a", "all Meta spend divided by bookings")}
  </div>`)
      .replace("<!--ADS-->", `  <section aria-labelledby="flow">
    <h2 id="flow">The pathway, ad to diary</h2>
    <div class="card">
      <div class="stages">
        ${stage("Lead form ads", gbp(p.spend.leadForms), `${p.leadForms.clicks} clicks`)}
        ${stage("Leads in GHL", String(leads), p.leadForms.clicks ? `${Math.round((100 * leads) / p.leadForms.clicks)}% of clicks` : "")}
        ${stage("Email + WhatsApp", `${p.followUp.sent} of ${leads}`, `${p.followUp.replies} replies`)}
        ${stage("Booked in ANS", String(booked), `${open} still open`, "good")}
      </div>
      <div class="stages">
        ${stage("Booking page ad", gbp(p.spend.bookingAd), `${p.bookingAd.clicks} clicks`, "quiet")}
        ${stage("To the landing page", String(p.bookingAd.toLandingPage), `${p.bookingAd.toBookingPage} went to the booking page first`, "quiet")}
        ${stage("Bookings traced", String(p.bookingAd.traced), "from this ad", "quiet")}
        ${stage("Highest frequency", maxFreq.toFixed(2), fatigue, "quiet")}
      </div>
      <p class="muted">${esc(p.summary)}</p>
      <p class="muted"><span class="pill p-warn">One to watch</span> Replies to the email and WhatsApp: ${p.followUp.replies} so far. Most leads book themselves within minutes, so the real test is the leads who do not. If replies are still at zero after about ten of those, the follow-up copy or timing changes.</p>
      <p class="muted">Every lead, traced from ad to booking, is on the <a href="/ads-pathway" target="_top">Ads Pathway</a> page.</p>
    </div>
  </section>`);
  }
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}img{max-width:100%}</style>${html.slice(0, html.indexOf("</style>") + 8)}</head><body>${html.slice(html.indexOf("</style>") + 8)}</body></html>`;
}
