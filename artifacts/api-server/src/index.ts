import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrate";

const port = Number(process.env["PORT"] ?? 8080);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env["PORT"]}"`);
}

// Start listening first so Railway's health check responds immediately,
// then run schema migrations in the background.
app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  setImmediate(() => {
    runMigrations().catch((err) =>
      logger.error({ err }, "Unexpected error in runMigrations"),
    );
  });
});
