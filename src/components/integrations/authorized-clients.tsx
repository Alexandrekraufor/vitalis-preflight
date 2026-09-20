"use client";

import { Bot } from "lucide-react";
import { useActionState } from "react";

import { revokeClientAccessAction } from "@/app/(dashboard)/configuracoes/chaves/actions";
import { INITIAL_CREDENTIAL_STATE } from "@/app/(dashboard)/configuracoes/chaves/credential-state";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { OAuthClient } from "@/domain/access/oauth";

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(value);
}

/**
 * Applications the signed-in person approved through the consent screen.
 *
 * Revoking here kills every token that application holds for this person, so
 * the agent stops working on its next call and has to ask again.
 */
export function AuthorizedClients({ clients }: { readonly clients: readonly OAuthClient[] }) {
  const [state, revoke] = useActionState(revokeClientAccessAction, INITIAL_CREDENTIAL_STATE);

  return (
    <Card>
      <CardHeader
        title="Aplicativos autorizados"
        description="Clientes MCP que você aprovou pelo fluxo de autorização, agindo em seu nome."
      />

      {clients.length === 0 ? (
        <EmptyState
          title="Nenhum aplicativo autorizado"
          description="Cole a URL do servidor MCP no seu cliente de IA: ele vai pedir autorização aqui."
        />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {clients.map((client) => (
            <li key={client.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Bot aria-hidden className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    {client.name}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    registrado em {formatDate(client.createdAt)}
                  </span>
                </span>
              </span>

              <form action={revoke}>
                <input type="hidden" name="clientId" value={client.id} />
                <button
                  type="submit"
                  className="text-sm font-medium text-danger underline-offset-2 hover:underline"
                >
                  Revogar acesso
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {(state.error !== null || state.notice !== null) && (
        <CardBody>
          <p className={`text-sm ${state.error !== null ? "text-danger" : "text-ready"}`}>
            {state.error ?? state.notice}
          </p>
        </CardBody>
      )}
    </Card>
  );
}
