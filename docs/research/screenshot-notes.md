# Screenshot analysis — raw notes

Every screenshot in `/screenshots` was reviewed in capture order. File numbers below
map to capture time (01 = 3.18.15 PM … 80 = 3.27.27 PM). Each entry records what the
screenshot shows, what we noticed, and how Mogram should implement it.

## Cloudairy (competitor) — board editor

### 01 · Board editor, default state

- **Shows:** AWS Disaster Recovery template on a light dot-grid canvas at 47%.
- **Chrome is floating cards, not docked bars.** Top-left card: logo, board title, hamburger.
  Top-right card: avatar, play (present), copy-link, primary "Share" button. Right edge:
  vertical icon rail (comments, details, background, history, download, search, present,
  record, timer, reactions, connector style). Bottom-centre: creation toolbar with letter
  shortcuts printed above each tool (D pen, S sticky, A arrow, T text, F frame) plus shapes,
  templates, diagram, image, "+". Bottom-left: map toggle, zoom −/47%/+, undo, redo, fit.
  Bottom-right: AI button.
- **Diagram:** nested containers (AWS Cloud → region flag → VPC orange → AZ dashed blue →
  subnet green tiles with lock badge). Icons ~32px with 2-line labels underneath.
  Orthogonal connectors with small junction dots. Sticky-note legend at right.
- **Mogram:** adopt the floating-card chrome (more canvas, feels modern). Shortcut letters
  in toolbar teach keys. Container styles per type (region/vnet/subnet) as presets — exactly
  the PRD "container style" preset family. Orthogonal routing for connections.

### 02 · Comments panel

- Right rail item opens a 300px side sheet "Comments" with filter + close. Empty state:
  icon tile, "No comment yet", helper copy. Minimap appears bottom-right when a panel opens.
- **Mogram:** PRD explicitly says comments create noise; we use _cards_ instead. Borrow the
  side-sheet pattern + empty-state structure (icon, title, one-line helper) for Cards/Tours/
  Scenes panels. Minimap: include as a toggle.

### 03 · Details panel

- Owner, contributors, creator, created date, labels. Dark tooltip "Board details" pointing
  left from the rail icon.
- **Mogram:** Diagram "Info" panel: owner, created/updated, file path(s), visibility.
  Tooltips on every icon-only button (dark pill, 12px, 6px radius).

### 04 · Background popover

- "Background Color" swatches (white, lavender — selected with ring, light gray, black,
  light blue, periwinkle, blush, mint, lilac, peach), "Custom Color" (+), "Grid: None | Dot grid"
  segmented control.
- **Mogram:** Canvas theme preset picker = swatches + gradients (PRD: solid colours AND
  gradients, light AND dark) + custom colour + grid toggle (hidden by default per PRD).

### 05 · Version history

- Grouped by day ("Today"), "Current version" row highlighted with ⋯ menu, entries with
  time + author avatar.
- **Mogram:** Cloud diagrams keep revisions on save (share link always shows latest — PRD).
  Version list + preview + restore is a cheap trust win.

### 06 · Version preview modal

- Modal "Preview 03:16 PM (id)", rendered read-only snapshot on a grey well, Cancel / Restore.
- **Mogram:** revision preview renders the read-only viewer of that YAML; Restore creates a
  new revision (never destructive).

### 07 · Download menu

- PNG, JPG, SVG, PDF, "Cloudairy Backup", Google Drive, OneDrive.
- **Mogram:** PNG, JPEG, SVG always; GIF + animated WebP only when the diagram animates
  (PRD table). Plus "Download .mogram.yaml" / folder zip as the "backup".

### 08 · Export bar

- Export replaces the chrome with a top bar: File name* (required), Selected area, Quality,
  Remove watermark, Cancel, Download.
- **Mogram:** export dialog with file name, format, area/crop, scale (1x/2x/3x),
  transparent background (PNG), and for animated: loop-current-scene vs play-all-scenes,
  duration. Live preview.

### 09 · Selected area options

- All areas, Square 1:1, Portrait 3:4, Landscape 4:3, Wide 16:9, Custom W×H — each with an
  aspect glyph.
