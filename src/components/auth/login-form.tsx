"use client";

import { useActionState } from "react";

import { loginAction } from "@/app/(auth)/login/actions";
import { INITIAL_LOGIN_STATE } from "@/app/(auth)/login/login-state";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm({ next }: { readonly next: string }) {
  const [state, formAction] = useActionState(loginAction, INITIAL_LOGIN_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <Field label="E-mail" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="h-10 w-full rounded-md border border-border-subtle bg-surface px-3 text-sm text-ink outline-none transition-colors focus-visible:border-accent"
        />
      </Field>

      <Field label="Senha" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-10 w-full rounded-md border border-border-subtle bg-surface px-3 text-sm text-ink outline-none transition-colors focus-visible:border-accent"
        />
      </Field>

      {state.error !== null && (
        <p
          role="alert"
          className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
    </form>
  );
}
