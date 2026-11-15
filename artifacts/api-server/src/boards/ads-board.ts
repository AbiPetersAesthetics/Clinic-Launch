// The Winchester Ads Board: the command centre for paid ads. Now (every ad, the funnel to paying
// patients, cost per paying patient and ROAS), how the data is collected (the scheduled runs), and
// the next 12 months (the evergreen plus the additional campaigns, switched on and off on dates).
// Built from the latest Ads Pathway snapshot, which carries the plan (ads-plan.json) as data.plan.
// Rulebook: ads/STRATEGY.md in the website repo.
import HEAD from "./ads-board-head.html";

interface Lead { name: string; ad: string; status: string; treated?: boolean | null; attended?: boolean | string; firstValue?: number; value90?: number }
interface AdRow { creative: string; adset: string; status: string; spend: number; impressions: number; clicks: number; leads: number; frequency: number }
interface AdSet { name: string; spend: number; reach: number; frequency: number; leads: number }
interface Campaign { id: string; name: string; kind: string; start: string; end: string | null; perDay: number; what: string; status: string; creative?: { from: string; theme: string }[] }
interface Plan {
  goal: string; targets: { costPerLead: number[]; costPerBooked: number; costPerPaying: number; roasFirstVisit: number; roasYearOne: number };
  caps: { from: string; perDay: number; why: string }[]; months: string[]; campaigns: Campaign[]; switching: string;
  schedule: { when: string; task: string; what: string }[];
  assumptions: { bookedToAttended: number; attendedToPaying: number; firstVisitValue: number; yearOneValue: number; kept: number; newPatientsPerWeekAlone: number; newPatientsPerWeekTwo: number; note: string };
}
interface Snapshot {
  updated: string; windowFrom: string;
  spend: { total: number; leadForms: number; bookingAd: number };
  leadForms: { clicks: number }; bookingAd: { clicks: number; toLandingPage: number; traced: number };
  followUp: { sent: number; replies: number }; totals: { impressions: number; linkClicks: number };
  adsets: AdSet[]; ads: AdRow[]; leads: Lead[]; summary: string;
  capacity?: { asOf: string; fill21: number; method?: string };
  outcomes?: { attended: number; treated: number; pending: number };
  budgetAdvice?: { current: number; proposed: number; action: string; why: string };
  plan?: Plan;
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const gbp = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;
const gbp0 = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const thisMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);

function kpi(label: string, value: string, note: string, tone = "") {
  return `<div class="kpi ${tone}"><span>${esc(label)}</span><b>${esc(value)}</b><em>${esc(note)}</em></div>`;
}

