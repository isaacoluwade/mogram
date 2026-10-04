# Eden design system — extracted reference

Mogram's UI follows Eden's look exactly. This document records what Eden actually uses,
taken from three sources (in order of authority):

1. **Eden's production CSS and HTML** (`eden.so`, fetched 2026-10-03). The hero on eden.so
   contains a live HTML mock of the Eden app (sidebar, search, chips, cards), so app-chrome
   values below are Eden's own classes, not estimates.
2. **Pixel sampling** of the 39 Eden screenshots in `/screenshots` (script in the build log).
3. Visual review of the screenshots (see `screenshot-notes.md`).

Everything in Mogram's token file (`apps/web/src/styles/tokens.css`) maps back to a row here.

## 1. Typography

| Role                                  | Eden                                                         | Notes                                           |
| ------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Body / UI                             | **Inter** 400/500/600, `-webkit-font-smoothing: antialiased` | `html { font-family: Inter, -apple-system, … }` |
| Headings (`h1`–`h6`, `.font-display`) | **Geist** weight **500**                                     | Never bold. Tight tracking.                     |
| App wordmark                          | **Instrument Sans** 500, 18px, tracking −0.005em             | Sidebar logo text in the app                    |
| Mono                                  | `ui-monospace, SFMono-Regular, Menlo, …`                     | We use Geist Mono for the YAML editor           |

Letter-spacing tokens Eden uses: −0.005, −0.01, −0.015, −0.02, −0.025, −0.03, **−0.035 (`tracking-tight`)**,
−0.04, −0.045em. Large display headlines use −0.035 to −0.045em; app page titles −0.04em.

Type scale observed:

| Use                       | Size / line-height / tracking                                                          |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Marketing hero h1/h2      | `clamp(2.1rem, 4vw, 3.1rem)`, lh 1.05, −0.035em (hero up to ~64px; pricing hero ~88px) |
| Section h2                | `clamp(1.6rem, 3vw, 2.3rem)`, lh 1.08, −0.035em                                        |
| App page title            | 26–27px, weight 500, lh 1.3, −0.04em, `white/92`                                       |
| App inactive title tabs   | same size, `white/30`                                                                  |
| Nav link                  | 0.85rem (13.6px), `text-secondary` → `text-primary` on hover                           |
| Sidebar row               | 14px / 21px, weight 400                                                                |
| Sidebar section label     | 13px / 21px, `white/38`                                                                |
| Subtitle under page title | 13.5px, `white/42`                                                                     |
| Search placeholder        | 13.5–14px, `white/30–35`                                                               |
| Chip                      | 11–12px, weight 500                                                                    |
| Badge                     | 0.66rem, weight 500, tabular-nums, tracking-wide                                       |
| Meta / timestamps         | 11.5–12px, tabular-nums, `white/35–40`                                                 |

