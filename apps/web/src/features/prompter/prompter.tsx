"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  FlipHorizontal2,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  Minus,
  Plus,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import {
  beatAt,
  FOLLOW,
  FOLLOW_REACHES,
  scriptWords,
  steadyFollow,
  type FollowReach,
} from "@mogram/core/prompter";
import { IconButton } from "@/components/ui/icon-button";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Panel, ToolbarDivider } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import type { PrompterMessage } from "./channel";
import { listen, microphones, type ListenerState, type Microphone } from "./listener";
import { openMicrophone, Takes } from "./recorder";

const SIZES = [36, 44, 52, 60, 72, 84, 96] as const;

/** How the reader likes the prompter, kept in this browser. */
interface Preferences {
  readonly size: number;
  readonly mirrored: boolean;
  readonly microphone: string | null;
  /** How far what's heard may move the reader: see `FollowReach`. */
  readonly reach: FollowReach;
}

const PREFERENCES = "mogram-prompter";
// Nearby by default: a script that says similar things in two places shouldn't throw the
// reader from one to the other. Anywhere is there for a reader who skips whole pages.
const DEFAULTS: Preferences = { size: 3, mirrored: false, microphone: null, reach: "nearby" };

const REACH_LABELS: Readonly<Record<FollowReach, { label: string; detail: string }>> = {
  order: { label: "Stay in order", detail: "Only the next words move it. Skip with the arrows." },
  nearby: { label: "Find me nearby", detail: "Also a sentence skipped or read again." },
  anywhere: { label: "Find me anywhere", detail: "Also anywhere else in the script." },
};

function readPreferences(): Preferences {
  try {
    const kept = JSON.parse(window.localStorage.getItem(PREFERENCES) ?? "{}") as Record<
      string,
      unknown
    >;
    return {
      size:
        typeof kept.size === "number" && kept.size >= 0 && kept.size < SIZES.length
          ? Math.round(kept.size)
          : DEFAULTS.size,
      mirrored: kept.mirrored === true,
      microphone: typeof kept.microphone === "string" ? kept.microphone : null,
      reach: FOLLOW_REACHES.find((reach) => reach === kept.reach) ?? DEFAULTS.reach,
    };
  } catch {
    return DEFAULTS;
  }
}

function clock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The prompter (D-96): a script, large, for reading into a camera. It follows the reader's
 * voice (Chrome recognises it on the device) and, for a diagram, moves its story on as each
 * beat's words are finished, so nobody has to keep pace with a scroll or press a key. Keys and
 * the buttons always work too.
 */
