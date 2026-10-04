import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  createDraft,
  deleteDraft,
  duplicateDraft,
  getDraft,
  getDraftThumbnail,
  isDraftId,
  listDrafts,
  saveDraft,
  setDraftThumbnail,
} from "./drafts";

const FILES = { "mogram.yaml": "name: Checkout\ncomponents:\n  web: azure/virtual-machine\n" };

describe("drafts in this browser (AC-1, AC-2)", () => {
  it("creates, reads, saves and lists drafts, newest first", async () => {
    const first = await createDraft("Checkout", FILES);
    expect(isDraftId(first.id)).toBe(true);
    expect(await getDraft(first.id)).toMatchObject({ name: "Checkout", files: FILES });

    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await createDraft("Payments", FILES);
    const listed = (await listDrafts()).filter((d) => d.id === first.id || d.id === second.id);
    expect(listed.map((d) => d.name)).toEqual(["Payments", "Checkout"]);

    const changed = { "mogram.yaml": `${FILES["mogram.yaml"]}  db: azure/sql-database\n` };
    expect(await saveDraft(first.id, { name: "Checkout v2", files: changed })).toBe(true);
    expect(await getDraft(first.id)).toMatchObject({ name: "Checkout v2", files: changed });
  });

  it("never brings back a draft that was deleted (or moved to the account) elsewhere", async () => {
    const draft = await createDraft("Gone soon", FILES);
    await deleteDraft(draft.id);
    expect(await saveDraft(draft.id, { name: "Gone soon", files: FILES })).toBe(false);
    expect(await getDraft(draft.id)).toBeNull();
  });

  it("keeps thumbnails separately, and deletes them with the draft", async () => {
    const draft = await createDraft("With picture", FILES);
    await setDraftThumbnail(draft.id, "data:image/jpeg;base64,AAAA");
    expect(await getDraftThumbnail(draft.id)).toBe("data:image/jpeg;base64,AAAA");
    expect((await listDrafts()).find((d) => d.id === draft.id)?.thumbnail).toBe(
      "data:image/jpeg;base64,AAAA",
    );
    await deleteDraft(draft.id);
    expect(await getDraftThumbnail(draft.id)).toBeNull();
  });

  it("duplicates a draft with its thumbnail, renaming the copy in its files too", async () => {
    const draft = await createDraft("Checkout", FILES);
    await setDraftThumbnail(draft.id, "data:image/jpeg;base64,BBBB");
    const copy = await duplicateDraft(draft.id);
    expect(copy?.name).toBe("Checkout copy");
    expect(copy?.files["mogram.yaml"]).toContain("Checkout copy");
    expect(await getDraftThumbnail(copy?.id ?? "")).toBe("data:image/jpeg;base64,BBBB");
  });

  it("ignores ids that can't be drafts", async () => {
    expect(await getDraft("../../etc")).toBeNull();
    expect(await duplicateDraft("nope")).toBeNull();
  });
});
