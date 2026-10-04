/** Minimal binary min-heap keyed by a numeric priority. */
export class MinHeap<T> {
  private readonly items: { priority: number; value: T }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(value: T, priority: number): void {
    const items = this.items;
    items.push({ priority, value });
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      const a = items[parent];
      const b = items[index];
      if (a === undefined || b === undefined || a.priority <= b.priority) break;
      items[parent] = b;
      items[index] = a;
      index = parent;
    }
  }

  pop(): T | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (top === undefined || last === undefined) return undefined;
    if (items.length > 0) {
      items[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        const current = items[smallest];
        const l = items[left];
        const r = items[right];
        if (l !== undefined && current !== undefined && l.priority < current.priority)
          smallest = left;
        const best = items[smallest];
        if (r !== undefined && best !== undefined && r.priority < best.priority) smallest = right;
        if (smallest === index) break;
        const swap = items[smallest];
        if (swap === undefined || current === undefined) break;
        items[smallest] = current;
        items[index] = swap;
        index = smallest;
      }
    }
    return top.value;
  }
}
