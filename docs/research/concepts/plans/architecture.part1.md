# Architecture plans, part 1

Stage 2 plans for `catalog/architecture.md` groups 1 to 4, in catalog order. Another part covers
groups 5–10 with the same shared visual language.

## Shared visual language

Services are rounded boxes, each with a small database cylinder attached directly beneath it
when it owns its data; no line ever joins two different services' cylinders. A monolith is one
large box whose internal modules are tiles; calls between tiles are short internal arrows, and a
change to one tile sends a highlight hopping across the other tiles it's coupled to (see
**ripple**, below). Teams are small groups of figures, each group one colour matching the part(s)
of the system they own. Requests are dots travelling along arrows (**token**). Domain boundaries
and bounded contexts are softly coloured regions drawn around the elements inside them
(**boundary**). An API gateway is a gate drawn at the system's edge, between outside clients and
the services behind it. Change over time — migration, growth, a workflow's timeline — uses a
timeline strip or lane running left to right along the bottom (**lanes**). A deploy is a box
flashing once as its new version ships (**restyle**).

Two notes on the technique vocabulary:

- **ripple (new)**: a change to one element visibly propagates, one hop at a time, to every
  other element it's coupled to — the signature move for showing hidden or hidden-away coupling
  (a shared database, a tightly bound module, a distributed monolith). Distinct from plain
  **path trace** (which highlights a route something already takes) because a ripple shows a
  _consequence_ spreading through connections that weren't necessarily on any single path.
- **scrub**: reused from `plans/data.part1.md` (the viewer drags a playhead, or steps a beat at
  a time, through a sequence) — used once here, for `event-sourcing`, to replay a log to any
  point in its history.

## Architecture styles

### Client-server (`client-server`)

**The aha**: One server holds the shared data and logic; many clients come and go, always
talking to it, never to each other. The price of that central authority: it is the one thing
everybody depends on.
**Misconception to defeat**: That it's the same as peer-to-peer with extra steps, or that
"server" means one physical machine.
**Cast**: A rounded server box, centre, with a small database cylinder attached. Three client
boxes, left, in a loose row. Arrows from each client to the server only; none between clients.
**Opening frame**: Three clients, one server, three arrows converging on it, nothing moving.
_"Many clients, one shared server."_
**Story**:

1. Client A sends a dot along its arrow to the server; the cylinder glints and a reply dot
   returns. _"Request, response."_
2. Client B appears, draws its own arrow to the server, and does the same. _"Any number of
   clients can join."_
3. Client A disappears (closes its connection); the server and its data are untouched.
   _"Clients come and go..."_
4. The server box flashes a new version and carries on serving the remaining clients, none of
   which changes. _"...the server persists and holds the truth."_
5. The cost: the server goes dark (red). Every arrow stalls at once; the clients sit useless,
   though nothing is wrong with them. _"One place everyone depends on."_
6. The server box unfolds into three copies behind one front door; the clients still see a single
   address. _"'Server' is a role, not one machine. Copies fix the outage, not the dependency."_
   **The moment**: Beat 5 — the star with its centre gone: every client stops together. That is
   what "central authority" costs, and what peer-to-peer (`peer-to-peer`) trades away.
   **Interaction**: Add or remove clients (arrows always land on the server, never each other);
   switch the server off and watch all clients stall.
   **Ending**: Back to the star, settled, cylinder calm. _"One place that knows everything."_
   **Variants**: `monolithic-architecture`, `peer-to-peer`, `n-tier-architecture`.
   **Techniques**: appear/disappear, token, restyle, failure, caption.

**Review**: Improved — dropped the peer-to-peer side-by-side (that plan owns it; this beat gave the
contrast away before the viewer had felt the problem) and replaced it with the server outage
(the cost of centralisation) plus the "server = role, replicated copies" beat that defeats the
one-machine misconception, which was named but never shown. Weighed keeping the mesh contrast;
worse, because it explained the alternative instead of this style's trade-off.

### Monolith (`monolithic-architecture`)

**The aha**: One deployable box contains every feature and talks to one database; it all ships
together. That is genuinely simple (one deploy, in-process calls, one transaction) until the
parts need different lives.
**Misconception to defeat**: That "monolith" means badly built or can't scale; it only describes
how it deploys.
**Cast**: One large rounded box, "Order App", holding feature tiles: Catalog, Cart, Checkout,
Shipping. One database cylinder attached underneath. A deploy pipeline icon beside it.
**Opening frame**: The big box, four tiles inside, one cylinder underneath. _"Everything, one
box, one database."_
**Story**:

1. Cart calls Checkout with a short internal arrow, no network icon, and both write to the
   cylinder in one commit that succeeds or fails whole. _"Plain function calls. One transaction.
   Nothing to coordinate."_
2. A developer edits only the Shipping tile; the whole box flashes as it redeploys, and a caption
   ticks "whole app: 6 min". _"Change one tile, ship them all..."_
3. A bug in Shipping crashes the process; all four tiles go dark together. _"...and fail
   together."_
4. A traffic spike hits Checkout only; two identical full boxes appear beside the first (clones),
   every one carrying all four tiles and all pointing at the same cylinder. _"Scale the busy tile
   by copying everything."_
5. The cylinder's meter climbs; extra boxes stop helping. _"And the one database is still the
   shared limit."_
   **The moment**: Beat 4 — one hot tile, three full boxes of mostly idle tiles. (Honest framing: the
   copies work fine; they are just wasteful, and that matters only when load or teams diverge.)
   **Interaction**: Click a tile to "change" it and watch the whole box flash; drag a load dial and
   watch whole clones appear.
   **Ending**: Three full clones, most of each idle. _"Simple to build and ship. Costly when the
   parts need different lives."_
   **Variants**: `modular-monolith`, `microservices-architecture`, `microservice-premium`,
   `big-ball-of-mud`.
   **Techniques**: contents, restyle, clone, meter, dial, failure, caption.

**Review**: Improved — opened with the strengths (in-process call, single transaction) so the
"not badly built" misconception is defeated by a beat rather than a caption; added the
shared-fate crash and the shared-database limit; removed "clumsy to scale", which overstated the
case (cloning a monolith is a legitimate strategy). Weighed a pure "deploy pain" story; it hides
why teams choose monoliths. Deploy time labelled illustrative.

### Modular monolith (`modular-monolith`)

**The aha**: Modules inside one deployable are strongly walled off, each owning its own data and
exposing a defined interface, so you get service-like ownership without the network — but they
still deploy and fail as one, and the walls only hold if something enforces them.
**Misconception to defeat**: That modules are just folders, or that this is secretly
microservices.
**Cast**: One large box. Inside, four tiles — Catalog, Cart, Checkout, Shipping — each with its
own small cylinder (its own schema, in practice possibly one database server), and a thin wall
between tiles. Arrows between tiles cross only at labelled ports. A small "build check" gate
sits on the walls.
**Opening frame**: The box, four walled tiles, four small cylinders. _"Same one box. Each part
keeps its own data."_
**Story**:

1. Cart tries to query Checkout's cylinder directly: the build check turns red and the arrow
   bounces off the wall. _"Reaching in is a build error, not a code-review hope."_
2. Cart instead calls Checkout's labelled port; a short internal arrow crosses cleanly. _"Only
   through the interface."_
3. A developer changes Checkout's internals; only that tile flashes — Cart stays calm because it
   only knew the port. _"Change inside a wall, nothing outside notices."_
4. The whole outer box still flashes at deploy, and a bug in Shipping still darkens every tile.
   _"Still one deployable. Still one fate."_
5. Checkout detaches into its own box. The short internal arrow at its port stretches into a
   network arrow with a timer on it. _"The seam is ready. The network is the price."_
   **The moment**: Beat 1 against `monolithic-architecture`'s free-for-all — the same reach-in is
   simply impossible here, and beat 3's flash stays inside one wall.
   **Interaction**: Try to cross a wall directly (bounces) versus through a port (succeeds); click
   "extract module" for beat 5.
   **Ending**: Checkout half-detached, port lines stretched but intact. _"A microservice already has
   a shape, if you ever need one."_
   **Variants**: `monolithic-architecture`, `microservices-architecture`, `coupling-and-cohesion`,
   `strangler-fig`.
   **Techniques**: contents, restyle, failure, zoom, move, timer, caption.

**Review**: Improved — made the "not just folders" claim visible by showing the wall enforced by a
build check; made the cost explicit (shared deploy and shared crash, the network appearing on
extraction); modules' data noted as schemas, not necessarily separate servers. Weighed leading
with the extraction story; it frames the style as a stepping stone and hides that it is a
destination in its own right.

### Layered / N-tier architecture (`n-tier-architecture`)

**The aha**: Horizontal layers — presentation, business logic, data — each call only the one
below. It separates technical concerns cleanly, but one business feature usually cuts through
every layer, and putting layers on separate tiers adds a network hop per boundary.
**Misconception to defeat**: Confusing a logical layer with a physical tier, or mistaking this
horizontal split for microservices' vertical one.
**Cast**: Three stacked horizontal bands — Presentation, Business logic, Data access — with a
database cylinder below the bottom band. Short arrows point only downward between adjacent
bands.
**Opening frame**: Three clean horizontal bands, arrows pointing down. _"Each layer calls the
one below."_
**Story**:

1. A request dot enters Presentation, drops to Business logic, drops to Data access, touches the
   cylinder, and climbs back up. _"A call passes through every layer."_
2. Presentation tries to reach the cylinder directly, skipping layers: the arrow is blocked. _"No
   skipping down."_
3. A swap: the cylinder is replaced by a different database; only the Data-access band flashes.
   _"The payoff: change a technology in one layer."_
4. "Add a discount field" lights a thin vertical strip across all three bands. _"But a business
   change cuts through every layer."_