export function PrompterStage({
  beats,
  channel: channelName,
  onClose,
  headings,
  announce = (started) => ({ kind: "beat", beats: started }),
  durations,
  recording,
}: {
  /** What's said, a beat (or a paragraph) at a time. */
  readonly beats: readonly string[];
  /** Where to say which beat is being read, for a viewer of the same diagram. */
  readonly channel?: string;
  /** Leaves the prompter, when there's somewhere to go back to. */
  readonly onClose?: () => void;
  /** A line over a beat: in a deck, the slide it starts. */
  readonly headings?: readonly (string | null)[];
  /** What a viewer is told once `started` beats have begun. */
  readonly announce?: (started: number) => PrompterMessage;
  /** How long each beat takes at the deck's own times, for what's left. */
  readonly durations?: readonly number[];
  /** Recording each beat's words, where they can be kept (D-105). */
  readonly recording?: RecordingLink;
}) {
  const words = useMemo(() => scriptWords(beats), [beats]);
  const [position, setPosition] = useState(0);
  const [state, setState] = useState<ListenerState>({ kind: "off" });
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [heard, setHeard] = useState("");
  const [timing, setTiming] = useState<{ from: number; to: number | null } | null>(null);
  const [now, setNow] = useState(0);
  const [quiet, setQuiet] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [devices, setDevices] = useState<readonly Microphone[]>([]);
  const at = useRef(0);
  const stop = useRef<(() => void) | null>(null);
  const current = useRef<HTMLSpanElement | null>(null);
  const level = useRef<HTMLSpanElement | null>(null);
  const { size, mirrored, microphone, reach } = preferences;
  // The listener reads it as it hears, so changing it takes effect mid-sentence.
  const reachNow = useRef(reach);
  useEffect(() => {
    reachNow.current = reach;
  }, [reach]);

  const prefer = useCallback((change: Partial<Preferences>) => {
    setPreferences((had) => {
      const next = { ...had, ...change };
      try {
        window.localStorage.setItem(PREFERENCES, JSON.stringify(next));
      } catch {
        // Kept for this visit only.
      }
      return next;
    });
  }, []);

  const moveTo = useCallback(
    (next: number) => {
      const was = at.current;
      at.current = next;
      setPosition(next);
      // The clock runs from the first word to the last.
      if (next === 0) setTiming(null);
      else if (was === 0) setTiming({ from: Date.now(), to: null });
      if (next >= words.length && words.length > 0)
        setTiming((had) => (had === null || had.to !== null ? had : { ...had, to: Date.now() }));
      else if (was >= words.length) setTiming((had) => (had === null ? had : { ...had, to: null }));
    },
    [words.length],
  );
  // A script edited shorter than where the reader was.
  useEffect(() => {
    if (at.current > words.length) moveTo(words.length);
  }, [words.length, moveTo]);

  const running = timing !== null && timing.to === null;
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [running]);

  // The viewer of this diagram follows along: it shows the beat being read.
  const reading = beatAt(words, position);
  const started = position === 0 ? 0 : reading.beat + 1;
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (channelName === undefined || typeof BroadcastChannel === "undefined") return;
    const opened = new BroadcastChannel(channelName);
    channel.current = opened;
    return () => {
      channel.current = null;
      opened.close();
    };
  }, [channelName]);
  const told = useRef(announce);
  useEffect(() => {
    told.current = announce;
  });
  // Viewers move when the reading does, not when the window opens.
  const announced = useRef(started);
  useEffect(() => {
    if (announced.current === started) return;
    announced.current = started;
    channel.current?.postMessage(told.current(started) satisfies PrompterMessage);
  }, [started]);

  // Record: each beat its own take, cut as the reading moves on (D-105).
  const recorder = useRecorder(recording, reading.done ? null : reading.beat, microphone);
  const left =
    durations === undefined
      ? null
      : durations.reduce(
          (sum, seconds, beat) =>
            sum + (beat > reading.beat || (beat === reading.beat && position === 0) ? seconds : 0),
          0,
        );

  // The word being read stays on the reading line.
  useEffect(() => {
    current.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [position, size]);

  // A screen that dims or sleeps mid-sentence is the one thing a prompter mustn't do.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const keep = async () => {
      try {
        const taken = await navigator.wakeLock.request("screen");
        if (alive) lock = taken;
        else void taken.release();
      } catch {
        // Not allowed, or not there: the system's own setting decides.
      }
    };
    const onVisible = () => document.visibilityState === "visible" && void keep();
    void keep();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement !== null) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }, []);

  const stopListening = useCallback(() => {
    stop.current?.();
    stop.current = null;
  }, []);
  const startListening = useCallback(
    async (deviceId: string | null) => {
      stopListening();
      let live = true;
      const follow = steadyFollow();
      // Until the recogniser is ready, stopping means "don't start after all".
      stop.current = () => {
        live = false;
        setState({ kind: "off" });
      };
      const end = await listen({
        lang: "en-US",
        deviceId,
        onState: (next) => live && setState(next),
        onLevel: (loud) => {
          if (level.current !== null) level.current.style.transform = `scaleX(${loud})`;
        },
        onHeard: (tail) => {
          setHeard(tail.slice(-8).join(" "));
          const next = follow(words, at.current, tail, { ...FOLLOW, reach: reachNow.current });
          if (next.moved !== "held") moveTo(next.position);
        },
      });
      if (live) stop.current = end;
      else end();
      // Their names are known now that the page may use one.
      void microphones().then(setDevices);
    },
    [words, moveTo, stopListening],
  );
  const wanted = state.kind === "listening" || state.kind === "preparing";
  const toggleListening = useCallback(() => {
    if (wanted) stopListening();
    else void startListening(microphone);
  }, [wanted, microphone, startListening, stopListening]);
  useEffect(() => () => stop.current?.(), []);

  /** The first word of the beat before or after the one being read. */
  const stepBeat = useCallback(
    (by: 1 | -1) => {
      const beat = beatAt(words, at.current).beat;
      const first = (index: number) => words.findIndex((word) => word.beat === index);
      const here = first(beat);
      if (by === -1) {
        if (at.current > here) moveTo(here);
        else {
          let before = beat - 1;
          while (before > 0 && first(before) === -1) before--;
          moveTo(Math.max(0, first(before)));
        }
      } else {
        const next = words.findIndex((word, index) => index >= at.current && word.beat > beat);
        moveTo(next === -1 ? words.length : next);
      }
    },
    [words, moveTo],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[role="menu"]') != null) return;
      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        stepBeat(1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        stepBeat(-1);
      } else if (event.key === " ") {
        event.preventDefault();
        toggleListening();
      } else if (event.key === "Home") moveTo(0);
      else if (event.key === "f" || event.key === "F") toggleFullscreen();
      else if ((event.key === "r" || event.key === "R") && recorder.available) recorder.toggle();
      else if (event.key === "Escape" && document.fullscreenElement === null) {
        if (wanted) stopListening();
        else onClose?.();
      }
    };
    // Space is the prompter's, wherever the focus is: a button that has it mustn't be pressed
    // too when the key comes up.
    const onKeyUp = (event: KeyboardEvent) => {
      if (
        event.key === " " &&
        (event.target as HTMLElement | null)?.closest('[role="menu"]') == null
      )
        event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    stepBeat,
    toggleListening,
    toggleFullscreen,
    stopListening,
    wanted,
    moveTo,
    onClose,
    recorder,
  ]);

  // While the reader is being followed, the controls get out of the way of the words.
  const listening = state.kind === "listening";
  useEffect(() => {
    if (!listening) return;
    let timer = window.setTimeout(() => setQuiet(true), 2500);
    const stir = () => {
      setQuiet(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setQuiet(true), 2500);
    };
    window.addEventListener("pointermove", stir);
    window.addEventListener("keydown", stir);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", stir);
      window.removeEventListener("keydown", stir);
      setQuiet(false);
    };
  }, [listening]);

  const fontSize = SIZES[size] ?? 60;
  // Where each beat's words start in the script, and how many it has.
  const spans = useMemo(() => {
    const found = beats.map(() => ({ first: words.length, count: 0 }));
    words.forEach((word, index) => {
      const span = found[word.beat];
      if (span === undefined) return;
      if (span.count === 0) span.first = index;
      span.count++;
    });
    return found;
  }, [beats, words]);
  const spoken = beats.filter((_, beat) => (spans[beat]?.count ?? 0) > 0).length;
  const number = spans.slice(0, reading.beat + 1).filter((span) => span.count > 0).length;

  return (
    <div
      className={cn(
        "relative h-dvh w-full overflow-hidden bg-page text-fg",
        // Nothing but the words while it's following: not even the pointer.
        quiet && "cursor-none",
      )}
      data-testid="prompter"
      data-position={position}
      data-listening={listening ? "true" : undefined}
    >
      <div
        className="scrollbar-none h-full overflow-y-auto px-[8vw] pb-[60vh] pt-[42vh]"
        style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
        data-mirrored={mirrored ? "true" : undefined}
      >
        {beats.map((_, beat) => {
          const span = spans[beat] ?? { first: 0, count: 0 };
          if (span.count === 0) return null;
          const done = position >= span.first + span.count;
          const heading = headings?.[beat] ?? null;
          const voice = recording?.status[beat] ?? "none";
          return (
            <Fragment key={beat}>
              {heading !== null ? (
                <p
                  className="mb-[0.4em] mt-[1.2em] text-caption font-medium uppercase tracking-wide text-fg-muted first:mt-0"
                  style={{ fontSize: Math.max(14, fontSize * 0.3) }}
                  data-slide-heading
                >
                  {heading}
                </p>
              ) : null}
              <p
                data-beat={beat}
                data-voice={recording === undefined ? undefined : voice}
                data-reading={reading.beat === beat && !reading.done ? "true" : undefined}
                className={cn(
                  "mb-[0.9em] font-medium leading-[1.28] tracking-snug transition-opacity duration-300",
                  done ? "opacity-25" : reading.beat === beat ? "opacity-100" : "opacity-45",
                )}
                style={{ fontSize }}
              >
                {words.slice(span.first, span.first + span.count).map((word, offset) => {
                  const here = span.first + offset;
                  return (
                    <span
                      key={here}
                      ref={here === Math.min(position, words.length - 1) ? current : undefined}
                      data-said={here < position ? "true" : undefined}
                      className={cn(
                        "transition-colors duration-150",
                        here < position ? "text-fg-muted" : "text-fg",
                      )}
                    >
                      {word.text}{" "}
                    </span>
                  );
                })}
                {recording !== undefined && voice !== "none" ? (
                  <span
                    className={cn(
                      "ml-[0.3em] inline-block size-[0.28em] -translate-y-[0.1em] rounded-full align-middle",
                      voice === "recorded" ? "bg-fg-soft" : "bg-amber",
                    )}
                    aria-label={
                      voice === "recorded" ? "Recorded" : "Recorded, but the words have changed"
                    }
                    role="img"
                  />
                ) : null}
              </p>
            </Fragment>
          );
        })}
      </div>

      {/* Where the eyes rest: the line being read sits between these two marks. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2">
        <span className="absolute left-[2vw] h-0.5 w-[3vw] rounded-full bg-fg-muted" />
        <span className="absolute right-[2vw] h-0.5 w-[3vw] rounded-full bg-fg-muted" />
      </div>
      {/* Words slide out from under the controls rather than colliding with them. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[12vh] bg-linear-to-b from-page to-transparent"
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-[22vh] bg-linear-to-t from-page from-35% to-transparent transition-opacity duration-500",
          quiet && "opacity-0",
        )}
      />

      <div
        className={cn(
          "absolute bottom-3 left-1/2 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-col items-center gap-2 transition-opacity duration-500 focus-within:opacity-100",
          quiet && "opacity-0",
        )}
        data-quiet={quiet ? "true" : undefined}
      >
        {recorder.phase !== "off" || recorder.problem !== null ? (
          <Panel
            role="status"
            className="flex items-center gap-2 px-3.5 py-2 text-caption text-fg-soft"
          >
            {recorder.phase === "recording" ? (
              <span className="size-2 shrink-0 animate-pulse rounded-full bg-rose" aria-hidden />
            ) : null}
            <span data-testid="recording-state">
              {recorder.problem ??
                (recorder.phase === "counting"
                  ? `Recording in ${recorder.count}…`
                  : recorder.saving > 0
                    ? "Recording · keeping the last beat…"
                    : "Recording: each beat is kept as you move on")}
            </span>
          </Panel>
        ) : null}
        {state.kind === "failed" || state.kind === "preparing" ? (
          <Panel role="status" className="px-3.5 py-2 text-caption text-fg-soft">
            {state.kind === "failed" ? state.reason : `${state.detail}…`}
          </Panel>
        ) : null}
        <Panel
          shape="pill"
          className="flex items-center gap-1 p-1"
          role="group"
          aria-label="Prompter"
        >
          {onClose === undefined ? null : (
            <>
              <IconButton label="Back to the script" shortcut="Esc" shape="round" onClick={onClose}>
                <X />
              </IconButton>
              <ToolbarDivider />
            </>
          )}
          <IconButton label="Beat before" shortcut="←" shape="round" onClick={() => stepBeat(-1)}>
            <ChevronLeft />
          </IconButton>
          <IconButton
            label={wanted ? "Stop following my voice" : "Follow my voice"}
            shortcut="Space"
            shape="round"
            active={wanted}
            onClick={toggleListening}
          >
            {wanted ? <Mic /> : <MicOff />}
          </IconButton>
          <Menu onOpenChange={(open) => open && void microphones().then(setDevices)}>
            <MenuTrigger asChild>
              <IconButton label="Following and microphone" shape="round">
                <ChevronUp />
              </IconButton>
            </MenuTrigger>
            <MenuContent align="center" side="top" className="w-80">
              <MenuLabel>When what I say is somewhere else in the script</MenuLabel>
              <MenuRadioGroup
                value={reach}
                onValueChange={(value) =>
                  prefer({ reach: FOLLOW_REACHES.find((each) => each === value) ?? reach })
                }
              >
                {FOLLOW_REACHES.map((each) => (
                  <MenuRadioItem key={each} value={each} description={REACH_LABELS[each].detail}>
                    {REACH_LABELS[each].label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
              <MenuSeparator />
              <MenuLabel>
                {devices.length === 0
                  ? "Follow your voice once, and the microphones are listed here"
                  : "Listen to"}
              </MenuLabel>
              <MenuRadioGroup
                value={devices.find((device) => device.id === microphone)?.id ?? "default"}
                onValueChange={(id) => {
                  prefer({ microphone: id });
                  if (wanted) void startListening(id);
                }}
              >
                {devices.map((device) => (
                  <MenuRadioItem key={device.id} value={device.id}>
                    {device.label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuContent>
          </Menu>
          <IconButton label="Next beat" shortcut="→" shape="round" onClick={() => stepBeat(1)}>
            <ChevronRight />
          </IconButton>
          {recorder.available ? (
            <IconButton
              label={recorder.phase === "off" ? "Record each beat" : "Stop recording"}
              shortcut="R"
              shape="round"
              active={recorder.phase !== "off"}
              onClick={recorder.toggle}
            >
              {recorder.phase === "off" ? <Circle /> : <Square />}
            </IconButton>
          ) : null}
          <span
            className="min-w-14 px-1 text-center text-caption tabular-nums text-fg-muted"
            data-testid="prompter-beat"
          >
            {reading.done ? spoken : number} / {spoken}
          </span>
          <span
            className="min-w-10 pr-1.5 text-center text-caption tabular-nums text-fg-muted"
            data-testid="prompter-clock"
            aria-label="Time reading"
          >
            {timing === null
              ? "0:00"
              : clock((timing.to ?? Math.max(now, timing.from)) - timing.from)}
          </span>
          {left !== null ? (
            <span
              className="min-w-10 pr-1.5 text-center text-caption tabular-nums text-fg-faint"
              data-testid="prompter-left"
              aria-label="Time left at the deck's own pace"
            >
              −{clock((reading.done ? 0 : left) * 1000)}
            </span>
          ) : null}
          <ToolbarDivider />
          <IconButton label="Start again" shortcut="Home" shape="round" onClick={() => moveTo(0)}>
            <RotateCcw />
          </IconButton>
          <IconButton
            label="Smaller"
            shape="round"
            disabled={size === 0}
            onClick={() => prefer({ size: Math.max(0, size - 1) })}
          >
            <Minus />
          </IconButton>
          <IconButton
            label="Larger"
            shape="round"
            disabled={size === SIZES.length - 1}
            onClick={() => prefer({ size: Math.min(SIZES.length - 1, size + 1) })}
          >
            <Plus />
          </IconButton>
          <IconButton
            label={mirrored ? "Stop mirroring" : "Mirror for a prompter's glass"}
            shape="round"
            active={mirrored}
            onClick={() => prefer({ mirrored: !mirrored })}
          >
            <FlipHorizontal2 />
          </IconButton>
          <IconButton
            label={fullscreen ? "Leave full screen" : "Full screen"}
            shortcut="F"
            shape="round"
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
          </IconButton>
        </Panel>
        {listening ? (
          <div className="flex max-w-full items-center gap-2 text-micro text-fg-muted" aria-hidden>
            {/* How loud the microphone is: proof it's the right one and it's on. */}
            <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-fill-strong">
              <span
                ref={level}
                className="block h-full origin-left scale-x-0 rounded-full bg-fg-soft transition-transform duration-100"
              />
            </span>
            <span className="truncate" data-testid="prompter-heard">
              {heard === "" ? "Listening…" : heard}
            </span>
          </div>
        ) : null}
      </div>
      {recorder.phase === "counting" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-page/60 text-[22vh] font-medium tabular-nums text-fg"
        >
          {recorder.count}
        </div>
      ) : null}
    </div>
  );
}

