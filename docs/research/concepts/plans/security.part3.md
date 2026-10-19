# Security plans, part 3

Stage 2 plans for `catalog/security.md` groups 10 to 13, in catalog order. They share the visual
language used across the Security area: people and clients on the left, apps in the middle,
protected resources on the right inside a dashed trust boundary; an identity is a badge card; a
token is a small ticket with fields and a seal; keys are key icons, locked data has a padlock;
secrets are sealed envelopes; an attacker is a red hooded figure whose path through the system is
traced in red; allowed requests get a green tick, denied ones a red cross; a pipeline is a
left-to-right conveyor of stages with the artifact as a labelled package (a signed artifact carries
a wax seal; an SBOM is an ingredients label on the package); detections are alarms that light up
on a security console.

## 10. Secure development and software supply chain

### Application security testing (SAST, DAST, SCA) (`application-security-testing`)

**The aha**: SAST, SCA, IAST and DAST look at different things at different moments, so each catches bugs the others can't see; and even all four together miss some.
**Misconception to defeat**: One scanner running means "we tested it."
**Cast**: A conveyor from "code" on the left to a running app inside the trust boundary on the right. Four stations above the belt: SAST (reads source text), SCA (reads the dependency list), DAST (fires requests at a deployed copy from outside, no source access), IAST (an agent inside the test copy, watching data flow while tests run). Five bug icons ride the package: a hardcoded secret, a library with a known CVE, an admin endpoint left open in the deployed config, a SQL injection, and a business-logic flaw (a discount code that stacks forever).
**Opening frame**: Package mid-belt, four stations dark, five bugs riding along, none caught.
**Story**:

1. At the pull request, SAST reads the source and the hardcoded secret glows and is caught; the other four ride on. _"SAST reads the code, before it runs."_
2. SCA reads the dependency list and flags the CVE library; SAST was dark for it. _"SCA checks what's inside against known flaws."_
3. In staging, DAST attacks the running app from outside and finds the open admin endpoint, a bug that only exists in the deployed config. _"DAST attacks the running app. No source needed."_
4. IAST, inside the test copy, watches a test request's data reach a database query unsanitised and flags the SQL injection, but only because a test exercised that code path. _"IAST sees inside, but only where tests go."_
5. A matrix: four scanners by five bugs, almost every bug lit in a different row, and the discount-code flaw in no row at all. _"Needs a human: threat modeling or a pen test."_
   **The moment**: The matrix with one bug lit in no column; "all four green" would still ship it.
   **Interaction**: Toggle a scanner off and replay: its bug rides all the way to production.
   **Ending**: All four stations lit, four bugs fixed before merge, the logic flaw circled for a human review. _"Different stages, different eyes."_
   **Variants**: `sbom`, `container-image-scanning`, `vulnerability-management`, `threat-modeling-stride`.
   **Techniques**: contents, spotlight, side by side, toggle, restyle, caption.
   **Review**: Improved — IAST was in the cast but never appeared, and "each bug lit in exactly one column" overclaimed (SAST and IAST do overlap on injection). Swapped the XSS for a deployed-config bug that only DAST can see, added the IAST beat, and added a bug no scanner catches, which defeats "we tested it" better than the toggle alone. Weighed a pure timeline-of-the-lifecycle framing: it shows when but not what each can see.

### Software supply chain attacks (`software-supply-chain-attack`)

**The aha**: You inherit the security of everything that touches your code before it ships. The compromise doesn't have to hit you, only something upstream you trust.
**Misconception to defeat**: A supply chain attack means someone hacked your servers.
**Cast**: A tree of upstream nodes (a package registry, a CI action marketplace, a maintainer's laptop, a vendor's build system) feeding "your build" inside a dashed boundary. A padlocked "your servers" box stays on screen throughout. A red hooded attacker.
**Opening frame**: Clean green tree, every upstream node feeding your build. Nothing is yours but all of it reaches you.
**Story**:

1. The attacker targets a trusted open-source maintainer, not you; a red path traces into one dependency node. _"Not your door. Theirs."_
2. That node turns red, carrying a hidden backdoor, and flows down into your build; the version number and name still look legitimate. Your servers box never changes.
3. Zoom out: your build ships to hundreds of downstream companies, all receiving the same poisoned package.
4. Three labels land on matching node types in turn: "SolarWinds 2020: the vendor's build system," "Codecov 2021: a CI script," "xz utils 2024: a maintainer won over by a patient attacker." A fourth: "tj-actions 2025: a CI action, its tags re-pointed."
   **The moment**: The zoom-out: one red node reaching hundreds of green companies, none of whom were attacked directly.
   **Interaction**: Click an upstream node type to see which real incident matches it and which link was hit.
   **Ending**: Back to the tree, every node you don't control dimmed, a lock appearing on each edge. _"Trust is transitive. Verify the links."_
   **Variants**: `vulnerable-dependencies`, `dependency-confusion`, `sbom`, `slsa-provenance`, `cicd-pipeline-security`.
   **Techniques**: boundary, path trace, stream, zoom, spotlight, restyle, caption.
   **Review**: Improved — kept the upstream-tree framing (weighed a "chain of custody" parcel metaphor: it hides that the attacker never touches you). Added the untouched "your servers" box so the misconception is visibly defeated, dated the incidents (SolarWinds 2020, Codecov 2021, xz 2024), added tj-actions (2025) for the CI-action case, and replaced the vague ending caption.

### Vulnerable and transitive dependencies (`vulnerable-dependencies`)

**The aha**: Most of your code is someone else's, including dependencies you never chose, and a known flaw four layers down is still yours.
**Misconception to defeat**: "I only wrote clean code" is enough.
**Cast**: Your app box at top; a dependency tree fanning down four layers: a few direct (chosen, bright) boxes, then many transitive (unchosen, dimmer) ones. One deep node labelled `log4j-core 2.14`. A lockfile card beside the tree.
**Opening frame**: App box on top, tree collapsed, count reads "5 direct dependencies."
**Story**:

1. The tree expands: 5 direct pull in 80 more, the count ticking up. _"Most of this, you never chose."_
2. A CVE alarm lights the deep `log4j-core` node; a path trace runs up through every ancestor to your app, all red. _"A flaw four layers down is still yours."_
3. A reachability check: your code does call the vulnerable function, so the path stays red (on another node it would dim to amber: "present, not called"). _"Fix what you can reach first."_
4. The lockfile: two installs a day apart. Without it, version ranges resolve differently and the tree shifts under you; with it, both installs are identical, so the scan result describes what you really run. _"The lockfile makes the tree the same every time."_
5. An automated pull request bumps the parent so the deep node moves to the fixed version; red fades to green up the path.
   **The moment**: The upward path trace from one small flagged box to the top: inheritance is automatic and vertical.
   **Interaction**: Click any node to trace its path up; toggle lockfile on/off and watch transitive versions drift between installs.
   **Ending**: Tree green, PR-merged banner, same 85 packages, risk gone.
   **Variants**: `software-supply-chain-attack`, `sbom`, `dependency-confusion`, `container-image-scanning`.
   **Techniques**: zoom, spotlight, path trace, contents, toggle, meter, caption.
   **Review**: Improved — beat 3 was muddled ("unpinned jumps to a newer, still-vulnerable version" teaches nothing); replaced with what a lockfile really gives (reproducible, so scans are true) and the deliberate bump as the fix. Added reachability, which the catalog names as the prioritiser, and made the depth four layers as the caption claims. Alternative weighed: an iceberg metaphor, which shows size but not the vertical inheritance that the path trace shows.

### Dependency confusion and typosquatting (`dependency-confusion`)

**The aha**: A package manager that can reach both a public and a private registry may install the attacker's public package under your internal name, just because its version number is higher.
**Misconception to defeat**: An internal package name is private, so it's safe.
**Cast**: A build requesting `acme-internal-utils@^1.2`. Two registries side by side: a small private one (yours) and a huge public one. A red attacker publishing to the public one.
**Opening frame**: Build box with the request pending, private registry holding `acme-internal-utils@1.2`, public registry has no such name.
**Story**:

