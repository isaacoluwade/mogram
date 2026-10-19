# Security plans, part 2

Stage 2 plans for `catalog/security.md` groups 6 to 9, in catalog order. They use the shared
security language: people and clients on the left, apps in the middle, protected resources on the
right inside a dashed trust boundary; an identity is a badge card; a token is a small ticket with
its fields visible and a wax seal for its signature; keys are key icons (a public key is an open
padlock anyone can snap shut, a private key the only key that opens it); locked data has a
padlock; ciphertext is scrambled text; secrets are sealed envelopes; an attacker is a red hooded
figure; allowed requests get a green tick, denied ones a red cross; protocol flows are ladder
diagrams (vertical lifelines per party, messages as slanted arrows travelling down in order, drawn
here with the **lanes** and **exchange** techniques). No new technique was needed beyond the
vocabulary in the README.

## 6. Cryptography

### Hashing vs encryption vs encoding (`hashing-vs-encryption-vs-encoding`)

**The aha**: Encoding is reversible by anyone, encryption is reversible only with the right key, hashing isn't reversible at all — pick based on whether you need the original back.
**Misconception to defeat**: That Base64 is "security," or that hashing is just a weak form of encryption.
**Cast**: Three machines in a row: "Encode" (a gear stamped Base64), "Encrypt" (a padlock with a key slot), "Hash" (a one-way funnel with shredder teeth). The same input card "hello" waits above each. A key icon sits only beside Encrypt.
**Opening frame**: Three idle machines, "hello" ready to feed each. _"Same word, three machines."_
**Story**:

1. "hello" through Encode becomes "aGVsbG8=". An attacker (red hood) reverses it instantly with no key. _"Encoding: a format swap, no secret."_
2. "hello" through Encrypt, key inserted, becomes scrambled ciphertext. The attacker grabs it and tries to reverse it without the key: red cross. _"Encryption: hidden, reversible only with the key."_
3. The legitimate key reinserted: ciphertext reverses to "hello", green tick. _"...and reversible for whoever holds it."_
4. "hello" through Hash becomes a fixed-length fingerprint. The owner tries running it backward: the funnel has no key slot and nothing to give back. _"Hashing: one-way. Nothing comes back."_
5. "world" hashes to a different fingerprint of the same length; "hello" hashed twice gives the identical one. Then a 1 GB video goes in and out comes a fingerprint just as short, so the original cannot be hiding inside it. _"Same input, same fingerprint. Tiny output, so the original is gone: good for comparing, not retrieving."_
   **The moment**: Beat 4, nothing coming back out of the hash funnel, right after beat 2 showed ciphertext coming back with the key.
   **Interaction**: Type any word into each machine and watch the three outputs; try reversing each.
   **Ending**: The three outputs side by side, labelled "reversible by anyone / reversible with the key / not reversible, only re-computable."
   **Variants**: `symmetric-vs-asymmetric-encryption`, `password-hashing`, `digital-signatures`.
   **Techniques**: contents, token, restyle, side by side, failure, caption.
   **Review**: Improved — beat 5 now feeds a 1 GB file through the funnel and gets the same short fingerprint, which shows why a hash cannot be run backward (the information is discarded) instead of just asserting it; ending label says "re-computable" so it leads into password-hashing's guessing. Weighed a translator / safe / blender metaphor: worse, the same-word-three-machines contrast is more direct. Checked: Base64("hello") is aGVsbG8=; Base64 has no key; hash output is fixed-length.

### Symmetric vs asymmetric encryption (`symmetric-vs-asymmetric-encryption`)

