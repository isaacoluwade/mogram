# Fundamentals part 2: review summary

## Verdicts (33 plans)

- Keep: 5 (finops, showback-vs-chargeback, unit-economics, rate-vs-usage-optimization, cost-of-idle)
- Improved: 28 (including `control-plane-vs-data-plane`, the owned id, polished with Reliability's and Networking's best ideas)
- Rethought: 0
- Merged: 0

## Most important changes

- `control-plane-vs-data-plane`: now ends on two recoveries for the same crash (press Create and bounce, or fail over to an already-running standby via a health check). Weighted-DNS dial from Reliability was dropped, since changing a weight is itself an API call.
- `well-architected-pillars`: radar-chart logic fixed; pulling Reliability outward must pull Cost optimisation inward.
- `composite-sla`: parallel example rebuilt on 99.9% components (was 99%), with the independence caveat.
- `budgets-and-anomaly-alerts`: "within the hour" corrected to about a day, since billing data lags.
- `spot-instances`: 2-minute notice is AWS only; Azure and GCP give about 30 seconds.
- `byol-vs-license-included`: BYOL wins only if licences are already owned and eligible.
- `cost-and-usage-data`: uses FOCUS ListCost/BilledCost/EffectiveCost, showing covered usage billed at zero.
- `cloud-cost-drivers`: added requests; fixed miscounted lines and amounts so the thin lines really exceed Storage.
- `schedule-non-prod-off`: consistent numbers (50 of 168 hours, about 70%) plus the disk/commitment catch.
- `migration-strategies-7rs`: Relocate was in the chute but never shown; now it is.
- `data-transfer-costs`, `commitment-discounts`, `data-gravity`: real magnitudes added and flagged as provider-specific or illustrative.
- `rightsizing`: "Large/Medium" replaced by vCPU counts; memory and network meters added.

## Patterns for the platform

- Coin meter plus "paid but unused" grey area recurs in nearly every cost plan (idle, commitments, autoscaling, scheduling); needs a first-class "billed vs used" area primitive.
- Demand curve with stacked, adjustable bands (commitment, on-demand, spot, capacity) needs a shared chart with draggable horizontal bands and live cost integration.
- Dial-driven recomputation (rate x usage, composite SLA, transfer time, TCO) needs formula-bound numbers, not scripted ones.
- Same-event side-by-side (two recoveries, two scale-in rules, two tier choices) needs synchronised replays of one timeline.
- Provider-specific figures (discounts, notice times, fees) should be data attached to a scene, not baked into captions, so they can be updated or marked illustrative.
