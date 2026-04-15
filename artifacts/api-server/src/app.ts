import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const isProduction = process.env["NODE_ENV"] === "production";

const DISCORD_HOSTNAMES = new Set([
  "discord.com",
  "discordapp.com",
  "discordsays.com",
]);

const DISCORD_SUFFIXES = [
  ".discord.com",
  ".discordapp.com",
  ".discordsays.com",
];

function isAllowedOrigin(origin: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }

  if (DISCORD_HOSTNAMES.has(hostname)) return true;
  if (DISCORD_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return true;

  const appUrl = process.env["APP_URL"];
  if (appUrl) {
    try {
      return hostname === new URL(appUrl).hostname;
    } catch {
      return false;
    }
  }

  return hostname.endsWith(".railway.app");
}

const corsOrigin: cors.CorsOptions["origin"] = isProduction
  ? (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed = isAllowedOrigin(origin);
      callback(allowed ? null : new Error("CORS: origin not allowed"), allowed);
    }
  : true;

app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (isProduction) {
  const frontendPath = path.resolve(__dirname, "../../paname-rush/dist/public");
  app.use(express.static(frontendPath));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

export default app;
