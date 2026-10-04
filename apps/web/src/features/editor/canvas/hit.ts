/** What the pointer is over on the editor canvas: elements carry `data-element` and `data-kind`. */
export interface Hit {
  readonly name: string;
  readonly kind: string;
}

function read(node: Element): Hit {
  return {
    name: node.getAttribute("data-element") ?? "",
    kind: node.getAttribute("data-kind") ?? "",
  };
}

/**
 * The element under a pointer event. The hovered component's halo (`data-halo`, an invisible ring
 * that keeps hover alive on the way to its connect handles) sits above the diagram, so it only
 * counts where nothing drawn above that component is under the pointer: an overlapping or
 * neighbouring element on top always wins the click.
 */
export function hitAt(target: EventTarget | null, x: number, y: number): Hit | null {
  const node = target instanceof Element ? target.closest("[data-element]") : null;
  if (node === null) return null;
  if (!node.hasAttribute("data-halo")) return read(node);
  const name = node.getAttribute("data-element") ?? "";
  const root = node.closest("svg") ?? node.ownerDocument;
  const self = root.querySelector(`[data-element="${CSS.escape(name)}"]:not([data-halo])`);
  for (const candidate of node.ownerDocument.elementsFromPoint(x, y)) {
    const owner = candidate.closest("[data-element]");
    if (owner === null || owner.hasAttribute("data-halo")) continue;
    if (owner.getAttribute("data-element") === name) return read(owner);
    const above =
      self === null ||
      (self.compareDocumentPosition(owner) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    // The first real thing under the pointer is drawn below the hovered component: keep the halo.
    return above ? read(owner) : read(node);
  }
  return read(node);
}
