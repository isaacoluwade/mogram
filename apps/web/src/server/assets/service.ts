import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { ASSET_MEDIA_TYPES, parsePointer } from "@mogram/core/assets";
import { LIMITS } from "@/lib/api/contracts";
import { getDb, type Database } from "../db/client";
import { asset, assetUse, diagram, user } from "../db/schema";
import { apiError, readBytes } from "../http";

export const assetHash = z.string().regex(/^[a-f0-9]{64}$/);

/** What the server keeps about an asset besides its bytes. */
export interface StoredAsset {
  readonly type: string;
  readonly bytes: number;
}

/** "Which of these do you have?": the body a client sends before uploading (at most one project's worth). */
export const missingAssetsBody = z.strictObject({
  hashes: z.array(assetHash).max(LIMITS.assetCount),
});

/**
 * The hashes, of those asked about, that this owner hasn't stored: what a client still has to
 * upload before saving (D-101). Asking is cheap; uploading eight megabytes again isn't.
 */
export async function missingAssets(ownerId: string, hashes: readonly string[]): Promise<string[]> {
  const asked = [...new Set(hashes)];
  if (asked.length === 0) return [];
  const db = await getDb();
  const rows = await db
    .select({ hash: asset.hash })
    .from(asset)
    .where(and(eq(asset.ownerId, ownerId), inArray(asset.hash, asked)));
  const stored = new Set(rows.map((row) => row.hash));
  return asked.filter((hash) => !stored.has(hash));
}
const mediaType = z.enum(ASSET_MEDIA_TYPES);

export async function recordAssetUses(
  tx: Pick<Database, "insert">,
  ownerId: string,
  diagramId: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  const hashes = new Set(
    Object.values(files).flatMap((text) => {
      const pointer = parsePointer(text);
      return pointer === null ? [] : [pointer.hash];
    }),
  );
  if (hashes.size > 0)
    await tx
      .insert(assetUse)
      .values([...hashes].map((hash) => ({ diagramId, ownerId, hash })))
      .onConflictDoNothing();
}

export async function uploadAsset(
  ownerId: string,
  hash: string,
  request: Request,
): Promise<Response> {
  if (!assetHash.safeParse(hash).success) return apiError(404, "not_found", "Asset not found.");
  const type = mediaType.safeParse(request.headers.get("content-type")?.split(";")[0]?.trim());
  if (!type.success) return apiError(400, "invalid_type", "Use a supported image or audio type.");
  const bytes = await readBytes(request, LIMITS.assetBytes);
  if (bytes instanceof Response) return bytes;
  if (bytes.length === 0) return apiError(400, "empty_asset", "That asset is empty.");
  if (createHash("sha256").update(bytes).digest("hex") !== hash)
    return apiError(400, "hash_mismatch", "The asset doesn't match its hash.");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, ownerId)).for("update");
    const [existing] = await tx
      .select({ type: asset.type })
      .from(asset)
      .where(and(eq(asset.ownerId, ownerId), eq(asset.hash, hash)))
      .limit(1);
    if (existing !== undefined) {
      return existing.type === type.data
        ? new Response(null, { status: 204 })
        : apiError(
            400,
            "invalid_type",
            "These bytes were already stored with a different media type.",
          );
    }
    const [usage] = await tx
      .select({
        bytes: sql<number>`coalesce(sum(${asset.bytes}), 0)::bigint`,
        count: sql<number>`count(*)::integer`,
      })
      .from(asset)
      .where(eq(asset.ownerId, ownerId));
    if (
      Number(usage?.bytes ?? 0) + bytes.length > LIMITS.assetProjectBytes ||
      Number(usage?.count ?? 0) >= LIMITS.assetCount
    )
      return apiError(413, "asset_quota", "Your assets can total at most 500 MB and 2000 files.");
    await tx
      .insert(asset)
      .values({ ownerId, hash, type: type.data, bytes: bytes.length, data: Buffer.from(bytes) });
    return new Response(null, { status: 201 });
  });
}

export async function ownedAssetMetadata(
  ownerId: string,
  files: Readonly<Record<string, string>>,
): Promise<ReadonlyMap<string, StoredAsset>> {
  const hashes = [
    ...new Set(
      Object.values(files).flatMap((text) => {
        const pointer = parsePointer(text);
        return pointer === null ? [] : [pointer.hash];
      }),
    ),
  ];
  if (hashes.length === 0) return new Map();
  const db = await getDb();
  const rows = await db
    .select({ hash: asset.hash, type: asset.type, bytes: asset.bytes })
    .from(asset)
    .where(and(eq(asset.ownerId, ownerId), inArray(asset.hash, hashes)));
  return new Map(rows.map((row) => [row.hash, { type: row.type, bytes: row.bytes }]));
}

export async function readDiagramAsset(
  identity: { ownerId: string; id: string } | { shareId: string },
  hash: string,
): Promise<Response> {
  const missing = () => apiError(404, "not_found", "Asset not found.");
  if (!assetHash.safeParse(hash).success) return missing();
  if ("id" in identity && !z.uuid().safeParse(identity.id).success) return missing();
  if (
    "shareId" in identity &&
    !z
      .string()
      .regex(/^[A-Za-z0-9_-]{22}$/)
      .safeParse(identity.shareId).success
  )
    return missing();
  const db = await getDb();
  const [project] = await db
    .select({ files: diagram.files, ownerId: diagram.ownerId })
    .from(diagram)
    .where(
      "id" in identity
        ? and(eq(diagram.id, identity.id), eq(diagram.ownerId, identity.ownerId))
        : and(eq(diagram.shareId, identity.shareId), eq(diagram.visibility, "link")),
    )
    .limit(1);
  if (project === undefined) return missing();
  const pointer = Object.values(project.files)
    .map(parsePointer)
    .find((value) => value?.hash === hash);
  if (pointer == null) {
    if (!("id" in identity)) return missing();
    const [reference] = await db
      .select({ hash: assetUse.hash })
      .from(assetUse)
      .where(
        and(
          eq(assetUse.diagramId, identity.id),
          eq(assetUse.ownerId, identity.ownerId),
          eq(assetUse.hash, hash),
        ),
      )
      .limit(1);
    if (reference === undefined) return missing();
  }
  const [stored] = await db
    .select()
    .from(asset)
    .where(and(eq(asset.ownerId, project.ownerId), eq(asset.hash, hash)))
    .limit(1);
  if (
    stored === undefined ||
    (pointer != null && (stored.bytes !== pointer.bytes || stored.type !== pointer.type))
  )
    return missing();
  return new Response(new Uint8Array(stored.data), {
    headers: {
      "Content-Type": stored.type,
      "Content-Length": String(stored.bytes),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
