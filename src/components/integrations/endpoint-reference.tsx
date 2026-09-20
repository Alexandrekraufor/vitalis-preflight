import { CodeSample } from "@/components/ui/code-sample";

import type { EndpointAccess, RestEndpoint } from "./rest-endpoint-catalog";

const METHOD_CLASS: Readonly<Record<"GET" | "POST", string>> = {
  GET: "bg-accent-soft text-accent",
  POST: "bg-brand-soft text-brand",
};

const ACCESS_LABEL: Readonly<Record<EndpointAccess, string>> = {
  API_KEY: "Bearer VITALIS_API_KEY",
  SESSION: "Cookie de sessão",
  PUBLIC: "Sem credencial",
};

const ACCESS_CLASS: Readonly<Record<EndpointAccess, string>> = {
  API_KEY: "bg-warn-soft text-warn",
  SESSION: "bg-review-soft text-review",
  PUBLIC: "bg-canvas text-ink-muted",
};

export function MethodBadge({ method }: { readonly method: "GET" | "POST" }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold ${METHOD_CLASS[method]}`}
    >
      {method}
    </span>
  );
}

export function AccessBadge({ access }: { readonly access: EndpointAccess }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${ACCESS_CLASS[access]}`}
    >
      {ACCESS_LABEL[access]}
    </span>
  );
}

/** One line in the compact endpoint index shown on the Integrações screen. */
export function EndpointRow({ endpoint }: { readonly endpoint: RestEndpoint }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-border-subtle px-5 py-3.5 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <MethodBadge method={endpoint.method} />
        <code className="font-mono text-sm text-ink">{endpoint.path}</code>
        <AccessBadge access={endpoint.access} />
      </div>
      <p className="text-sm text-ink-muted">{endpoint.summary}</p>
    </div>
  );
}

/** The full reference entry: what it does, what it takes, what comes back. */
export function EndpointReference({ endpoint }: { readonly endpoint: RestEndpoint }) {
  return (
    <section
      id={endpoint.id}
      className="scroll-mt-24 rounded-[var(--radius-card)] border border-border-subtle bg-surface"
    >
      <header className="border-b border-border-subtle px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={endpoint.method} />
          <code className="font-mono text-sm font-semibold text-ink">{endpoint.path}</code>
          <AccessBadge access={endpoint.access} />
        </div>
        <p className="mt-2 text-sm font-medium text-ink">{endpoint.summary}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{endpoint.detail}</p>
      </header>

      <div className="flex flex-col gap-5 px-5 py-4">
        {endpoint.parameters.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Parâmetros
            </h4>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th className="py-1.5 pr-3 font-medium">Nome</th>
                  <th className="py-1.5 pr-3 font-medium">Tipo</th>
                  <th className="py-1.5 pr-3 font-medium">Obrigatório</th>
                  <th className="py-1.5 font-medium">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.parameters.map((parameter) => (
                  <tr key={parameter.name} className="border-t border-border-subtle align-top">
                    <td className="py-2 pr-3 font-mono text-xs text-ink">{parameter.name}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-ink-muted">{parameter.type}</td>
                    <td className="py-2 pr-3 text-xs text-ink-muted">
                      {parameter.required ? "sim" : "não"}
                    </td>
                    <td className="py-2 text-sm text-ink-muted">{parameter.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Respostas
          </h4>
          <ul className="mt-2 flex flex-col gap-1.5">
            {endpoint.statuses.map((status) => (
              <li key={status.code} className="flex gap-2.5 text-sm">
                <span className="numeric w-9 shrink-0 font-mono text-xs font-semibold text-ink">
                  {status.code}
                </span>
                <span className="text-ink-muted">{status.meaning}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs text-ink-muted">Limite: {endpoint.rateLimit}</p>
        </div>

        {endpoint.request !== undefined && (
          <CodeSample caption="Requisição" code={endpoint.request} />
        )}
        <CodeSample caption="Resposta" language="json" code={endpoint.response} />
      </div>
    </section>
  );
}
