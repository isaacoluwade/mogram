# Google Cloud plans, part 2: review summary

Verdicts (31 plans): Keep 1, Improved 30, Rethought 0, Merged 0.

## Most important changes

- Moving data (`gcp-data-transfer-options`): the appliance "arrives in 2 days" ignored order, copy, return and ingest (weeks); added the 100 Mbps case and a stage bar.
- Machine families: memory arithmetic was wrong (n2-standard 4 GB/vCPU, highmem 8 GB/vCPU, no highmem-6); now 4 vCPU / 20 GB between 16 and 32 GB.
- Spot VMs: a Spot VM is stopped, not erased; persistent disks survive, so the data loss is Local SSD plus a lone server staying down.
- Block storage: boot disks auto-delete with the VM, so the test is now a stop.
- GKE node pools: taints/selectors were backwards in beat 1; Pending Pods now trigger node scale-up.
- GKE VPC-native: address maths fixed (/22 Pod range = four /24 node blocks, the fifth node fails).
- GKE release channels: the "never upgrade" misconception is now defeated by a forced end-of-support upgrade.
- Cloud Run: new deploys default to 100% traffic (now shown as a pinned deploy); no-token calls return 403 not 401; FaaS boxes are reused, not single-use.
- Autopilot: nodes are not "sized exactly" to a Pod; the spare room is Google's cost.
- AlloyDB: columnar engine lives in compute memory; removed the unsupported "seconds not minutes" failover claim.
- Autoclass default floor is Nearline, uniform access makes ACLs inert (not deleted), live migration has a brief real blackout.
- Removed invented figures (12 ms latency, "under a second" pause).

## Patterns for platform design

- "Same load through option A and option B" side-by-side with shared counters (concurrency, Autopilot vs Standard, classes, key designs) appears in most plans; needs synchronized dual scenes driven by one input.
- Load heatmaps over ranges (splits, tablets, zones) with a toggle between key designs and an "add nodes" action.
- Failure injection at a chosen scope (VM, zone, region) on any boundary frame, with survivors and casualties computed.
- Meters that tick with time (cost, uptime, countdowns, day counters) and a dial changing a rate or size; many "moments" are a meter diverging from an expectation.
- Question-path / decision-ladder widgets that light one service icon (choose-compute/storage/database).
- Permission gates that bounce labelled tokens (Invoker, public access prevention, Bucket Lock) with reason text.
- Key-range bars divided into pieces served by nodes, with ownership moving without data moving.
