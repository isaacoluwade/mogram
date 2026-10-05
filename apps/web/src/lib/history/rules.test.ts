import { describe, expect, it } from "vitest";
import { continuesSession, versionChanges, versionsToPrune, type VersionFacts } from "./rules";

const at = (iso: string) => new Date(iso);

describe("which saves join the version being edited", () => {
  const latest: VersionFacts = {
    createdAt: at("2026-10-04T10:00:00Z"),
    updatedAt: at("2026-10-04T10:12:00Z"),
    name: null,
    source: "save",
    authorId: "u1",
  };

  it("joins a plain save by the same person while they keep working", () => {
    expect(continuesSession(latest, "u1", at("2026-10-04T10:15:00Z"))).toBe(true);
  });

  it("starts a new version after a pause, after half an hour, or for someone else", () => {
    expect(continuesSession(latest, "u1", at("2026-10-04T10:18:00Z"))).toBe(false);
    expect(
      continuesSession(
        { ...latest, updatedAt: at("2026-10-04T10:29:00Z") },
        "u1",
        at("2026-10-04T10:31:00Z"),
      ),
    ).toBe(false);
    expect(continuesSession(latest, "u2", at("2026-10-04T10:13:00Z"))).toBe(false);
  });

  it("never joins a named version, an assistant turn or a restore", () => {
    const now = at("2026-10-04T10:13:00Z");
    expect(continuesSession({ ...latest, name: "Reviewed" }, "u1", now)).toBe(false);
    expect(continuesSession({ ...latest, source: "ai" }, "u1", now)).toBe(false);
    expect(continuesSession({ ...latest, source: "restore" }, "u1", now)).toBe(false);
    expect(continuesSession({ ...latest, source: "create" }, "u1", now)).toBe(false);
  });
});

describe("what a version changed", () => {
  it("says it in one line, with counts", () => {
    const before = { "mogram.yaml": "mogram: 1\ncomponents:\n  a: generic/service\n" };
    const after = {
      "mogram.yaml": "mogram: 1\ncomponents:\n  a: generic/service\n  b: generic/database\n",
    };
    expect(versionChanges(before, after)).toEqual({
      line: "Added B",
      added: 1,
      removed: 0,
      changed: 0,
      moved: 0,
    });
    expect(versionChanges(undefined, after).line).toBe("Created");
  });
});

describe("cleaning up old versions", () => {
  const now = at("2026-10-04T12:00:00Z");
  const v = (id: string, iso: string, name: string | null = null) => ({
    id,
    createdAt: at(iso),
    name,
  });

  it("keeps the last day, then one an hour for 30 days, then one a day; named always", () => {
    const versions = [
      v("now", "2026-10-04T11:59:00Z"),
      v("today", "2026-10-04T01:00:00Z"),
      v("hour-a", "2026-10-02T09:50:00Z"),
      v("hour-b", "2026-10-02T09:10:00Z"),
      v("named", "2026-10-02T09:05:00Z", "Reviewed"),
      v("day-a", "2026-08-01T18:00:00Z"),
      v("day-b", "2026-08-01T07:00:00Z"),
      v("first", "2026-07-01T07:00:00Z"),
    ];
    expect(versionsToPrune(versions, now).sort()).toEqual(["day-b", "hour-b"]);
  });
});
