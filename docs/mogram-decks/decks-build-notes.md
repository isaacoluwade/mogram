# Decks: build notes

Where each part of `decks.md` goes in the code, by milestone. Symbols are from the working tree on 2026-10-09, read and not run unless a line says "checked". No line numbers: the tree was moving. Paths under `packages/core/src/` are written `core:`, under `apps/web/src/` as `web:`.

Rules that apply throughout (from `docs/engineering-standards.md`): core stays pure (no DOM, no `Date.now()`, no randomness, every exported function tested); features own their folder; tokens only; four states for every view; zod on every body; a `D-<n>` entry and a build-log step for each milestone; Playwright journeys with screenshots at 390, 834, 1280 and 1440.

## Before anything: three things to settle

1. **Commit the K0 to K4 work.** Everything below builds on stories, presence and layouts, which are uncommitted. `concept-platform-status.md` §6.1 (build, production e2e, commit) comes first.
2. **Fix the rename gap.** `rewriteReferences` and `pruneReferences` in `core:edit/elements.ts` never touch `stories:`, so renaming or deleting an element leaves a step's `set`, `focus` and `zoom` pointing at nothing. Decks lean on stories for everything, so this is P0 work. The same functions need to follow parts (`main_tf.name`) and, for folders, deck entries.
3. **`"controls"` is missing from `SECTION_ORDER`** in `core:edit/session.ts`. Not a deck issue; noted because `deck` is about to be added to the same list.

## P0: stories anywhere

Today a story plays only when the diagram is the project's root.

| Where                                                                                                | What assumes the root                           | Change                                                                                     |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `topDiagram(files)` (`parseCached(files, "")`)                                                       | "the top diagram" is `""`                       | Take a folder: `diagramAt(files, folder)`. Callers that mean the project root pass `""`    |
| `web:features/viewer/controller.ts`, `ViewerController` (`top` is `levels.geometry("")`)             | stories, scenes and controls read from the root | A `root: string` on the controller. Levels, deep links and `exitLevel` work relative to it |
| `web:features/export/export.ts`, `prepare` (`story: folder === "" ? storyTimeline(diagram) : null`)  | only the root has a timeline                    | Use the timeline of the folder being exported                                              |
| `web:features/viewer/levels.ts`, `splitTarget`; `web:features/canvas/use-diagram.ts`, `resolveAlong` | paths start at the root                         | Start at `root`                                                                            |
| `core:nested/graph.ts`, `resolveLevels(source, path, root = "")`                                     | already takes a root                            | Pass it                                                                                    |

`DiagramPreview` already reads the story of whatever `folder` it is given, so previews are the model.

Done when: a project with `a/mogram.yaml` holding a story plays it at `/draft/<id>/view?level=…` opened on `a` as root, exports it, and links to its beats, with every existing journey unchanged.

## P1: page

**Core**

- `core:presets/pages.ts` (new): `PAGES = ["16:9", "4:3", "1:1", "9:16"]`, `pageSize(page): GridSize`.
- `core:model/types.ts`: `DiagramSettings.page: PageName | null`; `emptyDiagram`.
- `core:format/raw.ts` `RawSettings`; `core:format/read.ts` `SETTINGS_KEYS`, a case in `ElementReader.readSetting`, `emptySettings`. `page: 16:9` reads as the string `"16:9"` with the repo's `yaml` 2.9.1 (checked by the reader of core).
- `core:format/parse.ts`, the settings literal in `Merger.build`.
- `core:edit/session.ts` `SETTING_ORDER`; `core:edit/files.ts` `SettingKey` and `setSetting`.
- `core:layout/compute.ts`: `LayoutResult.page: Box | null` (`{ x: 0, y: 0, w, h }` in px). `bounds` stays what it is; callers choose.
- `core:lint/lint.ts`: the off-page suggestion.

**App**: everything that frames a diagram should ask one function, `frameOf(layout)`, which returns the page when there is one and the bounds otherwise. Callers found:

- `web:features/viewer/controller.ts` `fitArea` / `fitCamera` (`fitBox(bounds, viewport, { padding: 40, maxZoom: 1.1, … })`): with a page, padding 0 in present mode and no `maxZoom`.
- `web:features/editor/actions.ts` `fitArea` / `fitCamera` (`padding: 32, maxZoom: 1`).
- `web:features/export/export.ts` `exportFrame(bounds, area)` (pads by `PADDING = 48`, grows to `ASPECTS[area]`): a new area `"page"`, the default when there is one, with no padding. `ExportArea` and the two calls in `export-dialog.tsx`.
- `web:features/canvas/scene.ts` `SceneModel.bounds`; `web:features/canvas/diagram-preview.tsx` (`fitBox(model.bounds, …)`); `web:features/export/export.ts` `renderThumbnail` (480 × 300, 16:10: with a page, the page's proportions).
- `web:features/editor/chrome/minimap.tsx`, `chrome/scene-strip.tsx` (`SceneThumb`), `web:features/canvas/svg/stubs.tsx`, the placement code in `web:lib/ai/tools.ts` and in `actions.ts` for paste and insert.
- `web:features/canvas/svg/diagram-svg.tsx`: a clip to the page outside the editor; in the editor, the page outline and a dim wash over what's off stage.
- Editor: Page in the Canvas tab of the inspector; smart guides at the page's edges and centre lines.

## P2: decks that play

**Core**

- `core:model/types.ts`:

  ```ts
  export interface Deck {
    readonly frame: string | null; // a folder, normalised
    readonly captions: boolean;
    readonly entries: readonly DeckEntry[];
    readonly source: SourceRef;
  }
  export type DeckEntry =
    | { readonly kind: "section"; readonly title: string; readonly source: SourceRef }
    | {
        readonly kind: "slide";
        readonly folder: string;
        readonly story: string | null;
        readonly from: string | null;
        readonly to: string | null;
        readonly scene: string | null;
        readonly title: string | null;
        readonly frame: boolean;
        readonly skip: boolean;
        readonly source: SourceRef;
      };
  ```

  and `DiagramSettings.deck: Deck | null`.

- `core:format/read.ts`: `deck` joins `SETTINGS_KEYS` (today it falls to the default case: `"deck" isn't a section Mogram knows, so it is ignored.`). `readDeck` on the model of `readConcept`; `RawDeck` in `core:format/raw.ts`; folders through `resolveFromFolder` (`core:model/paths.ts`), which already keeps paths inside the project.
- `core:format/parse.ts`: `Merger.validateDeck` for what one file can know (shapes of entries, a deck's file having elements). What needs other folders is checked where `checkNestedReferences` is, with a `DiagramLoader`: `checkDeckReferences(source, deck)` (folder holds a diagram, isn't a deck, story and step names exist, `from` before `to`).
- `core:deck/` (new), all pure:

  ```ts
  deckInfo(files: ProjectFiles, folder = ""): DeckInfo | null      // like conceptInfo: a cheap regex first, then parse
  deckSlides(source: DiagramLoader, deckFolder: string): readonly DeckSlide[]   // skipped ones removed, numbered, with section and resolved stretch
  interface DeckSlide { index; number; folder; story; from: StepRef | null; to: StepRef | null; scene; title; section; frame; carriesOn: boolean }
  interface DeckPosition { readonly slide: number; readonly moment: Moment }
  startDeck(slides, at?): DeckPosition
  nextInDeck(source, slides, position, controls?): DeckPosition[]   // the cursors of one beat, or the next slide's opening
  previousInDeck(source, slides, position): DeckPosition | null
  slideOpening(diagram, slide): StoryCursor | null                 // the `from` picture: cursorAtStep
  slideEnded(diagram, slide, cursor): boolean                      // the `to` step's beat has played
  deckTimeline(source, slides, voices?): DeckTimeline
  deckPositionAt(timeline, t): { position: DeckPosition; previous: DeckPosition | null; changeStart: number; cut: boolean }
  ```

  `DeckTimeline` is `{ slides: { slide, start, end, opening, segments: StorySegment[] }[], sections: { title, start }[], duration }`, with `StorySegment` times made absolute. Constants beside the existing ones in `core:picture/timeline.ts`: `SLIDE_OPENING = 0.6`, `STILL_SLIDE = 4`, `SLIDE_CUT = REWIND_CUT`.

- `core:model/placeholders.ts`: `PlaceholderContext` gains `deck?: { name; section; slide; slides }`, and four cases in the built-in switch. The callers that pass no context today (`shown` in `buildScene`, `web:features/viewer/card-panel.tsx`) pass the deck's.
- Inheriting: one function, `slideDiagram(deckDiagram, slideDiagram): Diagram`, that fills `page`, `theme`, `background`, `grid`, and merges `styles` and `data`. Everything downstream takes its result.
- `core:edit/session.ts` `SECTION_ORDER` (after the settings, before `styles`).

**App**

- `web:features/deck/` (new): `deck-store.ts` (the position, playing, record mode, captions; created per instance, not a module singleton), `deck-controller.ts`, `deck-player.tsx`, `overview-grid.tsx`.
- `DeckPlayer` mounts one `Viewer` for the current slide with `root` set to its folder (P0), and owns the keys that cross slides. When the next slide carries on, it keeps the same `Viewer` mounted and only moves the story cursor; otherwise it swaps with the cut.
- The frame: `buildScene` for the frame's folder gives an underlay model that `DiagramSvg` draws first.
- `web:features/viewer/viewer.tsx`: a `chrome: "full" | "present" | "none"` prop in place of the `present` boolean. `"none"` (Record mode) gates, in `ViewerBody`: the leave button, `LevelBack`, `PresentStart`, `PresentHint`, `ViewerTitleBar`, `ViewerActions`, `ViewerZoom`, `SceneBar`, `ControlsBar`, `StoryBar`, `CardPanel`. `chromeInsets(viewport, present)` must return zeros and `reservedBottom` must not be set, or the page is pushed up. The pointer is hidden with CSS on the stage.
- Keys (`useViewerKeys` → `onKey`): today forward is ArrowRight, PageDown, and Space when presenting. Add Shift+Arrow for a slide, Home, End, `G` for the overview, `C` for captions. `P` and `M` keep their meanings.
- `web:features/share/deep-link.ts`: `DeepLink.slide: number | null` (`/^\d{1,3}$/`, like `beat`); `record=1` beside `present=1` on the route pages.
- Thumbnails: `DiagramPreview` gains an optional `moment` prop that replaces `playing.cursor` (it can't draw a chosen beat today). `SceneThumb` in `chrome/scene-strip.tsx` already takes a `Moment`.
- The viewer routes (`/draft/[id]/view`, `/edit/[id]/view`, `/s/[shareId]`) render `DeckPlayer` when `deckInfo(files)` isn't null.
- Opening: `readProject` in `web:features/files/open.ts` already keeps subfolders. A dropped folder is not walked today (`webkitGetAsEntry` isn't used; the folder input and zips work). Worth fixing here.

## P3: decks you can build

**Core** `core:edit/deck.ts` (new), each `(files, diagram, args) => EditResult` like every other command:

`createDeck`, `setDeckSetting` (frame, captions), `addSlide` (folder, at index, optional stretch), `addSection`, `renameSection`, `moveEntries`, `removeEntries`, `updateSlide` (story, from, to, scene, title, frame, skip), `duplicateSlide`, `detachSlide` (copies the folder under a fresh name and repoints the entry), `splitSlide` (names the step if it has no name, then writes `to` and `from`), `joinSlides`, `newSlideFolder` (a blank page diagram), `renameSlideFolder` (rewrites every entry and every `opens`).

**App**

- **The editor shell** (`web:features/editor/editor-shell.tsx`, `ShellBody`) is one full-bleed canvas with absolutely placed panels. The left `aside` is `w-panel-library` (288 px) with `leftTab` choosing `LibraryPanel`, `ConceptsPanel` or `AssistantPanel`. The rail is a new `aside` at the far left. What moves with it: every `left-3`, `md:left-clear-library` and `md:left-clear-pill`, the tokens in `src/styles/tokens.css`, and the insets `fitCamera` uses. In a deck the library panel starts closed (its pill).
- **Which slide is open** (`web:features/editor/store/editor-store.ts`): `folder` and `levelPath` already say which diagram is being edited, and `parsed()` is `parseCached(shownFiles(get()), get().folder)`, so showing a slide is setting `folder`. Add `slide: number | null` and `showSlide(index)`; undo snapshots already carry `folder` and `levelPath` and should carry `slide`.
- `web:features/deck/slide-rail.tsx`, `add-slide-dialog.tsx`, `slide-inspector.tsx`.
- **Story dock** (`chrome/story-strip.tsx`): "Start a new slide here" and "Join with the slide before" on a beat's menu.
- **Dashboard**: `DiagramSummary` gains `deck: { slides: number } | null` beside `concept` (`web:lib/api/contracts.ts`); `conceptSummary` in `web:features/drafts/drafts.ts` and `conceptOf` in `web:server/diagrams/service.ts` are where `deckInfo` is called too. `DashboardItem` currently drops `concept`; it needs to keep `deck`. `renderThumbnail(files)` draws folder `""`; for a deck it draws the first slide.
- **Templates**: starter slides are diagrams with a page, beside the existing templates (`web:features/templates/`).
- **Bring in a diagram from another saved diagram**: fetched once the way `ConceptEntry.load()` does (`getDraft(id)` or `api.getDiagram(id)`), copied in under a folder, with its origin kept in the slide's diagram as `data: { from_diagram: <id>, from_version: <n> }` so "Bring in the latest" can offer itself.

## P4: assets, images, wrapping text

### Assets

There is no binary storage today. `ProjectFiles` is `Readonly<Record<string, string>>`; drafts are idb-keyval (`mogram-drafts`); cloud rows hold `files jsonb`; revisions hold a full copy; limits are 2 MB a file, 5 MB a diagram, 6 MB a request (`LIMITS` in `web:lib/api/contracts.ts`, `MAX_BODY_BYTES` in `web:server/http.ts`), measured as `text.length`.

- **Core** `core:assets/pointer.ts` (new): `parsePointer(text): AssetPointer | null`, `formatPointer(pointer): string`, `isPointer(text)`. `AssetPointer` is `{ hash, type, bytes, width?, height?, seconds?, skip? }`.
- **Drafts**: a third idb-keyval store, `mogram-assets`, keyed `sha256:<hex>`, holding Blobs. Assets are shared across drafts by hash.
- **Cloud**: a table in `web:server/db/schema.ts`:

  ```ts
  asset: { ownerId, hash (sha256 hex), type, bytes (integer), data (bytea), createdAt }   // primary key (ownerId, hash)
  ```

  and a join of which diagrams use which hashes (worked out from the pointers in `files` on save, so revisions and shares need nothing extra).

- **Routes** (thin, zod, owner check, 404 not 403):
  - `PUT /api/assets/:hash` (signed in; body is the bytes; the server hashes them and refuses a mismatch; type from an allow-list; size limit);
  - `GET /api/diagrams/:id/assets/:hash` (owner);
  - `GET /api/share/:shareId/assets/:hash` (anyone with the link, only for hashes that diagram's files point at; `Cache-Control: public, max-age=31536000, immutable`; the stored type; `X-Content-Type-Options: nosniff` is already global).
- **Sanitiser** (`sanitizeProjectFiles`, `web:server/diagrams/sanitize.ts`): accept a pointer at an image or audio path when the owner has that asset; accept the code extensions as text up to 200 KB. Today anything else fails the save with `"${path} isn't a file type Mogram stores. Use .mogram.yaml, .md, .svg or images."`
- **Open** (`addEntry` in `web:features/files/open.ts`): today rasters become `data:` URLs and audio is skipped silently. Change: hash the bytes (`crypto.subtle.digest`), store the Blob, write the pointer (reading a picture's size with `createImageBitmap` and a clip's length with `decodeAudioData`). `ACCEPT` in `open-dialog.tsx` gains the audio and code extensions.
- **Download** (`downloadProject`, `web:features/files/download.ts`): it already decodes `data:` values to bytes with `dataUrlBytes`; do the same for pointers.
- **Resolve**: `web:features/assets/resolve.ts`, `assetUrl(pointer): Promise<string>` (a blob URL from the store, or the route). CSP already allows `img-src 'self' data: blob: https:` and `media-src 'self' blob:`.
- **Limits** to add to `LIMITS` and `docs/security.md` §5: a picture up to 8 MB; a recording up to 8 MB and 120 s; a project's assets up to 500 MB and 2,000 files.

### Image

- `core:presets/shapes.ts`: `"image"` joins `SHAPES`, with `SHAPE_INFO`. There is no `Shape` type: a shape is a `Component` with `shape: ShapeId`, `look: ShapeLook` and `type: "shape/<id>"`, read by `ElementReader.readShape`.
- `core:model/types.ts`: `Component.image: { src: string; fit: "contain" | "cover" } | null`.
- `core:format/read.ts` `SHAPE_KEYS` (`src`, `fit`, `parts`); `core:edit/elements.ts` `addShape`, `SHAPE_DEFAULTS`; `core:edit/properties.ts` `ELEMENT_KEYS`.
- `core:layout/compute.ts`: its default size from the pointer's proportions.
- `web:features/canvas/svg/image-node.tsx` (new), drawn as `<image>` beside `ShapeNode`. `iconSource` in `web:features/canvas/icons.ts` resolves only catalogue ids and `.svg` paths; images go through `assetUrl`.
- Export: frames are SVG strings decoded by `new Image()`, which can't fetch. `prepare` must turn every image a deck uses into a `data:` URL once, as it does for icons (`preloadIcons`) and fonts (`fontAsDataUrl`).
- Editor: drop and paste on the canvas; Image in the library's shapes.

### Wrapping text

- `core:model/types.ts`: `width: number | null` on the text variant of `Decoration`. `DECORATION_KEYS` in `core:format/read-layout.ts` (today `width` warns `"width" isn't a decoration setting, so it is ignored.`), read in the text branch of `LayoutReader.readDecorations`.
- `core:layout/compute.ts` `decorationSize`, the `"text"` case. Core has no real measurer: `estimateTextWidth` is `text.length × fontSize × 0.56`. So core's wrapped height is an estimate and the renderer's is exact. With a page that matters little (the frame is the page, not the bounds); without one, bounds may be a line out. Keep the estimate conservative.
- `web:features/canvas/scene.ts` `richDecoration` calls `layoutRich(…, { maxWidth: Number.POSITIVE_INFINITY })` for text; pass the width.
- `core:edit/elements.ts` `resizeElement` throws `Only highlight zones and sticky notes can be resized.`: let text take a width. `web:features/editor/canvas/text-editor.tsx` for the overlay.
- **A text decoration `in:` an arranging container isn't placed by it today** (checked with the parser on the fixture: `Decoration "p1" needs a position, like "at: [4, 6]", or something to ride on, like "on: web".`). `placeAll` / `placeMovers` in `core:layout/place.ts` and that check in `core:format/read-layout.ts` need to treat a decoration in a `row`, `column` or `grid` as a child like any other.

## P5: code, and parts

### Code

- `"code"` joins `SHAPES`. `Component.code: { text: string | null; file: string | null; lines: [number, number] | null; language: CodeLanguage; title: string | null | "none"; numbers: boolean } | null`.
- `core:code/` (new): `readCode(files, component): { lines: readonly string[]; first: number; missing: boolean }` (resolves `file`, applies the slice, expands tabs, strips colour codes for `console`), and `highlight(language, lines): readonly Token[][]` where a token is `{ text, kind }` and `kind` is one of `keyword, name, string, number, comment, punctuation, command, output, added, removed, changed, replaced, read, summary, plain`. Small hand-written tokenisers. No highlighter library: the popular ones need WebAssembly or `eval`, which production CSP blocks.
- Mono metrics for sizing: `0.6 × font_size` a character, `1.5 × font_size` a line, a 36 px header.
- `web:features/canvas/svg/code-node.tsx` (new): one `<text>` per line with `xml:space="preserve"` and a `<tspan>` per token. Today `wordsOf` in `web:features/canvas/rich-text.ts` collapses whitespace, which is why mono text loses its indentation; code doesn't go through it.
- Theme: token colours per theme, dark and light, in the canvas theme presets.
- `checkPath` in `web:lib/ai/tools.ts` lets `write_file` write only `.mogram.yaml`, `.mogram` and `.md`; allow the code extensions.
- The code panel lists only Mogram files and `.md` of the level's folder; list `code/` too.

### Parts

- `core:model/types.ts`: `Component.parts: ReadonlyMap<string, Part>`; `Part` is `{ name; lines: [number, number] | null; area: [number, number, number, number] | null; show: Presence; tone: Tone | null; mark: Mark | null; source }`.
- **Where a dotted name is understood today, and must learn parts:**
  - `core:format/parse.ts`: `Merger.validateSceneEntry` (the `dot !== -1` branch), `Merger.knownTarget` (story `focus` and `zoom`), the local `knownTarget` in `validateTours`, `validateSceneCapacity`, and `Merger.validateConnections` (which says `…only components that open a nested diagram have ports.`).
  - `core:format/endpoints.ts` `parseEndpoint` reads `a.b` as element `a`, port `b`. With parts: a part when `a` has parts.
  - `core:state/resolve.ts` `split()` sends every dotted target to `nested[owner]` and drops it silently when the owner opens nothing.
  - `core:picture/picture.ts`: `lay()` keys by the full target, but `keep()` applies lines by element name and treats any dotted target as nested. Add `Picture.parts: ReadonlyMap<string, ReadonlyMap<string, PartState>>`.
  - `web:features/viewer/levels.ts` `splitTarget` treats every segment but the last as a level path.
  - `core:edit/elements.ts` `renameElement`'s `replaceRef` already handles `${from}.` prefixes.
- `core:layout/`: `partBox(layout, element, part): Box`, for focus, zoom and connection ends. The router treats it as the end's box.
- `SET_KEYS` (`core:format/read-story.ts`) stay as they are; a part accepts three of them.
- `core:edit/elements.ts`: `setPart`, `removePart`, `renamePart`.
- Renderer: a wash and a left bar on code lines, an outline on image regions; marks from `glyphs.tsx`; focus dims the element's other lines, or everything outside the region.

## P6: words

- `core:model/types.ts` `StoryStep.script: string | null`; `STEP_KEYS` and `StoryReader.readStoryStep` in `core:format/read-story.ts`; `emptyStep`; `StoryStepPatch` and `updateStep` in `core:edit/stories.ts`.
- **A beat starts on `say` or `script`**: `beatsOf`, `nextBeat` and `captionAt` in `core:picture/moment.ts`, and the `caption = step.say ?? caption` line in `storyTimeline`.
- A step with only a `script` must count as saying something. Today it is dropped (checked on the fixture's title slide: `This step of story "main" says and changes nothing, so it's left out.`).
- `core:picture/timeline.ts`: `speakingTime(text) = 0.4 + words / 3.2`; `stepHold` uses it when the beat has a script and no clip.
- **Script window**: a route beside each viewer route (`…/script`), opened with `window.open`, kept in step over a `BroadcastChannel` named for the diagram id. It sends nothing over the network. `web:features/deck/script-window.tsx`, `deck-channel.ts`.
- **Script export**: `web:features/export/deck-export.ts`, `scriptMarkdown(source, slides)`.

## P7: voice

- **The header.** `next.config.ts` sends `Permissions-Policy: camera=(), microphone=(), …` on every response, which denies `getUserMedia({ audio })` even to Mogram itself. Change to `microphone=(self)` and record why in `docs/security.md`. Nothing recorded leaves the browser except as an asset the owner saves.
- **The key.** `core:assets/voice.ts`: `voiceKey(text): string`, a pure 64-bit FNV-1a over the normalised words, as 16 hex characters. `voiceFor(files, step): AssetPointer | null` looks for `voice/<key>.*`. `voiceLengths(files, diagram): ReadonlyMap<StepRef-key, { seconds; skip }>`.
- **Timeline.** `storyTimeline(diagram, story?, controls?, voices?)`. The loop already holds the beat's cursors, `endsBeat` and the caption, so the clip's length is applied there: the beat's segments are spread evenly over `seconds`, and the last one ends `0.35` later. `StoryStep.hold` already exists (capped by `MAX_HOLD = 60`) and wins in `stepHold`; with a clip it adds.
- **Recorder** `web:features/deck/recorder.ts`: `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } })`; a `MediaRecorder` (`audio/webm;codecs=opus` in Chrome) stopped and restarted at each advance, so each beat is its own file. On stop: decode once, find the first and last sample above about −45 dBFS, keep 80 ms either side, and write `seconds` and `skip` to the pointer. The file isn't re-encoded.
- **Play with sound** `web:features/deck/voice-player.ts`: an `AudioContext`; each clip decoded when its slide opens and started at its beat's time from `deckTimeline`, from `skip`.
- **Out of date / keep**: a beat whose key has no file but whose step had one in the last saved version is "out of date"; "Keep this recording" renames the file to the new key.
- **Subtitles and chapters** in `deck-export.ts`: cues from each beat's script (split at sentence ends into cues of at most two lines, timed by word count within the beat); chapters from `DeckTimeline.sections`.

## P8: deck exports

- **PDF**: `jpegToPdf` in `web:features/export/pdf.ts` writes PDF 1.4 by hand with one `/DCTDecode` JPEG and `/Count 1`. Make it take a list of pages.
- **Images**: the per-beat zip exists for one story (`ends = [story.opening, ...segments.filter(s => s.endsBeat).map(s => s.to)]`, packed with `zipSync`). Run it across slides, with folders by section.
- **Video** `web:features/export/video.ts` (new):
  - **Frames**: the existing path. `frameAt(t)` is `markup(prepared, modelAt(t), t, …)` (`renderToStaticMarkup(createElement(DiagramSvg, { time: { kind: "static", t }, mode: "export", … }))`) then `rasterize(svg, width, height, matte)` (Blob URL → `Image` → `drawImage`). Position at `t` from `deckPositionAt`. `MAX_ANIMATED_WIDTH = 1280` and `fps: 10 | 20 | 25` are for GIF and WebP and stay.
  - **Encoding**: WebCodecs. `new VideoFrame(canvas, { timestamp: i × 1e6 / fps })` into a `VideoEncoder`; wait while `encodeQueueSize > 4`; a key frame every two seconds. Ask `VideoEncoder.isConfigSupported` for H.264 (`avc1.640028` at 1080p, `avc1.640033` at 2160p) and fall back to VP9. About 8 Mbit/s at 1080p30 and 35 Mbit/s at 2160p30.
  - **Sound**: per slide, an `OfflineAudioContext` at 48 kHz mixes that slide's clips at their times; the result goes to an `AudioEncoder` (AAC `mp4a.40.2` with H.264, Opus with VP9). Per slide, not per deck: an hour of float samples in one buffer is over a gigabyte.
  - **Muxing**: a small MP4 and WebM muxer written in JavaScript. Not WebAssembly: production `script-src` has neither `'wasm-unsafe-eval'` nor `'unsafe-eval'`. Written to a file the person picks (`showSaveFilePicker`) as it goes; an hour of 1080p doesn't fit comfortably in memory.
  - **Still frames**: when the position hasn't changed since the last frame and nothing in the model moves (no flowing connection, no motion preset, no value run, no transition or capacity change under way), encode the previous canvas again and skip `markup` and `rasterize`. Text, code and picture slides are then almost free.
  - Not used anywhere in the app today: WebCodecs, MediaRecorder, AudioContext, getUserMedia, `<audio>`, `<video>`.
  - Worth knowing: fonts are inlined into every frame's SVG as `data:` URLs (`embeddedFonts`). That is fine for a 100-frame GIF and may dominate at 100,000 frames. Measure, and if it does, draw text-free layers once.
- Nothing is uploaded to export (`docs/security.md` §8 already says so); that stays true.

## P9: the assistant

`web:lib/ai/tools.ts` keeps `TOOL_INPUTS` (zod), `DESCRIPTIONS` and `applyOp(files, op): EditResult`; a new mutating tool also joins `MUTATING_TOOLS` in `web:lib/ai/protocol.ts`. `runChange` rejects any change that adds parse errors.

```ts
add_slide:    z.strictObject({ folder: FOLDER, at: z.number().int().optional(), from: NAME.optional(), to: NAME.optional(), title: z.string().optional() }),
move_slides:  z.strictObject({ slides: z.array(z.number().int()), to: z.number().int() }),
remove_slides: z.strictObject({ slides: z.array(z.number().int()) }),
add_section:  z.strictObject({ title: z.string(), at: z.number().int().optional() }),
set_slide:    z.strictObject({ slide: z.number().int(), story: NAME.optional(), from: NAME.optional(), to: NAME.optional(), scene: NAME.optional(), title: z.string().optional(), skip: z.boolean().optional() }),
set_words:    z.strictObject({ story: NAME, step: z.number().int(), say: z.string().nullable().optional(), script: z.string().nullable().optional(), folder: FOLDER }),
```

`insertYaml` (`core:edit/insert.ts`) accepts no `stories` or `controls` today, which K8 already owes; `add_elements` needs `image` and `code` shapes and `parts`.

## Tests, by milestone

|     | Core (`packages/core/test`)                                                                                                                                           | App unit                                                                                  | Journeys (`apps/web/e2e/<area>.spec.ts`)                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| P0  | a story in a subfolder: cursor, picture, timeline; rename and delete follow into stories                                                                              | export of a nested folder's story                                                         | `nested`: a nested diagram opened as root plays its story                                                                       |
| P1  | `page` read, written, defaulted; `LayoutResult.page`; the off-page suggestion                                                                                         | `exportFrame` with a page; `fitBox` on a page                                             | `page`: editor frame, viewer fit, PNG is exactly 1920 × 1080                                                                    |
| P2  | `deck:` read and every message; `deckSlides`, stepping across slides and back, carrying on, `deckTimeline`, tokens, inheritance                                       | deep link with `slide`; chrome `"none"` renders nothing but the stage                     | `deck-player`: keys, the cut, carrying on, the overview, a link part-way, Record mode screenshot is the page and nothing else   |
| P3  | every command in `edit/deck.ts`, including split and join round-tripping                                                                                              | dashboard summary has `deck`                                                              | `deck-editor`: add, reorder, duplicate, detach, skip, delete, sections, "Start a new slide here" writes `to` and `from`         |
| P4  | pointer parse and format; `width` wrapping estimate; image size from a pointer                                                                                        | sanitiser accepts pointers and refuses unknown hashes; open and download round-trip bytes | `assets`: drop a PNG, save, reload, share link serves it; `text`: a wrapped paragraph                                           |
| P5  | `readCode` (slice, tabs, missing file); every tokeniser; parts read, every message; a part in a set, in focus, as a connection end; an element with parts and `opens` | `code-node` keeps indentation                                                             | `code`: a listing with a lit part; `parts`: draw a region on a picture, name it, focus it in a step                             |
| P6  | a beat starting on `script`; `speakingTime`                                                                                                                           | the channel keeps two windows in step                                                     | `script`: the Script window follows the deck                                                                                    |
| P7  | `voiceKey` (same words, same key; punctuation ignored); timeline with clips; even spacing                                                                             | recorder slicing with a fake stream; trim                                                 | `voice`: record two beats with a fake microphone (`--use-fake-device-for-media-stream`), change a word, see "out of date", keep |
| P8  |                                                                                                                                                                       | multi-page PDF has N pages; vtt and chapters text                                         | `deck-export`: PDF, zip, script; a 10-second deck exports a video whose duration matches the timeline to a frame                |

The fixture in `fixtures/terraform-course/` is written so that each milestone has something in it to play. `fixtures/diagnostics-today.txt` is what the parser says about it now: every line is about something this plan adds, so the file is a countdown.

## Security review items (`docs/security.md` §10)

- `microphone=(self)`: a new permission, used only on a person's own gesture in the Script window.
- A public route that serves bytes: by hash, only for hashes the shared diagram points at, with the stored media type from an allow-list, `nosniff`, and no HTML or SVG among the types (SVG stays sanitised text in `files`).
- Uploads: the server hashes what it receives; size limits per file and per owner; images are never decoded on the server.
- New text file types are inert: read as text, shown as text, never parsed or executed.
- The Script window's channel is same-origin and local.
- Video export writes to a file the person chooses and uploads nothing.
