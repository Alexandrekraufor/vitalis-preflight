"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState } from "react";

import {
  deleteConventionAction,
  deleteProcedureAction,
  discardDraftAction,
  publishDraftAction,
  renameVersionAction,
  revalidateGuidesAction,
  saveConventionAction,
  saveDocumentAction,
  saveProcedureAction,
} from "@/app/(dashboard)/configuracoes/regras/actions";
import {
  INITIAL_RULE_STATE,
  type RuleActionState,
} from "@/app/(dashboard)/configuracoes/regras/rules-state";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, TableCell, TableHead, TableRow } from "@/components/ui/data-table";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  REQUIRED_FIELD_NAMES,
  requiredFieldLabel,
  type RuleDocumentJson,
} from "@/domain/conventions/rule-document";

const INPUT_CLASS =
  "h-10 w-full rounded-md border border-border-subtle bg-surface px-3 text-sm text-ink outline-none transition-colors focus-visible:border-brand";

const LABEL_CLASS = "flex flex-col gap-1.5 text-sm font-medium text-ink";

type Section = "planos" | "procedimentos" | "json";

interface RulesWorkspaceProps {
  readonly document: RuleDocumentJson;
  readonly section: Section;
  /** Name of the plan being edited, or `null` when adding a new one. */
  readonly editingConvention: string | null;
  readonly editingProcedure: string | null;
  readonly hasDraft: boolean;
}

function Message({ state }: { readonly state: RuleActionState }) {
  if (state.error !== null) {
    return (
      <p className="flex items-center gap-2 px-5 py-3 text-sm text-danger">
        <TriangleAlert aria-hidden className="size-4 shrink-0" />
        {state.error}
      </p>
    );
  }

  if (state.notice !== null) {
    return <p className="px-5 py-3 text-sm text-ready">{state.notice}</p>;
  }

  return null;
}

/**
 * The editing surface for the rule set.
 *
 * Every form posts to a Server Action that validates the whole document before
 * storing it, so a half-typed plan never becomes rules. Nothing here publishes
 * anything: edits pile up in a draft until somebody chooses to publish.
 */
