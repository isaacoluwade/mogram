# AKS cluster

Runs the storefront services in two namespaces. **Double-click** to open the cluster and see
what runs inside.

- Node pools: `system` (3 × D4s) and `apps` (3–12 × D8s, autoscaled)
- Images come from the [container registry](#registry); secrets from [Key Vault](#key_vault).
