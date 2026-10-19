// The prompter's bench (D-96): does it keep its place when a script is actually spoken?
//
// It makes recordings of a script being read (macOS `say`, in several voices and at several
// speeds, with ad-libs, a skipped paragraph and a sentence read twice), plays each one into the
// prompter as its microphone, in the installed Chrome with its on-device recogniser, and
// measures how far the prompter's place is from the reader's.
//
//   node scripts/prompter-bench.mjs                 every reading
//   node scripts/prompter-bench.mjs straight fast   only those
//   BENCH_SCRIPT=talk.txt node scripts/prompter-bench.mjs straight
//                                                   your own script (paragraphs a blank line
//                                                   apart), read straight, fast or slow
//
//   BENCH_SPOKEN=folder node scripts/prompter-bench.mjs
//                                                   recordings of people instead of `say`:
//                                                   the folder has manifest.json, a list of
//                                                   { file, text, chapter } in reading order
//                                                   (file: a WAV, 16-bit mono at 24 kHz).
//                                                   Record yourself reading a script once and
//                                                   it can be replayed after every change.
//
// Needs macOS, Chrome 139 or later, and the app on http://localhost:3100 (BENCH_URL to change).
// Chrome is started plainly rather than through Playwright's launcher: with the launcher's
// flags the recogniser hears the audio and says nothing until the session ends.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const URL_BASE = process.env.BENCH_URL ?? "http://localhost:3100";
const CHROME =
  process.env.BENCH_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Kept between runs: the language pack is downloaded into it once.
const PROFILE = process.env.BENCH_PROFILE ?? join(tmpdir(), "mogram-prompter-bench-profile");
const PORT = 9377;
const RATE = 24000;

const OWN = process.env.BENCH_SCRIPT;
const SPOKEN = process.env.BENCH_SPOKEN;
/** Recordings of people: what each says, and which part of the reading it belongs to. */
const TAKES =
  SPOKEN === undefined ? [] : JSON.parse(readFileSync(join(SPOKEN, "manifest.json"), "utf8"));
// With recordings, the last chapter isn't in the script: its takes are the ad-libs.
const CHAPTERS = [...new Set(TAKES.map((take) => take.chapter))];
const SCRIPTED = TAKES.filter((take) => CHAPTERS.length < 2 || take.chapter !== CHAPTERS.at(-1));
const UNSCRIPTED = TAKES.filter((take) => !SCRIPTED.includes(take));
const SCRIPT =
  SPOKEN !== undefined
    ? SCRIPTED.map((take) => take.text)
    : OWN !== undefined
      ? paragraphsOf(readFileSync(OWN, "utf8"))
      : [
          "So Terraform has read your file, and it has asked Azure what exists right now. Two lists: what you wrote, and what's really there.",
          "And the plan is just the difference between those two things. Nothing has been touched yet. It's a preview, and you can read it as many times as you like.",
          "Look at the symbols down the left. A plus means Terraform will create something. A tilde means it will change something in place. A minus means it will destroy it.",
          "The one to watch for is minus slash plus. That means destroy and then create again, and for a database that is usually not what you wanted.",
          "At the bottom there's a summary line: three to add, one to change, zero to destroy. Read that line every single time before you type yes.",
          "When you run apply, Terraform does exactly what the plan said, in an order it works out from the references between your resources.",
          "And when it's finished it writes down what it made in the state file, so that next time it knows which real things belong to which lines of your code.",
          "That's the whole loop: write, plan, read the plan, apply. Everything else in this course is detail on top of those four steps.",
        ];

const ASIDES = [
  "Okay, hang on a second, let me just move this window out of the way.",
  "Sorry, I lost my place for a moment there. Right.",
  "By the way, if you're new here, the earlier videos cover how to install all of this.",
];

function paragraphsOf(text) {
  return text
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph !== "");
}

