# Stage-3 reviewer brief

You are the stage-3 reviewer for part of Mogram's concept library. Mogram is a diagram tool
that explains cloud and software ideas with short animated diagrams, one idea per "concept".
Writers have produced a plan for each concept: the best possible animated explanation, not
limited by what Mogram can do today. Your job is to go through EVERY plan in your file, one by
one, and make sure it is genuinely the best way to explain that concept, so people understand
immediately. You are the quality bar; be demanding.

## Read first

1. `docs/research/concepts/README.md`: the plan format, the rules of good explanation, the
   technique vocabulary, and the "Review (stage 3)" section (the six questions, the verdict line
   format, the merge rule).
2. The area's catalog, `docs/research/concepts/catalog/<area>.md`: each concept's definition,
   "the idea to get across", and what it's confused with.
3. Your file, and skim its sibling part files for the area's shared visual language and the
   cross-links between concepts. Don't edit the siblings.

## For each plan

- Ask the six questions honestly. Check every technical claim (numbers, protocol steps,
  defaults, product behaviour and names as of 2026). Weigh at least one alternative framing: is
  there a sharper contrast, a truer metaphor, a more memorable failure?
- Then end the plan with one of:
  - `**Review**: Keep — <one line why>` when it's already the best;
  - `**Review**: Improved — <what changed>` after editing it in place (tighten beats, fix errors,
    sharpen the moment, shorten captions, improve the interaction);
  - `**Review**: Rethought — <why>` after rewriting it fully in the same template;
  - `**Review**: Merged — owned by <area>` for an id another area owns (your brief lists them),
    noting anything the owner's plan should borrow.
- Don't batch, and don't wave plans through. "Keep" has to be earned: its line must name the
  alternative framing you weighed and why it's worse, and the facts you checked. Earlier
  reviewers found a technical slip, a beat that contradicts the cast, or a misconception named
  but never defeated on screen in most plans; look for exactly those three things in every one.
  For each plan, check: (a) every number adds up; (b) each misconception is visibly defeated by
  a beat; (c) the opening frame makes sense to someone who has never met the idea; (d) the
  moment is one specific beat, not a summary; (e) the interaction teaches something the story
  didn't.
- Keep the template and the area's shared visual language; roughly 150–300 words per plan.
- Edit one or a few plans at a time, so progress is saved if you're interrupted. If some plans
  already carry a **Review** line, an earlier reviewer was interrupted: continue from the first
  plan without one.

## When done

Write a short summary next to your file as `<your file name without .md>.review.md`: verdict
counts; the most important changes (a line each); and patterns worth knowing for designing the
platform later (what visual machinery these concepts keep needing). Edit only your file and that
summary. Reply with the verdict counts and the three most important changes.
