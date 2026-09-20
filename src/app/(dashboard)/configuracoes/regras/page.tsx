import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import {
  draftRuleSet,
  getRuleSetWorkspace,
} from "@/application/rules/manage-rule-set.use-case";
import { previewRuleImpact } from "@/application/rules/rule-impact.use-case";
import { AccessDenied } from "@/components/layout/access-denied";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { RulesWorkspace } from "@/components/rules/rules-workspace";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, TableCell, TableHead, TableRow } from "@/components/ui/data-table";
import { SegmentedNav } from "@/components/ui/tab-nav";
import { ruleSetStatusLabel } from "@/domain/conventions/rule-set-status";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";
import { formatBrl } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata = { title: "Regras dos convênios" };

const SECTIONS = ["planos", "procedimentos", "json"] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_LABELS: Readonly<Record<Section, string>> = {
  planos: "Planos",
  procedimentos: "Procedimentos",
  json: "JSON",
};

const searchParamsSchema = z.object({
  secao: z.enum(SECTIONS).optional().catch(undefined),
  plano: z.string().min(1).optional().catch(undefined),
  procedimento: z.string().min(1).optional().catch(undefined),
  impacto: z.literal("1").optional().catch(undefined),
});

function formatDate(value: Date | null): string {
  return value === null
    ? "-"
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
        value,
      );
}

/**
 * Where the clinic's own rules are maintained.
 *
 * Editing produces a draft; publishing promotes it and archives the previous
 * version. Decisions already taken keep pointing at the version and hash that
 * produced them, which is what makes a past validation reproducible instead of
 * a moving target.
 */
