# Delivery plans, part 2

Stage 2 plans for the last six groups of [`catalog/delivery.md`](../catalog/delivery.md), in
catalog order (part 1 has the first four groups). Shared visual language: a pipeline is a
left-to-right conveyor of stages carrying the build artifact as a labelled package; checks are
small gates turning ✓ green or ✗ red; environments are labelled zones on the right; users are a
crowd whose traffic splits between v1 (blue) and v2 (violet); a Git repository is a small stack
of commit circles; declared infrastructure is a document on the left, real resources sit on the
right, and differences between them are amber. Part 1's element table also applies (v1 blue and
v2 violet, gates, the sealed artifact package, the ⟲ rewind and its **replay** technique); amber
here marks a difference from what's declared, not part 1's running-job ring.

New technique used here: **loop**, a process that repeats on its own, drawn as a pulse circling
a closed path (a reconciler, an agent checking in, a feedback cycle). Token and timer show one
trip or time passing, but not "this keeps happening without anyone starting it", which is the
whole point of reconciliation, pull agents and the DevOps loops.

## Database changes in deployments

### Database migrations in the pipeline (`database-migrations-in-pipeline`)

**The aha**: The database is deployed like code: numbered scripts ride in the app's package, the pipeline runs the missing ones in order before the new app starts, and each database keeps a ledger of what it has run.
**Misconception to defeat**: Schema changes are run by hand by a DBA (or synced by the ORM at startup), so dev, test and prod each end up with a slightly different schema.
**Cast**: Pipeline view. The repo's `migrations/` folder of numbered script cards (`001_users`, `002_orders`), sealed into the build package with the app. Dev, test and prod zones, each with a database cylinder showing a mini schema and a ledger tab, `schema_history`, listing the scripts applied. At each zone's door, a migrator (a clipboard with a tick) that runs before the app is swapped in.
**Opening frame**: The repo holds 001–002. All three ledgers read 001 ✓, 002 ✓ and the three schemas match. Caption: "Each database keeps a ledger of scripts it has run."
**Story**:

1. A card `003_add_email` drops into the folder as a new commit. Caption: "A schema change is a numbered script, committed like code."
2. The package rolls into dev. The migrator holds the folder against the ledger: 001 ✓, 002 ✓, 003 glows amber. Caption: "What hasn't run here yet?"
3. 003 runs as a token into the cylinder: `users` grows an `email` column, the ledger appends "003 ✓", and only then does the new app version start. Caption: "Run what's missing, in order. Then the app."
4. The same package is promoted to test, then prod: the same check, the same single script, the same new ledger row. Caption: "Same scripts, same order, every environment."
5. Prod is redeployed: nothing is amber and the schema doesn't flicker. Caption: "Already applied? Skipped."
6. ⟲ Replay by hand: a DBA runs 003 on prod but forgets test, so the release fails there ✗ "column email not found". Caption: "By hand, environments quietly differ."

**The moment**: Beat 4, slowed: three schemas and ledgers lining up row for row, then coming apart in beat 6.
**Interaction**: Deploy to a database restored from an old backup (ledger at 001): 002 then 003 run, in order. Make 003 fail: the line stops and the old app keeps serving. A toggle replays beat 4 by pipeline or by hand.
**Ending**: Holds on three identical schemas whose ledgers all end in 003 ✓; loops by dropping in 004.
**Variants**: `expand-contract-migration`, `rollback-vs-roll-forward` (migrations usually only roll forward), `build-once-deploy-many`; Data's `schema-migrations` and `online-schema-change`; Flyway, Liquibase, EF Core.
**Techniques**: contents, token, zoom, restyle, replay, side by side, toggle, failure, caption.
**Review**: Improved — refocused on the pipeline (scripts ride in the app's package and run before the new app starts), since Data's `schema-migrations` already tells the ledger story. The old interaction would have re-run scripts against existing tables; it's now a restored backup and a failing migration. "Runner" was renamed so it isn't mistaken for a CI runner.

### Expand/contract (parallel change) (`expand-contract-migration`)

**The aha**: Change a schema in steps that each work with both the old and the new app version, so no running instance ever meets a database it can't handle.
**Misconception to defeat**: A rename is one step: rename the column, ship the new code. During a rolling update the old instances are still running, and they break the moment the column moves.
**Cast**: Centre, a `users` table drawn as a grid; column headers are tabs. Above it, four app instances (v1 blue, v2 violet), each with thin lines to the columns it reads and writes. On the left, a crowd of users sending requests. Below, a phase track: Expand → Migrate → Contract.
**Opening frame**: Table `id | name`; four blue instances wired to `name`, all ✓. Caption: "Goal: rename name to full_name."
**Story**:

1. Big bang, tinted red: the header flips to `full_name` in one step. Every blue instance's line snaps, ✗ marks appear, users get errors. Rewind. Caption: "Rename in one step: every v1 breaks."
2. Expand: an empty, dashed `full_name` column appears beside `name`. Blue instances keep working. Caption: "Expand: add the new beside the old."
3. Rolling update: instances turn violet one at a time. v2 writes to both columns (two lines) and reads `full_name`, falling back to `name`. Blue and violet run together, all ✓. Caption: "Old and new run side by side."
4. Migrate: a sweep runs down the rows, copying `name` into the empty `full_name` cells. Caption: "Backfill the old rows."
5. Contract: a counter reads "v1 instances: 0". A v3 release stops writing `name`, then the `name` column fades out. Caption: "Contract: remove the old once nothing uses it."
6. Each gap on the phase track gets a "safe to roll back" ✓. Caption: "Every step works with both versions."

**The moment**: Beat 3, slowed: blue and violet instances hitting the same table at the same time, all green, with beat 1's snapped lines as a small inset for contrast.
**Interaction**: Scrub the phase track and press "roll back the app" anywhere: the older version always finds its column. Or choose "contract early": drop `name` while a blue instance is still alive and watch it break. Teaches that contract waits for the last old reader.
**Ending**: A clean `id | full_name` table, every instance violet, every phase ✓.
**Variants**: `rolling-update`, `blue-green-deployment`, `zero-downtime-deployment`, `rollback-vs-roll-forward`, `database-migrations-in-pipeline`.
**Techniques**: contents, restyle, appear/disappear, lanes, meter, side by side, failure, choice, caption.
**Review**: Merged — owned by Data (`data.part3.md`). Data's plan never shows the failure it prevents. It should borrow this opening (the one-step rename snapping every v1 instance's wire, then rewound), the instance-to-column wires, the "v1 instances: 0" counter that gates the contract step, and the "roll back the app" and "contract early" interactions. A rename is a simpler first example than a split.

## Security in delivery

### Secrets in pipelines (`pipeline-secrets`)

**The aha**: A secret is handed to the running job only when it needs it, from a store outside the repo, scoped to one environment and blanked in the logs; it is never in the code, the YAML or the package.
**Misconception to defeat**: A secret is just another config value, fine to keep in the YAML, a `.env` file or the build.
**Cast**: Left, a Git repo (commit stack) with `pipeline.yml` open. Middle, the pipeline conveyor with a build job and two deploy jobs (test, prod), and a log panel scrolling under it. Top, a secret store drawn as a vault with two compartments, "test" and "prod", each holding a gold key `DB_PASSWORD`. Right, test and prod zones. Secrets are always gold keys.
**Opening frame**: `pipeline.yml` shows `password: hunter2` with a gold key beside it. Caption: "The tempting way: the secret in the repo."
**Story**:

1. The key clones itself everywhere the repo goes: a laptop, a fork, the build package, a log line, and an old commit circle that keeps it even after the line is deleted. Each copy glows amber. Caption: "Everything that touches the repo has the key."
2. Reset. The key moves into the vault; the YAML now reads `${{ secrets.DB_PASSWORD }}`, an empty slot. Caption: "The repo only names the secret."
3. The build job runs with no key. At "deploy to test", the test key travels from the vault into that one job box. Caption: "Injected at run time, into one job."
4. The job prints a line containing the password; in the log it renders as `***`. Caption: "Masked in logs."
5. The job ends and the key inside it dissolves. Zooming into the package shows no key. Caption: "Gone when the job ends. Never in the artifact."
6. A job from a pull request asks for the prod key; the prod compartment's boundary refuses ✗. Only the approved prod deploy gets it. Caption: "Scoped: prod's key goes only to prod's deploy."

**The moment**: Beat 1 and beat 5 side by side: on the left, amber keys scattered across five places for good; on the right, one key that existed inside one job box for 40 seconds.
**Interaction**: Toggle between "in the repo" and "injected", then hunt for the secret by clicking the repo, its history, the fork, the log or the artifact. In one mode it turns up everywhere, in the other nowhere.
**Ending**: The vault, a placeholder in the YAML, a clean log showing `***`.
**Variants**: `pipeline-oidc-federation` (no stored secret at all), `devsecops-pipeline` (secret scanning catches the committed key); secret stores in Security.
**Techniques**: clone, token, contents, restyle, boundary, zoom, side by side, toggle, failure, caption.
**Review**: Keep — the key copying itself everywhere (even into history after the line is deleted) and the "hunt for the secret" toggle make it physical, and every beat matches real behaviour: environment-scoped secrets, log masking, no secrets for pull-request jobs.

### Secretless deploys with OIDC federation (`pipeline-oidc-federation`)

**The aha**: Instead of storing a cloud key, the job shows the cloud a signed, minutes-long ID card saying "repo X, branch main, environment prod", and the cloud swaps it for temporary credentials.
**Misconception to defeat**: To deploy, a pipeline has to hold a long-lived access key or service principal secret that someone stores and rotates.
**Cast**: Left, the CI provider (e.g. GitHub Actions) with a running deploy job and an empty "stored secrets" box. Middle, an ID token drawn as a badge with claim lines `repo: acme/shop`, `ref: main`, `environment: prod`, a signature seal and a timer ring "5 min". Right, the cloud: a trust policy panel listing the exact claims it accepts, a token-exchange desk, and the target resources.
**Opening frame**: Two rows. Top, "Stored key": a gold key in the CI's secrets box, age counter "731 days". Bottom, "Federation": the secrets box is empty and the cloud holds a trust policy. Caption: "Two ways for a pipeline to prove who it is."
**Story**:

