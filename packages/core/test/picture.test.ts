import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/format";
import {
  beatsOf,
  captionAt,
  choicesAt,
  chooseStory,
  cursorAtBeat,
  describeChange,
  hasNext,
  nextBeat,
  pictureAt,
  previousBeat,
  readingTime,
  sceneMoment,
  segmentAt,
  startStory,
  storyTimeline,
  type StoryCursor,
} from "../src/picture";
import { resolveState } from "../src/state";
import type { Diagram } from "../src/model";

const parse = (yaml: string) => parseDiagram({ "mogram.yaml": yaml });

const diagramOf = (yaml: string): Diagram => {
  const result = parse(yaml);
  expect(result.diagnostics).toEqual([]);
  return result.diagram;
};

const messages = (yaml: string) => parse(yaml).diagnostics.map((d) => d.message);

/** A queue hands a message to a worker; the lease runs out and a second worker takes it too. */
const LEASE = `shapes:
  queue: { shape: queue, label: Orders }
  worker_a: { label: Worker A }
  worker_b: { label: Worker B }
  msg: { shape: rounded, label: "7", tone: blue }
  again: { shape: rounded, label: "7", tone: blue, show: hidden }
  lease: { label: Lease, show: hidden }
connections:
  to_a: { from: queue, to: worker_a }
  to_b: { from: queue, to: worker_b }
stories:
  main:
    - say: A worker takes message 7. It's leased to them, not deleted.
      set: { lease: shown, worker_a: active }
      focus: [worker_a, lease]
    - set: { lease: { mark: clock } }
    - say: The work is slow, and the lease runs out.
      name: expired
      set: { lease: { show: faded, label: Expired, tone: rose, mark: cross } }
    - say: A second worker takes it too.
      set: { again: shown, worker_b: active }
      choices:
        - { label: Renew in time, play: renewed }
    - say: Now two workers are doing the same job.
      set: { worker_a: degraded }
  renewed:
    - say: At 25 seconds the worker renews. One charge.
      rewind: expired
      set: { lease: { show: shown, label: Renewed, tone: green, mark: check } }
`;

/** Plays `count` beats from the opening. */
const after = (diagram: Diagram, count: number): StoryCursor => {
  const cursor = cursorAtBeat(diagram, "main", count);
  if (cursor === null) throw new Error("no story");
  return cursor;
};

