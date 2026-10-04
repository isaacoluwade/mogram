"use client";

import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser side of Better Auth (D-6). Same origin, so cookies flow without configuration. */
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });

export function useSession() {
  return authClient.useSession();
}
