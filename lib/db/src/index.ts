import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] WARNING: DATABASE_URL is not set — database queries will fail at runtime.",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://localhost/placeholder",
});
export const db = drizzle(pool, { schema });

export * from "./schema";
