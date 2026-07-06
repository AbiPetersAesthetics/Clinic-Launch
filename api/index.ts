// Vercel serverless entry point — wraps the Express API server.
// All /api/* requests are rewritten here (see vercel.json).
import app from "../artifacts/api-server/src/app";

export default app;
