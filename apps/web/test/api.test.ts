import { beforeAll, describe, expect, it } from "vitest";
import * as authRoute from "@/app/api/auth/[...all]/route";
import * as diagramsRoute from "@/app/api/diagrams/route";
import * as diagramRoute from "@/app/api/diagrams/[id]/route";
import * as duplicateRoute from "@/app/api/diagrams/[id]/duplicate/route";
import * as revisionsRoute from "@/app/api/diagrams/[id]/revisions/route";
import * as revisionRoute from "@/app/api/diagrams/[id]/revisions/[revisionId]/route";
import * as restoreRoute from "@/app/api/diagrams/[id]/revisions/[revisionId]/restore/route";
import * as shareRoute from "@/app/api/diagrams/[id]/share/route";
import * as sharedRoute from "@/app/api/share/[shareId]/route";
import { devMessages } from "@/server/email/mailer";
import { createHash } from "node:crypto";
import { formatPointer } from "@mogram/core/assets";
import * as assetRoute from "@/app/api/assets/[hash]/route";
import * as diagramAssetRoute from "@/app/api/diagrams/[id]/assets/[hash]/route";
import * as sharedAssetRoute from "@/app/api/share/[shareId]/assets/[hash]/route";

/**
 * The REST API end to end (D-7, AC-3 … AC-7): real route handlers, real Better Auth, an
 * in-memory Postgres (PGlite) — only the HTTP server is skipped.
 */

const BASE = "http://localhost:3100";
type Params<T> = { params: Promise<T> };
const params = <T>(value: T): Params<T> => ({ params: Promise.resolve(value) });

