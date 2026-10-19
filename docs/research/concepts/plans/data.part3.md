# Data plans, part 3

Groups 9–13 of `catalog/data.md`, in catalog order. Shared visual language with parts 1 and 2:
databases are cylinders with a few visible rows, clients are small boxes on the left, failure is a
red flash and greying out, and analytics flows left to right (sources → ingest → store →
transform → serve) with rows as small horizontal strips, columnar files as vertical strips,
batches as boxes of strips and streams as a continuous flow of strips.

Part 1's **scrub** is used here too: the viewer drags a marker along a recorded timeline and the
whole scene shows that moment (restore to 14:02, read table version 2). It differs from **dial**,
which changes a parameter and re-runs; scrub moves through history that already happened.

## Analytical platforms

### OLTP vs OLAP (`oltp-vs-olap`)

**The aha**: Running the business and analysing the business want opposite shapes of data and
opposite resources, so analytics gets its own copy.

**Misconception to defeat**: "A database is a database: just run the reports on production."

**Cast**: Left, a column of shopper boxes. Centre, one cylinder `orders` with visible rows
(`1041: Ana, CA, $32, 14:02`). Right, an analyst figure holding a query card "Sales by country,
last 3 years". Each side has a meter: queries per second, rows per query, latency.

**Opening frame**: Shoppers left, analyst right, both pointed at the same cylinder. Caption:
"Two kinds of work, one database".

**Story**:

1. Shoppers fire small tokens; each lights one whole row, a horizontal band (an insert, an
   update). Meter: "2,000 queries/s · 1 row each · 3 ms". Caption: "OLTP: many tiny reads and
   writes of whole, current rows".
2. The analyst's card fires once; a vertical band lights just two columns, `country` and
   `amount`, down every row, years of them. Meter: "1 query · 400M rows · 40 s". Caption: "OLAP: a
   few huge scans of a few columns, over history".
3. Both at once: the scan hogs disk and memory, shopper tokens queue at the cylinder's edge and
   their latency meter climbs red to 900 ms. Caption: "The report slows checkout".
4. The cylinder clones to the right and rows stream into the copy; slowly, the copy's rows rotate
   into vertical column strips. Caption: "Analytics gets its own copy, stored the way it's read".
5. Run again: shoppers back to 3 ms on the left; on the right the scan reads only the two strips
   it needs. Caption: "Each side shaped for its own job".

**The moment**: Beat 2 crossing beat 1 on the same table: a horizontal band and a vertical band,
the two shapes of work. It pays off in beat 4, when the copy rotates to match the vertical one
and the red latency meter drops.

**Interaction**: Toggle "separate analytics copy" and press "Run report": off, checkout latency
spikes; on, it stays flat.

**Ending**: Two cylinders side by side, the left flickering with horizontal row hits, the right
with vertical column scans. Caption: "Opposite workloads, opposite shapes".

**Variants**: `data-warehouse`, `columnar-storage`, `read-replicas`, `change-data-capture`; HTAP
engines that keep both shapes in one system (SQL Server columnstore on OLTP tables, AlloyDB's
columnar engine, TiDB) as a follow-on.

**Techniques**: token, contents, spotlight, meter, restyle, clone, stream, side by side, toggle,
caption.

**Review**: Improved — made "opposite shapes" visible: OLTP lights a horizontal row band, OLAP a
vertical column band on the same table, and the copy rotates to match the vertical one; added
HTAP as the honest exception to "usually a separate copy".

### Data warehouse (`data-warehouse`)

**The aha**: Analytics gets its own cleaned, integrated, historical copy, so heavy reports never
slow the systems that run the business.

**Misconception to defeat**: That reports should query each app's database directly, or that a
warehouse is just a bigger operational database.

**Cast**: Left, three source cylinders, each describing the same customer its own way: `Shop`
(`cust 17: ON`), `CRM` (`C-17: Ontario`), `Payments` (`customerId 17`), each with its own shopper
boxes further left. Middle, a pipe (ingest and clean). Right, a wider warehouse cylinder with
columnar strips inside and a date axis along its base. Far right, an analyst and a dashboard.

**Opening frame**: The analyst's question "Revenue by province, 5 years?" with three arrows
running straight into the three sources.

**Story**:

1. The query fans out; each source flashes busy and its shoppers slow (small clock icons).
   Answers come back that don't line up: "ON", "Ontario", "17", "C-17". Caption: "Asking every
   app: slow, inconsistent, and it hurts them".
2. The direct arrows fade. On a schedule, rows stream out of each source into the pipe. Caption:
   "Copy the data out".
3. In the pipe, "ON" restyles to "Ontario", the IDs unify, and three strips for customer 17 merge
   into one. Caption: "Clean and integrate once".
4. Strips land in the warehouse and stack along the date axis: yesterday's rows stay, today's add
   on. Caption: "Keep history, modelled for questions".
5. The query now goes only to the warehouse. It splits across four compute nodes that scan slices
   in parallel, and one answer returns in seconds: "Ontario: $4.1M". The source meters stay green.
   Caption: "One question, one consistent answer, sources untouched".

**The moment**: Beat 5 against beat 1: four mismatched fragments ("ON", "Ontario", "17", "C-17")
become one consistent number, and the sources stay calm. Protecting production is
`oltp-vs-olap`'s moment; integrating many sources is this one's.

**Interaction**: Toggle "query sources / query warehouse" with the shoppers' latency meters
visible.

**Ending**: Steady state: sources serving shoppers, a nightly stream into the warehouse, the
dashboard refreshing.

**Variants**: `data-lake`, `data-lakehouse`, `star-schema`, `etl-vs-elt`, `oltp-vs-olap`; Azure
Synapse and Fabric Warehouse, Amazon Redshift, BigQuery.

**Techniques**: token, stream, restyle, contents, meter, toggle, caption.

**Review**: Improved — re-centred the payoff on integration (four mismatched answers become one
consistent number), so it no longer repeats `oltp-vs-olap`'s "the copy protects production"
moment; the cleaning beat and history axis were already right.

### Data lake (`data-lake`)

**The aha**: Land everything raw and cheaply now and decide later how to use it; without a catalog
and owners it turns into a swamp.

**Misconception to defeat**: "A data lake is a cheaper warehouse, ready to query", or "dump it all
in and it will be useful".

**Cast**: Left, mixed sources: log lines (plain strips), JSON events (strips with braces), CSV
exports, images (photo icons), sensor readings. Centre, a wide shallow basin labelled "object
storage" with folders `raw/clicks`, `raw/images`, `raw/sensors`. A volume meter and a cost meter.
Right, a data scientist with a notebook and an analyst.

**Opening frame**: Sources on the left, the empty basin with its folders, cost meter reading
"cheap per TB".

**Story**:

1. Every source pours in as it is, each in its own format; nothing changes at the gate. Caption:
   "Land everything, raw, any format".
2. The volume meter races to petabytes; the cost meter barely moves. Caption: "Object storage:
   cheap at any scale".
3. Months later the data scientist asks a question nobody planned for: "Predict churn from
   clicks". A schema stencil slides over the raw JSON strips in `raw/clicks`, and columns appear
   only under it. Caption: "A question nobody planned for? Structure it when you read it".
4. Fast forward: more teams dump files. Folders multiply (`clicks_final_v2`, `clicks_old`,
   `tmp_ana`), with no owners and duplicate copies, and the water turns murky brown. The analyst
   searches "clicks" and gets five question marks. Caption: "No catalog, no owners: a data swamp".
5. Catalog cards attach to each folder (owner, schema, last updated, "contains PII"); orphaned
   copies are deleted; the water clears. Caption: "A catalog and governance keep it a lake".

**The moment**: Beats 4 and 5: the basin silting up, then clearing as the cards attach.

**Interaction**: A "months without a catalog" dial: drag it forward and watch the swamp form;
toggle the catalog on to clear it.

**Ending**: A clear basin, every folder carded, both consumers reading from it.

**Variants**: `data-warehouse`, `data-lakehouse`, `schema-on-write-vs-read`,
`data-catalog-and-lineage`, `medallion-architecture`; ADLS Gen2, Amazon S3 with Lake Formation,
Cloud Storage with Dataplex.

**Techniques**: stream, contents, meter, restyle, appear, disappear, dial, toggle, caption.

**Review**: Improved — beat 3 now makes the "decide later" half of the aha explicit (an unplanned
question answered from data kept raw); the swamp-and-clear arc was already the right failure.

### Data lakehouse (`data-lakehouse`)

**The aha**: One copy of the data, in open files, serves both BI and data science, instead of
copying the lake into a separate warehouse.

**Misconception to defeat**: That a lakehouse is a lake and a warehouse side by side (the
two-tier setup), or a product rather than an architecture.

**Cast**: Left, sources. Centre bottom, the lake: bundles of vertical-strip files (Parquet).
Right top, a warehouse cylinder. Two consumers on the right, a BI dashboard and a data
scientist's notebook, each showing "Sales: ?". Meters for storage and pipeline cost.

**Opening frame**: The two-tier picture: sources → lake → copy pipeline → warehouse. BI reads the
warehouse; the notebook reads the lake. The two copies of `sales` carry timestamps "lake: 14:00"
and "warehouse: 06:00".

**Story**:

1. A late refund lands in the lake. The notebook shows "$1.30M"; the dashboard still shows
   "$1.32M". Caption: "Two copies drift: two answers".
2. The meters show storage ×2 and a copy pipeline running every few hours. Caption: "And you pay
   to keep copying".
3. The warehouse cylinder dissolves. A thin slab slides onto the lake files, labelled "table
   layer: transaction log · schema · permissions". Caption: "Put warehouse features on the lake
   itself".
4. Both consumers now point through the slab at the same files. A writer commits; both read
   "$1.30M" at once. Caption: "One copy, open format, both workloads".
5. The slab's badges light one by one: a malformed row bounces off ("schema enforced"), a
   half-written file stays invisible until commit ("transactions"), a SQL query skips files using
   their statistics ("fast SQL"), and a lock blocks a user without access ("governance").
   Caption: "Warehouse guarantees, on open files".

**The moment**: Beats 3 to 4: the second copy vanishing and the two numbers snapping to agree.

**Interaction**: Toggle "two-tier / lakehouse", then press "Add a refund": in two-tier the numbers
disagree until the next copy runs; in the lakehouse they agree immediately.

**Ending**: One lake, one slab, two consumers showing the same number.

**Variants**: `open-table-formats`, `data-lake`, `data-warehouse`, `medallion-architecture`,
`separation-of-storage-and-compute`; Azure Databricks, Fabric OneLake, BigLake.

**Techniques**: side by side, toggle, layers, disappear, token, meter, failure, restyle, caption.

