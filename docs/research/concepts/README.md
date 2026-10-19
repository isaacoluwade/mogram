# Concept research

Mogram explains cloud ideas with animated diagrams. The concept library will hold hundreds of
ready-made concepts: Git, Kubernetes, networking, security, data, messaging and more, plus
what's specific to Azure, AWS and Google Cloud. This folder is how that library is worked out,
in five stages, each documented here as it's done.

| Stage | What                                                                                       | Where                             |
| ----- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| 1     | **Research**: every major concept in each area, checked against authoritative syllabi      | `catalog/<area>.md`, `CATALOG.md` |
| 2     | **Plans**: for each concept, the best animated explanation (not limited by today's Mogram) | `plans/<area>.md`                 |
| 3     | **Review**: every plan read again: will people understand immediately? Rewritten if not    | `plans/<area>.md` (revised)       |
| 4     | **Platform**: the smallest set of tools, workflows and UI that can tell every story        | `../../plans/concept-platform.md` |
| 5     | **Build**: the platform, then the concepts, verified                                       | code, `packages/concepts/`        |

**Picking this up again?** Start with [where it stands](../../plans/concept-platform-status.md).

## Progress

- **Stage 1, research: done (2026-10-05).** 16 area catalogs, each checked against its field's
  syllabi and references (certification exam outlines, the Kubernetes docs, Pro Git, OWASP, the
  SRE books, the vendors' architecture centres; several exams named in the brief had been
  retired or replaced, and the current ones were used). 1,328 rows. Concepts two areas both
  catalogued are kept once: 18 under the same id and 17 under different ids
  (`tools/catalog.py` lists which area keeps each), leaving **1,293 concepts**: 293 tier 1, 789
  tier 2, 211 tier 3. The index is [CATALOG.md](CATALOG.md).
- **Stage 2, plans: done (2026-10-09).** A plan for every concept, in `plans/<area>.partN.md`:
  1,326 plans (the merged duplicates were planned by both areas), about 547,000 words. The
  techniques they use are counted by `tools/techniques.py`.
- **Stage 3, review: done (2026-10-09).** Every plan read again by a reviewer who didn't write
  it: 206 kept as they were, 1,081 improved in place, 16 rewritten, 23 marked as merged into
  another area's plan. The commonest faults were a technical slip (a wrong default, arithmetic
  that didn't add up), a beat that contradicted the cast, and a misconception named but never
  defeated on screen. Each part has a summary, `plans/<area>.partN.review.md`, with the
  machinery its concepts keep needing. (Git part 1 and Delivery part 2 were reviewed in full
  but their reviewers were cut off before writing a summary.) `tools/coverage.py` reports
  plans and verdicts per area.
- **Stage 4, platform: done (2026-10-09).** [The plan](../../plans/concept-platform.md): six
  tools (elements, layouts, values and controls, stories, scenes, the model), every technique
  made from them, and what's deliberately left out. Its first version was reviewed by expressing
  ten plans in its format and checking it against the code
  ([the review](../../plans/concept-platform.review.md)); the plan's last section lists what
  that changed.
- **Stage 5, build: paused part-way (2026-10-09).** Milestones K0–K4 of ten are built and
  tested: stories with captions, things that appear and change, containers that arrange what's
  in them, things that travel, formulas, meters and viewer controls, in the editor, the viewer,
  previews and exports. Two concepts are authored from their plans. What's left (side-by-side
  copies, timelines and message ladders, the assistant, and the other 1,291 concepts) and how
  to carry on is in [the status document](../../plans/concept-platform-status.md).

## Areas

| Area          | File (in `catalog/`, then `plans/`) | Covers                                                                        |
| ------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| Fundamentals  | `fundamentals.md`                   | What the cloud is: service models, shared responsibility, regions, cost       |
| Git           | `git.md`                            | Version control: commits, branches, merge, rebase, workflows, internals       |
| Containers    | `containers.md`                     | Images, containers and Kubernetes                                             |
| Networking    | `networking.md`                     | From packets to DNS, TLS, load balancers, virtual networks and private access |
| Security      | `security.md`                       | Identity, access, secrets, encryption, attacks and defences, supply chain     |
| Data          | `data.md`                           | Databases, consistency, replication, partitioning, storage, analytics, backup |
| Messaging     | `messaging.md`                      | Queues, pub/sub, streams, delivery guarantees, sagas and integration patterns |
| Scaling       | `scaling.md`                        | Capacity, scaling, caching, load balancing, rate limiting, latency            |
| Reliability   | `reliability.md`                    | Redundancy, failover, resilience patterns, SLOs, disaster recovery            |
| Delivery      | `delivery.md`                       | CI/CD, release strategies, infrastructure as code, GitOps                     |
| Observability | `observability.md`                  | Logs, metrics, traces, alerting, SLO monitoring                               |
| Architecture  | `architecture.md`                   | Monoliths, microservices, serverless, the cloud design patterns               |
| AI systems    | `ai.md`                             | Serving models, RAG, vector search, agents, GPU capacity                      |
| Azure         | `azure.md`                          | What's specific to Azure and needs its own explanation                        |
| AWS           | `aws.md`                            | What's specific to AWS                                                        |
| Google Cloud  | `gcp.md`                            | What's specific to Google Cloud                                               |

A concept belongs to one area; where it's also at home in another, that area lists it under
**Overlaps** instead of repeating it. A general idea (load balancing) lives in its area; a
platform's own take (Azure Front Door vs Application Gateway) lives in the platform's file.

## Catalog format (stage 1)

Each `catalog/<area>.md` has:

1. **Scope**: what's in, what's left to other areas.
2. **Sources**: what was consulted, with links, including the syllabi used to check coverage.
3. **Catalog**: grouped into sub-topics, one table per group:

   | id  | Concept | Tier | Platform | What it is | The idea to get across | Often confused with |
   | --- | ------- | ---- | -------- | ---------- | ---------------------- | ------------------- |
   - **id**: kebab-case, unique across all areas (`git-rebase`, `dns-resolution`).
   - **Tier**: 1 essential (anyone working in the cloud meets it), 2 important (a practitioner
     needs it), 3 advanced (specialists, or a certification's harder end).
   - **Platform**: `any`, `azure`, `aws`, `gcp` or `kubernetes`.
   - **The idea to get across**: the one thing someone must understand afterwards: the "aha".
   - **Often confused with**: the concept people mix it up with, if any.

4. **Coverage check**: each syllabus or source list compared against the catalog, and anything
   deliberately left out, with why.
5. **Overlaps**: concepts at home here and in another area.

## Plan format (stage 2)

Each `plans/<area>.md` has one section per concept in its catalog, in catalog order. A plan is
the **best way to explain the idea with an animated diagram**, as if any tool could draw it:
today's Mogram is deliberately not a constraint here (stage 4 works out what Mogram needs).

```markdown
### Concept title (`id`)

**The aha**: the one sentence someone walks away with.
**Misconception to defeat**: the wrong picture people bring, if there is one.
**Cast**: what's on screen and what each thing looks like.
**Opening frame**: the still picture before anything moves; it should already make sense.
**Story**: numbered beats, a few seconds each: what changes, what moves, the caption.
**The moment**: the beat where it clicks, and what makes it unmistakable (a contrast, a
before/after, a slow-down, a spotlight).
**Interaction**: what a viewer can try (step, scrub, break something, change a number), and
what it teaches. "None" is fine.
**Ending**: how it ends, or how it loops.
**Variants**: platform versions or follow-on concepts, by id.
**Techniques**: the visual techniques used, from the vocabulary below (add new ones if needed).
```

Rules of good explanation used throughout: one idea per concept; the opening frame is
meaningful on its own; every beat changes one thing; motion means something (never decoration);
words are short and appear when the thing they describe happens; compare against the wrong
model when there is one; end on the state that proves the point; real names (Azure, AWS, Git)
where the concept is about them, generic shapes where it isn't.

### Technique vocabulary

Plain, tool-neutral names, so stage 4 can count what the plans need:

| Technique          | Means                                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| appear / disappear | an element enters or leaves                                                 |
| move               | an element changes position (a branch label slides to a new commit)         |
| clone              | an element is copied, the copy then changes (a commit replayed)             |
| restyle            | an element changes look: state, colour, size, label, icon                   |
| token              | a labelled thing travels along a path (a packet, a request, a JWT)          |
| stream             | a continuous flow along a path whose rate shows volume                      |
| exchange           | an ordered back-and-forth between parties (a handshake, a protocol)         |
| contents           | items inside an element: a queue's messages, a cache's keys, a table's rows |
| layers             | a stack of layers, in or out (OSI, image layers)                            |
| lanes              | parallel rows or columns: Git branches, swimlanes, a time axis              |
| meter              | a number, bar or gauge changing (CPU, error budget, cost)                   |
| chart              | a value drawn over time                                                     |
| timer              | time passing visibly (a TTL running out, a timeout)                         |
| spotlight          | some elements emphasised, the rest dimmed                                   |
| path trace         | the route something takes is highlighted                                    |
| caption            | words for the beat, appearing with it                                       |
| side by side       | two versions compared at once (merge vs rebase)                             |
| toggle             | the viewer switches between two states (before/after, on/off)               |
| zoom               | into an element to see inside it, and back out                              |
| boundary           | a region drawn around things: a network, a zone, a trust boundary           |
| failure            | something breaks visibly                                                    |
| choice             | the viewer picks what happens next                                          |
| dial               | the viewer changes a number and sees the effect                             |

## Review (stage 3)

Every plan is read again by a reviewer who didn't write it, against six questions:

1. **The point**: is "the aha" the real core of the idea (checked against the catalog), and is
   it said so a newcomer would recognise it?
2. **Immediately understood**: does the opening frame make sense on its own, and does the story
   reach the moment without needing anything the viewer doesn't know? Would someone new to the
   idea get it on the first watch?
3. **The best way**: is there a better framing (a sharper contrast, a truer metaphor, a more
   memorable failure)? At least one alternative is weighed for every plan.
4. **Correct**: is every technical claim right (numbers, protocol steps, defaults, names)?
5. **Economical**: one idea, every beat earns its place, captions short, about 20–45 seconds.
6. **Consistent**: does it use the area's shared visual language, and does it link to the
   concepts around it?

The verdict goes on a final line of each plan: `**Review**: Keep — …`, `**Review**: Improved — …`
(edited in place; what changed) or `**Review**: Rethought — …` (rewritten; why). A plan for an
id another area owns (see `tools/catalog.py`) is marked `**Review**: Merged — owned by <area>`,
noting anything the owner's plan should borrow. Each area's reviewers also write
`plans/<area>.review.md`: the verdict counts, the most important changes, and patterns worth
knowing for the platform (stage 4).

## Tools

In `tools/`: `catalog.py` (the index, and which area keeps a concept two areas listed),
`techniques.py` (what the plans use), `coverage.py` (plans and verdicts per area),
`review-brief.md` (the stage-3 reviewer's brief), `author-brief.md` (how to write a concept file
from its plan) and `shots-yaml.mjs` (plays a concept file in the viewer and saves a picture of
each beat).
