# Scaling plans, part 1

Groups 1–4 of `catalog/scaling.md`, in catalog order. Shared visual language across all Scaling
plans: users on the left as a small crowd sending requests (dots) rightwards; servers as boxes, each
with a load bar that fills amber then red; a load balancer as a splitter fanning requests out; a scale
set as a frame where server copies appear and disappear; a cache as a small fast box beside the app
holding visible keys; a database as a cylinder; latency as a small stopwatch label on a request;
values that change over time as a chart strip along the bottom.

Two techniques are added to the vocabulary here: **replay** (rewind to an earlier frame and run the
same events again with one thing changed, so that change is the only difference) and **ghost** (a
faint, see-through copy of an element showing a state that isn't real: where a reading will land
after a step, or how a previous run went, drawn over the current one).

## Capacity and scaling basics

### Scalability (vs performance) (`scalability`)

**The aha**: Performance is how fast one request is; scalability is whether adding resources adds throughput in step, so a system can be fast for one user and slow for a thousand.

**Misconception to defeat**: "Scalable" means "fast", so making one request quicker makes a system scalable.

**Cast**: Users on the left, a crowd whose size follows a "users" number. Servers with load bars. Every request dot carries a stopwatch label. In the second half, a shared database cylinder with its own load bar. Bottom chart strip: "requests/s served" (up) against "servers" (across).

**Opening frame**: One user, one server, one request on its way back with its stopwatch reading "80 ms". Caption: "One user: fast."

**Story**:

1. The crowd grows to 1,000. The server's bar fills amber, then red, and the stopwatches climb to "2 s". Caption: "Fast for one, slow for many: a scalability problem."
2. The stage splits into two lanes fed by identical crowds, A on top and B below. A second server appears in each. In A, both bars drop to amber and a "+400 req/s" tag pops onto the chart. In B, every server writes to one shared database cylinder.
3. A server is added to both lanes every second. A's tags read "+400, +400, +400" and its chart line climbs straight. B's shrink, "+300, +100, +20, +0", while B's database goes red and its servers sit green and idle. Caption: "B: more servers, no more throughput."
4. Slow down on the chart: a straight line beside a curve that bends flat. Caption: "Scalable: each server adds about the same."

**The moment**: Beat 4. The two lines on one chart, with B's idle green servers spotlit next to its red database: the extra machines are there and buy nothing.

**Interaction**: A "users" dial and an "add a server" button that acts on both lanes. At 1 user both lanes are equally fast (same performance); turning users up exposes the difference (different scalability).

**Ending**: Hold on the chart, the lines labelled "scalable" and "not scalable", eight servers in each lane.

**Variants**: `elasticity`, `horizontal-scaling`, `bottleneck`, `amdahls-law`, `elasticity-vs-scalability` (Fundamentals).

**Techniques**: token, timer, meter, chart, appear / disappear, lanes, side by side, spotlight, caption, dial.

**Review**: Keep — the two-lane contrast and the idle servers beside a red database are the sharpest way to separate speed from scalability.

### Elasticity (`elasticity`)

**The aha**: Any fixed size is wrong for most of the day; elastic capacity follows the demand curve up and down, automatically.

**Misconception to defeat**: That there's a right fixed size, or that elasticity just means "able to grow" (that's scalability; elasticity is growing and shrinking automatically, all day).

**Cast**: The chart is the main stage here: a 24-hour clock across, demand as a blue line with a morning and an evening hump, and a capacity line. Above it, the user crowd (its size follows the clock) and a scale set frame. Two counters: "cost per day" and "requests dropped".

**Opening frame**: The day's demand curve drawn faintly, the clock at 00:00, three servers in the frame. Caption: "Demand changes all day. How much capacity should we run?"

**Story**:

1. Fixed for the peak: the capacity line sits flat at the top of the highest hump. The clock runs and the area between capacity and demand fills grey; most servers sit dim with near-empty bars. Cost: "$480". Caption: "Sized for the peak: idle most of the day, still paid for."
2. Fixed for the average: the line drops to mid-height. At each hump, demand rises above it, the area above fills red, and dots bounce off red servers and fall away. Dropped: "12,400". Caption: "Sized for the average: requests dropped at the peak."
3. Elastic: the flat line bends into a staircase that hugs the curve. Copies appear in the frame as the morning hump rises and fade after it. The grey shrinks to a sliver and the red is gone. Cost "$190", dropped "0". Caption: "Elastic: capacity follows demand."
4. All three runs overlay on one chart, the first two as ghosts and the staircase bold.

**The moment**: Beat 3. When the flat line bends into the staircase, the grey and the red both collapse at once: waste and drops removed together, not traded for each other.

**Interaction**: Drag the fixed line up and down: you can only swap grey for red, never remove both. Then switch on "elastic" and both disappear.

**Ending**: The day loops, the frame breathing in and out with the crowd while the counters keep score.

**Variants**: `autoscaling` (the mechanism), `scalability`, `predictive-scaling`, `scale-to-zero`, `elasticity-vs-scalability` (Fundamentals).

**Techniques**: chart, appear / disappear, meter, failure, ghost, toggle, dial, caption.

**Review**: Keep — the three-run overlay of waste, drops and cost is the right proof; numbers are illustrative but plausible.

### Vertical scaling (`vertical-scaling`)

**The aha**: Making one machine bigger is simple and needs no code changes, but there's always a largest size, resizing usually means a restart, and it's still one machine that can fail.

**Misconception to defeat**: That you can keep buying a bigger box for ever, and that a bigger box is a safer one.

**Cast**: One server drawn large enough to see inside: a row of core squares, a memory bar and its load bar. On the right, a size ladder with rungs "2 cores · 4 · 8 · 16 · 32 · 64 (largest)", a pointer, and a monthly price on each rung ("$70" up to "$2,240"). Users on the left sending dots.

**Opening frame**: A 2-core server at 40% load, the pointer on the bottom rung. Caption: "One server, 2 cores."

**Story**:

1. Traffic grows; the bar fills amber, then red, and stopwatches climb. Caption: "More load than it can take."
2. Scale up: the server goes dark for two seconds behind a "restarting" spinner, and dots arriving then bounce off with small red crosses. It comes back with 4 cores, the bar drops to amber and the pointer climbs a rung. Caption: "Bigger machine, same code. Usually a restart."
3. Traffic keeps growing and it repeats, faster each time: 8, 16, 32 cores, each with its blink of downtime. The box swells across the screen and the price doubles each step.
4. At 64 cores the pointer hits the top rung with a clunk, under a hard line marked "largest size". Traffic keeps climbing, the bar stays red and the "scale up" control greys out. Caption: "There's always a largest size."
5. The huge machine fails: it greys and cracks, and every dot from every user turns red at once. Caption: "And it's still one machine."

**The moment**: Beat 4, slowed down: the pointer jammed against the top rung while the traffic line on the chart strip keeps rising past it.

**Interaction**: The viewer presses "scale up" themselves (each press costs a restart blink and doubles the price) and can press "fail" at any size. Every press works, until suddenly none can.

**Ending**: Freeze on the dead 64-core machine with every user red; loop back to 2 cores.

**Variants**: `horizontal-scaling`, `scale-up-vs-out`, `right-sizing`.

**Techniques**: restyle, contents, meter, token, timer, failure, chart, caption, dial.

**Review**: Keep — the ladder, the restart blink, the ceiling and the single point of failure each get their own beat; claims check out.

### Horizontal scaling (`horizontal-scaling`)

**The aha**: Capacity grows by adding copies behind a load balancer, with no practical ceiling, and losing one copy loses only its share; it works only if any copy can serve any request.

**Misconception to defeat**: That adding servers is just a bigger server in pieces, or that any app can simply be copied.

**Cast**: Users on the left, a load balancer splitter, a scale set frame of server copies with load bars, and a "capacity" meter. Chart strip: traffic (blue) and copy count (a step line).

**Opening frame**: One copy in the frame behind the splitter, bar at 50%. Caption: "One copy behind a load balancer."

**Story**:

1. Traffic rises; the bar goes amber, then red.
2. Copy 2 clones out of copy 1 and slides into the frame. The splitter now fans dots across both, and both bars settle at amber. Caption: "Add a copy. Share the load."
3. Traffic keeps climbing; copies 3 to 8 appear one by one, every bar staying calm, and the copy-count steps track the traffic line. Caption: "Keep adding copies. No largest size."
4. Evening: traffic falls and copies fade out to two. Caption: "Fewer when it's quiet."
5. With four copies running, one cracks and greys. The splitter's branch to it fades, the other three bars rise a notch, and the capacity meter drops to 75%, not 0. A small inset replays one big machine failing: 0%. Caption: "Lose one copy, lose only its share."
6. One user's dots turn purple and land on copy 1, then copy 3, then copy 2, each answered correctly. Caption: "It works because any copy can serve any request."

**The moment**: Beat 5: the meter stopping at 75% beside the inset's 0%.

