import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "./auth";

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

/** The signed-in user for this request, or null. Deduplicated per request. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const auth = await getAuth();
  const result = await auth.api.getSession({ headers: await headers() });
  if (result === null) return null;
  return { id: result.user.id, email: result.user.email, name: result.user.name };
});

/** Same, for route handlers that receive the Request directly. */
export async function userFromRequest(request: Request): Promise<SessionUser | null> {
  const auth = await getAuth();
  const result = await auth.api.getSession({ headers: request.headers });
  if (result === null) return null;
  return { id: result.user.id, email: result.user.email, name: result.user.name };
}
