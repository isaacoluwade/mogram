# Security plans, part 1

Stage 2 plans for `catalog/security.md` groups 1 to 5, in catalog order. These share a visual
language with the other security plan files (groups 6–13, in `security.part2.md` and
`security.part3.md`): people and clients sit on the left, applications in the middle, and
protected resources on the right inside a dashed trust boundary. An identity is a badge card
(name, a few visible claims). A token is a small ticket with its fields printed on its face —
`iss`, `sub`, `aud`, `exp`, `scope` — and a wax seal in the corner standing for its signature; a
broken or missing seal is drawn cracked or absent. Keys are a key icon (gold for a person's,
silver for a workload's); locked data carries a padlock; a secret is a sealed envelope. An
attacker is a red hooded figure, always entering from outside the trust boundary. A request
that's allowed gets a green tick; one that's denied gets a red cross. Protocol exchanges (OAuth,
OIDC, SAML) are drawn as ladder diagrams: each party is a vertical lifeline labelled at the top,
messages are slanted arrows travelling down the page in the order they happen, the live step is
highlighted and dims once past, and whatever is being carried — a code, a token — rides visibly
on the arrow as a small ticket icon. No new technique was needed for this part; ladder exchanges,
badges, tickets and seals are all drawn with the existing **exchange**, **token** and **contents**
techniques.

## Principles, risk and compliance

### CIA triad (`cia-triad`)

**The aha**: Every control and every attack maps onto confidentiality, integrity or availability — naming which one first tells you which kind of control you need.
**Misconception to defeat**: Confused with AAA (authentication, authorization, accounting).
**Cast**: Three overlapping circles — Confidentiality (eye icon, blue), Integrity (seal icon, green), Availability (clock icon, amber) — around a data server. Incidents fly in as small red icons.
**Opening frame**: The three circles around the server, calm, all green.
**Story**:

1. A hooded figure copies a file out; the icon lands in Confidentiality, which flashes red. _"Stolen data: confidentiality."_
2. A tampered-ledger icon lands in Integrity, flashes red. _"Changed undetected: integrity."_
3. A DDoS wave hits Availability; it flashes red and the server greys briefly. _"Can't reach it: availability."_
4. A double-extortion ransomware icon arrives and splits, landing in both Confidentiality (data copied out) and Availability (files encrypted) at once. _"Ransomware: stolen and locked."_
5. A card reading "AAA: authenticate, authorize, account" slides in and docks on the outside of the triad as a guard ring, not as a fourth circle. _"AAA are mechanisms that guard the properties. CIA is what they protect."_
6. Each circle grows its own remedy icon: encryption, hashing/signing, redundancy. _"Which property, which control."_
   **The moment**: Beat 4, the single ransomware icon splitting across two circles, showing a real incident can hit more than one property while the triad still names exactly which.
   **Interaction**: Click an incident type (phishing, DDoS, SQL injection, ransomware) and see which circles light red; several light more than one, and each lit circle names the remedy to reach for.
   **Ending**: All three circles green again, each guarded by its remedy.
   **Variants**: `threat-vulnerability-risk`, `defense-in-depth`.
   **Techniques**: spotlight, restyle, token, choice, caption.

**Review**: Improved — the AAA confusion was named but never defeated; a beat now docks AAA as a guard ring around the triad (mechanism vs goal). Ransomware now says what actually hits C (copied out) and A (encrypted), not a vague "stolen and locked". Alternative weighed: a pure incident-to-letter quiz; worse, since the triad's value is that it names the goal before the tool.

### Threat, vulnerability and risk (`threat-vulnerability-risk`)

**The aha**: Risk is likelihood × impact; a critical flaw nobody can reach may matter less than a medium one exposed to the internet.
**Misconception to defeat**: Severity (how bad) mistaken for risk (how likely and how bad).
**Cast**: A wall with two cracked doors (vulnerabilities), each wearing a severity tag: the yard door "Critical 9.8", the street door "Medium 5.3". One faces a busy street (internet-facing), one a locked yard (internal only). A red hooded figure on the street (the threat). A treasure chest behind the yard door. Two dials, Likelihood and Impact, feeding a Risk gauge.
**Opening frame**: Both doors cracked, tags visible, all gauges at zero; three labels pin the words: figure = threat, crack = vulnerability, gauge = risk.
**Story**:

1. The attacker tests the street door's crack; Likelihood climbs: reachable, easy. _"Reachable and easy to exploit: likely."_
2. Behind it: an empty room. Impact reads low; combined risk reads medium. _"But not much to steal."_
3. The attacker can't reach the yard door at all; its Likelihood stays near zero despite the Critical tag. _"Severity rates the crack. Risk rates the crack in context."_
4. Behind the yard door: the treasure chest. Impact reads high, yet risk stays low because likelihood is near zero. _"Severe, but low risk, for now."_
5. A new corridor opens between street and yard (a misconfiguration); the yard door's Likelihood jumps and risk spikes red. _"Change what's reachable, risk changes."_
   **The moment**: Beats 2 and 4 side by side: the Critical flaw scores lower risk than the Medium one purely because nothing can reach it, until beat 5 reopens the path.
   **Interaction**: Drag a vulnerability between the two doors, or open and close the corridor, and watch the gauge respond.
   **Ending**: A mitigation dragged onto a door drops both dials and the gauge.
   **Variants**: `blast-radius`, `cia-triad`, `vulnerability-management`.
   **Techniques**: meter, spotlight, side by side, token, choice, caption.

**Review**: Improved — the severity-vs-risk misconception had no visible object; each crack now carries a severity tag (Critical 9.8 vs Medium 5.3, CVSS-style) so the viewer sees the "worse" flaw lose, and the three words are pinned to threat, crack and gauge in the opening frame. Likelihood x impact is the standard qualitative formula. Alternative weighed: a weather forecast metaphor; less concrete than two doors.

### Least privilege (`least-privilege`)

**The aha**: Start every identity with nothing and add only what it needs; unused permissions are free reach for whoever steals that identity.
**Misconception to defeat**: "Grant broad access now, trim later" feels safe because nobody's using the extra permissions yet.
**Cast**: Left, a badge "Service X" with a permission list, mostly unchecked. Right, a resource rack of ten drawers (Read Orders, Write Orders, Delete Orders, Billing, Users, Admin…).
**Opening frame**: Badge with one box checked ("Read Orders"); nine drawers locked, one unlocked.
**Story**:

1. Service X requests "Read Orders" only when it needs it; that drawer unlocks, the rest stay locked. _"Grant only what's used."_
2. Contrast badge "Service Y" appears with all ten boxes pre-checked "to save time later"; all ten drawers unlock. _"The common shortcut."_
3. A hooded figure steals Service Y's badge and walks through Billing, Users and Admin, looting each. _"Every unused grant is now the attacker's."_
4. The same attacker steals Service X's badge: Billing and Admin bounce red, only Read Orders opens, and the loot is one drawer's worth. _"One drawer, not ten."_
5. A usage report over Service Y: nine of ten boxes "never used in 90 days". The boxes are unticked one by one. _"'Trim later' is real work. Starting small avoids it."_
6. Service X later needs "Write Orders" for real; it's requested, reviewed and added: one more tick, nothing anticipatory. _"Add only when truly needed."_
   **The moment**: Beats 3 and 4 — the identical stolen-badge attack loots nine drawers for one service and one for the other.
   **Interaction**: Toggle a badge's checkboxes before "stealing" it, and see how much the attacker reaches.
   **Ending**: Both badges side by side, final permission lists, X's a fraction of Y's.
   **Variants**: `blast-radius`, `role-based-access-control`, `just-in-time-privileged-access`.
   **Techniques**: boundary, restyle, token, side by side, failure, caption.

**Review**: Improved — beat 4 claimed Read Orders was "empty of anything damaging", which is false (order data is still stolen); it now says one drawer's worth, not ten. The "trim later" misconception was never answered, so a last-used report shows nine of ten grants idle and the cleanup effort. Alternative weighed: a hotel master key vs room key; the drawers already show the same thing with countable stakes.

### Defense in depth (`defense-in-depth`)

**The aha**: Layering different kinds of controls means one failure doesn't become a breach, because an attacker must beat them all.
**Misconception to defeat**: Buying more of the same control (two firewalls) is mistaken for layering different ones.
**Cast**: Concentric layers around a data store: Identity (checkpoint), Network (gate), Application (shield), Data (padlock), Monitoring (an eye watching every layer). A red hooded figure approaches from outside. For the opening contrast, a second, identical Network gate.
**Opening frame**: Five intact layers around the data.
**Story**:

1. Contrast first: two identical Network gates in a row. One misconfigured rule opens the first; the same rule is in the second, and the attacker walks through both. _"Two of the same control fail the same way."_
2. Reset to five different layers. The attacker hits the Network gate; a misconfigured rule lets them through. _"Every layer has holes."_
3. At Identity the MFA prompt holds, until a phished, relayed approval lets them through. _"A different kind of control, a different test."_
4. At the Application shield, input validation blocks an injection attempt. _"Still blocked here."_
5. At Data, the attacker copies the file; it is encrypted, useless even taken. _"Even taken, unreadable."_
6. Monitoring's eye has blinked at every attempt; a siren fires and an alert ticket appears. _"A breach needs every layer to fail, and still gets seen."_
   **The moment**: Beats 2 and 3's holes lining up on the first two layers, yet the next layers hold and monitoring has already seen it: failures of different kinds don't line up.
   **Interaction**: Randomize which layers have holes, or swap the stack for five copies of one control, and see whether any run reaches the centre and how fast monitoring fires.
   **Ending**: A tally, "2 of 4 protective layers breached, 0 data lost, 1 alert fired," monitoring's alert front and centre.
   **Variants**: `cia-triad`, `zero-trust-architecture`, `security-misconfiguration`.
   **Techniques**: layers, failure, path trace, spotlight, choice, caption.

**Review**: Improved — the plan said "four holes line up" and ended "4 of 5 layers breached" although only Network and Identity are holed; the numbers now match the story. The same-control-twice misconception had no beat, so the identical-gates opener defeats it. Alternative weighed: a castle with moat and walls; same idea, but the five-layer cast ties directly to cloud controls. Caveat kept honest: encryption helps only if the key sits behind a different identity.

### Blast radius (`blast-radius`)

**The aha**: Assume a credential will be stolen, and design so it reaches as little as possible — separate accounts, narrow scopes, segmented networks.
**Misconception to defeat**: Confused with attack surface (what's exposed before a breach), when blast radius is what's reachable after.
**Cast**: Dev, Test and Prod boxes, each with its own badge-holding service. A red hooded figure starts inside Dev holding a stolen badge. A damage circle drawn around the attacker.
**Opening frame**: Three environments sharing one account, no boundaries, stolen badge glowing in Dev.
**Story**:

1. The stolen Dev badge walks straight into Test, then Prod — one account, no boundary. _"One shared account: one badge reaches everywhere."_
2. Rewind: dashed trust boundaries appear around Dev, Test and Prod as separate accounts. _"Separate accounts per environment."_
3. The same stolen badge tries to cross into Test: red cross at the boundary. _"Now it stops here."_
4. Inside Prod alone, a workload's badge is scoped to one resource rather than the whole environment; stealing it reaches one resource, red crosses everywhere else. _"Narrow scope shrinks the radius further."_
5. The damage circle shrinks across the three redraws, from "everything" to "one account" to "one resource." _"Design for compromise, not just prevention."_
   **The moment**: The shrinking damage circle — the same stolen credential, radically different consequence.
   **Interaction**: Toggle boundaries and widen or narrow a badge's scope; the damage circle resizes live.
   **Ending**: Smallest damage circle, one resource lit, everything else dim and safe.
   **Variants**: `least-privilege`, `network-segmentation`, `managed-workload-identity`.
   **Techniques**: boundary, token, failure, spotlight, dial, caption.

**Review**: Merged — owned by Reliability (plans/reliability.part1.md). Their plan already folds in this reading as beat 6, and its 100/25/5 meter is the clearest single picture. To borrow from here: (1) show the radius shrinking two ways for a stolen credential, boundaries (separate accounts) and scope (one resource, not the whole environment), since narrowing scope inside an account is the part their beat 6 only names; (2) the misconception that blast radius is attack surface (exposed before a breach vs reachable after) is not defeated in theirs, which defeats severity instead; a one-line caption would do. Facts checked: separate accounts/subscriptions/projects per environment, scoped credentials and segmented networks are the standard levers.

### Fail secure and secure defaults (`fail-secure-defaults`)

**The aha**: When a check errors out — a timeout, an exception, a missing policy — the system must deny, not allow; silent fail-open is where protections vanish.
**Misconception to defeat**: Confused with "fail-safe" (doors unlocking in a fire, to protect people) — security usually wants the opposite.
**Cast**: A gate with an "Authorization check" box in front of a resource. A storm cloud that can disrupt the check. Green tick / red cross outputs.
**Opening frame**: Gate closed by default, a request waiting.
**Story**:

1. A normal request runs the check, gets "allow," the gate opens and closes again. _"The normal path: checked, then allowed."_
2. The storm strikes: the check throws an exception mid-evaluation. Two paths play side by side: fail-open, fail-secure.
3. Left: the request sails through with a red cross hovering over it, access it should never have had. _"Fail-open: errors become access."_
4. Right: the request bounces, clean denial, an alert fires. A code inset shows an empty catch block beside one that explicitly denies. _"Fail-secure: errors become denial. (OWASP 2025 A10.)"_
5. A new resource is created with no policy attached; it arrives closed, not open. _"Secure default: no policy means no access."_
6. Inset: a fire door swings open in an emergency, beside the data gate staying shut. _"Fire doors protect people, so they open. This gate protects data, so it shuts. Open on purpose is a decision; open by accident is a bug."_
   **The moment**: The side-by-side storm — identical failure, opposite outcomes, only one of which is safe.
   **Interaction**: Trigger the storm repeatedly and toggle the gate's default; count how many storms let something through.
   **Ending**: Settles on fail-secure, gate closed, alert raised, nothing passed.
   **Variants**: `default-deny-policy-evaluation`, `defense-in-depth`.
   **Techniques**: side by side, failure, choice, toggle, caption.

**Review**: Improved — the title promised "secure defaults" but nothing showed one; a beat now shows a new resource arriving closed (no policy = no access), which also sets up default-deny. The fail-safe misconception was only named; the fire-door inset now contrasts it on screen, with the caveat that fail-open is sometimes chosen deliberately for availability. OWASP 2025 A10 (Mishandling of Exceptional Conditions) checked against the catalog. Alternative weighed: a circuit-breaker analogy; blurs fail-secure with resilience patterns.

### Compliance frameworks (`compliance-frameworks`)

**The aha**: Compliance proves a minimum set of controls existed when audited; it doesn't make you secure, and a provider's certificate covers only the provider's side of the shared-responsibility line.
**Misconception to defeat**: "We're SOC 2 certified" means "we're secure," or that the provider's certifications cover the customer's workload too.
**Cast**: A dashed boundary splitting Provider (datacenters, hypervisor) from Customer (app, data, configuration) above it. Report and certificate badges (ISO 27001 certificate, SOC 2 report, PCI DSS attestation) stamped on the provider layer. A calendar with an audit period shaded. A customer bucket, open to the public.
**Opening frame**: The provider layer covered in green badges; the customer layer blank above it.
**Story**:

1. An auditor checks boxes across the shaded audit period, stamps a badge and leaves. _"Evidence of a past period, not of today."_
2. Time runs past the period; the provider's badges stay static while, above the line, a customer bucket turns public, flashing red. _"The certificate didn't move up here."_
3. A line is drawn exactly at the shared-responsibility boundary, with every badge below it. _"The provider's reports cover the provider's side only."_
4. A breach runs through the public bucket; the provider's badges stay green throughout. _"Compliant provider, breached customer."_
5. Contrast: an org treats compliance as a floor, keeps patching and configuring above the line; the bucket locks, a green tick replacing beat 2's red flash.
   **The moment**: Beat 4, the provider's badges staying serenely green while the customer burns.
   **Interaction**: Toggle "compliance as ceiling" versus "compliance as floor" and watch whether the bucket stays misconfigured after audit day passes.
   **Ending**: The shared-responsibility line, badges below, a secured, actively maintained app above it.
   **Variants**: fundamentals' `shared-responsibility-model`, `cspm`, `security-misconfiguration`.
   **Techniques**: boundary, timer, restyle, failure, spotlight, caption.

**Review**: Improved — "SOC 2 certified" is loose: SOC 2 is an auditor's attestation report (Type II covers an observation period, Type I a point in time) while ISO 27001 is a certificate, so the badges and the "snapshot" caption now say report/period. The provider-vs-customer misconception was already defeated by beat 4. Alternative weighed: an annual health check-up; same floor-not-ceiling point, but the shared-responsibility split is what people actually get wrong.

## Authentication and identity

### Authentication vs authorization (`authentication-vs-authorization`)

**The aha**: Authentication proves who you are; authorization decides what you may do, and authorization must be checked on every request, not just at sign-in.
**Misconception to defeat**: Signing in once grants everything afterward.
**Cast**: A person approaching a front door (sign-in, badge check), then a hallway of further doors (resources), each with its own small lock. "401" on the front door, "403" on hallway doors.
**Opening frame**: Person outside the front door, badge in hand; the hallway dim behind it.
**Story**:

1. The badge is checked at the front door: green tick, door opens. _"Authentication: proving who you are. Once."_
2. The person reaches hallway door 1, "My Files"; the lock checks the badge's permissions, green tick, opens. _"Authorization: checked again, here."_
3. The person reaches hallway door 2, "Admin Panel"; the lock checks permissions, red cross, "403." The person is fully signed in and still bounced. _"Signed in isn't the same as allowed everywhere."_
4. Rewind to the front door with no badge at all: red cross, "401," the hallway is never even reached. _"401: not even recognized."_
5. Side by side: 401 at the front door, 403 down the hallway — two different refusals.
   **The moment**: Beat 3, the undeniably signed-in person bouncing off one door, proving the two checks are separate.
   **Interaction**: Toggle whether the person holds a valid badge, and which hallway doors they're permitted.
   **Ending**: Some hallway doors open, some shut, the front door open throughout.
   **Variants**: `role-based-access-control`, `default-deny-policy-evaluation`, `oauth2-delegated-authorization`.
   **Techniques**: token, failure, spotlight, side by side, caption.

**Review**: Keep — the hallway of doors makes "checked again, per door" literal, and beat 3 (a signed-in person bounced at one door) is the one specific beat that kills the misconception. Checked: 401 means no valid credentials (despite its name "Unauthorized"), 403 means authenticated but not allowed; the catalog's OAuth/OIDC confusion is handled in those plans. Alternative weighed: airport passport control then boarding gate; same two checks, but the airport has no repeated per-resource checks, which is the point here.

### Identity provider (IdP) (`identity-provider`)

**The aha**: Applications stop handling passwords themselves — they redirect to a central IdP and trust what it signs, so MFA and offboarding happen in one place.
**Misconception to defeat**: Confusing the IdP (which authenticates and issues tokens) with a directory (which just stores identities).
**Cast**: A user on the left; three apps (Email, CRM, Wiki) in the middle, each originally with its own small password vault; on the right a two-storey tower: the lower floor is the Directory (a filing room of identities), the upper floor is the IdP desk (checks password and MFA, signs tokens), with dashed trust lines from the desk to each app.
**Opening frame**: Three apps, each with its own password store; the user juggling three passwords.
**Story**:

1. The three app-local password stores are crossed out and removed. _"Apps stop storing passwords."_
2. The tower appears, with a trust line to each app. _"The directory stores people. The IdP checks them and signs."_
3. The user signs in at Email, is redirected to the IdP desk, enters password plus MFA once; a signed token flies back to Email. _"Apps trust what the IdP signs."_
4. The user goes to CRM: redirected to the same IdP, already has a session (no re-prompt), gets a fresh token for CRM. _"Each app gets its own token from one authority."_
5. HR disables the user's directory entry; the desk refuses new sign-ins and every trust line stops getting new tokens at once, while the apps' already-issued sessions tick down on their own clocks and expire. _"Offboard once: no new tokens anywhere. Live sessions run out on their timer."_
   **The moment**: Beat 5, one flip at the tower stopping new access to every app simultaneously, impossible with three local password stores.
   **Interaction**: Disable and re-enable the directory entry; add MFA at the IdP and see it apply to all three apps untouched.
   **Ending**: The tower glowing, three trust lines, no local passwords anywhere.
   **Variants**: `single-sign-on`, `identity-federation`, `saml-sso`, `openid-connect`.
   **Techniques**: boundary, token, exchange, restyle, failure, caption.

**Review**: Improved — the IdP-vs-directory misconception was never shown; the tower now has a directory floor (stores people) under an IdP desk (verifies, signs). Beat 5 overstated: disabling an account stops new tokens, but sessions and tokens already issued keep working until they expire, so they now visibly tick down (revoking those is the sessions-vs-tokens problem). Alternative weighed: a passport office issuing documents; close, but the redirect-and-sign loop is the thing to see.

### Single sign-on (SSO) (`single-sign-on`)

**The aha**: One strong sign-in at the IdP gives silent access to many apps because the IdP keeps a session and hands each app its own token — which also makes the IdP account the master key.
**Misconception to defeat**: Thinking SSO just means "one password for everything," like a password manager.
**Cast**: A user on the left, an IdP tower with a session clock in the middle, apps A, B and C on the right, each behind its own door.
**Opening frame**: User outside the IdP, no session, all three doors shut.
**Story**:

1. The user signs in once (password plus MFA); a session clock starts ticking in the tower. _"One strong sign-in starts a session."_
2. Clicking App A silently redirects to the IdP, which sees the live session and issues a token without re-asking; the door opens. _"The IdP remembers you..."_
3. Clicking App B repeats the round-trip with a different token; no password typed either time. _"...and vouches for you, app by app."_
4. Inset contrast: a password manager types the same password into App B's form, and App B receives it. In SSO, App B receives only a signed token and never sees a password. _"Not one password everywhere. No app holds a password at all."_
5. The tower is circled as "the master key"; a hooded figure targets it instead of any app, steals the session, and all three doors open for the attacker too. _"Compromise the IdP, compromise everything."_
6. Contrast: the IdP account carries the strongest MFA (a FIDO2 key), while App B's old local login, crossed out, never had any. _"That's why the IdP gets the hardest MFA."_
   **The moment**: Beat 5, the attacker needing to breach only the tower, not three apps.
   **Interaction**: Let the session expire and watch all three apps require re-auth; attack the IdP versus attack one app and compare what's gained.
   **Ending**: The tower hardened, three doors open behind a single gate.
   **Variants**: `identity-provider`, `identity-federation`, `conditional-access`.
   **Techniques**: timer, token, exchange, spotlight, failure, caption.

**Review**: Improved — the "one password for everything" misconception was named but not contrasted; a password-manager inset now shows the password reaching the app while SSO sends only a token. Checked: stealing the IdP session (cookie/token theft) bypasses the MFA already done, which is why the plan's attacker steals the session, not the password. Alternative weighed: a festival wristband; good for "show once, enter many", worse for the master-key risk, which the tower shows directly.

### Identity federation (`identity-federation`)

**The aha**: Trust between organizations is configured once, with metadata and certificates; after that, the partner checks a signature, not a password.
**Misconception to defeat**: Confusing federation (trust across domains) with SSO (one IdP, many apps) or with directory sync (copying accounts).
**Cast**: Two separate trust boundaries, Org A (its own IdP) and Org B (its own app, no account for Org A's users). A certificate document exchanged once between the IdP towers. A guest user in Org A.
**Opening frame**: Two boundaries, no connection, the guest stuck outside Org B's app.
**Story**:

1. Admins exchange metadata once (issuer name, signing certificate, endpoints); a single dashed trust line is drawn between the boundaries. _"Trust configured once."_
2. The guest signs in at Org A's own IdP, home turf, home MFA. _"Authenticates where they already have an account."_
3. A signed assertion rides the trust line into Org B; Org B's app checks the signature against the registered certificate, plus issuer, audience and expiry. Green tick; no Org B password involved. _"The partner checks a signature, not a password."_
4. Inset: directory sync would copy accounts and credentials into Org B. Here only a signed claim crosses. _"Nothing is copied. A claim is carried."_
5. An uninvited Org C sends its own signed assertion: no trust line exists, red cross. _"No configured trust, no entry."_
6. Months later Org A disables the guest. Its IdP simply stops issuing assertions; Org B never needed telling, and a session it already opened runs out on its own timer. _"Pull access at the source."_
   **The moment**: Beat 3, a user whose password Org B has never seen walking in on a signature alone.
   **Interaction**: Add or remove the trust line and watch assertions succeed or bounce; swap in an unregistered certificate and watch the signature check fail.
   **Ending**: One dashed trust line between two boundaries, doing all the work.
   **Variants**: `saml-sso`, `openid-connect`, `workload-identity-federation`, `single-sign-on`.
   **Techniques**: boundary, exchange, token, failure, caption.

**Review**: Improved — beat 5 said Org B's check fails through a "signature-to-directory lookup", which is wrong: Org B never queries Org A's directory, Org A just stops issuing assertions. The "no account in Org B" claim was also too strong (partners usually map or just-in-time create a guest object), so it now says no password. The sync-vs-federation misconception gets an inset. Alternative weighed: two countries recognising each other's passports; fits, but the metadata exchange is what the viewer must see.

### SAML single sign-on (`saml-sso`)

**The aha**: The browser is only the courier — the IdP and the service provider talk through it, trusting the signature on the assertion, not the browser carrying it.
**Misconception to defeat**: Confused with OpenID Connect (XML versus JSON/JWT, API-friendly), or with OAuth.
**Cast**: A ladder diagram, three lifelines: Browser, Service Provider (SP), Identity Provider (IdP). The SAML assertion is a wax-sealed XML scroll, readable but tamper-evident (OIDC's cousin carries a JWT instead).
**Opening frame**: Three lifelines; the user wants the SP's app, nothing sent yet.
**Story**:

1. The browser requests the app; the SP has no session, builds an authentication request and redirects the browser to the IdP. _"SP: go authenticate over there."_
2. The browser arrives at the IdP; the user signs in with password and MFA. _"Authenticates at the IdP, not the SP."_
3. The IdP builds a signed scroll and hands it to the browser with an auto-submitting form; the arrow "POST assertion" carries it down to the SP's assertion consumer URL. _"The browser only relays it. It can read it, not change it."_
4. The SP checks the wax seal against the IdP certificate from its metadata, plus audience, expiry and that it answers the SP's own request: green tick, session created, app loads. _"SP trusts the signature, not the courier."_
5. A tampered copy is tried; the seal visibly cracks, red cross, rejected. _"Any change breaks the seal."_
6. Variant: the user clicks the app's tile at the IdP instead. A scroll arrives at the SP with no earlier request to answer. _"IdP-initiated: it works, but the SP can't tell it asked for this."_
   **The moment**: Beats 3-4, the arrow sliding down carrying a sealed scroll that the browser can open but not alter without cracking the seal.
   **Interaction**: Step through the ladder one arrow at a time; send a tampered assertion and watch the seal check fail.
   **Ending**: The SP app loaded, the scroll resting beside the certificate it was checked against.
   **Variants**: `identity-federation`, `identity-provider`, `openid-connect`.
   **Techniques**: exchange, token, path trace, failure, spotlight, caption.

**Review**: Improved — the plan said the browser "can't read" the assertion; it can, unless the assertion is separately encrypted. What it can't do is alter it without breaking the signature. Added the SP's other checks (audience, NotOnOrAfter, in-response-to) and the IdP-initiated variant, which the brief calls out as the flow people mix up. Alternative weighed: a notarised letter carried by a courier; that is already the scroll metaphor, kept.

### Multi-factor authentication (MFA) (`multi-factor-authentication`)

**The aha**: Two things from the same category — two passwords — isn't MFA, and methods vary hugely in how phishable they are.
**Misconception to defeat**: "Two-step" with the same factor type counts as multi-factor, or that MFA is binary rather than a spectrum of strength.
**Cast**: A badge with three factor slots: Know, Have, Are. A strength ladder: SMS code, TOTP app code, push approve/deny, push with number matching, FIDO2/passkey. A phishing site, a real-time phishing proxy and a SIM-swap icon as attack props.
**Opening frame**: Badge with only "Know" filled; the ladder dim.
**Story**:

1. A second password fills "Know" again; the slot indicator reads "same category x2." _"Two passwords isn't MFA."_
2. Reset; a code from a phone fills "Have" instead. _"Different categories: that's MFA."_
3. Climbing the ladder: an SMS code is intercepted by a SIM-swap. _"SMS: phishable, SIM-swappable."_
4. A TOTP code is relayed through a real-time phishing proxy within its 30-second window. _"Still phishable, just harder."_
5. A plain approve/deny push is buried under a flood of prompts and the user taps Approve. Number matching stops that (the user must type the number shown on the sign-in screen), but the proxy simply shows the victim that number. _"Number matching stops tired taps, not a live proxy."_
6. A FIDO2 key refuses to sign for the wrong site origin; the red cross lands on the attacker. _"Bound to the real site: unphishable."_
   **The moment**: The same attacker, same effort, climbing the ladder and finally failing only at the top rung.
   **Interaction**: Pick a factor combination and an attack, and see whether it breaks through.
   **Ending**: FIDO2 secured, the top rung lit, the attacker stalled.
   **Variants**: `passkeys-webauthn`, `conditional-access`.
   **Techniques**: contents, token, failure, spotlight, dial, caption.

**Review**: Improved — beat 5 had number matching "bypassed after a flood of prompts"; that is backwards, since number matching is the fix for prompt-bombing. The ladder now has plain push (fatigue works) and number matching (fatigue fails, a relaying proxy still works). Defeats the binary-MFA misconception through the climb itself. Alternative weighed: a checklist of factor types; the ladder with one attacker climbing it is more memorable.

### Passkeys, FIDO2 and WebAuthn (`passkeys-webauthn`)

**The aha**: The device holds a private key per site that is never sent to the server, and the signature is bound to the real site's origin, so even a perfect phishing copy gets nothing usable.
**Misconception to defeat**: Thinking it's just another MFA code, or that biometric data is sent to the server.
**Cast**: A device keyring with one key per site. A real site "bank.com" and a pixel-perfect phishing site "bankk.com" side by side. A fingerprint sensor whose loop stays local.
**Opening frame**: A keyring with "bank.com" and "email.com" keys; both sites waiting.
**Story**:

1. Registering at the real bank.com generates a new key pair: the public half flies to the server, the private half stays in the device's secure storage. _"A new key pair, one per site."_
2. Signing back in: the server sends a challenge; a local fingerprint unlock (the biometric never leaves the device) signs it with the matching private key, and the server verifies. _"Unlock locally, sign locally."_
3. The attacker's "bankk.com" asks for a key; the browser tells the device the site is bankk.com, none is registered there, and no passkey is even offered. Even a relayed request would fail: the signed data names bankk.com and the real server rejects it. _"Bound to the real origin. No match, no key."_
4. A ghost TOTP code fades in, typed into the fake site and relayed by the attacker, crossed out. _"A phishable code could be typed anywhere. A passkey can't."_
5. A synced passkey (cloud icon) is end-to-end encrypted across the user's own devices and survives a lost phone; a device-bound one (a hardware key) is lost with the device but exists nowhere else. _"Synced: recoverable. Device-bound: strongest."_
   **The moment**: Beat 3, the device silently refusing to even prompt, because the origin string itself doesn't match.
   **Interaction**: Try signing into the look-alike site and watch the refusal; toggle synced versus device-bound and lose the device.
   **Ending**: The real site signed in, the fake site empty-handed, origin strings compared side by side.
   **Variants**: `multi-factor-authentication`, `oauth-authorization-code-pkce`.
   **Techniques**: contents, token, failure, side by side, spotlight, caption.

**Review**: Improved — "never leaves it" was wrong for synced passkeys, which replicate (encrypted) between a user's devices; the aha now says never sent to the server, and beat 5 explains the trade-off. Beat 3 now shows both defences, the browser's origin scoping and the server's check of the origin inside the signed data. Checked: biometrics only unlock the local key. Alternative weighed: a lock that only fits one door; kept the keyring since the key-per-site is the visual.

### Conditional and risk-based access (`conditional-access`)

**The aha**: Access becomes "if/then" instead of "yes/no" — the same user gets different treatment depending on device, location and risk signals, evaluated at every sign-in.
**Misconception to defeat**: Confused with firewalls and IP allowlists, or thought to be the same thing as MFA.
**Cast**: A policy engine with signal inputs flowing in — device compliance, location, sign-in risk, app — and three outputs: green tick (allow), amber shield (step up), red cross (block).
**Opening frame**: The engine idle; a user approaching from a managed laptop, home city.
**Story**:

1. Managed laptop, home city, low risk: the engine outputs a green tick, no prompt. _"Trusted context: let them through."_
2. The same user from an unmanaged personal laptop: the engine outputs an amber shield and requires MFA, one of several grant controls beside "compliant device" and "block". _"Different device, different ask."_
3. The same user from a country they've never used, laptop compliant: risk spikes, the engine outputs a harder step-up. _"Risk signal raises the bar."_
4. The same user from a known bad IP: risk maxes out, the engine outputs a red cross with no prompt at all. _"Risk too high: just block."_
5. A device-by-location grid fills in (managed or not, home or abroad), each cell with its own outcome; sliding the risk dial up turns every cell toward step-up, then block. _"If/then, not yes/no. MFA is one answer, not the policy."_
   **The moment**: The same badge producing four different outcomes across beats 1–4.
   **Interaction**: Toggle device compliance, location and a risk slider, and watch the engine's output change live.
   **Ending**: The filled 2×2 outcome grid at rest.
   **Variants**: `multi-factor-authentication`, `zero-trust-architecture`, `identity-lifecycle`.
   **Techniques**: dial, choice, restyle, meter, caption.

**Review**: Improved — beat 5's 2x2 grid of device by location did not match the four outcomes shown (the bad-IP block is a risk case, not a cell), so the grid is now device x location with risk as an overlay dial. MFA-vs-conditional-access is defeated by showing MFA as just one grant control among several. Checked: policies re-evaluate at sign-in and can be re-checked mid-session. Alternative weighed: a bouncer with a rule list; the engine with live signals is more accurate.

### Identity lifecycle (joiner-mover-leaver) (`identity-lifecycle`)

**The aha**: Breaches hide in the transitions — movers keep old access, leavers keep working accounts — so automated deprovisioning and access reviews matter more than onboarding.
**Misconception to defeat**: Thinking identity management is just "create an account" once, a one-off event.
**Cast**: A timeline, Joiner to Mover to Leaver, with a badge travelling along it, growing permission tags. An HR system feeding events in. A periodic access-review magnifying glass.
**Opening frame**: Timeline at "Joiner," a badge freshly created with one tag, "Support Agent."
**Story**:

1. HR's "hired" event provisions the badge automatically into the needed apps. _"Joiner: provisioned from one source of truth."_
2. HR's "promoted" event adds a "Team Lead" tag; "Support Agent" is not removed, left stale. _"Mover: new access granted..."_
3. The badge now carries two tags, one no longer relevant, unnoticed. _"...old access often kept — privilege creep."_
4. The review magnifying glass sweeps across badges, catches the stale tag, an admin removes it. _"Reviews catch what onboarding misses."_
5. HR's "resigned" event fires for another badge; deprovisioning either fires instantly or lags for days while the account, and a leftover API token tied to it, keep working. _"Leaver: the gap between leaving and losing access."_
6. A hooded figure uses that leftover token during the lag. _"Automate it, or that gap gets used."_
   **The moment**: Beat 3, the stale tag sitting unnoticed on an otherwise normal badge — privilege creep as leftover, not granted-now.
   **Interaction**: Speed up time and watch tags accumulate; run a review; toggle instant versus delayed deprovisioning on a leaver event.
   **Ending**: A clean badge with exactly the tags its current role needs, reviews running on a visible cadence.
   **Variants**: `least-privilege`, `managed-workload-identity`, `secret-rotation`.
   **Techniques**: lanes, timer, contents, spotlight, failure, caption.

**Review**: Keep — the badge accumulating tags along a joiner/mover/leaver timeline makes privilege creep a visible leftover (beat 3), and beat 5-6 shows the leaver gap being exploited, not just named. Checked: HR as source of truth driving provisioning (SCIM-style), reviews as the catch for movers, stale tokens outliving the account. Alternative weighed: a hotel key-card return desk; no analogue for the mover case, which is the plan's best beat.

## OAuth 2.0, OpenID Connect and tokens

### OAuth 2.0 (delegated authorization) (`oauth2-delegated-authorization`)

**The aha**: The app never sees your password; it gets a scoped, expiring, revocable token to act on your behalf — OAuth answers "may this app do X?", not "who is this user?"
**Misconception to defeat**: Thinking OAuth logs you in (that's OIDC's job), or that it's just another kind of API key.
**Cast**: Resource Owner (user, left), Client (a third-party app, middle), Resource Server (an API holding photos, right, inside the trust boundary). An Authorization Server tower issuing a ticket (`scope: read:photos`, `exp: 1hr`).
**Opening frame**: The user's photos sit at the Resource Server; the Client wants to print some, but has no password field at all.
**Story**:

1. The Client asks the user, "Let PrintCo read your photos?": a consent screen, not a password form. _"Never asks for your password."_
2. The user approves at the Authorization Server, their own login, their own session; a sealed ticket is issued: `scope: read:photos`, `exp: 1 hour` (the exact hand-off is the next plan). _"A scoped, time-boxed ticket, not your credentials."_
3. The Client presents the ticket; the seal checks out, the scope covers reading, green tick; it tries to delete a photo and bounces with "insufficient scope". _"Only what the ticket allows."_
4. The `exp` field runs out and the next request bounces; separately, the user clicks Revoke in their account and the ticket dies early. _"Expires on its own, or you pull it."_
5. The Client asks the ticket "who is the user?" and it has no answer: it says what may be done, not who is there. A question mark, then a small "OIDC" tag. _"Permission to act, not proof of who signed in."_
6. A spoofed consent screen tricks the user into approving a wider scope, `read:photos, read:email`; the issued ticket carries it, usable by the attacker's app. _"Consent phishing: real token, wrong app."_
   **The moment**: Beat 2, the consent screen appearing in place of a password field, with the ticket's visible scope and expiry.
   **Interaction**: Widen or narrow the requested scope on the consent screen before approving, and watch what the Resource Server then allows.
   **Ending**: The expired ticket, scope clause highlighted, no password field ever existing.
   **Variants**: `oauth-authorization-code-pkce`, `openid-connect`, `oauth-client-credentials`.
   **Techniques**: boundary, token, exchange, timer, failure, caption.

**Review**: Improved — the "OAuth logs you in" misconception was named but never defeated on screen; beat 5 now has the client ask who the user is and get nothing. "Revocable" was in the aha but not shown, so beat 4 adds the user pulling the ticket. Checked: delete bouncing is a scope failure (403 insufficient_scope), and consent phishing yields a genuine token. Alternative weighed: a valet key that opens the door but not the boot; it is a good metaphor but hides the consent step, which is the point.

### Authorization code flow with PKCE (`oauth-authorization-code-pkce`)

**The aha**: Tokens never travel through the browser URL — a one-time code does — and PKCE makes a stolen code useless because only the app that started the flow holds the secret that unlocks it.
**Misconception to defeat**: Confusing this with the removed implicit flow, or thinking the code itself is as dangerous as a token.
**Cast**: A ladder with Browser, Client App, Authorization Server and the Token Endpoint. PKCE is a locked box (`code_verifier`, kept secret) and its hash (`code_challenge`, sent openly).
**Opening frame**: All lifelines idle; the Client is about to start a sign-in.
**Story**:

1. The Client generates a random `code_verifier`, locks it away, and sends only its SHA-256 hash, the `code_challenge`, in the sign-in request. _"Send the hash, keep the secret."_
2. The browser is redirected to the Authorization Server; the user authenticates. _"User signs in at the AS."_
3. The Authorization Server redirects back with a one-time code riding visibly in the URL, short-lived and spent on first use. Greyed inset: the removed implicit flow put the access token itself here. _"Only a code travels in the open. Not a token."_
4. Off-browser, the Client calls the Token Endpoint directly with the code and, only now, the `code_verifier`. _"Now prove you're the one who started this."_
5. The Token Endpoint hashes the verifier, matches it against the challenge it stored with that code, and only then hands back an access token, over the direct connection, never through the browser. _"Match confirmed: here's your token."_
6. A hooded figure intercepts the code from beat 3 (and saw the challenge too) and posts it to the Token Endpoint. A hash can't be run backwards and a guessed verifier fails the match: red cross. _"A stolen code alone is useless."_
   **The moment**: Beat 6, the stolen code arriving with nothing to unlock it — PKCE's point, shown as a key literally missing from a lock.
   **Interaction**: Step through the ladder arrow by arrow; try the attack with PKCE on and off. With it off, the intercepted code buys a token from a client that has no secret of its own.
   **Ending**: The Client holding a real token, the code long spent, the verifier's box empty, already revealed and consumed.
   **Variants**: `oauth2-delegated-authorization`, `oauth-client-credentials`, `oauth-refresh-tokens`.
   **Techniques**: exchange, token, failure, spotlight, path trace, caption.

**Review**: Improved — beat 6 made the failure "no verifier to reveal" without saying why the attacker, who saw the code_challenge, can't derive it; the one-way hash is now the explanation. Added the greyed implicit flow beside the code so the removed-flow confusion is visible, and the PKCE-off interaction shows what it is protecting. Checked: S256 challenge, code bound to the challenge, direct back-channel token request. Alternative weighed: a coat-check ticket; fits, but the hash-and-reveal ordering is the actual mechanism.

### Client credentials flow (`oauth-client-credentials`)

**The aha**: A machine authenticates as itself, with no user involved — the token represents the app, so its permissions must be tightly scoped, and the credential proving it should be a certificate, not a shared secret.
**Misconception to defeat**: Confused with the authorization code flow, or with API keys.
**Cast**: A ladder with just two lifelines, Service A and the Authorization Server. Service A holds either a shared secret (orange padlock, weaker) or a certificate (blue key, stronger).
**Opening frame**: Service A, no user, no browser lifeline, wanting to call an API on its own behalf.
**Story**:

1. Service A authenticates directly with its shared secret. _"No user, no redirect: the service proves itself."_
2. A token is issued whose `sub` is the service's own identity, scoped to what Service A itself is allowed. _"The token represents the app."_
3. Within scope, calls succeed; outside it ("delete:customers"), they bounce. _"Scoped to what the app needs."_
4. The shared secret leaks from a config file into a public repo; a hooded figure replays it at the Authorization Server and gets a valid token too. _"Leak the secret, and anyone can be the app."_
5. Service A swaps to a certificate: the private key stays in secure storage and signs a short-lived, single-use assertion for each token request. The repo now holds at most the public certificate; a captured assertion is already expired. _"Prove you hold a key. Nothing replayable to leak."_
   **The moment**: Beats 4 and 5 side by side: the identical repo leak succeeding against a shared secret and yielding nothing against a certificate.
   **Interaction**: Choose shared secret versus certificate as the credential, then "leak" it and see whether the attacker gets anywhere.
   **Ending**: Service A authenticated by certificate, scope tight, nothing reusable left to find.
   **Variants**: `oauth2-delegated-authorization`, `workload-identity-federation`, `managed-workload-identity`, `secret-sprawl`.
   **Techniques**: exchange, token, side by side, failure, restyle, caption.

**Review**: Improved — beat 5 claimed the same leak fails because a leaked assertion "can't be re-signed", muddling what leaked; it now says what the repo contains (a public certificate, not the key) and why a captured assertion is useless (expired, single-use). Noted the next rung (no stored key at all) via managed-workload-identity. Checked: private_key_jwt / certificate client authentication; leaked access tokens still work until `exp`, hence tight scope. Alternative weighed: leading with API keys; worse, it changes the subject.

### Device authorization (device code) flow (`oauth-device-code`)

**The aha**: Sign-in happens on a screen with a keyboard, not on the TV or terminal that lacks one — but the same mechanism lets an attacker trick a victim into approving a code for them.
**Misconception to defeat**: Confused with the authorization code flow, or with one-time passwords.
**Cast**: A ladder with Device (a TV or CLI, no keyboard), Authorization Server, and the User's Phone. Two codes: a short `user_code`, "WDJB-MKPQ", for the human to type, and a long secret `device_code` that only the device keeps and polls with.
**Opening frame**: The Device shows "Go to example.com/device and enter WDJB-MKPQ," a polling spinner beneath it.
**Story**:

1. The Device requests a code and gets back two: it shows the short `user_code` and a URL, keeps the long `device_code` private, and starts polling with it. _"A pairing code, not a password. It grants nothing on its own."_
2. On the Phone, the user opens the URL, enters the code, and signs in normally with password and MFA. _"Sign-in happens where there's a real keyboard."_
3. The user approves on the phone; the Authorization Server marks that pairing approved. _"Approval travels through you, not the device."_
4. The Device's polls return "authorization pending", then "slow down" if too fast, then finally a real token; the TV lights up. _"The device picks up the token once you say yes."_
5. A hooded figure starts the flow on their own device, then poses as tech support and sends the victim their `user_code`. The victim signs in and approves on their own phone; the attacker's device, polling with its own `device_code`, lights up with the victim's account. _"Device-code phishing: a real flow, a tricked approval."_
   **The moment**: Beat 5, the exact same honest flow pointed at the attacker's device instead of the user's own, with the user none the wiser.
   **Interaction**: Step the polling loop manually; play the phishing scenario by choosing which device the approval secretly authorizes.
   **Ending**: A lit-up device beside the question, "whose device did you just approve?", and a switch labelled "disable this flow where nothing needs it".
   **Variants**: `oauth-authorization-code-pkce`, `multi-factor-authentication`.
   **Techniques**: exchange, token, timer, failure, spotlight, caption.

**Review**: Improved — the user code and device code were one object, which hides how the attack works (the attacker owns the polling half). Now two codes: a human-typed pairing code and a secret device code. The OTP confusion is answered by the pairing code granting nothing alone. Checked against RFC 8628: pending, slow_down, polling interval, expiry. Alternative weighed: a TV remote pairing metaphor; fine but loses the phishing twist.

### Refresh tokens (`oauth-refresh-tokens`)

**The aha**: Short-lived access tokens limit damage if stolen; the refresh token carries the real session, so it's guarded harder, rotated on every use, with reuse of an old one signalling theft.
**Misconception to defeat**: Treating refresh tokens as just another access token, or safe to send to APIs.
**Cast**: A Client holding two tickets — a short-lived Access Token (`exp: 5 min`, sent to APIs) and a long-lived Refresh Token (`exp: 30 days`, sent only to the Authorization Server, locked in a drawer). A chain linking each refresh token to its successor.
**Opening frame**: Both tickets in hand, the Access Token fresh, the Refresh Token locked away.
**Story**:

1. The Access Token is used repeatedly, green ticks each time. _"Access token: used everywhere, lives briefly."_
2. Its timer runs out; the Client sends the Refresh Token, only to the Authorization Server, never to the API. _"Refresh token: sent to one place only."_
3. The Authorization Server issues a new Access Token and a new Refresh Token, chaining it to the old one, now marked "spent" but remembered. The Client's own rotation is silent. _"Rotated on every use. Legitimate use: quiet."_
4. A hooded figure replays an old, spent Refresh Token from a log; the server recognizes the spent link and revokes the whole chain, including the Client's current valid tokens. _"Reuse of a spent token: the whole family dies."_
5. Race: the attacker instead steals the current token and refreshes first, getting a fresh pair. The Client's next refresh presents what is now a spent token; the alarm fires and the attacker's new tokens die with the family. _"Whoever comes second trips the alarm."_
   **The moment**: Beat 4, a single spent-token reuse nuking an entire valid session chain.
   **Interaction**: Steal a token from different points in the chain and see whether it triggers the alarm; note that a steal-and-use before the real client refreshes works until the client's next refresh. A grace window exists for network retries.
   **Ending**: A fresh chain, one new link, the old spent chain crossed out below it.
   **Variants**: `sessions-vs-tokens`, `json-web-token`, `short-lived-credentials`.
   **Techniques**: timer, token, exchange, failure, spotlight, caption.

**Review**: Improved — the plan implied theft of an old token is the only case; the interesting one is stealing the current token, so a race beat shows detection arriving when the second party refreshes. The quiet-rotation contrast is folded into beat 3. Checked: rotation with reuse detection revoking the family is the OAuth security BCP's approach for public clients. Alternative weighed: a passport vs boarding pass; loses the chain and reuse alarm.

### OpenID Connect (OIDC) (`openid-connect`)

**The aha**: Alongside the access token, OIDC hands the client an ID token — proof of sign-in, meant for the client itself — and using one in place of the other is a classic, dangerous bug.
**Misconception to defeat**: Thinking OIDC is OAuth, or that ID and access tokens are interchangeable.
**Cast**: The OAuth cast, with the Authorization Server also an OIDC Provider. The sign-in request carried `scope=openid` (OIDC = OAuth plus this scope), so it issues two tickets at once: an ID Token (`aud: Client App`, name and email claims, nonce, sealed) and an Access Token (`aud: Resource API`, scope, sealed).
**Opening frame**: Sign-in just finished; both tickets sit unexamined in the Client's hand.
**Story**:

1. The Client checks the ID Token's signature, `iss`, `exp`, its own `nonce` and `aud`: "Client App," a match; it decodes the claims and shows "Welcome, Ada." _"ID token: proof of sign-in, for the client."_
2. The Client tries calling the API with the ID Token instead; the API checks `aud`, sees "Client App," not itself, and rejects it. _"Wrong audience: the API isn't who this was for."_
3. The Client sends the Access Token instead: `aud` matches the API, scope checks out, green tick, data flows. _"Access token: permission to call an API."_
4. A recap grid: correct pairings green, swapped pairings both red. _"Each has exactly one home."_
5. The UserInfo endpoint is shown as an optional extra: the Access Token fetches more profile claims there. _"Need more profile data? Ask, don't assume it's in the ID token."_
   **The moment**: Beat 2, the `aud` check failing visibly, turning an abstract rule into a concrete mismatch.
   **Interaction**: Swap which token goes where and watch the `aud` check pass or fail.
   **Ending**: The 2×2 grid from beat 4, both correct pairings green, both swaps red.
   **Variants**: `oauth2-delegated-authorization`, `json-web-token`, `sessions-vs-tokens`, `saml-sso`.
   **Techniques**: token, exchange, side by side, failure, spotlight, caption.

**Review**: Improved — the "OIDC is OAuth" misconception had no visible answer; the cast now shows the `openid` scope as the thing that makes the OAuth server return an ID token, and beat 1 validates nonce as well as `aud`. Checked: ID token is for the client; access token for the API; API-side `aud` rejection of an ID token is the correct failure. Alternative weighed: a passport (ID) vs visa (access); the passport/visa split is close but loses the aud check, which is what makes it concrete.

### JSON Web Token (JWT) (`json-web-token`)

**The aha**: A JWT is signed, not encrypted — anyone can read its claims — so what protects you is verifying the signature and checking issuer, audience and expiry, every time.
**Misconception to defeat**: Thinking a JWT is encrypted because it looks unreadable, or trusting its claims without verifying the seal.
**Cast**: A ticket split into three compartments behind glass: Header, Payload (`iss`, `sub`, `aud`, `exp`, `scope`, all plain text), Signature (a wax seal). A base64 "window" showing the payload is encoded, not hidden.
**Opening frame**: A whole JWT, all three compartments visible through the glass.
**Story**:

1. The Payload reads out in clear text: `iss https://idp.example`, `sub user-42`, `aud api.example`, `exp 14:32`, `scope read:orders`. _"The claims are just base64url: readable by anyone who holds it."_
2. A bystander, not even an attacker, decodes the base64url with no key at all and reads every field. _"Signed, not encrypted."_
3. A hooded figure edits `sub` to "user-1 (admin)" and re-encodes it; the Signature's seal visibly cracks. _"Change a claim, break the seal."_
4. A receiver checks the seal against the issuer's published keys: cracked, red cross, rejected. _"Verify the signature. Every time."_
5. A second receiver skips the seal check, or lets the token's own header pick the algorithm (`alg: none`), and reads the tampered admin claim as true. _"Skip verification, and the 'signed' claims are just claims."_
6. Two more tokens with intact seals are refused: one expired, one minted for another API (`aud` mismatch). _"A valid seal is not enough: check `iss`, `aud`, `exp`."_
   **The moment**: Beat 3's crack against beat 5's bypass: tampering is detectable, but only if someone checks.
   **Interaction**: Edit any claim and watch the seal crack; toggle signature verification on and off at the receiver.
   **Ending**: A verified token, seal intact, claims trusted, beside a cracked, rejected one.
   **Variants**: `openid-connect`, `oauth2-delegated-authorization`, `sessions-vs-tokens`, `digital-signatures`.
   **Techniques**: contents, failure, spotlight, timer, side by side, caption.

**Review**: Improved — added the real-world way verification gets skipped (`alg: none` / trusting the header's algorithm) and the confused-deputy case of a valid token for the wrong audience, which the original left to a single expiry beat. Checked: JWS is signed not encrypted (JWE is separate), base64url, issuer keys published via a JWKS. Alternative weighed: a wax-sealed letter; already the metaphor and kept.

### Sessions vs tokens (`sessions-vs-tokens`)

**The aha**: Server sessions are easy to revoke but need shared state; self-contained tokens scale but can't be recalled before they expire — and where the browser keeps either matters as much as which one you choose.
**Misconception to defeat**: "JWTs are always better than cookies," or thinking the storage choice doesn't matter.
**Cast**: Side by side. Left, "Session": a browser holding an opaque cookie, a server holding a lookup table. Right, "Token": a browser holding a JWT with claims baked in, no server table. Storage beneath each: a locked HttpOnly cookie jar versus an open localStorage shelf.
**Opening frame**: Both browsers signed in, working identically from the outside.
**Story**:

1. Left: every request sends the cookie; the server looks it up and serves the page. _"Session: the cookie is just a pointer."_
2. Right: every request sends the JWT; the server reads the claims directly. _"Token: self-contained, no server memory."_
3. An admin kills a compromised session now: left, the table row is deleted and the cookie is instantly useless; right, the JWT stays valid until `exp`. The usual fixes appear: a short `exp` with refresh, or a deny list, which brings back a server lookup. _"Revoke now: easy for sessions, hard for tokens."_
4. Load grows: the left server needs a shared lookup on every request (a cache like Redis makes it fast, but it is state to run and replicate); the right just verifies locally. _"Scale: tokens skip the shared lookup."_
5. An XSS script runs on the page: on the right, the token on an open localStorage shelf is copied away; on the left, the script cannot read the HttpOnly cookie, so nothing leaves (it can still act inside the open page). _"Storage matters more than the token type."_
   **The moment**: Beat 5, the identical XSS attack succeeding against an open shelf and failing against a locked jar, independent of session versus token.
   **Interaction**: Toggle HttpOnly, Secure and SameSite on the cookie, and storage location for the token; run the revoke-now and XSS scenarios against each.
   **Ending**: Both approaches labelled by trade-off, not by a winner.
   **Variants**: `json-web-token`, `oauth-refresh-tokens`, `cross-site-scripting`.
   **Techniques**: side by side, contents, meter, failure, toggle, caption.

**Review**: Improved — beat 4's "10,000 requests per second makes the lookup a bottleneck" was overstated (session stores handle that routinely); it now says the real cost, shared state to run. Beat 3 adds how token revocation is actually bolted on, and beat 5 admits an HttpOnly cookie stops theft, not in-page abuse. Alternative weighed: an event wristband vs a guest list; fits revocation but not the storage point, which the XSS beat makes the real lesson.

### API authentication methods (`api-authentication-methods`)

**The aha**: API keys, OAuth tokens, mTLS and request signing each prove a different thing; an API key typically only names the caller (no user, often no scope or expiry), so it's identification, not authorization.
**Misconception to defeat**: Treating an API key as equivalent to a token, or assuming TLS plus a credential proves this exact request is unchanged, when only a signature ties the credential to the body and the time.
**Cast**: Four lanes approaching the same API gate: an API key (flat string), an OAuth access token (scope and expiry visible), an mTLS handshake (certificates exchanged), a signed request (an HMAC stamp beside the body).
**Opening frame**: All four lanes approaching the gate simultaneously.
**Story**:

1. The API key is checked only against a list of known app names; no user, scope or expiry travels with it. _"An API key identifies the caller. Nothing more."_
2. The OAuth token's scope and `exp` are both checked; fine-grained, time-boxed. It is a bearer token: whoever holds it can use it. _"A token carries permission and a clock."_
3. mTLS exchanges and verifies certificates before any request body is sent; the gate knows which private key the caller holds. _"Proves possession of a key, every connection."_
4. The signed request's stamp is recomputed and compared; a replayed copy carries an old timestamp inside the stamp and is rejected. _"Signing proves the body wasn't changed, and blocks replay."_
5. Each credential is "stolen": the leaked key works until revoked; the leaked token works only until `exp`, within its scope. _"A leaked key is a leaked identity. A leaked token is a leaked, shrinking window."_
   **The moment**: The four lanes answering "who's calling?" with four different strengths of answer, side by side.
   **Interaction**: Leak each credential type and see how much damage window each gives an attacker.
   **Ending**: The four lanes at rest, each labelled by exactly what it proves.
   **Variants**: `oauth2-delegated-authorization`, `mutual-tls`, `digital-signatures`, `secrets-vault`.
   **Techniques**: lanes, token, timer, failure, side by side, caption.

**Review**: Improved — the aha overclaimed (API keys can carry scopes or expiry in some products), so it now says "typically"; the signing claim was loosened because TLS and mTLS already protect integrity in transit, and what only signing adds is binding credential to body and time. Noted bearer-token theft in beat 2. Checked: HMAC request signing (SigV4-style) with timestamp window defeats replay. Alternative weighed: four keys on a ring; the four lanes at one gate keep the strength comparison visible.

## Authorization and privileged access

### Role-based access control (RBAC) (`role-based-access-control`)

**The aha**: An assignment is "who + role + where," and it inherits downward through the hierarchy — a role granted high up silently reaches everything below.
**Misconception to defeat**: Confusing roles (what you can do) with groups (who you are), or ABAC with RBAC.
**Cast**: Nested scope boxes: Organization (management group), Subscription (account or project), Resource Group, Resource. A badge with a role tag attached at one level, plus a "Support team" group badge holding several people. "Inherits down" arrows cascading from wherever the tag sits.
**Opening frame**: A "Reader" tag attached at the Resource level, a single small box lit.
**Story**:

1. With the Reader tag at Resource level, the badge sees that one resource, red crosses elsewhere. _"Who + role + where, narrowly."_
2. Dragging "Reader" up to Resource Group cascades down, lighting every resource inside. _"Assign higher, reach further, automatically."_
3. Dragging "Contributor" up to Subscription by mistake cascades across an entire subscription's resource groups and resources. _"A role granted high up reaches everything below, whether you meant it or not."_
4. The "who" is swapped from one person to the Support team group; a new member joins and inherits the role with no new assignment. _"Roles are what. Groups are who."_
5. A pile of narrow custom roles accumulates on one badge; it is replaced by one well-scoped role at the right level. _"Too fine-grained is role explosion. Right role, right scope."_
   **The moment**: Beat 3, the cascade of green suddenly covering an entire subscription from one assignment made one level too high.
   **Interaction**: Drag a role tag to different levels of the hierarchy and watch what lights up below it.
   **Ending**: A tidy hierarchy, each badge's tag at the smallest scope that still does the job.
   **Variants**: `attribute-based-access-control`, `least-privilege`, `permission-guardrails`.
   **Techniques**: boundary, path trace, restyle, spotlight, contents, caption.

**Review**: Improved — the roles-vs-groups misconception was named but never shown; beat 4 now swaps the "who" for a group while the role stays the same. Hierarchy relabelled generically (management group, subscription/account/project) since inheritance down a tree is the idea, not Azure's names. Checked: assignment = principal + role + scope, additive and inherited downward. Alternative weighed: a building's key-cards by floor; the nested boxes already do it and the drag makes the mistake tangible.

### Attribute-based access control (ABAC) (`attribute-based-access-control`)

**The aha**: One rule evaluated against live attributes replaces hundreds of role assignments and adapts automatically — but whoever can change a tag can change access.
**Misconception to defeat**: Thinking it's RBAC with extra steps, or missing that tag-editors control access too.
**Cast**: A policy card, "Engineers may read resources tagged with their own project." A pool of tagged resources and a pool of tagged badges.
**Opening frame**: The policy card glowing, resources and badges scattered, unconnected.
**Story**:

1. Badge "Ada (eng, project:alpha)" requests a resource tagged "project:alpha": attributes match live, green tick. _"One rule, evaluated against attributes."_
2. The same Ada requests a "project:beta" resource: mismatch, red cross, no new rule was written. _"No new rule needed. The attributes decide."_
3. A new hire, "Priya (eng, project:gamma)," appears with zero manual role assignment; her tag alone decides what she sees. _"Scales without role explosion."_
4. A contrasting RBAC table, one role per project per person, flashes briefly and is crossed out. _"The role-table alternative."_
5. Someone with tag-editing rights retags a resource from "project:beta" to "project:alpha"; Ada can now read it, with no permission system ever touched. _"Whoever edits the tag edits the access."_
6. A hooded figure with tag-editing rights retags a sensitive resource into their own project, gaining access through the side door. _"The tag is the real lock."_
   **The moment**: Beats 5–6, access changing with zero visits to any access-control screen.
   **Interaction**: Edit a resource's tag or a badge's attribute live and watch access recompute instantly.
   **Ending**: The policy card resting over correctly tagged resources, tag-editing rights shown as their own guarded permission.
   **Variants**: `role-based-access-control`, `conditional-access`, `relationship-based-access-control`.
   **Techniques**: contents, restyle, failure, spotlight, caption.

**Review**: Keep — beats 1-3 show one rule replacing per-person assignments, 4 crosses out the RBAC table it replaces, and 5-6 turn on the real hazard (whoever edits a tag edits access) with the "zero visits to any access screen" moment. Checked: attributes on principal and resource evaluated at request time (AWS principal/resource tags, Azure role-assignment conditions). Alternative weighed: coloured wristbands at a festival; good for matching, but loses the tag-tampering attack, which the tag cast shows directly. Misconception (RBAC with extra steps) is defeated by beat 4; the tag-editor risk by beats 5-6.

### Relationship-based access control (ReBAC) (`relationship-based-access-control`)

**The aha**: Access becomes a path search through a graph of relationships — "can Alice view this document?" is answered by walking owner-of, member-of, parent-of edges, not by checking a role.
**Misconception to defeat**: Thinking it's just RBAC or ACLs with a different name.
**Cast**: A graph: Alice, member of, Design Team, editor of, Project Folder, contains, Doc.pdf. A query box, "Can Alice view Doc.pdf?" A small rules card: "editor includes viewer" and "viewers of a folder view what it contains" (the Google Drive / Zanzibar model; OpenFGA, SpiceDB).
**Opening frame**: The graph drawn, edges dim, the query box empty.
**Story**:

1. The query is submitted; a search token enters at Alice's node. _"The question becomes a path search."_
2. It walks "member of" to Design Team. _"Step 1: Alice is on this team."_
3. It walks "editor of" to Project Folder; the rules card lights: editors can view. _"Step 2: the team edits this folder, and editing includes viewing."_
4. It walks "contains" to Doc.pdf; the full path lights green. _"A found path is a yes."_
5. A second query for Bob, who shares none of these edges, wanders and finds no path: red cross. _"No path, no access."_
6. Alice is removed from Design Team; her edge vanishes, and the next query fails instantly, no role ever touched. _"Change the graph, change the access."_
7. A contrasting ACL would need Doc.pdf to list Alice directly; ReBAC inferred it through hops she was never explicitly granted. _"ACLs name the subject directly. ReBAC infers through relationships."_
   **The moment**: Beat 4, the lit three-edge path arriving at the document as the literal mechanism by which "yes" was decided.
   **Interaction**: Add or remove edges and re-run the query to see the path appear, break, or reroute.
   **Ending**: The graph with Alice's path highlighted, Bob's absence of one shown beside it.
   **Variants**: `role-based-access-control`, `attribute-based-access-control`.
   **Techniques**: path trace, contents, token, failure, spotlight, caption.

**Review**: Improved — the path stepped from "editor of" straight to a view answer without saying why editing allows viewing; a rules card now supplies the inheritance rules that make the walk legitimate. Named the real systems (Zanzibar-style). Checked: check = graph reachability with relation rewrites; removal takes effect on the next check. Alternative weighed: a family tree; clear for relationships, weaker for derived permissions, which the rules card adds.

### Default deny and policy evaluation (`default-deny-policy-evaluation`)

**The aha**: Effective access is the union of every applicable allow minus any explicit deny, starting from nothing — so debugging "access denied" means finding the missing allow or the hidden deny.
**Misconception to defeat**: Thinking policy evaluation works like firewall rules, where the first match wins.
**Cast**: A badge approaching a resource. A stack of policy statements flowing in from different sources — direct assignment, group membership, inherited scope — each tagged allow or deny. A backdrop reading "Ø — denied by default."
**Opening frame**: An empty backdrop, no policies yet.
**Story**:

1. An allow flows in from a direct role; the backdrop updates, the badge can read. _"Start from nothing. Add explicit allows."_
2. A second allow flows in from group membership; both union together: the badge can now read and write. _"Multiple allows combine."_
3. A deny flows in from an inherited parent-scope policy ("deny write, contractor restriction"); it overrides the group's allow outright. Write access disappears; read remains. _"An explicit deny wins over any allow."_
4. The owner, confused, sees their role visibly says "write"; the scene zooms out to the full stack, the deny highlighted as the real reason. _"Debugging: find the hidden deny, not just the missing allow."_
5. The statements are shuffled into a different order; the result is identical. Beside it, a firewall rule list where reordering changes the outcome is crossed out. _"Not first-match: order doesn't matter."_
6. The parent-scope deny is removed; write access returns instantly, with no role ever re-granted. _"Removing a deny can restore access the role already implied."_
   **The moment**: Beat 3, a single deny silently overriding a role that visibly says "write."
   **Interaction**: Add and remove allow and deny statements from different sources and watch the effective-access summary update live.
   **Ending**: "Effective access = union(allows) − any deny," with the current stack resolved beneath it.
   **Variants**: `permission-guardrails`, `role-based-access-control`, `attribute-based-access-control`.
   **Techniques**: layers, contents, restyle, spotlight, caption.

**Review**: Improved — the "first match wins like firewall rules" misconception was named but never defeated; a shuffle beat now shows order changing nothing. Beat 5 said a "guardrail-level" deny where beat 3 introduced a parent-scope deny, now consistent (guardrail ceilings are the next plan). Checked: implicit deny, then union of allows, then explicit deny overrides (AWS IAM same-account model). Alternative weighed: a traffic-light stack; the badge-plus-statements stack makes the debugging step visible.

### Permission guardrails (`permission-guardrails`)

**The aha**: Guardrails never grant anything — effective access is the intersection of what's granted and what the guardrail allows — which lets you delegate admin power safely.
**Misconception to defeat**: Confusing a guardrail with an RBAC grant, or treating "policy as code" as the same layer.
**Cast**: Two overlapping circles: a large "Granted" circle (everything RBAC has given a badge) and a "Guardrail ceiling" circle (the organization-level cap). Their overlap, shaded, is the actual effective access.
**Opening frame**: A huge Granted circle (badge is "Owner") beside a much smaller Guardrail circle, not yet overlapping.
**Story**:

1. The circles slide together; only their overlap shades green, far smaller than Granted alone. _"Effective access: the overlap, not the grant."_
2. The Owner badge tries an action the org-wide guardrail forbids: red cross, even though RBAC alone would allow it. _"A guardrail caps you, however much you're granted."_
3. "Owner" is delegated to a junior engineer's badge; the same ceiling bounds them, so their overlap is the same small shape. _"Delegate freely: the ceiling still bounds them."_
4. An org admin (a separate, higher-privileged action) widens the ceiling. A badge with a small grant gains nothing; the overlap grows only where grants already exist. _"A ceiling grants nothing. Widening it only frees what was granted."_
5. Without any guardrail circle at all, the Owner badge's full, unconstrained Granted circle stands alone. _"Without a ceiling, 'Owner' really does mean everything."_
   **The moment**: Beat 2, the maximally granted "Owner" badge still bouncing off the ceiling.
   **Interaction**: Resize the Granted circle (the role) and the Guardrail circle (the policy) independently and watch the overlap resize.
   **Ending**: A stable, small, deliberate overlap labelled "effective access," both source circles visible around it; a caption notes that policy as code is how the ceiling is written and reviewed, not a third circle.
   **Variants**: `default-deny-policy-evaluation`, `role-based-access-control`, `least-privilege`.
   **Techniques**: boundary, side by side, restyle, failure, dial, caption.

**Review**: Improved — "guardrails never grant" was asserted but not shown; beat 4 now widens the ceiling over a badge with no grant and nothing appears. Beat 3 no longer implies safety outright, only that the same bound applies. Checked: AWS SCPs and permission boundaries and Azure's deny-style controls intersect with, and never add to, grants. Alternative weighed: a speed limiter on an engine; fits, but two overlapping sets let you see the intersection.

### Privilege escalation (`privilege-escalation`)

**The aha**: Any permission that can change permissions is effectively admin — creating keys for a stronger identity, attaching a powerful role to compute you control — so hunt for the paths, not just the admin role itself.
**Misconception to defeat**: Thinking only the literal "Admin" role is dangerous, or confusing this with lateral movement or IDOR.
**Cast**: A low-privilege badge, "Deployer — can create VMs and attach roles to them." A role graph with a glowing "Admin" role far away. A chain of small, innocuous permissions linking them.
**Opening frame**: The Deployer badge, visibly far from Admin on the graph, looking harmless.
**Story**:

1. Deployer's permission list reads "create:VM," "attach:role-to-VM"; neither mentions admin. _"None of this says 'admin.'"_
2. Deployer creates a VM, an ordinary, allowed action. _"Step 1: an ordinary action."_
3. Deployer attaches the "Admin" role to that VM, also technically allowed, since "attach:role-to-VM" doesn't check which role. _"Step 2: attach the powerful role to something you control."_
4. Deployer runs code on the VM and fetches its Admin token; a two-hop path from Deployer to Admin lights up, running up the graph, not sideways. The permission list is unchanged. _"Any permission that can change permissions is admin."_
5. A scanner sweeps the whole graph for quiet multi-hop paths to Admin, lighting several unexpected ones red. _"Hunt for the paths, not just the label."_
   **The moment**: Beat 4, the Deployer badge's own permission list staying exactly the same while its effective power silently becomes Admin.
   **Interaction**: Pick a low-privilege role and let the scanner search for escalation paths; click a found path to walk it step by step.
   **Ending**: The role graph with every quiet escalation path lit red, Admin reachable from more places than its own label suggests.
   **Variants**: `blast-radius`, `just-in-time-privileged-access`, `role-based-access-control`.
   **Techniques**: path trace, spotlight, contents, restyle, caption.

**Review**: Improved — the beat skipped how attaching a role becomes power (Deployer runs code on the VM and takes its token), and the misconception about lateral movement/IDOR was only named; the path now visibly climbs the graph, not sideways. Checked: this is the classic PassRole-plus-create-compute pattern; permissions that edit policies, create keys or pass roles are equivalent to admin. Alternative weighed: a stolen master key narrative; the quiet two-step is the sharper surprise.

### Just-in-time and privileged access management (`just-in-time-privileged-access`)

**The aha**: Standing admin rights are always there for an attacker to find; JIT privilege exists for one hour because someone asked, justified it, and got approved by someone else.
**Misconception to defeat**: Confusing this with least privilege (how much, not for how long), or with bastion hosts.
**Cast**: Two badges, "Standing Admin" (role permanently lit, timer "infinity") and "Eligible Admin" (role dark, timer "0," an Activate button, an approver badge). Two labelled axes: least privilege answers "how much", JIT answers "how long".
**Opening frame**: Standing Admin's role glowing steadily; Eligible Admin's role dark.
**Story**:

1. A hooded figure steals Standing Admin's credentials at 3am; the admin role is instantly usable, no activation needed. _"Standing privilege: always there, whenever it's stolen."_
2. The same attacker steals Eligible Admin's credentials; the role is dark, and activation needs MFA, a justification and an approver the attacker doesn't have. Red cross. _"Eligible: off until specifically turned on."_
3. The real owner requests activation with a reason; a different approver badge reviews and approves. _"Separation of duties: not a rubber stamp."_
4. The role lights up, a one-hour timer counts down, every action is logged with session recording. _"On for exactly as long as asked."_
5. The timer hits zero; the role goes dark again automatically, nothing to remember to revoke. _"Time's up. Access gone on its own."_
6. A break-glass account sits vaulted beside the normal flow, usable only when approval chains are down, and heavily logged on use. _"An emergency door, watched closely."_
   **The moment**: Beat 2 against beat 1, the identical theft succeeding instantly against Standing Admin and stalling completely against Eligible Admin.
   **Interaction**: Steal each badge's credentials and try to use admin power; walk through a real activation including choosing an approver.
   **Ending**: Eligible Admin's timer back at zero, role dark, a clean audit trail of the one hour it was lit.
   **Variants**: `least-privilege`, `privilege-escalation`, `bastion-host`, `identity-lifecycle`.
   **Techniques**: timer, token, exchange, failure, spotlight, caption.

**Review**: Improved — the confusion with least privilege (how much vs how long) was only in the text; two labelled axes now sit in the cast. Activation shown to require MFA as well as justification and approval, since a stolen password alone must not activate it. Checked: eligible vs active assignments, time-boxed activation, approval and logging as in Entra PIM / AWS-style JIT. Alternative weighed: a hotel safe checked out at the desk; same, but the dark role next to the lit one is the clearer contrast.

## Workload identity and secrets

### Managed workload identity (`managed-workload-identity`)

**The aha**: The platform gives a workload its own identity and hands it short-lived tokens from a local endpoint, so code calls cloud APIs with no stored secret to leak, rotate or commit.
**Misconception to defeat**: Thinking this is just a service-account key or client secret stored "more securely."
**Cast**: A VM with a badge pinned to it and a local metadata endpoint reachable only from inside it. Outside, a repo holding the old way: a committed key file.
**Opening frame**: The VM with its badge, its metadata endpoint beside it, idle.
**Story**:

1. The old way, greyed: a key file is generated, downloaded and pasted into a config and a `.env` file, sitting there indefinitely. _"The old way: a secret that has to live somewhere."_
2. The new way: the VM's code asks its local metadata endpoint for a token, no file, no download. _"Ask the platform, right here, right now."_
3. Recognizing the VM by its badge, the endpoint hands back a sealed token with a short `exp` (about an hour; it varies by cloud). _"A fresh, short-lived token, not a stored key."_
4. The timer runs out; the code simply asks again and gets a new one, no human involved. _"It expires and renews itself."_
5. A hooded figure steals beat 1's old key file from a backup; it still works until manually revoked. The same attacker tries the new way: there's no file to steal, and a token can only be requested from inside this VM. _"Nothing to leak, because nothing was ever handed out to leak."_
6. The metadata endpoint is reachable only from inside the VM, outside attempts bounce. But "inside" means any code running there: an SSRF bug in the app lets an attacker ask for a token. _"No secret needed to ask, so anything running here can ask. Keep the identity's permissions small."_
   **The moment**: Beat 5, the old key file still dangerous years later, against the new approach having no file to steal at all.
   **Interaction**: Try reaching the metadata endpoint from outside versus inside the VM; let a token's timer run out and watch it auto-renew.
   **Ending**: The VM quietly calling cloud APIs, badge pinned, no secret file in sight.
   **Variants**: `workload-identity-federation`, `short-lived-credentials`, `secrets-vault`, `secret-sprawl`.
   **Techniques**: boundary, token, timer, failure, side by side, caption.

**Review**: Improved — the token lifetime "15 minutes" matched none of the platforms (roughly an hour on GCP, hours on AWS instance profiles, up to a day on Azure managed identity), so it now says short and varies. Beat 6 praised the endpoint's reachability without admitting the SSRF hole (the Capital One pattern), which is why scope still matters. Checked: no stored secret, platform-attested identity, auto-renewing tokens. Alternative weighed: a hotel key-card issued at check-in; the metadata endpoint's local reachability is the part to see.

### Workload identity federation (`workload-identity-federation`)

**The aha**: The cloud trusts an external issuer for specific subjects — this repo, this branch — instead of you storing a long-lived cloud key in CI; but the trust condition is the security, and too broad a condition means any matching workload can assume the role.
**Misconception to defeat**: Confusing this with managed identity (for workloads already inside the cloud), or thinking the external token itself is the cloud credential.
**Cast**: A CI pipeline outside the boundary holding its own platform-issued OIDC token (`iss: token.actions.githubusercontent.com`, `sub: repo:org/app:ref:refs/heads/main`). A Cloud Role inside with a trust-policy card. An exchange booth at the boundary.
**Opening frame**: The CI pipeline outside, its own token in hand; the Cloud Role's trust policy showing one accepted subject pattern; no cloud key stored in CI.
**Story**:

1. The old way, greyed: a long-lived cloud access key sits as a secret in CI settings, usable forever once copied out. _"The old way: a cloud key, stored in CI."_
2. The new way: CI presents its own platform-issued token at the booth. First it tries the same token directly at the cloud API: refused, it is not a cloud credential. _"The CI token is only an introduction."_
3. The booth checks the signature against the issuer's published keys, then `iss`, `aud` and `sub` against the trust policy, an exact match; a short-lived cloud credential is minted in exchange, nothing stored. _"The cloud trusts the issuer, for this exact subject."_
4. A different pipeline, same platform, different repo, presents its token; `sub` doesn't match, red cross at the booth. _"Trust is scoped to a specific subject, not 'anything from GitHub.'"_
5. The trust policy is loosened to accept any repo and branch in the org by mistake; now a pull-request branch in an unrelated, less-trusted repo gets through too. _"Too broad a condition, and any matching workload gets in."_
   **The moment**: Beat 5, the same booth, same mechanism, only a wildcard changed, turning tight trust into wide-open trust.
   **Interaction**: Edit the trust policy's subject pattern and test different CI tokens against it.
   **Ending**: A correctly scoped trust policy, the booth quiet, no cloud key stored anywhere in CI.
   **Variants**: `managed-workload-identity`, `oauth-client-credentials`, `identity-federation`.
   **Techniques**: boundary, exchange, token, failure, spotlight, caption.

**Review**: Improved — the "external token is the cloud credential" misconception was named but not defeated; the CI token now bounces at the cloud API directly and works only through the exchange. The booth also checks signature and `aud`, not just `sub`. Checked: GitHub's issuer and `sub` format, exchange via AssumeRoleWithWebIdentity-style STS, wildcard `sub` as the classic misconfiguration. Alternative weighed: a visitor badge at reception; a booth with a visible policy card is better for the wildcard moment.

### Secrets management vault (`secrets-vault`)

**The aha**: Secrets live in one audited place and are pulled at runtime by an authenticated identity, so you know who read what and can rotate or revoke centrally instead of hunting copies everywhere.
**Misconception to defeat**: Confusing a vault with a KMS (which stores keys and does crypto, not arbitrary values), or with environment variables.
**Cast**: A vault building with shelves of sealed, versioned envelopes (DB password, API key, connection string, certificate). Apps approaching as badges, authenticating at the door. An audit log scrolling beneath.
**Opening frame**: Sealed envelopes on shelves, door shut, apps queued outside with no local secrets of their own.
**Story**:

1. App A authenticates at the door with its own workload identity (not another stored secret) and requests "DB password"; the door opens just for that envelope, which flies to App A, nothing stored locally afterward. _"Pulled at runtime by an authenticated identity."_
2. The audit log records, "App A read DB-password, 09:14." _"You know who read what, and when."_
3. To find who has access to a compromised secret, the team checks the vault's access list for that one envelope, not every app's config files. _"One place to check, not a hunt."_
4. The DB password is rotated: a new envelope replaces the old on the shelf; App A's next request automatically gets the new version. _"Rotate centrally, apps just ask again."_
5. A greyed-out "before" picture shows the same password copied into five apps' configs, `.env` files and a chat message, with no telling who still has a copy. _"Versus: copies everywhere, no telling who has one."_
6. Side by side: the vault hands you the value to use; a key management service never releases its key, you send data in and get ciphertext back. _"A vault stores secrets you use. A KMS does cryptography with keys you never see."_
   **The moment**: Beat 3, the audit log answering in one lookup a question that would otherwise mean searching every app in the company.
   **Interaction**: Request different secrets as different app badges and watch the audit log fill in; rotate a secret and watch old copies go stale.
   **Ending**: Vault shelves tidy, audit log current, no envelope duplicated outside its walls.
   **Variants**: `secret-sprawl`, `secret-rotation`, `key-management-service`, `managed-workload-identity`.
   **Techniques**: contents, exchange, token, layers, caption.

**Review**: Improved — the vault-vs-KMS misconception was named but never shown; beat 6 contrasts handing out a value with doing crypto without releasing the key. Beat 1 now says the app authenticates by workload identity, otherwise the vault only moves the stored-secret problem to the door. Checked: runtime retrieval, per-secret audit and versioning. Alternative weighed: a bank safe-deposit box; fine for storage, hides the identity and audit points.

### Secret sprawl and leaked credentials (`secret-sprawl`)

**The aha**: Cloud keys pushed to public repositories are found and abused within minutes by automated scanners, and deleting the commit doesn't help because history and forks keep it — you must revoke and rotate.
**Misconception to defeat**: Thinking a follow-up commit deleting the file, or a brief window as a public repo, makes the leak safe.
**Cast**: A secret envelope duplicated across source code, a `.env` file, a CI variable, a container layer, a log line, a chat message. One copy lands in a public repository. A hooded figure's automated scanner bot.
**Opening frame**: One secret, with faint duplicate outlines fanning to all six locations.
**Story**:

1. A developer commits a config file with the secret to a public repo; a clock starts at "00:00." _"Pushed to a public repo..."_
2. The scanner bot finds it at "00:03" and uses the key for crypto-mining compute; a cost meter spikes hard. _"...found by scanners within minutes, abused automatically."_
3. The developer deletes the file in a new commit, relieved, but the secret still glows in the commit history, one click back, and in a fork made seconds after beat 2. _"Deleting the commit doesn't delete the history, or the forks."_
4. The key is revoked at its source and a new one rotated in; the bot's copy stops working, and so, at the same instant, do the other five copies in `.env`, CI variable, container layer, log line and chat message. _"Revoke and rotate. It kills every copy, even the ones you never found."_
5. A push-protection gate is added to the repo; the next attempted secret commit is blocked before it ships. _"Secret scanning with push protection: stop it before it ships."_
   **The moment**: Beat 3, the "deleted" file still glowing in history and a fork, directly contradicting the developer's relief.
   **Interaction**: Try deleting the file versus revoking the key; add push protection and try committing a secret.
   **Ending**: The key revoked and rotated, push protection active, the cost meter flat.
   **Variants**: `secrets-vault`, `secret-rotation`, `software-supply-chain-attack`, `cicd-pipeline-security`.
   **Techniques**: clone, timer, failure, meter, spotlight, caption.

**Review**: Improved — the opening showed six copies fanning out but the story only used one; the revoke beat now kills all six at once, which is why revocation, not hunting, is the fix. Timings are illustrative (scanners are fast, minutes is the documented order). Checked: history and forks keep deleted commits; rewrite history is not remediation; revoke, rotate, then review what the key did. Alternative weighed: leading with a leaked-key cost horror story; the clock and cost meter already carry it.

### Secret rotation (`secret-rotation`)

**The aha**: Zero-downtime rotation needs overlap — create the new secret, roll it out, switch over, then revoke the old one — and systems built for exactly one valid secret break on rotation day.
**Misconception to defeat**: Thinking rotation means swapping the old value instantly everywhere, or confusing it with key rotation, which keeps old versions to decrypt existing data.
**Cast**: A secret slot holding one envelope, "DB password: v3." Three app instances using it. A rotation lever. A timeline strip for the overlap window.
**Opening frame**: All three instances using v3, the slot showing only v3 as valid.
**Story**:

1. A naive pull of the lever revokes v3 instantly and installs v4 with no overlap; two instances mid-request with cached v3 bounce red. _"Swap instantly, break what's mid-flight."_
2. Rewind: v4 is created alongside v3, both valid at once. _"Step 1: create the new secret. Old one still works."_
3. Instances are rolled over to v4 one at a time while the rest keep succeeding on v3. _"Step 2: roll out the new one gradually. Nothing breaks."_
4. Once all three confirm v4, v3 is finally revoked. _"Step 3: only now, revoke the old one."_
5. A database accepts one password per user, so overlap is impossible. The fix: two users, `app_a` and `app_b`; rotate the idle one, switch the apps to it, then retire the other. _"One password per user? Keep two users and alternate."_
6. Inset: encryption key rotation is a different thing; the new key encrypts new data and old versions are kept to decrypt what already exists. _"Not this: key rotation keeps the old versions."_
   **The moment**: Beat 1 against beats 2–4 — the same goal, one approach breaking live traffic, the other sailing through on a brief overlap.
   **Interaction**: Pull the rotation lever with overlap toggled on or off and watch the three instances succeed or fail.
   **Ending**: The slot holding only v4, all three instances green, no gap in service.
   **Variants**: `secrets-vault`, `secret-sprawl`, `key-rotation`, `certificate-lifecycle`.
   **Techniques**: toggle, timer, side by side, failure, contents, caption.

**Review**: Improved — beat 5 ended on a maintenance window, but the standard answer to single-secret systems is alternating two users, which keeps zero downtime; the window is now only the last resort. The secret-vs-key rotation misconception had no beat, so a short inset contrasts them. Checked: create, deploy, verify, revoke ordering (AWS Secrets Manager's alternating-user strategy). Alternative weighed: changing a lock while people are inside; the three-instance overlap shows the cost better.

### Short-lived and dynamic credentials (`short-lived-credentials`)

**The aha**: A credential that expires in 15 minutes is a small problem when it leaks, with nothing to rotate — but the catch is the caller still needs an identity to request one in the first place.
**Misconception to defeat**: Confusing this with secret rotation, or with session tokens generally.
**Cast**: A request booth that mints a brand-new, single-purpose credential on demand. Three parallel lanes: a temporary cloud security token, a per-request database user, a signed URL for one file.
**Opening frame**: The booth idle, three lanes waiting, nothing minted yet.
**Story**:

1. A workload with its own badge asks for cloud access and gets a token minted fresh, `exp: 15 min`, scoped to this task. _"Minted on demand, not stored."_
2. A web app asks for database access on one request's behalf and gets a brand-new DB user with narrow grants, destroyed when the request ends. _"A user that exists for one request."_
3. A service generates a signed URL for one file, valid ten minutes, usable by anyone holding the URL but only within that window. _"Anyone can use it, but only briefly."_
4. A hooded figure copies lane 1's token mid-flight; at minute 5 it works, but only within its narrow scope; at minute 20 it is expired, red cross. _"A window, not forever."_
5. Zooming out, all three lanes required the caller to already have an identity before the booth would mint anything. _"The catch: you still need an identity to ask with."_
6. An anonymous, badge-less caller tries the booth directly: red cross immediately. _"No identity, no credential: back to workload identity."_
   **The moment**: Beat 4, the stolen token working briefly then dying on its own, against beat 6 showing the booth itself isn't free to use.
   **Interaction**: Steal a credential from any lane and try it before and after expiry; request one with no identity.
   **Ending**: All three lanes' credentials expired and gone on their own, booth waiting for the next authenticated request.
   **Variants**: `managed-workload-identity`, `secret-rotation`, `oauth-refresh-tokens`.
   **Techniques**: timer, token, failure, lanes, spotlight, caption.

**Review**: Improved — beat 4 implied a stolen short-lived token is harmless; a thief still gets minutes of scoped access, so it now shows the token working at minute 5 and dead at 20, making the point "small window" rather than "no problem". Checked: 15 minutes is the AWS STS minimum, presigned URLs cannot be recalled before expiry, per-request DB users are Vault-style dynamic secrets. Alternative weighed: a hotel day pass; the three lanes show that the same idea spans cloud, database and storage.
