import type { Endpoint } from "../model/types";

/**
 * `aks.web` → element `aks` and what follows the dot; `web_vm` → element `web_vm`. Whether what
 * follows is a port (the element opens a nested diagram) or a part (it has parts, D-104) is only
 * known once the diagram is read: `parseEndpoint` calls it a port, and the reader moves it.
 */
export function parseEndpoint(raw: string): Endpoint {
  const index = raw.indexOf(".");
  if (index === -1) return { element: raw, port: null, part: null };
  return { element: raw.slice(0, index), port: raw.slice(index + 1), part: null };
}

export function endpointToString(endpoint: Endpoint): string {
  const after = endpoint.part ?? endpoint.port;
  return after === null ? endpoint.element : `${endpoint.element}.${after}`;
}