export function renderAdsBoard(p: Snapshot | null): string {
  if (!p || !p.plan) {
    return page(`<div class="board"><h1>Winchester Ads Board</h1><p>No snapshot with a plan yet. The next pathway check pushes one.</p></div>`);
  }
  const plan = p.plan;
  const A = plan.assumptions;
  const T = plan.targets;
  const leads = p.leads.length;
  const bookedLeads = p.leads.filter((l) => l.status === "booked");
  const booked = bookedLeads.length;
  const paying = p.leads.filter((l) => l.treated === true);
  const revenue = paying.reduce((s, l) => s + (l.value90 ?? l.firstValue ?? 0), 0);
  const cpl = leads ? p.spend.total / leads : 0;
  const cpb = booked ? p.spend.total / booked : 0;
  const cpp = paying.length ? p.spend.total / paying.length : null;
  const roas = paying.length ? revenue / p.spend.total : null;
  const leadToBooked = leads ? booked / leads : 0.5;

  // Verdict
  const tone = cpp != null ? (cpp <= T.costPerPaying ? "good" : cpp <= 90 ? "warn" : "bad") : (cpb <= T.costPerBooked ? "good" : "warn");
  const verdict = cpp != null
    ? `${tone === "good" ? "On target" : "Above target"}: ${gbp(cpp)} per paying patient, ROAS ${roas!.toFixed(1)}x`
    : `On track: ${gbp(cpb)} per booked consultation; paying patients counted from 2 December`;

  // KPIs
  const kpis = [
    kpi("Spent", gbp0(p.spend.total), `since ${p.windowFrom}`),
    kpi("Leads", String(leads), "Meta lead forms into GHL"),
    kpi("Cost per lead", gbp(cpl), `target £${T.costPerLead[0]} to £${T.costPerLead[1]}`, cpl <= T.costPerLead[1] ? "good" : "warn"),
    kpi("Booked consultations", String(booked), `${pct(leadToBooked)} of leads`),
    kpi("Cost per booked", booked ? gbp(cpb) : "n/a", `target under £${T.costPerBooked}`, cpb && cpb <= T.costPerBooked ? "good" : "warn"),
    kpi("Paying patients", paying.length ? String(paying.length) : "from Dec", "paid for a treatment"),
    kpi("Cost per paying patient", cpp != null ? gbp(cpp) : "from Dec", `target under £${T.costPerPaying}`, cpp == null ? "" : cpp <= T.costPerPaying ? "good" : "bad"),
    kpi("ROAS", roas != null ? `${roas.toFixed(1)}x` : "from Dec", roas != null ? `${gbp0(revenue)} taken from ad patients` : `target ${T.roasFirstVisit}x first visit`, roas == null ? "" : roas >= T.roasFirstVisit ? "good" : "warn"),
  ].join("");

  // Funnel
  const o = p.outcomes;
  const frow = (label: string, n: number | null, rate: string) => {
    const w = n == null ? 100 : leads ? Math.max(2, (100 * n) / leads) : 0;
    return `<div class="frow"><span>${esc(label)}</span><div><div class="fbar${n == null ? " pend" : ""}" style="width:${w.toFixed(1)}%"></div></div><b>${n == null ? "Dec" : n}</b>${rate ? `<span class="rate">${esc(rate)}</span>` : ""}</div>`;
  };
  const funnel = [
    frow("Leads", leads, ""),
    frow("Booked consultation", booked, `${pct(leadToBooked)} of leads, mostly within three minutes of the form`),
    frow("Attended", o ? o.attended : null, o ? `${booked ? pct(o.attended / booked) : ""} of booked` : `measured from 2 Dec; assumed ${pct(A.bookedToAttended)}`),
    frow("Paying patient", o ? o.treated : null, o ? `${o.pending} still inside their 30 days` : `assumed ${pct(A.attendedToPaying)} of attended until measured`),
  ].join("");

  // Diary and budget
  const fill = p.capacity?.fill21;
  const marker = fill == null ? "" : `<span class="marker" style="left:calc(${Math.min(100, Math.max(0, fill * 100)).toFixed(1)}% - 1px)"></span>`;
  const adv = p.budgetAdvice;
  const diary = `<div class="band" role="img" aria-label="Diary fill next 21 days: under 70% raise, 70 to 90% hold, over 90% lower"><div class="up"><b>Under 70%</b><br>raise 20%</div><div class="hold"><b>70 to 90%</b><br>hold</div><div class="down"><b>90%+</b><br>lower</div>${marker}</div>
    <p>${fill == null ? "First diary reading: Monday 12:30 (from the 2 December model days)." : `<b>${pct(fill)}</b> of Winchester's clinical hours booked in the next 21 days (${esc(p.capacity!.method ?? "ANS")}, ${esc(p.capacity!.asOf)}).`}</p>
    <p>${adv ? `<span class="pill ${adv.action === "hold" ? "" : "warn"}">This week: ${esc(adv.action)}</span> £${esc(adv.current)} to £${esc(adv.proposed)} a day. ${esc(adv.why)}` : `Budget now <b>£25 a day</b>: £15 cold, £7 warm, £3 landing page test. Cap £40 while Abi works alone.`}</p>
    <p style="color:var(--muted);font-size:12px">Steps of 20% at most, once a week, applied when you approve them. No raise while cost per paying patient is over £90.</p>`;

  // Every ad, grouped by creative
  const groups = new Map<string, { creative: string; status: string; spend: number; impressions: number; clicks: number; leads: number; frequency: number; sets: number }>();
  for (const a of p.ads) {
    const g = groups.get(a.creative) ?? { creative: a.creative, status: a.status, spend: 0, impressions: 0, clicks: 0, leads: 0, frequency: 0, sets: 0 };
    g.spend += a.spend; g.impressions += a.impressions; g.clicks += a.clicks; g.leads += a.leads; g.frequency = Math.max(g.frequency, a.frequency); g.sets += 1;
    if (a.status === "Active") g.status = "Active";
    groups.set(a.creative, g);
  }
  const keyFor = (ad: string) => [...groups.keys()].find((c) => c.startsWith(ad)) ?? ad;
  const bookedBy: Record<string, number> = {}; const payingBy: Record<string, number> = {};
  for (const l of p.leads) {
    if (l.status === "booked") bookedBy[keyFor(l.ad)] = (bookedBy[keyFor(l.ad)] ?? 0) + 1;
    if (l.treated === true) payingBy[keyFor(l.ad)] = (payingBy[keyFor(l.ad)] ?? 0) + 1;
  }
  const rank = (g: { status: string; leads: number }) => (g.status !== "Active" ? 2 : g.leads ? 0 : 1);
  const adRows = [...groups.values()].sort((x, y) => rank(x) - rank(y) || (rank(x) === 0 ? x.spend / x.leads - y.spend / y.leads : y.spend - x.spend)).map((g) => {
    const b = bookedBy[g.creative] ?? 0; const pay = payingBy[g.creative] ?? 0;
    const verdictPill = g.status !== "Active" ? `<span class="pill">Paused</span>` : g.leads && g.spend / g.leads <= T.costPerLead[1] ? `<span class="pill good">Keep</span>` : !g.leads && g.spend >= 20 ? `<span class="pill bad">Pause</span>` : !g.leads ? `<span class="pill warn">Learning</span>` : `<span class="pill warn">Watch</span>`;
    return `<tr${g.status !== "Active" ? ' style="color:var(--muted)"' : ""}><td>${esc(g.creative)}${g.sets > 1 ? ` <span style="color:var(--muted)">(${g.sets} ad sets)</span>` : ""}</td><td>${gbp(g.spend)}</td><td>${g.impressions.toLocaleString("en-GB")}</td><td>${g.clicks}</td><td>${g.impressions ? ((100 * g.clicks) / g.impressions).toFixed(1) + "%" : ""}</td><td>${g.leads}</td><td>${g.leads ? gbp(g.spend / g.leads) : ""}</td><td>${b}</td><td>${b ? gbp(g.spend / b) : ""}</td><td>${pay || ""}</td><td>${g.frequency.toFixed(2)}</td><td>${verdictPill}</td></tr>`;
  }).join("");
  const setRows = p.adsets.map((s) => {
    const f = s.frequency; const pill = f < 2 ? `<span class="pill good">Fresh</span>` : f <= 3 ? `<span class="pill warn">Watch</span>` : `<span class="pill bad">Refresh</span>`;
    return `<tr><td>${esc(s.name)}</td><td>${gbp(s.spend)}</td><td>${s.reach.toLocaleString("en-GB")}</td><td>${s.leads}</td><td>${s.leads ? gbp(s.spend / s.leads) : ""}</td><td>${f.toFixed(2)}</td><td>${pill}</td></tr>`;
  }).join("");

  // 12 month calendar
  const now = thisMonth();
  const active = (c: Campaign, ym: string) => c.start.slice(0, 7) <= ym && (!c.end || c.end.slice(0, 7) >= ym);
  const capFor = (ym: string) => [...plan.caps].filter((c) => c.from <= ym).pop()?.perDay ?? 40;
  const head = `<tr><th>Campaign</th>${plan.months.map((m) => `<th class="${m === now ? "now" : ""}">${monthLabel(m)}</th>`).join("")}</tr>`;
  const rows = plan.campaigns.map((c) => {
    const cells = plan.months.map((m) => active(c, m) ? `<td class="on k-${c.kind}${m === now ? " now" : ""}" title="${esc(c.name)}">${c.perDay > 0 ? "£" + c.perDay : c.perDay < 0 ? "−£" + -c.perDay : ""}</td>` : `<td class="${m === now ? "now" : ""}"></td>`).join("");
    return `<tr><td><b>${esc(c.name)}</b><br><span style="color:var(--muted);font-size:11.5px">${esc(c.what)}</span></td>${cells}</tr>`;
  }).join("");
  const totals = plan.months.map((m) => {
    const t = plan.campaigns.filter((c) => active(c, m) && c.status !== "conditional").reduce((s, c) => s + c.perDay, 0);
    const cap = capFor(m);
    return `<td class="${t > cap ? "over" : ""}${m === now ? " now" : ""}">£${t}</td>`;
  }).join("");
  const caps = plan.months.map((m) => `<td class="${m === now ? "now" : ""}">£${capFor(m)}</td>`).join("");
  const monthly = plan.months.map((m) => {
    const t = plan.campaigns.filter((c) => active(c, m) && c.status !== "conditional").reduce((s, c) => s + c.perDay, 0);
    return `<td class="${m === now ? "now" : ""}">${gbp0(t * 30.4)}</td>`;
  }).join("");
  const themes = (plan.campaigns.find((c) => c.id === "evergreen")?.creative ?? []).map((t) => `<li><span>${esc(t.theme)}</span><b>${esc(new Date(t.from + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }))}</b></li>`).join("");

  // Schedule
  const sched = plan.schedule.map((s) => `<li><b>${esc(s.when)}</b><span>${esc(s.what)}</span></li>`).join("");

  // Simulator data
  const simData = JSON.stringify({ cpl: Math.round(cpl * 100) / 100, l2b: Math.round(leadToBooked * 100) / 100, b2p: Math.round(A.bookedToAttended * A.attendedToPaying * 100) / 100, first: A.firstVisitValue, year: A.yearOneValue, kept: A.kept, capAlone: A.newPatientsPerWeekAlone, capTwo: A.newPatientsPerWeekTwo, target: T.costPerPaying }).replace(/</g, "\\u003c");

  const body = `<div class="board">
  <div class="head">
    <div style="display:grid;gap:6px">
      <span class="eyebrow">Abi Peters Skin Clinic &middot; Ads Board &middot; figures ${esc(p.updated)}</span>
      <h1>Winchester Ads Board</h1>
      <p>${esc(plan.goal)}</p>
    </div>
    <div class="tag"><span class="verdict"><i class="dot ${tone === "good" ? "" : tone}"></i>${esc(verdict)}</span></div>
  </div>
  <div class="grid">
    <aside class="rail sim" aria-label="Scale simulator">
      <div class="ctl"><span class="lbl">If we scale: what does it buy?</span><span class="hint">Starts from today's real cost per lead and booking rate. Paying rate is an assumption until December.</span></div>
      <div class="ctl"><span class="lbl">Daily budget</span><div class="slide"><input id="s-budget" type="range" min="20" max="60" step="1" value="25"><output id="o-budget">£25</output></div></div>
      <div class="ctl"><span class="lbl">Cost per lead</span><div class="slide"><input id="s-cpl" type="range" min="3" max="25" step="0.5" value="${Math.round(cpl * 2) / 2}"><output id="o-cpl"></output></div><span class="hint">Usually rises as spend rises; try a higher figure at higher budgets.</span></div>
      <div class="ctl"><span class="lbl">Lead to booked</span><div class="slide"><input id="s-l2b" type="range" min="0.1" max="0.9" step="0.05" value="${Math.round(leadToBooked * 20) / 20}"><output id="o-l2b"></output></div></div>
      <div class="ctl"><span class="lbl">Booked to paying</span><div class="slide"><input id="s-b2p" type="range" min="0.1" max="0.9" step="0.05" value="${Math.round(A.bookedToAttended * A.attendedToPaying * 20) / 20}"><output id="o-b2p"></output></div></div>
      <div class="ctl"><span class="lbl">Clinicians</span><div class="seg" id="s-team"><button type="button" aria-pressed="true" data-v="1">Abi alone</button><button type="button" aria-pressed="false" data-v="2">Two</button></div></div>
      <div class="ctl"><span class="lbl">Each month</span><div class="simout" id="simout"></div></div>
    </aside>
    <div class="main">
      <div class="kpis">${kpis}</div>
      <div class="row">
        <div class="card"><span class="q">The funnel we judge on</span><h2>From a form to a paying patient</h2><div class="funnel">${funnel}</div>
          <p style="color:var(--muted);font-size:12px">Follow-up: ${p.followUp.sent} of ${leads} leads had the email and WhatsApp, ${p.followUp.replies} replies. ${esc(p.summary)}</p></div>
        <div class="card"><span class="q">Spend follows the diary</span><h2>Diary fill and this week's budget</h2>${diary}</div>
      </div>
      <div class="card"><span class="q">Now</span><h2>Every ad, best first</h2>
        <div class="table-wrap"><table><thead><tr><th>Ad</th><th>Spend</th><th>Views</th><th>Clicks</th><th>Click rate</th><th>Leads</th><th>Per lead</th><th>Booked</th><th>Per booked</th><th>Paying</th><th>Freq</th><th>Verdict</th></tr></thead><tbody>${adRows}</tbody></table></div>
        <div class="table-wrap"><table><thead><tr><th>Audience</th><th>Spend</th><th>Reach</th><th>Leads</th><th>Per lead</th><th>Frequency</th><th>Fatigue</th></tr></thead><tbody>${setRows}</tbody></table></div>
        <p style="color:var(--muted);font-size:12px">An ad is judged after 7 days or £20. Keep: leads at or under £${T.costPerLead[1]}. Pause: £20 spent and no lead. Every lead, traced from ad to diary, is on <a href="/ads-pathway" target="_top">Ads Pathway</a>.</p>
      </div>
      <div class="card"><span class="q">The next 12 months</span><h2>The evergreen, plus campaigns switched on and off on their dates</h2>
        <div class="table-wrap"><table class="gantt"><thead>${head}</thead><tbody>${rows}
          <tr class="total"><td>Planned per day (excluding conditional)</td>${totals}</tr>
          <tr><td style="color:var(--muted)">Cap per day</td>${caps}</tr>
          <tr><td style="color:var(--muted)">About per month</td>${monthly}</tr></tbody></table></div>
        <div class="legend"><span><i class="k-evergreen"></i>Evergreen</span><span><i class="k-seasonal"></i>Seasonal</span><span><i class="k-launch"></i>Launch</span><span><i class="k-test"></i>Test</span><span><i class="k-conditional"></i>Only when conditions hold</span><span><i class="k-reduce"></i>Eased</span></div>
        <p style="color:var(--muted);font-size:12px">${esc(plan.switching)} The evergreen's figure is its starting budget; each Monday's diary reading moves it within the cap.</p>
      </div>
      <div class="row2">
        <div class="card"><span class="q">Evergreen creative</span><h2>What the always-on ads say, and when it changes</h2><ul class="steps">${themes}</ul></div>
        <div class="card"><span class="q">How the data is collected</span><h2>The scheduled runs that feed this board</h2><ul class="sched">${sched}</ul>
          <div class="life"><div><b>Minute 0</b>Form sent, lead in GHL</div><div><b>3 minutes</b>Most book from the thank-you button</div><div><b>Consultation day</b>Attended or not, from ANS</div><div><b>Within 30 days</b>First paid treatment: a paying patient</div><div><b>90 days</b>Takings so far: ROAS</div></div>
        </div>
      </div>
      <p style="color:var(--muted);font-size:11.5px">${esc(A.note)} Rulebook: ads/STRATEGY.md. Plan: ads/meta/pathway/ads-plan.json.</p>
    </div>
  </div>