5. The same stack is redrawn as three machines (web server, app server, database server), and
   each downward arrow gains a network timer. _"Layers are logical. Tiers are machines, and every
   tier boundary is a network hop."_
   **The moment**: Beat 4 — one vertical strip lighting all three horizontal bands, beside
   `service-decomposition`'s single lit box for the same kind of change. (Not a claim that
   microservices never span services; only that the cut follows the business.)
   **Interaction**: Toggle "logical layers / physical tiers" to see one process or three machines,
   and the hop timers appear.
   **Ending**: The vertical strip fading, all three bands dim again. _"Split by technical concern,
   not by what changes together."_
   **Variants**: `monolithic-architecture`, `microservices-architecture`, `service-decomposition`,
   `hexagonal-architecture`.
   **Techniques**: token, failure, spotlight, toggle, timer, caption.

**Review**: Improved — dropped the side-by-side with a one-box microservice change (it implied a
feature never spans services; false) and cross-linked `service-decomposition` instead; added the
positive beat (swap the data layer) so the trade-off is two-sided; made the tier cost (network
hops) visible. Weighed keeping the contrast with microservices here; worse, since the real
contrast belongs to the decomposition plan.

### Microservices (`microservices-architecture`)

**The aha**: Small, independently deployable services, each owning one business capability and
its own data, let each team ship and scale on its own — at the cost of distributed-systems
problems replacing in-process ones. What differs from a monolith is the deployment unit, data
ownership and team autonomy, not the size.
**Misconception to defeat**: That microservices are just "small monoliths" or automatically
better; the point is independence, not size, and it has a bill.
**Cast**: Four rounded service boxes — Catalog, Cart, Checkout, Shipping — spread apart, each
with its own database cylinder. Thin network arrows (not internal ones) connect them. Four small
team-figure groups, one colour each, standing by their service. A small "ops ledger" at the
bottom: pipelines 4, dashboards 4, on-call rotas 4.
**Opening frame**: Four separated boxes, four cylinders, four coloured teams. _"Each team owns
one box and its data."_
**Story**:

1. The Shipping team changes and redeploys only the Shipping box; it flashes alone. _"Change one,
   ship one."_
2. Checkout gets a traffic spike; only its box clones. _"Scale only what's hot."_
3. Checkout needs a customer's name: no join across the gap, so a token crosses the network to
   Cart. It's slow (timer), then fails (red). Checkout stalls. _"No shared tables. Every arrow is
   a call that can be slow or fail."_
4. Placing an order must update Cart, Checkout and Shipping: three cylinders, no single
   transaction. One update fails; the others have already committed. _"No cross-service
   transaction: you design for partial failure."_
5. The ops ledger counts up as boxes were added. _"Four of everything to build, run and watch."_
   **The moment**: Beat 3 — the same arrow that gave independence in beat 1 is a liability: a
   network call that can simply not come back.
   **Interaction**: Pick a service to change or fail; watch which boxes react (deploys stay local,
   failures spread along call arrows).
   **Ending**: Four boxes, one flashing, three calm; one network arrow lit red. _"Independent to
   change. Interdependent to run."_
   **Variants**: `modular-monolith`, `distributed-monolith`, `database-per-service`,
   `synchronous-call-chain`, `microservice-premium`.
   **Techniques**: restyle, clone, token, timer, failure, meter, caption.

**Review**: Improved — removed the side-by-side recap (beat 5 repeated beat 1) and spent the slot
on the two costs the plan promised but never showed: no cross-service transaction, and the
operational ledger. Checked: independent deploy/scale/data are the defining differences. Weighed a
"team autonomy first" opening; kept ownership colours in the cast but led with deploy, because it
is the beat a newcomer can see.

### Service-oriented architecture (SOA) (`service-oriented-architecture`)

**The aha**: SOA puts the smarts in the middleware — one enterprise service bus routes,
transforms and orchestrates between shared, reusable services; microservices moved that
intelligence back into the services themselves ("smart endpoints, dumb pipes"). The cost of
SOA's version: the bus, and the team that runs it, becomes the centre everything waits on.
**Misconception to defeat**: That SOA and microservices are the same thing at different sizes.
**Cast**: Centre, a thick horizontal bar, "Enterprise Service Bus", with gears on it (routing,
transform, orchestrate). Several service boxes above and below it with no integration logic of
their own, each marked "shared, reusable".
**Opening frame**: Services around a busy, gear-laden bus. _"One smart bus between services."_
**Story**:

1. Service A sends a request shaped one way; it enters the bus, a gear transforms its format, and
   it exits shaped for Service B. _"The bus translates and routes."_
2. The bus's orchestration gear calls three services in a fixed sequence it controls. _"It even
   decides the order."_
3. A team needs a change to the workflow; a queue of change requests forms at the one bus team.
   _"Every change goes through the middle."_
4. The bus flashes red under load or failure; every service's traffic stops. _"One smart middle,
   one point of failure."_
5. Toggle to microservices: the gears vanish from the bus (now a plain pipe) and reappear on each
   service. _"Smart endpoints, dumb pipes."_
   **The moment**: Beat 5 — the gears physically migrating off the bus and onto the boxes is the
   whole difference. Beat 3 supplies the reason it happened.
   **Interaction**: Toggle between "SOA" and "microservices" layouts and watch where the gears sit
   and where the queue of change requests forms.
   **Ending**: Two small diagrams, gears on the bus versus gears on the boxes. _"SOA: reuse and
   central control. Microservices: team independence."_
   **Variants**: `microservices-architecture`, `api-gateway`, `service-mesh`.
   **Techniques**: token, restyle, contents, toggle, failure, caption.

**Review**: Improved — "dumb services" was wrong (SOA services were substantial); replaced it with
"no integration logic"; added the organisational cost (central bus team becomes the bottleneck)
that actually explains why the industry moved, instead of only load. Checked: ESB routing,
transformation and orchestration are the classic SOA roles. Weighed a timeline "SOA then
microservices" framing; the gear migration is sharper.

### Serverless application architecture (`serverless-architecture`)