export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const services = await appServices();
  const user = await requireUser(services.access, "/configuracoes/regras");

  if (user.role !== "ADMIN") {
    return (
      <>
        <PageHeader title="Regras dos convênios" />
        <PageContent>
          <AccessDenied description="Apenas administradores podem ver ou alterar as regras dos convênios." />
        </PageContent>
      </>
    );
  }

  const parsed = searchParamsSchema.parse(await searchParams);
  const section: Section = parsed.secao ?? "planos";

  const workspace = await getRuleSetWorkspace(user, services.rules);
  const editing = workspace.draft ?? workspace.published;

  if (editing === null) {
    return (
      <>
        <PageHeader title="Regras dos convênios" />
        <PageContent>
          <Card>
            <CardBody className="text-sm text-ink-muted">
              Nenhuma versão de regras carregada ainda. Recarregue a página: a versão inicial é
              importada do arquivo do repositório no primeiro acesso.
            </CardBody>
          </Card>
        </PageContent>
      </>
    );
  }

  // Running the draft over every guide costs real work, so it happens only
  // when somebody asks to see the impact.
  const impact =
    parsed.impacto === "1" && workspace.draft !== null
      ? await previewRuleImpact(draftRuleSet(workspace.draft), {
          guides: services.guides,
          observationInterpreter: services.observationInterpreter,
        })
      : null;

  return (
    <>
      <PageHeader
        title="Regras dos convênios"
        description="Planos, procedimentos e limites que o motor determinístico aplica. Editar cria um rascunho; publicar passa a valer para as próximas validações."
      />

      <PageContent>
        <Card>
          <CardHeader
            title="Versão vigente"
            description="É esta versão, com este hash, que assina cada decisão tomada agora."
          />
          <CardBody className="flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                Versão
              </p>
              <p className="mt-0.5 text-sm font-medium text-ink">
                {workspace.published?.version ?? "sem versão publicada"}
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                Hash
              </p>
              <p
                className="numeric mt-0.5 font-mono text-xs text-ink-muted"
                title={workspace.published?.hash}
              >
                {workspace.published?.hash.slice(0, 16) ?? "-"}…
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                Publicada em
              </p>
              <p className="numeric mt-0.5 text-sm text-ink">
                {formatDate(workspace.published?.publishedAt ?? null)}
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                Por
              </p>
              <p className="mt-0.5 text-sm text-ink">
                {workspace.published?.publishedByName ?? "sistema"}
              </p>
            </div>
          </CardBody>
        </Card>

        {workspace.draft !== null && (
          <section className="rounded-[var(--radius-card)] border border-warn/30 bg-warn-soft px-5 py-4">
            <h2 className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-warn">
              <TriangleAlert aria-hidden className="size-3.5" />
              Rascunho não publicado
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              Versão <strong className="font-semibold">{workspace.draft.version}</strong>, salva
              em {formatDate(workspace.draft.updatedAt)}. As regras vigentes continuam sendo as
              publicadas até você publicar este rascunho.
            </p>
            <Link
              href="/configuracoes/regras?impacto=1"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Ver o que muda se publicar
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </section>
        )}

        {impact !== null && (
          <Card>
            <CardHeader
              title="Impacto do rascunho"
              description="Simulação sobre as guias atuais. Nada foi gravado."
            />
            <CardBody className="flex flex-wrap gap-x-8 gap-y-4">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                  Guias avaliadas
                </p>
                <p className="numeric mt-0.5 text-2xl font-bold text-ink">{impact.evaluated}</p>
              </div>
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                  Mudam de decisão
                </p>
                <p
                  className={`numeric mt-0.5 text-2xl font-bold ${
                    impact.changes.length === 0 ? "text-ready" : "text-warn"
                  }`}
                >
                  {impact.changes.length}
                </p>
              </div>
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                  Valor em risco
                </p>
                <p className="numeric mt-0.5 text-sm font-medium text-ink">
                  {formatBrl(impact.amountAtRiskBefore)} para{" "}
                  <strong
                    className={
                      impact.amountAtRiskAfter > impact.amountAtRiskBefore
                        ? "text-danger"
                        : "text-ready"
                    }
                  >
                    {formatBrl(impact.amountAtRiskAfter)}
                  </strong>
                </p>
              </div>
              {impact.unreadable > 0 && (
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                    Ilegíveis
                  </p>
                  <p className="numeric mt-0.5 text-2xl font-bold text-danger">
                    {impact.unreadable}
                  </p>
                </div>
              )}
            </CardBody>

            {impact.changes.length === 0 ? (
              <p className="flex items-center gap-2 border-t border-border-subtle px-5 py-3.5 text-sm text-ready">
                <CircleCheck aria-hidden className="size-4" />
                Nenhuma guia muda de decisão com este rascunho.
              </p>
            ) : (
              <div className="border-t border-border-subtle">
                <DataTable>
                  <TableHead columns={["Guia", "Decisão hoje", "Passaria a ser"]} />
                  <tbody>
                    {impact.changes.slice(0, 25).map((change) => (
                      <TableRow key={change.idGuia}>
                        <TableCell className="numeric whitespace-nowrap font-mono text-xs">
                          {change.idGuia}
                        </TableCell>
                        <TableCell className="text-ink-muted">{change.fromLabel}</TableCell>
                        <TableCell className="font-medium">{change.toLabel}</TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </DataTable>
              </div>
            )}
          </Card>
        )}

        <SegmentedNav
          label="Seções das regras"
          active={section}
          items={SECTIONS.map((key) => ({
            key,
            href: `/configuracoes/regras?secao=${key}`,
            label: SECTION_LABELS[key],
          }))}
        />

        <RulesWorkspace
          document={editing.document}
          section={section}
          editingConvention={parsed.plano ?? null}
          editingProcedure={parsed.procedimento ?? null}
          hasDraft={workspace.draft !== null}
        />

        <Card>
          <CardHeader
            title="Histórico de versões"
            description="Decisões antigas continuam apontando para a versão que as produziu."
          />
          <DataTable>
            <TableHead columns={["Versão", "Situação", "Hash", "Criada em", "Publicada em"]} />
            <tbody>
              {workspace.history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.version}</TableCell>
                  <TableCell className="text-ink-muted">
                    {ruleSetStatusLabel(entry.status)}
                  </TableCell>
                  <TableCell className="numeric font-mono text-xs text-ink-muted">
                    <span title={entry.hash}>{entry.hash.slice(0, 12)}…</span>
                  </TableCell>
                  <TableCell className="numeric whitespace-nowrap text-ink-muted">
                    {formatDate(entry.createdAt)}
                  </TableCell>
                  <TableCell className="numeric whitespace-nowrap text-ink-muted">
                    {formatDate(entry.publishedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </DataTable>
        </Card>
      </PageContent>
    </>
  );
}
