# Google Cloud plans, part 1

Stage 2 plans for `catalog/gcp.md` groups 1 to 6 (resource hierarchy and organisation; geography
and resilience; identity and access management; VPC networking; hybrid and multi-network
connectivity; load balancing and the edge), in catalog order.

## Shared visual language

- **Hierarchy as nested frames.** A dashed outer frame "Organization: example.com" (a small Cloud
  Identity icon in its corner) contains folder frames (a folder icon, solid border), which contain
  project frames (a Google Cloud project icon, a project ID chip), which contain the actual
  resources. Zooming into a frame reveals what it holds; zooming out shows where it sits.
- **A VPC network as one global frame.** A wide, pale frame labelled with the network's name and a
  globe icon spans the full width of the stage. Region bands sit inside it (`us-central1`,
  `europe-west1`, `asia-southeast1`, drawn as light vertical columns), each holding its own regional
  subnet frame (a subnet icon, a CIDR range). The network frame itself is reused across every VPC
  concept; only the subnets, VMs and backends move inside the region bands. A regional network
  (AWS VPC, Azure VNet) drawn for contrast is exactly one region band wide — it cannot cross into
  the next band.
- **IAM bindings.** A principal is a small rounded badge (a person icon for a user, a ring of
  people for a group, a gear for a service account). A role is a coloured pill
  (`roles/storage.objectViewer`). A binding is the badge and the pill joined by a ribbon landing on
  the resource frame it applies to — this is the new **bind** technique, below. Where a binding is
  set on an ancestor frame, the ribbon is drawn there and fainter copies fade in on every descendant
  frame, showing inheritance without redrawing the hierarchy.
- **Requests and packets as tokens**: a small dot for a packet, a small envelope for an API call or
  a signed request, labelled with just enough (`GET /`, a token type) and travelling along a drawn
  arrow at the speed the beat wants.
- **The global external load balancer** is one recurring icon: a small globe with an anycast IP
  chip (`34.8.x.x`) above a ring of user dots scattered across a world outline, arrows fanning down
  from the IP into backend regions.
- **"X vs Y" comparisons** run the same token through two setups side by side, in sync, so a viewer
  watches one succeed where the other stalls, leaks or costs more.
- **"Which service do I use" concepts** are a short vertical question path (a diamond per question,
  a short label) that a viewer's answers light one path through, ending on the one matching real
  Google Cloud icon, the rest left dim.

One technique is new to the vocabulary:

- **bind**: a persistent, labelled connector between two elements that travels with them, rather
  than a token that passes through once — a role ribbon between a principal and a resource, a tag
  attached to a VM. Unlike `token` (moves once, along a path, then is gone), a bind stays until
  removed, and inheritance or revocation is shown by the ribbon fading in on descendants or
  snapping away.

## Resource hierarchy and organisation

### Resource hierarchy (`gcp-resource-hierarchy`)

**The aha**: Where a resource sits in the organization → folder → project tree decides what policy
flows down onto it, so the tree should mirror how you govern, not how you browse.
**Misconception to defeat**: That the tree is just a folder-like way to organise and find things,
like a file browser, with no consequence to placement.
**Cast**: Top frame "Organization: example.com" (Cloud Identity icon). Inside, folder icons
"Production", "Non-production", with one nested folder "Production > EU-regulated". Inside
folders, project frames with a project icon and ID chip. Inside projects, small resource icons (a
VM, a bucket). IAM ribbons are blue, org-policy ribbons amber, so the two layers never blur.
**Opening frame**: The full tree, collapsed to outlines, labelled, nothing lit. _"Everything lives
in one tree."_
**Story**:

1. Zoom into the Organization frame; a role pill "Security Admin" ribbons onto it, then fainter
   copies fade onto every folder, project and resource beneath. _"Grant high, it reaches everywhere
   below."_
2. Add child folder "EU-regulated" inside "Production"; an amber org policy pill
   "gcp.resourceLocations: europe" binds to it, copying down onto its one project. _"Folders nest,
   policy nests with them."_
3. Bind "prod-operators: Editor" onto Production and "dev-team: Editor" onto Non-production; each
   copies down onto its own projects. Drag project "checkout" from Non-production into Production:
   its border recolours, dev-team's copy fades off, prod-operators' copy fades on, and the VM and
   bucket inside never change. _"Move it, and it inherits differently."_
4. Highlight the billing account icon floating outside the tree, linked to a project by a dashed
   line, not a ribbon. _"Billing links in, but it isn't a node of this tree."_
5. Contrast inset: the same shapes drawn as a flat list of projects, labelled "browsing", beside the
   governed tree with ribbons, labelled "governing". _"It's not for browsing. It's for
   inheritance."_
   **The moment**: Beat 3, moving the project and watching one set of ribbons swap for another with
   no edit made inside it.
   **Interaction**: Drag any folder or project to a new parent and watch which ribbons appear and
   fade.
   **Ending**: The full tree, ribbons settled. _"Where it sits is what it inherits."_
   **Variants**: `gcp-project`, `gcp-organization-policy`, `gcp-iam-policy-inheritance`; AWS
   Organizations OUs, Azure management groups.
   **Techniques**: boundary, bind, move, restyle, zoom, caption.
   **Review**: Improved — beat 3 moved a project between folders that had no ribbons of their own, so
   nothing could swap; added the two folder bindings, and used the real constraint name
   (`gcp.resourceLocations`). Weighed opening on the move (the payoff) and rejected it: a newcomer
   needs the downward flow first. Checked: org → folder → project, billing account outside the tree.

### Project (`gcp-project`)

**The aha**: The project is Google Cloud's unit of isolation and cost — APIs, quotas, IAM and one
billing account are all scoped to it, and three different names (ID, number, display name)
identify it.
**Misconception to defeat**: That "project" is just a folder label, interchangeable with its
display name.
**Cast**: One project frame holding three stacked chips: display name "Checkout service" (pencil
icon, editable), project ID "checkout-svc-492" (lock icon), project number "728193405611" (gear,
Google-assigned). Around the frame: an APIs panel of toggles, a quota meter, one line to a billing
account icon. A second, empty project beside it.
**Opening frame**: The frame with its three identity chips and an empty API panel. _"One container,
three names."_
**Story**:

1. Rename the display name to "Checkout v2" — the ID chip and number chip don't move. _"The name is
   just a label."_
2. Try to edit the ID chip: red flash, "can't change; unique across Google Cloud". _"The ID is
   forever."_
3. Toggle on "Compute Engine API" in the panel — a small padlock on that API opens only inside this
   frame. The second project shows the same API still locked. _"Enabled per project, not
   account-wide."_
4. A quota meter fills toward its cap inside the frame; the neighbour's identical meter sits
   untouched. _"Quotas count per project too."_
5. Draw a line from the frame to a billing account icon; try to draw a second line to another
   billing account — it bounces. _"One billing account at a time."_
6. Delete the project: the frame greys, a 30-day countdown appears over it. Click "Restore" with
   days left and it returns; let it hit zero and everything inside vanishes. _"Delete the project,
   delete everything in it — after a 30-day grace."_
   **The moment**: Beat 3, the toggle lit in one frame and dark in its twin, pinning down "per
   project" viscerally.
   **Interaction**: Click to enable or disable an API, push a quota meter, try to attach a second
   billing account, or restore a deleted project before its countdown ends.
   **Ending**: The frame with its three chips and one billing line. _"ID, number, name — only the ID
   is forever."_
   **Variants**: `gcp-resource-hierarchy`; AWS account, Azure subscription or resource group.
   **Techniques**: contents, restyle, failure, meter, timer, side by side, caption.
   **Review**: Improved — "exactly one" billing account became "one at a time" (a project can be
   unlinked), and the deletion beat now shows the 30-day restore, not only the loss. Weighed leading
   with the delete (most vivid) and kept the three-names opening: the misconception is about naming.
   Checked: ID immutable and globally unique, number Google-assigned, APIs and quotas per project,
   30-day soft delete.

### Organization policies and constraints (`gcp-organization-policy`)

**The aha**: Org policy decides what configurations are allowed at all, even for an Owner — a
separate layer from IAM's who-may-act.
**Misconception to defeat**: Confusing org policy with an IAM deny policy, which blocks named
principals from actions, rather than blocking a configuration for everyone.
**Cast**: Two sibling folders, "Production" (with an amber constraint pill
`constraints/compute.vmExternalIpAccess: deny all` bound on it) and "Sandbox" (none), each holding
a project. The same "Owner" badge with a full key in both. A "create VM" form with an "external IP"
checkbox. A two-gate strip in front of each project: gate one "IAM", gate two "org policy".
**Opening frame**: Owner badge, full key, both folders, the amber pill on Production only.
_"Owner can do anything IAM allows..."_
**Story**:

1. In Production, Owner ticks "external IP" and submits: the request clears the IAM gate (green,
   Owner is allowed to create VMs), then bounces at the org-policy gate, "violates
   vmExternalIpAccess". _"...except what org policy forbids outright."_
2. Same Owner, same form, in Sandbox: both gates green, VM created. _"Same identity, same role: the
   constraint decides, not the Owner title."_
3. Contrast: a deny policy pill "deny: delete, for dana@" bound on Sandbox blocks only Dana, only
   delete, whatever she is trying to configure. Org policy blocks the configuration, for everyone.
   _"Deny blocks who. Org policy blocks what."_
4. Toggle the constraint to "dry-run" on Production: the same call now succeeds but leaves a
   violation flag in the audit log. _"Test a rule before it bites."_
5. Zoom to a brand-new organization frame that already has several amber pills (no SA key creation,
   no automatic Editor for default accounts) attached, unlit by any admin action. _"New orgs start
   secure-by-default."_
   **The moment**: Beat 1 into 2, the identical Owner passing IAM both times and being stopped only
   where the constraint sits.
   **Interaction**: Toggle the constraint on, off or to dry-run, and retry the create-VM action in
   each folder.
   **Ending**: Both projects shown, one blocked, one allowed, the amber pill the only difference.
   _"IAM says who may act. Org policy says what's possible."_
   **Variants**: `gcp-iam-conditions-deny-pab`, `gcp-resource-hierarchy`; AWS Service Control Policies,
   Azure Policy.
   **Techniques**: bind, failure, side by side, toggle, spotlight, caption.
   **Review**: Improved — the old plan said "no IAM check even runs" (the service checks IAM, then the
   constraint) and put the constraint on the organization while expecting a sibling project to
   escape it; both fixed. Added the deny-policy contrast beat, because the named misconception was
   never defeated on screen, and dropped the CEL beat (custom constraints match resource fields, not
   project labels). Alternative weighed: leading with the deny contrast; worse, it needs IAM-deny
   vocabulary first. Checked: constraint name, dry-run, secure-by-default orgs.

### Labels vs tags vs network tags (`gcp-labels-vs-tags`)

**The aha**: Only tags carry policy (a "secure tag" is just a tag used in a firewall). A label is
searchable metadata that never grants or blocks anything, and a network tag is an older string that
anyone who can edit the VM can change.
**Misconception to defeat**: Treating labels, tags and network tags as three names for the same
thing.
**Cast**: One VM with three chips attached: a label chip (`env:prod`, blue), a tag chip
(org-defined, green, `env=prod`, a padlock showing it's IAM-protected), a network tag chip (plain
string, orange, `web-server`). A billing export table, a firewall rule panel, an IAM conditions
panel. A second VM, "Eve's VM", with no chips.
**Opening frame**: The VM with all three chips attached, visually similar. _"Three tag-like things
on one VM."_
**Story**:

1. Click the label chip: it streams into a billing export row, nothing else lights. _"Labels: free
   text, useful for cost reports, that's all."_
2. Click the tag chip: ribbons extend to a firewall policy and an IAM condition panel, both now
   referencing it. _"Tags: defined by the org, usable in policy."_
3. A user without the tag-user role tries to attach or edit the tag chip: bounces, padlock flashes.
   _"Tags are governed resources themselves."_
4. Click the network tag chip: a firewall rule "allow 5432 to tag:db-client" lights. Then Eve, who
   can edit only her own VM, types `db-client` onto it, no IAM check beyond editing the VM, and the
   rule now opens for her VM too. _"Network tags are just strings. Anyone who can edit the VM can
   add one."_
