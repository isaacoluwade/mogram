import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// -------------------------------------------------------------------------------------------------
// Auth tables — the shape Better Auth expects (D-6).

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// -------------------------------------------------------------------------------------------------
// Mogram tables

/** Project files: path → text (binary assets as data: URLs). The YAML is the source of truth (D-4). */
export type StoredFiles = Record<string, string>;

export const diagram = pgTable(
  "diagram",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    files: jsonb("files").$type<StoredFiles>().notNull(),
    /** Optimistic concurrency: every save names the version it was based on. */
    version: integer("version").notNull().default(1),
    /** Private by default until the owner shares it (AC-5). */
    visibility: text("visibility", { enum: ["private", "link"] })
      .notNull()
      .default("private"),
    /** Unguessable 128-bit id used in share links; regenerated to revoke. */
    shareId: text("share_id").unique(),
    /** Advanced share option: viewers may change state (SH-3). Off by default. */
    allowViewerState: boolean("allow_viewer_state").notNull().default(false),
    /** Small rendered SVG for the dashboard grid. */
    thumbnail: text("thumbnail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("diagram_owner_updated_idx").on(table.ownerId, table.updatedAt),
    check("diagram_visibility_check", sql`${table.visibility} in ('private', 'link')`),
  ],
);

export const revision = pgTable(
  "revision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    diagramId: uuid("diagram_id")
      .notNull()
      .references(() => diagram.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    files: jsonb("files").$type<StoredFiles>().notNull(),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("revision_diagram_created_idx").on(table.diagramId, table.createdAt)],
);

// -------------------------------------------------------------------------------------------------
// Sign-in throttling per email address (AC-7). Counted in the database with one atomic statement,
// so it holds across server instances and can't be dodged by spoofing client IP headers.

export const authThrottle = pgTable("auth_throttle", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export const schema = { user, session, account, verification, diagram, revision, authThrottle };
