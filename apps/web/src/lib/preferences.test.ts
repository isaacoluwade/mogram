import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { preference, resetPreferencesCache, setPreference } from "./preferences";

function fakeStorage(initial: Record<string, string>): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

function useWindow(storage: Storage) {
  (globalThis as { window?: unknown }).window = {
    localStorage: storage,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
}

describe("preferences", () => {
  beforeEach(() => resetPreferencesCache());
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("folds the old separate keys in, the first time", () => {
    useWindow(
      fakeStorage({
        "mogram.inspector.sections": JSON.stringify({ "component:card": false }),
        "mogram.inspector.tab.element": "style",
        "mogram.panel.right": "360",
        "mogram.palette.recent": JSON.stringify(["view.grid"]),
      }),
    );
    expect(preference("inspectorSections")).toEqual({ "component:card": false });
    expect(preference("inspectorTabs")).toEqual({ element: "style" });
    expect(preference("rightPanelWidth")).toBe(360);
    expect(preference("paletteRecent")).toEqual(["view.grid"]);
    expect(preference("libraryOpen")).toBeNull();
  });

  it("keeps only what's well formed, and saves changes as one object", () => {
    const storage = fakeStorage({
      "mogram.preferences": JSON.stringify({
        version: 1,
        inspectorSections: { a: true, b: "nope" },
        rightPanelWidth: "wide",
        libraryRecent: ["azure/vm", 3],
      }),
    });
    useWindow(storage);
    expect(preference("inspectorSections")).toEqual({ a: true });
    expect(preference("rightPanelWidth")).toBeNull();
    expect(preference("libraryRecent")).toEqual(["azure/vm"]);
    setPreference("rightPanelWidth", 300);
    expect(JSON.parse(storage.getItem("mogram.preferences") ?? "{}")).toMatchObject({
      version: 1,
      rightPanelWidth: 300,
      inspectorSections: { a: true },
    });
  });

  it("shows the grid as dots by default, and keeps a valid choice", () => {
    useWindow(fakeStorage({}));
    expect(preference("showGrid")).toBe(true);
    expect(preference("gridStyle")).toBe("dots");
    resetPreferencesCache();
    useWindow(
      fakeStorage({
        "mogram.preferences": JSON.stringify({ version: 1, showGrid: false, gridStyle: "lines" }),
      }),
    );
    expect(preference("showGrid")).toBe(false);
    expect(preference("gridStyle")).toBe("lines");
    resetPreferencesCache();
    useWindow(
      fakeStorage({
        "mogram.preferences": JSON.stringify({ version: 1, showGrid: "yes", gridStyle: "hex" }),
      }),
    );
    expect(preference("showGrid")).toBe(true);
    expect(preference("gridStyle")).toBe("dots");
  });

  it("shows a version's own changes by default, and keeps a valid choice", () => {
    useWindow(fakeStorage({}));
    expect(preference("historyChanges")).toBe("previous");
    resetPreferencesCache();
    useWindow(
      fakeStorage({
        "mogram.preferences": JSON.stringify({ version: 1, historyChanges: "current" }),
      }),
    );
    expect(preference("historyChanges")).toBe("current");
    resetPreferencesCache();
    useWindow(
      fakeStorage({ "mogram.preferences": JSON.stringify({ version: 1, historyChanges: "all" }) }),
    );
    expect(preference("historyChanges")).toBe("previous");
  });

  it("falls back to the defaults when storage can't be read", () => {
    (globalThis as { window?: unknown }).window = {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    };
    expect(preference("inspectorTabs")).toEqual({});
  });
});