**Interaction**: A traffic dial, plus "remove a copy" and "fail a copy" buttons. Removing copies until the bars turn red shows how much each one carries.

**Ending**: Loops through the traffic day, the frame filling and emptying with the wave.

**Variants**: `vertical-scaling`, `scale-up-vs-out`, `autoscaling`, `stateless-vs-stateful`, `load-balancing`, `database-sharding` (Data: scaling data out, not compute).

**Techniques**: clone, appear / disappear, token, meter, chart, failure, side by side, caption, dial.

**Review**: Keep — 75% against 0% on failure is the right moment, and the closing beat names the stateless prerequisite.

### Scale up vs scale out (`scale-up-vs-out`)

**The aha**: Scaling up is quick and simple but hits a ceiling and keeps a single point of failure; scaling out keeps growing and survives failures, but needs a load balancer and stateless services.

**Misconception to defeat**: That they're interchangeable, or that one always wins.

**Cast**: Two lanes fed by the same crowd. Top, "Scale up": one server with visible cores and the size ladder from `vertical-scaling`. Bottom, "Scale out": a splitter and a scale set frame. Each lane has its own chart strip (capacity against the shared traffic line). On the right, a scorecard with four empty rows: "Simple to start", "No ceiling", "Survives a failure", "Needs".

**Opening frame**: Both lanes coping with the same modest traffic; the scorecard empty. Caption: "Same traffic. Two ways to grow."

**Story**:

1. Getting started. The top lane resizes in one step (a restart blink). The bottom lane can't add a copy until two prerequisite tags tick in, "load balancer" and "session store". Scorecard: "Simple to start: up". Caption: "Up: one change. Out: a load balancer and stateless code first."
2. Growth. Traffic climbs. The top lane climbs the ladder to 64 cores and jams; its capacity line flattens below traffic and turns red. The bottom lane keeps adding copies and its line keeps tracking. Scorecard: "No ceiling: out".
3. Failure. Traffic resets to where both cope, then one machine fails in each lane at the same instant. Top: everything red, capacity 0%. Bottom: one copy of six greys, capacity 83%. Scorecard: "Survives a failure: out".
4. The last row fills: "Needs: up, nothing; out, a load balancer and stateless services". Caption: "Up is simpler. Out goes further."

**The moment**: Beat 3, both failures in the same frame: one lane goes fully dark while the other dims one box of six.

**Interaction**: A traffic dial that pushes both lanes past the top lane's ceiling, and a "fail one machine" button that hits both lanes at once.

**Ending**: Hold on the finished scorecard with both lanes running.

**Variants**: `vertical-scaling`, `horizontal-scaling`, `stateless-vs-stateful`.

**Techniques**: lanes, side by side, restyle, clone, chart, meter, failure, contents, caption, dial.

**Review**: Keep — both lanes failing in the same frame is the best contrast; the 5/6 = 83% arithmetic is right.

### Stateless vs stateful services (`stateless-vs-stateful`)

**The aha**: When no copy keeps anything between requests in its own memory, any copy can serve any request, so copies can be added, removed or replaced freely; the state hasn't gone, it has moved to a shared store.

**Misconception to defeat**: That "stateless" means the system has no state.

**Cast**: One named user, Ana, wearing a cart badge that shows what her cart holds. A splitter. Three copies, A, B and C, each with a visible memory pocket on its side. Later, a session store on the right: a cache box with visible keys.

**Opening frame**: Ana, the splitter, three copies with empty pockets. Caption: "Ana is shopping. Any of three copies might serve her."

**Story**:

1. Ana adds a shoe. The request goes to A, and A's pocket fills with "Ana: shoe". Her badge reads "shoe".
2. Ana adds a hat. The splitter sends this one to B. B's pocket is empty; a "?" pops, and B starts a new cart, "Ana: hat". Her badge now reads "hat": the shoe is gone. Caption: "State in one copy's memory: the others can't see it."
3. Copy A is scaled in and fades away, its pocket with it. Caption: "Remove the copy, lose what it held."
4. Replay. The pockets vanish and the session store appears. Shoe: A writes "cart:ana = shoe" into the store (a dot travels A to the store). Hat: B reads the key, then writes "shoe, hat". Caption: "Keep state in a shared store."
5. A is removed and D is added. Ana's next request lands on D, which reads the store; the cart is intact. Caption: "Now any copy can serve any request."
6. Spotlight on the store's key. Caption: "The copies are stateless. The state moved."

**The moment**: Beat 5 against beat 3: the same removal of copy A, at the same point, destroys the cart in one run and changes nothing in the other.

**Interaction**: Toggle "state in memory / state in a store", with "next request" (the splitter picks at random), "remove a copy" and "add a copy". In store mode nothing the viewer does loses the cart.

**Ending**: Copies churn in and out while Ana's badge stays "shoe, hat".

**Variants**: `sticky-sessions`, `distributed-cache`, `horizontal-scaling`, `sessions-vs-tokens` (Security).

**Techniques**: token, contents, path trace, disappear, replay, spotlight, toggle, caption.

**Review**: Keep — the replay of the same removal, destroying the cart in one run and not the other, is exactly the point.

### Sticky sessions (session affinity) (`sticky-sessions`)

**The aha**: Pinning each user to one server makes a stateful app work behind a load balancer, at a price: uneven load, new servers that only get new users, and lost sessions when a server goes.

**Misconception to defeat**: That stickiness makes a stateful app as scalable as a stateless one.

**Cast**: Users as coloured dots, one colour per person. A splitter that can read a cookie. Three servers, each with a memory pocket holding session chips in its users' colours, and a load bar.

**Opening frame**: Three servers, the splitter, a few coloured users. Caption: "A stateful app behind a load balancer."

**Story**:

1. Blue's first request goes to server 1. The response returns with a cookie tag "srv=1" that sticks to blue, and a blue chip appears in server 1's pocket.
2. Blue's next requests carry the tag; the splitter reads it and sends each straight to server 1, the same route lighting up every time. Caption: "Pinned: same user, same server."
3. Orange, a heavy user streaming dots fast, is pinned to server 2 with two others. Server 2 goes red while server 3 idles green, and the splitter can't move anyone. Caption: "Load spreads by user, not by request."
4. Server 4 appears. Everyone already pinned stays put; only newly arriving users go to 4. Its bar barely moves while server 2 stays red. Caption: "New servers only get new users."
5. Server 2 dies and its chips pop. Orange's next request goes to server 3, which has no orange chip: "Session lost. Please sign in." Caption: "When a server goes, its users' sessions go too."
6. Caption: "Stickiness hides state. It doesn't remove it."

**The moment**: Beat 4: a brand-new, nearly idle server next to a red one, unable to help because the users who need relief are pinned elsewhere.

**Interaction**: "Add a server", "remove a server" and a stickiness toggle. Turning stickiness off spreads load evenly and breaks every session: the trade in one switch.

**Ending**: Hold on the state after the failure, orange signed out, with a pointer to `stateless-vs-stateful`.

**Variants**: `stateless-vs-stateful`, `ip-hash`, `consistent-hashing`, `connection-draining`.

**Techniques**: token, path trace, contents, meter, appear / disappear, failure, toggle, caption.

**Review**: Keep — the idle new server beside the red pinned one is the memorable cost; cookie-based affinity behaves as described.

### Scale units (`scale-unit`)

**The aha**: Scaling one tier just moves the bottleneck to the next; scaling a tested bundle keeps every part in proportion and turns capacity into arithmetic.

**Misconception to defeat**: That autoscaling the busiest tier is enough.

**Cast**: A pipeline left to right: users, a splitter, an app tier (a scale set frame of 10 copies), a cache box and a queue partition (a short tube of message dots), each with a load bar. A "users" counter. Chart strip: request latency.

**Opening frame**: 10 app copies, one cache, one queue partition, all bars calm, "50,000 users". Caption: "App, cache and queue, in proportion."

**Story**:

1. Users double to 100,000. The app bars go red.
2. Only the app tier scales: copies 11 to 20 appear and the app bars go green, but the cache bar slams red and latency doesn't improve. Caption: "Scaled the app. The bottleneck moved to the cache."
3. A cache node is added; now the queue partition goes red. The red spot hops from box to box. Caption: "Scale one tier and the next one breaks."
4. Replay from 50,000 users. A dashed boundary wraps 10 app copies, one cache and one queue partition, labelled "1 scale unit = 50,000 users (load-tested)".
5. Users double: the whole boundary clones and slides in beneath the first, and the splitter fans into both units. Every bar stays the same calm colour. Caption: "Grow in tested units. Everything stays in proportion."
6. The counter is set to 140,000; a sum appears, "140,000 ÷ 50,000 → 3 units", and a third unit clones in. Caption: "Capacity becomes arithmetic."

**The moment**: The contrast between beat 3, the red spot hopping from tier to tier, and beat 5, where the whole bundle clones and no bar changes colour.

**Interaction**: A "users" dial (units appear as users ÷ 50,000, rounded up) and a toggle "scale the app only / scale in units" that replays the hopping bottleneck.