5. Finale: the three chips with arrows to what each one reaches, and a padlock on only one.
   **The moment**: Beat 4, Eve adding a plain string to her own VM and walking through a firewall
   rule, right after the protected tag refused her.
   **Interaction**: Try to attach or remove each chip and see which ones resist.
   **Ending**: The three-chip VM with a small legend: metadata / policy / legacy. _"Only the padlocked
   one can grant or block."_
   **Variants**: `gcp-resource-hierarchy`, `gcp-firewall-rules-policies`; AWS tags (which do drive
   attribute-based access control), Azure tags.
   **Techniques**: contents, bind, failure, stream, side by side, caption.
   **Review**: Improved — the moment was a network tag being removed (merely breaks a rule); changed
   to a network tag being added by someone who shouldn't, which is the actual security hole.
   Reworded the aha because "tags and secure tags" implied two policy mechanisms. Weighed a pure
   three-column table; rejected, no motion. Checked: labels feed billing export, tags are IAM-governed
   and usable in conditions, org policy and firewall policies, network tags are VM strings.

### Where Google Cloud identities come from (`gcp-cloud-identity`)

**The aha**: Authentication and authorization live in different places — your IdP proves who
someone is, Cloud Identity holds the Google principal, and IAM bindings on the hierarchy decide
what that principal may do.
**Misconception to defeat**: Thinking Google Cloud has its own user directory the way Entra ID or
AWS IAM users do.
**Cast**: Left, an external IdP box (Entra ID or Okta) holding a person "Dana". Middle, a Cloud
Identity domain frame "example.com" holding a Google Group ring. Right, the organization frame with
IAM ribbons.
**Opening frame**: Dana on the left, an empty Cloud Identity frame in the middle, the org frame on
the right, no connections yet. _"Where does Dana's Google identity come from?"_
**Story**:

1. A sync arrow (directory sync or provisioning) carries Dana's record from the IdP into the Cloud
   Identity frame; a Google account badge for Dana appears, with no password on it. _"First, a
   Google account is created for her."_
2. Dana signs in: Google bounces her to the IdP, she proves who she is there, a SAML assertion
   flows back and a session opens on her Google account. _"SSO: proof comes from your IdP."_
3. Dana's badge is dragged into a Google Group ring, "finance-team@example.com". _"Grant to groups,
   not individuals."_
4. A role pill binds onto a folder in the org frame, naming the group; the ribbon fades down onto
   Dana only because she's inside the ring. _"IAM decides what the group — and so Dana — may do."_
5. Try to attach a role pill directly to the IdP box: it bounces, nothing for IAM to name. _"IAM
   only knows Google principals. The IdP feeds Cloud Identity, never IAM."_
6. Side inset: Workforce Identity Federation from a different external IdP straight into a mapped
   principal badge, skipping a synced Google account entirely. _"External identities can map in
   without ever becoming a Google account."_
   **The moment**: Beat 5, the role pill bouncing off the IdP box — authentication and authorization
   drawn as two zones that only meet at the Google principal.
   **Interaction**: Drag a principal into or out of a group and watch inherited ribbons appear or
   disappear.
   **Ending**: Dana's badge inside the group ring, ribbon lit on the folder above. _"IdP proves who.
   Cloud Identity names them. IAM decides what."_
   **Variants**: `gcp-iam-roles`, `gcp-workload-identity-federation`; Microsoft Entra ID (directory and
   IAM in one), AWS IAM users and Identity Center.
   **Techniques**: exchange, token, bind, move, failure, caption.
   **Review**: Improved — the old beat 2 had the SAML assertion create Dana's account; SSO only signs
   in an account that already exists, so provisioning is now its own first beat and sign-in the
   second. Weighed starting from the group-and-role end; rejected, the title question is the origin.
   Checked: Google Groups, Cloud Identity or Workspace as the directory, SAML SSO, Workforce Identity
   Federation mapping without a Google account.

### Regions, zones, multi-regions and resource scope (`gcp-regions-zones`)

**The aha**: A resource's scope is its blast radius — zonal dies with its zone, regional survives a
zone loss, global or multi-regional survives a region loss.
**Misconception to defeat**: That "running in the cloud" means resilient by default — a plain VM is
zonal, and its scope is fixed the day you create it.
**Cast**: A world map outline with four region ovals (`us-central1`, `us-east1`, `europe-west1`,
`asia-southeast1`), each containing three zone boxes. A legend of three resource badges: "zonal" (a
VM pin), "regional" (a managed instance group spanning the zone boxes), "global" (a load balancer
icon spanning the whole map).
**Opening frame**: The map with four regions, each showing three zones, all calm. _"Independent
areas, independent failure domains."_
**Story**:

1. Drop a zonal VM pin into `us-central1-a`. Flash that zone red; the VM pin greys with it.
   _"Zonal: dies with its zone."_
2. Drop a regional managed instance group spanning all three zones of `us-central1`. Flash zone a
   red again; two of its three instances survive, the group's badge stays green. _"Regional: built
   to survive a zone."_
3. Flash the whole `us-central1` region red. The regional group now fully greys. _"But not a
   region."_
4. Drop a global load balancer icon spanning the map, with backends in `us-central1` and
   `europe-west1`. Flash `us-central1` red entirely; traffic arrows reroute live to `europe-west1`,
   the load balancer's badge stays green. _"Global: survives a region."_
