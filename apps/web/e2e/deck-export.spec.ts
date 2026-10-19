import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { openProject, recordTwoBeats, shot } from "./support";

// A microphone that's always there and always allowed: Chrome's own, which plays a tone.
test.use({
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
  permissions: ["microphone"],
});

const FILES = {
  "mogram.yaml": `mogram: 1
name: Short course
page: 16:9
deck:
  frame: frame
  slides:
    - section: Start
    - title: { title: Welcome, frame: false }
    - section: How it works
    - flow
`,
  "frame/mogram.yaml": `mogram: 1
name: Frame
shapes:
  footer: { label: "%slide% / %slides%" }
layout:
  footer: [10, 120]
`,
  "title/mogram.yaml": `mogram: 1
name: Title
shapes:
  heading: { label: Short course }
layout:
  heading: [20, 20]
`,
  "flow/mogram.yaml": `mogram: 1
name: The flow
shapes:
  write: { label: Write }
  plan: { label: Plan, show: hidden }
stories:
  main:
    - say: You write it.
      script: You write it down.
    - say: Then you plan.
      script: Then you plan it.
      set: { plan: shown }
layout:
  write: [20, 20]
  plan: [60, 20]
`,
};

async function exportDeck(page: Page, format: string, setup?: () => Promise<void>) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export" });
  await expect(dialog.getByRole("radio", { name: "The whole deck" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await dialog.getByRole("radio", { name: new RegExp(`^${format}`) }).click();
  await setup?.();
  const download = page.waitForEvent("download", { timeout: 240_000 });
  await dialog.getByRole("button", { name: new RegExp(`^Download ${format}`) }).click();
  const saved = await download;
  return { name: saved.suggestedFilename(), bytes: readFileSync(await saved.path()) };
}

test("exports a deck's pages, images and words", async ({ page }) => {
  await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Export" })).toBeVisible();
  await shot(page, "editor/deck-export-dialog");
  await page.keyboard.press("Escape");

  const pdf = await exportDeck(page, "PDF");
  expect(pdf.name).toBe("short-course.pdf");
  expect(pdf.bytes.subarray(0, 8).toString()).toBe("%PDF-1.4");
  expect(pdf.bytes.toString("latin1")).toContain("/Count 2");

  const images = await exportDeck(page, "Images", async () => {
    await page.getByRole("radio", { name: "Each beat" }).click();
    await expect(page.getByTestId("deck-export-detail")).toHaveText("3 images");
  });
  expect(images.name).toBe("short-course.zip");
  expect(Object.keys(unzipSync(new Uint8Array(images.bytes))).sort()).toEqual([
    "short-course/01-start/01-welcome.png",
    "short-course/02-how-it-works/02-the-flow-beat-01.png",
    "short-course/02-how-it-works/02-the-flow-beat-02.png",
  ]);

  const script = await exportDeck(page, "Script");
  expect(script.name).toBe("short-course-script.md");
  const text = script.bytes.toString("utf8");
  expect(text).toContain("## How it works");
  expect(text).toContain("### 2. The flow");
  expect(text).toContain("You write it down.\n\n_Not recorded yet._");

  const subtitles = await exportDeck(page, "Subtitles");
  expect(subtitles.bytes.toString("utf8")).toMatch(/^WEBVTT\n\n1\n00:00:\d\d\.\d{3} --> /);

  const chapters = await exportDeck(page, "Chapters");
  expect(chapters.bytes.toString("utf8")).toMatch(/^0:00 Start\n0:0\d How it works\n$/);
});

test("exports a deck as a video that plays", async ({ page }) => {
  test.setTimeout(300_000);
  await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();
  const video = await exportDeck(page, "Video");
  expect(video.name).toBe("short-course.webm");
  // The EBML magic, then a file Chrome can open, at the page's size, as long as the deck runs.
  expect([...video.bytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  const played = await page.evaluate(
    async (bytes) => {
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "video/webm" }));
      const element = document.createElement("video");
      element.muted = true;
      element.src = url;
      await new Promise((resolve, reject) => {
        element.onloadedmetadata = resolve;
        element.onerror = () => reject(new Error(element.error?.message ?? "It didn't load."));
      });
      element.currentTime = 2;
      await new Promise((resolve) => (element.onseeked = resolve));
      return { width: element.videoWidth, height: element.videoHeight, seconds: element.duration };
    },
    [...video.bytes],
  );
  expect(played).toMatchObject({ width: 1920, height: 1080 });
  expect(played.seconds).toBeGreaterThan(5);
});

/** The video frames in a WebM, by walking its elements: Segment, Cluster, SimpleBlock on track 1. */
function videoFrames(bytes: Uint8Array): number {
  const read = (from: number, to: number) => {
    const out: { id: number; start: number; end: number }[] = [];
    let at = from;
    while (at < to) {
      const idLength = Math.clz32(bytes[at] ?? 0) - 23;
      let id = 0;
      for (let i = 0; i < idLength; i++) id = id * 256 + (bytes[at + i] ?? 0);
      at += idLength;
      const sizeLength = Math.clz32(bytes[at] ?? 0) - 23;
      let size = (bytes[at] ?? 0) & (0xff >> sizeLength);
      for (let i = 1; i < sizeLength; i++) size = size * 256 + (bytes[at + i] ?? 0);
      at += sizeLength;
      out.push({ id, start: at, end: at + size });
      at += size;
    }
    return out;
  };
  const segment = read(0, bytes.length).find((each) => each.id === 0x18538067)!;
  let frames = 0;
  for (const cluster of read(segment.start, segment.end).filter((each) => each.id === 0x1f43b675))
    for (const block of read(cluster.start, cluster.end))
      if (block.id === 0xa3 && bytes[block.start] === 0x81) frames++;
  return frames;
}

test("exports a narrated deck as a video whose voice plays where its beats are", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Script window: read and record" }).click();
  const script = await popup;
  await recordTwoBeats(script);
  await script.close();
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();

  const video = await exportDeck(page, "Video");
  const heard = await page.evaluate(
    async (bytes) => {
      const context = new AudioContext();
      const audio = await context.decodeAudioData(new Uint8Array(bytes).buffer);
      const samples = audio.getChannelData(0);
      // Where it's loud, in seconds: the recordings, not silence.
      let first = -1;
      let last = -1;
      for (let i = 0; i < samples.length; i++)
        if (Math.abs(samples[i] ?? 0) > 0.02) {
          if (first === -1) first = i;
          last = i;
        }
      return {
        seconds: audio.duration,
        from: first / audio.sampleRate,
        to: last / audio.sampleRate,
      };
    },
    [...video.bytes],
  );
  // The still slide comes first (4 s and a cut), so the voice starts after it.
  expect(heard.seconds).toBeGreaterThan(5);
  expect(heard.from).toBeGreaterThan(4);
  expect(heard.to).toBeGreaterThan(heard.from + 1);
});