export function RulesWorkspace({
  document,
  section,
  editingConvention,
  editingProcedure,
  hasDraft,
}: RulesWorkspaceProps) {
  const [conventionState, saveConvention] = useActionState(
    saveConventionAction,
    INITIAL_RULE_STATE,
  );
  const [removeConventionState, removeConvention] = useActionState(
    deleteConventionAction,
    INITIAL_RULE_STATE,
  );
  const [procedureState, saveProcedure] = useActionState(
    saveProcedureAction,
    INITIAL_RULE_STATE,
  );
  const [removeProcedureState, removeProcedure] = useActionState(
    deleteProcedureAction,
    INITIAL_RULE_STATE,
  );
  const [documentState, saveDocument] = useActionState(saveDocumentAction, INITIAL_RULE_STATE);
  const [versionState, renameVersion] = useActionState(renameVersionAction, INITIAL_RULE_STATE);
  const [draftState, draftAction] = useActionState(publishDraftAction, INITIAL_RULE_STATE);
  const [discardState, discardAction] = useActionState(discardDraftAction, INITIAL_RULE_STATE);
  const [revalidateState, revalidateAction] = useActionState(
    revalidateGuidesAction,
    INITIAL_RULE_STATE,
  );

  const convention =
    editingConvention === null
      ? null
      : (document.convenios.find((entry) => entry.nome === editingConvention) ?? null);

  const procedure =
    editingProcedure === null
      ? null
      : (document.procedimentos.find((entry) => entry.codigo === editingProcedure) ?? null);

  return (
    <>
      {hasDraft && (
        <Card>
          <CardHeader
            title="Rascunho aberto"
            description="As regras vigentes seguem valendo até você publicar."
          />
          <CardBody className="flex flex-wrap items-center gap-2.5">
            <form action={draftAction}>
              <SubmitButton pendingLabel="Publicando…">Publicar versão</SubmitButton>
            </form>
            <form action={discardAction}>
              <SubmitButton variant="secondary" pendingLabel="Descartando…">
                Descartar rascunho
              </SubmitButton>
            </form>
          </CardBody>
          <Message state={draftState} />
          <Message state={discardState} />
        </Card>
      )}

      {section === "planos" && (
        <>
          <Card>
            <CardHeader
              title={`${document.convenios.length} planos`}
              description="Cada plano define o que exige, o que cobre e em que prazo."
            />
            <DataTable>
              <TableHead
                columns={["Plano", "Campos obrigatórios", "Cobertos", "Sessões", "Prazo", ""]}
              />
              <tbody>
                {document.convenios.map((entry) => (
                  <TableRow key={entry.nome}>
                    <TableCell className="font-medium">{entry.nome}</TableCell>
                    <TableCell className="numeric text-ink-muted">
                      {entry.campos_obrigatorios.length}
                    </TableCell>
                    <TableCell className="numeric text-ink-muted">
                      {entry.procedimentos_cobertos.length}
                    </TableCell>
                    <TableCell className="numeric text-ink-muted">
                      {entry.limite_sessoes_por_autorizacao}
                    </TableCell>
                    <TableCell className="numeric whitespace-nowrap text-ink-muted">
                      {entry.prazo_envio_dias} dias
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <a
                        href={`/configuracoes/regras?secao=planos&plano=${encodeURIComponent(entry.nome)}`}
                        className="text-sm font-medium text-brand underline-offset-2 hover:underline"
                      >
                        Editar
                      </a>
                      <form action={removeConvention} className="ml-3 inline">
                        <input type="hidden" name="nome" value={entry.nome} />
                        <button
                          type="submit"
                          className="text-sm font-medium text-danger underline-offset-2 hover:underline"
                        >
                          Remover
                        </button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </DataTable>
            <Message state={removeConventionState} />
          </Card>

          <Card>
            <CardHeader
              title={convention === null ? "Novo plano" : `Editando ${convention.nome}`}
              description="Os campos obrigatórios saem da lista que o motor sabe verificar: é isso que impede salvar uma regra que o sistema não aplicaria."
            />
            <CardBody>
              <form action={saveConvention} className="flex flex-col gap-4">
                {convention !== null && (
                  <input type="hidden" name="originalName" value={convention.nome} />
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className={LABEL_CLASS}>
                    Nome do plano
                    <input
                      type="text"
                      name="nome"
                      required
                      maxLength={80}
                      defaultValue={convention?.nome ?? ""}
                      placeholder="Plano Saúde Total"
                      className={INPUT_CLASS}
                    />
                  </label>

                  <label className={LABEL_CLASS}>
                    Sessões por autorização
                    <input
                      type="number"
                      name="sessoes"
                      required
                      min={1}
                      max={1000}
                      defaultValue={convention?.limite_sessoes_por_autorizacao ?? 10}
                      className={`numeric ${INPUT_CLASS}`}
                    />
                  </label>

                  <label className={LABEL_CLASS}>
                    Validade máxima da autorização (dias)
                    <input
                      type="number"
                      name="validade"
                      required
                      min={1}
                      max={3650}
                      defaultValue={convention?.validade_maxima_autorizacao_dias ?? 30}
                      className={`numeric ${INPUT_CLASS}`}
                    />
                  </label>

                  <label className={LABEL_CLASS}>
                    Prazo de envio (dias)
                    <input
                      type="number"
                      name="prazo"
                      required
                      min={1}
                      max={3650}
                      defaultValue={convention?.prazo_envio_dias ?? 30}
                      className={`numeric ${INPUT_CLASS}`}
                    />
                  </label>
                </div>

                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium text-ink">Campos obrigatórios</legend>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {REQUIRED_FIELD_NAMES.map((field) => (
                      <label key={field} className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          name="campos"
                          value={field}
                          defaultChecked={
                            convention?.campos_obrigatorios.includes(field) ?? false
                          }
                          className="size-4 rounded border-border-subtle"
                        />
                        {requiredFieldLabel(field)}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium text-ink">
                    Procedimentos cobertos
                  </legend>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {document.procedimentos.map((entry) => (
                      <label
                        key={entry.codigo}
                        className="flex items-center gap-2 text-sm text-ink"
                      >
                        <input
                          type="checkbox"
                          name="cobertos"
                          value={entry.codigo}
                          defaultChecked={
                            convention?.procedimentos_cobertos.includes(entry.codigo) ?? false
                          }
                          className="size-4 rounded border-border-subtle"
                        />
                        <span className="numeric font-mono text-xs">{entry.codigo}</span>
                        <span className="text-ink-muted">{entry.descricao}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className={LABEL_CLASS}>
                  Observação da regra
                  <textarea
                    name="observacao"
                    required
                    maxLength={600}
                    rows={3}
                    defaultValue={convention?.observacao ?? ""}
                    placeholder="Texto que a recepção e os agentes leem sem reinterpretação."
                    className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus-visible:border-brand"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2.5">
                  <SubmitButton pendingLabel="Salvando…">
                    {convention === null ? "Adicionar ao rascunho" : "Salvar no rascunho"}
                  </SubmitButton>
                  {convention !== null && (
                    <a
                      href="/configuracoes/regras?secao=planos"
                      className="text-sm font-medium text-ink-muted underline-offset-2 hover:underline"
                    >
                      Cancelar edição
                    </a>
                  )}
                </div>
              </form>
            </CardBody>
            <Message state={conventionState} />
          </Card>
        </>
      )}

      {section === "procedimentos" && (
        <>
          <Card>
            <CardHeader
              title={`${document.procedimentos.length} procedimentos`}
              description="Código, descrição e valor de referência. O valor é o que o motor compara com o que foi lançado."
            />
            <DataTable>
              <TableHead columns={["Código", "Descrição", "Valor de referência", ""]} />
              <tbody>
                {document.procedimentos.map((entry) => (
                  <TableRow key={entry.codigo}>
                    <TableCell className="numeric whitespace-nowrap font-mono text-xs">
                      {entry.codigo}
                    </TableCell>
                    <TableCell>{entry.descricao}</TableCell>
                    <TableCell className="numeric whitespace-nowrap text-ink-muted">
                      R$ {entry.valor_referencia}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <a
                        href={`/configuracoes/regras?secao=procedimentos&procedimento=${encodeURIComponent(entry.codigo)}`}
                        className="text-sm font-medium text-brand underline-offset-2 hover:underline"
                      >
                        Editar
                      </a>
                      <form action={removeProcedure} className="ml-3 inline">
                        <input type="hidden" name="codigo" value={entry.codigo} />
                        <button
                          type="submit"
                          className="text-sm font-medium text-danger underline-offset-2 hover:underline"
                        >
                          Remover
                        </button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </DataTable>
            <Message state={removeProcedureState} />
          </Card>

          <Card>
            <CardHeader
              title={procedure === null ? "Novo procedimento" : `Editando ${procedure.codigo}`}
              description="Remover um procedimento também o retira dos planos que o cobriam."
            />
            <CardBody>
              <form action={saveProcedure} className="flex flex-wrap items-end gap-3">
                {procedure !== null && (
                  <input type="hidden" name="originalCode" value={procedure.codigo} />
                )}

                <label className={`${LABEL_CLASS} min-w-[10rem]`}>
                  Código
                  <input
                    type="text"
                    name="codigo"
                    required
                    maxLength={40}
                    defaultValue={procedure?.codigo ?? ""}
                    placeholder="50000470"
                    className={`numeric ${INPUT_CLASS}`}
                  />
                </label>

                <label className={`${LABEL_CLASS} min-w-[18rem] flex-1`}>
                  Descrição
                  <input
                    type="text"
                    name="descricao"
                    required
                    maxLength={200}
                    defaultValue={procedure?.descricao ?? ""}
                    placeholder="Sessão de fisioterapia"
                    className={INPUT_CLASS}
                  />
                </label>

                <label className={`${LABEL_CLASS} min-w-[10rem]`}>
                  Valor de referência
                  <input
                    type="text"
                    name="valor"
                    required
                    inputMode="decimal"
                    defaultValue={procedure?.valor_referencia ?? ""}
                    placeholder="62,00"
                    className={`numeric ${INPUT_CLASS}`}
                  />
                </label>

                <SubmitButton pendingLabel="Salvando…">
                  {procedure === null ? "Adicionar" : "Salvar"}
                </SubmitButton>
              </form>
            </CardBody>
            <Message state={procedureState} />
          </Card>
        </>
      )}

      {section === "json" && (
        <Card>
          <CardHeader
            title="Documento completo"
            description="Para importar uma versão inteira de uma vez. É validado antes de virar rascunho."
          />
          <CardBody className="flex flex-col gap-3">
            <form action={saveDocument} className="flex flex-col gap-3">
              <textarea
                name="documento"
                rows={22}
                spellCheck={false}
                defaultValue={JSON.stringify(document, null, 2)}
                className="w-full rounded-md border border-border-subtle bg-canvas px-3 py-2 font-mono text-xs leading-relaxed text-ink outline-none focus-visible:border-brand"
              />
              <SubmitButton pendingLabel="Validando…">Salvar como rascunho</SubmitButton>
            </form>
          </CardBody>
          <Message state={documentState} />
        </Card>
      )}

      <Card>
        <CardHeader
          title="Nome da versão"
          description="Aparece em cada decisão validada sob estas regras."
        />
        <CardBody>
          <form action={renameVersion} className="flex flex-wrap items-end gap-3">
            <label className={`${LABEL_CLASS} min-w-[16rem] flex-1`}>
              Versão
              <input
                type="text"
                name="versao"
                required
                maxLength={60}
                defaultValue={document.versao}
                className={INPUT_CLASS}
              />
            </label>
            <SubmitButton variant="secondary" pendingLabel="Salvando…">
              Renomear no rascunho
            </SubmitButton>
          </form>
        </CardBody>
        <Message state={versionState} />
      </Card>

      <Card>
        <CardHeader
          title="Reavaliar guias com as regras vigentes"
          description="Publicar não mexe no que já foi decidido. Esta ação roda o motor de novo sobre todas as guias e registra uma nova validação, mantendo o histórico."
        />
        <CardBody>
          <form action={revalidateAction}>
            <SubmitButton variant="secondary" pendingLabel="Reavaliando…">
              Reavaliar todas as guias
            </SubmitButton>
          </form>
        </CardBody>
        <Message state={revalidateState} />
      </Card>
    </>
  );
}