5. Side inset: a bucket in the `US` multi-region, drawn as one shape covering `us-central1` and
   `us-east1`, survives the same flash with its data in the other region. _"Multi-region buys this
   for storage, not just compute."_
   **The moment**: Beats 3 to 4 — the same regional flash that killed the managed instance group
   leaves the global load balancer untouched; scope, not luck, decided it.
   **Interaction**: Choose a resource type (zonal, regional, global) and a failure (zone, region), and
   watch whether it survives.
   **Ending**: The map, one region fully red, only global or multi-region elements still green.
   _"Blast radius is a choice you make at creation."_
   **Variants**: `gcp-global-vpc`, `gcp-gke-regional-clusters`, `gcp-cloud-sql-ha-replicas`,
   `gcp-global-external-alb`; AWS Availability Zones (similar zones, but AWS's VPC stays regional
   where Google Cloud's network is global).
   **Techniques**: boundary, failure, path trace, spotlight, choice, caption.
   **Review**: Improved — the multi-region bucket was drawn spanning two of three regions, none of
   which sit inside the US multi-region, so a fourth region (`us-east1`) was added. The stated
   misconception (AWS equivalence, global network) was never shown here, so it became "resilient by
   default"; the global network belongs to `gcp-global-vpc`. Weighed a "zone as a building" metaphor;
   the flash-and-survive test is more direct. Checked: region has 3+ zones, zone = failure domain,
   scope examples.

### Backup and DR Service and backup vaults (`gcp-backup-dr`)

**The aha**: A snapshot in the source project is deleted by the same admin, or the same project
deletion, that destroys the disk; a backup vault is immutable and indelible until its retention
ends, so it survives mistakes, ransomware and a compromised admin.
**Misconception to defeat**: Thinking a disk snapshot is already a safe backup.
**Cast**: Left, a project frame with a VM and a disk, a snapshot card sitting in the same project
list. Right, outside that project, a backup vault frame in its own project (a vault icon, a
retention meter "min retention: 30 days", a value the vault owner sets) fed by an arrow labelled
"backup plan: schedule + retention".
**Opening frame**: VM, disk, snapshot beside them in one project; the vault frame sits separate,
empty. _"A snapshot lives in the same project, under the same admins."_
**Story**:

1. A compromised admin in the project deletes the disk, then the snapshot: two quick delete
   requests, both succeed. Then the project itself is deleted and the frame vanishes with
   everything. _"Same admin, same project, same blast radius."_
2. Rewind: this time a backup plan has been running — a copy token travels from the disk into the
   vault on a schedule, landing as a vault card with a retention countdown. _"A backup leaves the
   project."_
3. The same admin tries to delete the vault card before its countdown ends: bounces, red,
   "retention not expired". _"Indelible until retention ends — even for an admin."_
4. The project frame flashes red and vanishes (ransomware). The vault frame, outside it, sits
   untouched, card intact. _"Outside the blast radius of the thing it protects."_
5. When the countdown runs out, the card expires by the plan's own schedule. _"Gone only when
   policy says."_
   **The moment**: Beat 3, the compromised admin's own delete request bouncing off the vault — the
   same actor who just erased everything else.
   **Interaction**: Try to delete the vault card before or after its countdown; delete the whole
   source project and watch which copy survives.
   **Ending**: Project frame gone, vault frame standing with its card. _"Outside the project, and out
   of reach until retention says so."_
   **Variants**: `gcp-snapshots-images`, `gcp-regions-zones`; reliability's backup and DR concepts; AWS
   Backup Vault Lock.
   **Techniques**: contents, clone, token, timer, failure, boundary, caption.
   **Review**: Improved — beat 1 had the snapshot disappear when the VM and disk were deleted, but a
   snapshot is its own resource and survives disk deletion; the real weakness is that it shares the
   project and its admins, so beat 1 now has the admin delete it, then the project. "Min 35 days"
   replaced by a retention the vault owner sets (no such fixed number). Weighed an "undo" metaphor;
   rejected, the compromised-admin story is the vault's actual purpose. Checked: enforced minimum
   retention, vault outside source project, plan = schedule + retention.

### IAM allow policies and role types (`gcp-iam-roles`)

**The aha**: You never grant a permission directly — you grant a role, a bundle of permissions, to
a principal at some level of the hierarchy, and basic roles are far too broad for production.
**Misconception to defeat**: Imagining IAM like a JSON policy document attached to a user
(AWS-style), rather than role bindings on resources.
**Cast**: A project frame "checkout" holding a bucket, a VM and a database, each showing a few
permission dots. A principal badge "dana@". Three role pills for comparison: "Owner" (huge, the
whole permission list fanned out behind it), "roles/storage.objectViewer" (small, two dots,
`storage.objects.get` and `.list`), and a custom pill hand-assembled from permission chips. The
allow policy is drawn as a small card on the resource, listing "role → members".
**Opening frame**: The three role pills side by side, sized to show their scope. _"A role is a
bundle of permissions — sizes vary enormously."_
**Story**:

1. Bind "Owner" for Dana on the project: a row appears on the project's policy card, and every
   permission dot on the bucket, VM and database lights at once, including delete-bucket. _"The
   policy lives on the resource; basic roles grant almost everything."_
2. Swap the binding to "roles/storage.objectViewer" and move it onto the bucket alone: only "get"
   and "list" light there; the VM and database go dark. _"A predefined role, scoped to one service
   and one resource."_
3. Dana needs one permission no predefined role offers; assemble a custom pill from two permission
   chips. _"Custom, only when nothing predefined fits."_
4. A meter, "IAM recommender", flags that Dana hasn't used "list" in 90 days and suggests trimming
   it. _"Recommender trims what's unused."_
5. Try to bind a bare permission, no pill at all, onto Dana: it bounces. _"Permissions only travel
   in a role."_
   **The moment**: Beat 1 vs beat 2, the same principal lighting up the whole project's permission
   dots, then just two dots on one bucket — same binding mechanic, wildly different blast radius.
   **Interaction**: Swap which role is bound, and at which level, and watch which permission dots
   light on each resource.
   **Ending**: Dana bound to the scoped predefined role, recommender meter calm. _"Grant the smallest
   bundle, at the lowest level that works."_
   **Variants**: `gcp-iam-policy-inheritance`, `gcp-service-accounts`; AWS IAM policies, Azure RBAC
   role assignments.
   **Techniques**: bind, spotlight, contents, meter, failure, caption.
   **Review**: Improved — the plan bound Owner on a bucket, but basic roles can't be granted on an
   individual resource; the frame is now a project (Owner there), then the narrow role goes on the
   bucket, which also teaches "where" as well as "which". The policy-card-on-the-resource drawing now
   defeats the AWS-style misconception in beat 1. Weighed a side-by-side AWS JSON policy; it would
   import the wrong model. Checked: basic/predefined/custom, no raw permission grants, recommender.

### IAM policy inheritance (`gcp-iam-policy-inheritance`)

**The aha**: Effective access on a resource is the union of the allow policies on it and on every
ancestor — a grant on a folder can't be taken away by the project below it.
**Misconception to defeat**: Believing a project's own policy can override or block what a parent
folder granted.
**Cast**: The nested hierarchy: organization › folder "Prod" › project "checkout". A role pill
bound on the folder, "Viewer" for group "auditors". The project frame starts with a ghosted copy of
that ribbon already faded onto it.
**Opening frame**: Folder with one ribbon, project beneath it showing a faint ghost of the same
ribbon. _"A grant up here already reaches down there."_
**Story**:

1. Zoom into the project: the ghost ribbon solidifies into "auditors: Viewer" — inherited, not
   locally set. _"Effective access includes everything above."_
2. The project admin adds their own binding, "Editor" for a different group, directly on the
   project. Both ribbons now sit on the project, side by side. _"Allow policies only add."_
3. The project admin tries to delete the inherited "auditors: Viewer" ribbon from inside the
   project: it won't budge, greyed, "set on Prod — edit there". _"You can't remove it from here."_
4. Cut to the folder; removing the ribbon there, the ghost on the project fades with it. _"Only
   removing it at the source removes it below."_
5. Teaser inset: a deny policy pill dropped on the project cuts off the auditors' delete
   permission while the Viewer ribbon stays put. _"To block what's above, you need a different
   layer: a deny policy."_
   **The moment**: Beat 3, the project admin unable to delete a ribbon they didn't create, right there
   in their own frame.
   **Interaction**: Add or remove a binding at any level and watch which frames below light, or stay
   lit regardless.
   **Ending**: Folder and project both showing the union of ribbons. _"Access only ever grows as you
   go down — allow policies can't take it back."_
   **Variants**: `gcp-iam-roles`, `gcp-resource-hierarchy`, `gcp-iam-conditions-deny-pab`,
   `gcp-organization-policy`; AWS Service Control Policies and IAM policies, which differ in override
   behaviour.
   **Techniques**: boundary, bind, zoom, failure, side by side, caption.
   **Review**: Improved — beat 5 contrasted with an org policy being "replaced by a stricter
   project-level constraint", which mixes two layers in a concept about IAM; replaced by a deny-policy
   teaser that gives the viewer the actual way to cut access from below and links to
   `gcp-iam-conditions-deny-pab`. Weighed opening with the wrong model (project overrides folder) and
   refuting it; the ghost-ribbon opening already lands the answer. Checked: union of allow policies
   across ancestors, inherited bindings read-only below.

### IAM conditions, deny policies and principal access boundaries (`gcp-iam-conditions-deny-pab`)

**The aha**: IAM checks the principal access boundary, then deny policies, then allow policies with
their conditions, in that order — a deny always wins, so a guardrail can be enforced centrally
without auditing every allow policy.
**Misconception to defeat**: Assuming an allow policy for a powerful role like Owner can never be
stopped by anything else, or confusing a deny policy with an org policy.
**Cast**: A vertical three-gate checkpoint in front of a project frame: gate 1 "Principal Access
Boundary", gate 2 "Deny policy", gate 3 "Allow policy (+ conditions)". A principal badge with an
"Owner" role pill approaches from the left. Off to one side, dimmed and labelled "org policy:
checks the configuration, not a gate", for later.
**Opening frame**: The three gates, all open, Owner badge approaching. _"Every request passes three
checks, in order."_
**Story**:

1. Send the Owner badge through: it sails through all three gates, reaching the project. _"With
   nothing special set, Owner just works."_
2. Bind a deny policy to the project: "deny project deletion, except security-admins". Resend a
   delete-project request from Owner: it clears gate 1, then slams shut at gate 2 — never reaching
   gate 3, where Owner's allow lives. _"Deny wins, whatever the allow policy says."_
3. Bind a principal access boundary naming only two projects to Dana's principal set; send her
   toward a third project: gate 1 closes immediately, before deny or allow are even checked. _"A
   boundary caps what a principal can ever reach — checked first."_
4. Add an IAM condition chip "only 9am–5pm" onto the allow pill at gate 3; send a request at 11pm:
   gate 3 closes. _"Even the final allow can be conditional."_
5. A Privileged Access Manager request asks for "delete" for five minutes; once approved, a
   temporary allow pill appears, lets one request through gate 3, then dissolves. _"Standing access
   replaced by a short, approved window."_
   **The moment**: Beat 2, Owner's badge — supposedly all-powerful — stopped cold at gate 2, before
   ever reaching its own allow policy.
   **Interaction**: Toggle each gate's rule on or off and resend the same request to see which gate
   stops it.
   **Ending**: All three gates shown with their current rules, the request path traced exactly as far
   as it got; the dim org-policy note stays outside the gates. _"Three checks, in order — deny always
   beats allow."_
   **Variants**: `gcp-iam-roles`, `gcp-organization-policy`; AWS permission boundaries and Service
   Control Policies.
   **Techniques**: path trace, bind, failure, timer, token, caption.
   **Review**: Improved — deny policies attach to organizations, folders and projects (not an
   individual resource) and carry exceptions, so beat 2 is now a project-level deny with an exception
   group, the realistic guardrail; PAB is bound to a principal set, not "onto the organization".
   Added the dim org-policy marker so the named confusion is at least visibly separated. Weighed a
   timeline instead of gates; gates show "stopped before reaching its own allow" better. Checked:
   order PAB, deny, allow-with-conditions, as the catalog states.

### Service accounts (`gcp-service-accounts`)

**The aha**: A service account is both a principal, holding roles, and a resource, with roles held
on it — give each workload its own least-privilege one instead of a broad default.
**Misconception to defeat**: Treating the Compute Engine default service account as a safe,
ordinary identity rather than a historically over-privileged shortcut.
**Cast**: A VM frame with a gear badge "service account: checkout-sa@" attached (the principal
side). Beside it, the same gear badge redrawn as a small resource frame of its own (the resource
side), with a "Service Account User" pill bound onto it for a different principal, "dana@". A
project holding a bucket and other resources.
**Opening frame**: The gear badge shown twice — once attached to the VM as an identity, once as a
boxed resource with its own binding. _"Two faces of one service account."_
**Story**:

1. The VM, acting as checkout-sa@, reaches for a bucket; a "Storage Object Viewer" pill bound on
   the bucket lights green, the request succeeds. _"As a principal, it acts — with whatever roles
   it holds."_
2. Swap in the old default service account, which older projects bound to "Editor" project-wide:
   the same VM now reaches almost every resource in the project. _"The default account often carries
   Editor — too much."_ (Small chip: new orgs no longer grant it by default.)
3. Zoom to the gear badge as a resource: Dana holds "Service Account User" on it and nothing on the
   bucket. She creates a new VM and attaches checkout-sa@ to it; from that VM she reads the bucket.
   _"User lets you attach the account to something you run — and borrow its access."_
4. Flag a second gear badge, a "service agent" (a small Google logo corner), with a role bound by
   Google itself. An admin removes that role: it goes through, and the service it powers greys with
   "role missing". _"Nothing stops you. Don't touch service agents; the service breaks."_
   **The moment**: Beat 3, Dana reaching the bucket she has no direct access to, purely by holding
   User on the account that does.
   **Interaction**: Swap which service account the VM uses and watch its reach change; try to attach a
   powerful account to a VM as Dana.
   **Ending**: The least-privilege gear badge, scoped role pill, Dana's "User" binding clearly separate
   from the VM's own access. _"One identity, two things to watch: what it can do, and who can be it."_
   **Variants**: `gcp-service-account-impersonation`, `gcp-iam-roles`, `gcp-workload-identity-gke`; AWS
   IAM roles for EC2, Azure managed identities.
   **Techniques**: bind, spotlight, side by side, zoom, caption.
   **Review**: Improved — beat 3 had Dana send a request "as" the account with only Service Account
   User, which actually permits attaching it to a resource (acting through it), not calling APIs as
   it; that is Token Creator, the next concept. Rewritten as the attach-to-a-VM escalation path.
   Beat 4 claimed the removal bounces; Google lets it happen and the service breaks, so the beat shows
   that. Added the secure-by-default note on the default account. Weighed folding in impersonation;
   rejected, that is its own concept.

### Service account impersonation and short-lived credentials (`gcp-service-account-impersonation`)

**The aha**: Instead of downloading a key, a principal with Service Account Token Creator borrows a
service account's identity for minutes, via a short-lived token from the IAM Credentials API.
**Misconception to defeat**: Thinking impersonation means "becoming" the service account
permanently, rather than a brief, logged loan.
**Cast**: Dana's badge on the left. A gear service account badge in the middle, a "Service Account
Token Creator" pill bound onto it for Dana. The IAM Credentials API as a small booth between them.
A token with a visible countdown, "60 min". Two audit-log panels: one at the booth, one at a bucket.
**Opening frame**: Dana, the booth, the gear badge, Token Creator ribbon already bound. _"A borrowed
identity, not a shared password."_
**Story**:

1. Dana requests a token at the booth; it checks her Token Creator binding, then hands back an
   access token stamped "as checkout-sa@", countdown starting at 60:00. The booth's log writes
   "caller: dana@, target: checkout-sa@". _"Ask, don't download. The loan is logged."_
2. Dana uses the token to call a bucket API. The bucket's log shows checkout-sa@ as the actor; the
   link back to Dana is the booth's line from step 1. _"Her own roles aren't used — only the
   account's."_
3. The countdown reaches zero; Dana tries to reuse the same token: bounces, red, "expired". _"Gone
   within the hour. Ask again, or go without."_
4. Chain it: Dana's token requests another token for a second service account further down a
   delegation chain, which needs Token Creator on each hop. _"Delegation can chain, each hop
   logged."_
5. Contrast inset: a service account key file in a drawer, no countdown, dated "created 2 years
   ago", flagged red. _"The alternative: a password that never expires."_
   **The moment**: Beat 3, the token's countdown hitting zero mid-request and bouncing — contrasted
   with the key file that never runs out.
   **Interaction**: Request a token and watch the countdown; try to use it after it expires, or try
   with a principal who lacks Token Creator.
   **Ending**: The booth, a fresh token in hand, the old key file greyed out in the drawer. _"Borrow
   for minutes, not forever."_
   **Variants**: `gcp-service-accounts`, `gcp-workload-identity-federation`,
   `gcp-application-default-credentials`; AWS STS AssumeRole.
   **Techniques**: bind, token, timer, exchange, failure, caption.
   **Review**: Improved — the plan said the bucket's audit entry splits into "caller dana@ / acting
   as checkout-sa@"; in practice the token request is logged against Dana at the IAM Credentials
   call and the resource call shows the service account, so the two log panels are now placed where
   each fact lives. Added the failing no-Token-Creator case to the interaction. Weighed the
   "key vs token" contrast as the opener; kept it last since the borrowed-loan idea needs to land
   first. Checked: one-hour default lifetime, Token Creator role, delegation chains.

### Service account keys vs Workload Identity Federation (`gcp-workload-identity-federation`)

**The aha**: Federation lets an external workload trade its own token for a short-lived Google
credential, so nobody ever downloads a service account key.
**Misconception to defeat**: Thinking a service account key is the safe default way for an external
system to authenticate.
**Cast**: Left, an external platform box (AWS, GitHub Actions) holding a workload with its own
native proof. Middle, a workload identity pool frame with a provider card listing attribute
mappings and a condition. Right, the gear service account badge. A key file icon in a drawer,
tagged "copied to a repo", for contrast.
**Opening frame**: External workload, pool frame, gear badge, unconnected; the leaky key file sits
in the drawer already. _"The old way is sitting in a drawer."_
**Story**:

1. The external workload's native proof (an AWS signed identity request, a GitHub OIDC token) flies
   to the pool frame's provider card. _"It proves who it is, in its own platform's language."_
2. The provider card checks attribute mappings and the condition against it; on match, the Security
   Token Service hands back a short-lived federated token, countdown running. _"Google trusts the
   provider, not a password."_
3. A binding (the workload as workload identity user on the gear badge) lets that token be traded
   once more for an access token as the service account, the same impersonation mechanic as before,
   now reachable from outside Google Cloud. _"From anywhere, no key required."_
4. Try the same flow with a bad attribute (wrong repo, wrong AWS account): the provider card rejects
   it before any token is minted. _"Mapped and conditioned — not just anyone on that platform."_
5. Finale: an org policy pill "disable service account key creation" binds onto the organization;
   the key drawer flashes red and locks. _"Once nothing needs keys, remove the option to create
   them."_
   **The moment**: Beat 3, the external workload reaching Google Cloud and acting as the service
   account with nothing that ever touched disk.
   **Interaction**: Swap the external platform (AWS, GitHub Actions, on-prem OIDC) and watch the same
   pool-and-provider flow run for each.
   **Ending**: The key drawer locked by org policy, the pool frame doing all the work instead. _"No
   keys to leak, because none exist."_
   **Variants**: `gcp-service-account-impersonation`, `gcp-workload-identity-gke`,
   `gcp-application-default-credentials`; AWS's and Azure's own OIDC federation.
   **Techniques**: exchange, token, timer, bind, failure, caption.
   **Review**: Improved — the old flow had the provider card mint the Google credential in one step;
   it is two (a federated token from the Security Token Service, then impersonation of a service
   account, or direct use of the federated identity), and AWS has no "token" so it is now a signed
   identity request. Gave the key file a visible leak tag so the "key as default" misconception has
   a cost to defeat. Weighed showing only the OIDC case; the platform swap in the interaction covers
   variety. Checked: pool/provider mappings, `iam.disableServiceAccountKeyCreation`.

### Workload Identity Federation for GKE (`gcp-workload-identity-gke`)

**The aha**: Each Pod gets Google credentials scoped to its own Kubernetes identity, from a
per-node metadata server — not the node's shared service account.
**Misconception to defeat**: Assuming every Pod on a node inherits that node's, often broad, service
account, the way it used to work.
**Cast**: A GKE node box holding three Pod boxes (A, B, C), each with its own Kubernetes service
account badge. A GKE metadata server strip along the node's bottom. A project with a bucket and a
database, and two role pills (`storage.objectViewer`, `cloudsql.client`) ready to bind. The node's
own Google service account badge with a broad role pill.
**Opening frame**: Three Pods on one node, each with a distinct Kubernetes service account badge,
metadata server strip beneath. _"Three Pods, three Kubernetes identities — same node."_
**Story**:

1. Old picture first: all three Pods reach down into the node's one shared service account badge,
   all lighting the same broad role pill. _"The old way: every Pod borrows the node's identity."_
2. Switch on Workload Identity Federation for GKE: each Pod's Kubernetes service account is now
   itself an IAM principal. Bind `objectViewer` to Pod A's account and `cloudsql.client` to Pod B's;
   Pod C's has no binding. _"Now each Pod's own identity decides."_
3. Pod A requests a credential; the node's metadata server strip answers with a token for A's
   Kubernetes identity, and the bucket opens. Pod B asks the same strip and gets a different
   identity. _"One shared server, but it answers per Pod."_
4. Pod C asks too: it gets a token, but every call is refused, "no roles". _"An identity with no
   roles — and not the node's."_
5. Small inset: a binding can instead let a Pod's account impersonate a Google service account (a
   gear badge). _"Either way, the Pod's own identity is the key."_
   **The moment**: Beat 2, the same three Pods that all lit one broad role in beat 1 now each lighting
   a different, narrower one.
   **Interaction**: Bind or unbind a Pod's Kubernetes service account and watch what it can reach.
   **Ending**: Three Pods, three distinct scoped bindings, the node's own service account dark and
   unused. _"The node stopped being the identity."_
   **Variants**: `gcp-service-accounts`, `gcp-gke-vpc-native`; AWS IRSA and EKS Pod Identity, Azure
   Workload Identity.
   **Techniques**: bind, spotlight, failure, side by side, caption.
   **Review**: Improved — beat 4 said Pod C's request bounces for lack of a credential; with the
   feature on, the Pod still receives a token for its own identity, and it is the API call that is
   denied, so the beat shows that. The cast now binds roles straight to the Kubernetes service
   account (the current direct form) with impersonation as an inset, instead of requiring a gear
   badge per Pod. Weighed drawing the token-exchange internals; too much for one idea. Checked:
   node-level GKE metadata server, direct principal or impersonation.

