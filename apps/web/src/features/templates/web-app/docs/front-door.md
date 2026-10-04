# Front Door

Global entry point. Terminates TLS, caches static assets at the edge and routes every request to
the healthy region.

- **WAF** blocks common attacks before they reach the app.
- **Health probes** every 30 seconds decide where traffic goes.