/** A reading: what's said, in order. `beat` is a paragraph of the script; `aside` isn't in it. */
const READINGS = {
  straight: { voice: "Samantha", rate: 175, parts: SCRIPT.map((_, beat) => ({ beat })) },
  fast: { voice: "Daniel", rate: 220, parts: SCRIPT.map((_, beat) => ({ beat })) },
  slow: { voice: "Karen", rate: 140, parts: SCRIPT.map((_, beat) => ({ beat })) },
  // Other accents than the one the recogniser was mostly taught on.
  indian: { voice: "Rishi", rate: 175, parts: SCRIPT.map((_, beat) => ({ beat })) },
  irish: { voice: "Moira", rate: 175, parts: SCRIPT.map((_, beat) => ({ beat })) },
  southAfrican: { voice: "Tessa", rate: 175, parts: SCRIPT.map((_, beat) => ({ beat })) },
  // A room that isn't quiet: a steady hiss under the voice, about as loud as a fan nearby.
  noisy: { voice: "Samantha", rate: 175, noise: 0.03, parts: SCRIPT.map((_, beat) => ({ beat })) },
  // Long silences: Chrome ends a session that hears nothing, and it has to pick up again.
  pauses: {
    voice: "Samantha",
    rate: 175,
    parts: [{ beat: 0, pause: 12 }, { beat: 1 }, { beat: 2, pause: 25 }, { beat: 3 }, { beat: 4 }],
  },
  asides: {
    voice: "Samantha",
    rate: 180,
    parts: [
      { beat: 0 },
      { aside: ASIDES[0] },
      { beat: 1 },
      { beat: 2 },
      { aside: ASIDES[1] },
      { beat: 3 },
      { beat: 4 },
      { aside: ASIDES[2] },
      { beat: 5 },
      { beat: 6 },
      { beat: 7 },
    ],
  },
  skipping: {
    voice: "Samantha",
    rate: 180,
    // The third and fourth paragraphs are left out; the sixth is too.
    parts: [{ beat: 0 }, { beat: 1 }, { beat: 4 }, { beat: 6 }, { beat: 7 }],
  },
  again: {
    voice: "Daniel",
    rate: 185,
    // A paragraph fluffed and read again from its start.
    parts: [{ beat: 0 }, { beat: 1 }, { beat: 2 }, { beat: 2 }, { beat: 3 }, { beat: 4 }],
  },
  loose: {
    voice: "Samantha",
    rate: 180,
    // Read the way people read: words dropped, swapped and added.
    parts: [
      {
        beat: 0,
        as: "So Terraform's read your file, and it's asked Azure what exists at the moment. Two lists: the things you wrote, and what's actually there.",
      },
      {
        beat: 1,
        as: "The plan is the difference between those two. Nothing's been touched yet. It's only a preview, you can read it as often as you like.",
      },
      {
        beat: 2,
        as: "Look at the symbols on the left. Plus means Terraform is going to create something. Tilde means it'll change something in place. And minus means it will destroy it.",
      },
      { beat: 3 },
      {
        beat: 4,
        as: "At the bottom there is a summary: three to add, one to change, zero to destroy. Read that line every time before typing yes.",
      },
    ],
  },
};

if (SPOKEN !== undefined) {
  for (const name of Object.keys(READINGS)) delete READINGS[name];
  const take = (index) => ({ beat: index, file: join(SPOKEN, SCRIPTED[index].file) });
  // Everything, as recorded.
  READINGS.human = { voice: "a person", rate: 0, parts: SCRIPTED.map((_, index) => take(index)) };
  // The same reader wandering: asides every few takes, five takes skipped, three read twice.
  const parts = [];
  SCRIPTED.forEach((_, index) => {
    if (index >= 12 && index < 17) return;
    parts.push(take(index));
    if (index === 24) parts.push(take(22), take(23), take(24));
    const aside = UNSCRIPTED[Math.floor(index / 6)];
    if (index % 6 === 5 && aside !== undefined)
      parts.push({ aside: aside.text, file: join(SPOKEN, aside.file) });
  });
  READINGS.wandering = { voice: "a person", rate: 0, parts };
}

const isWord = (word) => /[a-z0-9]/i.test(word.normalize("NFKD"));
const countWords = (text) => text.split(/\s+/).filter(isWord).length;
/** Where each paragraph starts in the script, in words. */
const FIRST = SCRIPT.reduce((firsts, text) => [...firsts, firsts.at(-1) + countWords(text)], [0]);

function pcmOf(path) {
  const file = readFileSync(path);
  let at = 12;
  while (at < file.length - 8) {
    const size = file.readUInt32LE(at + 4);
    if (file.toString("latin1", at, at + 4) === "data")
      return file.subarray(at + 8, Math.min(file.length, at + 8 + size));
    at += 8 + size + (size % 2);
  }
  throw new Error(`No audio in ${path}`);
}