function request(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string } = {},
): Request {
  const headers = new Headers({ Origin: BASE });
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (init.cookie !== undefined) headers.set("Cookie", init.cookie);
  return new Request(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
}

async function signIn(email: string): Promise<string> {
  const sent = await authRoute.POST(
    request("/api/auth/email-otp/send-verification-otp", {
      method: "POST",
      body: { email, type: "sign-in" },
    }),
  );
  expect(sent.status).toBe(200);
  const message = devMessages().find((m) => m.to === email);
  const otp = /\b(\d{6})\b/.exec(message?.text ?? "")?.[1];
  expect(otp).toBeDefined();
  const signedIn = await authRoute.POST(
    request("/api/auth/sign-in/email-otp", { method: "POST", body: { email, otp } }),
  );
  expect(signedIn.status).toBe(200);
  const cookies = signedIn.headers.getSetCookie().map((c) => c.split(";")[0]);
  expect(cookies.length).toBeGreaterThan(0);
  return cookies.join("; ");
}

const FILES = {
  "mogram.yaml":
    "mogram: 1\nname: Checkout\ncomponents:\n  web: azure/virtual-machine\n  db: azure/sql-database\nconnections:\n  web_db: { from: web, to: db, flow: traffic }\n",
};

interface Detail {
  id: string;
  name: string;
  version: number;
  visibility: "private" | "link";
  shareId: string | null;
  files: Record<string, string>;
  thumbnail: string | null;
}

async function create(
  cookie: string,
  body: unknown = { name: "Checkout", files: FILES },
): Promise<Detail> {
  const response = await diagramsRoute.POST(
    request("/api/diagrams", { method: "POST", body, cookie }),
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { diagram: Detail }).diagram;
}

let alice = "";
let bob = "";

describe("media assets", () => {
  it("stores code as inert text and enforces its byte limit", async () => {
    const code = "<script>globalThis.executed = true</script>\n  exact indentation\n";
    const project = await create(alice, {
      name: "Code",
      files: { ...FILES, "example.html": code },
    });
    expect(project.files["example.html"]).toBe(code);
    const response = await diagramsRoute.POST(
      request("/api/diagrams", {
        method: "POST",
        cookie: alice,
        body: { name: "Too much code", files: { ...FILES, "large.ts": "x".repeat(200_001) } },
      }),
    );
    expect(response.status).toBe(400);
  });
  it("round-trips bytes with ownership, hash validation and immediate share revocation", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const upload = (cookie: string, digest = hash, type = "image/png") =>
      assetRoute.PUT(
        new Request(`${BASE}/api/assets/${digest}`, {
          method: "PUT",
          headers: { Origin: BASE, Cookie: cookie, "Content-Type": type },
          body: bytes,
        }),
        params({ hash: digest }),
      );
    expect((await upload(alice)).status).toBe(201);
    expect((await upload(alice)).status).toBe(204);
    expect((await upload(alice, "0".repeat(64))).status).toBe(400);
    expect((await upload(alice, hash, "text/html")).status).toBe(400);
    const pointer = formatPointer({
      hash,
      type: "image/png",
      bytes: bytes.length,
      width: 1,
      height: 1,
    });
    const files = { ...FILES, "images/picture.png": pointer };
    const unknown = await diagramsRoute.POST(
      request("/api/diagrams", {
        method: "POST",
        cookie: bob,
        body: { name: "Unknown assets", files },
      }),
    );
    expect(unknown.status).toBe(400);
    const project = await create(alice, { name: "Pictures", files });
    const read = (cookie: string, digest = hash) =>
      diagramAssetRoute.GET(
        request(`/api/diagrams/${project.id}/assets/${digest}`, { cookie }),
        params({ id: project.id, hash: digest }),
      );
    const response = await read(alice);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect((await read(bob)).status).toBe(404);
    expect((await read(alice, "0".repeat(64))).status).toBe(404);
    const shared = await shareRoute.PUT(
      request(`/api/diagrams/${project.id}/share`, {
        method: "PUT",
        cookie: alice,
        body: { visibility: "link", allowViewerState: false },
      }),
      params({ id: project.id }),
    );
    const { diagram: link } = (await shared.json()) as { diagram: { shareId: string } };
    const publicRead = () =>
      sharedAssetRoute.GET(
        request(`/api/share/${link.shareId}/assets/${hash}`),
        params({ shareId: link.shareId, hash }),
      );
    const publicBytes = await publicRead();
    expect(publicBytes.status).toBe(200);
    expect(publicBytes.headers.get("Cache-Control")).toBe("no-store");
    expect(new Uint8Array(await publicBytes.arrayBuffer())).toEqual(bytes);
    const removed = await diagramRoute.PUT(
      request(`/api/diagrams/${project.id}`, {
        method: "PUT",
        cookie: alice,
        body: { files: FILES, baseVersion: project.version },
      }),
      params({ id: project.id }),
    );
    expect(removed.status).toBe(200);
    expect((await read(alice)).status).toBe(200);
    expect((await publicRead()).status).toBe(404);
    await shareRoute.PUT(
      request(`/api/diagrams/${project.id}/share`, {
        method: "PUT",
        cookie: alice,
        body: { visibility: "private", allowViewerState: false },
      }),
      params({ id: project.id }),
    );
    expect((await publicRead()).status).toBe(404);
  });

  it("rejects oversized streamed uploads before buffering them", async () => {
    const response = await assetRoute.PUT(
      new Request(`${BASE}/api/assets/${"0".repeat(64)}`, {
        method: "PUT",
        headers: { Origin: BASE, Cookie: alice, "Content-Type": "image/png" },
        body: new Uint8Array(8_000_001),
      }),
      params({ hash: "0".repeat(64) }),
    );
    expect(response.status).toBe(413);
  });
});

beforeAll(async () => {
  alice = await signIn("alice@example.com");
  bob = await signIn("bob@example.com");
}, 30_000);

