import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction, Router } from "express";
import { Router as makeRouter } from "express";

// Shared-password login with a signed, httpOnly session cookie.
// Enabled only when APP_PASSWORD is set — with it unset (local dev before
// the password was introduced), everything behaves as before.

const COOKIE_NAME = "apa_session";
const SESSION_DAYS = 30;

function secret(): string {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || "dev-secret";
}

function sign(expiryMs: number): string {
  const payload = String(expiryMs);
  const mac = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

function verify(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return false;
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(payload) > Date.now();
}

function readCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE_NAME) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!authEnabled()) return next();
  // The auth endpoints themselves must stay reachable
  if (req.path.startsWith("/auth/")) return next();
  if (verify(readCookie(req))) return next();
  return res.status(401).json({ error: "Not authenticated" });
}

export const authRouter: Router = makeRouter();

authRouter.post("/auth/login", (req, res) => {
  if (!authEnabled()) return res.json({ ok: true, authDisabled: true });
  const { password } = req.body as { password?: string };
  const expected = process.env.APP_PASSWORD!;
  const a = Buffer.from(password ?? "");
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) return res.status(401).json({ error: "Wrong password" });

  const expiry = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(sign(expiry))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}${secure}`,
  );
  return res.json({ ok: true });
});

authRouter.post("/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res.json({ ok: true });
});

authRouter.get("/auth/me", (req, res) => {
  if (!authEnabled()) return res.json({ authenticated: true, authDisabled: true });
  return res.json({ authenticated: verify(readCookie(req)) });
});