describe("reading show, mark and stories", () => {
  it("reads show and mark on elements, shown and unmarked by default", () => {
    const diagram = diagramOf(`components:
  web: generic/service
  gate: { type: generic/service, mark: check }
containers:
  zone: { show: faded, mark: lock }
shapes:
  note: { show: hidden }
connections:
  a: { from: web, to: gate, show: hidden }
layout:
  decorations:
    hint: { text: Look here, at: [0, 0], show: hidden }
`);
    expect(diagram.components.get("web")).toMatchObject({ show: "shown", mark: null });
    expect(diagram.components.get("gate")?.mark).toBe("check");
    expect(diagram.containers.get("zone")).toMatchObject({ show: "faded", mark: "lock" });
    expect(diagram.components.get("note")?.show).toBe("hidden");
    expect(diagram.connections.get("a")?.show).toBe("hidden");
    expect(diagram.decorations.get("hint")?.show).toBe("hidden");
  });

  it("says what show and mark can be", () => {
    expect(
      messages(`components:\n  web: { type: generic/service, show: gone, mark: tick }\n`),
    ).toEqual([
      `"gone" isn't a show preset for "web". Choose one of shown, faded or hidden.`,
      `"tick" isn't a mark preset for "web". Choose one of check, cross, warn, lock, key, clock, star or question.`,
    ]);
  });

  it("reads a story's steps: words, a set, focus, pace, hold, names and choices", () => {
    const diagram = diagramOf(LEASE);
    expect(diagram.stories.map((story) => story.name)).toEqual(["main", "renewed"]);
    const [first, second, third, fourth] = diagram.stories[0]?.steps ?? [];
    expect(first).toMatchObject({
      say: "A worker takes message 7. It's leased to them, not deleted.",
      focus: ["worker_a", "lease"],
      pace: "normal",
      hold: null,
      rewind: null,
    });
    expect(first?.entries.map((entry) => [entry.target, entry.show ?? entry.state])).toEqual([
      ["lease", "shown"],
      ["worker_a", "active"],
    ]);
    expect(second).toMatchObject({ say: null });
    expect(second?.entries[0]).toMatchObject({ target: "lease", mark: "clock" });
    expect(third?.name).toBe("expired");
    expect(third?.entries[0]).toMatchObject({
      show: "faded",
      label: "Expired",
      tone: "rose",
      mark: "cross",
    });
    expect(fourth?.choices).toEqual([{ label: "Renew in time", play: "renewed" }]);
    expect(diagram.stories[1]?.steps[0]?.rewind).toBe("expired");
  });

  it("reads a caption on its own, a hold in seconds and a slow pace", () => {
    const diagram = diagramOf(`components:
  web: generic/service
stories:
  main:
    - Here is a web server.
    - say: It goes down.
      set: { web: down }
      hold: 2.5s
      pace: slow
`);
    expect(diagram.stories[0]?.steps).toMatchObject([
      { say: "Here is a web server.", entries: [] },
      { say: "It goes down.", hold: 2.5, pace: "slow" },
    ]);
  });

  it("scenes take the same set lines as steps", () => {
    const diagram = diagramOf(`components:
  web: generic/service
shapes:
  banner: { label: Sale, show: hidden }
scenes:
  sale:
    banner: shown
    web: { state: active, label: Web (busy), mark: warn }
`);
    expect(diagram.scenes[0]?.entries).toMatchObject([
      { target: "banner", show: "shown" },
      { target: "web", state: "active", label: "Web (busy)", mark: "warn" },
    ]);
  });

  it("explains what's wrong in a story", () => {
    expect(
      messages(`components:
  web: generic/service
connections:
  loop: { from: web, to: web }
stories:
  main:
    - say: Nothing there.
      set: { cache: down, web: shiny, loop: { mark: check } }
      focus: [edge]
      rewind: before
      choices:
        - { label: Try it, play: other }
    - {}
  empty:
`),
    ).toEqual([
      `Connection "loop" starts and ends at the same place.`,
      `Story "main" changes "cache", but there is no such element.`,
      `In story "main", "shiny" isn't something "web" can be set to. States: healthy, active, scaling, degraded, overloaded or down. Flows: traffic, slow, blocked, rerouted or idle. Or shown, faded or hidden.`,
      `Marks sit on components and containers, not on a connection like "loop".`,
      `In story "main", a step focuses on "edge", but there is no such element.`,
      `In story "main", a step rewinds to "before", but no step before it has that name. Use "start", or name an earlier step with "name:".`,
      `In story "main", the choice "Try it" plays "other", but there is no story by that name.`,
      `This step of story "main" says and changes nothing, so it's left out.`,
      `Story "empty" has no steps yet.`,
    ]);
  });

  it("keeps the rest of a line when one key doesn't fit", () => {
    const { diagram, diagnostics } = parse(`components:
  web: generic/service
scenes:
  odd:
    web: { state: down, tone: rose }
`);
    expect(diagnostics.map((d) => d.message)).toEqual([
      `A tone colours shapes and text. "web" is an icon component, so it's ignored.`,
    ]);
    expect(diagram.scenes[0]?.entries).toMatchObject([{ target: "web", state: "down" }]);
    expect(diagram.scenes[0]?.entries[0]?.tone).toBeUndefined();
  });
});

