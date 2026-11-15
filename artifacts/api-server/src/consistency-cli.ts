// Runs the money consistency check and fails when any money screen disagrees with another.
// Run before a push that touches money: node --env-file=../../.env dist/consistency-cli.mjs
import { moneyConsistency } from "./lib/consistency";

moneyConsistency(1).then((checks) => {
  for (const c of checks) console.log(`${c.ok ? "OK  " : "FAIL"} ${c.name}: ${c.detail}`);
  process.exit(checks.every((c) => c.ok) ? 0 : 1);
}).catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
