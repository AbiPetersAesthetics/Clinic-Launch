// The morning brief email (UX plan 2.7): reads today's ALFRED brief (the same code as the Today
// screen) and writes a house-style spec for abi-peters-skin-clinic/seo/build-report-email.js.
// Prints NOTHING and writes no spec when nothing needs David: silence means fine, and no email goes.
// Usage (from the Clinic-Launch folder, after building the API):
//   node --env-file=.env scripts/morning-brief.mjs <path to write spec.json>
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
if (!out) { console.error("Give the path to write the spec to"); process.exit(1); }
const APP = "https://clinic-launch.onrender.com";
const brief = JSON.parse(execFileSync(process.execPath, [path.join(here, "..", "artifacts", "api-server", "dist", "brief-cli.mjs")], { env: process.env, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }));

if (!brief.total) { console.log("NOTHING"); process.exit(0); }

const AREA = { ads: "Ads", money: "Money", clinic: "Clinic", growth: "Growth" };
const items = brief.items.map((it) => {
  if (it.kind === "proposal") return { title: `${AREA[it.proposal.area] ?? "Proposal"}: ${it.proposal.title}`, detail: it.proposal.why ?? "", href: `${APP}/inbox`, link: "Decide" };
  if (it.kind === "bank") return { title: "Money: the bank balance is out of date", detail: it.detail, href: `${APP}/money?bank=1`, link: "Update it" };
  if (it.kind === "stale") return { title: it.title, detail: it.detail, href: `${APP}${it.href}`, link: "Open" };
  return { title: `${AREA[it.alert.area] ?? ""}${AREA[it.alert.area] ? ": " : ""}${it.alert.title}`, detail: it.alert.detail ?? "", href: `${APP}${it.alert.href ?? "/"}`, link: "Open" };
});
const tile = (k) => k ? { label: k.label, value: k.value ?? "Not yet", was: k.source ? k.source.text : undefined } : null;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const spec = {
  kicker: "ALFRED morning brief",
  date: today,
  status: brief.state === "act" ? "bad" : brief.state === "watch" ? "warn" : "good",
  verdict: brief.verdict.replace(/^(On track|Watch|Act)\.\s*/, ""),
  sub: brief.runs.line,
  banner: brief.items.some((i) => i.kind === "stale") ? "Some figures are stale; they are left out of the verdict." : undefined,
  tiles: brief.vitals.slice(0, 3).map(tile).filter(Boolean),
  sections: [{ title: brief.total === 1 ? "One thing needs you" : `${brief.total} things need you`, items }],
  button: { text: "Open Today in ALFRED", href: `${APP}/` },
  footer: "Built from ALFRED's brief: every figure carries its source and age there. Approvals are recorded in ALFRED and done in the next live session.",
};
const text = JSON.stringify(spec);
if (/[–—]/.test(text)) { console.error("Refused: the brief contains an em or en dash"); process.exit(1); }
writeFileSync(out, JSON.stringify(spec, null, 2));
console.log(`SPEC ${out}: ${brief.total} item(s), ${spec.status}`);
