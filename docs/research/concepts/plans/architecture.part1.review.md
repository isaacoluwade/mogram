# Architecture part 1: stage-3 review

**Verdicts (33 plans)**: 33 Improved, 0 Keep, 0 Rethought, 0 Merged.

## Most important changes

- `context-map`: fixed a technical error. Customer/Supplier was described as "supplier sets terms,
  customer conforms", which is the Conformist pattern. Both are now shown, to contrast influence.
- `serverless-architecture`: the closing billing-meter beat contradicted the plan's own
  misconception (it is not about billing). Replaced with execution limits and honest warm-reuse
  of state ("sometimes remembers").
- `pipes-and-filters`: removed the claim that filters can be freely reordered (Decode must be
  first); replaced with swap/insert, plus a relabel beat showing CI and ETL are the same shape.
- `microkernel-architecture`: "a plug-in crash never harms the core" is only true with process
  isolation; now shows both, plus the plug-in API as a frozen contract.
- `scheduler-agent-supervisor`: the scheduler now dies mid-step, so the log living outside the
  driver is the visible point (defeats "retry in each caller").
- `space-based-architecture`: removed "no request dropped"; added the data-pump lag as the risk
  window.
- `ddd-aggregate`: opens on the oversized object graph (misconception shown), and the moment is a
  rejected concurrent edit (a mechanism) instead of a design rule drawn as a wall.
- `distributed-monolith`: second cause added (synchronous chains, lockstep versions), and the
  bill of costs shown.
- Cost beats added across the area: client-server outage, monolith shared fate, microservices
  no-transaction and ops ledger, SOA bus bottleneck, WQW redelivery, valet-key bearer token,
  event-sourcing correction/immutability, API composition availability (0.999^3, about 0.997),
  big-compute flat bill versus coupled cost.

## Patterns for the platform

- **Side-by-side with a toggle** is needed in about a third of the plans (SOA, n-tier, shared vs
  per-service database, replica vs read model, in-process vs isolated plug-ins, independent vs
  coupled big compute). One "state A / state B" component, with state carried across the toggle,
  would serve them all.
- **Ripple** (consequence hopping along coupling) is the signature move for coupling,
  distributed monolith, shared database and mud; it needs a graph with edge weights.
- **Wall/bounce with a reason**: blocked arrows (module walls, aggregate lines, bounded contexts,
  cylinders) all need the blocker labelled as a build check, a design rule or a real boundary.
- **Cost meters/ledgers** (ops ledger, availability readout, bill, lag meter) were the commonest
  missing element; a small reusable meter panel anchored to a cast would help.
- **Process-level boundary** (in-process vs isolated host) recurs in microkernel, modular
  monolith, serverless; a toggle that redraws a region as a process wall is cheap.
- **Timeline strip** with delayed consequences (Conway reorg, mud fencing, ACL retirement,
  CQRS lag) needs "later" markers, not just ordering.
- **Scrub** is used once (event sourcing) but a stateful replay of a log into a derived box is the
  same machinery as projections and snapshots.
