"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authenticate } from "@/application/access/authenticate.use-case";
import { appServices } from "@/infrastructure/composition-root";
import {
  simulatePasswordVerification,
  verifyPassword,
} from "@/infrastructure/auth/password-hasher";
import {
  SESSION_LIFETIME_MS,
  sessionTokens,
  writeSessionCookie,
} from "@/infrastructure/auth/session";
import { clientKey, consumeRateLimit } from "@/lib/rate-limit";

import type { LoginState } from "./login-state";

const loginSchema = z.object({
  email: z.string().min(1).max(320),
  password: z.string().min(1).max(256),
  next: z.string().optional(),
});

/**
 * One message for every failure.
 *
 * Distinguishing "no such account" from "wrong password" — or from "account
 * disabled" — turns the login form into a directory of who works here.
 */
const GENERIC_FAILURE = "E-mail ou senha incorretos.";

/** Only same-origin paths are honoured, so `next` cannot become an open redirect. */
function safeRedirectTarget(next: string | undefined): string {
  if (next === undefined) return "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) return { error: GENERIC_FAILURE };

  const requestHeaders = await headers();
  const throttleKey = clientKey(
    new Request("http://local/login", { headers: requestHeaders }),
    "login",
  );

  // Ten attempts a minute per client is invisible to a person typing and
  // useless to someone spraying a password list.
  const throttle = consumeRateLimit(throttleKey, { limit: 10, windowMs: 60_000 });
  if (!throttle.allowed) {
    return { error: "Muitas tentativas. Aguarde um instante e tente novamente." };
  }

  const services = await appServices();

  const result = await authenticate(
    { email: parsed.data.email, password: parsed.data.password },
    {
      access: services.access,
      hasher: { verify: verifyPassword, simulateVerification: simulatePasswordVerification },
      tokens: sessionTokens,
      sessionLifetimeMs: SESSION_LIFETIME_MS,
    },
  );

  if (!result.ok) return { error: GENERIC_FAILURE };

  await writeSessionCookie(result.value.token, result.value.expiresAt);

  redirect(safeRedirectTarget(parsed.data.next));
}
