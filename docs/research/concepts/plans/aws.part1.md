# AWS plans, part 1

Stage 2 plans for `catalog/aws.md` groups 1 to 5, in catalog order: global infrastructure and
frameworks; accounts, Organizations and governance; IAM and identity; VPC networking and hybrid
connectivity; edge, DNS and load balancing. Two other parts cover groups 6–9 and 10–17, sharing
this same visual language.

## Shared visual language

Real AWS throughout: service icons and names (account, OU, SCP, IAM role, VPC, security group,
NACL, Route 53, ALB/NLB…), never generic shapes, because these concepts are about AWS's own words.
AWS's own nesting is drawn as nested frames: an Organization frame holds OU frames holds Account
frames; a Region frame holds a VPC frame holds Availability Zone frames holds Subnet frames — a
subnet is drawn inside exactly one AZ frame, never straddling two. Requests and packets are small
dots (bare traffic) or envelope icons (an API call), travelling along arrows and tinted by outcome:
green reaches, red is dropped or denied, amber is in flight. IAM policy evaluation is a request
card moving left to right through a row of gates — SCP, permission boundary, identity policy,
resource policy, session policy — where an explicit Deny at any gate stamps a red ✗ on the card
that no later Allow can undo, and nothing downstream is reached. A role assumption swaps the
requester's badge for a temporary one in a different colour with a visible countdown timer in its
corner, rather than drawing a new character. "X vs Y" comparisons send the same traffic or task
through both options side by side, on the same clock, so the difference shows up as a divergence
rather than an assertion. "Which service do I use" questions are a short branching path of diamond
nodes whose chosen answers light a trail ending at the matching service icon. No new technique was
needed for this part; everything below is drawn from the vocabulary in `README.md`.

## Global infrastructure and frameworks

### AWS global infrastructure (`aws-global-infrastructure`)

**The aha**: A Region is really several isolated Availability Zones, so spreading across them survives a failure; edge locations only bring traffic onto AWS's network, cache and answer DNS — they don't run your application.
**Misconception to defeat**: Treating edge locations as mini-Regions, or Local Zones and Outposts as the same thing.
**Cast**: A world map. A Region frame (`us-east-1`) holding three AZ frames, each one or more datacentre icons with its own power and network. Dozens of small edge-location dots. A Local Zone icon beside a city, tethered by a dashed line to its parent Region. An Outposts rack inside a "your datacentre" boundary, cabled back to the Region.
**Opening frame**: The world map with Region boxes and edge dots, still. _"Not all AWS footprints are the same."_
**Story**:

1. Zoom into `us-east-1`: three AZ frames appear, labelled `use1-az1`…, each "own power, network, flood plain". _"A Region is really several of these."_
2. An app runs in two AZ frames. One AZ frame flashes red and greys out. The other AZ's instances keep serving. _"Spread across AZs: lose one, keep going."_
3. A browser dot travels to the nearest edge dot — a cache/DNS icon, no server — which forwards the miss on to the Region. _"Edge locations route and cache. Your app lives in the Region."_
4. Two accounts side by side: `us-east-1a` points at `use1-az1` in one and `use1-az2` in the other. _"Names are per account; IDs name the place."_
5. Local Zone and Outposts light up side by side, both tethered to the Region: one is AWS's building in a city near users, the other is AWS's rack inside your building. _"Same APIs, pushed closer: Local Zone in their building, Outposts in yours."_
   **The moment**: Beat 2 — a whole AZ frame greys out while the other AZ's instances keep serving.
   **Interaction**: Click an AZ to fail it and see which instances survive. Toggle names vs IDs across the two accounts.
   **Ending**: Rests on the zoomed Region, one AZ grey, the app still green.
   **Variants**: `aws-resource-scope`; fundamentals' region/AZ concept.
   **Techniques**: boundary, zoom, failure, toggle, token, side by side, caption.
   **Review**: Improved — facts check out (AZ = one or more datacentres, per-account AZ name mapping, edge locations do not host customer compute); the Local Zone vs Outposts misconception was named but never defeated, so beat 5 now contrasts whose building each sits in. Weighed a "city vs country" scale-ladder framing; it buries the failure moment that makes AZs matter.

### Global, Regional and zonal resources (`aws-resource-scope`)

**The aha**: A resource's scope — global, Regional or zonal — decides what an AZ or Region failure takes down, and what it can attach to.
**Misconception to defeat**: "S3 is global" (the bucket namespace is; the data lives in one Region), or "global" meaning "immune", or `us-east-1` as the home of everything global.
**Cast**: Three columns. Global: IAM, Organizations, Route 53, CloudFront, floating above the map, outside any Region frame. Regional: a Region frame holding VPC, S3, Lambda, DynamoDB, EFS, KMS. Zonal: an AZ frame inside it holding subnet, EC2, EBS, zonal NAT gateway.
**Opening frame**: The three columns, icons placed. _"Not every resource fails the same way."_
**Story**:

1. Fail one AZ frame: the Zonal icons inside it grey; the Region frame stays green. _"Zonal dies with its AZ."_
2. Fail a whole Region (not `us-east-1`): Regional and Zonal icons grey; the Global column, outside any Region frame, stays green. _"Regional and zonal die with the Region. Global isn't in one."_
3. Now fail `us-east-1`: Global icons keep answering (sign-ins, DNS, cached pages) but a small "edit settings" pencil on each stalls. _"Global keeps running; changing it leans on us-east-1."_
4. An EBS volume tries to attach to an instance in a different AZ frame: the cable bounces. _"A zonal resource attaches only inside its own AZ."_
5. A snapshot copies off the volume into a second Region frame, where an AMI is registered from it. _"Snapshots and AMIs are Regional: copy to move."_
6. Spotlight S3: the bucket sits in the Regional column; its name is checked in a global namespace above the map. _"The name is global. The data isn't."_
   **The moment**: Beat 2 — the three-column fate test: only the Global column survives a Region-wide failure.
   **Interaction**: Pick a resource, fail its AZ, then its Region, and watch which column survives.
   **Ending**: The three columns at rest, Region recovered, Global icons never having moved.
   **Variants**: `aws-global-infrastructure`.
   **Techniques**: boundary, failure, clone, move, spotlight, caption.
   **Review**: Improved — beat 2 overclaimed (global services' control planes do sit in `us-east-1`, which the catalog flags as a confusion), so beat 3 now separates serving from changing; fixed "snapshot becomes an AMI" (an AMI is registered from a snapshot, not the same object). Weighed a blast-radius ring diagram (AZ inside Region inside globe); the three-column fate test shows the same thing with attach rules too.

### AWS Well-Architected Framework (`aws-well-architected-framework`)

**The aha**: It's a structured conversation about trade-offs between six pillars, run as questions against one workload — not an audit, not a certification.
**Misconception to defeat**: That it grades you pass/fail, or hands out a certificate for an architecture.
**Cast**: A hexagon of six pillars (Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability) around a workload icon, each pillar with a gauge. A clipboard, "Well-Architected Tool", with a question list and a risk list.
**Opening frame**: The hexagon around the workload, all six gauges mid-level. _"Six pillars, one workload."_
**Story**:

1. A question appears: "How do you plan for disaster recovery?" Answered "we don't" — Reliability dips and a "High risk" flag lands on the risk list. _"Questions about your workload surface risks."_
2. A fix is applied (a standby-Region icon): Reliability rises, the Cost gauge ticks down. _"Pulling one pillar up can push another down."_
3. Side by side: a thrifty version (thin icons, Cost high, Reliability low) and a resilient version (redundant icons, the reverse). _"No single best, only the trade-off you choose."_
4. The risk list becomes an improvement plan; the clipboard stays "In review", never "Passed". _"A review, not a pass mark."_
   **The moment**: Beat 2 — one fix, two gauges moving in opposite directions.
   **Interaction**: Toggle fixes across pillars and watch all six gauges respond, some up, some down.
   **Ending**: The hexagon at a deliberately chosen balance, with a short improvement plan beside it.
   **Variants**: Fundamentals' shared responsibility model.
   **Techniques**: meter, dial, side by side, toggle, caption.
   **Review**: Improved — six pillars incl. Sustainability and the Tool's high/medium risk output checked; the gauges could imply a score, so the ending now shows a risk list and plan instead of a stamp, and the "confused with shared responsibility" misconception was never shown, so it was dropped for the audit/certificate one the story does defeat. Weighed an architect-and-reviewer conversation framing; the see-saw is more memorable.

## Accounts, Organizations and governance

### AWS account and the root user (`aws-account-and-root-user`)

**The aha**: The account is AWS's hard boundary; its root user can do anything, so lock it away, do daily work through roles, and let Organizations lend root out for minutes when a root-only fix is needed.
**Misconception to defeat**: Root as just a normal admin sign-in; the Organizations management account as just another account.
**Cast**: A member Account frame (a vault) with a crown "root user" behind a padlock, and role badges working inside. A separate Management account frame with its own crown, linked by a dashed line.
**Opening frame**: The crown locked behind MFA, roles active inside. _"The account's owner, locked away."_
**Story**:

1. A role badge does the daily work — deploy, read logs. _"Daily work: roles."_
2. Someone signs in as root for routine work: the crown flashes amber. _"Root can do anything, which is the problem."_
3. A bucket's own policy has locked everyone out, admins included: every role bounces red. Only the crown can fix it. _"A few jobs only root can do."_
4. The member's crown is removed: no password, no keys, no MFA. The management account mints a short-lived root session with a countdown, fixes the policy, and it expires. _"Centralized root access: no standing root, borrow it for minutes."_
5. The management account's own crown: MFA on, no access keys, and its workload area empty. _"The management account is still an account: lock its root, run nothing in it."_
   **The moment**: Beat 3 — every role bouncing off the lock-out and only the crown opening it.
   **Interaction**: Try routine tasks as root (all flash amber), then the lock-out (crown lights, roles bounce).
   **Ending**: Member account with no crown at all, roles doing every visible job.
   **Variants**: `aws-organizations`, `aws-iam-identities`.
   **Techniques**: boundary, restyle, failure, token, timer, spotlight, caption.
   **Review**: Rethought — the old beat 4 "routed the keys to the management account", which is wrong: with centralized root access member root credentials are deleted and privileged tasks run in short-lived root sessions (`sts:AssumeRoot`). The old "close this account" example is a poor choice because a member account is closed from the management account anyway; the policy lock-out is the catalog's example and a clearer root-only job. Weighed a "crown in a safe deposit box" metaphor; that suggests root is kept, whereas the modern answer is that members hold none.

### AWS Organizations (`aws-organizations`)

**The aha**: A policy attached to an OU reaches every account beneath it automatically, and billing pools across the whole tree.
**Misconception to defeat**: Treating an OU like an IAM group; treating the management account as just another account.
**Cast**: A root "Organization" frame holding a Management account (empty, no workloads) and OU frames (Security, Workloads, Sandbox), each holding Account frames. A guardrail policy icon above Workloads. A billing meter at the root.
**Opening frame**: The tree, the policy icon unattached. _"A tree of accounts, one owner at the root."_
**Story**:

1. Drag the policy onto the Workloads OU: small copies rain onto every Account frame beneath it. _"Attach once, it reaches every account below."_
2. A new account is added under Workloads; the same rain reaches it. _"New accounts inherit automatically."_
3. Drag the policy to the Organization root: everything lights except the Management account, which stays dim. _"It never restricts the management account, so run nothing there."_
4. Side by side: an IAM group holds people and grants them permissions; an OU holds accounts and carries guardrails. A user can't be dropped into an OU. _"A group organizes people. An OU organizes accounts."_
5. Three accounts' usage bars merge into one bill with a volume-discount tag. _"Billing pools: shared volume tiers and Savings Plans."_
   **The moment**: Beat 1 — one drag raining onto every nested account.
   **Interaction**: Drag a policy to different OUs and see which accounts light; add or remove an account under an OU.
   **Ending**: Full tree, policy rained down, one consolidated bill at the root.
   **Variants**: `aws-scps-and-rcps`, `aws-landing-zone-and-control-tower`, `aws-account-and-root-user`.
   **Techniques**: boundary, token, clone, meter, restyle, side by side, caption.
   **Review**: Improved — old beat 3 had the management account "refuse" the policy, which is wrong: you can attach one there, it just has no effect, so it now shows the dimmed account; old misconception about OU vs IAM group was never defeated, so beat 4 contrasts them. Pooled discounts and no-effect-on-management-account checked against the catalog. Weighed a folder-permissions-inheritance framing; the rain onto accounts is more direct.

### Service control policies and resource control policies (`aws-scps-and-rcps`)

**The aha**: SCPs and RCPs only set a ceiling — they never grant anything; a request still needs its own Allow, and a Deny anywhere still wins.
**Misconception to defeat**: "An SCP grants permissions."
**Cast**: An Account frame in an OU, with a role badge whose identity policy says "Allow: S3 full access". Above the account, an SCP gate holding two cards: `FullAWSAccess` ("Allow *") and a custom "Deny DeleteBucket". A bucket inside the account with an RCP gate on its side. Request cards: `GetObject`, `DeleteBucket`.
**Opening frame**: The wide-open identity policy, the SCP gate above it. _"A ceiling above an already-open door."_
**Story**:

1. `GetObject` passes the SCP gate (`FullAWSAccess` allows it, nothing denies it), then the identity Allow: green. _"An SCP only narrows what an Allow already permits."_
2. `DeleteBucket` hits the SCP's Deny: a red ✗ stamps the card there; the identity policy's Allow is never reached. _"The ceiling wins, though the policy says Allow all."_
3. A brand-new role with no identity policy sends `GetObject`: it passes the SCP's Allow * and dead-ends at the identity gate, grey. _"An SCP alone grants nothing."_
4. Switch to the bucket side: a principal from outside the org, with a bucket policy that says Allow, hits the RCP's "Deny non-org principals" and is stamped ✗. _"RCPs cap the resource, whoever is asking."_
5. A service-linked role's request slips past the SCP gate through a bypass lane. _"SCPs don't touch service-linked roles."_
   **The moment**: Beat 2, slowed — the red ✗ at the ceiling, with the wide-open Allow sitting unreached just downstream.
   **Interaction**: Toggle the SCP between "Deny DeleteBucket" and nothing; toggle whether the role has any identity Allow; toggle the RCP.
   **Ending**: SCP and RCP standing as ceilings, the Allow-all policy beneath, unreachable for the denied action.
   **Variants**: `aws-iam-policy-evaluation-logic`, `aws-organizations`, `aws-data-perimeter`.
   **Techniques**: boundary, token, failure, restyle, toggle, caption.
   **Review**: Rethought — the old beat 1 ("remove the SCP and it passes") and beat 2 ("no rule, implicit pass") misdescribe SCPs: with SCPs on, an action needs an SCP Allow (the default `FullAWSAccess`), so the gate now shows it; old beat 4 sent `DeleteBucket` (already denied by the SCP) to show "no Allow", muddling two lessons, so it uses `GetObject`; RCPs, half the title, were absent and now get beat 4. Weighed a "speed limit sign vs car" metaphor; the gate with a visible Allow * is truer to how evaluation works.

### Landing zone and AWS Control Tower (`aws-landing-zone-and-control-tower`)

**The aha**: The account is the unit of isolation, so each new workload gets a fresh account from a vending machine that already has logging, guardrails and SSO wired in.
**Misconception to defeat**: Confusing Control Tower with Organizations itself, or with Service Catalog.
**Cast**: An Organization tree: Security OU (Log Archive, Audit accounts), Infrastructure OU, Workloads OU (Prod, Non-Prod), Sandbox, Suspended, Policy-staging. An "Account Factory" machine with a lever at Workloads, and a small "Organizations" panel behind it.
**Opening frame**: The OU tree built, Account Factory idle. _"A vending machine for accounts."_
**Story**:

1. Pull the lever: the Organizations panel ticks "create account", then a blank Account frame drops into Workloads/Non-Prod already wearing a logging icon, a guardrail badge and an SSO key. _"Control Tower drives Organizations, and adds the baseline."_
2. Someone edits a guardrail inside it by hand; the dashboard flags "Drift detected" in amber. _"Change the baseline, and it's flagged."_
3. Log icons stream from every Workloads account into Log Archive. _"Every account logs centrally."_
4. An account is dragged to Suspended (an OU many landing zones add); its access drops to near zero. _"Suspended: locked down, not deleted."_
   **The moment**: Beat 1 — a lever-pull producing an account that is already governed, nothing configured by hand.
   **Interaction**: Pull the lever to mint an account; edit one of its guardrails and watch the drift flag appear.
   **Ending**: The OU tree with one more account, dashboard clean after repair.
   **Variants**: `aws-organizations`, `aws-scps-and-rcps`, `aws-account-and-root-user`.
   **Techniques**: boundary, clone, restyle, stream, zoom, caption.
   **Review**: Improved — beat 1 now shows the Organizations call underneath, which is what defeats "Control Tower is Organizations"; "Suspended" is described as a common OU rather than something Control Tower always creates (Security and Sandbox are its defaults). Log Archive/Audit accounts and drift detection checked. Weighed a "blueprint vs building" framing; the vending machine is the catalog's image and shows the born-compliant moment.

### Data perimeters (`aws-data-perimeter`)

**The aha**: Every request gets three checks — is the caller ours, is the resource ours, is it coming from our network — and only passing all three keeps data inside the trust zone, even when credentials leak.
**Misconception to defeat**: Treating a data perimeter as just a network firewall, or thinking SCPs alone achieve it.
**Cast**: A dashed "Trust zone (Org)" boundary around Account frames and a VPC. Three gates: "Caller ours? (`aws:PrincipalOrgID`)", "Resource ours? (`aws:ResourceOrgID`)", "Our network? (`aws:SourceVpce`)". A request card heading for an S3 bucket in the zone.
**Opening frame**: Three gates before the bucket, the trust-zone boundary around everything. _"Three questions, every time."_
**Story**:

1. A request from a role in the org, over the internet, passes gates 1 and 2 and fails gate 3. _"Right identity, right resource, wrong path."_
2. The same request through a VPC endpoint passes all three, green. _"All three, and it's in."_
3. Credentials stolen from one of our roles are used from an attacker's laptop: gate 1 passes (they're ours), gate 3 stops them. _"Stolen keys still need our network."_
4. One of our roles tries to copy data into a bucket in an outside account: gate 2 stops it. _"Not our bucket: nothing leaves."_
5. An outsider whose bucket-policy Allow looks fine fails gate 1 at the RCP. _"Not ours — stopped at the door."_
6. IAM Access Analyzer sweeps and flags one grant already shared outside. _"Analyzer finds what already leaked."_
   **The moment**: Beat 1 against beat 2, side by side — identical caller and resource, only the network path differs, and that alone decides the outcome.
   **Interaction**: Toggle the request's path (internet vs endpoint), the caller (ours vs foreign) and the destination bucket (ours vs outside).
   **Ending**: Legitimate traffic passing through the endpoint gate, Access Analyzer's flag cleared.
   **Variants**: `aws-scps-and-rcps`, `aws-vpc-endpoints-and-privatelink`; security's zero trust.
   **Techniques**: boundary, token, failure, side by side, spotlight, caption.
   **Review**: Improved — old beat 3 said stolen credentials carry a foreign `PrincipalOrgID`; stolen credentials from our role carry ours, so the network gate is what stops them, and the exfiltration-to-outside-bucket case (`aws:ResourceOrgID`) was missing. Conditions and Access Analyzer role checked against the catalog. Weighed a castle-gate metaphor; three visible gates mapped to the three condition keys is more teachable.

## IAM and identity

### IAM users, groups and roles (`aws-iam-identities`)