- **Mogram:** aspect presets for social posts (educators persona). Fit diagram into the frame
  with padding.

### 10 · Find / Replace

- Popover with tabs Find | Replace, search field.
- **Mogram:** "Find element" (⌘F) — jump camera to an element by name/type. Replace not needed.

### 11 · Present / recording mode

- All chrome hidden; tiny left rail (frame, sticky, pen, comment); bottom pill: timer,
  invite, red "Stop".
- **Mogram:** Present mode (PRD): fullscreen, chrome hidden, keyboard-driven, minimal
  bottom pill with tour step / scene controls + Exit.

### 12 · Timer widget

- Floating card with arc gauge "05:00", play/stop/+1 min. Tooltip "Timer".
- **Mogram:** out of scope (meeting notes are a PRD non-goal).

### 13 · Reactions popover

- Emoji grid (👍 ❤️ 🔥 🎉 👋 💯 👏 😍 😎 🤣) next to the rail.
- **Mogram:** not in PRD. Skip.

### 14 · "Edge animation" rail button

- Tooltip reveals the last rail item toggles connector animation globally.
- **Mogram:** our equivalent is the scene **Play/Pause** of the shared animation clock.
  Put a global "pause motion" toggle in the viewer and editor (also needed for
  `prefers-reduced-motion`).

### 15 · Selection context toolbar (zoomed 340%)

- Selecting a container shows a floating toolbar _above the selection_: fill (none),
  border colour, font family "Inter", size 12 stepper, bold, align, list, text colour,
  highlight, link, lock, ⋯. Dark tooltip "Border Color" under the hovered control.
- Connectors: rounded orthogonal corners (~12px radius), square port marker where the
  edge meets the node, round mid-segment handle for bending. Icon tiles have a pastel fill
  with a darker 3px bottom edge (soft "key-cap" look). Labels centred under icons.
- **Mogram:** PRD wants _presets not styling_, so our context toolbar is smaller: state
  preset, motion preset, flow preset (for edges), bring forward/back, lock, card, ⋯.
  Free styling lives under the inspector's "Advanced" section. Rounded orthogonal edges
  with a draggable mid-segment handle to bend (bending saves a path — PRD).

### 16 · Board menu (hamburger)

- Move, Convert to Template, "Hide Descriptions" switch, Delete (red, destructive).
- **Mogram:** diagram menu: Rename, Duplicate, Download YAML, Open file…, Delete (red,
  confirm dialog).

### 17 · Pen tool sub-toolbar

- Selecting a tool raises a secondary bar above the main toolbar: close ×, tool variants,
  12 colour swatches + rainbow custom.
- **Mogram:** freehand drawing is not in the PRD (decorative = text, labels, highlight zones).
  Reuse the _pattern_: choosing a tool reveals its options in a second row.

### 18 · Sticky note tool

- Colour swatches, font "Aa", size "Auto", alignment.
- **Mogram:** "Note" decorative element is useful for annotations (PRD: decorative free text,
  labels, highlight zones). We implement Text, Label and Highlight zone instead of sticky.

### 19 · Arrow tool

- Colour swatches + routing types: straight, elbow (orthogonal), curved, plain line.
- **Mogram:** connection routing choice: orthogonal (default, auto-routed), curved, straight.
  Stored only when it differs from default.

### 20 · Text tool

- Colours, "Aa" font, "Auto" size, align, "Style".
- **Mogram:** Text decorative element: size presets (Title / Heading / Body / Caption),
  colour from theme palette, alignment.

### 21 · "Frames" tooltip · 22 · "Shapes & lines" tooltip

- Every toolbar icon has a tooltip, positioned _above_ the bottom bar, with a caret.
- **Mogram:** consistent `Tooltip` primitive with side/align props and keyboard shortcut hint.

### 23 · Shapes sub-toolbar

- Rectangle, ellipse, diamond, triangle, pentagon, hexagon, star, callout, parallelogram,
  document, cylinder; fill + stroke swatches; "More shapes".
- **Mogram:** generic icon library covers database/queue/etc. as real icons rather than
  primitive shapes. Highlight zone covers the rectangle use-case.