**Ending**: Three identical units side by side, all calm.

**Variants**: `deployment-stamps` (Architecture: a whole copy of the stack), `cell-based-architecture`, `bottleneck`, `horizontal-scaling`, `capacity-planning`.

**Techniques**: boundary, clone, meter, chart, replay, spotlight, toggle, dial, caption.

**Review**: Keep — the hopping red spot against a whole-bundle clone is a sharp contrast, and "capacity becomes arithmetic" lands.

## Autoscaling

### Autoscaling (`autoscaling`)

**The aha**: Set the fewest copies (for safety), the most (for cost) and a target load; copies are added above the target and removed below it, but never past those limits.

**Misconception to defeat**: That autoscaling means infinite, instant capacity rather than a bounded, lagging thermostat.

**Cast**: A scale set frame sitting on a rail marked with "min" and "max" ticks. Each server copy has a load bar; a dashed line across every bar marks the target. Users on the left, a splitter, a traffic dial.

**Opening frame**: Two copies (the min), both bars sitting on the target line. Caption: "Min 2, max 8, target 50%."

**Story**:

1. Traffic rises; both bars climb above the target line.
2. A copy clones in; both bars drop back toward the line. Caption: "Above target: add a copy."
3. Traffic keeps climbing in steps; a copy is added each time, the bars always settling back near the dashed line. Caption: "It holds the target, like a thermostat."
4. Traffic falls; bars drop under the line and copies are removed one by one. Caption: "Below target: remove a copy."
5. A hard surge: copies keep appearing until the frame hits the max tick. The bars go red and stay red past it, traffic still climbing. Caption: "Never past max, however high it climbs."
6. Traffic drops to almost nothing; copies shrink to the min tick and stop, bars sitting idle. Caption: "Never below min, however quiet."

**The moment**: Beat 5: bars stuck red against the max tick while the traffic line on the chart keeps rising past the frame's limit.

**Interaction**: Dials for min, max, target and traffic; watch the frame hug the dashed line everywhere between the rails, and give up once it can't.

**Ending**: Loop a day of traffic, the frame breathing between min and max around the dashed line.

**Variants**: `elasticity`, `target-tracking`, `scaling-metrics`, `autoscaling-lag`, `autoscaling-cooldown`, `horizontal-scaling`, `scale-to-zero`.

**Techniques**: meter, clone, appear / disappear, chart, dial, caption.

**Review**: Keep — bounded thermostat framing with min, max and target is correct and the max-tick beat defeats the "infinite" myth.

### Target tracking scaling (`target-tracking`)

**The aha**: Target tracking works out how many copies are needed from the ratio of the metric to its target, so you set one number; step scaling does what a table you wrote by hand says, so it is only as good as the table.

**Misconception to defeat**: That all autoscaling reacts the same way, or that step scaling can only add one copy at a time (it can add more, but only the amounts you wrote into its bands).

**Cast**: Two lanes side by side, "Target tracking" and "Step scaling", fed the same traffic. Each has a load meter with a target line and a small readout. The step lane also shows its hand-written table: "above 60%: +1 · above 75%: +2".

**Opening frame**: Both lanes at 5 copies, 50% load, target 50%. Caption: "Same jump in traffic. Two ways to react."

**Story**:

1. Traffic jumps; both lanes' load reads 80%.
2. Step lane: the 75% band lights and the readout pops "+2". Seven copies; load settles at about 57%, under the alarm so the rule goes quiet, but above the target. Caption: "Step: whatever the table says."
3. Target tracking lane: a readout computes "5 × 80 ÷ 50 = 8 copies", three copies appear at once, and load settles on the target line. Caption: "Tracking: asks for the ratio."
4. A bigger jump: load hits 100% on 8 copies. Tracking works out 16 and asks for them. The step lane's top band still says only "+2", so it falls short and needs more rounds. Caption: "A table can't cover every size of surprise."
5. A shared chart overlays both: tracking's capacity line jumps to match each surge; the step line is a staircase stuck at the table's step sizes.

**The moment**: Beat 4: the same bigger surge, one lane computing the right answer, the other capped by its table's top band.

**Interaction**: A traffic dial, and an editable step table: tune the bands for one surge size and the other sizes go wrong. Tracking needs no tuning.

**Ending**: Hold both charts, tracking sitting on the line, step off it. A small note: "Tracking scales in more cautiously than it scales out."

**Variants**: `autoscaling`, `scaling-metrics`, `autoscaling-cooldown`.

**Techniques**: side by side, meter, chart, caption, toggle, dial.

**Review**: Improved — the original said step scaling only ever adds one copy, which is false. Reframed as formula (ceil of copies × metric ÷ target) versus a hand-written band table, with corrected arithmetic (5 × 80 ÷ 50 = 8) and a bigger surge that exposes the table's limit.

### Choosing a scaling metric (`scaling-metrics`)

**The aha**: A good metric rises with load and falls as copies are added; the wrong one misleads, because requests, and resources, aren't all the same cost.

**Misconception to defeat**: That one metric (requests per second, or CPU) is right for every service.

**Cast**: Three lanes: "Web tier" (CPU is right, requests misleads), "Video transcoder" (CPU is always high; wrong signal), "Queue workers" (backlog per worker). Each has its relevant meter and a metric selector.

**Opening frame**: Three calm lanes, each with its metric labelled above it.

**Story**:

1. Web tier under a mix of light and heavy requests: the CPU meter tracks the real load correctly and scales sensibly.
2. Replay the same web tier scaled on requests per copy instead. Many cheap pings push the count high, so it scales out although CPU is calm; then a handful of expensive report requests arrive, the count falls, CPU climbs to red, and nothing scales. Caption: "Requests differ in cost. Counting them misleads."
3. The video transcoder sits at 100% CPU doing its one job, as designed. A CPU alarm would see "overload" and add copies that change nothing about how long the queue takes. Its right metric is jobs waiting. Caption: "Here, 100% CPU is normal, not overload."
4. Queue workers: a backlog of messages grows. Their CPU stays low (they wait on I/O), but "backlog per worker" climbs and scaling follows it: copies = backlog ÷ what one worker clears in the time you can tolerate. Caption: "Scale on the work waiting, per worker."

**The moment**: Beat 2, the falling requests counter beside the CPU meter glowing red: the metric blind to the load actually happening.

**Interaction**: Toggle which metric drives each lane's autoscaler and watch which ones cause false or missed scale-outs.

**Ending**: Three lanes, each paired with its right metric, all calm.

**Variants**: `autoscaling`, `target-tracking`, `bottleneck`.

**Techniques**: lanes, meter, chart, toggle, caption, spotlight.

**Review**: Improved — beat 2 had the logic backwards (cheap pings keep the count low); fixed so cheap traffic over-scales and expensive traffic under-scales. Made the transcoder lane's wrong signal explicit (CPU at 100% is normal) and gave queue workers the backlog-per-worker formula.

### Scheduled scaling (`scheduled-scaling`)

**The aha**: When a spike is known in advance, don't wait for a metric to notice it; have the capacity ready first, and let reactive scaling cover the rest.

**Misconception to defeat**: That reactive autoscaling alone is always fast enough.

**Cast**: A 24-hour chart with a sharp known spike marked "09:00 launch", a scale set frame, and an alarm-clock icon at the scheduled time.

**Opening frame**: Clock at 08:50, two copies, demand flat. Caption: "A launch is scheduled for 09:00."

**Story**:

1. Reactive-only run: the clock reaches 09:00, demand jumps almost vertically, new copies boot too slowly to keep up, bars run red for a couple of minutes and a knot of dots bounce off as errors. Caption: "Reactive scaling waits for the metric, then waits to boot."
2. Replay: the alarm fires at 08:55, five minutes early. Copies boot calmly, no red, and by 09:00 eight copies are already waiting when the spike lands. Bars stay green throughout. Caption: "Scheduled: the capacity is already there."
3. After the known spike settles, reactive scaling quietly takes over for the rest of the day's ordinary variation.

**The moment**: The same spike, twice: a red scramble in beat 1, untouched green in beat 2.

**Interaction**: Drag the alarm's lead time earlier or later relative to the spike; too late still shows a flash of red.

**Ending**: The alarm ticks over, the staircase already covering the whole spike on the chart.

**Variants**: `predictive-scaling`, `autoscaling-lag`, `capacity-planning`, `autoscaling`.

**Techniques**: chart, replay, appear / disappear, timer, caption, dial.

**Review**: Keep — the same spike twice, red then green, is the clearest case; matches how scheduled actions raise capacity ahead of time.

### Predictive scaling (`predictive-scaling`)

**The aha**: Reactive scaling is always late by at least the boot time; forecasting a repeating curve lets capacity launch ahead of the rise, every day, without anyone setting a time.

**Misconception to defeat**: Confusing this with scheduled scaling: here nobody sets a time, the platform learns the pattern from history.

**Cast**: A chart with several previous days' demand drawn faint as ghost curves, a forecast line reaching ahead of a "now" marker, and a scale set frame.

