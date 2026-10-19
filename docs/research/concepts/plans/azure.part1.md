# Azure plans, part 1

Stage 2 plans for `catalog/azure.md` groups 1 to 4, in catalog order: Resource organisation and
Azure Resource Manager, Governance, Identity (Microsoft Entra), Networking.

## Shared visual language

Every plan here draws Azure as Azure: real service icons and the real nouns (subscription,
resource group, VNet, NSG, Entra ID, managed identity...), not generic boxes. Conventions used
throughout, shared with the other Azure plan files:

- **Nesting** is nested frames, drawn to scale of trust, not geography: an Entra tenant frame
  holds management group frames, which hold subscription frames, which hold resource group
  frames, which hold resource icons; a region frame holds VNet frames, which hold subnet frames.
  Crossing a frame's edge is always drawn, never implied.
- **An identity** (user, group, service principal, managed identity, agent) is a small badge
  card: an icon, a name, a type tag ("user", "managed identity"...).
- **A role assignment** is a ribbon, in the identity's colour, pinned from the badge to a scope
  frame. If the assignment sits at a management group or subscription, the ribbon's colour seeps
  down into every frame nested inside it, fading slightly at each level — inheritance as
  something that visibly flows, not something to remember.
- **A policy** is a small rule card pinned to the top edge of a frame, carrying one line of its
  rule and an effect icon (deny ⛔, audit 👁, append/modify ✏️, deployIfNotExists 🛠). A resource
  being created inside the frame pauses at the pinned card and comes away stamped ✓ or ✗.
- **Requests and packets** travel as small dots (control-plane calls) or envelopes (data,
  tokens, packets) sliding along an arrow between frames, never teleporting.
- **"X vs Y" comparisons** send the same request or packet through both options side by side, in
  matching lanes, and freeze on the one beat where their paths diverge.
- **"Which service" choices** are a short question path (two or three forks); the answer chosen
  lights the path and lands on one service icon, the others dimming.
- A **lock** (resource lock, policy deny) is a padlock icon on a frame's edge. A **failure** is a
  red flash, then the element greying out, as elsewhere in the library.

## Resource organisation and Azure Resource Manager

### Resource hierarchy: tenant, management groups, subscriptions, resource groups (`azure-resource-hierarchy`)

**The aha**: Everything in Azure nests inside one tenant, and where a subscription or resource
group sits in that nesting decides what governs it — the hierarchy is a governance tree, not a
map of where things run.
**Misconception to defeat**: That a resource group is a network or physical boundary, or that it
can nest inside another resource group.
**Cast**: An outer frame "Contoso tenant". Inside, a root management group frame, branching into
"Corp" and "Online" (up to six nested levels drawn as thinner rectangles). Inside "Online", two
subscription frames, "Prod" and "Dev". Inside "Prod", resource group frames "rg-web" and
"rg-data", each holding resource icons (a VM, a storage account). A separate box off to the side,
"Billing account › Invoice section", joined to the tenant only by a dashed line, clearly apart.
**Opening frame**: The full nested tree, outlines only, labelled "tenant › management groups ›
subscriptions › resource groups › resources". _"Everything nests inside one tenant."_
**Story**:

1. Zoom into "rg-web" (location: West Europe): a VM and a storage account sit inside, each
   stamped with its own location, "East US". The VM talks to a database VM in "rg-data" across the
   group edge, no obstacle. _"Resources live in a resource group — but a group is no network
   wall, and not even a region."_
2. Drag "rg-data" inside "rg-web": it bounces off, red. _"Resource groups can't nest."_
3. The VM moves from "rg-web" to "rg-data": it keeps "East US" while the group says "West
   Europe". _"A resource keeps its own region — the group's location is just metadata."_
4. Pull back to show "Prod" and "Dev" side by side, each with its own quota meter and cost.
   _"Subscriptions are where quota, cost and access boundaries sit."_
5. Spotlight the billing box: the invoice is paid at a billing account, joined to subscriptions
   by a dashed link, never part of the management-group tree. _"Billing has its own hierarchy."_
   **The moment**: Beat 2, the refusal: resource groups are flat containers, never nested, which
   breaks the instinct to organise them like folders.
   **Interaction**: Drag any resource between resource groups and subscriptions; try to nest a
   resource group inside another and watch it bounce.
   **Ending**: The full tree again, each level labelled by what it controls: tenant (identity),
   management group and subscription (governance, billing), resource group (lifecycle).
   **Variants**: `azure-resource-manager`, `azure-rbac`, `azure-policy`, `azure-landing-zones`.
   **Techniques**: boundary, move, failure, spotlight, meter, caption.
   **Review**: Improved — "region" was drawn as a tag (it's a property, and the group's location is the metadata); beats 1 and 3 now put a West Europe group around an East US VM so the "not a physical boundary" misconception is defeated on screen, not only the nesting one, and a cross-group call shows groups aren't network walls. Billing wording corrected (billing account hierarchy is separate). Weighed a folder metaphor (tempting but is exactly the wrong model); kept the bounce as the moment.

### Azure Resource Manager (ARM), the control plane (`azure-resource-manager`)

**The aha**: Every tool — portal, CLI, Bicep, Terraform, an SDK — is just a client calling one
API, so every change to every resource passes the same checkpoint and gets recorded the same way.
**Misconception to defeat**: That the portal is "the real way" to manage Azure and the CLI or
Terraform are side doors; that ARM is the template file format.
**Cast**: Five client icons (Portal, CLI, PowerShell, Bicep, SDK), arrows converging on one box,
"management.azure.com — Azure Resource Manager". Inside: four stations in a row, Entra (badge
check), RBAC (role check), Policy (rule card), Locks (padlock). Beyond the box, a resource
provider icon "Microsoft.Storage" and the resource itself. An Activity Log scroll beneath.
**Opening frame**: Five clients, five arrows, one box. _"Five doors, one checkpoint."_
**Story**:

1. A CLI command "create storage account" sends a dot into ARM; it passes the Entra station,
   badge matches, ✓. _"First: who are you?"_
2. The dot reaches RBAC: a ribbon from the caller's badge covers this scope, ✓. _"Then: are you
   allowed?"_
3. The dot reaches Policy: a pinned rule card stamps it ✓. _"Then: does the request pass the
   rules?"_
4. The dot reaches Locks, no padlock here, ✓, and is handed to "Microsoft.Storage", which creates
   the account. _"Then: is anything locked?"_
5. A line writes itself onto the Activity Log: caller, time, action, result. _"Every change is
   recorded."_ (Reads aren't logged there.)
6. A Bicep file is compiled into a JSON template (the "ARM template", drawn as a parcel) and
   handed in as the request body; the dot traces the same path as the CLI's. _"The template is
   just the parcel. Different door, same checkpoint."_
   **The moment**: Beat 6, the side-by-side replay: two different tools' requests trace the exact
   same path through the same four stations.
   **Interaction**: Pick a client and watch its request trace the path; break one station (deny a
   role, add a lock) and see every tool's request get stopped there alike.
   **Ending**: The Activity Log scroll, now with several lines, each naming a different client and
   the same four checks.
   **Variants**: `azure-control-plane-vs-data-plane`, `azure-rbac`, `azure-policy`,
   `azure-resource-locks`.
   **Techniques**: token, path trace, restyle, side by side, caption.
   **Review**: Improved — fixed "every check is recorded" (the Activity Log records write operations, not reads and not each station's verdict); beat 6 now shows Bicep compiling to the ARM template and arriving as a parcel, which defeats the "ARM is the file format" misconception instead of just naming it. Station order (authenticate, authorise, Policy, lock) is shown as a convenient left-to-right reading, not a documented strict sequence. Weighed a "hotel front desk" metaphor; the five-doors-one-checkpoint picture is more concrete and uses the real nouns.

### Control plane vs data plane in Azure (`azure-control-plane-vs-data-plane`)

**The aha**: Managing a resource and using it go through two different front doors, authorised
separately, so owning a storage account doesn't automatically let you read what's inside it.
**Misconception to defeat**: "Owner can do everything"; that a resource lock protects the data
inside a resource.
**Cast**: A storage account with two doors: a top door "management.azure.com (control plane)" and
a side door "account.blob.core.windows.net (data plane)". A badge "Priya — Owner". A blob icon
inside.
**Opening frame**: Priya's badge outside, both doors shut. _"Two doors into the same resource."_
**Story**:

1. Priya calls "list keys" / "resize the account": the dot goes through the top door, RBAC checks
   Actions, ✓. _"Owner → control-plane Actions: allowed."_
2. Priya signs in with her own Entra identity and tries to read a blob through the side door:
   checked against DataActions instead, and Owner alone grants none — red flash, refused.
   _"Same role, different door, different list."_ (An inset notes that the account keys she can
   list at the top door would open it too: why hardened accounts turn shared-key access off.)
3. An admin adds "Storage Blob Data Reader" to Priya's badge: a new ribbon appears, and the same
   blob read now passes the side door. _"Data access needs its own role."_
4. A CanNotDelete lock is pinned to the account: a top-door delete bounces off it; a blob write
   through the side door sails through untouched. _"A lock guards the top door only."_
   **The moment**: Beat 2, the refusal: an Owner, with full control-plane power, bounces off the
   data-plane door for lack of one DataActions role.
   **Interaction**: Toggle roles on Priya's badge and watch which door opens; toggle the lock and see
   it block only the top door.
   **Ending**: Both doors open, each lit by the role that opened it.
   **Variants**: `azure-resource-manager`, `azure-rbac`, `azure-resource-locks`,
   `azure-managed-identity`.
   **Techniques**: token, restyle, failure, side by side, caption.
   **Review**: Improved — the original contradicted itself: beat 1 has Owner calling "list keys", yet an account key opens the data door, so "Owner can't read blobs" is only true for Entra-authenticated access. Beat 2 now says so and the inset names the shared-key backdoor (honest, and a real exam trap). Verified Actions vs DataActions, CanNotDelete not affecting blob writes. Weighed splitting into two doors of a bank (teller vs vault); the two-door storage account is already that and uses real endpoints.

## Governance

### Azure RBAC: role assignments, scopes and inheritance (`azure-rbac`)

**The aha**: A role assignment ties an identity to a role at a scope, and because scopes nest,
permission granted high up flows down to everything inside — additively, with no way to subtract
it except an explicit deny.
**Misconception to defeat**: That permissions can be taken away by excluding an action, or that
access is "whatever's left after the exceptions".
**Cast**: The nested frame tree from `azure-resource-hierarchy`. A badge "Sam". Ribbons in Sam's
colour. A role card "Contributor" listing Actions and NotActions.
**Opening frame**: Sam's badge outside the tree, no ribbons. _"No assignment, no access."_
**Story**:

1. A ribbon "Contributor" is pinned from Sam's badge to the "Online" subscription frame; its
   colour seeps into every resource-group frame and resource icon nested inside it. _"Assign
   once, it flows down."_
2. Sam opens a VM three levels down: a dot from his badge passes through, tinted in his ribbon's
   colour. _"Contributor here, because of a ribbon three levels up."_
3. Contributor's card shows Actions `*` and NotActions "Authorization/*/write". Sam tries to
   grant a colleague a role: refused. Then a second ribbon, "User Access Administrator", is
   pinned to one resource group: inside it, the same attempt succeeds. _"NotActions only trims
   its own role. Another assignment can still grant it."_
4. Inside that group Sam now holds both ribbons; his reach is the union of both, drawn as the two
   colours overlapping. _"Assignments add up. Nothing subtracts."_
5. A slashed "deny: delete" ribbon, stamped "created by a deployment stack" (users can't author
   deny assignments directly), is pinned at the group: delete is blocked for Sam even though
   Contributor still allows it. _"Only a deny assignment takes access away."_
   **The moment**: Beat 1, the colour seeping down through three nested frames from a single ribbon
   — inheritance made visible rather than asserted.
   **Interaction**: Drag a role ribbon to any scope and watch which resources light up; add a second
   ribbon and a deny ribbon and see how they combine.
   **Ending**: The tree with several ribbons pinned at different heights, each resource icon coloured
   by every ribbon reaching it.
   **Variants**: `azure-resource-hierarchy`, `azure-entra-roles-vs-azure-roles`, `azure-pim`,
   `azure-policy`.
   **Techniques**: restyle, boundary, move, spotlight, caption.
   **Review**: Improved — three slips fixed. "The more powerful one wins" was wrong (permissions are a union, not a contest). Beat 3 showed an unrelated success (deleting a VM) so NotActions-is-not-a-deny was named but never defeated; it now shows a second assignment re-granting the trimmed action. Deny assignments can't be authored by users (they come from deployment stacks/managed apps, formerly Blueprints), now stated. Kept the seeping-colour opening as the moment; weighed a Venn-diagram framing for additivity, folded into beat 4.

### Microsoft Entra roles vs Azure roles (`azure-entra-roles-vs-azure-roles`)

**The aha**: Entra roles govern the directory and Microsoft 365; Azure roles govern the resource
hierarchy — two separate systems, and the most powerful directory admin starts with zero access
to either.
**Misconception to defeat**: "An admin is an admin" — that Global Administrator implies control of
subscriptions.
**Cast**: Two towers side by side. Left, "Microsoft Entra ID" holding users, groups, app
registrations, with a badge "Global Administrator" wearing a crown. Right, the resource hierarchy
tree. A dashed bridge between them, "Elevate access", with a gate.
**Opening frame**: The crowned badge rules the Entra tower completely; the resource tree shows no
ribbon of his colour anywhere. _"Total power on one side, none on the other."_
**Story**:

1. The badge manages a user in the Entra tower: instant, no check needed beyond the crown. _"Entra
   roles act on the directory directly."_
2. The same badge tries to open a subscription in the resource tree: bounces, red — no role
   assignment exists there. _"Global Administrator grants nothing here."_
3. The badge crosses the dashed bridge, "Elevate access": a gate logs the action, then a "User
   Access Administrator" ribbon appears pinned at the root scope "/" (the line above the root
   management group), in a distinct audit-red colour. _"A deliberate, logged step."_