**Review**: Keep — opening on the two-tier setup and collapsing it defeats the "lake and warehouse
side by side" misconception directly, and the drifting $1.30M/$1.32M is a concrete cost; building
up from a bare lake instead was weighed and loses that contrast.

### Open table formats (Delta, Iceberg, Hudi) (`open-table-formats`)

**The aha**: A table is files plus a log saying which files make up each version: writers commit
atomically, readers pick a version, and old versions stay readable.

**Misconception to defeat**: "Delta and Iceberg are file formats like Parquet", or "the table is
whatever files are in the folder".

**Cast**: A folder holding Parquet files as small bundles of vertical strips, `f1`, `f2`, `f3`.
Beside it, the log: a vertical stack of commit cards. A reader figure, a writer figure, and a
version slider under the log.

**Opening frame**: The folder of three files and no log. The reader reads "everything in the
folder" and shows a total of "$300".

**Story**:

1. The writer starts writing `f4` and `f5`, which grow in half drawn. The reader lists the folder
   mid-write, reads half of `f4`, and shows "$342" (red flash). Caption: "A folder of files isn't
   a table".
2. The log appears with cards "v1: f1, f2" and "v2: + f3". The reader now reads the log first,
   and a path traces from the newest card to exactly those files. Caption: "The log says which
   files are the table".
3. The writer writes `f4` and `f5` again; they appear ghosted, in no version. The reader still
   sees v2 and "$300". Caption: "New files are invisible until committed".
4. Slowly, the writer drops the card "v3: + f4, f5" onto the stack, and both files turn solid at
   once. Caption: "One commit: all or nothing".
5. "Fix prices": the writer writes `f6` and commits "v4: − f2, + f6". `f2` greys but stays in the
   folder. Caption: "Updates write new files; old ones stay".
6. A second reader asks for the table "AS OF v2", and the path traces `f1`, `f2`, `f3`. Caption:
   "Every version is still readable".

**The moment**: Beat 4: a single card turning two ghost files solid together.

**Interaction**: Scrub the version slider from v1 to v4 and watch which files light. A "vacuum"
button deletes unreferenced files; scrubbing back to v2 then fails, showing what retention buys.

**Ending**: Four cards, six files, the highlight following the slider. Caption: "Still Parquet
files. The table format is the log".

**Variants**: `data-lakehouse`, `columnar-storage`, `point-in-time-restore`,
`schema-compatibility`; Delta Lake (`_delta_log`), Apache Iceberg (metadata and manifests),
Apache Hudi (timeline).

**Techniques**: contents, appear, restyle, path trace, failure, scrub, caption.

**Review**: Improved — the ending caption now defeats the misconception outright (the data files
are still Parquet; the format is the log), and each format's own name for its log is given. The
torn read, ghost files and single-card commit are already the best telling.

### Medallion architecture (bronze, silver, gold) (`medallion-architecture`)

**The aha**: Each layer adds quality and keeps the one before, so you can always rebuild from raw
when the logic changes.

**Misconception to defeat**: That medallion is a data model like a star schema, or that once data
is cleaned the raw copy can be thrown away.

**Cast**: Left, sources. Three bins left to right, tinted bronze, silver and gold. Bronze holds
messy strips (a duplicate, a null, "13/01/2026" next to "2026-01-13"); silver holds tidy strips;
gold holds a few small summary boxes ("revenue by store, by day"). Right, a dashboard.

**Opening frame**: Three empty, labelled bins between the sources and the dashboard. Caption:
"Raw → cleaned → business-ready".

**Story**:

1. Events stream into bronze untouched, duplicate and all. Caption: "Bronze: exactly as it
   arrived".
2. A job reads bronze and writes silver: the duplicate merges, dates line up, IDs conform, and a
   cleaning rule drops rows with a negative amount as "invalid". Bronze's strips stay where they
   are; copies leave, originals remain. Caption: "Silver: cleaned and conformed".
3. A job folds silver strips into gold summary boxes (often a star schema), and the dashboard
   fills. Caption: "Gold: shaped for the business".
4. Finance spots it: those negative rows were refunds, and revenue has been overstated since
   March. Every gold box since March turns red. Caption: "The cleaning rule was wrong".
5. The silver rule is fixed. Silver and gold empty, then strips replay from bronze, refunds and
   all, through the new rule and refill both. Gold turns green. Caption: "Rebuild from raw".
6. Beside it, a ghost pipeline that deleted bronze after cleaning tries the same: its silver never
   held the refunds, and its rebuild arrow reaches an empty bin and flashes red. Caption: "Raw
   gone? What cleaning threw away is gone too".

**The moment**: Beats 5 and 6 side by side: one pipeline recovering the refunds from bronze, the
other with nothing to recover them from.

**Interaction**: Toggle "keep bronze" off, then press "Fix the rule": the rebuild fails.

**Ending**: Three full bins, gold corrected, the dashboard green. Caption: "Layers of quality, not
a data model".

**Variants**: `data-lake`, `data-lakehouse`, `star-schema`, `data-quality-checks`,
`lambda-vs-kappa-architecture`; Azure Databricks and Fabric lakehouses.

**Techniques**: stream, contents, clone, restyle, failure, side by side, toggle, caption.

**Review**: Improved — the logic change moved from gold to silver's cleaning rule (dropping
refunds as "invalid"): a gold-only rule could be rebuilt from silver, so it never proved bronze was
needed. Gold now notes it often holds a star schema, which answers the "medallion is a data model"
confusion.

### Data mesh (`data-mesh`)

**The aha**: It decentralises ownership, not just storage: the team that knows the data publishes
it as a product, instead of one central team becoming the bottleneck.

**Misconception to defeat**: "Data mesh is a technology", or "a lake split into several lakes".

**Cast**: Three domain zones drawn as boundaries: Orders, Payments, Shipping, each with two team
figures and their own operational cylinder. Centre, a central data team box with an inbox.
Right, consumers: a marketing analyst and a finance analyst.

**Opening frame**: Centralised: every domain's data pipes into the central team's lake, and the
consumers' request tickets point at the central inbox, which already holds 40 tickets.

**Story**:

1. Marketing asks "Why did delivery times rise?" The ticket joins the inbox and a timer reads
   "6 weeks". Caption: "One central team: a queue".
2. The central team opens Shipping's data, finds `status = 7`, and has to ask Shipping what it
   means; questions bounce back and forth. Caption: "…that doesn't know what the data means".
3. Shipping renames a field; the central pipeline breaks (red), and Shipping never sees it.
   Caption: "And owners never see the breakage".
4. The central inbox dissolves. On the edge of each domain zone a "data product" box grows: a
   dataset with an owner badge, a documented schema and a promise, "fresh hourly". Caption: "Each
   domain publishes its data as a product".
5. Marketing reads Shipping's product directly and has an answer in minutes. Caption: "Get it from
   the team that knows it".
6. A shared platform slab rises under all three zones (storage, catalog, access), and a thin ring
   of common rules circles them (shared customer IDs, privacy). Caption: "Self-serve platform,
   federated governance".

**The moment**: Beat 4: the bottleneck queue disappearing as products sprout at each domain's
edge.

**Interaction**: Toggle central / mesh while a stream of requests arrives; watch the wait timer
and who handles each request.

**Ending**: Three domains with their products, consumers reading across them, the one shared
platform beneath. Caption: "Ownership moved. The storage didn't have to".

**Variants**: `data-lake`, `data-catalog-and-lineage`, `data-quality-checks`; Fabric domains,
Dataplex, Lake Formation data sharing.

**Techniques**: boundary, contents, timer, exchange, failure, appear, disappear, layers, toggle,
caption.

**Review**: Improved — the ending caption now lands "ownership, not storage" (the platform under
all three domains is shared), which is the aha and answers "a lake split into several lakes". The
six beats map one to one onto the bottleneck and the four principles, so none was cut.

### Separation of storage and compute (`separation-of-storage-and-compute`)

**The aha**: When data lives in shared storage, compute can exist only while queries run, scale
on its own, and be thrown away.

**Misconception to defeat**: That data lives inside the servers that query it, so more data means
more servers and idle servers still cost money. (Also: "it's just serverless".)

**Cast**: Three nodes, each a CPU box stacked on a disk cylinder holding a third of the data. A
day clock. A cost chart across the top, drawn through the day.

**Opening frame**: Three coupled nodes at 03:00, nobody querying, the cost line already rising.

**Story**:

1. Night: no queries, the CPUs idle, the cost line climbs anyway. Data grows; to hold it, a whole
   fourth node (CPU included) appears and the data reshuffles across all four. Caption: "Coupled:
   pay for compute just to hold data".
2. The disks slide down and merge into one wide shared storage shelf of files; the CPUs float up
   as a detached cluster. Caption: "Data moves to shared storage".
3. 09:00: queries arrive, a cluster appears, reads files over the network and answers. 19:00: it
   vanishes. A second cost line drops overnight to a thin, flat floor: storage only. Caption:
   "Compute only while queries run".
4. Month-end: three more clusters appear, all reading the same files, then vanish. Caption: "Scale
   compute without moving data".
5. A SQL engine, a Spark job and an ML notebook attach to the same shelf. Caption: "Many engines,
   one copy".
6. A cluster fails (red flash, grey). It's discarded and another appears; the shelf is untouched.
   Caption: "Clusters are disposable".

**The moment**: Beat 3: two cost lines over the same day, one flat and high, the other down on
the storage floor overnight with humps in the day.

**Interaction**: Dial the day's query load (quiet, normal, month-end) and compare both cost
charts.

**Ending**: The day loops: the storage shelf constant, compute clusters blinking in and out with
the clock.

**Variants**: `data-lakehouse`, `data-warehouse`, `serverless-computing`, `cost-of-idle`;
Synapse serverless SQL and Fabric, Redshift RA3 and Spectrum, BigQuery slots, Snowflake virtual
warehouses.

**Techniques**: move, appear, disappear, chart, timer, failure, side by side, dial, caption.

**Review**: Improved — the decoupled cost line no longer "hugs zero" overnight: storage is always
billed, so it rests on a thin storage floor. The coupled-node opening and the two cost lines were
already the strongest framing.

## Analytical storage and dimensional modelling

### Columnar storage and file formats (`columnar-storage`)

**The aha**: Analytics reads a few columns of many rows; storing each column together means
reading only those columns, compressing them hard and skipping blocks you don't need.

**Misconception to defeat**: That file layout doesn't affect query speed, or that "columnar" means
a wide-column database like Cassandra.

**Cast**: Top, a small table of 8 rows × 6 columns (`id, date, customer, country, product,
amount`), each column its own colour. Below, two disk tracks: a row file (each row a horizontal
strip of six coloured cells, laid end to end) and a column file (six vertical strips, one per
column). A read head and a "bytes read" meter on each.