describe("moving through a story", () => {
  it("groups steps into beats: words start one, wordless steps continue it", () => {
    const diagram = diagramOf(LEASE);
    const main = diagram.stories[0];
    if (main === undefined) throw new Error("no story");
    expect(beatsOf(main).map((beat) => [beat.first, beat.steps.length])).toEqual([
      [0, 2],
      [2, 1],
      [3, 1],
      [4, 1],
    ]);
  });

  it("starts at the opening, with nothing played", () => {
    const diagram = diagramOf(LEASE);
    const opening = startStory(diagram);
    expect(opening).toMatchObject({ story: "main", played: [], beats: [] });
    expect(captionAt(diagram, opening)).toBeNull();
    expect(startStory(diagram, "nope")).toBeNull();
    expect(startStory(diagramOf(`components:\n  web: generic/service\n`))).toBeNull();
  });

  it("plays a beat a step at a time and stops before the next words", () => {
    const diagram = diagramOf(LEASE);
    const opening = startStory(diagram);
    if (opening === null) throw new Error("no story");
    const beat = nextBeat(diagram, opening);
    expect(beat.map((cursor) => cursor.played.length)).toEqual([1, 2]);
    const end = beat.at(-1);
    expect(captionAt(diagram, end ?? null)).toBe(
      "A worker takes message 7. It's leased to them, not deleted.",
    );
  });

  it("goes back a beat at a time, to the opening", () => {
    const diagram = diagramOf(LEASE);
    const two = after(diagram, 2);
    expect(two.played.length).toBe(3);
    const one = previousBeat(two);
    expect(one?.played.length).toBe(2);
    expect(captionAt(diagram, one ?? null)).toContain("leased");
    const opening = previousBeat(one ?? two);
    expect(opening?.played).toEqual([]);
    expect(previousBeat(opening ?? two)).toBeNull();
  });

  it("offers a step's choices, plays the chosen story, and comes back", () => {
    const diagram = diagramOf(LEASE);
    const three = after(diagram, 3);
    expect(choicesAt(diagram, three)).toEqual([{ label: "Renew in time", play: "renewed" }]);
    const chosen = chooseStory(diagram, three, "renewed");
    // The chosen story's only step rewinds: first the cut, then its changes.
    expect(chosen.map((cursor) => cursor.rewound)).toEqual([true, false]);
    const end = chosen.at(-1);
    if (end === undefined) throw new Error("nothing played");
    expect(captionAt(diagram, end)).toBe("At 25 seconds the worker renews. One charge.");
    expect(choicesAt(diagram, end)).toEqual([]);
    // Back in the story that offered the choice.
    const back = nextBeat(diagram, end).at(-1);
    expect(captionAt(diagram, back ?? null)).toBe("Now two workers are doing the same job.");
    expect(hasNext(diagram, back ?? end)).toBe(false);
    expect(nextBeat(diagram, back ?? end)).toEqual([]);
    // And going back from the chosen story returns to the choice.
    expect(choicesAt(diagram, previousBeat(end))).toHaveLength(1);
  });

  it("stops at the end when asked for more beats than there are", () => {
    const diagram = diagramOf(LEASE);
    expect(after(diagram, 99).played.length).toBe(5);
  });
});