4. That ribbon seeps down the resource tree exactly as any other role ribbon would. _"Now it's an
   ordinary Azure role, inherited like any other."_
   **The moment**: Beat 2, the bounce: the most powerful identity in the directory has, by default,
   zero standing in the resource hierarchy.
   **Interaction**: Click "Elevate access" to watch the audited bridge crossing; remove the resulting
   ribbon to see the badge return to zero resource access.
   **Ending**: Two towers, one bridge crossed and logged, one ribbon now present on the resource side.
   **Variants**: `azure-rbac`, `azure-resource-hierarchy`, `azure-pim`.
   **Techniques**: boundary, restyle, failure, side by side, caption.
   **Review**: Improved — elevation grants User Access Administrator at root scope "/", not at the root management group; fixed. Also note on the bridge that the ribbon is meant to be removed afterwards (beat 4's interaction already shows this). Weighed "master key vs separate building keys" metaphor; two towers with a gated bridge shows the same and gives the audit trail a place. Other facts checked: Global Administrator manages the directory, zero Azure assignments by default.

### Azure Policy: definitions, initiatives, assignments and effects (`azure-policy`)

**The aha**: RBAC decides who may act; Policy decides what the result may look like, and its
effect chooses whether a bad request is blocked, flagged, silently fixed, or completed and patched
up afterwards.
**Misconception to defeat**: That Policy is another permissions system, or that it only reports
problems after the fact.
**Cast**: A resource group frame with four rule cards pinned to its top edge: "Require tag:
costCenter — deny", "Allowed SKUs — audit", "Add tag environment:prod — modify" (with a
managed-identity badge), "Require monitoring agent — deployIfNotExists" (managed-identity badge
too). A stream of request envelopes approaching.
**Opening frame**: Four rule cards pinned, frame empty. _"Rules pinned to a scope, each with its
own effect."_
**Story**:

1. A VM-create request with no `costCenter` tag reaches the deny card: stamped ✗, bounced out of
   the frame entirely. _"Deny: the request never lands."_
2. A VM using a disallowed SKU reaches the audit card: stamped ✓ but flagged amber, and lands
   anyway; a compliance dashboard ticks up one non-compliant resource. _"Audit: it lands, but it's
   marked."_
3. A VM-create request with no environment tag reaches the modify card: the tag is written onto
   the request before it lands, stamped ✓. _"Modify: fixed in flight."_ (Older "append" does the
   same for some properties; modify is the one to use for tags.)
4. A VM lands with no monitoring agent; some minutes later the deployIfNotExists card's managed
   identity reaches in and attaches one. _"DeployIfNotExists: fixed after the fact, by the
   policy's identity."_
5. A VM that existed before the cards were pinned sits in the frame, unstopped; a compliance scan
   sweeps over it and flags it amber. _"Policy also scans what was already there."_
6. Pull back: all four cards sit inside one initiative card, "Security baseline", assigned once to
   the resource group. _"Grouped into an initiative, assigned as one."_
   **The moment**: Beats 1–4 run against the same kind of request, each effect producing a visibly
   different outcome from an identical starting point.
   **Interaction**: Pick an effect for a new rule card and send a test request at it; watch where
   it's stopped, flagged, edited or patched.
   **Ending**: The compliance dashboard, ticks and flags matched to the cards that caused them.
   **Variants**: `azure-rbac`, `azure-resource-locks`, `azure-landing-zones`, `azure-managed-identity`.
   **Techniques**: token, restyle, boundary, spotlight, choice, caption.
   **Review**: Improved — "append" is the legacy effect; modify is what people use for tags and is what carries the managed identity story, so the card now says modify. deployIfNotExists runs after the resource is created (not instantly) and needs its identity to hold a role, now implied by the badge. Added the pre-existing-resource beat: the misconception "it only reports after the fact" has a twin, "it only checks new things", and the scan shows what Policy does to the old. Real evaluation order is modify/append, then deny, then audit; the beats are ordered by teaching clarity, which is acceptable. Weighed a bouncer-metaphor; the shared stamped-request picture is stronger.

### Resource locks (`azure-resource-locks`)

**The aha**: Locks stop control-plane writes or deletes for everyone, Owners included — but they
guard the front door only, so the data inside can still change freely.
**Misconception to defeat**: That a lock is data protection, or an attacker-proof defence.
**Cast**: A resource group frame with a padlock on its edge, tagged "ReadOnly". Inside, a storage
account with a blob. Two badges: "Owner — Alice" and the account's own data endpoint.
**Opening frame**: Padlock shut, Owner badge outside. _"Locked — even for the owner."_
**Story**:

1. Alice tries to delete the resource group: bounces off the padlock, red, despite her Owner
   ribbon. _"Locks beat RBAC, not the other way round."_
2. Alice tries something innocent-looking, "list storage keys": it's actually a control-plane
   POST, and it bounces too. _"ReadOnly blocks more than it looks like it would."_
3. An app writes a new blob into the storage account through the data-plane door: sails straight
   through, untouched by the padlock. _"The data inside keeps changing."_
4. A CanNotDelete lock replaces the ReadOnly one: Alice can now resize the storage account but
   still can't delete it. _"Two lock types, two different restrictions."_
5. An attacker holding a stolen Owner token: the padlock stops the delete, but Owner may remove
   locks. The padlock pops off, then the delete lands. Meanwhile a second stolen credential with a
   data role encrypts the blob through the side door, lock untouched. _"Locks stop mistakes, not
   attackers."_
   **The moment**: Beat 3 against beat 1: the same locked resource group has its control-plane door
   bolted shut while its data keeps moving through the side door, unaffected.
   **Interaction**: Switch the lock type (None / CanNotDelete / ReadOnly) and try deleting, resizing
   and writing data; see which succeed.
   **Ending**: Padlock shut on the front door, data door swinging freely beside it.
   **Variants**: `azure-control-plane-vs-data-plane`, `azure-rbac`, `azure-policy`,
   `azure-resource-hierarchy`.
   **Techniques**: restyle, failure, boundary, toggle, caption.
   **Review**: Improved — beat 4 resized a VM that isn't in the cast (now the storage account). Beat 5's ransomware actor never faced the lock's real weakness: anyone with lock-management rights (Owner, User Access Administrator) can simply delete the lock, so the beat now shows that, plus the data-door bypass. Verified: ReadOnly blocks listKeys (a POST), CanNotDelete allows modify, locks apply to all roles. Weighed "seatbelt vs vault" framing; the padlock on the front door only already says it.

### Azure landing zones: platform and workload (`azure-landing-zones`)

**The aha**: Governance is built once into the management-group tree, so a new subscription
dropped into the right branch is born already wired for networking, logging, security and policy.
**Misconception to defeat**: That "landing zone" means a single subscription, or that it's just
the hub network.
**Cast**: A management-group tree: root, then "Platform" (branching to Connectivity, Identity,
Management, Security subscriptions) and "Landing zones" (branching to Corp, Online, each able to
hold many workload subscriptions), plus Sandbox and Decommissioned off to one side. A rule card and
a ribbon pinned high on "Landing zones", seeping down. An empty subscription slot on a conveyor
belt feeding into "Online".
**Opening frame**: The platform branch fully built; the landing-zone branch holds one workload
subscription, already coloured by the inherited ribbon and carrying the inherited policy cards.
_"The platform is built once..."_
**Story**:

1. A fresh, empty subscription appears on the conveyor belt, unconnected to anything. _"...a new
   subscription starts with nothing."_
2. It's dropped ("vended") into the "Corp" branch: it instantly picks up the policy cards and
   RBAC ribbon pinned above, and a line extends from it to the hub in "Connectivity". _"Land it in
   the right branch, and governance, logging and networking arrive with it."_
3. A team starts deploying resources inside it immediately: each one is already checked by the
   inherited policy cards. _"No one had to configure this subscription."_
4. A third subscription is vended into "Online": it gets the same policy cards but no line to the
   hub (internet-facing apps, own network). Another goes into "Sandbox": no policy cards, no hub.
   _"Different branch, different rules: Corp is wired in, Online is exposed, Sandbox is free."_
   **The moment**: Beat 2, the instant a bare subscription gains policy cards, a ribbon and a hub
   connection the moment it's placed in the tree, with no per-subscription setup.
   **Interaction**: Drag a new subscription into different branches (Corp, Online, Sandbox) and see
   what it inherits in each.
   **Ending**: Several workload subscriptions under "Landing zones", all sharing the platform
   branch's governance; Sandbox, visibly bare, beside them.
   **Variants**: `azure-resource-hierarchy`, `azure-rbac`, `azure-policy`, `azure-hub-spoke`,
   `azure-caf-vs-waf`.
   **Techniques**: boundary, move, restyle, spotlight, caption.
   **Review**: Improved — the plan vended into "Online" and drew a hub link, but in the reference architecture the private hub connection belongs to Corp; Online (internet-facing) deliberately has none by default. Beat 2 now uses Corp, and beat 4 contrasts Online and Sandbox so the interaction teaches that each branch carries different inherited rules. Verified: Platform holds Connectivity, Identity, Management and Security subscriptions; Sandbox and Decommissioned sit beside Landing zones. Weighed a "city zoning" metaphor; the conveyor-belt vending shows the same and matches how teams actually receive subscriptions.

### Cloud Adoption Framework vs Well-Architected Framework (`azure-caf-vs-waf`)

**The aha**: CAF builds and runs the estate a workload lands in; WAF reviews each workload once
it's there — one guidance framework operates at the organisation's altitude, the other at a single
workload's.
**Misconception to defeat**: Treating the two as competitors, or WAF's pillars as the whole of
CAF.
**Cast**: Two altitudes on one vertical axis. High up, "CAF": a path of stages, Strategy → Plan →
Ready → Adopt, with Govern, Secure, Manage running alongside, feeding the management-group tree.
Low down, at one workload (a resource group with an app inside), "WAF": five pillar icons in a
ring — Reliability, Security, Cost, Operational Excellence, Performance.
**Opening frame**: The CAF path above, one small workload frame below, unconnected. _"Two
frameworks, two altitudes."_
**Story**:

1. The CAF path runs: each stage lights in turn, and the management-group tree grows a branch as
   "Ready" completes. _"CAF: build and run the estate."_
2. A new workload subscription drops out of the tree into the workload frame below. _"A workload
   lands in what CAF built."_
3. The five WAF pillar icons sweep around the workload frame one at a time, each leaving a score
   (Reliability 72, Cost 54...). _"WAF: review this one workload, pillar by pillar."_
4. The Cost pillar's low score produces a recommendation card, which is applied; the score rises.
   _"Act on the review, workload by workload."_
5. A second workload drops in beside the first and gets its own, different pillar scores. _"Every
   workload gets its own WAF review inside the one CAF estate."_
   **The moment**: Beat 2, a workload literally dropping out of the CAF tree into the place where
   WAF's five-pillar review happens — showing one feeds the other rather than competing with it.
   **Interaction**: Step through the CAF stages; then run the WAF review on a chosen workload and see
   its five scores.
   **Ending**: The CAF tree above, several scored workloads below it.
   **Variants**: `azure-landing-zones`, `azure-resource-hierarchy`; fundamentals' architecture-centre
   reference material.
   **Techniques**: lanes, meter, move, spotlight, caption.
   **Review**: Keep — checked CAF's stages (Strategy, Plan, Ready, Adopt, plus Govern, Secure, Manage) and WAF's five pillars (Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency); the workload dropping out of the tree is the moment. Weighed a "city planner vs building inspector" metaphor: same altitude split, but the two-altitude diagram already uses the real management-group tree and avoids a second picture. Only note for production: spell out both acronyms in the opening captions.

## Identity (Microsoft Entra)

### Microsoft Entra ID and the tenant (`azure-entra-id`)

**The aha**: A tenant is the identity boundary that issues and checks tokens — subscriptions
trust exactly one tenant, but the tenant itself holds no resources.
**Misconception to defeat**: That a tenant is a domain controller (LDAP/Kerberos/Group Policy), or
that it's the same thing as a subscription.
**Cast**: A tenant frame "Contoso" holding user badges, group icons, app-registration cards,
device icons. Outside it, three subscription frames each with a dashed "trusts" arrow pointing
into the tenant. A separate small box "Entra Domain Services" off to one side, clearly a
different, optional thing. A token envelope.
**Opening frame**: The tenant frame full of identities; three subscriptions pointing trust arrows
into it. _"One identity store, trusted by many subscriptions."_
**Story**:

1. A user badge inside the tenant signs in: an OAuth token envelope is stamped and handed out.
   _"The tenant issues tokens..."_
2. The envelope travels to a subscription's resource, which checks the stamp and lets the user
   in. _"...and every subscription that trusts this tenant checks them the same way."_
3. A fourth subscription frame appears with a trust arrow into a different tenant entirely:
   identical shape, no connection to Contoso's identities. _"A subscription trusts exactly one
   tenant."_
4. Someone tries an LDAP bind and a Kerberos ticket request straight at the tenant frame: both
   bounce, red. _"It's not a domain controller."_
5. The separate "Entra Domain Services" box lights up and successfully answers the same LDAP
   bind. _"That's a different, optional service for legacy apps."_
   **The moment**: Beat 4, the bounce: the natural assumption that cloud identity means LDAP and
   Kerberos meets a flat refusal, right next to the service that actually does offer them.
   **Interaction**: Point different protocol requests (OAuth, LDAP, Kerberos) at the tenant and at
   Entra Domain Services and see which answers.
   **Ending**: The tenant frame with its trust arrows, Entra Domain Services sitting clearly apart.
   **Variants**: `azure-hybrid-identity`, `azure-resource-hierarchy`,
   `azure-app-registration-vs-enterprise-app`.
   **Techniques**: boundary, token, failure, side by side, caption.
   **Review**: Keep — checked: a subscription trusts exactly one tenant, Entra ID speaks OAuth/OIDC/SAML but not LDAP bind or Kerberos for your apps, and Entra Domain Services is the separate managed domain that answers LDAP. The LDAP/Kerberos bounce next to Domain Services is the sharpest contrast available; weighed a "passport office vs border post" metaphor, which is neat but adds a second picture to a plan that already has the real nouns. Misconception (tenant = subscription) is defeated by beat 3's second tenant.

### Hybrid identity: Entra Connect, password hash sync, pass-through auth, federation (`azure-hybrid-identity`)

**The aha**: Synchronization decides who exists in the cloud; the authentication method decides
where the password is actually checked — and they're independent choices.
**Misconception to defeat**: Treating "hybrid identity" as one setting, or assuming sign-in always
happens on-premises.
**Cast**: Left, an on-premises AD DS box with user accounts. Centre, "Entra Connect Sync" as a
conveyor carrying badge copies into the Entra tenant on the right. Below the conveyor, three
switchable sign-in paths: "Password hash sync" (a hashed copy stored in the tenant),
"Pass-through auth" (an arrow reaching back on-premises), "Federation" (a redirect to an
on-premises AD FS box).
**Opening frame**: AD DS on the left, empty tenant on the right, conveyor idle. _"Two separate
jobs: copy identities, then check passwords."_
**Story**:

1. The conveyor runs: user badges clone from AD DS into the tenant. _"Sync creates the badge in
   the cloud."_
2. Sign-in path set to "Password hash sync": a login checks against a hash already inside the
   tenant — succeeds even when the on-premises box is powered off. _"Hash sync: checked entirely
   in the cloud, even if on-premises is down."_
3. Switch to "Pass-through auth": the same login sends a check back on-premises through a small
   agent; power off AD DS, and the login now bounces, red. _"Pass-through: checked on-premises, in
   real time."_
4. Switch to "Federation": the login redirects entirely to AD FS, which answers; power off AD FS,
   same bounce. _"Federation: on-premises again, through a different door."_
5. Power AD DS and AD FS back on: pass-through and federation succeed again, while hash sync
   never cared either way. _"Hash sync is the one that survives on-premises being down."_
   (Also shown: hash sync can be switched on alongside the other two as a standby.)
   **The moment**: Beat 3, powering off the on-premises box and watching only the methods that depend
   on it fail — hash sync keeps working.
   **Interaction**: Choose the sign-in method, then toggle the on-premises box on and off, and watch
   which logins succeed.
   **Ending**: All three methods shown side by side with the on-premises box off, hash sync alone
   still green.
   **Variants**: `azure-entra-id`, `azure-conditional-access`.
   **Techniques**: clone, stream, toggle, failure, side by side, caption.
   **Review**: Improved — beat 5 powered AD DS back on but not AD FS, which beat 4 had switched off, so federation would still have failed; fixed. Added the practical point that hash sync can run beside the others as a standby (it's the Microsoft-recommended default). Verified: sync copies objects; PHS validates a hash-of-hash in the cloud; PTA validates on-premises through agents; federation redirects to AD FS. Weighed a "three doors" static comparison table; the power-off toggle makes the difference felt, so kept.

### App registrations vs enterprise apps (service principals), permissions and consent (`azure-app-registration-vs-enterprise-app`)

**The aha**: The registration is the blueprint, made once in its home tenant; the service
principal is the local copy that actually signs in and holds rights, one per tenant that uses the
app.
**Misconception to defeat**: Treating "the app" as a single object, or confusing API permissions
with Azure RBAC roles.
**Cast**: Tenant A holds an app-registration card "Expense App" (client ID, redirect URI,
requested permissions: Mail.Read). Tenant B and Tenant C each hold a service-principal badge for
the same app, created on first consent, each with its own role assignments and consent record.
**Opening frame**: One registration card in Tenant A; Tenants B and C empty. _"One blueprint, so
far nowhere installed."_
**Story**:

1. An admin in Tenant B clicks "consent": a service-principal badge clones into Tenant B,
   carrying the registration's requested permission. _"Consent creates the local copy."_
2. The service-principal badge now shows two separate lists: "API permissions (what it may
   call): Mail.Read" and "Azure roles (what it may do in Azure)". A ribbon "Reader" is pinned from
   it to a resource group, local to Tenant B. _"Rights are assigned to the local copy, not the
   blueprint. Permissions and roles are different lists."_
3. Tenant C repeats consent independently: its own badge, its own, different role ribbon. _"Same
   app, two tenants, two separate standings."_
4. Back in Tenant A, the registration adds a new requested permission, "Mail.Send": the service
   principals in B and C don't gain it. A greyed "requested, not granted" line appears until each
   tenant's admin consents separately. _"The blueprint changes; each installation must catch up on
   its own."_
5. A delegated-permission token (acting as a signed-in user) and an application-permission token
   (acting as the app alone, needing admin consent) are sent side by side: one carries the user's
   badge colour, the other the app's own. _"Delegated acts as you; application acts as itself."_
   **The moment**: Beat 3, the same registration producing two independent service principals with
   two independent sets of rights — "the app" is not one object.
   **Interaction**: Consent the same registration into a new tenant and watch a fresh service
   principal appear; assign it a role local to that tenant only.
   **Ending**: One registration card, three service-principal badges fanned out beneath it, each with
   its own ribbons.
   **Variants**: `azure-managed-identity`, `azure-workload-identity-federation`, `azure-entra-id`.
   **Techniques**: clone, restyle, boundary, side by side, caption.
   **Review**: Improved — "re-consent needed" flag isn't how Entra behaves (a new requested permission simply isn't granted until consent), reworded. The misconception "API permissions vs Azure RBAC roles" was named but never shown; beat 2 now puts the two lists on the same badge. Verified: the home tenant also holds a service principal for its own app; delegated vs application permissions (application ones need admin consent). Weighed a "franchise" metaphor; blueprint/copy is already that, with the real names.

### Managed identities: system-assigned vs user-assigned (`azure-managed-identity`)

**The aha**: The resource itself becomes the credential — give it a role and the secret
disappears from code, config and pipelines, because there's no secret to leak in the first place.
**Misconception to defeat**: That a managed identity is a password the app stores, just hidden
better.
**Cast**: A VM icon with a small badge attached to its side, no visible secret anywhere. A local
endpoint on the VM, "169.254.169.254". A target resource, a Key Vault, with a role ribbon. Beside
it for contrast, a second VM holding a visible secret card "client_secret: ••••••" in its config.
**Opening frame**: Two VMs side by side: one with a secret card glowing in its config, one with
only a badge attached, config empty. _"Same job, two ways to prove who you are."_
**Story**:

1. The secret-VM's app reads the secret card and sends it to Entra to get a token. A thief figure
   lifts the same card straight out of the config file. _"A stored secret can be copied."_
2. The managed-identity VM's app instead calls its own local endpoint: no file is read, a
   short-lived token comes straight back. _"The resource asks for itself. No long-lived secret to
   copy."_ (A small note: code running on the VM can still ask, so keep the role narrow.)
3. A ribbon "Key Vault Secrets User" is pinned from the badge to the Key Vault; the VM's token is
   now accepted there. _"Give the identity a role, like any other identity."_
4. The VM is deleted: its badge and its role ribbons vanish with it. A new VM, with system-assigned
   identity switched on, gets a fresh badge with no ribbons. _"System-assigned: lives and dies
   with one resource."_