1. Top row: the key is copied to an attacker's laptop and still works from there a week later. Caption: "A stored key works for anyone who has it."
2. Bottom row: the job starts and the CI provider mints the badge; its timer starts. Caption: "The job gets a signed ID card about itself."
3. The badge travels to the cloud. The trust policy checks it line by line: signer ✓, repo ✓, ref ✓, environment ✓. Caption: "The cloud checks who signed it and what it says."
4. The desk hands back a silver key with its own short timer; the job deploys. Caption: "Swapped for short-lived credentials."
5. A job on `feature/x` tries: `ref` fails ✗ and nothing is issued. Caption: "This repo, this branch, this environment. Nothing else."
6. The timers run out and badge and silver key crumble. The attacker replays a copied badge: refused ✗ "expired". Caption: "Nothing long-lived to leak or rotate."

**The moment**: Beat 3, slowed so each claim ticks in turn; then beat 6 set against beat 1: the stolen stored key still works, the stolen token is dust.
**Interaction**: Change the job's context (branch, environment, a fork) and see which claim fails. A "steal it" button replays the token after its timer: refused.
**Ending**: An empty secrets box; the trust policy is the only thing configured.
**Variants**: `pipeline-secrets`; workload identity federation in Security; Azure federated credentials, AWS IAM OIDC provider with `AssumeRoleWithWebIdentity`, Google Cloud Workload Identity Federation.
**Techniques**: exchange, token, contents, timer, side by side, restyle, failure, choice, caption.
**Review**: Keep — "the stolen key still works, the stolen token is dust" is the sharpest contrast available, and it's accurate: GitHub's ID token lives about five minutes, the trust policy matches issuer and claims, and the cloud hands back short-lived credentials.

### Security scanning in the pipeline (DevSecOps) (`devsecops-pipeline`)

**The aha**: Each security scan sits at the first stage where the thing it inspects exists, and a finding stops the line like a failing test.
**Misconception to defeat**: Security is a pen test at the end, once a year, after everything is built and shipped.
**Cast**: The pipeline conveyor: commit → build → image → deploy to test → prod, with the package travelling along it. Problems ride hidden inside the package as small icons: a gold key (leaked secret), a red bug (code flaw), a cracked brick (vulnerable library), a rusty layer (outdated base OS), an open door (runtime misconfiguration). Scanner gates sit above stages, each labelled with what it reads.
**Opening frame**: One big padlock gate at the far right, "Pen test, annually", with a 12-month time axis under the conveyor. Caption: "Security as one check at the end."
**Story**:

1. The package travels the whole line; months later the pen test finds five problems, and five long arrows race back to the start. Caption: "Found late, fixed expensively."
2. The big gate splits into four small gates that slide back along the line to their stages. Caption: "Put each scan where its signal first exists."
3. Commit: secret scanning and SAST read the diff; the gold key and the bug light red, gate ✗, fixed in seconds. Caption: "Secrets and code flaws: at commit."
4. Build: dependencies resolve into a full tree; SCA reads it and flags `lodash 4.17.15`, pulled in by another package, with a known CVE ✗. Caption: "Vulnerable libraries: once dependencies resolve."
5. Image: zoom into the image's layers; the scanner flags the rusty base layer ✗. Caption: "Base image: before it's pushed."
6. Test environment: DAST fires probes at the running app and finds a missing security header (amber, warn). Caption: "Runtime issues: against a running app."
7. All gates ✓; the package enters prod clean. Caption: "Findings fail the pipeline, like tests."

**The moment**: Beat 2: the single gate splitting apart while each problem's "found at" label jumps from "month 12" to "minute 1", "minute 6", "minute 9", "minute 25".
**Interaction**: Choose where each scanner sits; put DAST on the commit stage and it reports "nothing running to test". Switch any gate between block and warn.
**Ending**: Four green gates along the line and a clean package in prod.
**Variants**: `shift-left`, `policy-as-code`, `quality-gates`, `automated-dependency-updates`; SAST, SCA, DAST, SBOMs and signing in Security.
**Techniques**: token, contents, move, layers, zoom, restyle, failure, path trace, choice, caption.
**Review**: Improved — a lockfile exists at commit, so "SCA at build" broke the plan's own rule; the flagged library is now a transitive one that only appears when dependencies resolve. The single gate splitting and sliding back stays, because it teaches placement, which a cost curve (`shift-left`'s job) wouldn't.

### Policy as code (`policy-as-code`)

**The aha**: A rule like "no public storage" becomes code that runs against every planned change, so a non-compliant resource is refused before it exists.
**Misconception to defeat**: Compliance is a reviewer with a checklist; or IAM permissions, which decide who may act, not what's allowed to exist.
**Cast**: Left, declared infrastructure as a document with `storage "logs" { public = true }` buried at line 312. Middle, the pipeline's plan stage producing a plan card, then a policy gate drawn as a small rulebook with three lines: `deny public storage`, `require tag owner`, `region in [canadacentral]`. Right, the cloud zone of real resources, with a second policy gate at its edge. A reviewer figure with a clipboard.
**Opening frame**: The document with `public = true` highlighted amber. Caption: "A change that breaks a rule."
**Story**:

1. The reviewer scrolls a 400-line diff, misses line 312 and approves. A storage bucket appears in the cloud with an open padlock and internet arrows pointing at it. Caption: "Checklists depend on someone noticing."
2. Rewind. The checklist's three rules become code lines inside the gate. Caption: "Write the rule once, as code."
3. The plan card reaches the gate and each rule is checked in turn: tag ✓, region ✓, public ✗. The offending plan line glows red and the gate shuts: `deny: storage must not be public`. The cloud stays empty. Caption: "Checked on every plan, before anything exists."
4. The author sets `public = false`; the plan passes all three; the bucket is created, padlock closed. Caption: "Fix the code, pass the gate."
5. Someone tries to make the bucket public in the console; the gate at the cloud's edge refuses ✗. Caption: "The same rules guard the platform."

**The moment**: Beat 3 set against beat 1: the same line, but this time the cloud zone stays empty. The bucket never existed.
**Interaction**: Edit the resource (public on or off, drop the tag, change region) and see which rule fires. A toggle switches the gate between deny and audit, where the change goes through but is flagged amber.
**Ending**: A compliant bucket in the cloud; the gate shows three green rules.
**Variants**: `devsecops-pipeline`, `iac-plan-in-pull-request`, `quality-gates`; OPA Gatekeeper and Kyverno in Kubernetes, Azure Policy, AWS SCPs and Config rules.
**Techniques**: contents, token, restyle, spotlight, boundary, failure, choice, toggle, caption.
**Review**: Merged — owned by Security. No Security plan exists yet, so the owner should start from this one: the line missed in a 400-line diff against a gate that never misses, the bucket that never exists, the two enforcement points, the deny/audit toggle and the IAM contrast. One fix: name the cloud-edge mechanism (Azure Policy deny, S3 Block Public Access, an admission controller), because an SCP limits actions, not resource properties.

## Infrastructure as code

### Infrastructure as code (`infrastructure-as-code`)

**The aha**: The file is the source of truth: an environment is whatever the file says, so it can be reviewed, versioned and rebuilt exactly, at will.
**Misconception to defeat**: Infrastructure is clicked together in a console once and remembered (or written up in a wiki).
**Cast**: Two rows. Top, "Console": an engineer clicking through a console window, with a click counter. Bottom, "Code": a document `main.tf` listing a network, a VM, a database and a firewall, sitting on a Git commit stack. Each row ends on the right in a cloud zone of resource icons.
**Opening frame**: Both rows have built the same environment: the top after "37 clicks", the bottom from a 20-line file. Caption: "Two ways to build the same environment."
**Story**:

1. Build a second, identical copy. Top: the engineer clicks again from memory; the copy has a smaller VM and is missing a firewall rule, both amber. Bottom: the tool reads the file and an exact copy appears. Caption: "From memory, copies drift. From a file, they match."
2. A change: open port 443. Top: the firewall changes; the audit log shows who and when, but the "why?" and "reviewed?" tags stay blank. Bottom: one line changes in a commit, a pull request shows the diff and its reason, a reviewer approves ✓. Caption: "Changes become commits: reviewed and recorded."
3. Disaster: the region goes dark and every resource in both rows cracks and fades. Caption: "Now lose everything."
4. Top: a blank zone and a half-finished wiki page. Bottom: the file is applied to a new region and the environment rebuilds in minutes, timer running; the new database is empty, tagged "data: restore from backup". Caption: "Rebuild it from the file."

**The moment**: Beat 4: the bottom zone refilling resource by resource from the file while the top zone stays empty.
**Interaction**: A "delete everything" button, then "apply": the environment comes back identical every time.
**Ending**: The file on the left, two identical environments on the right, commit history beneath.
**Variants**: `declarative-vs-imperative`, `terraform-plan-apply`, `iac-state-file`, `infrastructure-drift`, `gitops`; Bicep, CloudFormation, CDK, Pulumi, Terraform.
**Techniques**: side by side, clone, appear/disappear, restyle, contents, failure, timer, caption.
**Review**: Improved — console changes do reach the audit log (who and when), so the contrast is now the missing why and review. IaC rebuilds infrastructure, not data, so the rebuilt database is now tagged for a backup restore.

### Declarative vs imperative IaC (`declarative-vs-imperative`)

**The aha**: A declarative tool is given the destination and works out the route from wherever things are now; an imperative script is a route that only works from the start it assumed.
**Misconception to defeat**: The difference is the language: YAML is declarative, TypeScript is imperative. (CDK and Pulumi use real languages but still hand a desired state to an engine.) Or: both automate, so they're the same.
**Cast**: Two lanes side by side. Left, "Imperative": a script card `add 3 servers to pool web`. Right, "Declarative": a document `pool web: 3 servers` and a comparator (the tool) drawn as a scale weighing "want" against "have". Under each lane, a cloud zone holding the `web` pool (a scale set) as server icons with a count.
**Opening frame**: Both pools empty. Caption: "Goal: three servers."
**Story**:

1. Both run from empty and both reach 3 ✓. Caption: "From empty, both work."
2. Someone deletes a server from each pool by hand, leaving 2. Run both. Imperative: three more appear, total 5, the extras amber. Declarative: the comparator shows want 3, have 2, and plans "+1"; total 3 ✓. Caption: "Imperative replays steps. Declarative closes the gap."
3. Someone scales both pools to 5 by hand. Imperative goes to 8. Declarative plans "−2" and lands on 3. Caption: "From any start, it converges."
4. Now want 4. Imperative: someone must write a new script for today's state. Declarative: change 3 to 4. Caption: "Say what you want; the tool works out how."
5. Zoom: a TypeScript loop `for (i < 3) new Server()` outputs a desired-state document that feeds the comparator. Caption: "Real code can still declare."

