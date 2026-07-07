import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from "pino-http";
import router from "./routes";
import { authRouter, requireAuth } from "./middlewares/auth";
import { logger } from "./lib/logger";

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
app.use("/uploads", (req, res, next) => requireAuth(req, res, next), express.static(path.join(process.cwd(), "uploads")));

app.use("/api", router);

export default app;