**The aha**: One shared key locks and unlocks fast; a key pair lets anyone lock but only one party unlock — real systems use asymmetric crypto to deliver a shared key, then symmetric crypto for the bulk data.
**Misconception to defeat**: That asymmetric is "the secure one" used for everything, or that a public key is a certificate.
**Cast**: Alice and Bob (badge cards) either side of a large file, `report.pdf`, and a tiny key card. One grey padlock (symmetric, one key fits both ways); one split padlock (Bob's public half, open, anyone can snap it shut; his private half, the only key that opens it). A stranger's unlabelled open padlock, and a signed ID card (certificate) that can be clipped to one.
**Opening frame**: Alice and Bob each hold an identical grey key, the file locked between them. _"Same key, both ways — fast, but how did they both get it?"_
**Story**:

1. Alice encrypts the file with the shared key; a speed meter reads "fast". _"Symmetric (AES): quick, for lots of data."_
2. An attacker intercepts the shared key itself mid-transit: game over, the file opens for them too. _"The hard problem: handing over the shared key safely."_
3. Cut to asymmetric: Bob publishes his open padlock (his public key) to everyone, because it is not secret, and keeps the only matching private key. Alice snaps it shut over a tiny card, "shared key = X7f2...". _"Anyone can lock it..."_
4. Only Bob's private key turns in the padlock. The attacker holds the very same open padlock and still cannot open the locked card: red cross. _"...only Bob can unlock it."_
5. A stranger hands Alice an open padlock claiming to be Bob's. Nothing on it says whose it is; a signed ID card clipped to it does. _"A public key is just a number. A certificate says whose."_
6. The unlocked card drops into the grey symmetric padlock from before, and the 1 GB file encrypts in a blink beside it, the key only 32 bytes. _"Asymmetric sets up the key, symmetric does the heavy lifting. (TLS 1.3 agrees the key with Diffie-Hellman instead of sending it: same hybrid idea.)"_
   **The moment**: Beat 6, the tiny unlocked card feeding the big fast padlock, showing why both exist together.
   **Interaction**: Toggle "symmetric only" and watch the key-delivery problem reappear; dial file size and watch symmetric stay fast while whole-file asymmetric would crawl (RSA can only encrypt under 200 bytes per operation anyway).
   **Ending**: The hybrid frame: a small asymmetric step feeding a fast symmetric one.
   **Variants**: `hashing-vs-encryption-vs-encoding`, `digital-signatures`, `pki-chain-of-trust`, `mutual-tls`, `key-management-service`.
   **Techniques**: token, restyle, exchange, meter, dial, failure, caption.
   **Review**: Improved — added a beat that defeats the named misconception (public key vs certificate) with a stranger's unlabelled padlock; reworded the TLS claim, since TLS 1.3 uses Diffie-Hellman key agreement rather than encrypting a key under RSA; added the RSA size limit to the dial. Weighed a mailbox-with-slot metaphor: the padlock already carries the 'anyone can lock' idea. Checked: AES-256 key is 32 bytes; asymmetric for key setup, symmetric for bulk.

### Digital signatures (`digital-signatures`)

**The aha**: Signing hashes the data and stamps that fingerprint with a seal only the private key can make; anyone with the public key can check the seal against the data, proving who signed and that nothing changed, while hiding nothing.
**Misconception to defeat**: That a signature encrypts the message; confusing it with HMAC, which uses a shared secret.
**Cast**: Alice (badge, private key), a readable document `contract.pdf`, a hash funnel, a wax seal, Bob (badge, Alice's public key on a keyring). Later, an HMAC tag made with a secret key card that Alice and Bob both hold.
**Opening frame**: `contract.pdf` sits in plain view with an empty wax-seal outline beside it. _"The contract stays readable."_
**Story**:

1. The document passes through the hash funnel, producing a short fingerprint. _"First, fingerprint the contract."_
2. Alice's private key presses a seal onto the fingerprint, attached to the document. Only that key can make this seal. _"Seal the fingerprint with the private key: the signature."_
3. Document and seal travel to Bob. An attacker reads every word along the way (nothing hidden) but cannot press a valid seal without the private key. _"Readable the whole way. Signing hides nothing."_
4. Bob hashes the document he received himself, then uses Alice's public key to test whether the seal fits that fingerprint. It fits: green tick. _"Public key checks the seal. It fits: from Alice, untouched."_
5. The attacker swaps one word mid-transit. Bob's fresh hash now differs and the old seal no longer fits: red cross. _"Change one word, the check breaks."_
6. Side by side: an HMAC tag made with a secret both Alice and Bob hold also catches the swapped word, but Bob could have made it himself, so he cannot prove to a judge that Alice did. _"Shared secret: integrity between two. Signature: anyone can verify, only Alice could sign."_
   **The moment**: Beat 5, the two fingerprints diverging after a single word changes; beat 6 then shows what a shared secret cannot do.
   **Interaction**: Edit the document text and watch Bob's hash change and the check fail; swap in a stranger's private key and watch the seal fail to fit Alice's public key.
   **Ending**: Two matching fingerprints, green tick held.
   **Variants**: `symmetric-vs-asymmetric-encryption`, `pki-chain-of-trust`, `json-web-token`, `artifact-signing`.
   **Techniques**: token, restyle, exchange, spotlight, side by side, failure, caption.
   **Review**: Improved — dropped the "lock the hash with the private key, open the seal to reveal the fingerprint" picture, which is only RSA folklore (ECDSA, EdDSA and ML-DSA verify a signature against a hash, they don't decrypt one); added the HMAC beat so the named misconception is actually defeated on screen. Weighed a handwritten-signature metaphor: loses the tamper-evidence beat. Checked: sign with private, verify with public; signatures give non-repudiation, HMAC does not.

### Password hashing, salting and key stretching (`password-hashing`)

**The aha**: Passwords are stored as slow, salted hashes so a stolen database can't be turned back into passwords quickly, and identical passwords don't look identical.
**Misconception to defeat**: That passwords are encrypted (reversible), or hashed with a fast general-purpose hash like SHA-256.
**Cast**: A sign-up form on the left; a database table on the right with columns `user | salt | hash`; a "slow" gear (Argon2id, also bcrypt and scrypt) next to a "fast" gear (SHA-256) for contrast; an attacker with a rainbow-table binder and a GPU-farm icon.
**Opening frame**: Empty table, form waiting. _"What should the database hold?"_
**Story**:

1. The naive way first: alice and bob both choose the same password and the fast gear (SHA-256) hashes each straight into the table, giving identical hashes. The rainbow-table binder matches both at once, and one cracked hash opens two accounts. _"No salt, fast hash: same password, same hash, ready-made lookup."_
2. Rewind. Alice's password gets a unique random salt stuck to it like a label, then runs through the slow gear (grinding, timer reads "~300ms"); only `salt, hash` are stored and the password evaporates. _"A random salt per user. Store only the hash."_
3. Bob picks the identical password; a different salt, different grinding, and a completely different stored hash. _"Same password, unrecognizable hashes."_
4. The attacker steals the table. The binder finds no match, because precomputed tables don't contain alice's salt. But the salt sits right there in the table: it is not secret. _"Salts kill precomputed tables and make every guess count once per user."_
5. Brute force with the GPU farm against the slow, memory-hard gear: the meter crawls at thousands of guesses a second, against billions for a fast hash. "summer2024" still falls in seconds; a long random password does not. _"Slow buys time, not immunity: weak passwords still fall."_
   **The moment**: Beat 1 against beat 3, identical passwords producing identical stored hashes without a salt and visibly different ones with it.
   **Interaction**: Type the same password for two users and watch the salts and hashes diverge; swap the slow gear for a fast one and watch the attacker's meter jump; try a weak password and a long random one against the same slow gear.
   **Ending**: The table showing only `salt, hash`, attacker's meter crawling.
   **Variants**: `hashing-vs-encryption-vs-encoding`, `secret-sprawl`, `multi-factor-authentication`.
   **Techniques**: token, restyle, meter, side by side, failure, caption.
   **Review**: Improved — now opens with the unsalted fast-hash failure so the moment is a before/after (two identical hashes, then two different ones) instead of a bare claim; stated that salts are not secret and that a weak password still falls to a slow hash, both of which the old plan left implied. Weighed leading with the brute-force meter: the salt contrast is the more surprising picture, the meter works as the second half. Checked: Argon2id/bcrypt/scrypt are the slow KDFs; salt is stored beside the hash; fast SHA-256 runs at billions per second on GPUs.

### PKI and the certificate chain of trust (`pki-chain-of-trust`)

**The aha**: A certificate is a signed ID card binding a name to a public key, and trust is a chain of signatures from the leaf up to a root your device already holds. TLS is the conversation; the certificate is the ID it carries.
**Misconception to defeat**: That TLS the protocol and certificates the ID documents are the same thing; that a self-signed certificate is just as good.
**Cast**: A TLS handshake ladder with a browser on the left and a server on the right. A vertical chain of three badge cards: "Root CA" (inside the device's trust store, a small locked vault), "Intermediate CA", and the leaf, "www.example.com" (public key, dates), each with a "signed by ↑" arrow to the one above.
**Opening frame**: The trust store holds a handful of Root CA cards. _"Your device already trusts a short list of roots."_
**Story**:

1. A browser opens a TLS handshake; the server's reply carries a certificate card (name, public key, dates, issuer). The ladder and the card are drawn as different things. _"TLS is the conversation. The certificate is the ID card it carries."_
2. The browser checks the leaf's signature with the Intermediate's public key, then the Intermediate's with the Root's; each link glows green. It also checks the name and dates against the site it asked for. _"Trust climbs the chain, one signature at a time."_
3. The top link matches a card already in the trust store, and the whole chain lights green. The server only sent the leaf and intermediate; the root came from the device. _"...until it reaches a root you already hold."_
4. A self-signed card appears, its arrow pointing only to itself; no path to the trust store, and a warning appears. _"No chain to a trusted root."_
5. The server stops sending its Intermediate. The browser fetches it from the leaf's issuer link and the chain still completes; curl has no such fallback and the chain breaks mid-stack. _"A missing intermediate: browsers cover for it, other clients don't."_
6. A CA is caught issuing certificates it should not have (as DigiNotar was in 2011) and its root is removed from the trust store; everything it signed, down through every intermediate, dims red. _"Distrust a CA and everything beneath it goes with it."_
   **The moment**: Beat 3, the chain lighting link by link until it touches a card already in the trust store, against beat 4's dead end.
   **Interaction**: Swap in a self-signed cert and watch the chain fail to connect; make the server stop sending its intermediate and switch the client between browser and curl; remove a root from the trust store and watch every chain beneath it turn red.
   **Ending**: A full green chain from leaf to a trusted root.
   **Variants**: `certificate-lifecycle`, `mutual-tls`, `tls-handshake` (networking), `certificate-chain-of-trust` (networking, merged here).
   **Techniques**: exchange, path trace, layers, restyle, failure, side by side, spotlight, caption.
   **Review**: Improved — the named TLS-vs-certificate misconception was never defeated on screen, so beat 1 now draws the handshake ladder carrying the certificate as a separate card; replaced the 'compromised root' beat (roots live offline, real incidents are misissuing CAs) with the DigiNotar-style distrust; borrowed Networking's missing-intermediate browser-vs-curl beat and name/date check. Weighed a passport-and-border-guard metaphor: it loses the 'root you already hold' point. Checked: leaf verified with intermediate's public key, root never sent, self-signed has no path.

### Certificate lifecycle and revocation (`certificate-lifecycle`)

**The aha**: Certificates expire on purpose, and public lifetimes are shrinking (200 days from March 2026, 100 from March 2027, 47 from March 2029), so only automation keeps up. Revocation is a patchy backstop for a leaked key, which is why short lifetimes matter.
**Misconception to defeat**: That issuing a certificate is a one-time task; that revocation and expiry are the same thing, or that revoking kills a certificate everywhere at once.
**Cast**: A timeline strip: Issue → Deploy → (long middle) → Renew → Expire, with "Revoked?" branching off mid-timeline; a calendar counting down; a server using the cert; an ACME robot icon for automation; two browsers, one with fresh revocation data and one without.
**Opening frame**: A fresh certificate at day 0 of a 200-day bar (today's maximum), a server using it, padlock green. _"A certificate, and its clock."_
**Story**:

1. The server generates a key pair and sends a CSR (signed with the new private key) to the CA; the CA checks the requester controls the domain and signs the certificate; the server deploys it. _"Issue, then deploy."_
2. The bar drains day by day; about two-thirds of the way through, the ACME robot renews in the background and swaps in a fresh cert with no flicker. _"Renew before the clock runs out, automated."_
3. A nearby manually-run server has no robot; its bar hits zero, the padlock turns red, visitors see a warning. _"Miss the date, outage."_
4. The lifetime ladder shrinks across the calendar: 200 days (Mar 2026), 100 (Mar 2027), 47 (Mar 2029). The manual calendar reminder that was fine yearly now needs to fire at least eight times a year, per certificate. _"Public certificate lifetimes keep shrinking."_
5. A private key leaks mid-lifetime. The CA revokes the certificate and its serial lands on a revocation list. Browser A has fetched the list and rejects the cert; browser B has not, and keeps trusting it with the bar still half full. _"Revocation reaches clients unevenly. Expiry is the guarantee, so short lifetimes cap the damage."_
   **The moment**: Beat 2 against beat 3, the automated server sailing through renewal while the manual one goes dark.
   **Interaction**: Drag the lifetime slider from 200 to 47 days and watch the robot fire more often; trigger a leak and watch the two browsers disagree until expiry.
   **Ending**: The automated server's bar quietly resetting to full, forever.
   **Variants**: `pki-chain-of-trust`, `secret-rotation`, `key-rotation`.
   **Techniques**: timer, token, restyle, failure, side by side, dial, caption.
   **Review**: Improved — fixed two errors: a CSR is signed by the requester's new private key, not by the CA, and revocation does not make browsers reject a cert 'immediately' (CRLs and OCSP are fetched or cached unevenly, and public CAs are moving away from OCSP), so beat 5 now shows two browsers disagreeing, which also explains why lifetimes shrink; added the CA/B Forum dates (200 days from 15 Mar 2026, 100 from 2027, 47 from 2029) and a 200-day opening bar to match today. Weighed a passport-expiry metaphor: it hides the automation point. Checked: lifetimes and dates, ACME renews around two-thirds of the way through.

### Mutual TLS (mTLS) (`mutual-tls`)

**The aha**: In mTLS both sides present and verify a certificate, so the server proves who the client is cryptographically, not just the other way round.
**Misconception to defeat**: That ordinary TLS already authenticates the client; confusing mTLS with API keys.
**Cast**: A ladder diagram, two lifelines, Client and Server, both holding badge cards with private keys. One-way TLS shown first as contrast: only the Server's badge travels down.
**Opening frame**: The one-way TLS ladder: Server's cert arrow descends, Client's lifeline is empty-handed. _"Normal TLS: only the server proves itself."_
**Story**:

1. Client verifies Server's cert chain (green tick) and starts sending data, but the server has no idea who the client is. _"The server trusts no one back."_
2. Switch to the mTLS ladder: Server sends its cert down, as before. _"Same first step..."_
3. Server sends a request back up, "and yours?"; an arrow climbs from Client holding its own certificate and a private-key-signed proof. _"...now the client sends a certificate too."_
4. Server verifies Client's chain just as Client verified Server's; green ticks appear on both lifelines. _"Both sides verified, both sides proven."_
5. An impostor lifeline with no valid client certificate has its upward arrow rejected mid-ladder; the connection drops before any data flows. _"No valid client cert, no connection — this is how service meshes authenticate workloads."_
   **The moment**: Beat 3, the arrow direction reversing as the server demands proof back, which one-way TLS never does.
   **Interaction**: Toggle one-way vs mutual and watch whether the upward arrow exists; swap in an invalid client cert and watch the handshake abort.
   **Ending**: Both lifelines with green ticks, a locked channel between them.
   **Variants**: `pki-chain-of-trust`, `symmetric-vs-asymmetric-encryption`, `api-authentication-methods`, `managed-workload-identity`.
   **Techniques**: exchange, lanes, path trace, toggle, failure, caption.
   **Review**: Merged — owned by networking (`mtls`). The kept plan should borrow from this one: the one-way vs mutual ladder as the opening contrast, and the impostor lifeline being rejected before any data flows. Worth correcting there: in TLS 1.3 the client can finish its side of the handshake before the server's rejection arrives, so the failure often shows up as an alert on the client's first read rather than as a clean handshake error; and the proof of identity is a signature made with the client's private key (CertificateVerify), so a stolen certificate file alone is useless. Networking's bearer-token contrast and 'identity sits on the connection' framing are the better ones; keep those. Add the service-mesh angle (short-lived SPIFFE-style workload certificates, automatically rotated).

### Post-quantum cryptography (`post-quantum-cryptography`)

**The aha**: The danger is "harvest now, decrypt later" — today's encrypted traffic can be recorded and broken once quantum computers arrive, so key exchange is migrating first to quantum-resistant algorithms.
**Misconception to defeat**: That quantum computers already break things today, or that symmetric crypto is equally at risk.
**Cast**: A timeline from "today" to a future "quantum era" icon; an attacker recording traffic into a growing vault; two padlocks in transit, one classical (RSA/ECC key exchange), one hybrid with ML-KEM; each recording is a bulk-data box locked with an AES key, which is itself wrapped by the key-exchange padlock.
**Opening frame**: Today's traffic flows, protected by a classical elliptic-curve key exchange, while the attacker quietly records a copy into the vault. _"Encrypted and safe, for now."_
**Story**:

1. Years pass on the fast-forwarding timeline; the vault of recorded ciphertext grows untouched. _"The attacker doesn't need to break it today."_
2. The quantum computer icon lights up at the far end; a beam reaches back into the vault, the RSA and elliptic-curve padlocks pop one by one, the AES keys they wrapped fall out, and the bulk data opens. _"A future quantum computer breaks RSA and elliptic curves: the key exchange, retroactively."_
3. An AES-256 lock hit by the same beam only loses some strength (quantum search halves the effective key length), so it holds. _"Symmetric crypto and hashes: mostly just use bigger keys."_
4. Back in today's timeline, a hybrid padlock appears on the wire, locked twice, once classical and once with ML-KEM (FIPS 203). _"Hybrid key exchange: classical plus post-quantum, already shipping in TLS."_
5. The beam reaches this hybrid-locked recording in the vault: the classical lock pops, the ML-KEM lock holds, the box stays shut. _"Harvested today, still unreadable tomorrow."_
6. Signatures are different: nobody can record-and-forge later; a forged certificate only matters once the quantum computer exists. So certificates move second, to ML-DSA (FIPS 204) or SLH-DSA (FIPS 205), on NIST's schedule to retire RSA and elliptic curves by 2035. _"Key exchange first. Signatures follow."_
   **The moment**: Beat 2 against beat 5, the same future beam popping the old key-exchange padlocks open but failing against the hybrid-locked one.
   **Interaction**: Scrub the timeline forward to the quantum era and watch which locked boxes in the vault pop open, old-style versus hybrid.
   **Ending**: The vault, old boxes open, hybrid ones still shut.
   **Variants**: `symmetric-vs-asymmetric-encryption`, `digital-signatures`, `pki-chain-of-trust`, `encryption-in-transit`.
   **Techniques**: timer, token, restyle, failure, side by side, spotlight, caption.
   **Review**: Improved — beat 2 now shows that the beam breaks the key exchange and the AES key falls out (the old plan implied the bulk cipher itself broke), opening frame says elliptic-curve exchange rather than RSA (modern TLS is ECDH), and a closing beat covers why signatures migrate later (FIPS 204/205, no harvest-later attack on authentication). Weighed a 'padlock replaced by a better padlock' framing without a timeline: harvest-now-decrypt-later needs the vault. Checked: FIPS 203 ML-KEM, 204 ML-DSA, 205 SLH-DSA (Aug 2024); Grover only halves symmetric strength; hybrid X25519+ML-KEM is deployed in TLS.

## 7. Keys and data encryption

### Key management service (KMS) and HSMs (`key-management-service`)

**The aha**: You never hold the key yourself — you ask the KMS to encrypt, decrypt or sign, and every ask is logged; access to the key is access to the data.
**Misconception to defeat**: That a KMS is just a secrets vault for storing key files; confusing it with a TPM.
**Cast**: A locked vault box labelled "KMS / HSM" with a key icon welded inside, never leaving. An app on the left sends requests through a small slot; a log scroll beside the vault records every call; a key-policy document is pinned to the vault. Beside it, a plain "secrets vault" that hands the stored secret out.
**Opening frame**: The vault with its key inside, the app beside it, an empty log. _"The key lives here. It never comes out."_
**Story**:

1. The app sends a small payload through the "encrypt" slot and ciphertext returns; the key icon never moves. Sent back through "decrypt", plaintext returns, and the log adds a line each time. Beside it the secrets vault hands the secret itself out to its caller. _"A KMS returns results, not keys. Every operation is logged."_
2. A different app with no grant tries the same decrypt slot: red cross, denied before it touches the key. _"The key policy decides who may ask."_
3. Two badges appear beside the vault: "Key admin" (changes policy, can't read data) and "Data user" (decrypts via policy, can't touch policy), deliberately different people. _"Separate who manages the key from who uses it."_
4. Zoom into the vault: tamper-resistant hardware (a validated HSM) holding the key; a pry attempt wipes the key rather than yielding it. A dedicated single-tenant HSM sits beside the shared service for strict compliance. _"Keys live in hardware built to destroy them if opened."_
5. An attacker with stolen app credentials calls decrypt and succeeds, because the policy allowed that app, but the log scroll now has an audit trail pointing straight at it. _"Stolen credentials still get logged, loudly."_
   **The moment**: Beat 1, the key icon staying welded in place while data flows in and ciphertext flows out — ask, don't hold.
   **Interaction**: Click encrypt/decrypt as different badge identities and watch which succeed per policy; scrub the log after an attack to find the anomalous caller.
   **Ending**: The vault untouched, the log full, the key still welded inside; the slot is tiny, which is why big data needs envelope encryption.
   **Variants**: `envelope-encryption`, `secrets-vault`, `customer-managed-keys`, `confidential-computing`.
   **Techniques**: contents, token, zoom, failure, restyle, spotlight, caption.
   **Review**: Improved — folded the redundant encrypt and decrypt beats into one, put a secrets vault beside the KMS so the 'KMS is just a vault' misconception is defeated by contrast, and used the freed beat to zoom into the HSM (tamper-resistant hardware, shared service vs dedicated HSM), which the title promised but the plan skipped; ending now sets up envelope encryption (KMS payloads are small, e.g. 4 KB in AWS KMS). Weighed a bank-teller metaphor: fine, but the welded key already says it. Checked: keys never leave in plaintext, policy decides, every call is logged, key admin and data user separated.

### Envelope encryption (`envelope-encryption`)

**The aha**: Data is encrypted locally with a small data key (DEK); only that tiny key, never the data, goes to the KMS to be wrapped by a key-encryption key (KEK), so encrypting terabytes stays fast.
**Misconception to defeat**: That this is "double encryption" for extra safety, or that keys sit in plaintext beside the data.
**Cast**: A huge file, `video.mp4`, on the left; a small key icon (the DEK) generated beside it; the KMS vault with its KEK welded inside, on the right; a "wrapped DEK" shown as the small key inside a second, smaller padlock.
**Opening frame**: The big file, no key yet, and a KMS slot that takes only a few kilobytes. _"A terabyte can't go through the KMS. So what does?"_
**Story**:

1. A fresh small DEK is generated locally, right beside the file, with no network call yet. _"Generate a tiny key, locally."_
2. The DEK encrypts the big file directly in one fast pass. _"Use it to encrypt the data. This part never touches the KMS."_
3. Only the tiny DEK travels to the KMS, is wrapped by the KEK inside, and the wrapped bundle returns to sit beside the encrypted file; the plaintext DEK is wiped from memory. _"The data is encrypted once; the key is encrypted once. Not double encryption."_
4. Later, to decrypt: the wrapped DEK goes back, unwraps using the KEK, the bare DEK returns and decrypts the big file locally. _"Unwrap the small key, then decrypt locally: fast both ways."_
5. Moving to a new KEK version: each small wrapped DEK is re-wrapped and the old KEK version can retire; the huge file is never touched. _"Move to a new KEK: re-wrap small keys, not terabytes."_
   **The moment**: Beats 3 and 5, the tiny key crossing the network while the massive file never leaves its machine, and later staying untouched when moving to a new KEK.
   **Interaction**: Dial the file size up and watch the KMS round-trip stay flat while local encryption time grows; move to a new KEK version and watch only the wrapped bundles change.
   **Ending**: The file encrypted once, a tiny wrapped DEK beside it, the KEK safe inside the vault; every object has its own DEK, so one leaked data key exposes one object.
   **Variants**: `key-management-service`, `key-rotation`, `encryption-at-rest`.
   **Techniques**: contents, token, meter, dial, zoom, caption.
   **Review**: Improved — beat 3 now says the data is encrypted once and the key once and shows the plaintext DEK wiped, defeating both 'double encryption' and 'key sitting beside the data' on screen; opening frame explains why the file cannot simply go through the KMS (small payload limit); beat 5 reworded because automatic KEK rotation keeps old versions and does not itself re-wrap DEKs. Weighed a safe-with-the-spare-key metaphor: it hides the performance reason. Checked: DEK encrypts data, KEK only wraps DEKs, only the DEK reaches the KMS.

### Key rotation (`key-rotation`)

**The aha**: Rotating a key creates a new version for new encryption while old versions stay around to decrypt what they already protected — it limits exposure, it doesn't retroactively re-encrypt anything.
**Misconception to defeat**: That rotation automatically re-encrypts old data, or that it's the same as secret rotation.
**Cast**: A key-version ladder, v1, v2, v3 stacked, each a key icon with a date; a shelf of encrypted files tagged by the version that locked them; a "destroy v1" button.
**Opening frame**: Only v1 exists, every file on the shelf tagged "v1". _"One key version, protecting everything so far."_
**Story**:

1. v2 is created above v1; new files from now on are tagged "v2", existing files keep "v1" unchanged. _"A new version for new writes. Old data stays as it was."_
2. A file tagged "v1" is requested: v1 is still on the ladder, so it decrypts fine. Unlike a password rotation, the old version keeps working, for decrypting only. _"Old versions are kept so old data still opens."_
3. v1 leaks. Files tagged v2 stay safe; every v1 file is exposed. _"Rotation limits what one key covers. It doesn't rescue what v1 already locked."_
4. Someone clicks "destroy v1", believing rotation already moved everything off it. v1 vanishes and every "v1"-tagged file flashes red, unreadable. _"Destroy a version too early, and its data is gone."_
5. Rewind: a background job re-wraps (or re-encrypts) each v1-tagged file under v2 first, tags updating one by one; once the shelf shows all "v2", v1 is retired with nothing lost. Most KMSs add a waiting period before deletion, a last chance to notice. _"To retire a version safely: re-encrypt everything first, then destroy it."_
   **The moment**: Beat 4's irreversible red flash, immediately followed by the rewind in beat 5 showing the correct order.
   **Interaction**: Click "rotate," then try "destroy old version" at different points and see which files survive; watch a progress bar for the re-wrap job.
   **Ending**: The ladder with only v2 standing, every file tagged v2, nothing lost.
   **Variants**: `envelope-encryption`, `secret-rotation`, `customer-managed-keys`.
   **Techniques**: lanes, token, restyle, failure, timer, caption.
   **Review**: Improved — added the beat the aha implied but never showed (v1 leaks: rotation protects new data, not old, so old data must be re-encrypted); made the 'not the same as secret rotation' contrast visible in beat 2; noted the deletion waiting period. Weighed a bank-card-reissue metaphor: it suggests the old card dies, which is the opposite of the lesson. Checked: rotation does not re-encrypt existing data, old versions must remain to decrypt, and destroying one early makes its data unreadable.

### Customer-managed keys, BYOK and HYOK (`customer-managed-keys`)

**The aha**: Moving from provider-managed to customer-managed to bring/hold-your-own-key trades more control for more responsibility, and disabling your key makes the data it protects unreadable everywhere, while deleting it makes that permanent.
**Misconception to defeat**: That this is the same switch as "encryption at rest on/off," or the same as client-side encryption.
**Cast**: A horizontal spectrum with four stops, Provider-managed → Customer-managed (cloud KMS) → Bring-your-own-key → Hold-your-own-key; a responsibility meter rising left to right; a data store padlocked, keyed to whichever stop is selected.
**Opening frame**: The spectrum at "Provider-managed," responsibility low, the key icon tucked fully inside the provider's cloud, invisible to the customer, the data store padlocked. _"Encrypted at every stop. What changes is who controls the key."_
**Story**:

1. Slide to "Customer-managed": the key icon moves into a KMS box labelled with the customer's badge; they can now see policy, rotation schedule, audit log. _"Now you hold the key's policy and lifecycle."_
2. Slide to "BYOK": the customer's own key material, generated outside in an on-prem HSM, is imported into the cloud KMS box. _"Your key material, imported into the cloud's KMS."_
3. Slide to "HYOK": the key never enters the cloud at all; every encrypt/decrypt call crosses out to an external key store, and a latency meter appears. _"The key never leaves your infrastructure, at a cost in speed and complexity."_
4. Back at "Customer-managed," click "disable key": every file, snapshot and backup under it turns unreadable, red, within minutes (services may cache unwrapped keys briefly). Re-enable and they all open again. Then "schedule deletion": after the waiting period the key is gone and so is the data. _"Disable is a pause. Deleting the key is crypto-shredding: on purpose, or by accident."_
   **The moment**: Beat 4, one click making data everywhere unreadable at once, then a second step making it permanent: power and danger in the same gesture.
   **Interaction**: Slide along the spectrum and watch responsibility and key location change; click disable/enable and watch the data react.
   **Ending**: The spectrum resting at a chosen stop, the trade-off meter visible.
   **Variants**: `key-management-service`, `encryption-at-rest`, `confidential-computing`.
   **Techniques**: dial, move, meter, restyle, failure, caption.
   **Review**: Improved — beat 4 claimed disabling is 'instant' and permanent; services can cache unwrapped keys for a short while, and disable is reversible while deletion (after a waiting period) is what shreds, so both steps are now shown; opening frame states that data is encrypted at every stop, which defeats the named 'same as at-rest on/off' misconception. Weighed a house-keys metaphor (landlord / you / you-with-the-only-copy): fits the spectrum but loses crypto-shredding. Checked: BYOK imports key material into the cloud KMS, HYOK keeps it in an external store, provider-managed is the default.

### Encryption at rest (`encryption-at-rest`)

**The aha**: Platform encryption at rest protects against stolen disks and backups, not against anyone who reads through the app with valid access — the higher the layer you encrypt at, the fewer eyes ever see plaintext.
**Misconception to defeat**: That "encryption at rest: on" means the data is safe from everyone, including app users and DBAs.
**Cast**: Three stacked layers, Disk → Database (TDE) → Application/field; a stolen-disk icon, a DBA badge and an app-user badge each try to peek through; a padlock sits at whichever layer is "on."
**Opening frame**: The padlock only at the Disk layer (on by default in the major clouds); the DBA and app-user both see plaintext rows above it. _"Disk encryption: the disk is locked, nothing above it is."_
**Story**:

1. A thief steals the physical disk and tries to read it: scrambled, red cross. _"Stolen disk: unreadable."_
2. The DBA opens the database normally with a valid connection: plaintext rows appear instantly. _"Anyone with DB access still reads plaintext."_
3. The padlock moves up to the Database (TDE) layer; disk theft still fails, and a stolen backup file is now scrambled too, but the DBA's live query still returns plaintext, because TDE decrypts transparently for valid connections. _"TDE protects backups and snapshots, not logged-in users."_
4. The padlock moves to the Application/field layer; a specific column is encrypted by the app before it's ever written. The same DBA query returns scrambled text for that column; only the app, holding the field key, sees the real value. The price: the database can no longer search or sort that column freely. _"Field-level: even the DBA sees ciphertext, at a cost in querying."_
   **The moment**: Beat 2 against beat 4, the same DBA badge and query returning plaintext at the bottom layer and scrambled text at the top.
   **Interaction**: Toggle the padlock between the three layers and watch what the thief, the DBA and the app-user can each read.
   **Ending**: The padlock at the application layer, the DBA staring at scrambled text.
   **Variants**: `envelope-encryption`, `customer-managed-keys`, `encryption-in-transit`, `confidential-computing`.
   **Techniques**: layers, toggle, spotlight, restyle, failure, caption.
   **Review**: Improved — small but real: noted that platform at-rest encryption is on by default (so 'it is on' tells you little) and that field-level encryption costs search and sorting. Weighed a safe / vault-room / locked-envelope nesting metaphor: the layer stack with the same DBA query at each level is sharper. Checked: disk/volume encryption stops stolen disks, TDE stops stolen backups, neither stops authorised queries, application-level hides data from the DBA; the moment (same query, plaintext vs ciphertext) holds.

### Encryption in transit (`encryption-in-transit`)

**The aha**: TLS protects data on the wire, but only on encrypted hops — wherever it terminates, the data is plaintext again unless deliberately re-encrypted onward.
**Misconception to defeat**: That "HTTPS" means the data is encrypted end to end, all the way to the database.
**Cast**: A request's journey, Client → Load Balancer → App Server → Database; each hop is a pipe, either padlocked or bare; an attacker sits on one hop at a time trying to read traffic.
**Opening frame**: Client-to-LB padlocked, everything past it bare. _"HTTPS to the edge. What about after?"_
**Story**:

1. The client sends a request through the padlocked pipe to the LB; an attacker sitting on that hop tries to read it: scrambled, red cross. _"On-path attackers can't read an encrypted hop."_
2. At the LB, TLS terminates; the pipe onward to the App Server is bare. The attacker moves to that hop instead and reads the request in plain text. _"TLS terminates at the LB: plaintext again behind it."_
3. The App-Server-to-Database hop is bare too; the attacker reads database traffic there as well. _"Every unencrypted internal hop is a free read."_
4. Each hop gets its own padlock: the LB re-encrypts to the app server (or passes the TLS straight through), and the app uses TLS to the database. The attacker tries every hop now and finds scrambled text everywhere. _"Re-encrypt every hop, including internal ones."_
5. A client with certificate validation switched off connects to a look-alike server instead of the real LB. The pipe is still encrypted, but to the attacker, who reads everything and forwards it on. _"Encrypted, but to whom? Skip certificate checks and anyone can answer."_
   **The moment**: Beat 2, the attacker moving one hop deeper and the pipe going from unreadable to perfectly readable, just by repositioning.
   **Interaction**: Click a hop to add or remove its padlock and watch where the attacker succeeds; toggle "skip cert validation" on the client.
   **Ending**: Every hop padlocked, the attacker shut out everywhere.
   **Variants**: `encryption-at-rest`, `mutual-tls`, `pki-chain-of-trust`, networking's TLS handshake.
   **Techniques**: path trace, restyle, failure, toggle, spotlight, caption.
   **Review**: Improved — beat 5 said the browser padlock 'still shows' with validation off, which is wrong (a browser warns; this is an app or curl -k situation) and it blurred the real point, so it now shows a connection that is encrypted to the wrong party; beat 4 mentions TLS pass-through as the alternative to re-encryption. Weighed an envelope-in-a-courier-van framing: the hop-by-hop pipe with a mobile attacker is the sharper image. Checked: TLS terminates at the LB/proxy, internal hops need their own TLS, hostname and chain validation is what makes TLS authenticate.

### Confidential computing (`confidential-computing`)

**The aha**: Confidential computing protects data even while it's in use — memory stays encrypted and isolated so not even the cloud operator or hypervisor can read it, and attestation proves what code is running before secrets are released.
**Misconception to defeat**: That encryption at rest plus in transit already covers everything; confusing it with ordinary HSMs.
**Cast**: A standard VM with its memory shown as a visible plaintext strip, peekable by a "cloud operator" badge and a hypervisor icon; beside it, a confidential VM whose memory strip looks scrambled from outside, shielded by a hardware (CPU) icon. A small HSM box for later contrast.
**Opening frame**: Both VMs run the same workload side by side, one memory strip readable to the host, one not. _"Same workload. Different states of 'in use.'"_
**Story**:

1. Disk encryption and TLS are both drawn ending at the VM: to compute on data it must be decrypted into memory. In the standard VM the cloud operator peeks at memory mid-computation: plaintext secrets visible. _"At rest and in transit are covered. In use, data is just there, in memory."_
2. In the confidential VM, the same peek hits scrambled memory: red cross, even for the operator and hypervisor. The CPU encrypts memory with a key the host never sees. _"Memory is encrypted and isolated by hardware: even the host can't see in."_
3. Before any secret is handed over, the confidential VM must produce a hardware-signed attestation of exactly what code is running; a key broker releases the secret only on a match. _"Prove what's running first. Then release the secret."_
4. The attested code is swapped for tampered code; the attestation no longer matches, and the secret delivery is blocked before it reaches memory. _"Wrong code, no secret."_
5. Zoom out to the three states of data, at rest, in transit, in use, the last one classical encryption never covered. The HSM guards keys, not a running program's memory; and the CPU maker is still trusted. _"The third state."_
   **The moment**: Beat 2, the same peek that worked a moment ago on the standard VM failing completely on the confidential one.
   **Interaction**: Tamper with the attested code and watch secret delivery get blocked; toggle standard vs confidential VM and try to peek at memory in each.
   **Ending**: The three-state diagram, all three padlocked, with the HSM shown guarding keys only.
   **Variants**: `encryption-at-rest`, `encryption-in-transit`, `key-management-service`, `customer-managed-keys`.
   **Techniques**: side by side, spotlight, failure, exchange, zoom, caption.
   **Review**: Improved — beat 1 now explains why in-use is a separate state (data must be decrypted into memory to be computed on), and the closing beat finally defeats the named 'same as an HSM' confusion and states the honest limit (you still trust the CPU vendor); attestation is described as hardware-signed and checked by a key broker. Weighed a sealed-room-with-a-glass-wall metaphor: the side-by-side same-peek contrast is clearer. Checked: confidential VMs / enclaves encrypt memory in hardware, attestation precedes secret release, operator and hypervisor are excluded.

## 8. Network security and zero trust

### Zero trust architecture (`zero-trust-architecture`)

**The aha**: Network location stops being a credential — every request to every resource is authenticated, authorized and encrypted individually, by a policy engine, regardless of whether it came from "inside."
**Misconception to defeat**: That ZTNA products or "no VPN" equal zero trust; that it's castle-and-moat with a better moat.
**Cast**: Old model, a castle wall around everything, all trusted once past one gate. New model, no wall; every resource has its own small gate (a policy enforcement point), all wired to a central Policy Engine watching identity, device health, location and behaviour.
**Opening frame**: Castle-and-moat, one gate, everything inside green. _"Old model: get past the wall, you're trusted."_
**Story**:

1. An attacker breaches the single gate with a phished credential and walks freely to every resource inside, all green. _"Inside the wall is one big trust zone."_
2. Switch to zero trust: no wall at all, each resource with its own small gate (a policy enforcement point) wired to the central Policy Engine. _"No perimeter. Every resource checks for itself."_
3. A legitimate user requests the database; identity, device-health and context signals flow to the Policy Engine, which allows that one gate only, over an encrypted connection. _"Authenticated, authorized and encrypted per request, per resource, not once at a wall."_
4. The same attacker, holding a stolen credential, requests the database: an "unmanaged device" signal gets it denied; a different resource, independently checked, is also denied. _"Assume breach: a stolen credential alone isn't enough."_
5. The legitimate user's session later shows an anomalous-location signal; the Policy Engine revokes access dynamically, closing the gate on an already-open session. _"Trust isn't a one-time grant. It's re-evaluated continuously."_
6. Contrast: a company that "removed the VPN" and put one broker in front of one app, while the servers behind it still trust each other freely; the attacker is back to walking everywhere. _"Dropping the VPN isn't zero trust. Dropping implicit trust is."_
   **The moment**: Beat 1 against beat 4, the same breached-wall scenario replayed with per-resource gates, the attacker stopped at every one.
   **Interaction**: Toggle perimeter vs zero-trust and run the same attacker through both; change a signal mid-session and watch access react live.
   **Ending**: The no-wall diagram, every gate independently checked, the central engine glowing; a lone broker in front of one app, with the servers behind it still trusting each other, marked "not zero trust".
   **Variants**: `ztna-vs-vpn`, `conditional-access`, `network-segmentation`, `least-privilege`.
   **Techniques**: boundary, failure, spotlight, side by side, exchange, caption.
   **Review**: Improved — the named misconception ('no VPN / a ZTNA product equals zero trust') was never defeated on screen; added beat 6 (a lone broker in front of a flat interior is still a wall) and spelled out 'authenticated, authorized and encrypted' from NIST SP 800-207 in beat 3. Weighed an airport-security-per-gate or hotel-keycard-per-room metaphor: both are good, but replaying the same breach through both models is the stronger proof. Checked: policy engine decides, enforcement point at each resource, continuous re-evaluation, assume breach.

### Zero trust network access (ZTNA) vs VPN (`ztna-vs-vpn`)

**The aha**: A VPN places the device on the network, able to reach everything the network allows; ZTNA brokers access to one application at a time, and never exposes the app to the internet.
**Misconception to defeat**: That ZTNA is just a nicer VPN, achieving the same thing differently. (A well-segmented VPN narrows reach, but its model is still "on the network"; ZTNA's is "this app, this request".)
**Cast**: A remote user's laptop on the left; a private network with four apps, A to D, inside a dashed trust boundary. VPN model: one tunnel straight onto the network. ZTNA model: an identity-aware broker in the middle, with an outbound-only connector from each app, no inbound port open.
**Opening frame**: The VPN tunnel, the laptop plugged straight onto the network, all four apps visible and reachable. _"VPN: a tunnel onto the network."_
**Story**:

1. The user connects for App A; the tunnel opens, and the laptop can also see and probe B, C and D sitting right there, a port-scan sweeping across all four. _"On the network means reachable, scanning included."_
2. An attacker who steals this VPN session inherits the same reach, sweeping to C, which they were never meant to touch, and getting in. _"One stolen VPN session, every app in range."_
3. Switch to ZTNA: the user requests App A specifically through the broker, which checks user and device signals, then opens a narrow, app-A-only path; B, C and D stay invisible, not even listed. _"ZTNA brokers one app at a time."_
4. Each app dials out to the broker; no app has an inbound port, and there is no VPN gateway listening on the internet for a scanner to find (VPN appliances are a frequent breach entry point). _"Nothing is listening. Nothing to scan."_
5. The stolen-session attack is replayed: the attacker gets the same session, but it only ever had a path to App A; C stays dark. Then the device posture turns unhealthy and the broker drops even A's path mid-session. _"A stolen ZTNA session reaches only what it was granted, and only while the checks keep passing."_
   **The moment**: Beat 2 against beat 5, the same stolen-session attack, full network reach versus a single app.
   **Interaction**: Toggle VPN/ZTNA and run a port-scan from the laptop in each; steal a session and see what it reaches.
   **Ending**: The ZTNA diagram, one bright narrow path to App A, everything else dark.
   **Variants**: `zero-trust-architecture`, `bastion-host`, `network-segmentation`, `conditional-access`.
   **Techniques**: boundary, spotlight, path trace, side by side, failure, caption.
   **Review**: Improved — added the VPN gateway itself as an internet-facing target and the mid-session posture drop borrowed from Networking's `zero-trust-network-access`, plus a caveat that a segmented VPN narrows reach; kept Security's replayed stolen-session beats, which are sharper than Networking's 'all three light up' because the same attack is run twice. Weighed a hotel metaphor (keycard to one room vs master key to the corridor): good, but not animated better than the scan. Checked: outbound-only connectors, per-app brokering, VPN grants network-level reach.

### Network segmentation and micro-segmentation (`network-segmentation`)

**The aha**: Segments force an attacker through checkpoints where they can be stopped and seen; a flat network lets one compromised machine reach everything, and filtering egress blocks data leaving too.
**Misconception to defeat**: That subnetting for addressing is the same as segmentation for security; relying on the perimeter firewall alone.
**Cast**: Two layouts side by side. Flat: one boundary holding ten machines, no internal walls. Segmented: the same ten machines grouped into Web, App and Data tiers, each inside its own dashed boundary, checkpoint gates between zones with a rule card, an egress gate at the outer edge.
**Opening frame**: The flat network, all ten machines, one outer wall. _"One network. One wall."_
**Story**:

1. An attacker compromises a Web-tier machine via phishing; a path-trace line sweeps freely to every other machine, no further checks. _"Flat: one compromise, everything reachable."_
2. The network is cut into three labelled subnets, but the rules between them say "allow all". The sweep goes straight through. _"Subnets are addresses. Rules are segmentation."_
3. Now the checkpoints between zones have rules: most paths are denied, only one narrow Web→App path is allowed and logged. The attacker tries to reach the Data tier directly from Web, skipping App: no path exists. _"Segments force the attacker through a checkpoint, where they can be seen."_
4. Micro-segmentation: inside the App tier, one app server tries to reach its neighbour sideways and is denied; each workload may talk only to what it needs. _"Even neighbours get walls."_
5. The compromised machine tries to send data straight to the internet; the egress gate checks the destination and blocks the unknown callback server. _"Egress filtering blocks data leaving, and blocks command-and-control callbacks."_
   **The moment**: Beat 1 against beat 3, the same free sweep across the flat network stopped cold at the first checkpoint in the segmented one.
   **Interaction**: Toggle flat/segmented and release the same attacker; click a checkpoint to see its allowed rules; set a checkpoint to "allow all" and watch the segments stop meaning anything; toggle egress filtering on and off.
   **Ending**: The segmented layout, the attacker contained to one web machine, every other zone untouched.
   **Variants**: `zero-trust-architecture`, `web-application-firewall`, `bastion-host`, `blast-radius`.
   **Techniques**: boundary, path trace, failure, side by side, spotlight, caption.
   **Review**: Improved — the named 'subnetting is not segmentation' misconception was never shown, so there is now a beat where labelled subnets with allow-all rules change nothing; micro-segmentation (east-west, per workload) from the title gets its own beat; moment renumbered. Weighed a ship-bulkheads metaphor: the identical-attacker flat/segmented replay already carries it. Checked: checkpoints force a logged path, tiers can't skip, egress filtering stops exfiltration and C2.

### Web application firewall (WAF) (`web-application-firewall`)

**The aha**: A WAF inspects HTTP requests against known attack patterns and buys time with "virtual patching," but it doesn't fix the vulnerable code underneath and needs tuning so it doesn't block real users.
**Misconception to defeat**: Confusing it with a network firewall that only checks IPs and ports; believing it replaces fixing the code.
**Cast**: An app server behind a WAF gate labelled "layer 7" (sitting where TLS ends), with a visible rule set. Four requests: a normal login, a SQL injection string in a form field, a support ticket whose text legitimately contains SQL code, and a disguised variant of the injection.
**Opening frame**: The WAF gate between the internet and the app. _"A filter that reads the request itself, not just the address."_
**Story**:

1. A normal login passes through, reaching the app unchanged. _"Ordinary traffic passes straight through."_
2. The injection string arrives in a form field; the WAF's rule matches the known pattern and blocks it before it reaches the app. _"Known attack patterns get blocked at the edge."_
3. A network firewall one layer below, checking only IP and port, lets the same request straight through: it's just HTTPS on port 443, and the payload is encrypted until it reaches the WAF. _"A network firewall can't see inside the request; a WAF can."_
4. A customer pastes a SQL snippet into a support ticket; the same pattern-matching blocks the real user too. _"The same rules can catch real people."_
5. The rule is first switched to count-only to see what it would block, then given an exception for that field; the support ticket now passes. _"Tuning fixes false positives."_
6. A disguised version of the injection (odd encoding, mixed case) slips past the rules and reaches the app, still unpatched and labelled "vulnerable underneath". _"A WAF buys time. It doesn't fix the code."_
   **The moment**: Beat 3, the same injection string sailing through the lower-layer firewall but caught by the WAF right above it.
   **Interaction**: Type different strings into the form and see which the WAF blocks; start a rule in count-only mode, then switch it to block; toggle a rule's strictness and watch false positives change.
   **Ending**: The WAF gate standing, the rule tuned, the disguised attack caught or not, and the caption noting the code beneath is still due for a fix.
   **Variants**: `sql-injection`, `cross-site-scripting`, `network-segmentation`, `rate-limiting-abuse`.
   **Techniques**: path trace, failure, side by side, restyle, caption.
   **Review**: Improved — replaced the lone-apostrophe false positive (rarely blocked by real rule sets) with a pasted SQL snippet, added that the WAF can read the payload because it sits where TLS ends, and made 'doesn't fix the code' visible with a disguised attack that slips through instead of a caption only. Weighed an airport-X-ray-vs-ticket-check metaphor: the same injection string passing the network firewall and caught by the WAF is the more precise picture. Checked: layer-7 managed rules (OWASP CRS style), count-then-block rollout, virtual patching, false positives, evasion by encoding.

### DDoS attacks and mitigation (`ddos-mitigation`)

**The aha**: You can't out-provision a single origin against a botnet — defences absorb at the edge, filter close to the source, and layer differently against volumetric, protocol and application floods.
**Misconception to defeat**: That rate limiting alone stops DDoS, or that it's a single-source attack.
**Cast**: A single origin server behind a scrubbing edge, a wide ring of distributed, anycast edge nodes; thousands of botnet-node icons sending streams toward the origin; three attack streams labelled volumetric, protocol (SYN floods) and application (HTTP floods against an expensive endpoint).
**Opening frame**: The origin alone, no edge, thousands of botnet streams converging, its meter already pinned red. _"One origin, versus thousands of sources."_
**Story**:

1. The volumetric flood, partly amplified by reflectors (small spoofed queries that bounce back as big replies aimed at the victim), overwhelms the single pipe into the origin; it flashes red and goes down. _"Volume alone can drown a single link."_
2. The scrubbing edge ring is added; the same flood spreads across many distributed anycast nodes and the origin's meter stays green. _"Absorb at the edge: spread the flood across many fronts."_
3. The protocol flood arrives next; edge nodes absorb the SYNs and complete or drop the half-open handshakes before they reach the origin's connection table. _"Filter protocol games close to where they land."_
4. The application flood: 10,000 bots each send one request a second to an expensive endpoint. Every bot is under any per-IP limit, yet together they crush the app. The edge scores behaviour and fingerprints, challenges suspicious clients and sheds the expensive path, and real users get through. _"A per-source rate limit can't see a botnet. Look at behaviour."_
5. The origin autoscales a second instance to absorb the surviving legitimate-looking load, and a cost meter ticks up sharply. _"What the attack doesn't cost you in downtime, it can cost you in the bill."_
   **The moment**: Beat 1 against beat 2, the identical flood that killed the undefended origin dissolving harmlessly across the edge ring.
   **Interaction**: Toggle the edge ring on and off and replay each flood type; watch the cost meter during an autoscale response.
   **Ending**: The edge ring absorbing all three flood types, the origin green, the cost meter elevated but controlled.
   **Variants**: `rate-limiting-abuse`, `web-application-firewall`, `network-segmentation`.
   **Techniques**: stream, boundary, failure, meter, side by side, caption.
   **Review**: Improved — beat 4 now defeats the named 'rate limiting alone stops DDoS' misconception by showing 10,000 bots each under the limit, and beat 1 gains the reflection and amplification detail that defines volumetric floods. Weighed a crowd-at-a-shop-door metaphor: the identical flood vs undefended-and-edge replay is clearer. Checked: volumetric / protocol (SYN) / application layers, anycast absorption, autoscaling turns downtime into cost, botnet is distributed.

### Bastion hosts and secure admin access (`bastion-host`)

**The aha**: Servers keep no public IPs; admins come through one audited, hardened door — ideally one with no listening port at all for an attacker to even find.
**Misconception to defeat**: Confusing it with a VPN or ZTNA generally; assuming any jump box is equally safe.
**Cast**: A private network of servers, all tagged "no public IP," inside a dashed boundary; an old-style bastion box at the edge with a visible open SSH port; an admin on the left; an attacker scanning the internet for open ports.
**Opening frame**: The private servers, dark from outside, one bastion box with a visible open port. _"One door, everything else dark."_
**Story**:

1. The admin connects to the bastion's open port, authenticates, then hops to a private server; the session is recorded. _"One audited, monitored entry point."_
2. An attacker port-scans the range, finds the bastion's open port exposed to the internet, and starts hammering it with credential attempts. _"A visible open port is something to attack, even when it's hardened."_
3. The modern successor removes the bastion's listening port entirely, replaced by an outbound-only connector from inside the network to a managed broker in the cloud. _"No listening port: nothing for a scanner to find."_
4. The admin authenticates to the broker from outside with an identity-based, just-in-time session; the broker relays it inward through the outbound connector, the same recorded session. _"Access comes to the admin's identity, not through an open inbound port."_
5. The same scanning attacker sweeps the range again: nothing answers on any port related to admin access. _"The best version isn't hardened — it's invisible."_
   **The moment**: Beat 2 against beat 5, the same scanning attacker finding a target the first time and finding nothing the second.
   **Interaction**: Toggle classic bastion vs connector-based access and run the port scanner each time; replay an admin session's recording.
   **Ending**: The connector-based model, no open port anywhere, the session recorded.
   **Variants**: `ztna-vs-vpn`, `just-in-time-privileged-access`, `network-segmentation`.
   **Techniques**: boundary, failure, toggle, spotlight, caption.
   **Review**: Merged — owned by networking (`bastion-host`, plans/networking.part3.md). The kept plan should borrow from this one: (1) the scanning attacker run twice, once finding the classic bastion's open SSH port and hammering it with credentials, once finding nothing against the connector model; this gives the 'invisible beats hardened' moment a before and after that Networking's rule-card beat lacks; (2) identity-based, just-in-time sessions with the recording replayable; (3) a stolen long-lived SSH key as the failure the managed version removes (short-lived credentials). Keep Networking's own strengths: the log strip showing every hop, and the side-by-side with a VPN. One accuracy note for the owner: Azure Bastion is a managed host reached over 443 from the portal (VMs need no public IP), while the 'outbound-only connector' shape fits AWS SSM Session Manager and Google IAP; don't present them as one mechanism.

## 9. Application and API security

### SQL injection (and the injection family) (`sql-injection`)

**The aha**: The fix is structural — parameterized queries keep user input as data no matter what it contains, while escaping and blocklists just lose an arms race.
**Misconception to defeat**: That input validation or escaping quotes fixes it.
**Cast**: A login form feeding a query template `SELECT * FROM users WHERE name = '<input>'`; a database table of users on the right; an attacker typing into the field.
**Opening frame**: The empty form, the query template with the input slot highlighted. _"User input lands inside a query string."_
**Story**:

1. A normal user types "alice"; the query becomes `...WHERE name = 'alice'` and returns her one row. _"Normally, harmless."_
2. The attacker types `' OR 1=1 --`; it slides into the template as `...WHERE name = '' OR 1=1 --'`, and the parser reads `OR 1=1` as query logic: every row lights up and returns. _"The input became code. Every row matches."_
3. Worse payloads follow: one reads another table, `'; DROP TABLE users; --` makes the table flash red and disappear. _"Same flaw: read other tables, change or drop data."_
4. The quick fix: strip or escape quotes. That payload now fails, but the attacker moves to a numeric field, `id = 1 OR 1=1`, which needs no quotes at all, and walks through. _"Escaping chases the attacker's next trick."_
5. Rewind to a parameterized query: the template now has a fixed placeholder, and the input is bound separately as a literal value, never glued into the query text. _"The query shape is fixed before input ever arrives."_
6. The same attack string is replayed: the database searches for a user literally named `' OR 1=1 --`, finds none, zero rows, table intact. _"The parser never sees it as syntax, just a very odd name to look up."_
   **The moment**: Beat 2 against beat 6, the identical attack string returning everything in one version and nothing in the other.
   **Interaction**: Type any string into the field and watch it either glue into the query text or bind as a literal value; toggle between the two modes; try to bind a table or column name as a parameter and see it refused, which is why those need an allowlist.
   **Ending**: The parameterized query standing, the attack string sitting harmlessly as a literal, the table intact. A closing strip shows the same shape elsewhere (OS command, NoSQL, LDAP, template injection): data reaching a parser as syntax.
   **Variants**: `cross-site-scripting`, `input-validation-output-encoding`, `insecure-deserialization`.
   **Techniques**: token, restyle, failure, toggle, side by side, caption.
   **Review**: Improved — the 'escaping quotes fixes it' misconception was named but never shown to fail; beat 4 now defeats it with a quote-free numeric injection; the DROP TABLE beat is captioned honestly (many drivers block stacked statements, reading other tables is the common real harm); added the limit that identifiers can't be parameters (interaction) and the injection family (ending). Weighed leading with the xkcd 'Bobby Tables' gag: funny but it teaches the rare payload. Checked: the glued string in beat 2 parses as written; parameterized queries separate query shape from values.

### Cross-site scripting (XSS) (`cross-site-scripting`)

**The aha**: The browser can't tell your script from injected script, so output must be encoded for the exact context it lands in.
**Misconception to defeat**: That XSS is a server-side flaw like SQL injection (the victim is the browser); that input validation alone is the fix.
**Cast**: A comment box posting into a shared list rendered to other visitors; a victim's browser with a token bar at top representing their session cookie; an attacker posting a comment containing a script tag.
**Opening frame**: The comment list with two normal comments. _"Comments, rendered for everyone who visits."_
**Story**:

1. The attacker posts a comment containing a script tag that will send the reader's cookie elsewhere; it's stored, unescaped, in the list. _"Stored: it waits in the database."_
2. A victim visits the page; their browser renders the list and runs the stored script as if it were the page's own code. _"The browser can't tell attacker script from site script."_
3. The script reads what the page can read and sends a copy of the session token off-screen, while the page looks normal. An HttpOnly cookie would hide the token from script, but the script could still act as the user. _"It runs with the site's own permissions: reading data, acting as the user."_
4. Two other routes to the same result: a crafted link whose parameter the server echoes into the page (reflected), and a client-side script that writes part of the URL into the page with innerHTML (DOM-based, never touching the server). _"Stored, reflected, DOM: three delivery routes, one browser bug."_
5. Rewind: the comment is now output-encoded for HTML before rendering, turning the angle brackets into harmless entities; the browser displays the literal text instead of running it. In the DOM case, textContent replaces innerHTML. _"Encode for the context and the tag is just text."_
6. The same attacker string is shown HTML-encoded, attribute-encoded and JavaScript-string-encoded side by side, each needing its own rule. _"Context changes what 'safe' output looks like."_
   **The moment**: Beat 2 against beat 5, the identical stored string running as code versus displaying as harmless text.
   **Interaction**: Post different payloads into the comment box and toggle encoding on and off; watch whether the token bar leaks.
   **Ending**: The comment list showing the attacker's string safely as visible text.
   **Variants**: `content-security-policy`, `sql-injection`, `input-validation-output-encoding`, `cross-site-request-forgery`.
   **Techniques**: token, restyle, failure, toggle, side by side, caption.
   **Review**: Improved — the plan said 'XSS types' nowhere on screen; beat 4 now shows stored, reflected and DOM-based routes, and beat 3 notes that HttpOnly protects the cookie but not the ability to act as the user (the old 'steals tokens' framing overstated what XSS is limited to). Weighed starting from the attacker's popup alert(1): harmless-looking, undersells the damage. Checked: browser executes injected script in the site's origin; fix is context-specific output encoding; frameworks escape by default until bypassed.

### Content Security Policy (CSP) (`content-security-policy`)

**The aha**: CSP tells the browser which sources of script, style and frames a page may use, so even if an attacker manages to inject a script tag, the browser simply refuses to run it.
**Misconception to defeat**: That CSP is the primary XSS fix, or confusing it with CORS or a WAF.
**Cast**: A page response with a CSP header, `script-src 'self' cdn.example.com`; the rendered page; an attacker's injected script tag pointing to an outside domain.
**Opening frame**: The page loading normally, scripts from allowed sources running fine, the CSP header visible. _"A second layer, after output encoding."_
**Story**:

1. An injected script tag slips through (say output encoding was missed) and the browser is about to fetch and run it. _"Say an injected tag makes it through anyway..."_
2. The browser checks the script's source against the CSP allowlist, finds no match, and refuses to fetch or run it. _"...the browser itself blocks it. Wrong source, never runs."_
3. A legitimate inline script written directly in the page, with no nonce, is blocked by the same strict policy, since inline scripts aren't allowed by default. _"Strict CSP blocks inline scripts too, including your own."_
4. A nonce, a random value generated fresh for every response, is added to both the CSP header and the legitimate inline script; it matches and runs, while the attacker, who can't know the next nonce, can't inject anything that matches. _"A nonce lets your own inline code through without opening the door generally. (Host allowlists are weaker: anything hosted on an allowed host can be abused.)"_
5. Separately, the CSP's frame-ancestors directive blocks the page from being embedded in another site's invisible iframe, stopping a clickjacking attempt from loading it at all. _"The same header stops clickjacking too."_
   **The moment**: Beat 2, the injected script tag sitting right there in the HTML, fetched, and refused anyway by the browser's own rule.
   **Interaction**: Edit the CSP allowlist and watch which script sources load; switch the header to Report-Only and watch violations get logged but not blocked, which is how teams roll CSP out; try embedding the page in an iframe with frame-ancestors on and off.
   **Ending**: The CSP header standing guard, the injected script blocked, the console showing the violation.
   **Variants**: `cross-site-scripting`, `cors-same-origin-policy`.
   **Techniques**: token, failure, restyle, caption.
   **Review**: Improved — tightened beat 4 (nonces are fresh per response, and host-based allowlists are the weaker design because any script served from an allowed host can be abused) and added Report-Only to the interaction, since that is how CSP is really adopted. Weighed showing CSP as a bouncer list vs a nonce 'password of the day': the nonce beat already uses the latter. Checked: script-src, nonce, frame-ancestors, a second layer behind output encoding, not a CORS or WAF substitute.

### Cross-site request forgery (CSRF) (`cross-site-request-forgery`)

**The aha**: A malicious site can make the victim's browser fire a state-changing request to a site where they're already signed in, because cookies attach automatically — the attacker triggers the action but never sees the response.
**Misconception to defeat**: Confusing it with XSS; thinking CORS prevents it.
**Cast**: Two browser tabs, "bank.com" (signed in, session cookie held; the cookie is SameSite=None, or from a browser without a Lax default) and "evil.com" (the attacker's page, with a hidden auto-submitting form targeting a transfer endpoint on bank.com).
**Opening frame**: Both tabs open, the bank's session cookie sitting in the shared cookie jar. _"One browser, one cookie jar, shared across tabs."_
**Story**:

1. The victim visits evil.com; a hidden form auto-submits to bank.com's transfer endpoint, and the browser automatically attaches bank.com's cookie, since the request is headed there regardless of who triggered it. _"The browser attaches the cookie automatically, whoever triggered the request."_
2. bank.com receives what looks like a normal, authenticated transfer request and processes it. _"The server can't tell a browser-triggered request from a user-clicked one."_
3. The attacker's page never gets to read bank.com's response, because the same-origin policy blocks that, but the policy never stopped the request being sent (a plain form POST needs no CORS permission). _"Blind: the attacker can fire the gun but not see where it landed, and doesn't need to."_
4. Rewind: the cookie is SameSite=Lax (today's default in Chrome and Edge) or Strict; the same hidden POST goes out but the browser withholds the cookie on the cross-site request, so the transfer is rejected for having no session. Strict also drops it on a clicked link; Lax still sends it on a top-level GET. _"SameSite: don't attach across sites. And never change state on a GET."_
5. As a further defence, the real transfer form includes a hidden anti-CSRF token tied to the real session; evil.com's forged form can't know it, so the request is rejected. Tokens still matter where SameSite can't help, such as an attacker on a sibling subdomain, which counts as same-site. _"Anti-CSRF tokens: prove the request came from the real form."_
   **The moment**: Beat 2, money moving from a request the victim never consciously made, then beat 4 showing the single cookie attribute that stops it.
   **Interaction**: Toggle SameSite strict, lax and none and replay the forged POST; then replay it as a clicked link (GET) and watch Lax let it through; toggle the anti-CSRF token's presence.
   **Ending**: SameSite holding on the POST, the token checked on the form, the transfer blocked, the cookie jar untouched by the cross-site request.
   **Variants**: `cors-same-origin-policy`, `sessions-vs-tokens`, `cross-site-scripting`.
   **Techniques**: token, exchange, failure, toggle, caption.
   **Review**: Improved — fixed a technical slip: with today's Lax-by-default cookies the drawn attack no longer works against a default cookie (it needs SameSite=None or an old browser), so beat 1/4 now say which cookie setting is in play; beat 3 now says plainly that the same-origin policy and CORS don't stop sending, defeating the 'CORS prevents it' misconception; added Lax's top-level-GET gap and the same-site subdomain case. Weighed an 'attacker mails a pre-signed cheque' metaphor: loses the cookie-jar mechanism. Checked: SameSite semantics, tokens, attacker cannot read the response.

### Same-origin policy and CORS (`cors-same-origin-policy`)

**The aha**: The same-origin policy and CORS are browser rules about whether a page may read a cross-origin reply; they protect the user's logged-in browser, not the server, because curl and attackers' servers ignore them.
**Misconception to defeat**: That CORS is a server-side security control, or that it stops CSRF.
**Cast**: A browser with a page from app-a.com and a "read gate" between each response and the page's script; api-b.com; a curl terminal beside it calling api-b.com directly; and a victim's browser holding a bank cookie, with an attacker's page open in another tab.
**Opening frame**: The app-a.com page, a fetch about to go to api-b.com. Caption: _"Different origin: scheme, host or port differs."_
**Story**:

1. The browser sends the cross-origin request from app-a.com; it reaches api-b.com, which processes it and sends back a full response. _"The request still happens."_
2. The reply reaches the browser's read gate. With no `Access-Control-Allow-Origin` header the gate stays shut and the page's fetch throws, but the server has already done its work. _"The browser just won't hand the reply to the page."_
3. api-b.com names app-a.com in a CORS header and the gate opens. For a PUT or custom header the browser first asks permission with an OPTIONS preflight. _"CORS: the server telling the browser this origin may read my response."_
4. curl, or an attacker's own server, calls api-b.com directly: no gate, full response. A private endpoint answers 401 because there is no cookie. _"CORS never restricted a non-browser. Protect the API with authentication."_
5. Why the gate exists: the victim's browser holds a bank cookie, and evil.com's script would otherwise read the victim's account page with it. The gate shuts. _"The policy protects the user's signed-in browser, not the server."_
6. api-b.com is misconfigured to reflect any Origin while also allowing credentials; now evil.com's page reads the victim's authenticated data through the browser. (A wildcard `*` is refused with credentials; reflecting is the trap.) _"Reflecting any origin with credentials: a data leak, not a convenience."_
   **The moment**: Beat 2, the response visibly arriving at the browser and only then being blocked at the read gate, followed by beat 4's curl reading the same reply with no gate at all.
   **Interaction**: Toggle the allowed-origin header and watch the gate open or shut on an already-delivered response; switch the target to a cookie-authenticated endpoint and the origin policy to "reflect any origin + credentials", and watch a stranger's page read the victim's data.
   **Ending**: api-b.com with a correctly scoped CORS header, authentication doing the real protection for anything private, the gate open only for app-a.com.
   **Variants**: `cross-site-request-forgery`, `broken-access-control`, `cors` (networking).
   **Techniques**: token, exchange, boundary, restyle, side by side, failure, toggle, caption.
   **Review**: Rethought — the old moment ('the same API data is sitting there for anyone who skips the browser') taught the wrong lesson: an attacker's own server gets only what an anonymous caller gets, and the point of the policy is stopping a hostile page from using the victim's cookies. Rebuilt around Networking's strongest beat (the reply arrives, then the read gate shuts), added preflight, curl, why the gate exists and the reflected-origin-plus-credentials leak that Networking's version lacks. Weighed a doorman metaphor: the read gate on an already-delivered reply is more exact. Checked: origin is scheme+host+port, requests are sent even when reads are blocked, `*` can't be combined with credentials, CORS doesn't prevent CSRF.

### Server-side request forgery (SSRF) (`server-side-request-forgery`)

**The aha**: A "fetch this URL" feature running on your server sits inside your trust boundary — tricking it into fetching an attacker-chosen URL can reach internal services and the cloud metadata endpoint, handing over real credentials.
**Misconception to defeat**: Confusing it with CSRF (no victim's browser here: the server itself is tricked) or with an open redirect.
**Cast**: An app server inside the dashed trust boundary with a "fetch image from URL" feature; outside, a normal image URL; inside, invisible from outside, an internal admin panel and the cloud instance metadata endpoint holding the server's own credentials.
**Opening frame**: The app server, the fetch feature, a normal external image already loaded. _"A server that fetches whatever URL you give it."_
**Story**:

1. A normal user submits an external image URL; the server fetches it from outside the boundary and displays it. _"Working as intended."_
2. The attacker submits the cloud metadata address instead; the trusted server fetches it internally and returns the response, the server's own cloud credentials, straight back to the attacker. _"The server will fetch anything it can reach, including itself."_
3. The now-opened credentials envelope is used to call the cloud API directly, reaching resources the app server was allowed to touch. _"One feature, the server's own keys."_
4. The attacker also submits the internal admin panel's address, which the server fetches too, revealing a page never meant to be reachable from outside. _"It can reach internal services the attacker never could."_
5. A first fix checks the URL text and blocks the metadata address. The attacker submits `http://evil.example`, whose DNS answers with the metadata IP (or which redirects there): the text check passes and the server connects to metadata anyway. _"Checking the URL string isn't checking where it goes."_
6. Rewind to a real fix: an allowlist of expected external destinations, the hostname resolved first and the IP actually connected to checked against internal and link-local ranges, redirects not followed blindly, the metadata service requiring a session token (IMDSv2), and egress filtering. All the attack URLs die before a request leaves. _"Check the address you actually connect to, and make the metadata endpoint ask for a token."_
   **The moment**: Beat 2, the server handing over its own cloud credentials because it trusted a URL typed by a stranger.
   **Interaction**: Type different URLs into the fetch box and watch which ones the server reaches; toggle the destination allowlist on and off; try a hostname that resolves to an internal address.
   **Ending**: The checks in place, the metadata and admin-panel URLs both blocked, and the DNS-tricked URL stopped at connect time.
   **Variants**: `broken-access-control`, `managed-workload-identity`, `security-misconfiguration`.
   **Techniques**: boundary, token, path trace, failure, toggle, caption.
   **Review**: Improved — the old fix (allowlist plus range-blocking) would still be bypassed by DNS pointing at an internal IP or by redirects, so beat 5 shows that bypass and beat 6 states the connect-time check; named the metadata token (IMDSv2) and egress filtering; CSRF confusion now stated against the plan's own cast. Weighed a 'receptionist who fetches any parcel you name' metaphor: fine, but the trust-boundary diagram carries it already. Checked: metadata at 169.254.169.254, link-local/private ranges, the 2019 Capital One path (SSRF to metadata credentials).

### Broken access control (`broken-access-control`)

**The aha**: Hiding a button on the client is not authorization — every request must be checked on the server, deny by default.
**Misconception to defeat**: That removing a link or button from the UI is enough; that authentication alone covers it.
**Cast**: A page with an "Admin" button hidden for a regular user's badge but shown for an admin badge; below, the actual API endpoint the button calls; a browser dev-tools panel.
**Opening frame**: The regular user's page, the Admin button nowhere in sight. _"The button is hidden. Is the door locked?"_
**Story**:

1. The user opens dev tools and finds the Admin button was just given `display:none`, the underlying link sitting right there in the page source. _"Hidden in the UI isn't hidden in the code."_
2. The user crafts that same request directly and sends it; the server, checking only "is this a logged-in user," executes it. _"The server executed it. It never asked whether this user was allowed to."_
3. Three more doors with the same hole: typing `/admin/users` straight into the address bar (forced browsing), editing an `isAdmin=false` cookie to true (trusting client-side flags), and `../` in a file path. _"Different doors, same missing lock."_
4. Rewind: the endpoint now checks the caller's role server-side first, deny by default unless admin. The regular user's identical crafted request is rejected; the admin's legitimate one passes the same check. _"Check on the server, every time, deny unless explicitly allowed."_
   **The moment**: Beat 2, the exact same request a UI "protected" by hiding a button, executed in full, because nothing server-side was watching.
   **Interaction**: Open dev tools, find the hidden endpoint, and fire it directly as different roles; toggle the server-side check on and off.
   **Ending**: The server-side check standing, deny-by-default, only the admin's role passing through.
   **Variants**: `idor-bola` (the object-level case), `security-misconfiguration`, `default-deny-policy-evaluation`.
   **Techniques**: spotlight, token, failure, side by side, toggle, caption.
   **Review**: Improved — beat 3 mixed a click from an admin and an over-permissive CORS config into the same pile, which confused the point (CORS is a browser read rule, covered by its own plan); replaced with forced browsing, a client-side admin flag and path traversal, and merged the fix and the legitimate-access beats. Weighed a hotel-corridor metaphor (door without a lock): the dev-tools reveal is more memorable for web developers. Checked: authentication is not authorization, server-side deny-by-default, OWASP's top risk in 2021 and 2025.

### IDOR / broken object level authorization (`idor-bola`)

**The aha**: The user is authenticated, but nobody checked that this particular object belongs to them — changing an ID in the URL reaches someone else's data.
**Misconception to defeat**: That IDOR is an authentication failure; that unguessable IDs alone fix it.
**Cast**: A logged-in user, "alice," viewing her own order via a URL she can edit; a second order belonging to "bob," visually identical in structure, sitting in the same table.
**Opening frame**: Alice's browser showing her own order, matching the URL's id. _"Alice, looking at Alice's order. Properly authenticated."_
**Story**:

1. Alice edits the URL's id to point at a different order. _"What if I just... change the number?"_
2. The server checks only that a logged-in user exists and that the order exists, then returns the full card, which happens to be bob's. _"Authenticated, yes. Authorized for this object? Never asked."_
3. Side by side, the server's actual check logic is shown as a single box with no clause comparing the order's owner to the requester. _"The missing line: does this order belong to this user?"_
4. Swapping the sequential id for a long random one makes guessing harder, but a resourceful attacker who gets one id from elsewhere still passes the same missing check. _"Unguessable IDs slow attackers. They don't stop the real gap."_
5. Rewind: the lookup is now scoped to the caller (`WHERE id = ? AND owner = alice`); alice's request for bob's order finds nothing and is refused, while her own order still returns fine. _"Check ownership of the specific object, every time."_
   **The moment**: Beat 2, bob's full order appearing on alice's screen from nothing more than typing a different number.
   **Interaction**: Edit the URL's id and watch what comes back; move the id into a POST body or header and see the same hole; toggle the ownership check on and off; swap sequential ids for random ones and see the check still matters.
   **Ending**: The ownership check standing, bob's order denied to alice, her own order fine.
   **Variants**: `broken-access-control`, `mass-assignment-bopla`, `default-deny-policy-evaluation`.
   **Techniques**: token, spotlight, side by side, failure, toggle, caption.
   **Review**: Improved — small: the fix is now drawn as the lookup being scoped to the caller (one query, one clause) rather than a loose second check, and the interaction adds ids in bodies and headers, since the bug isn't about URLs. Weighed a hotel-keycard-opens-every-room metaphor: right, but the id-in-the-URL edit is the thing developers will recognise. Checked: authenticated vs authorized, per-object check, unguessable ids don't fix it (OWASP API1 BOLA).

### Mass assignment and excessive data exposure (`mass-assignment-bopla`)

**The aha**: Authorization applies to object fields too, not just whole objects — an API that blindly binds every incoming field, or returns the whole record, lets a user write or read fields they should never touch.
**Misconception to defeat**: Treating this as the same bug as IDOR; believing input validation on values is enough.
**Cast**: An "update profile" endpoint; a user object with fields `name`, `email`, `role` (currently "user") and `balance`; an incoming, editable JSON request.
**Opening frame**: A normal update request about to hit an endpoint that auto-binds whatever fields arrive onto the model. _"The endpoint binds every field it's given onto the object."_
**Story**:

1. A normal update sends only `name`, and only `name` changes. _"Looks fine, for a request that only sends what's expected."_
2. The attacker also sends `role: "admin"` on their own profile, a field the UI never exposed but the API never restricted either; the model binds it directly, and `role` flips to admin. "admin" is a perfectly valid value, so value checks pass. _"Their own object, a field they shouldn't touch. Nothing stopped the extra field."_
3. Separately, a "get my profile" request returns the entire stored record, including an internal `balance` field never meant for the client, because the endpoint just serializes the whole object. _"Over-exposure: returning the whole record, not just what's meant to be seen."_
4. Rewind: the endpoint now uses an explicit allowlist for both directions, writable fields only name and email, readable fields only name and email, `role` and `balance` excluded from both. _"Explicit allowlists for what may be written, and separately, what may be returned."_
5. Both attacks are replayed: the `role` field in the write request is silently dropped, and the read response no longer includes `balance`. _"Same requests, now only touching what they're allowed to."_
   **The moment**: Beat 2, one unexpected field in a JSON body quietly promoting a user to admin.
   **Interaction**: Edit the incoming JSON and add arbitrary fields; toggle the allowlist on and off for both write and read directions.
   **Ending**: The allowlist enforced both ways, role and balance both out of reach.
   **Variants**: `idor-bola`, `broken-access-control`, `input-validation-output-encoding`.
   **Techniques**: token, contents, spotlight, toggle, failure, caption.
   **Review**: Improved — the 'not the same bug as IDOR' misconception is now stated on screen (it's the attacker's own object, the field is the problem), and beat 2 notes that `admin` passes any value validation. Weighed one combined 'return the whole object / bind the whole object' mirrored beat: the two-direction replay in beats 4 and 5 already does that. Checked: BOPLA is OWASP API3:2023, fix is allowlists/DTOs both ways.

### Insecure deserialization (`insecure-deserialization`)

**The aha**: Deserializers can construct objects and run their methods before your code ever inspects the data, so attackers chain existing "gadget" classes already in your program to reach code execution.
**Misconception to defeat**: Thinking this is just "parsing data wrong," the same risk as JSON parsing.
**Cast**: A server receiving a byte blob labelled "serialized object"; a deserializer gear turning bytes into a live object, calling constructors and methods as it goes; a library of classes already loaded in the program, one marked "gadget: has a dangerous method."
**Opening frame**: A byte blob arriving, the deserializer gear idle. _"Bytes, claiming to be a saved object."_
**Story**:

1. A legitimate blob representing a shopping cart deserializes normally, rebuilt field by field through its ordinary constructor; the application's own code then inspects it. _"Normally: rebuild the object, then your code checks it."_
2. The attacker crafts a blob that instead references the existing gadget class already sitting in the program, with its constructor chained to call a dangerous method. _"The attacker doesn't need to inject new code: your own classes are the weapon."_
3. The deserializer gear processes the crafted blob exactly like any other, instantiating the gadget and calling its method as part of "just rebuilding the object," before any application logic runs. _"The dangerous call happens during deserialization itself, before your code gets a turn."_
4. A shell icon pops open on the server as the attacker's command executes. _"Remote code execution, from a parsing step."_
5. Rewind: the server stops deserializing native formats from untrusted sources and switches to a data-only schema format; the same crafted blob is just inert fields (a JSON object cannot name a class to construct). If native formats are unavoidable, restrict the allowed classes and sign what you deserialize. _"Data-only formats can't call your methods."_
   **The moment**: Beat 3, the realization that the dangerous method runs during parsing, before any of "your" validation code gets a chance to look at anything.
   **Interaction**: Swap the crafted blob's target class and watch which gadget fires; switch to a pickle-style blob, which names the dangerous call directly with no gadget needed; toggle native deserialization against a data-only schema format.
   **Ending**: The data-only format standing, the crafted blob reduced to inert fields.
   **Variants**: `sql-injection`, `security-misconfiguration`.
   **Techniques**: contents, token, failure, restyle, toggle, caption.
   **Review**: Improved — beat 5 now says why JSON is different (it cannot name a class to instantiate) which defeats the 'same as JSON parsing' misconception, and lists class allowlisting alongside signing; interaction adds the pickle case where the blob carries the call itself and no gadget is needed. Weighed a trojan-parcel-opened-at-the-door metaphor: the 'runs before your checks' beat is the exact claim. Checked: Java/.NET/PHP gadget chains, pickle's reduce, code runs during deserialization.

### Security misconfiguration (`security-misconfiguration`)

**The aha**: In the cloud, one setting can publish an entire data store to the internet; misconfiguration, not exotic exploits, is a leading cause of cloud data exposure.
**Misconception to defeat**: That breaches mostly come from clever zero-day exploits.
**Cast**: A storage bucket with a single "Public access" toggle; a default-credentials panel on an admin console; a settings table with one entry highlighted red; an attacker simply browsing, no exploit tool in hand.
**Opening frame**: The bucket toggle "Off," locked, the attacker outside seeing nothing. _"One setting. No exploit needed either way."_
**Story**:

1. An engineer turns off the account's public-access block and attaches a public-read policy to test something, intending to undo it. Cloud defaults are private now; this took a deliberate override, but it was one quick change. _"A quick, forgettable change."_
2. Weeks pass; the setting is still on. Scanners sweep the internet continuously, and one running nothing more exotic than a bucket-name scanner finds it and downloads every file inside, no password, no vulnerability, just an open door. _"No exploit. Just an open setting."_
3. Side by side, more of the same root cause: an admin console still on its default password, a server leaking stack traces in verbose errors, an admin port open to 0.0.0.0/0, an IAM policy that allows `*`. _"Same root cause, different settings."_
4. Rewind: resources are provisioned private by default, policy-as-code blocks a public bucket at deploy time, and a continuous scan of every account flags any "Public: On" within minutes. _"Secure by default, and checked continuously, not once a year."_
5. The same toggle is flipped again by hand in the console; the automated check catches the drift within minutes, flags it on a dashboard, and auto-remediation flips it back. _"Caught and fixed before a scanner ever finds it."_
   **The moment**: Beat 2, the plain simplicity of the attack, just browsing to a forgotten "On" toggle.
   **Interaction**: Flip the toggle and watch a simulated internet scanner find it over time; toggle continuous scanning on and off.
   **Ending**: The toggle "Off," the continuous check green, the dashboard clear.
   **Variants**: `cspm`, `secure-baseline-hardening`, `broken-access-control`.
   **Techniques**: toggle, timer, failure, side by side, meter, caption.
   **Review**: Improved — 'most cloud breaches' is stated more strongly than the sources support, so the aha and beat 2 now say 'a leading cause'; beat 1 reflects that S3, Azure Storage and others now default to private and need a deliberate override; beat 3 adds open admin ports and wildcard IAM (more common than buckets); beat 4 adds blocking at deploy as well as scanning. Weighed a leaving-the-front-door-open metaphor: the scanner timeline already shows the open-door idea better. Checked: default-private storage, policy as code and CSPM, auto-remediation.

### Input validation and output encoding (`input-validation-output-encoding`)

**The aha**: Validation and encoding are two different jobs in two different places — validation rejects nonsense where data enters, encoding protects the exact context where it's finally used.
**Misconception to defeat**: Calling either one "sanitization" and treating them as interchangeable, or as the WAF's job.
**Cast**: A pipeline: input arrives at a "bio" field, passes a validation gate checking type, length and encoding, is stored, then later reaches an output point, rendered into HTML, bound into a SQL query, or passed to a shell command, each with its own destination-specific protection.
**Opening frame**: A string containing an apostrophe and an HTML tag, `Tom's <b>bold</b> bio`, entering at the left. _"One string, different jobs ahead of it."_
**Story**:

1. The string reaches the validation gate, which checks only what can be known up front: it is text, under 200 characters, valid UTF-8. It cannot reject `<` or `'`; real people type those. _"Validation: reject what can't be right. It can't know where the text will end up."_
2. The stored string later goes into an HTML page; at that output point, the encoding gate turns the tag into harmless entities, safe to display as text. _"Encoding: make it safe for this specific destination."_
3. The same string is used to build a SQL query; a different mechanism applies there, not escaping but a parameterized query binding it as a literal value. _"Different destination, different protection. SQL gets parameters, not HTML-escaping."_
4. The same string flows toward a shell command for a backup script. Best is to avoid the shell entirely and pass it as one argument in an argument list; if a shell is unavoidable it needs shell-specific quoting. _"Same input, three destinations, three different protections."_
5. Separately, a response fetched from a third-party API is displayed on the page without ever being treated as input, and a malicious field inside it runs as script. _"Anything landing in your page is input to your page, including other people's APIs."_
   **The moment**: Beats 2 through 4, the identical stored string being transformed three different ways depending only on where it's about to be used.
   **Interaction**: Edit the input string and watch it pass or fail validation; follow it to each output point and see its context-specific encoding.
   **Ending**: The pipeline diagram, validation once at the gate, protection three times, at each destination; a WAF sketched at the edge guessing from outside, while only each destination knows the right encoding.
   **Variants**: `sql-injection`, `cross-site-scripting`, `mass-assignment-bopla`.
   **Techniques**: path trace, restyle, side by side, spotlight, caption.
   **Review**: Improved — the old opening put an HTML tag through a name-style validation gate that should have rejected it, which undercut validation; the plan now uses a free-text bio that validation legitimately cannot restrict, which makes the real lesson (only the destination knows the right encoding) visible, and the shell case now recommends no shell at all instead of 'escaping'. Weighed a customs-checkpoint-vs-translator metaphor: the single string fanning out to three destinations is more concrete. Checked: validation at entry, context-specific protection at use, third-party data is untrusted.

### Rate limiting and abuse prevention (`rate-limiting-abuse`)

**The aha**: Abuse uses entirely valid requests, so there's no malicious payload to block — you limit how much and how fast, per user, key, IP or device, and protect the expensive endpoints first.
**Misconception to defeat**: That this is the same as DDoS protection, or that one global rate limit covers every endpoint equally.
**Cast**: A login endpoint and a "claim free item" endpoint, each with a request-counter meter and a threshold line; an attacker guessing one account's password from one address, later from a thousand, then a botnet replaying a leaked list of username-password pairs; a bot script hammering the free-item endpoint.
**Opening frame**: Both endpoints at low traffic, meters well under threshold. _"Every one of these requests is perfectly well-formed."_
**Story**:

1. An attacker guesses passwords for one account from one address, thousands of well-formed login attempts a minute; the meter climbs fast toward the threshold. _"No exploit, just trying a lot of passwords, fast."_
2. The threshold is crossed; new attempts from that address get a 429 and are rejected, while a real user's occasional mistyped login nearby sails through under the same limit. _"Limit how much and how fast, not whether it 'looks malicious'."_
3. Separately, a bot script hits the free-item endpoint far faster than any human could click; its much lower threshold, set because the endpoint is business-expensive, caps it hard while the login endpoint's limit stays untouched. _"Protect the expensive and valuable endpoints with their own limits."_
4. The attacker spreads the guesses over a thousand source addresses, each under its per-IP limit. Keying the limit on the targeted account makes them converge on one meter and get capped (by throttling or a challenge, not a hard lockout the attacker could use to lock real users out). _"Key the limit to what the attacker can't spread: the target."_
5. Credential stuffing flips it: a botnet tries each leaked username-password pair once, across a million accounts. Every account meter reads one, every address meter reads a few; neither trips. Device and behaviour signals, breached-password checks and MFA catch it. _"Spread across accounts, counting isn't enough. Add signals."_
**The moment**: Beat 2, the same-shaped request succeeding for a real user and failing for the attacker, purely because of rate, no content difference at all.
**Interaction**: Dial the request rate up and watch the meter and throttling kick in; switch the limiting key between IP, account and device fingerprint and watch which attack each one catches or misses.
**Ending**: Both endpoints with tuned, separate thresholds, the attacker's streams capped or challenged, real users unaffected.
**Variants**: `ddos-mitigation`, `web-application-firewall`, `multi-factor-authentication`, `rate-limiting`.
**Techniques**: meter, stream, failure, dial, side by side, caption.
</content>

**Review**: Improved — a technical slip: beat 1 called 'many leaked passwords against one username' credential stuffing, which is brute force; real credential stuffing is one try per leaked pair across many accounts, and the plan's account-keyed limit would miss it. Beats 1, 4 and 5 now show brute force, distributed brute force (account key) and true stuffing (needs device/behaviour signals, breached-password checks, MFA), plus the lockout-abuse caveat and 429. Weighed a nightclub-door-counter metaphor: dials and meters on two endpoints show per-endpoint thresholds better. Checked: abuse uses valid requests, per-endpoint thresholds, key choice matters.
