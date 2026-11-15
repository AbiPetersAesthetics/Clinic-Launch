// Exports the cash model to the clinic repo, rebuilds the 12 month model and pushes it to ALFRED as
// board key "model" (ops/model/README.md). Run after any money change and in the Monday money watch.
// Usage (from the Clinic-Launch folder, after building the API):
//   node --env-file=.env scripts/export-cash-model.mjs "<clinic repo>\ops\model\cash-model-export.json" [--allow-stale]
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const [out, flag] = process.argv.slice(2);
if (!out) { console.error("Give the path to the clinic repo's ops/model/cash-model-export.json"); process.exit(1); }
const run = (file, args, cwd) => execFileSync(process.execPath, [file, ...args], { env: process.env, cwd, stdio: "inherit" });
run(path.join(here, "..", "artifacts", "api-server", "dist", "export-cli.mjs"), [out, ...(flag ? [flag] : [])]);
const modelDir = path.dirname(out);
const clinicRepo = path.resolve(modelDir, "..", "..");
run(path.join(modelDir, "build.js"), [], clinicRepo);
run(path.join(here, "push-board.mjs"), ["model", path.join(modelDir, "model-12-months.json")]);