**The moment**: Beat 2, slowed at the comparator's subtraction (want 3, have 2: +1), beside the imperative lane overshooting.
**Interaction**: A dial sets the starting number of servers (0–6); press run. Declarative always ends at 3; imperative ends at start + 3, or errors.
**Ending**: After the dial session: the declarative lane on 3, the imperative lane on whatever it got.
**Variants**: `iac-idempotency`, `terraform-plan-apply`, `configuration-management`, `gitops-reconciliation`.
**Techniques**: side by side, lanes, contents, meter, appear/disappear, restyle, failure, zoom, dial, caption.
**Review**: Improved — a declarative tool only converges what it manages, so "start at 5, plan −2" was wrong for loose servers it never created. They're now one managed pool whose count the tool owns, so +1 and −2 match Terraform, Bicep and a ReplicaSet.

### Plan and apply (`terraform-plan-apply`)

**The aha**: Plan shows every create, update, replace and destroy before anything happens, and an innocent-looking edit can mean destroy-then-create.
**Misconception to defeat**: "I changed one line, so one small thing changes", and apply just pushes the file.
**Cast**: Left, declared infrastructure as a document: a VM `size = "small"` and a database `name = "orders-db"`. Right, the real resources: a VM and a database cylinder visibly full of rows of data. Between them, a plan sheet that fills with Terraform's symbols: `+ create` (green), `~ update in-place` (yellow), `-/+ replace` (orange-red, tagged "forces replacement"), `- destroy` (red).
**Opening frame**: Code and cloud match; the plan sheet is blank. Caption: "Code and cloud match. Now edit the code."
**Story**:

1. Edit `size = "medium"`. Plan compares the code with state and with what's real, and writes `~ vm.web: size small → medium`. Caption: "Plan: compare the code with reality."
2. Edit `name = "orders-database"`, a rename that looks cosmetic. Plan writes `-/+ db.orders (name forces replacement)`; the real database gets a red outline and its rows a red tint. Caption: "One renamed line: destroy, then create."
3. Spotlight the summary: `Plan: 1 to add, 1 to change, 1 to destroy`. Caption: "Read the plan, not just the diff."
4. A ghost run, "apply without reading": the database and its rows vanish and an empty one appears. Rewind. Caption: "The data would have gone with it."
5. The rename is reverted; the new plan shows only the `~` line. Caption: "Catch it before it happens."
6. Apply: the saved plan runs line by line; the VM grows; nothing else moves. Caption: "Apply does exactly what the plan said."

**The moment**: Beat 2, slowed: a one-word edit on the left, a red replace on a database full of data on the right. The mismatch in scale is the lesson.
**Interaction**: Pick an edit (resize the VM, add a tag, rename the database, change its region) and predict the plan symbol before it's revealed. Teaches update vs replace.
**Ending**: Code and cloud match again; the plan sheet is stamped "applied ✓".
**Variants**: `iac-state-file`, `iac-plan-in-pull-request`, `infrastructure-drift`; Bicep what-if, CloudFormation change sets, Pulumi preview.
**Techniques**: contents, restyle, spotlight, side by side, failure, appear/disappear, choice, caption.
**Review**: Keep — one renamed word producing a red replace on a database full of rows is the most memorable failure available, and the symbols, the plan summary line and applying a saved plan all match Terraform exactly.

### IaC state (`iac-state-file`)

**The aha**: State is the tool's memory of which real object belongs to which line of code; without it, the tool can't recognise what it built.
**Misconception to defeat**: The code is enough and the tool just looks at the cloud; or state and code are the same thing.
**Cast**: Left, declared infrastructure as a document with `network.main`, `vm.web`, `db.orders`. Right, the cloud full of resources: our three with opaque IDs (`vm-7f3a…`) mixed in with four grey ones from other teams. Middle, the state file as a ledger; each row is a thread running from a code line to a real object.
**Opening frame**: Three threads run code → ledger row → real object; the grey resources have none. Caption: "State: which real thing is which line of code."
**Story**:

1. Plan runs: a pulse follows each thread to its object, reads it and compares. All match. Caption: "The tool finds its resources through state."
2. Zoom into a row: `vm.web → id vm-7f3a, size small, ip 10.0.1.4`. Caption: "An address in code, an ID in the cloud, last known values."
3. The state file is deleted: the ledger burns and the threads snap. Plan again: code lines with no IDs, a cloud of look-alike resources, and `Plan: 3 to add`. Duplicates appear amber beside the originals, or creation fails ✗ on name clashes. Caption: "Lose state, and it tries to create everything again."
4. State is restored from backup; the threads reconnect. Caption: "So keep state safe, and shared."
5. Spotlight a row holding `admin_password = "S3cret!"` in plain text. Caption: "State can hold secrets. Guard it like one."
6. The ledger clones into three (dev, test, prod) from the same code, each threaded to its own environment. Caption: "One codebase, separate state per environment."

**The moment**: Beat 3: the threads snap, and the plan suddenly wants to build things that are standing right there.
**Interaction**: Toggle "with state" / "without state", then run plan.
**Ending**: The restored ledger with its threads intact, and its three workspace siblings.
**Variants**: `iac-remote-state-locking`, `terraform-plan-apply`, `infrastructure-drift` (refresh updates the last-known values); importing existing resources into state.
**Techniques**: contents, path trace, zoom, failure, appear/disappear, spotlight, clone, toggle, caption.
**Review**: Keep — the threads from code line to real object make state physical, the grey look-alikes quietly defeat "the tool just looks at the cloud", and losing state really does produce `Plan: 3 to add` and name clashes.

### Remote state and state locking (`iac-remote-state-locking`)

**The aha**: Only one plan or apply may hold the state at a time; the lock makes the second one wait or fail, because two writers on one state file overwrite each other.
**Misconception to defeat**: Git protects us: the code is in Git, so conflicts get caught. But Git holds the configuration, not the state.
**Cast**: Two engineers, Ana and Ben, each with a terminal on the left. The state file as a ledger. The cloud on the right. Later, a shared backend (a storage box) with a padlock slot on its lid.
**Opening frame**: Ana's and Ben's laptops each hold their own copy of the ledger, identical for now. Caption: "Two people, two copies of state."
**Story**:

1. Ana adds a subnet and applies; her copy gains a row. Ben pulls her code but not her copy of state. His plan has never heard of the subnet and plans `+ subnet` again; apply fails ✗ "already exists". Caption: "Copies on laptops disagree."
2. Both copies fly into the shared backend and merge into one ledger; both terminals connect to it. Caption: "Remote state: one copy for everyone."
3. Lock off: at the same instant, Ana adds a DNS record and Ben adds a tag. Both read the same ledger; Ana writes back first, then Ben's write lands on top. Her row is gone, though the record still runs in the cloud, amber and untracked. Caption: "Two writers at once: the last one wins."
4. ⟲ Replay, lock on: Ana's apply snaps the padlock shut, "held by ana, apply, 14:02". Ben's apply bounces off ✗ "Error acquiring the state lock" (or waits, if he set a lock timeout). Caption: "The first apply takes the lock."
5. Ana finishes and the padlock opens. Ben runs again: his plan reads the latest ledger, her record included, and adds only his tag. Caption: "Then the next one runs, on the latest state."

**The moment**: Beat 4, slowed at the collision point: Ben's token stopped at the padlock, with beat 3's untracked record alongside.
**Interaction**: "Run both at once", with a lock on/off toggle. "Kill Ana's laptop mid-apply": the padlock stays shut until someone runs `force-unlock`, a command for emergencies only.
**Ending**: One ledger, unlocked, holding both changes. Caption: "Git holds the code. The backend holds the state."
**Variants**: `iac-state-file`, `iac-plan-in-pull-request` (a pipeline as the single applier); Terraform backends on Azure Storage (blob lease), S3 (a lock file; DynamoDB in older setups), Cloud Storage, HCP Terraform.
**Techniques**: token, contents, clone, move, failure, restyle, toggle, replay, side by side, caption.
**Review**: Improved — fixed two errors. Ben's stale state wouldn't destroy Ana's subnet (Terraform only destroys what its state knows); it would try to create it again. And unlocked writes don't interleave: the last writer drops the other's change, leaving an untracked resource. The lock now fails fast, as Terraform does by default, and a stuck-lock interaction was added.

### Infrastructure drift and drift detection (`infrastructure-drift`)

**The aha**: Drift is reality quietly moving away from the code; until it's detected and then codified, reverted or imported, the next apply can silently undo someone's fix.
**Misconception to defeat**: Once applied, infrastructure stays as declared.
**Cast**: Declared infrastructure as a document on the left; real resources on the right: a VM, a firewall with its rule list, a storage account with tags. Faint lines link each declared attribute to its real one. An on-call engineer at a console. A clock above, for the scheduled drift check.
**Opening frame**: The code says the firewall allows 443; the real firewall allows 443; every link is grey. Caption: "Code and reality match."
**Story**:

1. 2 a.m. outage: the engineer adds `allow 8443` in the console. The real firewall gains a rule, the code doesn't, and the gap glows amber. Users recover. Caption: "A manual hotfix. The code doesn't know."
2. Days pass: someone resizes the VM and deletes a tag (more amber), and someone clicks a new bucket into existence; it has no link to the code, so nothing glows. Caption: "Drift builds up quietly."
3. A week later, an unrelated apply adds a tag. Its plan also says `~ firewall: remove allow 8443`, lost in the noise. Applied: the rule vanishes and the outage returns ✗. Caption: "The next apply undoes the fix."
4. ⟲ Rewind. A nightly scheduled plan compares code with reality and raises a drift report listing the three amber gaps. Caption: "Detect it: compare on a schedule."
5. A spotlight finds the hand-made bucket: it isn't on the report, because the code never mentioned it. Caption: "It only sees what the code manages."
6. Each gap gets a decision. The 8443 rule is copied into the code (codify); the VM is resized back (revert); the bucket is imported into the code. Every link turns grey. Caption: "Then codify, revert or import."

**The moment**: Beat 3, slowed: a harmless-looking apply quietly deleting the fix and the outage coming back.
**Interaction**: Change something by hand in the console (a firewall rule, the VM size, a tag) and watch the amber appear; create a new resource by hand and watch the check miss it. Then run the check and choose codify, revert or import for each gap.
**Ending**: Code and reality aligned, the clock ticking towards the next check.
**Variants**: `gitops-reconciliation` (reverts drift automatically), `configuration-management` (drift inside servers), `iac-state-file`; Terraform `plan -refresh-only` and `import` blocks, HCP Terraform and CloudFormation drift detection; Azure Resource Graph or AWS Config to find unmanaged resources.
**Techniques**: side by side, restyle, timer, failure, contents, spotlight, replay, choice, caption.
**Review**: Improved — added what drift detection can't see: a scheduled plan only compares what the code manages, so a resource clicked into existence is invisible to it. Import joins codify and revert, as the catalog row says, and beats 5–6 were merged to make room.

