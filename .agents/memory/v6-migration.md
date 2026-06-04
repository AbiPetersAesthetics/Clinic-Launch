---
name: DB migration pattern
description: How DB migrations work in this project — phase table naming, migration gating
---

Migrations live in `lib/db/src/startup-seed.ts` as inline `ALTER TABLE IF NOT EXISTS` (and UPDATE) statements. They are gated by checking the phase count in the `launch_phases` table (NOT `phases` — that table name was renamed).

Current migration version: V14 (adds invoice_file_url, invoice_vat_status, and UPDATEs david_approved_cap_gbp from 60000 → 80000).

**Why:** drizzle-kit push is not used for schema changes in production — only startup-seed.ts migrations run on deploy.

**How to apply:** Add new statements at the bottom of the existing migration block (inside the "V5 data already present" branch), then increment the version comment.
