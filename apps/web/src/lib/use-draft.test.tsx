// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDraft } from "./use-draft";

describe("useDraft", () => {
  it("holds local typing, and follows the source when it changes", () => {
    const { result, rerender } = renderHook(({ source }) => useDraft(source), {
      initialProps: { source: "Web VM" },
    });
    expect(result.current[0]).toBe("Web VM");
    act(() => result.current[1]("Web V"));
    expect(result.current[0]).toBe("Web V");
    rerender({ source: "Web VM" });
    expect(result.current[0]).toBe("Web V");
    rerender({ source: "Frontend" });
    expect(result.current[0]).toBe("Frontend");
  });
});
