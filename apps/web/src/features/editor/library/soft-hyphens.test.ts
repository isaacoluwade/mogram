import { describe, expect, it } from "vitest";
import { softHyphens } from "./soft-hyphens";

const SHY = "­";

describe("softHyphens", () => {
  it("leaves ordinary names alone", () => {
    expect(softHyphens("Amazon S3 Bucket")).toBe("Amazon S3 Bucket");
  });

  it("breaks CamelCase kinds between their words", () => {
    expect(softHyphens("NetworkPolicy")).toBe(`Network${SHY}Policy`);
    expect(softHyphens("HorizontalPodAutoscaler")).toBe(`Horizontal${SHY}Pod${SHY}Autoscaler`);
  });

  it("marks breaks every six letters in other long words", () => {
    expect(softHyphens("Automanaged")).toBe(`Automa${SHY}naged`);
  });
});