### Application Default Credentials (`gcp-application-default-credentials`)

**The aha**: The same unmodified code finds credentials anywhere — laptop, CI, production —
because Application Default Credentials searches a fixed order and picks up whatever the
environment offers.
**Misconception to defeat**: Confusing `gcloud auth login` (credentials for the CLI) with what a
program's client library actually uses.
**Cast**: One unchanged code line, `client = storage.Client()`, shown three times, over three
environments: a laptop, a CI runner, a production VM. Beneath each, the same ordered search list:
① `GOOGLE_APPLICATION_CREDENTIALS` file, ② `gcloud auth application-default login`, ③ attached
service account via metadata server. The laptop also shows a terminal where `gcloud auth login`
was run.
**Opening frame**: The same line of code, three environments, search list collapsed, unlit.
_"Identical code. Three places."_
**Story**:

1. Laptop: step ① is empty, step ② lights — the developer's own user credential from `gcloud auth
application-default login` is picked up. _"On a laptop: your own login."_
2. CI runner: step ① lights — a federation config file dropped in by the pipeline matches the
   environment variable and trades for a short-lived credential. _"In CI: whatever federation
   hands it."_
3. Production VM: steps ① and ② are both empty, step ③ lights — the attached service account
   answers through the metadata server, no file anywhere. _"In production: the identity attached to
   the machine."_
4. Back on the laptop, a developer who ran only `gcloud auth login`: the CLI works, but the search
   list stays empty at ② and the code errors, "could not find default credentials". _"gcloud's login
   is for gcloud. Your code searches this list."_
5. Contrast inset: a line of code with a literal key file path hardcoded, flagged red, "breaks the
   moment it changes machines". _"That's what ADC exists to avoid."_
   **The moment**: Beat 3, the search list quietly skipping two empty steps to land on the metadata
   server — the same list that lit differently in every environment before it.
   **Interaction**: Toggle which step has something present and watch which one the search stops on.
   **Ending**: The three environments, three different steps lit, one line of code above all three.
   _"The code never asks where. ADC always finds an answer."_
   **Variants**: `gcp-service-account-impersonation`, `gcp-workload-identity-federation`; `gcloud auth
