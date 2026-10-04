import { describe, expect, it } from "vitest";
import { editedLabel, relativeTime } from "./format";

const now = Date.parse("2026-10-03T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("relativeTime", () => {
  it("reads like Eden's meta text", () => {
    expect(relativeTime(ago(10_000), now)).toBe("Just now");
    expect(relativeTime(ago(5 * 60_000), now)).toBe("5m ago");
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe("3h ago");
    expect(relativeTime(ago(30 * 3_600_000), now)).toBe("Yesterday");
    expect(relativeTime(ago(4 * 86_400_000), now)).toBe("4d ago");
    expect(relativeTime("2026-09-01T12:00:00Z", now)).toBe("Sep 1");
    expect(relativeTime("2025-09-01T12:00:00Z", now)).toBe("Sep 1, 2025");
  });

  it("is empty for invalid dates and never negative", () => {
    expect(relativeTime("nope", now)).toBe("");
    expect(relativeTime(new Date(now + 60_000).toISOString(), now)).toBe("Just now");
  });
});

describe("editedLabel", () => {
  it("keeps month names capitalised and relative words lower case", () => {
    expect(editedLabel(ago(10_000), now)).toBe("Edited just now");
    expect(editedLabel(ago(30 * 3_600_000), now)).toBe("Edited yesterday");
    expect(editedLabel(ago(5 * 60_000), now)).toBe("Edited 5m ago");
    expect(editedLabel("2026-09-01T12:00:00Z", now)).toBe("Edited Sep 1");
  });
});