describe("accounts (AC-3)", () => {
  it("refuses diagram routes without a session", async () => {
    const response = await diagramsRoute.GET(request("/api/diagrams"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("rejects a wrong sign-in code", async () => {
    await authRoute.POST(
      request("/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        body: { email: "carol@example.com", type: "sign-in" },
      }),
    );
    const response = await authRoute.POST(
      request("/api/auth/sign-in/email-otp", {
        method: "POST",
        body: { email: "carol@example.com", otp: "000000" },
      }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("accepts a sign-in code only once", async () => {
    const email = "dave@example.com";
    await authRoute.POST(
      request("/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        body: { email, type: "sign-in" },
      }),
    );
    const otp = /\b(\d{6})\b/.exec(devMessages().find((m) => m.to === email)?.text ?? "")?.[1];
    const first = await authRoute.POST(
      request("/api/auth/sign-in/email-otp", { method: "POST", body: { email, otp } }),
    );
    expect(first.status).toBe(200);
    const again = await authRoute.POST(
      request("/api/auth/sign-in/email-otp", { method: "POST", body: { email, otp } }),
    );
    expect(again.status).toBeGreaterThanOrEqual(400);
  });
});

describe("diagrams (AC-4, AC-5)", () => {
  it("creates, lists and reads a diagram, private by default", async () => {
    const diagram = await create(alice);
    expect(diagram).toMatchObject({
      name: "Checkout",
      version: 1,
      visibility: "private",
      shareId: null,
    });
    const list = (await (
      await diagramsRoute.GET(request("/api/diagrams", { cookie: alice }))
    ).json()) as { diagrams: Detail[] };
    expect(list.diagrams.map((d) => d.id)).toContain(diagram.id);
    const read = await diagramRoute.GET(
      request(`/api/diagrams/${diagram.id}`, { cookie: alice }),
      params({ id: diagram.id }),
    );
    expect(((await read.json()) as { diagram: Detail }).diagram.files).toEqual(FILES);
  });

  it("hides one person's diagram from everyone else with a 404, never a 403", async () => {
    const diagram = await create(alice);
    for (const response of [
      await diagramRoute.GET(
        request(`/api/diagrams/${diagram.id}`, { cookie: bob }),
        params({ id: diagram.id }),
      ),
      await diagramRoute.PUT(
        request(`/api/diagrams/${diagram.id}`, {
          method: "PUT",
          body: { files: FILES, baseVersion: 1 },
          cookie: bob,
        }),
        params({ id: diagram.id }),
      ),
      await diagramRoute.DELETE(
        request(`/api/diagrams/${diagram.id}`, { method: "DELETE", cookie: bob }),
        params({ id: diagram.id }),
      ),
      await shareRoute.PUT(
        request(`/api/diagrams/${diagram.id}/share`, {
          method: "PUT",
          body: { visibility: "link", allowViewerState: false },
          cookie: bob,
        }),
        params({ id: diagram.id }),
      ),
      await revisionsRoute.GET(
        request(`/api/diagrams/${diagram.id}/revisions`, { cookie: bob }),
        params({ id: diagram.id }),
      ),
    ]) {
      expect(response.status).toBe(404);
    }
    const bobs = (await (
      await diagramsRoute.GET(request("/api/diagrams", { cookie: bob }))
    ).json()) as { diagrams: Detail[] };
    expect(bobs.diagrams.some((d) => d.id === diagram.id)).toBe(false);
  });

  it("treats malformed ids as not found", async () => {
    const response = await diagramRoute.GET(
      request("/api/diagrams/not-a-uuid", { cookie: alice }),
      params({ id: "not-a-uuid" }),
    );
    expect(response.status).toBe(404);
  });

  it("saves with optimistic concurrency: a stale version gets 409 with the current version", async () => {
    const diagram = await create(alice);
    const next = { ...FILES, "mogram.yaml": `${FILES["mogram.yaml"]}# edited\n` };
    const saved = await diagramRoute.PUT(
      request(`/api/diagrams/${diagram.id}`, {
        method: "PUT",
        body: { files: next, baseVersion: 1 },
        cookie: alice,
      }),
      params({ id: diagram.id }),
    );
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ version: 2 });
    const stale = await diagramRoute.PUT(
      request(`/api/diagrams/${diagram.id}`, {
        method: "PUT",
        body: { files: FILES, baseVersion: 1 },
        cookie: alice,
      }),
      params({ id: diagram.id }),
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: { code: "conflict" }, currentVersion: 2 });
  });

  it("validates every input against the contract", async () => {
    const bad = [
      { name: "", files: FILES },
      { name: "x".repeat(121), files: FILES },
      { name: "Bad path", files: { "../etc/passwd": "x" } },
      { name: "Bad type", files: { "mogram.yaml": "a: 1", "program.exe": "binary" } },
      { name: "Extra key", files: FILES, owner: "someone-else" },
    ];
    for (const body of bad) {
      const response = await diagramsRoute.POST(
        request("/api/diagrams", { method: "POST", body, cookie: alice }),
      );
      expect(response.status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
    const notJson = await diagramsRoute.POST(
      new Request(`${BASE}/api/diagrams`, {
        method: "POST",
        headers: { Origin: BASE, Cookie: alice, "Content-Type": "application/json" },
        body: "{nope",
      }),
    );
    expect(notJson.status).toBe(400);
  });

  it("cleans uploaded SVG icons and refuses ones that load remote content (IC-4, AC-7)", async () => {
    const scripted = await create(alice, {
      name: "Icons",
      files: {
        ...FILES,
        "icons/a.svg":
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect onload="alert(2)" width="4" height="4"/></svg>',
      },
    });
    expect(scripted.files["icons/a.svg"]).not.toMatch(/script|onload/i);
    const remote = await diagramsRoute.POST(
      request("/api/diagrams", {
        method: "POST",
        cookie: alice,
        body: {
          name: "Remote",
          files: {
            ...FILES,
            "icons/b.svg":
              '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>',
          },
        },
      }),
    );
    expect(remote.status).toBe(400);
  });

  it("renames into the YAML too (a new version), and stores only raster thumbnails", async () => {
    const diagram = await create(alice);
    const renamed = await diagramRoute.PATCH(
      request(`/api/diagrams/${diagram.id}`, {
        method: "PATCH",
        body: { name: "Storefront" },
        cookie: alice,
      }),
      params({ id: diagram.id }),
    );
    expect(renamed.status).toBe(200);
    const detail = (
      (await (
        await diagramRoute.GET(
          request(`/api/diagrams/${diagram.id}`, { cookie: alice }),
          params({ id: diagram.id }),
        )
      ).json()) as { diagram: Detail }
    ).diagram;
    expect(detail.name).toBe("Storefront");
    expect(detail.version).toBe(2);
    expect(detail.files["mogram.yaml"]).toContain("name: Storefront");

    const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
    await diagramRoute.PATCH(
      request(`/api/diagrams/${diagram.id}`, {
        method: "PATCH",
        body: { thumbnail: jpeg },
        cookie: alice,
      }),
      params({ id: diagram.id }),
    );
    await diagramRoute.PATCH(
      request(`/api/diagrams/${diagram.id}`, {
        method: "PATCH",
        body: { thumbnail: "<svg onload=alert(1)>" },
        cookie: alice,
      }),
      params({ id: diagram.id }),
    );
    const after = (
      (await (
        await diagramRoute.GET(
          request(`/api/diagrams/${diagram.id}`, { cookie: alice }),
          params({ id: diagram.id }),
        )
      ).json()) as { diagram: Detail }
    ).diagram;
    expect(after.thumbnail).toBeNull();
    expect(after.version).toBe(2);
  });

  it("duplicates with “copy” in the name and the YAML", async () => {
    const diagram = await create(alice);
    const response = await duplicateRoute.POST(
      request(`/api/diagrams/${diagram.id}/duplicate`, { method: "POST", cookie: alice }),
      params({ id: diagram.id }),
    );
    expect(response.status).toBe(201);
    const copy = ((await response.json()) as { diagram: Detail }).diagram;
    expect(copy.id).not.toBe(diagram.id);
    expect(copy.name).toBe("Checkout copy");
    expect(copy.files["mogram.yaml"]).toContain("name: Checkout copy");
  });

  it("deletes, after which the diagram is gone", async () => {
    const diagram = await create(alice);
    const removed = await diagramRoute.DELETE(
      request(`/api/diagrams/${diagram.id}`, { method: "DELETE", cookie: alice }),
      params({ id: diagram.id }),
    );
    expect(removed.status).toBe(204);
    const read = await diagramRoute.GET(
      request(`/api/diagrams/${diagram.id}`, { cookie: alice }),
      params({ id: diagram.id }),
    );
    expect(read.status).toBe(404);
  });
});

describe("share links (SH-1, SH-3, SH-5, AC-5)", () => {
  it("opens only while sharing is on, always shows the latest save, and can be reset", async () => {
    const diagram = await create(alice);
    const shared = await shareRoute.PUT(
      request(`/api/diagrams/${diagram.id}/share`, {
        method: "PUT",
        body: { visibility: "link", allowViewerState: true },
        cookie: alice,
      }),
      params({ id: diagram.id }),
    );
    const { shareId } = ((await shared.json()) as { diagram: Detail }).diagram;
    expect(shareId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const id = shareId ?? "";

    const open = await sharedRoute.GET(request(`/api/share/${id}`), params({ shareId: id }));
    expect(open.status).toBe(200);
    expect(open.headers.get("X-Robots-Tag")).toBe("noindex");
    const body = (await open.json()) as { diagram: Record<string, unknown> };
    expect(Object.keys(body.diagram).sort()).toEqual([
      "allowViewerState",
      "files",
      "name",
      "updatedAt",
    ]);

    const next = { "mogram.yaml": `${FILES["mogram.yaml"]}# v2\n` };
    await diagramRoute.PUT(
      request(`/api/diagrams/${diagram.id}`, {
        method: "PUT",
        body: { files: next, baseVersion: 1 },
        cookie: alice,
      }),
      params({ id: diagram.id }),
    );
    const latest = (await (
      await sharedRoute.GET(request(`/api/share/${id}`), params({ shareId: id }))
    ).json()) as { diagram: { files: Record<string, string> } };
    expect(latest.diagram.files).toEqual(next);

    const reset = await shareRoute.PUT(
      request(`/api/diagrams/${diagram.id}/share`, {
        method: "PUT",
        body: { visibility: "link", allowViewerState: true, regenerateLink: true },
        cookie: alice,
      }),
      params({ id: diagram.id }),
    );
    const newId = ((await reset.json()) as { diagram: Detail }).diagram.shareId ?? "";
    expect(newId).not.toBe(id);
    expect(
      (await sharedRoute.GET(request(`/api/share/${id}`), params({ shareId: id }))).status,
    ).toBe(404);

    await shareRoute.PUT(
      request(`/api/diagrams/${diagram.id}/share`, {
        method: "PUT",
        body: { visibility: "private", allowViewerState: false },
        cookie: alice,
      }),
      params({ id: diagram.id }),
    );
    expect(
      (await sharedRoute.GET(request(`/api/share/${newId}`), params({ shareId: newId }))).status,
    ).toBe(404);
  });

  it("answers malformed share ids with the same 404", async () => {
    for (const shareId of ["x", "../../etc", "a".repeat(200)]) {
      expect(
        (
          await sharedRoute.GET(
            request(`/api/share/${encodeURIComponent(shareId)}`),
            params({ shareId }),
          )
        ).status,
      ).toBe(404);
    }
  });
});

describe("version history", () => {
  it("lists versions and restores an earlier one as a new version", async () => {
    const diagram = await create(alice);
    const next = { "mogram.yaml": `${FILES["mogram.yaml"]}# later\n` };
    await diagramRoute.PUT(
      request(`/api/diagrams/${diagram.id}`, {
        method: "PUT",
        body: { files: next, baseVersion: 1 },
        cookie: alice,
      }),
      params({ id: diagram.id }),
    );
    const listed = (await (
      await revisionsRoute.GET(
        request(`/api/diagrams/${diagram.id}/revisions`, { cookie: alice }),
        params({ id: diagram.id }),
      )
    ).json()) as {
      revisions: { id: string; version: number }[];
    };
    // The first version is always kept; later saves seconds apart coalesce into one revision.
    expect(listed.revisions.map((r) => r.version)).toEqual([2, 1]);
    const oldest = listed.revisions.at(-1);
    expect(oldest).toBeDefined();
    const revisionId = oldest?.id ?? "";
    const files = (await (
      await revisionRoute.GET(
        request(`/api/diagrams/${diagram.id}/revisions/${revisionId}`, { cookie: alice }),
        params({ id: diagram.id, revisionId }),
      )
    ).json()) as {
      files: Record<string, string>;
    };
    expect(files.files["mogram.yaml"]).toBeDefined();
    const restored = await restoreRoute.POST(
      request(`/api/diagrams/${diagram.id}/revisions/${revisionId}/restore`, {
        method: "POST",
        cookie: alice,
      }),
      params({ id: diagram.id, revisionId }),
    );
    expect(restored.status).toBe(200);
    expect(((await restored.json()) as { version: number }).version).toBe(3);
  });

  it("keeps the first version even when the next saves come straight after it", async () => {
    const diagram = await create(alice);
    for (const [baseVersion, extra] of [
      [1, "# one\n"],
      [2, "# two\n"],
      [3, "# three\n"],
    ] as const) {
      const saved = await diagramRoute.PUT(
        request(`/api/diagrams/${diagram.id}`, {
          method: "PUT",
          body: { files: { "mogram.yaml": `${FILES["mogram.yaml"]}${extra}` }, baseVersion },
          cookie: alice,
        }),
        params({ id: diagram.id }),
      );
      expect(saved.status).toBe(200);
    }
    const { revisions } = (await (
      await revisionsRoute.GET(
        request(`/api/diagrams/${diagram.id}/revisions`, { cookie: alice }),
        params({ id: diagram.id }),
      )
    ).json()) as { revisions: { version: number }[] };
    expect(revisions.map((r) => r.version)).toEqual([4, 1]);
  });

  it("restores the name with the files, since renames are written into the YAML", async () => {
    const diagram = await create(alice);
    const renamed = await diagramRoute.PATCH(
      request(`/api/diagrams/${diagram.id}`, {
        method: "PATCH",
        body: { name: "Storefront" },
        cookie: alice,
      }),
      params({ id: diagram.id }),
    );
    expect(renamed.status).toBe(200);
    const { revisions } = (await (
      await revisionsRoute.GET(
        request(`/api/diagrams/${diagram.id}/revisions`, { cookie: alice }),
        params({ id: diagram.id }),
      )
    ).json()) as { revisions: { id: string; version: number }[] };
    const first = revisions.find((r) => r.version === 1);
    expect(first).toBeDefined();
    const revisionId = first?.id ?? "";
    await restoreRoute.POST(
      request(`/api/diagrams/${diagram.id}/revisions/${revisionId}/restore`, {
        method: "POST",
        cookie: alice,
      }),
      params({ id: diagram.id, revisionId }),
    );
    const after = (await (
      await diagramRoute.GET(
        request(`/api/diagrams/${diagram.id}`, { cookie: alice }),
        params({ id: diagram.id }),
      )
    ).json()) as { diagram: Detail };
    expect(after.diagram.name).toBe("Checkout");
  });
});

describe("security hardening (AC-7)", () => {
  it("only serves the auth endpoints Mogram uses", async () => {
    for (const path of [
      "/api/auth/email-otp/check-verification-otp",
      "/api/auth/sign-up/email",
      "/api/auth/change-email",
      "/api/auth/email-otp/reset-password",
    ]) {
      const response = await authRoute.POST(
        request(path, { method: "POST", body: { email: "x@example.com", otp: "000000" } }),
      );
      expect(response.status, path).toBe(404);
    }
  });

  it("limits code emails per address, whatever IP they come from", async () => {
    const email = "throttle-send@example.com";
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const req = request("/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        body: { email, type: "sign-in" },
      });
      req.headers.set("x-forwarded-for", `10.0.0.${i}`);
      statuses.push((await authRoute.POST(req)).status);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  });

  it("limits sign-in attempts per address, so a code can't be guessed", async () => {
    const email = "throttle-guess@example.com";
    await authRoute.POST(
      request("/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        body: { email, type: "sign-in" },
      }),
    );
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const req = request("/api/auth/sign-in/email-otp", {
        method: "POST",
        body: { email, otp: String(100000 + i) },
      });
      req.headers.set("x-forwarded-for", `10.1.0.${i}`);
      statuses.push((await authRoute.POST(req)).status);
    }
    expect(statuses[10]).toBe(429);
  });

  it("refuses changes from other sites", async () => {
    const evil = new Request(`${BASE}/api/diagrams`, {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        Cookie: alice,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "x", files: FILES }),
    });
    expect((await diagramsRoute.POST(evil)).status).toBe(403);
    const crossSite = new Request(`${BASE}/api/diagrams`, {
      method: "POST",
      headers: {
        "Sec-Fetch-Site": "cross-site",
        Cookie: alice,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "x", files: FILES }),
    });
    expect((await diagramsRoute.POST(crossSite)).status).toBe(403);
  });

  it("counts the bytes actually sent, not the declared length", async () => {
    const chunk = new TextEncoder().encode("x".repeat(1_000_000));
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent++ < 8) controller.enqueue(chunk);
        else controller.close();
      },
    });
    const response = await diagramsRoute.POST(
      new Request(`${BASE}/api/diagrams`, {
        method: "POST",
        headers: { Origin: BASE, Cookie: alice },
        body,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );
    expect(response.status).toBe(413);
  });

  it("refuses YAML or markdown larger than the parser reads", async () => {
    const big = `# ${"x".repeat(1_100_000)}\n`;
    const response = await diagramsRoute.POST(
      request("/api/diagrams", {
        method: "POST",
        cookie: alice,
        body: { name: "Big", files: { ...FILES, "docs/big.md": big } },
      }),
    );
    expect(response.status).toBe(400);
  });
});