**The aha**: Roles have no credentials of their own — something assumes a role to borrow temporary ones; users with long-term keys are the leak-prone exception.
**Misconception to defeat**: Treating a group as a principal, or a signed-in Identity Center person as an IAM user.
**Cast**: Three badges. User: keys pinned to it, permanent. Group: a folder of policies, no face. Role: a blank-faced badge, no keys, a "borrow" slot. An "IAM users" list panel.
**Opening frame**: User badge with keys, Group folder beside it, Role badge empty-handed. _"Three kinds of identity, one real exception."_
**Story**:

1. A policy attaches to the Group folder; it reflects onto three User badges inside. _"Groups bundle users so a policy attaches once."_
2. Someone names the Group as a Principal in a policy: the field bounces red. _"A group can't be a principal."_
3. A person signs in through the company login and approaches the Role badge, which hands over a key-card with a countdown; the IAM users list stays unchanged. _"Something assumes a role and gets temporary keys. No IAM user needed."_
4. The User's permanent keys sit exposed for weeks on a timeline; the Role's card expires and is reissued roughly hourly. _"Long-term keys sit still. Temporary ones keep turning over."_
   **The moment**: Beat 3 — the empty-handed Role handing over a ticking key-card, with the IAM users list unchanged.
   **Interaction**: Try the Group as a Principal (bounces); assume the Role repeatedly and watch the timer reset.
   **Ending**: Role badge idle, card expired; the User badge dimmed as "avoid", still holding its unchanged keys.
   **Variants**: `aws-iam-roles-and-sts`, `aws-iam-identity-center`.
   **Techniques**: restyle, token, timer, failure, caption.
   **Review**: Improved — beat 3 now leaves the IAM users list visibly unchanged, which defeats the Identity-Center-user-is-an-IAM-user confusion the plan only named. Group-not-principal and default one-hour sessions checked. Weighed "keys vs hotel key-cards" versus the blank badge; the empty-handed role makes "no credentials of its own" visible.

### IAM policy anatomy (`aws-iam-policy-anatomy`)

**The aha**: Everything starts denied; a policy statement opens one precise door — which actions, on which ARNs, under which conditions.
**Misconception to defeat**: Confusing identity policy statements with resource-based policies or S3 ACLs.
**Cast**: A solid grey wall, "Default: deny everything". A policy document beside a role badge, its JSON shown as labelled blocks: Effect, Action, Resource (ARN), Condition. No Principal block: the policy is attached to the role.
**Opening frame**: The grey wall, role badge empty-handed, no policy yet. _"Nothing is allowed until something says so."_
**Story**:

1. A request bounces off the wall: "implicit deny — no door exists." _"Start here: nothing is allowed."_
2. A statement appears (Effect Allow, Action `s3:GetObject`); a door opens shaped like its ARN pattern `arn:aws:s3:::reports/*`. _"A statement opens one precise door."_
3. A matching request passes; one for `logs/*` bounces beside the door. _"Only what the ARN names."_
4. A Condition locks the door with a key: resource tag `team` must equal the principal's `team` tag. Mismatched tags bounce. _"ABAC: one door, many teams, by tag."_
5. Side by side: a bucket policy has a Principal block ("who") and no attached role, while the identity policy has none. _"On the resource, name the who. On the identity, the who is the attachment."_
6. Three frames compared: inline (welded in), customer-managed (reusable), AWS-managed (factory-made). _"Same shape, three ways to manage it."_
   **The moment**: Beat 3 — the precisely shaped door letting through only what its ARN names.
   **Interaction**: Edit the ARN pattern or add a Condition and watch which sample requests now pass.
   **Ending**: The wall with its one door, matching requests flowing, everything else still denied.
   **Variants**: `aws-identity-vs-resource-policies`, `aws-iam-policy-evaluation-logic`.
   **Techniques**: boundary, token, failure, restyle, side by side, caption.
   **Review**: Improved — added the Principal contrast (beat 5), because the plan named the resource-policy confusion but never showed what separates the two. Effect/Action/Resource/Condition, ABAC tag condition and the three management types checked. Weighed a "keycard rules" framing; the wall-and-door lets the ARN pattern be literal geometry.

### Roles, AssumeRole and STS temporary credentials (`aws-iam-roles-and-sts`)

**The aha**: Trust and permissions are two separate doors on a role, and STS hands back credentials that expire.
**Misconception to defeat**: Thinking permissions alone are enough to use a role, or that a role's trust and permissions are one policy.
**Cast**: A Role badge with two doors: "Trust policy (who may assume me)" and "Permissions policy (what I can do)". An STS icon between a requester badge and the Role. A key-card with an expiry timer.
**Opening frame**: Requester facing the closed trust door. _"Two doors on one role."_
**Story**:

1. The requester knocks with the wrong identity: bounces at the trust door. _"Wrong trust: never gets in."_
2. A matching Principal opens the trust door; STS stamps a key-card — access key, secret key, session token — with a one-hour countdown. _"AssumeRole: STS issues temporary credentials."_
3. The requester tries an action the permissions door doesn't cover: bounces there, though trust let them in. _"Trust gets you in. Permissions decide what you can do."_
4. The countdown hits zero; the card greys and crumbles. The SDK's provider chain quietly knocks again and a fresh card arrives. _"Credentials expire, and the SDK refreshes them."_
5. A SigV4 signature badge rides along each request instead of the secret key. _"The secret key never travels. Only a signature."_
   **The moment**: Beat 3 — passing the trust door but bouncing at the permissions door.
   **Interaction**: Misconfigure trust vs permissions and see which door stops the requester.
   **Ending**: A fresh key-card counting down, the requester working.
   **Variants**: `aws-iam-identities`, `aws-roles-for-aws-compute`, `aws-cross-account-access`.
   **Techniques**: restyle, token, timer, failure, exchange, caption.
   **Review**: Improved — dropped the "instance profiles are different from roles" misconception (no beat addressed it; it belongs to `aws-roles-for-aws-compute`) and made beat 4's refresh visible. Trust-vs-permissions, three-part credentials, 1-hour default session and SigV4 checked. Weighed an airline "boarding pass vs seat" metaphor; two literal doors on the badge carries the same split without a second story.

### Identity-based vs resource-based policies (`aws-identity-vs-resource-policies`)

**The aha**: Within one account either side can open the door; across accounts, both sides must say yes.
**Misconception to defeat**: Thinking a bucket policy is just an ACL, or that a resource's policy can't grant on its own.
**Cast**: Two accounts side by side. Account A: a Role badge with an identity policy ("Allow `s3:GetObject` on bucket-X") and a bucket-A1 with no policy of its own. Account B: bucket-X with a resource policy.
**Opening frame**: Role in A, buckets in A and B, policies visible, unconnected. _"Two kinds of policy, two owners."_
**Story**:

1. In Account A, bucket A1 has no resource policy; the Role's identity Allow alone lets the request through. _"One account: the identity policy can grant it."_
2. Reverse it: a bucket in A has a resource policy naming the role, and the role has no identity Allow: the request passes. _"…or the resource policy alone can."_
3. Cross-account: the Role in A requests B's bucket. Its identity policy allows, but B's resource policy says nothing about A: bounce at B's boundary. _"Across accounts, the resource must say yes too."_
4. B's resource policy is edited to name A's role: two green ticks, identity Allow and resource Allow. _"Both sides must allow."_
5. KMS key, SQS queue, Lambda and role-trust policies flash by. _"This is how other accounts and AWS services get in without assuming a role."_
   **The moment**: Beat 3 against beat 4, side by side — identical request, only B's resource policy changes, and that flips the outcome.
   **Interaction**: Toggle whether the resource policy names Account A, and whether Role A's identity policy allows, and watch the cross-account request pass or bounce.
   **Ending**: Both green ticks lit, request through.
   **Variants**: `aws-iam-policy-anatomy`, `aws-cross-account-access`, `aws-iam-policy-evaluation-logic`.
   **Techniques**: boundary, token, failure, side by side, toggle, caption.
   **Review**: Improved — the first beat only showed the identity-grants half of "either side", so beat 2 now shows the resource policy granting alone; the stated misconception "trust policies aren't resource policies" was backwards (a role's trust policy is a resource-based policy), so it was replaced. Union within an account, both-sides cross-account and the resource-policy list checked. Weighed a "key and lock-owner" metaphor; the two-account side-by-side is the contrast that matters.

### IAM policy evaluation logic (`aws-iam-policy-evaluation-logic`)

**The aha**: Guardrails intersect, grants union, and one explicit Deny anywhere ends the request.
**Misconception to defeat**: Thinking SCPs or permissions boundaries grant permissions, rather than narrowing what's already granted.
**Cast**: A request card travelling through a row of gates in AWS's order: explicit-deny scan, RCP, SCP, resource-based policy, identity-based policy, permissions boundary, session policy. Guardrail gates are narrowing diamonds; grant gates are rectangles.
**Opening frame**: The request card at the start of the row, every gate unlit. _"One request, a row of checks."_
**Story**:

1. The card passes RCP and SCP, each showing a standing Allow `*` and no Deny. _"Guardrails stay open until a rule narrows them."_
2. At the identity-based gate, the only Allow in the chain lights green. _"Somewhere, a grant must say yes."_
3. At the permissions boundary, a narrower ceiling clips the identity policy's green glow to its own limit. _"Boundaries and SCPs only shrink what was granted."_
4. A cross-account card with no resource-policy Allow dead-ends grey, beside the same card staying in one account and sailing through. _"No applicable Allow: denied by default."_
5. Insert a Deny in the SCP. In slow motion the very first gate, the scan for any explicit Deny, finds it: red ✗ on the card, and the whole row behind it, including the wide-open identity Allow, stays dark. _"One explicit Deny ends it. Nothing after matters."_
   **The moment**: Beat 5, slowed — the ✗ at the front and the whole row going dark behind a generous Allow.
   **Interaction**: Add or remove a Deny in any policy and watch the row go dark; toggle the boundary's limit.
   **Ending**: The row at rest: one case ended by a Deny, one allowed end to end.
   **Variants**: `aws-scps-and-rcps`, `aws-cross-account-access`, `aws-identity-vs-resource-policies`.
   **Techniques**: token, failure, restyle, spotlight, caption.
   **Review**: Improved — gate order matches AWS's documented sequence; fixed two slips: the SCP/RCP "implicit pass" (they need an Allow, usually `FullAWSAccess`) and the Deny stamped mid-row, which contradicted the explicit-deny gate placed first (a Deny in any policy is found by that first scan). Weighed a flowchart of yes/no diamonds; the row of gates keeps the area's shared language and the blackout makes "nothing after matters" visible.

### Cross-account access (`aws-cross-account-access`)

**The aha**: Assuming a role swaps your identity, so you lose your own permissions while wearing it; a resource policy lets you keep your own identity.
**Misconception to defeat**: That assuming a role adds permissions on top of your own.
**Cast**: Two accounts, A and B. "Alice", a person badge with her own permissions, in A. A role badge in B. A bucket in B.
**Opening frame**: Alice's badge, full of her own permissions, in Account A. _"Two doors across an account boundary."_
**Story**:

1. Path 1: Alice assumes the role in B. Her badge is replaced by the role's temporary one; her own permissions fade while she wears it. _"Assume a role: you are the role now."_
2. She switches back: her badge and permissions return, the temporary one discarded. _"Drop the role, get yourself back."_
3. Path 2, side by side: B's bucket has a resource policy naming Alice, and Alice's own identity policy also allows it. She keeps her own badge throughout. _"Or the resource trusts you directly. Both sides must allow."_
4. "Vendor Inc" serves two customers, you and Mallory. Mallory gives the vendor your role's ARN; with no ExternalId, the vendor assumes your role on Mallory's behalf. _"Without an ExternalId, a vendor can be tricked into using your role for someone else."_
5. Your trust policy now requires an ExternalId unique to you. The vendor sends Mallory's ID with Mallory's request: bounce. With yours: pass. _"ExternalId: which customer is this call for?"_
   **The moment**: Beat 1 — Alice's own permissions visibly fading the moment she wears the role.
   **Interaction**: Toggle assume-role vs resource-policy for the same task, and add or remove the ExternalId.
   **Ending**: Alice back in her own badge; the ExternalId sitting in the trust policy.
   **Variants**: `aws-iam-roles-and-sts`, `aws-identity-vs-resource-policies`.
   **Techniques**: restyle, token, side by side, failure, caption.
   **Review**: Rethought (beats 3–5) — old beat 3 let a resource policy alone admit Alice, wrong across accounts (her identity policy must allow too); old beats 4–5 framed the attacker as "a lookalike from the same vendor", which isn't the confused-deputy attack, where another customer of the vendor supplies your role ARN. Beats 1–2 and the swap checked. Weighed showing only the swap; the ExternalId story is the catalog's explicit second lesson.

### IAM Identity Center (`aws-iam-identity-center`)

**The aha**: A permission set is a template — Identity Center stamps out the matching role in every assigned account, so people sign in once and get short-lived credentials anywhere.
**Misconception to defeat**: Confusing Identity Center users with IAM users, or with Cognito (customer sign-in).
**Cast**: An identity source (Entra ID, Okta, or the built-in directory) feeding an Identity Center hub. A permission-set template. Three Account frames, each with an "IAM users: 0" counter and no roles yet.
**Opening frame**: The hub, one permission set, three empty Account frames. _"One template, waiting."_
**Story**:

1. The permission set is assigned to all three accounts: identical `AWSReservedSSO_…` role badges appear in each frame at once. _"One template, a role in every assigned account."_
2. A user signs in once at the hub through the identity source. _"Sign in once…"_
3. She picks Account B from the portal and gets B's role as a temporary badge with a countdown; B's "IAM users: 0" stays 0. _"…pick an account, get that account's role. No IAM user."_
4. She switches to Account C, no new sign-in: a fresh temporary badge for C's role. _"Same session, any assigned account."_
5. One action is added to the template; the three roles update together. _"Edit the template, then provision: every account's role follows."_
   **The moment**: Beat 1 — one template becoming three real, separately governed roles.
   **Interaction**: Assign or unassign accounts and watch roles appear or disappear; switch accounts from the portal.
   **Ending**: The portal listing all assigned accounts, the user holding a fresh badge for whichever she picks.
   **Variants**: `aws-iam-roles-and-sts`, `aws-iam-federation`, `aws-account-and-root-user`.
   **Techniques**: boundary, clone, token, timer, caption.
   **Review**: Improved — the IAM-users counter staying at 0 now defeats the IAM-user confusion on screen, and beat 5 says "provision" because permission-set edits are pushed to accounts rather than magically live. Template-to-`AWSReservedSSO_` role and short-lived credentials checked against the catalog. Weighed "badge printer" vs "template"; template with visible roles is clearer and matches the moment.

### Federation into IAM: SAML, OIDC, Roles Anywhere (`aws-iam-federation`)

**The aha**: Outside identities never become IAM users — they present a token or certificate, and the role's trust policy checks the issuer and claims before temporary keys come back.
**Misconception to defeat**: Thinking federated users or pipelines get provisioned as IAM users, or that this is the same as Identity Center.
**Cast**: Three outside sources: a workforce IdP (SAML assertion), a CI pipeline (GitHub Actions OIDC token), an on-prem server (X.509 certificate via Roles Anywhere). Each presents to an STS gate (Roles Anywhere through its own endpoint, which then issues STS credentials), then to a Role's trust policy. An "IAM users: 0" counter.
**Opening frame**: Three sources left, a gate centre, Role badges right. _"Different proofs, one destination."_
**Story**:

1. The pipeline presents its OIDC token (`repo:myapp`, `ref:main`); the trust policy checks issuer and claims, then a temporary badge comes back. No AWS key sits in the pipeline's secrets, and IAM users stays at 0. _"A token in, temporary keys out."_
2. The same pipeline from a feature branch has the right issuer but the wrong claim: bounce. _"The trust policy checks which repo and branch, not just who issued it."_
3. The on-prem server proves itself with a certificate to Roles Anywhere; the same kind of temporary badge returns. _"Certificates do it for servers."_
4. A SAML assertion from the workforce IdP flows through beside the other two. _"Three proofs, same result."_
   **The moment**: Beat 2 — a token from the right issuer refused for the wrong branch.
   **Interaction**: Edit the trust policy's claim condition and test tokens from different branches or repos.
   **Ending**: All three sources holding valid temporary badges, no long-lived AWS keys outside AWS, IAM users still 0.
   **Variants**: `aws-iam-identity-center`, `aws-iam-roles-and-sts`, `aws-cross-account-access`.
   **Techniques**: token, exchange, failure, side by side, caption.
   **Review**: Improved — Roles Anywhere hands out credentials through its own endpoint after validating the certificate against a trust anchor, not through the STS gate directly, so the cast says so; the IAM-users counter now defeats the provisioning misconception on screen. OIDC claim check and SAML/OIDC/certificate split checked. Weighed showing only OIDC (the most common case); the three-way convergence is what the catalog row asks for.

### How AWS compute gets credentials (`aws-roles-for-aws-compute`)

**The aha**: The platform fetches and rotates credentials for you — no keys sit on the box — but which role does what depends on the service.
**Misconception to defeat**: Confusing the ECS task role with the task execution role, or a Lambda execution role with its resource policy.
**Cast**: Three compute icons. EC2 with an instance profile (a sleeve holding a role badge). An ECS task with two differently coloured badges: task role and task execution role. Lambda with an execution-role badge plus a separate resource-policy door.
**Opening frame**: All three idle, badges visible. _"No keys on any of these boxes."_
**Story**:

1. EC2: code first sends a PUT to the metadata service and gets a session token, then sends a GET carrying that token and receives a temporary badge, refreshed automatically. An SSRF attempt that can only send a plain GET gets nothing. _"IMDSv2's token step blocks the common SSRF theft."_
2. ECS: the task role is what the app code can do; the execution role, a different colour, does an earlier job — pulling the image, writing logs. _"Two roles, two jobs: running the app vs starting the container."_
3. Lambda: the execution role lets the function call other services; separately, a resource-policy door controls who may invoke it. _"What it can do vs who can call it."_
4. Someone hard-codes an access key into an environment variable on all three: a key pinned, then crossed out. _"The wrong way: keys on the box."_
   **The moment**: Beat 2 — two differently coloured ECS badges doing visibly different jobs.
   **Interaction**: Swap which role is attached and see which action — image pull vs app call — breaks.
   **Ending**: All three running on auto-rotated temporary badges, the hard-coded key crossed out.
   **Variants**: `aws-iam-roles-and-sts`, `aws-eks-pod-identity-vs-irsa`, `aws-lambda-in-a-vpc`.
   **Techniques**: restyle, token, timer, failure, side by side, caption.
   **Review**: Improved — IMDSv2 is now drawn as its two steps (PUT for a token, GET with it), since that two-step is the actual SSRF defence, and the instance profile is drawn as the sleeve that carries the role. Task role vs execution role, Lambda role vs resource policy and rotation checked. Weighed three separate mini-plans; one shared "no keys" theme with three contrasting wiring diagrams is tighter.

### EKS Pod Identity vs IRSA (`aws-eks-pod-identity-vs-irsa`)

**The aha**: A pod should get its own IAM role instead of sharing the node's; IRSA and Pod Identity both map a service account to a role, but Pod Identity drops the per-cluster OIDC setup.
**Misconception to defeat**: Assuming pods are safely separate from the node's instance role (by default every pod on the node can reach it), or that IRSA and Pod Identity are the same mechanism.
**Cast**: A Node (EC2) with an instance-profile badge and three Pods, each tagged with a Kubernetes service account. Two paths side by side: IRSA (per-cluster OIDC provider, annotated service account, `AssumeRoleWithWebIdentity`) and Pod Identity (an agent on each node, an association made in the EKS API).
**Opening frame**: A pod reaches the node's metadata endpoint and receives the node's badge: every pod on the node holds the same one. _"By default, pods can borrow the node's role."_
**Story**:

1. IRSA: the pod's annotated service account presents a projected web-identity token, verified through the cluster's OIDC provider, to STS and gets its own badge. The node's badge is no longer used. _"IRSA: per-cluster OIDC trust, one role per service account."_
2. Pod Identity, side by side: the node agent hands the pod credentials for the role associated with its service account in the EKS API. No OIDC provider in the picture, and the role trusts the EKS service itself. _"Pod Identity: an agent and an association. No OIDC provider."_
3. The same role is reused in a second cluster: IRSA needs a new trust entry for that cluster's OIDC provider; Pod Identity just adds an association. _"One role, many clusters."_
   **The moment**: Beat 2 — the same temporary badge arriving through visibly shorter machinery.
   **Interaction**: Toggle IRSA vs Pod Identity for the same pod and compare the setup steps listed.
   **Ending**: Each pod holding its own distinct badge, the node's role no longer shared.
   **Variants**: `aws-roles-for-aws-compute`, `aws-iam-roles-and-sts`.
   **Techniques**: boundary, token, side by side, restyle, caption.
   **Review**: Rethought — the opening frame had the pod bouncing off the node's role, but by default pods can reach it through the instance metadata endpoint, which is exactly the problem; it now shows the leak, then the two fixes. Pod Identity details checked: agent DaemonSet, EKS API association, trust to the `pods.eks.amazonaws.com` service principal, no per-cluster OIDC edits. Weighed a pure setup-steps checklist; the reuse-across-clusters beat gives the same contrast visually.

## VPC networking and hybrid connectivity

### VPC anatomy (`aws-vpc-anatomy`)

**The aha**: The VPC spans the whole Region; each subnet is pinned to exactly one AZ and follows exactly one route table.
**Misconception to defeat**: Treating a VPC like an on-prem VLAN, or like an Azure VNet where subnets span zones.
**Cast**: A Region frame holding a VPC frame (`10.0.0.0/16`) holding three AZ frames, each with one Subnet frame, each with its own route table icon. Inside one subnet's address bar, the first four addresses and the last greyed.
**Opening frame**: Region > VPC > three AZs > one subnet each, route tables attached. _"A network, nested inside AWS's own boundaries."_
**Story**:

1. Drag a subnet so it straddles two AZ frames: it snaps back into one. _"A subnet lives in exactly one AZ. For availability, make one per AZ."_
2. Highlight the VPC's CIDR boundary stretching across all three AZ frames. _"The VPC spans the Region."_
3. In a `10.0.1.0/24` subnet, `.0` network, `.1` router, `.2` DNS, `.3` future use and `.255` grey out. _"AWS keeps five addresses per subnet."_
4. A second VPC with an overlapping CIDR is drawn beside the first; a peering line between them snaps red. _"Overlapping ranges can never be peered."_
5. A secondary CIDR block grows the first VPC; an IPAM icon oversees both ranges. _"Plan CIDRs up front. Secondary blocks and IPAM help later."_
   **The moment**: Beat 1 — the subnet snapping back when dragged across an AZ boundary.
   **Interaction**: Drag subnets between AZs; try peering two VPCs with overlapping CIDRs.
   **Ending**: The full nesting at rest, each subnet in one AZ, one route table each.
   **Variants**: `aws-internet-gateway-vs-nat-gateway`, `aws-vpc-connectivity-options`.
   **Techniques**: boundary, failure, move, spotlight, caption.
   **Review**: Improved — reserved addresses are first four plus last, not "top of the range" as the cast said, and now sit in a real `/24`; beat 1 now states the HA consequence (one subnet per AZ). Region-wide VPC, one route table per subnet, five reserved IPs, overlapping-CIDR peering block all checked. Weighed an on-prem-VLAN comparison side by side; it needs a second unfamiliar picture, whereas the snap-back is felt instantly.

### Public subnets, Internet Gateway, NAT gateway, egress-only IGW (`aws-internet-gateway-vs-nat-gateway`)

**The aha**: A subnet is "public" only because its route table sends `0.0.0.0/0` to an Internet Gateway; private subnets reach out through a NAT gateway but can't be reached from outside.
**Misconception to defeat**: Treating "public subnet" as a property of the subnet, or thinking NAT accepts inbound connections.
**Cast**: A VPC with a public Subnet (route table `0.0.0.0/0` → IGW) holding an EC2 instance with a public-IP badge and the zonal NAT gateway, and a private Subnet (`0.0.0.0/0` → NAT) holding an instance with a private IP only. An IPv6 instance with an egress-only IGW.
**Opening frame**: Both subnets, route tables the only visible difference. _"Public is a route, not a property."_
**Story**:

1. Erase the public subnet's `0.0.0.0/0` → IGW entry: its instance, still holding a public IP, can no longer be reached. _"Public is a route table entry."_
2. An inbound request to the public IP reaches the IGW, which translates it 1:1 to the private IP; a capture overlay shows the OS only ever sees the private address. _"The IGW translates. The OS never sees its public IP."_
3. The private instance opens a connection out through the NAT gateway (its public IP stamped on it) and the reply returns. _"NAT lets private instances call out…"_
4. A connection started from the internet toward the NAT gateway's IP bounces; so does one aimed at the IPv6 instance behind an egress-only IGW, which lets only outbound-initiated flows back. _"…but never accepts a call in. IPv6 gets an egress-only IGW."_
5. Three egress layouts compared: one zonal NAT in AZ1 serving all AZs (AZ1 fails: everyone loses egress, with cross-AZ cost before), a zonal NAT per AZ (each AZ independent, three gateways and routes), and one regional NAT gateway (one gateway and route, spans the AZs). _"Regional NAT: one gateway across AZs, no public subnet needed."_
   **The moment**: Beat 2 — the IGW translating while the instance's own view never shows a public IP.
   **Interaction**: Delete the route entry and watch "public" disappear; aim a request at the NAT gateway's IP; fail an AZ in each egress layout.
   **Ending**: Both subnets at rest, route tables the only difference, NAT only ever initiating outward.
   **Variants**: `aws-vpc-anatomy`, `aws-security-groups-vs-nacls`, `aws-vpc-endpoints-and-privatelink`.
   **Techniques**: boundary, token, failure, side by side, spotlight, caption.
   **Review**: Improved — the egress-only IGW is in the title but was never drawn (now in beat 4); old beat 5 was muddled (instances in a failed AZ are gone anyway; the real hazard is other AZs sharing one zonal NAT), so it compares single zonal, one per AZ and the regional NAT gateway (Nov 2025, per the catalog). IGW 1:1 translation, no inbound via NAT and route-defined "public" checked. Weighed dropping NAT layouts as a separate concept; the catalog lists the regional NAT here.

### Security groups vs network ACLs (`aws-security-groups-vs-nacls`)

**The aha**: Security groups are stateful and remember a connection's return trip; NACLs are stateless and forget it, so the return traffic must be allowed explicitly.
**Misconception to defeat**: "Security groups and NACLs are the same" — a NACL as just a second security group.
**Cast**: A Subnet frame with a NACL gate at its edge (numbered allow/deny rules, in and out, evaluated in order). Inside, an EC2 instance wrapped in a Security Group shield (allow-only rules; can reference another SG by name).
**Opening frame**: Client outside, NACL gate at the subnet edge, SG shield around the instance, both wide open. _"Two firewalls, stacked."_
**Story**:

1. A request passes the NACL's inbound rule and the SG's inbound rule, reaching the instance. _"Both must allow the way in."_
2. Tighten the NACL: allow inbound 443, no rule for the high return ports. Side by side, the identical reply packet leaves: the SG waves it through on memory of the connection; the NACL, with nothing allowing it, turns it back. _"Stateful vs stateless, on the same packet."_
3. The fix: the NACL gets an outbound rule for ephemeral ports (1024–65535); the reply flows. _"NACLs need the return trip allowed."_
4. An SG rule reads "allow from `sg-web`" instead of an IP range; a new instance added to that group passes with no rule edit. _"Security groups can reference each other."_
5. NACL rules run in number order: rule 100 (deny) sits above 200 (allow) for the same range; the token stops at 100. An SG's rule list has no deny option at all. _"NACL: lowest matching number wins, allow or deny. SG: allow only."_
   **The moment**: Beat 2 — the identical reply packet waved through by the SG and turned back by the NACL.
   **Interaction**: Toggle a NACL outbound ephemeral rule and watch the return leg; reorder NACL rule numbers.
   **Ending**: Both fixed, the connection flowing through both gates.
   **Variants**: `aws-internet-gateway-vs-nat-gateway`, `aws-vpc-flow-logs-and-reachability`, `aws-centralized-traffic-inspection`.
   **Techniques**: boundary, token, failure, side by side, spotlight, caption.
   **Review**: Improved — merged old beats 2 and 3, which showed the same bounce twice; added that SGs have no deny rules (the "allow-only" half of the aha was only in the cast). Stateful SG, stateless NACL, ephemeral-port return, SG-to-SG references and lowest-number-first ordering checked. Weighed an airport "passport check vs ticket with stamp" metaphor; the identical reply packet is the sharper proof.

### Connecting VPCs: peering vs Transit Gateway vs PrivateLink vs sharing (`aws-vpc-connectivity-options`)

**The aha**: Peering doesn't chain — A↔B plus B↔C never gives A↔C — which is exactly why hubs like Transit Gateway exist.
**Misconception to defeat**: "VPC peering is transitive."
**Cast**: Three VPC frames, A, B, C. Peering cables A↔B and B↔C. A second scenario: a Transit Gateway hub in the middle with a spoke to each.
**Opening frame**: A↔B and B↔C peered, no line between A and C. _"Two connections, not three."_
**Story**:

1. A token travels from A toward C via B: it reaches B, then stops dead at B's edge — no cable onward. _"Peering is point-to-point. B won't forward it."_
2. Swap the cables for a Transit Gateway hub: the token now reaches C through the hub. A counter shows 5 VPCs need 10 peerings in a full mesh, but only 5 hub attachments. _"A hub routes between spokes. It also scales."_
3. Two hub route tables: Prod spokes associated with one, Dev with another; a Dev token bounces off Prod. _"Association and propagation keep prod and dev apart."_
4. Three needs light three tools: "one service, overlapping CIDRs" → PrivateLink; "fewer VPCs to run" → VPC sharing with RAM; "service-to-service at layer 7" → VPC Lattice. _"Choose by the need, not the VPC count."_
   **The moment**: Beat 1 — the token dead-ending at B.
   **Interaction**: With only peering, try A→C (always stops at B); add the hub and watch it succeed; toggle Dev/Prod route tables.
   **Ending**: Hub with three spokes, isolated route tables, Prod flowing, Dev kept apart.
   **Variants**: `aws-vpc-anatomy`, `aws-vpc-endpoints-and-privatelink`, `aws-direct-connect-vifs-and-gateway`.
   **Techniques**: token, failure, boundary, side by side, choice, meter, caption.
   **Review**: Improved — added the full-mesh count (n(n−1)/2: 10 peerings for 5 VPCs) to beat 2 so "why hubs exist" is quantitative as well as logical. Non-transitive peering, TGW route-table association/propagation, PrivateLink for overlapping CIDRs, RAM sharing and Lattice checked. Weighed leading with the mesh count; the dead-end token is a clearer failure, so the count supports it.

### VPC endpoints: gateway vs interface (PrivateLink) (`aws-vpc-endpoints-and-privatelink`)

**The aha**: A gateway endpoint is a free route-table entry for S3 and DynamoDB, usable only from inside the VPC; an interface endpoint puts a private IP in your subnet and is reachable from on-premises and peered networks too.
**Misconception to defeat**: Confusing either endpoint type with a NAT gateway, or with VPC peering.
**Cast**: A VPC with a private subnet. A Gateway Endpoint as a route-table prefix-list entry pointing to S3 outside the VPC. An Interface Endpoint as an ENI with a private IP in the subnet, cabled (PrivateLink) to a target. An on-prem site over VPN. A dimmed NAT gateway.
**Opening frame**: Both endpoint types present, idle, S3 and "your own NLB service" off to the side. _"Two ways off the internet, onto AWS's network."_
**Story**:

1. An instance calls S3: the prefix-list route sends it straight there, bypassing the dimmed NAT. _"Gateway endpoint: just a route, and it's free."_
2. A request from on-premises over VPN tries the same gateway endpoint and bounces. _"Gateway endpoints: this VPC only."_
3. The same on-prem request goes to an interface endpoint's private IP (S3 and DynamoDB offer one too) and succeeds over PrivateLink. _"Interface endpoints: reachable from on-prem and peered networks."_
4. An endpoint policy on the interface endpoint is tightened to one API action; a different action through it bounces. _"Endpoint policies limit what's reachable through them."_
5. A provider's NLB-fronted service in another account is exposed as an endpoint service; your interface endpoint connects to it just as it did to S3. _"The same mechanism exposes your own services."_
   **The moment**: Beat 2 beside beat 3 — the identical on-prem request refused by the gateway endpoint, accepted by the interface endpoint.
   **Interaction**: Toggle endpoint type for the same request path; edit the endpoint policy and test actions.
   **Ending**: Both endpoints at rest, the NAT gateway idle for AWS-service traffic.
   **Variants**: `aws-internet-gateway-vs-nat-gateway`, `aws-vpc-connectivity-options`, `aws-data-perimeter`.
   **Techniques**: boundary, token, failure, side by side, spotlight, caption.
   **Review**: Improved — beat 3 now notes that S3 and DynamoDB also offer interface endpoints (otherwise the plan implies interface endpoints are for "everything else" and on-prem S3 access looks impossible). Gateway endpoints free and S3/DynamoDB only, VPC-only reach, ENI-based interface endpoints, endpoint policies and NLB-fronted endpoint services checked. Weighed a "tunnel vs door" metaphor; the identical-request contrast is cleaner.

### Direct Connect vs Site-to-Site VPN (`aws-direct-connect-vs-vpn`)

**The aha**: VPN is fast to set up and encrypted by default over the internet; Direct Connect is a private circuit with consistent bandwidth that takes weeks and isn't encrypted unless you add it.
**Misconception to defeat**: Assuming Direct Connect is automatically encrypted, or confusing Client VPN (for people) with Site-to-Site VPN (for sites).
**Cast**: An on-prem datacentre left, a VPC right. Two paths side by side: Site-to-Site VPN (two IPsec tunnels over an "internet" cloud, to a virtual private gateway or Transit Gateway) and Direct Connect (a dedicated cable through a DX location, to the same gateway). A dimmed laptop labelled "Client VPN: for people".
**Opening frame**: Both paths unbuilt, a stopwatch beside each reading "minutes" and "weeks". _"Two ways to a VPC from on-prem."_
**Story**:

1. VPN: two tunnels light up over the internet cloud, stopwatch at "minutes". _"Minutes to set up, encrypted by default (IPsec)."_
2. DX: the cable through the DX location stays grey for most of its "weeks" stopwatch before lighting. _"A private circuit: weeks to provision."_
3. Identical traffic on both: DX's bandwidth meter stays flat and high; VPN's jitters with internet congestion. _"DX: consistent bandwidth and latency."_
4. No lock on the DX cable, plain packets visible; VPN's tunnels visibly locked. _"DX isn't encrypted unless you add it."_
5. Two pairings: VPN as backup to DX (lights when DX flashes red; a single DX cable is a single point of failure) and VPN over DX (a lock added to the cable; MACsec is the other option). _"Common pairings, not either/or."_
   **The moment**: Beat 4 — the missing lock on the faster, steadier DX cable.
   **Interaction**: Toggle DX up or down and watch the VPN backup light; add a lock to DX.
   **Ending**: Both paths standing, DX primary, VPN idle and ready.
   **Variants**: `aws-direct-connect-vifs-and-gateway`, `aws-vpc-connectivity-options`.
   **Techniques**: timer, side by side, meter, restyle, failure, caption.
   **Review**: Improved — added the dimmed Client VPN laptop (the stated confusion had no on-screen answer) and the single-link-until-redundant point from the catalog to beat 5. Two IPsec tunnels, minutes vs weeks, no default DX encryption, VPN-over-DX and MACsec checked. Weighed a "public road vs private road" metaphor; the missing lock is a more memorable surprise.

### Direct Connect virtual interfaces and DX gateway (`aws-direct-connect-vifs-and-gateway`)

**The aha**: One physical DX circuit carries several logical virtual interfaces, each with its own BGP session, and a DX gateway lets one VIF reach VPCs and Transit Gateways across many Regions — without routing between those VPCs itself.
**Misconception to defeat**: Thinking a DX gateway routes VPC-to-VPC traffic, or confusing it with Transit Gateway.
**Cast**: A physical cable from a DX location, fanning (VLAN tags) into three Virtual Interfaces: Private VIF (to VPC A via VGW), Transit VIF (to Transit Gateways via DX gateway), Public VIF (to AWS public endpoints). A DX Gateway hub between the Transit VIF and several Region frames, each with a VPC/TGW.
**Opening frame**: The cable, VLAN tags visible, fanning into three VIFs. _"One wire, several logical connections."_
**Story**:

1. Traffic tagged for the Private VIF peels off at its VLAN tag and reaches VPC A via its VGW — the other VIFs' traffic rides the same physical wire untouched. _"One wire, many VLAN-tagged logical connections."_
2. The Transit VIF's traffic reaches the DX Gateway, which forwards it to a Transit Gateway in Region 1 — then the same DX Gateway is shown also reaching a Transit Gateway in Region 2. _"A DX gateway is global: one VIF reaches many Regions' Transit Gateways."_
3. A token tries to cut from Region 1's Transit Gateway across to Region 2's directly through the DX Gateway: it bounces. _"The DX gateway doesn't route between those VPCs or Regions."_
4. Two BGP sessions exchange routes; a "local preference" tag on one path and an "AS path length" tag on the other decide which is active and which is passive. _"BGP attributes choose the active path."_
   **The moment**: Beat 3 — the token bouncing off the DX Gateway when used as a Region-to-Region router, the sharpest correction of the likely confusion with Transit Gateway.
   **Interaction**: Toggle BGP local preference between two paths and watch which becomes active; try routing Region-to-Region through the DX gateway.
   **Ending**: The fan of VIFs at rest, DX Gateway quietly reaching multiple Regions, no Region-to-Region shortcut through it.
   **Variants**: `aws-direct-connect-vs-vpn`, `aws-vpc-connectivity-options`.
   **Techniques**: token, boundary, failure, spotlight, exchange, caption.
   **Review**: Keep — facts checked against the catalog: VLAN-tagged VIFs each with their own BGP session; private, transit and public VIF roles; a DX gateway being a global object that reaches VPCs and Transit Gateways in many Regions without routing between them; local preference, AS path and communities choosing active/passive paths. Misconception (DX gateway as a TGW-like router) is defeated by the beat-3 bounce and the opening frame (one wire, three logical VIFs) stands alone. Weighed a trunk-road-with-lanes metaphor and a "hub airport" framing for the gateway; the VLAN fan plus the refused Region-to-Region token is stronger than either.

### Centralised inspection with Network Firewall and Gateway Load Balancer (`aws-centralized-traffic-inspection`)

**The aha**: Inspection is a routing problem — route tables force traffic through firewall endpoints in both directions, and Transit Gateway appliance mode keeps each flow on one path.
**Misconception to defeat**: Thinking Network Firewall or GWLB replace security groups and NACLs rather than adding a deeper layer.
**Cast**: A Transit Gateway hub with spokes to a Workload VPC and an Inspection VPC holding AWS Network Firewall endpoints in two AZs, or a fleet of third-party appliances behind a Gateway Load Balancer. Route tables drawn as explicit redirect arrows. A security group still around the workload instance.
**Opening frame**: Workload and Inspection VPCs spoked to the hub, route tables drawn, no traffic yet. _"A detour, built into the routing."_
**Story**:

1. Egress traffic from the workload is routed by explicit route-table entries through the Network Firewall endpoint, which blocks one bad domain a security group can't express, then continues out. _"A route table forces the detour. The firewall reads deeper."_
2. The return traffic comes back through the hub but lands on the other AZ's firewall endpoint: amber, asymmetric, the firewall sees half a conversation. _"Without care, the return trip takes a different path."_
3. Turn on Transit Gateway appliance mode on the inspection attachment: the flow is pinned to one AZ's path in both directions. _"Appliance mode keeps each flow on one path."_
4. Swap the firewall for three third-party appliances behind a GWLB: traffic is GENEVE-wrapped across the fleet, yet from outside it is one "bump in the wire". _"GWLB makes many appliances look like one."_
   **The moment**: Beat 2 against beat 3 — the same return packet, asymmetric without appliance mode, pinned with it.
   **Interaction**: Toggle appliance mode and watch whether the return path matches; swap Network Firewall for the GWLB fleet.
   **Ending**: Outbound and return traffic through the same inspection point, the security group still standing at the instance.
   **Variants**: `aws-security-groups-vs-nacls`, `aws-vpc-connectivity-options`, `aws-waf-and-shield`.
   **Techniques**: boundary, token, path trace, toggle, failure, caption.
   **Review**: Improved — appliance mode pins a flow to one AZ's network interface in both directions rather than "the exact firewall endpoint", so beat 2 now shows an AZ mismatch; the "replaces security groups" misconception had no beat, so beat 1 shows the firewall doing something an SG can't and the SG still standing at the end. Route-table-forced detour, GENEVE and GWLB-as-bump-in-the-wire checked. Weighed an airport-security-checkpoint metaphor; the plan's route-table arrows are the truer mechanism.

### VPC Flow Logs, Reachability Analyzer, Traffic Mirroring (`aws-vpc-flow-logs-and-reachability`)

**The aha**: Flow Logs record what happened — the 5-tuple and accept or reject, never the payload; Reachability Analyzer predicts what can happen and names the hop that would block it, without sending any traffic.
**Misconception to defeat**: Confusing Flow Logs with CloudTrail (API calls, not packets), or thinking Reachability Analyzer sends probes.
**Cast**: A VPC with instances A and B in different subnets, a security group and a NACL between them. A Flow Logs ledger (source, destination, port, protocol, ACCEPT/REJECT). A CloudTrail ledger of API calls beside it. A Reachability Analyzer icon with a path overlay.
**Opening frame**: A and B, SG and NACL between, both ledgers empty, Analyzer idle. _"What happened, and what could happen."_
**Story**:

1. A real packet from A to B is rejected by the NACL; a Flow Logs row appears: "A → B, 443, REJECT" — the verdict, no payload. _"Flow Logs: the 5-tuple and the verdict, never the payload."_
2. Reachability Analyzer is asked "A to B?" and no token moves; it highlights the NACL rule that would block it. _"Predicted, not probed. It names the blocking hop."_
3. An admin edits the rule: the CloudTrail ledger records the API call, not any packet. The Analyzer now traces a green path and a real packet adds an ACCEPT row. _"CloudTrail records who changed it. Analyzer predicts. Flow Logs confirm."_
4. Traffic Mirroring on a third link copies the actual packets to an inspection tool, beside the metadata-only row. _"Need the bytes? That's mirroring."_
   **The moment**: Beat 2 — the Analyzer naming the exact blocking hop while visibly sending nothing.
   **Interaction**: Break a rule, ask the Analyzer to find it; then send a real packet and watch its Flow Logs row appear.
   **Ending**: Analyzer's green trace and a confirming ACCEPT row side by side.
   **Variants**: `aws-security-groups-vs-nacls`, `aws-vpc-connectivity-options`.
   **Techniques**: token, path trace, spotlight, contents, caption.
   **Review**: Improved — added a CloudTrail ledger in beat 3 so the Flow Logs vs CloudTrail confusion is defeated on screen, not only named. Flow Log record contents, config-based Analyzer reasoning and packet-copy Traffic Mirroring checked. Weighed ordering Analyzer first ("could it work?" then "did it?"); keeping the real event first shows the gap that makes Analyzer useful.

## Edge, DNS and load balancing

### Route 53 hosted zones, alias records and Resolver (`aws-route53-hosted-zones-and-resolver`)

**The aha**: One name can answer differently inside your VPC than outside it, and an Alias record is a Route 53 feature that follows a target's IPs and works even at the zone apex, where a CNAME can't.
**Misconception to defeat**: Thinking Alias is just a CNAME.
**Cast**: The name `app.example.com`. Outside the VPC, a public hosted zone answering with one IP. Inside a VPC, a private hosted zone, associated only with that VPC, answering with a different IP. A Resolver icon at the VPC's `.2` address, with inbound and outbound endpoints reaching on-prem DNS.
**Opening frame**: The same name typed from outside and from inside the VPC, two hosted zones ready. _"One name, two owners."_
**Story**:

1. A client outside resolves the name against the public hosted zone and gets the public IP. _"Outside: the public hosted zone answers."_
2. An instance inside the VPC asks Resolver the exact same name: the private hosted zone answers, with a different IP. _"Split horizon: same name, different answer, by where you ask from."_
3. A CNAME at the zone apex (`example.com`) is rejected; an Alias at the same apex succeeds and follows the target's IP changes. _"Alias works at the apex and follows the target."_
4. An on-prem DNS server asks, through the inbound endpoint, for a VPC-private name; the VPC asks, through the outbound endpoint and a forwarding rule, for an on-prem-only name. _"Hybrid DNS: endpoints and forwarding rules, both directions."_
   **The moment**: Beat 2 — identical query text, two different correct answers, because of where it was asked from.
   **Interaction**: Toggle "ask from inside VPC / outside" for the same name; try a CNAME vs an Alias at the apex.
   **Ending**: Both hosted zones at rest, each still answering correctly for its audience.
   **Variants**: `aws-route53-routing-policies`; networking's DNS resolution.
   **Techniques**: boundary, token, side by side, toggle, failure, caption.
   **Review**: Improved — dropped the Resolver-vs-DNS-Firewall misconception (no beat touched it); the CNAME-at-apex rejection stays as the Alias proof. Private zone answering only associated VPCs, apex CNAME limit, Resolver at `.2` and inbound/outbound endpoints checked. Weighed leading with Alias; split horizon is the more surprising first idea.

### Route 53 routing policies and health checks (`aws-route53-routing-policies`)

**The aha**: DNS chooses which endpoint a client gets at lookup time, health checks remove failing answers from the pool, but clients cache the answer for the TTL — so DNS failover is never instant.
**Misconception to defeat**: Expecting failover to be immediate, or confusing geolocation (where the user is) with latency routing (measured network latency).
**Cast**: A record for `api.example.com` with a routing-policy selector (Simple, Weighted, Latency, Failover, Geolocation, Geoproximity, IP-based, Multivalue). Region A and B endpoints, each with a health-check icon. A TTL clock on each client.
**Opening frame**: Failover policy selected, Region A primary (green), Region B standby (grey). _"DNS picks, at lookup time."_
**Story**:

1. A client queries, gets Region A's IP and caches it: a TTL countdown starts on the client. _"DNS answers once, then the client holds the answer for the TTL."_
2. Region A's health check turns red; checkers from several AWS locations agree and pull A from the pool. _"Health checks remove the failing record…"_
3. A new client gets Region B. The first client, still mid-TTL, keeps hitting Region A's dead IP until its cache expires. _"…but a client already holding the old answer won't know until its TTL runs out."_
4. Two users, one in Lisbon and one in Nairobi. Switch policies on the same record: Weighted splits 80/20 for everyone; Geolocation sends each continent to its assigned Region; Latency sends each to whichever Region measures fastest, sometimes not the same answer; Geoproximity pulls users toward a Region by distance, with a bias dial. _"Weighted by rule, geolocation by place, latency by measurement, geoproximity by distance and bias."_
   **The moment**: Beat 3 — the stale client still hitting the dead Region while a fresh client already gets the healthy one.
   **Interaction**: Fail a Region and watch new vs cached clients diverge; switch policies and watch the same two users routed differently; drag the geoproximity bias.
   **Ending**: TTL expires, the stale client's next query finally returns Region B.
   **Variants**: `aws-route53-hosted-zones-and-resolver`, `aws-global-accelerator-vs-cloudfront`, `aws-elb-alb-vs-nlb-vs-gwlb`.
   **Techniques**: timer, failure, token, choice, side by side, caption.
   **Review**: Improved — beat 4 left geoproximity and its bias unused despite being named in the cast, so it is added; the two example users are made concrete. TTL caching behind slow failover, multi-location health checkers, and latency-measures-network vs geolocation-uses-location checked. Weighed splitting policies into their own plan; the shared "same two users" setup is what makes the contrast visible, so one plan is right.

### CloudFront distributions, behaviours and OAC (`aws-cloudfront-distributions`)

**The aha**: The cache key decides the hit rate — every header or cookie added to it splits one cached response into many — and Origin Access Control is what keeps the origin trusting only this distribution.
**Misconception to defeat**: Treating CloudFront as a plain reverse proxy, or confusing OAC with the legacy OAI.
**Cast**: A Distribution with path-pattern Behaviours (`/images/*` → S3, `/api/*` → ALB), each with a Cache Policy (cache-key ingredients) and an Origin Request Policy. Edge-location dots on a map feeding back to the distribution. A private S3 bucket trusting only this distribution via an OAC lock.
**Opening frame**: A request arriving at the nearest edge dot, distribution behind it, origins further behind. _"Every request meets the edge first."_
**Story**:

1. A request for `/images/photo.jpg` hits the edge and gets a cache hit, served instantly without touching the origin. _"A hit never reaches the origin."_
2. A request for `/api/data` misses, travels to the ALB origin, and is cached at the edge with its TTL. _"A miss goes to the origin, then gets cached too."_
3. The cache key widens to include a `User-Id` header: the one cached card for that URL clones into many thin cards, one per value. _"Add a header to the key, and the cache splits — one copy per value."_
4. A request straight to the S3 bucket's own URL, bypassing CloudFront, bounces off OAC's lock; only a request signed as coming from this distribution gets through. _"OAC: the bucket trusts only this distribution, not the open internet."_
5. A CloudFront Function running right at the edge rewrites a header in milliseconds; a heavier Lambda@Edge function, nearer the origin, does a bigger transform. _"Light and at the viewer vs heavier and near the origin."_
   **The moment**: Beat 3 — one cached card visibly cloning into many the instant a header joins the cache key, making the hit-rate cost concrete.
   **Interaction**: Add or remove headers and cookies from the cache key and watch the cache fracture or consolidate; try bypassing OAC directly to the bucket.
   **Ending**: Cache key trimmed back down, one shared cached card, high hit rate restored.
   **Variants**: `aws-global-accelerator-vs-cloudfront`, `aws-route53-routing-policies`, `aws-s3-access-control`.
   **Techniques**: boundary, token, contents, clone, failure, spotlight, caption.
   **Review**: Keep — facts checked: path-pattern behaviours mapping to origins, cache policy (cache key and TTLs) vs origin request policy, hits served at the edge with misses fetched from the origin, OAC signing requests so a private S3 bucket trusts only that distribution (OAI is the legacy form), CloudFront Functions at the viewer vs Lambda@Edge that can also act on origin requests. The aha (cache key governs hit rate; OAC keeps the origin private) is shown by beat 3's cloning cards and beat 4's bounced direct request; the opening frame (request meets the edge first) is understandable cold. Weighed leading with TTLs and invalidation instead of the cache key; widening the key is the sharper, more memorable failure.

### Global Accelerator vs CloudFront (`aws-global-accelerator-vs-cloudfront`)

**The aha**: CloudFront moves content closer to users by caching; Global Accelerator moves the network path closer, carrying any TCP or UDP traffic over AWS's backbone through two unchanging anycast IPs.
**Misconception to defeat**: Treating both as the same kind of "CDN", or thinking Global Accelerator caches anything.
**Cast**: Side by side. Left, CloudFront: an edge location caching HTTP content, origin behind. Right, Global Accelerator: two static anycast IP badges and a straight line along the AWS backbone to the nearest healthy Region, no cache icon. A faded Route 53 failover record for comparison.
**Opening frame**: Both sides idle, the same client on the far left of each. _"Two ways to use AWS's edge."_
**Story**:

1. Left: an HTTP request hits the nearest edge and is served from cache. _"CloudFront: content moves to the edge."_
2. Right: a UDP game stream enters at the nearest edge and rides the backbone, uncached, to a Region. _"Global Accelerator: the path improves. Nothing is cached."_
3. Region A fails. Faded DNS failover: a client holding the old IP waits out its TTL. Global Accelerator: its health checks pull Region A and the same two IPs now lead to Region B within about a minute, no DNS change, no client cache to expire. _"Static IPs fail over without waiting for DNS."_
4. A client with an IP allow-list works against Global Accelerator's two fixed IPs but breaks against CloudFront's large, changing edge ranges. _"Fixed IPs matter for allow-lists and non-HTTP traffic."_
   **The moment**: Beat 3 — the same two IPs, traffic moved to Region B, while the DNS client is still stuck on the old answer.
   **Interaction**: Fail a Region and watch the IPs stay fixed while traffic reroutes; toggle HTTP vs raw TCP/UDP.
   **Ending**: Both sides resting, each serving the traffic it suits.
   **Variants**: `aws-cloudfront-distributions`, `aws-route53-routing-policies`, `aws-elb-alb-vs-nlb-vs-gwlb`.
   **Techniques**: side by side, token, stream, failure, meter, timer, caption.
   **Review**: Improved — old beat 3 contrasted with "CloudFront origin failover relying on DNS", which is wrong (CloudFront origin groups fail over per request on errors); the real contrast is DNS-TTL failover, so Route 53 sits faded alongside. "Instant" became "about a minute" (health-check driven). Anycast static IPs, TCP/UDP, no caching and allow-list use checked. Weighed a pure "cache vs highway" two-panel; the failover beat connects to the routing-policy plan.

### Elastic Load Balancing: ALB vs NLB vs GWLB (`aws-elb-alb-vs-nlb-vs-gwlb`)

**The aha**: Choose by layer — ALB understands and routes requests, NLB moves connections at huge scale with the client IP preserved, GWLB slips an appliance into the path invisibly.
**Misconception to defeat**: Treating all three as interchangeable "load balancers".
**Cast**: Three load balancer icons side by side, each with nodes in subnets across AZ frames, each health-checking a Target Group. ALB: listener rules on host, path, header. NLB: one static IP per AZ. GWLB: GENEVE-wrapped traffic through an appliance fleet.
**Opening frame**: Identical traffic approaching all three in parallel. _"Same traffic, three very different jobs."_
**Story**:

1. ALB: a request for `/api/orders` is opened and read by listener rules and routed to the matching target group; the target sees the ALB's address, with the client in `X-Forwarded-For`. _"ALB reads the request, then forwards its own."_
2. NLB: a raw TCP connection passes through unopened at huge volume; the target sees the original client IP. _"NLB moves connections, fast, keeping the client IP."_
3. GWLB: the traffic is GENEVE-wrapped, sent through the appliance fleet and unwrapped; from outside it is one invisible hop. _"GWLB: an appliance in the path, invisible."_
4. Toggle cross-zone load balancing off: an AZ1 node won't send to a healthy AZ2 target. On: it spreads across AZs. A tag notes ALB defaults to on, NLB and GWLB to off. _"Cross-zone decides whether a node reaches other AZs' targets."_
5. A Classic Load Balancer sits dimmed. _"CLB: legacy."_
   **The moment**: Beat 1 against beat 2 — identical traffic, ALB opening it to read the path, NLB passing it through unopened.
   **Interaction**: Toggle cross-zone and watch an AZ's node reach (or not) targets elsewhere; route identical traffic to all three and compare.
   **Ending**: All three resting, each carrying the traffic suited to its layer.
   **Variants**: `aws-route53-routing-policies`, `aws-global-accelerator-vs-cloudfront`, `aws-waf-and-shield`.
   **Techniques**: boundary, token, stream, side by side, toggle, restyle, caption.
   **Review**: Improved — the ALB/NLB contrast now includes the client IP (ALB terminates the connection, so targets see the ALB and rely on `X-Forwarded-For`), which sharpens the moment; cross-zone defaults (ALB on; NLB, GWLB off) added. Dropped the API Gateway misconception (never shown). ALB L7 with target groups, NLB static IP per AZ, GWLB GENEVE checked. Weighed a decision-tree framing; the same-traffic-three-ways contrast shows the layer difference directly.

### AWS WAF vs Shield, and Firewall Manager (`aws-waf-and-shield`)

**The aha**: WAF inspects each request against rules you write; Shield absorbs floods automatically — attach both at the edge so attacks are dropped before reaching a Region.
**Misconception to defeat**: Confusing WAF (layer 7, rule-based) with Shield (layer 3/4, automatic), or thinking either replaces security groups.
**Cast**: A CloudFront distribution at the edge with a WAF Web ACL (a stack of rule cards: managed rule group, rate-based rule, bot control), a Shield shell around the edge. Behind it the Region, with an ALB whose security group lets in only CloudFront.
**Opening frame**: Edge location, WAF rule stack, Shield shell, Region quiet behind. _"Two layers of defence, before anything reaches the Region."_
**Story**:

1. A SQL-injection-shaped request arrives; a managed rule-group card matches and blocks it before the cache or origin. _"WAF: inspects each request against rules you choose."_
2. One IP bursts past the rate-based rule's threshold; that card blocks only that IP while normal traffic flows. _"Rate-based rules catch abuse by volume."_
3. A volumetric flood of thousands of dots hits the edge; Shield Standard absorbs it automatically at layers 3 and 4, no rule authored, Region untouched. _"Shield: automatic L3/L4 absorption, nothing to write."_
4. A layer-7 flood escalates to Shield Advanced: a response-team icon, L7 mitigation working with WAF's rules, and cost protection for scaling charges. _"Shield Advanced adds L7 help, a response team and cost protection."_
5. Firewall Manager pushes the same Web ACL to every account in the Organization. _"Firewall Manager rolls it out org-wide."_
   **The moment**: Beat 3 — thousands of dots breaking against Shield with zero rules involved, right after WAF's rule-by-rule work.
   **Interaction**: Send a SQLi pattern, a single-IP burst, a volumetric flood, and see which layer stops each.
   **Ending**: Edge calm, WAF stack and Shield shell intact, Region untouched, the ALB's security group still admitting only the CDN.
   **Variants**: `aws-elb-alb-vs-nlb-vs-gwlb`, `aws-centralized-traffic-inspection`, `aws-organizations`.
   **Techniques**: boundary, token, restyle, failure, stream, clone, caption.
   **Review**: Improved — the "doesn't replace security groups" misconception had no beat, so the cast and ending now include the origin ALB's security group still doing its job. WAF L7 rules (managed, rate-based, bot), Shield Standard automatic L3/L4, Advanced's L7 help, response team and cost protection, and Firewall Manager checked. Weighed a bouncer-vs-crowd-barrier metaphor; the labelled attack shapes make the layer split concrete.