### IaC modules (`iac-modules`)

**The aha**: Write the pattern once, with safe defaults, and every environment calls the same module with different inputs, so a fix made once reaches everywhere.
**Misconception to defeat**: Each environment gets its own copy of the files, edited by hand.
**Cast**: A module drawn as a blueprint box `web_app v1.2` with input sockets on its edge (`size`, `count`) and parts inside: a scale set, a load balancer, a firewall marked "HTTPS only", logging. Dev, test and prod zones on the right, each with a short calling document.
**Opening frame**: Copy-paste: `dev/`, `test/` and `prod/` folders each hold a full 200-line copy, with small amber differences: test lacks "HTTPS only", dev has no logging. Caption: "Copy-paste: three copies that slowly differ."
**Story**:

1. A TLS fix lands in prod's copy only; test and dev stay amber. Caption: "Fix one copy; the others stay broken."
2. The three copies collapse into one blueprint; each folder shrinks to a five-line call. Caption: "Write the pattern once."
3. Inputs plug in: dev `size=small, count=1`, prod `size=large, count=6`. Each zone renders from the same blueprint: different size, identical shape. Caption: "Same module, different inputs."
4. Dev's call never mentions HTTPS, yet its firewall shows "HTTPS only". Caption: "Safe defaults come free."
5. The TLS fix goes into the blueprint as v1.3. Dev bumps its version pin first, then test, then prod; the fix spreads zone by zone. Caption: "Fix once. Each environment upgrades by version."

**The moment**: Beat 3: one blueprint stamping out three environments of different sizes but identical shape, beside the opening's three drifting copies.
**Interaction**: Dials for each environment's inputs (`count`, `size`), and a version pin (v1.2 / v1.3) to toggle per environment.
**Ending**: One module, three short calls, three consistent environments.
**Variants**: `reusable-pipeline-templates` (the same idea for pipelines), `environment-parity`, `platform-engineering`; Terraform registry modules, Bicep modules (Azure Verified Modules), CDK constructs.
**Techniques**: clone, contents, side by side, restyle, move, dial, toggle, caption.
**Review**: Keep — three drifting copies collapsing into one blueprint shows the payoff before explaining it, and version pins rolling a fix out environment by environment are true to how modules are consumed.

### Idempotency in IaC and deployments (`iac-idempotency`)

**The aha**: Running the same apply again gives the same result and changes nothing if nothing changed, which is what makes retries and automation safe.
**Misconception to defeat**: Running it again does it again, so re-running a deployment is risky.
**Cast**: Two lanes. Top, a script `create bucket logs`. Bottom, a declaration `bucket logs exists`. Each lane has a run button, a run counter and a cloud zone.
**Opening frame**: Both zones empty. Caption: "Same intent: a bucket called logs."
**Story**:

1. Run 1: both create the bucket ✓. Caption: "First run: both work."
2. Run 2: the script fails ✗ "bucket already exists". The declaration checks, finds the bucket as declared, and reports "No changes". Caption: "Second run: one fails, one does nothing."
3. A bigger deploy of four resources is cut off by a network failure after two. An automatic retry: the script starts from the top and fails on step 1, stuck. The declaration sees two present and creates the missing two. Caption: "After a failure, the retry finishes the job."
4. Runs 3 to 50 in a fast montage on the declarative lane: the counter climbs, the cloud doesn't change, "0 changes" every time. Caption: "Run it fifty times: same result."
5. Deploy steps too: "append this line to the config" adds a duplicate on each run; "ensure this line is present" doesn't. Caption: "Write steps as 'make it so', not 'do it'."

**The moment**: Beat 2: the same second run, a red ✗ above and a calm "No changes" below.
**Interaction**: "Run again" (as often as you like) and "fail halfway" buttons.
**Ending**: The declarative lane's counter in the dozens and its cloud unchanged.
**Variants**: `declarative-vs-imperative`, `configuration-management`, `gitops-reconciliation` (reconcilers rely on idempotent applies); idempotent consumers in Messaging.
**Techniques**: side by side, lanes, meter, failure, appear/disappear, choice, caption.
**Review**: Keep — the same second run giving ✗ above and "No changes" below is the whole idea in one frame; the interrupted retry shows why automation needs it, and "append" vs "ensure present" carries it to any deploy step.

### Resource dependency graph (`iac-dependency-graph`)

**The aha**: Build order comes from the references between resources, not from where they're written; independent resources are built in parallel, and destroy walks the graph backwards.
**Misconception to defeat**: The tool runs the file from top to bottom.
**Cast**: Left, a document listing six resources in a jumbled order (`vm`, `dns_record`, `subnet`, `storage`, `network`, `nic`) with a numbered to-do column 1–6 beside them. Right, an empty canvas for the graph and, below it, a time axis of build lanes.
**Opening frame**: The document with its 1–6 column. Caption: "Written in this order. Built in this order?"
**Story**:

1. References light up as arrows between lines: `vm` uses `nic.id`, `nic` uses `subnet.id`, `subnet` uses `network.id`, `dns_record` uses `vm.ip`. Nothing points at `storage`. Caption: "References link resources."
2. The lines lift off the page and fall into a graph: network → subnet → nic → vm → dns, with storage on its own. The 1–6 column fades. Caption: "The tool builds a graph from them."
3. Apply: network and storage start at the same moment, progress bars filling side by side in the lanes; each next node starts as soon as the one it depends on finishes. Caption: "Independent ones build in parallel."
4. Total time equals the longest chain, not the sum of all six. Caption: "Order from the graph, not the file."
5. Destroy: the arrows reverse; dns goes first and network last. Caption: "Destroy walks it backwards."

**The moment**: Beat 2: the list falling into a graph, with storage visibly breaking away from the chain.
**Interaction**: Shuffle the file: the graph and the build order don't change. Replace the nic's `subnet.id` reference with the subnet's ID typed in as text: the arrow disappears, the nic starts alongside the network and fails ✗ "subnet not found". A dependency the tool can't see has to be stated (`depends_on`).
**Ending**: The graph with every node green and the lanes showing what ran in parallel.
**Variants**: `pipeline-parallelism-matrix` (the same longest-path idea), `terraform-plan-apply`; `depends_on` for hidden dependencies; Terraform builds 10 at a time by default (`-parallelism`).
**Techniques**: move, path trace, lanes, meter, restyle, failure, choice, caption.
**Review**: Improved — "delete the reference" would just break the configuration; the interaction now swaps the reference for a typed-in ID, the real way a dependency becomes invisible to the tool, so the early start and failure follow. Added Terraform's default parallelism.

### Plan in the pull request (`iac-plan-in-pull-request`)

**The aha**: Reviewers approve the change to real infrastructure (the plan posted on the PR), not just a diff of the code, and merging applies the change they approved.
**Misconception to defeat**: Reviewing the code diff is enough.
**Cast**: Left, a pull request card with a small code diff. Under it, a CI row of gates: validate, lint, plan. A reviewer figure. Right, the cloud: a VM `web` at `20.1.2.3` and a DNS record pointing at it. A plan comment card that attaches to the PR.
**Opening frame**: The PR shows `- image = "ubuntu-22.04"` / `+ image = "ubuntu-24.04"` and the reviewer looking at it. Caption: "A two-line change. Safe to merge?"
**Story**:

1. The reviewer reads the diff; a thought bubble shows a thumbs-up. Caption: "The diff looks harmless."
2. The PR triggers CI: validate ✓, lint ✓, then plan runs against real state. A comment unfolds on the PR: `-/+ vm.web must be replaced (image forces replacement)` and `~ dns.web: 20.1.2.3 → (known after apply)`. The replace line glows red. Caption: "CI posts what will actually happen."
3. The reviewer's eye moves from the diff to the plan, stops on the red line, and requests changes ✗. Caption: "Review the plan, not just the code."
4. The author reworks it to build the new server beside the old one first; the new plan is a single `+ create`, nothing destroyed; approved ✓. Caption: "Iterate until the plan is what you want."
5. Merge: the pipeline applies the saved plan, the new server appears, and an "applied ✓" comment joins the thread. Caption: "Merging applies what was reviewed."

**The moment**: Beat 2: the plan comment unfolding under a harmless-looking diff, its red line the only colour on screen.
**Interaction**: A quiz of small diffs: guess "harmless" or "dangerous" for each before its plan is revealed. Only the plan tells. Then apply someone else's change first and merge: the saved plan is now stale, so it's refused and a fresh plan is posted for review.
**Ending**: The merged PR with its plan and applied comments; the cloud updated.
**Variants**: `terraform-plan-apply`, `policy-as-code` (rules checked against the same plan), `pull-request-checks`, `gitops` (an agent pulls instead of CI applying); Atlantis (applies from the PR, then merges), HCP Terraform (a speculative plan on the PR, a fresh run on merge).
**Techniques**: contents, token, restyle, spotlight, appear/disappear, failure, choice, caption.
**Review**: Improved — Application Gateway has no Premium SKU, so the diff is now an OS image bump, which really does force a VM replacement, and the DNS change follows from the new IP. "Applies exactly that plan" was softened to what holds across tools, and the stale-plan case moved into the interaction.

## Servers, images and environments

### Immutable vs mutable infrastructure (`immutable-infrastructure`)

**The aha**: Never patch a running server; bake the fix into a new image and replace the servers, so every server stays identical to its image and rollback is just launching the previous image again.
**Misconception to defeat**: Patching in place is normal and cheap; throwing away a working server over one fix feels wasteful.
**Cast**: Two lanes, "Mutable" and "Immutable", each with three servers behind a load balancer. Mutable servers collect patch stickers. Immutable: an image box with a version tag (v1 blue, v2 violet) and servers stamped from it; replaced servers fade out rather than being edited.
**Opening frame**: Both lanes: three identical servers tagged v1. Caption: "Three identical servers. Now apply a fix."
**Story**:

1. Mutable: SSH in and upgrade each server. Server 2's upgrade fails halfway; server 3 is down for maintenance and gets skipped. The stickers land unevenly. Caption: "Patch in place."
2. Months pass: more hand-applied patches, a different pile on each server. "Snowflake" labels appear; no document describes any of them now. Caption: "Every manual fix makes each server unique."
3. Immutable lane: the fix becomes a line in the image recipe; image v2 is baked. Caption: "Bake the fix into a new image."
4. Three v2 servers spawn beside the v1 ones, traffic shifts to them, and the v1 servers fade and are destroyed. The three are exact copies. Caption: "Replace, don't patch."
5. Something breaks in v2. Mutable: an engineer undoes patches by hand, server by server, unsure which sticker caused it. Immutable: launch from v1 again; identical servers return. Caption: "Rollback: launch the old image again."

**The moment**: Beat 5 side by side: a frantic manual undo with no clear culprit, against one calm switch back to a known-good image.
**Interaction**: Click "patch" repeatedly on the mutable fleet and watch the three servers drift apart as patches fail or get skipped; click "bake new image" on the immutable lane to spawn a clean generation.
**Ending**: The mutable lane holds three sticker piles no one can fully describe; the immutable lane holds identical v2 servers, with v1 kept on the shelf. Loops by baking v3.
**Variants**: `golden-image` (how the image gets built), `configuration-management`, `build-once-deploy-many`, `rollback-vs-roll-forward`; pets vs cattle (Fundamentals).
**Techniques**: clone, restyle, contents, side by side, lanes, failure, choice, caption.
**Review**: Improved — a single mutable server can't show servers drifting apart, so it's now a fleet of three where a patch fails on one and another is skipped, which makes "snowflake" visible. Images now use v1 blue and v2 violet, and the ending's version numbers follow on.

### Configuration management (`configuration-management`)

