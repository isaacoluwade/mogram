# Scaling plans, part 3

Groups 8 to 10 of `catalog/scaling.md`. One technique is added to the vocabulary here:
**code trace**: a short code or query snippet beside the diagram, whose running line lights up in
step with what the diagram does (used in `n-plus-one-queries`, which Data owns; offered to its plan).

## Doing less work per request

### Asynchronous (non-blocking) I/O (`non-blocking-io`)

**The aha**: Most of a request's life is spent waiting, so a server that parks waiting requests serves thousands with a few threads, while one that gives each request a thread runs out of threads with its CPU idle.
**Misconception to defeat**: "Async makes code faster," and "we're out of capacity" when the server is really out of threads, not CPU.
**Cast**: Two one-core servers side by side, both calling one database cylinder on the right. Left, "Thread per request": four thread lanes. Right, "Event loop": one thread lane plus a "waiting" shelf. A CPU meter and an "in flight" counter on each. Requests are dots; in a lane, each draws its time as a bar: a green sliver of work, a long grey "waiting for database", a green sliver (1 ms of work in all, 99 ms of waiting).
**Opening frame**: Both servers idle at CPU 0%, the shared database, a small crowd on the left ready to send.
**Story**:

1. One request enters the left server. Its thread works for a sliver, sends a query, then sits grey. "Blocked: waiting for the database."
2. Four requests fill all four lanes, all grey. A fifth queues at the door, its stopwatch climbing. CPU 4%. "Out of threads. CPU 4% busy."
3. Same arrivals on the right. The thread does its sliver, sends the query, sets the request on the shelf with an hourglass, and takes the next. The shelf fills with dozens. "Park it. Take the next one."
4. Replies come back; each parked request lights up and the thread finishes it. The lane becomes solid green slivers, back to back.
5. A CPU-heavy "resize image" request arrives on the right: one long green bar, and the whole shelf waits behind it. "CPU work gets no faster, and blocks the loop."
   **The moment**: Freeze at beat 4 and spotlight both servers on the same core: left, lanes 99% grey, 4 in flight, 40 req/s, CPU 4%; right, the lane solid green, 50 in flight, 500 req/s, CPU 50%. "The wait didn't shrink. The thread stopped waiting with it."
   **Interaction**: A "time spent waiting" dial (99% → 10%): as waiting falls, the right server's advantage fades to nothing. An arrivals dial: past 1,000 req/s the right server's CPU hits 100%, its honest limit. A button to send the CPU-heavy request.
   **Ending**: Same load on both: a long line at the left door, a full shelf and an empty door on the right.
   **Variants**: `concurrency-vs-parallelism`, `littles-law`, `connection-pooling`.
   **Techniques**: side by side, lanes, contents, token, meter, timer, spotlight, dial, caption.
   **Review**: Improved — the numbers didn't add up (4 threads at CPU 5% beside 200 in flight at CPU 40% on one thread); both servers now share one core with 1 ms of work per 100 ms request, so 4 in flight at 40 req/s and CPU 4% sits against 50 in flight at 500 req/s and CPU 50%, all consistent with Little's Law. Beat 5 now names the event loop's own hazard (CPU work blocks everyone waiting), and an arrivals dial shows that CPU is now the honest limit. Weighed the waiter metaphor (one waiter per table vs one taking orders from every table); the lanes are the real mechanism and already read as clearly.

### Connection pooling (`connection-pooling`)

**The aha**: Opening a connection costs several round trips and reusing one costs almost nothing; the pool also caps what the database sees, and scaling out multiplies that cap.
**Misconception to defeat**: "Connections are free, open one per request," and then "more app instances is always safe for the database."
**Cast**: An app server (centre-left), a database cylinder (right) with a "connections 0 / 500" meter. Connections are pipes between them. Setup is an exchange of labelled arrows: TCP, TLS, login. A stopwatch on each request.
**Opening frame**: One app, one database, no pipes, one request waiting in the app.
**Story**:

1. The request needs data. A pipe is built arrow by arrow: TCP handshake, TLS hello, login (the database also starts a process for it). Then the 1 ms query, then the pipe is torn down. Stopwatch 21 ms. "20 ms of setup for a 1 ms query." The next request, fast-forwarded, climbs the whole ladder again.
2. A pool tray appears inside the app holding 10 open pipes. A request borrows one (it lights), queries, returns it (it dims). 1 ms. "Borrow, use, return."
3. A burst of 30: all 10 pipes busy, the rest wait a moment in a short line. The database meter stays at 10. "The pool caps the database's load too."
4. Zoom out: the scale set clones the app to 100 instances, each with a pool of 20. Pipes thicken into a web; the meter races past 500 to 2,000 and turns red; new logins fail. "100 instances × 20 = 2,000 connections."
5. A pooling proxy slides in between: the 2,000 thin pipes land on it, and it lends 100 real connections out, one transaction at a time. Meter green. "Many app connections, a few database ones."
   **The moment**: Beats 1 and 2 replayed side by side: one request climbing the whole handshake ladder, the other dropping straight down an open pipe. 21 ms against 1 ms.
   **Interaction**: Dials for instance count and pool size, their product shown on the database meter against its limit (scale-out is where the limit gets hit, often with serverless functions that each open their own); a toggle for the pooling proxy.
   **Ending**: 100 app instances, one proxy, a calm database meter.
   **Variants**: Data's `database-connection-pooling`; `non-blocking-io`, `latency-numbers`; Networking's HTTP keep-alive (the same reuse for HTTP); Amazon RDS Proxy, the built-in PgBouncer in Azure Database for PostgreSQL flexible server.
   **Techniques**: exchange, token, timer, contents, meter, clone, zoom, failure, side by side, dial, toggle, caption.
   **Review**: Improved — folded the repeated handshake (old beat 2, which changed nothing new) into beat 1 as a fast-forward, leaving five beats. The proxy beat now says how it fits 2,000 clients into 100 connections (lending a real connection per transaction), and the interaction names serverless as the usual way the limit is hit. Checked: 20 ms of setup is realistic for TCP + TLS + authentication plus the server-side process a PostgreSQL connection costs. Weighed making the 2,000-connection flood the moment, since it's this area's angle; kept reuse as the click because everything after builds on it, and Data's `database-connection-pooling` covers the same reuse more slowly.

### Batching (and chatty I/O) (`batching`)

**The aha**: Every call pays a fixed overhead (a round trip, a commit), so many tiny calls pay it again and again while one batch pays it once.
**Misconception to defeat**: "The cost is in the data, so 500 small calls cost the same as one call of 500 items." Also mixed up with request coalescing, which merges identical requests.
**Cast**: An app (left) holding 10 rows as small squares; a database cylinder (right) a visible distance away. Each call is an envelope: a grey header (the overhead) carrying rows. Below, a timeline lane where each call draws a fat grey block (trip and commit) and a thin green sliver (the actual insert). A total timer.
**Opening frame**: 10 rows in the app marked "save these", the database, an empty timeline.
**Story**:

1. Chatty: one envelope with one row travels out, an ack travels back. The lane draws a grey block and a sliver. "One row, one trip."
2. Nine more, one after another. Ten grey blocks, ten slivers. Timer 10 ms. "The overhead, paid ten times."
3. Rewind. All ten rows slide into one envelope; one trip, one ack. One grey block, ten slivers. Timer 1.1 ms. "One trip for all ten."
4. Scale to 500 rows: "500 trips, 505 ms" against "1 trip, 6 ms".
5. The price: rows now trickle in, and the envelope waits to fill ("send at 50 rows or 10 ms"). The first row's stopwatch ticks while it waits. "More throughput, a little latency."
   **The moment**: The two lanes stacked at 500 rows: a wall of grey above, one block below, with a "time spent on overhead" meter reading 99% against 17%.
   **Interaction**: A batch-size dial (1 → 500) showing total time and first-row wait together, so the sweet spot shows. A distance dial (same zone 1 ms → another region 50 ms): chatty calls become a disaster at distance; the batch barely notices.
   **Ending**: Both lanes at 500 rows: a long grey ribbon and one short block.
   **Variants**: `n-plus-one-queries`, `request-coalescing`, `latency-numbers`; Architecture's `gateway-aggregation`.
   **Techniques**: token, lanes, timer, meter, contents, side by side, dial, caption.
   **Review**: Improved — the overhead meter's 92% against 8% didn't match the story's own numbers (1 ms per trip, 0.01 ms per row gives 99% against 17% at 500 rows), so it now reads that, and the moment moves to 500 rows, where the wall of grey is at its most striking. Small timing fixes to match (1.1 ms, 505 ms). Weighed a delivery-van metaphor (one parcel per trip vs a full van); the envelope with its grey header is already that picture, with the real overhead labelled.

### Compression (`compression`)