### 24 · Templates gallery modal

- Left nav (For you, Favourites, Premium, Created by you, Shared with you, Category list),
  search "What would you like to create?", 4-column cards: thumbnail on grey well, title,
  Preview / Use template.
- **Mogram:** "New diagram" dialog with starter templates (Blank, Azure 3-tier web app,
  AKS microservices, Region failover). Templates are just YAML documents → they also demo the
  file format. Thumbnail rendered by the same renderer.

### 25 · Images popover

- Search, masonry stock photos, "Make an image", "Upload image".
- **Mogram:** "Upload SVG icon" lives in the library panel (PRD: your own icons, SVG only,
  saved in `icons/`). No stock photos.

### 26 · More tools popover

- Tabs All / Formats / Templates / Widgets / Stickers / More, search, promo card
  "Start from a template" (Browse templates / Dismiss), "Plan your work" (Kanban/Timeline/Gantt).
- **Mogram:** not needed — keeps the toolbar focused.

### 27 · More Shapes modal (library browser)

- Left: searchable tree "Standard libraries" → Shapes, AWS → categories with checkboxes.
  Right: library hero (title, description, mini sample diagram) and category sections with
  icon grids. Footer "Use Selected Shapes".
- **Mogram:** our Library panel = one search box across all libraries (PRD) + collapsible
  categories per library (Azure → Compute, Networking, Storage, Databases, Containers,
  Security, …; Generic; Tool logos; My icons). Icons drag straight onto the canvas.

### 28 · Shapes left panel

- Docked left panel "Shapes": search, Recent, Basic Shapes with "Apply colors", grid of shapes,
  primary "More Shapes" + secondary "Import data" at the bottom.
- **Mogram:** **this is our Library panel's shape**: docked left floating panel, search on top,
  "Recent" section, categories collapsible, 4-col icon grid with names on hover / below,
  bottom actions "Upload SVG". Drag to canvas or click to insert at viewport centre.

### 29 · More Shapes → Azure

- Azure library hero with description + mini sample flow (numbered step badges on arrows).
  Categories: AI/ML, Analytics, App Services, Azure Ecosystem, Azure Stack, Blockchain,
  Compute, Containers, Databases, DevOps, General, Hybrid Multicloud, Identity, Integration,
  Intune, IoT, Management Governance, Migrate …
- **Mogram:** mirror the official Azure architecture icon categories so Azure users find
  things where they expect them.

### 30 · More Shapes → libraries list

- Shapes, AWS, Azure, GCP, Kubernetes, Alibaba, Salesforce, Oracle, Infographics, Network,
  Citrix, Charts, Sitemap, Cisco, VMware, … Tri-state checkbox on Azure (partial selection).
- **Mogram:** PRD scope: Azure, Generic, Tool logos, My icons (AWS/GCP later). Our catalogue
  model must be library → category → icon with aliases so adding AWS later is data-only.

### 31 · Shapes panel drilled into Azure

- Back chevron "‹ Azure", category accordion (AI ML open), 5-col icon grid, dropped icon on
  canvas shows label below ("Genomics Accounts").
- **Mogram:** drag-to-canvas creates a component whose `type` is `azure/<slug>` and whose
  name defaults to a slugged label (`genomics_accounts`), human label from the catalogue.

### 32 · Import data modal

- Org chart / ERD / Import from Lucid — cards with illustration, title, format chips, copy.
- **Mogram:** "Open file" accepts `.mogram`, `.mogram.yaml`, or a zipped folder. Same card
  pattern for the "New diagram" chooser (Blank / Template / Open from computer).

### 33 · Share dialog

- "Share Board", "Copy Link" + settings gear, add people by email + role "Can View", Invite,
  "Who has access", "Publish as a Template".
- **Mogram:** Share dialog: visibility (Private — default per PRD / Anyone with the link),
  copy link, advanced section with "Let viewers change state" (off by default — PRD),
  deep-link builder (scene / card / tour step).

## Ilograph (competitor) — interactive viewer

### 34 · Perspective overview (dark)

