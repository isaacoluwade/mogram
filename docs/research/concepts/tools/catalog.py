"""Reads every catalog/<area>.md and reports the concepts: counts, duplicate ids, and (with
--write) the master index CATALOG.md. Run from anywhere: python3 tools/catalog.py [--write]."""
import pathlib, re, sys, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
AREAS = ["fundamentals", "git", "containers", "networking", "security", "data", "messaging",
         "scaling", "reliability", "delivery", "observability", "architecture", "ai",
         "azure", "aws", "gcp"]
LABELS = {"fundamentals": "Fundamentals", "git": "Git", "containers": "Containers & Kubernetes",
          "networking": "Networking", "security": "Security & identity", "data": "Data & storage",
          "messaging": "Messaging & events", "scaling": "Scaling & performance",
          "reliability": "Reliability", "delivery": "Delivery", "observability": "Observability",
          "architecture": "Architecture", "ai": "AI systems", "azure": "Azure", "aws": "AWS",
          "gcp": "Google Cloud"}

# Ids two areas both catalogued: the area that keeps it (the others list it as an overlap).
OWNERS = {
    "backpressure": "messaging", "bastion-host": "networking", "blast-radius": "reliability",
    "cdn": "networking", "consistent-hashing": "data",
    "control-plane-vs-data-plane": "fundamentals", "durability-vs-availability": "reliability",
    "expand-contract-migration": "data", "hedged-requests": "scaling",
    "idempotency-key": "reliability", "latency-percentiles": "observability",
    "load-shedding": "scaling", "n-plus-one-queries": "data",
    "network-segmentation": "security", "policy-as-code": "security",
    "service-discovery": "networking", "split-brain": "data", "stream-windowing": "messaging",
}

# Different ids for the same concept: the id dropped → the id kept (found in review).
SAME_AS = {
    "queue-based-load-leveling": "queue-load-levelling",
    "merge-queue": "git-merge-queue",
    "semantic-versioning": "git-semantic-versioning",
    "overload-and-goodput": "overload",
    "mutual-tls": "mtls",
    "latency-bandwidth-throughput": "latency-vs-throughput",
    "cors": "cors-same-origin-policy",
    "zero-trust-network-access": "ztna-vs-vpn",
    "certificate-chain-of-trust": "pki-chain-of-trust",
    "critical-path-analysis": "critical-path",
    "vector-database": "vector-search",
    "connection-pooling": "database-connection-pooling",
    "replication-is-not-backup": "backup-vs-replication",
    "rest-graphql-grpc": "api-styles",
    "watermarks-late-data": "watermarks",
    "k8s-service-mesh": "service-mesh",
}

def cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]

def read(area):
    path = ROOT / "catalog" / f"{area}.md"
    if not path.exists():
        return None
    rows, group, inside = [], None, False
    for line in path.read_text().splitlines():
        if line.startswith("## "):
            inside = re.sub(r"^##\s+(\d+\.\s*)?", "", line).strip() == "Catalog"
            continue
        if not inside:
            continue
        if line.startswith("### "):
            group = re.sub(r"^###\s+([\d.]+\s*)?", "", line).strip()
            continue
        if line.startswith("|") and not re.match(r"^\|\s*-", line):
            c = cells(line)
            if len(c) < 7 or c[0].lower() == "id" or not re.fullmatch(r"`?[a-z0-9-]+`?", c[0]):
                continue
            ident = c[0].strip("`")
            rows.append(dict(id=ident, title=c[1], tier=c[2], platform=c[3].strip("`"),
                             what=c[4], aha=c[5], confused=c[6], group=group, area=area))
    return rows

def main():
    all_rows, by_id = [], collections.defaultdict(list)
    missing = []
    for area in AREAS:
        rows = read(area)
        if rows is None:
            missing.append(area)
            continue
        for r in rows:
            by_id[r["id"]].append(area)
        all_rows += [r for r in rows
                     if OWNERS.get(r["id"], area) == area and r["id"] not in SAME_AS]
    dupes = {k: v for k, v in by_id.items() if len(v) > 1 and k not in OWNERS}
    merged = {k: v for k, v in by_id.items() if len(v) > 1 and k in OWNERS}
    tiers = collections.Counter(r["tier"] for r in all_rows)
    print(f"{len(all_rows)} concepts in {len(AREAS) - len(missing)} areas; missing: {missing}")
    print("by tier:", dict(sorted(tiers.items())))
    for area in AREAS:
        n = sum(1 for r in all_rows if r["area"] == area)
        if n:
            t = collections.Counter(r["tier"] for r in all_rows if r["area"] == area)
            print(f"  {area:14} {n:4}  " + " ".join(f"t{k}:{v}" for k, v in sorted(t.items())))
    bad = [r["id"] for r in all_rows if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", r["id"])]
    if bad:
        print("bad ids:", bad)
    if dupes:
        print("duplicate ids:")
        for k, v in sorted(dupes.items()):
            print(f"  {k}: {v}")
    if "--write" in sys.argv:
        out = ["# Concept catalog", "",
               "Every concept from the area catalogs in `catalog/`, generated by "
               "`tools/catalog.py --write`. Tier 1 is essential, 2 important, 3 advanced.", ""]
        out.append(f"**{len(all_rows)} concepts**: " + ", ".join(
            f"{tiers[t]} tier {t}" for t in sorted(tiers)) + ".")
        out += ["", "Ids more than one area catalogued are kept by one (the others list them as "
                "overlaps): " + "; ".join(f"`{k}` → {LABELS[OWNERS[k]]}" for k in sorted(merged)) + ". The same concept under two ids is kept once: " + "; ".join(
            f"`{k}` → `{v}`" for k, v in sorted(SAME_AS.items())) + ".", ""]
        for area in AREAS:
            rows = [r for r in all_rows if r["area"] == area]
            if not rows:
                continue
            out += [f"## {LABELS[area]} ({len(rows)})", ""]
            group = None
            for r in rows:
                if r["group"] != group:
                    group = r["group"]
                    out += ["", f"**{group}**", "", "| id | Concept | Tier | Platform |",
                            "| -- | ------- | ---- | -------- |"]
                out.append(f"| `{r['id']}` | {r['title']} | {r['tier']} | {r['platform']} |")
            out.append("")
        (ROOT / "CATALOG.md").write_text("\n".join(out) + "\n")
        print("wrote CATALOG.md")

main()
