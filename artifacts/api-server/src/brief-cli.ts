// Prints today's ALFRED brief as JSON, from the same code the Today screen reads, for the morning
// brief email (scripts/morning-brief.mjs). Run: node --env-file=../../.env dist/brief-cli.mjs
import { composeBrief } from "./routes/brief";

composeBrief(1)
  .then((b) => { process.stdout.write(JSON.stringify(b)); process.exit(0); })
  .catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