- Top bar: hamburger, breadcrumb "Ilograph's Serverless Architecture > Request Perspective >
  Ilograph AWS Instance", "New diagram", "Detail" slider. Right panel: "Start Walkthrough"
  - perspective notes (prose). Bottom tab strip of perspectives.
- Labelled edges ("Requests*", "Read / Write*"), nested dashed containers, hovering a
  container shows colour dots, pin, expand, close.
- **Mogram:** breadcrumbs for nested diagrams (PRD), edge labels, a right-hand panel that
  holds card/tour content. Tours list for viewers (PRD "listed for viewers to pick from").

### 35 · Clicking a resource zooms & expands it

- `/diagram` grows into a large card showing its description; breadcrumb gains a level;
  the URL encodes the path (deep link).
- **Mogram:** clicking a component with `opens:` grows the icon into a frame and fades the
  child diagram in (PRD "The zoom"). Every level has its own URL.

### 36 · Second expansion

- handleDiagram expands; its siblings shrink. Description text inside the expanded node.

### 37–41 · Walkthrough steps 1→5

- URL `/_walkthrough/N` — every step is deep-linkable.
- Right panel: big primary "Next", then "Back · 1/18 ▾ · Finish". Prose per step.
- **Everything not in the step fades to ~25% opacity**; focused elements and the edges
  between them stay full strength. Camera re-frames on each step with a smooth tween.
- **Mogram:** tour player = camera tween to the step's element (riding the routed edge path —
  PRD), focus-dimming of everything else, card beside it, step counter with jump menu,
  Back/Next/Finish, ←/→ keys, deep link `?tour=request_flow&step=storage`, branching choices
  rendered as buttons in the card footer.

## Eden (UI reference — Mogram must match this look)

### 42 · Marketing hero

- Near-black page, 1px hairline header divider. Header: logo tile (white mark on dark
  rounded square) + wordmark "Eden" (~20px, medium). Right nav in muted grey (~15px), "Sign in",
  and a **white pill CTA** "Start free" (black text, fully rounded, ~44px tall).
- Eyebrow "Capture. Research. Create. Sell." muted grey 15px.
- **Two-tone headline**: first part mid-grey, emphasis part white. ~64px, tight tracking,
  semi-bold.
- Checklist: white ✓, key phrase white + continuation grey.
- Product screenshot sits in a rounded (~24px) card with hairline border on near-black.
- App chrome inside: sidebar with logo tile + name, search icon, segmented icon toggle;
  nav rows with outline icons (New, Library _active = lighter fill pill_, Discover, Custom AI,
  Publish); section label "Chats" muted; rows with bullet dot + right-aligned "1d" muted.
- Main: page title with icon, 32px; muted subtitle; "+ New" ghost pill button (hairline
  border); big rounded-full search field; "Items | Sources" segmented pill; filter chips
  (rounded-full, hairline border, icon + label; active = filled lighter grey).

### 43 · Testimonials + three-up feature cards

