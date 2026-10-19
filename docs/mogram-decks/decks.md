# Plan: decks (Mogram as the place a talk or a course is made)

Written 2026-10-09 from a design conversation with the owner. It follows the shape of `docs/plans/concept-platform.md` and is meant to be copied into `docs/plans/decks.md` in the Mogram repo. Three files go together:

| File                         | What                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `decks.md` (this)            | What a deck is, the tools it needs, the workflows, what won't be built, milestones, decisions                                            |
| `decks-file-format.md`       | The contract: every new key, its values, defaults and messages, written to drop into `docs/file-format.md`                               |
| `decks-build-notes.md`       | Where each change goes in the code, by symbol; storage, security headers, limits, tests                                                  |
| `fixtures/terraform-course/` | A small deck in the new format. It doesn't read today. Each milestone is done when the part of it that milestone carries plays correctly |

**What this was checked against.** The working tree on 2026-10-09 (K0 to K4 built and uncommitted, `docs/plans/concept-platform-status.md`). Facts about the code are from reading it, not from running it, except where a line says "checked". Line numbers are left out on purpose: the tree was changing as it was read. Symbols are the anchor.

## 1. What it's for

The first user is a one-hour course, "Terraform Crash Course for Absolute Beginners": about 58 slides, a build every 10 to 20 seconds, real code and real command output with lines lit, screenshots of a cloud portal, and a narrator. It is the acceptance test for this plan the way the ten reviewed concept plans are for the platform plan.

The test is the platform plan's: few tools, each general. **Nothing here may serve only decks.** A page helps a single diagram export cleanly. Parts are what a `card`'s fields were always going to be. An image and a code listing belong in any explanation. A script and a voice make any story a video.

What a deck made in Mogram does that a slide tool can't:

- **The diagram is alive and it stays.** Flows, states and the capacity model run on a slide as they do anywhere. The same diagram can come back six slides later and carry on from where it stopped, with no redraw.
- **Code, state and cloud in one picture.** A connection can run from a line of code to the resource it makes, and `focus` lights both.
- **A concept is a slide.** Every explainer in the catalogue is a slide that can be dropped into a deck.
- **The words live with the picture.** The caption, the spoken script and the recorded voice all belong to the beat. Subtitles, a chapter list and a script document fall out of the same file.
- **The deck is its own handout.** A share link is the same deck with captions on and "what if it were down" working.

## 2. What Mogram has, and the gap

Mogram has everything a slide's _content_ needs except two elements. It has no idea of a _sequence of diagrams_, and several assumptions stand in the way.

| Has                                                                      | Gap                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stories: beats, captions, presence, focus, zoom, rewind, choices, `when` | **A story plays only from the root folder.** `topDiagram(files)` is `parseCached(files, "")`, the viewer's `controller.top` is the root, and export uses `storyTimeline` only when `folder === ""`. `DiagramPreview` is the one exception |
| A camera that fits the diagram's contents                                | **No page.** Bounds are the union of elements. The viewer fits at no more than 1.1× and labels are 12 px, so a diagram fills about 60% of a 1920 px frame (checked by rendering)                                                          |
| Text, notes, labels, zones                                               | **Text doesn't wrap** (`decorationSize` takes the widest line; `layoutRich` is called with an infinite `maxWidth`)                                                                                                                        |
| SVG icons                                                                | **No raster image on the canvas.** Opened PNGs become `data:` strings in `files` and only card markdown draws them                                                                                                                        |
| Mono text                                                                | **No code element.** Whitespace collapses, one colour per element, no line can be lit                                                                                                                                                     |
| A `path → text` map per diagram, 2 MB a file, 5 MB a diagram             | **No binary storage.** Audio is dropped on open and refused by the server. Thirty screenshots already pass 5 MB                                                                                                                           |
| Present mode, arrow keys, links to a beat                                | **Chrome stays on screen** (story bar, key hint, leave button), and `Permissions-Policy: microphone=()` blocks recording                                                                                                                  |
| PNG, JPEG, SVG, one-page PDF, GIF, animated WebP capped at 1280 px       | **No multi-page PDF and no video.** "No MP4 export" and "No speaker or meeting notes" are written non-goals                                                                                                                               |
| Nested diagrams by `opens:`                                              | Nothing lists diagrams in an order                                                                                                                                                                                                        |

