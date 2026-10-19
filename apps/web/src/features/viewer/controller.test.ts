import { voiceFiles } from "@mogram/core/assets";
import { STILL_SLIDE, type DeckSlide } from "@mogram/core/deck";
import { Clock } from "@/features/canvas/clock";
import type { ViewerDeck } from "@/features/deck/viewer-deck";
import { AKS_FILES } from "@/features/templates/files";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ViewerController } from "./controller";
import { createViewerStore } from "./viewer-store";

function setup() {
  const store = createViewerStore(AKS_FILES, false);
  const next = vi.fn<ViewerDeck["next"]>(() => false);
  const slide: DeckSlide = {
    item: 0,
    number: 1,
    folder: "",
    story: null,
    from: null,
    to: null,
    scene: null,
    title: "Intermission",
    section: null,
    frame: false,
    carriesOn: false,
  };
  const deck: ViewerDeck = {
    folder: "",
    frame: null,
    slides: [slide, { ...slide, item: 1, number: 2, carriesOn: true }],
    index: 0,
    start: { kind: "opening" },
    captions: true,
    playing: false,
    next,
    previous: () => false,
    toggleCaptions: () => {},
    overview: () => {},
    goTo: vi.fn(),
  };
  const controller = new ViewerController(store, new Clock(() => 0), deck);
  return { controller, next, deck, store };
}

describe("viewer controller still-slide playback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("advances after the still-slide delay", () => {
    const { controller, next, store } = setup();

    controller.setStoryPlaying(true);

    expect(store.getState().storyPlaying).toBe(true);
    vi.advanceTimersByTime(STILL_SLIDE * 1000 - 1);
    expect(next).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(true);
  });

  it("pauses a still slide and cancels its pending advance", () => {
    const { controller, next, store } = setup();

    controller.setStoryPlaying(true);
    controller.setStoryPlaying(false);
    vi.advanceTimersByTime(STILL_SLIDE * 1000);

    expect(store.getState().storyPlaying).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it("stops handing over once the slide is on its way out", () => {
    const { controller, next } = setup();

    controller.setStoryPlaying(true);
    controller.leave();
    vi.advanceTimersByTime(STILL_SLIDE * 1000 * 2);
    controller.stepDeck(1);

    expect(next).not.toHaveBeenCalled();
  });

  it("stops everything when the viewer goes", () => {
    const { controller, next } = setup();

    controller.setStoryPlaying(true);
    controller.dispose();
    vi.advanceTimersByTime(STILL_SLIDE * 1000 * 2);

    expect(next).not.toHaveBeenCalled();
  });
});

describe("viewer controller stepping through a deck", () => {
  beforeEach(() => {
    vi.stubGlobal("window", globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the deck for the next slide by hand, without playing on", () => {
    const { controller, next } = setup();

    controller.stepDeck(1);

    expect(next).toHaveBeenCalledWith(false);
  });

  it("plays on in the same viewer when the next slide carries on", () => {
    const { controller, next, deck, store } = setup();
    next.mockImplementation(() => ({ ...deck, index: 1 }));

    controller.stepDeck(1);

    expect(store.getState().slide).toBe(1);
  });

  it("asks for the slide before at the start of a slide", () => {
    const { controller, deck } = setup();
    const previous = vi.spyOn(deck, "previous");

    controller.stepDeck(-1);

    expect(previous).toHaveBeenCalledOnce();
  });
});

describe("viewer controller playing with the voice (D-105)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("plays a beat's recording and waits for it, but plays none stepping by hand", () => {
    const script = "Everything starts with the request.";
    const files = {
      "mogram.yaml": `mogram: 1
shapes:
  a: { label: A }
  b: { label: B, show: hidden }
stories:
  main:
    - say: First
      script: ${script}
      set: { b: shown }
    - say: Second
layout:
  a: [0, 0]
  b: [20, 0]
`,
      ...voiceFiles("", script, {
        hash: "b".repeat(64),
        type: "audio/webm",
        bytes: 100,
        seconds: 8,
        skip: 1,
      }),
    };
    const store = createViewerStore(files, false);
    const controller = new ViewerController(store, new Clock(() => 0));
    const sound = { play: vi.fn(), stop: vi.fn() };
    controller.sound = sound;
    controller.openStory();

    controller.nextBeat();
    expect(sound.play).not.toHaveBeenCalled();

    controller.openStory();
    controller.setStoryPlaying(true);
    vi.advanceTimersByTime(2000);
    expect(sound.play).toHaveBeenCalledWith(expect.objectContaining({ seconds: 7, skip: 1 }));
    // Seven seconds of words and a short tail: the next beat waits for them.
    expect(controller.storyBeat).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(controller.storyBeat).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(controller.storyBeat).toBe(2);
  });
});
