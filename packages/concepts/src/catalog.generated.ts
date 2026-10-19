// Generated from content/ by scripts/build-catalog.ts. Do not edit: run `pnpm build:catalog`.
import type { ConceptCard } from "./types";

export const CONCEPT_CATALOG: readonly ConceptCard[] = [
  {
    "id": "blue-green-deployment",
    "title": "Blue/green deployment",
    "summary": "Run the new version as a full second environment, test it privately, then move all traffic with one switch. Rolling back is the same switch, as long as the database still suits both versions.",
    "topic": "delivery",
    "platform": "any",
    "tags": [
      "release",
      "deployment",
      "cutover",
      "rollback",
      "zero downtime"
    ],
    "kind": "explainer",
    "parts": []
  },
  {
    "id": "canary",
    "title": "Canary release",
    "summary": "Release a new version to a small share of traffic. If it holds up, give it more; if it doesn't, take its share away before most people notice.",
    "topic": "delivery",
    "platform": "any",
    "tags": [
      "release",
      "deployment",
      "rollout",
      "rollback"
    ],
    "kind": "pattern",
    "parts": [
      {
        "element": "lb",
        "label": "What splits the traffic",
        "optional": false
      },
      {
        "element": "stable",
        "label": "The version in use",
        "optional": false
      },
      {
        "element": "canary",
        "label": "The new version",
        "optional": false
      }
    ]
  },
  {
    "id": "queue-load-levelling",
    "title": "Queue load levelling",
    "summary": "Put a queue in front of the work. A burst waits in the queue instead of overwhelming the workers, who scale out and work through it as fast as they can.",
    "topic": "messaging",
    "platform": "any",
    "tags": [
      "queue",
      "workers",
      "backlog",
      "burst"
    ],
    "kind": "pattern",
    "parts": [
      {
        "element": "queue",
        "label": "What holds the work",
        "optional": false
      },
      {
        "element": "workers",
        "label": "What works through it",
        "optional": false
      }
    ]
  },
  {
    "id": "visibility-timeout",
    "title": "Visibility timeout",
    "summary": "A received message isn't deleted, only hidden from other consumers for a set time. If it hasn't been acknowledged when that time is up, it comes back and another consumer does the work again.",
    "topic": "messaging",
    "platform": "any",
    "tags": [
      "queue",
      "lease",
      "peek-lock",
      "ack",
      "redelivery",
      "at-least-once"
    ],
    "kind": "explainer",
    "parts": []
  },
  {
    "id": "load-balancing",
    "title": "Load balancing",
    "summary": "A load balancer sends each request to one server behind it, evenly or by weight, so a bigger server can take a bigger share. When a server fails, the others take its share.",
    "topic": "networking",
    "platform": "any",
    "tags": [
      "load balancer",
      "weights",
      "health"
    ],
    "kind": "pattern",
    "parts": [
      {
        "element": "lb",
        "label": "What spreads the traffic",
        "optional": false
      },
      {
        "element": "a",
        "label": "A server behind it",
        "optional": true
      },
      {
        "element": "b",
        "label": "Another server behind it",
        "optional": true
      },
      {
        "element": "c",
        "label": "A third server",
        "optional": true
      }
    ]
  },
  {
    "id": "failover",
    "title": "Failover",
    "summary": "Traffic goes to a primary while it's healthy. A standby waits beside it, and when the primary fails, its traffic moves to the standby.",
    "topic": "reliability",
    "platform": "any",
    "tags": [
      "standby",
      "disaster recovery",
      "dns",
      "backup"
    ],
    "kind": "pattern",
    "parts": [
      {
        "element": "primary",
        "label": "What usually serves",
        "optional": false
      },
      {
        "element": "standby",
        "label": "What takes over",
        "optional": false
      },
      {
        "element": "switch",
        "label": "What moves the traffic",
        "optional": true
      }
    ]
  },
  {
    "id": "autoscaling",
    "title": "Autoscaling",
    "summary": "Set the fewest copies (for safety), the most (for cost) and a target load. Copies are added when they get busier than the target and removed when they're quiet, but never past those limits.",
    "topic": "scaling",
    "platform": "any",
    "tags": [
      "scale out",
      "autoscale",
      "min",
      "max",
      "target"
    ],
    "kind": "pattern",
    "parts": [
      {
        "element": "api",
        "label": "What scales automatically",
        "optional": false
      }
    ]
  },
  {
    "id": "caching",
    "title": "Caching",
    "summary": "A cache keeps answers to requests it has seen. Hits come straight back; only misses go on to the database, so it carries a fraction of the traffic.",
    "topic": "scaling",
    "platform": "any",
    "tags": [
      "cache",
      "redis",
      "hit rate",
      "database"
    ],
    "kind": "pattern",
    "parts": [
      {
        "element": "cache",
        "label": "What answers repeat requests",
        "optional": false
      },
      {
        "element": "db",
        "label": "What it protects",
        "optional": true
      }
    ]
  },
  {
    "id": "horizontal-scaling",
    "title": "Horizontal scaling",
    "summary": "Run more copies of a service as traffic grows and fewer as it falls. A load balancer spreads the requests, so each copy carries a fair share.",
    "topic": "scaling",
    "platform": "any",
    "tags": [
      "scale out",
      "scale set",
      "load balancer",
      "vm"
    ],
    "kind": "pattern",
    "parts": [
      {
        "element": "app",
        "label": "What scales out",
        "optional": false
      },
      {
        "element": "lb",
        "label": "What spreads the traffic",
        "optional": true
      }
    ]
  },
  {
    "id": "scale-up-vs-out",
    "title": "Scale up vs scale out",
    "summary": "Scaling up makes one machine bigger, up to the largest size there is. Scaling out adds more machines behind a load balancer, with room to keep growing.",
    "topic": "scaling",
    "platform": "any",
    "tags": [
      "scale out",
      "scale up",
      "comparison"
    ],
    "kind": "pattern",
    "parts": [
      {
        "element": "out",
        "label": "What scales out",
        "optional": true
      },
      {
        "element": "up",
        "label": "What scales up",
        "optional": true
      }
    ]
  },
  {
    "id": "vertical-scaling",
    "title": "Vertical scaling",
    "summary": "Give one machine more cores, memory and disks as its load grows, and less as it falls. There is always a largest size; past it, the machine is overloaded.",
    "topic": "scaling",
    "platform": "any",
    "tags": [
      "scale up",
      "vm size",
      "database",
      "cpu",
      "memory"
    ],
    "kind": "pattern",
    "parts": [
      {
        "element": "db",
        "label": "What scales up",
        "optional": false
      }
    ]
  }
];
