# Plan: capacity (scaling that responds to traffic) and the concept library

Agreed with the product owner on 2026-10-04. Principle: **nothing is scripted per concept.**
Mogram gets a small, general capacity model; animation is how that model is drawn. Concepts are
ordinary diagrams built from the same keys, so people can make their own.

## The model, in the file format

```yaml
components:
  web_vm:
    type: azure/virtual-machine
    scale: { min: 2, max: 8 } # scale out: copies (optional target: 70%, capacity: 1x)
  orders_db:
    type: azure/sql-database
    scale:
      sizes: # scale up: one copy that grows through sizes
        - { name: S2, cpu: 2, memory: 8, disks: 1 }
        - { name: S4, cpu: 4, memory: 16, disks: 2 }
  cache: { type: azure/cache-redis, hit: 80% } # passes only misses on
  lb: { type: azure/load-balancers, routing: split } # one of the next (inferred for LBs)
connections:
  users_to_lb: { from: users, to: lb, traffic: 2x } # twice what it would carry (relative)
  lb_to_v2: { from: lb, to: v2, share: 10% } # a share of a split
scenes:
  spike:
    users_to_lb: 5x # five times as much; the diagram works out the rest
    lb_to_v2: { share: 50% }
    web_vm: { copies: 6 } # or pin a count / size by hand
```

- **Traffic** is relative (1× is normal). Elements with nothing coming in send 1×; a connection's
  own `traffic` multiplies what it would otherwise carry (changed while building C8 from "replaces
  what reaches it", so a concept's spike means the same in any diagram). Each element passes its traffic on: to **all** next
  elements (calls), or to **one of** them (`routing: split`, inferred for load balancers,
  gateways and front doors), by `share` or evenly. Something down passes nothing on; a split
  skips connections that are blocked, and `backup_for` connections take over their traffic.
  Into a container, traffic is split among the elements inside that nothing inside feeds.
- **Capacity**: each copy handles `capacity` (default 1×) at 100%. Scale out keeps the copies'
  load at `target` (default 70%) between min and max; scale up picks the smallest size that does
  (each size doubles capacity unless given). Past the limit it's overloaded: shown, never hidden.
- **Queues** (queue icons and shapes, or `queue: true`) pass on only what their consumers can
  take; the rest waits, and the backlog fills and drains. **Caches** pass on only misses (`hit`).

## Milestones

- [x] **C1 Format and model**: `scale` (min/max/target/capacity, or sizes), `capacity`,
      `routing`, `hit`, `queue` on components; `traffic`, `share` on connections; scene values
      `traffic`, `share`, `hit`, `copies`, `size`. Parse with plain-language diagnostics; write
      them (edits); diff names them; file-format docs.
- [x] **C2 Engine** (`@mogram/core/capacity`): traffic through the graph (routing, shares,
      blocked and backup connections, containers, caches, queues), load per copy, copies and
      sizes, and overload from load; part of state resolution. Property tests: traffic is never
      invented or lost at a split, copies stay within min and max, sizes within the list.
- [x] **C3 Time** (`CapacityTimeline`): copies boot (delay, staggered, start-up) and drain
      (cool-down, traffic stops first, then they leave); sizes change after a restart that pauses
      traffic; traffic eases; backlogs fill and drain. Deterministic for a sequence of changes, so
      the canvas, the viewer and exports agree; reduced motion jumps to the end.
- [x] **C4 Layout**: a scaled-out component reserves room for its maximum (a grid of copies);
      a scaled-up one for its largest size. A container that holds only a scaled-out component is
      its scale set: it grows and shrinks with it.
- [x] **C5 Drawing**: the scale set frame grows and shrinks inside its faint maximum; copies
      with the element's own icon boot (ring fills, green tick) and drain (dim, leave); traffic
      fans out from where it comes in to every copy and back out; a load bar per copy and a
      count. Scale up: the tile opens into a machine (cores light up, memory fills, disks slide
      in, the size's name), restarts dim it and pause its traffic, a dashed ceiling at the
      largest size. Dots follow the traffic (more traffic, denser dots); queues fill; caches show
      their hit rate. Same in the editor, the viewer, thumbnails and exports.
- [x] **C6 Inspector and scenes**: a Scaling section (off, out, up; sizes with presets for VMs,
      databases and generic tiers), Traffic on connections (level, share), routing, cache hit
      rate, queue; with a scene selected, the same controls write that scene's values.
- [x] **C7 Traffic slider**: in the editor (a preview, never saved) and for viewers who may try
      "what if"; the diagram responds live.
- [x] **C8 Concept library**: a concept is a diagram with a `concept:` section (summary, roles).
      Built in: horizontal scaling, vertical scaling, autoscaling, scale up vs out, load
      balancing, caching, failover, queue load-levelling, canary. In the library: an animated
      preview, Apply to my diagram (roles bound to the selection or picked), Insert the example,
      Open it. Save as concept from a selection; your concepts (drafts and account diagrams with a
      `concept:` section) appear beside the built-in ones. The assistant can set scaling and
      apply concepts.
- [x] **C9 Docs, tests, browser journeys, screenshots, verification.**
