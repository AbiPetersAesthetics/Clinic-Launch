// Acceptance tests for the market module business rules.
// Run: npm run test:market (bundles the TS lib with esbuild, then asserts).
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const tmp = mkdtempSync(join(tmpdir(), "market-rules-"));
const out = join(tmp, "market-rules.mjs");
execSync(`npx esbuild src/lib/market-rules.ts --bundle --platform=node --format=esm --outfile="${out}"`, { stdio: "inherit" });
const lib = await import(pathToFileURL(out).href);

const treatments = new Map([
  ["aw1", { key: "aw1", displayName: "Anti-wrinkle treatment, 1 area", isPom: true, durationMinutes: 15, priceWinchester: 190, priceBedhampton: 165 }],
  ["led", { key: "led", displayName: "LED session", isPom: false, durationMinutes: 20, priceWinchester: 55, priceBedhampton: 45 }],
  ["apaFacial", { key: "apaFacial", displayName: "APA medical facial", isPom: false, durationMinutes: 45, priceWinchester: 95, priceBedhampton: 75 }],
]);

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("ok -", name); };

// 1. POM validation blocks a public membership containing a POM (the write gate)
test("POM in a public membership is blocked", () => {
  const r = lib.validateMembershipInclusions([{ treatmentKey: "aw1", qtyPerYear: 3 }], true, treatments);
  assert.equal(r.ok, false);
  assert.match(r.error, /prescription-only/i);
  assert.match(r.error, /CAP Code/);
});

// 2. The same inclusions are allowed on a PRIVATE plan (post-consultation enrolment)
test("POM on a private plan is allowed", () => {
  const r = lib.validateMembershipInclusions([{ treatmentKey: "aw1", qtyPerYear: 3 }], false, treatments);
  assert.equal(r.ok, true);
});

// 3. A POM hidden inside a choiceOf list is still caught
test("POM inside choiceOf is blocked", () => {
  const r = lib.validateMembershipInclusions([{ choiceOf: ["led", "aw1"], qtyPerMonth: 1 }], true, treatments);
  assert.equal(r.ok, false);
});

// 4. Frown Free Club can never appear in a public export
test("private membership excluded from public export", () => {
  const memberships = [
    { name: "Skin Circle", isPublic: true },
    { name: "Frown Free Club / APA Treatment Plan", isPublic: false },
    { name: "The Skin Plan", isPublic: true },
  ];
  const exported = lib.buildPublicMembershipExport(memberships);
  assert.equal(exported.length, 2);
  assert.ok(!exported.some(m => /frown free/i.test(m.name)));
});

// 5. Median engine returns n and flags low confidence under 4 samples
test("median exposes n and low-confidence flag", () => {
  const m = lib.computeMedian([
    { priceGbp: 190, qualifier: "exact", competitorId: 1 },
    { priceGbp: 200, qualifier: "exact", competitorId: 2 },
    { priceGbp: 210, qualifier: "from", competitorId: 3 },
  ]);
  assert.equal(m.n, 3);
  assert.equal(m.median, 200);
  assert.equal(m.lowConfidence, true);
  const m2 = lib.computeMedian([
    { priceGbp: 190, qualifier: "exact", competitorId: 1 },
    { priceGbp: 200, qualifier: "exact", competitorId: 2 },
    { priceGbp: 210, qualifier: "from", competitorId: 3 },
    { priceGbp: 220, qualifier: "exact", competitorId: 4 },
  ]);
  assert.equal(m2.lowConfidence, false);
});

// 6. POA rows never count toward a median
test("poa rows excluded from medians", () => {
  const m = lib.computeMedian([
    { priceGbp: null, qualifier: "poa", competitorId: 1 },
    { priceGbp: 300, qualifier: "exact", competitorId: 2 },
  ]);
  assert.equal(m.n, 1);
  assert.equal(m.median, 300);
});

// 7. Variance flags at the 15 percent thresholds
test("variance flags below and above 15 percent", () => {
  assert.equal(lib.varianceFlag(80, 100), "below");
  assert.equal(lib.varianceFlag(120, 100), "above");
  assert.equal(lib.varianceFlag(110, 100), null);
});

// 8. VAT element is gross divided by 6
test("vat element is gross / 6", () => {
  assert.equal(lib.vatElement(300), 50);
  assert.equal(lib.vatElement(190), 31.67);
});

// 9. Gap detection recomputes the September 2026 bands from the data
test("gap detection finds the two open membership bands", () => {
  const points = [
    { low: 12.5, high: 12.5 },  // CJA
    { low: 50, high: 50 },      // Sarah Well-being
    { low: 62, high: 62 },      // Club AL
    { low: 75, high: 105 },     // Sarah x2 + Reverie range
    { low: 149, high: 199 },    // WMA founder to standard
    { low: 160, high: 160 },    // Jane Bulbeck
    { low: 199, high: 199 },    // Esthetic Skin
  ];
  const gaps = lib.detectGaps(points, 30);
  assert.equal(gaps.length, 2);
  assert.deepEqual(gaps[0], { from: 12.5, to: 50, width: 38 });
  assert.deepEqual(gaps[1], { from: 105, to: 149, width: 44 });
});

// 10. Face value is computed from the treatments table, never typed
test("face value computed from treatments per site", () => {
  const fv = lib.computeFaceValue([{ treatmentKey: "led", qtyPerMonth: 1 }], "winchester", treatments);
  assert.equal(fv, 55);
  const fvB = lib.computeFaceValue([{ treatmentKey: "led", qtyPerMonth: 1 }], "bedhampton", treatments);
  assert.equal(fvB, 45);
});

// 11. Revenue per clinical hour
test("revenue per clinical hour", () => {
  assert.equal(lib.revenuePerHour(190, 15), 760); // an injectable hour
  assert.equal(lib.revenuePerHour(95, 45), 127);
});

// 12. Copy compliance rules
test("copy compliance catches banned wording", () => {
  assert.ok(lib.copyComplianceIssues("Save on Botox today").length > 0);
  assert.ok(lib.copyComplianceIssues("exosomes injected deep").length > 0);
  assert.ok(lib.copyComplianceIssues("our beautiful listed building").length > 0);
  assert.ok(lib.copyComplianceIssues("a lovely em dash — here").length > 0);
  assert.equal(lib.copyComplianceIssues("Anti-wrinkle treatment with exosomes applied topically after microneedling.").length, 0);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} tests passed.`);
