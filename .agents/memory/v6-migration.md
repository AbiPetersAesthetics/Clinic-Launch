---
name: V6 migration pattern
description: How DB migrations work in startup-seed.ts; critical table name quirk
---

## Rule
All DB schema migrations go in `runV6Migration(projectId)` (or a future vN equivalent) in `lib/db/src/startup-seed.ts`, guarded by checking whether the new data already exists (e.g. check a unique phase name). This function is called from `runStartupSeed()` inside the "V5 data already present" branch, so it runs on every server boot but exits immediately if already applied.

**Why:** drizzle-kit push is blocked by interactive prompts in this environment. All schema changes must be applied directly via `executeSql` (ALTER TABLE) before the Drizzle schema files are updated.

## Critical quirk: table names
The phases table Drizzle ORM name is `phasesTable` but the actual PostgreSQL table name is **`launch_phases`**, not `phases`. The tasks table is **`launch_tasks`**. Using bare `phases` or `tasks` in raw SQL will throw `relation does not exist`.

**How to apply:** Any raw `sql\`...\`` fragment referencing these tables must use `launch_phases` and `launch_tasks`. Always use Drizzle ORM query builder when possible to avoid this.

## New fields added in V6
- `cost_vat_status` TEXT (inc_vat / ex_vat / vat_na / vat_unknown / mixed) — default 'vat_unknown'
- `supply_scope` TEXT (included / excluded / client_supplied / contractor_supplied / to_confirm) — default 'to_confirm'  
- `procurement_status` TEXT (not_required / to_specify / to_quote / quote_received / approved / ordered / delivered / installed / included_in_contractor / excluded_client_direct) — default 'to_specify'

These are on both `launch_tasks` (NOT NULL with defaults) and `property_task_overrides` (nullable).