describe("pictureAt", () => {
  it("is the diagram itself when nothing differs", () => {
    const diagram = diagramOf(`components:\n  web: generic/service\n`);
    const picture = pictureAt(diagram, null);
    expect(picture.diagram).toBe(diagram);
    expect(picture.entries).toEqual([]);
    expect(picture.presence.size).toBe(0);
    expect(picture.focus).toBeNull();
  });

  it("leaves out what's hidden at the start, so the model doesn't see it", () => {
    const diagram = diagramOf(LEASE);
    const picture = pictureAt(diagram, { scene: null, story: startStory(diagram) });
    expect([...picture.presence]).toEqual([
      ["again", "hidden"],
      ["lease", "hidden"],
    ]);
    expect(picture.diagram.components.has("lease")).toBe(false);
    expect(picture.diagram.components.has("msg")).toBe(true);
    // Maps nothing was taken from are the very same ones.
    expect(picture.diagram.connections).toBe(diagram.connections);
    expect(resolveState({ diagram: picture.diagram }).elements.has("lease")).toBe(false);
  });

  it("adds up the steps played: shown, faded, relabelled, marked", () => {
    const diagram = diagramOf(LEASE);
    const one = pictureAt(diagram, { scene: null, story: after(diagram, 1) });
    expect(one.presence.get("lease")).toBeUndefined();
    expect(one.diagram.components.get("lease")).toMatchObject({ label: "Lease", mark: "clock" });
    expect(one.entries).toMatchObject([{ target: "worker_a", state: "active" }]);
    expect([...(one.focus ?? [])]).toEqual(["worker_a", "lease"]);

    const two = pictureAt(diagram, { scene: null, story: after(diagram, 2) });
    expect(two.presence.get("lease")).toBe("faded");
    expect(two.diagram.components.get("lease")).toMatchObject({ label: "Expired", mark: "cross" });
    expect(two.diagram.components.get("lease")?.look?.tone).toBe("rose");
    // The next beat has no focus of its own, so nothing dims.
    expect(two.focus).toBeNull();
    // What an earlier step set is still set.
    expect(two.entries).toMatchObject([{ target: "worker_a", state: "active" }]);
  });

  it("rewinds to a named step's picture, then plays the step's own changes", () => {
    const diagram = diagramOf(LEASE);
    const [cut, played] = chooseStory(diagram, after(diagram, 3), "renewed");
    if (cut === undefined || played === undefined) throw new Error("nothing played");
    const before = pictureAt(diagram, { scene: null, story: cut });
    // Cut back to "expired": the second worker's copy is gone again.
    expect(before.presence.get("again")).toBe("hidden");
    expect(before.diagram.components.get("lease")?.label).toBe("Expired");
    expect(before.entries.map((entry) => entry.target)).toEqual(["worker_a"]);
    const then = pictureAt(diagram, { scene: null, story: played });
    expect(then.presence.has("lease")).toBe(false);
    expect(then.diagram.components.get("lease")).toMatchObject({ label: "Renewed", mark: "check" });
  });

  it("rewinds to the start", () => {
    const diagram = diagramOf(`components:
  web: generic/service
  db: generic/database
stories:
  main:
    - say: The database goes down.
      set: { db: down }
    - say: The same again, but the web server fails instead.
      rewind: start
      set: { web: down }
`);
    const end = pictureAt(diagram, { scene: null, story: after(diagram, 2) });
    expect(end.entries.map((entry) => [entry.target, entry.state])).toEqual([["web", "down"]]);
  });

  it("hides what's inside a hidden container, and what connects to something hidden", () => {
    const diagram = diagramOf(`containers:
  region: { show: hidden }
  zone: { in: region }
components:
  web: { type: generic/service, in: zone }
  user: generic/user
connections:
  in: { from: user, to: web }
groups:
  pair: { members: [web] }
layout:
  decorations:
    hint: { text: New region, at: [0, 0], in: region }
scenes:
  open:
    region: shown
  ghost:
    region: faded
`);
    const closed = pictureAt(diagram, null);
    expect(Object.fromEntries(closed.presence)).toEqual({
      region: "hidden",
      zone: "hidden",
      web: "hidden",
      hint: "hidden",
      in: "hidden",
      pair: "hidden",
    });
    expect([...closed.diagram.components.keys()]).toEqual(["user"]);
    expect(closed.diagram.connections.size).toBe(0);
    expect(closed.diagram.groups.size).toBe(0);

    const open = pictureAt(diagram, sceneMoment("open"));
    expect(open.presence.size).toBe(0);
    expect(open.diagram).toBe(diagram);

    const ghost = pictureAt(diagram, sceneMoment("ghost"));
    expect(ghost.presence.get("web")).toBe("faded");
    expect(ghost.presence.get("in")).toBe("faded");
    expect(ghost.diagram.components.has("web")).toBe(true);
  });

  it("lays the scene over the steps, key by key", () => {
    const diagram = diagramOf(`components:
  db: generic/database
stories:
  main:
    - say: The database is busy.
      set: { db: { state: active, motion: pulse, mark: warn } }
scenes:
  outage:
    db: down
`);
    const picture = pictureAt(diagram, { scene: "outage", story: after(diagram, 1) });
    expect(picture.entries).toMatchObject([{ target: "db", state: "down", motion: "pulse" }]);
    expect(picture.diagram.components.get("db")?.mark).toBe("warn");
  });

  it("takes a mark away with none, and changes connection and text words", () => {
    const diagram = diagramOf(`components:
  a: { type: generic/service, mark: lock }
  b: generic/service
connections:
  link: { from: a, to: b, label: HTTP }
layout:
  decorations:
    title: { text: Before, at: [0, 0] }
scenes:
  after:
    a: { mark: none }
    link: { label: HTTPS }
    title: { label: After, tone: green }
`);
    const picture = pictureAt(diagram, sceneMoment("after"));
    expect(picture.diagram.components.get("a")?.mark).toBeNull();
    expect(picture.diagram.connections.get("link")?.text).toBe("HTTPS");
    expect(picture.diagram.decorations.get("title")).toMatchObject({
      text: "After",
      tone: "green",
    });
    // Looks alone leave nothing for the resolver.
    expect(picture.entries).toEqual([]);
  });

  it("puts lines handed down from the diagram outside underneath its own", () => {
    const diagram = diagramOf(`components:
  pod: generic/service
shapes:
  extra: { show: hidden }
scenes:
  busy:
    pod: active
`);
    const source = { file: "outer", line: 1 };
    const picture = pictureAt(diagram, sceneMoment("busy"), [
      { target: "pod", state: "down", flow: null, motion: null, source },
      { target: "extra", state: null, flow: null, motion: null, show: "shown", source },
    ]);
    expect(picture.presence.size).toBe(0);
    expect(picture.entries).toMatchObject([{ target: "pod", state: "active" }]);
  });
});