1. The name leaks: it sits in a public JavaScript bundle or a public repo's manifest; the attacker's eye lands on it. _"Internal names leak more than you think."_
2. The attacker registers `acme-internal-utils@9.9.9` on the public registry, a red card with a much higher number.
3. The build asks both registries (as many default configs do), compares 1.2 with 9.9.9, and the path trace runs from the public registry into the build. _"Highest version wins, not 'ours' wins."_
4. The package's install script runs inside the build, with the build's credentials; red spreads through the box.
5. A short coda: a developer mistypes `acme-internal-utlis`; a look-alike package sits there waiting. Different trick (a similar name, not a higher number), same result.
   **The moment**: The version comparison, 1.2 against 9.9.9, choosing the attacker's package for no reason but a bigger number.
   **Interaction**: Toggle the fix on: your namespace is claimed or reserved on the public registry, and the build resolves only through one proxied feed that serves internal names from the private registry; the red path hits a wall.
   **Ending**: One feed, internal names pinned to private, lockfile hashes in place, green tick.
   **Variants**: `vulnerable-dependencies`, `software-supply-chain-attack`, `secret-sprawl`.
   **Techniques**: side by side, token, path trace, restyle, toggle, caption.
   **Review**: Improved — the fix was wrong as stated ("scoped namespace" only helps if you own that scope publicly, and the lasting fix is a single proxied feed with internal names bound to the private source). Added how names leak, the build credentials at risk, and a short typosquatting beat since the title promises it. Weighed leading with typosquatting: it is easier to picture but lacks the surprising "higher number wins" moment.

### Software bill of materials (SBOM) (`sbom`)

**The aha**: An SBOM is an ingredients label for an artifact, so when the next big vulnerability lands, "are we affected?" is a query instead of weeks of digging. It lists what is inside, not whether it is safe or how it was built.
**Misconception to defeat**: An SBOM proves an artifact is safe, or how it was built.
**Cast**: Shipped packages on shelves inside the trust boundary, each with an attached ingredients label ("openssl 3.0.2, log4j 2.14, express 4.18…", format SPDX or CycloneDX). A console.
**Opening frame**: One package on a shelf, label attached, nobody reading it. _"Every artifact can carry a label."_
**Story**:

1. A CVE alarm lights on the console: "log4j 2.14, critical."
2. Without SBOMs: a search token wanders through the warehouse opening package after package, a timer reading "weeks."
3. Reset. With SBOMs: one query flies to every label at once; three packages light red in under a second.
4. A VEX note lands on one red package: "not affected: vulnerable code never runs." It restyles to grey. _"Not just what's inside: does it matter?"_
5. A different package has a spotless label but was tampered with after the label was written. The label is just words; nothing on it says who made it or how. _"The label lists ingredients. It doesn't vouch for them."_
   **The moment**: "Weeks" collapsing to "seconds" side by side, then the spotless label on a bad package that stops the viewer trusting it too far.
   **Interaction**: Trigger a new CVE and watch the query light affected packages across the warehouse; toggle "SBOM missing" on one package and see it show as unknown, not as clear.
   **Ending**: Console reads "3 contain it, 1 not affected, 2 to patch," a concrete next step; the label's blank "built by:" field points to `slsa-provenance`.
   **Variants**: `artifact-signing`, `slsa-provenance`, `vulnerable-dependencies`, `container-image-scanning`.
   **Techniques**: contents, token, spotlight, timer, side by side, restyle, caption.
   **Review**: Improved — "3 affected, 1 exploitable" didn't add up against the VEX beat (it left 3 red, 1 grey, so 2 to patch); fixed. The misconception was named but never defeated on screen, so added the spotless-label-on-a-tampered-package beat. Also made the missing-SBOM case show "unknown" rather than "clear". Weighed a food-recall metaphor: apt, but it is already the ingredients label.

### Artifact and code signing (Sigstore) (`artifact-signing`)