**Opening frame**: The past week's curves ghosted in, "now" at 06:00, two copies. Caption: "The same rise happened yesterday, and the day before."

**Story**:

1. Small inset, reactive only: copies climb only once demand has actually risen, always a step behind.
2. Main stage: a forecast line draws itself ahead of "now", tracing the expected rise from the ghosted history, and new copies appear along it before the real demand line reaches that point in time. Caption: "The forecast scales ahead of the rise."
3. Real demand catches up to exactly where the staircase is already waiting; bars stay calm the whole way up.
4. An unusual day: demand breaks from the forecast (a one-off event). The predictive staircase still rises on its learned schedule, but reactive scaling layers extra copies on top to cover the surprise. Caption: "Predictive covers the pattern. Reactive covers the surprise."

**The moment**: Beat 2, the staircase of copies rising visibly before the real demand line arrives at that point in time.

**Interaction**: Toggle "typical day" against "unusual day" to see predictive alone, then predictive plus reactive together. A "days of history" dial: with under a day there is no forecast, and the staircase is reactive only.

**Ending**: A week of ghosted curves, the staircase hugging each one closely.

**Variants**: `scheduled-scaling`, `autoscaling-lag`, `elasticity`, `autoscaling`.

**Techniques**: chart, ghost, appear / disappear, toggle, caption.

**Review**: Improved — added the real limits (it needs history, covers repeating daily or weekly patterns, and always runs alongside reactive scaling); the core framing against scheduled scaling was already right.

### Autoscaling lag (`autoscaling-lag`)

**The aha**: Autoscaling takes minutes: collecting the metric, evaluating the alarm, provisioning, booting, warming up. A spike that arrives in seconds lands on the fleet that's already there.

**Misconception to defeat**: That autoscaling reacts instantly to rising load.

**Cast**: A stopwatch strip broken into labelled segments ("collect metric", "evaluate alarm", "provision", "boot", "warm up"), a scale set frame, traffic drawn as a near-vertical spike.

**Opening frame**: Two calm copies, flat traffic. Caption: "Traffic can rise in seconds. Scaling doesn't."

**Story**:

1. Traffic spikes almost vertically at the clock's zero mark.
2. The stopwatch strip lights segment by segment, each with its own duration, a running total climbing toward "2m 40s". The existing copies sit red the whole time, with dots bouncing off as timeouts.
3. Only once the strip finishes does a new copy appear; only then do the bars start dropping.

**The moment**: The gap between the instantly vertical spike and the long, slowly lighting stopwatch strip, with red bars persisting the entire time between them.

**Interaction**: A button that removes one stopwatch segment at a time (pre-provisioned, pre-booted, pre-warmed) and shows the red duration shrink to match.

**Ending**: Hold on the full strip's total, captioned "this gap is what headroom, warm pools or queues have to cover."

**Variants**: `autoscaling-cooldown`, `warm-pool`, `cold-start`, `capacity-headroom`, `queue-load-levelling`.

**Techniques**: timer, meter, failure, chart, caption, dial.

**Review**: Keep — the vertical spike against the slowly lighting stopwatch strip is the right image; segment total is plausible.

### Cooldowns and stabilisation windows (`autoscaling-cooldown`)

**The aha**: New instances take time to boot and take load off the metric; without a pause the scaler keeps reading the stale number and keeps adding. Scale out fast; scale in slowly.

**Misconception to defeat**: That a cooldown is a bug or a delay, rather than a deliberate pause.

**Cast**: A scale set frame, a load meter with a scale-out trigger line, and a lock icon that clamps over the scaling control during a cooldown, with its own countdown.

**Opening frame**: Two copies, load climbing toward the trigger line. Caption: "Load crosses the line: scale out."

**Story**:

1. Without a cooldown: load crosses the trigger, a copy appears. Before it's warmed enough to take load off the metric, the still-high reading triggers two more copies in the next seconds. Load then crashes down with three extra, mostly idle, copies. Caption: "Without a pause: it keeps adding on stale data."
2. Replay with a cooldown: load crosses the same trigger, a copy appears, and a lock clamps over the control with "cooldown: 3 min" counting down. The trigger line is greyed out and struck through while it runs.
3. The cooldown ends right as the new copy has finished warming and the metric has genuinely settled below the trigger. No pile-on this time. A small note: newer scalers do this more precisely with an "instance warm-up": the booting copy counts as capacity already on its way, rather than the whole control being locked.
4. Scale-in uses a longer look-back (a bigger hourglass; Kubernetes' default scale-down stabilisation window is 5 minutes, scale-up has none), so a brief dip doesn't trigger a removal that then has to be reversed.

**The moment**: The same trigger crossing, twice: three extra idle copies in beat 1, exactly one in beats 2–3.

**Interaction**: A cooldown-length dial; too short recreates the pile-on, too long leaves load high a little longer than it needs to.

**Ending**: Hold on the cooldown-protected run, settled at the right number of copies.

**Variants**: `autoscaling-lag`, `autoscaling-flapping`, `autoscaling`.

**Techniques**: meter, timer, replay, restyle, caption, dial.

**Review**: Improved — added the modern mechanism (instance warm-up counts a booting copy as pending capacity) and a concrete default for the slower scale-in window; the replay structure was already the sharpest way to show it.

### Flapping (`autoscaling-flapping`)

**The aha**: Adding or removing one copy moves the load by roughly 1/N, so leave a gap between the scale-out and scale-in lines wider than that; otherwise each step lands the reading on the other line.

**Misconception to defeat**: That any two thresholds will do, as long as scale-out sits above scale-in.

**Cast**: A load meter with two threshold lines close together ("out above 65%", "in below 60%"), a scale set frame of eight copies, and a chart strip tracking copy count.

**Opening frame**: Eight copies, load at 62%, sitting between the close lines. Caption: "Out above 65%, in below 60%. Close together."

**Story**:

1. Load ticks to 66%, crosses the "out" line; a 9th copy appears and load drops to 59% (66 × 8 ÷ 9), now below the "in" line.
2. A copy is removed at once; load jumps back to 66%, crosses "out" again. The chart strip shows the copy count sawing 8, 9, 8, 9. Caption: "Scale out pushes it below 'in'. Scale in pushes it back over 'out'."
3. Replay with the thresholds pulled apart: "out above 70%, in below 40%". The same load crosses "out" at 70%, a 9th copy appears, load drops to 62% and lands in the wide quiet zone, nowhere near "in". No further action, no sawtooth. Caption: "Gap wider than one copy's worth of load."
4. A small caption on the cost: the wider the gap, the lower the average utilisation you tolerate before scaling in. Pair it with a cooldown.

**The moment**: The chart strip's sawtooth flattening out the moment the thresholds widen in the replay.

**Interaction**: Drag the two threshold lines closer together or further apart and watch the chart strip's oscillation grow or vanish.

**Ending**: Hold on the widened gap, the chart calm.

**Variants**: `autoscaling-cooldown`, `autoscaling`, `target-tracking`.

**Techniques**: meter, chart, replay, dial, caption.

**Review**: Improved — the original's numbers were impossible (adding one copy to two would drop 66% to 44%, not 58%). Rebuilt on eight copies with the real arithmetic, stated the 1/N rule behind the gap, and noted the utilisation cost of a wide gap.

### Scale to zero (`scale-to-zero`)

**The aha**: Idle time costs nothing: run no instances when there's no traffic, and start one on the next request. The trade is that the first request after a quiet spell pays a cold start.

**Misconception to defeat**: That running zero instances means the service is down.

**Cast**: A scale set frame that can go fully empty, a cost meter, a users crowd that can shrink to a single dot, and a stopwatch on the first request after quiet.

**Opening frame**: One copy, light traffic, "$0.02/min". Caption: "A rarely used service."

**Story**:

1. Traffic stops; after a quiet timer runs out, the last copy fades away. The frame is empty, cost drops to "$0". Caption: "No traffic: no instances, no cost."
2. A request arrives into the empty frame. A stopwatch starts; a new copy begins booting (a spinner), the request waits. The stopwatch climbs to "1.8s", then the copy appears, finishes booting, and answers.
3. Follow-on requests arrive while the copy is still warm: no wait, the stopwatch reads "20ms".
4. Quiet returns, the timer runs out, the copy fades to zero again.
5. An inset toggle, "minimum instances: 0 / 1": with it on, one copy always stays; cost ticks up slightly, but the stopwatch never climbs again.

**The moment**: Beat 2's stopwatch leaping from nothing to "1.8s" the instant traffic resumes from an empty frame.

**Interaction**: Toggle minimum instances between 0 and 1 and watch cost and the first-request stopwatch trade off against each other.

**Ending**: Loop between quiet (empty, free) and a request (a brief wait, then cost).

**Variants**: `cold-start`, `warm-pool`, `autoscaling`, `elasticity`.

**Techniques**: appear / disappear, timer, meter, toggle, caption.

**Review**: Keep — the empty frame and the 1.8 s first-request stopwatch make the trade (free idle, cold first request) concrete.

### Cold start (`cold-start`)

**The aha**: The first requests to a new instance are slow too: provisioning, booting, loading code, opening connections, warming up. Smaller packages, lazy init, minimum instances, warm pools and a load balancer's slow-start ramp all shrink the delay.

**Misconception to defeat**: That a freshly scaled-out copy is instantly as fast as the others, or confusing this with a cold cache.

**Cast**: A new copy cloning into a scale set frame, its own internal timeline strip broken into segments ("provision", "boot OS", "load code", "open DB connections", "warm up"), and a stopwatch on its first few requests.

**Opening frame**: An existing warm copy answering in "20ms". Caption: "A warm copy: fast."

**Story**:

1. A new copy clones in; its timeline lights up segment by segment, each with a duration, several seconds in total before it's marked ready.
2. Its first request lands the instant it goes live: the stopwatch reads "900ms", still opening database connections. Caption: "The first requests to a new copy are slow too."
3. Successive requests get faster: "400ms", "120ms", "25ms", as connections open and code paths warm.
4. Side by side, four fixes shrink the picture: a smaller package shortens "load code"; lazy init reorders the segments so simple requests needn't wait on everything; a minimum instance keeps one copy always pre-warmed; a load balancer's slow-start gives the new copy only a trickle of traffic that ramps up, instead of a full share immediately.

**The moment**: Beat 2's stopwatch jump on a copy that looks ready in the frame but isn't yet, next to slow-start quietly refusing it a full share until it's proven.

**Interaction**: Toggle each mitigation on or off and watch the first-request stopwatch and the timeline shrink.

**Ending**: Hold the mitigated version: a short timeline, a fast first request.

**Variants**: `cold-cache`, `scale-to-zero`, `warm-pool`, `global-load-balancing`.

**Techniques**: clone, timer, chart, toggle, caption, spotlight.

**Review**: Keep — timeline segments, the stopwatch decay and the four mitigations (including load balancer slow start) are accurate and fit one story.

### Warm pools and pre-warmed capacity (`warm-pool`)

**The aha**: Pay a little to keep capacity half-started, so a scale-out takes seconds instead of minutes. The cost is the idle pool.

**Misconception to defeat**: That warm pool instances are already serving traffic; they're idle and ready, but out of rotation, unlike headroom, which already is serving.

**Cast**: Two frames side by side: the live scale set (connected to the splitter, serving traffic) and a warm pool beside it, holding paused, dimmed copies not connected to anything, with a small cost meter.

**Opening frame**: Two live copies serving, two paused copies dimmed in the pool. Caption: "Two serving. Two more, half-started, waiting."

**Story**:

1. Traffic spikes. A paused copy slides out of the pool into the live frame; its internal timeline is already mostly lit (provisioned, booted), only a short "resume" segment plays, taking seconds.
2. A race inset shows a fresh clone going through the full cold-start timeline alongside it, taking far longer to turn green.
3. The pool refills: a new paused copy is created to replace the one just promoted. The cost meter shows the idle pool's price: small for stopped copies (storage only), as much as a live copy for running ones.
4. Traffic falls; a live copy returns to the pool paused, rather than being destroyed, ready for the next spike.

**The moment**: The side-by-side race between promoting from the warm pool and cloning fresh, finishing at wildly different times.

**Interaction**: A warm-pool-size dial, from zero to several; watch the scale-out race time change against the idle cost it buys.

**Ending**: Hold on the pool restocked, cost ticking, ready for the next spike.

**Variants**: `cold-start`, `autoscaling-lag`, `scale-to-zero`, `capacity-headroom`.

**Techniques**: side by side, clone, restyle, timer, meter, caption, dial.

**Review**: Improved — made the cost honest: stopped warm instances cost mainly storage, running ones cost full price, so pool state is the trade-off knob. Race inset kept as the moment.

## Load balancing

### Load balancing (`load-balancing`)

**The aha**: Clients see one address. Behind it, servers can be added, removed or lost without clients noticing, and each one carries a fair share.

**Misconception to defeat**: That a load balancer is just a dumb traffic cop, or that clients secretly talk to one server that happens to change underneath them.

**Cast**: Users sending dots to a single address label, a splitter box, three servers behind it with load bars.

**Opening frame**: One address, the splitter, three servers each near a third of load. Caption: "One address. Three servers behind it."

**Story**:

1. Dots arrive at the address; the splitter fans them out evenly across the three, bars staying close together.
2. A fourth server clones in behind the splitter; the fan-out widens to include it, every bar dropping slightly. Caption: "Add a server: clients don't notice."
3. One server fails and greys out. A couple of dots already inside it flash red and are retried; the splitter's branch to it vanishes within a moment and its share moves to the others. Caption: "Lose one: a blip, then clients carry on."
4. Zoom on the address label: it's the only thing users ever see, while the frame behind it keeps changing shape.

**The moment**: Beat 3: a server dying and the address never flickering; the new dots never see it.

**Interaction**: Add, remove and fail servers; the address and the users' experience never change.

**Ending**: Hold the address steady while the servers behind it keep churning.

**Variants**: `round-robin`, `least-connections`, `health-checks`, `horizontal-scaling`, `global-load-balancing`.

**Techniques**: token, appear / disappear, failure, zoom, spotlight, caption, dial.

**Review**: Improved — a crashed server does fail the requests in flight on it and takes a few seconds to be detected, so beat 3 now shows a small blip rather than "zero effect" (that detail is what `health-checks` and `connection-draining` then pick up).

### Round robin and weighted round robin (`round-robin`)

**The aha**: Taking turns is simple and fair when every request costs the same, but it doesn't look at how busy a server already is, so a run of heavy requests can pile onto one server that keeps getting its turn regardless.

**Misconception to defeat**: That round robin balances load, rather than just request count.

**Cast**: A splitter with a rotating pointer ticking 1, 2, 3, 1, 2, 3; three servers with load bars; request dots sized small or large by cost.

**Opening frame**: The pointer on server 1, uniform small dots, bars level. Caption: "Same-size requests: turns keep it even."

**Story**:

1. The pointer cycles 1, 2, 3 with uniform dots; bars stay level and low. Caption: "Fair, by turn."
2. Every third request is a large, slow one, and the rotation happens to line them up with server 2's turn. Its large dots overlap and its bar climbs to red while 1 and 3 stay calm, though the pointer never skipped a turn. Caption: "It doesn't know server 2 is already busy."
3. A weighted version gives server 1 (bigger) three turns per cycle against the others' one; with uniform cost, load now balances in proportion to size.
4. The heavy-run scenario replays under weighting: it still piles onto whichever server's turn comes up. Caption: "Weight balances size. Not busy-ness."

**The moment**: Beat 2, a server turning red purely from the luck of turn order and request cost, the pointer rotating dutifully the whole time.

**Interaction**: A request-cost dial (uniform or variable) and a weight dial; see where round robin holds up and where it doesn't.

**Ending**: Hold on the red server's bar beside the innocently rotating pointer.

**Variants**: `least-connections`, `load-balancing`.

**Techniques**: token, meter, path trace, chart, dial, caption.

**Review**: Improved — "a run of heavy requests on server 2 across consecutive turns" is impossible with three servers taking turns; replaced with a heavy request every third turn lining up on server 2 (or genuinely uneven request durations).

### Least connections (`least-connections`)

**The aha**: Sending each request to the server with the fewest in-flight requests beats round robin when request lengths vary; checking just two random servers ("power of two choices") gets most of the benefit without checking everyone.

**Misconception to defeat**: That "least connections" means least traffic historically, not least work in progress right now.

**Cast**: A splitter, three servers each showing a stack of in-flight request tokens plus a load bar.

**Opening frame**: Each server with one token in flight. Caption: "Count what's in progress right now."

**Story**:

1. A large, slow request lands on server 1 and sits there, its token staying stacked for a long duration.
2. A new request arrives: server 1 now shows two in flight (one long), servers 2 and 3 show one each. The splitter sends the new request to 2 or 3, the fewest, even though it would have been server 1's turn under round robin. Caption: "Steered away from the busy one."
3. A replay inset shows the same moment under round robin: the new request walks straight into the already-busy server 1, its stopwatch climbing.
4. With many servers, the splitter peeks at just two random ones and picks the lesser, instead of checking every server; a before/after shows bars ending up almost as even either way.

**The moment**: The contrast between beats 2 and 3: least connections dodging the busy server while round robin walks straight into it.

**Interaction**: Toggle between round robin, least connections and power of two choices on the same stream of mixed-length requests.

**Ending**: Hold on least connections' even bars against round robin's lopsided ones.

**Variants**: `round-robin`, `least-response-time`, `load-balancing`.

**Techniques**: contents, meter, path trace, toggle, replay, caption.

**Review**: Keep — dodging the busy server against round robin walking into it, plus power of two choices, is correct and well contrasted.

### Least response time (`least-response-time`)

**The aha**: Routing to whoever answers fastest reacts to slowness directly, but a server that's broken, not slow, fails instantly and looks fastest of all, drawing every request onto it unless errors count against it.

**Misconception to defeat**: That the fastest responder is always the healthiest server.

**Cast**: A splitter, three servers each with a response-time readout and a load bar; one can be switched to "broken" (instant errors).

**Opening frame**: Three servers reading 40ms, 60ms, 50ms, bars roughly even. Caption: "Route to whoever's answering fastest."

**Story**:

1. Server 2 slows under a heavy query; its readout climbs to "300ms", and the splitter quietly shifts more traffic to 1 and 3, whose times stay low. Caption: "Slow server, less traffic. It reacts."
2. Server 2 then breaks entirely, returning instant errors; its readout drops to "2ms", looking like the fastest server, and the splitter floods it with traffic. Every one of those dots bounces straight back red. Caption: "Fastest to fail looks fastest."
3. A fix: errors are counted as a penalty against the response-time score. Server 2's effective score worsens despite its fast raw time, and traffic drains away from it.

**The moment**: Beat 2, the broken server's tempting low time beside a growing pile of red bounced dots, until the penalty in beat 3 corrects it.

**Interaction**: A "break server 2" button and a toggle for counting errors against response time, showing the flood happen or not.

**Ending**: Hold on the corrected state, the broken server avoided, dots piling at 1 and 3 instead.

**Variants**: `least-connections`, `health-checks`.

**Techniques**: meter, failure, path trace, toggle, caption.

**Review**: Keep — fastest-to-fail drawing a flood onto a broken server is a real, memorable failure, and the error-penalty fix is accurate.

### IP hash (hash-based routing) (`ip-hash`)

**The aha**: Hashing the client's IP gives affinity with nothing stored, but everyone behind one shared IP lands on the same server, and adding or removing a server reshuffles almost every client at once.

**Misconception to defeat**: That hashing is as flexible and stable as a stored session mapping.

**Cast**: A splitter showing the formula "hash(IP) mod N → server", users as coloured dots each tagged with an IP, three servers.

**Opening frame**: Five users with distinct IPs, each hashed to a server, consistently, on repeat visits. Caption: "Same IP, same server. No memory needed."

**Story**:

1. Five office workers share one IP behind a NAT box; hash(IP) is identical for all of them, so all five land on server 1. Its bar climbs while 2 and 3 idle. Caption: "One IP, many people: all pinned together."
2. A fourth server is added. The formula recomputes "mod 4" for every user, and about three in four of their connection lines redraw to new servers in a flurry (only one in four keeps its server), scrambling affinity just to add capacity. Caption: "Adding one server reshuffles most users."

**The moment**: Beat 2: one new box triggering a near-total redraw of every line, wildly disproportionate to the small change made.

**Interaction**: An add/remove-server button that replays the reshuffle each time, and a NAT-group-size dial showing how uneven load gets.

**Ending**: Hold on the scrambled lines after one server is added, pointing toward consistent hashing as the fix.

**Variants**: `sticky-sessions`, `consistent-hashing`.

**Techniques**: token, path trace, meter, dial, caption.

**Review**: Improved — gave the real number (going from 3 to 4 servers moves about 75% of clients, N/(N+1) in general) instead of "almost everyone", and softened the caption to match.

### Consistent hashing (`consistent-hashing`)

**The aha**: Servers and keys sit on a ring; each key belongs to the next server clockwise, so a server joining or leaving only moves the keys next to it, about one nth of them, not nearly all of them.

**Misconception to defeat**: Conflating this with plain hash-mod-N (`ip-hash`'s problem), or thinking it's a kind of sharding rather than a placement technique sharding can use.

**Cast**: A circular ring with servers placed as marks around it (each with a few lighter virtual-node ghosts for evenness), and keys as dots that belong to the next server clockwise.

**Opening frame**: A ring with three servers, several keys each assigned clockwise to their nearest mark, the ring visibly divided into three coloured arcs. Caption: "Each key belongs to the next server, going clockwise."

**Story**:

1. Zoom on one key: a line draws clockwise to its nearest server mark. Repeating for a handful of keys shows the three arcs.
2. A replay inset shows plain hash-mod-N adding a server: nearly every key's line redraws at once.
3. Back on the ring, a fourth server mark is inserted. Only the keys in the small arc just before it have their line redraw to it; every other key's line stays untouched. Caption: "Only the neighbouring slice moves. About one nth of the keys."
4. A server is removed; only its arc's keys redraw, pointing to the next server clockwise. Caption: "Leaving moves the same small slice back."
5. Virtual nodes are revealed: each physical server actually owns several scattered marks around the ring, which is why the arcs come out roughly even rather than lumpy.

**The moment**: Beat 3 beside beat 2's inset: one redraws a sliver, the other scrambles everything, for the same change.

**Interaction**: Add or remove a server on the ring and watch exactly which keys' lines redraw, and which stay still.

**Ending**: Hold the ring with four servers, arcs roughly even, most keys never having moved across the whole demo.

**Variants**: `ip-hash`, `sticky-sessions`, `database-sharding` (Data).

**Techniques**: boundary, path trace, spotlight, replay, side by side, caption, dial.

**Review**: Merged — owned by Data (plan in `plans/data.part2.md`). Technically sound (about 1/N of keys move on join or leave). The owner's plan should borrow: the replay inset of hash-mod-N moving about 75% of keys when going from 3 to 4 servers, shown as a live "keys moved" counter beside the ring's ~25%; virtual nodes revealed last as the fix for lumpy arcs; and the removal beat (the leaving server's arc passes to its clockwise neighbour only).

### Health checks (`health-checks`)

**The aha**: A failed server is routed around within seconds, with nobody acting; but a deep check that also tests a shared dependency can fail every server at once and take down the whole service.

**Misconception to defeat**: That a health check only ever reports what's wrong, rather than being something with its own failure modes.

**Cast**: A splitter, three servers each periodically pinged by a probe icon on a timer, a pass/fail indicator per server, and later a shared database cylinder.

**Opening frame**: Three servers, probes ticking every few seconds, all green. Caption: "The load balancer asks, 'are you OK?'"

**Story**:

1. Server 2 crashes and greys out. The next probe times out; a fail counter ticks "1 of 3" (thresholds and intervals are configurable; 2 to 3 fails every 5 to 30 seconds is typical). After three failures in a row the splitter's branch to it is cut, traffic flowing only to 1 and 3. Caption: "A few failures in a row, then it's cut out."
2. Server 2 recovers; the next probe passes, and after a couple of consecutive passes the splitter reconnects it. Caption: "Passes again, traffic resumes."
3. A shallow probe is shown hitting only the server's own "alive" endpoint, always green while the process runs. A deep probe additionally queries the shared database.
4. The database goes down. Every server's deep probe fails at the same moment, and the splitter cuts all three at once, the frame left empty. Some balancers then "fail open" and send to everyone anyway; either way users get errors, and the servers' own healthy parts (cached pages, static files) are no longer reachable. Caption: "A deep check on a shared dependency can fail everyone together."

**The moment**: Beat 4: three independently healthy servers all yanked from rotation at once, because they share one thing the deep check also tests.

**Interaction**: Toggle shallow or deep probing and break the database; watch one server quietly recover under shallow checks versus the deep check's all-or-nothing failure.

**Ending**: Hold on the all-three-cut frame, captioned with the shared dependency it points at.

**Variants**: `connection-draining`, `load-balancing`, `liveness-readiness-probes` (Containers).

**Techniques**: timer, meter, failure, toggle, caption.

**Review**: Improved — added that many balancers fail open when every target looks unhealthy (so the all-cut frame is not always "nothing to send to") and that thresholds and intervals are configurable; the shallow-versus-deep failure remained the best moment.

### Connection draining (`connection-draining`)

**The aha**: Taking a server out shouldn't cut off the users it's already serving; stop sending it new work, let the old work finish, then shut it down.

**Misconception to defeat**: That removing a server from rotation means killing it immediately.

**Cast**: A splitter, a server marked "draining" with a countdown timer, a handful of in-flight request tokens already sitting inside it, and new dots approaching.

**Opening frame**: Server 2 serving normally, three requests in flight. Caption: "Server 2 is being scaled in."

**Story**:

1. Draining starts: a label appears on server 2, and the splitter's branch of new dots to it disappears entirely. The three requests already inside it keep being processed, finishing one by one.
2. A countdown appears, "drain timeout: 30s", ticking down alongside the remaining tokens.
3. All three finish cleanly before the timer expires; server 2 then fades away with zero errors. Caption: "New work stopped. Old work finished. Then it's gone."
4. A contrast inset shows an abrupt removal instead: server 2 is killed while three requests are still inside, and those tokens turn red mid-flight. Caption: "Without draining: in-flight work is lost."
5. A second scenario: one request runs long and the drain timer expires first anyway, cutting it off. Caption: "The timeout is a limit, not a guarantee."

**The moment**: Beat 3 against beat 4's inset, the same removal, one clean and one lossy.

**Interaction**: A drain-timeout dial; set it too short and watch a straggler get cut off anyway.

**Ending**: Hold on the clean drain completing, the server gone, nothing red.

**Variants**: `health-checks`, `sticky-sessions`, `autoscaling`.

**Techniques**: timer, token, path trace, failure, toggle, caption, dial.

**Review**: Keep — the clean-versus-lossy removal and the "timeout is a limit" beat are right (defaults are longer in practice, but the shape holds).

### Global vs regional load balancing (`global-load-balancing`)

**The aha**: There are two layers: a global one picks the nearest healthy region, a regional one picks the server inside it. When a region fails, the global layer sends its users to the next nearest region.

**Misconception to defeat**: That one load balancer handles everything, or confusing this with a CDN.

**Cast**: A world map with a few region markers, a global layer (arrows from users to a region) above a regional layer inside each marker (a splitter and servers, as in `load-balancing`).

**Opening frame**: Three users in different places, each arrow pointing to their nearest region, each region's internal splitter fanning to its own servers. Caption: "Global picks the region. Regional picks the server."

**Story**:

1. Zoom into "Europe": inside, an ordinary splitter and three servers, handling that region's own share, just like regular load balancing.
2. Zoom back out: the global layer's arrows all point to the nearest healthy region, each with a small latency stopwatch, low for the near ones.
3. The "Europe" marker fails entirely, its internal servers all red. The global layer's own health check notices, and the arrows from European users redraw to the next nearest region, their stopwatches now reading higher. Caption: "Lose a region: global routes its users to the next nearest." A toggle "DNS-based / anycast": with DNS, some users keep an old cached answer for the record's TTL (their dots keep hitting the dead region for a minute or more); with an anycast front door the shift takes seconds. Caption: "How fast users move depends on how the global layer is built."
4. Inside the new region, the regional layer absorbs the extra users by spreading them, and a brief autoscale nod shows it coping with the added load.

**The moment**: Beat 3, a region going dark and every one of its arrows bending to a new destination, latency rising but nothing truly broken.

**Interaction**: A "fail a region" button, the DNS / anycast toggle, plus a users-per-region dial to watch the regional layer absorb the shift.

**Ending**: Hold the map with one region dark, arrows rerouted, both layers calm.

**Variants**: `load-balancing`, `cdn`, `dns-failover` (Networking), `failover` (Reliability).

**Techniques**: boundary, zoom, path trace, failure, timer, caption, dial.

**Review**: Improved — the original made failover instant; DNS-based global balancing is delayed by cached answers (TTL) while anycast/proxy front doors move in seconds, so the plan now shows both and says "nearest" is by latency and health.

## Caching: why it works and where it lives

### Caching (`caching`)

**The aha**: A cache keeps copies of answers it has already fetched, so repeat requests come straight back, and only the misses ever reach the database.

**Misconception to defeat**: That a cache is just a faster database, or a full copy kept in sync, which is what a read replica is.

**Cast**: Users on the left, a cache box beside the app with visible keys inside, a database cylinder behind it with a load bar. Each request dot carries a stopwatch.

**Opening frame**: An empty cache, a calm database. Caption: "Ask once, remember the answer."

**Story**:

1. A first request for "item:42" finds no such key (a "?" flickers); it passes through to the database, the stopwatch climbing to "80ms", and as the answer flows back a new key, "item:42 → value", appears inside the cache box.
2. A second request for the same item finds the key already there; a short arrow highlights it, the answer returns at once, no trip to the database, stopwatch reading "2ms". Caption: "A hit: straight back, no trip to the database."
3. A stream of varied requests follows: most are hits, lighting up keys with short stopwatches; a few are misses, travelling to the database and adding new keys. The database's load bar stays low throughout, despite the volume of dots arriving. Caption: "Only misses reach the database."

**The moment**: Beat 2's instant return beside beat 1's long one: the same request, the same answer, wildly different speed.

**Interaction**: Toggle the cache on and off on the same incoming stream and watch the database's load bar and the stopwatches change.

**Ending**: Hold on a calm, low database bar beside a busy, hit-heavy cache.

**Variants**: `cache-hit-ratio`, `cache-layers`, `cache-aside`, `distributed-cache`, `read-replicas` (Data).

**Techniques**: contents, token, timer, meter, toggle, caption.

**Review**: Keep — the same request fast and slow, then misses-only-reach-the-database, is the right core.

### Why caches work: locality and popularity (`locality-of-reference`)

**The aha**: Because popularity is so skewed, a cache holding a small fraction of the data can serve most of the requests, but only because requests aren't spread evenly.

**Misconception to defeat**: That caching only helps once most of the data fits, or that every request is equally likely regardless of what came before.

**Cast**: A shelf of 100 small items and a cache box beside it with only ten slots; above, a popularity chart over the 100 items drawn as a steep, long tail; incoming request dots labelled with the item they want.

**Opening frame**: The long-tail chart, a handful of items towering on the left over a long flat tail. Caption: "Not all data is asked for equally."

**Story**:

1. Requests stream in, most labelled with one of the top ten items, a few with obscure items from the tail.
2. The ten-slot cache, holding just those popular items, lights up a hit for nearly every dot. A counter climbs fast: "92% hits, with 10% of the data cached." Caption: "A small cache catches most of the traffic." (The skew drawn is steep; say "for steeply skewed demand", since a gentler curve gives far less.) Dots also repeat: an item asked a moment ago is likely asked again soon, which is why a cache that simply keeps what it just saw works.
3. The request pattern is swapped to uniform random across all 100 items, and the chart flattens to a line. The same ten-slot cache now only catches a tenth of requests, the counter crawling: "10% hits." Caption: "If every request were different, no cache could help."

**The moment**: The hit counter's race between beats 2 and 3: an identical cache, wildly different hit rates, purely from the shape of demand.

**Interaction**: Toggle the request pattern between skewed and uniform random and watch the hit counter diverge.

**Ending**: Hold on the skewed chart, the tall popular items lit inside the cache, counter high.

**Variants**: `cache-hit-ratio`, `caching`, `cache-eviction`.

**Techniques**: chart, contents, meter, toggle, caption.

**Review**: Improved — made explicit that 92% is a stylised steep skew (a gentler Zipf curve gives far less) and added the second half of locality, recent items being asked again, which the title promised but the story omitted.

### Cache hit ratio (`cache-hit-ratio`)

**The aha**: The source only sees the misses, so going from 90% to 99% hit ratio cuts its load tenfold; a small change in hit ratio makes a big change in backend load.

**Misconception to defeat**: That hit ratio and backend load scale the same way, so a slightly better ratio means a slightly lighter backend.

**Cast**: A cache box with a hit-ratio dial, a database cylinder with a load bar, and a readout of the percentage of traffic reaching the database.

**Opening frame**: The dial at 90%, the database bar reading "10% of traffic, load 40%". Caption: "90% hits: the database sees the other 10%."

**Story**:

1. The dial is nudged to 95%; the miss share drops from 10% to 5%, and the database bar drops to "20%". Caption: "95%: half the backend load."
2. The dial is nudged to 99%: misses drop to 1%, the bar nearly flat at "4%". A readout spells it out: "10% → 1% miss rate = 10× less load."
3. The dial is nudged the other way, down to 80%: misses jump to 20%, the bar surges to red, "load 80%+". Caption: "A small drop in hit ratio: a big jump in backend load."

**The moment**: Equal-looking steps on the dial (90 → 95 → 99) producing misses that halve, then fall fivefold (10% → 5% → 1%): the nonlinearity made visible.

**Interaction**: A hit-ratio dial the viewer drags, watching the database bar and the readout react disproportionately.

**Ending**: Hold at 99%, the database bar nearly flat, the dial pushed toward the top.

**Variants**: `caching`, `locality-of-reference`, `cache-stampede`.

**Techniques**: meter, dial, chart, caption.

**Review**: Improved — the moment claimed the misses halve each step; they halve from 90 to 95 and fall fivefold from 95 to 99. Corrected. All the load arithmetic checked out.

### Where caches live (`cache-layers`)

**The aha**: Caches sit at every hop, browser, CDN edge, reverse proxy, application and the database's own memory; each layer answers what it can and passes the rest on. The closer the hit, the more it saves, but every extra layer is one more copy that can go stale.

**Misconception to defeat**: That "the cache" is one single thing in one place.

**Cast**: A left-to-right pipeline of five boxes, "Browser", "CDN edge", "Reverse proxy", "App", "Database", each with a small cache icon and a hit/miss indicator. A single request dot travels the pipeline.

**Opening frame**: All five boxes empty and cold. Caption: "A request can be answered at any of five stops."

**Story**:

1. A request dot checks the browser first, misses, passes on; checks the CDN edge, misses, passes on; the reverse proxy, misses, passes on; the app, misses, passes on; finally reaches the database, which computes the answer. As it flows back, each layer stores a copy in turn, keys lighting up at every box.
2. A second identical request hits at the very first stop, the browser, and never leaves the user's machine. Caption: "The closer the hit, the less it costs."
3. The underlying data changes at the database. The cached copies at the browser, CDN edge, reverse proxy and app are now stale, a small flag appearing on each, until each expires or is invalidated on its own schedule. The server can purge the CDN and proxy but cannot reach into the browser: the stalest copy is the one nobody controls. Caption: "Every extra layer is one more copy that can go stale."

**The moment**: Beat 2's dot stopping dead at the very first box, against beat 1's long full-pipeline trip for the exact same answer.

**Interaction**: A flush button for each box individually, letting the viewer see which stop a later request now has to reach.

**Ending**: Hold the five-stop pipeline with keys present at every layer, captioned "each layer answers what it can."

**Variants**: `browser-cache`, `reverse-proxy-cache`, `distributed-cache`, `cdn`, `cache-ttl`, `cache-invalidation`.

**Techniques**: path trace, contents, lanes, replay, restyle, caption.

**Review**: Improved — the stale flags skipped the browser, the layer that is hardest to invalidate; added it with that point. The five-stop trip against the first-stop hit stays the moment.

### Browser cache and HTTP caching (`browser-cache`)

**The aha**: The fastest request is the one never sent. The server decides how long a response may be reused, and revalidation turns a full download into a quick "still good?" check.

**Misconception to defeat**: That the browser always re-downloads, or that caching and revalidation are the same thing.

**Cast**: One user's browser with a cache slot holding a response plus a "Cache-Control: max-age=60" tag and an ETag, a server on the right, and a timer counting the max-age down.

**Opening frame**: An empty browser cache, a ready server. Caption: "First visit to a page."

**Story**:

1. The browser requests the page; the server replies with the content plus its headers, both stored in the browser's cache slot, and a 60-second timer starts.
2. Within that time the user revisits; the browser serves straight from its own slot, no request drawn at all. Caption: "No request sent. Instant."
3. The timer hits zero; the user revisits again. A small request goes out this time, carrying the stored ETag. The content hasn't changed, so the server replies "304 Not Modified", a tiny response with no body, and the browser keeps its stored copy, resetting the timer. Caption: "Expired, but unchanged: a quick check, not a full download."
4. The content actually changes on the server; the next revalidation gets a full "200 OK" with new content and a new ETag, replacing the cached copy.

**The moment**: Beat 3's tiny 304 beside beat 1's full download, the same page, radically different sizes, triggered by the same expired timer.

**Interaction**: A "change content" button and a time-skip control to expire the timer, showing which kind of reply comes back.

**Ending**: Hold on the browser serving instantly from cache, the timer ticking down again.

**Variants**: `cache-layers`, `cdn`, `cache-ttl`.

**Techniques**: timer, token, contents, chart, caption, dial.

**Review**: Keep — expiry, ETag revalidation and the 304 against the full 200 are accurate and the tiny reply is the moment.

### Reverse proxy cache (`reverse-proxy-cache`)

**The aha**: A proxy in front of the app servers stores whole responses and serves repeats itself; a popular page is built once and served many times, and the app servers only see misses and personalised requests.

**Misconception to defeat**: Confusing this with a CDN, the same idea spread worldwide rather than sitting locally in front of the servers, or assuming it can safely cache personalised pages.

**Cast**: Users on the left, a proxy box in front of a scale set of app servers, the proxy holding visible full-page cache entries, the servers each with a load bar.

**Opening frame**: An empty proxy, idle app servers. Caption: "A popular page, requested by many."

**Story**:

1. The first user requests "/home"; the proxy has no entry and passes the request through. An app server builds the full page, and the proxy stores the whole rendered result as an entry labelled "/home".
2. The next five hundred users request "/home"; the proxy answers every one directly from its stored entry, the path to the app servers staying unused, their bars flat. Caption: "Built once. Served many times."
3. A different request, "/account", carries a cookie and the response is marked private; by the proxy's rules it isn't stored, so every one passes straight through and the app servers' bars tick up. Caption: "Personalised requests still reach the app." (Cached by mistake, one user would see another's page.) If 500 users ask for an uncached page in the same instant, a good proxy sends one request and makes the rest wait for it (`cache-stampede`).

**The moment**: Beat 2's wall of five hundred dots all stopping at the proxy, the app servers' bars staying flat the entire time.

**Interaction**: Toggle a page between cacheable and personalised and watch whether traffic reaches the app servers.

**Ending**: Hold on the proxy fielding the crowd, the app servers calm underneath.

**Variants**: `cdn`, `cache-layers`, `load-balancing`.

**Techniques**: contents, path trace, meter, toggle, caption.

**Review**: Improved — made personalisation a rule (private responses, cookies) rather than the proxy "recognising" it, named the danger of caching it, and linked the simultaneous-miss case to `cache-stampede`.

### Distributed cache (vs in-process cache) (`distributed-cache`)

**The aha**: A shared cache cluster that every instance reads and writes beats each instance keeping its own cache: separate in-process caches warm up separately and disagree after an update, at the cost of a network hop and one more service to run.

**Misconception to defeat**: Assuming "the cache" automatically means one shared thing, when a per-instance, in-memory cache is a real and different option with real downsides.

**Cast**: A scale set of three app copies, each starting with its own small in-process cache pocket; later, a separate shared cache cluster box that all three connect to instead.

**Opening frame**: Three copies, each with an empty in-process pocket. Caption: "Each copy keeps its own cache."

**Story**:

1. A request for "item:42" hits copy 1, misses, is fetched from the database, and stored only in copy 1's pocket.
2. The splitter sends the next "item:42" request to copy 2, which has never seen it: another miss, another database fetch, stored only in copy 2's pocket. The same happens for copy 3. Caption: "Each warms up separately. Three misses for the same item."
3. The underlying data changes. Copy 1 updates its own pocket, but copies 2 and 3 still hold the old value, a stale flag appearing on each. Caption: "And they can disagree after an update."
4. A replay removes the pockets and adds a shared cache cluster box connected to all three. "item:42" via copy 1 misses once, is fetched, and written into the shared cluster; via copy 2 it hits directly from the cluster over a short network hop, not a database trip; the same for copy 3.
5. The data changes once more; one update to the shared entry is instantly visible to all three copies next time they read it. Caption: "One copy, seen by everyone. At the cost of a network hop."

**The moment**: Beat 3's three disagreeing pockets against beat 5's single shared value updating cleanly for everyone.

**Interaction**: Toggle between in-process and distributed on the same three copies and watch miss counts and consistency after an update.

**Ending**: Hold on the shared cluster, all three copies reading the same fresh value.

**Variants**: `caching`, `stateless-vs-stateful`, `cache-invalidation`, `database-sharding` (Data).

**Techniques**: contents, path trace, replay, toggle, restyle, caption.

**Review**: Keep — three disagreeing pockets against one shared value shows both warm-up and staleness; the network-hop cost is stated.

### Cold cache and cache warming (`cold-cache`)

**The aha**: A backend sized for the cache's misses can't survive 100% misses; when the cache is empty, all traffic hits the source at once, so it's warmed before cutover or ramped in slowly instead.

**Misconception to defeat**: Confusing this with a cold start, a new instance booting, rather than an empty cache on a service that's already running.

**Cast**: A cache box, a database cylinder with a load bar, and a steady stream of users.

**Opening frame**: A warm cache, mostly hits, the database bar calm at 10%. Caption: "A warm cache: most requests never reach the database."

**Story**:

1. The cache is flushed, a sweep clearing every key; the box goes empty. Caption: "Restart, deployment, or flush: the cache comes back empty."
2. The same traffic continues at full volume. Every request now misses and floods straight to the database, whose bar spikes instantly to red; dots start bouncing off as errors. Caption: "Empty cache: every request is a miss, all at once."
3. A replay shows warming instead: before traffic is switched on, a background pass reads the popular keys from the database and pre-fills the cache, one key at a time, with the database bar rising only modestly during this quiet pre-fill.
4. Real traffic is switched on once warmed; the hit ratio starts high immediately and the database bar stays calm. Caption: "Warm it first, then let traffic in."
5. A second fix: instead of pre-warming, traffic is ramped in slowly after a flush, from 1% to 100% over a couple of minutes, giving the cache time to fill itself from real misses without ever facing the full flood at once.

**The moment**: Beat 2's instant red spike the moment the empty cache meets full traffic, against beat 4's calm, immediate start after warming.

**Interaction**: A "flush cache" button paired with a traffic-ramp dial; flushing at full traffic spikes the database, flushing with the ramp turned down doesn't.

**Ending**: Hold on the warmed cache absorbing full traffic calmly, the database bar flat.

**Variants**: `cold-start`, `caching`, `cache-stampede`, `distributed-cache`.

**Techniques**: contents, meter, failure, timer, dial, replay, caption.

**Review**: Keep — the instant red spike on an empty cache against the warmed start, with a ramp as the second fix, is correct and distinct from a cold start.
