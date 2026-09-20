"use client";

import { useActionState } from "react";

import { acceptInviteAction } from "@/app/(auth)/invite/[token]/actions";
import { INITIAL_ACCEPT_STATE } from "@/app/(auth)/invite/[token]/invite-state";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

const INPUT_CLASS =
  "h-10 w-full rounded-md border border-border-subtle bg-surface px-3 text-sm text-ink outline-none transition-colors focus-visible:border-accent";

interface AcceptInviteFormProps {
  readonly token: string;
  readonly minPasswordLength: number;
}

export function AcceptInviteForm({ token, minPasswordLength }: AcceptInviteFormProps) {
  const [state, formAction] = useActionState(acceptInviteAction, INITIAL_ACCEPT_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <Field label="Seu nome" htmlFor="name">
        <input id="name" name="name" autoComplete="name" required className={INPUT_CLASS} />
      </Field>

      <Field
        label="Senha"
        htmlFor="password"
        hint={`Pelo menos ${minPasswordLength} caracteres.`}
      >
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={minPasswordLength}
          required
          className={INPUT_CLASS}
        />
      </Field>

      <Field label="Confirmar senha" htmlFor="passwordConfirmation">
        <input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          minLength={minPasswordLength}
          required
          className={INPUT_CLASS}
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

      <SubmitButton pendingLabel="Criando acesso…">Criar acesso</SubmitButton>
    </form>
  );
}
