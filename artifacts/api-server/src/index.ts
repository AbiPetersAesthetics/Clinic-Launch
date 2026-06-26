import app from "./app";
import { logger } from "./lib/logger";
import { runStartupSeed } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Start listening immediately so the deployment healthcheck can pass,
// then run migrations/seed in the background.
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  runStartupSeed()
    .then(() => {
      logger.info("Startup seed completed");
    })
    .catch((err) => {
      logger.error({ err }, "Startup seed failed — continuing");
    });
});
