import { handleAuthRequest } from "@/server/auth/handler";

// Better Auth serves sign-in codes, sessions and sign-out behind Mogram's allowlist and throttle.
export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