**The aha**: Design shifts from servers to events: small, stateless functions fire when
something happens, and all state lives in the managed services around them. You trade control
(limits, cold starts, lock-in) for not running servers.
**Misconception to defeat**: That this is just "small microservices", or the billing model
(that's Fundamentals) rather than how you shape the app.
**Cast**: A row of small function icons (ƒ), each dormant (greyed, flat). Around them, managed
services: a queue, a storage bucket, a database, an API gateway. Event arrows connect services to
functions. A small "limits" panel: timeout, concurrency.
**Opening frame**: Grey, flat functions; the managed services around them lit and waiting. _"No
servers running. Just triggers waiting."_
**Story**:

1. An upload lands in storage; an event arrow fires, a function pops up solid, runs, writes to
   the database, and flattens again. _"A function exists only while it works."_
2. A hundred uploads land at once; a hundred copies pop up in parallel. The count stops rising at
   a ceiling line. _"Scale is more copies, up to a limit."_
3. The first pop-up is slow (timer, "cold start"); the next ones are instant. _"Starting from
   nothing costs a moment."_
4. A function tags a note on itself. A second event reaches the same function: the note is there,
   once. A third lands on a fresh copy: no note. _"Sometimes it remembers. You can't count on it —
   state lives in the services."_
5. A long job's timer runs into a wall at the timeout and the function is cut off; the job is
   re-drawn as small steps joined by queues. _"Long work gets split: functions are short by
   design."_
   **The moment**: Beat 4 — the note surviving once and vanishing the next time shows why state
   cannot live in the function, even when it sometimes seems to work.
   **Interaction**: Trigger an event and watch a function pop up, run and flatten; leave a note and
   see it survive or vanish depending on which copy is hit.
   **Ending**: All functions flat again, services around them holding everything that matters.
   _"Events in, managed state around, nothing idle."_
   **Variants**: `web-queue-worker`, `twelve-factor-app`; fundamentals' `serverless-computing`.
   **Techniques**: restyle, token, clone, timer, appear/disappear, caption.

**Review**: Improved — the old beat 5 was a billing meter, which the plan's own misconception said
this concept is not about; replaced with the architectural cost (execution limits force splitting
work). Beat 2 now shows a concurrency ceiling, and beat 4 shows warm reuse honestly ("sometimes
remembers"), which is the real trap. Weighed a "cost at steady load exceeds a server" beat;
that is economics and belongs in fundamentals.

## Specialist styles and processing patterns

### Web-Queue-Worker (`web-queue-worker`)

**The aha**: Keep the user-facing front end fast by never doing slow work inside a request —
push it onto a queue for workers to process asynchronously, so each tier scales on its own. The
costs: the result arrives later, and a message can be delivered more than once.
**Misconception to defeat**: That this is "microservices with extra steps"; it's usually just two
roles, often sharing a database.
**Cast**: Left, a "Web" box taking client requests. Centre, a queue drawn as a row of waiting
message cards. Right, a "Worker" box pulling from the queue. A shared database cylinder beneath
both Web and Worker (one deployable each, one database).
**Opening frame**: Client arrow into Web, empty queue beside it, idle Worker. _"Requests in.
Nothing slow happens here yet."_
**Story**:

1. A client uploads a video; Web replies instantly "accepted" and drops a message card in the
   queue. _"The front end never waits."_
2. More cards arrive than Worker finishes; the queue lengthens. _"The queue absorbs the burst."_
3. Worker pulls a card, chews on it (timer), writes the result to the database, and the client's
   "processing..." changes to "done" on its next check. _"The slow part runs off to the side; the
   answer comes later."_
4. A Worker dies mid-card; after a timeout the card reappears and another Worker takes it — the
   video is processed, twice partly. _"At-least-once: workers must tolerate repeats."_
5. Web traffic spikes: Web clones, queue and Worker untouched. Later the queue grows: Worker
   clones, Web untouched. _"Each tier scales for its own reason."_
   **The moment**: Beat 5 — two tiers growing at different times, for different reasons, because the
   queue decouples them.
   **Interaction**: Dial request rate and worker count separately; watch the queue length respond to
   the gap between them; kill a worker and watch the card return.
   **Ending**: Queue drained, both tiers sized to their own load. _"Fast tier, slow tier, a queue
   between."_
   **Variants**: `pipes-and-filters`, `microservices-architecture`; messaging's
   `queue-based-load-leveling`, `competing-consumers`.
   **Techniques**: token, contents, clone, timer, failure, dial, meter, caption.

**Review**: Improved — added the two costs that were absent (the answer is asynchronous; redelivery
means duplicates), and the shared-database two-role shape now visibly answers the "microservices
with extra steps" misconception. Weighed leading with the scaling decoupling; kept the user-wait
opening because it shows the reason before the mechanics.

### Pipes and Filters (`pipes-and-filters`)

**The aha**: A task is split into independent filter steps joined by pipes; each filter does one
job, and the slowest one sets the whole chain's throughput.
**Misconception to defeat**: Confusing this with a CI/CD pipeline or a data ETL job specifically
— it's the general shape underneath both.
**Cast**: A horizontal chain of four boxes — Decode, Resize, Watermark, Encode — joined by thin
pipes. A stream of items enters on the left. A throughput meter at the exit.
**Opening frame**: Four filters in a row, pipes between them, empty. _"Each box does one
transformation."_
**Story**:

1. One image enters Decode, flows through each filter in turn, exits transformed at Encode.
   _"Independent steps, one flow."_
2. Resize is swapped for a sharper version mid-stream, and a new "Strip metadata" filter is
   inserted; the others don't change, as long as the pipe's shape stays the same. _"Replace or add
   one filter. Only the pipe format is shared."_
3. Items keep streaming; a queue of waiting items builds up in front of Watermark, while the
   others sit empty and the exit meter flattens at Watermark's speed. _"One slow filter, and
   items pile up before it."_
4. Watermark clones into three parallel copies; the backlog drains and the meter rises to the next
   slowest filter's rate. _"Scale the bottleneck, not the whole chain."_
5. The four boxes relabel in turn as "lint, build, test, deploy" and "extract, transform, load";
   the same chain shape remains. _"A CI pipeline and an ETL job are this shape."_
   **The moment**: Beat 3 into 4 — the pile-up in front of one box, then the rate recovering only
   once that one box is cloned (and capping at the next slowest).
   **Interaction**: Pick which filter to clone and watch throughput respond, or not, depending on
   whether it was the bottleneck.
   **Ending**: An even stream through all four, no pile-ups. _"As fast as the slowest filter — until
   you scale it."_
   **Variants**: `web-queue-worker`, `big-compute`; messaging's stream processing concepts.
   **Techniques**: stream, contents, clone, meter, restyle, caption.

**Review**: Improved — removed the "reorder the filters" beat (Decode must come first; claiming
free reordering is wrong) and replaced it with swap/insert, which is true provided the pipe format
holds; converted the CI/ETL misconception from a claim into a relabel beat; meter now shows the
cap at the next slowest filter. Weighed a pure bottleneck story; adding composability keeps the
style, not just the throughput law.

### Scheduler Agent Supervisor (`scheduler-agent-supervisor`)

**The aha**: A scheduler drives a multi-step distributed workflow, agents wrap each remote call,
and a supervisor watches recorded state to retry or roll back stuck steps — making multi-step
work recoverable even when the thing driving it dies. The catch: a retry may repeat work, so
steps must be safe to repeat.
**Misconception to defeat**: That "it'll probably just work" is a plan, or that retry logic in
each caller is the same thing as a supervisor.
**Cast**: A "Scheduler" box holding a step list (Reserve → Charge → Ship). Each step calls
through a small "Agent" box to a remote service. A durable log cylinder, outside the Scheduler,
records each step's state. A "Supervisor" box watches the log from above.
**Opening frame**: Step list at "Reserve", agent idle, log empty, supervisor watching. _"A plan,
a log, and a watcher."_
**Story**:

1. Scheduler tells Agent-Reserve to call Inventory; the log records "Reserve: in progress".
   _"Every step is written down before it runs."_
2. The call succeeds; the log updates "Reserve: done", Scheduler moves to Charge. _"State moves
   forward, durably."_
3. Agent-Charge calls Payments, and the Scheduler crashes (red) while it waits. Nothing reports
   an error; the log still reads "Charge: in progress", ageing. _"The driver is gone. The record
   isn't."_
4. Supervisor sees the entry older than its threshold. It restarts the step with the same
   idempotency key, so a late first charge isn't repeated. _"Stale for too long: retry, safely."_
5. If Payments says it can't charge, Supervisor instead undoes Reserve (log: "rolled back").
   _"Or undo what was done."_
   **The moment**: Beat 3 into 4 — the scheduler dies mid-step and no code in the caller can retry,
   yet the workflow resumes, because the state lived outside whoever was driving.
   **Interaction**: Choose where a step hangs or the scheduler dies, and whether the supervisor
   retries or compensates; watch the log and downstream steps react.
   **Ending**: Log reads all steps "done" or cleanly "rolled back" — never stuck. _"Recoverable
   because every step was written down."_
   **Variants**: `web-queue-worker`; messaging's `saga`, `durable-execution`,
   `choreography-vs-orchestration`.
   **Techniques**: contents, token, timer, failure, restyle, spotlight, caption.

**Review**: Improved — the old beat 3 let a timer "catch" the stall in the caller, which blurred
the point; now the scheduler itself dies, which is what a caller-side retry loop cannot survive
and defeats the "retry in each caller" misconception on screen. Added the cost (retries repeat
work, so idempotency). Weighed a plain timeout/retry framing; it can't show why the log has to
live outside the driver.

### Microkernel (plug-in) architecture (`microkernel-architecture`)

**The aha**: A minimal core provides only the essentials and a plug-in registry; everything that
varies lives in independent plug-ins added without touching the core. Plug-ins are only as safe
and stable as the contract the core offers them.
**Misconception to defeat**: Confusing this with a modular monolith (modules are peers; here one
core is privileged and plug-ins are optional extras) or microservices (usually no network
between them).
**Cast**: A small hexagonal "Core" box in the centre holding a short list: "load, save, render".
A ring-shaped "Registry" around it. Plug-in tiles — Spell-check, Dark theme, Export-to-PDF — slot
into sockets on the ring. The sockets carry a small "plug-in API v1" label.
**Opening frame**: Core alone, empty registry ring, no plug-ins. _"The core does almost nothing
on its own."_
**Story**:

1. Spell-check slots into a socket; the registry lights its entry. Core calls it when text
   changes. _"A plug-in adds one capability."_
2. Dark theme and Export-to-PDF slot in, each unaware of the others. _"Plug-ins don't know about
   each other."_
3. Export-to-PDF is unplugged and Export-to-EPUB plugged in; Core is untouched. _"Swap what
   varies, never touch the core."_
4. A plug-in running inside the core's own process crashes — and the whole Core goes dark with
   it. Rewind: the plug-ins now run in a separate "host" process; the same crash is contained to
   its tile. _"Isolation is a choice you pay for. Editors and browsers pay for it."_
5. The core ships "API v2"; two old plug-ins turn red. _"The contract is the cost: change it and
   every plug-in feels it."_
   **The moment**: Beat 4 — the same crash, first taking down the core, then contained once plug-ins
   live behind a process wall.
   **Interaction**: Plug and unplug tiles; toggle "in-process / isolated host" and crash a plug-in
   to see the blast radius.
   **Ending**: Core steady, a changed set of plug-ins around it. _"What varies lives outside; what's
   essential stays small."_
   **Variants**: `modular-monolith`, `sidecar-pattern`.
   **Techniques**: contents, appear/disappear, failure, toggle, spotlight, caption.

**Review**: Improved — the old beat 4 claimed plug-in failure never harms the core, which is only
true with process isolation; now shows both, plus the real cost (the plug-in API as a frozen
contract). Dropped the relabel-to-real-examples beat (VS Code extensions run in a separate host
process, which beat 4 now covers). Weighed keeping the real-product beat; names add recognition
but not understanding.

### Space-based architecture (`space-based-architecture`)

**The aha**: Take the database out of the request path — processing units hold replicated
in-memory data and handle requests directly, while the database catches up asynchronously in the
background — so extreme, spiky load never waits on disk. The cost: the memory grid is a
consistency and durability problem you now own.
**Misconception to defeat**: That this is just caching; here the in-memory grid is the primary
store for the transaction, not a read shortcut to a database that still takes every write first.
**Cast**: A ring of "Processing unit" boxes, each holding a slice of an in-memory grid (lit
squares) plus a replica of a neighbour's slice. A "Virtualized middleware" layer coordinating
them. Below, a database cylinder connected by a dashed "data pump" line, with a small "lag"
meter.
**Opening frame**: Processing units busy, grid lit, database quiet below, dashed line idle.
_"Requests never touch the database directly."_
**Story**:

1. A flash sale starts: a surge of request dots, each handled entirely inside the grid —
   reserve a ticket, update a count — all in memory. _"All the action happens in memory."_
2. The data pump streams the changes to the database, behind the grid; the lag meter shows a gap.
   _"The database catches up afterward."_
3. One processing unit fails (red); its replica takes over its slice and requests keep flowing.
   _"The grid, not one machine, is the store."_
4. If the failure strikes before the pump has drained, the lagging writes exist only in the
   replica; a second failure now would lose them. _"The lag is the risk window."_
5. Contrast inset: the same spike against a database-in-the-path design — its cylinder turns red
   and requests queue outside it. _"There, the database is the bottleneck. Here, it isn't in the
   loop."_
   **The moment**: Beat 1 against the inset in beat 5 — identical spike, one system sailing through
   in memory, the other jammed at its database.
   **Interaction**: Drive the load dial up and compare both designs' response times, and watch the
   lag meter grow with load.
   **Ending**: Grid calm, the dashed line still slowly draining into the database. _"Survive the
   spike now, settle the data later."_
   **Variants**: scaling's caching concepts (contrast); `event-sourcing` (async persistence,
   different motivation).
   **Techniques**: contents, token, stream, failure, meter, side by side, dial, caption.

**Review**: Improved — "no request dropped" overclaimed, since the database is behind by the pump
lag; added the lag meter and beat 4 (data in flight is vulnerable) to make the trade-off honest,
and moved the contrast inset last so it reads as the payoff. Weighed a cache vs primary-store
side-by-side; kept the inset since the load difference is the visible, memorable part.

### Peer-to-peer (`peer-to-peer`)

**The aha**: Every node is both client and server, sharing directly with other peers with no
central authority, so there's no single point to overload — but discovery, trust and consistency
all get harder.
**Misconception to defeat**: That removing the server removes the hard problems — it just moves
them onto every peer.
**Cast**: A ring of identical peer boxes, no centre box at all. Each peer holds its own small
data fragment. Thin arrows connect peers directly to whichever others they're talking to,
shifting over time.
**Opening frame**: Six identical peers in a ring, a few arrows already connecting some pairs.
_"No server. Every box is the same kind of thing."_
**Story**:

1. Peer C asks Peer A for a file fragment it holds; a token travels directly, no middle box.
   _"Peers serve each other directly."_
2. Peer A is switched off (disappears); the others keep serving each other from their own
   fragments. _"No single box to lose."_
3. A new peer joins and has to ask several existing peers just to find who has what it needs —
   several arrows fan out before one answers. _"Finding anything takes its own protocol — there's
   no directory."_
4. Two peers claim different values for the same shared fact (both glow, mismatched). _"With no
   central authority, who's right?"_
5. A third arrives from an unknown peer carrying a corrupted fragment; the receiver cannot tell
   it from a good one until it checks a signature. _"Nobody vouches for anyone: trust is yours to
   build."_
   **The moment**: Beat 4 — two peers disagreeing, with no server to adjudicate, makes the trade
   concrete.
   **Interaction**: Switch off any peer and see the rest keep going; try to resolve beat 4's
   disagreement and find there is no built-in referee.
   **Ending**: The ring, missing one peer, still functioning. _"Resilient by having no centre — and
   harder for exactly the same reason."_
   **Variants**: `client-server`, `space-based-architecture`.
   **Techniques**: token, appear/disappear, failure, spotlight, caption.

**Review**: Improved — dropped the client-server side-by-side (now owned by that plan's outage
beat, and its caption conflated "data loss" with "server down") and added trust (corrupted peer) as
the third hard problem the aha lists but the story never showed. Checked: discovery (DHT or
bootstrap), consistency and trust are the standard costs. Weighed keeping the contrast; it
repeated the cross-link at the cost of a missing beat.

### Big compute (HPC) (`big-compute`)

**The aha**: Embarrassingly parallel tasks scale almost linearly across cores the cloud lets you
rent by the thousand for just the job — so the bill barely changes while the wait collapses.
Tightly coupled tasks need fast interconnects because the nodes must keep talking.
**Misconception to defeat**: Confusing this with "big data" (bound by data volume, not raw
compute) or ordinary autoscaling web apps.
**Cast**: A tiny input file icon feeding a "Scheduler" box that splits one big job into many task
tiles. A grid of hundreds of core squares, lighting up as they take tasks. A time meter and a cost
meter. For the tightly-coupled case, thick "interconnect" lines between a cluster of cores.
**Opening frame**: A small input file, one huge job, an empty core grid. _"A small question that
needs enormous arithmetic."_
**Story**:

1. The job splits into a thousand independent task tiles; the scheduler hands them out, one per
   core, almost all lighting at once. _"Independent tasks: just add cores."_
2. The time meter falls in step with the core count; the cost meter stays flat (1,000 cores for 1
   hour costs about what 1 core costs for 1,000). _"Same bill, a thousand times sooner."_
3. The grid empties at the end; cores were rented only for the job. _"Rent thousands of cores,
   briefly."_
4. Contrast case: a tightly coupled simulation where each core swaps results with its neighbours
   every step; thick interconnect lines appear, and a latency meter on them now matters.
   _"Tasks that must keep talking need a fast network, not just more cores."_
5. One slow link drags the whole cluster's progress down, and extra cores now buy less speed-up
   while the cost meter rises. _"Add cores here and the bill grows faster than the speed."_
   **The moment**: Beat 2 versus beat 5 — the same "add more cores" move gives near-linear speed-up at
   flat cost in one case, and a throttled, costlier run in the other.
   **Interaction**: Toggle "independent tasks / tightly coupled" and drag the core count; watch time
   and cost respond, or not.
   **Ending**: Grid empty, job done, cost shown only for the rental window. _"Scale by the thousand,
   briefly — if the tasks don't need to talk."_
   **Variants**: `pipes-and-filters`; Data's big-data concepts (contrast).
   **Techniques**: clone, meter, failure, toggle, side by side, dial, caption.

**Review**: Improved — added the cost meter (flat bill, collapsing time) as the real reason
rented parallelism matters, and the coupled case now shows rising cost, not just a slower link;
opening frame makes the "small input, huge compute" shape explicit, which is what separates it
from big data. Weighed a classic Amdahl serial-fraction framing; kept it out for economy, but
the coupled case shows the same limit.

## Decomposition and boundaries

### Coupling and cohesion (`coupling-and-cohesion`)

**The aha**: Good boundaries keep things that change together in one place (high cohesion) and
keep the connections between places few and stable (loose coupling) — nearly every pattern in
this area is pushing toward that. Some coupling is unavoidable; the goal is to make it thin and
deliberate.
**Misconception to defeat**: That "coupling" just means "calls another thing" — it's about how
much, and how brittle, that dependency is.
**Cast**: Two small systems side by side. Left, "Tangled": four tiles with thick, crossing
arrows between every pair. Right, "Clean": four tiles grouped into two boxes of two, with one
thin arrow between the boxes.
**Opening frame**: Tangled left, Clean right, both doing the same job. _"Same four parts,
arranged differently."_
**Story**:

1. "Add a field to Orders": in Tangled, a ripple runs through all four tiles' thick arrows. In
   Clean, it touches only the two tiles already grouped together. _"A change that travels
   everywhere, or stays local."_
2. In Tangled, one tile is renamed and three others break (red) because they reached into its
   internals. _"Tight coupling: a change elsewhere breaks you."_
3. In Clean, the same rename inside one box leaves the thin arrow untouched, even though a steady
   stream of calls crosses it. _"Many calls can still be loose coupling: only the outside shape
   matters."_
4. Zoom into one of Clean's boxes: its two tiles do clearly related work (both pricing). _"High
   cohesion: what's grouped belongs together."_
5. Zoom into a mis-grouped box: pricing and shipping crammed together for no reason; changes to
   one keep lighting the other. _"Low cohesion: grouped for no good reason."_
   **The moment**: Beat 1's ripple, side by side — the same change lighting up the whole Tangled
   diagram versus a tidy corner of Clean.
   **Interaction**: Pick a tile to rename and watch which other tiles break, in each diagram.
   **Ending**: Clean's diagram, calm, the thin arrow between its two boxes. _"Group what changes
   together. Thin the rest."_
   **Variants**: `service-decomposition`, `distributed-monolith`, `modular-monolith`,
   `big-ball-of-mud`.
   **Techniques**: ripple, side by side, zoom, failure, token, spotlight, caption.

**Review**: Improved — the "coupling is not just calling" misconception was named but never
defeated; beat 3 now streams many calls across Clean's thin arrow while a rename breaks nothing.
Checked: cohesion and coupling definitions are the standard ones. Weighed a "Lego vs glue"
metaphor; the ripple is the platform's signature move and shows consequence, which a metaphor
cannot.

### Service decomposition (by business capability or subdomain) (`service-decomposition`)

**The aha**: Split vertically by what the business does, not horizontally by technology, so a
typical feature change lands inside one service instead of touching every layer.
**Misconception to defeat**: That splitting by table or by technical layer counts as
decomposition — the cut has to follow the business, not the stack.
**Cast**: A big box of business capabilities as labelled regions: Orders, Payments, Shipping.
Two candidate cuts drawn as dashed lines: one vertical (through the regions), one horizontal
(across UI/logic/data strips layered over the same regions).
**Opening frame**: The box with both candidate cuts sketched faintly. _"Where do you draw the
lines?"_
**Story**:

1. The vertical cut solidifies: three service boxes emerge, one per capability, each a full
   vertical slice (its own UI bits, logic, data). _"Cut by capability: each service does one
   business thing, start to finish."_
2. "Add free shipping over $50" lights the Shipping box; one thin arrow also lights to Orders for
   the order total. _"A business change, almost one box."_
3. Undo; the horizontal cut solidifies instead: UI, Logic, Data strips, each spanning all three
   capabilities. _"Cut by layer instead..."_
4. The same change now lights a strip in each of the three layers, and each strip is a different
   team's. _"...and the same change touches every team."_
5. A finer version: Orders splits into "Order placement" and "Order history", because they change
   for different reasons at different rates. _"Capabilities can split further, by subdomain."_
   **The moment**: Beat 2 versus beat 4 — the identical business change, one box plus a thin arrow
   against three layers.
   **Interaction**: Toggle between the vertical and horizontal cut and re-run the same change to
   compare blast radius.
   **Ending**: The vertical cut, three capability boxes, one lit by the last change. _"Cut along
   what the business does."_
   **Variants**: `n-tier-architecture`, `domain-driven-design`, `bounded-context`,
   `coupling-and-cohesion`.
   **Techniques**: boundary, toggle, spotlight, side by side, caption.

**Review**: Improved — beat 2 claimed a change lands in exactly one box, which is rarely true; the
thin arrow to Orders keeps it honest (cut well and most changes stay in one box, not all). Beat 4
now ties the cost to teams. Checked against `n-tier-architecture`: a layered split is fine inside
a team's box, wrong as the service cut. Weighed a "split by table" counter-example; layers are
the more common mistake.

### Service granularity (`service-granularity`)

**The aha**: Smaller isn't automatically better — independent scaling, fault isolation and team
ownership pull services apart, while shared transactions, chatty calls and shared data pull them
back together. Things that always change and deploy together belong in one service.
**Misconception to defeat**: Measuring "micro" by lines of code or box count rather than by what
actually needs independence.
**Cast**: A horizontal slider from "Coarse" (two large service boxes) to "Fine" (fifteen tiny
service boxes), both ends showing the same total business logic. Four force arrows below the
slider: two pushing right ("scale independently", "fault isolation"), two pushing left ("shared
transaction", "chatty calls"); a fifth, "team ownership", added later. Three indicators: checkout
latency, blast radius, teams per box.
**Opening frame**: The slider at a middle position, forces balanced. _"How big should each box
be?"_
**Story**:

1. Drag toward Fine: boxes multiply; one box under heavy load now scales alone, cheaply.
   _"Independent scaling pulls toward smaller."_
2. Still at Fine: a checkout flow now crosses five tiny boxes, each call a network hop; the
   latency indicator climbs and a request dot stutters across all five. _"Chatty calls pull back
   toward bigger."_
3. Drag toward Coarse: the five merge into one box; the same flow is one fast in-process call,
   but the blast-radius indicator grows — a bug in that box can take everything down. _"Fewer
   network calls, less fault isolation."_
4. The five boxes, still separate, are shown always deploying together in lockstep: they snap
   into one. _"If they always change and ship together, they were one service."_
5. Ten small teams appear; at Coarse several share one box and collide. _"Team count pulls
   toward smaller."_
   **The moment**: Beat 2 into 3 — the same checkout flow, five slow hops collapsing into one fast
   call while the blast-radius indicator swells: one gained, one lost, in one drag.
   **Interaction**: Drag the slider and watch latency, blast radius and teams-per-box move in
   opposite directions.
   **Ending**: The slider left at a position that balances the forces for this system, neither
   extreme. _"Size for the forces, not for 'smaller is better'."_
   **Variants**: `microservices-architecture`, `coupling-and-cohesion`, `microservice-premium`.
   **Techniques**: dial, token, meter, spotlight, caption.

**Review**: Improved — the old plan had no specific moment ("the slider itself"); beat 2 into 3 is
now the beat, and beat 4 defeats the lines-of-code misconception by showing a box count that
collapses when boxes always deploy together. Weighed a "Goldilocks" story with a fixed answer;
rejected, because the right size depends on the system's forces, which the slider makes the
subject.

### Domain-driven design (DDD) (`domain-driven-design`)

**The aha**: Software structure should mirror the business, in the business's own language (the
ubiquitous language), with large domains explicitly split into bounded models — DDD's strategic
half is what actually draws the boundaries.
**Misconception to defeat**: Treating DDD as database modelling, or as something only
microservices need — it predates them and applies just as well inside a monolith.
**Cast**: A conversation scene: a domain expert figure and a developer figure at a whiteboard,
between them a growing diagram of boxes and labels in business words ("Policy", "Claim",
"Premium" — not "Table", "Row", "Field").
**Opening frame**: Blank whiteboard, the two figures facing it. _"Model the business, in its own
words."_
**Story**:

1. The expert says "a policy covers a claim"; "Policy" and "Claim" appear as boxes with a line
   between them. _"The model comes from the conversation, not the schema."_
2. The developer tries a generic word, "Record" — the expert frowns, crosses it out, writes
   "Claim" again. _"One precise language, used by experts and code alike."_
3. The whiteboard splits in two as the expert explains that Sales and Support mean different
   things by "customer"; each region gets its own "Customer" box. _"Where the language really
   differs, the model splits too."_
4. The two regions are dropped into a single deployable box as two modules, then pulled apart
   into two services. Either way, the regions stay as drawn. _"The boundary comes from the
   model, not from how you deploy it."_
5. A plain admin screen with no rules sits off to one side, left undrawn. _"Not everywhere: DDD
   earns its effort where the domain is complex."_
   **The moment**: Beat 3 into 4 — the whiteboard split becoming a boundary that survives both a
   monolith and services; this is the strategic idea, ahead of vocabulary.
   **Interaction**: Offer a generic label and watch it get rejected in favour of the domain's own
   word; drag the two regions between a monolith and separate services.
   **Ending**: Two labelled regions on the board, each consistent inside itself. _"The business's
   language, drawn as a map."_
   **Variants**: `bounded-context`, `ddd-aggregate`, `event-storming`, `context-map`.
   **Techniques**: appear/disappear, boundary, move, caption.

**Review**: Improved — the moment moved from the crossed-out word (a vocabulary detail) to the
split that survives any deployment shape, which defeats the "only microservices" misconception on
screen; added the cost (DDD pays off in complex domains, not CRUD). Weighed leading with the
tactical building blocks (entities, value objects); rejected, as they are not what draws
boundaries.

### Bounded context (`bounded-context`)

**The aha**: The same word can legitimately mean different things in different parts of a
business — give each meaning its own model and boundary rather than forcing one shared model
that suits nobody.
**Misconception to defeat**: Assuming a bounded context is just a microservice (it is a model
boundary; services are one way to deploy it) or the same as a subdomain (a subdomain is a part of
the business problem; a context is your solution's model of it).
**Cast**: A single "Customer" box swollen with fields from both worlds: lead score, deal stage,
ticket history, SLA tier, many greyed out depending on who looks. Later, two softly coloured
regions, "Sales" (warm) and "Support" (cool), each with its own Customer box.
**Opening frame**: One fat "Customer" box with Sales and Support figures both reaching into it.
_"One word, one model, trying to please everyone."_
**Story**:

1. Sales' figure sees only half the fields as useful, Support's the other half; the rest grey out
   each time. A change for Support breaks a Sales screen. _"Fitting neither well, and every
   change collides."_
2. The box splits along a new line into two regions with lean boxes: Sales' Customer has "lead
   score, deal stage"; Support's has "ticket history, SLA tier". _"Split it: each context keeps
   only what it needs."_
3. A request crosses from Sales into Support carrying a customer ID; at the boundary it's
   translated into Support's own shape. _"Crossing the line means translating, not sharing."_
4. Someone in Support tries to read Sales' "deal stage" directly: the boundary blocks it, red.
   _"Each model only means something inside its own line."_
5. Both regions are placed inside one deployable box: still two contexts. _"A context is a
   model boundary, not a deployment."_
   **The moment**: Beat 1 into 2 — the swollen box, fields greyed out, splitting into two boxes that
   each fit cleanly.
   **Interaction**: Drag the "Customer" concept across the regions and watch its shape change at the
   boundary.
   **Ending**: Two clean regions, translation happening only at the line. _"One word, two true
   meanings, two models — the cost is translating between them."_
   **Variants**: `domain-driven-design`, `context-map`, `anti-corruption-layer`,
   `core-supporting-generic-subdomains`.
   **Techniques**: boundary, failure, restyle, path trace, caption.

**Review**: Improved — the opening frame gave away the answer (already split); it now starts with
the swollen shared model so a newcomer sees the problem first. Beat 5 defeats "context equals
microservice" on screen, and the garbled subdomain note is fixed. Added the cost (translation at
the boundary, some duplicated data). Weighed a dictionary-word metaphor ("bank" as riverside or
institution); the Customer example is more realistic for software.

### Core, supporting and generic subdomains (`core-supporting-generic-subdomains`)

**The aha**: Classify parts of the domain as core (what differentiates you), supporting (needed,
specific to you) or generic (solved problems like payments or identity) — then spend your best
effort only on the core, and buy the generic. The classification belongs to your business, not
to the technology.
**Misconception to defeat**: Treating every part of the system as equally worth custom-building,
or treating "generic" as "unimportant" (it is essential, just not where you win).
**Cast**: A target with three rings: a small bright centre labelled "Core" (e.g. "Route
optimization" for a delivery company), a middle ring "Supporting" ("Driver scheduling"), an outer
ring "Generic" ("Payments", "Identity", "Email"). A small team-figure group and an effort meter
per ring.
**Opening frame**: Three rings, effort meters all equal. _"Treating everything the same."_
**Story**:

1. The Core meter climbs as the team's figures crowd into the centre, building custom logic.
   _"Pour your best people into what makes you different."_
2. Supporting's meter stays moderate; a smaller team builds it in-house without the same
   intensity. _"Needed, specific, but not where you win."_
3. Generic's ring greys as vendor logos slot in — "Stripe", "Okta" — replacing custom builds.
   _"Buy the solved problems."_ A small badge notes the price: integration and lock-in.
4. Contrast inset: the company building custom payments and identity itself, its Core meter near
   empty because everyone is stuck on the outer ring. _"The thing that makes you different
   starves."_
5. Swap the company for a payments provider: "Payments" slides to the centre and the vendor logos
   move out. _"The ring depends on the business, not on the technology."_
   **The moment**: Beat 4's inset — the inverted effort distribution, proving where the waste goes.
   **Interaction**: Drag team figures between rings and watch each ring's output quality and cost;
   swap the company type and watch the rings relabel.
   **Ending**: Team concentrated at the centre, vendor logos on the outside ring. _"Differentiate at
   the centre. Buy the edges."_
   **Variants**: `bounded-context`, `domain-driven-design`.
   **Techniques**: meter, move, restyle, spotlight, side by side, toggle, caption.

**Review**: Improved — added beat 5 (a payments company's core is payments), which defeats the
"generic means unimportant / technology-based" reading and shows the classification is relative;
named the cost of buying (integration, lock-in); swapped Auth0 for Okta (the product moved under
that brand). Checked: Evans's three kinds. Weighed a "build vs buy" table framing; the target
shows where effort goes.

### Aggregate (`ddd-aggregate`)

**The aha**: An aggregate is the transaction and consistency boundary — change one aggregate per
transaction, refer to others only by ID, and accept eventual consistency between them, usually
via domain events. The price: rules that span aggregates can't be guaranteed instantly.
**Misconception to defeat**: Treating a database table, or an ORM's whole object graph, as the
aggregate — the aggregate is whatever one root enforces rules over, which is often smaller.
**Cast**: An "Order" aggregate: a root box "Order" containing child boxes "Line item" ×3 inside
its boundary. Outside, a "Customer" box connected only by a thin dashed line "customerId: 42".
Behind, a faint tangle linking Order to Customer, Products, Warehouse as a loaded object graph.
**Opening frame**: The whole object graph highlighted, Orders attached to everything. _"Load
everything related and call it one thing?"_
**Story**:

1. The highlight shrinks to Order plus its line items; the other links become dashed ID
   references. _"Smaller: only what must stay consistent together."_
2. "Add a line item": the whole boundary pulses once, as a single transaction. _"One transaction,
   one aggregate."_
3. Two users add items at once; the root's rule "total under $10,000" holds because the second
   commit is rejected on a version check. _"The boundary is where the rule can be enforced — and
   where concurrent edits collide."_
4. Someone also tries to change Customer's address in the same transaction: by design, refused at
   the dashed line. _"Other aggregates: by ID, never in the same transaction."_
5. After commit, "OrderPlaced" travels to an Inventory aggregate, slightly later. _"They catch up
   afterward — eventual consistency."_
   **The moment**: Beat 3 — two simultaneous edits, one rejected: the boundary is what lets a rule
   hold, not a grouping convenience.
   **Interaction**: Try to change two aggregates in one transaction and watch it refused; follow the
   event in beat 5 to its effect.
   **Ending**: Order boundary calm, the event landed on Inventory. _"One boundary, one transaction;
   the rest happens afterward."_
   **Variants**: `bounded-context`, `event-sourcing`, `database-per-service`, `cqrs`.
   **Techniques**: boundary, failure, token, path trace, spotlight, caption.

**Review**: Improved — the old plan named the "whole object graph" misconception but never showed
it; it now opens on it and shrinks it. The old moment (a blocked cross-aggregate write) is a
design rule, not a physical wall; the concurrent-edit rejection is a real mechanism and shows
why the boundary exists. Weighed keeping the blocked-write as the moment; it teaches the rule
but not the reason.

### Context map (`context-map`)

**The aha**: How bounded contexts and the teams behind them relate — partnership, shared kernel,
customer/supplier, conformist, anti-corruption layer, open host/published language, separate
ways — is a design decision about influence, made visible on one map.
**Misconception to defeat**: Mistaking this for a deployment or network diagram — it maps models
and team relationships, not infrastructure.
**Cast**: Several softly coloured regions (bounded contexts), each labelled with a team-figure
group. Lines between regions, each styled by relationship type: a thick equal line
"Partnership", an upstream-to-downstream arrow (U above D), a shield icon "Anti-corruption
layer", a dashed line "Separate ways". A small "who has influence?" arrow on each.
**Opening frame**: Five regions, plain unlabelled lines between them. _"Contexts exist. How do
they relate?"_
**Story**:

1. Sales → Billing becomes a "Customer / Supplier" arrow: Billing is upstream, but Sales is a
   customer whose requests go into Billing's plan. _"Upstream supplies. The customer has a say."_
2. Reporting → Billing restyles to "Conformist": Reporting has no say and simply adopts Billing's
   model. _"Same direction, no influence: conform."_
3. The line between Billing and the Legacy Mainframe gains a shield, "Anti-corruption layer":
   Billing translates and refuses to conform. _"Here we protect ourselves."_
4. Marketing and Analytics, once linked, fade to a dashed "Separate ways". _"Sometimes the right
   relationship is none."_
5. Zoom out: the labelled map shows which teams depend on which, and who can ask for change.
   _"A map of influence disguised as a technical diagram."_
   **The moment**: Beat 5 — the full map revealing the influence structure that was invisible as
   plain lines in the opening frame.
   **Interaction**: Click any line to see its relationship type, which side is upstream, and what
   each team can ask of the other.
   **Ending**: The completed, fully labelled map. _"Every line is a decision about influence, not
   just data flow."_
   **Variants**: `bounded-context`, `anti-corruption-layer`, `conways-law`.
   **Techniques**: boundary, restyle, path trace, zoom, caption.

**Review**: Improved — fixed a technical error: the old beat 1 said that in Customer/Supplier the
supplier's team "sets the terms, Sales conforms", which is the Conformist pattern; in
Customer/Supplier the downstream customer has real influence. Beat 2 now shows Conformist as the
contrast, so the distinction is visible. Weighed one beat per every pattern (nine); kept to four
that teach the axis (influence).

### Anti-corruption layer (`anti-corruption-layer`)

**The aha**: A translation layer between your clean model and a legacy or external one keeps the
foreign model from leaking in — and because all translation lives in one disposable place, it's
also a key migration tool. It is code you must build and run, and it adds a hop.
**Misconception to defeat**: Treating this as a plain adapter or facade at the same scale — here
it's protecting a whole domain model, not just one function call.
**Cast**: Your clean "Orders" region, softly coloured, on the right. A legacy mainframe box,
grey and angular, on the left, with ugly field names ("ORD_STS_CD", "CUST_NO"). Between them, a
shield-shaped box labelled "ACL".
**Opening frame**: Clean region right, legacy box left, shield between. _"Nothing foreign crosses
without passing through here."_
**Story**:

1. The legacy system sends one flat record, `ORD_STS_CD=3, CUST_NO, ADDR…`; the shield translates
   the code to `status: shipped` and splits the record into an Order and a Customer. _"More than
   renaming: it converts the model."_
2. Try routing a legacy field straight into your region, bypassing the shield: blocked, red.
   _"No shortcuts around the layer."_
3. The legacy system changes a field's meaning; only the shield's logic updates and your region
   never notices. _"Absorb legacy churn in one place."_
4. Over a timeline along the bottom, features move to the clean side, the legacy box shrinks, and
   the shield's rules dwindle until both vanish. _"Eventually, nothing left to translate."_
   **The moment**: Beat 3 — a legacy change that would ripple through your code instead dead-ends at
   the shield.
   **Interaction**: Change a legacy field's meaning and watch the shield absorb it; fast-forward the
   timeline to beat 4's retirement.
   **Ending**: Clean region alone, shield and legacy box gone. _"The layer did its job, then was
   thrown away."_
   **Variants**: `bounded-context`, `strangler-fig`, `context-map`.
   **Techniques**: boundary, token, failure, restyle, lanes, caption.

**Review**: Improved — "not a plain adapter" is now defeated in beat 1 (one record becomes two
domain objects, so it converts models, not just names); the cost is stated up front. Weighed
showing the layer failing as the moment; the dead-ended change is the benefit people buy it for.

### Event storming (`event-storming`)

**The aha**: Boundaries emerge from the flow of events — lay out a business process as a
timeline of what happened, and where the language or ownership changes along that timeline is
where bounded contexts, and services, split.
**Misconception to defeat**: That this is UML done by engineers alone — it's a live workshop
where domain experts drive, using sticky notes, not a diagramming notation.
**Cast**: A long horizontal timeline (orange notes = events: "Order placed", "Payment taken",
"Order shipped"). Blue notes for commands, small yellow for actors, lilac for policies, a
pink/red "hot spot" note for questions and conflicts. A loose crowd of figures around a wall:
mostly domain experts, one developer holding the markers.
**Opening frame**: A nearly empty wall, one orange note, a crowd of figures facing it. _"Start
with one thing that happened."_
**Story**:

1. More orange event notes get added along the timeline, roughly in order, overlapping and moved
   as people disagree. The expert figures place them; the developer asks. _"Lay out everything
   that happens, in the experts' words."_
2. Yellow actors and blue commands slot in just before the events they cause ("Customer" →
   "Place order" → "Order placed"). _"Who did what, causing which event."_
3. The crowd argues over "Order": Sales' and Fulfilment's figures define it differently; a hot
   spot note is stuck on it. _"Where people argue is itself a signal."_
4. A boundary is drawn across the timeline at that point, splitting it into two coloured regions.
   _"The language splits here — so does the system."_
   **The moment**: Beat 3 into 4 — the argument on the wall becoming the literal line on the
   diagram.
   **Interaction**: Drag event notes along the timeline to reorder the story; drop a boundary line
   anywhere and see what it would split.
   **Ending**: A timeline covered in notes, cut into labelled regions. _"The map drew itself, from
   what actually happens. It takes the right people in the room for a day."_
   **Variants**: `bounded-context`, `domain-driven-design`; messaging's domain events.
   **Techniques**: lanes, appear/disappear, move, boundary, caption.

**Review**: Improved — the experts now visibly drive and the developer holds markers (defeating
"UML by engineers"); added the hot spot note, which is the real mechanism behind beat 3, and the
cost (right people, a day). Checked: orange events, blue commands, yellow actors, lilac policies
are Brandolini's conventions. Weighed a before/after comparison with a UML sequence diagram;
the live wall is more memorable.

### Conway's law (`conways-law`)

**The aha**: Organizations design systems that mirror their own communication structure — team
boundaries become system boundaries whether you plan it or not, and the inverse Conway
manoeuvre shapes teams deliberately to get the architecture you want. It cuts both ways: the
architecture then constrains the teams.
**Misconception to defeat**: Treating this as a technical rule rather than a sociotechnical
observation about people, not code.
**Cast**: Two small team-figure groups, each a colour, each clustered near their own part of a
system diagram. Lines of communication between the team figures, mirrored by call lines between
the system parts they own. A timeline strip along the bottom.
**Opening frame**: Two teams, two system regions, matching colours, matching line pattern.
_"Teams talk the way their systems are wired. Or is it the other way round?"_
**Story**:

1. The two teams rarely talk (thin grey line); their system parts have almost no calls between
   them — a clean boundary, by accident. _"Little communication, a natural seam."_
2. A third team sits across both, messaging both constantly (thick lines); the system grows a
   tangled component straddling both regions. _"A team that spans two areas grows code that spans
   them too."_
3. Reorganise deliberately: the spanning team splits, one half per area, cutting the cross lines.
   On the timeline the tangled component only splits months later. _"Reshape the teams first —
   the inverse Conway manoeuvre — and the architecture follows. Slowly."_
   **The moment**: Beat 2 — a messy piece of architecture growing directly out of a team's
   communication pattern, unplanned.
   **Interaction**: Draw or erase communication lines between team figures and watch the system
   diagram's coupling redraw to match.
   **Ending**: Teams and system both split along the same lines. _"Shape the teams, and you've
   shaped the system."_
   **Variants**: `distributed-monolith`, `service-decomposition`, `microservice-premium`.
   **Techniques**: path trace, restyle, move, boundary, lanes, caption.

**Review**: Improved — added the lag on the timeline in beat 3 (reorganising teams is cheap, the
architecture follows slowly) and the reverse constraint in the aha; checked: Conway 1967, and the
inverse Conway manoeuvre is a later term. Weighed the classic "four teams, four-pass compiler"
anecdote; the spanning-team story shows mechanism where the anecdote only shows the outcome.

### Distributed monolith (`distributed-monolith`)

**The aha**: Splitting into separate services that still must be changed, deployed or scaled
together gives you all the costs of microservices and none of the independence — the worst of
both worlds. The test: can you deploy one alone?
**Misconception to defeat**: Assuming any system drawn as separate boxes with network arrows
between them is automatically independent.
**Cast**: Four service boxes, Catalog, Cart, Checkout, Shipping, drawn apart like microservices —
but all four sharing one database cylinder, and a dotted "must-deploy-together" lasso drawn
loosely around all four.
**Opening frame**: Four separate boxes, one shared cylinder beneath them all, the lasso around
all four. _"Looks split. Isn't."_
**Story**:

1. A developer changes Shipping's table in the shared cylinder; a red ripple flashes across
   Catalog, Cart and Checkout, which all read that same table. _"One schema change, every box
   affected."_
2. All four boxes redeploy together in lockstep, the lasso pulsing once. _"'Independent'
   services, deployed as one."_
3. Cause two, even with separate databases: a call chain Catalog → Cart → Checkout → Shipping. A
   slowdown in Shipping stalls the whole chain, and new fields need all four to upgrade together.
   _"Synchronous chains and lockstep versions bind them too."_
4. Checkout scales alone but hammers the shared cylinder, slowing Cart and Catalog. _"Can't scale
   one without straining the rest."_
5. Side by side with real microservices (separate cylinders, no lasso, calls that degrade
   gracefully): the same change lights one box. A bill appears: network hops, four pipelines,
   four on-call rotas. _"All the costs of services, none of the freedom."_
   **The moment**: Beat 1's ripple across all four boxes from a change meant to touch only one — the
   whole deception in one flash.
   **Interaction**: Try to deploy any one box alone (it won't work); make a change and compare how
   far the ripple and lasso reach against the microservices version.
   **Ending**: The four boxes, visually separate, the lasso still wrapped around all of them.
   _"Separate boxes. Shared fate."_
   **Variants**: `microservices-architecture`, `shared-database`, `coupling-and-cohesion`,
   `modular-monolith`.
   **Techniques**: ripple, failure, boundary, side by side, spotlight, token, caption.

**Review**: Improved — the old plan blamed only a shared database; synchronous call chains and
lockstep versioning are equally common causes, so beat 3 shows a second, database-free route to
the same fate. Beat 5 now states the bill (the "all the costs" half of the aha, never shown
before). Weighed building the plan around the "can you deploy one alone?" test; it became the
interaction instead.

### Big ball of mud (`big-ball-of-mud`)

**The aha**: A system with no discernible structure, where everything depends on everything,
decays without deliberate boundaries — and the DDD response is to fence the mud off so it stops
spreading, not to redesign it all at once.
**Misconception to defeat**: Equating this with "monolith" — a monolith can be cleanly
structured; a big ball of mud is specifically the absence of structure, in any style.
**Cast**: A tangled mass of tiles with arrows crossing every which way, no visible grouping —
genuinely hard to read. Beside it, a clean bounded-context region, softly coloured, with a thick
wall between it and the mass.
**Opening frame**: The tangled mass alone, unreadable. _"No boundaries left. Everything touches
everything."_
**Story**:

1. Trace one feature's logic through the mass: the highlight zigzags across a dozen tiles with
   no pattern. _"You can't find where anything 'lives'."_
2. The same tangle is redrawn as separate service boxes joined by network arrows: just as
   knotted, now slower. _"Services don't cure it. Mud is in any style."_
3. An attempt to redesign everything at once stalls — the highlight for "redesign everything"
   flashes and resets. _"Redesigning it all at once fails: too much to hold."_
4. Instead, a wall is drawn around one small piece, "Billing", with one narrow gate (translation
   in and out). _"Fence off one piece."_
5. Inside the fence order is restored; mud stays outside, for now. On a timeline another region is
   fenced, then another, the mass slowly shrinking. _"Fence by fence. It takes years, and the
   mud pays interest meanwhile."_
   **The moment**: Beat 3's failed all-at-once attempt against beat 4's single successful fence —
   proof that the fix is incremental, not a rewrite.
   **Interaction**: Try to "redesign everything" (always resets) versus drawing one fence (always
   succeeds).
   **Ending**: Two clean regions fenced off, the mass smaller but still present. _"Contain it, piece
   by piece."_
   **Variants**: `monolithic-architecture`, `bounded-context`, `anti-corruption-layer`,
   `strangler-fig`.
   **Techniques**: path trace, boundary, failure, lanes, caption.

**Review**: Improved — the "any style" claim is now a beat (the same tangle as networked services)
instead of a sentence; merged the two fencing beats to make room, and stated the cost (slow, and
mud keeps charging interest). Checked: "Big Ball of Mud" is Foote and Yoder (1997); Evans lists
it as a context-map pattern. Weighed a "how mud grows" story (deadlines, quick fixes); it is the
cause, but the fix is the lesson this plan owns.

## Data across services

### Database per service (`database-per-service`)

**The aha**: Each service owns its data privately, reached only through its own API or events —
exactly what makes services independently changeable, at the cost of no cross-service joins or
ACID transactions.
**Misconception to defeat**: Thinking the boundary is about separate physical servers — services
can share a server but must never share tables.
**Cast**: Three service boxes, Orders, Payments, Shipping, each with its own database cylinder
directly beneath it, no lines between the cylinders. A would-be cross-service SQL join query
drawn as a dashed arrow trying to span two cylinders.
**Opening frame**: Three boxes, three private cylinders, no lines between them. _"Each service's
data: visible only to it."_
**Story**:

1. Orders changes its own table's schema freely; Payments and Shipping don't react. _"Change your
   own schema, nobody else notices."_
2. The dashed cross-service join from Payments straight into Orders's cylinder is blocked, red,
   at the cylinder's edge. _"No reaching into someone else's tables."_
3. The three cylinders slide inside one database server's outline; the wall still stands between
   them and the blocked join stays blocked. _"Private data, not separate hardware."_
4. Payments asks Orders's API for what it needs; a token travels service to service, not table to
   table. _"Only through the owner's interface (or events)."_
5. A report needing all three makes three API calls and combines the answers itself — slower than
   one SQL join. Placing an order now updates two cylinders with no shared transaction. _"The
   price: no joins, no cross-service transaction."_
   **The moment**: Beat 2 — the blocked direct query, right at the edge of someone else's cylinder,
   makes the ownership rule visible as a wall, not a convention.
   **Interaction**: Try the direct cross-service query (always blocked) versus going through the API
   (always works, slower).
   **Ending**: Three private cylinders, one cross-service API call lit from the last report.
   _"Private data. That's what makes it independent."_
   **Variants**: `shared-database`, `api-composition`, `cqrs`, `microservices-architecture`.
   **Techniques**: boundary, failure, token, path trace, caption.

**Review**: Improved — added beat 3 so the "not about separate servers" misconception is defeated
on screen (cylinders inside one server still blocked), and extended the cost beat to the missing
transaction, not only the missing join. Weighed a cost-first framing; the wall first, price last
mirrors how teams discover it.

### Shared database (integration database) (`shared-database`)

**The aha**: Several services reading and writing the same tables is simple and keeps ACID
transactions, but the schema becomes a hidden contract — one team's change can break everyone
else, and no service deploys independently anymore.
**Misconception to defeat**: Confusing "database per service" with simply having several
databases on one physical server — the shared database problem is about shared tables, not
shared hardware.
**Cast**: One database cylinder in the centre, with a visible table grid inside. Three service
boxes, Orders, Payments, Shipping, all wired directly into the same cylinder, all reading and
writing the same rows.
**Opening frame**: One cylinder, three boxes wired into it. _"One database, read and written by
all three."_
**Story**:

1. Orders writes a row; Payments reads the same row an instant later, consistent, no composition
   needed. _"Simple. Transactional. Fast to build."_
2. Payments's team renames a column to tidy things up; red flashes in Orders's and Shipping's
   boxes, both quietly relying on the old name. _"A change in one place breaks the others — a
   hidden contract."_
3. The fix must ship in all three boxes at the same moment as the migration, in forced lockstep.
   _"Nobody deploys alone anymore."_
4. Side by side with database-per-service: the same rename flashes only inside the owner's box.
   A variant where each service has its own schema on one server is shown too: also contained.
   _"The fault is shared tables, not shared hardware."_
   **The moment**: Beat 2 — a well-intentioned tidy-up rippling red across two unrelated teams'
   boxes.
   **Interaction**: Rename a column and watch which boxes break; compare against the
   database-per-service version of the same action.
   **Ending**: Three boxes, still wired into the one cylinder, the rename finally absorbed
   everywhere. _"Easy now. Expensive to change."_
   **Variants**: `database-per-service`, `distributed-monolith`, `coupling-and-cohesion`.
   **Techniques**: contents, ripple, failure, restyle, side by side, caption.

**Review**: Improved — made the one-server misconception a beat (a separate schema on one server
is contained) rather than a caption; kept the strength in beat 1 so the trade-off is honest
(sensible for one team or a monolith). Fixed beat 3, which implied every box needs its own
independent deploy rather than a single coordinated one. Weighed adding performance coupling
(one service's query locking another's); noted but cut for economy.

### API composition (`api-composition`)

**The aha**: A composer answers a cross-service query by calling each service that owns part of
the data and joining the results in memory — no shared tables, but extra calls, in-memory joins,
and an answer that needs every service involved to be up.
**Misconception to defeat**: Confusing this with gateway aggregation (that's at the edge, for a
client) or a CQRS read model (that's pre-built, not assembled live).
**Cast**: A "Composer" box in the centre. Three service boxes around it — Orders, Payments,
Shipping — each with its own cylinder. A query arrives asking "order #42, full status". A small
availability readout: each service 99.9%.
**Opening frame**: Composer idle, three services around it, each holding its own slice of the
answer. _"No single place has the whole picture."_
**Story**:

1. The query enters the composer; three request tokens fan out to Orders, Payments and Shipping
   at once. _"Ask everyone who owns a piece."_
2. Three replies come back at different times; the composer waits for the slowest. _"Join them in
   memory, once all the pieces are in."_
3. The composer assembles one answer card and returns it. _"One answer, from three sources."_
4. Shipping's reply is delayed (timer); the whole composed answer waits. _"Only as fast as the
   slowest piece..."_
5. Shipping goes down (red); the answer has a hole or fails outright. The availability readout
   reads 99.9% x 3, about 99.7%. _"...and only as available as all three together."_
6. A report across ten thousand orders: the composer would fetch and join ten thousand rows
   in memory; the card sags under the weight. _"Fine for one order, painful for lists."_
   **The moment**: Beat 5 — one unavailable service turning a three-quarters-complete answer into a
   failed or incomplete one.
   **Interaction**: Slow down or fail one of the three services and watch the composed answer
   degrade or stall.
   **Ending**: All three replies in, one composed card. _"Cross-service reads, assembled live —
   fragile exactly where it spans the most."_
   **Variants**: `database-per-service`, `gateway-aggregation`, `cqrs`.
   **Techniques**: token, timer, failure, contents, meter, spotlight, caption.

**Review**: Improved — added the availability arithmetic (0.999 cubed is about 0.997) and the
large-result limit, the two reasons the aha says "extra calls" without proof; the misconception
about CQRS stays a cross-link (that plan shows the pre-built shape). Weighed contrasting with
the CQRS read model right here; kept it in the CQRS plan to stay one idea.

### CQRS (Command Query Responsibility Segregation) (`cqrs`)

**The aha**: Separate models — often separate stores — for writing data and for reading it, so
each can be optimized on its own; the cost is that the read side lags behind the write side.
**Misconception to defeat**: Assuming CQRS requires event sourcing (it doesn't, though they're
often paired) or that it's just a read replica (a replica copies the same model; CQRS's read model
can have a different shape entirely).
**Cast**: Left, a "Write model" box with a cylinder shaped for normalized writes (several linked
tables). Right, a "Read model" box with a flat cylinder of pre-joined "order summary" rows. A
sync arrow between them, with a small timer. Below, a plain read replica for contrast.
**Opening frame**: Write model and Read model, differently shaped, sync arrow idle. _"Two models.
Two shapes. One source of truth."_
**Story**:

1. A command "place order" writes into the Write model: normalized, transactional, instant.
   _"Writes go to the model built for writing."_
2. A query "show my order summaries" reads the flat Read model: no joins at read time. _"Reads go
   to the model built for reading."_
3. The replica below is shown copying the Write model's tables unchanged, so the same query still
   needs a join. _"A replica copies the shape. CQRS changes it."_
4. The sync arrow carries an "OrderPlaced" change to the Read model; the timer ticks a few
   hundred milliseconds. _"The read side catches up, not instantly."_
5. A user queries right after placing the order, before the arrow lands: the old summary shows.
   _"Read your own write too soon, and it looks stale."_
6. A moment later it returns the new summary. _"Eventual consistency."_
   **The moment**: Beat 5 — the exact window where the two models disagree, made visible.
   **Interaction**: Place an order and immediately query it, watching the lag; widen or shrink the
   sync timer to see the window change. A toggle collapses the stores into one database with two
   code paths: still CQRS, lag gone, benefit smaller.
   **Ending**: Both models agreeing, sync arrow calm. _"Different shapes for different jobs —
   briefly out of step."_
   **Variants**: `event-sourcing`, `api-composition`, `database-per-service`; data's materialized
   views.
   **Techniques**: contents, token, timer, restyle, toggle, side by side, caption.

**Review**: Improved — the replica misconception is now a beat (beat 3: a replica copies the
shape), and the interaction states the minimal form (one database, two code paths) so CQRS is not
mistaken for "two databases plus event sourcing". Weighed leading with the staleness; opening
on the two shapes shows the point (different models) before the cost.

### Event sourcing (`event-sourcing`)

**The aha**: Store the full, append-only sequence of state-changing events as the source of
truth, and derive current state by replaying them — you keep the complete history and "why", can
rebuild any view as of any point, and events are the natural thing to publish. The price: every
event shape lives forever, and reading current state needs projections.
**Misconception to defeat**: Confusing this with plain audit logging (a log is a side record;
here the log is the only truth) or change data capture (CDC watches a database that already holds
state; here there's no separate state to begin with).
**Cast**: A long append-only log of event cards: "AccountOpened", "Deposited $100", "Withdrew
$30", "Deposited $50". To the side, a "Current balance" box that's empty until events are replayed
into it.
**Opening frame**: A log of four event cards, the balance box empty. _"The truth is this list.
Nothing else."_
**Story**:

1. The events replay one at a time into the balance box: 0, 100, 70, 120. _"Replay the events,
   get the current state."_
2. Pause the replay after "Withdrew $30": the balance box reads 70 — the exact balance as of
   that moment. _"Rebuild state as of any point in time."_
3. A new requirement: "show total deposits only". A second box (a projection) replays the same
   log counting deposits: 100 + 50 = 150. _"Need a new view? Replay the same history
   differently."_
4. The $30 withdrawal was a mistake. Editing the card is refused; instead a new "Correction
   +$30" card is appended and the balance reads 150. _"You never edit history; you add to it."_
5. The log grows into the thousands; replay slows (timer) until a "snapshot" marker is dropped
   partway and replay restarts from there. _"Long histories are slow to replay — snapshots fix
   that."_
   **The moment**: Beat 2 — scrubbing to the exact state at any past moment, something a "current
   balance" column could never show.
   **Interaction**: Scrub the log's playhead to any point and watch the balance box show that
   moment's true state; add a new projection live; try to edit a card (refused).
   **Ending**: The log, long and complete, a snapshot marker partway along it, balance box current.
   _"Everything that ever happened, still here — and forever the shape you chose."_
   **Variants**: `cqrs`, `ddd-aggregate`; messaging's event-driven architecture, domain events.
   **Techniques**: contents, token, timer, scrub, clone, failure, caption.

**Review**: Improved — dropped "events to publish for free" (publishing needs a reliable mechanism
and the events become a public contract) and replaced it with the correction-event beat, which
shows append-only on screen and defeats "just an audit log" (you can't amend an audit log's
truth). Added the cost to the aha and ending. Checked arithmetic: 0, 100, 70, 120; deposits 150;
after correction 70 + 30 + 50 = 150. Weighed adding GDPR deletion as a cost beat; named in the
ending's "forever" instead.

### Valet key (`valet-key`)

**The aha**: The app hands a client a scoped, time-limited token to read or write one resource in
storage directly — taking the app's own servers out of the data path, with the token itself
limiting what can be done and for how long.
**Misconception to defeat**: Confusing this with a long-lived API key, or with the gatekeeper
pattern (there, every request still passes through a server).
**Cast**: A client box, left. An "App" box, centre, holding an "Issue key" gear but no file data.
A storage bucket, right, holding one object "video.mp4". A key-shaped token with a visible
countdown and a scope label ("write · this file only · 15 min").
**Opening frame**: Client, app, bucket, far apart; no connection yet. _"The app doesn't sit
between the client and the data."_
**Story**:

1. Client asks the app "I need to upload a video"; the app checks the client is allowed, then
   hands back the key, scoped and timed, without touching bytes. _"The app only authorizes."_
2. The client takes the token straight to the bucket; a thick upload stream flows directly,
   bypassing the app box. _"The heavy transfer skips the app completely."_
3. The client tries the token on a different file: blocked. _"Scoped: only what it says."_
4. The countdown reaches zero; a second upload bounces. _"Time-limited: it expires."_
5. The cost: before it expires, a copy of the token on another machine works the same. The app
   can't recall it, and never saw the bytes. _"Whoever holds it can use it; keep it short-lived."_
6. After the upload, the bucket sends the app an event, and it scans the file. _"Check afterward,
   because the app wasn't in the path."_
   **The moment**: Beat 2 — the direct, thick stream from client to bucket with the app box sitting
   untouched off to the side.
   **Interaction**: Try the token outside its scope, after it expires (both bounce), and from a
   second machine (works until expiry); compare against the long-lived key side by side.
   **Ending**: Token's countdown at zero, greyed out, the upload long since complete. _"A key for
   one valet, one task, one window of time."_
   **Variants**: `gatekeeper-pattern`; security's SAS tokens and presigned URLs.
   **Techniques**: token, stream, timer, failure, side by side, caption.

**Review**: Improved — the old plan showed only the benefits and a long-lived-key straw man;
beat 5 now shows the real cost (bearer tokens can't be recalled, so short life is the control) and
beat 6 the consequence of bypassing the app (validate after the fact). Checked: SAS tokens and S3
presigned URLs are scoped, expiring bearer URLs. Weighed keeping the long-lived-key side-by-side
as a beat; moved to interaction, since expiry already shows the contrast.