function wavOf(pcm) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Speaks a reading into one recording, and says when each part of it starts and ends. */
function record(reading, folder) {
  const gap = Buffer.alloc(Math.round(RATE * 0.45) * 2);
  const chunks = [Buffer.alloc(RATE * 2)]; // A second of quiet first.
  const parts = [];
  let seconds = 1;
  reading.parts.forEach((part, index) => {
    const text = part.aside ?? part.as ?? SCRIPT[part.beat];
    const path = part.file ?? join(folder, `${index}.wav`);
    if (part.file === undefined)
      execFileSync("say", [
        "-v",
        reading.voice,
        "-r",
        String(reading.rate),
        `--data-format=LEI16@${RATE}`,
        "-o",
        path,
        text,
      ]);
    const pcm = pcmOf(path);
    const length = pcm.length / 2 / RATE;
    parts.push({ ...part, from: seconds, to: seconds + length });
    const quiet = Buffer.alloc(Math.round(RATE * (part.pause ?? 0)) * 2);
    chunks.push(pcm, gap, quiet);
    seconds += length + 0.45 + (part.pause ?? 0);
  });
  chunks.push(Buffer.alloc(RATE * 2 * 3)); // And three of quiet after, for the last words to land.
  const pcm = Buffer.concat(chunks);
  if (reading.noise !== undefined) {
    // The same hiss every run, so a run can be compared with the last.
    let seed = 12345;
    for (let at = 0; at < pcm.length; at += 2) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const hiss = (seed / 0x7fffffff - 0.5) * 2 * reading.noise * 32767;
      pcm.writeInt16LE(Math.max(-32768, Math.min(32767, pcm.readInt16LE(at) + hiss)), at);
    }
  }
  return { wav: wavOf(pcm), parts, seconds: seconds + 3 };
}

/** Where the reader is in the script at a moment of a recording, in words said. */
function readerAt(parts, seconds) {
  let place = 0;
  for (const part of parts) {
    if (seconds < part.from) break;
    if (part.aside !== undefined) continue;
    const first = FIRST[part.beat];
    const words = FIRST[part.beat + 1] - first;
    place = first + Math.round(words * Math.min(1, (seconds - part.from) / (part.to - part.from)));
  }
  return place;
}

