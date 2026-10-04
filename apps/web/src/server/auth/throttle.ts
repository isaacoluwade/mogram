import "server-only";
import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { authThrottle } from "../db/schema";

/**
 * Counts an attempt against `key` and says whether it is still within `limit` per window.
 * One atomic upsert: concurrent requests can't all slip through on a stale count, and the
 * count lives in the database, so it holds across server instances and restarts.
 */
export async function withinLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const db = await getDb();
  const window = sql`make_interval(secs => ${windowSeconds})`;
  const [row] = await db
    .insert(authThrottle)
    .values({ key, count: 1, resetAt: sql`now() + ${window}` })
    .onConflictDoUpdate({
      target: authThrottle.key,
      set: {
        count: sql`case when ${authThrottle.resetAt} <= now() then 1 else ${authThrottle.count} + 1 end`,
        resetAt: sql`case when ${authThrottle.resetAt} <= now() then now() + ${window} else ${authThrottle.resetAt} end`,
      },
    })
    .returning({ count: authThrottle.count });
  // Old windows are cleared now and then; they're only counters.
  if (Math.random() < 0.02)
    await db.delete(authThrottle).where(lt(authThrottle.resetAt, sql`now() - interval '1 day'`));
  return (row?.count ?? 0) <= limit;
}

/** Throttle keys never store the address itself. */
export function emailKey(scope: string, email: string): string {
  return `${scope}:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
}
