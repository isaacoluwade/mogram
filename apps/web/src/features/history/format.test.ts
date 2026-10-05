import { describe, expect, it } from "vitest";
import { dayLabel, timeLabel, versionDetail, versionTitle } from "./format";
import type { VersionItem } from "./source";

const at = (iso: string): string => new Date(iso).toISOString();

const version = (overrides: Partial<VersionItem>): VersionItem => ({
  id: "v",
  createdAt: at("2026-10-04T17:00:00"),
  updatedAt: at("2026-10-04T17:00:00"),
  author: "Ada",
  name: null,
  source: "save",
  label: null,
  changes: { line: "Added Orders DB", added: 1, removed: 0, changed: 0, moved: 0 },
  restoredFromAt: null,
  ...overrides,
});

describe("version history wording", () => {
  it("groups by Today, Yesterday, then the date", () => {
    const now = new Date("2026-10-04T18:00:00");
    expect(dayLabel(at("2026-10-04T09:00:00"), now)).toBe("Today");
    expect(dayLabel(at("2026-10-03T23:59:00"), now)).toBe("Yesterday");
    expect(dayLabel(at("2026-09-30T12:00:00"), now)).toMatch(/Sep/);
    expect(dayLabel(at("2025-09-30T12:00:00"), now)).toMatch(/2025/);
  });

  it("shows a working session as a time range", () => {
    expect(timeLabel(version({}))).not.toContain("–");
    expect(
      timeLabel(
        version({ createdAt: at("2026-10-04T17:00:00"), updatedAt: at("2026-10-04T17:25:00") }),
      ),
    ).toContain("–");
  });

  it("calls a version by its name, its prompt, or what changed", () => {
    expect(versionTitle(version({}))).toBe("Added Orders DB");
    expect(versionDetail(version({}))).toBeNull();
    const named = version({ name: "Reviewed" });
    expect(versionTitle(named)).toBe("Reviewed");
    expect(versionDetail(named)).toBe("Added Orders DB");
    const ai = version({ source: "ai", label: "Add a cache in front of the database" });
    expect(versionTitle(ai)).toBe("Add a cache in front of the database");
    expect(versionDetail(ai)).toBe("Added Orders DB");
    expect(versionTitle(version({ source: "create", changes: null }))).toBe("Created");
    expect(versionTitle(version({ source: "import" }))).toBe("Saved to your account");
    expect(
      versionTitle(version({ source: "restore", restoredFromAt: at("2026-10-01T09:30:00") })),
    ).toMatch(/^Restored the version from Oct 1/);
  });
});