</div>
<script>
(function(){
  var D=${simData}, team=1;
  function $(id){return document.getElementById(id);}
  function money(n){return "£"+Math.round(n).toLocaleString("en-GB");}
  function run(){
    var b=+$("s-budget").value, cpl=+$("s-cpl").value, l2b=+$("s-l2b").value, b2p=+$("s-b2p").value;
    $("o-budget").textContent="£"+b; $("o-cpl").textContent="£"+cpl.toFixed(2); $("o-l2b").textContent=Math.round(l2b*100)+"%"; $("o-b2p").textContent=Math.round(b2p*100)+"%";
    var spend=b*30.4, leads=spend/cpl, booked=leads*l2b, paying=booked*b2p, cpp=paying?spend/paying:0;
    var cap=(team===1?D.capAlone:D.capTwo)*4.33, over=paying>cap;
    var roas1=spend?paying*D.first/spend:0, roasY=spend?paying*D.year/spend:0;
    var cls=cpp<=D.target?"good":cpp<=90?"warn":"bad";
    $("simout").innerHTML=
      "<div><span>Spend</span><b>"+money(spend)+"</b></div>"+
      "<div><span>Leads</span><b>"+Math.round(leads)+"</b></div>"+
      "<div><span>Booked consultations</span><b>"+Math.round(booked)+"</b></div>"+
      "<div><span>Paying patients</span><b class=\\""+(over?"bad":"")+"\\">"+Math.round(paying)+"</b></div>"+
      "<div><span>Cost per paying patient</span><b class=\\""+cls+"\\">"+money(cpp)+"</b></div>"+
      "<div><span>ROAS, first visit</span><b>"+roas1.toFixed(1)+"x</b></div>"+
      "<div><span>ROAS, first year</span><b>"+roasY.toFixed(1)+"x</b></div>"+
      "<div><span>Kept in year one, after ads</span><b>"+money(paying*D.year*D.kept-spend)+"</b></div>"+
      "<div><span>New patient room a month</span><b class=\\""+(over?"bad":"good")+"\\">"+Math.round(cap)+(over?", over":"")+"</b></div>";
  }
  ["s-budget","s-cpl","s-l2b","s-b2p"].forEach(function(id){$(id).addEventListener("input",run);});
  $("s-team").addEventListener("click",function(e){var t=e.target.closest("button"); if(!t)return; team=+t.dataset.v; [].forEach.call(this.querySelectorAll("button"),function(x){x.setAttribute("aria-pressed",String(x===t));}); run();});
  run();
})();
</script>`;
  return page(body);
}

function page(body: string) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${HEAD}</head><body>${body}</body></html>`;
}
