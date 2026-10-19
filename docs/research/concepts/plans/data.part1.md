# Data plans, part 1

Stage 2 plans for `catalog/data.md` groups 1 to 4, in catalog order. They use the shared data
language: a database is a cylinder with a few visible `key: value` rows; replicas are copies side
by side, with replication as rows streaming between them; clients are small boxes on the left;
concurrent transactions are coloured horizontal bands on one timeline (time flows left to right),
with their reads and writes as dots on the band; partitions are separate cylinders labelled by key
range; storage tiers are shelves (hot near, archive far); a failure is a red flash, then the
element greys out. Conventions this part adds: an uncommitted value is drawn in pencil (dashed,
tinted in the writer's colour) and a committed one in ink (solid); a lock is a padlock in the
holder's colour; a transaction that is waiting has a hatched band.

Two techniques are new to the vocabulary: **split / merge** (one element divides into parts, or
parts combine into one) and **scrub** (the viewer drags a playhead along the timeline, or steps
one beat at a time, to replay an interleaving).

## Storage types, redundancy and lifecycle

### Block storage (`block-storage`)

**The aha**: Block storage is a raw disk plugged into one server; only that server's operating system knows what the blocks mean.
**Misconception to defeat**: That it's a shared drive with files on it, like file storage.
**Cast**: Left, a server box "VM-A" with an OS strip inside ("Linux · ext4"). Right, a disk drawn as an 8×8 grid of small numbered squares (blocks 0–63), labelled "Block volume · 128 GB". A thick cable joins them. Below, a second server "VM-B", dim.
**Opening frame**: VM-A cabled to a grid of blank numbered blocks. _"A raw disk: numbered blocks, nothing more."_
**Story**:

1. VM-A formats the disk: a few blocks tint as "file table", the rest stay free. _"The server lays its own file system on it."_
2. An app in VM-A saves `report.pdf`. A token "write blocks 17–20" runs down the cable; those four squares fill blue. _"Writes are just 'put these bytes in block 17'."_
3. Split the screen: left, VM-A's view (a folder, `report.pdf`); right, the disk's view of the same moment (blocks 17–20 full of hex, no names). _"The disk has no idea a file exists."_
4. VM-B reaches its cable toward the disk: red flash at the socket, "attached to VM-A". _"One server owns it."_
5. Ghost replay of why: had VM-B attached, its OS, keeping its own map of free blocks, writes `notes.txt` over block 18, and `report.pdf` turns to garbage in VM-A's view. _"Two OSes, two maps of the same blocks."_
6. Three meters appear on the cable: capacity 128 GB, 3,000 IOPS, 125 MB/s, latency "~1 ms". _"You buy size, IOPS and throughput."_
   **The moment**: Beat 3. The same instant seen twice, a named file on one side and anonymous blocks on the other, shows that the meaning lives in the server's OS, not the disk; beat 5 shows that this is exactly why it can't be shared.
   **Interaction**: Toggle "OS view / disk view". Force-attach VM-B and watch the corruption (multi-attach exists, but only with a cluster-aware file system). A size dial, on clouds where performance scales with size, moves the IOPS meter.
   **Ending**: Rests on the split view. _"A hard drive plugged into one server."_
   **Variants**: `file-storage`, `object-storage`, `storage-snapshots`; platform: Azure Managed Disks, Amazon EBS (`aws-ebs-volumes-and-snapshots`, multi-attach as the exception), Google Persistent Disk (`gcp-block-storage`).
   **Techniques**: contents, token, side by side, toggle, failure, meter, dial, caption.
   **Review**: Improved — the refusal was a bare rule; a ghost replay now shows why one server owns the disk (a second OS with its own map of free blocks overwrites the first's file), which ties the single-attach fact to the aha that the meaning lives in the OS. The interaction lets viewers force it. Weighed opening on a side-by-side with file storage, but that contrast belongs to `file-storage`'s ending.

### File storage (`file-storage`)

**The aha**: A file share is one folder tree that lives on the network, so many machines mount it at once and existing apps use it through ordinary paths.
**Misconception to defeat**: That it's block storage shared out, or object storage with real folders.
**Cast**: Centre, a file-server box holding a folder tree (`/projects/plan.docx`, `/finance/budget.xlsx`), with a label "file system lives here". Left, three servers VM-A, VM-B, VM-C, each showing a mount path `/mnt/projects`. Lines between them marked "SMB / NFS".
**Opening frame**: Three servers wired to one folder tree. _"One folder tree, mounted by many machines."_
**Story**:

1. VM-A opens `plan.docx`: a token "open /projects/plan.docx" travels to the share. _"Clients ask for files by path."_
2. VM-A saves; the modified time updates in all three servers' views at once. _"Everyone sees the same files."_
3. VM-B tries to write `plan.docx`: a padlock in VM-A's colour sits on the file; B's token bounces with "locked by VM-A". _"The share handles locks..."_
4. VM-C (user "intern") asks for `/finance/`: a shield on the folder turns it back. _"...and permissions."_
5. A legacy `app.exe` on VM-C, expecting a plain path, reads through the mount without change. _"Existing apps work unchanged."_
6. Contrast inset: block storage, where the "file system lives here" label sits inside one VM; it slides across to the share. _"Block: the server owns the file system. File: the share does."_
   **The moment**: Beat 6. Moving the "file system lives here" label from the VM to the share is the whole difference between block and file storage.
   **Interaction**: Click any server to open or save a file and watch the lock appear for the others.
   **Ending**: Three servers, one tree, lock released.
   **Variants**: `block-storage`, `object-storage`; platform: Azure Files (`azure-files`), Amazon EFS and FSx, Google Filestore.
   **Techniques**: token, contents, restyle, side by side, move, caption.
   **Review**: Keep — moving the "file system lives here" label from the VM to the share is the sharpest contrast with block storage there is, and paths, locks, permissions and the unchanged legacy app cover the catalog's idea one beat each. Weighed opening on block storage's refused VM-B instead; ending on the moving label lands harder because the viewer has seen the label all along.

### Object storage (`object-storage`)

**The aha**: You put and get whole objects by key over HTTP; you never edit bytes in place, and "folders" are only prefixes in the key.
**Misconception to defeat**: That it's a file system in the cloud with folders and editable files.
**Cast**: A bucket drawn as a wide flat tray "bucket: photos". Objects are cards: a key on top (`2024/june/beach.jpg`), a thumbnail of bytes, a metadata tag (`image/jpeg · 2 MB`). A client on the left joined by a pipe marked "HTTPS".
**Opening frame**: A file-explorer view: folder `2024` › `june` › `beach.jpg`. _"Looks like folders..."_
**Story**:

1. The explorer view collapses into a flat list of cards; the slashes in each key glow. _"...but it's one flat list. '2024/june/' is part of the name."_
2. The client sends `PUT /photos/2024/june/pier.jpg` with the whole file; a card drops into the tray. _"PUT a whole object under a key."_
3. The client tries to change one byte of `log.txt`: the token "write byte 512" bounces, red. Then it GETs the whole object, edits it locally, PUTs it back; the old card is swapped for the new one. _"No edits in place: replace the whole object."_
4. `LIST prefix=2024/june/`: the matching cards light, the rest dim. _"A 'folder' is a list by prefix."_
5. Zoom out: the tray stretches and the cards shrink to millions of dots. Meters: objects "no practical limit", durability "11 nines", cost "about 2¢ per GB-month". _"That trade buys scale, durability and low cost."_
   **The moment**: Beat 3, built on beat 1: once the folders have dissolved into keys, the bounced in-place edit replaces the file-system picture for good.
   **Interaction**: Type a prefix to filter the list. A "folder view / real view" toggle. An "edit in place" button that always bounces.
   **Ending**: The flat list with a prefix lit. _"Whole objects, by key, over HTTP."_
   **Variants**: `file-storage`, `storage-access-tiers`, `soft-delete-and-versioning`, `data-lake`; platform: Amazon S3 (`aws-s3-fundamentals`), Azure Blob Storage, Google Cloud Storage. Exceptions worth a footnote there: Azure Data Lake Storage's hierarchical namespace (real directories, atomic renames) and Azure append and page blobs (append-only and random-write).
   **Techniques**: toggle, contents, token, failure, spotlight, zoom, meter, caption.
   **Review**: Improved — "cents per GB" is now per GB-month, the moment is one beat rather than two, and the variants name the real exceptions to "no folders, no edits" (ADLS hierarchical namespace, append and page blobs) so the platform plans don't contradict this one. The folders-dissolve opening is the right wrong model to start from; a "warehouse with claim tickets" metaphor was weighed and dropped as less exact than real keys.

### Storage redundancy (local, zone, geo) (`storage-redundancy-levels`)

**The aha**: Each wider scope of copies survives a bigger failure (disk, then datacenter, then region) and costs more; geo copies are asynchronous, so the newest writes can be lost.
**Misconception to defeat**: "Three copies" means safe from anything, whatever the copies share.
**Cast**: Region A as a large boundary holding three zone boxes, each a datacenter with racks. Region B, far right. The data is three small copy cards of `photo.jpg`. A selector: Local · Zone · Geo. A cost meter.
**Opening frame**: All three copies in Zone 1's datacenter. _"Local: three copies, one datacenter."_
**Story**:

1. One disk fails: one copy flashes red and greys; a new copy is cloned beside the survivors. _"A disk dies: fine."_
2. Zone 1's datacenter flashes red; all three copies grey. _"Lose the building, lose all three."_
3. Switch to Zone: the copies move to Zones 1, 2 and 3; cost ticks up. Zone 1 fails; two copies survive. _"Across zones: survive a datacenter."_
4. All of Region A flashes; everything greys. Switch to Geo: a stream of rows runs from Region A to Region B along a long dashed line, and cost ticks up again. _"A second region survives a region."_
5. Slow-down: write `v42` lands in Region A and the client gets a green tick. While `v42` is still on the dashed line, Region A fails. Region B holds `v41`; the `v42` token fades out, red. _"Geo copies lag. The last writes can be lost."_
   **The moment**: Beat 5, slowed: a write the client was told was saved, caught mid-flight when the region goes.
   **Interaction**: Choose a redundancy level, then choose a failure (disk, datacenter, region, or "delete it by mistake") and see whether the data survives and what it costs. The mistaken delete wipes every copy at every level, pointing to `backup-vs-replication`.
   **Ending**: A ladder: Local–disk, Zone–datacenter, Geo–region, with cost rising up the ladder.
   **Variants**: `durability-vs-availability`, `geo-replication`, `sync-vs-async-replication`, `erasure-coding`, `backup-vs-replication`; platform: Azure LRS/ZRS/GRS/GZRS and read-access variants (`azure-storage-redundancy`), S3 One Zone vs Standard, GCS regional, dual-region and multi-region.
   **Techniques**: boundary, clone, failure, choice, meter, stream, token, caption.
   **Review**: Improved — the catalog's confusion with backups was never defeated, so the failure menu gains "delete it by mistake", which every level copies faithfully. The rest holds: widening the boundary one failure at a time is the clearest ladder, and the slowed `v42` caught mid-flight is a better geo moment than a cost comparison. Checked: Azure LRS is three copies in one datacenter, ZRS spans three zones, geo copies are asynchronous on Azure, S3 and GCS.

### Durability vs availability (`durability-vs-availability`)

**The aha**: Durability asks "will my data still exist?"; availability asks "can I reach it right now?"; data can be perfectly safe and unreachable.
**Misconception to defeat**: That "eleven nines" is an uptime figure, or that the two are one number.
**Cast**: A vault holding three copies of a file, reached from a client on the left through a pipe with a gate. Two meters: "Durability: will it survive?" and "Availability: can I reach it?". A one-year time strip along the bottom.
**Opening frame**: Client, gate open, vault with three copies; both meters green. _"Two different questions."_
**Story**:

1. The client reads the file: a token goes through the gate and back. _"A normal day: safe and reachable."_
2. The gate slams shut (red flash on the pipe). The client's tokens bounce with "503". Inside, the three copies glow, untouched. The availability strip marks downtime; the durability meter doesn't move. _"Outage: perfectly safe, and unreachable."_
3. The gate reopens; the same file comes back. _"Nothing was lost."_
4. Inside the vault one copy fails and is rebuilt. Then a rarer event: all copies corrupt at once and the file is gone for good. Durability is the chance of that: "store 10 million objects, expect to lose one every 10,000 years". _"Durability: the chance it's gone forever."_
5. Two cards: "Bought with: more copies, checksums, erasure coding" under durability; "Bought with: redundant front ends, zones, failover" under availability. _"Measured differently, bought differently."_
   **The moment**: Beat 2. The meters diverge, availability dropping while durability stays at 100%, with the copies visibly intact behind the closed gate.
   **Interaction**: Two buttons, "Break the network" and "Lose the copies"; each moves only its own meter.
   **Ending**: The year strip with an outage blip and zero data lost. _"Safe isn't the same as reachable."_
   **Variants**: `storage-redundancy-levels`, `erasure-coding`; reliability's `nines-of-availability` and `sli-slo-sla`; fundamentals' `cloud-provider-sla`. The same id appears in the reliability catalog, so one plan should serve both.
   **Techniques**: meter, token, failure, spotlight, side by side, choice, caption.
   **Review**: Merged — owned by Reliability (`reliability.part1.md`). Theirs is the stronger spine: it shows both directions (intact copies behind a dead front door, and a green front door returning 404 after a single disk dies), where this plan only shows safe-but-unreachable. Theirs should borrow three things from here: the concrete reading of eleven nines (store 10 million objects, expect to lose one every 10,000 years, AWS's own gloss), which turns the label into something a viewer can picture; the "bought with" cards (copies, checksums, erasure coding vs redundant front ends, zones, failover), which carry the catalog's "bought in different ways"; and the year-strip ending with an outage blip and zero data lost.

### Erasure coding (`erasure-coding`)

**The aha**: Split data into k pieces plus m parity pieces, and any k of them rebuild it: the durability of many full copies for about half the space, paid for in CPU and network when rebuilding.
**Misconception to defeat**: That surviving failures needs full copies of the data.
**Cast**: Side by side. Left "Replication": three full bars `video.mp4` on three disks. Right "Erasure coding": the same bar above six empty disks. A space meter under each. A parity gear (Σ) on the right.
**Opening frame**: Left already holds three copies (space meter 3x); the right bar waits. _"Same goal: never lose the file."_
**Story**:

1. The right bar splits into four coloured pieces D1–D4. _"Split into k = 4 data pieces."_
2. The gear reads D1–D4 and emits two striped pieces, P1 and P2. A small inset shows the trick with numbers: pieces 5 and 3, parity 8; cover the 3, and 8 − 5 brings it back. _"Compute m = 2 parity pieces: maths that can refill any two gaps."_
3. The six pieces fly to six different disks. The space meters read 3x left and 1.5x right. _"Half the space of three copies."_
4. Two disks fail on each side (red flash, grey). Left keeps one copy; right keeps four pieces. Both files still open. _"Lose any two: still whole."_
5. Slow-down on the right: the four survivors stream to the gear, a CPU meter spikes, the network line thickens, and D2 reappears on a fresh disk. _"Rebuilding costs CPU and network."_
6. A third right-side disk fails: only three pieces left, and the file flashes red. _"Any 4 of 6. Fewer, and it's gone."_
   **The moment**: Beats 3 and 4 side by side: both survive two failures while the space meters read 3x and 1.5x.
   **Interaction**: Dials for k and m (overhead (k+m)/k and failures tolerated, m, update live). Click disks to fail them and see whether the file can be rebuilt.
   **Ending**: Two summary cards: "Survives 2 failures · 3x space" and "Survives 2 failures · 1.5x space".
   **Variants**: `storage-redundancy-levels`, `durability-vs-availability`; RAID 5 and 6 as the single-machine version; used inside cloud object stores (Azure Storage's local reconstruction codes), Ceph and HDFS.
   **Techniques**: split / merge (new), side by side, meter, failure, stream, dial, caption.
   **Review**: Improved — "any 4 of 6 rebuild it" was asserted, not shown, and reads as magic to a newcomer; a numeric inset (5 and 3 with parity 8; lose one, subtract to get it back) makes parity believable in two seconds without Reed-Solomon. Numbers check out: k = 4, m = 2 is 1.5x and tolerates two losses, the same as three copies at 3x. The side-by-side with replication stays: it's the comparison the catalog asks for.

### Storage access tiers (hot, cool, archive) (`storage-access-tiers`)

**The aha**: Choose the tier by how often data is read, not how important it is: hot costs more to keep and less to read; archive is cheapest to keep and dearest to read, often offline for hours.
**Misconception to defeat**: "Important data goes hot, old data goes cold", and colder is always cheaper.
**Cast**: Shelves at growing distance from a desk on the left: hot (near), cool, cold, archive (in a back room behind a door). Each has a price tag "store $/GB-month · read $/GB". Two files: `logo.png` (read 10,000×/month) and `tax-2019.zip` (read once a year). A monthly bill split into "storage" and "access".
**Opening frame**: Both files on the hot shelf; bill showing. _"Same data, different shelves, different prices."_
**Story**:

1. A month runs (timer). `logo.png` is fetched over and over from the near shelf; `tax-2019.zip` sits untouched, yet its storage cost is billed. _"Hot: dear to keep, cheap to read."_
2. `tax-2019.zip` moves to the archive room; the storage bar drops. _"Rarely read? Archive costs pennies."_
3. An auditor asks for it: the request reaches a closed door, a clock spins through hours ("rehydrating"), the file moves to the hot shelf and a retrieval fee lands on the bill. _"Archive: hours and a fee to get back."_
4. Someone moves `logo.png` to cool "because it isn't important". Each read now costs per GB; the access bar balloons past what hot cost. _"Read often from cool: a bigger bill."_
5. A file moved off cool after 10 days gets a "30-day minimum" penalty chip. _"Leave early, pay anyway."_
   **The moment**: Beat 4, as two bills side by side: the "cheaper" tier costs more for data that's read a lot.
   **Interaction**: A dial "reads per month" for one file. The cheapest shelf lights up and moves from archive to cool to hot as reads rise, showing the crossover points.
   **Ending**: The dial at low reads, archive lit. _"Tier by how often it's read."_
   **Variants**: `storage-lifecycle-policies`, `object-storage`, fundamentals' `storage-tiering-for-cost`; platform: Azure Blob hot/cool/cold/archive and rehydration (`azure-blob-access-tiers`), S3 storage classes and Glacier retrieval tiers (`aws-s3-storage-classes-and-lifecycle`), GCS Standard/Nearline/Coldline/Archive and Autoclass. The platform plans must say which archives are offline: Azure Archive and S3 Glacier Flexible Retrieval and Deep Archive are; GCS Archive and S3 Glacier Instant Retrieval answer in milliseconds but keep the high read fee.
   **Techniques**: contents, move, meter, timer, token, side by side, dial, spotlight, caption.
   **Review**: Improved — "archive is offline for hours" is true of Azure Archive and S3's Glacier Flexible and Deep Archive but not of GCS Archive or Glacier Instant Retrieval, so the aha now leads with what every archive shares (cheapest to keep, dearest to read) and the variants say which are offline. The two-bills moment and the reads-per-month dial, whose cheapest shelf slides as reads rise, are the right framing; an "importance vs frequency" sorting game was weighed and lost to the bill, which shows the penalty in money.

### Lifecycle policies and expiry (TTL) (`storage-lifecycle-policies`)

**The aha**: Rules like "cool after 30 days, archive after 180, delete after 7 years" keep cost and retention in line automatically, without anyone remembering.
**Misconception to defeat**: That someone will tidy it up by hand, or that lifecycle rules are retention locks (they delete; locks prevent deleting).
**Cast**: Shelves (hot, cool, archive) and a shredder at the far end. An age ruler above them: 0, 30 days, 180 days, 7 years. A rule card on the wall. Files as cards with age badges. A cost chart in the corner.
**Opening frame**: A heap of files of all ages on the hot shelf; the cost line climbing. _"Without rules, everything stays hot forever."_
**Story**:

1. The clock speeds up; new files land daily and the heap grows. _"Data piles up. Nobody moves it."_
2. The rule card lights. Files whose badge passes 30 slide to cool. _"Day 30: cool."_
3. Badges passing 180 slide to archive. _"Day 180: archive."_
4. Badges passing 7 years drop into the shredder; one card wearing a retention padlock is passed over. _"Seven years: deleted. Rules delete; only a lock stops them."_
5. The flow settles into a steady conveyor and the cost line flattens beside a ghost of the old rising line. _"Housekeeping on autopilot."_
6. Inset: a database row `session:8f2a` with a "TTL 24h" timer; it runs out and the row disappears. _"Databases do it per item: time to live."_
   **The moment**: Beat 5. The steady conveyor next to the two cost lines, flat with rules and rising without.
   **Interaction**: Drag the thresholds on the age ruler and watch shelf counts and cost change. A toggle "by age / by last access" (with by last access, a file read again hops back to hot).
   **Ending**: Loops the steady conveyor.
   **Variants**: `storage-access-tiers`, `soft-delete-and-versioning` (expire old versions), `immutable-storage-worm`; scaling's `cache-ttl`, messaging's `message-ttl`; platform: S3 Lifecycle, Azure Blob lifecycle management (its rules can key on last access and move data back to hot; S3 Intelligent-Tiering and GCS Autoclass do access-based moves as a storage feature instead), GCS Object Lifecycle, DynamoDB TTL (expired items are removed within days, so reads must filter them) and Cosmos DB TTL.
   **Techniques**: move, timer, chart, contents, disappear, dial, toggle, caption.
   **Review**: Improved — the misconception that rules are retention locks was named but never shown; one padlocked card now rides past the shredder, which defeats it in a single beat and links `immutable-storage-worm`. Variants now say where access-based moves come from on each cloud and that DynamoDB's TTL deletes lazily. Kept the conveyor and the flat-vs-rising cost lines, which beat a calendar-of-chores framing because they show the payoff, not just the rules.

### Soft delete and object versioning (`soft-delete-and-versioning`)

**The aha**: Deletes and overwrites become reversible for a while, which protects against mistakes and bad scripts, but every kept version is billed.
**Misconception to defeat**: That an overwrite or delete is final (or, the other way, that keeping versions is free).
**Cast**: An object card `config.json` in a bucket, with a stack of earlier versions fanned behind it (v1, v2, v3). A recycle bin with a countdown. Switches "Versioning" and "Soft delete". A storage meter (GB billed).
**Opening frame**: `config.json` v3, switches off. _"Normally, overwrite or delete means gone."_
**Story**:

1. A bad script overwrites `config.json` with `{}`; v3's contents vanish, red. _"A bad script, and it's gone."_
2. Rewind; Versioning on. The same script runs: v3 slides back into the stack and an empty v4 sits on top. _"Versioning keeps the old one underneath."_
3. Drag v3 to the top: it's cloned as v5, identical to v3. _"Restore by promoting an old version."_
4. Soft delete on. Delete the object: the card drops into the bin with a "14 days" countdown; "Undelete" lifts it back. _"Deleted things wait in a bin."_
5. Another card's countdown hits zero and it's shredded. _"After the retention period, gone for real."_
6. A script rewrites the file hourly; the stack grows tall and the storage meter climbs. _"Every kept version is billed."_
   **The moment**: Beat 2 against beat 1: the same overwrite destroys the data, then merely pushes it one layer down.
   **Interaction**: The two switches, plus buttons Overwrite, Delete, Restore; watch the stack, the bin and the bill.
   **Ending**: Restored `config.json` on top, the stack beneath, the meter showing what it costs. The bucket's outline glows: everything kept lives inside it. _"Reversible for a while, in the same place: an undo, not a backup."_
   **Variants**: `storage-lifecycle-policies` (expire noncurrent versions), `immutable-storage-worm` (what an admin can't switch off), `storage-snapshots`, `backup-vs-replication`; platform: S3 Versioning (`aws-s3-versioning`; a delete adds a delete marker), Azure Blob soft delete and versioning (`azure-blob-data-protection`), GCS object versioning and soft delete.
   **Techniques**: toggle, layers, clone, move, timer, disappear, meter, boundary, caption.
   **Review**: Improved — the catalog lists backups as the usual confusion, and nothing in the story said that versions and the bin live in the same bucket as the data; the ending now does, in one caption, and hands off to `immutable-storage-worm`, whose opening shows an admin switching these protections off. The overwrite-then-rewind pair is the right moment: the same bad script, destroying and then merely burying the data.

### Immutable storage (WORM, legal hold) (`immutable-storage-worm`)

**The aha**: Under a locked retention policy or legal hold, nobody can change or delete the data until it expires, not even an administrator, so ransomware and rogue admins can't undo it.
**Misconception to defeat**: That soft delete or read-only permissions are enough. Anyone with admin rights can switch those off.
**Cast**: Two buckets side by side holding the same invoice cards. Left: "Soft delete + permissions". Right: the cards inside a glass case with a padlock tagged "locked until 2033". An attacker figure wearing an "admin" badge. A calendar.
**Opening frame**: Twin buckets, same invoices. _"Two buckets of records. One is locked."_
**Story**:

1. The attacker works the left bucket: removes the permission lock, flips soft delete off, encrypts the cards (they scramble red), deletes them. _"With admin rights, protections can be switched off."_
2. The same moves on the right: delete bounces off the glass; "shorten retention" is refused; "remove policy" is refused. _"Locked: no one can change or delete. Not even an admin."_
3. A new invoice drops into the right bucket; read tokens leave it freely. _"Write once, read many."_
4. The calendar runs to 2033; the padlock opens and a lifecycle rule may now delete. _"Time-based retention ends on its date."_
5. One card wears a "LEGAL HOLD" tag; the calendar runs past its date but it stays locked until legal removes the tag. _"A legal hold lasts until it's released."_
   **The moment**: Beat 2 against beat 1: the same attacker and the same actions leave one bucket empty and the other untouched.
   **Interaction**: Play the attacker: Delete, Overwrite, Shorten retention, Remove policy. A toggle "policy unlocked / locked" shows that an unlocked policy can still be removed, which is why locking matters.
   **Ending**: Right bucket intact, left empty. _"The protection an attacker can't undo."_
   **Variants**: `soft-delete-and-versioning`, `storage-lifecycle-policies`, `backup-vs-replication`; security's `ransomware` and `immutable-backups`; platform: S3 Object Lock (`aws-s3-object-lock`; governance mode can be bypassed with a special permission, compliance mode can't), Azure immutable blob storage, GCS Bucket Lock.
   **Techniques**: side by side, boundary, failure, restyle, timer, choice, toggle, caption.
   **Review**: Improved (links only) — the story is already the best: the same attacker, the same admin rights and the same four moves against two buckets is the most memorable failure this concept has, and the details are right (a locked policy can be extended but not shortened or removed, an unlocked one can be removed, hence the toggle; a legal hold outlasts its date until released). Variants now link Security's `ransomware` and `immutable-backups` by id and spell out S3's governance vs compliance mode.

## Data shapes, modelling and tenancy

### Structured, semi-structured, unstructured data (`structured-semi-unstructured-data`)

**The aha**: The shape of data decides where it can live and how you can query it: tables for structured, documents for semi-structured, object storage plus extraction for unstructured.
**Misconception to defeat**: That this is the same split as relational vs NoSQL (it's about the data's shape, not the product: relational databases hold JSON too), or that any data can be queried like a table.
**Cast**: Left, three pieces of data about one order: a row `order 1042 | customer 7 | 59.90 | 2026-03-02`; a JSON card with a nested `items` array and an optional `gift_note`; a photo of a crushed parcel plus a complaint email. Right, three homes: a table grid with fixed columns, a stack of document cards, an object bucket. A query bar along the bottom.
**Opening frame**: Three pieces, three homes. _"Three shapes of data."_
**Story**:

1. The row drops into the grid; each field clicks into its column. _"Structured: fixed columns, every row the same."_
2. The JSON card is pushed at the grid's fixed columns: its `items` array bulges out of the cells, red. It goes to the document stack instead, and so does a second order with different fields; a ghost `details JSON` column on the grid shows it could also live there whole. _"Semi-structured: nested, self-describing, can vary."_
3. The photo and email drop into the bucket as sealed files. _"Unstructured: no fields at all."_
4. The query `total > 50` runs against all three: rows light in the table, documents answer by field path, the bucket returns "?". _"Shape decides how you can ask."_
5. An extractor reads the photo and email and emits `{damaged: true, sentiment: angry}`, which joins the document. The query now finds it. _"Extract structure to make it queryable."_
   **The moment**: Beat 4. The same question meets three homes and gets three different outcomes.
   **Interaction**: Drag any piece to any home and see whether it fits and what is lost (the JSON fits a table's JSON column and stays queryable by path; flattened into fixed columns, its array is lost).
   **Ending**: All three homes filled, the query answering across them.
   **Variants**: `relational-model`, `document-database`, `object-storage`, `schema-on-write-vs-read`, `data-lake`, `vector-database`, `relational-vs-nosql`.
   **Techniques**: move, contents, failure, spotlight, choice, caption.
   **Review**: Improved — beat 2 as written (JSON bounced off the table, so it must go to a document store) taught the very confusion the catalog names, that semi-structured means NoSQL; a ghost JSON column now shows relational tables hold it too, so the lesson stays about shape. The same-query-three-outcomes moment is the strongest framing; a "sorting machine" opening was weighed and dropped because it shows where data goes, not why.

### Relational model (tables, keys, joins) (`relational-model`)

**The aha**: Each fact is stored once and linked by keys, so the database can enforce integrity and answer questions nobody planned for by joining tables.
**Misconception to defeat**: A database is a big spreadsheet with everything on one sheet.
**Cast**: A wide spreadsheet "Orders" in which "Ada Lovelace, London" repeats on four rows and "Alan Turing, London" on two. It becomes two tables, Customers (`id`, `name`, `city`) and Orders (`id`, `customer_id`, `total`). A gold key marks a primary key; an arrow marks a foreign key. A SQL card.
**Opening frame**: The spreadsheet with Ada's repeated details highlighted ×4. _"A spreadsheet repeats facts."_
**Story**:

1. The repeated columns lift out and merge into Customers rows (`7: Ada, London`, `8: Alan, London`); in Orders they're replaced by `customer_id 7` or `8`. _"Store each fact once."_
2. A gold key appears on Customers.id; arrows run from each `customer_id` to row 7. _"A key names a row; a foreign key points to one."_
3. Insert an order with `customer_id 99`: its arrow searches Customers, finds nothing, red flash, refused. _"Broken links are refused."_
4. Ada moves to Paris: one cell changes, and every order reads Paris through its arrow. _"Change it once, right everywhere."_
5. A question nobody planned: "revenue by city?". The SQL card reads `SELECT city, SUM(total) … JOIN …`. Order rows slide along their arrows to meet their customer rows, form a temporary combined table, and fold into `London 210 · Paris 340`. _"Joins answer new questions at query time."_
   **The moment**: Beat 5. Rows travel along key arrows to assemble an answer that was never stored anywhere.
   **Interaction**: Pick a question (orders per customer, revenue by city, customers with no orders) and watch the join path trace.
   **Ending**: Two tidy tables with a join result beside them.
   **Variants**: `normalization-vs-denormalization`, `relational-vs-nosql`, `query-execution-plan`, `database-indexes`, `acid-transactions`.
   **Techniques**: split / merge (new), contents, path trace, failure, restyle, choice, caption.
   **Review**: Improved — a continuity fix: with Ada as the only customer, "London 210 · Paris 340" was impossible once she had moved to Paris, so a second London customer joins the cast. Otherwise the plan is the right one: the spreadsheet is exactly the wrong model the catalog names, and rows travelling along key arrows to build an answer nobody stored is the moment; a "filing cabinet with cross-references" metaphor was weighed and is weaker than the real tables.

### Normalization vs denormalization (`normalization-vs-denormalization`)

**The aha**: Normalize to make writes safe; denormalize to make reads fast, and accept that every duplicate must be kept in step.
**Misconception to defeat**: That denormalizing is just sloppy design, or that normalizing is always right.
**Cast**: Side by side. Left "Normalized": Customers and Orders linked by a key. Right "Denormalized": an Orders table with customer name and city copied into each of its three rows, and an Invoices table that copied them once more. A reader (dashboard) and a writer (profile edit) on the far left. A timer per side.
**Opening frame**: Same data both ways; Ada's city appears ×1 on the left and ×4 on the right. _"One fact. Stored once, or four times."_
**Story**:

1. Read "orders with customer city": the left side joins (rows meet across the key), 12 ms; the right reads one table, 3 ms. _"Denormalized: reads skip the join."_
2. Write "Ada moved to Paris": left, one cell changes. _"Normalized: change one place."_
3. Right: four cells must change. The profile edit updates the three copies in Orders; nobody remembered the one in Invoices (it stays dark). _"Denormalized: change every copy, wherever it lives."_
4. Slow-down: the right side now says Paris three times and London once; the dashboard shows two cities for one customer, and the next invoice is addressed to London. _"Miss one copy and the data disagrees."_
5. A scoreboard appears: left "writes safe, reads join"; right "reads fast, writes multiply and can drift". Then the common answer: a normalized source with a denormalized read copy fed by a "refresh" arrow. _"Often both: truth normalized, copies for reading."_
   **The moment**: Beat 4: the database contradicting itself about one customer.
   **Interaction**: A dial "reads per write" that shifts the scoreboard. "Update city" buttons on both sides, with a list of copies to tick off on the right (untick one to see the drift).
   **Ending**: The source and read-copy picture with the scoreboard.
   **Variants**: `relational-model`, `materialized-views`, `access-pattern-data-modelling`, `star-schema`, `document-database`.
   **Techniques**: side by side, contents, timer, failure, restyle, dial, caption.
   **Review**: Improved — the failure was a crash halfway through one UPDATE, which a transactional database would roll back, so a practitioner would call it wrong; the drift now comes from what really causes it, a copy in a second table that the update code didn't know about. Kept the self-contradicting customer as the moment and the "truth normalized, copies for reading" resolution, which links `materialized-views`.

### Schema-on-write vs schema-on-read (`schema-on-write-vs-read`)

**The aha**: "Schemaless" doesn't mean no schema: the schema moves from the database into every piece of code that reads the data, so the cost of change moves from one migration to every reader.
**Misconception to defeat**: "NoSQL has no schema."
**Cast**: Two lanes. Top "Schema-on-write": writer → a gate holding a schema card (`name: text, age: int`) → table → three readers. Bottom "Schema-on-read": writer → open door → document store or lake → three readers, each with a small schema card inside it. Records are small cards.
**Opening frame**: Both lanes, gate on top, open door below. _"Where does the schema live?"_
**Story**:

1. Top: `{name: "Ada", age: "thirty"}` hits the gate and bounces, red. _"Checked at the door."_
2. Bottom: the same record walks straight in. _"Stored as-is..."_
3. Bottom: Reader A loads it; its card says `age: int`; red flash inside the reader. _"...and checked by whoever reads it."_
4. Rename `name` to `full_name`. Top: one migration sweeps the table, every row reshapes, and the readers' cards swap one word: one shape, from now on. Bottom: new records say `full_name`, old ones keep `name`; all three readers' cards grow a line "name or full_name", for as long as old records exist. _"Change cost moves from one migration to every reader, for good."_
5. Spotlight on the three cards inside the bottom readers. _"The schema didn't disappear. It moved into the code."_
   **The moment**: Beat 5. The open door, then the schema cards lit inside every reader.
   **Interaction**: Choose a change (add a field, rename a field, send a bad record) and see where the cost lands in each lane.
   **Ending**: Both lanes with cost markers: one at the gate on top, three at the readers below.
   **Variants**: `structured-semi-unstructured-data`, `document-database`, `data-lake`, `schema-migrations`, `schema-compatibility`.
   **Techniques**: lanes, side by side, token, failure, restyle, spotlight, choice, caption.
   **Review**: Improved — the rename beat implied readers on the schema-on-write side change nothing, which isn't true (their queries still say `name`); the honest difference is that they learn one new shape once, while schema-on-read readers must handle every shape ever written. The gate-vs-open-door lanes and the spotlight on schema cards inside the readers are the best framing; a "bouncer vs everyone checks ID" metaphor was weighed and is less exact.

### Access-pattern-driven modelling (NoSQL) (`access-pattern-data-modelling`)

**The aha**: In key-value and document stores you list the questions first and store what's read together under one key, because there are no cheap joins later.
**Misconception to defeat**: Model the entities first and normalize, as you would for a relational database.
**Cast**: Query cards pinned at the top: Q1 "Order with its lines and customer name", Q2 "A customer's orders, newest first". Partition cylinders labelled by key. Design A: separate items for Customer, Order and each OrderLine, scattered across partitions. Design B: one partition `CUST#7` holding `PROFILE` and items `ORDER#2026-03-02#1042` (lines embedded, customer name copied), sorted by sort key. A latency meter.
**Opening frame**: Only the query cards, before any data. _"Start with the questions."_
**Story**:

1. Design A runs Q1: the app fires five reads at three partitions and stitches the answer; the latency meter ticks up once per round trip. _"No joins: the app stitches pieces, one trip at a time."_
2. Design B runs Q1: one get by key returns the order item with lines and name. _"Store together what's read together."_
3. Design B runs Q2: one query on `CUST#7` with prefix `ORDER#` lights a contiguous, already-sorted slice. _"The key answers the question."_
4. A new question, Q3 "all orders over $500": no key answers it, so every partition lights and the meter crawls. _"Unplanned questions are expensive."_
5. The customer renames: the copied name in each order item must update. _"Duplication is deliberate, and it has to be maintained."_
   **The moment**: Beats 1 and 2 side by side: five scattered round trips against one read.
   **Interaction**: Pick a query card and run it against either design; add a secondary index to rescue Q3.
   **Ending**: The query list with ticks beside Q1 and Q2 and a warning beside Q3.
   **Variants**: `normalization-vs-denormalization`, `key-value-store`, `document-database`, `wide-column-store`, `local-vs-global-secondary-indexes`; platform: DynamoDB single-table design, Cosmos DB partition keys, Bigtable row keys.
   **Techniques**: contents, token, meter, side by side, spotlight, choice, caption.
   **Review**: Keep — opening on the questions before any data is itself the lesson, five scattered round trips against one keyed read is an unmistakable contrast, and Q3 plus the rename beat show the price honestly. The key shapes (`CUST#7`, sort key `ORDER#date#id`, prefix query) are how DynamoDB single-table design really works. Weighed an ER-diagram-first opening that then fails, but beat 1's Design A already plays the wrong model.

### Views vs materialized views (`materialized-views`)

**The aha**: A view reruns its query on every read; a materialized view stores the answer ahead of time, trading freshness and storage for read speed.
**Misconception to defeat**: That a plain view stores data, or that a materialized view is always current.
**Cast**: Left, an Orders cylinder with many rows. Middle, two boxes: "View `sales_by_day`" (dashed outline holding only a query card) and "Materialized view `sales_by_day`" (solid, holding seven result rows). Right, dashboard clients. A database CPU meter.
**Opening frame**: The dashed box with its query card, the solid box with rows. _"A view is a saved question. A materialized view is a saved answer."_
**Story**:

1. A dashboard reads the view: the query fires, a thick stream of rows flows from Orders through a sum gear, and the answer returns in 2.4 s. _"A view does the work on every read."_
2. Two more dashboards read; the stream runs twice more and the CPU meter pegs. _"...every read, every time."_
3. A dashboard reads the materialized view: rows come straight back in 40 ms, with no stream from Orders. _"Computed once, ahead of time."_
4. A new order lands. The view's next answer includes it; the materialized row still shows the old total and gets a "stale" badge with a timer. _"Only as fresh as its last refresh."_
5. A refresh runs once: the stream flows, the rows update, the badge clears. _"Refresh recomputes it, once, for everyone."_
   **The moment**: Beat 4 side by side: the view with the new order at 2.4 s, the materialized view without it at 40 ms.
   **Interaction**: Dials for refresh interval and number of readers move the CPU meter and the staleness timer. An "insert order" button. A toggle "refresh on a schedule / maintain on every write" (SQL Server indexed views, Oracle refresh on commit, BigQuery's automatic refresh): the stale badge never appears, and each insert now carries a little extra work.
   **Ending**: Both show the same numbers just after a refresh, with the trade captioned.
   **Variants**: `normalization-vs-denormalization`, `change-data-capture`; architecture's `cqrs`; scaling's `cache-aside` and `materialised-view` (the read-to-write economics of precomputing; this plan keeps to view vs materialized view).
   **Techniques**: side by side, stream, timer, meter, restyle, dial, toggle, caption.
   **Review**: Improved — "only as fresh as its last refresh" is true of PostgreSQL but not of engines that maintain the view on every write, so the interaction adds that mode and shows where its cost goes; the variants now separate this plan from Scaling's `materialised-view` (a different id about precomputation economics) instead of suggesting one plan for both. "A saved question vs a saved answer" is the sharpest framing available and stays.

### Multi-tenant data isolation models (`multi-tenant-data-isolation`)

**The aha**: Isolation, cost and effort trade against each other: shared tables are cheapest but one missing filter or one heavy tenant affects everyone; a database each is safest and hardest to run at scale.
**Misconception to defeat**: That a tenant-ID filter is isolation, or that tenancy is just sharding.
**Cast**: Three tenants as colours: Acme (blue), Globex (green), Initech (orange). A slider along the bottom: Shared table · Schema per tenant · Database per tenant · Tenants across shards. Three meters: Isolation, Cost, Ops effort. Each tenant's client on the left with a response timer.
**Opening frame**: One cylinder with interleaved blue, green and orange rows, each prefixed `tenant_id`. _"Shared tables: everyone's rows side by side."_
**Story**:

1. Acme queries `WHERE tenant_id = 'acme'` and only blue rows return. _"A filter keeps tenants apart..."_
2. A buggy query forgets the filter: green and orange rows flow to Acme's screen, red flash. _"...forget it once and data leaks."_
3. Initech runs a huge report: the single CPU meter pegs and Acme's and Globex's timers stretch. _"One heavy tenant slows everyone."_
4. Slide to schema per tenant: the cylinder grows walled compartments. The forgotten filter now bounces off the walls; the heavy report still slows everyone, because they share one server. Meters shift.
5. Slide to database per tenant: three cylinders, each with its own CPU meter. A forgotten filter can't reach another tenant; Initech's load spikes only its own meter. Then zoom out to 3,000 tenants: a wall of tiny cylinders, and an "add column" migration crawls through them. _"Safest, and hardest to run at scale."_
6. Slide to shards: small tenants pooled on shared cylinders, a big tenant alone, a tenant-to-shard map in front. _"Pool the small, isolate the big."_
   **The moment**: Beat 2 against beat 5: the leak through a missing filter, then the 3,000-cylinder zoom-out that shows what full isolation costs.
   **Interaction**: The slider, plus "forget the filter" and "heavy report" buttons available at every position.
   **Ending**: The hybrid position, with the three meters balanced.
   **Variants**: `database-sharding`; architecture's `multitenancy`, `tenancy-models` and `noisy-neighbour`; row-level security (the database enforcing the tenant filter) belongs in Security.
   **Techniques**: dial, boundary, contents, failure, meter, zoom, timer, caption.
   **Review**: Improved — two overclaims fixed: database per tenant makes a forgotten filter harmless but doesn't make leaks impossible (a wrong connection string still leaks), and it only isolates load when each database has its own compute, so the cylinders now carry their own CPU meters. The variants pointed at ids that don't exist (`tenant-data-isolation`, `noisy-neighbor`) and now use Architecture's real ones. The slider with two failure buttons at every position is the right machine; it beats four separate mini-stories.

## Database families

### Relational vs NoSQL (`relational-vs-nosql`)

**The aha**: NoSQL isn't automatically more scalable or less consistent: each family gives up query flexibility to serve one access pattern well, and most systems use several stores side by side.
**Misconception to defeat**: "SQL doesn't scale; NoSQL means no SQL, no schema, no consistency."
**Cast**: Five stores across the right: a relational cylinder, a key-value locker wall, a stack of JSON document cards, a wide sorted grid (wide-column), and a node-and-edge web (graph); a little apart, a search index. Left, an e-commerce app box with features: Orders, Cart, Catalogue, Recommendations, Search.
**Opening frame**: The usual story as two labels: "SQL: old, doesn't scale" and "NoSQL: scales, no schema". _"The usual story."_
**Story**:

1. Myth check: the relational cylinder splits into shards with a "distributed SQL" tag; a NoSQL store flips a "strong consistency" switch and shows its SQL-like query language (CQL, PartiQL). Both labels crack and fall away. _"Scale and consistency aren't the dividing line."_
2. Under each store appears what it answers best: relational "any question, joins"; key-value "get by key"; document "a whole aggregate"; wide-column "a range within a partition"; graph "follow relationships". _"The real line: each trades flexibility for one pattern."_
3. An ad-hoc query "revenue by city last month" hits all five: relational answers; the others scan or refuse. _"Flexibility is what you give up."_
4. Each app feature draws a line to its best store: Orders → relational, Cart → key-value, Catalogue → document, Recommendations → graph, Search → the search index. _"Most systems use several, side by side."_
   **The moment**: Beat 4. The app wired to five stores at once replaces "pick one side".
   **Interaction**: Pick a feature or a query and see which stores answer it in one step and which struggle.
   **Ending**: The polyglot wiring diagram.
   **Variants**: `key-value-store`, `document-database`, `wide-column-store`, `graph-database`, `search-engine-database`, `distributed-sql`, `access-pattern-data-modelling`, `schema-on-write-vs-read` (where NoSQL's schema went).
   **Techniques**: restyle, disappear, token, path trace, choice, spotlight, caption.
   **Review**: Improved — the labels used to crack in beat 1 before any evidence, with the counter-examples arriving two beats later; the myth check now comes first and is what breaks them, so the viewer sees why the usual story is wrong before being told the real dividing line. The search engine Search wires to is now in the cast. A "one toolbox, many tools" metaphor was weighed and dropped: the wiring diagram is the same idea with the real stores.

### Key-value store (`key-value-store`)

**The aha**: Lookup by exact key is as fast and scalable as storage gets, but you can't ask anything the key doesn't answer.
**Misconception to defeat**: That it can search by value, or that it's only a cache (many are durable databases).
**Cast**: A wall of lockers, each door labelled with a key (`user:42`, `cart:42`, `session:8f2a`) and each value a sealed box. A hash funnel in front. A client on the left. A latency meter.
**Opening frame**: Client, funnel, lockers. _"A key, and an opaque value. That's all."_
**Story**:

1. `GET user:42`: the key drops through the funnel, a beam points to exactly one locker, and the sealed box comes back in 1 ms. _"Exact key: straight to the value."_
2. `PUT cart:42` stores a box; `DELETE` empties a locker. _"Get, put, delete."_
3. The wall splits across four partition cylinders by key hash. A thousand clients fire GETs, each reaching exactly one partition; the latency meter stays flat. _"Every request touches one place, so it scales out."_
4. "Which users live in Paris?": the funnel has nothing to hash, so every locker opens one by one and the meter climbs off the scale. _"Anything else means opening every locker."_
5. A new locker appears: `city:paris → [42, 77, 103]`. _"So you design keys for the questions you'll ask."_
   **The moment**: Beat 1 against beat 4: one beam to one locker, then every locker flickering.
   **Interaction**: Type a key to look it up, or choose "search by value" to watch the scan. A "restart" button beside a twin wall labelled "cache": after it, the key-value database's lockers are still full and the cache's come back empty. _"A cache may forget. A database mustn't."_
   **Ending**: The locker wall with the extra designed key.
   **Variants**: `access-pattern-data-modelling`, `document-database`, `consistent-hashing`; scaling's `distributed-cache` and `cache-aside`; platform: DynamoDB, Azure Table Storage, Redis, Memorystore.
   **Techniques**: contents, token, path trace, meter, spotlight, choice, caption.
   **Review**: Improved — the plan named "it's only a cache" as a misconception but never defeated it; a restart button against a twin cache wall now does, without adding a beat. The lockers with one beam against every door flickering is the best framing for exact-key lookup; a phone-book metaphor was weighed and is worse, because a phone book is sorted and invites range questions a hash can't answer.

### Document database (`document-database`)

**The aha**: One document holds a whole aggregate (an order with its lines), so one read returns everything; relationships between documents are where it gets hard.
**Misconception to defeat**: That it's a relational row with nesting, or a key-value store that happens to hold JSON (documents are queryable by any field).
**Cast**: Side by side. Left: the same order as rows across three tables (Orders, OrderLines ×3, Customers). Right: one JSON card `order 1042` with nested `customer {id, name}`, `lines [...]`, `shipping {country}`, in a stack of document cards. A client.
**Opening frame**: Five rows in three tables against one card. _"Same order, two shapes."_
**Story**:

1. Read order 1042: left, tokens gather rows from three tables and assemble them; right, one card lifts out whole. _"One document, the whole aggregate, one read."_
2. Query `shipping.country = 'CA'`: an index on that field lights the matching cards. _"Any field can be indexed and queried."_
3. A new order arrives with an extra field `gift_wrap: true` and is simply stored. _"Documents can vary in shape."_
4. Ada changes her name: the name is embedded in 50 order documents, and all 50 flicker as they update. _"Copy it in, and you update every copy..."_
5. Toggle to "reference": orders hold only `customer_id`; reading an order with the name now takes a second lookup. _"...or reference it, and join it yourself."_
   **The moment**: Beat 1: three tables assembled against one card lifted out whole.
   **Interaction**: Toggle "embed / reference" for the customer and compare read cost with update cost.
   **Ending**: The card with the embed-or-reference trade captioned.
   **Variants**: `relational-model`, `key-value-store`, `access-pattern-data-modelling`, `normalization-vs-denormalization`; architecture's `ddd-aggregate`; platform: Cosmos DB, Firestore, DocumentDB.
   **Techniques**: side by side, contents, token, spotlight, toggle, restyle, caption.
   **Review**: Keep — five rows gathered from three tables against one card lifted out whole is the aggregate idea in a single frame, and the embed-or-reference toggle puts "where it gets hard" in the viewer's hands rather than a caption's. Beat 2 (query by any indexed field) separates it from a key-value store, as the misconception requires. Weighed a "folder of paper forms" metaphor; the real JSON card is clearer and needs no translation.

### Wide-column (column-family) store (`wide-column-store`)

**The aha**: Rows are kept sorted by key within each partition, so you design the key to make each query one contiguous read, and the store takes huge write volumes.
**Misconception to defeat**: That "wide-column" means columnar analytical storage.
**Cast**: Three partition cylinders labelled by partition key: `sensor-A`, `sensor-B`, `sensor-C`. Inside each, rows sorted by timestamp (the clustering key, newest first), each with a sparse set of columns (`temp`, `humidity`, `battery`, some missing). A query bar.
**Opening frame**: Three cylinders, each holding one sensor's readings in time order. _"Partition key picks the node. Clustering key sorts the rows."_
**Story**:

1. A write storm streams in from the left; each reading goes to its sensor's cylinder and slots into sorted position. A write meter runs high with no slowdown. _"Built for huge write volumes."_
2. `sensor-B, last hour`: the query goes to one cylinder and a highlight band covers one contiguous slice. _"Good key: one partition, one contiguous read."_
3. Zoom on two rows: one has `battery`, the other doesn't, and no empty cell is stored. _"Columns vary per row."_
4. `all sensors where temp > 30`: every cylinder lights and scans end to end. _"A query the key doesn't serve hits everything."_
5. Inset: a columnar file with each column stored separately for analytics, tagged "not this". _"Wide-column isn't columnar analytics."_
   **The moment**: Beat 2 against beat 4: one tidy slice against every cylinder scanning.
   **Interaction**: Choose the partition and clustering keys (by sensor, by day, by sensor and day) and run the queries to see contiguous reads, scatter, or a hot partition.
   **Ending**: The single highlighted slice.
   **Variants**: `columnar-storage`, `access-pattern-data-modelling`, `range-vs-hash-partitioning`, `hot-partition`, `b-tree-vs-lsm-tree`; platform: Bigtable row-key design, Cassandra, HBase, Amazon Keyspaces.
   **Techniques**: contents, stream, spotlight, zoom, choice, side by side, caption.
   **Review**: Keep — sensors as partitions and time as the clustering key is the canonical, honest example; one highlighted slice against every cylinder scanning is the moment, the sparse-row zoom earns its few seconds, and the "not columnar analytics" inset defeats the catalog's named confusion directly. The key-choice interaction (by sensor, by day, by sensor and day) also surfaces unbounded and hot partitions without extra beats.

### Graph database (`graph-database`)

**The aha**: When the question is about connections, following edges beats piling up joins that grow with every hop.
**Misconception to defeat**: "Tables with foreign keys already do this."
**Cast**: Side by side, the same small social network. Left: a People table and a long Friendships table (`person_a`, `person_b`) with its index. Right: people as circles joined by edges "FRIENDS". A hop counter, a work meter and a query card under each side (SQL left, Cypher right). The question: "friends-of-friends of Ada who climb".
**Opening frame**: The same people both ways. _"Same data: tables, or a graph."_
**Story**:

1. Hop 1: right, light runs from Ada along her three edges; left, a lookup beam goes into the whole Friendships index and returns Ada's rows. Both meters are low. _"One hop: both are fine."_
2. Hop 2: right, the light steps one edge further from each friend; left, every friend becomes another lookup into the whole index, and the SQL card grows a second self-join. _"Each hop is another join..."_
3. Hops 3 and 4: the SQL card is four self-joins long and the left meter climbs steeply as lookups multiply; the Cypher card stays one line, `(ada)-[:FRIENDS*1..4]-(p)`, and the right light touches only the people it reaches. _"...a graph just follows edges from where it is."_
4. A fraud example: accounts sharing a phone and a card light up as a closed loop. _"When the question is the connections."_
   **The moment**: Beat 3, with the two meters pulling apart hop by hop and the SQL card lengthening beside a one-line pattern.
   **Interaction**: A hop dial from 1 to 5 and a network-size dial (a thousand people to a hundred million, Ada's circle unchanged): the join's cost grows with both, the traversal's only with what it touches. Click any person to start from them.
   **Ending**: The graph with the traced path and the two meters.
   **Variants**: `relational-model`, `relational-vs-nosql`, `database-indexes`; platform: Amazon Neptune, Cosmos DB for Apache Gremlin, Spanner Graph.
   **Techniques**: side by side, path trace, meter, dial, contents, spotlight, caption.
   **Review**: Improved — the old beats blamed a ballooning stack of intermediate rows, but the friends-of-friends frontier balloons on both sides; the real difference is that each relational hop looks rows up in the whole Friendships table while a traversal steps along pointers from where it stands. The beats now show that, with the lengthening SQL against one Cypher line, and a network-size dial proves the cost tracks what's touched, not the table's size. Weighed a pure "query length" framing; it's memorable but explains nothing about speed, so it rides along rather than leading.

### Time-series database (`time-series-database`)

**The aha**: Data arrives in time order and is read by time range, so the engine compresses heavily and drops old data cheaply; too many distinct tag combinations is what hurts.
**Misconception to defeat**: That it's any database with a timestamp column, or a log store.
**Cast**: A time axis running to "now" on the right. Points streaming in from three servers, tagged `host=web1, region=eu`. Storage as hourly chunks along the axis. A series list (one line per tag combination). A retention cliff at the left edge. A memory meter.
**Opening frame**: Points arriving at "now" and filling the newest chunk. _"Measurements, arriving in time order."_
**Story**:

1. Every point lands at the right end, never in the middle. _"Always appended at now."_
2. An older chunk squeezes: `1000, 1001, 1003` becomes `+1, +2`, and the chunk shrinks about 10×. _"Neighbouring values are alike: compress hard."_
3. "CPU, last 6 hours, 5-minute averages": a bracket covers six chunks and a downsampled line draws above them. _"Read by time range: only those chunks."_
4. Chunks older than 30 days tip over the cliff whole. _"Old data drops off a chunk at a time."_
5. Add a tag `user_id` with a million values: the series list explodes from 30 lines into a wall, and the memory meter goes red. _"What hurts: too many tag combinations."_
   **The moment**: Beat 5. The series count jumps from 30 to 30 million when one tag is added, showing that cardinality, not volume, is the enemy.
   **Interaction**: A dial for distinct tag values drives the series count and memory meter; a retention slider moves the cliff.
   **Ending**: Loops the steady stream: append, compress, drop.
   **Variants**: `partitioned-tables`, `storage-lifecycle-policies`, `stream-windowing`; observability's `metric-time-series` and `metric-cardinality` (the same cardinality cliff, seen from the metrics side); platform: Amazon Timestream, Azure Data Explorer, Bigtable for time series.
   **Techniques**: stream, lanes, contents, restyle, chart, disappear, meter, dial, caption.
   **Review**: Improved (links only) — the plan is already the best: append, compress, read by range and drop whole chunks build up to the cardinality jump (30 series to 30 million when one tag is added), which defeats "volume is the enemy" in a single beat, and the numbers are right (delta encoding, about 10× compression, chunk-at-a-time retention). Variants now name Observability's `metric-time-series` and `metric-cardinality` by id.

### Search engine (inverted index) (`search-engine-database`)

**The aha**: Search turns the data inside out: instead of scanning documents for a word it looks the word up, and the index is a derived, eventually consistent copy, not the source of truth.
**Misconception to defeat**: That a `LIKE '%word%'` query does the same job.
**Cast**: Left, a database cylinder holding review cards: D1 "red running shoes", D2 "trail running jacket", D3 "red dress". Right, the inverted index as a word list: `jacket → D2`, `red → D1 D3`, `running → D1 D2`, `shoes → D1`. A search box.
**Opening frame**: The cards and an empty search box. _"Find every document that mentions 'running'."_
**Story**:

1. `LIKE '%running%'`: a scanner beam reads every word of every card. Zoom out to 10 million cards and the beam crawls. _"LIKE reads every document."_
2. Build the index: each card's words fly out, lowercased, and land under their entry in the word list, which collects document ids. _"Index once: each word points to its documents."_
3. Search "running": jump straight to its entry, and D1 and D2 light up. _"Search looks the word up."_
4. Search "red runing shoes": the typo still matches "running", D1 matches three words and ranks first, and score bars appear. _"Ranked by relevance, tolerant of typos."_
5. A new review D4 is written to the database. An arrow carries it toward the index; for a moment a search misses it, then it appears. _"A derived copy: it lags the database."_
   **The moment**: Beats 2 and 3. Documents fan out into a word-to-documents list, and the search becomes one jump instead of a crawl.
   **Interaction**: Type a search term to see the entry and its document list light; a "LIKE scan" toggle for the timing comparison.
   **Ending**: The index including D4, the database labelled "source of truth".
   **Variants**: `database-indexes`, `vector-database`, `change-data-capture`, `materialized-views`, `strong-vs-eventual-consistency`; platform: Amazon OpenSearch Service, Azure AI Search, Elasticsearch.
   **Techniques**: split / merge (new), contents, path trace, timer, token, zoom, toggle, caption.
   **Review**: Keep — documents fanning out into a word-to-documents list is literally "turning the data inside out", and the crawl-versus-jump contrast against `LIKE` defeats the named misconception on screen. The second half of the catalog's idea (a derived, lagging copy) gets its own beat with a visible miss. Accurate as drawn: terms are normalised, fuzzy matching and relevance scoring are real query features, and the index trails the database by its refresh and sync delay. A "book's back-of-index" metaphor was weighed; it's the same picture, and the real cards are clearer.

### Vector database (`vector-database`)

**The aha**: It retrieves by similarity of meaning rather than exact match, and approximate indexes give up a little accuracy for a very large gain in speed.
**Misconception to defeat**: That it's a keyword search engine.
**Cast**: A 2-D "meaning map" with dots for documents in clusters: pets ("cat refuses food", "pet off its dinner"), billing ("refund my invoice"), travel. An embedding gear that turns text into a list of numbers `[0.12, −0.80, …]` and a pin. A search box. Later, the map divided into cells.
**Opening frame**: The clustered map. _"Similar meanings sit close together."_
**Story**:

1. "my kitten won't eat" goes through the gear, becomes numbers, and lands as a pin near the pets cluster. _"Text becomes a point in meaning-space."_
2. A keyword search for the same words finds nothing (red X), because the best documents share none of its words ("cat refuses food"). A circle grows from the pin and catches it. _"Nearest by meaning, not matching words."_
3. Exact search: lines run from the pin to all 10 million points and the timer drags. _"Exact: compare with everything."_
4. The map divides into cells. The query visits only its own cell and two neighbours and finds the top five fast. One true neighbour just across a cell edge stays faint, missed. Meters: recall 98%, speed 100×. _"Approximate: a little accuracy for a lot of speed."_
   **The moment**: Beat 4. The faint missed neighbour beside the speed meter makes the trade visible.
   **Interaction**: A dial for "cells searched" moves recall and latency in opposite directions. A toggle adds exact keywords back ("hybrid"), since real systems often combine both.
   **Ending**: The pin with its five nearest neighbours highlighted.
   **Variants**: `search-engine-database`; in AI systems, embeddings, approximate nearest-neighbour indexes (HNSW, IVF) and RAG; platform: Azure AI Search vectors, pgvector, Vertex AI Vector Search.
   **Techniques**: contents, token, spotlight, timer, boundary, meter, dial, caption.

**Review**: Improved — beat 2 could not work as written: the query "my kitten won't eat" shares the word "kitten" with the "kitten diet" document, so a keyword search would have found it. The cluster now uses wording with no overlap, so the red X is honest. A hybrid toggle names what production systems do. The faint missed neighbour next to the speed meter stays as the moment; a graph-walk (HNSW) picture was weighed, but the cell picture is simpler and the dial teaches the same trade.

### Distributed SQL (NewSQL) (`distributed-sql`)

**The aha**: These databases get NoSQL-style scale-out with relational guarantees by running consensus per shard and coordinating transactions across shards, and they pay for it in write latency.
**Misconception to defeat**: That it's just a relational database sharded by hand.
**Cast**: A SQL client on the left talking to one endpoint. Behind it, three partitions labelled by key range (A `1–3000`, B `3001–6000`, C `6001–9999`). Each partition is three replica cylinders side by side across three zones, one crowned leader. A write-latency meter. Inset: a ghost of manual sharding (an app with routing code and two separate databases).
**Opening frame**: One endpoint in front of three replicated shards. _"Looks like one database. Underneath: shards, each replicated."_
**Story**:

1. Update id 7: it goes to A's leader, rows stream to two followers, and the commit lands when two of three confirm. _"Each shard agrees by majority."_
2. A's leader flashes red and greys; a follower takes the crown and writes continue. _"Lose a node, keep going."_
3. Transfer from id 7 (A) to id 9052 (C): a coordinator prepares both shards, each through its own majority, then commits both together. _"Cross-shard transactions stay all-or-nothing."_
4. Slow-down on the latency meter: one machine 1 ms; across zones a few ms; across regions tens of milliseconds up to 100+ depending on distance, with each round trip drawn. _"The price: every write waits for agreement."_
5. Inset replay: manual sharding. The app debits A, crashes before crediting C, and the money vanishes. _"By hand, cross-shard writes aren't atomic."_
   **The moment**: Beat 3 against beat 5: the same transfer is atomic in one picture and half done in the other.
   **Interaction**: Kill any node. A dial spreads replicas across zones or regions and moves the latency meter. Toggle "distributed SQL / manual shards".
   **Ending**: The transfer committed on both shards, latency shown.
   **Variants**: `two-phase-commit`, `consensus-raft-paxos`, `database-sharding`, `shard-rebalancing`, `serializability`, `pacelc`; platform: Spanner (TrueTime), CockroachDB, YugabyteDB (all run consensus per shard as drawn); Aurora DSQL reaches the same guarantees by a different route (optimistic concurrency over a distributed log, no leader per shard), so give it its own plan rather than reusing this one.
   **Techniques**: boundary, stream, exchange, failure, meter, dial, toggle, side by side, caption.

**Review**: Improved — the region latency was a flat "about 100 ms", which depends on the distance (tens of ms to 100+), and the variants listed Aurora DSQL beside Spanner as if the same machinery, which it is not. The beat 3 against beat 5 contrast (one transfer atomic, the same transfer half done by hand) is the sharpest framing; a pure latency chart was weighed and lost, since it shows the price but not what it buys.

## Transactions and concurrency

### ACID transactions (`acid-transactions`)

**The aha**: All or nothing: if anything fails part-way, every change is rolled back, so nobody ever sees half a money transfer.
**Misconception to defeat**: That a sequence of individually safe writes is safe, and the mix-up of ACID's C with CAP's C.
**Cast**: A cylinder with rows `alice: 100`, `bob: 50` and a badge "total = 150". One blue transaction band on the timeline with dots `alice −30`, `bob +30`, `COMMIT`. A lightning icon for a crash. A grey observer client.
**Opening frame**: The rows and the total badge. _"Move $30 from Alice to Bob."_
**Story**:

1. No transaction: `alice → 70` is written, then lightning; the restart shows `70 / 50` and the badge goes red at 120. _"Two separate writes: a crash loses $30."_
2. With a transaction: the band begins, and `alice 70` appears in pencil. Lightning. On restart the pencil is erased and the row is back to 100. _"Atomic: a failure undoes everything."_
3. Run again: both pencil values, then the COMMIT dot inks both rows at the same instant; the badge stays 150. _"Commit: all changes become real together."_
4. The observer reads mid-band and sees `100 / 50`, never `70 / 50`. _"Isolated: no one sees half (at the usual default levels)."_
5. Lightning just after COMMIT; on restart the rows still read `70 / 80` (a log icon pulses). _"Durable: committed survives a crash."_
6. Try moving $200: a rule "balance ≥ 0" refuses, and the whole band rolls back. _"Consistent: the rules hold."_
   **The moment**: Beat 1 against beat 2: the same crash loses money without a transaction and changes nothing with one.
   **Interaction**: A "crash here" pointer that can be dropped anywhere on the band. Wherever it lands, the result is the old state or the new one, never half.
   **Ending**: The letters A, C, I, D, each pinned to its beat icon, with the badge at 150. The C is tagged "your rules hold", with a ghost of CAP's C ("all copies agree") crossed out beside it.
   **Variants**: `isolation-levels` (how much "no one sees half" holds at each level), `write-ahead-log`, `two-phase-commit`, `cap-theorem` (the other C); messaging's `saga`.
   **Techniques**: lanes, contents, restyle, failure, side by side, choice, meter, caption.

**Review**: Improved — the plan named the C mix-up in its misconception but never showed it, so the ending now contrasts ACID's C (the application's rules, enforced by constraints) with CAP's; beat 4's isolation claim is qualified because it depends on the level, with a hand-off to `isolation-levels`. The crash-then-compare pair is the right moment, and a "bank vault door" metaphor was weighed and dropped as decoration.

### Isolation levels (`isolation-levels`)

**The aha**: Weaker levels are faster but allow specific anomalies, and the same level name means different things in different databases.
**Misconception to defeat**: That the default level is "safe", or that "repeatable read" means the same everywhere.
**Cast**: Left, a dial with four levels: read uncommitted, read committed, repeatable read / snapshot, serializable. Right, a grid with the levels as rows and the anomalies as columns (dirty read, non-repeatable read, phantom, lost update, write skew). Centre, a small two-band stage (T1 blue, T2 orange) that replays an anomaly. A throughput meter. Vendor tabs: PostgreSQL · SQL Server · MySQL · Oracle, each marking its default level.
**Opening frame**: An empty grid, dial at read committed. _"How much can concurrent transactions see of each other?"_
**Story**:

1. Dial to read uncommitted: the stage plays a dirty read and its cell fills red, "allowed". Throughput is high. _"Weakest: even uncommitted data shows."_
2. Dial to read committed: the dirty read replays and is blocked (its cell turns green); a non-repeatable read plays and gets through (red), and so does a lost update. _"Each level up blocks another anomaly..."_
3. Dial to snapshot: non-repeatable reads and phantoms are blocked, but write skew plays and slips through. _"...but not all of them."_
4. Dial to serializable: every cell is green, one band aborts with "retry", and throughput dips. _"Strongest costs waits and retries."_
5. Click the vendor tabs: the repeatable-read row reshuffles. PostgreSQL gives a snapshot and aborts a lost update; SQL Server holds read locks but lets phantoms in; MySQL (InnoDB) gives snapshot reads but lets a plain read-then-write lose an update. The default markers sit on read committed for PostgreSQL, SQL Server and Oracle, repeatable read for MySQL (Azure SQL Database defaults to read committed with row versioning). Oracle's "serializable" is really snapshot, so write skew slips through. _"Same name, different guarantees."_
   **The moment**: Beat 5. The vendor tabs reshuffle one row of the grid in place.
   **Interaction**: The level dial and vendor tabs; click any cell to replay that anomaly at that level.
   **Ending**: The filled grid beside the throughput meter, the default marker on a red-celled row. _"Your default is not the safe one."_
   **Variants**: `dirty-read`, `non-repeatable-read`, `phantom-read`, `lost-update`, `write-skew`, `mvcc`, `serializability`; `strong-vs-eventual-consistency` (consistency models, a different axis); Azure SQL's read-committed-snapshot default.
   **Techniques**: dial, lanes, contents, restyle, toggle, meter, failure, caption.

**Review**: Improved — three accuracy gaps: lost update was in the grid but never played at the lower levels; the defaults (the actual answer to "is the default safe?") were not on screen; and Oracle's "serializable" is snapshot isolation, the sharpest example of a name that lies. The vendor-tab reshuffle stays as the moment. Weighed a plain table of levels against anomalies; the dial that fills it while the stage replays each anomaly teaches the same thing with cause attached.

### Dirty read (`dirty-read`)

**The aha**: Reading another transaction's uncommitted write means acting on data that may never exist; read committed and anything stronger prevent it.
**Misconception to defeat**: Mixing it up with non-repeatable read. What matters here is that the value was never committed.
**Cast**: A cylinder row `order 1042: status = paid`, in ink. T1 (blue, "Refund job") and T2 (orange, "Email job") on the timeline. An envelope icon.
**Opening frame**: The row, two empty bands. _"T1 will change an order. T2 will read it."_
**Story**:

1. T1 writes `refunded`: a dot on T1, and the row shows "refunded" in blue pencil over "paid". _"T1 writes, but hasn't committed."_
2. At read uncommitted, T2 reads: a line runs from the pencil value to T2's dot, "refunded". _"T2 reads the uncommitted value..."_
3. T2 sends "Your refund is on its way" (the envelope flies off-screen) and commits. _"...and acts on it."_
4. Slow-down: T1 hits an error and rolls back. The pencil erases and the row is "paid" in ink again. The sent envelope gets a red outline. _"The refund never happened. The email went out anyway."_
5. Replay at read committed: at beat 2, T2's line passes the pencil and lands on the ink "paid", and no email is sent. _"Read committed: only ever see committed data."_
   **The moment**: Beat 4. The pencil value erases while its consequence is already out of reach.
   **Interaction**: Toggle read uncommitted / read committed and replay; scrub the timeline. A note that PostgreSQL won't allow this at all (its read uncommitted behaves as read committed), and that SQL Server's `NOLOCK` hint is the same thing under another name.
   **Ending**: The two runs side by side: email sent vs not sent.
   **Variants**: `isolation-levels`, `non-repeatable-read`, `mvcc`, `acid-transactions`.
   **Techniques**: lanes, contents, restyle, token, toggle, scrub (new), side by side, caption.

**Review**: Keep — the email that cannot be recalled after the pencil is erased is the right failure: it shows why uncommitted data is dangerous (it may never exist) rather than just stating the rule. The ending contrast and the cross-database note are accurate. Weighed a more abstract counter-style example; the refund and email is more memorable and keeps the cause (a rollback) visible.

### Non-repeatable read (read skew) (`non-repeatable-read`)

**The aha**: Under read committed, each statement sees the latest committed data, so one transaction can see the same data before and after someone else's change.
**Misconception to defeat**: That a transaction sees the database at one single moment.
**Cast**: Rows `A: 500`, `B: 500` and a badge "actual total = 1000". T1 (blue, "Report: total balance") and T2 (orange, "Move $100 from B to A"). A report card "Total: ?".
**Opening frame**: Two rows, an empty report card. _"T1 adds up the accounts while T2 moves money between them."_
**Story**:

1. T1 reads A = 500; the value drops onto the report card. _"T1 reads A: 500."_
2. T2's whole band runs in the gap: B becomes 400 and A becomes 600, and both ink at commit. The actual-total badge stays at 1000 throughout. _"T2 moves $100 and commits."_
3. Slow-down: T1 reads B = 400, and the report card shows 900, red. _"T1 saw A before and B after: $100 missing."_
4. T1 reads A again and gets 600. Two dots on one band with different values, joined by a red bracket. _"Same row, same transaction, two answers."_
5. Toggle snapshot: a camera flash at T1's first read freezes its view. It reads B = 500 and the total is 1000, while T2 still commits normally. _"A snapshot gives one consistent moment."_
   **The moment**: Beat 3. The report says 900 next to a badge showing the database held 1000 at every commit.
   **Interaction**: Drag T2's band along the timeline: the anomaly appears only when T2 lands between T1's reads. Toggle read committed / snapshot; scrub.
   **Ending**: The two report cards side by side: 900 and 1000.
   **Variants**: `phantom-read`, `mvcc`, `isolation-levels`, `dirty-read`; backups and long analytics queries that hit it. A note: a single `SELECT SUM(...)` is one statement and sees one snapshot even under read committed, so the anomaly needs separate reads, as drawn. Beats 1 to 3 are read skew (two rows) and beat 4 the textbook non-repeatable read (one row twice); both labelled.
   **Techniques**: lanes, contents, restyle, move, toggle, scrub (new), side by side, caption.

**Review**: Improved — a snapshot starts at the first statement, not at BEGIN, so the camera moved; and a single-statement total sees one snapshot even at read committed, which a viewer who knows SQL would object to, so the note says why the plan uses separate reads. Beats 1 to 3 (the two-row version) and beat 4 (one row twice) are now labelled as read skew and the textbook case. The 900-beside-1000 moment stays; an animated "bank statement" metaphor was weighed and is weaker than the real report card.

### Phantom read (`phantom-read`)

**The aha**: Locking the rows you've read isn't enough: protection must cover rows that don't exist yet, through range locks or a snapshot.
**Misconception to defeat**: "I lock every row I read, so nothing can change under me."
**Cast**: Table `bookings` in a cylinder: `room 1, 10:00`, `room 1, 14:00`. T1 (blue) runs `SELECT * WHERE room = 1` twice. T2 (orange) inserts `room 1, 12:00`. Padlocks.
**Opening frame**: Two booking rows and two bands. _"T1 lists room 1's bookings, twice."_
**Story**:

1. T1's first query: both rows light and blue padlocks snap onto them. _"T1 reads two rows and locks them."_
2. T2 inserts `room 1, 12:00`: a new row slides in between the two locked rows, untouched by either lock, and commits. _"No lock covered a row that didn't exist."_
3. T1's second query returns three rows; the new one glows with a ghost outline. _"Same query, an extra row: a phantom."_
4. Replay with a range lock: a blue bracket spans all of "room = 1", gaps included. T2's insert bumps into it and waits (hatched band). _"Lock the range, not just the rows."_
5. Replay with a snapshot: T2 inserts freely, but T1 keeps reading its snapshot and sees two rows both times. _"Or read from a snapshot."_
   **The moment**: Beat 2. The new row slides between two padlocked rows, and the locks visibly guard nothing.
   **Interaction**: Toggle "row locks / range lock / snapshot" and replay; scrub.
   **Ending**: The range-lock version: bracket in place, T2 waiting.
   **Variants**: `non-repeatable-read`, `write-skew` (phantoms are how many write skews happen), `isolation-levels`, `mvcc`, `serializability`; MySQL next-key (gap) locks, SQL Server key-range locks.
   **Techniques**: lanes, contents, restyle, appear, boundary, toggle, scrub (new), caption.

**Review**: Keep — the padlocks guarding nothing while a new row slides between them is the exact failure and defeats "I lock every row I read". Range lock and snapshot are the two real remedies (MySQL gap locks, SQL Server key-range locks, snapshot reads), and the variants rightly point on to write skew for when a snapshot alone is not enough. Weighed a count-changes framing ("the sum changed"); the row sliding in is more concrete.

### Lost update (`lost-update`)

**The aha**: A read-modify-write cycle needs protection (an atomic update, an explicit lock or a compare-and-set), or one of two concurrent updates silently disappears.
**Misconception to defeat**: "Both writes committed, so nothing was lost."
**Cast**: A cylinder row `likes: 10`. T1 (blue) and T2 (orange), each with three dots: read, compute in the app (a small calculator bubble), write. A badge "expected".
**Opening frame**: The row, two users clicking Like together. _"Two people like the same post."_
**Story**:

1. T1 reads 10; a "10" bubble sits on T1. _"T1 reads 10."_
2. T2 reads 10. _"T2 reads 10 too."_
3. T1 computes 11, writes it and commits; the row inks 11. _"T1 writes 11."_
4. Slow-down: T2 computes 11 from its stale 10 and writes it. The row's 11 is replaced by an identical-looking 11; T1's increment greys and falls away. The badge reads "expected 12". _"T2 overwrote T1. A like vanished, silently."_
5. Fix: atomic. `SET likes = likes + 1` merges read and write into one dot inside the database; the second waits a moment; the row reaches 12. _"Let the database do it in one step."_
6. Fix: lock. `SELECT … FOR UPDATE` puts a blue padlock on the row; T2's read waits (hatched), then reads 11, and the row reaches 12. _"Or lock it while you think."_
7. Fix: compare-and-set. T2 writes "11 if still 10" and bounces; it retries, reads 11, and writes 12. _"Or check nothing changed, and retry."_
   **The moment**: Beat 4. An 11 overwrites an 11, with no error, next to "expected 12".
   **Interaction**: Choose the protection (none, atomic, lock, compare-and-set, or the database's own: PostgreSQL repeatable read aborts T2 with "could not serialize", MySQL repeatable read does not) and replay; scrub.
   **Ending**: The row at 12 under the chosen fix.
   **Variants**: `optimistic-vs-pessimistic-locking`, `write-skew`, `isolation-levels`, `write-conflict-resolution`.
   **Techniques**: lanes, contents, restyle, failure, choice, scrub (new), caption.

**Review**: Improved — the fix list left out the one that needs no code change, a stricter isolation level, and it is exactly where databases differ (PostgreSQL and SQL Server snapshot abort the second writer, MySQL InnoDB lets it through), which also ties back to `isolation-levels`. Kept the identical-looking 11 over 11 as the moment; a "ledger entry" framing was weighed and is less direct.

### Write skew (`write-skew`)

**The aha**: Two transactions each check a rule, then write different rows, and together they break the rule neither broke alone; snapshot isolation can't see it, and only serializable isolation or locking what the decision was based on prevents it.
**Misconception to defeat**: "They wrote different rows, so there was no conflict," and confusing it with lost update.
**Cast**: Table `on_call`: `alice: true`, `bob: true`. A rule badge "≥ 1 doctor on call", green. T1 (blue, Alice) and T2 (orange, Bob), each with dots: count, decide, update own row, commit. Camera icons for snapshots.
**Opening frame**: Both on call, badge green. _"Rule: at least one doctor on call. Alice and Bob both feel ill."_
**Story**:

1. Both bands start at snapshot isolation, each with a camera flash and a frozen view "2 on call". _"Each starts from a snapshot."_
2. T1 counts 2 (thought bubble "2 ≥ 2, I can go"); T2 counts 2, with the same bubble. _"Each checks: two on call, safe to leave."_
3. T1 sets Alice off; T2 sets Bob off. Their arrows land on different rows, and no conflict icon appears. _"Different rows. No conflict detected."_
4. Both commit. Slow-down: the badge turns red, "0 on call". _"Together they broke the rule."_
5. Inset beside lost update: there, two arrows hit the same row; here, they hit different rows. _"Snapshots guard the rows you write, not what you decided on."_
6. Replay at serializable: at T2's commit two arrows light, each from one transaction's count to the other's write, closing a loop; T2 aborts (red flash), retries, counts 1, and stays on call. _"Serializable spots it and aborts one."_
   **The moment**: Beat 4. Both commits succeed and the badge flips red, with no row ever touched twice.
   **Interaction**: Toggle snapshot / serializable / `SELECT … FOR UPDATE`; scrub. Choose other cases: a meeting room double-booked, a username claimed twice. In those there is no row to lock yet (a phantom), so `FOR UPDATE` does nothing and only serializable or a unique constraint helps.
   **Ending**: The serializable run: Bob still on call, T2 marked "retried".
   **Variants**: `lost-update`, `phantom-read`, `serializability`, `mvcc`, `isolation-levels`.
   **Techniques**: lanes, contents, spotlight, restyle, side by side, toggle, scrub (new), failure, choice, caption.

**Review**: Improved — the serializable detection was drawn as one arrow, but the real signal is a cycle of read-write dependencies (each transaction read what the other wrote), so two arrows now close a loop. Also added that `FOR UPDATE` cannot protect rows that do not exist yet. The both-commit-then-the-badge-turns-red beat stays as the moment; a table-level explanation was weighed and is dull next to it.

### MVCC and snapshot isolation (`mvcc`)

**The aha**: Readers never block writers and writers never block readers, because each row keeps versions and each transaction reads the versions current when it started.
**Misconception to defeat**: That a reader must wait for a writer to finish, or that MVCC is optimistic locking.
**Cast**: One row drawn as a stack of version cards, each tagged with the transaction that created it ("100 · by tx 5"). Transactions on the timeline: a long green T-report and a purple T-write, each with a camera icon and what it can see (the latest transaction id at its start). A sweeper for vacuum.
**Opening frame**: One row with one version, `100`. _"Each row keeps versions, not just a value."_
**Story**:

1. The wrong model, small and grey: the writer padlocks the row and the reader's band goes hatched, waiting. _"Without versions, readers wait."_
2. With MVCC: T-report starts (camera flash: "sees up to tx 8"). T-write updates the row, and a new card `70 · by tx 9` lands on top while `100` stays beneath. _"An update adds a version. The old one stays."_
3. T-report reads: its line skips the `70` card (greyed for it, too new) and lands on `100`, with no waiting. _"Each reads what was current when it began."_
4. T-write commits. A new transaction, T-new, starts and reads `70`, while T-report still reads `100` at the same moment. _"Readers never block writers. Writers never block readers."_
5. T-report finishes. No one can see `100` any more; the sweeper clears it. _"Old versions are cleaned up later."_
   **The moment**: Beat 4. Two transactions read the same row at the same instant, get different values, and both are right.
   **Interaction**: Drop a new transaction at any start time and see which version it reads; toggle "versions on / off" to compare with the waiting picture; hold T-report open and watch old versions pile up behind it (bloat). A second writer on the same row still waits: writers block writers, and this is not optimistic locking; scrub.
   **Ending**: One live version after cleanup.
   **Variants**: `isolation-levels`, `non-repeatable-read`, `write-skew`, `serializability`, `optimistic-vs-pessimistic-locking`; read committed takes a fresh snapshot per statement, repeatable read / snapshot one per transaction; PostgreSQL VACUUM, SQL Server's tempdb version store, Oracle undo.
   **Techniques**: layers, lanes, path trace, restyle, side by side, disappear, scrub (new), caption.

**Review**: Improved — the version labels mixed a clock time (t=10) with transaction ids (tx 9), which made the visibility rule unreadable; the camera now shows the last id the reader can see. The misconception that MVCC is optimistic locking was named but never answered, so the interaction shows a second writer still waiting and old versions piling up behind a long reader. Kept the two-readers-two-answers-both-right moment; the stack of cards beats a timeline-only framing.

### Serializability (`serializability`)

**The aha**: Serializable means the outcome is as if transactions ran one at a time, which removes every race condition but makes transactions wait or abort, so the application must retry.
**Misconception to defeat**: That it means transactions literally run one by one (only one implementation does), and confusing it with linearizability.
**Cast**: Top, the shared timeline with three overlapping bands T1, T2, T3. Below, an empty "one at a time" lane. A checker that compares outcomes. Three mechanism icons: a single-lane road (serial), padlocks (two-phase locking), a detective (SSI).
**Opening frame**: Overlapping bands above, an empty serial lane below. _"Many at once. Is it the same as some one-at-a-time order?"_
**Story**:

1. A safe interleaving: the bands touch different rows. The checker slides them into the lane as T1, T2, T3 and the outcomes match (green tick). _"Serializable: equal to some serial order."_
2. The on-call write skew: the checker tries T1 then T2 (mismatch), then T2 then T1 (mismatch). No order fits, red. _"No serial order matches: that's a race."_
3. Mechanism 1: a single lane; the bands queue and run one after another. _"Actually run them one at a time."_
4. Mechanism 2: padlocks; T2's band hatches while it waits on T1's locks. _"Or lock what you read and write."_
5. Mechanism 3: the bands run freely on snapshots; at commit the detective flags T2 and aborts it (red flash); a retry loop reruns T2 after T1 and the outcomes match. _"Or run freely and abort whoever breaks the order."_
6. A "retry" wrapper draws around T2. _"So your code must retry."_
   **The moment**: Beat 2. Both serial orders are tried and neither matches, which makes "race condition" concrete.
   **Interaction**: Choose the mechanism and watch waits, aborts and a throughput meter.
   **Ending**: The serial lane filled, with a retry count. A small inset: linearizability orders operations on one object by real time; serializability orders whole transactions; both together is "strict serializable" (Spanner).
   **Variants**: `isolation-levels`, `write-skew`, `mvcc`, `linearizability`, `database-deadlock`, `distributed-sql`; PostgreSQL SSI, SQL Server range locks, MySQL InnoDB (locking reads), Oracle (its "serializable" is snapshot isolation and is not this).
   **Techniques**: lanes, move, side by side, restyle, failure, choice, meter, caption.

**Review**: Improved — the linearizability confusion was in the misconception and nowhere in the story; an ending inset now separates the two in one line. The variants add that Oracle's "serializable" is not this. The two-orders-both-mismatch beat stays as the moment (it makes "race condition" concrete); a purely visual "single lane vs many" framing was weighed, but then the correctness test would be missing.

### Optimistic vs pessimistic concurrency (`optimistic-vs-pessimistic-locking`)

**The aha**: Lock first when conflicts are common; check at write time when they're rare, and with optimistic concurrency a conflict means a retry, not a wait.
**Misconception to defeat**: Confusing optimistic concurrency with MVCC.
**Cast**: Side by side, each with its own timeline. Two editors, Ann and Ben, both edit `product 17: price 20 · version 4`. Left "Pessimistic", with a padlock. Right "Optimistic", with a version badge.
**Opening frame**: Same record, same two editors, twice. _"Two people edit the same record."_
**Story**:

1. Left: Ann opens it and her padlock snaps on. Ben opens it and his band hatches; a timer runs. _"Pessimistic: lock first, others wait. Here the lock lasts through Ann's whole edit."_
2. Left: Ann saves and unlocks, and Ben carries on with fresh data. _"Then the next one goes."_
3. Right: both read version 4 at once, with no waiting. _"Optimistic: everyone proceeds."_
4. Right: Ann saves `WHERE version = 4`, which succeeds, and the badge turns 5. Ben saves `WHERE version = 4`: no row matches, and he bounces with "conflict". _"Check at write time. Second one loses."_
5. Right: Ben rereads version 5, reapplies his change and saves version 6. _"A conflict means a retry, not a wait."_
6. A dial for conflict rate: low, and the right side's throughput meter wins; high, and retries loop on the right while the left wins. _"Lock when conflicts are common, check when rare."_
   **The moment**: Beat 6. The winner flips as the conflict dial crosses over.
   **Interaction**: Dials for conflict rate and number of editors. A toggle shows the HTTP form of the same idea: `ETag` and `If-Match`, with a 412 response.
   **Ending**: Dial mid-way, both meters labelled. A caption separates the two ideas: MVCC is how a database lets readers see old versions; optimistic concurrency is how your code detects a conflicting write.
   **Variants**: `lost-update`, `mvcc`, `serializability`, `database-deadlock`; HTTP ETags, Cosmos DB ETags, DynamoDB conditional writes.
   **Techniques**: side by side, lanes, restyle, timer, failure, dial, meter, toggle, caption.

**Review**: Improved — the MVCC confusion in the misconception was never answered on screen; the ending now draws the line. Beat 1 also shows that the lock is held for the length of Ann's edit, which is the real cost of pessimistic locking over human time (database locks are normally held for a short transaction). The conflict-rate dial flipping the winner is the moment; a pure "pros and cons" comparison was weighed and loses to it.

### Deadlock (`database-deadlock`)

**The aha**: Deadlocks come from taking locks in different orders: a consistent lock order prevents them, and when one happens the database aborts a victim that must retry.
**Misconception to defeat**: That a deadlock is just slow blocking, or that it hangs forever.
**Cast**: Two rows, `A` and `B`. T1 (blue, "A → B transfer") locks A then B. T2 (orange, "B → A transfer") locks B then A. A wait-for graph off to the side: circles T1 and T2.
**Opening frame**: Two rows, two bands. _"T1 pays A to B. T2 pays B to A. Same moment."_
**Story**:

1. T1 locks A: blue padlock. _"T1 holds A."_
2. T2 locks B: orange padlock. _"T2 holds B."_
3. T1 asks for B; its band hatches and an arrow T1 → T2 appears in the graph. _"T1 waits for T2."_
4. T2 asks for A; its band hatches, an arrow T2 → T1 closes the loop, and the cycle glows red. _"Each holds what the other needs. A cycle."_
5. The detector spots the cycle (within about a second in PostgreSQL, about five in SQL Server) and picks one victim, here T2: red flash, T2's padlock drops, T2 rolls back. T1 takes B and commits. _"The database aborts one to break it (it chooses which)."_
6. T2 reruns and succeeds. _"The victim must retry."_
7. Replay with a fixed order (lowest id first): T2 also asks for A first, waits briefly, then proceeds, and no loop ever forms. _"Same lock order: waiting, never a cycle."_
   **The moment**: Beat 4, the closing of the loop in the wait-for graph.
   **Interaction**: Choose "lock order: as written / always A first"; drag T2's start later to see that timing matters; scrub.
   **Ending**: The fixed-order run: two transactions completing one after the other.
   **Variants**: `optimistic-vs-pessimistic-locking`, `serializability` (two-phase locking), `lost-update`; deadlocks that span databases or services are not detected, and lock timeouts are the fallback.
   **Techniques**: lanes, restyle, appear, path trace, failure, choice, scrub (new), caption.

**Review**: Improved — "picks T2" implied a fixed rule, but victims are chosen by cost or priority, or by whichever session notices first, and the detector runs about once a second to once every five seconds, so "hangs forever" is now defeated with the real timing. The wait-for graph closing into a cycle is the moment; a traffic-gridlock metaphor was weighed and is only the same picture with less precision.

### Two-phase commit (2PC) (`two-phase-commit`)

**The aha**: Two-phase commit makes one transaction atomic across machines, but if the coordinator dies after "prepare", participants are stuck holding locks until it returns.
**Misconception to defeat**: Confusing it with two-phase locking, or assuming it's harmless glue (sagas are the non-blocking alternative).
**Cast**: Three lanes on a shared timeline: Coordinator (top), Orders DB, Payments DB (each a cylinder at the lane's start). Messages as diagonal arrows between lanes. Participant badges: working → prepared (padlock) → committed. A small decision log on the coordinator. A client that wants to read a locked row.
**Opening frame**: Three lanes. _"One transaction, two databases. Both commit or neither."_
**Story**:

1. Each database makes its change in pencil and holds a lock. _"Both do the work, tentatively."_
2. Phase 1: PREPARE arrows go out. Each participant saves its change to disk, badges "prepared" and replies YES. _"Can you commit? Each promises yes, and can't back out."_
3. Phase 2: the coordinator writes COMMIT to its log and sends COMMIT; both ink their rows and release locks. _"Then: commit everywhere."_
4. Quick replay: Payments replies NO, and ABORT goes to both, which roll back. _"Any no aborts all."_
5. Slow-down: rerun. Both reply YES, then the coordinator flashes red and greys before phase 2. The participants sit prepared with padlocks on and timers counting up; the client's read hatches, waiting. _"Coordinator gone after prepare: they can't commit or abort alone."_
6. The coordinator returns, reads its log, sends COMMIT, and the locks release. _"Only the coordinator's log can settle them."_
   **The moment**: Beat 5. Prepared participants frozen with locks held and timers climbing, and a blocked client caught in it.
   **Interaction**: "Kill the coordinator" at any point. A participant that has not yet voted can safely abort alone; once it votes YES it is in doubt and must wait for the coordinator's answer. An operator can force a "heuristic" outcome but risks the two databases disagreeing. The vulnerable window becomes visible.
   **Ending**: Committed on both, with the trade captioned and a pointer to sagas.
   **Variants**: `acid-transactions`, `distributed-sql`, `consensus-raft-paxos`, `serializability` (two-phase locking is a different thing); messaging's `saga` and `transactional-outbox`; Spanner makes the coordinator a replicated group so it cannot be a single point of failure; XA and MSDTC are the real implementations.
   **Techniques**: lanes, exchange, token, restyle, failure, timer, choice, caption.

**Review**: Improved — the interaction said everyone can abort before the decision, which is true only for participants that have not voted; once a YES is out the participant is in doubt. The blocked-forever claim is softened to its real escape hatches (the coordinator's log, or a risky manual heuristic outcome), and variants point at the fix (a replicated coordinator). The frozen prepared participants with a blocked client are the moment; a "wedding vows" metaphor was weighed and dropped as less exact.