**Opening frame**: The table, the two tracks, and the query
`SELECT sum(amount) WHERE country = 'CA'`.

**Story**:

1. Row file: `amount` and `country` are interleaved in every row, so the head sweeps the whole
   track and every cell lights. Meter "100%". Caption: "Row file: read every column to use two".
2. Column file, slowed: the head reads only the `country` and `amount` strips; the rest stay dark.
   Meter "33%". Caption: "Column file: read only the columns asked for".
3. Zoom into `country`: `CA CA CA CA US US CA CA` collapses into "CA×4 US×2 CA×2" and the strip
   shrinks. Meter "8%". Caption: "Similar values side by side compress well".
4. Zoom out to a year of orders, sorted by date. The column file splits into blocks (row groups),
   each tagged with its min/max (`date: Jan 1–Jan 31`, `Feb 1–Feb 28`, …). Add `AND date in
March`: blocks whose range misses March grey out unread. Meter "3%". Caption: "Min/max
   statistics skip whole blocks".
5. A fair contrast: "Fetch order 1041, all fields". The row file reads one strip; the column file
   touches all six. Caption: "One whole row? Row files win".

**The moment**: Beat 2: both heads moving in step, one lighting everything and the other two
strips, the meters pulling apart.

**Interaction**: Tick which columns the SELECT uses and pick a filter; both meters update. A
"shuffle rows" button unsorts the data: every block's range widens to Jan–Dec and skipping stops,
showing that statistics only help when similar values sit together.

**Ending**: The two tracks with their final meters, "100%" against "3%".

**Variants**: `oltp-vs-olap`, `partitioned-tables`, `open-table-formats`, `wide-column-store`;
Parquet, ORC, SQL Server columnstore indexes.

**Techniques**: side by side, contents, spotlight, meter, zoom, restyle, choice, caption.

**Review**: Improved — beat 4 zooms out to a year of date-sorted rows first (an 8-row table can't
fill monthly blocks), and a "shuffle rows" interaction shows min/max skipping depends on the data
being sorted or clustered. The fair contrast in beat 5 stays: it keeps the plan honest.

### Partitioned tables and partition pruning (`partitioned-tables`)

**The aha**: Partitioning by a column you filter on lets a query skip most of the data, but
slicing too fine creates swarms of tiny files that are slower than not partitioning at all.

**Misconception to defeat**: That this is sharding (spreading writes across machines), or that
more partitions are always better.

**Cast**: A table `sales/` drawn as a cabinet, its files as small vertical-strip bundles. A query
card, a "files opened" meter and a "query time" meter.

**Opening frame**: One big drawer holding a year of files jumbled together. Query:
`WHERE date = '2026-10-01'`.

**Story**:

1. The engine opens every file in the drawer and they all light. Meters: "365 days scanned ·
   60 s". Caption: "No partitions: scan everything to find one day".
2. The files fly into 365 drawers labelled `date=2026-01-01` onward. Caption: "Partition by date:
   one folder per day".
3. Same query: one drawer opens, the other 364 dim. Meters: "1 day · 0.4 s". Caption: "Filter on
   the partition column and the rest is skipped".
4. Query `WHERE customer = 'Ana'`: every drawer opens again. Caption: "It only helps filters on the
   partition column".
5. Re-partition by date, hour and customer: the drawers explode into thousands, each holding one
   tiny file. The date query now opens 40,000 files, and the time meter climbs past the
   unpartitioned 60 s, mostly spent opening files. Caption: "Too fine: thousands of tiny files,
   slower than none".
6. Back to daily partitions; inside each, a compaction step merges the small files into a few
   large ones. Caption: "Partition coarsely, compact small files".

**The moment**: Beat 3 (one drawer lit, 364 dark) against beat 5 (the explosion of tiny files).

**Interaction**: Dial the granularity (none, month, day, hour, hour + customer) and watch query
time trace a U-shaped curve.

**Ending**: The U-shaped chart with "day" at the bottom of the curve.

**Variants**: `database-sharding`, `columnar-storage`, `range-vs-hash-partitioning`,
`open-table-formats`; BigQuery partitioning and clustering, Hive-style lake folders, Delta
OPTIMIZE.

**Techniques**: move, contents, spotlight, meter, chart, dial, caption.

**Review**: Keep — the drawers make pruning instant to read, beat 4 limits it honestly to the
partition column, and the U-shaped granularity dial is the right interaction for "too fine is
slower than none". An index-based framing was weighed; it hides the small-files failure.

### Star schema (facts and dimensions) (`star-schema`)

**The aha**: Put the measurable events in one central fact table and their descriptions around
it; every question becomes "filter the dimensions, sum the facts".

**Misconception to defeat**: That an analytical model should be normalized like the OLTP schema,
one table per entity with many joins.

**Cast**: First, a dozen small normalized tables (`order`, `order_line`, `product`,
`subcategory`, `category`, `store`, `city`, `region`, `customer`, `segment`, …) linked in a
tangle. Later, a
central fact table `Sales` (rows of keys and numbers: `date_key, product_key, store_key,
customer_key, qty, amount`) and four dimensions: `Date`, `Product`, `Store`, `Customer`. A join
counter.

**Opening frame**: The tangle and the question "Revenue by category and region, Q3?"

**Story**:

1. A path traces the joins needed through the tangle, `order_line → order → store → city →
region` and `order_line → product → subcategory → category`, while the counter ticks to 7.
   Caption: "Normalized for writing: 7 joins for one question".
2. The tables rearrange: order lines slide to the centre and become `Sales`; subcategory and
   category fold into `Product`; city and region fold into `Store`. The star forms. Caption:
   "Facts in the middle, descriptions around them".
3. A counter on `Sales` runs to 500M narrow rows; `Store` shows 300 wide ones. Caption: "Facts:
   many narrow rows of numbers. Dimensions: few wide rows of words".
4. The question again: matching rows light in `Product` (category = Tents), `Store` (region =
   West) and `Date` (Q3); their keys flow inward; the matching fact rows light and their amounts
   sum. The join counter reads 3, each one hop. Caption: "Filter the dimensions, sum the facts".
5. A new question, "by customer segment and month": different dimensions light, the same shape
   answers. Caption: "Slice by any dimension".

**The moment**: Beat 2, the tangle collapsing into the star, paid off in beat 4 when the join
counter reads 3 instead of 7.

**Interaction**: Pick group-by attributes from any dimension; see which joins light and the
result table.

**Ending**: The star with one query path lit. Caption: "Denormalized on purpose, for reading".

**Variants**: `normalization-vs-denormalization`, `slowly-changing-dimensions`,
`data-warehouse`, `medallion-architecture`; snowflake schema as a follow-on; Power BI semantic
models.

**Techniques**: move, path trace, spotlight, contents, meter, choice, caption.

**Review**: Improved — the join count is now checkable: the path names its seven hops and the
tables that fold into `Product` match them (the arbitrary "8" had no path behind it). The
tangle-to-star collapse is the right moment.

### Slowly changing dimensions (SCD) (`slowly-changing-dimensions`)

**The aha**: Whether you keep a dimension's history decides whether last year's sales still report
under last year's region.

**Misconception to defeat**: That a changed attribute is just an update to overwrite, or that this
is the same thing as change data capture.

**Cast**: A `Customer` dimension with the row `key 1 · C42 · Ana · region: East`. A `Sales` fact
table with `2025 · $500 → key 1`. A report card "2025 sales by region". The whole scene is shown
twice, side by side: left "Type 1", right "Type 2".

**Opening frame**: Both sides identical, both reports reading "2025: East $500".

**Story**:

1. A token arrives on both sides: "Jan 2026: Ana moves to West". Caption: "A dimension attribute
   changes".
2. Left: the row's region overwrites to "West". Right: the old row gains "valid to 2025-12-31 ·
   current: no", and a new row appears: `key 2 · C42 · Ana · West · valid from 2026-01-01`.
   Caption: "Type 1 overwrites. Type 2 adds a row".
3. A 2026 sale of $300 arrives. Left: it links to key 1. Right: it links to key 2, while the 2025
   sale still points at key 1. Caption: "New facts point at the current version".
4. Slowly, re-run "2025 sales by region". Left: East $0, West $500, the $500 sliding across with a
   red "history changed" tag. Right: East $500, unchanged. Caption: "Type 1 rewrites history. Type
   2 keeps it".
5. One more change: Ana's name was misspelled "Aan". Both sides overwrite it, and that's right.
   Caption: "A correction: overwrite. A real change: keep history".

**The moment**: Beat 4: the same report giving two answers, the $500 jumping regions on the left.

**Interaction**: Choose type 1 or type 2 per attribute (region, name), press "Move Ana" again, and
re-run the report for 2025 or 2026.

**Ending**: Both reports side by side, the right one annotated "as it was".

**Variants**: `star-schema`, `change-data-capture` (CDC delivers the change; SCD decides whether
the old value is kept), `open-table-formats`; SCD type 3 and type 6 as follow-ons.

**Techniques**: side by side, contents, appear, restyle, path trace, move, toggle, caption.

**Review**: Improved — the beat 4 caption is shorter, and the CDC confusion is answered in one
line (CDC delivers the change, SCD decides what to keep). The type 1 / type 2 split-screen with the
$500 jumping regions is the right moment, and beat 5's correction case keeps it from becoming
"always type 2".

## Data movement, processing and quality

### ETL vs ELT (`etl-vs-elt`)

**The aha**: ETL and ELT are the same three steps in a different order: once cloud warehouses made
compute cheap and elastic, the transform moved to after the load, and the raw data stays there to
transform again.

**Misconception to defeat**: That ETL and ELT are two different kinds of pipeline, or that ELT
made ETL obsolete.

**Cast**: Left, a source cylinder `orders`. A pipe to the right threaded with three beads, E, T
and L, and a gears icon (the transform) on a separate server beside the T bead. Right, a warehouse
cylinder with a compute label; later it holds a `raw` shelf and a `modelled` shelf.

**Opening frame**: Source → E → T → L → warehouse, the warehouse labelled "2005: fixed, expensive
compute". Caption: "Extract, transform, load. In which order?"

**Story**:

1. ETL: rows leave the source, pass through the gears on their own server (fields renamed, types
   cast, bad rows dropped), and only the cleaned result lands in the warehouse. Caption: "ETL:
   transform on the way in, load only the result".
2. The warehouse restyles into a cloud warehouse: its label flips to "elastic, pay per use" and it
   grows extra nodes. Caption: "Cloud warehouses made compute cheap and elastic".
3. Slowly, the T bead and the gears slide along the pipe, past L, into the warehouse. Rows now
   land untouched on the `raw` shelf, and the gears run as SQL inside, writing the `modelled`
   shelf beside it. Caption: "ELT: load raw, transform inside with SQL".
