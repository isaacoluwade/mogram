# Azure plans, part 1: review summary

34 plans reviewed: 27 Improved, 7 Keep, 0 Rethought, 0 Merged.

Keep: azure-caf-vs-waf, azure-entra-id, azure-conditional-access, azure-external-identities,
azure-entra-agent-id, azure-network-security-layers, azure-vpn-vs-expressroute.

## Most important changes

- azure-rbac: "the more powerful role wins" was wrong (permissions are a union); NotActions-is-not-a-deny was named but never shown (now a second assignment re-grants the trimmed action); deny assignments are system-created, not user-authored.
- azure-nsg: priority wording was ambiguous and the two-gate block never shown; rewritten with real rule numbers and the built-in default deny, statefulness added, outbound now shows all four gates.
- azure-user-defined-routes: /0 was described as the "widest, most relevant" match, backwards; rewritten around longest prefix first, then UDR over BGP over system on ties.
- azure-vnet-peering and azure-hub-spoke: the unpeered packet is dropped at the sender (no route), not stranded in the middle; forwarder needs IP forwarding, allow-forwarded-traffic and a return route; internet egress leaves via the firewall, not the VPN gateway.
- azure-control-plane-vs-data-plane: "Owner can't read blobs" contradicted the listKeys beat; now states it holds only for Entra-authenticated access and names the shared-key backdoor.
- azure-landing-zones: hub link belongs to Corp, not Online; Online and Sandbox now contrast.
- azure-policy: append replaced by modify; added pre-existing-resource scan beat; DINE runs afterwards.
- azure-resource-locks: attacker beat now shows Owner simply removing the lock.
- azure-entra-roles: elevation grants UAA at root scope "/", not the root management group.
- azure-hybrid-identity: AD FS wasn't powered back on in the last beat.
- azure-private-endpoint-vs-service-endpoint: muddled beat 5 became a concrete exfiltration contrast, plus a beat showing public access is still there until disabled.
- azure-application-gateway: removed the false claim that a global edge can't route by path.
- azure-front-door: origin lock needs the service tag plus your own Front Door ID header.
- azure-outbound-connectivity: meter now reaches the SNAT ceiling and a second IP doubles it.
- azure-resource-hierarchy: region shown as a property, with a West Europe group around an East US VM.
- Smaller: ARM Activity Log records writes only; Bicep compiles to the template parcel; app-registration "re-consent" flag removed; API permissions vs Azure roles shown as two lists; managed identity "nothing to copy" softened; PIM thief now stops at MFA; vWAN Standard SKU; load balancer vs NAT Gateway direction; Bastion vs self-built jump box.

## Patterns for the platform

- Two-door / two-gate pictures recur (control vs data plane, locks, NSG subnet+NIC, ARM stations): a reusable "gate chain" element where each gate shows its rule card and the verdict stamp.
- Role ribbons that seep down nested frames need a real tinting/inheritance system; also union vs deny rendering (overlapping colours, slashed ribbon).
- Route tables and rule lists (UDR, NSG, DNS records) are central: a sortable list with a highlighted matching row, driven by a token.
- Drop-at-source vs travel-and-stop must be distinguishable (no-route vs blocked-by-rule); consider different failure marks.
- Power/availability toggles on a component (on-prem box, appliance, origin) with downstream per-path outcomes.
- Meters with labelled ceilings (SNAT ports, quotas), and a "dial" to raise them.
- Identity badge cards with typed lists (API permissions vs Azure roles) and clone-into-another-container animations (service principals, guests, subscriptions).
- Many plans use a side-by-side "same request, two lanes, freeze on divergence"; worth first-class support.
- Naming drifts (Entra, Foundry, Flex Consumption): keep captions data-driven so renames are cheap.