**The aha**: A valid seal only proves who signed these exact bytes; it protects you only if a gate checks the seal and checks it is the signer you expect.
**Misconception to defeat**: A signed package is safe to run no matter what checks it.
**Cast**: A pipeline conveyor ending at a sealing station: an ephemeral signer badge ("workflow `release.yml` of repo `acme/app`", proven by the pipeline's OIDC token) gets a short-lived certificate (valid about 10 minutes), presses a wax seal, and vanishes. A public ledger strip logs each seal (the transparency log). An admission gate guards the trust boundary, with a rule card: "signer must be `acme/app` release workflow."
**Opening frame**: Package mid-belt, unsealed, gate ahead closed.
**Story**:

1. The signer badge appears, is issued a short-lived certificate, presses the seal, logs an entry on the ledger, and the badge and its key disappear. _"Keyless: no long-lived key to steal. Logged publicly."_
2. At the gate, the seal is checked against the ledger and the rule card: right bytes, right signer. Green tick, gate opens.
3. An attacker builds a package, signs it with their own real identity: a perfectly valid seal, a real certificate, logged. The gate reads the signer, sees it is not `acme/app`, red cross. _"Valid signature, wrong signer."_
4. A third package reuses a legitimate seal on tampered contents; the hash no longer matches and the seal cracks. _"The seal covers exactly these bytes."_
   **The moment**: Beat 3: a genuinely valid seal turned away because of who made it. The gate's rule, not the seal, decides.
   **Interaction**: Delete the signer rule, leaving only "has a valid signature," and the attacker's package gets in; remove the gate entirely and a tampered package sails through.
   **Ending**: Gate standing with its rule, a sealed package inside. _"Verify before run. A signature says who, not whether safe."_
   **Variants**: `sbom`, `slsa-provenance`, `cicd-pipeline-security`, `container-image-scanning`.
   **Techniques**: appear/disappear, token, boundary, failure, path trace, restyle, caption.
   **Review**: Improved — the old beat 3 ("forged or missing seal") was the easy case; the real keyless trap is a perfectly valid signature from the attacker's own identity, so verification must pin signer identity (and issuer). Added that, kept the tamper beat, and put the certificate lifetime and the transparency log in the cast. Alternative: lead with a wax-seal-on-a-letter metaphor only; it hides the identity check, which is the whole point.

### SLSA and build provenance (`slsa-provenance`)

**The aha**: Provenance is a signed statement of what was built, from which source, by which builder, so you can check that an artifact really came from the pipeline you expect, not a laptop.
**Misconception to defeat**: An SBOM and provenance are the same thing. One lists ingredients; the other is the build's paper trail.
**Cast**: Two identical-looking packages. Behind A, a visible pipeline (named repo, commit, isolated builder) ending in a provenance ticket sealed to the package, next to an ingredients label (SBOM). Behind B, a laptop icon, a label that looks identical, no ticket.
**Opening frame**: Two packages, backs hidden, one question: _"Same artifact. Which came from the pipeline?"_
**Story**:

1. Reveal behind A: repo at commit `abc123`, a hosted, isolated build, producing a ticket with matching fields, sitting beside the ingredients label. _"Label: what's inside. Ticket: how it was made."_
2. Reveal behind B: built on a developer's laptop. Its ingredients label is perfect, but no ticket, or a hand-typed one. _"A good label can't say where it was built."_
3. The gate checks each ticket against policy ("built by pipeline X from repo Y"). A matches, green tick; B fails, red cross.
4. A ladder (SLSA build track): L1 provenance exists (anyone can still forge it); L2 produced and signed by a hosted build service; L3 hardened, builds isolated, signing material out of reach of the build's own steps. A rogue build step tries to inject a fake field at L3 and fails.
   **The moment**: The two reveals side by side: identical wrapper and identical label, but a checkable trail behind only one.
   **Interaction**: Pick a trust policy (any provenance, signed by a hosted builder, from repo Y only) and watch example artifacts pass or fail the gate.
   **Ending**: Gate open for A only. _"Trust the paper trail, not the wrapper. It shows where, not that the code is good."_
   **Variants**: `sbom`, `artifact-signing`, `cicd-pipeline-security`.
   **Techniques**: side by side, contents, boundary, spotlight, failure, caption.
   **Review**: Improved — the SBOM-vs-provenance misconception was in the header but never defeated; now package A carries both, and B shows a perfect label with no ticket. Checked the levels against SLSA v1.0's build track (L1 exists, L2 signed by hosted platform, L3 hardened and isolated) and added L1's forgeability, which explains why L2 and L3 exist. Added that provenance says where, not that the code is good. Weighed a passport-and-customs metaphor; the two-package reveal is more direct.

### CI/CD pipeline security (`cicd-pipeline-security`)

**The aha**: The pipeline holds credentials to production, so it is a production admin. Attack surface, not just a scanner host.
**Misconception to defeat**: Pipeline security means scanning the code that runs through it, not the pipeline itself as a target.
**Cast**: A conveyor with stages (checkout, build, test, deploy). A long-lived credential, a sealed envelope, sits as a pipeline-wide variable. A code-scan badge on the pull request, green. The production boundary at the far end.
**Opening frame**: Pipeline running normally, the long-lived secret in plain sight, the code scanner green.
**Story**:

1. An attacker opens an innocuous pull request with a crafted test script. The scan finds no vulnerable code (green), and the pipeline, set up to give pull request builds the same access as the main branch, runs the script in "test" with the secret in reach. _"The code was clean. The pipeline was the target."_
2. A red path takes the secret through "deploy" into production. _"A production admin, running on pull requests."_
3. Replay, four controls one by one, each stopping the path: the PR build runs sandboxed with no secrets; the long-lived secret is replaced by a short-lived token the job exchanges for its own identity and discards (federated OIDC); third-party actions are pinned to a commit hash, so a re-pointed tag is ignored; a required review gates the deploy stage.
4. The same PR runs again, finds nothing, and dead-ends in "test."
   **The moment**: The scanner green while the red path reaches production, replayed with each control cutting it earlier.
   **Interaction**: Remove one control at a time and replay the PR to see how far it now gets.
   **Ending**: All four controls lit, the PR stopped at "test," deploy never reached.
   **Variants**: `managed-workload-identity`, `short-lived-credentials`, `secrets-vault`, `artifact-signing`, `container-image-scanning`.
   **Techniques**: path trace, boundary, token, failure, restyle, spotlight, caption.
   **Review**: Improved — the misconception was not defeated (no beat showed a clean scan alongside a successful attack); added the green scanner. Fork PRs don't get secrets by default on GitHub, so the story now says the pipeline is configured to give PR builds access, which is the real OWASP CI/CD "poisoned pipeline execution" and "insufficient flow control". Beat 3 was four controls crammed into one beat; sequenced explicitly. Weighed an "attack tree" framing: right for analysts, but the replay-with-controls is quicker to grasp.

### Container image scanning (`container-image-scanning`)

**The aha**: An image that was clean at build goes bad as new CVEs are published, so scan continuously and fix by rebuilding from an updated base, never by patching a running container.
**Misconception to defeat**: "We scanned it before release" covers it forever.
**Cast**: A container image as stacked layers (base OS, runtime, app code) on a registry shelf; a running container cloned from it inside the trust boundary; a calendar timer; a console.
**Opening frame**: Image on the shelf, a scanner beam passing over it, every layer green, "scanned: today."
**Story**:

1. The image is cloned into a running container: identical layers, clean.
2. The timer runs forward weeks. A new CVE lights the base OS layer: the same layer, in both the shelved image and the running container, turns red at once. _"The image didn't change. The world did."_
3. Someone patches the running container; the next redeploy from the unchanged image overwrites the fix and the flaw returns. _"Patching a container doesn't stick."_
4. The correct path: a new base layer replaces the old, the image rebuilds and re-scans green, and redeploy replaces the container.
5. Side by side: a minimal (distroless) image beside a full-OS one; the scanner reports far fewer findings on the thin one. One finding on the full image is labelled "no fix available yet." _"Scanners only know published CVEs: not zero-days, and not code they can't identify."_
   **The moment**: The same red layer lighting in two places at once, days after a "clean" scan.
   **Interaction**: Advance the timer to trigger new CVEs; toggle "patch live container" versus "rebuild and redeploy" and see which survives the next deploy.
   **Ending**: Console reads "re-scanned daily, rebuilt on change," a thin image mostly green.
   **Variants**: `vulnerability-management`, `sbom`, `cicd-pipeline-security`, `secure-baseline-hardening`.
   **Techniques**: layers, clone, timer, restyle, side by side, spotlight, caption.
   **Review**: Improved — added the scanner's limits (the brief asks for them): unfixed CVEs and blindness to unknown flaws. Checked that rescans in a registry compare the stored package list to new advisories, so the same layer lights without a rebuild. Weighed a "milk expiry date" metaphor, which is memorable but implies the image is fixed by throwing it out, which is actually what rebuild does; kept the layer animation as the more exact picture.

## 11. Cloud security operations

### Audit logging (`audit-logging`)

**The aha**: Without logs there's no detection and no investigation, and they must sit where an attacker holding stolen admin credentials can't reach.
**Misconception to defeat**: "We have logs" meaning application logs, when control-plane and data-plane audit logs are what's missing.
**Cast**: Resources inside the trust boundary; an application log strip that only prints "200 OK"; a separate, small, padlocked log account off to the side. Every action is a token; some peel off a copy into the log account.
**Opening frame**: Resources in the boundary, an app log scrolling "200 OK," an empty dim log account. _"Who did what, when, from where?"_
**Story**:

1. An admin token changes a firewall rule. The app log says nothing; a copy peels off to the log account stamped with identity, time, source IP. _"Control plane: who changed what."_
2. A different token reads a row of sensitive data. Many platforms keep these data-plane logs off by default (AWS data events, GCP Data Access logs, Azure resource logs), so no copy peels off. _"Data plane: off until you turn it on."_
3. An attacker steals the admin credential, switches logging off (that event is logged and fires an alarm), then reaches into the log account to erase the trail and bounces off the padlock: different account, different credentials, write-only for the sources. _"The attacker who owns production can't rewrite history."_
4. Data-plane logging is on and the same read now peels off a copy.
   **The moment**: Beat 3: an attacker with full admin over production bouncing off the log account.
   **Interaction**: Toggle control-plane and data-plane logging independently; try deleting a log entry as the compromised admin.
   **Ending**: Log account full of timestamped entries, still locked, review console lit.
   **Variants**: `siem-soar`, `incident-response-lifecycle`, `cspm`.
   **Techniques**: token, boundary, clone, failure, toggle, spotlight, caption.
   **Review**: Improved — the "application logs" misconception was named but never shown; added the "200 OK" strip that is silent about the change. Checked defaults (management/admin activity logs on by default; data events off by default on AWS and GCP, resource logs need diagnostic settings on Azure). Added the "turn logging off" step, which is itself logged, as the usual attacker move. Weighed a black-box flight-recorder metaphor; kept the separate padlocked account because it is the actual control.

### Cloud security posture management (CSPM) (`cspm`)

**The aha**: Cloud configuration drifts every minute, so posture is a continuous measurement, and the best tools join small misconfigurations into the one attack path that matters.
**Misconception to defeat**: An annual audit or checklist is enough.
**Cast**: A sprawling map of resources inside the trust boundary; a radar sweeping continuously; a benchmark checklist (CIS); a findings console.
**Opening frame**: Radar mid-sweep, map mostly green, a few amber dots.
**Story**:

1. Someone opens a storage bucket (test data only) to the public to debug something and forgets; the dot flips amber on the next sweep. _"An annual audit would have missed this for 364 days."_
2. The radar finds three separate small issues on one VM: it's reachable from the internet, it has an exploitable known CVE, and its role can read the customer database. Each is amber alone.
3. A path trace joins the three into one red chain: internet → VM → CVE → role → customer data. _"Joined, these are a way in. Fix this first."_
4. The console ranks that chain above the many lone amber dots, the empty test bucket among them.
   **The moment**: Three separate amber dots joining into one traced red path: findings reframed as an attack path.
   **Interaction**: Click any two dots to see whether a path connects them; fix one link and watch the red path break.
   **Ending**: Chain broken, one link fixed and greyed, the radar still sweeping.
   **Variants**: `secure-baseline-hardening`, `vulnerability-management`, `policy-as-code`.
   **Techniques**: path trace, spotlight, restyle, meter, caption.
   **Review**: Improved — the old story contradicted itself: its three findings were "public bucket, CVE VM, over-broad role" but the chain was "public VM → CVE → role", so the bucket wasn't in it. Moved all three findings onto the VM and let the bucket stay a lone lower-priority dot. Dropped "within minutes" (sweep cadence varies by tool and by whether it is event-driven). Weighed a smoke-detector metaphor; the attack-path join is what separates CSPM from a checklist.

### Policy as code (`policy-as-code`)

**The aha**: A rule like "no public storage" is written once as code, decided by one policy engine, and enforced at every stage (before merge, at deploy, and on what already runs), so a non-compliant resource is refused before it exists.
**Misconception to defeat**: Policy as code is an automated checklist; or IAM, which says who may act, not what is allowed to exist.
**Cast**: Left, a change document with `storage "logs" { public = true }` buried at line 312 of 400. Centre top, a small rulebook box, the policy engine (the decision point), with three lines of code: `deny public storage`, `require tag owner`, `region in [canadacentral]`. Three gates (enforcement points) ask it: a pull-request gate on the plan, a cloud-edge gate (an admission controller or Azure Policy deny effect) in front of the cloud zone, and a fleet scanner sweeping what already runs. A reviewer figure with a clipboard.
**Opening frame**: The document with line 312 amber, the rulebook, three idle gates. _"A change that breaks a rule."_
**Story**:

1. The reviewer scrolls the diff, misses line 312, approves. A bucket appears in the cloud with an open padlock and internet arrows. _"Checklists depend on someone noticing."_
2. Rewind. The checklist becomes the three code lines in the rulebook. Each gate holds no rule of its own; it asks the engine. _"The engine decides. Gates enforce."_
3. The plan reaches the PR gate: tag tick, region tick, public cross. Line 312 glows red; merge blocked. The cloud stays empty. _"Checked on every plan, before anything exists."_
4. Someone bypasses the pipeline and applies from a laptop. The cloud-edge gate asks the same engine; refused. _"Same rule at the door of the platform."_
5. A bucket that predates the rule is already public. No gate sees it, but the sweeping scanner asks the engine, flags it amber, and an auto-remediation token flips it private. _"Detective: find drift and fix it."_
6. Edit the rule in one place; all three gates change together.
   **The moment**: Beat 3 against beat 1: the same line, but this time the bucket never exists.
   **Interaction**: Edit the resource (public on or off, drop the tag, change region) and see which rule fires. A toggle switches a rule between deny and audit, where the change goes through but is flagged amber, the safe way to roll a new rule out.
   **Ending**: Rule glowing, three gates green, a compliant bucket with a closed padlock.
   **Variants**: `permission-guardrails`, `cspm`, `cicd-pipeline-security`, `devsecops-pipeline`, `iac-plan-in-pull-request`; Azure Policy, OPA Gatekeeper and Kyverno, AWS Config rules and S3 Block Public Access.
   **Techniques**: contents, token, restyle, spotlight, boundary, failure, choice, toggle, caption.
   **Review**: Improved — merged Delivery's plan into this one. Borrowed its missed-line-in-a-400-line-diff opening, its three-rule gate, the "bucket never exists" moment, the deny/audit toggle, and the IAM contrast. Kept the three enforcement points and added the decision/enforcement split the catalog calls out. Fixed the old drift beat (a deny at the edge would block the console change, so drift now means a bucket that predates the rule) and named real mechanisms: an SCP limits actions, not resource properties, so the edge gate is a deny policy, admission controller or S3 Block Public Access. Weighed a "airport security" metaphor; it doesn't show the code rule or the continuous sweep.

### Secure baselines and hardening (`secure-baseline-hardening`)

**The aha**: Every running service, account and port is something to attack, and you can't protect what you don't know exists. Build hardened golden images and rebuild drifted machines instead of patching them by hand.
**Misconception to defeat**: Hardening means patching a server by hand; a forgotten server isn't real risk.
**Cast**: A golden image labelled "CIS benchmark applied," stripped of unused ports, accounts and software before cloning; a fleet of clean VMs cloned from it inside the trust boundary; one forgotten VM off to the side, dim, absent from the inventory list.
**Opening frame**: Golden image stripped bare, fleet of clones beside it, an inventory list with N entries; the forgotten VM is not on the list.
**Story**:

1. The golden image is built: default accounts, unused ports and extra software disappear in turn. _"Shrink what's there before it ever runs."_
2. New VMs clone from the image, inheriting the stripped config. _"Every new machine starts hardened."_
3. The forgotten VM: never cloned from the image, a default account, an open port, patches years old. An attacker's red path goes straight to it. _"Nobody inventoried it. Nobody patched it."_
4. An inventory sweep (compare the cloud's asset list with the inventory) surfaces it and flags it.
5. It is torn down and re-cloned from the current golden image rather than patched by hand. _"Rebuild, don't repair."_
   **The moment**: The attacker's path going straight to the one machine nobody inventoried while the cloned fleet stays untouched.
   **Interaction**: Add a forgotten VM and watch it appear only when the sweep runs; choose "patch by hand" versus "rebuild from image" and see which one drifts away from the image again.
   **Ending**: Fleet cloned from the current image, inventory complete, no dark corners. A small note: the image itself is rebuilt as patches land.
   **Variants**: `cspm`, `vulnerability-management`, `container-image-scanning`.
   **Techniques**: appear/disappear, clone, path trace, spotlight, caption.
   **Review**: Improved — the opening frame hid the key actor (an invisible VM) and the "never inventoried" cause was implicit; added the visible inventory list that lacks it, the benchmark label, the real cause (unpatched, default account), and the image-rebuild note so "golden" doesn't imply forever. Weighed leading with the forgotten server alone (a shadow-IT ghost story): memorable but loses the point that hardening is something you build into the image.

### Vulnerability management and patching (`vulnerability-management`)

**The aha**: There will always be more CVEs than time, so prioritise by what's being exploited and exposed, not by severity score alone.
**Misconception to defeat**: "Critical severity" means "fix first," regardless of exposure.
**Cast**: A console of vulnerability cards. A: CVSS 9.8, on an internal-only machine, exploit probability (EPSS) 0.1%. B: CVSS 5.4, on an internet-facing machine, listed as exploited in the wild (CISA KEV). An SLA clock on each card.
**Opening frame**: A and B side by side, sorted by CVSS alone, A on top.
**Story**:

1. Sorted by score, A leads the queue, B sits low. _"By score alone, fix A first."_
2. A path trace: no route from the internet to A's machine; a bright path runs from the internet to B's.
3. B's "exploited in the wild" alarm blinks as live threat intel arrives; A's EPSS meter barely moves. _"B is being used against systems like yours."_
4. Re-sorted by real risk (exploited, exposed, asset value), B jumps over A. B's SLA clock reads days; A's, weeks.
5. A patch closes B and the alarm stops. A is scheduled, with a stopgap control (a network rule) meanwhile, because an attacker already inside could still reach it.
   **The moment**: The re-sort, B leaping over A once exposure and exploitation join the score.
   **Interaction**: Toggle exposure, exploited-in-the-wild and asset value in or out of the ranking and watch the queue reorder.
   **Ending**: Queue sorted by risk, B fixed, A scheduled with a stopgap.
   **Variants**: `cspm`, `container-image-scanning`, `threat-detection`.
   **Techniques**: path trace, meter, restyle, spotlight, caption.
   **Review**: Improved — made the inputs concrete and checkable: CVSS measures severity, EPSS estimates the chance of exploitation, KEV lists confirmed exploitation. Added the SLA clock the brief asks for and the caveat that "internal only" is not "safe" once someone is inside (so A is scheduled, not ignored). Weighed a triage-nurse metaphor: good, but the two-card re-sort is the same idea made concrete.

### Threat detection (`threat-detection`)

**The aha**: Prevention eventually fails, so detection decides how much damage an attack does, and a fake credential nobody should ever touch is among the most reliable alarms there is.
**Misconception to defeat**: Detection means antivirus signatures; behavioural and deception-based detection get overlooked.
**Cast**: A console wired to three alarm types: signature match, behavioural anomaly (a baseline line with a spike), and a honeytoken, a single fake credential clearly marked in the vault among real secrets, with an alert rule watching any use of it.
**Opening frame**: Console dark, three detectors idle, honeytoken sitting quietly.
**Story**:

1. An attacker runs a known-bad tool; the signature match fires. _"Known-bad: easy, if you've seen it before."_
2. A second attacker signs in from a new country at 3 a.m. with valid stolen credentials. No signature matches, but the behavioural baseline spikes. _"No signature, but it doesn't look like them."_
3. A careful third attacker avoids anything flashy but reads the secrets store and tries the honeytoken. The instant it's used, the alarm lights brightest. _"Nobody legitimate has a reason to use this."_
4. All three feed the console; the honeytoken's is marked "near-zero false positives," the behavioural one "tune the threshold."
   **The moment**: The honeytoken lighting up with certainty beside the fuzzier behavioural alarm.
   **Interaction**: Walk the attacker past the detectors in a different order; remove the honeytoken and the careful attacker slips through.
   **Ending**: Console with all three alarm types, the honeytoken clearly the most trusted.
   **Variants**: `siem-soar`, `secrets-vault`, `secret-sprawl`.
   **Techniques**: path trace, restyle, spotlight, meter, caption.
   **Review**: Improved — "zero false positives" overclaimed (a backup or discovery tool can enumerate a secret store); now "near-zero". Made the honeytoken mechanism concrete (an alert on any use of the fake key). Weighed a tripwire-in-a-hallway picture: it's what the honeytoken is, but a trio of detectors gives the contrast a newcomer needs.

### SIEM and SOAR (`siem-soar`)

**The aha**: A SIEM turns many weak signals into one strong alert by correlation; SOAR then acts on it in seconds instead of hours.
**Misconception to defeat**: SIEM and threat detection are the same thing. SIEM is where signals are combined, not where they're produced.
**Cast**: Four thin streams on the left (login log, firewall log, endpoint alert, DNS log), each labelled with its source system, flowing into a central SIEM funnel. A bright alert on a console; a SOAR playbook flowchart beside it.
**Opening frame**: Four unremarkable streams, funnel quiet. _"Each system sees its own slice."_
**Story**:

1. Each stream shows one ordinary signal: a login, a firewall allow, a process start, a DNS lookup. Nothing alerts. _"Four weak signals, four different systems."_
2. The funnel normalises them into one format and lines them up: same user, two-minute window, correlation lines between them. _"Together and in order: a pattern."_
3. One bright alert: "possible credential theft and lateral movement, user X."
4. The SOAR playbook enriches the alert (is the IP known-bad? is X an admin?), then disables the user and revokes sessions on its own; isolating the host waits for an analyst's approval. Timer: seconds beside a ghosted "hours" for the manual route.
   **The moment**: Four unremarkable streams converging into one bright alert, none alone worth a look.
   **Interaction**: Remove one of the four signals and the correlation falls under threshold; set the playbook to "fully automatic" and watch a false positive lock out a legitimate user, then back to "approve high-impact steps."
   **Ending**: Incident handled, the timer stopped at seconds, a tuning note added to the rule.
   **Variants**: `threat-detection`, `audit-logging`, `incident-response-lifecycle`.
   **Techniques**: stream, path trace, spotlight, timer, side by side, restyle, caption.
   **Review**: Improved — "automatic response" had no cost, so a false-positive lockout and a human approval step for high-impact actions were added (both SIEM tuning and alert fatigue are in the catalog's idea). Added the source system labels, which make "SIEM isn't the detector" visible. Weighed a detective's corkboard with string; it is the same picture as the converging streams, so the streams stay.

### Incident response lifecycle (`incident-response-lifecycle`)

**The aha**: In the cloud you contain without destroying evidence (isolate, revoke, snapshot) before you rebuild, and rehearsal is what makes the real thing survivable.
**Misconception to defeat**: Incident response means "unplug it and clean up," destroying the evidence you need.
**Cast**: A loop of stages following NIST SP 800-61 Rev. 3 (2025), which ties incident response to the CSF 2.0 functions: a background ring "Govern, Identify, Protect" (preparation: plans, rehearsals, logging) and a loop Detect, Respond (analyse, contain, eradicate), Recover, with Lessons Learned feeding back into the ring. A compromised VM inside the trust boundary; a camera icon; a fresh VM.
**Opening frame**: The ring and loop laid out, an alarm lit at Detect, a tabletop-exercise card already on the ring.
**Story**:

1. The ring, dimmed in the back, shows a rehearsal already done, logs on, roles named. _"Rehearsed before the real thing."_
2. Detect: an analyst traces the red attacker path through logs to the compromised VM.
3. Respond: instead of deleting the VM, it is moved into an isolation network rule while still running; its sessions and keys are revoked; a camera flash captures memory first, then the disk. _"Contain without destroying the evidence."_
4. Eradicate and Recover: a fresh VM is cloned from the golden image and the isolated one moves to a forensics area, preserved.
5. Lessons Learned replays the sequence as a highlight reel, circles the slowest step, and feeds a new note onto the ring's rehearsal card.
   **The moment**: Containment isolating and snapshotting the live VM instead of reflexively shutting it down.
   **Interaction**: Choose "delete now" versus "isolate and snapshot" and see which still has evidence at Lessons Learned.
   **Ending**: Loop back to the ring with the new lesson on it: a cycle, not a line.
   **Variants**: `audit-logging`, `siem-soar`, `immutable-backups`, `ransomware`.
   **Techniques**: lanes, boundary, token, clone, path trace, restyle, caption.
   **Review**: Improved — the lane names followed the older four-phase Rev. 2 model; Rev. 3 (April 2025) reorganises incident response around CSF 2.0 (Govern, Identify, Protect as continuous preparation; Detect, Respond, Recover as the loop; improvement fed back), so the cast now follows it and still shows the familiar steps. Memory is captured before the disk because it is volatile. Weighed a fire-brigade metaphor: it misses that you preserve the scene.

## 12. Data protection

### Data classification and discovery (`data-classification`)

**The aha**: Controls follow the label, and you can't protect sensitive data you never found, including the copies in logs, test databases and exports.
**Misconception to defeat**: Classification is a one-time tagging exercise done only on the "real" database.
**Cast**: A padlocked production database labelled "restricted: customer SSNs." Fainter, unlabelled satellite copies: a log stream, a test database, an export file on a laptop. A discovery radar.
**Opening frame**: Production clearly tagged with controls attached; satellite copies dim and untagged off to the side.
**Story**:

1. Zoom into production: fields in four colour bands (restricted, confidential, internal, public). _"Controls follow the label."_
2. An export job copies a slice of restricted data into a spreadsheet "for quick analysis"; the copy has no tag, no padlock, outside the boundary. _"The label didn't travel with the copy."_
3. The discovery radar (pattern matching and classifiers) sweeps the log stream, test database and spreadsheet, finds SSN-shaped data in all three, lights them red. _"Found: copies nobody classified."_
4. Each find gets the right treatment, not just a tag: the log is scrubbed and the logger fixed, the test database is replaced with masked data, the export is deleted or labelled and locked. _"The label decides the action."_
   **The moment**: The radar showing "protected" data sitting unprotected in three other places the whole time.
   **Interaction**: Run the sweep and watch untagged copies get found one by one; pick a treatment for each.
   **Ending**: Every remaining copy carries a label and its controls, and the log no longer holds SSNs. A scheduled sweep keeps running.
   **Variants**: `tokenization`, `data-loss-prevention`, `encryption-at-rest`.
   **Techniques**: contents, spotlight, restyle, appear/disappear, caption.
   **Review**: Improved — beat 4 only tagged the copies, which keeps the sprawl; now each find gets the action its label calls for (scrub, mask, delete/lock), and the sweep recurs, defeating "one-time." Weighed a "library catalogue" metaphor; the radar finding unknown copies is the stronger moment.

### Tokenization and data masking (`tokenization`)

**The aha**: With vault-based tokenization, a token has no mathematical link to the real value; only the vault's lookup maps it back. Systems holding only tokens fall out of the blast radius and the audit scope.
**Misconception to defeat**: Tokenization is just another form of encryption, reversible with a key.
**Cast**: A vault with a mapping table (real value to token) and a detokenize door guarded by permissions. Downstream systems on the right, handling only tokens (ticket-shaped, "not real"). An encryption example beside it. A coat-check ticket as the metaphor card.
**Opening frame**: A real card number in the vault; its token `TOK-9f82` flowing out to downstream systems.
**Story**:

1. A downstream payment system stores and logs `TOK-9f82` everywhere and never sees the real number. _"Like a coat-check ticket: it says nothing about the coat."_
2. An attacker takes the whole downstream system, token included, and tries to reverse it. There is no key and no maths to attack; the token is random. The system has no permission on the detokenize door either. _"No key can turn a token into the number."_
3. Side by side, encryption: the attacker steals the ciphertext and, with the key, decrypts it. _"Encryption is reversible by anyone with the key. A token isn't reversible by maths at all."_
4. Masking, briefly: the same number shown as `****-****-****-1234` on a screen and in a test database, irreversible. _"Masked for display and for test."_
5. A compliance-scope boundary that wrapped the whole downstream estate shrinks to wrap only the vault.
   **The moment**: The reversal attempt bouncing off nothing: there is no key to find, which is structurally different from encryption.
   **Interaction**: Give the attacker a stolen key and watch ciphertext crack while the token stays safe; then grant the compromised system detokenize permission and watch the vault hand the number over.
   **Ending**: Scope boundary shrunk to the vault, which is now the high-value target.
   **Variants**: `data-classification`, `hashing-vs-encryption-vs-encoding`, `data-loss-prevention`.
   **Techniques**: token, boundary, side by side, failure, restyle, caption.
   **Review**: Improved — the title promises masking, which was absent; added a short beat. Added the real weak point (a compromised system that is allowed to call detokenize, and the vault itself as the new crown jewel) and scoped the claim to vault-based tokenization, as some products (vaultless, format-preserving) use keys. Added the coat-check ticket to explain "no maths." Checked: PCI DSS scope reduction.

### Data loss prevention (DLP) (`data-loss-prevention`)

**The aha**: DLP is classification plus policy enforced at the exits, and it should start in monitor-only mode to learn the false positives before it blocks real work.
**Misconception to defeat**: DLP is a single always-on blocker from day one.
**Cast**: The trust boundary with exits as doors: email, upload to a public site, USB/endpoint, an AI chat prompt box. A DLP inspector at each, reading content against labels and patterns.
**Opening frame**: All four exits open, uninspected, labelled data (customer records) flowing through.
**Story**:

1. DLP switches on in monitor mode: inspectors watch every exit without blocking; a customer file sent by email logs a flag but the door stays open. _"Watch first, learn what's normal."_
2. One flagged "violation" is a nine-digit order number that looks like an SSN; marked a false positive, the rule is refined to require context. _"Tune before you block."_
3. A middle step on a borderline case: the user sees "this looks like customer data; add a reason to send." _"Coach, then block."_
4. In enforce mode a real customer export to a personal email is caught, the door slams, red cross, a warning pops. _"Block the clear-cut cases."_
5. An AI chat prompt containing a pasted customer record meets the same inspector, blocked identically. _"Same policy, every exit, including the newest."_
   **The moment**: The shift from "logged, not blocked" to the door slamming on an unambiguous violation, now that it has learned what's normal.
   **Interaction**: Toggle monitor versus enforce and see the same event logged only or blocked.
   **Ending**: All four exits enforcing on clear cases, false positives low, a "not covered" door (an unmanaged personal phone) drawn dim: DLP only sees the exits it's on.
   **Variants**: `data-classification`, `tokenization`.
   **Techniques**: boundary, toggle, failure, spotlight, caption.
   **Review**: Improved — the false-positive example was vague (now a concrete SSN-lookalike), added the warn-and-justify middle step real DLP products offer, and the dim unmanaged exit so DLP isn't read as a guarantee. Weighed a border-checkpoint metaphor; the four doors already give it.

### Immutable backups against ransomware (`immutable-backups`)

**The aha**: If an admin credential can delete or modify the backups, so can the attacker who stole it. Immutability plus a separate account lets you recover without paying.
**Misconception to defeat**: Backups automatically protect against ransomware.
**Cast**: Production data with a standard backup in the same account, same credentials. A separate, isolated vault in a different account, with a write-once lock (compliance mode) and a retention calendar.
**Opening frame**: Production, its standard backup beside it, the locked vault further away, retention "30 days, cannot be shortened."
**Story**:

1. A ransomware operator compromises the production admin account, the same credential that controls the standard backup, and deletes it in one action. _"If your admin can delete the backup, so can whoever steals the admin."_
2. The operator encrypts production; the victim turns to the backup: gone. A ransom note. _"No backup, no choice."_
3. Rewind: this time the immutable vault exists in its own account, with credentials the attacker never got. The red path reaches the vault's padlock and bounces: in compliance mode not even that account's root can delete a locked backup early. _"Locked. Not even an admin can delete it early."_
4. Recovery: data restores from the last point before the intrusion into clean production. _"Restores tested, restore point chosen before the attacker arrived."_
   **The moment**: The forked replay: same attack, same stolen credential, the standard backup dying instantly while the immutable one cannot be touched.
   **Interaction**: Toggle "same account" versus "separate immutable vault" and replay the attack; toggle governance mode (a privileged user can bypass) versus compliance mode (nobody can).
   **Ending**: Production restored, the vault still locked and intact.
   **Variants**: `ransomware`, `storage-redundancy-levels`.
   **Techniques**: boundary, path trace, failure, timer, toggle, restyle, caption.
   **Review**: Improved — added the lock modes (S3 Object Lock and Backup Vault Lock have a bypassable governance mode, so "not even an admin" is only true in compliance mode), and the restore-point choice: an immutable copy taken after encryption starts is an immutable ruin. Weighed an offline tape/air-gap picture; same goal, but the cloud version is a logical air gap that fits the cast.

## 13. Threats, attack chains and threat modeling

### Threat modeling (STRIDE) (`threat-modeling-stride`)

**The aha**: Draw the data flow, then ask the STRIDE question at each element and crossing. Every threat is the opposite of a security property, so every threat points to a control.
**Misconception to defeat**: Threat modeling is something scanners do after the system is built, rather than a design-time drawing exercise.
**Cast**: A bare data-flow sketch: client (external entity), a dashed trust boundary, app (process), database (data store), arrows for flows. Six STRIDE cards above, each paired dimly with its opposite property (Authentication, Integrity, Non-repudiation, Confidentiality, Availability, Authorization).
**Opening frame**: The sketch with one boundary crossing, STRIDE cards waiting, nothing ticked. _"What are we building? What can go wrong?"_
**Story**:

1. The client: "Spoofing?" Could someone pretend to be the client? Yes; "Authentication" appears.
2. The client→app flow: "Tampering?" Could the request be altered in transit? Yes; "Integrity: TLS."
3. Same client: "Repudiation?" Could a user deny an action, with nothing to prove it? Yes; "Audit log."
4. app→database: "Information disclosure?" Could data leak? Yes; "Confidentiality: access control, encryption."
5. The app: "Denial of service?" Could it be flooded? Yes; "Rate limiting." Then "Elevation of privilege?" Could a normal user reach an admin function? Yes; "Authorization on every call."
   **The moment**: Each abstract letter resolving into a concrete control placed on the drawing: the checklist is a build list.
   **Interaction**: Click any element to cycle the questions that apply to it (an external entity: S, R; a process: all six; a data store: T, I, D, and R for logs; a flow: T, I, D); add a component and the checklist needs a re-run.
   **Ending**: A controlled sketch with all six ticked, nothing built yet. _"What will we do? Did we do enough?"_
   **Variants**: `cia-triad`, `authentication-vs-authorization`, `attack-lifecycle-kill-chain`.
   **Techniques**: boundary, spotlight, appear/disappear, restyle, caption.
   **Review**: Improved — Repudiation was in the cast but skipped, so only five letters were walked; added. Elevation of privilege was placed on the database but belongs on a process (STRIDE-per-element), so it moved to the app. Added which questions apply to which element type, and Shostack's four questions as framing. Weighed a "walk the attack path" framing (kill chain style): better for attackers' view, not for design-time controls.

### Attack lifecycle (kill chain and MITRE ATT&CK) (`attack-lifecycle-kill-chain`)

**The aha**: An attack is a chain of stages, and defenders don't need to beat every step. Breaking any link stops what follows, and each step has named techniques you can detect or block.
**Misconception to defeat**: A breach is one catastrophic exploit, not a long sequence with many chances to intervene.
**Cast**: A horizontal chain of stages: recon, initial access, execution, persistence, privilege escalation, lateral movement, collection, exfiltration, impact. An attacker walking it. Dotted defensive checkpoints, currently dark. A zoomable column showing ATT&CK techniques (such as phishing, valid accounts) under a stage.
**Opening frame**: The chain laid out, attacker at "recon," checkpoints dark, "impact" lit ominously at the right end.
**Story**:

1. The attacker walks the whole chain unopposed to "impact," which flashes red. _"Nine stages, no resistance."_
2. Zoom into "initial access": below the tactic ("why") stack the techniques ("how"): phishing, stolen valid accounts, an exposed service. _"ATT&CK names the tactic, then each technique."_
3. Replay: a checkpoint at initial access, phishing-resistant sign-in (passkeys), stops the phished credential; nothing downstream happens. _"Break any link, stop everything after."_
4. Replay: initial access succeeds, but segmentation at lateral movement leaves the attacker stuck on one machine.
5. Replay: everything succeeds until exfiltration, where egress filtering catches the outbound data. Full access, nothing gets out.
   **The moment**: The same walk replayed three times, breaking at a different link each time.
   **Interaction**: Pick which single checkpoint to activate and watch how far the attacker gets; then pick two and see that a later checkpoint still matters when an earlier one fails.
   **Ending**: All checkpoints lit, attacker stopped at the first link; _"Real attackers loop and skip stages; the chain is a map, not a script."_
   **Variants**: `threat-modeling-stride`, `phishing-social-engineering`, `lateral-movement`, `ransomware`.
   **Techniques**: lanes, path trace, restyle, failure, zoom, caption.
   **Review**: Improved — the title promises ATT&CK but the plan was only a chain; added the tactic-over-technique zoom. Fixed "MFA stops the phished credential", which contradicts the AiTM plan (ordinary MFA is relayed; only phishing-resistant sign-in stops it). Added that real intrusions loop and skip stages, so the chain isn't a script. Checked: ATT&CK Enterprise has 14 tactics; the nine shown are a labelled subset.

### Phishing and social engineering (`phishing-social-engineering`)

**The aha**: Phishing sidesteps technical controls by manipulating people, so defences stack: stop some messages, catch others fast, and limit what one fooled person can reach.
**Misconception to defeat**: Phishing is only an obviously fake email with bad spelling.
**Cast**: Four incoming messages (email, SMS, voice call, QR code), one hiding a convincing fake sign-in page. A person's badge. Stacked defensive layers between the messages and the person's real credentials.
**Opening frame**: Four messages arriving, the fake login page glowing convincingly, no visible defences yet.
**Story**:

1. Email authentication (SPF, DKIM, DMARC) checks only the email. A message spoofing the company's exact domain is rejected. A lookalike (`acme-support.com`), sent from the attacker's own properly set-up domain, passes. The SMS, call and QR code never meet this layer. _"Authenticated is not trustworthy. And most channels aren't email."_
2. The surviving lookalike's fake page convinces the person, who types their password; it flows to the attacker. _"Manipulation works on people. This layer can fail."_
3. The attacker signs in: the account requires a passkey, password sign-in is off, so the stolen password is useless. _"A fooled person is still safe if what they gave away isn't enough."_
4. Replay with weaker MFA (a code or push the attacker relays): they get in, but a narrow role shrinks a dashed boundary around what that identity reaches. _"Limit what one fooled person can reach."_
5. A "report phishing" click lights a console alarm, shortening the time to catch the next wave.
   **The moment**: A genuinely fooled person still stopped by the next layer.
   **Interaction**: Remove one layer at a time and replay the same lure to see how far it gets.
   **Ending**: All layers lit, every message type failing against the same stack.
   **Variants**: `credential-stuffing-spraying`, `adversary-in-the-middle-phishing`, `multi-factor-authentication`, `passkeys-webauthn`.
   **Techniques**: lanes, restyle, failure, boundary, caption.
   **Review**: Improved — the old beat 1 ran email authentication over SMS, voice and QR lures, which it can't see. Reworked so the layer's limits (email only; lookalike domains pass) are the lesson, which defeats "obviously fake" better. Noted that password sign-in must be disabled for passkeys to protect, else the fallback is the weak point. Weighed a "fishing line" metaphor: pretty but not informative.

### Adversary-in-the-middle phishing (MFA bypass) (`adversary-in-the-middle-phishing`)

**The aha**: A reverse-proxy phishing kit relays the real sign-in page, MFA prompt and all, and steals the session that comes out the other end. The user did everything right; only an origin-bound credential stops it.
**Misconception to defeat**: "I completed MFA, so I'm safe." This attack defeats code and push MFA because the login really is genuine.
**Cast**: A user on the left, a transparent relay box in the middle run by the attacker (domain `acme-login.com`), the real identity provider on the right (`login.acme.com`). A session token is the prize. A URL bar shows the domain.
**Opening frame**: The user clicks a link and lands on what looks exactly like the real sign-in page; the URL bar says `acme-login.com`.
**Story**:

1. The user types their real password; the relay forwards it to the real IdP unmodified. _"The page is real. It's relayed through someone."_
2. The IdP challenges for MFA (a six-digit code or push); the relay forwards it; the user approves genuinely. _"They really did complete MFA."_
3. The IdP issues a session; the relay keeps a copy of the cookie while passing the rest on. _"The prize isn't the password. It's the session."_
4. The attacker replays the cookie against the real app, no password or MFA needed, and walks in as the user.
5. Contrast: the user has a passkey for `login.acme.com`. At `acme-login.com` the device finds no passkey for that domain, and the signed response would carry the wrong origin anyway, so the real IdP would reject it. Nothing is relayed. _"The device checks the domain. The user doesn't have to."_
   **The moment**: A fully completed, genuine MFA flow still ending with the attacker holding the session.
   **Interaction**: Swap the authenticator among password plus SMS code, push approval and passkey, and replay the same relay against each.
   **Ending**: The passkey version leaves the relay empty-handed; the code and push versions end with the attacker in a live session.
   **Variants**: `phishing-social-engineering`, `passkeys-webauthn`, `sessions-vs-tokens`, `oauth-refresh-tokens`.
   **Techniques**: path trace, token, exchange, restyle, side by side, failure, caption.
   **Review**: Improved — made the origin mismatch visible with a URL bar (the only thing that differs), and corrected beat 5: the relay can call WebAuthn, but the browser binds the response to the page's origin and the authenticator holds no credential for it, so "can't request the ceremony" was loose. Noted that code and push are both defeated, not just push. Weighed leaving it at "MFA is bad"; wrong, since the lesson is that origin binding, not a second factor, defeats the relay.

### Credential stuffing, password spraying and brute force (`credential-stuffing-spraying`)

**The aha**: Stuffing replays passwords stolen from other breaches; spraying tries a few common passwords across many accounts to dodge lockouts. Both exploit scale and reuse, not cleverness.
**Misconception to defeat**: These are sophisticated, targeted hacks rather than dumb automation exploiting reuse and lax limits.
**Cast**: A leaked username/password list from an unrelated breach on the left; an automated bot in the middle; rows of login forms for your app, each a small account badge with its own lockout counter.
**Opening frame**: The leaked list, badges all green and untouched.
**Story**:

1. Stuffing: the bot tries each leaked pair unchanged; about 1 in 100 works, because those users reused the password, and each hit flips red. _"Someone else's breach. Your account, because of reuse."_
2. Spraying: the bot tries one common password per account across hundreds of accounts, each counter staying at 1 or 2, under its lockout line. A few badges still flip. _"Wide and slow dodges the lockout."_
3. Brute force: many passwords against one account, fast; its counter fills at once and the account locks. _"Narrow and fast trips the lockout."_
4. Matching defences: a breached-password check rejects reused passwords at signup and sign-in, passkeys or MFA make a correct guess insufficient, and a view across accounts (one password everywhere, one IP range, a burst of failures) catches the spray that per-account lockout can't.
   **The moment**: The spray's counters staying just under the lockout line across hundreds of accounts: the pattern is the trick, not the guessing.
   **Interaction**: Dial the bot's attempts per account and watch it move between tripping the lockout and evading it; turn on the cross-account view and the spray lights up.
   **Ending**: Each attack shape stopped by its matching defence, console quiet.
   **Variants**: `phishing-social-engineering`, `multi-factor-authentication`, `rate-limiting-abuse`.
   **Techniques**: contents, dial, meter, failure, side by side, caption.
   **Review**: Improved — gave the stuffing hit rate (low single-digit percent at best, still thousands of accounts at scale), and fixed the defences: a per-account lockout does nothing against spraying, so the defence needs a cross-account view; this was only implied before. Weighed merging stuffing and spraying into one flow; the three-shapes contrast on the same counters is clearer.

### Lateral movement (`lateral-movement`)

**The aha**: The first compromised machine is rarely the target. Attackers hop sideways using stolen credentials and tokens, and flat networks with shared admin passwords make the hop fast and quiet.
**Misconception to defeat**: A breach is "contained" once the first compromised machine is found and cleaned.
**Cast**: A flat mesh of machines, several sharing the same local admin credential badge. An attacker on a low-value desktop at the edge; a customer database elsewhere, looking unreachable. A hop counter.
**Opening frame**: Flat mesh, attacker's dot on the desktop, the database far away, looking disconnected.
**Story**:

1. The foothold is an unremarkable desktop. _"Rarely the real target."_
2. The same admin credential is cached there and reused elsewhere (pass-the-hash); a red path hops to a second machine. Hop 1. _"One shared password, many doors."_
3. An on-prem admin account synced to the cloud carries the path into the cloud tenant. Hop 2. _"Synced identities carry the hop with them."_
4. Meanwhile the defender finds and wipes the first desktop; the red path is already two machines away and still going. _"Cleaning the first box isn't containment."_
5. Hops 3 and 4 follow, over a shared credential and an over-trusted role, until it reaches the database. No alarms yet.
6. Replay with fixes: segmentation puts checkpoints between segments, unique local admin passwords end the reuse, tiered admin blocks the privileged hop, east-west monitoring alarms on the first sideways step.
   **The moment**: The unbroken four-hop path from a boring desktop to the crown-jewel database, with almost nothing in the way.
   **Interaction**: Toggle each fix independently and replay to see where the path now stops.
   **Ending**: Mesh redrawn into segments, red path stopped at hop one, alarm lit.
   **Variants**: `privilege-escalation`, `blast-radius`, `network-segmentation`, `attack-lifecycle-kill-chain`.
   **Techniques**: path trace, restyle, boundary, failure, meter, caption.
   **Review**: Improved — "contained once the first machine is cleaned" was named but never defeated; added the beat where the first box is wiped while the path is already elsewhere. Numbered the hops so "four hops" adds up, and named the real fixes (unique local admin passwords, as LAPS does). Weighed a chess-pieces framing; the hop counter shows speed and quietness better.

### Ransomware attack chain (`ransomware`)

**The aha**: Encryption is the last step of a campaign. Backups are often disabled first and data is often stolen before anything is locked, so there are many earlier chances to catch it, and isolated immutable backups decide whether you must pay to get data back.
**Misconception to defeat**: Ransomware is "a virus that encrypts your files," a single sudden event rather than the final act of a campaign.
**Cast**: The attack-lifecycle chain, specialised: initial access, escalation, disable backups, exfiltrate, encrypt. Production data and a standard backup in the same account; a leak site in the corner.
**Opening frame**: Chain laid out, attacker at "initial access," production and its backup sitting peacefully together.
**Story**:

1. Initial access (a phishing email, stolen credentials or an unpatched internet-facing device) gives a quiet foothold, often days or weeks before. _"It starts quietly."_
2. Escalation to admin widens the reach.
3. The red path reaches the standard backup first, with the same stolen admin credential, and deletes it before production is touched. _"Backups go first, so recovery isn't an option later."_
4. A slow stream of data flows out over hours or days. _"Often a breach before it's ever a lockout."_
5. Only now does production flash and lock; a ransom note appears, with a threat to publish the stolen data.
6. Replay with an isolated immutable backup: step 3 bounces off its padlock and clean data restores.
   **The moment**: Backups dying before production is even touched, the step that decides whether recovery is possible.
   **Interaction**: Replay with the immutable backup present versus absent and compare; then add egress monitoring and see step 4 caught early.
   **Ending**: Two endings side by side: no backup, pay; immutable backup, restore. But the leak site still shows the stolen data: restoring fixes availability, not exposure, so catching the exfiltration matters too.
   **Variants**: `immutable-backups`, `attack-lifecycle-kill-chain`, `incident-response-lifecycle`, `data-loss-prevention`.
   **Techniques**: path trace, stream, restyle, failure, side by side, caption.
   **Review**: Improved — the old ending said immutable backups mean "no payment", which ignores double extortion: backups restore data but not the secrecy of a stolen copy. Added the leak threat and the egress-monitoring interaction. Checked that attacker order varies (exfiltration may precede or follow backup deletion), hence "often". Weighed a pure "timeline of dwell time" chart; the specialised chain reuses the area's language and shows the backup beat better.

### Subdomain takeover (dangling DNS) (`subdomain-takeover`)

**The aha**: Cloud resource names get recycled, but DNS records don't clean themselves up. A dangling record pointing at a deleted resource lets an attacker claim that name and inherit your domain's trust.
**Misconception to defeat**: This requires hacking DNS or the registrar. It doesn't; the record was already pointing at nothing.
**Cast**: Your DNS zone with one CNAME record, `promo.yourcompany.com → cloud-app-xyz123.provider.com`, and the cloud resource it points to, live inside the trust boundary. A browser with an address bar.
**Opening frame**: The record pointing cleanly at a live resource, a solid line between them, the browser showing a padlock.
**Story**:

1. The campaign ends, the resource is deleted, but the DNS record stays, now dangling. _"The resource is gone. The DNS record isn't."_
2. An attacker scanning for this pattern finds the unclaimed name.
3. They create a new resource and request that same name, which succeeds because the provider lets any customer claim a free name; the dangling line reconnects to the attacker's resource. _"Names get recycled. Your DNS doesn't know."_
4. The attacker even gets a valid certificate for `promo.yourcompany.com`. Visitors see your domain, a padlock, and the attacker's page: a phishing form, cookies scoped to the parent domain, or a hijacked OAuth redirect. _"Your domain, their content."_
   **The moment**: The line reconnecting itself to an attacker-owned resource: the DNS record never changed; what's underneath silently became someone else's.
   **Interaction**: Delete a resource and leave the record, let an attacker claim the name and watch the line reconnect; then remove the record first and watch the attacker's claim go nowhere.
   **Ending**: Before/after: remove the record first, then the resource, or have infrastructure code delete both together; a scanner flags any record that points at nothing.
   **Variants**: `security-misconfiguration`, `phishing-social-engineering`.
   **Techniques**: appear/disappear, path trace, restyle, side by side, caption.
   **Review**: Improved — added the padlock on the attacker's page (a valid certificate can be obtained for a name you control, which is what makes it convincing) and the infrastructure-code and scanner fixes. Checked: many providers now require a domain-verification record before attaching a custom domain, so the plan says "provider lets any customer claim the name" for the vulnerable case. Weighed a "forwarding address after you move out" metaphor; the live line reconnecting is more exact.
