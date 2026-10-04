"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoGlyph } from "@/components/ui/logo";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

type Step = "email" | "code";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 30;

type Failure = { status?: number | undefined; message?: string | undefined };

const OFFLINE = "Couldn't reach Mogram. Check your connection and try again.";

function friendly(error: Failure | null | undefined, fallback: string): string {
  if (error == null) return fallback;
  // Both the per-client and the per-address limits answer 429; the longer one lasts 15 minutes.
  if (error.status === 429) return "Too many tries. Wait a few minutes, then try again.";
  return error.message !== undefined && error.message.length > 0 ? error.message : fallback;
}

/**
 * Sign in or sign up in one flow (D-6), in Eden's "Enter the garden" style: a big borderless
 * email field and a pill button, then a six-digit code from email. No passwords.
 */
export function SignInForm({ next, showDevMailbox }: { next: string; showDevMailbox: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeInput = useRef<HTMLInputElement | null>(null);
  const valid = EMAIL.test(email.trim());

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    let failure: Failure | null;
    try {
      ({ error: failure } = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(),
        type: "sign-in",
      }));
    } catch {
      setPending(false);
      setError(OFFLINE);
      return;
    }
    setPending(false);
    if (failure !== null) {
      setError(friendly(failure, "The code couldn't be sent. Check the address and try again."));
      return;
    }
    setCode("");
    setStep("code");
    setResendIn(RESEND_SECONDS);
  };

  const verify = async (value: string) => {
    if (value.length !== 6 || pending) return;
    setPending(true);
    setError(null);
    let failure: Failure | null;
    try {
      ({ error: failure } = await authClient.signIn.emailOtp({
        email: email.trim().toLowerCase(),
        otp: value,
      }));
    } catch {
      setPending(false);
      setError(OFFLINE);
      return;
    }
    if (failure !== null) {
      setPending(false);
      setCode("");
      setError(friendly(failure, "That code didn't work. Check it, or send a new one."));
      codeInput.current?.focus();
      return;
    }
    router.replace(next as Parameters<typeof router.replace>[0]);
    router.refresh();
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-backdrop px-6 py-16">
      <div aria-hidden className="bg-grain pointer-events-none absolute inset-0" />
      <div className="relative flex w-full max-w-[400px] flex-col items-center text-center animate-reveal">
        <Link
          href="/"
          aria-label="Mogram home"
          className="text-fg-title transition-opacity hover:opacity-80"
        >
          <LogoGlyph className="size-9" />
        </Link>

        {step === "email" ? (
          <form
            onSubmit={(event) => void send(event)}
            className="flex w-full flex-col items-center"
            noValidate
          >
            <h1 className="mt-8 font-display text-title-lg font-semibold tracking-heading text-fg-title">
              Welcome to Mogram
            </h1>
            <p className="mt-2.5 text-body text-fg-secondary">Sign up or sign in to get started.</p>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              spellCheck={false}
              placeholder="you@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={error !== null}
              aria-describedby={error !== null ? "sign-in-error" : undefined}
              className="mt-20 w-full bg-transparent text-center text-field-xl tracking-field text-fg caret-fg outline-none placeholder:text-fg-placeholder"
            />
            <ErrorLine error={error} />
            <SubmitButton disabled={!valid} pending={pending} className="mt-16">
              Continue
            </SubmitButton>
            <button
              type="button"
              onClick={() => {
                if (!valid) {
                  setError("Enter your email first, then the code we sent to it.");
                  return;
                }
                setError(null);
                setStep("code");
              }}
              className="mt-2 inline-flex min-h-8 items-center px-2 text-fine font-semibold text-fg-quiet transition-colors hover:text-fg"
            >
              I already have a code
            </button>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verify(code);
            }}
            className="flex w-full flex-col items-center"
            noValidate
          >
            <h1 className="mt-8 font-display text-title-lg font-semibold tracking-heading text-fg-title">
              Check your email
            </h1>
            <p className="mt-2.5 text-body text-fg-secondary">
              We sent a 6-digit code to <span className="text-fg">{email.trim()}</span>
            </p>
            <label htmlFor="code" className="sr-only">
              Sign-in code
            </label>
            <input
              ref={codeInput}
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(value);
                if (value.length === 6) void verify(value);
              }}
              aria-invalid={error !== null}
              aria-describedby={error !== null ? "sign-in-error" : undefined}
              className="mt-20 w-full bg-transparent text-center font-mono text-field-xl tracking-[0.4em] text-fg caret-fg outline-none placeholder:text-fg-placeholder"
            />
            <ErrorLine error={error} />
            <SubmitButton disabled={code.length !== 6} pending={pending} className="mt-16">
              Sign in
            </SubmitButton>
            <div className="mt-2 flex items-center gap-2 text-fine font-semibold">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
                className="inline-flex min-h-8 items-center gap-1 px-2 text-fg-quiet transition-colors hover:text-fg"
              >
                <ArrowLeft className="size-3.5" />
                Change email
              </button>
              <span aria-hidden className="text-fg-ghost">
                ·
              </span>
              <button
                type="button"
                disabled={resendIn > 0 || pending}
                onClick={() => void send()}
                className="inline-flex min-h-8 items-center px-2 text-fg-quiet transition-colors hover:text-fg disabled:text-fg-ghost"
              >
                {resendIn > 0 ? `Send again in ${resendIn}s` : "Send a new code"}
              </button>
            </div>
            {showDevMailbox ? (
              <p className="mt-5 text-caption text-fg-muted">
                Running locally: codes are printed in the server log and at{" "}
                <a
                  href={`/api/dev/mailbox?to=${encodeURIComponent(email.trim().toLowerCase())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-fg-soft"
                >
                  the dev mailbox
                </a>
                .
              </p>
            ) : null}
          </form>
        )}

        {step === "email" ? (
          <Link
            href="/diagrams"
            className="mt-6 text-label text-fg-secondary underline decoration-border-emphasis underline-offset-2 transition-colors hover:text-fg"
          >
            Continue without an account
          </Link>
        ) : null}
        <p className="mt-5 text-footnote text-fg-quiet">
          By signing in, you agree to how we{" "}
          <Link
            href="/security"
            className="text-fg-secondary underline decoration-border-emphasis underline-offset-2 transition-colors hover:text-fg"
          >
            store and protect your diagrams
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return (
    <p
      id="sign-in-error"
      role="alert"
      aria-live="polite"
      className={cn("mt-3 min-h-5 text-label text-rose", error === null && "invisible")}
    >
      {error}
    </p>
  );
}

/** Eden's pill: white when ready; until then the same pill, dimmed right down. */
function SubmitButton({
  disabled,
  pending,
  className,
  children,
}: {
  disabled: boolean;
  pending: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="submit"
      variant="primary"
      size="xl"
      disabled={disabled || pending}
      className={cn(
        "h-[54px] w-full max-w-[340px] text-pill font-semibold disabled:opacity-[0.16] disabled:shadow-none",
        className,
      )}
    >
      {pending ? "One moment…" : children}
    </Button>
  );
}
