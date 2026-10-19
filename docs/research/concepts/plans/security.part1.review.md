# Security part 1: review summary

38 plans reviewed: 34 Improved, 3 Keep (`authentication-vs-authorization`, `attribute-based-access-control`, `identity-lifecycle`), 1 Merged (`blast-radius`, owned by Reliability), 0 Rethought.

## Most important changes

- `multi-factor-authentication`: number matching was "bypassed by prompt flooding", which is backwards; plain push now falls to fatigue, number matching to a live proxy.
- `saml-sso`: the browser can read the assertion (it just can't alter it); added SP checks and the IdP-initiated variant.
- `defense-in-depth`: tally said "4 of 5 breached" with only two holes in the story; numbers fixed and a same-control-twice opener added.
- `identity-federation`: removed the invented "signature-to-directory lookup"; revocation is the home IdP no longer issuing assertions.
- `identity-provider`: directory vs IdP split drawn; disabling an account stops new tokens, not live sessions.
- `oauth-refresh-tokens`: added the race where the thief refreshes first; the second party trips the alarm.
- `oauth-device-code`: split into user_code (typed) and device_code (secret, polled), which is what the phishing attack hinges on.
- `oauth-authorization-code-pkce`, `oauth-client-credentials`: why a stolen code is useless (one-way hash; attacker saw only the challenge); the certificate case now says what actually leaks.
- `managed-workload-identity`: 15-minute token lifetime matched no platform; SSRF caveat added.
- `passkeys-webauthn`: "never leaves the device" was wrong for synced passkeys.
- `sessions-vs-tokens`: removed the overstated 10,000 rps lookup bottleneck.
- `secret-sprawl`, `secret-rotation`: revoke kills all six copies at once; alternating-users pattern replaces the maintenance-window fallback.
- `blast-radius`: Merged into Reliability; their plan already borrows beat 6, notes added on what else to take.

## Patterns for the platform

- **Ladder diagrams** (OAuth, SAML, device code, PKCE) need step-through with a highlighted live arrow and a payload that rides on the arrow; "attacker intercepts at step N" needs to be a branch off the same ladder.
- **Tokens as tickets with editable fields and a seal** (JWT, OIDC, OAuth): fields must be editable live and the seal must react (crack) and be checked by a receiver with a toggleable "verify" switch.
- **Side-by-side identical attack, different defence** is the moment in over half the plans (stolen badge vs least privilege, JIT, shared secret vs certificate, old key file vs managed identity); the platform needs two parallel scenes driven by one attack trigger.
- **Policy evaluation as sets** (default deny, guardrails, RBAC inheritance): overlapping circles, a stack of statements with allow/deny tags, a draggable tag on a tree with live cascade.
- **Graphs with path search** (ReBAC, privilege escalation, RBAC hierarchy): edges editable, query highlights the found path.
- **Timers on tokens and sessions** recur (expiry, rotation, JIT, offboarding): a shared clock that many elements subscribe to.
- **Insets** (a small contrasting picture inside a scene, e.g. password manager vs SSO, fire door vs data gate, implicit flow greyed) appeared in a dozen plans; worth a first-class "inset/contrast" element.