- Testimonial band on a slightly lighter radial grey (#2a2a2a → #161616) — quotes grey,
  author white, role muted.
- "Start with **what interests you.**" two-tone. Three cards: 1px border, ~24px radius,
  mock content inside; under each: eyebrow (muted), title (white 24px), description (grey),
  link "Explore … →" (white).
- **Accent colour is warm gold/amber**: "Get access" button (amber fill, dark text),
  "100.3×" badge (amber outline + tint), "Course + Custom AI" card header gold gradient.

### 44 · Feature section "01 · Discover what's working"

- Numbered eyebrow, two-line two-tone headline (grey line / white line), large grey body
  copy (~24px), white pill CTA with →.
- Tabs "Posts | Ads": active white with 2px underline bar, inactive muted.
- Search pill containing a nested filter pill "3 platforms · Last 3 months · 10× ▾".
- Chips, one filled "All" + outline chips. Stacked/tilted cards with deep soft shadows.

### 45 · "02 · Study creators and brands"

- Mirror layout of 44 (visual left, copy right). Profile card: avatar, name + @handle muted,
  bio truncated, small outline pill actions (Save, ✓ In 1 list, Open), meta row with icons.
- Filter chips: "Top outlier" active (filled #2a2a2a, white text), divider, "Videos" active.
- Video cards with rose-tinted multiplier badges (471×) — a second semantic tint (rose).
- **Mogram:** chip active state = filled surface-3 + primary text; inactive = hairline
  border + muted text. Badges: tinted bg + matching border + bright text.

### 46 · Pricing comparison table

- Eyebrow + two-tone headline left-aligned in a narrow column (~880px).
- Quote with 1px left rule, attribution muted.
- Table = single rounded container (~20px radius), rows divided by hairlines; row title white
  16px, sub-row grey 14px with "·" separators; price right-aligned grey.
- **Mogram:** list rows in settings / share panel use this pattern: hairline-divided rows in
  one rounded container.

### 47 · Pricing table footer + section switch

- Highlighted rows (slightly lighter bg #1d1d1d) for totals; final price bigger, white.
- "See all plans →" white pill. Section divider hairline. "Grid view | Freeform canvas" tabs.
- Panel header: "‹ YouTube Swipe File +" with "Chat" / "Share" small outline pills + gear.
- **Mogram:** our editor top bar mimics this: back chevron, diagram title, small outline pill
  actions (Share, Export) on the right.

### 48 · Feature list + chat mock

- Check bullets in a _round dark chip_ (24px, #262626 bg, white ✓).
- Bold lead-in + grey continuation (same two-tone idea at paragraph scale).
- Mock chat panel: "Research complete" card, menu popover "Deep Social / Deep Synthesis"
  rows with icon + title + grey description.
- **Mogram:** menu items with title + description (e.g. export formats, preset pickers)
  follow this: 14px white title, 12px grey description, 8px radius hover fill.

### 49 · Horizontal carousel of feature cards

- Prev/next round icon buttons (44px, hairline border; next = filled lighter).
- Cards: 1px border, 24px radius, gradient from #1a1a1a top to #121212 bottom, mock UI on top,
  two-tone title (grey + white), grey body.
- Green bar chart → a green semantic colour exists (#4ade80-ish) for "healthy".

### 50 · "Schedule & publish" section

- "Replaces" + outline chips. Product mock with tabs "Drafts · Scheduled · Sent".
- Muted section labels "Tomorrow Jun 22". "+ Move here" ghost actions.

### 51 · Final CTA + footer

- Centered logo tile (56px, rounded 14px, white mark on #1c1c1c with hairline), two-tone
  headline, grey sub, white pill CTA.
- Footer: logo+wordmark, tagline (white 18px), "Updates" label muted 13px, email input pill
  (dark, hairline border) + round white submit button with →. Link columns with muted
  12–13px headings and 15px grey links.

### 52 · Footer (full)

- Bottom bar "© 2026 Eden" + round social icon buttons.

### 53 · Features mega-menu

- Dropdown panel (#141414, 1px border #262626, 16px radius, big shadow) with two columns of
  grouped links; group labels muted 13px; links 15px #d4d4d4.
- **Mogram:** menus/popovers = surface-2 bg, hairline border, 12–16px radius, shadow-lg.

### 54 · Same as 43 (scroll position) — confirms card spacing: 28px gap, cards ~388px.

### 55 · Sign-in ("Enter the garden")

- Full-bleed near-black with **film-grain noise and soft diagonal light falloff** (subtle
  radial highlights). Centered logo glyph (no tile), H1 white 32px bold, grey sub.
- Email input is borderless, huge (36px) centered placeholder with caret.
- "Continue" = full pill (~390×60), disabled state = #2a2a2a bg with #555 text.
  "I already have a code" small link. Legal line muted 13px with underlined links.
- **Mogram:** our sign-in/sign-up page copies this exactly: noise + vignette background,
  logo glyph, "Sign in to Mogram", big borderless input, pill continue.

### 56 · Pricing hero

- Centered eyebrow white 15px, huge two-tone headline (~88px), grey paragraph 22px.
- "What brings you to Eden?" + outline icon chips in 2 rows.
- Segmented toggle "Monthly | Annual [Save up to 33%]" — container pill with hairline,
  active segment filled #2a2a2a with nested tiny badge.
- **Mogram:** segmented control primitive = this exact look (used for Explore/Present,
  Light/Dark theme, Grid on/off, export format family).

### 57 · Pricing tier cards

- Outer group container (#121212, 1px #222, 24px radius, 28px padding) with eyebrow
  "Curator plans" + 26px title, right-aligned grey description.
- Inner cards (#161616, 1px #262626, 20px radius): title 24px white, grey description,
  price 40px white + "/forever" muted, small muted sub-line, **outline pill button full-width**
  (#1c1c1c bg, hairline border, white text, →), divider, checklist with thin ✓ and 16px grey text.
  Negative item uses × and dimmer text.
- **Mogram:** home dashboard / new diagram template cards adopt the nested-container +
  inner-card structure.

### 58 · Pricing "Most popular"

- Middle card raised with "Most popular" white pill badge straddling top border; CTA is
  **solid white pill** (primary) while siblings are outline pills (secondary).
- Strikethrough old price; "Everything in Starter" muted lead line; underlined inline link.
- **Mogram:** button hierarchy = primary (white pill), secondary (outline pill on surface),
  ghost (text only). Never more than one primary per view.

### 59 · Agency card + "Need something bigger?"

- Two-column card (copy left, 2-col checklist right). Secondary link with underline offset.
- "Talk to us →" outline pill aligned right in a slim row card.

### 60 · Slider + segmented toggle in a card

- Range slider: thin 3px grey track, white fill, round grey thumb with white value bubble above.
- Inner well (#191919) with large price, muted billing line, hairline divider, meta row.
- **Mogram:** slider primitive for preset "Advanced" options (speed, density, intensity) and
  export duration — same thin track + value bubble.

### 61 · Full comparison table

- Header row with plan names centred; section rows (#191919) with bold title + muted inline
  description; body rows 16px grey labels, centred values; ✓ inside a 28px circle (#262626);
  em dash "—" in muted for "not included". Row dividers #1f1f1f.

### 62 · Comparison table continued — same pattern.

### 63 · Closing CTA

- "Start with Free" eyebrow (white 15px), centred 64px white headline, grey sub, white pill.

### 64 · Footer bottom

- Hairline divider, "© 2026 Eden" muted 15px; 40px round outline icon buttons (X, Instagram).

### 65 · Comparison page hero (eden.so/vs/foreplay)

- Big search pill (60px tall, #141414 bg, 1px #2a2a2a, 30px radius) with sparkle icon and
  nested filter dropdown pill "All ▾".
- Segmented "Posts | Ads" inside a pill + icon chips "For you", "Top", "Longest-running"
  (active = brighter border + white text).
- **Mogram:** Library panel search is this search pill (compact). Canvas theme picker and
  library filters use these chips.

### 66 · "The short version"

- Two-column editorial block between hairline rules: small muted label left + date at the
  bottom; right column 34px grey text with white emphasised phrase. Sections separated by
  full-width hairlines and a subtle background shift (#0c0c0c → #111).

### 67 · Comparison table mock + feature list

- Mock card: header with logo, title + sub, right "Longest" + green pill "B · 118 days"
  (green tint bg, green border, green text) → **green semantic tint** confirmed.
- Grid table with column dividers, left column label muted 12px.
- Highlighted rows legend "■ Highlighted rows are what Notion changed" – amber tint.

### 68 · Action menu + key-value card

- Menu card: rows with 14px icon, title 13px white, description 11px grey, active row filled
  #232323 rounded 10px. Exactly the dropdown style for Mogram's preset pickers.
- Key–value table card: muted keys left (12px), white values right, hairline row dividers.
  Footer actions: white pill w/ sparkle "Draft 5 variations" + outline pill "Save as note".
- **Mogram inspector = key-value rows** (Type, Name, State, File) in this style.

### 69 · "04 · Widen your research"

- Same two-column template, flipped. Confirms the rhythm: 120px+ vertical section padding,
  full-width hairline between sections, subtle per-section background tint shift.

### 70 · "Eden and Foreplay, in plain words." comparison table

- Centered eyebrow (muted), 44px headline, muted caption. Table container (#151515, 1px
  #262626, 24px radius); header row; group label rows small (12px) white on #181818; body rows
  18px white label left, centred values (white for Eden col, grey for competitor col); plain ✓.

### 71 · Two side-by-side cards + "Honest recommendation"

- Left card neutral border, right card ("Why choose Eden") has **brighter border + slightly
  lighter gradient** to signal emphasis — emphasis by luminance, not colour.
- **Mogram:** selected/active cards (selected template, active scene thumbnail) get the brighter
  border (#3a3a3a → #4a4a4a) + lighter fill rather than a coloured outline.

### 72 · Pricing side-by-side

- Highlight card has a very faint **green-tinted border** (rgba green ~0.25) — subtle.
- "Most picked" badge = tiny outline pill with green tint.
- Row: title white 18px + price right white; grey 14px description; hairline dividers.

### 73 · Final CTA band

- Section bg has a soft top-to-bottom gradient (#1a1a1a → #0b0b0b) and the CTA band ends
  with a hairline. Headline white both lines here (no two-tone) — two-tone is optional.

### 74 · Marketplace hero

- **Faint square grid pattern** on the page background (1px lines ~#ffffff08 at ~64px) —
  very close to a canvas grid. Header variant: logo left, plain text links right.
- Search bar full-width (#141414, 1px #2a2a2a, 14px radius — _not_ fully round here).
- Category tabs: active = white pill with black text + count; inactive = text + muted count.
- Goal chips: small outline pills, active "All" = filled #262626.
- Product cards: image top (cover), small dark pill label overlaid top-left ("Download",
  "Custom AI": #000000b3 bg, white 13px), title 20px white semibold, 2-line grey description
  clamp, footer avatar + name grey + price white right.
- **Mogram:** this is exactly our **dashboard diagram grid** (thumbnail on top, overlay tag
  for "Shared" / "Private", title, description, footer with updated time).
  The grid background pattern also inspires the canvas dot/line grid styling.

### 75 · Marketplace rows with "See all 9 →" and round next-arrow (40px, #1c1c1c, hairline)

overlapping the card edge — horizontal scroller pattern.

### 76 · Custom AI cards

- 56px round icon well (#1a1a1a + hairline) holding a **coloured line icon** (amber, violet,
  green, orange) — colour used _only_ in small icon accents.
- Meta rows muted 13px with "·" separators; outline pill "Start chat →" bottom right.
- **Mogram:** template cards & empty states use the round icon well + accent-coloured icon.

### 77 · Creators row + "Sell on Eden Marketplace" CTA card

- Small square-ish cards (avatar 64px, name white, count grey). Centered CTA card with
  white pill "Start your store". Footer strip "Built with Eden" muted 14px.

### 78 · Creator store page (thedankoe.eden.so)

- **Top radial spotlight**: soft grey glow behind the avatar fading to black (radial-gradient
  ellipse at top, #3a3a3a → transparent). Uppercase name, muted handle, grey bio, row of 40px
  round outline social icons.
- Filter chips (active white pill). Quiz card with lettered option rows (circle letter badge
  - text, 12px radius, hairline border).
- **Mogram:** the shared/public **viewer page** header uses this spotlight + centred title
  - owner. Option rows = **tour branching choices** UI (A/B badges + label).

### 79 · Store sections

- Section header: title 22px + count badge (round outline) + collapse chevron button right.
- List rows (#141414, 1px #262626, 16px radius): 52px icon tile, title white 17px, grey
  description 2-line clamp, chevron or price right (strikethrough old price muted).
- **Mogram:** Scenes/Tours/Cards panel lists use this row pattern; panel sections use
  "Title (count) ⌃" collapsible header.

### 80 · Downloads page

- Four platform cards (#121212, 1px #262626, 20px radius) with tiny corner badges
  ("This device", "TestFlight", "Beta": outline pill 12px muted), grey glyph, title 24px,
  small white pill CTA with icon; disabled = outline pill muted "Coming soon".
- **Mogram:** export format cards (PNG / JPEG / SVG / GIF / WebP) with corner badges
  ("Animated", "Advanced") and a disabled state when the diagram has no animation.
