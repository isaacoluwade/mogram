import type { Endpoint } from "../model/types";

/** `aks.web` → element `aks`, port `web`; `web_vm` → element `web_vm`. */
export function parseEndpoint(raw: string): Endpoint {
  const index = raw.indexOf(".");
  if (index === -1) return { element: raw, port: null };
  return { element: raw.slice(0, index), port: raw.slice(index + 1) };
}

export function endpointToString(endpoint: Endpoint): string {
  return endpoint.port === null ? endpoint.element : `${endpoint.element}.${endpoint.port}`;
}
