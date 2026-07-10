import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from "pino-http";
import fs from "fs";
import router from "./routes";
import { authRouter, requireAuth } from "./middlewares/auth";
import { logger } from "./lib/logger";
import { UPLOADS_ROOT } from "./lib/uploads";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health endpoint — must respond immediately for deployment healthchecks
app.get("/api", (_req, res) => {
  res.json({ status: "ok" });
});

// Login endpoints + guard: everything below (uploads + all /api routes)
// requires a session once APP_PASSWORD is set.
app.use("/api", authRouter);
app.use("/api", requireAuth);
app.use("/uploads", (req, res, next) => requireAuth(req, res, next), express.static(UPLOADS_ROOT));

app.use("/api", router);

// ── Production: serve the built frontend from the same server ───────────────
// (Local dev uses the Vite dev server on 8090 instead; this block only
// activates when the frontend build output exists next to the API build.)
const FRONTEND_DIST = path.resolve(process.cwd(), "artifacts", "clinic-launch-os", "dist", "public");
if (fs.existsSync(path.join(FRONTEND_DIST, "index.html"))) {
  app.use(express.static(FRONTEND_DIST));
  // SPA fallback for client-side routes (anything not /api or /uploads)
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

export default app;