/** Each beat's recording: none yet, one, or one made for words that have since changed. */
export type VoiceStatus = "none" | "recorded" | "stale";

/** Where a Script window's recordings go (D-105). */
export interface RecordingLink {
  /** Whether a beat has a script a recording can be kept for. */
  readonly canRecord: (beat: number) => boolean;
  readonly status: readonly VoiceStatus[];
  /** Keeps a take as the beat's recording; throws with why it couldn't be. */
  readonly save: (beat: number, take: Blob) => Promise<void>;
}

/** Seconds counted down before the first take, to settle and breathe. */
const COUNT_IN = 3;

/**
 * Record (D-105): after a count-in, the beat being read is recorded; when the reading moves on
 * (by voice or by key) that take is kept as its beat's recording and the next beat's starts.
 * Going back throws the take away and records the beat again. Stopping keeps the last one.
 */
function useRecorder(
  link: RecordingLink | undefined,
  beat: number | null,
  microphone: string | null,
) {
  const [phase, setPhase] = useState<"off" | "counting" | "recording">("off");
  const [count, setCount] = useState(COUNT_IN);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const takes = useRef<Takes | null>(null);
  const taking = useRef<number | null>(null);
  const countdown = useRef<number | null>(null);

  const keep = useCallback(
    (forBeat: number, take: Blob | null) => {
      if (take === null || link === undefined) return;
      setSaving((n) => n + 1);
      void link
        .save(forBeat, take)
        .catch((error: unknown) =>
          setProblem(error instanceof Error ? error.message : "That recording couldn't be kept."),
        )
        .finally(() => setSaving((n) => n - 1));
    },
    [link],
  );

  // A take for the beat being read; the one before is kept, or thrown away going back.
  useEffect(() => {
    const session = takes.current;
    if (phase !== "recording" || session === null) return;
    const was = taking.current;
    if (was === beat && session.recording) return;
    if (was !== null && session.recording) {
      if (beat !== null && beat < was) session.discard();
      else void session.finish().then((take) => keep(was, take));
    }
    taking.current = null;
    if (beat !== null && link?.canRecord(beat) === true) {
      session.start();
      taking.current = beat;
    }
  }, [beat, phase, keep, link]);

  const stop = useCallback(() => {
    if (countdown.current !== null) window.clearInterval(countdown.current);
    countdown.current = null;
    const session = takes.current;
    const was = taking.current;
    takes.current = null;
    taking.current = null;
    setPhase("off");
    if (session === null) return;
    void session.finish().then((take) => {
      if (was !== null) keep(was, take);
      session.close();
    });
  }, [keep]);

  const toggle = useCallback(() => {
    if (phase !== "off") {
      stop();
      return;
    }
    setProblem(null);
    void openMicrophone(microphone).then(
      (stream) => {
        takes.current = new Takes(stream);
        setCount(COUNT_IN);
        setPhase("counting");
        let left = COUNT_IN;
        countdown.current = window.setInterval(() => {
          left -= 1;
          if (left > 0) {
            setCount(left);
            return;
          }
          if (countdown.current !== null) window.clearInterval(countdown.current);
          countdown.current = null;
          setPhase("recording");
        }, 1000);
      },
      () =>
        setProblem("The microphone couldn't be opened. Allow it for this site, then try again."),
    );
  }, [phase, microphone, stop]);

  useEffect(
    () => () => {
      if (countdown.current !== null) window.clearInterval(countdown.current);
      takes.current?.close();
    },
    [],
  );

  return { available: link !== undefined, phase, count, problem, saving, toggle };
}