**Two-tone headlines.** The headline is set in `text-secondary` (#a3a3a3) with the emphasised
phrase wrapped in `<span class="text-accent">` (#fafafa). This is Eden's signature and is used on
every marketing section, and occasionally reversed (white then grey) in the app.

## 2. Colour tokens (Eden's names → values)

| Eden token              | Value                       | Mogram token                      |
| ----------------------- | --------------------------- | --------------------------------- |
| `page`                  | `#0a0a0a` (rgb 10)          | `--color-page`                    |
| `card`, `elevated`      | `#141414` (rgb 20)          | `--color-card`                    |
| `surface-subtle`        | `#1a1a1a` (rgb 26)          | `--color-surface`                 |
| app sidebar             | `#171717`                   | `--color-sidebar`                 |
| app main area           | `#111111`                   | `--color-main`                    |
| `border`                | `rgba(255,255,255,.08)`     | `--color-border`                  |
| `border-subtle`         | `rgba(255,255,255,.04)`     | `--color-border-subtle`           |
| `text-primary`          | `#f5f5f5`                   | `--color-fg`                      |
| `text-secondary`        | `#a3a3a3`                   | `--color-fg-secondary`            |
| `text-muted`            | `#737373`                   | `--color-fg-muted`                |
| `accent`                | `#fafafa`                   | `--color-accent` (white emphasis) |
| `primary` (brand green) | `rgb(92,151,118)` `#5c9776` | `--color-brand`                   |
| `accent-cloudberry`     | `hsl(10 54% 61%)` `#d17866` | `--color-cloudberry`              |
| selection               | `rgba(92,151,118,.45)`      | `::selection`                     |

App chrome uses white-alpha layers rather than solid greys. The exact alphas Eden uses:

| Purpose                       | Value                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Row hover / active            | `white/8` bg, text `white`                                                         |
| Row idle text                 | `white/72` (nav), `white/64` (lists)                                               |
| Row icon idle                 | `white/45–72`                                                                      |
| Search field                  | `white/4` (header search) · `white/7` (page search)                                |
| Segmented container           | `white/5.5–6`                                                                      |
| Segmented active thumb        | `white/11–13` + `ring-1 ring-inset white/8`                                        |
| Chip idle                     | border `white/7–8`, bg `white/2.5–3`, text `white/43–60`                           |
| Chip active                   | border `white/15–16`, bg `white/10–11.5`, text `white/90`, inset `0 1px 0 white/5` |
| Dashed add chip / icon button | `border-dashed white/15`, text `white/55`                                          |
| Secondary button              | bg `white/9`, text `white/75`, 12px medium, h-8, full pill                         |
| Divider                       | `white/6.5` (footer rule) · `white/9` (inline separator)                           |
| Card in app                   | `rounded-2xl` (16px), border `white/6`, bg `white/2`, p-3.5                        |
| Sidebar                       | bg `#171717`, border `white/10`, radius 12px, shadow `0 6px 24px rgba(0,0,0,.18)`  |

Pixel-sampled marketing surfaces (for sanity): header `#0f0f0f` with `#222` divider, outer pricing
group `#111` / border `#222`, inner card `#161616` / border `#282828`, outline button `#202020`
with border `#404040`, comparison section row `#1b1b1b`, check circle `#282828`, dash `#494949`.

### Semantic tints (badges, status)

Eden uses Tailwind 300-weight hues at 12% fill / 35% border / 100% text for badges:
`rose-300`, `orange-300`, `fuchsia-300`, `amber`. Sampled: amber badge text `#f3bd7f` on
`#302a22` with border `#755e43`; green pill text `#8fe5bb` with border `#415f50`; amber CTA
fill `#ecb95b`; gold header gradient `#b58c45 → #764f1f`. Status dot green `#73b490`.
Icon-well accent colours: amber `#e9a23b`, violet `#a38cf3`, green `#91b799`, orange `#e97c36`.

Mogram maps diagram **state presets** onto these exact tints so states look native to Eden:

| State      | Hue                                            | Rationale                  |
| ---------- | ---------------------------------------------- | -------------------------- |
| healthy    | neutral (no tint)                              | Normal looks normal        |
| active     | Eden green `#73b490` / `#8fe5bb`               | Eden's own "positive" tint |
| degraded   | amber `#f3bd7f`                                | Eden amber badge           |
| overloaded | orange-300 `#fdba74`                           | Eden orange badge          |
| down       | cloudberry/rose `#d17866` / rose-300 `#fda4af` | Eden's warm red            |
| scaling    | violet `#a38cf3`                               | Eden icon accent           |

## 3. Radius

Eden radii: 7 (segmented thumb), 8, 9 (segmented track), 10, **12 (sidebar rows, sidebar, menus)**,
14 (search bar on marketplace), **16 (`rounded-2xl` cards)**, 20 (pricing inner cards), **24 (feature
cards, outer groups)**, full (`rounded-full`) for every button, chip, pill input and badge.
Logo tile uses `rounded-[32%]` (squircle-ish).

## 4. Elevation

| Use                      | Shadow                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary white pill       | `inset 0 1px 0 rgba(255,255,255,.18), 0 1px 1.5px rgba(0,0,0,.16), 0 3px 6px -1px rgba(0,0,0,.22), 0 8px 14px -4px rgba(0,0,0,.18)`; hover lifts `-translate-y-0.5` with a deeper stack |
| Floating panel (sidebar) | `0 6px 24px rgba(0,0,0,.18)`                                                                                                                                                            |
| Popover / product cards  | `0 14px 36px rgba(0,0,0,.5)` · `0 12px 30px -10px rgba(0,0,0,.8)`                                                                                                                       |
| Hairline ring            | `0 0 0 1px rgba(250,250,250,.06–.08)`                                                                                                                                                   |
| Logo tile                | gradient `#2c2c2c → #1d1d1d`, `inset 0 0 0 1px white/14, inset 0 1px 0 white/12, 0 1px 1px rgba(0,0,0,.22)`                                                                             |

## 5. Motion

- Section reveal: opacity 0 → 1, `translateY(24px)` → 0, `.7s cubic-bezier(.22,.68,.35,1)`.
- Segmented thumb slide: `300ms cubic-bezier(0.2,0.8,0.2,1)`.
- Panel crossfade: `opacity/transform 500ms ease-out`, `translate-x-2` offset.
- Buttons: `transition-all 200ms ease-out`.
- Everything honours `prefers-reduced-motion` (`motion-reduce:transition-none`).

## 6. Component recipes (Eden → Mogram primitive)

| Eden pattern                                                                                 | Mogram primitive             |
| -------------------------------------------------------------------------------------------- | ---------------------------- |
| White gradient pill (`from-white to-[#e8e8e8]`, text `page`, 0.84rem medium, tracking-tight) | `Button variant="primary"`   |
| Secondary pill (`bg white/9`, `white/75`)                                                    | `Button variant="secondary"` |
| Outline pill (`#1c1c1c`-ish bg + hairline border, white text, →)                             | `Button variant="outline"`   |
| Text link with arrow                                                                         | `Button variant="ghost"`     |
| Floating sidebar with 30px rows                                                              | `Sidebar`, `SidebarItem`     |
| Page header: title 26px + subtitle 13.5px + New button                                       | `PageHeader`                 |
| Search pill with nested filter pill                                                          | `SearchField`                |
| Segmented control (track + sliding thumb)                                                    | `SegmentedControl`           |
| Filter chips + dashed add chip + vertical divider                                            | `Chip`, `ChipGroup`          |
| Badge (tint 12% / border 35% / text 100%)                                                    | `Badge tone=`                |
| `rounded-2xl` card, border `white/6`, bg `white/2`                                           | `Card`                       |
| Menu rows (icon + title + description, active `#232323`)                                     | `Menu`, `MenuItem`           |
| Key/value rows with hairlines                                                                | `PropertyRow` (inspector)    |
| Logo tile                                                                                    | `LogoMark`                   |
| Grain + vignette auth page                                                                   | `AuthShell`                  |
| Top radial spotlight (store page)                                                            | `Spotlight` (viewer header)  |
| Lettered option rows (A/B/C)                                                                 | tour `ChoiceList`            |
