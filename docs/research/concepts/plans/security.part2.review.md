# Security plans, part 2: review summary

Reviewer pass over `plans/security.part2.md` (34 plans, groups 6 to 9).

## Verdict counts

- Keep: 0
- Improved: 31
- Rethought: 1 (`cors-same-origin-policy`)
- Merged: 2 (`mutual-tls` to networking's `mtls`; `bastion-host` to networking)

## Most important changes

- `cors-same-origin-policy` rethought: the old moment ("the API data sits there for anyone without a browser") taught that the policy is pointless. It now shows the reply arriving then hitting the read gate, curl unaffected, why the gate exists (the victim's cookies) and the reflect-origin-with-credentials leak.
- `certificate-lifecycle`: a CSR is signed by the requester's key, not the CA; revocation does not reach browsers "immediately" (two browsers now disagree, expiry is the backstop, which is why lifetimes shrink).
- `cross-site-request-forgery`: the drawn attack no longer works against Lax-by-default cookies; the plan now states the cookie setting, that SOP/CORS never stop sending, Lax's top-level GET gap and same-site subdomain attackers.
- `rate-limiting-abuse`: "credential stuffing" was actually brute force; split into brute force, distributed brute force (key on account) and true stuffing (needs signals, breached-password checks, MFA).
- `server-side-request-forgery`: added the DNS/redirect bypass and the connect-time IP check, plus IMDSv2.
- `digital-signatures`: removed the RSA-only "encrypt the hash / open the seal" picture and added the HMAC contrast beat.
- `pki-chain-of-trust`: TLS-vs-certificate misconception now shown (handshake ladder carrying the card); borrowed Networking's missing-intermediate browser-vs-curl beat.
- `post-quantum-cryptography`, `customer-managed-keys`, `encryption-in-transit`, `security-misconfiguration`: overclaims fixed (key exchange vs bulk cipher, "instant" disable, padlock with validation off, "most breaches").
- `sql-injection`, `network-segmentation`, `ddos-mitigation`, `zero-trust-architecture`, `password-hashing`, `key-rotation`: a named misconception that was never defeated on screen now has its own beat.

## Patterns for the platform

- Ladder diagrams (lifelines, slanted messages) for handshakes and brokers; chain-of-signature stacks with per-link glow.
- "Same attack, two worlds" replay (flat vs segmented, VPN vs ZTNA, escaped vs parameterized, with vs without edge): nearly every attack concept needs one scenario run twice with a toggle.
- A read gate / filter placed on a path, with a rule card that can be edited live (WAF, CSP, CORS, egress, SameSite).
- Key-version ladders with tagged items on a shelf, and destructive actions with a visible waiting period and undo.
- Meters and dials for rates, cost, latency and guess speed; a time axis with a calendar for lifetimes and rotation.
- Hash and encode transforms of a visible string (text in, transformed text out), repeated for several destinations.
- A scanner or attacker agent that can be re-run against any toggle state, so "before" and "after" are one interaction.
