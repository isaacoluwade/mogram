# AI systems plans, part 1

Stage 2 plans for `catalog/ai.md` groups 1 to 5, in catalog order. A second agent plans groups 6
to 10 in `ai.part2.md` with this same shared visual language.

## Shared visual language

The app and its users sit on the left. The model is a large rounded box in the middle, labelled
with its name (e.g. "LLM"). Text is a row of token chips — small rounded rectangles, one per
token — that stream out one by one. The context window is a fixed-size tray next to the model
box, divided into labelled compartments (system prompt, history, retrieved documents, tool
definitions, answer), that fills with chips and overflows from the oldest end. Embeddings are
points on a 2D "meaning map" where similar meanings sit close together (a flattened view of a
much higher-dimensional space). A vector database is a cylinder holding those points, each
carrying its source text and permission tags. Documents are page icons cut into chunk strips.
Tools are small boxes with a wrench; a tool call is an envelope travelling from model to tool.
GPUs are chips with a utilisation bar. Cost is a coin meter. Time-to-first-token and
tokens-per-second are stopwatch labels.

Conventions this part adds, for recurring beats inside groups 1 to 5: the model's weights are
drawn, when they need to be seen, as a grid of numbers inside the box (full precision shown as
long decimals, quantized precision as truncated digits); generating a token shows a probability
bar chart of candidate next chips popping up above the box, with one sampled and dropped onto the
output row; a quality or accuracy result is a labelled meter or badge (green check / red X) next
to the output it judges; a GPU's cold start is a visible multi-minute timer (provision, pull
weights, load) distinct from a request's millisecond timers. Two techniques from `data.part1.md`
are reused here: **split / merge** (a document dividing into chunks) and, where useful, **scrub**.

## Foundations: models, tokens and context

### Training vs inference (`training-vs-inference`)

**The aha**: Training adjusts weights in one big occasional job; inference runs the finished model per request, and for a popular model that per-request cost usually dominates spend.
**Misconception to defeat**: That inference is a smaller training run, or that the model relearns on every request.
**Cast**: Left, a "Training" factory: a huge mixed data pile feeding the model box, a weights dial inside it, a GPU cluster below with pinned-high utilisation bars, a calendar ("3 weeks") and a one-time coin stack. Right, "Inference": the same box, now labelled "LLM v1, frozen", a single user sending a prompt and getting a reply, one GPU chip flickering per call, a running coin meter.
**Opening frame**: The model box between an inert data pile (left) and a single waiting user (right); nothing running yet.
**Story**:

1. Training runs: data streams in, the weights dial spins and settles. "3 weeks, thousands of GPUs."
2. The box freezes: "weights locked — v1." The factory greys out.
3. Inference runs: one user's prompt tokens flow in, a quick flicker, tokens flow out. "Seconds, a slice of one GPU. Weights don't change."
4. More users appear one by one, each sending a prompt; the coin meter under inference starts climbing.
5. Zoom out after "a day": the inference meter has climbed far past training's one-time bar.
   **The moment**: Beat 5, the two totals side by side: training's spent, flat bar dwarfed by inference's still-climbing meter.
   **Interaction**: Dial "number of users" and watch the inference meter climb while training's cost stays fixed.
   **Ending**: Training grey and done; inference still climbing. "One build. Every use."
   **Variants**: `foundation-model`, `llm-token-costs`, `fine-tuning`.
   **Techniques**: contents, stream, meter, dial, restyle, side by side, caption.
   **Review**: Improved — an LLM reply takes seconds, not milliseconds; the inference beat now also says the weights stay frozen, which is the misconception.

### Foundation models and LLMs (`foundation-model`)

**The aha**: One general model, steered by what you feed it, replaces training a narrow model per task.
**Misconception to defeat**: That you need a different trained model for each task.
**Cast**: Left, "old way": three small task-specific boxes, each wired to its own narrow training pile ("Translate-bot", "Summarize-bot", "Classify-bot"). Right, "new way": one large box, "Foundation model", with an input slot on its left face.
**Opening frame**: The old way's three idle boxes, each dimly lit with one purpose.
**Story**:

1. Old way: three separate piles train three separate boxes in parallel, each taking weeks. "One model per task."
2. Switch: one box, already trained once on broad, mixed data (books, code, web).
3. A user types "translate this to French"; the box answers in French.
4. Same box, unmodified: another user types "summarize this"; it answers with a summary.
5. A third user attaches an image alongside text (multimodal), handled the same way; a dial shrinks the box to a "small language model" — "faster, cheaper, narrower."
   **The moment**: Beat 4 — the exact same box answering a different task with no retraining, against beat 1's three separate boxes.
   **Interaction**: Type different instructions into the slot and watch one model answer each.
   **Ending**: One box, instruction cards fanned beneath it. "Steered by what you ask."
   **Variants**: `training-vs-inference`, `llm-tokens`, `prompt-engineering`.
   **Techniques**: side by side, contents, token, restyle, dial, caption.
   **Review**: Keep — one box answering different tasks against three single-purpose boxes is the sharpest contrast; claims are accurate.

### Tokens (`llm-tokens`)

**The aha**: Tokens, not words or characters, are the unit everything is measured in.
**Misconception to defeat**: That the model reads words, or that cost and limits are counted in characters.
**Cast**: A sentence above a conveyor belt; a tokenizer blade cuts it into chips that don't align with word boundaries; each chip is stamped with an integer ID.
**Opening frame**: The plain sentence sitting over an empty, uncut belt.
**Story**:

1. The blade runs under the sentence; chips drop, some boundaries falling inside words.
2. Each chip is stamped with an ID (a quick word-to-integer flash).
3. A short word becomes one chip; a rare word becomes several — "roughly 3-4 English characters per token; each model family's tokenizer differs."
4. The belt feeds a meter: "context window: 12 / 8,000 tokens" — the chip count ticks up, not a character count.
5. A price tag drops per chip (output chips priced higher than input chips); the coin meter rises with chip count, not word count.
   **The moment**: Beat 3 — two similarly long words producing very different chip counts, breaking "words ≈ tokens."
   **Interaction**: Type any sentence and watch it cut into chips live, including surprises like emoji or non-English text costing more.
   **Ending**: The belt holds stamped chips, meter reading the count. "The unit of everything."
   **Variants**: `context-window`, `llm-token-costs`, `embeddings`.
   **Techniques**: token, contents, meter, caption, restyle.
   **Review**: Improved — tokenizer differences and input/output pricing made explicit; "3-4 characters" qualified as English.

### Context window (`context-window`)

**The aha**: Every call is a fresh, self-contained package built from scratch inside a fixed token budget; the model keeps nothing between calls.
**Misconception to defeat**: That a bigger context window means the model remembers past conversations.
**Cast**: The model box; beside it a fixed-size tray, "Context window: 8,000 tokens," with compartments (system prompt, history, retrieved documents, tool definitions, answer). The app sends a fresh request each turn.
**Opening frame**: An empty tray, compartments outlined, before message 1.
**Story**:

1. Turn 1: system prompt chips drop in, then the user's message; the model answers, answer chips also filling the tray.
2. The tray empties completely, a hard cut. "The model forgets everything."
3. Turn 2: the app rebuilds the tray — resending the system prompt, turn 1's message and turn 1's answer, then the new question. Fuller just to ask one more thing.
4. Turns continue; the tray creeps toward full. At turn N, the next request won't fit: the API rejects it, or the app trims. The app (not the model) cuts the oldest history chips, which the model then never sees. "The app decides what falls off."
5. Contrast inset: a small external "long-term memory" drawer the app can choose to write to and pull back — separate from the tray, reset fresh every call.
   **The moment**: Beats 2-3 — the tray emptying, then rebuilt by resending old turns, showing memory is the app's job.
   **Interaction**: Keep sending turns and watch the tray fill and overflow; try a bigger tray and see it still eventually overflows, just later.
   **Ending**: A full tray, oldest chips falling off. "Fresh every call. Fixed size."
   **Variants**: `llm-tokens`, `agent-memory`, `context-engineering`, `prompt-caching`.
   **Techniques**: contents, token, meter, appear/disappear, side by side, caption.
   **Review**: Improved — overflow does not silently drop the oldest turns in the model; the API errors or the app trims, so the beat now shows the app deciding.

### How an LLM generates text (next-token prediction and sampling) (`next-token-prediction`)

**The aha**: Generation is a loop that emits one token at a time, chosen from a probability guess, not looked up from storage.
**Misconception to defeat**: That the model retrieves a stored answer like a database or search engine.
**Cast**: The model box with a probability bar chart popping up above it each step: ranked candidate chips with bars. A sampled chip drops onto a growing output row. A temperature dial, a stop-sign icon.
**Opening frame**: The prompt's chips sitting in the tray; the output row empty.
**Story**:

1. The box computes; a bar chart of candidate chips fans out above it (the model scores its whole vocabulary, around 100k tokens; the chart shows the top few).
2. One chip is sampled and drops to the output row — not always the top bar, depending on the temperature dial.
3. That chip feeds back into the tray; the process repeats for the next position.
4. Temperature at 0: always the top bar, so the same prompt gives (nearly always) the same output. Temperature up: a lower bar sometimes wins — the same prompt run twice, side by side, gives two different answers.
5. A max_tokens meter fills; at the limit a stop sign halts the loop mid-sentence. Normally the model emits its own end-of-text token first.
   **The moment**: Beat 4 — the identical prompt run twice at high temperature, two different outputs side by side.
   **Interaction**: Dial temperature and top-p, rerun the same prompt, compare outputs; drag max_tokens down and watch the cutoff.
   **Ending**: The output row complete, halted by a stop token. "One probable token at a time, looped."
   **Variants**: `reasoning-models`, `llm-hallucination`, `llm-latency-streaming`.
   **Techniques**: contents, chart, token, dial, side by side, failure, caption.
   **Review**: Improved — temperature 0 is near-deterministic, not guaranteed; vocabulary scale shown; max_tokens cutoff separated from the model's own stop token.

### Reasoning models and thinking tokens (`reasoning-models`)

**The aha**: Reasoning spends extra tokens and time thinking before answering, buying accuracy on hard problems — a dial, not a free upgrade.
**Misconception to defeat**: That it's the same as asking an ordinary model to "show its steps" in the prompt.
**Cast**: The model box with a dim "thinking" scratchpad above it (grey chips, "not shown to the user") and a normal blue output row below. A thinking-budget dial, a stopwatch, a coin meter.
**Opening frame**: A hard question's tokens in context; both compartments empty.
**Story**:

1. Budget dial low: a few grey chips, then a quick final answer — wrong (red X).
2. Dial up: many grey chips stream in, briefly legible sub-steps, stopwatch running further, then a correct final answer (green check).
3. The coin meter and stopwatch both read higher for the high-budget run, even though the grey chips are hidden from the user (some providers show a summary): they are billed as output tokens.
4. Contrast inset: an ordinary model told "think step by step" writes its steps as ordinary blue output the user does see and does pay to read — "chain-of-thought prompting: visible, billed as a normal answer." A reasoning model is trained (with reinforcement learning) to use its scratchpad; the prompt trick only imitates it.
5. Dial to "off" for an easy question ("2+2") — correct instantly, no benefit from thinking.
   **The moment**: Beat 2 — the same question, low vs high budget, side by side: wrong-fast vs right-slower-costlier.
   **Interaction**: Drag the thinking-budget dial per question and watch accuracy, time and cost move together.
   **Ending**: The scratchpad fades, the final answer remains. "Thinking is tokens you pay for, turned up where it earns its keep."
   **Variants**: `next-token-prediction`, `llm-token-costs`, `llm-latency-streaming`.
   **Techniques**: contents, token, dial, timer, meter, side by side, spotlight, caption.
   **Review**: Improved — added that reasoning is trained behaviour, not just a prompt, and that hidden thinking tokens are still billed.

## ML lifecycle and MLOps

### ML lifecycle (`ml-lifecycle`)

**The aha**: It's a loop, not a line — a deployed model decays as the world changes, so monitoring feeds back into retraining.
**Misconception to defeat**: Treating it like the software development lifecycle, where code doesn't decay just sitting there.
**Cast**: A circular track with six stations: Frame problem, Collect & prepare data, Train, Evaluate, Deploy, Monitor, with an arrow looping from Monitor back to Collect data. A puck travels the loop. A world clock ticks in the centre.
**Opening frame**: The six-station ring, the puck at "Frame problem," clock at rest.
**Story**:

1. The puck moves station to station: data piles up, the weights dial spins, a score badge turns green, the puck becomes a live endpoint radiating to users.
2. The clock advances months; a faint second data pile ("real-world data, today") drifts from the original pile's shape.
3. At Monitor, an accuracy meter that had been flat starts sliding down as true outcomes arrive (labels lag), with no code changing.
4. The arrow from Monitor lights; the puck redraws back at Collect data, carrying the drifted pile with it.
5. Contrast inset: a software pipeline drawn as a straight line ending at "done," no return arrow, the same clock ticking beside untouched, still-correct code.
   **The moment**: Beat 3 against the inset — accuracy sliding purely from the clock, while the software's correctness line stays flat.
   **Interaction**: Scrub the clock forward and watch accuracy slide; click "retrain" and watch the puck loop back and the meter recover.
   **Ending**: The puck mid-loop, the Monitor-to-Collect arrow lit. "A loop that never really finishes."
   **Variants**: `mlops`, `model-drift`, `training-vs-inference`.
   **Techniques**: lanes, token, meter, chart, move, side by side, caption.
   **Review**: Improved — accuracy can only be measured once ground truth arrives; noted so the monitor beat is honest.

### MLOps: ML pipelines and continuous training (`mlops`)

