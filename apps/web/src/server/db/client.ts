import "server-only";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import { env } from "../env";
import { schema } from "./schema";

/** Both drivers share Drizzle's Postgres API; code depends only on this type (D-5). */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = join(process.cwd(), "drizzle");

interface DbHolder {
  promise: Promise<Database> | null;
}

// One database per process. Stored on globalThis so dev hot reloads don't open PGlite twice,
// which would corrupt its data directory.
const holder = ((globalThis as { __mogramDb?: DbHolder }).__mogramDb ??= { promise: null });

async function connect(): Promise<Database> {
  const config = env();
  if (config.DATABASE_URL !== undefined && config.DATABASE_URL.length > 0) {
    const pool = new Pool({ connectionString: config.DATABASE_URL, max: 10 });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as Database;
  }
  // Runtime data, not source: tell the bundler not to trace this path into the build output.
  const dataDir =
    config.NODE_ENV === "test"
      ? "memory://"
      : resolve(/*turbopackIgnore: true*/ process.cwd(), config.PGLITE_DATA_DIR);
  if (!dataDir.startsWith("memory://")) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  await client.waitReady;
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Database;
}

export function getDb(): Promise<Database> {
  holder.promise ??= connect().catch((error: unknown) => {
    holder.promise = null;
    throw error;
  });
  return holder.promise;
}
