import { describe, expect, it } from "vitest";
import { parseEnv } from "@/server/env";

const SECRET = "x".repeat(32);

describe("server environment", () => {
  it("runs with no configuration on a developer's machine", () => {
    const env = parseEnv({ NODE_ENV: "development" });
    expect(env.local).toBe(true);
    expect(env.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("treats KEY= lines (as in .env.example) as not set", () => {
    const env = parseEnv({ NODE_ENV: "development", BETTER_AUTH_SECRET: "", RESEND_API_KEY: " " });
    expect(env.local).toBe(true);
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("is not local in production, or when served from a real host", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow("BETTER_AUTH_SECRET");
    expect(() =>
      parseEnv({ NODE_ENV: "development", APP_URL: "https://staging.example.com" }),
    ).toThrow("BETTER_AUTH_SECRET");
  });

  it("refuses to start without an email key outside local development", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        APP_URL: "https://mogram.app",
        BETTER_AUTH_SECRET: SECRET,
      }),
    ).toThrow("RESEND_API_KEY");
    const env = parseEnv({
      NODE_ENV: "production",
      APP_URL: "https://mogram.app",
      BETTER_AUTH_SECRET: SECRET,
      RESEND_API_KEY: "re_test",
    });
    expect(env.local).toBe(false);
  });
});
