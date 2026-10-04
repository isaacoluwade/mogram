import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
import { getDb } from "../db/client";
import { schema } from "../db/schema";
import { sendEmail } from "../email/mailer";
import { signInCodeEmail } from "../email/templates";
import { env } from "../env";

/**
 * Accounts (AC-3, D-6): email one-time codes, like Eden's "enter your email, then the code".
 * Codes are stored hashed, expire after 10 minutes, allow 5 attempts, and sending is rate limited.
 */
async function createAuth() {
  const config = env();
  const db = await getDb();
  return betterAuth({
    appName: "Mogram",
    baseURL: config.APP_URL,
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [config.APP_URL],
    database: drizzleAdapter(db, { provider: "pg", schema }),
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      enabled: config.NODE_ENV !== "test",
      window: 60,
      max: 60,
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: 5 },
        "/sign-in/email-otp": { window: 60, max: 10 },
        // Every page reads the session to know who is signed in. It is cheap (cookie cache) and
        // reveals nothing, and the overall limit would otherwise lock out an office sharing an IP.
        "/get-session": false,
      },
    },
    advanced: {
      cookiePrefix: "mogram",
      useSecureCookies: config.APP_URL.startsWith("https://"),
      // Rate limits key on the client IP, so only trust the header the deployment's proxy sets.
      // Without one, IP limits are off and the per-email throttle (handler.ts) still applies.
      ipAddress: {
        ...(config.TRUSTED_IP_HEADER !== undefined
          ? { ipAddressHeaders: [config.TRUSTED_IP_HEADER] }
          : {}),
        ...(config.TRUSTED_PROXIES !== undefined
          ? {
              trustedProxies: config.TRUSTED_PROXIES.split(",")
                .map((cidr) => cidr.trim())
                .filter((cidr) => cidr.length > 0),
            }
          : {}),
        disableIpTracking:
          !config.local &&
          config.TRUSTED_IP_HEADER === undefined &&
          config.TRUSTED_PROXIES === undefined,
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        allowedAttempts: 5,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp }) {
          await sendEmail(signInCodeEmail(email, otp));
        },
      }),
    ],
  });
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;

const holder = ((
  globalThis as { __mogramAuth?: { promise: Promise<Auth> | null } }
).__mogramAuth ??= {
  promise: null,
});

export function getAuth(): Promise<Auth> {
  holder.promise ??= createAuth().catch((error: unknown) => {
    holder.promise = null;
    throw error;
  });
  return holder.promise;
}