## 3. Principles

The platform plan's six stand (§3 there). Four more, for decks:

1. **A slide is a diagram on a page.** There is no second content system. A title, a listing, a screenshot and an icon are all elements.
2. **A deck adds order, not content.** It is a list. Everything shown lives in a diagram that could be opened on its own.
3. **One beat, one clip, no timeline.** A beat lasts as long as its recording. Anything that must land on a word starts its own beat. Nothing stores an offset.
4. **Words are the key.** A recording belongs to the words it reads, so it is found by them. Change the words and the recording is out of date; put them back and it returns.

## 4. The tools

Seven. Each is general.

| Tool       | Today                        | Becomes                                                                              |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| **Page**   | bounds of the contents       | a fixed frame any diagram can have                                                   |
| **Deck**   |                              | an ordered list of slides, in sections                                               |
| **Parts**  | (a `card`'s fields, planned) | named sub-areas of an element that a step can show, tone, mark, focus and connect to |
| **Image**  | SVG icons                    | a picture on the canvas, with parts                                                  |
| **Code**   | mono text                    | lines of text kept exactly, coloured, with parts                                     |
| **Words**  | `say`                        | + `script`, and a voice found by its words                                           |
| **Assets** | text files only              | binary files held by their hash                                                      |

Plus one small change: a text element can have a `width` and wrap.

### 4.1 Page

`page: 16:9` beside `theme:`. The page's top-left is the canvas origin. At 16:9 it is 240 × 135 cells, which is 1920 × 1080 px at zoom 1, so a 28 px title is 28 px in a 1080p video.

- With a page, the viewer, present mode, thumbnails and exports all frame **the page**, not the contents. Nothing is padded or letterboxed inside it.
- What sits outside the page is off stage: drawn dimmed in the editor, not drawn anywhere else.
- A diagram without a page behaves exactly as today.
- Sizes: `16:9` (240 × 135), `4:3` (180 × 135), `1:1` (135 × 135), `9:16` (135 × 240). The short side is always 1080 px.

### 4.2 Deck

A folder whose `mogram.yaml` has a `deck:` section is a deck, as a diagram with a `concept:` section is a concept.

```yaml
mogram: 1
name: Terraform Crash Course for Absolute Beginners
page: 16:9
theme: midnight
deck:
  frame: frame # ./frame, drawn under every slide
  captions: off # viewers don't see each beat's `say`
  slides:
    - section: What Terraform is
    - title: { frame: false } # ./title, its whole story, without the frame
    - before_terraform
    - terraform_flow: { to: applied } # an existing diagram, up to the step named "applied"
    - reading_a_plan
    - section: State and drift
    - terraform_flow: { from: applied } # the same diagram, carrying on
```

- **A slide** names a folder that holds a diagram. It plays that diagram's first story, or the one it names. A diagram with no story is a still slide.
- **A stretch.** `to:` and `from:` name a step (steps already have `name:` for rewind). `to: applied` plays through the beat that step is in. `from: applied` begins with the picture as it stood then.
- **Carrying on.** When two slides next to each other show the same diagram and the second begins where the first ended, there is no cut: it is one story with a slide boundary in it. When other slides come between, the diagram returns already in its `from` picture.
- **Sections** are entries in the same list. They group the rail, the overview and the chapter list.
- **Linked, not copied.** A slide points at the folder. Fix the diagram and every slide showing it is fixed. **Detach** copies the folder so one slide can differ.
- **Inherit.** A slide takes the deck's `page`, `theme`, `background`, `grid`, `styles` and `data` unless it sets its own (key by key for `styles` and `data`).
- **The frame** is one diagram drawn under every slide's own elements: a logo, the section name, a slide number. A slide entry can say `frame: false`.
- **Built-in values** join `%name%` and `%diagram%`: `%deck%`, `%section%`, `%slide%`, `%slides%`.
- **The deck's own file holds no elements.** Its canvas is not a slide.
- **A deck's slides are diagrams.** A deck is not a slide in another deck (courses made of several decks come later).

### 4.3 Parts

An element can name sub-areas of itself. A step can show, fade or hide a part, tone it and mark it; `focus` and `zoom` can name it; a connection can end on it.

```yaml
shapes:
  main_tf:
    shape: code
    file: code/main.tf
    parts:
      name: 2 # a line
      required: 2-6 # a range of lines
  portal:
    shape: image
    src: images/storage-basics.png
    parts:
      name_field: [0.36, 0.42, 0.50, 0.08] # x, y, w, h as fractions of the picture
connections:
  same_thing: { from: portal.name_field, to: main_tf.name }
stories:
  main:
    - say: The form tells you what Terraform will ask for.
      focus: [portal.name_field, main_tf.name]
    - set: { main_tf.name: { mark: warn, tone: amber } }
```

- A part is addressed `element.part`. The dot already means "a named thing on an element" for ports (`to: aks.web`).
- **An element with parts can't also open a nested diagram**, so a dotted name is never ambiguous.
- What a set can change on a part: `show`, `tone`, `mark`. Nothing else.
- `focus` on a part keeps it bright while the rest of its own element dims with everything else. On an image that is a spotlight.
- Kinds that take parts: `code` and `image` now, `card` when it is built (its fields are parts, which is why this is one idea and not three).

### 4.4 Image

`shape: image` with `src:`. It is a component drawn as a picture, so it nests, connects, carries presence and a card, and appears in sets like any shape.

- PNG, JPEG, WebP, GIF (first frame) and SVG (sanitised as icons are).
- `fit: contain | cover`, and the look keys a shape already has (`corner`, `stroke`, `shadow`, `opacity`).
- No label unless one is written. The label is the caption under it and its description for screen readers.
- Size from the layout; without one, 80 cells wide at the picture's own proportions.

### 4.5 Code

`shape: code`: lines of text kept exactly.

```yaml
shapes:
  plan:
    shape: code
    file: code/plan-rename.txt
    lines: 12-31
    language: plan
    title: terraform plan
    parts:
      replaced: 14-16
      summary: { lines: 31, show: hidden }
```

- `text:` inline or `file:` in the project; `lines:` shows a slice and keeps the file's own numbers.
- Spaces, indentation and blank lines are never touched. Lines don't wrap.
- `language:` colours it: `hcl`, `console` (commands and their output), `plan` (Terraform's `+`, `~`, `-`, `-/+`), `yaml`, `json`, `shell`, `diff`, or `plain`. The colours come from the theme. Small tokenisers in core, no highlighter dependency.
- A terminal session is a `code` element with `language: console`. Revealing it a part at a time is how a command "runs" on a slide. Nothing is typed out letter by letter.
- The `file:` is real output or real source in the project, so a slide can't drift from the code it shows.

### 4.6 Text that wraps

`width:` on a text element, in cells. It wraps at word boundaries and its height follows. A list is several text elements; put them in a container with `layout: column` (K3) and they need no positions. Each appears with `show`, as anything does.

### 4.7 Words

```yaml
- say: The plan is the difference.
  script: |
    So Terraform has read your file, and it has asked Azure what exists
    right now. And the plan is just the difference between those two
    things. Nothing has been touched yet.
  set: { plan: shown }
```

- **`say`** is the caption, as today: short, for someone watching without sound.
- **`script`** is what is spoken. A step with `say` or `script` starts a beat.
- **The voice** is a recording of the script. It is not written in the YAML. It is the file `voice/<key>.<ext>`, where the key is worked out from the script's words (lower-cased, punctuation dropped). So:
  - moving a beat, reordering slides or renaming anything never loses a recording;
  - changing a word makes the recording out of date, and the Script window says so;
  - undoing the change brings the recording back;
  - fixing a comma keeps it. Fixing a spelling doesn't, so there is a **Keep this recording** action that re-keys the clip.
- **Timing.** A beat with a clip lasts as long as the clip, plus a short tail. Its wordless steps are spaced evenly through the clip. A beat without a clip holds for the time its script takes to say, or its caption to read.

### 4.8 Assets

A picture or a recording is held by the hash of its bytes, outside the `files` map. In `files`, its path holds one line that points at it:

```
mogram-asset 1 sha256:9f2c…e1 image/png 482113 1920x1080
mogram-asset 1 sha256:77aa…0b audio/webm 81234 6.19s skip=0.21
```

- Core stays pure: a picture's proportions and a clip's length are read from that line, not from the bytes.
- A version in the history copies pointers, not megabytes.
- In a repository or a zip the path is the real file. Opening a folder turns bytes into assets; downloading turns pointers back into bytes.
- Small `data:` images that exist today keep working.

## 5. What the picture is

One definition, so the editor, the player, thumbnails and exports can't disagree.

**Where someone is in a deck** is a slide and a `Moment`:

```ts
interface DeckPosition {
  readonly slide: number;
  readonly moment: Moment;
}
```

**The picture of a slide** is laid over in this order: the frame's diagram → the slide's diagram → the steps on the path so far (starting from the `from` picture) → the scene the slide names → the viewer's own changes → what the model derives. Everything after the first item is `pictureAt` as it is today, given the slide's folder as its root.

**Stepping.** Forward plays the next beat of the slide's stretch. At the end of the stretch it moves to the next slide. Back does the reverse and lands on the previous slide's last beat.

**Between slides.** A different diagram: the 0.45 s cut that `rewind` uses. The same diagram carrying on: nothing.

**The deck's times** (what Play, the Script window's clock and exports follow):

- a slide's opening picture holds 0.6 s (a still slide holds 4 s);
- each beat is its clip, or its speaking time, as §4.7;
- a cut is 0.45 s;
- stepping by hand ignores all of it, as today.

**A link** opens a deck part-way: `?slide=12&beat=3`. `beat` counts within the slide's stretch.

## 6. Workflows and where they live

### Making a deck (editor)

**The dashboard** lists decks beside diagrams (a card shows the first slide and the slide count). **New** offers a diagram or a deck.

**A deck opens in the same editor**, with one addition: a **slide rail** down the left edge.

```
+--------+-----------+------------------------------+-----------+
| Slides | Library   |                              | Inspector |
| Deck   | (closed   |      +--- page 16:9 ---+     |  Element  |
| v Intro|  to a     |      |                 |     |  At this  |
|  1 [=] |  pill by  |      |  current slide  |     |   step    |
|  2 [=] |  default  |      |                 |     |  Slide    |
| v State|  in a     |      +-----------------+     |           |
|  3 [=] |  deck)    +------------------------------+           |
|  + Add |           | Story: Opening | 1 | 2 | 3   |           |
+--------+-----------+------------------------------+-----------+
```

- **A tile per slide**: its number, a thumbnail of its closing picture, its title, and a dot when a beat has no recording or an out-of-date one.
- **Sections** are headers: rename in place, collapse, drag a slide between them.
- **The Deck tile** at the top selects the deck itself: its name, page, theme, frame and captions in the inspector, and the frame on the canvas to edit.
- **Add** offers: a blank page; a template; a diagram already in this deck (linked); one of your other diagrams (brought in); a concept; images (one slide each); a code file.
- **On a tile**: duplicate, detach, skip, delete, and "show in its own window".
- **Selecting a slide** shows its diagram on the canvas inside the page frame. Everything else is the editor as it is: the library, the Story dock, the inspector.

**The Story dock** gains two things:

- **Start a new slide here**, on a beat. It names the step before (if it has no name) and splits the slide's entry into a `to:` and a `from:`. **Join with the slide before** undoes it. Nobody types a stretch.
- **The beat's words**: the caption field it has, and under it the script. Beside them, the recording's state (none, recorded, out of date) with play and record.

**The inspector** gains a **Slide** tab when nothing is selected (title, story, from, to, scene, frame on or off, skip), **Page** in the Canvas tab, and for a `code` or `image` element a **Parts** list. Parts are made on the canvas: drag down the gutter of a listing, or draw a rectangle on a picture, then name it. With a step showing, clicking a part offers what a step can do to it.

**New elements** are in the library's shapes (Image, Code). Dropping or pasting a picture onto the canvas adds an image; dropping a text file adds a code element.

### Recording (the Script window)

A second window that follows the deck: **Present ▾ → Script window**. It is the teleprompter now and the presenter view later.

> **Built ahead of the rest (2026-10-09, D-96 in `docs/decisions.md`).** The reading half exists: `script` on a step (with a field in the Story strip), a prompter for a draft, a saved diagram or any pasted script, following your voice with Chrome's on-device recogniser, and the viewer following the prompter. Recording, clips, the count-in and decks are still as planned below. Chrome gives no word times, so cutting a take by voice needs a second engine.

- The current beat's script, large. The next beat's, dimmed. The slide's number and title. A clock: elapsed, and what's left.
- **Record** starts a take at the beat showing. Reading on and pressing → ends that beat's clip and starts the next beat's. The deck advances as you speak, and the take is cut at every advance. ← discards the beat just recorded and starts it again.
- Each clip has its silence trimmed from both ends when it is saved (the trim is a number on the pointer; the file isn't re-encoded).
- A level meter, the microphone to use, and a three-second count-in.
- A beat's clip can be played back, recorded again, or kept after an edit to its words.

### Presenting and playing (viewer)

- **Present** is what it is today, with slides: → and Space step a beat and roll into the next slide, ← goes back, Shift+→ and Shift+← move a slide at a time, Home and End.
- **Record mode** (`?record=1`, or Present ▾ → Record mode) shows the page and nothing else: no story bar, key hint, leave button or pointer. Esc leaves.
- **Overview** (`G`): every slide as a thumbnail under its section. Click to go there.
- **Captions** (`C`) turns each beat's `say` on or off for this viewing. The deck's `captions:` is where a share link starts.
- **Play** runs the deck at its own times with the voice. In Record mode that is a deck that plays itself.

### Sharing

A share link to a deck opens the player. A viewer steps through, turns captions on, and can still poke a diagram ("what if it were down") where the deck allows viewer state. Assets are served by hash to anyone with the link.

### Exporting

From a deck, **Export** offers:

|               |                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **PDF**       | a page per slide (its closing picture), or a page per beat                                                                                    |
| **Images**    | PNG or JPEG per slide or per beat, zipped, in folders by section                                                                              |
| **Script**    | `script.md`: sections, slides, and each beat's caption and script. Beats with no recording are marked                                         |
| **Subtitles** | `.vtt`, from each beat's script and the deck's times                                                                                          |
| **Chapters**  | a text file of `0:00 Section title` lines, from the sections and the deck's times                                                             |
| **Video**     | the deck at its own times with the voice: 1920 × 1080 or 3840 × 2160 (the picture is vector, so 4K costs only time), 30 or 60 frames a second |

The video is made in the browser from the same frames every other export uses. It covers the deck. Camera footage is joined outside Mogram.

### The assistant

Tools to add, move and remove slides and sections, set a slide's stretch, and set a beat's caption and script, in the shape the existing tools have. They sit beside the story tools the platform plan already owes (K8).

## 7. What we won't build, and what it costs

- **A timeline.** No tracks, no clip offsets, no cue editor. A build that must land on a word starts its own beat. Cost: scripts are written a sentence to a build, which is how a build-per-sentence course is written anyway.
- **Slot layouts and masters.** No "title and content" layout with text that flows between boxes. A template is a starter diagram; a `column` arranges a list. Cost: a text-heavy slide takes longer to make than in a slide tool. That's the right pressure for this product.
- **Slide transitions.** One cut. No menu.
- **Letter-by-letter typing, scrolling code, wrapped code.** Code is revealed by parts.
- **A video element** in the first version. The export covers the deck; camera footage is joined outside. Later, a `video` shape with parts would let a clip be spotlit like a picture.
- **Editing audio.** Trim at both ends and nothing else: no noise removal, no levelling, no cutting inside a clip. Recording a beat again is the edit.
- **Live links between saved diagrams.** Inside one project a link is live. A diagram brought in from another saved diagram is a copy that remembers where it came from, with **Bring in the latest**. A live link across records would need an answer to "the deck is shared and the diagram is private".
- **Decks inside decks, and courses of decks.** Later.
- **Speaker notes apart from the script.** The script is the notes.

## 8. How it's built

`decks-build-notes.md` has the detail by symbol. In outline, core first, as always:

- **`format/`**: `page` and `deck` beside `concept`; `script` on a step; `width` on text; `image` and `code` shapes; `parts`. Each with plain-language messages.
- **`picture/`**: a beat starts on `say` or `script`; `deck.ts` for the position, stepping and the deck's times; voices in `storyTimeline`.
- **`layout/`**: the page box; sizes of images and code; the box of a part.
- **`code/`** (new): reading a listing and its slice; the tokenisers.
- **`assets/`** (new): the pointer line; the voice key.
- **`edit/`**: commands for slides, sections, stretches, parts, scripts.
- **The app**: the assumption that a story plays from the root goes first, because everything else stands on it. Then the page through the canvas, viewer and exports; the player; the rail; assets and the two elements; the Script window and recorder; the exports.
- **The server**: an asset table and two routes; the sanitiser learns pointers and code files; `microphone=(self)`.

**Milestones.** Each leaves Mogram shippable and is verified before the next. The course is the fixture.

- [x] **P0 Stories anywhere** (2026-10-09, D-97 in `docs/decisions.md`). The diagram that plays is a folder, not always the root. Renaming or deleting an element follows into stories (it doesn't today). No change for anyone using one diagram.
- [x] **P1 Page** (2026-10-09, D-98). The setting; the page in the layout, the editor, the viewer fit, thumbnails and exports.
- [x] **P2 Decks that play.** `deck:` read and checked; the position, stepping and times; the player with slides, the cut, carrying on, links, Record mode and the overview. A deck folder or zip opens and plays.
- [x] **P3 Decks you can build** (D-100; 12 authoring and 2 player browser journeys pass). The dashboard; the rail; add, reorder, duplicate, detach, skip, delete; sections; the Slide tab; "Start a new slide here"; the frame; templates.
- [x] **P4 Assets, images and wrapping text** (2026-10-10, D-101, D-102). The asset store in drafts, the cloud and zips; `shape: image`; parts on a picture; `width` on text and text in a `column`.
- [x] **P5 Code** (2026-10-10, D-103, D-104). `shape: code`, its sources, slice, tokenisers and parts; code files in a project.
- [x] **P6 Words** (2026-10-10, D-105). `script`; the Script window following a deck; holds from speaking time; the script export.
- [x] **P7 Voice** (2026-10-10, D-105). The microphone; the recorder with its cut on every advance; clips found by their words; out of date and keep; Play with sound; subtitles and chapters.
- [x] **P8 Deck exports** (2026-10-10, D-106). PDF and images for a whole deck; video (WebM, VP9 and Opus, made in the browser).
- [x] **P9 Round out** (2026-10-10, D-107). The assistant's deck tools; share-link polish; the presenter view (the Script window: this beat, the next, the slide, the clock). The `video` shape and courses stay out, as §7 says.

What the course needs, by how it gets made: narrated live over the deck, through P5. Recorded a beat at a time and captured as it plays itself, through P7. Rendered, through P8.

## 9. Decisions this records

For `docs/decisions.md`, continuing from D-88.

- **D-89 · A slide is a diagram on a page, and a deck is a list of them.** No second content system, no slots, no masters. Order lives in the deck; everything shown lives in a diagram. The same diagram can be shown on many slides and carries on in place. Rejected: one canvas of frames (one file and one namespace for a whole course); a diagram of diagrams (order hidden in a story).
- **D-90 · A page is a setting on any diagram.** Fixed proportions, 1080 px on the short side, origin at its corner. The viewer, thumbnails and exports frame the page.
- **D-91 · Parts.** One mechanism for a listing's lines, a picture's regions and a card's fields: named, addressed `element.part`, changed only by `show`, `tone` and `mark`, usable in `focus`, `zoom` and connection ends. An element with parts can't open a nested diagram.
- **D-92 · Binary files are held by their hash.** A one-line pointer in `files`, the bytes elsewhere. Core reads sizes and lengths from the pointer and stays pure.
- **D-93 · A beat has a caption, a script and a voice, and the voice is found by its words.** This reverses the PRD's "No speaker or meeting notes in tours". One beat, one clip, no stored offsets, which keeps "No video style timeline".
- **D-94 · Video export.** This reverses the PRD's "No MP4 export". The reason it was refused (the share link is the richer experience) still holds for diagrams; a narrated deck is a video, and every frame is already a pure function of time.
- **D-95 · The page, text width and code are not deck features.** Each stands on its own for single diagrams and concepts.

## 10. Requirements

Rows for `docs/requirements.md`, in its format. New prefixes: **PG** (pages), **DK** (decks), **PA** (parts), **ME** (media elements), **WO** (words and voice), **VX** (deck and video export).

| ID    | Requirement                                                                                                        | Status | Evidence                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------- |
| PG-1  | A diagram can have a page (16:9, 4:3, 1:1, 9:16) with its corner at the origin                                     | ☑      | core page tests; `page.spec.ts`                                  |
| PG-2  | With a page, the viewer, present mode, thumbnails and exports frame the page; what's outside isn't drawn           | ☑      | `page.spec.ts`, `deck-export.spec.ts`                            |
| PG-3  | The editor draws the page, dims what's off stage and snaps to its edges and centre                                 | ☑      | `page.spec.ts`                                                   |
| DK-1  | A folder whose settings have `deck:` is a deck: slides in order, in sections                                       | ☑      | `test/deck.test.ts`                                              |
| DK-2  | A slide shows a diagram and plays its story, or a stretch of it between named steps                                | ☑      | `test/deck.test.ts`; `deck-player.spec.ts`                       |
| DK-3  | The same diagram on neighbouring slides carries on with no cut; elsewhere a slide change is one cut                | ☑      | `deck-player.spec.ts` (carried viewer stays mounted)             |
| DK-4  | Slides inherit the deck's page, theme, background, grid, styles and data; one frame diagram sits under every slide | ☑      | `test/deck.test.ts`; `deck-player.spec.ts` (frame footer)        |
| DK-5  | `%deck%`, `%section%`, `%slide%`, `%slides%` in any label                                                          | ☑      | `deck-player.spec.ts` (`%slide% / %slides%`)                     |
| DK-6  | A story plays in any folder, not only the root                                                                     | ☑      | P0, D-97                                                         |
| DK-7  | The player: beats then slides, back, slide jumps, overview, captions on or off, links to a slide and beat          | ☑      | `deck-player.spec.ts`                                            |
| DK-8  | Record mode shows the page and nothing else                                                                        | ☑      | `deck-player.spec.ts` (record from the button, across cuts, Esc) |
| DK-9  | The dashboard lists decks and makes new ones                                                                       | ☑      | `deck-editor.spec.ts`                                            |
| DK-10 | The slide rail: tiles, sections, add, reorder, duplicate, detach, skip, delete                                     | ☑      | `deck-editor.spec.ts`                                            |
| DK-11 | "Start a new slide here" and "Join with the slide before" on a beat                                                | ☑      | `deck-editor.spec.ts`                                            |
| DK-12 | A diagram added from the same project is linked; one from elsewhere is brought in and remembers its origin         | ☑      | `deck-editor.spec.ts`; `test/deck-edit.test.ts`                  |
| PA-1  | An element can name parts; a set can show, fade, hide, tone and mark one                                           | ☑      | `test/media.test.ts`; `media.spec.ts`                            |
| PA-2  | `focus`, `zoom` and connection ends can name a part                                                                | ☑      | `media.spec.ts` (focus and zoom on lines)                        |
| PA-3  | Parts are made and named on the canvas                                                                             | ☑      | `media.spec.ts` (draw a region)                                  |
| ME-1  | `shape: image`: PNG, JPEG, WebP, GIF, SVG; fit; the shape's look; parts as regions                                 | ☑      | `media.spec.ts`                                                  |
| ME-2  | `shape: code`: inline or from a file, a slice, exact whitespace, a header, line numbers, parts as lines            | ☑      | `media.spec.ts`; `test/code.test.ts`                             |
| ME-3  | Code is coloured for hcl, console, plan, yaml, json, shell and diff from the theme                                 | ☑      | `test/code.test.ts`                                              |
| ME-4  | Text with a `width` wraps; text in a `column` is arranged by it                                                    | ☑      | `media.spec.ts`                                                  |
| ME-5  | Binary files are stored by hash in drafts, the cloud and zips, and served to share links                           | ☑      | `features/assets/assets.test.ts`; `media.spec.ts` (cloud share)  |
| WO-1  | A step has `script`; a step with `say` or `script` starts a beat                                                   | ☑      | `test/words.test.ts`                                             |
| WO-2  | The Script window follows the deck: this beat's script, the next, the clock                                        | ☑      | `script-window.spec.ts`                                          |
| WO-3  | Recording cuts a take at every advance; back records the beat again; silence is trimmed                            | ☑      | `script-window.spec.ts`; `recorder.ts` (`voiceSpan`)             |
| WO-4  | A recording is found by its words; a changed script shows it out of date; it can be kept                           | ☑      | `test/words.test.ts`; `script-window.spec.ts`                    |
| WO-5  | A beat lasts as long as its clip; without one, as long as its script takes to say                                  | ☑      | `test/words.test.ts`; `controller.ts`                            |
| WO-6  | Play runs the deck with its voice                                                                                  | ☑      | `controller.ts` (VoicePlayer)                                    |
| VX-1  | A deck exports as a PDF and as images, a page per slide or per beat                                                | ☑      | `deck-export.spec.ts`                                            |
| VX-2  | A deck exports its script, subtitles and chapters                                                                  | ☑      | `deck-export.spec.ts`; `test/words.test.ts`                      |
| VX-3  | A deck exports as video with its voice at 1080p or 2160p, in the browser                                           | ☑      | `deck-export.spec.ts` (plays in Chrome); `webm-mux.test.ts`      |
| AI-12 | The assistant can add, move and remove slides and set a beat's caption and script                                  | ☑      | `lib/ai/tools.test.ts`                                           |

## 11. What changed from the conversation, and what's open

Four places where this plan differs from what was sketched while talking, each for a reason found in the code:

1. **The voice has no key in the YAML.** The sketch showed `voice: voice/flow-plan.m4a` on a step. A clip found by its words needs no line, can't point at the wrong file, and survives every reorder. The decision it serves (one beat, one clip, no timeline) is unchanged.
2. **"Linked" is live inside a project and a remembered copy across saved diagrams.** Nothing in Mogram refers from one saved diagram to another today, and a live link across them raises a sharing question this plan doesn't answer.
3. **The rail sits beside the library panel, not in place of it.** The editor's left edge already holds Library, Concepts and Assistant in a 288 px panel. In a deck that panel starts closed.
4. **The frame can be switched off per slide** (`frame: false`), because a title slide wants it gone.

Open, for the owner:

- **The dot in `element.part`.** `docs/plans/concept-platform-status.md` chose `<copy>_<child>` for container copies to keep dots meaning "nested". Parts are safe (an element with parts can't open anything, and a dotted target whose head opens nothing is an error today), but `split()` in `state/resolve.ts` and `splitTarget` in the viewer both need to learn it. If that is unwelcome, `element/part` is the alternative.
- **Where assets live in production.** A table of bytes is simplest and fine at this scale; object storage is the usual answer later. The pointer format doesn't care.
- **Codecs.** H.264 with AAC in MP4 where the browser's encoder supports it, VP9 with Opus in WebM otherwise. Not checked on the owner's machine.
- **How fast video export is.** A frame today is rendered to an SVG string, decoded as an image and drawn to a canvas. Reusing the last frame while nothing moves makes text and code slides nearly free; slides with flows are the cost. Measure before promising a time.
- **The story check for decks.** The catalogue's check (at most 12 beats, captions under 150 characters) is right for a concept and wrong for a course slide. A deck needs its own: every slide's folder exists, every stretch is in order, no beat is over about 25 seconds, no chapter is under 10.
