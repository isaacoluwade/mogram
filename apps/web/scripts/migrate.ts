// Applies database migrations ahead of a deploy: `DATABASE_URL=postgres://… pnpm db:migrate`.
// (The app also migrates on first connection, so local development needs nothing.)
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (url === undefined || url.length === 0) {
  console.error("Set DATABASE_URL to the Postgres database to migrate.");
  process.exit(1);
}
const pool = new Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), {
    migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
  });
  console.log("Migrations applied.");
} finally {
  await pool.end();
}
