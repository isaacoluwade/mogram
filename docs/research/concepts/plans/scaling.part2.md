# Scaling plans, part 2

Groups 5–7 of `catalog/scaling.md`, in catalog order, in the shared visual language set out in
part 1 (users on the left, a cache as a small box of key cards beside the app, a database cylinder
with a load bar, stopwatches on requests, a chart strip along the bottom), with part 1's **replay**
and **ghost**. Cached entries are cards whose **TTL ring** drains as they age. Two techniques are
added here: **slow motion** (the decisive beat replayed at a fraction of speed, with a "0.25×"
badge) and **map** (a world map on which requests travel arcs, so distance is visibly latency).

## Caching: strategies, freshness and failure modes

### Cache-aside (lazy loading) (`cache-aside`)

**The aha**: The application runs the cache itself. It checks the cache, and on a miss it reads the database and puts the answer in. The cache sits beside the path, not in it.

**Misconception to defeat**: That the cache fills itself, or that it sits between app and database, so losing it would break reads.

**Cast**: The user crowd on the left; one app server in the middle; the database cylinder on the right, level with the app; the cache box above the app, joined to it by its own short arrow and holding empty key slots. Each request carries a stopwatch.

**Opening frame**: The app with two arrows out: up to the cache ("1. check") and across to the database ("2. only on a miss"). The cache is empty.

**Story**:

1. A request for `user:42` reaches the app, which asks the cache. A grey ✗ comes back. "Check the cache first."
2. The app reads the database itself. Stopwatch: 40 ms. "Miss: the app reads the database…"
3. The app drops a `user:42` card into the cache, its TTL ring full. "…and stores the answer itself."
4. Three more requests for `user:42` go up to the cache and back in 2 ms each. The database arrow stays dark. "Hits never touch the database."
5. A write renames Ana. The app updates the database, then crosses out `user:42` in the cache. "On a write, the app deletes the old copy."
6. The cache fails and greys out. Requests go straight to the database at 40 ms, and its load bar turns amber. "Cache down: slower, not broken."

**The moment**: Beat 6. With the cache crossed out, the app still answers every request; only the stopwatches get bigger. That's what "aside" means.

**Interaction**: Send requests for repeated or new keys and see that only requested keys appear. A "Kill cache" toggle. A "Write" button that shows the delete.

**Ending**: The cache comes back empty and refills one requested key at a time; keys nobody asks for never appear. "Only what's read gets cached."

**Variants**: `read-through` (the cache does the loading), `write-through`, `cache-invalidation`, `cold-cache`, `caching`.

**Techniques**: token, contents, timer, meter, restyle, failure, toggle, caption.

**Review**: Keep — the "cache down: slower, not broken" moment is exactly what "aside" means and the contrast read-through needs; costs (first-read miss, delete on write) are both shown.

### Read-through cache (`read-through`)

**The aha**: Read-through fills lazily, exactly like cache-aside. Only the job of loading moves: the cache fetches from the database itself, so the app makes one call.

**Misconception to defeat**: That read-through and cache-aside cache different things or differ in speed. Hits and misses behave the same in both; what differs is where the loading code lives.

**Cast**: Two identical panels side by side, each with users, an app, a cache and a database. Each app shows a small code card. Left, "Cache-aside": four lines, `get cache / if miss: query db / set cache / return`. Right, "Read-through": one line, `cache.get(id)`. The right-hand cache has a small loader gear inside it.

**Opening frame**: Both panels. On the left, the app has arrows to the cache and to the database. On the right, app → cache → database form a single line. "Same job, different owner."

**Story**:

1. The same miss enters both panels at once. Left: app → cache → back to the app → database → app → cache. Right: app → cache → database → cache → app. "Cache-aside: the app fetches. Read-through: the cache fetches."
2. Spotlight the code cards. The three loading lines lift out of the left app's card and slide into the right cache's gear. "The loading logic moves into the cache."
3. Two more services join each panel. On the left, each copies the loading code, and one copy writes the key as `User:42`, so a duplicate card appears in the cache. On the right, all three call `cache.get` through the one loader. "Every caller loads the same way."
4. A repeat request hits in both panels, by the same path, in the same 2 ms. "Hits look exactly the same."
5. Both caches fail. Left, the app falls back to its own database arrow at 40 ms. Right, the app's only road ran through the cache, and its requests stop with a red ✗. "The price: the cache is now in the path."

**The moment**: Beat 2. The loading code physically leaves the app and enters the cache, and the app's arrow to the database disappears.

**Interaction**: A toggle on one diagram swings the database arrow from the app to the cache and back; hits and misses don't change, only who does the loading. A "Kill cache" button shows what that arrow was worth.

**Ending**: The right-hand panel alone: an app with one arrow, and a cache with its loader and a line to the database. "One call for the app. One loader for everyone."

**Variants**: `cache-aside`, `write-through` (often paired with it, as in DynamoDB Accelerator), `request-coalescing` (a read-through layer is the natural place to coalesce).

**Techniques**: side by side, token, path trace, move, contents, spotlight, toggle, failure, caption.

**Review**: Improved — added the cost of moving the loader (the cache now sits in the read path, so an outage fails reads instead of slowing them), which completes the contrast with cache-aside's moment; a real example (DAX).

### Write-through cache (`write-through`)

**The aha**: A write is acknowledged only once both the cache and the database have it. Anything written through the cache is never stale there, but every write pays for both, and the cache fills with data nobody may read.

**Misconception to defeat**: That writing through the cache makes writes faster (it makes them slower), and mixing this up with write-behind.

**Cast**: A user; the app; a cache of key cards, each with a small "reads" counter; the database. The write is a token carrying a running stopwatch. The acknowledgement is a ✓ token that returns to the user.

**Opening frame**: The cache and the database both show `price:sku1 = $10`, with a small "in sync" link between them.

**Story**:

1. The user sends `price:sku1 = $12`. It lands in the cache and the card flashes to $12. "Write to the cache…"
2. The same token carries on to the database, whose row flips to $12, while the stopwatch keeps running. "…and to the database."
3. Only now does ✓ travel back. Until it arrived, the user's dot was pulsing "waiting". Stopwatch: 32 ms (2 + 30). "Acknowledged when both have it."
4. A read for `price:sku1` hits: $12. "Reads never see an old price."
5. A burst of writes to `audit:*` and `draft:*` keys lands in the cache. Their cards sit there with "reads: 0" and slowly grey, and one of them pushes a hot key out. "Everything written gets cached, read or not."

**The moment**: Beat 3, in slow motion. The user is visibly held until the database confirms, and the stopwatch adds both legs together.

**Interaction**: "Kill the cache" after any write: nothing is lost, because the database has every acknowledged write. A "Write straight to the database" button (another service, a migration) bypasses the cache and leaves a stale card: the guarantee only covers writes that go through. A toggle to write-behind shows ✓ coming back after the cache alone, as a preview of the trade.

**Ending**: Cache and database agree, ✓ is home, and grey unread cards line the cache, their TTL rings draining them away. "Always fresh. Slower writes."

**Variants**: `write-behind`, `cache-aside`, `read-through` (the usual partner for reads), `cache-invalidation`, `cache-ttl` (clears the unread cards).

**Techniques**: token, exchange, contents, restyle, timer, failure, toggle, slow motion, caption.

**Review**: Improved — narrowed "never stale" to writes that go through the cache and added a bypass button that shows the limit; the TTL now clears unread cards, the usual fix for write-through's cache pollution.

### Write-behind (write-back) cache (`write-behind`)

**The aha**: The cache acknowledges a write at once and saves it to the database later, in batches. Writes are very fast and the database sees fewer of them, but anything still unsaved dies with the cache.

**Misconception to defeat**: That "acknowledged" means "saved". Here it only means "in memory".

**Cast**: The user crowd; the app; a cache with a "not yet saved" tray, where unsaved cards have amber outlines; a flush timer ring on the tray ("every 5 s"); the database with a "writes received" counter. Each ✓ stays pinned beside the user dot that got it.

**Opening frame**: The cache holds a few normal cards and an empty tray. The database counter reads 0 and the flush timer is full.

**Story**:

1. A write lands in the cache. The card turns amber, and ✓ is back in 2 ms. "Acknowledged as soon as the cache has it."
2. Five more writes arrive: six amber cards stack in the tray, each with its ✓, and the database does nothing. "Writes pile up in memory."
3. The flush timer empties. All six cards move to the database as one batch token and turn normal. The database counter goes up by 1, not 6. "Saved later, in one batch."
4. Three more amber cards collect. Then the cache cracks and goes dark, and the three amber cards fade and fall away, while their users still show ✓. "The cache died. Three acknowledged writes are gone."
5. Spotlight the database: three rows missing, outlined in red. "Durability traded for speed."

**The moment**: Beat 4, in slow motion: green ✓ ticks still beside the users while the writes they confirm evaporate.

**Interaction**: A flush-interval dial (1–60 s). A longer interval means fewer database writes and a bigger amber pile at risk. A "Crash now" button works at any time. Together they teach that the loss window is the flush interval.

**Ending**: Frozen on the dark cache, with a tally: "acknowledged 9 · saved 6".

**Variants**: `write-through` (the contrast), `batching`, `queue-load-levelling` (a durable queue absorbs writes without this risk).

**Techniques**: token, contents, restyle, timer, meter, failure, spotlight, dial, slow motion, caption.

**Review**: Keep — the ✓ ticks surviving the writes they confirm is the right, unforgettable failure, and the flush-interval dial teaches that the loss window is the flush interval; numbers and tally (9 acknowledged, 6 saved) check out.

### Time to live (TTL) (`cache-ttl`)

**The aha**: TTL is a dial between freshness and load. Short means fresh data and a busy database; long means a calm database and older data. Either way, nothing is ever staler than one TTL.

**Misconception to defeat**: That an entry disappears when its data changes. TTL runs on a clock and knows nothing about changes.

**Cast**: The user crowd sending a steady stream; the app; a cache shelf of a few hundred product-price cards, each with a TTL ring, and one of them, `price:sku1`, enlarged in front; the database showing the true prices. A chart strip along the bottom has two lines: "database load" and "age of data served".

**Opening frame**: The front card `price:sku1 = $10` with a full 60 s ring, the database also at $10, and requests bouncing off the cache.

**Story**:

1. Requests hit while the ring drains steadily. "Every entry has a clock."
2. The database flashes to $12. Answers keep leaving the cache tagged $10, now outlined amber. "The source changed. The cache doesn't know."
3. The ring empties and the card fades. The next request misses, fetches $12, and the ring refills. "Expired: the next request fetches fresh."
4. On the chart, the amber stretch is bracketed. It's never wider than the TTL. "Stale for at most one TTL."
5. The dial turns to 5 s. Every ring on the shelf now empties twelve times a minute, each refill is one database query, and together they become a thick stream; the database's load bar turns amber. On the chart, the load line rises and the age line falls. "Short TTL: fresh data, busy database."
6. The dial turns to 1 hour. The rings barely move, the database idles, but $10 is still served long after the change. "Long TTL: calm database, old data."

**The moment**: Beats 5–6. As the dial turns, the two chart lines cross, and the stream of refills thickens and thins in step: each key costs one query per TTL.

**Interaction**: A TTL dial (1 s to 1 h) and a "Change the price" button. Viewers look for the TTL where both the staleness and the load are acceptable for them.

**Ending**: The dial settles at 60 s with both meters moderate. "Pick how stale you can afford."

**Variants**: `cache-invalidation`, `stale-while-revalidate`, `cache-stampede` (when a hot key expires), `negative-caching`, `browser-cache` (max-age).

**Techniques**: timer, contents, stream, chart, meter, restyle, dial, caption.

**Review**: Improved — one cached key refills only once per TTL, so a single card couldn't produce "a thick stream of misses"; the cache is now a shelf of keys with one in front, making the load (keys ÷ TTL) honest and visible.

### Cache invalidation (`cache-invalidation`)

**The aha**: Deleting the copy when the data changes keeps caches fresh without short TTLs. But a slow read can put the old value back just after the delete, so keep a TTL as a backstop.

**Misconception to defeat**: That deleting the key on write is simple and complete.

**Cast**: A Reader dot and a Writer dot on the left; the app; a cache card `user:42`; the database. Below them, four time lanes (Reader, Writer, Cache, Database) with a playhead, where each event drops a marker as it happens.

**Opening frame**: The cache and the database both hold `user:42 = "Ana"`. The cache card has a long TTL ring (1 h).

**Story**:

1. The Writer changes the name to "Ann". The database updates, and the app deletes the cache card with a cross and a puff. "On write: update the database, delete the copy."
2. The next read misses, fetches "Ann" and refills the cache. "The next read gets the fresh value."
3. Replay from the start, with one change. "Now with a slow reader." The Reader misses and reads "Ana" from the database, but its token stalls on the way back while its stopwatch climbs.
4. Meanwhile the Writer sets "Ann" and deletes the key, though nothing is there to delete. A marker drops in the Cache lane.
5. The stalled token finally lands and writes "Ana" into the cache with a fresh 1-hour ring, outlined in red. On the lanes, an arrow shows the old read landing after the delete. "The slow read put the old value back after the delete."
6. Every later reader gets "Ana". Fast-forward: the ring finally empties and "Ann" appears. "Only the TTL ends it."

**The moment**: Beat 5, in slow motion. The delete flashes, and a beat later the stale write lands, with the out-of-order arrow drawn on the lanes.

**Interaction**: Drag the slow reader's arrival along the timeline: before the delete it's harmless, after it the cache is stale. A "TTL backstop" toggle: with it off, the red card's ring becomes ∞ and the stale value lives for ever. A "Version check" toggle: the cache refuses a fill older than the delete, and the stale write bounces off.

**Ending**: The lanes, with the race circled and the red card's ring draining. "Invalidate on change. Keep a TTL anyway."

