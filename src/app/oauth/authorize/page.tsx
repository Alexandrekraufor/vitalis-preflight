import { CircleCheck, ShieldCheck, TriangleAlert } from "lucide-react";

import {
  beginAuthorization,
  type AuthorizationFailure,
} from "@/application/access/oauth-authorization.use-case";
import { MCP_SCOPE } from "@/domain/access/oauth";
import { requireUser } from "@/infrastructure/auth/guards";
import { oauthDependencies } from "@/infrastructure/auth/oauth-secrets";
import { appServices } from "@/infrastructure/composition-root";
import { mcpToolCatalog } from "@/mcp/tool-catalog";

import { approveConsentAction, denyConsentAction } from "./consent-actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Autorizar acesso" };

const FAILURE_MESSAGE: Readonly<Record<AuthorizationFailure, string>> = {
  UNKNOWN_CLIENT: "O aplicativo que pediu acesso não está registrado neste servidor.",
  INVALID_REDIRECT_URI:
    "O endereço de retorno não confere com o que o aplicativo registrou. O pedido foi recusado.",
  UNSUPPORTED_RESPONSE_TYPE: "Este servidor só aceita o fluxo de código de autorização.",
  PKCE_REQUIRED:
    "O aplicativo não enviou a prova de posse exigida (PKCE com S256). Atualize o cliente.",
  RESOURCE_MISMATCH: "O pedido é para outro servidor, não para este.",
};

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value.at(0) ?? null;
  return value ?? null;
}

function Shell({ children }: { readonly children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-lg rounded-[var(--radius-card)] border border-border-subtle bg-surface p-6 shadow-premium">
        {children}
      </div>
    </main>
  );
}

/**
 * The consent screen.
 *
 * This is the only place a person grants an agent access to clinic data, so it
 * says three things plainly: who is asking, what they will be able to do, and
 * what they will not. The parameters were validated before this rendered, and
 * the form carries only an opaque id.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) => {
      const single_ = single(value);
      return single_ === null ? [] : [[key, single_] as [string, string]];
    }),
  );

  const services = await appServices();
  const user = await requireUser(services.access, `/oauth/authorize?${query.toString()}`);

  const outcome = await beginAuthorization(
    {
      clientId: single(params["client_id"]) ?? "",
      redirectUri: single(params["redirect_uri"]) ?? "",
      responseType: single(params["response_type"]) ?? "",
      codeChallenge: single(params["code_challenge"]),
      codeChallengeMethod: single(params["code_challenge_method"]),
      scope: single(params["scope"]),
      state: single(params["state"]),
      resource: single(params["resource"]),
    },
    user,
    oauthDependencies(services),
  );

  if (!outcome.ok) {
    return (
      <Shell>
        <TriangleAlert aria-hidden className="size-6 text-warn" />
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-ink">
          Não foi possível autorizar
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {FAILURE_MESSAGE[outcome.error]}
        </p>
        <p className="mt-4 text-xs text-ink-faint">
          Nada foi concedido e nenhum dado foi compartilhado.
        </p>
      </Shell>
    );
  }

  const request = outcome.value;
  const tools = mcpToolCatalog(services);

  return (
    <Shell>
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-white">
        <ShieldCheck aria-hidden className="size-5" />
      </span>

      <h1 className="mt-4 text-lg font-semibold tracking-tight text-ink">
        {request.clientName} quer acessar o Vitalis Preflight
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        Autorizando, este aplicativo passa a consultar dados da clínica em seu nome,{" "}
        {user.name}. Você pode revogar quando quiser em Configurações.
      </p>

      <div className="mt-5 rounded-lg border border-border-subtle bg-canvas p-4">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
          O que ele vai poder fazer
        </p>
        <ul className="mt-2.5 flex flex-col gap-2">
          {tools.map((tool) => (
            <li key={tool.name} className="flex items-start gap-2 text-sm text-ink">
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-ready" />
              <span>
                <span className="font-medium">{tool.title}</span>
                <span className="block text-xs text-ink-muted">
                  somente leitura, sem alterar nenhuma guia
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3.5 border-t border-border-subtle pt-3 text-xs leading-relaxed text-ink-muted">
          Ele <strong className="font-semibold text-ink">não</strong> pode criar, corrigir,
          aprovar ou excluir guias, importar arquivos, mexer na equipe nem ver senhas. O escopo
          concedido é <code className="font-mono">{MCP_SCOPE}</code>.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <form action={approveConsentAction}>
          <input type="hidden" name="requestId" value={request.id} />
          <button
            type="submit"
            className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            Autorizar acesso
          </button>
        </form>

        <form action={denyConsentAction}>
          <input type="hidden" name="requestId" value={request.id} />
          <button
            type="submit"
            className="h-10 rounded-lg border border-border-subtle px-4 text-sm font-medium text-ink transition-colors hover:border-border-strong"
          >
            Recusar
          </button>
        </form>
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        Retorno para <code className="font-mono">{request.redirectUri}</code>
      </p>
    </Shell>
  );
}