**The aha**: Text and JSON shrink by 70–90%, so they arrive faster and cost less to send, for a little CPU; images and video are already compressed and gain nothing.
**Misconception to defeat**: "Compress everything": images and video are already compressed, and on a fast internal link the CPU can cost more than the bytes save.
**Cast**: A server (right) with a CPU meter and a compressor at its exit; a phone user (left) at the end of a thin 1 Mbps "mobile link" pipe. Payloads are blocks whose length is their size, labelled in KB. An egress cost meter; a stopwatch on each transfer.
**Opening frame**: A 100 KB JSON block at the server's exit, the thin pipe, the waiting phone.
**Story**:

1. Uncompressed, the long block crawls down the pipe. 800 ms. "100 KB of JSON."
2. Zoom into the block: the same keys ("name", "price", "sku") repeat on every row, highlighted in matching colours. "Text repeats itself."
3. The phone's request carries a tag, "Accept-Encoding: br, gzip". The compressor swaps each repeat for a tiny back-reference (an arrow to the first copy). The block shrinks to 15 KB, tagged "Content-Encoding: br"; the CPU meter blips for 2 ms. "Repeats become pointers."
4. The short block crosses in 120 ms; the egress meter moves 15% as far.
5. A 100 KB JPEG goes through the compressor: CPU blips, the block stays 99 KB. "Already compressed. Nothing left to squeeze."
   **The moment**: Beat 4 run beside beat 1 on two identical pipes: the compressed block has landed while the plain one is barely a seventh of the way along.
   **Interaction**: Choose the payload (JSON, HTML, CSV log, JPEG, MP4) and see its ratio. A link-speed dial (mobile → 10 Gbps inside a data centre): on a fat pipe the time saved shrinks below the CPU time spent, so compression stops paying for speed. A level dial trades smaller output for more CPU.
   **Ending**: A results board: JSON −85%, HTML −80%, JPEG −1%.
   **Variants**: `cdn` (edges compress for you), `static-content-hosting`, `latency-vs-throughput`; Fundamentals' `data-transfer-costs`.
   **Techniques**: token, zoom, restyle, meter, timer, side by side, choice, dial, caption.
   **Review**: Improved — dropped minification from the misconception (nothing in the story addressed it, and it's a second idea) and sharpened "compress everything" to the two cases the story actually shows. Beat 3 now shows how it's switched on in HTTP (the client's Accept-Encoding, the server's Content-Encoding), and the "a sixth / a seventh" mismatch is fixed to 15%. Checked: 100 KB at 1 Mbps is 800 ms, 15 KB is 120 ms; JSON shrinking 80–90% with gzip or Brotli is typical; LZ-style back-references are what gzip, Brotli and zstd all build on. Weighed a vacuum-packing metaphor; the zoom onto repeated keys is truer and shows why text compresses and JPEG doesn't.

### Pagination (fetch only what you need) (`pagination`)

**The aha**: Fetch only the rows and fields you'll show; offset pages get slower the deeper you go because the skipped rows are still read, while cursor pages stay fast.
**Misconception to defeat**: "SELECT \* and let the client pick," and "OFFSET 5000 jumps straight to row 5,000."
**Cast**: A phone (left) with ten row slots; a database cylinder (right) opened to show a tall column of 10,000 rows; a pipe between. A "rows read" counter and a stopwatch on the database. A query label above the pipe that changes each beat.
**Opening frame**: The empty phone, the tall table, the label `SELECT * FROM orders`.
**Story**:

1. Every row lights as it's read; a thick stream floods the pipe; the app's memory meter swells; the phone fills its ten slots. Rows read: 10,000. "10,000 rows fetched. 10 shown."
2. The label becomes `SELECT id, total, date … LIMIT 10`. Ten narrow rows travel. "One page. Only the fields you show."
3. The user pages deep: `ORDER BY id OFFSET 5000 LIMIT 10`. A read head walks down the table; 5,000 rows flash grey ("read, then thrown away") before ten light up. Rows read: 5,010. A chart strip plots latency by page number: rising.
4. Page 1,000: the walk is twice as long; the line keeps climbing.
5. Cursor: the last page ended at id 5000, so the app asks `WHERE id > 5000 ORDER BY id LIMIT 10`. The head jumps straight to row 5,001 through the index and reads ten. Rows read: 10. The chart gains a flat second line. "Start where you stopped."
   **The moment**: Beats 3 and 5 side by side on the same table, the walk slowed so the waste is felt: the offset head trudging past thousands of grey rows, the cursor head arriving in one leap.
   **Interaction**: A page-number slider (1 → 1,000): the offset walk lengthens while the cursor stays instant. A toggle between `SELECT *` and named fields thins the stream. An "insert a row above" button while paging: every row below shifts down one, so the next offset page shows a row twice; the cursor page doesn't. The trade, in one caption: a cursor can go next and back, but can't jump to page 437.
   **Ending**: The chart: one line climbing, one flat.
   **Variants**: `n-plus-one-queries`, `compression`; Data's `database-indexes`.
   **Techniques**: contents, spotlight, stream, move, meter, timer, chart, side by side, dial, toggle, caption.
   **Review**: Improved — the queries lacked `ORDER BY`, without which neither offset nor keyset paging is defined; the cursor beat now says where its id comes from ("start where you stopped"). The interaction adds offset paging's other flaw (rows shifting under inserts, so one shows twice) and the cursor's honest price (no jumping to an arbitrary page). Checked: OFFSET still reads and discards the skipped rows, so cost grows with depth; a keyset seek on an indexed column reads only the page. Weighed a bookmark metaphor (re-counting pages from the front vs opening at the bookmark); "start where you stopped" carries it without leaving the table.

### N+1 queries (`n-plus-one-queries`)

**The aha**: Fetching a list, then querying once per item, costs 1 + N round trips: harmless with 10 rows, a collapse with 10,000, and one join or batched query fixes it.
**Misconception to defeat**: "Each query is fast, so the page is fast," and "it passed in testing." The ORM hides the queries behind lines that look like plain property reads.
**Cast**: An app server (left) with a code panel; a database cylinder (right). A round-trip counter and a stopwatch on the page request. A data label: "rows: 10 (test)". The code:
`orders = Order.all()` / `for o in orders:` / `show(o.customer.name)`
**Opening frame**: The code panel, the database, the counter at 0.
**Story**:

1. Line 1 lights; one query goes out, ten orders come back. Counter 1.
2. The loop runs. `o.customer.name` looks harmless, but each time it lights, a query token escapes from it to the database and back. Ten small round trips, one after another. Counter 11, stopwatch 12 ms. "Fine in testing."
3. The label flips to "rows: 10,000 (production)". Same code. The round trips blur; the counter spins to 10,001; the database's load bar goes red; the stopwatch passes 10 s. "Same code. 10,001 round trips."
4. The fix: the first line becomes `Order.all().include(customer)`. Two queries: the orders, then one `WHERE id IN (…)` carrying every customer id. Counter 2, stopwatch 40 ms.
   **The moment**: Beat 2 slowed on the innocent line: each pass, the line flashes and a query leaves it. Then the cut to beat 3, where the flash becomes a strobe.
   **Interaction**: A rows dial (10 → 10,000) and an eager-loading toggle, with counter and stopwatch for both. A distance dial (same host → another zone): N+1 grows with every millisecond of round trip; the fixed version barely moves.
   **Ending**: Two counters at 10,000 rows: 10,001 and 2.
   **Variants**: `batching` (chatty I/O, the general form), `pagination`, `latency-numbers`.
   **Techniques**: code trace (new), exchange, token, meter, timer, spotlight, side by side, dial, toggle, caption.
   **Review**: Merged — owned by Data (`plans/data.part2.md`). Data's plan should borrow: the "rows: 10 (test)" → "rows: 10,000 (production)" flip under the same code, the catalog's most memorable failure, which its plan lacks; the code trace, with the innocent `o.customer.name` line flashing each time a query escapes from it, so the ORM's hidden query is seen leaving a line that looks like a property read (its own misconception); the database's load bar going red, since N+1 costs the database as well as the page; and a distance dial (same host → another zone) showing N+1 scale with round-trip time while the fixed version barely moves.

### Materialised views and precomputation (`materialised-view`)

**The aha**: Move work from read time to write time: if a result is read a thousand times per change, computing it once per change is far cheaper.
**Misconception to defeat**: "It's just a cache." A cache fills on the first read, so someone pays the miss; a view is kept ready before anyone asks.
**Cast**: Readers on the left looking at a "Sales by region" dashboard; a database (right) holding three small tables (orders, products, regions); a writer at the top posting new orders. A database CPU meter, a "work done" counter, stopwatches on reads. Later, a small ready table beside the database: the view.
**Opening frame**: The dashboard, the three tables, one reader about to ask.
**Story**:

1. One read: rows from the three tables fly together, join and sum, and the answer returns. CPU spikes; 800 ms. Work: 1.
2. A thousand readers in a minute. The same join runs a thousand times; CPU red; work 1,000. "Same answer, computed 1,000 times."
3. The view appears: "sales_by_region", four ready rows. A new order arrives from the writer; only its region's total ticks up, at write time. Work: 1. "Updated when the data changes, before anyone asks."
4. A thousand reads go to the view: each a lookup, 5 ms. CPU calm.
5. Refreshing on a schedule instead: a new order lands but the view still shows the old total, with a small timer "refreshes in 4:00". "Fast reads, slightly behind."
   **The moment**: Beats 2 and 4 side by side with "1,000 reads : 1 write" stamped between them: a work counter of 1,000 against a work counter of 1.
   **Interaction**: A read:write ratio dial. At 1,000:1 the view wins hugely; at 1:10 (write-heavy, rarely read) it does more work than it saves and the counters flip. A toggle for "refresh on every write" vs "every 5 minutes", trading freshness for write cost. A "cache instead" toggle: after every change, the first reader waits the full 800 ms for the miss; with the view, nobody does.
   **Ending**: Readers served from the small ready table, the big tables quiet.
   **Variants**: `cache-aside` (the lazy alternative), `scaling-reads-vs-writes`; Data's `materialized-views`; Architecture's `cqrs`; precomputed feeds (a timeline written into each follower's inbox when someone posts).
   **Techniques**: contents, token, meter, timer, appear / disappear, side by side, dial, toggle, caption.
   **Review**: Improved — the misconception (it's just a cache) was named but never shown; a "cache instead" toggle now makes the first reader after each change pay the miss, against a view that's ready before anyone asks, which beat 3's caption now says. Added precomputed feeds as a variant, so precomputation isn't read as a database feature only. Checked: per-write updates are incremental maintenance (SQL Server indexed views, BigQuery, streaming databases); PostgreSQL's `REFRESH MATERIALIZED VIEW` recomputes whole, which is the scheduled path of beat 5. Weighed a "pre-printed timetable vs asking the clerk" metaphor; the work counters already make the trade numeric.

### Scaling reads vs scaling writes (`scaling-reads-vs-writes`)

**The aha**: Copies multiply read capacity, but every copy has to apply every write, so copies don't help writes; to scale writes, each node must own only part of the data.
**Misconception to defeat**: "Add replicas until the database stops struggling," whatever it's struggling with.
**Cast**: Users on the left sending reads (blue dots) and writes (orange dots). Database cylinders, each with a load bar split into a blue part (reads) and an orange part (writes). A chart strip with two lines: read capacity and write capacity.
**Opening frame**: One database, its bar overflowing red: mostly blue with a solid orange slice.
**Story**:

1. Two replicas appear. Reads fan out across three nodes; each node's blue part drops to a third. "Copies share the reads."
2. Follow one write, slowed, with its path traced: it lands on the primary and is cloned to each replica. Every node's orange part stays exactly as tall. "Every copy applies every write."
3. Writes double (a sale). Three more replicas pop in one by one: the blue parts shrink each time, the orange slices don't move, and they turn the bars red on their own. Chart: read capacity climbing in steps, write capacity flat.
4. Split instead: the data divides into two shards, A–M and N–Z. Writes route by key; each node's orange part halves. "Each node owns part of the data."
5. Each shard keeps one replica for its reads. Blue and orange both low.
   **The moment**: Beat 3: in one picture, every new replica shrinks the blue parts while the orange parts stay put, and the flat orange chart line makes it undeniable.
   **Interaction**: Dials for replicas (1–8), shards (1–4) and the read/write mix. Replicas only move blue; shards move orange. A write-heavy mix makes the replicas useless on screen.
   **Ending**: Two shards with a replica each, every bar green, both chart lines rising.
   **Variants**: Data's `read-replicas`, `database-sharding`, `replication-lag`; `caching` (another read copy), `queue-load-levelling` (smoothing writes over time).
   **Techniques**: stream, clone, meter, chart, path trace, spotlight, appear / disappear, dial, caption.
   **Review**: Keep — the two-colour load bar makes the whole argument visible at once: every replica shrinks the blue and leaves the orange untouched, and the flat write-capacity line removes any doubt. Correct as drawn (a full replica applies every write; a shard owns only its key range). Weighed a library metaphor (photocopies of a book help readers, not the author editing it); the bars are the real thing and say it faster.

## Protecting capacity

### Overload and goodput collapse (`overload`)

**The aha**: Past capacity, throughput doesn't level off: useful work collapses while the servers show 100% busy, so overload has to be stopped at the door.
**Misconception to defeat**: "At the limit the server maxes out, and the extra requests just wait": a flat plateau.
**Cast**: Users on the left; one server with a load bar and a visible queue at its door. Each request carries a stopwatch; each user has a patience ring (a 2 s timeout) that drains. A user who gives up turns grey, but their request stays queued as a hollow ghost. Replies leave green (someone's waiting) or grey (nobody is). A chart strip: offered load across, with a "busy" line, a "goodput" line and a dashed plateau labelled "what people expect".
**Opening frame**: Light traffic, a short queue, green replies, the dashed plateau already on the chart.
**Story**:

1. Load rises to 90% of capacity: the queue lengthens a little, everything green. Goodput climbs the diagonal with load, toward the plateau.
2. 120%: the queue grows without stopping; stopwatches pass 2 s. The first user gives up; their ghost is still worked on, and its grey reply goes nowhere. "Working on a request nobody's waiting for."
3. The grey users retry, each sending a fresh dot. The queue grows faster.
4. The load bar stays pinned at 100%, but the output is now mostly grey; goodput dives under the dashed line. "100% busy. Almost nothing useful."
5. A gate at the door turns the excess away instantly (red bounce, "503"). The queue shortens, replies turn green, goodput climbs back to the plateau. "Stop overload at the door."
   **The moment**: Beat 4, slowed: spotlight the output stream fading from green to grey under a load bar that never moves, while the chart's goodput line peels away from the expected plateau.
   **Interaction**: An offered-load dial (50–200%) that draws the curve live; toggles for "clients retry on timeout" (the collapse steepens) and "turn away excess at the door" (the plateau holds).
   **Ending**: The chart with both curves: the collapse, and the held plateau.
   **Variants**: Reliability's `overload-and-goodput`, `retry-storm`, `metastable-failure`; `load-shedding`, `admission-control`, `utilisation-vs-latency`.
   **Techniques**: stream, contents, timer, restyle, meter, chart, spotlight, failure, dial, toggle, caption.
   **Review**: Improved — beat 1 no longer shows a calm, short queue at 100% load, which contradicts `utilisation-vs-latency` (with random arrivals the queue at 100% never settles); it now stops at 90%, and beat 2 says the queue grows without stopping. Otherwise strong: drawing the expected plateau in the opening frame puts the wrong model on screen before the real curve peels away from it, and the 503 at the door hands over to `load-shedding`. Weighed Reliability's moment (the worker labouring over a ghost); beat 2 already has it, and the chart is the better climax. Flag: Reliability catalogues the same idea as `overload-and-goodput`, an id `tools/catalog.py` doesn't reconcile; one should merge into the other.

### Rate limiting (`rate-limiting`)

**The aha**: A cap per client means no single client can use up the capacity meant for everyone; over the cap, they get 429.
**Misconception to defeat**: That a rate limit is mainly an overload shield (it caps each client, whatever the server's load; reacting to the server's own load is `load-shedding`), and that each gateway copy can count on its own.
**Cast**: Three clients on the left: A (blue), B (green), C (orange, a runaway script). A gate holding one small token bucket per client, each labelled "10/s". One shared server behind it with a load bar. Rejected dots bounce back red with "429".
**Opening frame**: A and B sending a gentle trickle, C a firehose, the server red, no gate yet.
**Story**:

1. No limit: C's stream swamps the server; A's and B's stopwatches climb to seconds. "One client eats everyone's capacity."
2. The gate drops in. A and B each spend a token per request and pass. C drains its bucket in a blink; its extra dots bounce "429 Too Many Requests". The server goes green; A and B are back to 40 ms. "Everyone gets their share."
3. C's bucket refills a token at a time; exactly 10 of C's requests a second get through.
4. The gateway scales out to three copies behind a load balancer. C's requests spread across them, each copy's C bucket sees only a third, and C gets 30 a second through. "Three gates counting alone let through three times the limit."
5. A shared counter (a small Redis box) wires into all three; their C buckets become one. C is back to 10 a second.
   **The moment**: A toggle between beats 1 and 2 under the same firehose: only C's dots bounce, while A's and B's streams flow untouched.
   **Interaction**: A slider for C's send rate; a limiter on/off toggle; a gateway-count dial with a choice of "count alone", "shared counter" (exact, one network hop per check) or "split the limit" (each copy allows 10 ÷ 3, no hop, but uneven if traffic isn't spread evenly).
   **Ending**: Three gates, one shared counter, three clients at fair rates, the server green.
   **Variants**: `token-bucket`, `leaky-bucket`, `window-rate-limiting` (the algorithms), `throttling`, `quotas`, `noisy-neighbour`; Security's `rate-limiting-abuse`; Azure API Management `rate-limit-by-key`, Amazon API Gateway usage plans.
   **Techniques**: stream, token, contents, meter, restyle, clone, spotlight, toggle, dial, choice, caption.
   **Review**: Improved — the misconception now draws the line against load shedding explicitly (a rate limit caps each client whatever the server's load), and the interaction adds the catalog's second fix for many gateways, splitting the limit across copies, with each option's cost. Checked: 429 Too Many Requests (RFC 6585) is the right code for a client over its limit; three uncoordinated copies behind an even balancer do let 3× through. Weighed a turnstile-per-ticket-holder metaphor; the per-client buckets at one gate are both the metaphor and the mechanism, and the toggle moment (only C bounces) is the clearest possible proof of fairness.

### Token bucket (`token-bucket`)

**The aha**: Two numbers make two promises: the refill rate is the sustained limit, and the bucket size is the burst allowed.
**Misconception to defeat**: That "5 a second" means never more than 5 in any second (bursts do get through), and that it smooths traffic like the leaky bucket.
**Cast**: The gate, with a bucket above it and a tap dripping tokens (small coins) into it. Two labels: "Refill: 5/s" by the tap and "Size: 10" on the rim. Requests arrive from the left; each takes a token and passes, or finds none and bounces red "429". A chart strip of requests passed per second, with a dashed line at 5.
**Opening frame**: A half-full bucket, the tap dripping, no requests yet.
**Story**:

1. Quiet: tokens drip in until the bucket holds 10; more drip over the rim and vanish. "Unused tokens save up, to a point."
2. A burst of 12 at once: 10 grab tokens and pass in one gulp; 2 bounce. The chart spikes to 10. "Size" glows. "Bucket size: the burst you allow."
3. A steady 8 a second: each new token is taken the instant it drips in; 5 pass and 3 bounce, every second. The bucket stays empty; the chart sits flat on the dashed line. "Refill" glows. "Refill rate: what you can sustain."
4. Traffic drops to 2 a second: the bucket slowly fills again, ready for the next burst.
   **The moment**: Beat 2 cutting straight into beat 3: one tall spike on the chart, then a flat line at the refill rate, each lit by its own number.
   **Interaction**: Dials for refill rate and bucket size; a "send a burst" button; a steady-rate slider. Size 1 makes it a strict pacer; a huge bucket lets a long burst through. A readout keeps the worst case honest: the most that can pass in any one second is size + refill (15).
   **Ending**: The chart showing the spike and the plateau, each labelled with the number that set it.
   **Variants**: `leaky-bucket` (smooths instead), `window-rate-limiting`, `rate-limiting`, `throttling`; Amazon API Gateway's throttling settings, "rate" and "burst", are exactly these two numbers.
   **Techniques**: contents, token, meter, chart, restyle, spotlight, dial, caption.
   **Review**: Improved — added a real product whose two settings are the two numbers (Amazon API Gateway's rate and burst), and a worst-case readout (size + refill in any one second), so the misconception is answered precisely rather than with "bursts get through". Checked the arithmetic: full bucket of 10, burst of 12 → 10 pass, 2 rejected; steady 8/s against 5/s refill → 5 pass, 3 rejected each second once the bucket is empty. Weighed an arcade-token or coin-jar metaphor; the dripping tap is the canonical picture and makes the refill rate visible, which a jar doesn't.

### Leaky bucket (`leaky-bucket`)

**The aha**: Whatever shape traffic arrives in, it leaves as a smooth, steady stream: bursts are delayed or dropped, never passed straight through.
**Misconception to defeat**: That it's the same as a token bucket, which lets bursts through.
**Cast**: A bucket that is a queue: requests drop in from the left and stack up as visible dots, and a hole in the bottom lets one out every 200 ms toward a fragile downstream ("legacy payments API, max 5/s") with a load bar. When the bucket is full (8 dots), arrivals spill over the rim and bounce red. Each waiting dot shows its wait time. Two stacked chart strips: "in" and "out".
**Opening frame**: An empty bucket, a steady 3 a second dripping straight through, the two charts matching.
**Story**:

1. A burst of 10: the dots pile into the bucket. The drip doesn't speed up and the downstream bar stays steady. Dots higher up show longer waits. "Bursts wait their turn."
2. A bigger burst: the bucket fills to the brim and the overflow bounces red. "Full bucket: the rest are dropped."
3. The charts fill in: "in" jagged, "out" a flat line at 5 a second that never rises above it, however tall the spike above. "Never faster than the leak."
4. A token bucket appears alongside, fed the same burst: ten pass at once and the fragile downstream's bar spikes red. "A token bucket passes bursts. A leaky bucket flattens them."
   **The moment**: Beat 3: the jagged input chart above the ruler-flat output chart, aligned in time, so every spike above lands on the same flat line below.
   **Interaction**: A "send a burst" button; dials for leak rate and bucket size (a bigger bucket drops less but makes requests wait longer); a toggle for the token bucket beside it.
   **Ending**: The downstream API calm at a steady 5 a second, the in and out charts beneath it.
   **Variants**: `token-bucket`, `queue-load-levelling` (the same smoothing, with workers that can scale), `backpressure`; NGINX `limit_req` with `burst` is this bucket (adding `nodelay` passes the burst at once, like a token bucket).
   **Techniques**: contents, stream, timer, chart, restyle, side by side, dial, toggle, caption.
   **Review**: Improved — the output line was described as flat at 5 a second, but when the bucket is empty it simply carries the arrivals (3 a second in the opening); it's now "never above 5", which is the actual promise. Added NGINX `limit_req` as the real-world form, whose `nodelay` switch turns it into the token-bucket behaviour of beat 4. Note for the platform: "leaky bucket" also names a counter-based meter that behaves like a token bucket; this plan uses the queue form the catalog defines. Weighed a funnel metaphor; the bucket with visible waiting dots shows the delay cost, which a funnel hides.

### Fixed and sliding window limits (`window-rate-limiting`)

**The aha**: A fixed window can let through double the limit around a boundary; a sliding window always counts the last 60 seconds, so it can't.
**Misconception to defeat**: "10 a minute means never more than 10 in any minute."
**Cast**: Two time-axis lanes, one above the other, with ticks at 0:00, 1:00, 2:00 and 3:00; requests appear as dots at the moment they arrive. Limit: 10 a minute. Top lane, "Fixed window": each clock minute is a box with a counter. Bottom lane, "Sliding window": a translucent 60-second frame glides with "now" and counts the dots inside it. Rejected dots turn red "429".
**Opening frame**: Both lanes empty, "10 / minute" labelled, "now" at 0:00.
**Story**:

1. Fixed: a few dots arrive through the first minute; the 0:00–1:00 box counts 3/10. At 1:00 the counter snaps to 0. "Counted per clock minute."
2. A client stays quiet until 1:59, then sends 10: all pass (10/10). At 2:00 the counter resets, and they send 10 more: all pass.
3. Spotlight the two seconds either side of 2:00: 20 green dots, under a limit of 10. "20 requests in 2 seconds."
4. Replay the same arrivals in the sliding lane. At 2:00 the frame still holds the ten from 1:59, so it reads 10/10 and the next ten turn red. "Always the last 60 seconds."
5. The cost: the sliding lane keeps every timestamp (a small memory meter growing), or uses the cheap blend of two counters, shown at 2:42: "30% of last minute's count + this minute's", trusting that last minute's requests were spread evenly.
   **The moment**: Beats 3 and 4 stacked on the shared axis: the same 20 dots, all green above, half red below.
   **Interaction**: Drag the burst along the timeline. Away from a boundary the lanes agree; across one, only the fixed window lets double through. A dial for the limit.
   **Ending**: Both lanes frozen at 2:01 with the difference spotlit.
   **Variants**: `token-bucket`, `leaky-bucket`, `rate-limiting`.
   **Techniques**: lanes, contents, meter, move, spotlight, side by side, restyle, dial, caption.
   **Review**: Improved — the timeline contradicted itself: beat 1 counted 3 dots in the first minute and moved past 1:00, then beat 2 sent a full 10 "at 0:59" in that same window, which would have rejected 3. The burst now straddles 2:00 after a quiet minute, so every count is right. The sliding-counter caption now says when the 30% applies (42 seconds in, 70% through the minute) and what it assumes, since the blend is an estimate, unlike the timestamp log. Weighed adding the token bucket as a third lane; it would split the one idea (the boundary) into a comparison of algorithms that `token-bucket` and `leaky-bucket` already make.

### Throttling and backing off on 429s (`throttling`)

**The aha**: Throttling is a conversation: the service says "too much, come back in 2 s", well-behaved clients wait and back off, and clients that ignore it turn throttling into a retry storm.
**Misconception to defeat**: That a 429 is an error to retry at once, or that throttling is a one-sided cap.
**Cast**: A busy service (right) with a load bar; a crowd of clients (left). Requests and replies form an exchange; a 429 reply carries a tag "Retry-After: 2s". A waiting client shows a countdown ring. A chart strip of the service's load against a capacity line.
**Opening frame**: The service amber, near its line, clients sending steadily.
**Story**:

1. Load crosses the line. The service answers some requests with a red 429 tagged "Retry-After: 2s"; a 503 card with the same tag flips up beside it. "429: you're over your share. 503: I'm full. Both say when."
2. A polite client gets a 429: a 2 s ring appears and it goes quiet, then retries and succeeds. A second 429 earns a longer ring, with a little random jitter. "Wait as told, then back off."
3. Rewind. Now every client is impatient: each 429 instantly spawns a new request. Each rejection comes straight back as more traffic; the stream thickens; the load line climbs; 429s turn into timeouts. "Ignore the signal, get a retry storm."
4. Switch everyone back to polite: retries scatter across time, the load settles just under the line, and every request gets through, a little later.
   **The moment**: Beats 2 and 3 side by side on the same 429: one client falls silent behind a countdown, the other fires straight back, and their load charts split apart below.
   **Interaction**: A choice of client behaviour ("retry at once", "honour Retry-After", "back off with jitter", "pace yourself": the client runs its own small token bucket below its limit and rarely sees a 429 at all) and a dial for the number of clients. It shows that the clients decide whether throttling works.
   **Ending**: Polite clients, the load hovering under capacity, every request eventually green.
   **Variants**: `rate-limiting`, `load-shedding`, `token-bucket` (for pacing yourself); Reliability's `retry-backoff-jitter`, `retry-storm`; Azure Resource Manager's 429s with Retry-After, Amazon S3's "503 Slow Down", AWS SDKs' built-in backoff.
   **Techniques**: exchange, token, timer, stream, meter, chart, side by side, choice, dial, caption.
   **Review**: Improved — added the 429-vs-503 distinction (over your share vs over capacity, both able to carry Retry-After, in seconds or as a date), since real services use both for throttling (Amazon S3 answers "503 Slow Down"). The interaction adds the caller-side half the catalog assigns here (Azure's Rate Limiting pattern): a client that paces itself never needs the 429. Weighed a motorway ramp-meter metaphor; the exchange with a visible countdown is the real protocol and makes the "conversation" literal.

### Quotas (`quotas`)

**The aha**: Rate limits cap speed and quotas cap amount, and a cloud quota is a hidden scaling limit, because autoscaling stops when it reaches it.
**Misconception to defeat**: "If we stay under the rate limit we're fine," and "autoscaling will add whatever we need."
**Cast**: Part 1: a client and an API gate with two instruments, a speedometer ("rate limit: 10/s") and a fuel gauge ("quota: 100,000 calls a day"), over a 24-hour clock strip. Part 2: a scale set of 8-vCPU servers inside a region boundary, with a "vCPUs 64 / 100" meter on the boundary.
**Opening frame**: The two instruments side by side: speedometer low, fuel gauge full, clock at 08:00.
**Story**:

1. The client sends 4 a second: the speedometer sits well under its line; the gauge drains slowly as the clock runs.
2. A batch job pushes it to 15 a second: the speedometer redlines and the extras bounce "429". "Rate limit: how fast."
3. It slows back to 4 a second and stays polite. At about 15:00 the gauge hits empty, and even slow requests bounce "quota exceeded: resets at midnight". "Quota: how much."
4. Part 2: the same idea on cloud resources. A traffic spike; the autoscaler adds servers: 72, 80, 88, 96 vCPUs. The next appears as a dashed outline, flickers and fails: "quota exceeded". The servers turn red and requests fail. "Autoscaling stops at the quota."
5. Rewind: weeks earlier, a quota increase to 400 (a request that can take days) moves the meter's limit, and the same spike scales out freely.
   **The moment**: Beat 4, slowed: load bars red, the autoscaler reaching for one more server, and the dashed outline failing against the spotlit quota meter, with plenty of demand still waiting.
   **Interaction**: A spike-size dial; a "raise the quota first" toggle.
   **Ending**: The scale set at 14 servers, "112 / 400 vCPUs", every bar green.
   **Variants**: `rate-limiting`, `capacity-planning`, `autoscaling`; Containers' `k8s-resource-quotas`; Azure vCPU quotas, AWS Service Quotas, Google Cloud quotas; capacity reservations (a quota is permission to use capacity, not a promise the region has it free).
   **Techniques**: meter, timer, restyle, clone, failure, boundary, spotlight, dial, toggle, caption.
   **Review**: Improved — the numbers didn't work: at 8 a second, a 10,000-a-day quota runs out in 21 minutes, not at 16:00. The quota is now 100,000 a day and the client sends 4 a second, which empties it by about 15:00. Beat 4 now bridges the two halves ("the same idea on cloud resources"), beat 5 notes that increases take time to approve, and a variant flags that quota isn't reserved capacity. Weighed a phone-plan metaphor (speed cap vs monthly data allowance); the speedometer and fuel gauge already are that contrast, and the vCPU half needs the real cloud meter.

### Load shedding (`load-shedding`)

**The aha**: Serving 90% of requests fast beats serving 100% too slowly for anyone, and a quick "no" costs almost nothing next to a timeout after the work is done.
**Misconception to defeat**: "Never turn a request away." Also confused with rate limiting: no client here is over any limit; the server sheds based on its own load.
**Cast**: Users on the left sending two kinds of request: gold "checkout" (critical) and grey "recommendations" (can wait). A server with a load bar, a queue at its door and a valve at the entrance wired to the load bar. Stopwatches on requests; the timeout is 2 s. A chart strip: "% served in time".
**Opening frame**: Normal traffic, every stopwatch under 200 ms, the valve open.
**Story**:

1. A flash sale pushes load to 130%, all from well-behaved clients. Everything is accepted; the queue grows; every stopwatch passes 2 s, checkout included. The chart drops toward zero. "Everyone accepted. No one served in time."
2. Shedding on: once the load bar crosses 90%, the valve sends grey requests straight back red "503", in 1 ms. The queue shortens; gold requests flow through in 150 ms. "Reject early, reject cheaply."
3. Zoom on two requests: the rejected one used a sliver of CPU; the timed-out one waited past 2 s, its client's patience ring long empty, and the worker still did all of its work for a seat nobody was sitting in. "A 1 ms no beats a 2 s too late."
4. The chart jumps to about three-quarters served in time (130% offered, capacity 100%), with checkout at 100%. Rejected clients see "503, Retry-After: 5" and wait.
   **The moment**: A toggle between beats 1 and 2 under the same spike: all late and grey, then a thin red stream of fast rejections beside a wide green stream served in time.
   **Interaction**: A shedding on/off toggle; a spike-size dial; a "shed by priority vs at random" toggle, which shows checkout surviving only when priority is used (the caller tags each request with its importance; the valve can't guess). A "reject after parsing" option shows shedding must be cheap: the later the no, the less it saves.
   **Ending**: The sale still running, the valve trimming grey requests, every checkout green.
   **Variants**: `overload` (the collapse this prevents), `admission-control`, `rate-limiting`; Reliability's `graceful-degradation`; Messaging's `priority-queue`.
   **Techniques**: stream, contents, timer, meter, chart, restyle, zoom, side by side, toggle, dial, caption.
   **Review**: Improved — borrowed Reliability's ghost image (a patience ring drained, the worker still labouring for an empty seat) into beat 3, which makes "timeout after the work is done" literal, and its point that the valve needs the caller's priority label. Rejections now carry Retry-After so shed clients don't return at once (503 is right for server-side overload; 429 would say this client exceeded its own share), the three-quarters figure is tied to 130% offered load, and an option shows the cost of shedding late. Weighed Reliability's priority-threshold dial; the random-vs-priority toggle teaches the same point more directly. Flag: Reliability's `overload-and-goodput` duplicates `overload` and should merge into it.

### Backpressure (`backpressure`)

**The aha**: When a consumer is slower than its producer, the gap piles up somewhere; backpressure sends the slowdown back to the source, where it can be handled, instead of letting it pile up until something crashes.
**Misconception to defeat**: "A bigger buffer fixes it," and confusing it with load shedding, which drops work, where backpressure slows the sender.
**Cast**: A three-stage pipeline, left to right: producer (gauge "100/s"), transformer, consumer (gauge "60/s"). Between stages, buffers drawn as boxes holding visible items. A memory meter on the machine holding them.
**Opening frame**: The pipeline flowing, buffers nearly empty, the 100 vs 60 mismatch labelled.
**Story**:

1. Unbounded buffers: the one before the consumer grows by 40 items a second, stretching longer and longer. Memory goes amber, then red, then the process dies and everything buffered scatters. "The gap piles up somewhere."
2. Replay with a buffer twice the size: the same crash, later. "A bigger buffer only delays it."
3. Bounded buffers of 10: the consumer's buffer fills and shows "full". A pulse travels right to left, the first backwards motion on screen: the transformer pauses, its own buffer fills, and the pulse reaches the producer, whose gauge drops to 60. "A full buffer pushes back."
4. Steady state: every stage at 60 a second, buffers partly full, memory flat. At the source the slowdown is now visible and handled: the producer reads less, or answers its callers with 429. "The slowdown reaches the source."
   **The moment**: Beat 3, slowed: the pulse crossing the pipeline backwards, stage by stage, until the producer's needle drops, straight after the crash in beat 1.
   **Interaction**: A consumer-speed dial; a bounded/unbounded toggle; a "credits" mode in which the consumer sends tokens back ("send me 10 more") and the producer only sends what it's been granted.
   **Ending**: A calm pipeline at 60 a second, buffers half full, memory flat.
   **Variants**: `load-shedding`, `queue-load-levelling`, `admission-control`; Messaging's `consumer-prefetch`, `consumer-lag`.
   **Techniques**: contents, stream, meter, failure, token, path trace, side by side, toggle, dial, caption.
   **Review**: Merged — owned by Messaging (`plans/messaging.part2.md`). Messaging's plan already has the backward pulse, bounded tubes and the bigger-buffer dial. It should borrow from this one: a gauge on the producer that visibly drops from 100/s to the consumer's rate when the pulse arrives (the slowdown "reaches the source" and becomes someone's decision); a replay with a doubled buffer, the same crash a little later, before the bounded version; and one inset contrasting load shedding (work dropped, red) with backpressure (sender slowed, amber), since the two are the pair people confuse.

### Queue-based load levelling (`queue-load-levelling`)

**The aha**: With a queue in between, workers can be sized for the average instead of the peak, because the spike waits as a backlog. It works when callers can wait for the result.
**Misconception to defeat**: "To survive the peak, run enough servers for the peak," or that the queue makes the work itself faster.
**Cast**: Users on the left submitting jobs ("generate invoice"). A queue in the middle: a horizontal tube with visible messages and a depth meter. Workers on the right in a scale-set frame, each with a load bar. Two stacked chart strips: "arrivals" and "processed". Each message carries a stopwatch.
**Opening frame**: Two lanes at a calm trickle, the same two workers in each. Top: users straight into the workers. Bottom: users into a queue tube, then the same workers. Under each, arrivals (thin line) and processed (thick line) charts, flat.
**Story**:

1. The same spike, ten times the traffic, hits both lanes. Top: the workers' bars go red, "503" bounces fly back, one worker crashes. "Direct: the spike hits the workers."
2. Bottom: each job drops into the tube and its user gets an instant "202 accepted". The workers pull at their own pace and stay steadily amber, never red. "Queued: the spike becomes a backlog."
3. The spike ends. The tube drains while the thick line stays flat long after the thin line has fallen, and the area under the thin line (arrivals) and the area under the thick line (processed) shade the same colour. "Same work, spread out."
4. A ghost of the top lane returns with ten workers: it survives the spike, but sits idle all day under a running cost meter. "Or pay for the peak, all day."
5. Backlog per worker crosses a threshold; two more workers appear and the drain speeds up; once the tube is empty they leave.
6. Spotlight the last job's stopwatch: "waited 4 minutes". "Fine for an invoice. Not for a login."
   **The moment**: Beat 3, slowed: the depth meter rises and falls between a spiky line in and a flat line out, the two shaded areas equal. "Peak in, average out."
   **Interaction**: A "send a burst" button; spike height and length dials; a worker-count dial (fewer workers mean longer waits, never failures). Push the average arrivals above the workers' rate and the backlog never drains: levelling buys time, and then you need more workers (autoscaling toggle).
   **Ending**: An empty tube, two workers, and the charts showing the spike above and the flat line below.
   **Variants**: `backpressure`, `leaky-bucket`, `autoscaling`, `scaling-metrics` (backlog per worker); Messaging's `queue-based-load-leveling` (same concept, kept here), `competing-consumers`, `async-request-reply`; Containers' `k8s-keda`.
   **Techniques**: contents, stream, chart, meter, timer, exchange, appear / disappear, side by side, spotlight, dial, toggle, caption.
   **Review**: Improved — adopted Messaging's side-by-side opening (the same spike hitting a direct lane and a queued lane at once), a sharper contrast than the old sequential crash, and its equal-area shading, which proves the work is the same and only its shape changed. Kept this plan's own contribution, the ghost lane of ten idle workers (the cost of sizing for the peak), the backlog-per-worker scaling beat and the 202-then-wait wording. The interaction now states the limit Messaging also stresses: if average arrivals exceed the workers' rate, the backlog grows forever. Kept as the surviving id; Messaging's `queue-based-load-leveling` should merge into it (or vice versa) in `tools/catalog.py`.

### Admission control and concurrency limits (`admission-control`)

**The aha**: Limit the work in progress, not the arrivals: a cap on in-flight requests keeps latency steady whatever each request costs, and turning the overflow away protects everything already admitted.
**Misconception to defeat**: "Requests per second is capacity." Requests differ in cost, so a rate limit can read "fine" while the server drowns.
**Cast**: Two servers side by side. A has a rate limiter at its door ("100 req/s"). B has eight seats inside and a door counter ("in flight 6/8"). Requests are dots sized by cost: small "search", big "export report". A request holds a seat until it's done. Stopwatches on requests; a latency chart strip under each server.
**Opening frame**: Both servers handling 100 small requests a second, latency flat, A's limiter reading "100/100: OK".
**Story**:

1. The mix changes: still 100 a second, but half are exports, each about 19 times a search, so the average request costs ten times as much. A's limiter still reads OK; inside, the big dots pile up, latency climbs, the bar goes red. "Same rate, ten times the work."
2. On B, exports take seats and hold them longer. When all eight are full, the next arrival bounces "503, Retry-After" at the door (the server is full, not this caller over a limit), so fewer requests a second get in, automatically. Latency stays flat. "Cap the work in progress."
3. The charts: A's climbing, B's flat beside a thin stream of rejections.
4. Adaptive: the database slows and B's latency starts to creep, so the door cuts the seats sharply (8 → 6) and latency recovers. When things are fast again, seats come back one at a time: grow slowly, shrink fast, the way TCP congestion control does. "Adaptive limits find the cap from latency."
   **The moment**: Beat 3 frozen with both gauges spotlit: A's rate limiter reading "OK" beside its exploding latency chart; B's full seats beside its flat line.
   **Interaction**: A cost-mix slider (all cheap → all heavy); a seat-count dial; an adaptive toggle; a "slow the database" button.
   **Ending**: B under the heavy mix, every seat full, steady latency, a trickle of quick rejections.
   **Variants**: `littles-law` (in flight = rate × time), `load-shedding`, `rate-limiting`, `scaling-metrics`.
   **Techniques**: contents, meter, timer, chart, side by side, restyle, spotlight, dial, toggle, caption.
   **Review**: Improved — the "same rate, ten times the work" now has a number behind it (half the requests at 19 times the cost), the rejection is a 503 with Retry-After rather than a 429 (the server is full; nobody exceeded a limit), and the adaptive beat names its rule: cut the limit fast on rising latency, raise it slowly (as TCP does; Netflix's concurrency-limits library works this way). Checked Little's Law: seats in use equal arrival rate times time in system, so a fixed seat count turns any slowdown into fewer admissions. Weighed an airport-security-queue metaphor; the two servers side by side keep the contrast with rate limiting that the catalog wants.

### Noisy neighbour (`noisy-neighbour`)

**The aha**: Shared capacity needs limits per tenant, so that one customer's spike stays their own problem.
**Misconception to defeat**: That it's ordinary overload, fixed by adding capacity. Two of the three tenants changed nothing and still suffered.
**Cast**: Three tenants on the left as coloured crowds: A (blue), B (green), C (orange). One shared resource, a database pool, with a load bar stacked by tenant colour. A stopwatch label beside each tenant.
**Opening frame**: Three moderate streams; the stacked bar at 50%, a third of each colour; every stopwatch 50 ms.
**Story**:

1. C starts a bulk import. Its stream thickens and orange floods the bar to 100%.
2. A's and B's stopwatches climb to 2 s and their dots crawl. Spotlight A and B. "A and B changed nothing."
3. Double the resource: C's import, which takes whatever it's given, fills that too. "More capacity, same problem."
4. Per-tenant limits: dividers appear in the bar, capping each tenant at 40%. C's excess waits or bounces "429" at C's own gate. A and B drop back to 50 ms. "C's spike stays C's problem." (The caps add up to 120%: they can oversubscribe, because tenants rarely peak together.)
5. The biggest tenant can also get its own pool: C's stream re-routes to a separate box.
   **The moment**: A toggle between beats 2 and 4: with limits off, three colours suffer; with them on, only orange waits, and A's stopwatch drops from 2 s to 50 ms.
   **Interaction**: A "make C spike" button; a per-tenant-limits toggle; a choice of isolation (rate limit, quota, separate pool) showing how each one contains C: a rate limit stops the burst as it happens, a quota caps the total, a pool removes the sharing (and costs idle capacity). A "fair share" option lets C use idle capacity but yields the moment A or B need it.
   **Ending**: Blue and green calm at 50 ms; orange busy behind its own gate.
   **Variants**: `rate-limiting`, `quotas`; Reliability's `shuffle-sharding`, `blast-radius`; Architecture's `tenancy-models`.
   **Techniques**: stream, meter, timer, spotlight, boundary, restyle, toggle, choice, caption.
   **Review**: Improved — the per-tenant caps summed to 120% without comment, so the beat now says they can oversubscribe because tenants rarely peak together, and the choice-of-isolation interaction says what each tool contains and costs (rate limit for bursts, quota for totals, separate pool for full removal at the price of idle capacity). Added a fair-share option, which is how most real systems avoid hard caps wasting idle capacity. Checked: the arithmetic holds (a third each at 50% is about 17% apiece; C capped at 40% leaves the bar near 74%). Weighed a flatmate-hogging-the-bathroom metaphor; stacked colours on one bar show who took what, which a metaphor can't.

## Capacity planning, testing and cost

### Capacity planning (`capacity-planning`)

**The aha**: Autoscaling handles minutes; capacity planning handles months, getting quotas, reserved capacity, database size and anything that can't autoscale ready before the demand arrives.
**Misconception to defeat**: "Autoscaling will cover whatever comes." Some things don't scale on their own in time, or at all.
**Cast**: A year-long timeline across the top, with a demand chart beneath it: a rising trend, seasonal bumps, and a flag marked "launch day" far ahead. A checklist panel: quota, database size, reserved capacity. A scratch sheet for back-of-envelope maths.
**Opening frame**: The year's demand chart, the flag on launch day, the checklist all unticked.
**Story**:

1. Zoom into one ordinary day: autoscaling tracks the daily wave fine, minute by minute. "Autoscaling: minutes."
2. Zoom back out to launch day arriving: traffic jumps tenfold, the autoscaler reaches for more servers and hits the old quota of 12 instances; requests fail. "Quota from last quarter. Demand from this one."
3. Rewind to months earlier: the scratch sheet works it out — "10,000 req/s at peak ÷ 500 req/s per instance (from a load test) = 20, plus 30% headroom = 26 instances" — and the checklist starts ticking: quota raised, database resized, capacity reserved.
4. Launch day replayed: the same tenfold jump, now autoscaling smoothly within the raised quota.
   **The moment**: The same launch-day jump, twice: failing against an unraised quota, then sailing through once the checklist is ticked weeks ahead of time.
   **Interaction**: A lead-time dial — how many weeks ahead planning starts — showing whether the checklist finishes before the flag.
   **Ending**: Launch day green, the checklist fully ticked, the quota line raised above the jump.
   **Variants**: `capacity-headroom`, `quotas`, `load-test`, `scheduled-scaling`.
   **Techniques**: chart, timer, meter, zoom, side by side, failure, dial, caption.
   **Review**: Improved — the back-of-envelope sum was wrong in practice (50,000 users each sending 2 requests a second is 100,000 req/s, not a typical day); it now runs from a peak request rate and a per-instance rate taken from a load test, adds headroom, and the failing run names the old quota (12 instances) so the gap to 26 is visible. Kept the central contrast, the same launch day failing then sailing through. Weighed a pre-ordering-for-a-wedding metaphor; the replayed launch day is the same lesson with the real artefacts (quota, database, reservations) on screen.

### Headroom (`capacity-headroom`)

**The aha**: Running at 100% leaves nothing for the unexpected; headroom is spare capacity sized so that losing a whole zone doesn't take the rest down with it.
**Misconception to defeat**: "Headroom is just waste," and "N+1 means one spare machine" rather than one zone's worth of spare capacity.
**Cast**: Three zone boxes, A, B, C, each holding several servers with load bars, inside a region boundary.
**Opening frame**: All three zones at 90%, bars amber-red, almost no gap above any of them.
**Story**:

1. Zone C fails: a red X over it, its traffic reroutes to A and B. Their bars, at 90%, would need 135%; they hit the top and requests start bouncing. "Nowhere for the load to go."
2. Rewind: each zone now runs at 60% of its servers' capacity, bars green with visible headroom above them.
3. Zone C fails again: its traffic reroutes the same way, and A's and B's bars climb to 90% — busy, but green, and still with a sliver to spare. The headroom gap is spotlit shrinking as the bars rise. "Three zones at 60% = two zones at 90%."
   **The moment**: The same failure, twice: cascading overload with no headroom, calm absorption with it, side by side under the identical red X.
   **Interaction**: A headroom dial (0–50%) and a "fail a zone" button, showing the smallest headroom that survives; a zone-count dial shows the price falling as zones rise (2 zones need 50% each to survive a loss, 3 need 67%, 6 about 83%, so more zones means less idle spare). The 67% is the bare minimum with zero slack, which is why the plan runs at 60%.
   **Ending**: Two zones at 90%, green, carrying what used to be three zones' load.
   **Variants**: `overload`, `autoscaling-lag`, `capacity-planning`; Reliability's `failover`, `blast-radius`.
   **Techniques**: meter, boundary, failure, side by side, spotlight, dial, caption.
   **Review**: Improved — the old "survive" ending had the two remaining zones at exactly 100%, which is the failure the plan warns against (no room for the next surprise, and autoscaling lags). Now zones run at 60% and absorb the loss at 90%, with the opening at 90% so the failure case really fails (90% × 3 ÷ 2 = 135%). The zone-count dial adds the economics: survivable utilisation is (N−1)/N, so more zones need less idle spare. Weighed a spare-tyre metaphor; the same failure under the same red X, with and without headroom, is the contrast and needs no metaphor.

### Load testing (`load-test`)

**The aha**: Load testing answers "do we meet our targets at the load we expect?" and sets a baseline so a later slowdown gets caught before users feel it.
**Misconception to defeat**: "A few manual clicks tell us we're ready."
**Cast**: A production-like server and database on the right; a load generator on the left firing a steady stream up to "expected peak: 1,000 req/s". A results panel: p50/p95/p99 latency, error rate, throughput, each a meter, with an SLA line on the p99 meter at "300 ms". A chart strip holding today's run in colour beside last month's as a grey ghost line.
**Opening frame**: The generator idle, the server calm, the SLA line drawn, no run yet.
**Story**:

1. Ramp to 1,000 req/s, hold it for several minutes (so caches and connections warm and a short blip can't pass for a result): meters settle green, the p99 chart sits flat under the SLA line, errors at 0. "Meets the target."
2. The grey ghost line from last month's run appears beneath today's, matching almost exactly.
3. Next release, run automatically by the pipeline with the same test and the same traffic mix: the p99 chart now pokes above the SLA line partway through, flagged red, against last month's ghost sitting comfortably under it. "Caught before anyone saw it."
   **The moment**: Today's red poke sitting directly above last month's flat grey line, at the same load, same test.
   **Interaction**: A release toggle to compare runs against the baseline; a dial to set the target load.
   **Ending**: A dashboard: this run flagged, the regression pinned to the exact load it appears at.
   **Variants**: `stress-test`, `spike-test`, `soak-test`, `latency-percentiles`.
   **Techniques**: stream, meter, chart, side by side, spotlight, toggle, dial, caption.
   **Review**: Improved — the ramp now holds at the target (a ramp alone only samples the target for a moment, and warm-up skews early numbers), and the regression run is triggered by the release pipeline with the same traffic mix, which is what makes the comparison against last month's ghost line fair. Checked: judging by p99 against an SLA line, with the error rate beside it, is the right pass criterion; averages hide the tail. Weighed leading with the manual-clicking failure; the baseline ghost is the more distinctive idea, and the misconception line already names the clicking.

### Stress testing (`stress-test`)

**The aha**: Keep increasing load past the expected peak until it breaks, to learn the breaking point and, more importantly, how it breaks.
**Misconception to defeat**: "Load testing already told us our limit" — load testing only proves the expected peak holds, not what happens beyond it.
**Cast**: Two servers, A and B, each with a load bar and a queue; a load dial that climbs past "expected peak" with no ceiling. Two chart strips: goodput (answers delivered in time) vs offered load, and latency vs offered load.
**Opening frame**: Both servers healthy at expected peak, dial sitting on the peak mark, charts flat so far.
**Story**:

1. Push past the peak: throughput keeps climbing for a while on both, latency creeping up.
2. Push further: the throughput curve bends over and flattens — the bottleneck found — while latency climbs steeply.
3. Push further still: A sheds load at the door, bouncing the excess red, and its throughput holds at the flattened line. B has no shedding; it queues everything, latency explodes off the chart, and the queue fills with requests whose clients have already given up, so the server stays broken even after the dial is pulled back down.
   **The moment**: The dial dropped back to normal on both: A's goodput snaps straight back to the flat line; B's stays near zero while it works through the backlog of abandoned requests (and their retries), recovering slowly or only on restart.
   **Interaction**: A load-ramp dial with no ceiling; a toggle for shedding on A.
   **Ending**: The breaking point labelled on the chart, "3× expected peak," with each system's way of breaking captured beside it.
   **Variants**: `load-test`, `spike-test`, `overload`, `load-shedding`.
   **Techniques**: meter, chart, contents, failure, side by side, choice, dial, caption.
   **Review**: Improved — "B stays pinned at zero, needing a restart" overstated it; the cause is now shown (a queue of abandoned requests, plus retries, keeping a server busy and useless after the load falls) and the recovery is slow rather than impossible. The throughput chart is now goodput, since plain throughput stays at maximum while B collapses (see `overload`). Kept the two-way contrast and the unlabelled-until-it-breaks dial; stress testing's real output is the breaking point and the way it breaks, plus whether it recovers. Weighed a bridge-load-test metaphor; the side-by-side servers are the actual claim.

### Soak (endurance) testing (`soak-test`)

**The aha**: Some failures only build up over time — memory leaks, exhausted pools, filling disks — and a short test never sees them, because nothing is wrong yet when it ends.
**Misconception to defeat**: "It passed a 10-minute load test, so it's fine."
**Cast**: One server under a steady, unchanging load (bar flat green throughout) with three slow-building meters: memory, connection pool in use, disk. A long clock fast-forwarding through hours and days, with a chart strip per meter running the whole length.
**Opening frame**: Hour 0: load bar flat green, all three meters low, the clock at zero.
**Story**:

1. Hours pass, load never changes. The memory chart is a sawtooth (garbage collection clears it) whose floor creeps up: 20%, 25%, 35%. Zoom in on one connection from the pool that was never returned, sitting stuck.
2. Hour 18: memory at 70%, the pool nearly full of stuck connections, disk filling with logs nobody rotates, the load bar still perfectly flat.
3. Hour 30: memory maxes out and the server stalls, though the offered load is identical to hour 0. "Nothing changed. It still fell over."
4. Rewind with the leak patched, pool cleanup and log rotation added: the same 30 hours, all three charts flat beside the unchanged load bar.
   **The moment**: The load bar dead flat for the entire run while the three meters beneath it climb steadily to failure — proof it was never about load.
   **Interaction**: A clock speed-up dial; a toggle between the leaking build and the fixed one; a "restart nightly" switch, which resets the climb and hides the leak instead of curing it.
   **Ending**: Three flat charts under a flat load bar, stretched across the full multi-day clock.
   **Variants**: `load-test`, `connection-pooling`, `cache-stampede`.
   **Techniques**: meter, chart, timer, zoom, contents, side by side, toggle, caption.
   **Review**: Improved — the tell is now drawn: healthy memory is a sawtooth that returns to the same floor, while a leak's floor rises each cycle, so a viewer learns what to look for on a real chart. Added the nightly-restart switch, the usual way leaks get hidden. Checked: 20% to 70% over 18 hours is about 2.8% an hour, reaching 100% near hour 30, so the story's timings agree; real soaks run 8 to 72 hours at normal-to-peak load. Weighed a dripping-tap-fills-the-bath metaphor; the flat load bar beside climbing meters is the sharper proof that it was never load.

### Spike testing (`spike-test`)

**The aha**: A spike test jumps the load suddenly instead of ramping it, to see what averages hide: how fast autoscaling reacts, whether queues and shedding hold, and how long recovery takes.
**Misconception to defeat**: Confused with stress testing — a gradual ramp finds the ceiling; a sudden jump tests the reaction time to get there.
**Cast**: A server fleet with an autoscaler, a queue and a shedding valve, as in earlier concepts. A load chart with two shapes available: a gradual ramp and a near-vertical jump, both reaching the same 5× final load.
**Opening frame**: Steady baseline load, flat chart, both load shapes ready to fire.
**Story**:

1. Fire the vertical jump: the chart leaps to 5× in seconds; existing servers' bars spike red at once; the queue floods; the shedding valve starts catching overflow immediately.
2. The autoscaler reacts on a countdown, "90s to new capacity," while the queue backlog keeps building underneath it.
3. New capacity arrives: bars drop to amber, the queue drains, the chart's "time to recover" span is marked from the jump to the last backlog message clearing.
4. The spike ends as abruptly as it came; the extra servers sit for their cooldown before scaling in. Replay with the gradual ramp to the same 5×: the autoscaler keeps pace step by step, the queue barely grows, no backlog triangle.
   **The moment**: The two load charts side by side, identical final height: one with a visible backlog triangle under a sudden cliff, the other flat beneath a slope.
   **Interaction**: A dial for jump steepness (gradual to instant); an autoscaling-lag dial; a warm-pool toggle (spare ready servers) showing how it shrinks the backlog triangle.
   **Ending**: The vertical-jump chart with "time to recover" measured and labelled against a pass line (say, errors under 1% and recovered in 5 minutes).
   **Variants**: `stress-test`, `autoscaling-lag`, `load-shedding`, `queue-load-levelling`.
   **Techniques**: chart, meter, contents, timer, side by side, dial, caption.
   **Review**: Improved — a spike test needs a pass criterion, so the ending now draws one against the measured recovery time; the spike now ends abruptly too (it tests scale-in and the cooldown, not only the rise). The interaction adds a warm-pool toggle, the practical fix for a 90-second lag. Checked the contrast with stress testing (stress ramps to find the ceiling and the way it breaks; spike jumps a fixed amount to time the reaction). Weighed a flash-flood-vs-rising-river metaphor; the two charts of identical final height already say it.

### Right-sizing (`right-sizing`)

**The aha**: Most fleets are sized by guesswork and left oversized; measure, then resize, and pick the instance family the workload actually needs, not just a smaller version of the same one.
**Misconception to defeat**: "Bigger is safer," and "autoscaling makes this unnecessary" — autoscaling changes how many; right-sizing changes how big.
**Cast**: A scale set of large server boxes, each with a CPU meter and a memory meter inside, and a cost meter below the whole fleet. A family picker: general purpose, compute-optimised, memory-optimised.
**Opening frame**: Eight large boxes, CPU meters at 15%, memory meters at 10%, cost meter high.
**Story**:

1. Spotlight one box's usage over a week as a chart strip: even the busiest hour (the p95) never crosses 25% CPU. "Sized for a peak that never came."
2. Resize to a quarter the size (a quarter of the cores, memory and price): CPU meters rise to a comfortable 60%, memory to 40%, cost meter drops to a quarter. "Measure the peak, then leave room."
3. A different workload, video transcoding, on general-purpose boxes: CPU meter pegged at 95%, memory barely touched. "The size isn't the problem. The type is."
4. Switch the family to compute-optimised at the same price: CPU meter drops to 60% doing the same work, more cores for the same dollar.
   **The moment**: The cost meter falling sharply at the exact instant the CPU and memory meters rise from idle to comfortably busy — shrinking the fleet is the win, not growing it.
   **Interaction**: A size dial and a family picker, with CPU, memory and cost meters responding live.
   **Ending**: A right-sized fleet, every meter comfortably busy, cost at its lowest point for the same throughput.
   **Variants**: `autoscaling`, `scaling-metrics`, `capacity-planning`; Fundamentals' `instance-families`.
   **Techniques**: meter, chart, spotlight, restyle, zoom, dial, choice, caption.
   **Review**: Improved — the shrink arithmetic was inconsistent (a quarter-size box has a quarter of the memory too, so 20% memory would have become 80%, not "still spare"); memory now starts at 10% and lands at 40% beside CPU at 60%. Sizing is by the busy hour (p95 over a week or more), not the average, and aims for around 60% to leave room. The family-mismatch half (a CPU-bound job on general-purpose boxes) is the plan's sharpest idea and stays. Real tools worth naming in the platform: Azure Advisor, AWS Compute Optimizer, Google's rightsizing recommendations. Weighed a suit-tailoring metaphor; the shrinking cost meter is the payoff and the meters respond live.
