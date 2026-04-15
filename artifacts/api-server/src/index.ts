import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app";
import { logger } from "./lib/logger";

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

async function runMigrations() {
  if (!process.env["DATABASE_URL"]) {
    logger.warn("DATABASE_URL not set — skipping schema sync");
    return;
  }

  logger.info("Syncing database schema with drizzle-kit push...");

  const workspaceRoot = resolve(
    fileURLToPath(import.meta.url),
    "../../../..",
  );

  try {
    execSync("pnpm --filter @workspace/db run push-force", {
      stdio: "inherit",
      cwd: workspaceRoot,
      timeout: 60_000, // 60s max
    });
    logger.info("Database schema synced successfully");
  } catch (err) {
    logger.error({ err }, "Database schema sync failed — server will start anyway");
  }
}

await runMigrations();

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