4. A new rule arrives: "revenue includes tax". ETL (ghosted replay): fix the gears and re-extract
   from the source, which keeps only 90 days, so older months can't be redone. ELT: re-run the SQL
   over five years of raw rows, in minutes. Caption: "Raw kept: transform again any time".
5. A fair note: the `raw` shelf holds every field, customer emails and phone numbers included,
   so it needs locking down; ETL could have stripped them before they landed. Caption:
   "Trade-off: raw data, sensitive fields and all, lives in the warehouse".

**The moment**: Beat 3: the T bead sliding past L, the same three steps in a new order, paid off
in beat 4 when the rule change replays from raw instead of going back to the source.

**Interaction**: Drag the T bead before or after L, then press "change the rule": before L the
fix needs the source (and loses what it no longer keeps); after L it re-runs inside.

**Ending**: Both orders side by side: ETL's clean-only warehouse, ELT's raw-plus-modelled one.
Caption: "Where the T sits decides what you can redo".

**Variants**: `data-warehouse`, `medallion-architecture` (bronze is ELT's raw shelf),
`data-lakehouse`, `incremental-load`, `data-pipeline-orchestration`; dbt, Azure Data Factory,
AWS Glue.

**Techniques**: move, stream, contents, restyle, side by side, choice, caption.

**Review**: Rethought — the old version listed two pipelines side by side and never showed why the
order changed; its cost beat also claimed ELT runs on "compute already paid for", which is wrong
for per-query warehouses. Now the warehouse's compute changes first and the T bead slides past L
because of it (the misconception defeated in one motion), the rule change is the payoff, and a
fair trade-off beat says why ETL survives (sensitive fields).

### Batch vs stream processing (`batch-vs-stream-processing`)

**The aha**: Batch waits for a bounded pile of data and answers once, completely but late;
streaming answers continuously as events arrive, fresh but sometimes needing correction.

**Misconception to defeat**: That streaming is just batch made faster, with no trade-off. Its
freshness is paid for with answers that can change and a job that never finishes.

**Cast**: Left, an event source emitting order tokens, each stamped with when it happened. Two
lanes: top "Batch", where tokens pile into an hourly box with a clock; bottom "Stream", a pipe
through a standing counter. Right of each lane, a bar chart "orders per 10 minutes",
10:00–11:00.

**Opening frame**: Clock at 10:00, both lanes empty, both charts blank.

**Story**:

1. Orders arrive. Batch: they pile into the hour's box, uncounted, and its chart stays blank.
   Stream: each token bumps the current bar the instant it passes. Caption: "Stream: answers as
   events arrive".
2. At 10:45 an order placed at 10:22 arrives late (the phone was offline). Stream: the 10:20 bar,
   already shown, ticks up with a "corrected" flag. Batch: the token just joins the pile. Caption:
   "Answer early, and late data means corrections".
3. 11:00: the box seals, a job sweeps it, and all six bars appear at once, matching the stream's
   corrected ones. The job ends and the lane goes idle. Caption: "Batch: a bounded pile, one
   complete answer, late".
4. The stream lane keeps flowing into 11:00–12:00; its job never ends. Caption: "Bounded: the job
   finishes. Unbounded: it never does".

**The moment**: Beat 3: batch's six bars appearing all at once at 11:00, beside the stream's bars
that have stood all hour, one carrying its correction flag.

**Interaction**: Dial the batch interval (daily, hourly, 5 minutes) and an order's lateness.
Shorter batches get fresher but each still waits for its box to close; an order later than the
interval misses its run and needs a rerun, while the stream simply corrects.

**Ending**: Two identical charts, reached two ways: one built up through the hour, one appearing
at the end. Caption: "Latency against completeness".

**Variants**: `stream-windowing`, `watermarks-late-data`, `lambda-vs-kappa-architecture`,
`change-data-capture`; Messaging's `stream-processing` (the standing query) and
`event-time-vs-processing-time`.

**Techniques**: token, lanes, contents, chart, timer, side by side, dial, caption.

**Review**: Improved — the old beat 5 ("batch recomputes, stream corrects" after a bug fix) was
muddled, and a late event could never visibly correct an hourly running total; the dashboard is
now bars per 10 minutes, so the late order bumps a bar already shown. Added the bounded/unbounded
distinction (the batch job ends, the stream job never does) and cut to four beats.

### Change data capture (CDC) (`change-data-capture`)

**The aha**: Reading the database's own change log streams every insert, update and delete in
commit order, so downstream systems stay in sync without dual writes or missed deletes.

**Misconception to defeat**: That CDC is the app writing twice (once to the database, once to the
pipeline), or the same as polling for new rows.

**Cast**: A source cylinder `orders` with a transaction log strip running beneath it (commit cards
in order, each carrying a position number). A CDC reader tapping the log, not the table. A
downstream search index and a downstream warehouse. Beside it, a "dual write" app writing to both
the cylinder and the index directly.

**Opening frame**: The cylinder, its log, and the CDC reader attached to the log, idle. Caption:
"Tap the log, not the table".

**Story**:

1. An insert, an update and a delete happen to `orders`; each writes a commit card to the log in
   order (the delete is a card too). Caption: "Every change already lands in the log".
2. The CDC reader streams those three cards onward, in the same order, to the index and the
   warehouse. Both update to match, the delete included. Caption: "Stream the log, in commit order".
3. Contrast: the dual-write app's insert reaches the cylinder but its matching write to the index
   times out (red flash); the two now disagree, and nothing records that. Caption: "Dual writes:
   one can fail and they drift".
4. Contrast again: a "poll for new rows" reader checks `updated_at`; the delete leaves no row to
   find, so the index keeps a ghost order the source no longer has. Caption: "Polling misses
   deletes".
5. Back on the CDC path: the reader crashes mid-stream, restarts, and resumes from its last saved
   log position. The two cards after that position are sent again and the index applies them by
   key, with no visible change. Caption: "Resumes from its saved position. A repeat is harmless".

**The moment**: Beats 3 and 4 against beat 2: the same three changes, reliably ordered through the
log, versus drift or a missed delete on the other two paths.

**Interaction**: Choose CDC, dual write or polling, then fire an insert/update/delete burst with a
dropped network call; watch which downstream copies end up correct.

**Ending**: The log strip with the reader's position marker at the latest card, index and
warehouse both matching the source. A small note: "Log kept long enough? A reader gone too long
loses its place".

**Variants**: `incremental-load`, `data-pipeline-orchestration`, `slowly-changing-dimensions`,
`database-migration-cutover`; Debezium (reads the Postgres WAL or MySQL binlog), Azure SQL/Cosmos
DB change feed, AWS DMS, Datastream.

**Techniques**: contents, token, stream, path trace, failure, side by side, caption.

**Review**: Improved — beat 5 claimed the reader "re-sends nothing twice", but log readers are
at-least-once (a crash replays from the last saved position), so it now shows the harmless repeat
applied by key. Deletes are now visible commit cards, and the log-retention caveat is added.

### Full vs incremental loads (`incremental-load`)

**The aha**: Copying only what changed since a stored high-water mark is far cheaper than copying
everything, but it silently misses deletes and late changes unless the source tracks them.

**Misconception to defeat**: That incremental load is the same thing as change data capture (it
reads the table, not a log), or that a timestamp column always catches every change.

**Cast**: A source table `orders` with an `updated_at` column. A high-water mark flag sitting at a
timestamp. A target cylinder. A clock running day by day.

**Opening frame**: Source and target both holding the same 1,000 rows; the high-water mark flag
sits at "yesterday 23:59".

**Story**:

1. A full load: every row streams across regardless of change, meter reading "rows copied: 1,000 ·
   time: 40 s". Caption: "Full: copy it all, every run".
2. Reset to incremental: only rows with `updated_at` after the flag stream across and are upserted
   by key; meter reads "rows copied: 12 · time: 1 s". Only after the load succeeds does the flag
   advance. Caption: "Incremental: copy what changed, then move the mark".
3. A row is deleted from the source outright, with no `updated_at` recorded anywhere. Next run,
   nothing about it crosses; the target still holds the now-nonexistent row. Caption: "A delete has
   no 'updated_at': it's missed".
4. A row is corrected by a backend job that doesn't touch `updated_at`, and another row's
   transaction commits late, stamped before the mark. Neither crosses. Caption: "Silent and late
   changes are missed too".
5. Two fixes run: each load re-reads a short overlap before the mark (the late row now crosses,
   upserted, not duplicated), and a periodic full load reconciles the rest and removes the ghost.
   Caption: "Overlap the mark; sweep with an occasional full load".

**The moment**: Beat 3: the deleted row sitting untouched in the target while everything else
moves on, until the full-load sweep in beat 5 finds it.

**Interaction**: Toggle full / incremental, then trigger a delete, a silent update or a late
commit and watch whether the target catches up; dial the overlap width.

**Ending**: The target matching the source after the periodic full load, the high-water mark at
"now".

**Variants**: `change-data-capture` (reads the log, so it does see deletes), `data-pipeline-orchestration`,
`etl-vs-elt`; soft-delete flags in the source as another fix.

**Techniques**: stream, meter, token, failure, toggle, timer, caption.

**Review**: Improved — added the late-commit gap (a row stamped before the mark but committed after
it) with the standard fix of re-reading an overlap and upserting by key, and made the mark advance
only after a successful load. The delete and silent-update misses stay as the core failure.

### Data pipeline orchestration (`data-pipeline-orchestration`)

**The aha**: The orchestrator owns order, retries and reruns across a dependency graph; because of
that, each step must be idempotent, or a retry quietly loads the same data twice.

**Misconception to defeat**: That this is just cron with more steps, or that retrying a failed step
is always safe.

**Cast**: A DAG of boxes: "extract orders" and "extract customers" side by side, both feeding
"join" → "load warehouse" → "refresh dashboard"; arrows show dependency, not just sequence. A run
calendar below, one row per day (each run belongs to a date). A retry counter on each box.

**Opening frame**: The DAG, all boxes grey, today's calendar row empty. Caption: "Steps, and the
order they must run in".

**Story**:

1. The scheduler fires at 02:00 for "today"; both extracts light together, and "join" lights only
   when both finish. Caption: "Not a list: a graph of dependencies".
2. "load warehouse" fails halfway (red flash); "refresh dashboard" never starts, and the extracts
   upstream are untouched. Caption: "A failure stops only what depends on it".
3. The orchestrator retries "load warehouse" automatically; it reruns from the top and the rows it
   had already written are inserted again, so the day's total reads double. Caption: "A naive retry
   re-does work it already did".
4. Rewind: the same step rewritten to replace its date's partition (delete that day, then insert,
   or merge by key). The retry now lands on the exact same result. Caption: "Idempotent: run it
   twice, same result".
