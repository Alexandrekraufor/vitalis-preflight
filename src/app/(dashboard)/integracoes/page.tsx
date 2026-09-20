import { sql } from "drizzle-orm";
import { BookOpen, KeyRound } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { ApiUsagePanel } from "@/components/integrations/api-usage-panel";
import { AuthorizedClients } from "@/components/integrations/authorized-clients";
import { EndpointRow } from "@/components/integrations/endpoint-reference";
import { EvaluationAccess } from "@/components/integrations/evaluation-access";
import { McpClientSetup } from "@/components/integrations/mcp-client-setup";
import { McpToolRow } from "@/components/integrations/mcp-tool-reference";
import {
  INTERNAL_ENDPOINTS,
  REST_ENDPOINTS,
} from "@/components/integrations/rest-endpoint-catalog";
import { Fact, HealthDot, SurfaceStatus } from "@/components/integrations/surface-status";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CodeSample } from "@/components/ui/code-sample";
import { SegmentedNav, TabNav } from "@/components/ui/tab-nav";
import { listAuthorizedClients } from "@/application/access/oauth-authorization.use-case";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";
import { db } from "@/infrastructure/db/client";
import { env } from "@/lib/env";
import { mcpToolCatalog } from "@/mcp/tool-catalog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Integrações" };

const USAGE_WINDOW_DAYS = 7;

