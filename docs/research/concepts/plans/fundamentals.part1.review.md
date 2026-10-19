# Fundamentals part 1: review summary

Verdicts (28 plans): Keep 5, Improved 23, Rethought 0, Merged 0.

Keep: on-premises-vs-cloud, nist-cloud-characteristics, iaas-paas-saas, virtual-machines, landing-zone.

## Most important changes

- quotas-and-limits: a capacity reservation still counts against the quota (plan showed it exempt); quotas are per region.
- zonal-regional-global-resources: regional scope does not guarantee zone redundancy (managed databases run in one zone until HA is on); replaced two weak beats.
- compute-options-compared: bare metal is not all blue (provider still owns facility to servers); VMs already bill per second, so billing/scaling gains moved to serverless and functions.
- multi-cloud: egress is charged on leaving a provider, entering is free.
- data-residency-and-sovereignty: sovereignty means keys, operations, support and jurisdiction; the order still arrives but yields only ciphertext.
- regions-and-zones: zone latency is about 1-2 ms and cross-zone traffic is billed (was "sub-millisecond", "almost free").
- managed-vs-self-managed: failover takes a minute or two with HA enabled; engineer-hours meter added so total cost is compared.
- shared-responsibility-model: unsourced breach statistic replaced with typical causes.
- dedicated-hosts-and-bare-metal: bare metal motivated by own hypervisor/raw hardware, not compliance; both bill the whole machine.
- tagging-and-labels, policy-guardrails, cloud-deployment-models, edge-locations-and-pops: wording fixes to match real provider behaviour.

## Patterns for the platform

- The ten-layer responsibility stack with per-layer blue/grey/hatched state, driven by a slider, is reused by about eight plans (IaaS/PaaS/SaaS, CaaS, compute options, shared responsibility, serverless).
- Failure injection on a map or frame (zone, region, account wall) with survive/grey-out states is the dominant moment in global-infrastructure and governance plans.
- Demand line plus capacity area plus coin meter, with a dial reshaping demand.
- Nested frames with inheritance "drip" (policy, budget, tag), and drag-to-reparent with rules swapping.
- Tokens crossing boundaries with a toll or bounce (egress, court order, leaked key, denied action).
- Side-by-side compare with a freeze frame; toggles that flip a label.
- Scope per provider differs (AWS accounts hold resources directly; Azure resource groups; Google folders/projects), so hierarchy art should be generic with provider-name overlays.