5. A backfill is requested for all of last March under a fixed rule. A bar sweeps the calendar, one
   run per date, each rewriting only its own day. Caption: "Idempotent per date: backfills are
   safe".

**The moment**: Beat 3 against beat 4: the same retry doubling totals one way, landing exactly the
same the other way.

**Interaction**: Fail a chosen step, retry it, and see whether downstream totals double; toggle
"idempotent" on the step to fix it.

**Ending**: The calendar fully green, a backfill bar having swept across March without a single
double-count.

**Variants**: `etl-vs-elt`, `incremental-load`, `data-quality-checks`; Airflow, Azure Data Factory,
Dataflow.

**Techniques**: contents, path trace, failure, restyle, meter, scrub, caption.

**Review**: Improved — the DAG now fans in (two extracts feed the join), as beat 1 already said it
should; the old retry "inserted half the rows twice" yet doubled the total, which doesn't add up,
so a retry now re-inserts what had already landed. Runs are tied to a date so the backfill beat has
something to sweep.

### MapReduce (`mapreduce`)

**The aha**: Split the data across many machines, run the same small function on each piece in
parallel, group the results by key, then combine each group. A failed piece just reruns.

**Misconception to defeat**: That MapReduce is a specific tool rather than a model other engines
(including Spark) still echo, or that "map" and "reduce" are an arbitrary pair of steps rather
than "do this everywhere" then "combine by key".

**Cast**: A huge log file split into blocks across four worker boxes. Each worker runs the same
small "map" gear, emitting key-value cards (`word: "cloud", count: 1`) that pile up on its own
local disk. A shuffle stage regroups cards by key across the network. Four "reduce" gears sum each
group.

**Opening frame**: The split log, four idle workers, the question "count every word".

**Story**:

1. Each worker's map gear reads only its own block (the data is already there, so nothing is
   fetched) and emits one card per word, in parallel. Caption: "Map: the same small function, run
   where the data is".
2. Cards for the same word, scattered across all four workers, are sorted by key and stream across
   the network to land together. Caption: "Shuffle: group by key".
3. A worker dies mid-job (red flash, grey), and with it the cards on its disk. The scheduler just
   reruns that block's map on another worker, since map reads its block and touches no shared
   state. Caption: "A failed piece: just redo it".
4. Each reduce gear sums the cards piled in front of it ("cloud: 1+1+1=3") and writes one final
   count per word. It started only once every map had finished. Caption: "Reduce: combine each
   group".
5. Zoom out: the same shape solves a different question ("total sales per store") with map
   emitting `store: amount` and reduce summing. Caption: "Any 'group then combine' question fits".

**The moment**: Beat 3: the dead worker's block quietly rerunning elsewhere while the rest of the
job keeps moving, unaffected.

**Interaction**: Kill a random worker mid-run and watch the job finish anyway, just slower.

**Ending**: The final counts, one per word, assembled from four workers that never needed to
coordinate except at the shuffle.

**Variants**: `spark-execution-model`, `separation-of-storage-and-compute`; Hadoop as the original
implementation.

**Techniques**: split / merge, contents, token, stream, failure, spotlight, caption.

**Review**: Improved — beat 1 now says why map is cheap (it runs where its block already lives), and
beat 3 notes that the dead worker's map output was on its local disk, which is why the block is
redone and not fetched; reduce is shown starting only after the maps finish. Spark contrasts come
in `spark-execution-model`.

### Distributed dataflow (Spark) execution (`spark-execution-model`)

**The aha**: The engine builds a lazy graph of transformations, and shuffling data across the
network is what's expensive; avoiding shuffles (broadcasting a small table, partitioning well) is
most of what makes a job fast or slow.

**Misconception to defeat**: That every line of Spark code runs immediately, in order, like a
script; or that MapReduce and Spark are the same thing with a different name.

**Cast**: A chain of transformation boxes (`read`, `filter`, `join`, `aggregate`, `write`) drawn as
a graph, initially unlit ("lazy"). A huge `orders` table split into partitions across four
executors, and a tiny `countries` lookup table. A network icon between executors.

**Opening frame**: The graph of boxes, none running yet. Caption: "Nothing has happened: just a
plan".

**Story**:

1. `write` is called; only now does the graph light up, and the engine works out what's needed.
   Caption: "Transformations are lazy until an action forces them".
2. `read` and `filter` run together in one pass over each partition, with no data moving between
   executors. The graph splits at the `join`: before it "stage 1", after it "stage 2", exactly
   where data must move. Caption: "A shuffle boundary makes a new stage".
3. Joining `orders`' spread-out partitions to `countries` by key means every executor sends and
   receives pieces over the network, written to disk on the way; the network icon lights busy and
   a time meter climbs. Caption: "A shuffle: expensive, network and disk".
4. Replay the join, broadcasting the whole tiny `countries` table to every executor instead; each
   joins locally, no data moves for the join, the stage boundary disappears, and the meter stays
   low. Caption: "Broadcast a small table: no shuffle".
5. A badly chosen key sends 90% of `orders` to one executor (one country dominates), which chugs
   alone while the other three sit idle. Caption: "Skewed partitions: one executor does the work
   of four".

**The moment**: Beat 3 against beat 4: the same join, the network icon lit versus dark, the time
meters far apart.

**Interaction**: Toggle "shuffle join / broadcast join" and watch the network meter and runtime
change; dial the partition skew and watch one executor's bar grow.

**Ending**: The graph, now fully lit as one DAG run in a single job, not a chain of separate jobs
each writing its output to disk; two stages and the shuffle boundary marked between them. Caption:
"One plan, the shuffle is the cost".

**Variants**: `mapreduce`, `separation-of-storage-and-compute`, `partitioned-tables`; newer Spark
versions can pick a broadcast and split skewed partitions on their own (adaptive query execution).

**Techniques**: contents, path trace, stream, meter, split / merge, toggle, dial, caption.

**Review**: Improved — beat 2 now shows narrow steps (`read`, `filter`) running together in one
stage, so the stage boundary is clearly "where data must move", and a broadcast join has no such
boundary. The ending now answers "same as MapReduce": one DAG, not a chain of jobs that each write to
disk. Added the adaptive-engine note.

### Stream windowing (`stream-windowing`)

**The aha**: An infinite stream can't be totalled all at once, so it's totalled per window; which
events land in the same window depends entirely on the window type chosen.

**Misconception to defeat**: That "windowing" just means "every five minutes", or that all window
types group the same events together.

**Cast**: A continuous stream of event strips flowing along a time axis. Three window shapes drawn
beneath it in turn: tumbling (fixed boxes, edge to edge), hopping/sliding (overlapping boxes), and
session (boxes sized by gaps in activity). A running total meter per window.

**Opening frame**: The bare stream, no windows drawn yet. Caption: "Total events, grouped how?"

**Story**:

1. Tumbling, 1-minute boxes snap down edge to edge; each event falls into exactly one box, totalled
   once it closes. Caption: "Tumbling: fixed, no overlap, each event counted once".
2. Hopping, 1-minute boxes every 20 seconds: the same events now fall into three overlapping boxes
   at once. Caption: "Hopping: overlapping, smoother, events counted more than once".
3. A burst of clicks arrives close together, then nothing, then another burst. Session windows
   open with the first click of each burst and close only after a gap passes. Caption: "Session:
   closed by a gap, not the clock".
4. The same burst run through tumbling windows gets sliced awkwardly across two fixed boxes,
   undercounting each one. Caption: "A fixed window can slice a burst in two".

**The moment**: Beat 4 against beat 3: the same burst, split awkwardly by the clock versus captured
whole by the gap-based session window.

**Interaction**: Choose a window type and width, feed in the same burst pattern, and watch where
the boundaries fall.

**Ending**: All three window types drawn over the same stream, each giving a different total for
the same events. Caption: "Same stream, different question".

**Variants**: `batch-vs-stream-processing`, `watermarks-late-data`.

**Techniques**: stream, contents, meter, dial, side by side, caption.

**Review**: Merged — owned by Messaging (`messaging.part1.md`, `stream-windowing`). Their plan should
borrow beat 4 here (the same click burst sliced across two tumbling boxes, then captured whole by a
session window) as its second moment, since it shows why session exists; and the per-window running
total meter. Keep their "one click inside three windows" moment and their rate-limiting contrast.
Terminology to align: "sliding" in some engines is "hopping" (fixed size, smaller hop).

### Event time, watermarks and late data (`watermarks-late-data`)

**The aha**: Events arrive late and out of order, so the engine can't simply know a window is
"done"; a watermark is its running guess ("newest event time seen, minus how late I'll tolerate")
and it decides when a window closes and what happens to stragglers.

**Misconception to defeat**: That processing time (when the system sees an event) and event time
(when it happened) are the same thing, or that late events are simply dropped.

**Cast**: Two time axes stacked: top "event time", bottom "processing time". Event strips travel
diagonally between them, some arriving out of order. A watermark line on the event-time axis,
labelled with its rule "newest event time − 2 min". A window box `12:00–12:05` waiting to close.

**Opening frame**: Both axes aligned at 12:00, watermark at 12:00, the window open. Caption: "Two
clocks: when it happened, when it arrived".

**Story**:

1. Events stamped 12:01, 12:03 arrive in order and land in the window; the watermark trails the
   newest by two minutes. Caption: "Usually, order matches arrival".
2. An event stamped 12:02 arrives after the 12:03 one, out of order. It still slots into the
   `12:00–12:05` window, keyed on event time, since the watermark hasn't passed 12:05. Caption:
   "Event time, not arrival time, decides the window".
3. An event stamped 12:07 arrives; the watermark moves to 12:05, the window closes and emits its
   total. Caption: "The watermark passes the window's end: close".
4. A straggler stamped 12:04 arrives after that. Two badges appear as options: "drop it" (greyed
   ghost; the usual default) or "update the total, flagged late" (if the window was kept around for
   late data). Caption: "Too late for the guess: dropped, or corrected".
5. Dial the lateness allowance from 2 to 5 minutes: the same straggler now arrives before the
   window closes and is counted cleanly, but every window closes three minutes later. Caption:
   "Wait longer: fewer corrections, slower answers".

**The moment**: Beat 4: the straggler arriving just after the door shut, forcing an explicit choice
the viewer sees made.

**Interaction**: Dial the watermark's allowed lateness and the straggler's delay; watch whether it
makes the window or misses it, and how long results take to appear.

**Ending**: A settled window with its late-arrival badge, the watermark line still moving onward.

**Variants**: `stream-windowing`, `batch-vs-stream-processing`, `lambda-vs-kappa-architecture`;
Messaging's `event-time-vs-processing-time` and `watermarks` (Kafka's high-water mark is a log
position, a different thing).

