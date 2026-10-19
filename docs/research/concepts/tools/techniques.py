"""Counts the techniques the plans use (from each plan's **Techniques** line), overall and per
area, and lists techniques outside the README's vocabulary. python3 tools/techniques.py"""
import pathlib, re, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOCAB = ["appear / disappear", "move", "clone", "restyle", "token", "stream", "exchange",
         "contents", "layers", "lanes", "meter", "chart", "timer", "spotlight", "path trace",
         "caption", "side by side", "toggle", "zoom", "boundary", "failure", "choice", "dial"]
ALIASES = {"appear/disappear": "appear / disappear", "appear": "appear / disappear",
           "disappear": "appear / disappear", "side-by-side": "side by side",
           "path-trace": "path trace"}

def plans():
    for path in sorted((ROOT / "plans").glob("*.md")):
        area = path.name.split(".")[0]
        text = path.read_text()
        for block in re.split(r"\n(?=### )", text):
            m = re.match(r"### (.*)\(`([a-z0-9-]+)`\)[ \t]*(?:\n|$)", block)
            if not m:
                continue
            t = re.search(r"\*\*Techniques\*\*:?\s*(.+)", block, re.I)
            used = set()
            if t:
                for part in re.split(r"[,;]", t.group(1)):
                    name = re.sub(r"\(.*?\)|\*|`|\.$", "", part).strip().lower()
                    name = ALIASES.get(name, name)
                    if name:
                        used.add(name)
            yield area, m.group(2), used

def main():
    overall = collections.Counter()
    per_area = collections.defaultdict(collections.Counter)
    count = collections.Counter()
    for area, ident, used in plans():
        count[area] += 1
        for u in used:
            overall[u] += 1
            per_area[area][u] += 1
    total = sum(count.values())
    print(f"{total} plans: " + ", ".join(f"{a} {n}" for a, n in sorted(count.items())))
    for name, n in overall.most_common():
        mark = "" if name in VOCAB else "   (new)"
        print(f"  {n:5}  {100 * n / total:5.1f}%  {name}{mark}")

main()
