"use client";

import { KeyRound, TriangleAlert } from "lucide-react";
import { useActionState } from "react";

import {
  issueCredentialAction,
  revokeCredentialAction,
} from "@/app/(dashboard)/configuracoes/chaves/actions";
import {
  INITIAL_CREDENTIAL_STATE,
  type CredentialActionState,
} from "@/app/(dashboard)/configuracoes/chaves/credential-state";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CodeSample } from "@/components/ui/code-sample";
import { DataTable, TableCell, TableHead, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  API_SCOPES,
  API_SURFACES,
  apiScopeLabel,
  apiSurfaceLabel,
  type ApiCredential,
} from "@/domain/access/api-credential";

const INPUT_CLASS =
  "h-10 w-full rounded-md border border-border-subtle bg-surface px-3 text-sm text-ink outline-none transition-colors focus-visible:border-brand";

function formatDate(value: Date | null): string {
  return value === null
    ? "-"
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
        value,
      );
}

function Message({ state }: { readonly state: CredentialActionState }) {
  if (state.error !== null) {
    return (
      <p className="flex items-center gap-2 text-sm text-danger">
        <TriangleAlert aria-hidden className="size-4 shrink-0" />
        {state.error}
      </p>
    );
  }

  if (state.notice !== null) {
    return <p className="text-sm text-ready">{state.notice}</p>;
  }

  return null;
}

/**
 * Issuing and revoking machine credentials.
 *
 * The secret is rendered exactly once, in the response of the action that
 * created it: the server keeps only a digest, so a reload cannot show it again
 * and neither can this component.
 */
export function CredentialManagement({
  credentials,
}: {
  readonly credentials: readonly ApiCredential[];
}) {
  const [issueState, issue] = useActionState(issueCredentialAction, INITIAL_CREDENTIAL_STATE);
  const [revokeState, revoke] = useActionState(
    revokeCredentialAction,
    INITIAL_CREDENTIAL_STATE,
  );

  return (
    <>
      <Card>
        <CardHeader
          title="Criar chave"
          description="A chave aparece uma única vez, no momento em que é criada. Guarde-a onde o integrador vai lê-la."
        />
        <CardBody className="flex flex-col gap-4">
          {/* One grid row, so the two fields and the button sit on the same
              baseline; the hint lives under the grid instead of stretching one
              column and pushing its neighbours out of line. */}
          <form action={issue} className="flex flex-col gap-2">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
              <Field label="Para que serve" htmlFor="credential-name">
                <input
                  id="credential-name"
                  type="text"
                  name="name"
                  required
                  maxLength={60}
                  placeholder="Sistema de gestão da recepção"
                  className={INPUT_CLASS}
                />
              </Field>

              <Field label="Superfície" htmlFor="credential-surface">
                <select
                  id="credential-surface"
                  name="surface"
                  defaultValue="REST"
                  className={INPUT_CLASS}
                >
                  {API_SURFACES.map((surface) => (
                    <option key={surface} value={surface}>
                      {apiSurfaceLabel(surface)}
                    </option>
                  ))}
                </select>
              </Field>

              <SubmitButton pendingLabel="Criando…">Criar chave</SubmitButton>
            </div>

            <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <legend className="sr-only">Permissões</legend>
              <span className="text-sm font-medium text-ink">Permissões</span>
              {API_SCOPES.map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="scopes"
                    value={scope}
                    defaultChecked={scope === "READ"}
                    className="size-4 rounded border-border-subtle"
                  />
                  {apiScopeLabel(scope)}
                  <span className="text-xs text-ink-muted">
                    {scope === "READ" ? "consultar guias e relatórios" : "injetar guias"}
                  </span>
                </label>
              ))}
            </fieldset>

            <p className="text-xs text-ink-muted">
              O nome aparece na lista e no registro de auditoria.
            </p>
          </form>

          <Message state={issueState} />

          {issueState.issuedToken !== null && (
            <div className="flex flex-col gap-2 rounded-lg border border-warn/30 bg-warn-soft p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <KeyRound aria-hidden className="size-4 text-warn" />
                {issueState.issuedName}
              </p>
              <p className="text-sm text-ink-muted">
                Esta é a única vez que a chave aparece. Se perdê-la, revogue e crie outra.
              </p>
              <CodeSample caption="Chave" code={issueState.issuedToken} />
              <CodeSample
                caption="Como usar"
                code={`Authorization: Bearer ${issueState.issuedToken}`}
              />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Chaves emitidas"
          description="Guardadas como digest: nem o sistema consegue mostrar o valor de novo."
        />

        {credentials.length === 0 ? (
          <EmptyState
            title="Nenhuma chave criada"
            description="Crie a primeira chave acima para liberar a API ou o MCP."
          />
        ) : (
          <DataTable>
            <TableHead
              columns={[
                "Nome",
                "Superfície",
                "Permissões",
                "Início",
                "Criada em",
                "Último uso",
                "Situação",
                "",
              ]}
            />
            <tbody>
              {credentials.map((credential) => (
                <TableRow key={credential.id}>
                  <TableCell className="font-medium">{credential.name}</TableCell>
                  <TableCell className="whitespace-nowrap text-ink-muted">
                    {apiSurfaceLabel(credential.surface)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-ink-muted">
                    {credential.scopes.map(apiScopeLabel).join(" e ")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-ink-muted">
                    {credential.hint}…
                  </TableCell>
                  <TableCell className="numeric whitespace-nowrap text-ink-muted">
                    {formatDate(credential.createdAt)}
                  </TableCell>
                  <TableCell className="numeric whitespace-nowrap text-ink-muted">
                    {formatDate(credential.lastUsedAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {credential.revokedAt === null ? (
                      <span className="rounded-full bg-ready-soft px-2 py-0.5 text-xs font-medium text-ready">
                        ativa
                      </span>
                    ) : (
                      <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink-muted">
                        revogada
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {credential.revokedAt === null && (
                      <form action={revoke}>
                        <input type="hidden" name="credentialId" value={credential.id} />
                        <button
                          type="submit"
                          className="text-sm font-medium text-danger underline-offset-2 hover:underline"
                        >
                          Revogar
                        </button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </DataTable>
        )}

        {(revokeState.error !== null || revokeState.notice !== null) && (
          <CardBody>
            <Message state={revokeState} />
          </CardBody>
        )}
      </Card>
    </>
  );
}