**Techniques**: token, timer, path trace, choice, dial, caption.

**Review**: Improved — the watermark is now derived from event times (newest seen minus a tolerance)
and not from the processing clock, which the old beat 2 contradicted: an event arriving at 12:07
could not still be "in time" while the next beat's watermark first passed 12:05. Beats now follow
one consistent run; "dropped or corrected" is shown as a choice, not an assumption.

### Lambda vs kappa architecture (`lambda-vs-kappa-architecture`)

**The aha**: Lambda keeps a batch layer for accurate results and a speed layer for fresh ones,
which means writing the same logic twice; kappa removes the duplicate by treating batch as a
replay of the same stream.

**Misconception to defeat**: That lambda and kappa are about having both batch and streaming tools
installed, or that kappa means "no batch at all".

**Cast**: A log of raw events, retained with a long history. Lambda side: the log feeds two
separate paths, "batch layer" (exact, slow) and "speed layer" (fast, covers only the recent gap),
each with its own copy of the aggregation logic, merging into one served view. Kappa side: the log
feeds one streaming path whose logic is the only copy, with a "replay from offset 0" lever.

**Opening frame**: Both sides fed from the same retained log. Caption: "Same source. Two ways to
compute from it".

**Story**:

1. Lambda: events stream through the speed layer and a dashboard number updates within seconds,
   marked "recent, may be approximate". Caption: "Speed layer: fast and fresh".
2. Hours later the batch layer finishes its sweep over the same events; the served view takes its
   exact total for that period and drops the speed layer's number. Caption: "Batch layer: slow,
   exact, takes over".
3. The aggregation rule changes ("exclude test accounts"). On the lambda side, the fix must be
   written and tested twice, once per layer; a mismatch appears when only the speed layer gets
   patched first. Caption: "Two copies of the logic: can drift apart".
4. Kappa side: the rule change is written once. A second copy of the job starts at offset 0 of the
   retained log, writing a new output table beside the old; when it has caught up to now, the
   dashboard switches to it and the old job and table are deleted. Caption: "One copy of the logic;
   batch is just a replay".
5. A small cost note on kappa: the replay takes as long as the history is big, and needs a log kept
   that long. Caption: "The price: keep the log, wait for the replay".

**The moment**: Beat 3 against beat 4: the lambda side's two logics briefly disagreeing, the kappa
side needing only one change and one replay.

**Interaction**: Change the rule, then on the lambda side patch only one layer and watch the
mismatch; on the kappa side start the replay and watch the new output catch up and take over.

**Ending**: Kappa side settled: one pipeline, one logic, a served view that both layers of lambda
had to work together to produce.

**Variants**: `batch-vs-stream-processing`, `medallion-architecture`, `watermarks-late-data`.

**Techniques**: stream, contents, path trace, restyle, failure, side by side, scrub, caption.

**Review**: Improved — kappa's replay now runs as a second job writing a new table that replaces the
old one once caught up (that is how it is actually done, not a lever that edits results in place),
the speed layer's number is shown being discarded when batch takes over, and the replay's cost (a
retained log, a slow rerun) is stated.

### Data catalog and lineage (`data-catalog-and-lineage`)

**The aha**: A catalog says what data exists and who owns it; lineage says what fed into it and
what depends on it, so you can find data you can trust and see what breaks before you change
anything.

**Misconception to defeat**: That a catalog is just a list of table names, or that lineage is only
useful after something has already broken.

**Cast**: A sprawl of unlabelled datasets (cylinders, file bundles). A catalog panel listing each
with owner, schema, freshness and a "contains PII" badge. A lineage graph: arrows from sources
through pipeline jobs to downstream tables and dashboards.

**Opening frame**: An analyst searching "customer revenue" against the unlabelled sprawl, getting
three identically-named, unexplained candidates.

**Story**:

1. Catalog cards attach to each dataset: owner, last updated, schema, a short description. The
   search now returns one dataset with a green "owned, fresh, documented" badge. Caption: "A
   catalog: what exists, and who to ask".
2. The analyst opens its lineage: a path traces backward through two pipeline jobs to three raw
   sources. The arrows were recorded by the jobs as they ran, not drawn by hand. Caption: "Lineage:
   where it came from".
3. An engineer plans to drop a column from one raw source. The lineage path traces forward
   instead, lighting every job, table and dashboard that reads that column, including one the
   engineer didn't know existed. Caption: "And what depends on it".
4. The engineer drops the column anyway, skipping the check. Every lit downstream job turns red in
   turn, cascading over the next few runs. Caption: "Skip lineage, and it breaks downstream, late
   and confusing".
5. Rewind: the engineer checks lineage first, finds the dashboard owner, coordinates the change,
   and the drop happens with nothing turning red. Caption: "Check first: no surprise outages".

**The moment**: Beat 3's forward trace lighting up an unexpected dashboard, then beat 4 making that
warning real.

**Interaction**: Pick a dataset or column to change and trace its lineage forward before
committing; compare with skipping the check.

**Ending**: The full graph, catalogued and traceable, the risky drop made safely with every
downstream owner informed.

**Variants**: `data-mesh`, `data-lake`, `data-quality-checks`, `schema-compatibility`; Microsoft
Purview, Unity Catalog, AWS Glue Data Catalog and DataZone, Dataplex; OpenLineage as the open
standard for recording lineage.

**Techniques**: path trace, appear, restyle, failure, spotlight, caption.

**Review**: Improved — beat 2 now says lineage is captured from job runs (that is why it can be
trusted, and why it works at column level), and the vendor names are added. The forward trace that
finds a dashboard nobody knew about is the best moment; it also answers "lineage is only for after
breakage".

### Data quality checks (`data-quality-checks`)

**The aha**: Automated rules catch bad data at the pipeline boundary, where it's cheap to fix,
instead of downstream in dashboards and models, where it's expensive to find.

**Misconception to defeat**: That data quality is just schema validation (right types, right
columns), or that a human will notice a wrong number eventually.

**Cast**: A pipeline stage between ingest and the warehouse, drawn as a gate with a checklist: not
null, unique, in range, fresh, row count expected, matches a reference. Rows stream through it as
strips. A quarantine bin beside the gate. Downstream, a dashboard.

**Opening frame**: The gate, checklist unlit, rows flowing straight through to the warehouse and
the dashboard beyond.

**Story**:

1. A batch arrives with one negative `price` and a `country` code nothing recognises. With no
   checks, both flow straight through; the dashboard's "average price" and "sales by country"
   quietly go wrong. Caption: "Bad data flows straight into the numbers".
2. The checklist lights on: "not null", "price > 0", "country in reference list". The same batch
   arrives again; the bad rows bounce off the gate into the quarantine bin, the rest pass. Caption:
   "Catch it at the boundary".
3. A "row count expected" check compares today's batch (40 rows) against a normal range
   (900–1,100) and fails the whole run, red, rather than silently loading a tenth of the data.
   Caption: "Some checks fail the run entirely".
4. An alert fires to the pipeline owner with the quarantined rows attached; the dashboard owner is
   never bothered. Caption: "Caught where it's cheap to fix".
5. Contrast: the same missing-rows scenario without row-count checks plays out further right, the
   thin batch loading clean, and only the dashboard's sudden, unexplained dip giving it away two
   days later. Caption: "Without checks: found late, in the numbers themselves".

**The moment**: Beat 5 against beats 2–4: the same bad batch, caught at the gate in minutes versus
surfacing as a mystery two days later.

**Interaction**: Turn checks on or off and inject a bad batch; see whether it's caught at the gate
or shows up only in the dashboard.

**Ending**: The gate's checklist fully lit, a small quarantine bin holding the batch's bad rows,
the dashboard unaffected.

**Variants**: `data-catalog-and-lineage`, `data-pipeline-orchestration`, `schema-compatibility`,
`medallion-architecture`.

**Techniques**: contents, token, failure, restyle, meter, side by side, caption.

**Review**: Keep — the same bad batch caught at the gate in minutes versus found two days later in a
dashboard is the clearest case for checks at the boundary, and beat 3 correctly shows that some
checks (volume, freshness) fail the whole run while row-level ones quarantine. A "schema check
only" framing was weighed; it hides the wrong-but-well-typed values the beats show.

## Backup and recovery

### Full, incremental and differential backups (`backup-types`)

**The aha**: It's a trade between backup cost and restore effort: incrementals are small to take,
but restoring needs the full backup plus every increment since, in order.

**Misconception to defeat**: That "incremental" and "differential" are the same thing, or that
smaller backups are simply better.

**Cast**: A database cylinder. A weekly calendar strip, Sunday to Saturday. Three backup chains
drawn beneath it as boxes: "Full only", "Full + incremental", "Full + differential". A restore
clock.

**Opening frame**: Sunday's full backup box, solid and complete, sitting alone under the calendar.

**Story**:

1. Full only: every day a complete box the same size as Sunday's appears. Caption: "Full:
   everything, every time — simple, heavy".
2. Full + incremental: Monday's box holds only what changed since Sunday; Tuesday's holds only what
   changed since Monday; each box is small. Caption: "Incremental: just the changes since the last
   backup, of any kind".
3. Full + differential: Monday's box holds what changed since Sunday; Tuesday's box holds what
   changed since Sunday too, growing larger each day. Caption: "Differential: changes since the
   last full, every time".
4. Restore to Thursday: the incremental chain needs Sunday's full plus Monday, Tuesday, Wednesday
   and Thursday's boxes, replayed in order; one missing box breaks the chain. The differential
   chain needs only Sunday's full plus Thursday's box. Caption: "Incremental: cheap to take, a long
   chain to restore".
5. One of Tuesday's incremental boxes turns out corrupted (red flash); the chain snaps, and
   Wednesday and Thursday become unrestorable even though they're intact. The differential chain,
   unaffected by Tuesday, restores Thursday fine. Caption: "A broken link breaks everything after
   it".

**The moment**: Beat 4's two restore paths side by side: a short hop for differential, a long
fragile chain for incremental.

**Interaction**: Pick a day to restore to under each scheme and watch which boxes the restore
needs; corrupt one box and see what becomes unrestorable.

**Ending**: Three calendars side by side with their final backup sizes and restore-chain lengths
compared. Caption: "Smaller backups, longer chains".

**Variants**: `storage-snapshots`, `point-in-time-restore`, `backup-vs-replication`.

**Techniques**: contents, meter, path trace, failure, side by side, caption.

**Review**: Keep — the incremental-vs-differential definitions are right (since the last backup of
any kind, versus since the last full), and the restore-to-Thursday chain with one corrupt box
makes the cost of a long chain concrete. Showing only sizes was weighed; it hides the restore
effort, which is the real trade.

### Snapshots (`storage-snapshots`)

