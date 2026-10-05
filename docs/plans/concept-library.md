# Plan: a concept library that holds hundreds

Agreed with the product owner on 2026-10-05. The concepts list sat inside the building-blocks
library: a flat list with cut-off summaries, no previews and no grouping, fine for nine and not
for the hundreds planned (networking, Azure, AWS, Git…). This round is the structure and the UI;
adding concepts comes later, and so do scenes that show, hide or move elements (for Git).

## Grouping

Every concept has a **topic** and a **platform**, plus free **tags** for search:

```yaml
concept:
  summary: Run more copies of a service as traffic grows…
  topic: scaling # scaling | reliability | networking | security | data | messaging |
  # containers | delivery | git | architecture
  platform: any # any | azure | aws | gcp | kubernetes
  tags: [autoscaling, vm, load balancer]
  roles: … # parts to pick: a pattern you apply. None: an explainer you insert or open.
```

## Where concepts live

`@mogram/concepts`: one `.mogram.yaml` per concept under `content/<topic>/`, a generated catalog
(id, title, summary, topic, platform, tags, kind, parts) that loads instantly, and the diagrams
themselves loaded a topic at a time, only when one is opened. A test checks every concept reads
cleanly, tells its story, is filed under its topic, and that the catalog is up to date.

## The UI

- The left panel: **Library · Concepts · Assistant**. Library is building blocks only.
- **Concepts tab**: search, a platform filter (defaults to the diagram's cloud; general concepts
  always show), Yours, Recently used, and topics with counts that open into lists.
- **Browse all**: a large gallery with topics down the side, platform and kind filters, search, and
  a grid of previews (drawn as they scroll into view, playing on hover).
- The concept window shows topic and platform; an explainer offers Insert and Open only.
- The Diagram inspector's Concept section sets topic, platform and tags.
- The assistant finds concepts by search (`find_concepts`) instead of a list in its description,
  and the browser replays an applied concept from what the server sends, so hundreds of concepts
  are never bundled into the editor.

## Milestones

- [x] **L1 Format**: topic, platform and tags on `concept:` (read, write, diagnostics); kinds.
- [x] **L2 Package**: `@mogram/concepts` with content, catalog generator, lazy loading, search, tests;
      the nine concepts moved into it.
- [x] **L3 Concepts tab and gallery**; Library without concepts; the concept window for both kinds;
      Recently used; your own concepts with their topics.
- [x] **L4 Inspector**: topic, platform and tags in the Concept section.
- [x] **L5 Assistant**: `find_concepts`, `apply_concept` by id with the diagram sent along.
- [x] **L6 Docs, tests, browser journeys, screenshots, full verification.**