async function play(context, name, reading, folder) {
  const { wav, parts, seconds } = record(reading, folder);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.route("**/prompter-bench.wav", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: wav }),
  );
  await page.addInitScript((script) => {
    window.localStorage.setItem("mogram-prompter-script", script);
    // The readings skip whole paragraphs and go back: the widest reach is what's measured.
    window.localStorage.setItem("mogram-prompter", JSON.stringify({ reach: "anywhere" }));
    // The recording is the microphone.
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext();
      const bytes = await (await fetch("/prompter-bench.wav")).arrayBuffer();
      const source = context.createBufferSource();
      source.buffer = await context.decodeAudioData(bytes);
      const out = context.createMediaStreamDestination();
      source.connect(out);
      window.benchStart = () => {
        source.start();
        return performance.now();
      };
      return out.stream;
    };
  }, SCRIPT.join("\n\n"));
  await page.goto(`${URL_BASE}/prompter`);
  await page.getByRole("button", { name: /Read it/ }).click();
  const stage = page.getByTestId("prompter");
  await stage.waitFor();
  await page.keyboard.press("Space");
  await page
    .locator('[data-testid="prompter"][data-listening="true"]')
    .waitFor({ timeout: 180_000 });
  // A picture of it following, a third of the way through.
  const picture =
    process.env.BENCH_SHOT === undefined
      ? null
      : setTimeout(
          () => void page.screenshot({ path: process.env.BENCH_SHOT }).catch(() => undefined),
          (seconds / 3) * 1000,
        );
  const { samples, heard } = await page.evaluate(async (length) => {
    const stage = document.querySelector('[data-testid="prompter"]');
    const began = window.benchStart();
    const samples = [];
    // What the recogniser said, each time it changed: kept to replay through the follower.
    const heard = [];
    const words = document.querySelector('[data-testid="prompter-heard"]');
    new MutationObserver(() =>
      heard.push([Math.round(performance.now() - began) / 1000, words.textContent]),
    ).observe(words, { characterData: true, childList: true, subtree: true });
    await new Promise((done) => {
      const timer = setInterval(() => {
        const seconds = (performance.now() - began) / 1000;
        samples.push([seconds, Number(stage.getAttribute("data-position"))]);
        if (seconds >= length) {
          clearInterval(timer);
          done();
        }
      }, 100);
    });
    return { samples, heard };
  }, seconds);
  if (picture !== null) clearTimeout(picture);
  if (process.env.BENCH_DUMP !== undefined) {
    mkdirSync(process.env.BENCH_DUMP, { recursive: true });
    writeFileSync(
      join(process.env.BENCH_DUMP, `${name}.json`),
      JSON.stringify({ script: SCRIPT, parts, heard, samples }),
    );
  }
  await page.close();

  // How far the prompter was from the reader, while script was being read.
  const behind = [];
  let aheadWorst = 0;
  let wandered = 0;
  for (const [at, place] of samples) {
    const part = parts.find((each) => at >= each.from && at <= each.to);
    if (part === undefined) continue;
    if (part.aside !== undefined) {
      // During an aside the prompter should be where the last paragraph ended.
      const before = readerAt(parts, part.from - 0.01);
      wandered = Math.max(wandered, Math.abs(place - before) > 3 ? Math.abs(place - before) : 0);
      continue;
    }
    // The start of a part is the recogniser catching up; after a jump to somewhere else in
    // the script (a skip, or going back), finding the reader again takes a few words more.
    const before = parts[parts.indexOf(part) - 1];
    const jumped =
      before !== undefined && before.aside === undefined && before.beat !== part.beat - 1;
    if (at - part.from < (jumped ? 4 : 1.5)) continue;
    const reader = readerAt(parts, at);
    behind.push(reader - place);
    aheadWorst = Math.max(aheadWorst, place - reader);
  }
  behind.sort((a, b) => a - b);
  const middle = behind[Math.floor(behind.length / 2)] ?? 0;
  const most = behind[Math.floor(behind.length * 0.95)] ?? 0;
  // How long after each part ended the prompter had reached its end.
  const late = parts
    // A part of two or three words is over before a recogniser has settled on it.
    .filter((part) => part.aside === undefined && FIRST[part.beat + 1] - FIRST[part.beat] >= 4)
    .map((part) => {
      const end = FIRST[part.beat + 1];
      const near = part.as === undefined ? 1 : 3;
      const reached = samples.find(([at, place]) => at >= part.from && place >= end - near);
      return reached === undefined ? Infinity : Math.max(0, reached[0] - part.to);
    });
  const lost = late.filter((seconds) => seconds > 4).length;
  const lastPart = parts.filter((part) => part.aside === undefined).at(-1);
  const final = samples.at(-1)?.[1] ?? 0;
  // A paragraph read loosely may never say its last words as written.
  const finished = final >= FIRST[lastPart.beat + 1] - (lastPart.as === undefined ? 1 : 3);
  const ok = finished && lost === 0 && wandered === 0 && most <= 8 && aheadWorst <= 6;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name.padEnd(12)} ${reading.voice.padEnd(9)} ${String(reading.rate).padStart(3)} wpm  ` +
      `behind: usually ${middle}, at worst ${most} words  ahead: at worst ${aheadWorst}  ` +
      `parts late: ${lost}/${late.length}  wandered in asides: ${wandered}  ended at ${final}/${FIRST[lastPart.beat + 1]}`,
  );
  if (!ok || process.env.BENCH_TRACE !== undefined) {
    for (const part of parts) {
      const row = samples.filter(([at]) => at >= part.from && at <= part.to + 0.45);
      const places = row.filter((_, index) => index % 5 === 0).map(([, place]) => place);
      const label =
        part.aside !== undefined
          ? "aside"
          : `beat ${part.beat} (${FIRST[part.beat]}–${FIRST[part.beat + 1]})`;
      console.log(`       ${label.padEnd(18)} ${places.join(" ")}`);
    }
  }
  return ok;
}

const wanted = process.argv.slice(2);
const names = wanted.length > 0 ? wanted : OWN !== undefined ? ["straight"] : Object.keys(READINGS);
if (OWN !== undefined && names.some((name) => !["straight", "fast", "slow"].includes(name)))
  throw new Error("Your own script can be read straight, fast or slow.");
mkdirSync(PROFILE, { recursive: true });
const folder = mkdtempSync(join(tmpdir(), "mogram-prompter-bench-"));
const chrome = spawn(
  CHROME,
  [
    `--user-data-dir=${PROFILE}`,
    `--remote-debugging-port=${PORT}`,
    "--autoplay-policy=no-user-gesture-required",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore" },
);
let failed = 0;
try {
  let browser = null;
  for (let attempt = 0; attempt < 40 && browser === null; attempt++) {
    await new Promise((done) => setTimeout(done, 500));
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`).catch(() => null);
  }
  if (browser === null) throw new Error("Chrome didn't start.");
  const context = browser.contexts()[0];
  await context.grantPermissions(["microphone"], { origin: URL_BASE });
  for (const name of names) {
    const reading = READINGS[name];
    if (reading === undefined) throw new Error(`No reading called ${name}.`);
    if (!(await play(context, name, reading, folder))) failed++;
  }
  await browser.close();
} finally {
  chrome.kill();
  rmSync(folder, { recursive: true, force: true });
}
console.log(failed === 0 ? "\nThe prompter kept its place." : `\n${failed} reading(s) lost.`);
process.exit(failed === 0 ? 0 : 1);
