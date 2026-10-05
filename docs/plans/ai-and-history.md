# Plan: version history and the AI assistant

Agreed with the product owner on 2026-10-04 (see the conversation summary in `build-log.md`, Step
23 onwards). History comes first: the assistant relies on it for "before Claude" checkpoints.

## H — Version history

- [x] **H1 Core diff** (`@mogram/core/diff`): what changed between two projects, by element name
      (added, removed, changed fields, moved), per diagram folder, plus a one-line summary
      ("Added Payments API, Orders DB · changed 3 · removed 1"). `restoreElements`: bring named
      elements and scenes back from another version without rolling anything else back.
- [x] **H2 Cloud history**: revisions gain `name`, `source` (save, restore, ai, named, import),
      `label` and `summary`. Saves merge into one revision per editing session (5 min idle, 30
      min at most), never into a named, AI, restore or first revision. Endpoints: name a revision,
      make a checkpoint, duplicate from a revision. Retention: everything from the last 24 hours,
      hourly for 30 days, daily after; named revisions always.
- [x] **H3 Local history** for drafts in IndexedDB, same rules, uploaded with the draft when it's
      saved to the cloud. One `HistorySource` interface for both.
- [x] **H4 History panel** on the right: versions by day with author (✨ and the prompt for
      an assistant turn), change summary and thumbnail; the chosen version shown read-only on the canvas
      with a banner (Restore · Make a copy · Back to current); Show changes (added, changed,
      removed ghosts; against the version before or against now); name a version; bring back
      selected elements; restore adds a version on top.

## A — AI assistant

- [x] **A1 Architecture lint** (`@mogram/core/lint`): what parses but an architect wouldn't draw
      (AWS subnet outside an Availability Zone, icons from two clouds, unconnected components,
      empty containers). Shown under Problems and returned to the model.
- [x] **A2 Tools**, shared by the server loop and the browser: search_icons, add_elements (YAML),
      update_elements, remove_elements, rename_element, move_into, arrange, story (scenes, cards,
      data), edit_file, plus ask_user and propose_plan, which end the turn. Every mutating call
      is validated; one that adds errors is rejected with them.
- [x] **A3 Server**: provider-neutral (Anthropic, OpenAI-compatible for DeepSeek/OpenAI/others,
      scripted for tests), cached briefing (format guide, cloud rules, example, conventions),
      agent loop, `POST /api/ai/chat` streaming events, limits and usage records.
- [x] **A4 Assistant panel**: a tab beside Library; transcript with change cards (select, undo,
      diff), question cards (options, Other, multi-select, mini-diagram previews), plan cards;
      composer with selection chips, @mentions and model choice; ✨ button and ⌘J; "Ask Claude"
      on the canvas; changes highlighted while Claude works, with Follow; each turn one undo step
      and one version.
- [x] **A5 Start from a description** on the diagrams page.
- [x] **A6 Evaluations**: prompts with checks, run against any provider; scripted-provider tests in
      CI.

## Notes from the build

- The assistant is called by its provider: "Claude" when Claude answers, "Assistant" otherwise
  (D-78). History marks its versions with ✨ and the request, and the person who asked.
- Not testable here without a provider key: real model calls. The scripted provider runs the
  whole loop in the unit and browser tests; `pnpm eval:ai` measures real models once a key is
  set (D-78).
