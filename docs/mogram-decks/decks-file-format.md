# Decks: the file format additions

> Merged into `docs/file-format.md` on 2026-10-10, corrected to what was built (code file extensions, the voice key and its `.txt`, a 0.4 s tail). That file is the canonical spec; this one is the record of the proposal.

The contract for `decks.md`, written so each section can be dropped into `docs/file-format.md`. Where it says "message", the wording follows the existing ones: plain words, names in double quotes, what was seen, then what happens.

Nothing here changes how a file that is valid today is read.

## Files

A deck is a folder. Additions to the table of files:

| File                                 | Purpose                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| `mogram.yaml` with a `deck:` section | Makes the folder a deck and holds its settings and slide list |
| `<slide>/mogram.yaml`                | A slide's diagram (any folder in the project can be a slide)  |
| `images/*`                           | Pictures: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`    |
| `code/*`                             | Listings and output, as plain text                            |
| `voice/*`                            | Recordings, named by Mogram                                   |

**Code files.** These extensions are read as text, anywhere in a project, up to 200 KB each: `.tf`, `.tfvars`, `.hcl`, `.sh`, `.bash`, `.ps1`, `.json`, `.toml`, `.ini`, `.cfg`, `.py`, `.go`, `.js`, `.ts`, `.tsx`, `.sql`, `.dockerfile`, `.txt`, `.log`, `.out`. They are never run and never parsed as Mogram files.

**Binary files.** A picture or a recording is stored by the hash of its bytes. In the project's files its path holds one line:

```
mogram-asset 1 sha256:<64 hex> <media type> <bytes>[ <width>x<height>][ <seconds>s][ skip=<seconds>]
```

```
mogram-asset 1 sha256:9f2c…e1 image/png 482113 1920x1080
mogram-asset 1 sha256:77aa…0b audio/webm 81234 6.19s skip=0.21
```

- `<width>x<height>` is a picture's size in pixels. `<seconds>s` is how much of a recording plays; `skip=` is how far in it starts (the silence trimmed from the front).
- In a repository or a zip the path is the file itself. Mogram writes the pointer when it opens the folder and the bytes when it downloads it.
- A picture written as a `data:` URL, as today, is still read.

Media types accepted: `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/wav`, `audio/ogg`.

## Settings

Two more, in `mogram.yaml` or the single file:

```yaml
page: 16:9 # a fixed frame (default: none)
deck: { … } # makes the folder a deck (see Decks)
```

### Page

| Value            | Cells                  | Pixels at 100% |
| ---------------- | ---------------------- | -------------- |
| `none` (default) | the diagram's contents |                |
| `16:9`           | 240 × 135              | 1920 × 1080    |
| `4:3`            | 180 × 135              | 1440 × 1080    |
| `1:1`            | 135 × 135              | 1080 × 1080    |
| `9:16`           | 135 × 240              | 1080 × 1920    |

The page's top-left corner is `[0, 0]`. Positions are in cells from there, as always.

With a page:

- the viewer and present mode fit the page to the screen, at any zoom that takes;
- an export's area is the page, with no padding (the other areas are still offered);
- a thumbnail shows the page;
- what lies outside the page is off stage: the editor draws it dimmed, and nothing else draws it.

Messages:

- `"page" should be 16:9, 4:3, 1:1, 9:16 or none.` (error; the diagram is read without a page)
- Suggestion: `"title" sits outside the page, so nobody watching will see it.`

## Decks

```yaml
mogram: 1
name: Terraform Crash Course for Absolute Beginners
page: 16:9
theme: midnight
deck:
  frame: frame
  captions: off
  slides:
    - section: What Terraform is
    - title: { frame: false }
    - before_terraform
    - terraform_flow: { to: applied }
    - reading_a_plan: { title: What is Terraform about to do? }
    - section: State and drift
    - terraform_flow: { from: applied }
    - drift: { scene: tag_added }
```

| Key        | Values                                                                     | Default |
| ---------- | -------------------------------------------------------------------------- | ------- |
| `frame`    | A folder whose diagram is drawn under every slide                          | none    |
| `captions` | `on`, `off`: whether someone watching sees each beat's `say` to begin with | `on`    |
| `slides`   | The list, in order                                                         |         |

**An entry in `slides`** is one of:

- `- section: <title>`: a section starts here.
- `- <folder>`: a slide showing that folder's diagram and playing its first story.
- `- <folder>: { … }`: the same, with keys.

| Key     | Means                                                                                | Default            |
| ------- | ------------------------------------------------------------------------------------ | ------------------ |
| `story` | Which of the diagram's stories it plays                                              | the first          |
| `from`  | A step's `name`: begin with the picture as it stood once that step's beat had played | the story's start  |
| `to`    | A step's `name`: stop once that step's beat has played                               | the story's end    |
| `scene` | A scene laid over it throughout                                                      | none               |
| `title` | What the rail, the overview and exports call it                                      | the diagram's name |
| `frame` | `false`: this slide is drawn without the deck's frame                                | `true`             |
| `skip`  | `true`: kept in the file, not shown or counted                                       | `false`            |

- A folder is written relative to the deck's folder (`title`, `./title`, `../shared/checkout`) and must stay inside the project.
- The same folder can appear on several slides. When two next to each other show the same folder and story and the second's `from` is the first's `to`, the story carries on with no cut.
- A diagram with no story is a still slide.
- Slides are counted from 1, skipping the skipped. Sections aren't counted.
- A deck's own file holds settings, `styles:` and `deck:` only.
- Up to 400 slides.

**What a slide takes from the deck.** `page`, `theme`, `background` and `grid` unless it sets its own. `styles` and `data` are merged key by key, the slide's own winning.

**Built-in values**, for any label on a slide or in the frame, beside `%name%`, `%type%`, `%diagram%` and `%date%`:

| Token       | Shows                                   |
| ----------- | --------------------------------------- |
| `%deck%`    | The deck's name                         |
| `%section%` | The section the slide is in, or nothing |
| `%slide%`   | The slide's number                      |
| `%slides%`  | How many slides there are               |

A `data:` value of the same name wins, as with the other built-ins.

**Stories and scenes belong to the slide's diagram.** In a deck, each slide's diagram is "the top diagram, the one people open": its `stories:` play and its `scenes:` apply, and they reach into diagrams it opens by path. (Outside a deck this is unchanged.)

Messages:

- `Slide 3 is "terraform_flo", but no folder with that name holds a diagram. Did you mean "terraform_flow"?` (error; the slide is left out)
- `Slide 3 is "../../elsewhere", which is outside the project.` (error)
- `Slide 4 is "lesson_2", which is a deck. A deck's slides are diagrams.` (error)
- `Slide 3 plays "terraform_flow" from "aplied", but its story "main" has no step with that name. Did you mean "applied"?` (error; the slide plays the whole story)
- `Slide 5 stops at "applied", which comes before "drift", where it starts.` (error; the slide plays from "drift" to the end)
- `Slide 6 names the story "rollback", but "terraform_flow" has no story with that name.` (error)
- `"frame" is "frme", but no folder with that name holds a diagram.` (error; no frame)
- `"captions" should be on or off.`
- `"box" is an element in a deck's own file. A deck's file holds its settings and its slides; put "box" on a slide or in the frame.` (warning; ignored)
- `The deck has no slides yet.` (warning)
- `"deck" belongs in mogram.yaml. Mogram ignores it in slides.mogram.yaml.` (warning, as for other settings)

A link can open a deck part-way: `?slide=12&beat=3`. `beat` counts within the slide's stretch.

## Shapes: image and code

Two more values for `shape:`.

### Image

```yaml
shapes:
  portal:
    shape: image
    src: images/storage-basics.png
    fit: contain
    corner: 10
    shadow: true
    parts:
      name_field: [0.36, 0.42, 0.50, 0.08]
      region: { area: [0.36, 0.60, 0.50, 0.08], show: hidden }
layout:
  portal: { at: [8, 22], size: [104, 72] }
```

| Key                                                   | Values (default first)                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src`                                                 | A picture in the project (required): `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`         |
| `fit`                                                 | `contain`, `cover`                                                                            |
| `corner`                                              | 8, or a radius in px                                                                          |
| `stroke`, `stroke_width`, `dash`, `shadow`, `opacity` | as for any shape (`stroke` defaults to `none`)                                                |
| `label`                                               | none. When written it is the caption under the picture and its description for screen readers |
| `parts`                                               | see Parts                                                                                     |

- Without a size in the layout it is 80 cells wide at the picture's own proportions (16:9 when they aren't known).
- It takes every component key (`in`, `show`, `card`, `link`, `data`, `mark`). It has no `tone`, `fill` or typography keys, and no `state` or `motion`.
- A GIF shows its first frame. An SVG is cleaned as an uploaded icon is.

Messages:

- `"portal" shows "images/portl.png", but there is no such file. Did you mean "images/portal.png"?` (error; drawn as a missing picture)
- `"portal" shows "notes.md", which isn't a picture Mogram can show. Use PNG, JPEG, WebP, GIF or SVG.`
- `"portal" is an image, so it needs "src", like src: images/portal.png.`
- `"fit" should be contain or cover.`

### Code

```yaml
shapes:
  main_tf:
    shape: code
    file: code/main.tf
    lines: 1-7
    language: hcl
    title: main.tf
    numbers: true
    font_size: 22
    parts:
      name: 2
      required: 2-6
  plan:
    shape: code
    language: plan
    title: none
    text: |
      # azurerm_storage_account.storage must be replaced
      -/+ resource "azurerm_storage_account" "storage" {
            ~ name = "tfcoursedeveusabc12st" -> "tfdemodeveusabc12st" # forces replacement
          }

      Plan: 9 to add, 0 to change, 9 to destroy.
    parts:
      block: 1-4
      summary: { lines: 6, show: hidden }
```

| Key                                                             | Values (default first)                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `text` or `file`                                                | The lines, written in place with `                                                                                 | `, or a text file in the project. Exactly one of the two |
| `lines`                                                         | All of it, or a slice like `12-31`. Line numbers stay the file's own                                               |
| `language`                                                      | From the file's extension, else `plain`. One of `hcl`, `console`, `plan`, `yaml`, `json`, `shell`, `diff`, `plain` |
| `title`                                                         | The file's name (nothing for `text:`), or words for the header, or `none` for no header                            |
| `numbers`                                                       | `false`, `true`: line numbers down the left                                                                        |
| `font_size`                                                     | 20, or 10–64 (px). The font is always the mono one                                                                 |
| `fill`, `stroke`, `stroke_width`, `corner`, `shadow`, `opacity` | as for any shape; the fill and stroke default to the theme's code panel                                            |
| `parts`                                                         | see Parts                                                                                                          |

- Every space, tab (shown as two spaces) and blank line is kept. Lines never wrap.
- Without a size in the layout it fits its text. With one, a line too long for it is cut with `…` and a suggestion says which.
- It takes `in`, `show`, `card`, `link`, `data` and `mark`. It has no `label`, `tone`, `state` or `motion`.

**Languages.**

| `language`              | Coloured as                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hcl`                   | block types, labels, attribute names, strings, numbers, comments                                                                                                                           |
| `console`               | a line starting `$ ` or `> ` is a command; the rest is its output. Colour codes in captured output are dropped                                                                             |
| `plan`                  | Terraform's plan: a line whose first mark is `+` is added, `-` removed, `~` changed, `-/+` or `+/-` replaced, `<=` read; `#` lines are comments; `Plan:` and `No changes.` are the summary |
| `yaml`, `json`, `shell` | keys, strings, numbers, comments, commands                                                                                                                                                 |
| `diff`                  | `+` and `-` lines                                                                                                                                                                          |
| `plain`                 | one colour                                                                                                                                                                                 |

Extensions: `.tf`, `.tfvars`, `.hcl` are `hcl`; `.yaml`, `.yml` are `yaml`; `.json` is `json`; `.sh`, `.bash` are `shell`; `.diff`, `.patch` are `diff`; everything else is `plain`. `console` and `plan` are always written.

Messages:

- `"main_tf" is code, so it needs "text" or "file", like file: code/main.tf.`
- `"main_tf" has both "text" and "file". Use one.`
- `"main_tf" shows "code/mian.tf", but there is no such file. Did you mean "code/main.tf"?`
- `"main_tf" shows lines 12-31 of "code/plan.txt", which has 20 lines.` (warning; shows what there is)
- `"lines" should be a line or a range, like 12 or 12-31.`
- `"language" is "terraform", which isn't one Mogram colours, so it is shown plain. Did you mean "hcl"?` (warning)
- Suggestion: `Line 14 of "plan" is wider than the element at this size, so its end is cut.`

## Parts

An element can name sub-areas of itself. Today that is `image` and `code`.

```yaml
parts:
  name: 2 # code: a line
  required: 2-6 # code: a range of lines
  summary: { lines: 31, show: hidden } # the long form, with how it starts
  name_field: [0.36, 0.42, 0.50, 0.08] # image: x, y, w, h, each 0–1 of the picture
  region: { area: [0.36, 0.60, 0.50, 0.08], show: faded }
```

| On      | Short form                     | Long form keys                  |
| ------- | ------------------------------ | ------------------------------- |
| `code`  | a line number, or `first-last` | `lines`, `show`, `tone`, `mark` |
| `image` | `[x, y, w, h]`                 | `area`, `show`, `tone`, `mark`  |

- A part's name follows the rules for any name and is unique within its element. Up to 64 parts an element.
- Parts can overlap.
- A code part's lines are the file's own numbers, whatever slice is shown.
- **A part is addressed `element.part`**: in a scene or a step's `set`, in `focus`, in `zoom`, and as an end of a connection.

```yaml
connections:
  same_thing: { from: portal.name_field, to: main_tf.name }
scenes:
  reviewed:
    main_tf.required: { mark: check }
stories:
  main:
    - say: The form tells you what Terraform will ask for.
      focus: [portal.name_field, main_tf.name]
    - set:
        plan.summary: shown
        main_tf.name: { tone: amber, mark: warn }
      zoom: plan.summary
```

**What a set can change on a part**

| Key    | Means                                                                   |
| ------ | ----------------------------------------------------------------------- |
| `show` | `shown`, `faded` or `hidden`. One word is enough: `plan.summary: shown` |
| `tone` | A wash of that colour behind the lines, or an outline round the region  |
| `mark` | A sign at the start of the first line, or at the region's corner        |

- `focus` on a part keeps it bright. The rest of its element dims along with everything else that isn't in focus.
- `zoom` on a part frames it.
- A connection that ends on a part attaches to the part's box.
- Hiding an element hides its parts. A hidden code part leaves its lines blank, so nothing below it moves.

**An element with parts can't open a nested diagram**, so `a.b` is a part when `a` has parts and a path into a nested diagram when `a` opens one.

Messages:

- `"main_tf" has parts, so it can't also open a nested diagram.` (error; `opens` is ignored)
- `In story "main", "main_tf.nam" names a part of "main_tf" that isn't there. Did you mean "name"?` (error; the line is ignored)
- `In scene "reviewed", "web.name" points inside "web", but "web" has no parts and doesn't open a nested diagram.` (replaces today's message for this case)
- `Part "summary" of "plan" is line 40, but "code/plan.txt" has 31 lines.` (warning)
- `Part "name_field" of "portal" should be four numbers from 0 to 1: x, y, width, height.`
- `A part can change "show", "tone" and "mark". "label" is ignored on "main_tf.name".` (warning)
- `Connection "same_thing" ends on "portal.nme_field", but "portal" has no part with that name.`

## Text and sticky notes

One more key for free text (`text:`):

| Key     | Values        | Default                           |
| ------- | ------------- | --------------------------------- |
| `width` | 4–240 (cells) | none: as wide as its longest line |

With a `width` the text wraps at spaces to fit, and its height follows. `align` works within the width.

A text element whose `in:` is a container that arranges its contents (`layout: column`, `row` or `grid`) is placed by it like any other child, and needs no `at`.

Messages:

- `"width" only applies to text, so it is ignored on "follow_ups".` (warning; notes and zones have `size`)
- `"width" should be a number of cells from 4 to 240.`

## Stories: script and voice

One more key on a step:

| Key      | Means                          |
| -------- | ------------------------------ |
| `script` | What is spoken. Written with ` | ` for several lines. Up to 4,000 characters |

- **A step with `say` or `script` starts a beat.** Steps after it with neither belong to that beat, as before.
- `say` is still the caption. A beat with only a `script` shows no caption.
- A step that is only a `script` (no `set`) is a step that only says something, as a caption on its own is today.

```yaml
stories:
  main:
    - say: The plan is the difference.
      script: |
        So Terraform has read your file, and it has asked Azure what exists
        right now. And the plan is just the difference between those two
        things. Nothing has been touched yet.
      set: { plan: shown }
    - script: Read that line again. Two to add, nothing to change, nothing to destroy.
      focus: [plan.summary]
```

**The voice** is not written in the YAML. A beat's recording is the file

```
voice/<key>.<ext>
```

in the diagram's project, where `<key>` is 16 characters worked out from the beat's `script` (or its `say` when it has no script): the words lower-cased, everything that isn't a letter or a digit dropped, single spaces between words. The same words give the same key anywhere.

- Mogram writes these files when a beat is recorded. Nobody names them.
- Changing a word changes the key: the old recording is no longer this beat's, and the beat is shown as needing one. Changing the words back finds it again.
- Punctuation and capitals don't change the key.
- A recording whose words are no longer in any story is kept until it is cleared out by hand ("Remove recordings nothing uses").

**Timing** (what Play and exports follow; stepping by hand ignores it, as now):

| A beat                           | Lasts                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| with a recording                 | the recording, then 0.35 s. Its first change starts with it; its wordless steps are spaced evenly through it |
| with a `script` and no recording | 0.4 s, then about 3.2 words a second                                                                         |
| with only `say`                  | the reading time, as today                                                                                   |

`hold:` on a beat's last step adds to a recording and replaces the other two. `pace: slow` works as now.

In a deck: a slide's opening picture holds 0.6 s; a still slide holds 4 s; a cut between slides takes 0.45 s; slides that carry on have neither.

Messages:

- `"script" in story "main" is longer than 4,000 characters. Split it into beats.`
- Suggestion: `Beat 4 of "main" takes about 40 seconds to say. Beats under 25 seconds are easier to record and to follow.`

## Validation

Added to what Suggestions review (advice, never errors):

- something that sits outside the page;
- a slide whose folder is shown nowhere else and has no elements;
- stretches of one diagram that overlap, or leave beats no slide plays;
- a code line cut off at its element's size;
- a beat over about 25 seconds;
- a section that would be a chapter shorter than 10 seconds.