**The aha**: You ship the pipeline that produces the model, not just the model, so retraining becomes a trigger instead of a manual project.
**Misconception to defeat**: That MLOps is DevOps CI/CD pointed at a different artifact.
**Cast**: A conveyor of stations — Ingest, Validate data, Transform, Train, Evaluate, Register, Deploy. Above it, three trigger buttons: a clock (schedule), a data pile (new data), a meter (accuracy drop). A maturity ladder: Level 0 (a hand pushing a cart), Level 1 (pipeline automated, with continuous-training triggers), Level 2 (plus CI/CD on the pipeline's own code), as in Google Cloud's MLOps levels.
**Opening frame**: Level 0 — a person manually carrying a model box from notebook to production, stations grey.
**Story**:

1. The conveyor runs end to end alone once started (the pipeline replaces the hand-carried steps), but still needs a push to "go."
2. Level 1: the trigger buttons wire to "go." The clock fires on schedule; the conveyor runs unattended.
3. New data arrives; it also fires "go" — a second automatic run.
4. The accuracy meter dips below a line; it fires "go" too, labelled "continuous training (CT)."
5. Level 2: a CI/CD badge appears on the pipeline's own code: a change to "Transform" runs its own tests before the pipeline may execute, separate from the model's evaluate station.
   **The moment**: Beat 4 — the drift meter itself pressing "go," no person involved.
   **Interaction**: Click each trigger independently; toggle maturity level 0/1/2 and see which triggers are wired.
   **Ending**: All three triggers live, conveyor idle, ready to fire itself. "Ship the pipeline, not just the model."
   **Variants**: `ml-lifecycle`, `model-drift`, `experiment-tracking`, `ml-model-registry`.
   **Techniques**: lanes, contents, meter, timer, token, restyle, toggle, caption.
   **Review**: Improved — maturity levels matched to the standard definition (continuous training is Level 1, CI/CD on the pipeline code is Level 2).

### Feature store (`feature-store`)

**The aha**: Computing a feature once, the same way, for training and serving prevents training-serving skew and lets teams reuse it.
**Misconception to defeat**: That it's a regular database or data warehouse.
**Cast**: One feature definition card ("avg_spend_30d = ..."). Two stores branch from it: "Offline store," a long shelf of timestamped historical rows ("full history, point-in-time correct"); "Online store," a small fast cache with the latest value per user. A training job pulls offline; a live endpoint pulls online.
**Opening frame**: The definition card, both stores empty beneath it.
**Story**:

1. The definition runs over raw events; rows stream into the offline shelf, each stamped with the moment it was true.
2. The same definition, run continuously, writes only the newest value per user into the online cache.
3. The training job pulls offline rows as of a past date (a point-in-time slider): it gets the value true back then, not today's. "No peeking at the future."
4. The live endpoint pulls the online cache's current value in milliseconds.
5. Contrast: with no store, training uses a SQL version of avg_spend_30d and the live service a hand-rewritten one; the same customer reads 41.2 in training and 38.9 in production, a mismatch glyph between them. That is training-serving skew. With the store, both read one definition.
   **The moment**: Beat 3 — dragging the slider backward and getting the value that was true then, defeating "just a database of current values."
   **Interaction**: Drag the point-in-time slider; toggle the shared definition against the ad hoc one to see the mismatch.
   **Ending**: One definition, two stores, both consumers fed consistently. "Computed once. Used everywhere, the same way."
   **Variants**: `ml-lifecycle`, `mlops`, `vector-search`.
   **Techniques**: contents, stream, token, side by side, dial, spotlight, caption.
   **Review**: Improved — the contrast is now actual training-serving skew (the concept's core), not another team's calculation.

### Experiment tracking (`experiment-tracking`)

**The aha**: Without recording what produced a result, you can't reproduce, compare or audit it.
**Misconception to defeat**: Confusing it with the model registry — every attempt, not just the chosen ones.
**Cast**: A row of run cards, each stamped with code version, data version, parameters and a metrics badge. A log book collects them. A leaderboard sorts by metric.
**Opening frame**: An empty log book; one run about to start.
**Story**:

1. Run 1 starts: its stamps appear before training finishes; the card slides into the log, metrics badge filling in live to "0.81."
2. Run 2: one parameter changes; a new card appears, identical except that field — ends at "0.84."
3. The leaderboard sorts all cards by metric; run 2 floats to the top.
4. "Reproduce run 2": its four stamps are copied out and rerun; the result lands within noise of 0.84.
5. Contrast: an unlogged run from last month, remembered only as "the good one" — a question mark where the stamps should be, impossible to rerun exactly.
   **The moment**: Beat 4 — the stamped card alone recreating the result, versus beat 5's shrug.
   **Interaction**: Click a card to see its full stamp; try to "reproduce" the unlogged run and get the question mark.
   **Ending**: A leaderboard of stamped cards, best one highlighted. "If it isn't stamped, it didn't happen."
   **Variants**: `ml-model-registry`, `mlops`, `model-shadow-and-ab-testing`.
   **Techniques**: contents, token, meter, spotlight, side by side, caption.
   **Review**: Keep — stamped card versus unlogged "the good one" is the right contrast, and the within-noise reproduction is honest.

### Model registry (`ml-model-registry`)

**The aha**: The registry is the hand-off between training and deployment — every production model is a named, approved, traceable version you can roll back to.
**Misconception to defeat**: Confusing it with a container registry, which stores images, not model lineage and approval.
**Cast**: A shelf of labelled boxes (fraud-model v1, v2, v3), each tagged with a lineage thread back to an experiment card, an evaluation badge, and a stage flag (Staging / Approved / Archived). A deployment arrow reaches only "Approved" boxes.
**Opening frame**: v1 on the shelf, flagged Approved, thread back to one experiment card; the endpoint running v1.
**Story**:

1. v2 arrives, flagged Staging — the deployment arrow doesn't reach it.
2. An approval stamp reviews v2's badge, passes it; the flag flips to Approved, the arrow swaps to v2; v1 flips to Archived but stays on the shelf.
3. v3 arrives, fails its evaluation badge (red X) — it never gets the stamp, never reaches the arrow.
4. The live endpoint misbehaves; v1's Archived flag flips back to Approved and the arrow re-points at it. "Rollback: re-point at a version already vetted."
5. Contrast inset: a container registry shelf holding generic images with no lineage, no badge, no stage flags — just "built: Tuesday."
   **The moment**: Beat 4 — rollback as re-pointing the arrow at an already-sitting, already-approved box, nothing rebuilt.
   **Interaction**: Click a box to trace its lineage; try to deploy a Staging box directly and watch the arrow refuse.
   **Ending**: v1 re-approved live, v2 archived beside it, v3's rejected box dim. "Named, approved, traceable, keepable."
   **Variants**: `experiment-tracking`, `mlops`, `model-shadow-and-ab-testing`.
   **Techniques**: contents, restyle, move, path trace, side by side, failure, caption.
   **Review**: Improved — the rollback target was Archived; the beat now re-promotes it, consistent with the ending.

### Model drift: data drift and concept drift (`model-drift`)

**The aha**: Nothing errored and the code didn't change, yet the model got worse because the world moved; only monitoring against a baseline reveals it.
**Misconception to defeat**: Confusing it with training-serving skew (present from day one), or assuming a silent failure must be a bug.
**Cast**: Two overlaid histograms: a dashed training-time baseline and a solid live curve. Below, a second pair for concept drift: input regions with arrows to labels, some arrows able to swap endpoint. An accuracy meter; a code box marked untouched.
**Opening frame**: Curves overlapping exactly, accuracy meter high, code box highlighted "no changes here."
**Story**:

1. Time ticks forward; the live curve slides away from baseline — younger customers arriving. "Data drift: the inputs changed shape."
2. The accuracy meter dips, unexplained by anything in the code box.
3. Switch to concept drift: input regions stay put, but a label arrow swaps which region it points to (yesterday's fraud pattern is now legit). "Concept drift: the right answer changed."
4. The accuracy meter dips further.
5. Monitors catch it: an input-distribution check against the baseline flags data drift at once (no labels needed); concept drift only shows when true outcomes arrive and accuracy is compared. The code box stays dim throughout.
   **The moment**: Beats 2/4 — accuracy sliding with the code box frozen and unedited the whole time.
   **Interaction**: Drag the live curve away from baseline and watch accuracy fall; toggle data vs concept drift.
   **Ending**: Live curve far from baseline, monitor red, code box pristine. "The world moved. The code didn't have to."
   **Variants**: `ml-lifecycle`, `mlops`, `model-shadow-and-ab-testing`.
   **Techniques**: chart, side by side, meter, timer, spotlight, caption.
   **Review**: Improved — data drift is detectable from inputs alone; concept drift needs delayed labels. The monitor beat now says so.

### Shadow deployment and A/B testing of models (`model-shadow-and-ab-testing`)

**The aha**: Offline scores don't guarantee production gains — shadow proves a new model is safe at no risk, A/B proves it's actually better on the metric that matters.
**Misconception to defeat**: Thinking these are just canary/blue-green releases of app code, where success is only an error rate.
**Cast**: Live traffic to Model A (current), lit green. A dimmed mirror path also sends a copy to Model B (shadow) below; its answers land in a sealed log, never reaching the user. A scoreboard compares both logs. Later, a splitter divides users between A and B, each with its own business-metric meter.
**Opening frame**: All traffic to A; a mirrored copy also reaching B, B's output landing in a log marked "user never sees this."
**Story**:

1. Requests stream; A answers users; B answers only its log, in parallel, at full volume.
2. The scoreboard tallies B vs A over thousands of real requests, no user touched by B (errors, latency, agreement with A; business outcomes can't be measured, since no user acted on B). "Shadow: as real as production, zero risk."
3. Switch to A/B: the splitter sends real users to B directly; its metric meter starts moving next to A's.
4. B's meter climbs above A's over days; a significance badge lights once the gap exceeds noise. Then a canary dial shifts traffic to B in steps (10%, 50%, 100%), watching for regressions.
5. Contrast inset: the same mechanics on an app-code canary, where the only meter is error rate — beside the model case's richer meters (accuracy, conversion), captioned "same mechanics, a different judge of success."
   **The moment**: Beat 2 — the shadow log filling with real-traffic answers no user ever sees.
   **Interaction**: Toggle shadow / A-B / canary; drag the canary dial and watch traffic shift with both meters live.
   **Ending**: B fully promoted, dial at 100%, A's meter now the dim one. "Proven safe, then proven better."
   **Variants**: `ml-model-registry`, `model-drift`, delivery's canary deployment.
   **Techniques**: stream, contents, meter, dial, side by side, toggle, caption.
   **Review**: Improved — shadow can't measure business metrics; A/B needs statistical significance, and the canary ramp is a separate step after it.

## Model serving and inference performance

### Model inference endpoint (`model-inference-endpoint`)

**The aha**: Serving a model is running a web service whose handler is a model: it needs the same scaling, health checks, auth and monitoring as any API, plus hardware the model fits on.
**Misconception to defeat**: Confusing the endpoint with the model file itself, or with the training job.
**Cast**: A load balancer, a row of replicas each holding "pre-process → model → post-process" on a GPU chip, an auth padlock at the door, a heartbeat on each replica.
**Opening frame**: Three healthy replicas; one inert model file sitting off to the side, unconnected, labelled "just weights on disk."
**Story**:

1. The inert file is loaded into a fresh replica: wrappers appear around it, its GPU chip lights up. "Packaging turns a file into a service."
2. A request (text plus an image) routes to a replica, is pre-processed, reaches the model, is post-processed on the way out.
3. One replica's heartbeat flatlines; the load balancer routes around it and the autoscaler starts a fresh one.
4. Load spikes: more replicas appear, each needing its own GPU chip — "hardware the model fits on, not just more CPU."
5. An unauthenticated request bounces off the padlock, never reaching any replica.
   **The moment**: Beat 1 — the same inert file, useless alone, becoming a service only once wrapped, scaled and exposed.
   **Interaction**: Kill a replica and watch traffic reroute; send an unauthenticated request and watch it bounce.
   **Ending**: Replicas healthy, traffic even, the model file clearly one ingredient inside each box. "A web service whose handler is a model."
   **Variants**: `batch-vs-realtime-inference`, `model-hosting-options`, `gpu-inference-scaling`.
   **Techniques**: contents, token, failure, restyle, meter, caption.
   **Review**: Improved — replacement is the orchestrator's job, not the load balancer's.

### Batch, real-time and asynchronous inference (`batch-vs-realtime-inference`)

**The aha**: Choose by how soon someone needs the answer — if nobody's waiting, batch is far cheaper and simpler than an always-warm endpoint.
**Misconception to defeat**: Confusing async inference with streaming (token-by-token delivery of one answer).
**Cast**: Three lanes. Real-time: a user waits, clock running, answer in milliseconds. Asynchronous: a user submits, gets a ticket, leaves; a notification arrives later. Batch: a stack of thousands of cards loaded overnight, processed on schedule, written to a file. A cost meter under each.
**Opening frame**: Three idle triggers — a chat bubble, a ticket stub, a calendar set to "nightly."
**Story**:

1. Real-time: one request, a tight stopwatch, answer under a second; the endpoint sits always warm, its meter ticking even when idle.
2. Async: a large document goes in, a ticket pops out, the user leaves; minutes later a result lands with a notification; the endpoint only runs for the job's duration.
3. Batch: a million rows load at 2am, process for hours at a discount badge ("~50% off"), results land by morning; no endpoint kept warm at all.
4. The three meters compare: real-time highest per item, batch lowest, longest wait.
5. Someone forces a million rows through the real-time lane: the queue backs up, latency balloons, cost spikes past batch's discounted line.
   **The moment**: Beat 5 — real-time struggling and costing more than batch for work nobody was waiting on.
   **Interaction**: Drag a workload onto each lane and watch latency and cost react.
   **Ending**: Each lane settled with its natural workload. "Choose by who's waiting."
   **Variants**: `model-inference-endpoint`, `llm-latency-streaming`, `llm-token-costs`.
   **Techniques**: lanes, timer, meter, token, contents, side by side, caption.
   **Review**: Keep — beat 5's misuse is the memorable failure; the ~50% batch discount matches major providers' batch APIs.

### Model hosting options: pay-per-token, provisioned throughput, self-hosted (`model-hosting-options`)

**The aha**: The choice is who pays for idle capacity — per-token suits spiky or low volume, provisioned suits steady high volume, self-hosting adds control at the cost of running GPUs yourself.
**Misconception to defeat**: Thinking these are just cheap-vs-expensive tiers rather than different bets on idle capacity.
**Cast**: Three columns. Pay-per-token (serverless, on-demand): a shared pool, a coin dropping per call, a quota ceiling. Provisioned: a dedicated lane, a flat monthly coin stack, a capacity meter that can sit empty or full. Self-hosted: owned GPU racks, your own weights file, an ops-team icon.
**Opening frame**: A spiky traffic graph above the three unselected columns.
**Story**:

1. Spiky traffic through pay-per-token: coins drop per burst; during quiet gaps the meter sits at zero. "Pay only when you call."
2. The same traffic through provisioned: the flat coin stack is already paid; the capacity meter sits mostly empty during gaps. "You paid for quiet, too."
3. Swap in steady, high, flat traffic and rerun provisioned: the capacity meter sits near full almost always — the same stack now looks cheap per token used.
4. Rerun the steady traffic through pay-per-token: the per-call meter, multiplied by huge steady volume, climbs past what provisioned would have cost.
5. Self-hosted lights up separately: the provider's quota ceiling is replaced by your own (the GPUs you bought), and an ops-team icon now watches GPU health, scaling and failures that used to be someone else's problem.
   **The moment**: Beats 2 and 4 — the same provisioned column flipping from wasteful to cheap purely because the traffic shape changed.
   **Interaction**: Drag the traffic-shape slider between spiky and steady and watch which column's total cost comes out lowest.
   **Ending**: The cheapest column highlighted, the others dimmed. "Who eats the idle time decides who wins."
   **Variants**: `training-vs-inference`, `gpu-capacity-planning`, `llm-rate-limits`.
   **Techniques**: lanes, meter, chart, dial, side by side, spotlight, caption.
   **Review**: Improved — self-hosting trades the provider's quota for your own capacity limit, and pay-per-token labelled as serverless.

### Model quotas and rate limits (TPM and RPM) (`llm-rate-limits`)

**The aha**: The binding limit is usually tokens, not requests — a few long prompts can exhaust a quota that thousands of short ones wouldn't.
**Misconception to defeat**: Treating LLM rate limits like generic API rate limiting counted only by request count.
**Cast**: Two meters: "RPM: 0/100" and "TPM: 0/40,000." A queue of request cards, each with a token-count badge, some tiny, some huge with a reserved max_tokens.
**Opening frame**: Both meters at zero, a mixed-size queue waiting.
**Story**:

1. Small requests (50 tokens) flow through: RPM climbs toward 100; TPM barely moves.
2. Reset. A handful of huge requests (8,000 tokens each) flow through: after 5, TPM hits 40,000 and locks, while RPM reads "5/100."
3. The next request bounces off the TPM wall, stamped "429, retry-after: 12s."
4. A retry waits out the timer and resends with backoff; it goes through once TPM refills (a bucket refilling continuously, not a hard reset on the minute).
5. Contrast inset: a generic limiter tracking only request count waves the same 5 huge requests through happily, because "5 ≤ 100."
   **The moment**: Beat 2/3 — TPM slamming shut after only 5 requests while RPM sits nearly empty.
   **Interaction**: Providers differ (some meter input and output tokens separately). Adjust request sizes and watch which meter hits its ceiling first; trigger a 429 and watch retry-after count down.
   **Ending**: TPM draining as the window rolls forward, the stalled request let through. "Count tokens, not calls."
   **Variants**: `llm-token-costs`, `model-hosting-options`, `llm-gateway`.
   **Techniques**: meter, timer, token, failure, side by side, dial, caption.
   **Review**: Improved — refill is continuous, and provider differences in counting are noted.

### LLM latency: time to first token, tokens per second and streaming (`llm-latency-streaming`)

**The aha**: Long prompts slow the start (prefill), long answers slow the finish (decode); streaming only changes when you see it.
**Misconception to defeat**: Confusing TTFT/TPS with network latency, or throughput across many users with one user's tokens-per-second.
**Cast**: A timeline strip. "Prefill": the whole prompt enters at once, bar growing with prompt length. "Decode": output chips appear one at a time at a steady beat. Two stopwatches: TTFT (stops at the first output chip) and total time.
**Opening frame**: A long prompt row waiting at the model's door, both stopwatches at zero.
**Story**:

1. Prefill floods in; TTFT's stopwatch runs through this phase and stops at the first output chip.
2. Decode begins: chips appear one by one at a steady beat; a tokens/sec meter reads the rate.
3. Side by side: a short-prompt/long-answer run (fast TTFT, long tail) versus a long-prompt/short-answer run (slow TTFT, short tail) — same total token count, but the long-prompt run finishes far sooner: prefill takes the whole prompt in parallel, decode emits one token per step.
4. Streaming on: chips appear the instant each is generated. Streaming off: identical total time, nothing shows until the last chip. "Streaming changes when you see it, not how long generation takes."
5. Contrast inset: queueing and network delay added before prefill, drawn as separate bars: a user's measured TTFT includes them, the model's prefill does not. "That's waiting, not the model."
   **The moment**: Beat 3 — two runs with the same token count and opposite shapes: a long wait before the first token, or a long trickle after it; prompt tokens are cheap in time, answer tokens are not.
   **Interaction**: Drag prompt length and answer length independently and watch TTFT and total time move on separate axes; toggle streaming on/off.
   **Ending**: The full timeline, prefill and decode both visible, streaming on. "Two costs: how long to start, how fast to finish."
   **Variants**: `next-token-prediction`, `batch-vs-realtime-inference`, `kv-cache`, `inference-batching`.
   **Techniques**: timer, chart, token, side by side, toggle, dial, caption.
   **Review**: Improved — fixed a false claim (equal totals): prompt tokens are far cheaper in time than output tokens; TTFT as measured includes queue and network.

### KV cache (`kv-cache`)

**The aha**: GPU memory, not compute, usually caps how many conversations a server can hold at once, because each one's cache stays resident until it finishes.
**Misconception to defeat**: Confusing it with prompt caching (across requests) or an ordinary application cache.
**Cast**: A GPU memory bar divided into blocks. Several concurrent conversations, each a coloured strip of KV blocks growing a block at a time as tokens are generated, parked until the request finishes. A paging icon slots blocks in like a hotel assigning rooms.
**Opening frame**: An empty memory bar, three conversations about to start.
**Story**:

1. The cache stores every earlier token's keys and values so the model never recomputes them: speed bought with memory. A's strip grows as it generates (a block fills every ~16 tokens), staying put until A finishes, unlike compute, which finishes each step and moves on.
2. B and C start concurrently; their blocks interleave into free slots, not needing contiguous space.
3. A long conversation D keeps growing; the memory bar fills even though a separate compute meter isn't maxed at all. "Spare compute, no spare memory."
4. A new conversation E tries to start: no free blocks — refused or queued.
5. A finishes; its blocks free (flash, grey, available); E's blocks slot into the freed space immediately.
   **The moment**: Beat 3/4 — a request refused purely on memory while compute sits well below its ceiling.
   **Interaction**: Start and finish conversations and watch blocks claim and free space; drag a max-concurrency dial capped by memory, not compute.
   **Ending**: Memory packed efficiently via paging, compute meter with headroom. "Memory held until it's done."
   **Variants**: `inference-batching`, `gpu-inference-scaling`, `prompt-caching`.
   **Techniques**: contents, meter, stream, restyle, failure, dial, caption.
   **Review**: Improved — now says why the cache exists (avoid recomputation), blocks hold many tokens, and lifetime is the request.

### Request batching for inference (continuous batching) (`inference-batching`)

**The aha**: A GPU serving one request at a time is mostly idle; continuous batching multiplies throughput without making everyone wait for the slowest request.
**Misconception to defeat**: Confusing it with offline batch inference (a scheduled dataset scoring job).
**Cast**: A GPU utilisation bar; several requests, short and long, each a row of decode ticks. "Static batching": a fixed group waits to fill, all wait for the longest to finish. "Continuous batching": the same slot refills every tick as rows finish early and new ones arrive.
**Opening frame**: The GPU bar flickering on only during tiny ticks, mostly idle between, serving one request alone.
**Story**:

1. Single-request serving: the bar is mostly idle. "A GPU this parallel, doing one thing, is wasted."
2. Static batching: four requests wait to form a group, start together; two short ones finish early and sit frozen, results held until the long ones finish too.
3. Continuous batching: the same four start as they arrive; a finished short request's slot is immediately handed to a new arrival — the bar stays busy, short results return the moment they're done.
4. A throughput meter compares all three over the same window: single lowest, static middling, continuous highest.
5. A latency-for-short-requests meter shows static's short requests waiting far longer than continuous's.
   **The moment**: Beat 3 — a short result returning instantly inside a batch full of long-running neighbours.
   **Interaction**: Mix request lengths with a dial and compare static vs continuous batching's throughput and short-request latency.
   **Ending**: Continuous batching's bar fully busy, short requests exiting promptly. "Never idle, never held hostage."
   **Variants**: `kv-cache`, `gpu-inference-scaling`, `batch-vs-realtime-inference`.
   **Techniques**: meter, lanes, contents, side by side, dial, chart, caption.
   **Review**: Keep — static versus continuous with a short result escaping instantly is the right contrast; accurate.

### Autoscaling and load balancing GPU inference (`gpu-inference-scaling`)

**The aha**: GPU inference doesn't scale like a web app — replicas are slow to start and requests vary enormously in cost, so scale ahead on the right signal and route by real load.
**Misconception to defeat**: Applying CPU-style horizontal pod autoscaling and round-robin load balancing straight across.
**Cast**: Replica boxes, each with a utilisation bar, a KV-cache fill meter and a multi-minute cold-start timer. A load balancer with two modes: round robin and queue/cache-aware.
**Opening frame**: Three warm replicas, moderate load, load balancer idle between them.
**Story**:

1. Traffic spikes; a CPU-style autoscaler watches only a flat CPU% and does nothing, while the replicas' KV-cache meters climb toward full. "CPU was never the bottleneck here."
2. Scaling signal switched to queue depth/KV-cache usage: a new replica triggers, but the cold-start timer runs minutes (provision, pull weights, load) before it's ready.
3. Round robin sends a new request to an already-nearly-full replica while a lightly loaded one sits idle nearby.
4. Switch to cache-aware balancing: the request routes to the idle replica, and a follow-up reusing an earlier prefix routes to the replica that already has that prefix cached.
5. Side by side: round robin's uneven utilisation versus cache-aware's balanced one, same traffic.
   **The moment**: Beat 2 — the multi-minute cold-start timer running while demand is already there.
   **Interaction**: Toggle the scaling signal and the balancing mode and watch utilisation and latency react.
   **Ending**: Replicas evenly loaded, new ones pre-warmed ahead of a forecast spike. "Scale on the real signal, route by real load, start early."
   **Variants**: `kv-cache`, `inference-batching`, `gpu-capacity-planning`, `model-hosting-options`.
   **Techniques**: meter, timer, lanes, side by side, toggle, dial, caption.
   **Review**: Keep — cold-start timer against rising demand is the sharpest moment; claims hold.

### Quantization (`model-quantization`)

**The aha**: Fewer bits per weight lets a model fit on fewer or cheaper GPUs and run faster, at a small, measurable quality cost.
**Misconception to defeat**: Confusing it with distillation (training a smaller model) or compressing files at rest.
**Cast**: The model box's weights as a grid of numbers at full precision (16-bit, long decimals). A GPU memory bar beneath, nearly full. A quality meter and a speed meter.
**Opening frame**: Weights at 16-bit, memory bar nearly full, quality meter at its ceiling, speed meter modest.
**Story**:

1. Quantize to 8-bit: digits visibly truncate, the memory bar shrinks roughly by half, speed rises, quality barely moves.
2. Quantize to 4-bit: digits truncate further, memory shrinks again, speed rises again — quality dips more, and one eval question flips from right to wrong (a before/after answer pair).
3. Contrast inset: distillation shown as a wholly different, smaller model trained fresh on a teacher's outputs — "quantization keeps the same model, smaller numbers."
4. Contrast inset 2: a zip file that must fully decompress before use, versus quantized weights staying small in GPU memory and read directly (small blocks are converted on the fly inside the compute kernel; the full-size model is never rebuilt).
5. The now-roomier memory bar fits a second model copy beside the first, where only one fit at 16-bit.
   **The moment**: Beat 2 — the same eval question flipping from right to wrong as precision drops.
   **Interaction**: Drag a bit-depth dial (16/8/4-bit) and watch memory, speed and quality move together; click an eval question to see if it flips.
   **Ending**: 4-bit weights, two model copies fitting where one did. "Fewer bits, smaller, faster — measure what you lose."
   **Variants**: `ai-accelerators`, `gpu-capacity-planning`, `kv-cache`.
   **Techniques**: restyle, meter, dial, side by side, spotlight, caption.
   **Review**: Improved — 8-bit is usually near-lossless (the dip belongs to 4-bit), and the zip contrast no longer implies no conversion happens at all.

## Prompting, context and customization

### Prompt engineering (`prompt-engineering`)

**The aha**: The prompt is the program — specific instructions, context and examples improve output more cheaply than any other lever.
**Misconception to defeat**: Thinking a prompt is a casual question whose wording doesn't really matter.
**Cast**: A prompt card split into zones: system (role + rules), examples, delimiters, the ask. The model box; an output card with a quality badge.
**Opening frame**: A bare, vague prompt; a generic, unhelpful output, quality badge low.
**Story**:

1. Add a system zone ("You are a financial analyst. Be concise, bullet points only") — the output redraws on-topic and bulleted; quality rises.
2. Add one example pinned above the ask — the output's shape now matches it exactly; quality rises again.
3. Add delimiters around a messy pasted document — a stray instruction the model had been obeying from inside the pasted text stops being followed once the document is fenced and labelled as data. Caption: "delimiters reduce confusion, they are not a security boundary."
4. A reusable template with variables runs twice with different values — same structure, two consistent outputs.
5. Side by side: the original bare prompt's output next to the final engineered one, quality badges far apart.
   **The moment**: Beat 5 — same model, same question, wildly different quality, nothing changed but the prompt.
   **Interaction**: Toggle each zone on and off independently and watch the output react to each alone.
   **Ending**: The fully built prompt, every zone lit, output at its best. "The prompt is the program."
   **Variants**: `context-engineering`, `llm-structured-output`, `prompting-vs-rag-vs-fine-tuning`.
   **Techniques**: contents, restyle, side by side, toggle, meter, caption.
   **Review**: Improved — delimiters help but are not a defence against injected instructions; said so.

### Context engineering (`context-engineering`)

**The aha**: More context isn't better — models degrade as the window fills with noise, so the job is picking the smallest set of high-signal tokens for each step.
**Misconception to defeat**: Believing a bigger window, or stuffing in everything that might be relevant, is strictly an improvement.
**Cast**: The context tray, compartments labelled, chips shaded bright (relevant) or dull (noise). A quality meter beside the output.
**Opening frame**: A tray half full of bright chips; quality meter high.
**Story**:

1. Marginally-relevant documents (dull chips) are added, well within the token limit — the tray isn't full, but quality slides down anyway. "Context rot, not from running out of room." Chips buried mid-tray are also used less than those at the start or end ("lost in the middle").
2. Side by side: the same question with a lean, curated tray (bright chips, well under capacity) versus the noisy, nearly-full tray — the lean one answers sharper, despite "less" context.
3. A just-in-time loader: instead of pre-loading five documents, one is loaded, read, and only then a second is loaded if needed — the tray stays lean throughout.
4. An old, long history compacts into a short summary chip, freeing room without losing the thread; quality recovers.
5. A sub-agent does one noisy research task in its own disposable tray; only its clean one-line result returns to the main tray.
   **The moment**: Beat 2 — two trays, one visibly less full, yet the fuller one's answer is worse.
   **Interaction**: Drag documents in and out of the tray and watch quality move independent of how full it gets; toggle just-in-time loading.
   **Ending**: A lean tray, mostly bright chips, quality at its peak. "The smallest set of high-signal tokens."
   **Variants**: `context-window`, `prompt-engineering`, `agent-memory`, `prompt-caching`.
   **Techniques**: contents, meter, restyle, side by side, toggle, spotlight, caption.
   **Review**: Improved — added position effects (lost in the middle) to the degradation story.

### Structured output (`llm-structured-output`)

**The aha**: When code consumes the answer, constrain the format at generation time — don't ask nicely and hope.
**Misconception to defeat**: Thinking "reply in JSON" in the prompt is the same guarantee as the provider's strict mode.
**Cast**: A schema card feeding the model box. Two paths: "ask nicely" (a plain instruction) versus "strict mode" (the schema wired into generation, filtering each candidate next-token to schema-valid ones). A downstream parser with a crash icon on standby.
**Opening frame**: The schema card, a waiting parser.
**Story**:

1. Ask-nicely: output streams out chatty, with a trailing sentence, and "age" as a string, not a number. The parser crashes, red.
2. Strict mode: the probability bar chart shows invalid-shape chips greyed out and unselectable at each step; output lands exactly schema-valid. The parser consumes it cleanly, green.
3. Run ask-nicely ten times: outputs vary — sometimes valid JSON, sometimes fenced, sometimes prose with JSON embedded. Run strict mode ten times: every one is valid.
4. Contrast inset: tool-call arguments are also JSON from a schema; with the provider's strict option they get the same constrained decoding, without it they are ask-nicely too.
5. Tighten the schema with an enum (status: "open" or "closed"); any other word is greyed out, impossible to emit. Boundary: strict mode guarantees shape, not truth; providers support only part of the schema language, so a range like "age 0-120" is still checked by your own code.
   **The moment**: Beats 2/3 — greyed-out invalid chips, and ten reliable outputs against ask-nicely's scattered ones.
   **Interaction**: Toggle ask-nicely vs strict mode and run the same prompt repeatedly, watching the parser crash or succeed.
   **Ending**: Strict mode's ten valid outputs lined up, parser green every time. "Constrain the shape where it's made."
   **Variants**: `tool-calling`, `prompt-engineering`.
   **Techniques**: contents, restyle, side by side, spotlight, failure, caption.
   **Review**: Improved — range constraints are not reliably supported by strict modes, so beat 5 now uses an enum and names the limit; tool-call strictness is opt-in.

### Prompting vs RAG vs fine-tuning (`prompting-vs-rag-vs-fine-tuning`)

**The aha**: Use RAG to give a model knowledge and fine-tuning to change how it behaves; try prompting first, because each step up costs more and is harder to change.
**Misconception to defeat**: Believing fine-tuning is how to teach a model new or changing facts.
**Cast**: A four-rung ladder: Prompting, RAG, Fine-tuning, Pre-training (dimmed, "rare"). A cost meter and an "update speed" timer beside it.
**Opening frame**: A question about the company's newest product, asked of a plain model — confident, wrong (trained before the product existed).
**Story**:

1. Prompting: better wording and examples, still wrong on the fact. "Wording alone can't supply a fact the model never saw. Pasting it in could; RAG is that, automated."
2. RAG: a document about the product is fetched into the prompt at query time — now correct, with a citation; cost ticks up modestly; editing the document fixes next week's answer instantly.
3. Fine-tuning: training on examples shifts tone to formal with a disclaimer appended — the style visibly changes, but the same fact question is still wrong; cost and update time jump much higher, and fixing the fact still needs retraining.
4. Pre-training: dimmed, "a new base model, almost never your job."
5. Side-by-side finale: the three attempts at the same fact question — prompting wrong, RAG right and cited, fine-tuning still wrong, just more formally.
   **The moment**: Beat 5 — fine-tuning, at high cost, still wrong on the fact RAG fixed cheaply.
   **Interaction**: Pick a goal (fix a fact vs change tone) and watch the ladder highlight the rung that actually solves it.
   **Ending**: RAG lit for the fact, fine-tuning lit for the tone goal, each the cheapest rung that works. "Climb only as far as the goal requires."
   **Variants**: `rag-pipeline`, `fine-tuning`, `prompt-engineering`.
   **Techniques**: lanes, side by side, meter, timer, restyle, spotlight, caption.
   **Review**: Improved — links prompting to RAG honestly (pasting a fact into the prompt works).

### Fine-tuning (including LoRA and distillation) (`fine-tuning`)

**The aha**: Fine-tuning changes the model itself — good for consistent behavior or a cheaper specialised model, poor for fresh facts, and it creates a new version to evaluate, host and maintain.
**Misconception to defeat**: Believing it's how to add new or changing knowledge, or that it's the same as RAG or prompting.
**Cast**: The base model box with a full weights grid. Example pairs feeding a training arrow that nudges the grid (for LoRA, only a small add-on). A thin "LoRA adapter" patch clipped onto the frozen box's side. A separate small "student" box trained by watching a larger "teacher" box.
**Opening frame**: The base box, weights grid static, example pairs waiting.
**Story**:

1. Full fine-tune: example pairs stream through; every number in the grid nudges slightly; the box becomes a new frozen copy, "v1-finetuned," needing its own hosting slot.
2. LoRA: the base box's grid stays untouched; a thin adapter patch trains instead. Swap the patch and the same frozen base behaves differently each time. "One base, many small adapters."
3. Distillation: a large, slow teacher answers many questions; a small, fast student trains purely to mimic those answers, afterward answering almost as well at a fraction of the cost.
4. The freshly fine-tuned v1 is asked a fact from after its training cutoff — still wrong, same as the base: fine-tuning touched behavior, not knowledge.
5. v1 needs its own registry entry, evals and hosting slot — a checklist of new chores the base model never needed.
   **The moment**: Beat 2 — the frozen grid not moving while a swapped patch changes behavior.
   **Interaction**: Swap different LoRA patches onto the same frozen base and compare behavior; ask the fine-tuned model a post-cutoff fact to confirm it's still wrong.
   **Ending**: The base frozen, three patches lined up beside it, a small distilled student nearby. "The model changes. The facts it knows don't, not reliably."
   **Variants**: `prompting-vs-rag-vs-fine-tuning`, `ml-model-registry`, `model-quantization`.
   **Techniques**: contents, restyle, side by side, spotlight, toggle, caption.
   **Review**: Improved — a full fine-tune updates all weights (the subset is LoRA), and facts can leak in but not reliably.

## Embeddings, vector search and RAG

### Embeddings (`embeddings`)

**The aha**: Embeddings turn meaning into geometry, so "similar" becomes "near" and can be searched with maths.
**Misconception to defeat**: Confusing embeddings with tokens (integer IDs) or with encryption or hashing.
**Cast**: Text cards on the left ("reset my password," "recover account access," "bake a cake"). An empty 2D meaning map on the right. An embedding model box between them, converting each card into a point.
**Opening frame**: Three text cards, an empty map, nothing plotted.
**Story**:

1. "Reset my password" goes through the embedding box, lands as a point on the map.
2. "Recover account access" goes through the same box, lands very close to the first, sharing almost no words with it.
3. "Bake a cake" goes through, lands far away.
4. Zoom into a point: it's actually a long vector ("[0.21, -0.07, 0.88, ...] × 1536"), briefly expanding out of the dot before collapsing back — the map is a flattened view of a much higher-dimensional space.
5. The same text run through a different embedding model lands at a completely different point. "Queries and documents must share the same model; switching means re-embedding everything."
   **The moment**: Beat 2 — two sentences with no shared words landing right next to each other.
   **Interaction**: Type any two phrases and see where they land relative to each other; swap the embedding model and watch the whole map rearrange.
   **Ending**: The map with the two near points glowing, the distant one dim. "Meaning became distance."
   **Variants**: `llm-tokens`, `vector-search`, `rag-pipeline`.
   **Techniques**: token, move, zoom, spotlight, side by side, caption.
   **Review**: Keep — two no-shared-word sentences landing together is the best possible click; accurate (1536 is a real default size).

### Vector search and vector databases (`vector-search`)

**The aha**: Vector search finds by meaning rather than matching words, so "reset my password" finds "recover account access."
**Misconception to defeat**: Confusing it with keyword (full-text) search, or with a feature store.
**Cast**: The meaning map, populated with many document points, stored in a cylinder ("vector database") beneath it, each point carrying its source text and metadata. A query becomes a point; a search ring expands from it.
**Opening frame**: A cylinder full of pre-plotted document points, quiet.
**Story**:

1. "Recover account access" is embedded, lands as a new point.
2. A ring expands outward (by cosine similarity, say); the nearest points light up in ranked order as the ring passes them.
3. The top result's source text pops up: "Reset your password" — correct, despite sharing no words with the query.
4. Contrast inset: a keyword search on the same query misses it (no word "recover" in the target text) but would catch an exact phrase match elsewhere that vector search ranks lower.
5. The cylinder is shown holding millions of points; the ring-expansion process is flagged "this gets slow at scale."
   **The moment**: Beat 3 — the top result sharing no words with the query, pulled up purely by proximity.
   **Interaction**: Type a query and watch the ring expand and the ranked results light up; toggle a keyword-search overlay to compare.
   **Ending**: The ring settled on the nearest points, their text surfaced. "Near on the map, relevant in meaning."
   **Variants**: `embeddings`, `ann-vector-index`, `hybrid-search`, `feature-store`.
   **Techniques**: token, move, spotlight, path trace, side by side, contents, caption.
   **Review**: Keep — query and answer sharing no words, found by proximity, with the keyword contrast; sound.

### Approximate nearest neighbor search (HNSW) (`ann-vector-index`)

**The aha**: At scale you accept "almost the closest" results for orders-of-magnitude faster search, and you tune how close "almost" is.
**Misconception to defeat**: Thinking vector search always checks every stored vector exactly.
**Cast**: The meaning map with a million points, overlaid with a layered graph: sparse long-range edges at the top, denser short-range edges below, the densest layer at the bottom.
**Opening frame**: The million-point map, the layered graph faintly overlaid, a query point hovering above the top layer.
**Story**:

1. Exact search inset: checking all million points runs a comically slow progress bar. "Doesn't scale."
2. ANN: the query enters at the sparse top layer, hops a couple of long-range edges to get roughly close fast.
3. It drops a layer, denser now, and hops a few more times to refine.
4. It drops to the bottom layer (the only one holding every point, and the densest) and takes a few short final hops to land among the true near neighbours — a handful of hops total.
5. Compared against the exact answer: 9 of 10 top results match, the 10th is a near-miss. Tuning dials (m, efConstruction, efSearch) move a speed/memory meter against a recall meter.
   **The moment**: Beat 4/5 — a handful of hops reaching nearly the same answer as checking a million points, recall traded against speed made explicit.
   **Interaction**: Drag efSearch and watch hops, time and recall move against each other; toggle exact vs ANN side by side.
   **Ending**: The graph settled, recall at "~99%," speed "~100x faster" (illustrative; RAM use is higher). "Hop toward close. Decide how close is close enough."
   **Variants**: `vector-search`, `embeddings`.
   **Techniques**: layers, move, path trace, meter, dial, side by side, caption.
   **Review**: Improved — "1000x" overstated for a million vectors; bottom layer holds every point.

### Retrieval-augmented generation (RAG) (`rag-pipeline`)

**The aha**: The model doesn't learn your data — you look up the relevant facts at question time and hand them over in the prompt, like an open-book exam.
**Misconception to defeat**: Thinking RAG trains the model on your documents, or that it's just search without generation on top.
**Cast**: Two flows. Ingestion (offline): a document icon → extract text (with an OCR pass) → chunk into strips → embed → index into the vector database cylinder, kept in sync when sources change. Query (online): a question → embedded → nearest chunks retrieved → dropped into the context tray → the model generates an answer with citations.
**Opening frame**: An empty cylinder, a user with a question, both idle.
**Story**:

1. Ingestion runs once: documents stream through extraction, chunking, embedding, landing as indexed points.
2. "What's our refund policy?" is embedded, lands on the map; nearest chunks light up and are pulled out.
3. The chunks' actual text drops into the tray beside an instruction: "answer only from these chunks, cite them."
4. The model generates an answer with each sentence carrying a citation tag back to a chunk; clicking one shows the exact source strip.
5. Contrast inset: the bare model with no retrieval answers fluently but wrong, no citations possible — side by side with the grounded, cited RAG answer.
6. A source document is edited; the sync arrow re-chunks and re-embeds just that document; the next query reflects the update immediately, no retraining.
   **The moment**: Beat 5 — the same question, with and without retrieval: confident-but-wrong versus grounded-and-cited.
   **Interaction**: Edit a source document and watch the index update and the next answer change; click a citation to trace it to its chunk.
   **Ending**: The pipeline at rest, an answer on screen with live citations. "Look it up, then write the answer, open-book."
   **Variants**: `document-chunking`, `hybrid-search`, `rag-reranking`, `grounding-and-citations`, `agentic-rag`, `prompting-vs-rag-vs-fine-tuning`.
   **Techniques**: contents, token, move, path trace, side by side, spotlight, caption.
   **Review**: Keep — with-and-without retrieval, and the edit-the-source loop, make the open-book point; no errors found.

### Document chunking (`document-chunking`)

**The aha**: Chunk size is the main RAG design knob — too small loses context, too big dilutes relevance and wastes tokens; chunk along the document's natural structure.
**Misconception to defeat**: Confusing chunking with tokenization (splitting for the model to read, not for retrieval).
**Cast**: A long page icon (headings, paragraphs, a table). A chunk-size and strategy dial. A cutting line that can follow fixed character counts, sentence boundaries, or the document's own headings.
**Opening frame**: The whole page, uncut, dial at "whole document."
**Story**:

1. Whole document: a query about the refund window retrieves the entire policy — the relevant sentence buried, diluting relevance, wasting tokens.
2. Tiny fixed-size, no overlap: the page shreds into strips, some cutting a sentence in half; the retrieved strip reads "...within 30 days of purchase, the" — missing what the 30 days apply to.
3. Fixed-size with overlap: the same strips now share a few sentences at each boundary; the cut sentence now appears whole in at least one.
4. By structure: the cutting line snaps to headings and paragraphs; the retrieved strip is exactly "Refund Policy: ... within 30 days ... store credit only" — complete and right-sized.
5. Side by side: the four settings' retrieved chunk for the same query, with a relevance badge on each — structure-aware usually wins on documents with real structure; no setting is best everywhere, so test on your own queries.
   **The moment**: Beat 2 vs beat 4 — the same sentence, once sliced in half and meaningless, once whole and exactly answering the query.
   **Interaction**: Drag the chunk-size and strategy dial and watch the cutting lines move and the retrieved strip change.
   **Ending**: Structure-aware cutting settled, a clean, complete chunk retrieved. "Cut along the document's own joints."
   **Variants**: `rag-pipeline`, `hybrid-search`, `llm-tokens`.
   **Techniques**: contents, split / merge, dial, side by side, spotlight, caption.
   **Review**: Improved — removed the claim that structure-aware always wins.

### Hybrid search (`hybrid-search`)

**The aha**: Vectors catch meaning and keywords catch exact terms; together they miss less than either alone.
**Misconception to defeat**: Thinking vector search alone is strictly better, or that hybrid search is the same step as reranking.
**Cast**: A query splits into two lanes: "keyword (BM25)," a text-matching pass producing ranked list A; "vector," the meaning-map ring producing ranked list B. A merge box below fuses A and B by Reciprocal Rank Fusion into one list.
**Opening frame**: The query above two idle lanes, empty ranked-list panels.
**Story**:

1. Keyword alone: an exact error code ("E-4042") is nailed at rank 1, but phrasing variants of "password reset" rank low or miss.
2. Vector alone: it finds meaning-matched chunks about "recovering account access" nicely, but ranks the exact-code chunk lower — a code is just a token to it.
3. Both merge via RRF: each chunk scores 1/(60 + rank) in each list and the scores add (ranks, not incompatible raw scores) — the code chunk and the meaning-matched chunk both float to the top, where either alone ranked the other too low.
4. A metadata filter chip narrows both lanes to the same scope before merging.
5. Side by side finale: keyword-only's top-3, vector-only's top-3, and hybrid's top-3 — only hybrid contains both chunks.
   **The moment**: Beat 3 — two chunks, each ranked high by one lane and low by the other, rising to the top together once fused.
   **Interaction**: Toggle each lane on and off; type a query mixing an exact code and a vague phrase and watch each lane's strength show up.
   **Ending**: The fused list on top, the merge box's RRF arrows visible. "Catch what either search catches."
   **Variants**: `vector-search`, `rag-reranking`, `document-chunking`.
   **Techniques**: lanes, path trace, side by side, spotlight, caption.
   **Review**: Improved — the RRF formula is shown and the moment no longer contradicts beats 1-2.

### Reranking (`rag-reranking`)

**The aha**: Retrieval optimises for recall, reranking for precision — cheap search casts a wide net, an expensive judge picks the best few.
**Misconception to defeat**: Confusing it with hybrid search's fusion step, or with sorting by date or popularity.
**Cast**: A funnel. Wide top: "retrieve top 50," a cheap, fast pass. Middle: a slower cross-encoder or LLM judge box scoring the query against each candidate, one pair at a time. Narrow bottom: "keep top 5," feeding the context tray.
**Opening frame**: The funnel's top already holding 50 loosely-ranked candidates, a false positive sitting high near the top.
**Story**:

1. The cheap pass's top 10 includes an unrelated chunk scored similarly to the embedding — a false positive by geometry alone.
2. Each of the 50 is fed, in turn, into the judge box alongside the query — far slower per candidate than the first pass's lookup, so affordable only for 50, but far more discriminating because it reads query and chunk together.
3. The judge's scores re-order the 50: the false positive sinks to the bottom; a candidate that ranked 23rd rises to 1st.
4. Only the top 5 survive into the context tray; the other 45 are discarded, never reaching the model.
5. Side by side: the raw top-5 (with the false positive) versus the reranked top-5 (false positive gone, the true best answer included) — the generated answers differ, the reranked one correct.
   **The moment**: Beat 3 — a candidate jumping from 23rd to 1st, and a confident false positive sinking to the bottom.
   **Interaction**: Toggle reranking on and off before the funnel's narrow end and compare the final 5 chunks and the resulting answer.
   **Ending**: The narrow top-5 settled, correct and clean, the discarded 45 greyed below. "Wide net first. Sharp judge second."
   **Variants**: `hybrid-search`, `rag-evaluation`, `llm-as-a-judge`.
   **Techniques**: contents, meter, spotlight, side by side, toggle, caption.
   **Review**: Improved — the cost comparison was muddled; now says why only a shortlist is reranked.

### Query rewriting and decomposition (`query-rewriting`)

**The aha**: Users ask in ways documents don't phrase things, so reshaping the question to resemble the answer improves retrieval.
**Misconception to defeat**: Confusing it with prompt engineering of the final answer — this reshapes the question, before retrieval, not the response.
**Cast**: A vague query bubble ("did it get fixed?"). A rewrite stage with three lanes: add context from conversation, decompose into sub-queries, HyDE (write a hypothetical answer, embed that instead). Each lane feeds the meaning map's retrieval ring.
**Opening frame**: The vague bubble alone, a dim, scattered retrieval ring around it.
**Story**:

1. Add-context lane: the last two conversation turns fold in ("the login bug from yesterday") — the ring tightens around the right ticket.
2. Decomposition lane: a compound question splits into two sub-queries, each retrieved separately, then merged — neither would have surfaced well blended together.
3. HyDE lane: instead of embedding the question, a short hypothetical answer is written first and embedded — since documents are written as answers, this lands closer to the true answer document than the bare question did (a wrong guess can mislead, so it is a tool, not a default).
4. Side by side: the bare query's weak, scattered ring versus each rewritten version's tight, accurate one, over the same documents.
5. Caption ties it together: "the question and the answer are rarely phrased alike; make the query sound more like the answer."
   **The moment**: Beat 3 — the hypothetical answer landing closer to the true document than the literal question ever could.
   **Interaction**: Toggle between the raw query and each rewriting technique and watch the retrieval ring tighten or loosen.
   **Ending**: The rewritten query's tight ring around the correct chunk. "Ask it the way the answer is written."
   **Variants**: `rag-pipeline`, `agentic-rag`, `vector-search`.
   **Techniques**: move, path trace, side by side, toggle, spotlight, caption.
   **Review**: Improved — HyDE's failure mode noted.

### Permission-aware retrieval (security trimming) (`rag-access-control`)

**The aha**: The model can't keep a secret it was given — authorisation must happen at retrieval time, before content reaches the prompt.
**Misconception to defeat**: Thinking you can just tell the model in the prompt not to reveal restricted content.
**Cast**: The vector database cylinder, each point tagged with permissions (HR-only, Finance, Public). Two users: an intern (Public only) and an HR manager (HR + Public). A permission filter gate between the retrieval ring and the context tray.
**Opening frame**: The cylinder with mixed-permission points, the gate closed by default.
**Story**:

1. The intern asks about average salary; the gate sits inside the search, so the ring only considers chunks the intern may see (a pre-filter on the permission tag); the HR-only chunk is never a candidate (a red flash where it would have been), only Public chunks return, and the model says it has nothing on that. Filtering after top-k would leave too few results.
2. The HR manager asks the identical question; the same ring finds the same chunk; the gate matches the tag and lets it through; the model answers with the real figure, cited.
3. Contrast inset: instead, the HR-only chunk is let through to the intern's prompt with only an instruction "don't reveal salary data" — the model reads it anyway and, on a follow-up question, leaks the number regardless.
4. An employee's groups change; their next query is filtered under the new rule immediately, though past access isn't retroactively unseen.
5. A second worry: the embeddings themselves, queried directly without going through the filter gate, can leak source text — the gate must wrap the index, not just the app's front door.
   **The moment**: Beat 1 vs beat 3 — blocking at the gate (safe) versus trusting an instruction after the model already has the secret (leaks anyway).
   **Interaction**: Switch users and watch the gate open or close on the same query; toggle "filter at retrieval" vs "ask the model not to tell."
   **Ending**: The gate correctly open for the manager, correctly shut for the intern, same question. "Stop it before it's seen, not after."
   **Variants**: `rag-pipeline`, `vector-search`, `prompt-injection`.
   **Techniques**: contents, restyle, failure, side by side, toggle, spotlight, caption.
   **Review**: Improved — enforcement is a pre-filter inside the search, not a post-hoc block on already-retrieved results.

### Agentic RAG (`agentic-rag`)

**The aha**: Fixed RAG does one search per question; agentic RAG keeps searching until it has enough, buying better answers to complex questions with more latency and cost.
**Misconception to defeat**: Confusing it with standard RAG's single retrieve-then-generate pass, or with a full multi-agent system.
**Cast**: The model box beside a "search" tool box (an envelope icon per call). A decision diamond inside the loop: "enough to answer?" A step counter and a cost/time meter ticking per loop.
**Opening frame**: A hard, multi-part question ("compare last quarter's refund rate to this quarter's, and explain the change") in front of a fixed single-search pipeline, which runs once, returns a partial chunk, and answers incompletely, missing the explanation.
**Story**:

1. Switch to agentic RAG: the model decides it needs quarter-1 data, sends a search envelope, gets chunks back.
2. Decision diamond: not enough yet — it needs quarter-2 data; a second search envelope goes out.
3. Decision diamond again: still not enough to explain the change; a third search specifically for "refund rate change reasons" lands a chunk about a policy update.
4. Decision diamond: enough now — the loop exits and the model writes a complete answer citing all three retrievals, step counter at "3 searches," cost/time meter visibly higher than fixed RAG's single pass. A max-steps limit sits beside the counter to stop endless loops.
5. Side by side: fixed RAG's one-search, incomplete answer (fast, cheap) versus agentic RAG's three-search, complete answer (slower, costlier), same question.
   **The moment**: Beat 4/5 — the counter clicking to 3 and the complete answer appearing, against fixed RAG's single, incomplete attempt.
   **Interaction**: Click through each decision diamond manually to force an extra or fewer search; toggle fixed vs agentic RAG on a question of varying difficulty (an easy question should finish agentic RAG in one search too).
   **Ending**: The loop's exit, a complete cited answer, counter at rest. "It keeps asking until it has enough, not just once."
   **Variants**: `rag-pipeline`, `agent-loop`, `tool-calling`, `query-rewriting`.
   **Techniques**: contents, token, path trace, choice, meter, side by side, caption.
   **Review**: Improved — added the step cap that keeps the loop's cost bounded.
