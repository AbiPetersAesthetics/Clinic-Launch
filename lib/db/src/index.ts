import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Neon over node-postgres: `channel_binding=require` and strict TLS verification
// in the connection string succeed under some Node/OpenSSL builds (local) but
// fail under others (e.g. Render's runtime), which 500s every query. Strip those
// params and connect over TLS with relaxed CA verification so the SAME
// DATABASE_URL works in every environment. The connection is still encrypted.
function normalizeDbUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete("channel_binding");
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

export const pool = new Pool({
  connectionString: normalizeDbUrl(process.env.DATABASE_URL),
  ssl: { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

export * from "./schema";
export { runStartupSeed } from "./startup-seed";
