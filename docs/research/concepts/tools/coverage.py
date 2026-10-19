"""Which catalog concepts have a plan, and how far review has got. python3 tools/coverage.py"""
import pathlib, re, collections
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / "tools" / "catalog.py").read_text().replace("\nmain()\n", "\n")
ns = {"__file__": str(ROOT / "tools" / "catalog.py")}
exec(compile(src, "catalog", "exec"), ns)

plans = {}
for path in sorted((ROOT / "plans").glob("*.part*.md")):
    if path.name.endswith(".review.md"):
        continue
    for block in re.split(r"\n(?=### )", path.read_text()):
        m = re.match(r"### .*\(`([a-z0-9-]+)`\)[ \t]*(?:\n|$)", block)
        if m:
            verdict = re.search(r"\*\*Review\*\*:?\s*(Keep|Improved|Rethought|Merged)", block)
            plans.setdefault(m.group(1), []).append((path.name, verdict.group(1) if verdict else None))

missing, by_area = [], collections.defaultdict(lambda: collections.Counter())
for area in ns["AREAS"]:
    for r in ns["read"](area) or []:
        owner = ns["OWNERS"].get(r["id"], area)
        if owner != area or r["id"] in ns["SAME_AS"]:
            continue
        got = plans.get(r["id"])
        if not got:
            missing.append((area, r["id"]))
            by_area[area]["missing"] += 1
            continue
        mine = [v for f, v in got if f.startswith(area + ".")] or [v for f, v in got]
        by_area[area]["planned"] += 1
        by_area[area][mine[0] or "unreviewed"] += 1
for area, c in by_area.items():
    print(f"{area:14} " + " ".join(f"{k}:{v}" for k, v in sorted(c.items())))
print("missing plans:", len(missing))
for a, i in missing[:60]:
    print("  ", a, i)
