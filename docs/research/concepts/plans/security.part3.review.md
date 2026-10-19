# Security part 3 review

Verdicts (29 plans): Improved 29, Keep 0, Rethought 0, Merged 0. `policy-as-code` is owned by Security; Delivery's plan was merged into it.

## Most important changes

- `policy-as-code`: merged Delivery's missed-line-in-a-400-line-diff opening, three-rule gate, deny/audit toggle and IAM contrast; added the decision-point vs enforcement-point split; fixed the drift beat (a deny at the edge would block it, so drift is a pre-existing resource); named real edge mechanisms (an SCP limits actions, not resource properties).
- `artifact-signing`: the keyless trap is a valid signature from the attacker's own identity; the gate must pin signer identity, not just check validity.
- `phishing-social-engineering`: email authentication was applied to SMS, voice and QR lures it cannot see; now shows its limits (email only, lookalike domains pass).
- `incident-response-lifecycle`: moved from Rev. 2 phases to NIST 800-61 Rev. 3 / CSF 2.0 (Govern, Identify, Protect ring; Detect, Respond, Recover loop).
- `threat-modeling-stride`: Repudiation was skipped; Elevation of privilege moved from the data store to the process.
- `cspm`: findings and attack chain contradicted each other (bucket vs VM); `sbom`: "3 affected, 1 exploitable" did not add up against the VEX beat.
- `ransomware`: restoring from immutable backups does not end double extortion; added the leak threat.
- `attack-lifecycle-kill-chain`: "MFA stops it" contradicted the AiTM plan; now phishing-resistant sign-in. Added the ATT&CK tactic/technique zoom.
- `dependency-confusion`, `vulnerable-dependencies`: wrong or muddled fixes (scoped namespace, lockfile) corrected.
- Unshown misconceptions now defeated by a beat: lateral movement (first box wiped, path already elsewhere), SBOM (spotless label on a tampered package), CI/CD (green scan during the attack), audit logging ("200 OK" app log).

## Patterns for the platform

- Replay-with-a-control: the same attack path replayed with one control switched on (kill chain, CI/CD, lateral movement, ransomware, immutable backups, phishing). Needs a recordable path trace, per-control toggles, and a ghost of the earlier run.
- Gate with a rule card: a gate that shows the rule it enforces (signing, provenance, DLP, policy-as-code); the rule must be editable and the verdict re-run.
- Same item in two places: a state change (CVE, label, token) lighting every copy at once (images, SBOM query, discovery sweep).
- Ladders and modes: levels (SLSA), modes (monitor/enforce, deny/audit, governance/compliance) as a toggle with different outcomes for the same event.
- Counters per entity (lockout counters, hop counter, SLA clocks) and a cross-entity view that reveals a pattern no single counter shows.
- Real-incident labels and dated facts as clickable annotations on nodes.
- A URL bar or address line as a first-class element when origin or name is the point (AiTM, subdomain takeover, dependency confusion).
