// Ads Ideas: seasonal, creative, funnel and retention approaches for Meta that could lift ROAS, each
// with its evidence, expected effect, effort and the advertising rules that limit it, plus the
// published benchmarks. Source: ads/meta/ideas.json in the website repo (researched 15 Nov 2026),
// merged into the Ads Pathway snapshot as data.ideas by push-ads-pathway.mjs.
import HEAD from "./ads-board-head.html";

interface Idea { id: string; group: string; title: string; when: string; what: string; why: string; expectedEffect: string; effort: string; cost: string; compliance: string; fit: string; status?: string }
interface Bench { figure: string; measuredOn?: string; region?: string; type?: string; source?: string; date?: string }
interface Ideas {
  researched: string; notes?: string;
  benchmarks: Record<string, unknown> & { summary?: string; bestEstimate?: { firstVisitROAS?: { value: string; reason: string }; yearOneROAS?: { value: string; reason: string } } };
  topFive: { rank: number; id: string; why: string }[];
  ideas: Idea[];
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const GROUPS: Record<string, string> = { seasonal: "Seasonal", creative: "Creative", funnel: "Funnel and targeting", retention: "Retention" };
const BENCH: Record<string, string> = { roas: "ROAS", costPerLead: "Cost per lead", costPerBookedConsultation: "Cost per booked consultation", consultationToTreatment: "Consultation to treatment", noShowRate: "No-shows" };

export function renderAdsIdeas(snap: { ideas?: Ideas; updated?: string } | null): string {
  const d = snap?.ideas;
  if (!d) return page(`<div class="board"><h1>Ads Ideas</h1><p>No ideas file in the latest snapshot yet.</p></div>`);
  const byId = new Map(d.ideas.map((i) => [i.id, i]));
  const fitTone = (f: string) => (/^high/i.test(f) ? "good" : /^medium/i.test(f) ? "warn" : "");
  const status = (i: Idea) => i.status ? `<span class="pill ${i.status === "adopted" ? "good" : i.status === "testing" ? "warn" : ""}">${esc(i.status)}</span>` : "";

  const top = d.topFive.sort((a, b) => a.rank - b.rank).map((t) => {
    const i = byId.get(t.id);
    return `<div class="kpi"><span>Adopt ${t.rank}</span><b style="font-size:17px">${esc(i?.title ?? t.id)}</b><em>${esc(t.why)}</em></div>`;
  }).join("");

  const best = d.benchmarks.bestEstimate;
  const benchRows = Object.entries(BENCH).map(([k, label]) => {
    const rows = (d.benchmarks[k] as Bench[] | undefined) ?? [];
    return rows.map((r, n) => `<tr><td>${n === 0 ? `<b>${esc(label)}</b>` : ""}</td><td style="text-align:left;white-space:normal;min-width:260px">${esc(r.figure)}${r.measuredOn ? `<span class="why">Measured on: ${esc(r.measuredOn)}</span>` : ""}</td><td style="text-align:left;white-space:normal">${esc(r.type ?? "")}</td><td style="text-align:left;white-space:normal">${esc(r.region ?? "")}</td><td style="text-align:left">${r.source ? `<a href="${esc(r.source)}" target="_blank" rel="noreferrer">source</a>` : ""} ${esc(r.date ?? "")}</td></tr>`).join("");
  }).join("");

  const tabs = `<div class="seg" id="g-tabs"><button type="button" data-g="all" aria-pressed="true">All ${d.ideas.length}</button>${Object.entries(GROUPS).map(([g, l]) => `<button type="button" data-g="${g}" aria-pressed="false">${esc(l)} ${d.ideas.filter((i) => i.group === g).length}</button>`).join("")}</div>`;
  const cards = d.ideas.map((i) => `<div class="card idea" data-group="${esc(i.group)}">
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="pill">${esc(GROUPS[i.group] ?? i.group)}</span><span class="pill ${fitTone(i.fit)}">Fit: ${esc(i.fit.split(":")[0])}</span><span class="pill">Effort: ${esc(i.effort)}</span>${status(i)}</div>
      <h3>${esc(i.title)}</h3>
      <p class="muted-s"><b>When:</b> ${esc(i.when)}</p>
      <p>${esc(i.what)}</p>
      <p class="muted-s"><b>Expected effect:</b> ${esc(i.expectedEffect)}</p>
      <details><summary class="muted-s">Why, cost, rules and fit</summary>
        <p class="muted-s"><b>Why:</b> ${esc(i.why)}</p>
        <p class="muted-s"><b>Cost:</b> ${esc(i.cost)}</p>
        <p class="muted-s"><b>Rules:</b> ${esc(i.compliance)}</p>
        <p class="muted-s"><b>Fit:</b> ${esc(i.fit)}</p>
      </details></div>`).join("");

  const body = `<div class="board">
  <div class="head"><div style="display:grid;gap:6px"><span class="eyebrow">Abi Peters Skin Clinic &middot; Ads Ideas &middot; researched ${esc(d.researched)}</span>
    <h1>Ways to lift our return on ad spend</h1>
    <p>Seasonal moments, creative approaches, funnel changes and retention ideas for Meta, each with its evidence, what it should move, the effort, and what the advertising rules allow. Nothing here runs until you choose it.</p></div></div>
  <div class="card"><span class="q">Where we stand against the industry</span><h2>Published benchmarks, and how much to trust them</h2>
    <p>${esc(d.benchmarks.summary ?? "")}</p>
    <div class="kpis">
      <div class="kpi"><span>Industry ROAS, first visit</span><b>${esc((best?.firstVisitROAS?.value ?? "").replace(/ for a typical clinic.*$/, ""))}</b><em>${esc(best?.firstVisitROAS?.reason ?? "")}</em></div>
      <div class="kpi"><span>Industry ROAS, first year</span><b>${esc((best?.yearOneROAS?.value ?? "").replace(/ for a typical clinic.*$/, ""))}</b><em>${esc(best?.yearOneROAS?.reason ?? "")}</em></div>
      <div class="kpi"><span>Our cost per booked consultation</span><b>about £13</b><em>Below every published range; what decides ROAS now is how many booked consultations go on to pay.</em></div>
    </div>
    <details><summary class="muted-s">Every figure, with its source and type</summary><div class="table-wrap"><table><thead><tr><th>Measure</th><th style="text-align:left">Figure</th><th style="text-align:left">Type</th><th style="text-align:left">Where</th><th style="text-align:left">Source</th></tr></thead><tbody>${benchRows}</tbody></table></div></details>
  </div>
  <div class="card"><span class="q">Start here</span><h2>The five to adopt first</h2><div class="kpis">${top}</div></div>
  <div class="card"><div class="head" style="grid-template-columns:minmax(0,1fr) auto"><div><span class="q">Every idea</span><h2>Choose what to try</h2></div>${tabs}</div>
    <div class="ideas">${cards}</div>
    <p class="muted-s">${esc(d.notes ?? "")}</p></div>
</div>
<style>.ideas{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}.idea h3{font-size:15px}.idea p{margin:0}.why{display:block;font-size:11.5px;color:var(--muted)}details summary{cursor:pointer}</style>
<script>(function(){var t=document.getElementById("g-tabs");t.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;var g=b.dataset.g;[].forEach.call(t.querySelectorAll("button"),function(x){x.setAttribute("aria-pressed",String(x===b));});[].forEach.call(document.querySelectorAll(".idea"),function(c){c.hidden=g!=="all"&&c.dataset.group!==g;});});})();</script>`;
  return page(body);
}

function page(body: string) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${HEAD.replace("<title>Winchester Ads Board</title>", "<title>Ads Ideas</title>")}</head><body>${body}</body></html>`;
}
