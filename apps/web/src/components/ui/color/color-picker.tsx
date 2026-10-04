"use client";

import {
  DEFAULT_GRADIENTS,
  DEFAULT_SOLIDS,
  GRADIENT_GROUPS,
  PALETTE,
  formatHex,
  hsvToRgb,
  normalizeHex,
  paintCss,
  paintColors,
  parseColor,
  rgbToHsv,
  samePaint,
  type Hsv,
  type NamedColor,
  type Paint,
} from "@mogram/core/presets";
import { ArrowLeft, Pipette, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { SearchField } from "../search-field";
import { Tabs, TabsList, TabsTrigger } from "../tabs";
import { CHECKERBOARD, Swatch } from "./swatch";
import { ColorArea, ColorStrip, HUE_TRACK } from "./color-area";
import {
  GRADIENT_STYLES,
  rememberColor,
  readRecentColors,
  searchPaints,
  seedGradient,
  styleOf,
  styled,
  withAddedStop,
  withStopColor,
  withoutStop,
} from "./color-model";

export interface ColorPickerProps {
  /** What is being coloured ("Background", "Note colour"): the accessible name of the panel. */
  readonly label: string;
  readonly value: Paint | null;
  /** `live` is true while a slider is being dragged, so callers can merge those into one undo step. */
  readonly onChange: (value: Paint | null, live: boolean) => void;
  /** Offer gradients as well as solid colours. */
  readonly gradients?: boolean;
  /** Offer opacity (default on). */
  readonly alpha?: boolean;
  /** The name of "no colour of its own" (e.g. "Preset colour"); without it there is no such choice. */
  readonly none?: string;
  /** Colours already used in the diagram, shown first so a palette stays consistent. */
  readonly documentColors?: readonly Paint[];
  /** A row of colours made for this use (sticky note colours), shown above the defaults. */
  readonly presets?: { readonly title: string; readonly colors: readonly NamedColor[] };
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly align?: "start" | "center" | "end";
  /** The trigger (usually a `Swatch`). */
  readonly children: ReactNode;
}

/**
 * A colour picker modelled on Canva's: search by name or hex, the colours in this diagram, solid
 * and gradient tabs, a custom colour editor with opacity and an eyedropper, and preset rows with
 * the full palette and gradient groups behind "See all" so the panel stays short by default.
 */
export function ColorPicker({
  children,
  side = "left",
  align = "start",
  ...props
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        aria-label={props.label}
        className="w-[296px]"
        onKeyDown={(event) => event.stopPropagation()}
      >
        {open ? <PickerPanel {...props} /> : null}
      </PopoverContent>
    </Popover>
  );
}

type View =
  | { readonly kind: "main" }
  | { readonly kind: "custom"; readonly stop: number | null }
  | { readonly kind: "solids" }
  | { readonly kind: "gradients" };

interface EyeDropperApi {
  open(): Promise<{ sRGBHex: string }>;
}

/** The browser's eyedropper (Chromium), or null where it isn't available. */
function eyeDropper(): (new () => EyeDropperApi) | null {
  const api = (window as unknown as { EyeDropper?: new () => EyeDropperApi }).EyeDropper;
  return api ?? null;
}

function PickerPanel({
  label,
  value,
  onChange,
  gradients = false,
  alpha = true,
  none,
  documentColors = [],
  presets,
}: Omit<ColorPickerProps, "children" | "side" | "align">) {
  const [view, setView] = useState<View>({ kind: "main" });
  const [tab, setTab] = useState<"solid" | "gradient">(
    value !== null && value.kind !== "solid" ? "gradient" : "solid",
  );
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(readRecentColors);
  const choose = (paint: Paint | null) => {
    onChange(paint, false);
    if (paint !== null) setTab(paint.kind === "solid" ? "solid" : "gradient");
  };
  const pickWithEyeDropper = async () => {
    const Api = eyeDropper();
    if (Api === null) return;
    try {
      const { sRGBHex } = await new Api().open();
      const color = normalizeHex(sRGBHex);
      if (color !== null) {
        choose({ kind: "solid", color });
        setRecent(rememberColor(color));
      }
    } catch {
      // Cancelled with Escape: nothing to do.
    }
  };

  if (view.kind === "custom") {
    const editing =
      view.stop !== null && value !== null && value.kind !== "solid"
        ? (value.stops[view.stop]?.color ?? "#000000")
        : value === null
          ? "#ffffff"
          : (paintColors(value)[0] ?? "#ffffff");
    return (
      <CustomColor
        title={
          view.stop === null
            ? "Custom colour"
            : `Gradient colour ${view.stop + 1} of ${value !== null && value.kind !== "solid" ? value.stops.length : 2}`
        }
        label={label}
        color={editing}
        alpha={alpha}
        onBack={() => setView({ kind: "main" })}
        onChange={(color, live) => {
          if (view.stop !== null && value !== null && value.kind !== "solid") {
            onChange(withStopColor(value, view.stop, color), live);
          } else {
            onChange({ kind: "solid", color }, live);
          }
          if (!live) setRecent(rememberColor(color));
        }}
        onRemove={
          view.stop !== null && value !== null && value.kind !== "solid" && value.stops.length > 2
            ? () => {
                onChange(withoutStop(value, view.stop ?? 0), false);
                setView({ kind: "main" });
              }
            : null
        }
      />
    );
  }

  if (view.kind === "solids") {
    return (
      <SubPanel title="Default solid colours" onBack={() => setView({ kind: "main" })}>
        <div className="flex flex-col gap-2" role="group" aria-label="All solid colours">
          {PALETTE.map((row) => (
            <div key={row[0]?.name ?? ""} className="grid grid-cols-7 gap-2">
              {row.map((entry) => (
                <Swatch
                  key={entry.color}
                  name={entry.name}
                  paint={{ kind: "solid", color: entry.color }}
                  selected={samePaint(value, { kind: "solid", color: entry.color })}
                  onClick={() => choose({ kind: "solid", color: entry.color })}
                />
              ))}
            </div>
          ))}
        </div>
      </SubPanel>
    );
  }

  if (view.kind === "gradients") {
    return (
      <SubPanel title="Default gradients" onBack={() => setView({ kind: "main" })}>
        <div className="flex flex-col gap-4">
          {GRADIENT_GROUPS.map((group) => (
            <section key={group.name} aria-label={group.name}>
              <h4 className="mb-2 text-caption text-fg-muted">{group.name}</h4>
              <div className="grid grid-cols-7 gap-2">
                {group.gradients.map((entry) => (
                  <Swatch
                    key={entry.name}
                    name={entry.name}
                    paint={entry.paint}
                    selected={samePaint(value, entry.paint)}
                    onClick={() => choose(entry.paint)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </SubPanel>
    );
  }

  const results = searchPaints(query, gradients);
  const canDrop = eyeDropper() !== null;
  return (
    <div className="flex max-h-[min(600px,80dvh)] flex-col">
      <div className="px-3 pb-2 pt-3">
        <SearchField
          placeholder='Try "blue" or "#00c4cc"'
          aria-label={`Search colours for ${label.toLowerCase()}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Enter takes the first match: a typed hex, or the closest name.
            const first = results[0];
            if (event.key === "Enter" && first !== undefined) {
              event.preventDefault();
              choose(first.paint);
            }
          }}
          className="min-h-9"
        />
      </div>
      <div className="flex flex-col gap-4 overflow-y-auto px-3 pb-3">
        {query.trim() !== "" ? (
          <Section title="Results">
            {results.length === 0 ? (
              <p className="text-caption text-fg-muted">No colours match “{query}”.</p>
            ) : (
              <SwatchGrid>
                {results.map((result) => (
                  <Swatch
                    key={`${result.name}-${paintCss(result.paint)}`}
                    name={result.name}
                    paint={result.paint}
                    selected={samePaint(value, result.paint)}
                    onClick={() => choose(result.paint)}
                  />
                ))}
              </SwatchGrid>
            )}
          </Section>
        ) : (
          <>
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Quick colours"
            >
              <button
                type="button"
                aria-label="Custom colour"
                title="Custom colour"
                onClick={() => setView({ kind: "custom", stop: null })}
                className="flex size-8 items-center justify-center rounded-full border border-border-strong text-fg-soft transition-colors hover:text-fg [&_svg]:size-4"
                style={{
                  background:
                    "conic-gradient(#ef4444, #f59e0b, #facc15, #22c55e, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)",
                }}
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-card">
                  <Plus />
                </span>
              </button>
              {canDrop ? (
                <button
                  type="button"
                  aria-label="Pick a colour from the screen"
                  title="Pick a colour from the screen"
                  onClick={() => void pickWithEyeDropper()}
                  className="flex size-8 items-center justify-center rounded-full border border-border-strong text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg [&_svg]:size-4"
                >
                  <Pipette />
                </button>
              ) : null}
              {none !== undefined ? (
                <Swatch
                  name={none}
                  paint={null}
                  selected={value === null}
                  onClick={() => choose(null)}
                />
              ) : null}
              {recent.map((color) => (
                <Swatch
                  key={color}
                  name={`Recent colour ${color}`}
                  paint={{ kind: "solid", color }}
                  selected={samePaint(value, { kind: "solid", color })}
                  onClick={() => choose({ kind: "solid", color })}
                />
              ))}
            </div>

            {documentColors.length > 0 ? (
              <Section title="Colours in this diagram">
                <SwatchGrid>
                  {documentColors.map((paint) => (
                    <Swatch
                      key={paintCss(paint)}
                      name={paint.kind === "solid" ? paint.color : "Gradient in this diagram"}
                      paint={paint}
                      selected={samePaint(value, paint)}
                      onClick={() => choose(paint)}
                    />
                  ))}
                </SwatchGrid>
              </Section>
            ) : null}

            {gradients ? (
              <Tabs
                value={tab}
                onValueChange={(next) => {
                  const kind = next === "gradient" ? "gradient" : "solid";
                  setTab(kind);
                  // Switching converts the current colour, as Canva does: the first colour of a
                  // gradient becomes the solid, a solid becomes the start of a gradient.
                  if (kind === "gradient" && (value === null || value.kind === "solid")) {
                    onChange(seedGradient(value?.color ?? "#3b82f6"), false);
                  } else if (kind === "solid" && value !== null && value.kind !== "solid") {
                    onChange({ kind: "solid", color: paintColors(value)[0] ?? "#000000" }, false);
                  }
                }}
              >
                <TabsList className="w-full border-b border-border-subtle">
                  <TabsTrigger value="solid" className="flex-1">
                    Solid colour
                  </TabsTrigger>
                  <TabsTrigger value="gradient" className="flex-1">
                    Gradient
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : null}

            {gradients && tab === "gradient" && value !== null && value.kind !== "solid" ? (
              <GradientEditor
                value={value}
                onChange={(paint) => onChange(paint, false)}
                onEditStop={(stop) => setView({ kind: "custom", stop })}
              />
            ) : null}

            {presets !== undefined ? (
              <Section title={presets.title}>
                <SwatchGrid>
                  {presets.colors.map((entry) => (
                    <Swatch
                      key={entry.color}
                      name={entry.name}
                      paint={{ kind: "solid", color: entry.color }}
                      selected={samePaint(value, { kind: "solid", color: entry.color })}
                      onClick={() => choose({ kind: "solid", color: entry.color })}
                    />
                  ))}
                </SwatchGrid>
              </Section>
            ) : null}

            <Section
              title="Default solid colours"
              action={{ label: "See all", onClick: () => setView({ kind: "solids" }) }}
            >
              <SwatchGrid>
                {DEFAULT_SOLIDS.map((entry) => (
                  <Swatch
                    key={entry.color}
                    name={entry.name}
                    paint={{ kind: "solid", color: entry.color }}
                    selected={samePaint(value, { kind: "solid", color: entry.color })}
                    onClick={() => choose({ kind: "solid", color: entry.color })}
                  />
                ))}
              </SwatchGrid>
            </Section>

            {gradients ? (
              <Section
                title="Default gradients"
                action={{ label: "See all", onClick: () => setView({ kind: "gradients" }) }}
              >
                <SwatchGrid>
                  {DEFAULT_GRADIENTS.map((entry) => (
                    <Swatch
                      key={entry.name}
                      name={entry.name}
                      paint={entry.paint}
                      selected={samePaint(value, entry.paint)}
                      onClick={() => choose(entry.paint)}
                    />
                  ))}
                </SwatchGrid>
              </Section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-caption font-medium text-fg-soft">{title}</h4>
        {action !== undefined ? (
          <button
            type="button"
            onClick={action.onClick}
            className="rounded-sm text-caption text-fg-muted transition-colors hover:text-fg"
          >
            {action.label}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SwatchGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-7 gap-2">{children}</div>;
}

function SubPanel({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex max-h-[min(600px,80dvh)] flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle px-2 py-2">
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className="flex size-7 items-center justify-center rounded-md text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg [&_svg]:size-4"
        >
          <ArrowLeft />
        </button>
        <h3 className="text-label font-medium text-fg">{title}</h3>
      </div>
      <div className="overflow-y-auto p-3">{children}</div>
    </div>
  );
}

function GradientEditor({
  value,
  onChange,
  onEditStop,
}: {
  value: Exclude<Paint, { kind: "solid" }>;
  onChange: (paint: Paint) => void;
  onEditStop: (stop: number) => void;
}) {
  const current = styleOf(value);
  return (
    <div className="flex flex-col gap-3">
      <Section title="Gradient colours">
        <div className="flex flex-wrap items-center gap-2">
          {value.stops.map((stop, index) => (
            <Swatch
              key={index}
              name={`Edit gradient colour ${index + 1} (${stop.color})`}
              paint={{ kind: "solid", color: stop.color }}
              onClick={() => onEditStop(index)}
            />
          ))}
          {value.stops.length < 6 ? (
            <button
              type="button"
              aria-label="Add a gradient colour"
              title="Add a gradient colour"
              onClick={() => onChange(withAddedStop(value))}
              className="flex size-8 items-center justify-center rounded-full border border-dashed border-border-strong text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg [&_svg]:size-4"
            >
              <Plus />
            </button>
          ) : null}
        </div>
      </Section>
      <Section title="Style">
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Gradient style">
          {GRADIENT_STYLES.map((style) => {
            const preview = styled(style.id, value.stops);
            return (
              <button
                key={style.id}
                type="button"
                role="radio"
                aria-checked={current === style.id}
                aria-label={style.label}
                title={style.label}
                onClick={() => onChange(preview)}
                className={cn(
                  "h-10 rounded-md border border-border-strong outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-border-emphasis",
                  current === style.id && "ring-2 ring-fg ring-offset-2 ring-offset-card",
                )}
                style={{ background: paintCss(preview) }}
              />
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function CustomColor({
  title,
  label,
  color,
  alpha,
  onBack,
  onChange,
  onRemove,
}: {
  title: string;
  label: string;
  color: string;
  alpha: boolean;
  onBack: () => void;
  onChange: (color: string, live: boolean) => void;
  onRemove: (() => void) | null;
}) {
  const rgba = parseColor(color);
  // Hue is kept separately: greys and black have none, and dragging through them mustn't lose it.
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(rgba));
  const [opacity, setOpacity] = useState(rgba.a);
  const [hexText, setHexText] = useState(color.slice(0, 7));
  const [percentText, setPercentText] = useState(String(Math.round(rgba.a * 100)));
  const emit = (next: Hsv, nextOpacity: number, live: boolean) => {
    setHsv(next);
    setOpacity(nextOpacity);
    const hex = formatHex(hsvToRgb(next, nextOpacity));
    setHexText(hex.slice(0, 7));
    setPercentText(String(Math.round(nextOpacity * 100)));
    onChange(hex, live);
  };
  const opaque = formatHex(hsvToRgb(hsv));
  const current = formatHex(hsvToRgb(hsv, opacity));
  const commitHex = () => {
    const parsed = normalizeHex(hexText.startsWith("#") ? hexText : `#${hexText}`);
    if (parsed === null) {
      setHexText(opaque);
      return;
    }
    const read = parseColor(parsed);
    emit(rgbToHsv(read), parsed.length === 9 ? read.a : opacity, false);
  };
  const commitPercent = () => {
    const value = Number.parseFloat(percentText);
    if (!Number.isFinite(value)) {
      setPercentText(String(Math.round(opacity * 100)));
      return;
    }
    emit(hsv, Math.min(1, Math.max(0, value / 100)), false);
  };

  return (
    <SubPanel title={title} onBack={onBack}>
      <div className="flex flex-col gap-3">
        <ColorArea hsv={hsv} label={label} onChange={(next, live) => emit(next, opacity, live)} />
        <ColorStrip
          label={`${label}: hue`}
          value={hsv.h / 360}
          valueText={`Hue ${Math.round(hsv.h)} degrees`}
          track={HUE_TRACK}
          thumb={formatHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }))}
          onChange={(value, live) => emit({ ...hsv, h: value * 360 }, opacity, live)}
        />
        {alpha ? (
          <ColorStrip
            label={`${label}: opacity`}
            value={opacity}
            valueText={`Opacity ${Math.round(opacity * 100)}%`}
            track={`linear-gradient(to right, transparent, ${opaque}), ${CHECKERBOARD}`}
            thumb={current}
            onChange={(value, live) => emit(hsv, value, live)}
          />
        ) : null}
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-8 shrink-0 rounded-full border border-border-strong"
            style={{ background: `linear-gradient(${current}, ${current}), ${CHECKERBOARD}` }}
          />
          <input
            aria-label={`${label}: hex colour`}
            value={hexText}
            spellCheck={false}
            onChange={(event) => setHexText(event.target.value)}
            onBlur={commitHex}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitHex();
            }}
            className="h-8 min-w-0 flex-1 rounded-md bg-fill-field px-2.5 font-mono text-caption uppercase text-fg outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis"
          />
          {alpha ? (
            <label className="flex h-8 w-[68px] items-center rounded-md bg-fill-field pr-2 text-caption text-fg-muted focus-within:ring-1 focus-within:ring-border-emphasis">
              <input
                aria-label={`${label}: opacity percent`}
                value={percentText}
                inputMode="numeric"
                onChange={(event) => setPercentText(event.target.value)}
                onBlur={commitPercent}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitPercent();
                }}
                className="h-full min-w-0 flex-1 bg-transparent px-2 text-right text-caption text-fg outline-none"
              />
              %
            </label>
          ) : null}
        </div>
        {onRemove !== null ? (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-8 items-center justify-center gap-2 rounded-md text-caption text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg [&_svg]:size-3.5"
          >
            <Trash2 /> Remove this colour
          </button>
        ) : null}
      </div>
    </SubPanel>
  );
}