describe("a story's timeline", () => {
  it("gives every step a change and a hold, beat by beat", () => {
    const diagram = diagramOf(LEASE);
    const timeline = storyTimeline(diagram);
    if (timeline === null) throw new Error("no story");
    expect(timeline.beats).toBe(4);
    expect(timeline.segments.map((segment) => [segment.beat, segment.endsBeat])).toEqual([
      [0, false],
      [0, true],
      [1, true],
      [2, true],
      [3, true],
    ]);
    const [first, second] = timeline.segments;
    expect(first).toMatchObject({ start: 1.5, change: 0.6 });
    // A wordless step follows after a short gap.
    expect(second?.start).toBeCloseTo(1.5 + 0.6 + 0.35);
    // And the beat then stays long enough to read its caption.
    expect((second?.end ?? 0) - (second?.start ?? 0)).toBeCloseTo(
      0.6 + readingTime("A worker takes message 7. It's leased to them, not deleted."),
    );
    expect(timeline.duration).toBeCloseTo(timeline.segments.at(-1)?.end ?? 0);
    expect(segmentAt(timeline, 0.2)).toBeNull();
    expect(segmentAt(timeline, 1.6)).toBe(first);
    expect(segmentAt(timeline, 9999)).toBe(timeline.segments.at(-1));
  });

  it("follows a step's own hold and slow pace", () => {
    const diagram = diagramOf(`components:
  web: generic/service
stories:
  main:
    - say: It goes down.
      set: { web: down }
      hold: 2
      pace: slow
`);
    const timeline = storyTimeline(diagram);
    expect(timeline?.segments[0]).toMatchObject({ start: 1.5, change: 1.2, end: 4.7 });
  });

  it("reads longer captions for longer, within limits", () => {
    expect(readingTime("Short.")).toBe(2.4);
    expect(readingTime("one two three four five six seven eight nine")).toBeCloseTo(4.2);
    expect(readingTime(Array(80).fill("word").join(" "))).toBe(9);
  });
});

describe("describing what a step changes", () => {
  it("says each key in a few plain words", () => {
    const diagram = diagramOf(`components:
  users: generic/users
  web: generic/service
  cache: { type: generic/cache, hit: 50% }
shapes:
  lease: { label: Lease }
connections:
  in: { from: users, to: web }
  hot: { from: web, to: cache, label: Hot path }
layout:
  decorations:
    hint: { text: A very long note that goes on and on, at: [0, 0] }
scenes:
  all:
    lease: { show: faded, label: Expired, tone: rose, mark: cross }
    web: { state: down, motion: none }
    in: { flow: blocked, traffic: 2.5x }
    hot: { share: 10% }
    cache: { hit: 80%, mark: none }
    hint: hidden
`);
    const said = (diagram.scenes[0]?.entries ?? []).map((entry) => describeChange(diagram, entry));
    expect(said).toEqual([
      ["fades Lease", "Lease says “Expired”", "Lease turns rose", "Lease gets a cross"],
      ["Web: down", "Web stops moving"],
      ["Users → Web: blocked", "Users → Web carries 2.5×"],
      ["Hot path gets 10%"],
      ["Cache hits 80%", "Cache loses its mark"],
      ["hides A very long note that g…"],
    ]);
  });
});

describe("a story in a folder (D-97)", () => {
  const files = {
    "mogram.yaml":
      "mogram: 1\nname: Course\nshapes:\n  cover: { label: A course }\nlayout:\n  cover: [0, 0]\n",
    "slides/flow/mogram.yaml": [
      "mogram: 1",
      "name: The flow",
      "shapes:",
      "  write: { label: Write }",
      "  plan: { label: Plan, show: hidden }",
      "stories:",
      "  main:",
      "    - say: You write what you want.",
      "    - say: Terraform plans it.",
      "      set: { plan: shown }",
      "layout:",
      "  write: [0, 0]",
      "  plan: [30, 0]",
      "",
    ].join("\n"),
  };

  it("is read, played and timed like the project's own", () => {
    const root = parseDiagram(files).diagram;
    expect(root.stories).toHaveLength(0);
    const { diagram, diagnostics } = parseDiagram(files, "slides/flow");
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const opening = startStory(diagram);
    expect(pictureAt(diagram, { scene: null, story: opening }).presence.get("plan")).toBe("hidden");
    const first = nextBeat(diagram, opening!).at(-1)!;
    const second = nextBeat(diagram, first).at(-1)!;
    expect(captionAt(diagram, second)).toBe("Terraform plans it.");
    expect(pictureAt(diagram, { scene: null, story: second }).presence.get("plan") ?? "shown").toBe(
      "shown",
    );
    expect(storyTimeline(diagram)?.segments).toHaveLength(2);
  });
});