test("exports a video at 4K and 60 frames a second", async ({ page }) => {
  test.setTimeout(300_000);
  await openProject(
    page,
    {
      "mogram.yaml": "mogram: 1\nname: One slide\npage: 16:9\ndeck:\n  slides: [title]\n",
      "title/mogram.yaml": FILES["title/mogram.yaml"],
    },
    { allowEmptyRoot: true },
  );
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();
  const video = await exportDeck(page, "Video", async () => {
    await page.getByRole("radio", { name: "4K" }).click();
    await page.getByRole("radio", { name: "60", exact: true }).click();
    await expect(page.getByTestId("deck-export-detail")).toHaveText("0:05 · 2160p · 60 fps · WebM");
  });
  const size = await page.evaluate(
    async (bytes) => {
      const element = document.createElement("video");
      element.muted = true;
      element.src = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "video/webm" }));
      await new Promise((resolve, reject) => {
        element.onloadedmetadata = resolve;
        element.onerror = () => reject(new Error("It didn't load."));
      });
      return { width: element.videoWidth, height: element.videoHeight };
    },
    [...video.bytes],
  );
  expect(size).toEqual({ width: 3840, height: 2160 });
  // A still slide holds 4 s, then the end holds 1 s: 5 s at 60 frames a second.
  expect(videoFrames(new Uint8Array(video.bytes))).toBe(300);
});