**The aha**: A snapshot is fast and cheap because it shares unchanged blocks with the live disk and
only records what changes afterward; as long as it lives in the same storage pool, it isn't a real
backup.

**Misconception to defeat**: That a snapshot is a full, independent copy like a backup.

**Cast**: A disk drawn as a grid of blocks, mostly filled. A snapshot taken at a moment, drawn as a
thin frame around the same grid with a timestamp. As blocks change, new blocks appear beside the
old ones, with the snapshot's frame still pointing at the originals. A "storage pool" boundary
around the disk and the snapshot together.

**Opening frame**: The disk, fully written, and the question "back this up right now".

**Story**:

1. The snapshot is taken: it completes instantly, size meter reading "0 bytes extra". Caption:
   "Taken almost instantly: no data copied yet".
2. A block is overwritten on the live disk; the old block is kept (now pointed at by the snapshot)
   and the new data lands in a fresh block for the live disk to use. Caption: "Old blocks are kept
   only where they change".
3. More writes happen over the next hour; the snapshot's size meter grows slowly, holding only the
   blocks that would otherwise have been lost. Caption: "Grows only with what changes".
4. The storage system fails (controller dies, red flash across the pool). The snapshot, inside the
   same pool, greys out with the disk. Caption: "Same system, same failure".
5. Contrast: a full copy of the snapshot's blocks written to separate storage survives the same
   failure untouched. Caption: "Copy it elsewhere, and it becomes a real backup".

**The moment**: Beat 4: the snapshot dying alongside the disk it was supposed to protect against,
because it never left.

**Interaction**: Fail the underlying pool and watch the snapshot go with it; toggle "copied
off-system" and watch it survive instead.

**Ending**: A snapshot and a copied-off backup side by side, one grey after the failure, one
intact.

**Variants**: `backup-types`, `backup-vs-replication`, `point-in-time-restore`, `block-storage`.
Cloud disk snapshots (Azure managed disk, EBS, Persistent Disk) are stored apart from the disk and
are incremental, so they are closer to a backup, but still sit in the same account and region.

**Techniques**: contents, meter, clone, failure, side by side, toggle, caption.

**Review**: Improved — the old caption named "copy-on-write" while the picture showed
redirect-on-write (new data to a fresh block); the caption is now neutral about the mechanism. The
"not a backup" claim is scoped to snapshots inside the same storage pool (arrays, ZFS, LVM): cloud
disk snapshots live apart from the disk, which the variants line now notes.

### Point-in-time restore (PITR) (`point-in-time-restore`)

**The aha**: Replaying the transaction log forward from the last full backup turns one daily backup
into a continuous one, letting you rewind to the second before a bad statement ran.

**Misconception to defeat**: That restoring means picking the nearest snapshot or backup and
losing everything since, or that PITR is the same as restoring a snapshot.

**Cast**: A database cylinder. Beneath it, a continuous transaction log strip with timestamps,
archived as it fills. A full backup marker at 00:00. A restore timeline slider beneath, scrubbable
second by second. A disaster marker: "14:02:17 — DROP TABLE orders".

**Opening frame**: The cylinder healthy, the log strip running from 00:00 to now, the disaster
marker sitting on it at 14:02:17.

**Story**:

1. At 14:02:17 the bad statement runs; the cylinder's `orders` rows vanish (red flash). Caption:
   "The mistake happens at a precise second".
2. The nearest backup is from 00:00, fourteen hours earlier; restoring only that loses every order
   since midnight. Caption: "A backup alone: restore to the last full copy".
3. The restore instead starts from the 00:00 full backup into a new database beside the broken
   one, then replays the log forward, redoing every committed transaction after it. Caption:
   "Restore the full copy, then replay the log forward".
4. The slider is scrubbed toward 14:02:17; the new cylinder's rows rebuild in step, order by order,
   as the replay catches up. Caption: "Walk forward to any second".
5. The slider stops at 14:02:16, one second before the DROP; the DROP itself is never replayed.
   `orders` is whole again; only the second after the mistake is lost. Caption: "Stop the replay
   just before the mistake".

**The moment**: Beat 5: the slider parked exactly one tick before the disaster marker, the table
whole while the DROP sits just ahead, un-replayed.

**Interaction**: Scrub the timeline slider across the log and watch the cylinder's state follow
it, second by second, through the disaster point. Delete one log segment and the replay stops at
the gap: the log must be unbroken from the full backup on.

**Ending**: The restored database at 14:02:16 beside the damaged one, the log strip showing exactly
how far the replay went, and the app pointed at the restored copy.

**Variants**: `backup-types`, `storage-snapshots`, `open-table-formats`; Azure SQL and RDS keep
backups and logs for a retention window and restore to a new database.

**Techniques**: contents, token, failure, scrub, path trace, caption.

**Review**: Improved — the restore now lands in a new database beside the damaged one (how Azure SQL
and RDS do it, and the safe habit), and the interaction shows that one missing log segment stops
the replay, the real limit on PITR. The stop-one-tick-before-the-DROP moment was already right.

### Backup vs replication (`backup-vs-replication`)

**The aha**: A replica copies your mistakes instantly; only an independent, versioned backup lets
you go back to before the mistake happened.

**Misconception to defeat**: That having a live replica means you're already backed up, or that
high availability and backup solve the same problem.

**Cast**: A primary cylinder with a replica beside it, rows streaming between them continuously.
Separately, a backup vault off to the side, holding dated, versioned copies (Mon, Tue, Wed…) on
different storage, with a padlock "immutable". A small card: "3 copies · 2 media · 1 off-site".

**Opening frame**: Primary and replica in sync, the vault holding Monday's and Tuesday's dated
copies untouched.

**Story**:

1. A normal write streams from primary to replica within milliseconds, both showing the same rows.
   Caption: "Replication: keep live copies in sync".
2. The primary's server dies (red flash); the replica is promoted and serves on. Caption:
   "Replication does its job: a hardware failure, and you stay up".
3. Someone runs `DROP TABLE orders` on the primary; the replica, doing exactly its job, replicates
   the same drop within the same second. Both go red. Caption: "A replica copies mistakes instantly
   too".
4. Ransomware encrypts every row; the replica syncs the encrypted garbage moments later. Reaching
   for the vault, the attacker's credentials are refused: its copies are immutable, with separate
   access. Tuesday's clean copy sits intact. Caption: "A backup is separate, versioned, and out of
   reach".
5. Tuesday's backup is restored to a fresh cylinder; orders reappear as they were, while the drop
   and the ransomware are left behind in time. Caption: "Only a backup lets you go back".

**The moment**: Beats 3 and 4: the replica dutifully mirroring disaster in near real time, proving
it was never a backup, set against beat 2 where the same replica was exactly right.

**Interaction**: Trigger a server failure, a bad command or ransomware and watch which of replica
and vault saves you each time.

**Ending**: A healthy cylinder restored from the vault, the replica rebuilt fresh from it, the
3-2-1 card fully lit.

**Variants**: `storage-redundancy-levels`, `backup-types`, `point-in-time-restore`; reliability's
high-availability and failover concepts.

**Techniques**: stream, failure, contents, side by side, caption.

**Review**: Improved — the old plan said replication protects against hardware failure but never
showed it, so a failover beat now makes the contrast fair (each protects against a different
thing). The vault's safety was just "not continuously connected"; it is now immutable with
separate access, which is what actually stops ransomware reaching backups. The two bad-command
beats stay separate on screen but share a caption arc.

## Schema evolution and migration

### Schema migrations (`schema-migrations`)

**The aha**: The schema is code: each change is a versioned, ordered script, recorded in the
database itself and applied the same way in every environment, never by hand.

**Misconception to defeat**: That schema changes are one-off things someone runs manually when
they remember, or that "migration" here means moving to a different database.

**Cast**: A folder of numbered migration files (`001_create_orders.sql`, `002_add_index.sql`,
`003_add_column.sql`…). Three environments in a row: Dev, Staging, Production, each with its own
database cylinder and a `schema_migrations` table listing which numbers have run. A deployment
pipeline arrow running through all three.

**Opening frame**: Dev's cylinder and its `schema_migrations` table both at "003"; Staging and
Production still at "001". Caption: "The database remembers what's been applied".

**Story**:

1. A developer writes `004_add_customer_email.sql` and commits it to the folder, numbered to run
   after 003. Caption: "A change is a versioned script, reviewed like code".
2. The pipeline runs it against Dev: the column appears, and `schema_migrations` records "004" as
   applied. Caption: "Applied by the pipeline, not by hand".
3. The pipeline promotes the build to Staging; it checks `schema_migrations`, sees 001 only, and
   runs 002, 003, 004 in order to catch up, recording each. Caption: "Every environment ends up
   identical, in the same order".
4. Someone hand-adds `customer_email` to Production's table outside the folder. The next pipeline
   run reaches 004 there: `ADD COLUMN customer_email` fails, "already exists", and the deploy
   stops with the record still at 003. Caption: "A manual change breaks the next deploy".
5. The hand-edit is reverted; Production runs 002 through 004 cleanly through the pipeline,
   matching Dev and Staging. Caption: "Same scripts, same order, everywhere".

**The moment**: Beat 4: the hand-edited production database colliding with its own next migration,
blocking the deploy until it's reconciled.

**Interaction**: Hand-edit one environment's schema directly and watch the next pipeline run
collide; edit an already-applied script and watch its stored checksum refuse to match; apply
through the pipeline instead and watch it succeed.

**Ending**: All three environments' `schema_migrations` tables reading "004", their schemas
identical.

**Variants**: `expand-contract-migration`, `online-schema-change`, `schema-compatibility`;
delivery's `database-migrations-in-pipeline` (the same ledger, seen from the pipeline); Flyway,
Liquibase, EF Core.

**Techniques**: contents, appear, path trace, failure, side by side, caption.

**Review**: Improved — beat 4 claimed the pipeline "detects a mismatch against `schema_migrations`",
but migration tools only compare their ledger and script checksums, they don't diff the live
schema; the realistic failure is the next script colliding with the hand-made change. The
interaction adds the checksum case. Delivery's plan tells the pipeline half, so this one stays on
the ledger.

### Expand and contract (parallel change) (`expand-contract-migration`)

**The aha**: During a deployment, old and new versions of the app run side by side, so a breaking
schema change must pass through steps that each work for both versions.

**Misconception to defeat**: That a rename is one step: change the column and ship the new code.
During a rolling update the old instances are still running, and they break the moment the column
moves.

**Cast**: Centre, a `users` table drawn as a grid; column headers are tabs. Above it, four app
instances (v1 blue, v2 violet, v3 green), each with thin lines to the columns it reads and writes.
Left, a crowd of users sending requests. Below, a phase track: Expand → Migrate → Contract, and a
counter "v1 instances: 4".