/** Kept out of the component body: the clock is not a pure value. */
function usageWindowStart(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const TABS = ["api", "mcp"] as const;
type Tab = (typeof TABS)[number];

/**
 * Sections inside each surface.
 *
 * Three different questions get asked on this screen: how do I connect, what
 * can it do, and how much is it being used. Stacking all three answers on one
 * scroll makes the reader skim past two of them every time.
 */
const SECTIONS = {
  api: ["endpoints", "uso"],
  mcp: ["conectar", "tools", "uso"],
} as const satisfies Readonly<Record<Tab, readonly string[]>>;

type Section = (typeof SECTIONS)[Tab][number];

const SECTION_LABELS: Readonly<Record<Section, string>> = {
  endpoints: "Endpoints",
  uso: "Uso",
  conectar: "Conectar",
  tools: "Tools",
};

const searchParamsSchema = z.object({
  aba: z.enum(TABS).optional().catch(undefined),
  secao: z.string().optional().catch(undefined),
});

const CONNECTION_STEPS: readonly string[] = [
  "O cliente lê os metadados publicados e descobre onde autorizar.",
  "Ele se registra sozinho e recebe um identificador, sem segredo compartilhado.",
  "Você entra na sua conta e vê uma tela dizendo quem está pedindo e o que vai poder fazer.",
  "Ao autorizar, o cliente recebe um token de uma hora, renovável, e as tools sobem com descrição e instruções.",
];

async function databaseIsReachable(): Promise<boolean> {
  try {
    await db().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

function ClosedSurfaceHelp({ variable }: { readonly variable: string }) {
  return (
    <CardBody className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-ink-muted">
        Chave ausente fecha a superfície, nunca a abre. Crie uma chave em{" "}
        <Link
          href="/configuracoes/chaves"
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          Configurações › Chaves de API
        </Link>{" "}
        e use-a no header{" "}
        <code className="font-mono text-xs text-ink">Authorization: Bearer</code>. A chave fica
        guardada como digest e pode ser revogada a qualquer momento.
      </p>
      <p className="text-sm leading-relaxed text-ink-muted">
        Para uma credencial fixa de deploy, a variável{" "}
        <code className="font-mono text-xs text-ink">{variable}</code> continua valendo.
      </p>
      <Link
        href="/configuracoes/chaves"
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        <KeyRound aria-hidden className="size-4" />
        Criar chave
      </Link>
    </CardBody>
  );
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const services = await appServices();
  const user = await requireUser(services.access, "/integracoes");

  const parsed = searchParamsSchema.parse(await searchParams);
  const active: Tab = parsed.aba ?? "api";

  const available: readonly Section[] = SECTIONS[active];
  const fallback = available[0] as Section;
  const section: Section = available.includes(parsed.secao as Section)
    ? (parsed.secao as Section)
    : fallback;

  const databaseUp = await databaseIsReachable();
  const configuration = env();
  const restConfigured = configuration.VITALIS_API_KEY !== undefined;
  const mcpConfigured = configuration.VITALIS_MCP_API_KEY !== undefined;
  const demoMode = configuration.VITALIS_API_DEMO_MODE;
  const baseUrl = configuration.APP_URL;
  const tools = mcpToolCatalog(services);
  const local = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

  // The usage log is only read when the panel is actually on screen.
  const surface = active === "api" ? "REST" : "MCP";
  const since = usageWindowStart(USAGE_WINDOW_DAYS);
  const [usage, recentRequests] =
    section === "uso"
      ? await Promise.all([
          services.usage.summarize({ since, surface }),
          services.usage.listRecent({ since, surface, limit: 15 }),
        ])
      : [null, null];

  // The evaluation key is read by the account provisioned for an assessment,
  // and by an administrator who needs to hand it over. Nobody else sees it.
  const showsEvaluationKey = user.role === "ADMIN" || user.role === "EVALUATOR";
  const evaluationCredentials = showsEvaluationKey
    ? await services.access.listEvaluationCredentials()
    : [];

  // Only the MCP tab asks who is connected, and it asks for this person only.
  const authorizedClients =
    active === "mcp" && section === "conectar"
      ? await listAuthorizedClients(user, { oauth: services.oauth })
      : [];

  const mcpClientConfig = JSON.stringify(
    {
      mcpServers: {
        "vitalis-preflight": {
          type: "http",
          url: `${baseUrl}/mcp`,
          headers: { Authorization: "Bearer ${VITALIS_MCP_API_KEY}" },
        },
      },
    },
    null,
    2,
  );

  return (
    <>
      <PageHeader
        title="Integrações"
        description="Os mesmos casos de uso atendem a interface, a API REST e os agentes de IA."
        action={
          <Link
            href="/integracoes/documentacao"
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            <BookOpen aria-hidden className="size-4" />
            Documentação completa
          </Link>
        }
      />

      <PageContent>
        <Card>
          <CardHeader title="Estado da aplicação" />
          <CardBody className="flex flex-wrap gap-x-8 gap-y-4">
            <HealthDot up label="Aplicação" />
            <HealthDot up={databaseUp} label="PostgreSQL" />
            <Fact
              label="Regras"
              value={`${services.ruleSet.version} (${services.ruleSet.hash.slice(0, 12)}…)`}
              title={services.ruleSet.hash}
            />
            <Fact label="Observação" value={services.observationInterpreter.name} />
            <Fact label="Origem" value={baseUrl} />
          </CardBody>
        </Card>

        <TabNav
          label="Superfícies de integração"
          active={active}
          items={[
            {
              key: "api",
              href: "/integracoes?aba=api",
              label: "API REST",
              hint: "sistemas e integradores",
            },
            { key: "mcp", href: "/integracoes?aba=mcp", label: "MCP", hint: "agentes de IA" },
          ]}
        />

        <SegmentedNav
          label={`Seções de ${active === "api" ? "API REST" : "MCP"}`}
          active={section}
          items={available.map((key) => ({
            key,
            href: `/integracoes?aba=${active}&secao=${key}`,
            label: SECTION_LABELS[key],
          }))}
        />

        {section === "uso" && usage !== null && recentRequests !== null && (
          <ApiUsagePanel
            summary={usage}
            recent={recentRequests}
            days={USAGE_WINDOW_DAYS}
            title={active === "api" ? "Uso da API" : "Uso do MCP"}
          />
        )}

        {active === "api" && section === "endpoints" && (
          <>
            {showsEvaluationKey && (
              <EvaluationAccess
                credentials={evaluationCredentials}
                baseUrl={baseUrl}
                surface="REST"
              />
            )}

            <Card>
              <CardHeader
                title="API externa de integração"
                description="Para o sistema de gestão e integradores. Cada chave vale pelo que foi autorizada: leitura consulta, escrita injeta guias."
              />
              <SurfaceStatus
                state={restConfigured ? "OPEN" : demoMode ? "DEMO" : "CLOSED"}
                detail={
                  restConfigured
                    ? `Os endpoints de /api/v1 respondem em ${baseUrl}. A permissão de cada chave decide o que ela alcança.`
                    : demoMode
                      ? "Sem chave no ambiente. Apenas POST /api/v1/guides/validate responde, por causa do modo demonstração; os demais seguem fechados."
                      : "Crie uma chave para abrir a API. Sem credencial, /api/v1 responde 401 a qualquer chamada."
                }
              />
              {restConfigured ? (
                <CardBody>
                  <CodeSample
                    caption="Primeira chamada"
                    code={`curl -sS "${baseUrl}/api/v1/guides?status=NEEDS_CORRECTION&limit=5" \\
  -H "Authorization: Bearer $VITALIS_API_KEY"`}
                  />
                </CardBody>
              ) : (
                <ClosedSurfaceHelp variable="VITALIS_API_KEY" />
              )}
            </Card>

            <Card>
              <CardHeader
                title="Endpoints públicos"
                description="Parâmetros, códigos de status e exemplos completos estão na documentação."
              />
              {REST_ENDPOINTS.map((endpoint) => (
                <EndpointRow key={endpoint.id} endpoint={endpoint} />
              ))}
            </Card>

            <Card>
              <CardHeader
                title="Endpoints internos do painel"
                description="Alcançados pelo navegador com o cookie de sessão, nunca com chave de API. É a única superfície que grava dados operacionais."
              />
              {INTERNAL_ENDPOINTS.map((endpoint) => (
                <EndpointRow key={endpoint.id} endpoint={endpoint} />
              ))}
            </Card>

            <Card>
              <CardHeader
                title="Integração com o sistema de gestão"
                description="Hoje a entrada é por CSV e por API. O caminho definitivo já cabe na mesma arquitetura."
              />
              <CardBody className="flex flex-col gap-3 text-sm text-ink">
                <p className="font-mono text-xs text-ink-muted">
                  sistema de gestão → webhook ou polling → POST /api/v1/guides/validate → decisão
                </p>
                <p className="leading-relaxed">
                  Validação e ingestão são caminhos separados. Consultar a decisão de uma guia não
                  muda nada; registrar a guia é uma operação própria, com autorização própria. Toda
                  ingestão, seja CSV, seed ou uma futura integração, passa pelo mesmo caso de uso,
                  então nenhuma regra precisa ser reescrita para ligar o sistema de gestão. Os
                  endpoints do sistema da clínica não estão definidos aqui porque ainda não
                  existem; o que existe é o ponto de entrada deste lado.
                </p>
              </CardBody>
            </Card>
          </>
        )}

        {active === "mcp" && section === "conectar" && (
          <>
            {showsEvaluationKey && (
              <EvaluationAccess
                credentials={evaluationCredentials}
                baseUrl={baseUrl}
                surface="MCP"
              />
            )}

            <AuthorizedClients clients={authorizedClients} />

            <Card>
              <CardHeader
                title="Conectar um cliente de IA"
                description="Cole esta URL no seu cliente MCP. Ele descobre o servidor, se registra sozinho e pede a sua autorização."
              />
              <SurfaceStatus
                state="OPEN"
                detail="A autorização é por OAuth: ninguém precisa copiar chave nenhuma."
              />
              <CardBody className="flex flex-col gap-4">
                <CodeSample caption="URL do servidor MCP" code={`${baseUrl}/mcp`} />

                <ol className="flex flex-col gap-2.5">
                  {CONNECTION_STEPS.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
                      <span className="numeric flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[0.6875rem] font-bold text-brand">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>

                <p className="text-sm leading-relaxed text-ink-muted">
                  As autorizações concedidas ficam em{" "}
                  <Link
                    href="/configuracoes/chaves"
                    className="font-medium text-brand underline-offset-2 hover:underline"
                  >
                    Configurações › Chaves de API
                  </Link>{" "}
                  e podem ser revogadas a qualquer momento: o agente para de funcionar na chamada
                  seguinte.
                </p>
              </CardBody>
            </Card>

            <McpClientSetup endpoint={`${baseUrl}/mcp`} reachablePublicly={!local} />

            <Card>
              <CardHeader
                title="Chave fixa, para integração sem pessoa"
                description="Alternativa ao OAuth quando quem chama é um servidor, não alguém sentado na frente da tela."
              />
              <SurfaceStatus
                state={mcpConfigured ? "OPEN" : "CLOSED"}
                detail={
                  mcpConfigured
                    ? "Há uma credencial fixa configurada no ambiente para este endpoint."
                    : "Nenhuma chave fixa configurada. Crie uma na tela de chaves ou use o OAuth acima."
                }
              />
              <CardBody className="flex flex-col gap-3">
                <CodeSample
                  caption="Cliente MCP com chave fixa"
                  language="json"
                  code={mcpClientConfig}
                />
                <p className="text-sm leading-relaxed text-ink-muted">
                  A chave é criada em{" "}
                  <Link
                    href="/configuracoes/chaves"
                    className="font-medium text-brand underline-offset-2 hover:underline"
                  >
                    Configurações › Chaves de API
                  </Link>
                  , escolhendo a superfície{" "}
                  <strong className="font-medium text-ink">Servidor MCP</strong>.
                </p>
              </CardBody>
            </Card>
          </>
        )}

        {active === "mcp" && section === "tools" && (
          <>
            <Card>
              <CardHeader
                title={`${tools.length} tools, todas somente de leitura`}
                description="Nenhuma tool edita, aprova, corrige ou exclui uma guia. Uma credencial válida compra o direito de perguntar, nunca de mudar."
              />
              {tools.map((tool) => (
                <McpToolRow key={tool.name} tool={tool} />
              ))}
            </Card>

            <Card>
              <CardHeader
                title="Como o agente deve usar"
                description="As instruções que o servidor envia no handshake."
              />
              <CardBody className="flex flex-col gap-3 text-sm leading-relaxed text-ink-muted">
                <p>
                  As regras dos convênios são a única fonte da verdade e vivem neste servidor: o
                  agente consulta{" "}
                  <code className="font-mono text-xs text-ink">consultar_regra_convenio</code> em
                  vez de assumir qualquer regra de memória.
                </p>
                <p>
                  Para saber se uma guia pode ser enviada, o agente usa{" "}
                  <code className="font-mono text-xs text-ink">verificar_guia</code>, que executa o
                  mesmo motor determinístico da aplicação web. O servidor nunca inventa código de
                  procedimento, CID ou número de autorização.
                </p>
              </CardBody>
            </Card>
          </>
        )}
      </PageContent>
    </>
  );
}