5. A separate badge, drawn as its own resource, is attached to two different VMs at once, and
   survives when one VM is deleted. _"User-assigned: its own resource, shareable, can exist
   first."_
   **The moment**: Beat 1 against beat 2: the thief's hand closing on the secret card next to the
   identity-VM's empty config — one has something to steal, the other doesn't.
   **Interaction**: Delete the VM under each identity type and see whether the badge survives; attach
   a user-assigned badge to a second VM.
   **Ending**: Both VMs reaching the Key Vault successfully, only one of them via a readable secret.
   **Variants**: `azure-app-registration-vs-enterprise-app`, `azure-workload-identity-federation`,
   `azure-rbac`.
   **Techniques**: restyle, token, failure, side by side, clone, caption.
   **Review**: Improved — "nothing to copy" overclaimed (code on the VM can request tokens, though they're short-lived and not portable), now stated honestly without weakening the moment. Beat 4 said a new VM gets a badge "automatically", which only happens if the setting is on, and the new identity has no role assignments; both fixed, which also teaches why user-assigned identities are handy. Verified: local endpoint 169.254.169.254, role "Key Vault Secrets User". Weighed a "badge vs password sticky note" metaphor; the thief beat already does it.

### Workload identity federation (`azure-workload-identity-federation`)

**The aha**: Entra can trust tokens from an outside system for one exact subject, so a workflow
outside Azure gets access with nothing stored to leak or rotate.
**Misconception to defeat**: That this is just another kind of secret, or the same thing as a
managed identity (which only works for things running inside Azure).
**Cast**: Outside Azure, a GitHub Actions run badge "repo: contoso/app, environment: prod". Inside
Azure, an app registration with a federated-credential card: "trust tokens from
token.actions.githubusercontent.com, subject = repo:contoso/app:environment:prod". An arrow from
the run badge to Entra, then from Entra to the target resource.
**Opening frame**: The GitHub run on the left, the federated-credential card pinned to the app
registration on the right, no secret visible anywhere between them. _"A trust statement, not a
stored secret."_
**Story**:

1. The GitHub run requests its own short-lived OIDC token, stamped with its exact subject.
   _"GitHub issues its own token first."_
2. The token envelope travels to Entra; Entra checks it against the federated-credential card's
   exact subject string — match, ✓ — and swaps it for an Entra access token. _"Entra trusts it,
   for this one subject only."_
3. A run from a different environment, "staging", sends its token: the subject doesn't match the
   card, red bounce. (Issuer, subject and audience must all match; the card ticks off each.)
   _"Trust is scoped to one exact subject, not the whole repo."_
4. The exchanged Entra token reaches the target resource via a role ribbon, same as any identity.
   _"From there on, it's an ordinary role assignment."_
5. Contrast inset: a client-secret app registration beside it, its secret card sitting in a GitHub
   repo setting, a thief's hand reaching for it. _"The alternative has something to steal; this
   doesn't."_
   **The moment**: Beat 3, the mismatch bounce: trust is pinned to one exact subject string, not
   "anything from GitHub".
   **Interaction**: Edit the subject string on the federated-credential card and watch which workflow
   runs pass or fail the swap.
   **Ending**: The GitHub run reaching the target resource, no secret anywhere on the path.
   **Variants**: `azure-managed-identity`, `azure-app-registration-vs-enterprise-app`.
   **Techniques**: token, exchange, failure, side by side, spotlight, caption.
   **Review**: Improved — added that the check is issuer, subject and audience, not subject alone (a student otherwise thinks any token with the right subject text works). Checked: issuer token.actions.githubusercontent.com, subject format repo:org/repo:environment:name, federated credentials live on app registrations or user-assigned managed identities, and the exchange yields a short-lived Entra token. The misconception "same as managed identity" is covered by the cast (outside Azure). Weighed a "passport and visa" framing; the mismatch bounce is more concrete.

### Conditional Access (`azure-conditional-access`)

**The aha**: Every sign-in is judged in context after the password, by every matching policy at
once, and any one block wins — that's Zero Trust enforced in front of every app.
**Misconception to defeat**: That MFA alone is Conditional Access, or that it's a network
firewall.
**Cast**: A sign-in gate with a password check already passed. Beyond it, a row of policy cards,
each with an assignment (who/what app) and conditions (location, device, risk) leading to a
verdict: Block, or Grant + requirement (MFA, compliant device). A badge "Dana" signing in from two
different contexts: office laptop, and an unfamiliar country on a personal phone.
**Opening frame**: Dana's badge past the password gate, approaching a row of silent policy cards.
_"Password checked. Now: context."_
**Story**:

1. Dana signs in from the office laptop: each policy card lights and evaluates — all say Grant,
   one adding "require MFA". Dana completes MFA and gets through. _"Every matching policy applies
   together."_
2. Dana signs in from the unfamiliar country, personal phone: the risk-based policy lights red,
   "Block". Even though the device-compliance policy would have granted access, the block wins.
   _"Any block wins, no matter what else would allow it."_
3. An admin builds a new, stricter policy and sets it to "Report-only": sign-ins pass through
   unaffected, but each is logged as "would have blocked". _"Test in context, before it bites."_
4. Admin flips it live: the next matching sign-in is blocked for real. _"Now it's enforced."_
   **The moment**: Beat 2, one red card among several green ones — and the whole sign-in still fails,
   showing "any block wins" rather than a majority vote.
   **Interaction**: Change Dana's context (location, device, risk) and watch which policy cards light
   and what the combined verdict is; toggle report-only.
   **Ending**: A log line for every attempt, verdict and the policy that decided it.
   **Variants**: `azure-pim`, `azure-hybrid-identity`, security's zero-trust and MFA concepts.
   **Techniques**: token, restyle, spotlight, toggle, side by side, caption.
   **Review**: Keep — verified: policies run after first-factor sign-in, all matching policies apply, any Block wins over any Grant, grants can require MFA, compliant device or authentication strength, report-only logs "would have". The one red card among green is the sharpest way to show "block beats majority". Weighed a "airport checkpoints in series" metaphor, but that suggests sequential gates, whereas Conditional Access evaluates everything at once, so the row of cards lighting together is more accurate. Misconceptions (MFA alone, network firewall) are answered by the cards listing device and risk.

### Privileged Identity Management (PIM) (`azure-pim`)

**The aha**: PIM turns standing admin rights into short, audited activations, so a stolen account
usually holds no privilege at all until someone deliberately switches it on.
**Misconception to defeat**: Confusing PIM with Conditional Access, or assuming an "eligible" role
already works.
**Cast**: A badge "Omar" with a role card "Global Administrator" attached by a dashed, grey ribbon
labelled "Eligible". A clock, an "Activate" button, MFA and justification prompts, and an approval
queue.
**Opening frame**: Omar's badge, dashed grey ribbon, role powerless. _"Eligible — not active."_
**Story**:

1. Omar tries to use the admin role directly: it bounces, the dashed ribbon doesn't grant
   anything. _"Eligible means nothing on its own."_
2. Omar clicks Activate: MFA, then a justification box, then (for a higher-risk role) a request
   sits in an approval queue until someone approves it. _"Activation is deliberate and checked."_
3. The ribbon turns solid for a visible countdown, "expires in 8 hours". Omar now passes the same
   action that bounced in beat 1. _"Now it's real — and timed."_
4. The timer runs out; the ribbon reverts to dashed grey automatically, no action needed. _"It
   switches itself back off."_
5. Meanwhile, a stolen-password figure grabs Omar's badge before activation: the admin action
   bounces, and clicking Activate stops at the MFA prompt it can't answer. _"A compromised
   account, caught with no standing privilege."_
6. An access review card appears months later, asking "does Omar still need this eligible role?"
   — a "no" removes the dashed ribbon entirely. _"Recertified periodically, not assumed forever."_
   **The moment**: Beat 5, the thief's hand on a badge that, eligible or not, currently holds nothing
   — the whole point of just-in-time access.
   **Interaction**: Activate the role and watch the timer and solid ribbon; let it expire; try the
   stolen-badge scenario before and after activation.
   **Ending**: The dashed grey ribbon, resting state, countdown gone.
   **Variants**: `azure-conditional-access`, `azure-rbac`, `azure-entra-roles-vs-azure-roles`.
   **Techniques**: restyle, timer, failure, exchange, caption.
   **Review**: Improved — beat 5 only showed the thief bouncing off the admin action; a real attacker would try Activate, so the beat now ends at the MFA prompt, which is what makes "usually holds no privilege" true (and ties PIM to Conditional Access without confusing them). Checked: activation windows are configurable (the 8 hours shown is a typical default), approval is per-role setting, access reviews recertify eligibility, PIM covers Entra roles, Azure roles and groups. Weighed a "safe-deposit box with a key from the manager" metaphor; the dashed-to-solid ribbon with a timer is more direct.

### External identities: B2B collaboration vs External ID for customers (`azure-external-identities`)

**The aha**: Partners become guests inside your own tenant; customers live in a separate,
purpose-built tenant — mixing the two means staff and customers end up in the same directory.
**Misconception to defeat**: Treating any outside sign-in as the same kind of "external identity".
**Cast**: Left, the workforce tenant "Contoso" with staff badges and, newly added, a guest badge
"Priya @ Fabrikam" tagged "B2B guest", governed by a cross-tenant settings card. Right, a separate
tenant "Contoso Customers" built for External ID, holding thousands of small customer badges with
a sign-up form and social-login icons at its door.
**Opening frame**: Contoso's staff tenant on the left, an empty customer tenant on the right. _"Two
different outside doors."_
**Story**:

1. Priya from Fabrikam is invited: her badge clones into Contoso, tagged "guest", signing in with
   her own Fabrikam credentials. _"B2B: a partner, inside your staff directory."_
2. Priya is added to a project group and picks up a role ribbon there, same as any staff badge.
   _"A guest is governed exactly like your own staff."_
3. The cross-tenant access settings card is tightened: Fabrikam guests now need MFA claimed from
   their home tenant. _"You control the terms of that trust."_
4. On the right, a customer visits the sign-up form, picks "Sign in with Google", and a new badge
   appears in the customer tenant, separate from Contoso entirely. _"External ID: a different
   tenant, built for millions of these."_
5. Someone tries to invite a customer as a B2B guest into the staff tenant by mistake: the badge
   lands among staff, red flag "customer in workforce directory". _"Mixing them is the actual
   danger."_
   **The moment**: Beat 5, the misplaced badge: a customer sitting inside the staff tenant makes the
   risk of choosing wrong concrete.
   **Interaction**: Route a new sign-in through either door and see which tenant it lands in; tighten
   the cross-tenant settings and watch Priya's access change.
   **Ending**: Two tenants, clearly separate, each holding the population it was built for.
   **Variants**: `azure-entra-id`, `azure-rbac`.
   **Techniques**: clone, restyle, boundary, side by side, failure, caption.
   **Review**: Keep — checked: B2B guests sign in with their home credentials, cross-tenant access settings can trust the partner's MFA claim, External ID uses a separate external tenant with self-service sign-up and social logins, and it replaces Azure AD B2C (closed to new customers since May 2025). The misplaced customer badge is the memorable failure (the red flag is a teaching label, not a product alert). Weighed a "guest list vs public box office" metaphor; the two tenants side by side already carry it. Beat 2's guest still has limited default directory rights; mention in narration if space.

### Microsoft Entra Agent ID (`azure-entra-agent-id`)

**The aha**: Agents get their own first-class, governable identities instead of borrowed user
accounts or shared app secrets, so a whole fleet created from one blueprint can be seen and
restricted at once.
**Misconception to defeat**: That an AI agent runs "as" the user who built it, or holds a normal
app's client secret.
**Cast**: An "agent identity blueprint" card holding credentials. Beneath it, several small agent
badges spawned from it, each marked "no credentials of its own", grouped inside a dashed ring
labelled "governed as one group". Conditional Access and ID Protection icons pointed at the ring.
For contrast, a lone badge "Dana's account", borrowed by a script.
**Opening frame**: The blueprint card, ring empty. _"A blueprint, before any agent exists."_
**Story**:

1. A Foundry agent is created: a badge spawns from the blueprint into the ring, carrying no secret
   of its own. _"Agents get identities drawn from the blueprint, automatically."_
2. Three more agents spawn the same way, all inside the same ring. _"A whole fleet, from one
   source."_
3. Conditional Access targets the ring as a single group: one policy, "require compliant
   network", restyles every badge inside it at once. _"Governed together, not one by one."_
4. ID Protection flags one agent's badge as risky (unusual call pattern): that one badge alone is
   blocked, the ring's dashed boundary making clear the others are untouched. _"Individually
   targetable too."_
5. Contrast inset: the borrowed-account script runs "as Dana", so blocking the script means
   blocking Dana, and Dana's audit log fills with the agent's actions. _"The old way blurs agent
   and human."_
   **The moment**: Beat 3 against the inset: one policy reaching every agent in the ring at once,
   versus the borrowed-account script that drags a real person's identity down with it.
   **Interaction**: Spawn agents from the blueprint, apply a Conditional Access policy to the ring,
   and flag one agent as risky to see it isolated from the rest.
   **Ending**: The ring of agent badges, each independently visible, blueprint still at the centre.
   **Variants**: `azure-managed-identity`, `azure-app-registration-vs-enterprise-app`,
   `azure-conditional-access`.
   **Techniques**: clone, boundary, restyle, spotlight, caption.
   **Review**: Keep — checked against the catalog: a blueprint holds credentials, agent identities are special service principals with none of their own, and Conditional Access and ID Protection can target them as a group; Foundry and Copilot Studio agents get them automatically. Both misconceptions are defeated (the inset shows the borrowed-account script dragging Dana in; the badges show no secret). Weighed a "fleet of company cars from one registration" metaphor; the ring-and-blueprint picture is the same idea with the real nouns. Tier 3 and the product is new, so keep the labels generic enough to survive renames.

## Networking

### Virtual networks and subnets (`azure-vnet-subnets`)

**The aha**: A VNet is a software-defined routing and isolation boundary that spans the whole
region, not a stretch of cable — Azure's router handles every hop, and new VNets start with no
implicit path to the internet.
**Misconception to defeat**: Treating a VNet like an on-premises VLAN, or expecting one subnet per
availability zone the way AWS works.
**Cast**: A region frame "East US" holding a VNet frame "10.0.0.0/16", split into subnet frames
"web (10.0.1.0/24)" and "data (10.0.2.0/24)". Each subnet frame spans the full height of the VNet
frame, crossing all three zone markers drawn faintly in the background. Five reserved-address
ticks at the start of each subnet.
**Opening frame**: The VNet frame, two subnets inside, zone markers faint in the background
crossing both. _"Subnets span every zone in the region."_
**Story**:

1. A VM is placed in "web", zone 2; another in "web", zone 3. Both sit in the same subnet frame.
   _"Not one subnet per zone."_
2. An envelope travels from a VM in "web" to one in "data" with no extra hop drawn: it just
   arrives. _"Azure's own router moves it — by default, every subnet can already reach every
   other."_
3. Five address ticks grey out at the start of "data" (network, gateway, two DNS reservations,
   broadcast). _"Azure reserves five addresses per subnet."_
4. A new subnet is created in a fresh VNet: an envelope tries to leave for the internet and
   bounces at the subnet's edge, red. _"New subnets are private by default: no implicit outbound
   path."_ (Subnets that already existed keep their old implicit access.)
5. Try broadcasting from one VM: nothing ripples across the subnet the way it would on a LAN. _"No
   cabling, no broadcast — it's all routing."_
   **The moment**: Beat 4, the bounce: the instinctive "of course it can reach the internet" meets
   Azure's current default of a private subnet.
   **Interaction**: Place VMs in different zones within one subnet; try to broadcast; try reaching
   the internet from a fresh VNet.
   **Ending**: The VNet frame, zone markers visible crossing both subnets, outbound path still closed
   until deliberately opened.
   **Variants**: `azure-nsg`, `azure-user-defined-routes`, `azure-vnet-peering`,
   `azure-outbound-connectivity`.
   **Techniques**: boundary, token, failure, spotlight, caption.
   **Review**: Improved — "new VNets" is imprecise: the retirement of default outbound access makes new subnets private (setting applied per subnet; existing ones unchanged), so beat 4 now says subnets and names the exception. Verified the five reserved addresses (network, default gateway, two for Azure DNS, broadcast), subnets spanning all zones, no broadcast or multicast, default reachability between subnets. Weighed an AWS contrast overlay (one subnet per AZ); the zone markers crossing both subnets show the difference without needing AWS knowledge.

### Network security groups and application security groups (`azure-nsg`)

**The aha**: An NSG isn't a box traffic passes through — it's a filter attached at every subnet
and every NIC, and a flow must clear both layers, in both directions, to get through.
**Misconception to defeat**: Picturing an NSG as a single firewall appliance sitting in the path;
assuming AWS-style "security groups are allow-only, NACLs are the layered part".
**Cast**: A subnet frame with an NSG card pinned to its edge (rule list by priority). Inside, a VM
with its own NIC, a second NSG card pinned to the NIC. An envelope arriving from outside the
subnet. Two ASG tags, "web" and "db", stuck on groups of VMs instead of IP lists.
**Opening frame**: Subnet NSG card and NIC NSG card both visible, envelope outside. _"Two filters,
not one box."_
**Story**:

1. An inbound envelope from the internet reaches the subnet NSG first: rules are read lowest
   number first, and "100 Allow 443" matches, ✓. _"First gate: the subnet."_
2. At the NIC NSG, which holds only the built-in rules, nothing allows internet traffic; the
   default "65500 DenyAllInbound" matches and the envelope is stopped, red, even though the
   subnet allowed it. A "100 Allow 443" rule is added at the NIC and the next envelope passes.
   _"Both gates must say yes. Lowest number is read first."_
3. The reply to that request flows back with no rule written for it. _"Stateful: replies are
   allowed automatically."_ A new connection from this VM to a database VM in another subnet
   clears four gates in order: its NIC and subnet outbound rules, then the destination subnet and
   NIC inbound rules. _"Outbound is the same gates, reversed, each evaluated separately."_
4. A rule written as "ASG:web → ASG:db, port 1433" is shown next to the alternative, a rule that
   would have listed raw IPs — when a new VM joins ASG:web, the ASG rule covers it instantly, the
   IP-list rule doesn't. _"ASGs let rules describe roles, not addresses."_
5. Network Watcher's "effective security rules" view merges both NSGs into the one list that
   actually applied. _"What actually happened, after both gates."_
   **The moment**: Beat 2, the envelope the subnet NSG waved through stopped dead at the NIC's
   default deny — a flow is blocked if either layer says no.
   **Interaction**: Reorder rules by priority and watch a flow's verdict flip; add a VM to an ASG and
   see which rules now cover it.
   **Ending**: The effective-rules view, both NSGs resolved into the path a packet actually took.
   **Variants**: `azure-network-security-layers`, `azure-vnet-subnets`, `azure-user-defined-routes`.
   **Techniques**: token, path trace, restyle, spotlight, caption.
   **Review**: Improved — rewrote beats 1 to 3 and the moment. "Lower-priority Deny with an Allow above it" was ambiguous (in Azure the lower number wins, so "lower priority" reads backwards) and the beat never showed the claimed two-gate block; it now uses real numbers and the built-in default deny. Beat 3 omitted two of the four gates for outbound-to-another-subnet and never showed statefulness, which was in the catalog; both added. Verified: priorities 100 to 4096, defaults 65000/65001/65500, ASGs usable in rules, effective rules in Network Watcher. Weighed a "two security guards" metaphor; the numbered rule cards make the real mechanism, so kept literal.

### NSGs and ASGs vs Azure Firewall vs WAF vs DDoS Protection (`azure-network-security-layers`)

**The aha**: A web request passes through DDoS Protection, then WAF, then optionally Azure
Firewall, then NSGs — four different defences, each seeing something the others can't, and none of
them alone is "the firewall".
**Misconception to defeat**: Calling any one of these "the firewall", or assuming Azure Firewall
sees all traffic automatically.
**Cast**: A horizontal lane from the internet to a VM: public IP (DDoS Protection shield), Front
Door/App Gateway (WAF shield), a fork to Azure Firewall (reached only via a route-table arrow),
then the subnet and NIC NSGs, then the VM.
**Opening frame**: The full lane, all four shields dim, a request envelope waiting at the far
left. _"One request, four defences on the way in."_
**Story**:

1. A volumetric flood of envelopes hits the public IP: DDoS Protection's shield lights and absorbs
   most of them before they go anywhere else. _"Layer one: survive the flood."_
2. A single malicious envelope (a SQL-injection payload in its text) reaches the WAF shield at the
   edge: inspected and blocked, never reaching the network at all. _"Layer two: known web attacks,
   stopped before they're even network traffic."_
3. A clean envelope passes WAF, then hits a fork: does a route table send it via Azure Firewall?
   If no UDR points there, it skips straight past — unexamined. _"Layer three only sees what
   routing sends it."_
4. The envelope reaches the subnet NSG, then the NIC NSG, each checked in turn, same as the
   `azure-nsg` plan. _"Layer four: the filter at every subnet and NIC, always checked, routing or
   not."_
5. Side by side: the same attack envelope sent at a setup with only NSGs (it reaches the VM, if a
   rule happens to allow it) versus the full stack (stopped at WAF). _"No single layer catches
   everything the full stack does."_
   **The moment**: Beat 3, the unrouted skip: Azure Firewall sitting dark and uninvolved because no
   route table pointed traffic at it, even though it's "turned on".
   **Interaction**: Toggle each shield on or off and send test traffic (a flood, a web exploit, a
   plain packet) to see which layer catches it.
   **Ending**: The full lane, all four shields lit, one surviving envelope reaching the VM.
   **Variants**: `azure-nsg`, `azure-user-defined-routes`, `azure-load-balancing-decision`; security's
   WAF and DDoS concepts.
   **Techniques**: lanes, token, spotlight, side by side, toggle, caption.
   **Review**: Keep — checked: DDoS infrastructure protection is free and Network/IP Protection are paid tiers on public IPs; WAF runs on Front Door and Application Gateway; Azure Firewall sees only what routes send it (plus DNAT'd inbound); NSGs always apply at subnet and NIC. Beat 3's dark firewall is the memorable failure. Weighed a medieval "moat, wall, gate, guard" metaphor, but it would blur which Azure product does which; the real icons in a lane keep them separate. Misconception "Azure Firewall sees everything" is defeated by beat 3; "which one is the firewall" by beat 5.

### Routing: system routes and user-defined routes (`azure-user-defined-routes`)

**The aha**: Azure routes everything for you by default, so adding one route with a new next hop
— like 0.0.0.0/0 to a firewall — silently redirects every packet a subnet sends, which is exactly
how forced tunnelling works and exactly how it breaks.
**Misconception to defeat**: Thinking NSGs control the path a packet takes, or that routing only
matters for exotic topologies.
**Cast**: A subnet's route table, shown as a short list: system routes already filled in (VNet
local, peering, gateway/BGP, internet), each with a next hop icon. An envelope leaving a VM. A
firewall appliance off to the side.
**Opening frame**: The route table with only system routes, an envelope addressed to the internet
taking the "Internet" system route directly out. _"Azure already knows how to get everywhere — by
default."_
**Story**:

1. The same envelope, addressed to a peered VNet, takes the "Peering" system route straight there,
   no extra hop. _"Each destination already has a route."_
2. A new UDR is added: "0.0.0.0/0 → Virtual appliance (firewall)". It replaces the system
   internet route for the same prefix (a tie, which the UDR wins). _"Same prefix: your route
   beats the system's."_
3. The internet-bound envelope now detours through the firewall icon before continuing out. An
   envelope to the peered VNet still takes the peering route: its /16 is a longer, more specific
   match than /0. _"Everything with no more specific route takes the detour, including packets
   nobody meant to touch."_
4. A UDR and a BGP-learned route both claim the same prefix: the UDR wins, shown by the firewall
   detour beating a different, on-premises-learned path. _"UDR beats BGP beats system routes, on a
   tie."_
5. The firewall is temporarily removed without updating the UDR: the envelope detours into an
   empty spot and vanishes, red. _"Routing doesn't know the appliance is gone."_
   **The moment**: Beat 3, the instant one added route bends every matching packet's path — the quiet
   mechanism behind both forced tunnelling and its failures.
   **Interaction**: Add, remove or reprioritise UDRs and watch an envelope's path change; remove the
   appliance behind an active UDR and see traffic vanish.
   **Ending**: A route table with system and user-defined routes both visible, the active path traced
   through it.
   **Variants**: `azure-vnet-subnets`, `azure-hub-spoke`, `azure-outbound-connectivity`, `azure-nsg`
   (routes, don't filter).
   **Techniques**: token, path trace, restyle, failure, caption.
   **Review**: Improved — beat 2 called /0 "the widest, most relevant prefix", which gets longest-prefix match backwards (/0 is the least specific, and it wins only by tying with the system route and beating it as a UDR). Rewrote beats 2 and 3 so the viewer sees both rules: longest prefix first, then UDR over BGP over system on equal prefixes. Showing the peered VNet's route staying untouched also explains why spoke-to-spoke needs its own route. Beat 5 (appliance gone, packets vanish) verified as correct. Weighed a "GPS detour" metaphor; the route table itself is clearer for the actual rules.

### VNet peering and gateway transit (`azure-vnet-peering`)

**The aha**: Peering connects exactly the two VNets it's set up between — A-to-B and B-to-C never
gives A a path to C, which is the one fact that makes hub-and-spoke designs need a router in the
hub.
**Misconception to defeat**: Assuming peering is transitive like a shared network.
**Cast**: Three VNet frames, A, B, C, in a row. A-B peered (a direct line, set up on both sides,
shown as two matching arrowheads). B-C peered the same way. No line between A and C.
**Opening frame**: A-B and B-C peered, A-C blank. _"Two separate peerings. Nothing between the
ends."_
**Story**:

1. An envelope from A to B: travels the direct peering line, arrives. _"Direct, both ways, as set
   up."_
2. An envelope from B to C: same, direct. _"Same for this pair."_
3. An envelope from A to C: A's route table has no entry that leads to C's address space, so the
   envelope never leaves A, dropped, red. _"Peering is a link between two, not a network you
   route through."_
4. A router/firewall VM is placed inside B (IP forwarding on, "allow forwarded traffic" ticked on
   the peerings), and a UDR in A points C-bound traffic at it, with a matching UDR in C for the
   reply. The A-to-C envelope reaches B, is forwarded, and arrives at C. _"Give the traffic a
   next hop in B, and now it can."_
5. Separately, A peers to a hub VNet that owns a VPN gateway; "gateway transit" is switched on,
   and A's on-premises-bound envelope rides the hub's gateway without A needing one of its own.
   _"Transit for a shared gateway is a specific, opt-in feature — not the same as transiting
   ordinary traffic."_
   **The moment**: Beat 3, the envelope dropped at A's edge: the natural assumption that "B connects
   to both" should mean something, meeting the flat fact that it doesn't.
   **Interaction**: Try sending A-to-C traffic directly; then add a router in B and a UDR in A and
   watch the path open up.
   **Ending**: A-B and B-C peered as before, A-to-C now flowing only through the router placed
   deliberately in B.
   **Variants**: `azure-hub-spoke`, `azure-virtual-wan`, `azure-user-defined-routes`.
   **Techniques**: token, path trace, failure, boundary, caption.
   **Review**: Improved — the old beat 3 had the packet travel to B and stop there, but A has no route for C's addresses, so it never leaves A; corrected, and the moment moved with it. Beat 4 now includes the three things a real forwarder needs (IP forwarding, allow-forwarded-traffic, a return route), otherwise the reply would break asymmetrically. Verified: peering is set on both sides, address spaces can't overlap, gateway transit needs "allow gateway transit" on the hub and "use remote gateway" on the spoke. Weighed a "friend-of-a-friend" social metaphor; the three-VNet row is already that.

### Hub-and-spoke topology (`azure-hub-spoke`)

**The aha**: Centralising shared services in a hub and routing every spoke's traffic through it
makes the hub the one control point for both traffic and cost — spokes can't reach each other
unless something in the hub lets them.
**Misconception to defeat**: Assuming spokes can reach each other just because they're all peered
to the same hub.
**Cast**: A hub VNet frame holding Azure Firewall, VPN/ExpressRoute gateways, Bastion, a DNS
resolver. Three spoke VNet frames, each peered to the hub with a direct line, each with a UDR
pointing its traffic at the firewall.
**Opening frame**: Hub in the centre, three spokes peered around it, each spoke's UDR visible
pointing inward. _"Everything shared lives once, in the middle."_
**Story**:

1. Spoke 1's envelope, bound for the internet, follows its UDR into the hub's firewall, then out
   to the internet; one bound for the office goes on through the hub's VPN gateway. _"A spoke
   uses the hub's shared firewall and gateway."_
2. With Spoke 1's UDR switched off, an envelope bound for Spoke 2 has no route and is dropped at
   Spoke 1's edge — spokes aren't peered to each other. _"Spoke-to-spoke isn't automatic, same as
   any two unpeered VNets."_
3. UDR back on, with the route to the firewall: the envelope goes to the hub firewall, which
   forwards it on to Spoke 2 (Spoke 2's UDR sends the reply back the same way). _"Route it
   through the hub, and the firewall becomes the one place that sees, logs or blocks every
   spoke-to-spoke flow."_
4. Azure Virtual Network Manager is shown pushing a security admin rule into all three spokes at
   once, overriding a local NSG that would have allowed something risky. _"The hub can enforce
   rules the spokes can't opt out of."_
   **The moment**: Beat 2 against beat 3: the same two spokes, unreachable directly, reachable the
   moment the hub is given the job of forwarding — control concentrated exactly where it's wired to
   be.
   **Interaction**: Toggle a spoke's UDR on and off and watch whether spoke-to-spoke and internet
   traffic reach the firewall; push a security admin rule and see it override a local NSG.
   **Ending**: All three spokes routed through the hub, every flow between them visibly passing its
   firewall.
   **Variants**: `azure-vnet-peering`, `azure-virtual-wan`, `azure-user-defined-routes`,
   `azure-landing-zones`.
   **Techniques**: boundary, path trace, failure, token, restyle, caption.
   **Review**: Improved — beat 1 sent internet traffic "out through the hub's gateway"; VPN/ExpressRoute gateways carry on-premises traffic, internet egress leaves via the firewall. Split. Beat 2 had the envelope "stop dead" at the hub's peering, but the drop happens at the spoke (no route); corrected, and the UDR toggle makes the moment a before/after of the same flow. The reply route is now shown, the usual missing piece. Verified Virtual Network Manager security admin rules are evaluated before NSGs. Weighed a "hub airport" metaphor; spoke-to-spoke via the hub is the classic layover, but the literal frame is already clear.

### Azure Virtual WAN (`azure-virtual-wan`)

**The aha**: Virtual WAN is hub-and-spoke with Microsoft running the hub, so any-to-any transit
between VNets, branches and users comes built in, in exchange for less control over what's inside
that hub.
**Misconception to defeat**: Treating it as just a bigger version of a self-managed hub, with the
same tuning knobs.
**Cast**: A Microsoft-managed hub icon (cloud-shaded, distinct from a normal VNet frame) per
region, containing a router, gateways, and optionally a secured-hub Azure Firewall. Several VNets,
branch-office icons and remote-user icons, each with one line into the hub. A second regional hub,
linked to the first.
**Opening frame**: One managed hub, three VNets and a branch connected to it, each with a single
line in — no lines between the spokes themselves. _"Connect in. The hub does the rest."_
**Story**:

1. An envelope from VNet 1 to VNet 2: travels through the managed hub automatically, no UDR
   authored by anyone. _"Any-to-any, out of the box (Standard SKU)."_
2. An envelope from the branch office to VNet 3: same single hop through the hub. _"Branches,
   users and VNets, all the same way in."_
3. A second regional hub is added and linked: an envelope from VNet 1 crosses both hubs over the
   Microsoft backbone to reach a VNet attached to the far hub. _"Hub-to-hub transit comes with
   it."_
4. "Routing intent" is turned on: every flow, including hub-to-hub, now detours through the
   secured hub's Azure Firewall before continuing. _"Force every path through inspection, with one
   setting."_
5. Contrast inset: the self-built hub-and-spoke from `azure-hub-spoke`, where the same any-to-any
   behaviour needed UDRs authored by hand in every spoke. _"That routing is what Microsoft is
   managing for you here."_
   **The moment**: Beat 1, the lack of any UDR anywhere — any-to-any transit appearing for free,
   which is the whole trade this service makes.
   **Interaction**: Connect a new VNet or branch to the hub and watch it gain reachability to
   everything else instantly; toggle routing intent and see traffic detour through the firewall.
   **Ending**: Two linked managed hubs, every spoke reaching every other without a hand-authored
   route in sight.
   **Variants**: `azure-hub-spoke`, `azure-vnet-peering`, `azure-vpn-vs-expressroute`.
   **Techniques**: boundary, token, path trace, toggle, side by side, caption.
   **Review**: Improved — added the SKU caveat: any-to-any transit is Standard, and the Basic SKU is site-to-site only. Checked: Microsoft-managed hub per region with router and gateways, hub-to-hub over the backbone, routing intent via a secured hub. The opening and beat 1 make the trade clear (no hand-authored routes) and the inset ties back to the previous plan's manual routes. Weighed a "managed vs self-managed airport" metaphor, and a table of control knobs lost to the zero-UDR moment, which is the one thing that makes the trade felt.

### Private Endpoint vs Service Endpoint (Private Link) (`azure-private-endpoint-vs-service-endpoint`)

**The aha**: A private endpoint brings the service into your network with its own private IP
pinned to one resource; a service endpoint only lets your subnet through the service's public
front door — only the first one works from on-premises.
**Misconception to defeat**: Treating them as the same idea at different price points, or thinking
either stops the service from having a public address at all.
**Cast**: A subnet with a VM. Two paths to a storage account, shown side by side. Left, "Service
endpoint": a tagged lane from the subnet to the storage account's still-public endpoint, with a
firewall rule "allow subnet X". Right, "Private endpoint": a NIC with a private IP sitting inside
the subnet itself, wired directly to the specific storage account.
**Opening frame**: Both paths unconfigured, storage account's public endpoint visible in both.
_"Two ways to reach the same PaaS resource."_
**Story**:

1. Service endpoint: the VM's request leaves the subnet, tagged, crosses the Microsoft backbone to
   the storage account's public endpoint, where a firewall rule recognises the tag and allows it.
   _"Still the public front door — just one your subnet is allowed through."_
2. An on-premises VM tries the same thing: the subnet tag only exists for traffic from inside the
   VNet, so it arrives as an ordinary internet request and is refused (unless its public IP is
   separately allow-listed). _"The subnet rule can't see on-premises."_
3. Private endpoint: the VM's request never leaves the subnet at all — it hits the NIC with the
   private IP, already wired to one specific storage account. _"The service, brought inside your
   network."_
4. The same on-premises VM, now routed over ExpressRoute into the VNet, reaches the private
   endpoint's IP directly and succeeds. _"Works from on-premises too, because it's just a private
   IP."_
5. Exfiltration test. A compromised VM tries to copy data to an attacker-owned storage account.
   Over the service-endpoint lane it works: the subnet is allowed to the Storage service as a
   whole. Over the private endpoint, the IP is wired to one account only, so the attacker's
   account has no private path. _"Pinned to one resource, not a whole service."_
6. Both storage accounts still show a public endpoint. Public network access is switched off on
   the private-endpoint account: the public door greys out and the private path keeps working.
   _"A private endpoint doesn't remove the public address. Turn it off yourself."_
   **The moment**: Beat 2 against beat 4, the on-premises VM failing through the service endpoint and
   succeeding through the private endpoint — the exact same client, two different outcomes.
   **Interaction**: Switch between the two endpoint types and try reaching the storage account from
   inside the VNet and from a simulated on-premises network.
   **Ending**: Both paths shown at rest, the private endpoint's NIC sitting visibly inside the subnet,
   the service endpoint's tag sitting visibly outside it.
   **Variants**: `azure-private-endpoint-dns`, `azure-vnet-subnets`, `azure-vpn-vs-expressroute`.
   **Techniques**: side by side, token, boundary, failure, caption.
   **Review**: Improved — beat 5 was muddled (an attacker's account being "reached via" the endpoint); it is now a concrete exfiltration contrast (service endpoint opens the subnet to a whole service, private endpoint to one resource; service endpoint policies can narrow it, mention in narration). The stated misconception "either stops the service having a public address" was never defeated, so beat 6 shows public network access being disabled. Beat 2 softened (IP allow-listing is possible, but not the subnet rule). Beat 4 should flag that DNS must also be right; the next plan owns that. Weighed a "VIP entrance vs back door" metaphor; kept the two-lane literal view.

### Private endpoint DNS and DNS Private Resolver (`azure-private-endpoint-dns`)

**The aha**: A private endpoint only works if the client's name lookup actually resolves to the
private IP — most "it doesn't work" reports are really a DNS problem, not a networking one.
**Misconception to defeat**: Assuming creating the private endpoint is enough on its own.
**Cast**: A client VM looking up "mystorage.blob.core.windows.net". A public DNS record for that
name, with a CNAME arrow to "mystorage.privatelink.blob.core.windows.net". A private DNS zone
linked to the VNet, holding an A record for that privatelink name pointing at the private
endpoint's IP. An on-premises client off to the side, plus a DNS Private Resolver bridging in and
out.
**Opening frame**: The client about to resolve the name, both the public chain and the private
zone visible but untraced. _"The name has to resolve to the right address."_
**Story**:

1. The in-VNet client's lookup follows the CNAME to the privatelink name, then the linked private
   zone answers with the private IP. _"Inside the VNet: the private zone wins, automatically."_
2. The same client's traffic goes straight to that private IP, never touching the public internet.
   _"Private IP, private endpoint, private endpoint used."_
3. An on-premises client does the identical lookup: no private zone is linked there, so the CNAME
   chain falls through to the public DNS answer — the real, public IP. _"Off-VNet, the same name
   resolves differently — and bypasses the private endpoint entirely."_
4. A DNS Private Resolver's inbound endpoint (a private IP in the VNet; on-premises can't reach
   Azure's own 168.63.129.16) is added, and on-premises DNS forwards the service's zone, such as
   blob.core.windows.net, to it: the lookup follows the CNAME into the linked private zone and
   returns the private IP. The traffic then travels over the VPN or ExpressRoute. _"Extend
   resolution to on-premises, and it matches."_
5. Someone "fixes" it instead with a hosts-file entry on one machine: works there, breaks silently
   if the endpoint is ever recreated with a new IP, and every other machine is still wrong.
   _"A patch, not a fix — the DNS Private Resolver is."_
   **The moment**: Beat 3, the identical name resolving to two different addresses depending only on
   which DNS the client used — the real cause behind almost every private-endpoint "connectivity"
   complaint.
   **Interaction**: Run the same lookup from an in-VNet client and an on-premises client, with and
   without the resolver wired up, and watch the resolved IP change.
   **Ending**: Both clients resolving to the same private IP, resolver bridging the gap.
   **Variants**: `azure-private-endpoint-vs-service-endpoint`; networking's DNS concepts.
   **Techniques**: token, path trace, side by side, failure, caption.
   **Review**: Improved — beat 4 now explains why a resolver is needed at all (Azure's 168.63.129.16 resolver is unreachable from on-premises), forwards the service's own zone rather than only the privatelink zone, and says the traffic then needs a VPN/ExpressRoute path. Beat 5's "IP changes" is rare; the real failure is recreation and every other machine, so reworded. Verified the CNAME chain to privatelink.blob.core.windows.net and the private A record. Weighed a "phone book" metaphor; the CNAME-then-A chain is the same thing with real records. The identical name resolving to two IPs is the moment.

### Choosing a load balancer: Front Door vs Traffic Manager vs Application Gateway vs Load Balancer (`azure-load-balancing-decision`)

**The aha**: Azure's load balancers split along two axes, global-vs-regional and HTTP-vs-any-
protocol, so picking the right one — and often combining several — is a matter of scope and layer,
not "which is best".
**Misconception to defeat**: Treating these as competing, interchangeable products, or picking one
for every job.
**Cast**: A two-by-two grid: columns "Regional" and "Global", rows "Layer 7 (HTTP)" and "Layer 4 /
DNS (anything)". Application Gateway sits regional/L7, Load Balancer regional/L4, Front Door
global/L7, Traffic Manager global/DNS. A request/packet travelling to a correctly or incorrectly
chosen cell.
**Opening frame**: The empty grid, four labelled cells. _"Two questions: how global, how deep into
the protocol?"_
**Story**:

1. A global HTTP request drops into the Front Door cell: TLS, WAF and caching happen at the edge,
   then it rides the backbone to the nearest healthy region. _"Global and HTTP: Front Door."_
2. The same request, aimed at the Traffic Manager cell instead: it only ever gets a DNS answer
   pointing at a region — no inspection, and failover waits on the DNS record's TTL to expire
   everywhere. _"Global but DNS-only: slower, blinder failover."_
3. Inside one region, an HTTP request drops into the Application Gateway cell: path-based routing
   sends it to the right backend pool over a private IP. _"Regional and HTTP: Application Gateway
   lives in your VNet and reads the URL."_
4. A raw TCP stream drops into the Load Balancer cell: forwarded packet-for-packet at huge scale,
   Load Balancer never looking at anything above layer 4. _"Any protocol: Load Balancer, blind to
   the content."_ (A cross-region tier of Load Balancer exists, drawn as a faint extension of the
   cell.)
5. Pull back: Front Door is shown sitting in front of Application Gateway in two regions at once —
   both cells used together, not competing. _"A normal design combines a global and a regional
   one."_
   **The moment**: Beat 5, the combined picture: the "which one" question dissolves once two cells
   are shown stacked, each doing the job only it can.
   **Interaction**: Drop a request into each cell and see what each service actually does with it;
   build the combined Front Door + Application Gateway path.
   **Ending**: The grid, all four cells lit, two of them wired together in a working path.
   **Variants**: `azure-front-door`, `azure-application-gateway`, `azure-load-balancer`, networking's
   load-balancing concepts.
   **Techniques**: choice, token, side by side, spotlight, caption.
   **Review**: Improved — Load Balancer is not strictly regional (a cross-region tier exists), so the cell now notes it; beat 3's caption claimed Application Gateway "reaches private backends" as if Front Door couldn't (Premium reaches Private Link origins), reworded to the safe claim that the gateway lives in your VNet. Verified: Traffic Manager returns DNS answers only, so failover waits on TTL and resolver caches. The grid-then-stack ending is the right moment: "which one" dissolves. Weighed a decision-tree framing (question forks); the grid shows two axes at once and the brief's own "which service" convention is a short path, so the interaction adds one.

### Azure Front Door (`azure-front-door`)

**The aha**: The user's connection ends at a nearby edge point of presence, not in your region, so
Front Door can speed things up, fail over in seconds, and filter attacks before they ever reach
your origin — provided the origin is locked to accept only Front Door.
**Misconception to defeat**: Thinking Front Door is "just a CDN", or that locking origins is
optional.
**Cast**: A world map with several edge "points of presence" (POPs) dotted around it, each capable
of TLS termination, WAF and caching. Two origin regions behind them in an origin group, with
health probes. A user icon near one POP; an attacker icon trying to reach an origin directly.
**Opening frame**: User near a POP, POPs linked by the Microsoft backbone to both origins. _"The
connection ends close to the user, not at your servers."_
**Story**:

1. The user's request stops at the nearest POP: TLS terminates there, the WAF inspects it, a
   cached response might answer it immediately with no trip to the backend at all. _"Edge
   first."_
2. Not cached: the request rides the Microsoft backbone, not the public internet, to the
   healthiest origin in the group. _"Backbone, not best-effort internet, for the rest of the
   trip."_
3. That origin's health probe fails: within seconds, new requests route to the other origin
   instead. _"Failover in seconds, from the edge."_
4. The attacker icon tries to hit an origin's public IP directly, bypassing Front Door entirely:
   if the origin still accepts public traffic, it gets through untouched by any of the above.
   _"Skip Front Door, skip every protection it offered."_
5. The origin is reconfigured to accept only the Front Door service tag and the header carrying
   your own Front Door's ID (the tag alone would admit anyone's Front Door): the same direct
   attack now bounces at the origin's own front door. _"Lock origins to your Front Door, and the
   edge protection can't be routed around."_
   **The moment**: Beat 4 against beat 5: identical attack, unprotected origin lets it through,
   locked origin refuses it — the one setting that makes the whole edge layer actually matter.
   **Interaction**: Fail an origin and watch failover; send an attack straight at an origin with
   locking on and off.
   **Ending**: User still near the POP, both origins healthy, lock engaged.
   **Variants**: `azure-load-balancing-decision`, `azure-application-gateway`; networking's CDN and
   anycast concepts.
   **Techniques**: token, path trace, failure, toggle, spotlight, caption.
   **Review**: Improved — "Front Door's signature" was vague and the naive version of it (allow the AzureFrontDoor.Backend tag) lets any other customer's Front Door reach your origin; beat 5 now names tag plus your own Front Door ID header. Premium can reach origins over Private Link, which removes the public origin entirely (mention in narration). Verified: anycast edge POPs, TLS/WAF/caching at the edge, backbone to origins, health-probe failover (seconds to tens of seconds depending on probe settings), classic retiring 31 Mar 2027 so the plan draws Standard/Premium only. Weighed a "CDN with extras" framing (the misconception itself); the attack before and after locking is the sharper lesson.

### Application Gateway (`azure-application-gateway`)

**The aha**: Application Gateway is the private-network side of HTTP load balancing — it lives
inside your VNet, in a subnet of its own, so it can reach backends with only private IPs and
route them by URL path, listener and health, all within one region.
**Misconception to defeat**: Treating it as a smaller Front Door, or confusing it with the Load
Balancer.
**Cast**: A VNet subnet holding the Application Gateway, with listeners (port, host, certificate)
feeding routing rules. Two backend pools, "/images → pool A" and "/api → pool B", each pool of VMs
with only private IPs, no public exposure. Health probes ticking.
**Opening frame**: The gateway inside its subnet, two backend pools visible with private IPs only.
_"Deployed inside your network, next to backends that have no public address at all."_
**Story**:

1. A request for `/images/logo.png` arrives at a listener, matches the path-based rule, and is
   sent to pool A — reached entirely over private IPs. _"Path-based routing, inside the VNet."_
2. A request for `/api/orders` matches the other rule and goes to pool B instead — same listener,
   different destination by path alone. _"One entry point, routed by URL."_
3. A health probe on pool B fails for one VM: that backend greys out and traffic shifts to the
   healthy ones. _"Unhealthy backends drop out automatically."_
4. Contrast inset: the same two backend pools with no public IPs are shown unreachable from Front
   Door directly, since Front Door needs a public or Private Link origin — the gateway, a
   private-IP front, is what the edge points to. _"The edge can't reach a plain private backend;
   the gateway is what sits in front of it."_
5. Load climbs; autoscaling adds another gateway instance, the rule set and probes replicated onto
   it. _"Scales out, same rules."_
   **The moment**: Beat 4, the inset: the private-IP backend pools sitting unreachable from the edge
   until the regional gateway is drawn in front of them — the gap this service exists to fill.
   **Interaction**: Edit a path-based rule and watch requests route differently; fail a backend VM
   and watch traffic shift.
   **Ending**: Both pools healthy, routed correctly by path, gateway autoscaled.
   **Variants**: `azure-front-door`, `azure-load-balancing-decision`, `azure-load-balancer`.
   **Techniques**: token, path trace, restyle, failure, spotlight, caption.
   **Review**: Improved — the aha claimed URL-path routing is something "a global edge service can't do", which is false (Front Door has route patterns too); the real distinguishing facts are that it lives in your VNet, reaches private backends, and is regional. Rewrote the aha and the inset caption to say so, and the misconception beat still holds. Verified: dedicated subnet, listeners, rules, probes, autoscaling, WAF_v2 (v1 retired April 2026). Weighed a "doorman inside the building vs at the street" metaphor; the private-pools inset already shows it with the real pieces.

### Azure Load Balancer (`azure-load-balancer`)

**The aha**: Load Balancer forwards packets at layer 4 without terminating the connection, so it
handles any TCP or UDP traffic at huge scale, preserves the client's IP, and knows nothing about
URLs, cookies or certificates.
**Misconception to defeat**: Expecting it to route by content the way Application Gateway does, or
confusing it with NAT Gateway.
**Cast**: A frontend IP, a backend pool of VMs, a health probe, and a packet (not an HTTP request
card — a plain, unlabelled envelope) arriving.
**Opening frame**: Frontend, backend pool, a plain envelope approaching. _"Just packets — no
content read."_
**Story**:

1. The envelope arrives at the frontend with a source IP marked "client: 203.0.113.5": the
   load-balancing rule picks a healthy backend by hash, and the envelope is forwarded there, its
   source IP unchanged. _"Forwarded, not re-wrapped — the backend sees the real client IP."_
2. A second envelope, this one UDP, arrives: treated identically, same frontend, same pool, same
   rule. _"Any protocol — it never inspects what's inside."_
3. An HA Ports rule is shown handling every port on a pair of NVAs at once, something Application
   Gateway (which only understands HTTP) can't do. _"Where there's no content to read, this is the
   tool."_
4. A health probe stops getting a response from one backend VM: it's pulled from rotation, no
   packets sent its way until it recovers. _"Keeps traffic off unhealthy backends — by probing,
   not by understanding."_
5. Contrast inset: the same envelope sent through Application Gateway instead is shown being
   opened and read for a Host header before being forwarded, re-wrapped, with the gateway's own
   source IP (the client's rides in a header). _"That's the layer-7 alternative — and the trade
   it makes."_
6. Direction check: a backend VM's reply path is the LB's own, but a new outbound request from a
   backend to the internet is drawn leaving by a separate arrow marked "NAT Gateway / outbound
   rules". _"This balances arrivals. Leaving is another job."_
   **The moment**: Beat 1, the unchanged source IP: the clearest sign that nothing was opened or
   rewritten, only forwarded.
   **Interaction**: Send TCP, UDP and an HA-Ports-eligible flow through and watch all three pass
   identically; fail a backend and watch the probe pull it.
   **Ending**: Backend pool healthy, packets flowing, content never read.
   **Variants**: `azure-application-gateway`, `azure-load-balancing-decision`,
   `azure-outbound-connectivity`.
   **Techniques**: token, restyle, failure, side by side, caption.
   **Review**: Improved — the stated confusion with NAT Gateway was never defeated; beat 6 separates inbound balancing from outbound egress and points to the next plan. Beat 5 clarified (App Gateway sends the client's IP in a header, not as the packet source). Verified: Standard SKU only (Basic retired September 2025), hash-based distribution, source IP preserved, HA ports, probes, a cross-region tier and Gateway Load Balancer exist. Weighed a "post office sorting by address only" metaphor: close, but the unchanged source IP is the more checkable proof.

### Outbound internet: NAT Gateway and the end of default outbound access (`azure-outbound-connectivity`)

**The aha**: Egress has to be designed on purpose now — in order of precedence, a UDR, then NAT
Gateway, then an instance public IP, then Load Balancer outbound rules — and NAT Gateway is what
answers "which IP do we allow-list?" cleanly.
**Misconception to defeat**: Assuming a VM can always just reach the internet, or that SNAT ports
are unlimited.
**Cast**: A subnet of many VMs, no individual public IPs. A precedence ladder off to the side: UDR
→ NAT Gateway → instance public IP → LB outbound rules. A NAT Gateway resource with a small pool
of public IPs and a SNAT-port meter ("~64,000 per IP").
**Opening frame**: The subnet, VMs with private IPs only, ladder showing all four rungs empty.
_"Nobody's told these VMs how to reach the internet yet."_
**Story**:

1. With nothing configured, a VM in a newly created private subnet sends an outbound request to
   the internet: it bounces at the subnet edge, red. (Subnets from before the change keep the old
   implicit access, which is being retired.) _"No implicit path."_
2. A NAT Gateway is attached to the subnet: the same request now exits through one of its public
   IPs, SNAT-port meter ticking up by one. _"All VMs in the subnet share this gateway's IPs."_
3. Dozens of VMs open thousands of simultaneous outbound connections: the meter climbs toward its
   ceiling of ~64,000 ports per attached IP, shared on demand by every VM in the subnet instead of
   a small fixed slice each. At the ceiling new connections fail; a second public IP is attached
   and the ceiling doubles. _"A predictable budget, and you add IPs to raise it."_
4. A UDR is added pointing 0.0.0.0/0 at a firewall instead: it now wins over the NAT Gateway for
   matching traffic, per the precedence ladder. _"A UDR always outranks NAT Gateway."_
5. A downstream partner asks "what IP should we allow-list?": a single, fixed answer — the NAT
   Gateway's public IP — rather than a sprawling list of ephemeral VM IPs. _"One stable, nameable
   address for the egress."_
   **The moment**: Beat 3, the port meter's steady climb against its labelled ceiling — SNAT
   exhaustion made visible as a budget, not a mystery error.
   **Interaction**: Attach or detach NAT Gateway, add a competing UDR, and load up outbound
   connections to watch the SNAT-port meter and the precedence ladder decide the path.
   **Ending**: The ladder with NAT Gateway lit as the active rung, one stable IP named.
   **Variants**: `azure-vnet-subnets`, `azure-user-defined-routes`, `azure-load-balancer`.
   **Techniques**: boundary, failure, meter, path trace, caption.
   **Review**: Improved — beat 3 never reached the ceiling it labelled, so "SNAT ports aren't unlimited" was asserted not shown; the meter now fills, connections fail, and a second IP doubles the ceiling. Beat 1 and caption made precise: the new default is per subnet, and existing subnets keep default outbound until changed. Verified: precedence UDR to NVA/firewall, then NAT Gateway, then instance public IP, then Load Balancer outbound rules; about 64,000 SNAT ports per public IP; private subnets default after 31 Mar 2026. Weighed a "taxi rank" metaphor for shared ports; the meter is more honest to the number.

### Hybrid connectivity: VPN Gateway vs ExpressRoute (`azure-vpn-vs-expressroute`)

**The aha**: VPN rides the public internet, encrypted and quick to set up; ExpressRoute is a
private circuit, predictable and fast but not encrypted by default — many enterprises run both,
ExpressRoute primary and VPN as its failover.
**Misconception to defeat**: "Private means encrypted", or thinking either one alone is always the
better choice.
**Cast**: On-premises office on the left. Two paths to a VNet on the right. Top path: "VPN
Gateway", an IPsec tunnel drawn across a cloud-shaped "public internet" region, with a lock icon on
the tunnel. Bottom path: "ExpressRoute", a private line through a connectivity-provider box,
labelled "not encrypted" with an open-padlock icon, running beside (not through) the public
internet.
**Opening frame**: Both paths present, neither carrying traffic yet. _"Two different roads to the
same place."_
**Story**:

1. An envelope takes the VPN path: it's wrapped in a locked IPsec tunnel as it crosses the
   public-internet region, arriving encrypted but subject to that region's unpredictable
   congestion (a jitter wobble drawn on the path). _"Encrypted, but riding the open road."_
2. The same envelope instead takes the ExpressRoute path: unwrapped, open padlock, but travelling
   a dedicated lane through the provider with steady, low, predictable latency. _"Private and
   steady — but not encrypted on its own."_
3. The ExpressRoute path is shown also carrying Microsoft peering traffic to Microsoft 365 and
   PaaS services, a second lane alongside the VNet one. _"Private peering to your VNets, Microsoft
   peering to Microsoft's own services — different lanes, same circuit."_
4. The ExpressRoute provider box flashes red and fails: traffic has nowhere to go until a VPN
   Gateway path, pre-configured alongside it, lights up and carries the same traffic instead.
   _"ExpressRoute primary, VPN Gateway failover."_
5. A point-to-site branch is added off VPN Gateway: a single laptop icon connects in with a
   certificate, no office needed at all. _"VPN also covers individual users, which ExpressRoute
   doesn't."_
   **The moment**: Beat 2's open padlock sitting right next to ExpressRoute's steady, uncongested
   lane — private and unencrypted, together, undoing the instinctive pairing of "private" with
   "safe."
   **Interaction**: Toggle which path carries traffic; fail the ExpressRoute circuit and watch VPN
   take over; add encryption on top of ExpressRoute and see the padlock close.
   **Ending**: Both paths present, ExpressRoute primary and lit, VPN Gateway standing by.
   **Variants**: `azure-virtual-wan`, `azure-vnet-peering`; networking's VPN and BGP concepts.
   **Techniques**: side by side, token, restyle, failure, toggle, caption.
   **Review**: Keep — checked: VPN Gateway is IPsec over the internet (site-to-site, point-to-site with certificate, RADIUS or Entra sign-in), ExpressRoute is a private circuit through a provider and is not encrypted by default (IPsec over it, or MACsec on ExpressRoute Direct, adds encryption), private peering to VNets vs Microsoft peering to Microsoft 365 and PaaS, and ExpressRoute with VPN failover is the standard pattern. The open padlock beside a steady lane is the sharpest way to break "private means encrypted"; weighed a comparison table (speed, price), which loses the misconception. Interaction already closes the padlock.

### Azure Bastion (`azure-bastion`)

**The aha**: Bastion lets you reach a VM's RDP or SSH session over HTTPS without the VM ever
needing a public IP or an open management port — the only thing exposed is one hardened endpoint
you don't patch.
**Misconception to defeat**: Thinking this is the same as briefly opening a port (just-in-time
access), or that it's just a jump box you built yourself.
**Cast**: A VM with no public IP, NSG showing no inbound RDP/SSH rule at all. A separate Bastion
subnet ("AzureBastionSubnet") holding the Bastion resource. A user's browser reaching Bastion over
HTTPS from the internet; from there, a short private hop to the VM.
**Opening frame**: VM with no public IP, no open management port, Bastion resource sitting in its
own subnet. _"The VM has nothing exposed."_
**Story**:

1. A user opens the portal, clicks "Connect" on the VM: a browser session opens an HTTPS
   connection straight to Bastion's public endpoint — the only public surface anywhere in this
   picture. A faded self-built jump-box sits beside it with an "OS patching: yours" tag.
   _"One exposed door, hardened and patched by Microsoft."_
2. From inside its own subnet, Bastion opens the actual RDP/SSH session to the VM's private IP.
   _"The VM is reached privately, from Bastion's side, never from the internet."_
3. An attacker scans the VNet's public IP ranges for open port 3389: finds nothing, because none
   exists. _"There's no port to find."_
4. Contrast inset: a just-in-time access rule is shown instead, briefly opening port 3389 to one
   IP for an hour — a real but temporary hole, versus Bastion's permanently closed one. _"JIT
   opens a door briefly; Bastion never has one to open."_
5. The Standard SKU also lets a native SSH or RDP client connect through the same Bastion, not
   just the portal's browser session; Premium adds session recording and a private-only option
   (no public IP at all). _"Not locked to the browser, at the higher SKUs."_
   **The moment**: Beat 3, the attacker's scan coming back empty — there's no port 3389 anywhere to
   find, which is a stronger claim than "briefly closed."
   **Interaction**: Try scanning for the VM's management port with and without Bastion in place;
   compare against the just-in-time inset.
   **Ending**: VM untouched by any inbound rule, Bastion standing as the one path in.
   **Variants**: `azure-vnet-subnets`, `azure-vpn-vs-expressroute`, `azure-nsg`; security's
   just-in-time access concept.
   **Techniques**: boundary, token, failure, side by side, caption.
   **Review**: Improved — the stated misconception "just a jump box you built yourself" was never contrasted; beat 1 now draws the self-built jump box with its patching burden. Beat 5 reworded (the SKU point is native-client access and, at Premium, session recording and private-only deployment; the old caption implied the VM is reached differently). Verified SKUs Developer, Basic, Standard, Premium, the dedicated AzureBastionSubnet, and that JIT opens a port temporarily where Bastion never opens one. Weighed leading with the JIT contrast; the empty port scan (beat 3) remains the stronger moment.
