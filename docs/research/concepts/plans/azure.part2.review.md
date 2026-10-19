# Azure plans part 2: review summary

**Verdicts (27 plans)**: Keep 0, Improved 26, Rethought 1 (`azure-durable-functions`), Merged 0.

## Most important changes

- `azure-durable-functions`: rewritten. The old "kill the process" beat had nothing to kill (the orchestrator had already stopped); now the code visibly re-executes from line 1 and a nondeterministic `now()` produces an on-screen mismatch.
- `azure-cosmos-db-consistency-levels`: "5 versions or 5 seconds" is a single-region minimum; the cross-region scenario drawn needs 100,000 versions or 5 minutes. Session reframed around one client's session token.
- `azure-storage-auth`: Owner can list account keys and so reach data via Shared Key; added the key drawer and the "disable shared key access" switch. Role revocation is minutes, not instant; ad hoc SAS can't be recalled.
- `azure-blob-data-protection`: an admin can switch soft delete and versioning off, so only a locked immutability policy survives an attacker; the redundancy misconception is now shown (delete hits all replicas).
- `azure-app-service-deployment-slots`: warm-up is part of the swap, and sticky settings stay with the slot so v2 runs with production's settings.
- `azure-vm-building-blocks`: portal-created VMs delete the OS disk, NIC and IP with the VM by default; added per-part "delete with VM" switches.
- `azure-storage-account`: the anonymous-access setting is blob-only; the account-wide switch is network access.
- `azure-container-apps`: contradiction (0 replicas yet 10% traffic) fixed by separating an HTTP-scaled web app from a queue-scaled worker.
- `azure-aks-architecture` and `azure-aks-networking`: pods are evicted and recreated (not migrated); nodes are replaced via surge; flat mode reserves a node's pod addresses at join; "hard to change" softened.
- Also: change feed holds only latest versions; SQL meters, Data Factory capability, failover group grace period and data loss, availability set is not zone-pinned.

## Patterns for the platform

- **Ownership colouring** (you / Azure) on layers of a stack, toggled: compute decision, AKS Automatic.
- **Failure injection against a configuration choice** (rack/zone/region x SKU): VM availability, storage redundancy, SQL and Cosmos failover. Needs a reusable failure-picker plus survivor display.
- **A meter that reacts to a dial** (cost, RU/s, address pool, queue depth, lag): nearly every plan. Includes paired meters moving oppositely.
- **Same input through several options, side by side**: the plan's most common structure.
- **A code panel with a cursor** (Durable Functions replay; bindings vs SDK code): a new need, a few lines of code with a moving pointer and an external history.
- **Settings pinned to a label versus travelling with a box** (slot-sticky): needs separable "container" and "label" objects that swap independently.
- **Clone-to-all-members** (apps in every plan instance, scale set growth) and **timers for waits** (cold start, rehydration, grace period).
- Plans repeatedly needed a "what happens to the bill" strip; make cost a first-class overlay.
