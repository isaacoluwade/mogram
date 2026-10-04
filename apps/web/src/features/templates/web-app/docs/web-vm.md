# Web VM

Runs the storefront (`checkout-web`, Node.js 22) behind the Application Gateway.

| Setting | Value |
| --- | --- |
| Size | Standard_D4s_v5 |
| Autoscale | 2–10 instances |

Talks to the [orders database](#db_primary) and the [session cache](#cache).