**The aha**: Provisioning creates the machine; configuration management is the separate, ongoing job of bringing the software and settings inside it to a declared state, and keeping them there.
**Misconception to defeat**: Provisioning and configuring are the same step; or "configuration management" means keeping everything in version control (the _Continuous Delivery_ book's older use of the term).
**Cast**: Left, Terraform producing bare VMs (empty rooms). Middle, a configuration document listing desired state: `nginx: installed`, `firewall: 443 open`, `cert: v3`. Right, one VM's interior with three slots for those items, and behind it a fleet of twenty identical VMs. The configuration tool either reaches in from outside (push, e.g. Ansible over SSH) or lives inside each VM as an agent, looping on its own (pull, e.g. Puppet every 30 minutes).
**Opening frame**: A bare VM, an empty room, the document listing three unchecked items. Caption: "Provisioning made the machine. What runs inside it?"
**Story**:

1. The configuration tool runs; each slot fills: nginx ✓, firewall rule ✓, cert ✓. Zoom out: all twenty VMs fill the same way. Caption: "Converge every machine to the document."
2. Someone disables the firewall rule inside one VM; the slot empties, amber. Push: nothing changes until someone runs the tool again. Pull: the agent's loop ticks, notices and restores the rule. Caption: "A pull agent keeps correcting on its own."
3. The document changes to `cert: v4`; on the next run (push) or tick (pull), all twenty machines update to match. Caption: "Change the document, the fleet follows."

**The moment**: Beat 2: the pull agent quietly undoing the manual change on its next tick, while push stays silent until someone runs it.
**Interaction**: Toggle push/pull, then break a setting inside any VM and watch whether, and when, it self-heals.
**Ending**: All twenty rooms match the document, the pull agents' loops pulsing quietly. An end card: "Not the _Continuous Delivery_ book's 'configuration management' (version everything)."
**Variants**: `immutable-infrastructure` (bake instead of converge), `golden-image`, `iac-idempotency` (why re-running is safe), `gitops-reconciliation` (the same loop for Kubernetes); Ansible, Chef, Puppet, Azure Machine Configuration (DSC), AWS Systems Manager State Manager.
**Techniques**: contents, token, loop, zoom, restyle, failure, toggle, side by side, caption.
**Review**: Improved — the beat on the term's other meaning was a second idea, so it's now an end card. One VM became a fleet of twenty, because converging many machines from one document is the point. Added real tools and Puppet's 30-minute pull interval.

### Golden images (`golden-image`)

**The aha**: Bake the hardened, fully set-up image once, at build time; every instance launches from it ready to serve, instead of setting itself up every time it boots.
**Misconception to defeat**: Setup belongs at boot: install packages, harden, configure, on every launch ("fry at boot"). Or the opposite slip: bake everything in, secrets included.
**Cast**: Two lanes, each ending at a launch pad. "Fry at boot": a bare base image and a boot script (install, harden, configure) that runs on every launch. "Bake once": a bake station (Packer) in the pipeline that runs the same steps once and seals a golden image with a version tag. A stopwatch per lane, and a public package mirror both lanes reach.
**Opening frame**: Both lanes idle at their launch pads, the same three steps listed in each. Caption: "Set up every boot, or once?"
**Story**:

1. Fry lane: a bare image launches; the boot script runs step by step, the stopwatch climbing into minutes; one step stalls on the flaky package mirror ✗. Caption: "Set up on every boot."
2. Bake lane: the same steps run once, in the pipeline, sealing golden image v1.4. Caption: "Do it once, seal it into an image."
3. A traffic spike: ten instances needed now. Fry lane: ten boot scripts run, several stall, the stopwatch keeps climbing. Bake lane: ten instances launch from v1.4, ready in about a minute, all identical; each fetches only its own config and secrets. Caption: "Launch fast and identical."
4. A security patch is needed. Fry lane: edit the boot script; instances already running never pick it up. Bake lane: bake v1.5, then replace the instances. Caption: "Patch by rebaking."

**The moment**: Beat 3 side by side: the fry lane's ragged, partly stalled scale-out against the bake lane's clean, simultaneous one.
**Interaction**: Dial the instance count (1–20) and the mirror's flakiness, and compare time-to-ready between the lanes.
**Ending**: A fleet of identical v1.5 instances, with a shelf of past images (v1.3, v1.4) kept for rollback.
**Variants**: `immutable-infrastructure`, `configuration-management` (often what runs inside the bake), `container-image-pipeline` (the same idea for container images); Packer, EC2 Image Builder, Azure VM Image Builder.
**Techniques**: clone, contents, timer, side by side, failure, meter, dial, caption.
**Review**: Improved — listing "pull secrets" as boot work that baking replaces implied baking secrets into the image; now only per-instance config and secrets arrive at boot. "Ten at once" became a traffic spike, "almost instantly" became about a minute, and Packer is named.

### Ephemeral preview environments (`ephemeral-environments`)

**The aha**: IaC makes a full environment cheap enough to create for a single pull request and throw away when it closes, so every change can be seen and tested on its own.
**Misconception to defeat**: Everyone shares one staging environment, so unrelated changes queue up and interfere with each other.
**Cast**: Left, the repo with pull requests opening as branches. Right, a "shared staging" zone (one crowded box) above a row of per-PR zones, each a small full copy of the stack (app plus a database seeded with test data) stamped from the same IaC module, labelled with its PR number and a cost meter that ticks while it exists.
**Opening frame**: Shared staging holds two unrelated changes, #41 and #42, overlapping, with an amber conflict mark between them. Caption: "One staging environment, several changes at once."
**Story**:

1. #42's tests run in shared staging against #41's half-finished data change and fail ✗; nobody can tell whose change broke it. Caption: "Shared staging: changes trip over each other."
2. ⟲ Replay. PR #41 opens: the IaC module stamps out a full environment just for it, and a bot comments the link `pr-41.preview.example.com` on the PR. Caption: "Each PR gets its own environment."
3. PR #42 opens and gets its own. A reviewer clicks each link and sees exactly one change. Caption: "Seen and tested on its own."
4. PR #41 merges: its environment is destroyed and its cost meter stops. Caption: "Destroyed on merge or close."
5. A PR left open for weeks: its meter keeps climbing until an idle timeout tears the environment down. Caption: "It costs money while it waits."

**The moment**: Beat 1 against beat 3: a tangled collision in shared staging, next to two clean boxes side by side, each one link away.
**Interaction**: Open and close PRs and watch environments appear and vanish with their cost meters; set an idle timeout, then leave a PR open.
**Ending**: Zero open PRs, zero preview environments, the total cost frozen; a new PR opens and one appears.
**Variants**: `infrastructure-as-code`, `iac-modules` (what defines each environment), `environment-parity`, `platform-engineering` (the self-service version of this); Azure Deployment Environments, Argo CD's pull-request generator, Vercel and Netlify previews.
**Techniques**: clone, appear/disappear, contents, meter, timer, boundary, failure, replay, side by side, caption.
**Review**: Improved — the countdown bar meant two things, so it's now a cost meter plus an idle timeout. The preview link on the PR makes "seen" concrete, and an interaction that gave the viewer nothing to do was replaced.

### Environment parity (`environment-parity`)

**The aha**: Every difference between staging and production is a place for a bug to hide, so keep them alike in runtime, dependencies, config shape and deploy process; parity is about shape, not scale.
**Misconception to defeat**: Staging just needs to be "close enough"; or parity means matching size and cost.
**Cast**: Two zones side by side, `staging` and `prod`, each with four labelled slots: runtime, deploy process, config (part 1's sticky note) and size (an instance-count dial). Mismatched slots glow amber. A bug icon that can hide in any amber slot.
**Opening frame**: Staging runs Python 3.9, deployed by a hand-run script; prod runs Python 3.12, deployed by the pipeline; the config notes have different keys; staging has 1 instance, prod 6. Caption: "Close enough?"
**Story**:

1. A change that imports `distutils` passes every staging test, then crashes in prod, because Python 3.12 removed it. The bug pops out of the runtime slot ✗. Caption: "The bug was hiding in the difference."
2. ⟲ Rewind. The runtime slots match: 3.12 in both. Caption: "Same runtime."
3. Staging's hand-run script is replaced by prod's pipeline, IaC modules and artifact (seal `9c2e` in both zones). Caption: "Same artifact, same process, same modules."
4. The config notes line up: the same keys, only the values differ (`db: stg-db` vs `db: prod-db`). The size dials stay at 1 and 6, grey rather than amber. Caption: "Same shape, different size."
5. The same change runs again: staging fails it ✗ before prod ever sees it. Caption: "Now staging catches what prod would."

**The moment**: Beat 1 against beat 5: the same change slipping through once, then caught in staging.
**Interaction**: Toggle each slot between matched and mismatched and replay the change: only a mismatch in shape lets this bug through, and shrinking staging's size never does.
**Ending**: Staging and prod matched on every slot except size.
**Variants**: `ephemeral-environments`, `build-once-deploy-many`, `iac-modules`, `environment-promotion`; the Twelve-Factor App's dev/prod parity.
**Techniques**: side by side, restyle, contents, dial, failure, toggle, replay, caption.
**Review**: Improved — the unnamed "runtime quirk" is now a real one (`distutils`, removed in Python 3.12). "Same artifact" was added from the catalog row, and a beat that repeated beat 3's caption was folded in.

## GitOps

### GitOps (`gitops`)

**The aha**: Git becomes the control panel: you change the system by merging a PR, an agent inside the system pulls the change and keeps it true, so the audit trail is `git log` and rollback is `git revert`.
**Misconception to defeat**: GitOps is any CI/CD pipeline triggered by a Git push, or just another name for infrastructure as code.
**Cast**: Left, a Git repo holding a manifest (`replicas: 3`). Right, the live system as a boundary holding resource icons, with an agent inside drawn as a loop. Above, four lamps for the OpenGitOps principles: Declarative, Versioned and immutable, Pulled automatically, Continuously reconciled. A human merges PRs on the left; no arrow runs from a human or CI into the live system.
**Opening frame**: `replicas: 3` in Git, three resources live, the loop pulsing, status "Synced"; the four lamps dark. Caption: "Git describes it. A loop inside keeps it true."
**Story**:

1. A PR changes `replicas: 3 → 5`; it's reviewed and merged as a new commit. Lamps 1 and 2 light. Caption: "Change the system: merge a PR."
2. The agent pulls the new commit, sees 3 live against 5 wanted, and adds two. Lamp 3 lights. Caption: "Pulled automatically."
3. Someone deletes a resource by hand; on its next pass the loop sees 4 against 5 and recreates it. Lamp 4 lights. Caption: "Continuously reconciled."
4. A bad change merges, `replicas: 0`, and the system goes dark. A `git revert` merges and the loop brings back all five; nobody touches the system itself. Caption: "Rollback: git revert."
5. `git log` unrolls as the record of every change the system has had. Caption: "Audit: git log."
6. ⟲ Replay of beats 2–3 with CI running `kubectl apply` on merge: the change lands, but lamps 3 and 4 stay dark and the hand-deleted resource stays gone. Caption: "CI pushing on merge isn't GitOps."

**The moment**: Beat 4: an outage fixed by a revert commit alone, with no hand anywhere near the live system.
**Interaction**: Merge commits (scale up, scale down, a bad value) and watch the loop converge; edit the live system directly and watch it revert; switch to "CI pushes" and see which lamps go dark.
**Ending**: Git and the live system match, all four lamps lit, the loop pulsing.
**Variants**: `push-vs-pull-deployment`, `gitops-reconciliation`, `gitops-environment-promotion`, `argocd-sync-and-health`, `infrastructure-as-code`; Argo CD, Flux.
**Techniques**: contents, loop, token, restyle, appear/disappear, failure, replay, toggle, caption.
**Review**: Improved — the four principles were listed in the aha but never shown. They're now lamps that light as each one is demonstrated, and the CI-push replay leaves two dark, a visible test of the misconception. The moment moved to the revert, the clearest proof that Git is the control panel.

### Push vs pull deployment (`push-vs-pull-deployment`)

**The aha**: Push: CI holds the target's credentials and reaches in. Pull: an agent inside the target fetches the desired state itself. Pull keeps those credentials out of CI and keeps correcting drift, but pull alone isn't GitOps.
**Misconception to defeat**: Push vs pull is an implementation detail; or any pull agent means you're doing GitOps.
**Cast**: Two lanes, each with Git on the left and a target environment drawn as a boundary on the right. "Push": CI holds the target's gold key and reaches across the boundary through an open inbound door. "Pull": an agent inside the boundary, drawn as a loop, reaching out to Git with only a read-only token; the boundary has no inbound door.
**Opening frame**: Both lanes: the same manifest in Git, identical in-sync targets. Caption: "Same change, two directions."
**Story**:

1. Push lane: the pipeline runs; the key crosses the boundary, makes the change, retracts. Caption: "Push: CI reaches in, holding the key."
2. Pull lane: the agent's loop ticks, reads Git and applies the change from inside. Caption: "Pull: the target fetches for itself."
3. Both CI systems are breached. The attacker clones the push lane's key and walks in through the door. In the pull lane, CI holds no key to the target and the boundary has no door. Caption: "No target key in CI, nothing to steal."
4. Someone changes both targets by hand. Push: nothing happens until CI runs again. Pull: the next tick reverts it. Caption: "Pull keeps correcting. Push acts only when run."
5. The pull lane's agent is pointed at a file in a bucket anyone can overwrite, with no review and no history; it pulls and applies whatever is there. Caption: "Pull is needed for GitOps, not enough."

**The moment**: Beat 3: the stolen key opening the push lane's door while the pull lane's boundary offers nothing to grab.
**Interaction**: "Breach CI" on each lane; switch the pull lane's source between a reviewed, versioned Git repo and an overwritable bucket.
**Ending**: The push lane's boundary still shows its door; the pull lane's shows none, just the loop ticking inside. Caption: "With pull, guard the repo: whatever merges gets applied."
**Variants**: `gitops`, `gitops-reconciliation`, `pipeline-oidc-federation` (push done more safely, but still push), `configuration-management` (the same push/pull split for servers).
**Techniques**: boundary, token, loop, clone, failure, side by side, toggle, caption.
**Review**: Improved — the pull agent does hold a credential (read-only, for Git), so "nothing to steal" became "no target key in CI", and the ending says where the risk moves: guard the repo. The vague "pull but not GitOps" case became an overwritable bucket, and the missing opening caption was added.

### GitOps reconciliation loop (`gitops-reconciliation`)

**The aha**: A controller endlessly compares Git's desired state with the cluster's live state and applies the difference; because the loop never stops, a manual change in the cluster is undone on the next pass.
**Misconception to defeat**: This is a one-time deployment that happens when you push, not something running continuously.
**Cast**: A Git manifest (`replicas: 3`, `image: v1.2`) on the left. A controller in the middle, drawn as the loop technique circling through "read Git" → "read cluster" → "diff" → "apply", with a tick label "every 2–3 min, or at once on a webhook". A Kubernetes cluster of pods on the right. A small "self-heal" switch on the controller, on.
**Opening frame**: Git says 3 replicas of v1.2; the cluster shows 3 matching pods; status reads "Synced", loop idling. Caption: "It never stops checking."
**Story**:

1. The loop pulses on a visible tick: read Git, read cluster, compare, find nothing to do. Caption: "Every tick, it checks again."
2. A commit changes `image: v1.2 → v1.3`. Next tick: the diff shows a mismatch, status flips to "OutOfSync", amber. Caption: "OutOfSync: Git and cluster disagree."
3. The controller applies the difference: pods roll from v1.2 to v1.3 one at a time; status flips back to "Synced", green. Caption: "Apply the difference."
4. Someone runs a manual scale command straight on the cluster, to 5 replicas. Next tick: the diff shows 5 live against 3 desired, "OutOfSync" again. Caption: "A manual change is drift, too."
5. The controller scales back down to 3 without anyone asking it to. Caption: "Self-healing: it reverts what Git doesn't say."

**The moment**: Beat 5: pods shrinking back from 5 to 3 entirely on their own, with no human triggering it.
**Interaction**: Edit the live cluster directly (scale it, change its image) and watch the next tick correct it; change the Git commit instead and watch the same mechanism apply it forward. Turn self-heal off: the manual change is still flagged OutOfSync, but it stays until someone syncs. Detecting isn't correcting.
**Ending**: "Synced" held steady, the loop still pulsing.
**Variants**: `gitops`, `argocd-sync-and-health`, `gitops-environment-promotion`, `infrastructure-drift` (the IaC-world sibling: detect, then a human decides, instead of auto-revert); Flux (corrects drift on every interval), Argo CD (automated sync and self-heal are both opt-in; polls every 2–3 minutes by default).
**Techniques**: loop, contents, restyle, failure, meter, toggle, caption.
**Review**: Improved — Argo CD detects drift by default but only reverts it with self-heal on. Added a self-heal switch, an interaction that separates detecting from correcting, and the real 2–3 minute polling interval.

### GitOps environment promotion (`gitops-environment-promotion`)

**The aha**: Promotion is a reviewed, revertible commit that changes one environment's folder in a config repo (usually just an image tag), while the app repo only builds images: no branch per environment, no rebuild.
**Misconception to defeat**: Promoting to the next environment means merging a branch or rebuilding the code; or application code and environment config live in the same place.
**Cast**: Two repos side by side. "App repo": a commit stack whose CI builds an image, tags it and pushes it to a registry. "Config repo": `dev/`, `test/` and `prod/` folders, each a small manifest with an `image:` line. An image-update bot watches the registry. On the right, three cluster zones, each with its own reconciliation loop watching its own folder.
**Opening frame**: App repo at v1.4.1; the registry holds that image; all three config folders read `image: v1.4.1`; the three clusters match. Caption: "One repo builds images. The other decides where they run."
**Story**:

1. The app repo gets a new commit; CI builds and pushes image v1.4.2 to the registry. Nothing deploys. Caption: "Code lives here, and builds an image."
2. The bot notices the new tag and opens a PR against `dev/`, changing `image: v1.4.1 → v1.4.2`. Caption: "Promotion is a PR to the config repo."
3. The PR merges; dev's loop picks it up and dev's cluster updates. Test and prod stay visibly behind on v1.4.1. Caption: "Each environment moves on its own commit."
4. After bake time, a PR bumps `test/` too; reviewed, merged, test's cluster updates. Caption: "Promotion is reviewed, like code."
5. Something's wrong in test: the promotion PR is reverted, and test's cluster rolls back through the same loop. Caption: "Roll back: revert the config commit."
6. A fixed v1.4.3 takes the same path: dev, test, then prod, one PR each. Caption: "Prod moves last, on its own commit."

**The moment**: Beat 3: dev's zone changing while test and prod visibly don't, from one commit touching one folder.
**Interaction**: Open, merge and revert promotion PRs for each environment independently, and watch each cluster react only to its own folder's commits.
**Ending**: All three folders and clusters on v1.4.3; `git log` on the config repo reads as the promotion history, one PR per hop.
**Variants**: `gitops`, `gitops-reconciliation`, `environment-promotion` (the general, non-GitOps version), `container-image-pipeline`, `push-vs-pull-deployment`; Flux image automation, Argo CD Image Updater, Kargo.
**Techniques**: token, contents, loop, move, restyle, failure, caption.
**Review**: Improved — fixed a continuity error: test was reverted to v1.4.1, then every environment read v1.4.2. A fixed v1.4.3 now makes the trip. The opening and beat 6 got their own captions, and each cluster its own loop.

### Sync status vs health (`argocd-sync-and-health`)

**The aha**: Sync status asks "does the cluster match Git?" and health asks "is it actually working?"; they're separate questions, and Git can describe a broken app perfectly, so Synced doesn't mean Healthy.
**Misconception to defeat**: Once the controller says "Synced", the deployment must be fine.
**Cast**: Git on the left. An Argo CD application card with two independent badges: "Sync" (Synced green, OutOfSync amber) and "Health" (Healthy green, Progressing as a grey spinning ring, Degraded red). Below it, the app's pods, each with a restart counter.
**Opening frame**: A 2×2 grid of small application cards, one per combination: Synced + Healthy, OutOfSync + Healthy, Synced + Degraded, OutOfSync + Degraded. Caption: "Two separate questions."
**Story**:

1. Spotlight Synced + Healthy: Git says v2, the cluster runs v2, pods green and serving. Caption: "Synced and healthy: the normal state."
2. Spotlight Synced + Degraded: a commit changes `DB_HOST: orders-db` to `ordres-db`. The controller applies it faithfully and sync stays green. The new pods can't reach a database, exit and restart in a loop, their counters climbing; health spins Progressing, then turns Degraded. Caption: "Git described it perfectly. It just doesn't work."
3. Spotlight OutOfSync + Healthy: someone scales the app by hand; sync flips amber while the pods stay green and serving. Caption: "Drifted, but still working."
4. Back to beat 2's card: pressing "sync again" changes nothing. A commit fixing the typo does: sync blips OutOfSync, then Synced; health spins Progressing, then turns Healthy. Caption: "Fix it in Git. Watch health, not just sync."

**The moment**: Beat 2: the calm green "Synced" badge sitting directly above crash-looping pods whose restart counters keep climbing.
**Interaction**: Pick any cell of the grid to play its scene, including both-wrong-at-once; press "sync again" on the Degraded case and watch it stay broken until the commit is fixed.
**Ending**: Back to Synced + Healthy, both badges green, pods calm.
**Variants**: `gitops-reconciliation`, `automated-canary-analysis` and `progressive-delivery` (health judged from metrics), `quality-gates` (post-deploy health checks more generally); Argo CD's other health states (Suspended, Missing); Flux's per-resource Ready condition.
**Techniques**: restyle, spotlight, contents, failure, meter, side by side, choice, caption.
**Review**: Improved — a missing image tag gives ImagePullBackOff, not a crash loop. The broken commit is now a config typo the app crashes on, health passes through Progressing as Argo CD reports it, and the filler beats became a fix-it-in-Git ending.

## DevOps practice and measurement

### DevOps (`devops`)

**The aha**: DevOps tears down the wall between building and running software: the team that builds a service also ships and runs it, with automation and fast feedback, so speed and safety come together instead of trading off.
**Misconception to defeat**: DevOps is a job title, a team name or a toolchain.
**Cast**: Two rooms, "Dev" (full of commits) and "Ops" (full of alerts), with a solid wall between them and a one-way hatch labelled "throw it over". The prod zone and its user crowd on the right. A stopwatch for time to fix.
**Opening frame**: The walled scene, the wall solid between the rooms. Caption: "Built here. Run over there."
**Story**:

1. Dev throws a package over the wall; it breaks in prod and an alert fires in Ops, who have never seen this code. Caption: "The people who can fix it don't know it broke."
2. Ops files a ticket back over the wall; the stopwatch runs for days before Dev sees it. Caption: "Feedback crawls back, if at all."
3. A tempting fix: a third room appears between them, labelled "DevOps team" and stocked with tool logos. Now there are two walls and two hatches to cross. Caption: "A new team in the middle is just another wall."
4. ⟲ Rewind. The walls dissolve: one team spans build and run, and the deployment pipeline runs straight through where the wall was. Caption: "One team builds it and runs it."
5. The same kind of break: the alert lands on the people who wrote the code, and their fix rides the pipeline out within the hour. Caption: "You build it, you run it."

**The moment**: Beat 1 against beat 5: the same kind of break, once landing on strangers, once on the people who can fix it, with the stopwatch at days against under an hour.
**Interaction**: Switch between "two teams", "a DevOps team in the middle" and "one team", and watch how long an incident takes to reach a fix in each.
**Ending**: One team, no wall, the pipeline running between build and run.
**Variants**: `dora-metrics` (where "fast and safe together" is measured), `platform-engineering`, `inner-outer-loop`, `lightweight-change-approval`, `ci-cd-pipeline`.
**Techniques**: boundary, token, timer, restyle, appear/disappear, side by side, toggle, replay, caption.
**Review**: Improved — the misconception (DevOps as a team or a toolchain) was never shown; a new beat puts a "DevOps team" room in the middle and gets a second wall. The unproven summary-meter beat was cut, leaving that claim to `dora-metrics`.

### DORA metrics (`dora-metrics`)

**The aha**: Speed and stability go together: the teams that deploy most often also fail least, so delivery is measured on both at once, as throughput (deployment frequency, change lead time, failed deployment recovery time) and instability (change fail rate, deployment rework rate).
**Misconception to defeat**: Shipping faster means shipping riskier; or these are productivity scores like velocity or story points.
**Cast**: A chart with "Throughput" across (right is better) and "Stability" up (up is better), and team dots plotted on it. Any dot opens into two small panels of meters: Throughput (deployment frequency, change lead time, failed deployment recovery time) and Instability (change fail rate, deployment rework rate).
**Opening frame**: The empty chart with a dashed diagonal from top left to bottom right, labelled "fast or safe: pick one". Caption: "The expected trade-off."
**Story**:

1. Survey dots for thousands of teams drop onto the chart and cluster along the other diagonal, bottom left to top right. The dashed trade-off line is crossed out. Caption: "In practice, fast and safe move together."
2. Zoom into one dot: five meters in two panels. Recovery time sits under throughput, because it measures how fast a fix gets through. Caption: "Five numbers, two questions: how fast, how stable."
3. A team adopts small batches and better automation; over several quarters its dot moves up and to the right, all five meters improving. Caption: "Improve the practices, both move."
4. Another team only deploys more often, changing nothing else: its dot slides right and down as change fail rate and rework rate climb. Caption: "Speed alone isn't the goal."

**The moment**: Beat 1: the dots landing on the opposite diagonal to the one everyone expected, and the trade-off line being crossed out.
**Interaction**: Drag a team's dot and see its five meters update; or turn a practice dial (batch size, test automation) and watch the dot move.
**Ending**: The team's dot top right, its five meters green.
**Variants**: `small-batches`, `value-stream-mapping`, `flaky-tests` (pipeline health as a leading indicator), `devops`; the original four keys (with "time to restore service") and 2021's reliability measure, as history; deployment markers (Observability).
**Techniques**: chart, meter, move, spotlight, zoom, dial, caption.
**Review**: Improved — corrected to DORA's current five as dora.dev groups them: recovery time counts as throughput, and the fifth metric is deployment rework rate, not 2021's "reliability". Dropped the Elite-to-Low labels, which DORA retired in 2025. The trade-off line is now crossed out by the evidence, not before it.

### Working in small batches (`small-batches`)

**The aha**: Risk grows with the size of a change, not with how often you deploy: small changes are quicker to review, easier to debug and hurt less when they fail.
**Misconception to defeat**: Deploying more often is inherently riskier, so fewer, bigger releases must be safer.
**Cast**: Two lanes on the same pipeline, ending in prod with its user crowd. "Big batch": one large package holding twenty numbered change chips. "Small batches": the same twenty changes as twenty small packages, one after another. A stopwatch per lane for time to find the cause.
**Opening frame**: Both lanes about to ship the same twenty changes, one as a single crate, the other as a queue of twenty. Caption: "Same twenty changes. One box, or twenty?"
**Story**:

1. The big batch deploys and breaks ✗; users get red `!`. Caption: "Which of the twenty broke it?"
2. Engineers open the crate and bisect through twenty changes while the stopwatch runs into hours and users stay broken. Caption: "Finding the cause means searching all of it."
3. Small-batches lane: #1–#6 are already live; #7 deploys alone and breaks at once. The culprit is obvious; the stopwatch reads minutes. Caption: "One change breaks: you know which one."
4. Rollback: the small lane pulls back just #7 and #8 onward keep flowing. The big lane's rollback takes all twenty out again, nineteen good changes with the bad one. Caption: "Small batches fail small."
5. A batch-size dial beside a "pain when it breaks" meter: the pain follows the dial, not the number of deploys. Caption: "Risk follows size, not frequency."

**The moment**: Beat 2 against beat 3: an hours-long twenty-change search next to an instant, obvious one-change culprit.
**Interaction**: A dial sets how many changes are bundled together (1 to 20) before a scripted failure; watch time to find the cause and rollback cost scale with the dial.
**Ending**: The small-batches lane steadily shipping single changes, each failure small and quickly fixed.
**Variants**: `continuous-integration`, `ci-cd-pipeline`, `dora-metrics`, `rollback-vs-roll-forward`, `feature-flags` (how unfinished work still ships in small pieces).
**Techniques**: contents, failure, timer, dial, side by side, meter, spotlight, caption.
**Review**: Improved — when #7 deploys, only #1–#6 can already be live, not "the other nineteen". The aha now leads with its claim, and the opening got a caption.

### Shift left (`shift-left`)

**The aha**: Move the checks to where the work happens (the IDE, the commit, the PR), so a defect is caught minutes after it's made, while it's cheap to fix, instead of days later at the end.
**Misconception to defeat**: Shifting left means the later checks can be dropped or weakened.
**Cast**: A timeline running left to right: IDE, Commit, PR, Build, Test environment, Production. Check posts (linter, unit tests, secret scan, code review, integration and load tests, monitoring) that can slide along it. A bug token typed at the IDE that travels right until a check catches it. A "time to fix" meter that climbs steeply to the right as context fades and rebuilds pile up.
**Opening frame**: Every check post bunched at the far right in a "QA and security review" phase before Production; the left of the timeline empty. Caption: "All the checking happens at the end."
**Story**:

1. A bug is typed in the IDE and travels untouched through commit, PR and build. QA catches it three weeks later; the developer has moved on, and the fix needs a new build and a retest. Meter: 3 days. Caption: "Caught at the end: days to fix."
2. The checks slide left: linter and type checker into the IDE, unit tests and secret scanning onto the commit, review and integration tests onto the PR. Caption: "Move the checks to where the work happens."
3. ⟲ Replay: the same bug is underlined as it's typed and fixed in 30 seconds; the meter barely moves. Caption: "Caught as you type: seconds."
4. A different bug, one that only shows under heavy load, passes every early check and is caught by the load test in the test environment. The late checks never left. Caption: "Earlier checks don't replace the later ones."

**The moment**: Beat 3 against beat 1: the same bug, the meter at 30 seconds against 3 days.
**Interaction**: Drag any check post along the timeline, then plant bugs of different kinds; watch where each is caught and how the time-to-fix meter responds.
**Ending**: Checks spread along the whole timeline, most bugs stopped at the left, the late checks still guarding the right.
**Variants**: `devsecops-pipeline` (where each security scan goes), `test-pyramid`, `quality-gates`, `inner-outer-loop`, `pull-request-checks`.
**Techniques**: move, token, meter, failure, timer, replay, side by side, choice, caption.
**Review**: Improved — the plan moved the bug, not the checks. Now the checks start bunched at the end and slide left, which is what the name means. Cost is measured as time to fix rather than the poorly sourced 10×/100× multipliers, and the secret-scanning beat that duplicated `devsecops-pipeline` was cut.

### Platform engineering and internal developer platforms (`platform-engineering`)

**The aha**: A platform team turns the ops ticket queue into a self-service product: golden paths (templates, pipelines, environments) with security already built in, so the safe way is also the fastest, and product teams carry less in their heads.
**Misconception to defeat**: This is just an ops team with a ticket queue, or a renamed "DevOps team" still doing the work for everyone else.
**Cast**: Left, product teams, each carrying a backpack of things they'd otherwise have to know (Kubernetes, Terraform, networking, secrets, policy). Middle, "Ticket desk": a queue of request forms with timers. Right, "Platform": a catalog of golden-path cards (new service, new pipeline, new environment), each carrying guardrail badges (policy check, secret injection, logging). Behind the catalog, the platform team with a feedback inbox.
**Opening frame**: The ticket queue holds three pending requests, each with a running timer. Caption: "Need an environment? File a ticket and wait."
**Story**:

1. A team's request for an environment waits days behind others, then is built by hand, slightly differently from the last one. Caption: "A queue doesn't scale, and isn't consistent."
2. ⟲ Replay: the same team picks "new environment" from the catalog; a template stamps one out in minutes, badges already attached, and the team's backpack shrinks to one short form. Caption: "Self-service, compliant by default."
3. A second team creates a pipeline from the catalog; it comes out with the same badges. Caption: "The safe way is the easy way."
4. A team with an unusual need leaves the path and builds by hand: allowed, but slower and without the badges. Its need lands in the platform team's inbox and comes back next quarter as a new card. Caption: "Paved roads are optional. The platform learns from detours."

**The moment**: Beat 2: a days-long queue replaced by a minutes-long click, and the heavy backpack shrinking to one form.
**Interaction**: Click catalog cards and watch each spin up with its badges; file the same request at the ticket desk and compare; take a detour and see it return as a new card.
**Ending**: Several teams self-serving in parallel with light backpacks, the ticket desk empty.
**Variants**: `iac-modules`, `reusable-pipeline-templates`, `ephemeral-environments`, `policy-as-code`, `devops`, `inner-outer-loop`; Backstage, Azure Deployment Environments.
**Techniques**: contents, clone, timer, restyle, side by side, failure, choice, replay, caption.
**Review**: Improved — added two parts of the catalog row that were missing: cognitive load (a backpack of things to know, which shrinks) and the platform as a product (a feedback inbox that turns a detour into a new card). Without them it read as "automate the ticket desk".

### Inner loop vs outer loop (`inner-outer-loop`)

**The aha**: The inner loop (edit, build, run, test on your own machine) turns in seconds; the outer loop (PR, CI, review, deploy, operate) takes minutes to days. They need different tools, so keep the inner loop fast and send only what needs shared resources outward.
**Misconception to defeat**: This is just CI; or there's one loop, the pipeline, and everything goes through it.
**Cast**: Two nested loops. A small inner loop around a developer's laptop, edit → build → run → test, labelled with its tools (hot reload, local tests, dev container). A large outer loop around the team, commit → PR → CI → review → deploy → operate, labelled with its tools (CI runners, reviewers, environments, monitoring). The laptop's loop sits inside the outer loop's "commit" segment. A lap timer on each loop.
**Opening frame**: Both loops idle, lap timers reading "~10 s" and "hours to days". Caption: "Two loops, two speeds."
**Story**:

1. A developer edits; the inner loop laps several times in a few seconds, with feedback every lap. Caption: "Inner loop: seconds, on your machine."
2. Satisfied, the developer commits, entering one segment of the big loop. A PR opens, CI runs for 12 minutes, a reviewer looks hours later, it deploys and runs, and incidents and metrics flow back over days. Caption: "Outer loop: minutes to days, shared with everyone."
3. ⟲ Replay with no local build: every small edit is pushed just to learn whether it compiles, and each lap waits 12 minutes on CI. Caption: "Iterating through the outer loop is slow."
4. ⟲ Replay the other way: a test that needs five other services is crammed onto the laptop; the inner loop stalls and flakes. Caption: "Not everything belongs in the inner loop."
5. Both checks go back to their natural loop, and each loop laps at its own speed. Caption: "Fast checks inside. Shared ones outside."

**The moment**: Beat 1 against beat 3: the same edit, a lap in seconds against 12 minutes waiting on CI.
**Interaction**: Move any check (compile, unit tests, a test needing other services, a security scan) between the loops and watch both lap timers change.
**Ending**: Both loops lapping continuously at their own speeds, nested as before.
**Variants**: `devops`, `ci-cd-pipeline`, `continuous-integration`, `shift-left` (moving checks into the inner loop), `platform-engineering` (tools that speed up both loops); dev containers, cloud development environments.
**Techniques**: loop, timer, zoom, failure, replay, toggle, caption.
**Review**: Improved — the aha says the loops need different tools, but none appeared; each loop now has tool labels and a lap timer. Beats 3–4 became replays, and the missing captions were added.

### Value stream mapping (`value-stream-mapping`)

**The aha**: Map every step from idea to production with its working time and its waiting time, and you usually find most of the lead time is waiting in queues and handoffs, which is where to improve.
**Misconception to defeat**: This is just a process flowchart: it shows which steps exist, not how long each takes or why.
**Cast**: A row of steps: triage, code, PR review, CI, approval, deploy. Each is a block that can split into a green "working" segment and a grey "waiting" segment, labelled with times. A lead-time meter and a flow-efficiency readout (working ÷ lead time) beneath.
**Opening frame**: A plain flowchart of the six steps, boxes and arrows, no times. Caption: "A flowchart shows the steps. Not the time."
**Story**:

1. Each block splits into green and grey; nearly all of them are mostly grey. Caption: "Split each step: working vs waiting."
2. Spotlight PR review: 30 minutes of reading, 2 days in a queue. Caption: "Most steps are mostly waiting."
3. Spotlight approval: 15 minutes of sign-off, 5 days waiting for the weekly board. It's the biggest block. Caption: "Handoffs and queues dominate."
4. The segments slide together into one stacked bar: lead time 13 days, of which 2 are work. Flow efficiency: 15%. Caption: "Most lead time is waiting, not working."
5. Two fixes compared: halve the coding time and lead time drops a day; replace the weekly board with peer review and automated checks and it drops five. Caption: "Fix the queues, not the work."

**The moment**: Beat 4: the stacked bar's overwhelming grey against its sliver of green, beside the opening's innocent-looking flowchart.
**Interaction**: Click any step to see its split; apply a fix to any one and watch lead time and flow efficiency respond.
**Ending**: Lead time down from 13 days to 8, and the next-biggest grey block (triage) spotlighted. Caption: "Then map it again."
**Variants**: `dora-metrics` (change lead time is one of its numbers), `lightweight-change-approval` (the fix in beat 5), `small-batches`, `inner-outer-loop`.
**Techniques**: contents, chart, meter, spotlight, move, choice, caption.
**Review**: Improved — added the numbers that make it land (2 days of work in 13, 15% flow efficiency) and beat 5's comparison: faster work saves a day, removing a queue saves five. The ending now lands on the next bottleneck instead of overclaiming.

### Lightweight change approval (`lightweight-change-approval`)

**The aha**: DORA found that external change advisory boards slow delivery without improving stability; a reviewer close to the change, backed by automated checks in the pipeline, is both faster and safer.
**Misconception to defeat**: More formal, centralised sign-off means safer changes; removing a CAB means removing controls.
**Cast**: Two lanes, each with a stopwatch. "CAB": a change request travelling to a distant committee room with a weekly meeting slot and a long queue of other requests, reviewed by people who don't know the code. "Lightweight": the same change going to a peer reviewer close to the work, automated gates running at once, and part 1's audit log scroll beside the pipeline.
**Opening frame**: Both lanes hold an identical change request, waiting to go out. Caption: "Same change. Two ways to approve it."
**Story**:

1. CAB lane: the request waits days for the weekly slot; the committee skims a summary and approves the form, not the code. Caption: "Approval by people far from the change."
2. Lightweight lane: a peer who knows the code reviews the actual diff within the hour while automated checks run; both pass, and the audit log records who approved, which checks ran and what shipped. Caption: "A close reviewer, automated checks, a full record."
3. A chart appears: across many teams, external approval goes with longer lead times and the same change fail rate. Caption: "DORA: CABs slow things down without making them safer."
4. A risky change goes through both. The committee approves it, because the form looked fine, and it fails in prod ✗. In the lightweight lane, the reviewer spots the risk in the diff and an automated gate blocks it before merge. Caption: "Context catches what a form can't."

**The moment**: Beat 3's chart: no less safe and much faster, against the intuition that more formal must mean safer.
**Interaction**: Send the same change through both lanes and compare time to approval, and whether the risky one gets caught.
**Ending**: The lightweight lane's change merged and deployed the same day, its audit log complete; the CAB lane's change still waiting for next week's meeting.
**Variants**: `dora-metrics`, `deployment-approvals`, `quality-gates`, `value-stream-mapping`, `devops`.
**Techniques**: side by side, timer, chart, contents, failure, choice, caption.
**Review**: Improved — "removing a CAB removes controls" was never answered; beat 2 now shows the pipeline's audit log keeping the record. The chart now says exactly what DORA found: longer lead times and no difference in change fail rate.