**Variants**: `cache-ttl`, `cache-aside`, `write-through`, `cdn` (purging a path), `cache-eviction` (a different reason to drop). Leases or versioned fills (as in Facebook's memcache) close the race; the TTL bounds whatever still slips through.

**Techniques**: token, contents, lanes, timer, restyle, replay, slow motion, dial, toggle, caption.

**Review**: Improved — named the rewind as part 1's replay; added a version-check toggle and the lease/version fix, so "only the TTL ends it" isn't read as "nothing else can prevent it". The race itself is correct and is the right moment.

### Eviction policies (LRU, LFU) (`cache-eviction`)

**The aha**: Eviction is about space, not freshness: a full cache has to drop something. LRU keeps what's hot right now, but one big scan flushes it. LFU keeps long-time favourites, but it's slow to let go of yesterday's.

**Misconception to defeat**: That eviction is expiry. The evicted cards haven't expired.

**Cast**: Two five-slot cache shelves side by side, labelled LRU and LFU, fed the same request stream from the left. Each card shows its key, a use count and a TTL ring. The LRU shelf is ordered by recency, most recent on the left. Under each shelf is a hit-ratio meter.

**Opening frame**: Both shelves are full with cards A–E. A (×40) and B (×35) are clearly hot, and a "5/5" badge glows. "Full. Something must go."

**Story**:

1. F arrives and misses. LRU drops its right-most card, the least recently used; LFU drops its lowest count. F slides in on both. "LRU drops the oldest-used. LFU drops the least-used."
2. Spotlight the dropped cards: their TTL rings are still full. "Nothing expired. It's about space."
3. A report job scans G, H, I, J and K once each, as grey cards. On the LRU shelf every grey card pushes off a hot one, until the shelf is all grey. On the LFU shelf, A and B hold, and the grey cards churn through one slot. "One scan flushes LRU."
4. Normal traffic for A and B returns. LRU misses, shown in red, and its hit ratio falls; LFU hits. "LFU kept the favourites."
5. Tastes change: V, W, X, Y and Z become the hot set, and nobody asks for A or B any more. LFU keeps A (×40) and B (×35) for good, so the five new favourites churn through the other three slots, missing in red. LRU lets A and B age out and holds all five. "LFU clings to yesterday's favourites."

**The moment**: Beat 3. The same scan sweeps through both shelves: LRU is wiped out and LFU barely moves.

**Interaction**: Choose a traffic pattern (steady hot set, one big scan, trend shift) and a policy (LRU, LFU, random), and watch each hit ratio. No policy wins every pattern.

**Ending**: A small scoreboard of hit ratio by policy and pattern. "Choose by your traffic."

**Variants**: `cache-ttl` (expiry, the contrast), `cache-hit-ratio`, `locality-of-reference`. Real LFUs decay old counts (Redis's `allkeys-lfu`), and admission-aware policies (W-TinyLFU, in Caffeine) fix both weaknesses: an advanced follow-on.

**Techniques**: side by side, contents, move, restyle, spotlight, meter, choice, caption.

**Review**: Improved — beat 5 was wrong as written: a single new hot key would enter once and then hit, even under LFU. It now uses a new hot set larger than the slots A and B leave free, which is how stale counts really hurt; noted count decay and W-TinyLFU as the real-world fixes.

### Stale-while-revalidate and refresh-ahead (`stale-while-revalidate`)

**The aha**: Nobody waits for a refresh. Just past expiry, the old copy is served instantly while one background fetch replaces it, and if the source is down, the old copy covers for it. A hard limit still caps how old an answer can get.

**Misconception to defeat**: That an expired entry must make the next user wait for fresh data.

**Cast**: Two lanes, top "Plain TTL" and bottom "Stale-while-revalidate", each with users, a cache card, the database and stopwatches on requests. The bottom card's ring has a green arc (fresh, the soft TTL), then an amber arc (may serve stale while refreshing), and a thin red line where amber ends (the hard limit: never serve older than this).

**Opening frame**: Both cards are fresh and green, and both lanes serve hits in 2 ms.

**Story**:

1. Both rings drain through green. "Fresh: serve from the cache."
2. Top: the ring empties, and the next user waits on a database fetch. Their dot pulses and the stopwatch reads 300 ms. "Plain TTL: someone waits for the refresh."
3. Bottom: the ring enters amber. The next user gets the old copy in 2 ms, tagged "stale", while one dashed token goes to the database in the background. "Stale but instant. Refreshing behind the scenes."
4. The dashed token returns. The card flips to the new value and its ring goes back to full green. "The next users get fresh data."
5. Refresh-ahead: a request near the end of the green arc triggers the background refresh early, so amber never shows. "Or renew just before it expires."
6. The database fails with a red ✗. Refreshes bounce back, and the card keeps serving amber answers. "Source down? Serve the last good copy."
7. The ring reaches the red line, and the bottom lane now returns errors too. "Hard limit: too old to serve."

**The moment**: Beats 2–3, side by side at the same instant: 300 ms in red on top, 2 ms below. The only difference is who waits: a user, or a background fetch.

**Interaction**: Two dials, the soft TTL (green) and the hard limit (red line). A "Break the database" button.

**Ending**: The bottom lane cycles green → amber → green while every user gets a 2 ms answer. "Nobody waits. Nothing gets too old."

**Variants**: `cache-ttl`, `cache-stampede` (one background refresh instead of a herd), `request-coalescing`, `browser-cache` and `http-caching` (Networking): in HTTP the green arc is `max-age`, amber is `stale-while-revalidate`, and `stale-if-error` sets how long amber may stretch while the origin fails (RFC 5861; honoured by most CDNs).

**Techniques**: side by side, lanes, timer, token, restyle, failure, dial, caption.

**Review**: Improved — refresh-ahead is triggered by a request near expiry, not by the card on its own; the three dials collapsed to two (grace was just the gap between them); the arcs are mapped to the real HTTP directives. The side-by-side 300 ms vs 2 ms moment is right.

### Cache stampede (thundering herd) (`cache-stampede`)

**The aha**: The cache was hiding how much load there really is. When one popular entry expires, 10,000 hits become 10,000 identical database queries at the same moment.

**Misconception to defeat**: That a miss costs one query.

**Cast**: A dense crowd sending a thick stream; three app servers; a cache with one hot card, `homepage`, and its TTL ring; the database with a load bar; a "database queries/s" counter; a chart strip of database load along the bottom.

**Opening frame**: The thick stream turns back at the cache, and none of it reaches the database. "10,000 req/s · database: 0". The database bar is nearly empty.

**Story**:

1. The `homepage` ring drains. "One hot key, about to expire."
2. Slow motion, with a 0.25× badge. The ring reaches zero and the card vanishes.
3. The stream no longer turns back. It pours past the cache as thousands of tokens, every one labelled `SELECT homepage`. The counter jumps from 0 to 10,000, the database bar slams red, and query stopwatches climb from 20 ms to 3 s. "10,000 misses, all asking for the same thing."
4. Nobody has refilled the key, because the first query hasn't come back, so the misses keep coming and the chart spikes. "The slower the database, the longer the key stays missing."
5. One answer finally returns and refills the card. The flood stops. "The cache was hiding the real load."
6. Three small replays of the same expiry, each with one fix: coalescing (one query while the rest wait), jittered TTLs (expiries spread out) and early refresh (the card renews before zero). Each flattens the chart. "Coalesce, add jitter, refresh early."

**The moment**: Beat 3, in slow motion. The stream that turned back at the cache swerves straight into the database, every token carrying the same query.

**Interaction**: A "traffic on this key" dial (100 to 10,000 req/s): the herd is traffic × refill time (Little's Law again), and since the herd slows the refill, it feeds itself. A "Many keys, same TTL" choice expires a whole batch at once. Toggles turn each fix on.

**Ending**: The chart strip shows the spike beside the flat line with coalescing on.

**Variants**: `request-coalescing`, `stale-while-revalidate`, `cold-cache` (every key missing at once), `cache-ttl`, `littles-law`; `thundering-herd` and `retry-storm` (Reliability).

**Techniques**: stream, token, timer, meter, chart, slow motion, replay, failure, toggle, dial, choice, caption.

**Review**: Improved — the plan was already strong (the turned-back stream swerving into the database is the right moment); tagged beat 6 as replays, tied the herd size to Little's Law and its self-feeding loop, and linked Reliability's `thundering-herd` and `retry-storm`.

### Request coalescing (single flight) (`request-coalescing`)

**The aha**: When many requests miss on the same key at once, one goes to the source and the rest wait and share its answer. 1,000 identical misses become one backend call.

**Misconception to defeat**: That every miss needs its own query, and confusing coalescing with batching, which bundles different requests.

**Cast**: The user crowd; a cache with an empty `homepage` slot; beside it, an "in flight" board with one row per key being fetched and a row of waiting dots attached to each; the database with a load bar; a "backend calls" counter.

**Opening frame**: `homepage` has just expired and a burst of identical requests is arriving. The board is empty and the counter reads 0.

**Story**:

1. The first miss writes "homepage: fetching…" on the board and sends one token to the database. Counter: 1. "First miss: one request goes to the source."
2. 999 more misses arrive. Instead of passing through, each clips onto the waiting row behind that board entry. The waiting count climbs while the counter stays at 1. "The rest see it's on its way, and wait."
3. The answer returns. It fills the cache and splits into 1,000 copies that fly back to every waiting user at once. "One answer, shared by all."
4. Toggle: coalescing off, same burst. 1,000 tokens hit the database, its bar turns red and the counter reads 1,000. "Without it: 1,000 identical queries."
5. A burst for different keys (`a`, `b`, `c`) gets three board rows and three fetches. "It only merges identical requests. Batching bundles different ones."

**The moment**: Beat 3. One reply token fans out into a thousand while the backend counter still reads 1.

**Interaction**: A coalescing on/off toggle and a burst-size dial (10 to 10,000). With coalescing on, backend calls stay at 1; with it off, they match the burst.

**Ending**: Side-by-side counters: "1,000 requests → 1 backend call" and "1,000 → 1,000".

**Variants**: `cache-stampede`, `batching` (the contrast), `origin-shield` and `cdn` (collapsed forwarding at the edge), `read-through`.

**Techniques**: token, contents, clone, meter, toggle, dial, side by side, caption.

**Review**: Keep — one reply fanning out to a thousand while the counter reads 1 is unmistakable, and beat 5 defeats the batching confusion; correct as written (it's Go's `singleflight`, NGINX's `proxy_cache_lock`, a CDN's request collapsing).

### Negative caching (`negative-caching`)

**The aha**: A lookup for something that doesn't exist misses every time and goes all the way to the database. Caching "not found" for a short time stops repeated or malicious lookups hammering the source.

**Misconception to defeat**: That "not found" leaves nothing to cache, or the opposite mistake, that an absence can be cached as long as a real answer.

**Cast**: Users, including a cluster of red dots (a broken client polling a deleted account, and a scraper re-requesting a handful of dead links); the app; a cache of normal cards with long TTL rings; the database with a load bar; a "queries for things that don't exist" counter. A negative entry is a hollow card marked ∅, with a short, fast ring.

**Opening frame**: Normal traffic hits the cache and the database is calm.

**Story**:

1. A request for `user:123` hits. Fine.
2. A request for `user:9999` misses, goes to the database and comes back "not found". The cache slot stays empty, with a small puff to show nothing was stored. "Not found: nothing gets cached."
3. The red dots ask for `user:9999` and the same few dead ids again and again. Each goes to the database, the counter climbs, and the database bar turns amber, then red. "So every repeat goes all the way to the database."
4. Negative caching is switched on. The next "not found" is stored as `user:9999 → ∅` with a 30 s ring, and the red dots start turning back at the cache. The database bar falls. "Cache the absence, briefly."
5. User 9999 signs up and a row appears in the database. The ∅ card still answers "not found" until its short ring empties; then the real user is fetched. "Keep it short: absence can change."

**The moment**: Beat 4. The red stream that ran through to the database turns back at the ∅ cards, and the database's load bar drops.

**Interaction**: A negative-caching toggle and a negative-TTL dial. A longer TTL means less database load, but a newly created item stays "not found" for longer. A "Random ids" switch shows the limit: when every lookup is for a new id, nothing repeats and ∅ cards never get a hit, which is a job for rate limiting.

**Ending**: A cache of solid cards with slow rings alongside hollow ∅ cards with fast ones.

**Variants**: `cache-ttl`, `cache-aside`, `rate-limiting` (the defence against never-repeating lookups). DNS caches "no such name" answers the same way (Networking).

**Techniques**: token, stream, contents, timer, meter, restyle, toggle, dial, caption.

**Review**: Improved — the bot asked for random ids, which negative caching can't stop (each id is new, so each still misses); the red traffic now repeats the same missing ids, and a "Random ids" switch shows where rate limiting has to take over.

## Content delivery and the edge

### Content delivery network (CDN) (`cdn`)

**The aha**: Distance is latency. Serving from a nearby edge cuts a round trip from hundreds of milliseconds to a few tens, and the origin only sees the misses.

**Misconception to defeat**: That a CDN makes your server faster or is a kind of load balancer. What it actually does is move copies closer to users.

**Cast**: A world map. The origin (a server box and a database) is in Virginia. User crowds are in Sydney, London, São Paulo and Tokyo. Requests are tokens that travel arcs on the map, carrying stopwatches. Edge locations are small cache boxes pinned on cities, each with its own contents.

**Opening frame**: The map, with one long dashed arc from Sydney to Virginia labelled "~200 ms round trip". "Your server is in one place. Your users aren't."

**Story**:

1. A Sydney user requests `logo.png`. The token slowly crosses the Pacific and comes back. Stopwatch: 220 ms. "Every request crosses the ocean."
2. Edge pins appear in each city, one by one. "A CDN puts caches near users."
3. Sydney asks again. The token makes a short hop to the Sydney edge, which is empty, so the edge makes one long trip to the origin, stores `logo.png` and replies. 230 ms. "First request: the edge fetches from the origin."
4. The next Sydney users make short local hops and hit, at 15 ms each. "After that, it's served next door."
5. Every city does the same. The map fills with short local loops, and only an occasional thin arc reaches Virginia. The origin's counter reads "requests seen: 4 of 10,000" and its load bar is nearly empty. "The origin only sees the misses."

**The moment**: Beat 4. 220 ms and 15 ms side by side, with the difference in arc length plain on the map.

**Interaction**: Click any city to send a request and read its stopwatch. A CDN on/off toggle. A pull/push toggle: push uploads files to every edge ahead of time, so even the first request hits.

**Ending**: A map full of short local loops and a quiet origin. "Distance is latency."

**Variants**: `origin-shield`, `edge-compute`, `static-content-hosting`, `cache-invalidation` (purging the edges), `global-load-balancing` (the contrast: it routes users, it doesn't copy content), `latency-numbers`. Platform versions: Azure Front Door, Amazon CloudFront, Cloud CDN.

**Techniques**: map, token, path trace, timer, contents, appear / disappear, meter, toggle, caption.

**Review**: Merged — owned by Networking (`plans/networking.part2.md`). That plan should borrow: an origin counter ("requests seen: 4 of 10,000") so "the origin only sees the misses" is shown, not said; the first-request cost at the edge (230 ms on a miss, 15 ms after) as clickable cities on a map whose arc lengths are the latency; the pull/push toggle, since the Scaling catalog folds push vs pull into `cdn`; and links to `origin-shield`, `edge-compute`, `static-content-hosting` and `global-load-balancing` (the contrast: it routes users, it doesn't copy content).

### Origin shield (tiered caching) (`origin-shield`)

**The aha**: Without a shield, every edge location misses on its own, so a new object costs one origin fetch per city. With a shield in between, the origin fetches it once.

**Misconception to defeat**: That a CDN means the origin fetches each object once. It actually fetches it once for every edge.

**Cast**: A world map with twelve edge pins and the origin in Virginia (with a load bar). The shield is a larger, funnel-shaped cache box beside the origin. A counter at the origin reads "fetches of `launch.mp4`".

**Opening frame**: A new video has just been published. The edges are empty and the counter reads 0.

**Story**:

1. No shield. Viewers in all twelve cities press play within seconds of each other. Every edge misses, twelve long arcs converge on Virginia, the counter reads 12, and the origin's bar flares amber. "No shield: every city fetches on its own."
2. Replay, with one change: the shield appears next to the origin. "Add a middle layer."
3. The same twelve misses arrive. All twelve arcs end at the shield, which merges them, misses once, and sends a single arc to the origin. Counter: 1. "Edges miss to the shield. Only the shield goes to the origin."
4. The shield stores the video, and its one copy flows back along all twelve arcs, each edge keeping its own. "One origin fetch, served worldwide."
5. A purge empties every cache and the same thing repeats: the origin sees one fetch, not twelve.

**The moment**: Beats 1 and 3, side by side: twelve arcs converging on the origin against a single one, with counters reading 12 and 1.

**Interaction**: An edge-count dial (5 to 300). Without the shield, origin fetches follow the dial; with it, they stay at 1.

**Ending**: The shielded map: many short arcs into the shield, one thin line to the origin, and the counter at 1.

**Variants**: `cdn` (Networking), `request-coalescing` (the shield merges simultaneous misses), `cache-layers`, `cache-stampede`. Platform versions: CloudFront Origin Shield, Cloudflare Tiered Cache, Fastly shielding.

**Techniques**: map, token, path trace, side by side, replay, meter, appear / disappear, clone, dial, caption.

**Review**: Improved — "copies it out to all twelve edges" read as a push; the copy now flows back along the edges' own requests (it's still pull). Beat 3 shows the shield merging the twelve simultaneous misses, which is what keeps the counter at 1; the rewind is part 1's replay.

### Static content hosting (`static-content-hosting`)

**The aha**: Most of a page load is files that are the same for every user. Served from object storage behind a CDN, they scale with no servers at all, and the app servers spend their capacity only on dynamic work.

**Misconception to defeat**: That files belong on the app servers because that's where they were deployed.

**Cast**: The user crowd; a scale set of three app servers with load bars; a page load drawn as a burst of two kinds of token, one purple diamond (the dynamic HTML or API call) and twenty small grey squares (images, JS, CSS). A storage bucket and a CDN edge arrive in beat 3.

**Opening frame**: A single page load heads into the app servers as a 21-token burst labelled "1 dynamic · 20 static". The servers' bars are amber.

**Story**:

1. Page loads stream in, every token going to the app servers, and the scale set adds a fourth copy to keep up. "Twenty of every 21 requests are files."
2. Spotlight the grey squares: they're identical for every user. "Most of your servers' requests send the same files to everyone."
3. A `/static` folder card lifts out of the app box and drops into a bucket, and a CDN edge appears in front of it. "Move them to object storage behind a CDN."
4. The next page load splits by colour as it leaves the user. Grey tokens go to the nearby edge and are back in milliseconds; only the purple diamond goes to the app servers. Their bars drop to green and the fourth copy disappears. "Servers do only the dynamic work."
5. Traffic ×10. The grey path absorbs it with nothing to scale, and the app tier scales only for the extra diamonds. "Static scales with no servers at all."

**The moment**: Beat 4. The burst splits into two streams by colour, and the app servers' bars fall from amber to green.

**Interaction**: A traffic dial and a static-hosting toggle. With hosting off, the scale set needs several times the copies for the same traffic.

**Ending**: Two clear paths: a thick grey stream to the bucket and CDN, and a thin purple one to a lean app tier.

**Variants**: `cdn`, `cache-layers`, `browser-cache`, `horizontal-scaling`. Platform versions: Azure Blob Storage static website behind Azure Front Door, Amazon S3 with CloudFront, Cloud Storage with Cloud CDN.

**Techniques**: token, stream, move, spotlight, meter, appear / disappear, toggle, dial, caption.

**Review**: Improved — static files do change (on deploy), so "never change" became "the same for every user"; "servers spend most of their time" overclaimed (static requests are many but cheap) and became a request count; "adds just one copy" at ×10 traffic was arithmetic the plan couldn't back, so the app tier now scales only for the diamonds.

### Edge compute (`edge-compute`)

**The aha**: Some decisions don't need the origin. Running small functions on edge servers saves the round trip and the origin's capacity, within tight limits on run time and state.

**Misconception to defeat**: That edge compute is the same as CDN caching. A cache stores answers; edge code works them out.

**Cast**: A world map with a Sydney user, the Sydney edge, and the origin in Virginia (with a load bar). The edge box has two compartments: a cache shelf of stored files, and a function slot with a λ icon, a small code card and a tight budget meter (milliseconds of CPU, a little memory, no local database). Requests carry stopwatches.

**Opening frame**: The Sydney edge with an empty function slot, as a request for `GET /account` with no login cookie arrives.

**Story**:

1. The edge can't answer it, so it forwards the request across the Pacific. The origin checks for the cookie and replies "302 → /login". Stopwatch: 230 ms. "All that, to say 'go and log in'."
2. Code drops into the function slot: `if no cookie → redirect`. "Run the decision at the edge."
3. The same request again: the function answers 302 on the spot. Stopwatch: 12 ms. No arc is drawn and the origin's counter doesn't move. "Decided next door. The origin never sees it."
4. A quick run of examples, all handled locally: an A/B request stamped "B" and served cached page B, a cached page with the user's name stitched in, and a country redirect. "Redirects, auth checks, A/B splits, personalising cached pages."
5. Spotlight the two compartments: the shelf hands back the same file every time, while the function builds a different answer per request. "A cache stores answers. Edge code makes them."
6. A checkout needs the orders database and a payment call, both in Virginia. Run at the edge, it would cross the ocean several times instead of once (a ghost shows the zigzag), so the edge passes it to the origin. "Work that needs the origin's data stays at the origin."

**The moment**: Beat 3. The ocean arc from beat 1 simply isn't drawn, and the stopwatch drops from 230 ms to 12 ms.

**Interaction**: Choose a request type (redirect, A/B, personalise, checkout) and see whether it completes at the edge or has to go to the origin.

**Ending**: The map dotted with short loops at the edges, with the origin handling only real work. "Decide at the edge. Do the heavy work at home."

**Variants**: `cdn` (Networking), `static-content-hosting`, `serverless-architecture` (Architecture). Platform versions: Cloudflare Workers, Fastly Compute, CloudFront Functions (sub-millisecond, no network calls) and Lambda@Edge; Azure Front Door's rules engine covers declarative rules (redirects, rewrites), not general code.

**Techniques**: map, token, contents, timer, meter, appear / disappear, spotlight, ghost, choice, caption.

**Review**: Improved — the checkout beat blamed a time limit, but modern edge runtimes can wait on calls; the real reason is data gravity (the database is at the origin, so edge code would cross the ocean more, not less), now shown with a ghost zigzag. Platform list corrected: Azure's rules engine isn't general edge code.

## Latency, throughput and the maths of performance

### Latency, throughput and bandwidth (`latency-vs-throughput`)

**The aha**: Latency is how long one request takes. Throughput is how many finish per second. Bandwidth is the most a link could ever carry. More lanes don't make any one car faster.

**Misconception to defeat**: That a bigger pipe makes each response faster. It makes more fit through, not any one of them quicker.

**Cast**: A motorway drawn with lanes (bandwidth). Cars are requests, each with a dashboard stopwatch for its own journey. A toll counter at the far end ticks up cars per minute (throughput). A chart strip along the bottom tracks throughput over time.

**Opening frame**: A two-lane motorway, one car entering, stopwatch at zero, toll counter at zero.

**Story**:

1. The car drives the full length and exits. Its stopwatch reads 10 s. "Latency: how long one request takes."
2. The toll counter ticks to 1. A car enters one lane every 5 s, and the counter climbs at a steady 12 a minute. "Throughput: how many finish per unit time."
3. Two more lanes appear, unused. The same single car makes the same trip in the same 10 s. "More lanes: no change for one car."
4. Fill all four lanes with a steady stream. Cars now enter all four lanes every 5 s and the counter's rate quadruples to 48 a minute, while every car's own stopwatch still reads 10 s. "Bandwidth lets more happen at once. It doesn't speed up any one of them."
5. A shortcut cuts the road, and every trip drops to 6 s. Only now does the per-car stopwatch fall, and the counter's rate rises too, because each lane clears cars faster. "To make one request faster, shorten its path, not widen the road."

**The moment**: Beat 3 next to beat 5: adding lanes changes nothing on the dashboard stopwatch; shortening the road changes it for everyone.

**Interaction**: A lane-count dial and a road-length dial, independent of each other. Watch which one moves the stopwatch and which one moves the chart strip. A "big file" switch turns each car into a 50-car convoy: now extra lanes do shorten the time for the whole file, which is why bandwidth matters for downloads and not for a tiny API call.

**Ending**: Four full lanes, a steady high throughput line on the chart, and stopwatches holding at the shortened time. "Aim for the most throughput at a latency you can live with."

**Variants**: `latency-numbers`, `littles-law` (throughput = in flight ÷ latency), `bottleneck`.

**Techniques**: stream, token, timer, meter, chart, dial, toggle, caption.

**Review**: Improved — "11 cars over a minute" didn't add up with a 10 s trip (now 12 a minute, then 48 with four lanes); added a big-file switch, since bandwidth does shorten the transfer of a large payload and the misconception should be bounded, not overstated.

### Latency percentiles (p50, p95, p99) (`latency-percentiles`)

**The aha**: Averages hide the slow requests users actually feel. Percentiles rank every request by how long it took, so p99 names the time that's slower than 99 out of 100 requests.

**Misconception to defeat**: That the average latency is what a typical user experiences.

**Cast**: An empty chart, x-axis "response time (ms)" from 0 to 2,000. Completed requests arrive as dots that drop onto the axis at their own time. A vertical average line and three percentile markers (p50, p95, p99) track live. A single heavy user is a highlighted dot colour.

**Opening frame**: Blank axis, average line and percentile markers all parked at zero.

**Story**:

1. Dots rain in, piling into a tall cluster around 100 ms. The average line drifts to 100 ms. "Most requests are fast."
2. About one dot in seventy lands far right, near 2,000 ms, rare but real. The average line slides only to about 130 ms and still looks healthy. "A few slow ones barely dent the average."
3. All the dots slide sideways into one ranked row, fastest to slowest. p50 lands on the middle dot (100 ms), p95 a little further (200 ms), p99 well into the tail (1,900 ms). "Lined up by speed, the tail is unmistakable."
4. A heavy user fires 100 requests in a burst, highlighted in a second colour. On average one of their dots lands past p99, and about 63 times in 100 bursts at least one does. "The more you ask, the more often you hit the tail."
5. Side by side: "average: 130 ms" against "p99: 1,900 ms" in large labels.

**The moment**: Beat 3, the instant the cloud of dots resolves into one ranked line and the tail becomes visible as distance, not a number.

**Interaction**: Drag a cursor along the ranked row to read any percentile. A "fire 100 requests" button for the heavy user, repeatable, to see how often they land past p95 or p99.

**Ending**: The ranked row frozen, p50/p95/p99 labelled, the average line dwarfed beside the long tail.

**Variants**: `tail-latency`, `hedged-requests`, `utilisation-vs-latency`.

**Techniques**: contents, chart, meter, restyle, spotlight, dial, caption.

**Review**: Merged — owned by Observability (`plans/observability.part1.md`). The numbers here were inconsistent (a p99 of 1,900 ms needs more than 1% of requests near 2 s, which pushes the average well past 103 ms), so they are fixed above (average about 130 ms, p95 200 ms). That plan should borrow: the cloud-of-dots-to-ranked-row move; the "average beside p99" closing pair; the heavy-user burst (1 − 0.99^100 ≈ 63% of bursts hit the tail), which also links to `tail-latency`; and a caution that percentiles from several servers can't be averaged (merge histograms instead).

### Tail latency at fan-out (`tail-latency`)

**The aha**: If each backend is slow only 1% of the time, a request that fans out to 100 of them and waits for all is slow 63% of the time (1 − 0.99¹⁰⁰). Rare slowness becomes common the moment one request depends on many things.

**Misconception to defeat**: That a 1% chance of slowness stays rare once many things are involved.

**Cast**: A grid of 100 backend boxes. One incoming request splits into 100 tokens, one per box. Each box has a small die that, on each run, has a 1% chance of landing red (slow). A fan-in point waits for every token to return. A tally below counts "runs with at least one slow backend" out of runs so far.

**Opening frame**: The grid, all green, one request about to fan out.

**Story**:

1. The request fans out into 100 tokens. All 100 dice land green; every box answers in 10 ms; the fan-in completes at 10 ms. "No slow backend, no problem."
2. Rerun. This time box 37's die lands red: it takes 2,000 ms while the other 99 finish at 10 ms and sit waiting, greyed "done". The fan-in still reads 2,000 ms. "One slow branch holds up the whole request."
3. Run the fan-out in fast succession, 1,000 times. The tally of "at least one slow backend" settles near 634 (it wobbles by a few percent from run to run). "100 backends, 1% each: about 63% of requests feel it."
4. A chart strip plots "runs with zero slow backends" flattening near 37% beside "runs with at least one" climbing to 63%.
5. Resize the grid: 10 boxes give about 10%, 100 give 63%, 1,000 give nearly every request. To keep 99% of requests fast at 100 backends, each backend must be fast 99.99% of the time. "At scale, a backend's p99 is the user's median."

**The moment**: Beat 3, watching the tally lock in near 63% even though each individual backend is almost always fine.

**Interaction**: Two dials, the number of backends fanned out to and each one's slow probability, recompute the "at least one slow" percentage live with the formula beside it. A switch to "wait for the first 90 of 100" shows how tolerating a few stragglers lowers it.

**Ending**: The grid frozen with one red box, tally reading about 63%, caption "100 × 1% ≠ 1%: it's 63%".

**Variants**: `hedged-requests` (the fix), `latency-percentiles`, `littles-law`.

**Techniques**: token, clone, meter, chart, dial, spotlight, restyle, toggle, caption.

**Review**: Improved — 1 − 0.99¹⁰⁰ ≈ 63.4% is right, but 100 runs would wobble by ±5, so the demo now runs 1,000; added the n sweep and the flip side (each backend must be 99.99% fast for a 99% fast request), and a wait-for-90 switch, since partial fan-out is the real escape alongside hedging. Independence between backends is assumed and the caption shouldn't claim more.

### Hedged requests (`hedged-requests`)

**The aha**: If a request hasn't been answered by its p95 time, send a second copy to another replica and take whichever answer comes first. About 5% extra load shears off the tail, because both copies rarely stall at once.

**Misconception to defeat**: Confusing a hedge with a retry. A retry waits for a failure; a hedge races a reply that simply hasn't come yet. And that hedging doubles the load: only the slowest 5% get a copy.

**Cast**: A client, two replicas (A and B) of the same service, a stopwatch, and a trigger line on the timeline marking the hedge delay (the p95 time, here 50 ms). Beside them, a histogram of response times.

**Opening frame**: The request heads to A alone; the trigger line sits ahead on the timeline.

**Story**:

1. Normal case: A answers in 20 ms, before the trigger line. No hedge fires. "Most requests finish before a hedge would even trigger."
2. Unlucky case: A stalls. The stopwatch crosses the trigger line at 50 ms, and a second token goes to B. "Past the trigger: send a copy elsewhere."
3. B answers 15 ms later, 65 ms in all. That answer is used, and a cancel flies to A, whose work stops. Without the hedge the request would have waited 2,000 ms. "Fastest answer wins. Cancel the loser."
4. Stream 1,000 requests, 1% of which stall. Two histograms build side by side: "no hedging" grows a long red tail; "hedging" stops at about 65 ms. A counter reads "+5% backend calls". "The tail only survives if both copies stall: 1% × 1%."
5. Caution: the stall is a shared one (the whole fleet is overloaded). Every hedge now adds load to replicas already struggling and the tail gets worse, and the counter climbs. The same trick on a write sends two charges. "Hedge idempotent reads, and cap the extra load."

**The moment**: Beat 3, B's fast answer landing and winning while A's request, still stalled, is cancelled.

**Interaction**: A hedge-delay dial (p50 to p99) and an on/off toggle; watch the tail histogram and the extra-load counter move together. A "slow everywhere" switch triggers the beat 5 failure.

**Ending**: The two histograms frozen side by side, one long-tailed, one short, with "+5% load" beside the short one.

**Variants**: `tail-latency` (the problem), `latency-percentiles`; Reliability's `retry-backoff-jitter` (waits for a failure) and `idempotency-key`.

**Techniques**: token, clone, timer, chart, meter, dial, toggle, side by side, caption.

**Review**: Improved — the counter said "+1%" while the trigger sat at p95, which hedges about 5% of requests (the trigger percentile sets the extra load, not the stall rate); B's time is now counted from the hedge (65 ms, not 15); the late reply is cancelled, not left to limp in; added the correlated-slowness and writes cautions and the 1% × 1% reason it works, borrowed from `plans/reliability.part1.md`, which keeps its own framing of the retry contrast.

### Latency numbers to know (`latency-numbers`)

**The aha**: Each step up the ladder (memory, SSD, a round trip inside a data centre, a disk seek, a round trip across an ocean) is roughly 5 to 1,000 times the last. One ocean crossing costs as much time as over a million memory reads.

**Misconception to defeat**: That these numbers are all roughly the same order of magnitude, so code tuning matters more than where the data sits.

**Cast**: A vertical ladder on a log scale, rungs labelled memory read (~100 ns), SSD read (~0.1 ms), same-data-centre round trip (~0.5 ms), disk seek (~10 ms), cross-ocean round trip (~150 ms). Each rung fires a token with a stopwatch and a size bar comparing it to the rung below. A "human clock" strip sits beside the ladder, empty.

**Opening frame**: The ladder, all rungs dim, a token waiting at the bottom.

**Story**:

1. Memory read: an instant flash, 100 ns. "Memory: about 100 nanoseconds."
2. SSD read: a short pause, 0.1 ms, bar reads "1,000× the memory read". "Already a thousand times slower."
3. Round trip inside a data centre: 0.5 ms, bar "5× the SSD read".
4. Disk seek: 10 ms, bar "20× the data-centre round trip".
5. Round trip across an ocean, on a small map arc: 150 ms, bar "15× the disk seek". A ticker beside it counts up to "1,500,000 memory reads". "One ocean crossing = over a million memory reads."
6. Rescale to human time: the memory read becomes 1 second. The SSD read is 17 minutes, the data-centre trip 1.4 hours, the disk seek a day, and the ocean crossing 17 days. "If a memory read took a second, the ocean would take over two weeks."

**The moment**: Beat 6, the same ladder stretched to human time, where the ocean rung runs off the screen.

**Interaction**: Click any rung to replay its token and comparison bar against the rung below it. A "scale" switch moves between real units and human time.

**Ending**: The full log-scaled ladder, every rung lit with its time and comparison. "Move data closer before tuning code."

**Variants**: `cdn`, `latency-vs-throughput`, `critical-path`.

**Techniques**: chart, token, timer, meter, spotlight, toggle, caption.

**Review**: Improved — the ratios check out (1,000×, 5×, 20×, 15×; 150 ms ÷ 100 ns = 1.5 million) but the caption said "ten to a thousand times", wrong for the 5× rung, now "5 to 1,000"; added the human-time rescale, which makes the gap felt rather than read. The figures are rough, round and dated (modern SSD reads are tens of microseconds on NVMe); the plan should say "orders of magnitude" on screen. Beats 1–4 run fast so the sequence stays under 45 s.

### Little's Law (`littles-law`)

**The aha**: Requests in flight equal the arrival rate times how long each one spends in the system (L = λW). Measure any two and you know the third. If latency doubles at the same arrival rate, the concurrency you need doubles too.

**Misconception to defeat**: That "requests in flight" is some separate, unrelated number from arrival rate and latency, instead of their product.

**Cast**: A pipe (the system), dots entering steadily on the left at rate λ, each carrying a stopwatch running for W seconds before it exits on the right. A live counter above the pipe reads the number of dots currently inside (L). Two dials, λ and W, with a readout "L = λ × W".

**Opening frame**: Dots entering at λ = 10/s, each lasting W = 0.2 s, counter settling at L = 2.

**Story**:

1. Steady trickle at 10/s, each dot's stopwatch running 0.2 s before it leaves. "Arrival rate 10 per second, 0.2 seconds each."
2. Count the dots inside the pipe at any instant: it holds steady at 2. "L = 10 × 0.2 = 2."
3. Turn λ up to 100/s, W unchanged: the pipe visibly fills with far more dots at once; the counter climbs to 20. "Ten times the arrivals, ten times the concurrency."
4. Turn λ back to 10/s and turn W up to 2 s instead (a slow dependency makes each request linger): the pile is again 20. "Ten times the time in the system does the same as ten times the rate."
5. Relabel the pipe "thread pool, size 20", with λ back at 100/s. A slow dependency doubles W to 0.4 s: L wants to be 40, the pool holds 20, and the excess dots queue outside it, a queue that keeps growing. "That's how many threads, connections or instances you need. Slow down, and you need twice as many."

**The moment**: Beats 3–4, two completely different dial moves producing the identical pile of dots inside the pipe, because both multiply out to the same L.

**Interaction**: Drag the λ and W dials independently; watch the pipe's contents and the L readout track the product live. A pool-size slider shows the queue appearing the instant L exceeds it.

**Ending**: The pipe at a steady state, L dots visibly inside, the equation beside it reading exactly that count.

**Variants**: `utilisation-vs-latency`, `bottleneck`, `concurrency-vs-parallelism`; `cache-stampede` (herd size = traffic × refill time).

**Techniques**: stream, contents, meter, timer, chart, dial, caption.

**Review**: Improved — beat 4's caption was wrong (starting from 10/s and 0.2 s, doubling W gives 4, not 20; ten times W gives 20); the "pool of 15" example is replaced by the real case, a slow dependency doubling W against a fixed pool, where the overflow queue grows without end rather than settling at 5. L counts everything in the system, queued or being served, which the caption should keep saying.

### Utilisation vs waiting time (queueing) (`utilisation-vs-latency`)

**The aha**: As a resource gets busier, the wait for it grows faster than the busy-ness itself. At 50% busy a request takes twice its work time in total; at 90% it takes ten times. That's why 100% utilisation, which sounds efficient, is a latency disaster.

**Misconception to defeat**: That running a resource flat out is the efficient, desirable state.

**Cast**: A single server with a visible queue of waiting requests in front of it (random, bursty arrivals, work times that vary), a utilisation meter (0-100%) beneath it, and a chart strip that plots response time (as a multiple of the work time) against utilisation, drawing a curve as readings come in.

**Opening frame**: Server idle, meter at 0%, queue empty, chart axis bare.

**Story**:

1. Random arrivals push utilisation to 50%. The queue holds 0-1 requests most of the time; each request spends about 2× its work time in the system (1× working, 1× waiting). A point plots at (50%, 2×). "Half busy: barely any queue."
2. Utilisation rises to 70%. The queue lengthens in bursts; response time climbs to about 3.3×. The curve starts to bend upward.
3. Utilisation rises to 90%. The queue now regularly stacks several requests deep; response time balloons to about 10×. "Nearly full: the wait explodes."
4. Push to 99%: about 100×, the queue grows into a long line, stopwatches near the back spin upward, and the curve goes almost vertical. At 100% it never recovers. "Every extra point of busy costs more than the last."
5. A caption lands beside the full curve: "100% utilised sounds efficient. For latency, it's a disaster."

**The moment**: Beats 3-4, the queue's visible length and the curve's steepness both exploding for a small move of the meter.

**Interaction**: Drag the utilisation dial and watch the queue and the plotted curve respond live. A "steady arrivals" switch (one request exactly every 10 ms) removes the queue even at 99%, showing that randomness, not busy-ness alone, makes the wait.

**Ending**: The completed curve, a green "healthy" zone shaded well below the knee (about 70-80% for one server) and a red zone shaded at the steep end.

**Variants**: `littles-law`, `bottleneck`, `capacity-headroom`, `overload`.

**Techniques**: contents, meter, chart, dial, toggle, restyle, caption.

**Review**: Improved — the plan mixed queue wait and total time (the single-server formula gives total = work ÷ (1 − utilisation): 2×, 3.3×, 10×, 100×); the chart now plots total response time, matching the catalog's "twice at 50%, ten times at 90%". Added the steady-arrivals switch, because the curve assumes random arrivals and varying work, and a note that the knee shifts right with many servers sharing one queue.

### Bottlenecks (`bottleneck`)

**The aha**: A pipeline only goes as fast as its slowest stage. Speeding up anything else changes nothing, and fixing the bottleneck just promotes the next-slowest stage into the role.

**Misconception to defeat**: That upgrading any stage helps throughput, wherever it is in the chain.

**Cast**: A four-stage pipeline of "parse", "validate", "query DB" and "render", drawn as boxes in a row, each with a sustainable-throughput number, a busy bar and visibly different pipe widths. A stream of tokens flows through; a queue builds in front of whichever stage is narrowest. An overall-throughput chart runs along the bottom.

**Opening frame**: Capacities 500, 500, 100, 150 req/s. "query DB" is drawn narrow, with tokens already queuing in front of it.

**Story**:

1. A heavy, steady stream enters stage one, flows cleanly, then piles up in front of "query DB". Its busy bar is full while the others show idle gaps; the chart flatlines at 100 req/s. "The whole line moves at query DB's pace."
2. Double "parse" to 1,000 req/s. Nothing downstream changes: the same queue, the same flat 100 on the chart. "Faster upstream changes nothing."
3. Instead double "query DB" to 200 req/s. Its queue drains, the chart climbs to 150, not 200, and a new queue now appears in front of "render" (150 req/s), previously hidden behind the bigger bottleneck. "Fix the bottleneck, and the next-slowest stage takes its place."
4. Upgrade "render" to 300: the chart climbs to 200 and the queue moves back to "query DB". Each upgrade gains less than the one before.

**The moment**: Beats 2 and 3, the same action (doubling a stage's capacity) doing nothing in one case and something in the other.

**Interaction**: Click any stage to upgrade its capacity; watch where the queue relocates and whether the overall-throughput chart moves.

**Ending**: All stages balanced near the same capacity, no queue anywhere, the chart flat at the new, higher ceiling.

**Variants**: `critical-path` (the latency analogue), `littles-law`, `utilisation-vs-latency`, `amdahls-law`.

**Techniques**: stream, contents, meter, chart, spotlight, dial, caption.

**Review**: Improved — beat 3 said the chart would climb to 200 while also saying render caps it at 150 (the next-slowest stage sets the new ceiling, so 150); the opening render was 500 and is now 150 to make that true from the start. Added busy bars, since the bottleneck is the stage at 100% with idle stages around it, and replaced "queue grows without bound" with a stream the stages can be seen to lag behind.

### Critical path (`critical-path`)

**The aha**: The critical path, the longest chain of steps that must happen one after another, sets the end-to-end latency. Speeding up a step off that path changes nothing; running independent steps in parallel shortens it.

**Misconception to defeat**: That making any step faster makes the whole request faster.

**Cast**: A request's work as a small dependency graph: "auth" (20 ms), then "fetch profile" (30 ms) and "fetch settings" (10 ms), both feeding "render" (15 ms). Boxes connected by arrows; the chain that actually determines the total is outlined in bold once found.

**Opening frame**: The four steps drawn running strictly in sequence (auth, then profile, then settings, then render) with a stopwatch ticking through all of them.

**Story**:

1. Run it as drawn: one token passes through all four boxes in turn. Stopwatch: 75 ms. "One after another: 75 ms."
2. Redraw the graph honestly: profile and settings only depend on auth, not on each other. They move into parallel lanes. "They don't need each other."
3. Replay with two tokens launching together right after auth: profile and settings run side by side; render waits for the slower of the two, not both added up. Total: 20 + 30 + 15 = 65 ms. "Wait for the slowest, not the sum."
4. The chain auth → profile → render is outlined in bold: that's what sets the 65 ms. Settings, finishing early, is dimmed. "This chain is the critical path."
5. Speed "settings" up to 2 ms: the total stays at 65 ms, because it was never on the bold path. "Faster off the path: nothing changes."
6. Speed "profile" up to 10 ms instead: the total drops to 45 ms. Push it down to 2 ms: still 45, because settings (10 ms) is now the longer branch and the bold outline jumps to it. "Faster on the path: everything moves, until the path changes."

**The moment**: Beats 5 and 6, the identical move (make a step faster) doing nothing once and everything the next time, depending only on whether it's on the bold chain, with the bold path hopping across.

**Interaction**: Click any box to speed it up or slow it down; watch the bold path recompute and the total stopwatch respond, or not. A trace-waterfall view lays the same steps as bars on a timeline, as a tracing tool would show them.

**Ending**: The graph with its critical path outlined end to end, the total time labelled beside it.

**Variants**: `bottleneck` (the throughput analogue), `littles-law`, `concurrency-vs-parallelism`.

**Techniques**: token, path trace, spotlight, timer, restyle, dial, caption.

**Review**: Improved — the arithmetic is right (75, 65, 65, 45) but the profile-to-10 ms step left a tie with settings; the plan now pushes on past it, showing the path switching and the gain stopping at 45 ms, which is the part people get wrong in practice. Added the trace-waterfall view as the real-world form.

### Amdahl's law (`amdahls-law`)

**The aha**: The speed-up from parallelising is capped by the part of the work that can't be split. If 5% must run sequentially, no number of machines makes the job more than 20 times faster, and with coordination overhead, adding more can even slow it down.

**Misconception to defeat**: That doubling the machines roughly doubles the speed, forever.

**Cast**: A task bar split into a small red "sequential" segment, fixed width, and a larger blue "parallel" segment that shrinks as workers are added. A worker-count dial. A speed-up chart plotting achieved speed-up against worker count, with a dashed ceiling line.

**Opening frame**: One worker: red 5%, blue 95%, total time 100%. Speed-up reads "1×". Chart empty, ceiling line not yet drawn.

**Story**:

1. Add a second worker: blue halves to 47.5% of the original time; red stays fixed at 5%. New total: 52.5%. Speed-up: about 1.9×. A point plots on the chart. "The parallel part splits. The sequential part doesn't."
2. Keep doubling workers: 8 gives 5.9×, 16 gives 9.1×, 64 gives 15.4×. Blue keeps shrinking toward nothing while red stays exactly 5% wide; the curve visibly bends toward a dashed ceiling at 20×. "The cap: 1 ÷ 0.05 = 20×, however many machines."
3. Push to 1,000 workers: blue is a sliver, red is still 5% of the bar, speed-up sits just under 20× (19.6×), flat. "No number of machines gets past the sequential part."
4. Switch on coordination overhead: past some worker count, a growing purple segment (locking, chatter between workers) appears and widens with more workers. The speed-up curve now peaks and bends back down. "Add coordination costs, and more machines can even be slower."

**The moment**: Beats 2-3, red's width staying stubbornly identical no matter how far blue shrinks, and the speed-up curve flattening against its ceiling.

**Interaction**: A worker-count dial and a sequential-fraction dial, each reshaping the bar and the chart's ceiling; a coordination-overhead toggle.

**Ending**: The chart frozen with the curve pressed against its ceiling (and dipping past its peak if overhead is on), the ceiling labelled "1 ÷ f".

**Variants**: `bottleneck`, `concurrency-vs-parallelism`, `littles-law`.

**Techniques**: contents, meter, chart, dial, toggle, restyle, caption.

**Review**: Improved — the maths was already right (1 ÷ (0.05 + 0.95 ÷ N): 1.9×, ceiling 20×, 19.6× at 1,000); added the 8, 16 and 64 worker readings so the bend can be read off, and named the overhead curve as the Universal Scalability Law, which the catalog folds in here. It holds the job size fixed; bigger jobs on bigger fleets (Gustafson) is a different story and shouldn't be implied.

### Concurrency vs parallelism (`concurrency-vs-parallelism`)

**The aha**: Concurrency is many tasks in progress, switching between them: one core can juggle hundreds if they mostly wait. Parallelism is several tasks actually running at the same instant, on separate cores. Parallelism only helps work that's genuinely computing.

**Misconception to defeat**: Treating "handling many requests at once" as one thing, when waiting and computing behave completely differently.

**Cast**: Two panels. Left, "Concurrency: 1 core": one core icon, several request bars mostly hatched ("waiting") with brief solid slivers ("working"), a scheduler arrow hopping between them. Right, "Parallelism: 4 cores": four cores, each running one task's solid, unbroken bar at once, with a vertical "now" line crossing all four.

**Opening frame**: Both panels idle, four waiting requests each.

**Story**:

1. Left: request A does 2 ms of real work, then waits 200 ms on a database (hatched). The scheduler arrow jumps to B, which does its 2 ms and waits too, then C, then D, then back to A. "One core, many requests, mostly waiting."
2. Over one second, about 500 requests finish on the left, about 100 in flight at any moment (500 × 0.2 s, Little's Law again), because waiting costs nothing once the core can switch away from it. A completed-count ticks up fast.
3. Right: four CPU-bound tasks (image resizing), each a solid, unbroken bar on its own core. The vertical "now" line crosses all four at the same literal instant. "Four cores, four tasks, truly at once."
4. Drop a CPU-bound task into the left panel. On an event loop it never yields and everything else stalls behind it; with time-slicing, every task runs at a fraction of the speed. Either way nothing finishes sooner. "Concurrency doesn't speed up CPU-bound work on one core."
5. Drop a waiting, I/O-bound task into the right panel with only one core free: it still waits the full 200 ms. "More cores don't shorten a wait, either."

**The moment**: Beat 3 right after beat 1: the single hopping arrow against four bars moving at the same literal instant.

**Interaction**: A toggle between "I/O-bound tasks" and "CPU-bound tasks" fed into both panels; completed-task counters on each show which panel actually benefits for each kind of work.

**Ending**: A small 2×2 scorecard, concurrency and parallelism against I/O-bound and CPU-bound, showing which combination helps.

**Variants**: `littles-law`, `non-blocking-io`, `amdahls-law`, `bottleneck`.

**Techniques**: side by side, contents, restyle, timer, meter, toggle, spotlight, caption.

**Review**: Improved — "thousands finish in a second" was impossible: 2 ms of CPU each caps one core at about 500 a second, and it needs about 100 waiting in flight (now stated, tied to Little's Law); the CPU-bound beat said the scheduler "never lets go", true of an event loop but not of preemptive threads, so both outcomes are shown.