login`, which is not what code uses.
   **Techniques**: path trace, spotlight, side by side, failure, caption.
   **Review**: Improved — beat 1 called the laptop credential "impersonated" (it is the developer's
   own user credential); beat 4 had prod code running on a laptop "anyway", which never defeated the
   named confusion, so it now shows the `gcloud auth login`-only laptop failing. Beat 2's file is a
   credential configuration, not a secret. Weighed a "which comes first" quiz; the three-environment
   contrast is better. Checked: ADC order env var, user credentials, metadata server.

### Global VPC with regional subnets (`gcp-global-vpc`)

**The aha**: One VPC network is global — a single frame spanning every region, with only its
subnets tied to regions — so a VM in Tokyo and one in Iowa are on the same network, no peering
required.
**Misconception to defeat**: Picturing a Google Cloud VPC like an AWS VPC or Azure VNet, confined to
one region.
**Cast**: The shared wide VPC frame spanning three region bands (`us-central1`, `europe-west1`,
`asia-southeast1`), each holding a regional subnet frame spanning that region's zones. One VM in
the `us-central1` subnet, one in the `asia-southeast1` subnet. For contrast: an AWS VPC drawn as a
single region-wide box with zonal subnets, and a second AWS VPC in another region joined only by a
peering line.
**Opening frame**: The global VPC frame spanning all three region bands, a VM in two far-apart
subnets already inside it. _"One network. Three regions. Already."_
**Story**:

1. Draw a straight internal-IP arrow between the two VMs, no gateway, no peering line, labelled
   "over Google's backbone" (a firewall allow rule chip snaps on first, since ingress is closed by
   default). _"Same network, no gateway."_
2. Add a new region band with an empty subnet inside the same VPC frame — the frame simply
   stretches to include it. _"Add a region: the network already reaches there, just add a subnet."_
3. Switch to "auto mode": a subnet appears in every region from one fixed range (10.128.0.0/9),
   and a second auto-mode network next to it carries the identical ranges, a red clash. _"Auto mode
   is quick, and its fixed ranges collide when you connect networks."_
4. Switch to "custom mode": draw each subnet's range by hand, then add a non-overlapping range for
   a future peering — no collision. _"Plan ranges yourself, so networks can connect later."_
5. Side-by-side finale: the Google Cloud frame spanning three regions, next to two same-region AWS
   VPCs joined by a peering line. _"Where AWS needs peering across regions, Google Cloud already
   spans them."_
   **The moment**: Beat 1, the direct VM-to-VM arrow with no gateway in between, crossing two region
   bands inside one frame.
   **Interaction**: Add a region band with a new subnet; toggle auto or custom mode and watch ranges
   clash or not.
   **Ending**: The global frame, three regions, two VMs talking directly. _"The network was never
   regional to begin with."_
   **Variants**: `gcp-regions-zones`, `gcp-shared-vpc`, `gcp-vpc-peering`, `gcp-vpc-routing`; AWS VPC
   and Azure VNet (regional), AWS subnets (zonal) vs Google Cloud subnets (regional).
   **Techniques**: boundary, token, side by side, toggle, caption.
   **Review**: Improved — beat 3 blamed auto mode's problem on the default network's open firewall
   rules, which is a separate trait of the default network; the real reason to leave auto mode is its
   fixed shared range that collides on peering or hybrid links, so the beat now shows the clash. Beat
   1 now admits the firewall rule, since a viewer who knows firewalls would object. Weighed leading
   with the AWS contrast; the global frame alone is the stronger opening. Checked: global network,
   regional subnets, auto vs custom mode.

### VPC firewall rules and firewall policies (`gcp-firewall-rules-policies`)

**The aha**: Firewalling happens at every VM's virtual NIC and follows identity, tags or service
accounts, not a box at the network edge — so a rule written once applies wherever those VMs run.
**Misconception to defeat**: Picturing Cloud NGFW like a single edge appliance or an AWS-style
subnet-level NACL.
**Cast**: Three VM boxes scattered across two subnets in the global VPC frame, each with a tiny
shield at its own virtual NIC. A rule card "allow 443 → service account: web-sa@" with a priority
number. A hierarchical firewall policy at the organization frame with a rule card and `goto_next`
arrows descending to a project-level policy. A dim "implied: deny all ingress, allow all egress"
card at the bottom of the stack.
**Opening frame**: Three VMs, two subnets, each VM's own shield lit the same colour, no edge box
anywhere. _"The firewall isn't a box on the edge. It's at every NIC."_
**Story**:

1. Send a packet at 443 toward a VM running as web-sa@ before any rule exists: it stops at that
   VM's shield, dropped by the implied deny. Add the allow rule: the packet passes, and the reply
   goes back out with no rule of its own. _"Closed by default; stateful once opened."_
2. Move that VM to a different subnet: its shield, and the rule lighting it, travel with it
   unchanged. _"The rule follows the service account, not the subnet."_
3. A second VM, same subnet, running as a different service account, sends the same packet: its
   shield stays dark, the rule doesn't match. _"Same place, different identity, different
   outcome."_
4. Zoom to the hierarchy: the organization-level policy with its rule card, a `goto_next` arrow
   descending past an empty folder policy into a project-level policy with its own extra rule —
   both now apply to the VM below, in order. _"Rules stack down the hierarchy, security team first."_
5. A project owner tries to delete the organization-level rule from inside their own project view:
   it won't budge, greyed, "set above — edit there". _"Central rules, not overridable below."_
   **The moment**: Beat 2, the VM's shield and its matching rule migrating together across a subnet
   boundary the rule never mentions.
   **Interaction**: Move a VM between subnets, or swap its service account, and watch which rule
   lights.
   **Ending**: Three VMs, shields lit by identity, the hierarchy policy stack shown beside them.
   _"Distributed enforcement, centrally delegated."_
   **Variants**: `gcp-labels-vs-tags`, `gcp-vpc-routing`, `gcp-cloud-armor`; AWS security groups and
   NACLs, Cloud Armor (layer 7, at the load balancer instead).
   **Techniques**: bind, boundary, path trace, move, failure, caption.
   **Review**: Improved — the plan never showed the two fundamentals the exams ask about, the implied
   deny/allow rules and statefulness, so beat 1 now opens with a packet dropped before any rule and
   the reply flowing back unaided. Priority is shown on the rule card and in the stack order of beat
6. Weighed adding a tag-vs-service-account contrast (that sits in `gcp-labels-vs-tags`). Checked:
   per-NIC enforcement, service account and secure tag targets, `goto_next`, org → folder → project
   order.

### VPC routes and Cloud Router (`gcp-vpc-routing`)

**The aha**: Cloud Router only learns and advertises routes, packets never pass through it, and the
network's dynamic routing mode decides how far those learned routes reach across the VPC's
regions.
**Misconception to defeat**: Picturing Cloud Router, or an on-prem router, as sitting in the data
path, like a physical router forwarding packets.
**Cast**: The global VPC frame with two region bands. An on-prem network box connected by a VPN
tunnel into `us-central1`. A Cloud Router icon beside the tunnel, drawn off to the side of the
actual traffic path, labelled "control plane only". The one VPC-wide routing table listing system,
static and dynamic routes. A "dynamic routing mode: regional | global" switch on the VPC frame's
header.
**Opening frame**: On-prem box, tunnel into `us-central1`, Cloud Router beside the tunnel, routing
table empty of the on-prem range. _"Nothing from on-prem yet."_
**Story**:

1. On-prem advertises its range over BGP through the tunnel; Cloud Router's icon pulses as it
   "hears" the route and writes a new row into the routing table — no packet has moved yet. _"It
   learns. It doesn't carry."_
2. Send a data packet from a VM in `us-central1` to on-prem: its path arrow goes straight through
   the tunnel, visibly bypassing the Cloud Router icon. _"Packets skip it — this is the control
   plane."_
3. With the VPC's switch on "regional" (the default): the new route row only appears for
   `us-central1`; a VM in `europe-west1` checks the table and finds nothing. _"Regional mode: the
   route stays local."_
4. Flip the VPC's switch to "global": the same row now appears for `europe-west1` too, and that
   VM's packet reaches on-prem, crossing the backbone to the tunnel. _"Global mode: it reaches
   every region of the VPC."_
5. Add a custom static route scoped to a network tag; only tagged VMs' packets follow it, others
   ignore it though the row exists. _"Static routes can be scoped too."_
   **The moment**: Beat 2, a packet visibly cutting past the Cloud Router icon it just watched learn a
   route — the clearest possible "control plane, not data plane."
   **Interaction**: Toggle regional vs global dynamic routing mode and send a packet from each region
   to see which succeeds.
   **Ending**: The routing table, rows learned by Cloud Router, packets flowing along tunnels that
   never touch it. _"It draws the map. It never walks the road."_
   **Variants**: `gcp-global-vpc`, `gcp-cloud-vpn`, `gcp-cloud-interconnect`; a router or AWS Transit
   Gateway in the data path, AWS per-subnet route tables.
   **Techniques**: path trace, token, boundary, toggle, spotlight, caption.
   **Review**: Improved — the plan set the regional/global mode "on Cloud Router"; it is a setting of
   the VPC network, which Cloud Routers in it obey, so the switch moved to the VPC frame. Weighed
   leading with the mode puzzle (why can't europe reach on-prem?) as the hook, but the
   control-plane/data-plane point is the root cause of the confusion. Checked: BGP learned routes,
   one routing table per network, tag-scoped static routes, regional default.

### Shared VPC (`gcp-shared-vpc`)

**The aha**: Shared VPC lets one host project's network team own subnets, routes and firewalls
while each application team keeps its own service project for IAM and billing — separating who
runs the network from who runs workloads.
**Misconception to defeat**: Confusing Shared VPC, one network, many projects, with VPC Peering, two
separate networks.
**Cast**: A host project frame holding the global VPC frame with its subnets. Two service project
frames, each empty of any network of its own, each with a "Compute Network User" ribbon bound on
one specific subnet inside the host's VPC. VMs created inside each service project are drawn
physically sitting in the host's subnet.
**Opening frame**: Host project with its VPC and subnets; two service projects beside it, empty,
with ribbons reaching into specific subnets. _"One network. Separate teams around it."_
**Story**:

1. Service project A's team creates a VM; it appears physically inside the host's subnet, but its
   billing and IAM ribbons stay tied back to project A. _"Runs in the shared network. Belongs to
   its own project."_
2. Service project B's team tries to create a VM in a subnet they have no "Compute Network User"
   ribbon for: bounces, red. _"Access to use a subnet is its own grant, per subnet."_
3. The host project's network team adds a firewall rule at the VPC level: it instantly governs both
   A's and B's VMs, neither service project team able to override it. _"Network control stays
   centralised."_
4. Project A is billed for its VM's compute and its VM's network traffic; the host's bill shows only
   what the host owns, such as the VPN tunnel and Cloud NAT. _"Billing follows the workload."_
5. Contrast inset: VPC Peering beside it, two full, separate VPC frames linked by a thin line, each
   with its own admin, against Shared VPC's one frame, many tenants. _"Peering: two networks, two
   admins. Shared VPC: one network, many tenants."_
   **The moment**: Beat 2, project B's VM creation bouncing off a subnet it has no explicit grant for,
   inside a network it doesn't own at all.
   **Interaction**: Grant or revoke "Compute Network User" on a subnet for a service project and retry
   VM creation.
   **Ending**: Host project's VPC, two service projects' VMs sitting inside its subnets, each billed
   home. _"One team runs the roads. Many teams drive on them."_
   **Variants**: `gcp-global-vpc`, `gcp-vpc-peering`, `gcp-network-connectivity-center`; AWS VPC
   sharing through Resource Access Manager.
   **Techniques**: boundary, bind, failure, side by side, caption.
   **Review**: Improved — beat 4 said the host's bill "shows only the network resources" while the
   plan implied the host also pays for traffic; egress is billed to the project of the sending VM, so
   the beat was made explicit with examples of what the host owns. Weighed opening on the peering
   confusion instead; the host-and-tenants picture explains why peering is different, so the order
   stays. Checked: host/service projects, subnet-level Compute Network User, central firewall.

### VPC Network Peering (`gcp-vpc-peering`)

**The aha**: Peering is not transitive — if A peers with B and B peers with C, A still cannot reach
C — which is why hub-and-spoke designs often need something else.
**Misconception to defeat**: Assuming peering behaves like a transitive trust, so peering with a hub
reaches everything else peered to that hub.
**Cast**: Three separate VPC frames, A, B and C, each with its own admin badge, firewall rules and a
small routing table beside it. A thin peering line between A and B, with route rows copied across.
A second peering line between B and C. No line between A and C.
**Opening frame**: A–B peered, B–C peered, A and C with a visible gap between them. _"Two separate
peerings. Is that a path from A to C?"_
**Story**:

1. A sends a packet to a VM in B: the peering line lights, B's subnet rows already sit in A's table,
   it arrives. _"A reaches B — they're directly peered."_
2. B sends a packet to C: same thing, direct peering, arrives. _"B reaches C too."_
3. A sends a packet addressed into C's range: A's table has rows for B's ranges only, none for C's,
   so the packet never leaves A (no route, dropped). B's table has C's rows, but B doesn't pass them
   on. _"A has no route to C. Peering doesn't chain."_
4. Try to peer A with a new network D whose subnet range overlaps one of A's: the peering request
   bounces before any route exchange. _"Ranges can't overlap either."_
5. Contrast inset: the same three networks as spokes of a Network Connectivity Center hub instead —
   this time A's packet to C succeeds. _"Need transitivity? Use something built for it."_
   **The moment**: Beat 3, A's routing table visibly missing the row for C, after two individually
   successful peerings suggested it "obviously" should work.
   **Interaction**: Add or remove a peering line between any two of the three networks and see whether
   A's table gains a row for the far network.
   **Ending**: A, B, C with their two non-transitive lines, A's table showing only B's rows, the
   missing C row marked. _"Direct only. Never through a peer's peer."_
   **Variants**: `gcp-shared-vpc`, `gcp-network-connectivity-center`, `gcp-private-service-connect`;
   Shared VPC (one network, shared).
   **Techniques**: boundary, path trace, token, failure, side by side, caption.
   **Review**: Improved — the old beat 3 had A's packet travel to B's edge and die there; since
   routes are exchanged only between direct peers, A has no route to C at all and the packet never
   leaves A, so the moment is now the missing table row, which also explains why. Weighed a
   "transitive trust" metaphor drawn as a chain of handshakes; the routing table is the true cause.
   Checked: non-transitive, overlapping ranges rejected, NCC as the transitive alternative.

### Private Google Access (`gcp-private-google-access`)

**The aha**: A VM with only an internal IP can still reach Google APIs without NAT and without ever
leaving Google's network, and `restricted.googleapis.com` narrows that to only the services VPC
Service Controls protects.
**Misconception to defeat**: Thinking any API call from an internal-only VM needs Cloud NAT, the way
reaching the general internet does.
**Cast**: A subnet frame with a "Private Google Access: on" toggle at its header. A VM inside with
no external IP badge. Two destinations off the right edge: a generic internet cloud, and a Google
APIs ring (`storage.googleapis.com`, `bigquery.googleapis.com`) sitting entirely inside Google's own
boundary line.
**Opening frame**: VM, no external IP, toggle off, both destinations greyed. _"Internal-only — can
it reach anything?"_
**Story**:

1. With the toggle off, the VM calls a public website: bounces. It calls `storage.googleapis.com`:
   also bounces. _"Nothing reaches out — not even Google's own APIs."_
2. Flip the toggle on: the call to the Google APIs ring now succeeds, its path staying entirely
   inside Google's boundary line, never touching the public internet cloud. _"Private Google Access
   opens one specific door — to Google's own services."_
3. The call to the generic public website still bounces. _"Just not the general internet — that's
   Cloud NAT's job, a different door."_
4. Extend to an on-prem host over VPN: DNS sends it `private.googleapis.com` and the route to that
   range rides the tunnel; its call to the APIs ring now succeeds too. _"The same private door,
   reachable from on-prem."_
5. Swap the destination to `restricted.googleapis.com`; a VPC Service Controls boundary appears
   around some projects. A call to a protected project's bucket works; a call to a bucket in an
   unprotected project, or to an API the boundary doesn't cover, is refused although the VM is
   fully private. _"Restricted narrows the door to what you've fenced in."_
   **The moment**: Beat 2, the API call's path staying fully inside Google's own boundary line while
   the internet call right beside it bounces at the subnet edge.
   **Interaction**: Toggle Private Google Access on or off, and swap the destination between the
   internet, the open API range and the restricted range.
   **Ending**: VM, toggle on, one clean path into the APIs ring, internet still closed. _"No external
   IP, no NAT — just a private door to Google's own services."_
   **Variants**: `gcp-cloud-nat`, `gcp-private-service-connect`; Private Service Connect endpoints as
   the newer alternative door.
   **Techniques**: toggle, boundary, path trace, failure, caption.
   **Review**: Improved — beat 5 said calls to services "outside the boundary" fail, which is loose:
   restricted.googleapis.com only serves VPC-SC-supported APIs, and VPC-SC itself refuses resources
   outside the perimeter; the beat now shows both outcomes concretely. Beat 4 names the DNS step an
   on-prem host needs. Weighed merging with Cloud NAT as "two doors"; kept apart, each deserves its
   own beat. Checked: per-subnet setting, private/restricted VIPs, internal-only VM, no NAT needed.

### Private Service Connect vs private services access (`gcp-private-service-connect`)

**The aha**: Private Service Connect exposes one service through an endpoint in your own subnet,
with no peering and no IP coordination, the opposite of private services access, which peers your
whole VPC with a producer's network.
**Misconception to defeat**: Treating PSC and private services access, or VPC Peering, as the same
mechanism with a different name.
**Cast**: A consumer VPC frame with a subnet holding a small PSC endpoint icon (its own internal IP).
Off to the side, a producer's service attachment icon (Cloud SQL, or a partner SaaS logo), drawn
as a single point, not a full peered network. For contrast, a second consumer VPC fully peered
(private services access) with a reserved IP range inside a Google-managed network box.
**Opening frame**: Consumer VPC with its PSC endpoint; producer's service attachment as one small
icon, no network lines between the two VPCs at all. _"An endpoint, not a connection between
networks."_
**Story**:

1. A VM calls the endpoint's internal IP directly, as if it were any other resource in its own
   subnet; the call forwards to the producer's service attachment, with NAT happening on the
   producer's side. _"Looks local. Reaches a whole other organization."_
2. Try to route traffic the other way, producer to consumer: it bounces. _"One direction only:
   consumer to producer."_
3. A second, unrelated consumer VPC adds its own PSC endpoint to the same service attachment, no
   coordination with the first consumer's IP range at all. _"No shared range to plan around — each
   side picks its own."_
4. Side by side: the older private services access picture, a reserved range, a full peering line
   into a Google-managed network, shown inheriting peering's non-transitive limit when a third
   network tries to reach through it. _"The older model peers whole networks and inherits peering's
   limits."_
5. Swap the producer to a different organization's SaaS service entirely; the same single-endpoint
   pattern works unchanged, no org-level trust needed. _"It even crosses organizations, because
   it's exposing one service, not a network."_
   **The moment**: Beat 1, the producer's entire service reduced to one small icon reachable at a plain
   internal IP, no visible network boundary crossed at all.
   **Interaction**: Swap the producer between Google APIs, a managed service and a partner SaaS;
   compare against the peered private-services-access picture.
   **Ending**: The tidy single endpoint beside the sprawling peered alternative. _"One service exposed,
   not one network joined."_
   **Variants**: `gcp-vpc-peering`, `gcp-private-google-access`, `gcp-cloud-sql-ha-replicas`; AWS
   PrivateLink, Azure Private Link.
   **Techniques**: boundary, path trace, side by side, failure, caption.
   **Review**: Keep — weighed "one door vs one road" and the AWS PrivateLink analogy as the
   frame, but "one service exposed, not one network joined" with the peered picture beside it is
   sharper and already in the plan. Checked: endpoint is an internal IP forwarding to a service
   attachment, NAT on the producer side so overlapping consumer ranges are fine, consumer-initiated
   only, crosses organizations, private services access = peering to a Google-managed network. The
   misconception (same as peering) is defeated in beats 2 to 4, and the opening frame stands alone.

### Cloud NAT (`gcp-cloud-nat`)

**The aha**: Cloud NAT has no gateway machine — it's programmed into Google's software-defined
network — so what you actually size and monitor is source ports per VM, not throughput.
**Misconception to defeat**: Picturing Cloud NAT like AWS's NAT Gateway, a managed appliance
instance that traffic funnels through and can be overwhelmed.
**Cast**: A subnet with three VMs, no external IPs, each making outbound calls. No box drawn
anywhere as "the NAT gateway" — each VM's outbound packet gets a small "NAT" stamp mid-arrow, with a
source-port meter per VM ticking up as connections open, and a shared external IP chip at the edge.
**Opening frame**: Three VMs, no external IPs, no gateway box in sight, port meters at zero. _"Where's
the NAT box? There isn't one."_
**Story**:

1. VM 1 opens an outbound connection; its packet gets stamped with the shared external IP and a
   port number, the port meter ticking to 1. _"Translated in flight, not at a chokepoint."_
2. VM 1 opens hundreds more connections rapidly, all to the same destination; its port meter climbs
   toward its allocation while VMs 2 and 3's meters stay flat. _"No shared throughput to contend
   for — each VM has its own port budget."_
3. VM 1's meter hits its cap; the next connection to that same destination bounces, "port
   exhaustion", while existing connections keep running and connections to other destinations still
   open. _"The limit is ports per destination, not a box melting under load."_
4. Try an inbound connection initiated from outside, aimed at one of the VMs: it bounces outright.
   Replies to VM-initiated connections still return. _"Outbound-only. Nothing gets in this way."_
5. Dynamic port allocation on: VM 1's allotment grows on demand toward a ceiling you set; a slider
   for the minimum and maximum ports per VM shows the cap rising. _"Size it by ports per VM — the
   real knob."_
   **The moment**: Beat 2, three VMs hammering outbound traffic with zero sign of shared contention,
   because there's no shared appliance to contend for.
   **Interaction**: Raise one VM's outbound rate and watch only its own port meter move; try an inbound
   connection; drag the min/max ports slider.
   **Ending**: Three VMs, their individual port meters, no gateway box anywhere on screen. _"What you
   monitor is ports per VM — there's nothing else to monitor."_
   **Variants**: `gcp-private-google-access`, `gcp-global-vpc`; AWS NAT Gateway (a managed appliance
   per AZ), Secure Web Proxy.
   **Techniques**: token, meter, failure, dial, caption.
   **Review**: Improved — beat 3's exhaustion was unqualified, but NAT ports are reused across
   different destinations, so exhaustion hits when many connections go to the same destination IP and
   port; the beat now shows that. Beat 5 offered "static instead of dynamic" as the fix; dynamic
   allocation already raises a VM's ports on demand, so the knob is the min and max, now a dial.
   Weighed a "post-office counter" metaphor; the missing box is more striking. Checked: no gateway,
   outbound-only, port allocation as the scaling limit.

### Network Service Tiers: Premium vs Standard (`gcp-network-service-tiers`)

**The aha**: Premium Tier rides Google's private backbone to the edge nearest the user before
handing off, cold potato; Standard Tier hands off to the public internet near the region instead,
hot potato; and only Premium supports global anycast IPs.
**Misconception to defeat**: Assuming "tier" is just a price label with no effect on the actual path
packets take.
**Cast**: A world map. A region in `us-central1` holding a backend. A user in Tokyo. Two paths
drawn: Premium, a thick line labelled "Google backbone" almost all the way to Tokyo before a short
public hop; Standard, a short Google segment near `us-central1` then a long public-internet line
labelled "ISP hops" the rest of the way.
**Opening frame**: Both paths drawn faintly, map unlit, price tags showing Premium higher than
Standard. _"Same traffic, two very different journeys."_
**Story**:

1. Light up Premium: the packet travels almost the entire distance on the backbone line, only
   popping onto the public internet right at an edge location near Tokyo. _"Cold potato: stay on
   Google's network as long as possible."_
2. Light up Standard instead, same packet, same endpoints: it leaves Google's network almost
   immediately near `us-central1` and spends most of the journey hopping across public ISPs. _"Hot
   potato: hand off early, let the internet carry it."_
3. Side-by-side latency meters: Premium's reads lower and steadier; Standard's reads higher and
   jumps more. _"The backbone is usually faster and steadier — that's what the price buys."_
4. Try to attach a global anycast IP to a load balancer under Standard Tier: it refuses, "global LB
   requires Premium". Standard only offers a regional IP. _"Standard can't do global anycast at
   all."_
5. Cost meter ticks: Standard's egress price sits visibly lower throughout. _"Standard trades path
   quality for a cheaper bill — a legitimate choice for tolerant traffic."_
   **The moment**: Beat 2, the exact same packet taking a visibly different-shaped path across the map
   purely from a tier switch, most of the backbone line disappearing.
   **Interaction**: Toggle Premium or Standard and watch the path redraw, the latency meter and the
   cost meter move together.
   **Ending**: Both paths shown at once, price and latency meters side by side. _"You're choosing how
   much of the trip rides Google's own network."_
   **Variants**: `gcp-global-external-alb`, `gcp-cloud-interconnect`; CDNs (caching, not routing), AWS
   Global Accelerator.
   **Techniques**: toggle, path trace, meter, side by side, caption.
   **Review**: Keep — weighed a "connecting flight" metaphor (which airline carries you how far)
   and a pure cost-vs-latency chart; the same packet taking two visibly different map paths is a
   truer picture of cold vs hot potato and defeats "just a price label" in beat 2. Checked: Premium is
   the default and rides the backbone to the edge nearest the user, Standard hands off near the region,
   only Premium gives global anycast IPs and global load balancers, Standard egress is cheaper. The
   opening frame (two faint paths, price tags) makes sense unprompted.

### Cloud DNS zones and hybrid DNS (`gcp-cloud-dns-private-hybrid`)

**The aha**: Each VPC has its own private DNS resolver and view, so hybrid name resolution is wiring
two separate views together, forwarding cloud-to-on-prem, an inbound policy on-prem-to-cloud.
**Misconception to defeat**: Assuming DNS "just works" across a VPN or Interconnect link the way it
does on one flat network.
**Cast**: The VPC frame with its private zone (`internal.example.com`) and a resolver icon at the
fixed metadata-server address. An on-prem network box with its own resolver and a firewall. A VPN
tunnel between them. Two arrows to wire: a forwarding zone (cloud → on-prem) and an inbound server
policy (on-prem → cloud).
**Opening frame**: VPC resolver, on-prem resolver, tunnel between them, both arrows undrawn, both
sides blind to each other's names. _"Two networks, two separate views of DNS."_
**Story**:

1. A VM queries `app.corp.local`, an on-prem name: the VPC resolver has no record, "not found".
   _"Right now, cloud can't see on-prem's names."_
2. Add a forwarding zone for `corp.local` pointing at the on-prem resolver. The query is forwarded
   but times out: it arrives from `35.199.192.0/19`, which the on-prem firewall drops and has no
   route back to. Allow the range and route it over the tunnel: the same query resolves. _"Forwarded
   queries come from 35.199.192.0/19 — let it in and route it back."_
3. Flip direction: an on-prem host queries a cloud private-zone name; on-prem's resolver has no
   record either. _"Still blind the other way."_
4. Add an inbound server policy: it gives on-prem a resolver address inside the VPC. Point on-prem's
   resolver at it over the tunnel; the host's query now resolves. _"Inbound policy: an address for
   on-prem to ask."_
5. Add a second VPC with DNS peering to the first, so it reuses the first VPC's private zone without
   its own copy. _"Peering borrows another VPC's view, rather than forwarding."_
   **The moment**: Beat 2, the forwarded query timing out until the on-prem firewall is shown
   allowing `35.199.192.0/19` back in — the detail that silently breaks this in practice.
   **Interaction**: Wire or unwire each direction, forwarding zone, inbound policy, DNS peering, and
   send a query each way; toggle the on-prem allow for the return range.
   **Ending**: Both arrows wired, both resolvers answering each other's names, tunnel calm. _"DNS
   doesn't cross a VPN by itself — you wire both directions."_
   **Variants**: `gcp-global-vpc`, `gcp-cloud-vpn`, `gcp-cloud-interconnect`; Route 53 Resolver
   endpoints, Azure Private DNS Resolver.
   **Techniques**: boundary, token, path trace, failure, exchange, caption.
   **Review**: Improved — the plan tied the `35.199.192.0/19` gotcha to the inbound direction; those
   are the source addresses of queries Cloud DNS forwards out to on-prem, so it belongs to the
   forwarding-zone beat, where the moment now sits. The inbound beat is simplified to the resolver
   address on-prem asks. Weighed teaching the four DNS objects as a table; wiring one arrow at a time
   is easier. Checked: metadata-server resolver, forwarding zone, inbound server policy, DNS peering.

### Cloud VPN: HA VPN vs Classic VPN (`gcp-cloud-vpn`)

**The aha**: HA VPN's 99.99% SLA comes from topology, not the product name — both interfaces need
tunnels to the peer with dynamic routing, so a failed tunnel shifts traffic by itself.
**Misconception to defeat**: Assuming "HA VPN" is automatically highly available just by being the
newer product, regardless of how it's wired.
**Cast**: An HA VPN gateway box with two interfaces, each its own public IP, each with a tunnel
running to a peer gateway, both routed dynamically via Cloud Router and BGP. Beside it, a Classic
VPN gateway box with one interface, one tunnel, static routes. A bandwidth meter per tunnel ("up to
~3 Gbps").
**Opening frame**: HA VPN's two interfaces, two tunnels, both green, BGP routes flowing on both.
Classic VPN's single interface, single tunnel, static route label. _"Two designs, two different
ceilings."_
**Story**:

1. Fail one of HA VPN's two tunnels (red flash): BGP routes over it expire after the hold timer (up
   to about a minute by default, faster with BFD) and traffic shifts onto the surviving tunnel with
   no manual step. _"Dynamic routing: the failure routes around itself."_
2. Fail Classic VPN's single tunnel: traffic simply stops, nothing to shift to. _"One tunnel, no
   failover — that's the SLA gap."_
3. Rewind HA VPN: configure only one of its two interfaces with a tunnel. Fail that tunnel: traffic
   stops too, despite being "HA VPN"; the SLA badge reads "not met". _"The product name alone
   doesn't earn 99.99% — both interfaces, both tunnels, dynamic routes do."_
4. Push traffic past ~3 Gbps across one tunnel: it saturates. Add a second parallel tunnel on the
   same interface: the meter's total rises. _"More bandwidth means more tunnels, not a bigger
   pipe."_
5. Push far past what tunnels reasonably multiply to: an arrow points off toward "Cloud
   Interconnect". _"Beyond a point, VPN isn't the tool — interconnect is."_
   **The moment**: Beat 3, "HA VPN" failing exactly like Classic VPN the moment it's wired with only one
   active tunnel — the name never was the guarantee.
   **Interaction**: Toggle how many interfaces or tunnels are active and fail one to see whether
   traffic shifts.
   **Ending**: Both interfaces active, both tunnels green, BGP routes flowing on both, SLA badge lit.
   _"99.99% is something you wire, not something you buy."_
   **Variants**: `gcp-cloud-interconnect`, `gcp-vpc-routing`; AWS and Azure's own VPN gateways.
   **Techniques**: boundary, failure, meter, path trace, toggle, caption.
   **Review**: Improved — "BGP withdraws within seconds" overstated failover speed (default hold time
   is about a minute unless BFD is on); the old 2 Gbps saturation point sat inside the 1 to 3 Gbps
   range the catalog gives, so it is now ~3 Gbps. Weighed a plain table of SLAs; the "name vs wiring"
   failure in beat 3 is far more memorable. Checked: HA VPN two interfaces, BGP, 99.99% requires both
   tunnels, Classic single interface and static routes.

### Cloud Interconnect: Dedicated, Partner and Cross-Cloud (`gcp-cloud-interconnect`)

**The aha**: Choose by bandwidth and reach: VPN for quick and modest, Partner Interconnect without a
Google facility or under 10 Gbps, Dedicated for high steady volume, and none of it is encrypted
unless you add MACsec or VPN on top.
**Misconception to defeat**: Assuming any "Interconnect" product is automatically encrypted like a
VPN, because it sounds more secure.
**Cast**: Three parallel paths from an on-prem network box to a VPC frame: Cloud VPN (a padlock on
the line, internet cloud underneath), Partner Interconnect (through a service-provider box, no
padlock), Dedicated Interconnect (a direct cable into a Google colocation facility icon, no
padlock). A bandwidth meter and an SLA meter per path.
**Opening frame**: Three paths side by side, bandwidth meters at different scales, one padlock
visible, two paths bare. _"Same destination. Different roads — only one locked by default."_
**Story**:

1. Send a packet along VPN: it rides the public internet, padlock visible, bandwidth meter capped
   low. _"Fast to set up, encrypted, modest bandwidth."_
2. Send the same packet along Partner Interconnect: no public internet, no padlock either, the raw
   packet is visible mid-path. _"Private, but not encrypted, by default."_
3. Send it along Dedicated Interconnect, direct into the colocation facility: same bare packet, but
   the meter now reads 10 or 100 Gbps. _"High, steady volume — still nothing locking it."_
4. Add a MACsec badge onto the Dedicated path, or layer HA VPN on top of an Interconnect path: the
   padlock reappears. _"Want encryption on a private circuit? You add it."_
5. SLA meter finale: one Dedicated connection reads "no SLA", flagged "development only"; add a
   second in the same metro on a different edge availability domain and the meter reads 99.9%; add
   two more in a second metro and it reads 99.99%. _"The SLA is redundancy you build, in metros and
   domains, not a number the product hands you."_
   **The moment**: Beat 2, the private, expensive Interconnect path shown just as bare and unencrypted
   as the moment it leaves the colocation facility, contradicting the instinct that "private" means
   "safe."
   **Interaction**: Choose a path by bandwidth need and facility access; add redundant connections and
   watch the SLA meter climb.
   **Ending**: All three paths, encryption added where chosen, SLA meter at its earned level.
   _"Bandwidth and reach pick the road. Redundancy earns the SLA. Encryption is always a choice."_
   **Variants**: `gcp-cloud-vpn`, `gcp-network-connectivity-center`; Cross-Cloud Interconnect as a
   fourth path to another cloud; Direct and Carrier Peering (different purpose), AWS Direct Connect,
   Azure ExpressRoute.
   **Techniques**: boundary, token, meter, failure, side by side, caption.
   **Review**: Improved — beat 5 showed a single connection with a 99.9% SLA; one connection has no
   SLA, 99.9% needs two in a metro on different edge availability domains, and 99.99% needs four
   across two metros. Weighed a decision tree as the main frame; the "bare packet" moment is a better
   anchor for the encryption misconception. Checked: Dedicated 10 and 100 Gbps, Partner 50 Mbps to 50
   Gbps, MACsec or HA VPN for encryption, Cross-Cloud mentioned.

### Network Connectivity Center (`gcp-network-connectivity-center`)

**The aha**: NCC adds the transitivity that VPC Peering lacks — many VPCs and sites reach each other
through one hub, instead of needing a direct link between every pair.
**Misconception to defeat**: Expecting a mesh of individual peerings or VPNs to already behave like
a hub, when none of them talk to each other.
**Cast**: A central hub icon, drawn as a route table, not a box packets enter. Around it, spokes:
three VPC frames (VPC spokes), an on-prem network box reached by HA VPN (a hybrid spoke), another
reached by an Interconnect VLAN attachment (a hybrid spoke), and a branch office box connected by
an SD-WAN appliance (a hybrid spoke). No direct lines between any two spokes at first; each spoke
connects to the hub.
**Opening frame**: Five spokes, one hub, no spoke-to-spoke lines at all. _"Everything joins the
hub — on purpose."_
**Story**:

1. VPC spokes A and B each join the hub: route rows flow in, then out to the other. A packet from A
   to B then flows directly along a new path between them; the hub only shared the routes. _"Two
   VPCs, connected without ever peering directly."_
2. The on-prem HA VPN spoke joins: its routes reach the VPC spokes and theirs reach it; a packet
   from on-prem to VPC spoke C arrives. _"A hybrid site reaches a VPC the same way."_
3. Replay the A–B–C dead end from `gcp-vpc-peering`: A's table was missing C's row. With all three
   as spokes, A's table gains C's row, and A's packet to C now succeeds. _"This is the
   transitivity peering never had."_
4. Add a sixth spoke, a branch office, by joining it to the hub — every existing spoke gets its
   routes and can reach it, with no new line to any of the other five. _"Add once at the hub,
   reachable from everywhere."_ (Branch-to-branch paths over Google's backbone need site-to-site
   data transfer switched on.)
5. Toggle topology from "mesh" (every spoke exchanging with every other) to "star" (edge VPCs reach
   only a central group): the reachability lines narrow. _"The hub can also enforce a star, not just
   a free-for-all mesh."_
   **The moment**: Beat 3, replaying the exact A–B–C dead end from the peering concept and watching A's
   missing routing row appear, with nothing changed except joining the hub.
   **Interaction**: Add a new spoke and see what it can reach with zero new direct lines; toggle mesh
   vs star topology.
   **Ending**: Six spokes, one hub, every pair reachable, or deliberately not in star mode, via the
   shared routes. _"One hub, and every spoke stops needing its own line to every other."_
   **Variants**: `gcp-vpc-peering`, `gcp-shared-vpc`, `gcp-cloud-interconnect`, `gcp-cloud-vpn`; AWS
   Transit Gateway, Azure Virtual WAN.
   **Techniques**: boundary, path trace, token, toggle, side by side, caption.
   **Review**: Improved — the old beats routed every packet A → hub → B, as if the hub were an
   appliance in the data path; NCC is a route-exchange hub like Cloud Router, which is exactly the
   control-plane lesson from `gcp-vpc-routing`, so the hub is now drawn as a route table and packets
   go direct. Added the site-to-site data transfer caveat for hybrid-to-hybrid traffic. Weighed
   keeping the through-the-hub animation (clearer at a glance) and rejected it as untrue. Checked:
   VPC, hybrid and router-appliance spokes; mesh and star.

### The Cloud Load Balancing family (`gcp-load-balancer-family`)

**The aha**: There's no single "load balancer" product — the right one falls out of three
independent choices (traffic type, exposure, scope), and each choice changes the IP, client-IP
visibility and available features.
**Misconception to defeat**: Looking for one "Google Cloud load balancer" the way one might look for
"the AWS ALB."
**Cast**: A three-question path, the "which service" chooser: Q1 "Traffic type?" (HTTP/HTTPS, TCP
with TLS offload, any IP protocol), Q2 "Exposure?" (external, internal), Q3 "Scope?" (global or
cross-region, regional). Each answer narrows a grid of lit icons until one resolved load balancer
type remains, with its IP badge (anycast global vs regional) and feature badges (Cloud CDN, Cloud
Armor, IAP) lighting beside it. The older "classic" Application Load Balancer sits in the grid,
permanently dim, tagged "legacy".
**Opening frame**: All three questions open, a grid of every possible load balancer type dimly
visible behind them. _"Not one product. Three choices."_
**Story**:

1. Answer Q1 "HTTP/HTTPS": every TCP-only and passthrough option dims; only Application Load
   Balancer types stay lit. _"Traffic type narrows the field first."_
2. Answer Q2 "external": the internal-only variants dim further. _"Who can reach it next."_
3. Answer Q3 "global": one current type remains lit, the global external Application Load
   Balancer, its anycast IP badge and full feature set lighting at once. _"Scope decides the IP and
   the feature set."_
4. Rewind, answer Q1 as "any IP protocol" instead: the path resolves to a passthrough Network Load
   Balancer, its badge showing "preserves client IP" where the Application Load Balancer's badge
   read "sees the proxy's IP"; its scope is stuck on regional. _"A different first answer, a
   different machine underneath."_
5. Rewind once more, choose "regional" at Q3: the resolved type's IP badge flips from the anycast
   globe to a plain regional IP chip. _"Scope alone changes the kind of address you get."_
   **The moment**: Beat 3 vs beat 5, the identical first two answers landing on two different IP badges
   purely from the scope answer.
   **Interaction**: Answer the three questions in any order and watch the grid narrow to one type, with
   its IP and feature badges.
   **Ending**: One fully resolved type, its IP badge and feature badges lit, the rest of the grid dim.
   _"Three questions, one answer — never a single default."_
   **Variants**: `gcp-lb-anatomy`, `gcp-global-external-alb`, `gcp-proxy-vs-passthrough-lb`; AWS ALB,
   NLB and GWLB, Azure Front Door, Application Gateway and Load Balancer.
   **Techniques**: choice, spotlight, meter, caption.
   **Review**: Improved — beat 3 claimed exactly one type survives "external, HTTP, global", but the
   older classic Application Load Balancer also matches; it now sits in the grid dimmed as legacy, so
   a viewer who knows the console isn't surprised. Beat 4 notes passthrough can't go global, which
   pre-tees `gcp-proxy-vs-passthrough-lb`. Weighed presenting a flat table of all types; the
   narrowing path is what actually helps a person choose. Checked: Application, proxy and passthrough
   Network LB, internal vs external, regional vs global.

### Load balancer building blocks (`gcp-lb-anatomy`)

**The aha**: There's no single "load balancer" resource in the API — it's a chain of parts
(forwarding rule → target proxy → URL map → backend service → backends), and knowing the chain
tells you exactly where each setting lives.
**Misconception to defeat**: Imagining the console's "load balancer" as one object, rather than a
label on a chain of resources.
**Cast**: Five boxes in a horizontal chain: forwarding rule (an IP and port chip), target proxy (a
certificate icon clipped to it), URL map (branching paths by host and path), backend service (a
dial for balancing mode, a health-check heart, CDN and Armor toggles), backends (a managed
instance group and a serverless network endpoint group). Below the URL map, a second branch goes
straight to a backend bucket icon, skipping the backend service. One request token travels left to
right.
**Opening frame**: The boxes in a row, a faint "Load Balancer" tag floating above the whole chain
in a lighter colour. _"The console's name is a label on a chain, not a box of its own."_
**Story**:

1. A request token lands on the forwarding rule (an IP and port 443): "First, an IP and a port."
   The token moves on.
2. At the target proxy, a TLS certificate icon clips to it and terminates the token's encryption.
   _"Certificates live here."_
3. At the URL map, the token's path branches it toward one lane among several. _"Routing lives
   here — host and path rules, splits, rewrites."_
4. Down the backend-service lane: the health-check heart on one backend is checked green before the
   token is allowed through; a CDN toggle and an Armor toggle sit on this same box. _"Health,
   balancing, CDN and Armor settings live on this box."_
5. The token reaches the backends: a managed instance group or a serverless network endpoint group
   (Cloud Run, say); then a second request takes the bucket lane straight from the URL map. _"One IP
   can front a VM, a container and a bucket at once."_
6. Zoom out: the floating "Load Balancer" tag dissolves into highlighting every box it was always
   just naming. _"There was never a sixth box. Just a name for the chain."_
   **The moment**: Beat 6, the tag dissolving to reveal it was never a real resource, right after
   watching the request actually move through distinct ones.
   **Interaction**: Click any box to see what settings live only there.
   **Ending**: The chain, token having passed through, tag gone. _"A few parts. One name for
   convenience."_
   **Variants**: `gcp-load-balancer-family`, `gcp-global-external-alb`, `gcp-cloud-armor`; Kubernetes
   Ingress and Gateway objects, which GKE builds this chain for you from.
   **Techniques**: token, path trace, spotlight, zoom, caption.
   **Review**: Improved — the plan listed a bucket among the backends of a backend service; a backend
   bucket is its own resource that the URL map points at directly (no health check, no balancing mode),
   so it now has its own lane. Weighed an "airport" metaphor (check-in, security, gate); a literal
   chain with settings pinned to each box is more useful. Checked: forwarding rule, target proxy with
   certificates, URL map, backend service holding health checks, CDN and Armor.

### Global external Application Load Balancer and Cloud CDN (`gcp-global-external-alb`)

**The aha**: One anycast IP serves the whole planet — users connect to the nearest Google edge, TLS
terminates there, and the request rides the backbone to the closest healthy backend with spare
capacity, failing over across regions with no DNS change.
**Misconception to defeat**: Thinking global load balancing works like DNS-based balancing (Route 53
latency records, Traffic Manager), where failover means waiting for a new DNS answer.
**Cast**: A world map with user dots in Tokyo, São Paulo and Berlin. One anycast IP chip floating
above the whole map, not tied to any single point. Google Front End icons at edge locations near
each user cluster, each with a small cache shelf. Backend regions in `us-central1` and
`asia-southeast1`, each with a capacity meter and a health heart.
**Opening frame**: The one IP chip above the map, three user clusters, two backend regions both
green. _"One address. The whole planet."_
**Story**:

1. The Tokyo user's request travels the shortest distance to the nearest Google Front End; TLS
   terminates right there, the token's look changing from encrypted to internal. _"Nearest edge,
   not nearest backend."_
2. From that edge, the decrypted request rides a thick backbone line to the closest healthy backend
   with spare capacity, `asia-southeast1`, its capacity meter ticking. _"Then the backbone carries
   it the rest of the way."_
3. The Berlin user's request, same single IP, takes a different edge and backbone path to a
   different backend. _"Same IP, every user, a path chosen just for them."_
4. Flash `asia-southeast1`'s health heart red: after a few seconds' health-check delay, new requests
   from Tokyo still hit the same edge and IP but ride the backbone to `us-central1` instead, with no
   DNS lookup. A request that was mid-flight to the failed region errors and is retried. _"Failover
   happens on the backbone, not in DNS."_
5. Side-by-side contrast: a DNS-based alternative resolving a different IP after a TTL countdown,
   versus this one IP never changing through the same failure. _"DNS-based: wait out a TTL.
   Anycast: the address never changes."_
6. Turn on Cloud CDN: Berlin's second request for the same image is answered from the edge's cache
   shelf and never reaches a backend. _"CDN is just caching inside the same edge."_
   **The moment**: Beat 4, the single IP never changing while the backend underneath it silently
   swaps regions.
   **Interaction**: Fail a backend region and watch which edge users get rerouted through the
   backbone, versus toggling to the DNS-based comparison.
   **Ending**: The one IP chip, both regions shown, one healthy, traffic quietly reshaped around the
   failure. _"One IP for the planet — the planet moves around failures, not the address."_
   **Variants**: `gcp-load-balancer-family`, `gcp-lb-anatomy`, `gcp-network-service-tiers`,
   `gcp-cloud-armor`; DNS-based global balancing, the regional Application Load Balancer.
   **Techniques**: token, path trace, failure, side by side, meter, caption.
   **Review**: Improved — beat 4 claimed existing connections keep flowing through the failure, which
   overpromises (in-flight requests to the dead backend fail until health checks react); softened to
   a short detection delay and a retry. Cloud CDN is in the concept's title but appeared nowhere, so
   beat 6 adds a cache hit. Weighed a "global switchboard" metaphor, but the unchanged IP over a
   changing path is the cleaner contrast. Checked: GFE edge TLS termination, Premium-tier anycast,
   cross-region failover without DNS.

### Proxy vs passthrough load balancers (`gcp-proxy-vs-passthrough-lb`)

**The aha**: Proxy load balancers terminate the client connection and open a new one to the backend,
TLS offload, global reach, but the backend sees the proxy's IP; passthrough forwards packets
unchanged, keeping the client's IP and any protocol, but staying regional with raw traffic.
**Misconception to defeat**: Assuming "layer 4 vs layer 7" always means the same thing as
"passthrough vs proxy" — Google has proxies at both layers.
**Cast**: Side by side. Left, "Proxy": client → Google Front End or Envoy box → backend, two
separate connection segments drawn distinctly, each with its own source-IP label. Right,
"Passthrough" (Network Load Balancer, built on Maglev): client → balancer → backend as one
unbroken connection, the client's IP carried through, and the backend's reply going straight back
to the client. A small 2×2 grid, rows "layer 4 / layer 7", columns "proxy / passthrough", initially
empty.
**Opening frame**: Both setups, one client each, same backend type, connection lines drawn
differently already. _"Same job. Already a different shape."_
**Story**:

1. On the proxy side, the client's connection ends at the Front End box; a brand-new connection,
   with the box's own IP as source, continues to the backend. The backend's log shows the box's IP,
   with `X-Forwarded-For` carrying the real client IP as a header. _"The backend sees the proxy —
   unless it reads the header."_
2. On the passthrough side, the same client's packet reaches the backend with the client's own IP
   untouched, and the reply skips the balancer on its way back. _"The backend sees the client, no
   header needed."_
3. Send a UDP packet and an ESP packet down both paths: the proxy path rejects both (TCP and TLS
   only); the passthrough path carries both through unchanged. Add a TLS certificate to the proxy
   box and it terminates there, offloading the backend; the passthrough path has no box to hold one.
   _"Passthrough carries any IP protocol. TLS offload is a proxy feature."_
4. Fill the grid: the Application Load Balancer lands at layer 7 / proxy; a passthrough Network Load
   Balancer at layer 4 / passthrough; then the proxy Network Load Balancer drops into layer 4 /
   proxy, terminating TCP, losing the client IP unless PROXY protocol is on; layer 7 / passthrough
   stays empty. _"Layer 4 versus 7 is a different question from proxy versus passthrough."_
5. Try to make the passthrough setup "global": its badge stays "regional". The proxy setup's badge
   toggles to "global". _"Global reach needs the proxy's architecture."_
   **The moment**: Beat 1 vs beat 2, the same client's IP arriving intact on one side and
   disguised-but-logged-separately on the other, the single fact that explains most of this concept's
   practical headaches.
   **Interaction**: Send different protocols (TCP/TLS, UDP, ESP) down each path and see which survive;
   toggle scope global or regional on each.
   **Ending**: Both paths side by side, IP labels diverging at the backend, the grid filled. _"Terminate
   and relay, or forward untouched — pick by what the backend needs to see."_
   **Variants**: `gcp-load-balancer-family`, `gcp-lb-anatomy`, `gcp-vpc-routing` (passthrough as a
   route's next hop); layer 4 vs layer 7 in general.
   **Techniques**: side by side, token, path trace, toggle, caption.
   **Review**: Improved — the named misconception (layer 4/7 versus proxy/passthrough) was never
   defeated on screen; beat 4 is now the 2×2 grid with the proxy Network Load Balancer at layer 4. The
   old TLS-offload beat merged into beat 3 to keep the count. Added direct server return, so
   passthrough's reply path is drawn truthfully. Weighed a plain "who owns the connection" diagram;
   kept the IP-visible-to-backend moment. Checked: Maglev, X-Forwarded-For, PROXY protocol,
   passthrough regional, UDP/ESP passthrough only.

### Cloud Armor (`gcp-cloud-armor`)

**The aha**: Because the load balancer is a proxy, volumetric layer 3 and 4 floods never even reach
your backends, they're dropped at Google's edge, and Cloud Armor handles the layer 7 part with
rules on the backend service.
**Misconception to defeat**: Expecting Cloud Armor to be the thing stopping network-level floods,
when the proxy architecture itself already blocks those before Armor ever runs.
**Cast**: The world map with the anycast IP and Google Front End edges from `gcp-global-external-alb`,
now with a Cloud Armor shield icon at the edge, and a backend service box behind it with a
security-policy panel (OWASP rule chips, an IP or geo rule, a rate-limit meter, an Adaptive
Protection badge).
**Opening frame**: Edge with shield, backend calm behind it, security-policy panel showing a few
rule chips. _"Attacks meet the shield before they meet you."_
**Story**:

1. A volumetric SYN flood aimed at the anycast IP arrives at the Front End edge; it's absorbed and
   dropped there, by the sheer architecture of being a proxy, the backend's traffic meter never
   twitches. _"Layer 3 and 4 floods die at the edge, structurally — before Armor's rules even
   run."_
2. A layer 7 attack, a malicious SQL-injection-shaped request, arrives, passes the proxy fine (it's
   a valid connection), and is checked against an OWASP rule chip on the backend service's security
   policy: flagged, blocked, red flash. _"This is Armor's actual job — content, not volume."_
3. Add a geo rule "block requests from region X": a request from that region bounces at the same
   policy panel, never reaching the backend. _"Geo and IP rules, same place."_
4. Spike a rate-limit meter past its threshold with a burst of otherwise-valid requests: past the
   line, further requests from that source are throttled or blocked. _"Rate limiting, enforced right
   here."_
5. A slow, evolving attack pattern pushes traffic off its normal baseline: the Adaptive Protection
   badge lights after a short learning beat and drafts a suggested rule, which an operator accepts
   (or, with auto-deploy on, applies by itself). _"Adaptive Protection spots what a fixed rule
   can't, and proposes the fix."_
6. Contrast inset: the same OWASP rule chip tried against a VPC firewall rule panel instead, it has
   no such concept, flagged "wrong layer". _"VPC firewall rules match addresses, ports and
   protocols — not request content."_
   **The moment**: Beat 1, the flood simply never showing up as a blip anywhere near the backend's own
   meter, the proxy architecture, not a rule, is what stopped it.
   **Interaction**: Send a volumetric flood vs a crafted layer-7 request and see where each one
   actually gets stopped.
   **Ending**: Shield at the edge, calm backend, security-policy panel with its rule chips lit from the
   beats above. _"The proxy stops the flood. Armor stops the clever stuff."_
   **Variants**: `gcp-global-external-alb`, `gcp-firewall-rules-policies`, `gcp-lb-anatomy`; VPC
   firewall rules (inside the network), AWS WAF and Shield, Azure WAF.
   **Techniques**: boundary, failure, meter, spotlight, side by side, caption.
   **Review**: Improved — beat 5 had Adaptive Protection start blocking on its own; it detects
   anomalies and proposes a rule that you accept, auto-deploy being an opt-in, so the beat shows
   that. Beat 6's claim was too absolute (newer firewall tiers do inspect traffic), so the caption
   now says what basic firewall rules actually match on. Weighed a layered "onion" diagram of
   defences; the unmoved backend meter in beat 1 is a better moment. Checked: policies on backend
   services, OWASP, geo/IP, rate limit, Adaptive Protection.