**Opening frame**: Table `id | name`; four blue instances wired to `name`, all ticks. Caption:
"Goal: rename `name` to `full_name`".

**Story**:

1. Big bang, tinted red: the header flips to `full_name` in one step. Every blue instance's line
   snaps, errors reach users. Rewind. Caption: "Rename in one step: every v1 breaks".
2. Expand: an empty, dashed, nullable `full_name` column appears beside `name`. Blue instances keep
   working. Caption: "Expand: add the new beside the old".
3. Migrate: a rolling update turns instances violet one at a time. v2 writes both columns and reads
   `full_name`, falling back to `name`. Blue and violet run together, all ticks. Caption: "Old and
   new run side by side".
4. When v1 reads zero, a sweep runs down the rows copying `name` into the still-empty `full_name`
   cells, in small batches. Rows saved by v1 during the rollout were covered by this sweep, not by
   v2. Caption: "Backfill what only the old code wrote".
5. Contract: a v3 release (green) reads and writes only `full_name`; once the counter reads "v1 and
   v2: 0", the `name` column fades out. Caption: "Contract: remove the old once nothing uses it".
6. Each gap on the phase track gets a "safe to roll back" tick, except the last. Caption: "Every
   step works with both versions. Dropping is the one-way step".

**The moment**: Beat 3, slowed: blue and violet instances hitting the same table at the same time,
all green, with beat 1's snapped lines as a small inset for contrast.

**Interaction**: Scrub the phase track and press "roll back the app" anywhere before contract: the
older version always finds its column. Or press "contract early": drop `name` while a blue
instance is alive and watch it break. Contract waits for the last old reader.

**Ending**: A clean `id | full_name` table, every instance green, every phase ticked; the `name`
column kept in a backup, not in the table.

**Variants**: `schema-migrations`, `online-schema-change` (how the engine performs each step),
`schema-compatibility`; delivery's `rolling-update`, `blue-green-deployment`,
`zero-downtime-deployment`, `rollback-vs-roll-forward`. A split (`name` into first and last) is the
follow-on: the same steps, with a lossy backfill.

**Techniques**: contents, restyle, appear, disappear, lanes, meter, side by side, failure, choice,
caption.

**Review**: Rethought — the old plan never showed the failure it prevents and used a name split,
whose backfill is lossy and distracts. Rebuilt on the rename with delivery's best parts: the
big-bang failure first, wires from instances to columns, a "v1 instances" counter gating contract,
and the roll-back and contract-early interactions. Also fixed a real gap: old instances keep
writing only the old column during the rollout, so the backfill must run after they are gone (or
be rerun), and reads fall back to the old column until then.

### Online schema change (`online-schema-change`)

**The aha**: Some schema changes lock or rewrite the whole table; an online tool rebuilds the
table in a shadow copy in the background, captures ongoing writes, then swaps it in with a brief
rename.

**Misconception to defeat**: That any `ALTER TABLE` is quick (or always slow), or that this is the
same technique as expand-and-contract (which is about app compatibility, not how the database
performs the rewrite).

**Cast**: A huge `orders` table, millions of rows, under constant write traffic from the left. A
naive `ALTER TABLE ... ALTER COLUMN quantity TYPE bigint` lock icon. Beside it, a shadow table being
built with the new type, and a changes buffer capturing writes that land on the original while the
shadow builds.

**Opening frame**: The live table under steady write traffic, and the command `ALTER TABLE orders
ALTER COLUMN quantity TYPE bigint`.

**Story**:

1. Run naively: a lock icon drops onto the whole table; incoming writes queue up, stacking into a
   growing backlog as the rewrite grinds through millions of rows. Caption: "A full rewrite can
   lock the table for the whole thing".
2. Reset. The online tool instead creates an empty shadow table with the new type and copies rows
   across in batches, in the background, no long lock. Caption: "Copy into a shadow table instead".
3. While the copy runs, a new order arrives on the original table; it's captured into a changes
   buffer (by triggers, or by reading the binlog) and replayed onto the shadow table too. Caption:
   "Capture writes that happen during the copy".
4. The copy finishes and the buffer drains to zero, the shadow table now matching the original
   exactly, plus the new type. Caption: "Catch up completely before swapping".
5. A brief atomic rename swaps the shadow table in for the original: a lock measured in
   milliseconds, not minutes, against beat 1's backlog. Caption: "Swap atomically: a split second,
   not a lock-up".
6. A quick aside: `ADD COLUMN loyalty_tier` (nullable) on a modern MySQL or PostgreSQL is a
   metadata-only change and finishes instantly. Caption: "Some changes are already instant: check
   first".

**The moment**: Beat 1's growing backlog against beat 5's split-second swap, for the same schema
change.

**Interaction**: Toggle naive `ALTER` / online tool and watch the write queue either stack up for
the whole rewrite or barely blip at the final swap.

**Ending**: The new type in place, writes having flowed the entire time, the backlog meter having
only ever ticked at the very end.

**Variants**: `schema-migrations`, `expand-contract-migration`; gh-ost (binlog), pt-online-schema-change
(triggers), MySQL online DDL, PostgreSQL `CREATE INDEX CONCURRENTLY`.

**Techniques**: clone, contents, stream, token, failure, side by side, toggle, caption.

**Review**: Improved — the example changed from `ADD COLUMN`, which modern MySQL (8.0 instant add)
and PostgreSQL (11+, constant default) do as a metadata-only change, to a column type change that
really rewrites; that instant case is kept as a short aside so "any ALTER is slow" isn't
swapped in as the new misconception. Names how changes are captured (triggers or binlog).

### Backward and forward compatibility (`schema-compatibility`)

**The aha**: Data outlives code and writers and readers upgrade at different times, so every
schema change must be readable both ways: add optional fields, never reuse or repurpose an old
one.

**Misconception to defeat**: That this is just API versioning, or that any schema change is fine
as long as the code compiles.

**Cast**: A message schema with fields `id`, `amount`, `currency` (tag 3). An old reader and a new
reader. An old writer and a new writer. Messages drawn as cards with field tags, flowing between
them. Two labelled arrows: "new reads old = backward" and "old reads new = forward".

**Opening frame**: One writer, one reader, both on the same schema, messages flowing cleanly.

**Story**:

1. The schema adds an optional field `discount` (tag 4) with a default. The new writer emits it;
   the old reader, not knowing tag 4, ignores it and reads fine. Caption: "Forward compatible:
   old readers cope with new data".
2. The old writer, still on the old schema, emits messages without `discount`. The new reader
   fills in the default and reads fine. Caption: "Backward compatible: new readers cope with
   old data".
3. Someone instead removes `currency` (tag 3) and repurposes tag 3 for a new field `taxRate`, to
   save a tag. An old message tagged 3 meaning "currency: CAD" is read by new code as "taxRate:
   CAD" (red flash, nonsense value). Caption: "Reusing a tag: old data gets misread as something
   else".
4. Rewind: `taxRate` is given a fresh tag 5 instead, and tag 3 is marked reserved, never reused.
   Old messages with tag 3 are ignored by new readers. Caption: "Retire a field's tag; never recycle
   it".
5. Across a rolling deploy, old and new writers and readers are mixed for a while; every
   combination reads correctly. Both arrows lit: "full compatibility". Caption: "Both ways must
   hold, because upgrades aren't instant".

**The moment**: Beat 3: the same bytes read correctly moments ago, now silently misread as the
wrong field, because a tag was reused.

**Interaction**: Mix old/new writers and readers across a schema change and watch which
combinations stay correct; try reusing a tag, or adding a required field with no default, and
watch each break.

**Ending**: Four combinations of writer/reader version, all green, a graveyard of retired tags
that were never reused.

**Variants**: `expand-contract-migration`, `schema-migrations`, `data-quality-checks`; Avro (matches
fields by name, with defaults), Protocol Buffers (matches by tag), JSON Schema; a schema registry
enforces backward, forward or full modes on every new version.

**Techniques**: token, contents, restyle, failure, side by side, caption.

**Review**: Improved — beats 1 and 2 had the two terms swapped (old reader on new data is forward
compatibility, new reader on old data is backward), which is the one thing people mix up here, so
the captions and a labelled pair of arrows now make it unmistakable. Added "full" and the
registry modes, the protobuf `reserved` mechanism, and the required-field-without-default break.

### Database migration and cutover (`database-migration-cutover`)

**The aha**: Bulk-copying the data once, then keeping the target in sync with CDC while
validating it, shrinks downtime to the moment of cutover instead of the whole migration.

**Misconception to defeat**: That migrating a database means taking it offline for the whole copy,
or that cutover is just "flip a switch" without checking the target first.

**Cast**: A source database (old engine) on the left, full of rows and under live traffic. A
target database (new engine) on the right, empty at first. A bulk-copy pipe, a CDC stream running
alongside it, a lag meter, a validation checklist, and a cutover switch in the middle.

**Opening frame**: Source full and serving traffic, target empty, the switch pointed at the
source.

**Story**:

1. The schema is converted for the new engine. The log position is noted, then a bulk copy streams
   every existing row across while the source keeps serving live traffic. Caption: "Copy the bulk
   while the source stays live".
2. Changes made during the copy are captured from that noted position and applied once the copy
   ends; the CDC stream then carries every new change continuously, and the lag meter falls toward
   zero. Caption: "Keep the target in sync with CDC".
3. A validation checklist runs against the target: row counts match, checksums match, a sample of
   recent writes matches. One mismatch (red flash) sends it back to keep syncing and investigate.
   Caption: "Validate before trusting it".
4. Checks pass; a brief freeze stops writes to the source, the last changes drain (lag zero), and
   the switch flips so applications read and write the target. Caption: "Cutover: a short freeze,
   once everything else is done".
5. Reverse sync now flows target to source, so a rollback stays possible. Contrast, faded in
   behind: the naive approach, a single long maintenance window with the source offline for the
   entire bulk copy. Caption: "Without this: the whole copy is downtime".

**The moment**: Beat 4 against beat 5: a cutover measured in seconds beside a maintenance window
measured in hours, for the same migration.

**Interaction**: Toggle "big-bang / bulk + CDC" and compare the length of the downtime window for
the same data volume.

**Ending**: The switch resting on the target, the source dim but kept in sync backwards until the
team decides to retire it.

**Variants**: `change-data-capture`, `schema-migrations`, `online-schema-change`; AWS DMS, Azure
Database Migration Service, Google Database Migration Service.

**Techniques**: stream, token, contents, failure, side by side, toggle, caption.

**Review**: Improved — CDC now starts from a log position taken before the bulk copy (otherwise
changes made during the copy are lost), and cutover is gated on lag reaching zero. The ending keeps
a reverse sync for rollback instead of "CDC stopped, source unused", which would leave no way
back.
