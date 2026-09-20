import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { EndpointReference } from "@/components/integrations/endpoint-reference";
import { DocsIndex } from "@/components/integrations/docs-index";
import { McpToolReference } from "@/components/integrations/mcp-tool-reference";
import {
  INTERNAL_ENDPOINTS,
  REST_ENDPOINTS,
} from "@/components/integrations/rest-endpoint-catalog";
import { GUIDE_FIELD_LABELS } from "@/components/guides/guide-fields";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CodeSample } from "@/components/ui/code-sample";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { TabNav } from "@/components/ui/tab-nav";
import { GUIDE_STATUSES, guideStatusLabel } from "@/domain/guides/guide-status";
import { GUIDE_COLUMNS } from "@/domain/normalization/normalization.types";
import { FINDING_CODES, findingLabel } from "@/domain/rules/finding-codes";
import { DEFERRED_RULES } from "@/domain/rules/rules.types";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";
import { env } from "@/lib/env";
import { mcpToolCatalog } from "@/mcp/tool-catalog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Documentação de integração" };

const TABS = ["api", "mcp"] as const;
type Tab = (typeof TABS)[number];

const searchParamsSchema = z.object({
  aba: z.enum(TABS).optional().catch(undefined),
});

const STATUS_MEANING: Readonly<Record<(typeof GUIDE_STATUSES)[number], string>> = {
  READY_TO_SUBMIT: "Nenhum problema nas regras vigentes. A guia pode seguir para o convênio.",
  NEEDS_CORRECTION: "Problema objetivo e corrigível antes do envio.",
  REVIEW_REQUIRED: "Dados contraditórios ou situação que nenhuma regra resolve. Precisa de leitura humana.",
};

const SEVERITIES = [
  { code: "BLOCKING", meaning: "Impede o envio. A guia não pode ir para o convênio assim." },
  { code: "REVIEW", meaning: "Não bloqueia sozinho, mas exige conferência humana." },
  { code: "INFO", meaning: "Registro informativo; não altera a decisão." },
] as const;

const SOURCES = [
  { code: "CONVENTION_RULE", meaning: "Regra do convênio em data/source/regras_convenio.json." },
  { code: "REFERENCE_TABLE", meaning: "Tabela de procedimentos e valores de referência." },
  { code: "RECEPTION_NOTE", meaning: "Fato extraído da observação da recepção, sempre com evidência textual." },
] as const;

const PROBLEM_CODES = [
  { code: "UNAUTHORIZED", status: 401, meaning: "Credencial ausente ou inválida." },
  { code: "FORBIDDEN", status: 403, meaning: "Sessão válida, papel insuficiente." },
  { code: "INVALID_JSON", status: 400, meaning: "O corpo não é JSON válido." },
  { code: "INVALID_PAYLOAD", status: 400, meaning: "Corpo ou parâmetro fora do contrato." },
  { code: "UNPROCESSABLE_GUIDE", status: 422, meaning: "O payload não pôde ser interpretado como guia." },
  { code: "INVALID_FILE", status: 422, meaning: "O arquivo enviado não pôde ser lido." },
  { code: "PAYLOAD_TOO_LARGE", status: 413, meaning: "Corpo acima do limite da superfície." },
  { code: "NOT_FOUND", status: 404, meaning: "O recurso pedido não existe." },
  { code: "RATE_LIMITED", status: 429, meaning: "Limite por janela estourado; veja Retry-After." },
  { code: "INTERNAL_ERROR", status: 500, meaning: "Falha inesperada. Sem stack trace, SQL ou caminho de arquivo." },
] as const;

function SectionCard({
  id,
  title,
  description,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card>
        {description === undefined ? (
          <CardHeader title={title} />
        ) : (
          <CardHeader title={title} description={description} />
        )}
        {children}
      </Card>
    </section>
  );
}

function ReferenceTable({
  columns,
  rows,
}: {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-xs text-ink-muted">
          {columns.map((column) => (
            <th key={column} className="px-5 py-2 font-medium">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]} className="border-t border-border-subtle align-top">
            {row.map((cell, index) => (
              <td
                key={columns[index] ?? String(index)}
                className={
                  index === 0
                    ? "px-5 py-2 font-mono text-xs text-ink"
                    : "px-5 py-2 text-sm text-ink-muted"
                }
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function IntegrationDocumentationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const services = await appServices();
  await requireUser(services.access, "/integracoes/documentacao");

  const { aba } = searchParamsSchema.parse(await searchParams);
  const active: Tab = aba ?? "api";

  const configuration = env();
  const baseUrl = configuration.APP_URL;
  const demoMode = configuration.VITALIS_API_DEMO_MODE;
  const tools = mcpToolCatalog(services);

  const apiIndex = [
    { href: "#visao-geral", label: "Visão geral" },
    { href: "#autenticacao", label: "Autenticação" },
    { href: "#erros", label: "Erros e limites" },
    ...REST_ENDPOINTS.map((endpoint) => ({
      href: `#${endpoint.id}`,
      label: `${endpoint.method} ${endpoint.path}`,
    })),
    { href: "#internos", label: "Endpoints internos" },
    { href: "#payload", label: "Campos da guia" },
    { href: "#decisoes", label: "Decisões e findings" },
    { href: "#desligadas", label: "Regras desligadas" },
  ];

  const mcpIndex = [
    { href: "#mcp-visao-geral", label: "Visão geral" },
    { href: "#mcp-conexao", label: "Conexão e handshake" },
    ...tools.map((tool) => ({ href: `#${tool.name}`, label: tool.name })),
    { href: "#mcp-garantias", label: "Garantias" },
  ];

  const handshake = JSON.stringify(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "meu-agente", version: "1.0.0" },
      },
    },
    null,
    2,
  );

  return (
    <>
      <PageHeader
        title="Documentação de integração"
        description="Contrato completo das duas superfícies de máquina: a API REST e o servidor MCP."
        action={
          <Link
            href="/integracoes"
            className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink-muted"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Voltar para Integrações
          </Link>
        }
      />

      <PageContent>
        <TabNav
          label="Documentação"
          active={active}
          items={[
            { key: "api", href: "/integracoes/documentacao?aba=api", label: "API REST" },
            { key: "mcp", href: "/integracoes/documentacao?aba=mcp", label: "MCP" },
          ]}
        />

        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[15rem_minmax(0,1fr)]">
          <DocsIndex entries={active === "api" ? apiIndex : mcpIndex} />

          <div className="flex min-w-0 flex-col gap-8">
            {active === "api" ? (
              <>
                <SectionCard
                  id="visao-geral"
                  title="Visão geral"
                  description="Uma API de leitura e validação sobre os mesmos casos de uso da tela."
                >
                  <CardBody className="flex flex-col gap-3 text-sm leading-relaxed text-ink-muted">
                    <p>
                      Origem: <code className="font-mono text-xs text-ink">{baseUrl}</code>. Todas as
                      respostas são JSON em UTF-8. Valores monetários são publicados em reais, como
                      número; internamente são inteiros em centavos, nunca ponto flutuante.
                    </p>
                    <p>
                      Datas de atendimento e de autorização seguem{" "}
                      <code className="font-mono text-xs text-ink">AAAA-MM-DD</code>, e a validade de
                      uma autorização é inclusiva. Carimbos de tempo de validação são ISO-8601 em UTC.
                    </p>
                    <p>
                      <strong className="font-medium text-ink">Validar não é ingerir.</strong>{" "}
                      <code className="font-mono text-xs text-ink">POST /api/v1/guides/validate</code>{" "}
                      calcula e não grava, por mais que seja chamado.{" "}
                      <code className="font-mono text-xs text-ink">POST /api/v1/guides</code> é a
                      ingestão: exige permissão de escrita e passa pelo mesmo caso de uso do upload
                      de CSV, então existe uma só porta de gravação, com versionamento e
                      procedência. Os demais endpoints continuam somente de leitura.
                    </p>
                  </CardBody>
                </SectionCard>

                <SectionCard
                  id="autenticacao"
                  title="Autenticação"
                  description="Bearer token no header Authorization."
                >
                  <CardBody className="flex flex-col gap-3">
                    <p className="text-sm leading-relaxed text-ink-muted">
                      A chave é criada em{" "}
                      <strong className="font-medium text-ink">Configurações › Chaves de API</strong>{" "}
                      com as permissões que terá: <strong className="font-medium text-ink">leitura</strong>{" "}
                      para consultar guias e relatórios,{" "}
                      <strong className="font-medium text-ink">escrita</strong> para injetar guias,
                      ou as duas. Uma chave de leitura chamando a ingestão recebe 403, não 401: a
                      credencial existe, a permissão é que não. Credencial ausente e credencial
                      errada recebem a mesma resposta, então sondar não revela nada.
                    </p>
                    <p className="text-sm leading-relaxed text-ink-muted">
                      A variável <code className="font-mono text-xs text-ink">VITALIS_API_KEY</code>{" "}
                      continua valendo para deploy, comparada em tempo constante, e vale{" "}
                      <strong className="font-medium text-ink">somente para leitura</strong>: gravar
                      exige uma chave emitida no painel para isso. Chave ausente{" "}
                      <strong className="font-medium text-ink">fecha</strong> a superfície, em vez de
                      publicar a API sem querer.
                    </p>
                    <CodeSample
                      caption="Header"
                      code={`Authorization: Bearer $VITALIS_API_KEY`}
                    />
                    <p className="text-sm leading-relaxed text-ink-muted">
                      Uma resposta 401 traz{" "}
                      <code className="font-mono text-xs text-ink">
                        WWW-Authenticate: Bearer realm=&quot;vitalis-preflight&quot;
                      </code>
                      .{" "}
                      {demoMode
                        ? "O modo demonstração está ligado nesta instância: POST /api/v1/guides/validate - e somente ele - responde sem credencial. É proibido em produção pelo próprio schema de ambiente."
                        : "O modo demonstração está desligado nesta instância, então todo /api/v1 exige credencial."}
                    </p>
                  </CardBody>
                </SectionCard>

                <SectionCard
                  id="erros"
                  title="Erros e limites"
                  description="Um envelope único para toda superfície de máquina."
                >
                  <CardBody className="flex flex-col gap-3">
                    <CodeSample
                      caption="Envelope de erro"
                      language="json"
                      code={`{
    "error": {
      "code": "INVALID_PAYLOAD",
      "message": "Parâmetros de busca inválidos.",
      "details": [{ "field": "status", "message": "Invalid option" }]
    }
  }`}
                    />
                    <p className="text-sm leading-relaxed text-ink-muted">
                      Nenhuma resposta carrega stack trace, SQL, caminho de arquivo ou segredo. O corpo
                      de uma requisição JSON é limitado a 64 KB; um CSV de importação, a 5 MB e 20.000
                      linhas. Os limites por janela são fixos, contados em memória por instância: 60
                      chamadas por minuto na validação e 120 por minuto no restante de{" "}
                      <code className="font-mono text-xs text-ink">/api/v1</code>. Estourar devolve 429
                      com <code className="font-mono text-xs text-ink">Retry-After</code>.
                    </p>
                  </CardBody>
                  <ReferenceTable
                    columns={["Código", "HTTP", "Quando acontece"]}
                    rows={PROBLEM_CODES.map((entry) => [
                      entry.code,
                      String(entry.status),
                      entry.meaning,
                    ])}
                  />
                </SectionCard>

                {REST_ENDPOINTS.map((endpoint) => (
                  <EndpointReference key={endpoint.id} endpoint={endpoint} />
                ))}

                <SectionCard
                  id="internos"
                  title="Endpoints internos do painel"
                  description="Documentados por completude. Exigem cookie de sessão; chave de API não abre estas portas."
                >
                  <CardBody className="flex flex-col gap-4">
                    {INTERNAL_ENDPOINTS.map((endpoint) => (
                      <EndpointReference key={endpoint.id} endpoint={endpoint} />
                    ))}
                  </CardBody>
                </SectionCard>

                <SectionCard
                  id="payload"
                  title="Campos da guia"
                  description="As 18 colunas que POST /api/v1/guides/validate aceita, iguais às do CSV do sistema de gestão."
                >
                  <CardBody className="text-sm leading-relaxed text-ink-muted">
                    Qualquer campo pode vir vazio ou ausente: campo obrigatório faltando vira finding,
                    não erro de requisição. Datas são aceitas em AAAA-MM-DD ou DD/MM/AAAA e valores com
                    ponto ou vírgula - a conversão volta declarada em{" "}
                    <code className="font-mono text-xs text-ink">normalizations</code>.{" "}
                    <code className="font-mono text-xs text-ink">carteirinha</code> é string, e zeros à
                    esquerda são preservados.
                  </CardBody>
                  <ReferenceTable
                    columns={["Coluna", "Significado"]}
                    rows={GUIDE_COLUMNS.map((column) => [column, GUIDE_FIELD_LABELS[column]])}
                  />
                </SectionCard>

                <SectionCard
                  id="desligadas"
                  title="Regras modeladas que ainda não são aplicadas"
                  description="Faltam dados para verificá-las sem inventar informação. Valem para todas as superfícies."
                >
                  <ul className="divide-y divide-border-subtle">
                    {DEFERRED_RULES.map((rule) => (
                      <li key={rule.id} className="px-5 py-3.5">
                        <p className="text-sm font-medium text-ink">{rule.title}</p>
                        <p className="mt-1 text-sm text-ink-muted">
                          Dado ausente: {rule.missingData} {rule.consequence}
                        </p>
                      </li>
                    ))}
                  </ul>
                </SectionCard>

                <SectionCard
                  id="decisoes"
                  title="Decisões, severidades e códigos de problema"
                  description="O vocabulário que atravessa REST, MCP e CSV exportado."
                >
                  <CardBody className="text-sm leading-relaxed text-ink-muted">
                    Os códigos de finding são parte do contrato público e só crescem: renomear um
                    quebraria todo consumidor, então a lista é append-only.
                  </CardBody>
                  <ReferenceTable
                    columns={["Decisão", "Na tela", "Significado"]}
                    rows={GUIDE_STATUSES.map((status) => [
                      status,
                      guideStatusLabel(status),
                      STATUS_MEANING[status],
                    ])}
                  />
                  <div className="border-t border-border-subtle">
                    <ReferenceTable
                      columns={["Severidade", "Efeito"]}
                      rows={SEVERITIES.map((entry) => [entry.code, entry.meaning])}
                    />
                  </div>
                  <div className="border-t border-border-subtle">
                    <ReferenceTable
                      columns={["Origem do finding", "O que é"]}
                      rows={SOURCES.map((entry) => [entry.code, entry.meaning])}
                    />
                  </div>
                  <div className="border-t border-border-subtle">
                    <ReferenceTable
                      columns={["Código do problema", "Rótulo"]}
                      rows={FINDING_CODES.map((code) => [code, findingLabel(code)])}
                    />
                  </div>
                </SectionCard>
        
    </>
          ) : (
            <>
              <SectionCard
                id="mcp-visao-geral"
                title="Visão geral"
                description="Model Context Protocol sobre Streamable HTTP, sem estado."
              >
                <CardBody className="flex flex-col gap-3 text-sm leading-relaxed text-ink-muted">
                  <p>
                    Endpoint: <code className="font-mono text-xs text-ink">{baseUrl}/mcp</code>, nos
                    métodos POST, GET e DELETE. O transporte não cria sessão e não guarda nada entre
                    chamadas, então qualquer instância atrás de um balanceador atende qualquer
                    requisição.
                  </p>
                  <p>
                    As tools chamam exatamente os mesmos casos de uso da aplicação web: um agente e
                    uma pessoa recebem a mesma resposta sobre a mesma guia. Cada tool devolve{" "}
                    <code className="font-mono text-xs text-ink">structuredContent</code> conforme o
                    seu <code className="font-mono text-xs text-ink">outputSchema</code>, espelhado
                    em texto para clientes que só leem{" "}
                    <code className="font-mono text-xs text-ink">content</code>.
                  </p>
                  <p>
                    As tabelas abaixo são geradas a partir dos schemas que o próprio servidor publica
                    em <code className="font-mono text-xs text-ink">tools/list</code> - não de uma
                    cópia escrita à mão.
                  </p>
                </CardBody>
              </SectionCard>

              <SectionCard
                id="mcp-conexao"
                title="Conexão, autorização e handshake"
                description="OAuth 2.1 com PKCE, registro dinâmico de cliente e tela de consentimento."
              >
                <CardBody className="flex flex-col gap-3">
                  <p className="text-sm leading-relaxed text-ink-muted">
                    O caminho recomendado não usa chave. O cliente recebe apenas a URL do
                    servidor, lê{" "}
                    <code className="font-mono text-xs text-ink">
                      /.well-known/oauth-protected-resource
                    </code>{" "}
                    a partir do 401, descobre o servidor de autorização em{" "}
                    <code className="font-mono text-xs text-ink">
                      /.well-known/oauth-authorization-server
                    </code>
                    , registra-se em <code className="font-mono text-xs text-ink">/oauth/register</code>{" "}
                    e manda a pessoa para <code className="font-mono text-xs text-ink">/oauth/authorize</code>.
                    O token sai de <code className="font-mono text-xs text-ink">/oauth/token</code>.
                  </p>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    PKCE com <code className="font-mono text-xs text-ink">S256</code> é obrigatório e{" "}
                    <code className="font-mono text-xs text-ink">plain</code> é recusado. O código
                    vale 60 segundos e só pode ser trocado uma vez; o token de acesso vale uma
                    hora; o de renovação é rotacionado a cada uso, então um token vazado morre
                    assim que o cliente legítimo renova. Todo token é preso ao endereço deste
                    servidor, então não pode ser reapresentado em outro lugar.
                  </p>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    A pessoa que autoriza precisa estar ativa: desativar alguém na tela de Equipe
                    derruba junto os agentes que agiam em nome dela.
                  </p>
                  <CodeSample
                    caption="Descoberta"
                    code={`curl -sS ${baseUrl}/.well-known/oauth-protected-resource
curl -sS ${baseUrl}/.well-known/oauth-authorization-server`}
                  />
                  <p className="text-sm leading-relaxed text-ink-muted">
                    A chave fixa continua aceita no mesmo endpoint, para integração servidor a
                    servidor onde não há ninguém para consentir.
                  </p>
                  <CodeSample
                    caption="Cliente MCP"
                    language="json"
                    code={JSON.stringify(
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
                    )}
                  />
                  <CodeSample caption="Handshake" language="json" code={handshake} />
                  <CodeSample
                    caption="Chamada direta"
                    code={`curl -sS -X POST ${baseUrl}/mcp \\
  -H "Authorization: Bearer $VITALIS_MCP_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`}
                  />
                </CardBody>
              </SectionCard>

              {tools.map((tool) => (
                <McpToolReference key={tool.name} tool={tool} />
              ))}

              <SectionCard
                id="mcp-garantias"
                title="Garantias"
                description="O que este servidor não faz, por construção."
              >
                <ul className="flex flex-col divide-y divide-border-subtle">
                  <li className="px-5 py-3 text-sm text-ink-muted">
                    <strong className="font-medium text-ink">Nada é alterado.</strong> Não existe
                    tool que edite, aprove, corrija ou exclua uma guia - e o tipo das tools só admite{" "}
                    <code className="font-mono text-xs text-ink">readOnlyHint: true</code>.
                  </li>
                  <li className="px-5 py-3 text-sm text-ink-muted">
                    <strong className="font-medium text-ink">Nada é inventado.</strong> Regra de
                    convênio, código de procedimento, CID e número de autorização só saem daqui se
                    existirem no dataset vigente.
                  </li>
                  <li className="px-5 py-3 text-sm text-ink-muted">
                    <strong className="font-medium text-ink">A decisão é determinística.</strong> O
                    modelo de IA apenas extrai fatos da observação da recepção, sempre com evidência
                    textual literal; quem decide é o motor de regras.
                  </li>
                  <li className="px-5 py-3 text-sm text-ink-muted">
                    <strong className="font-medium text-ink">A versão das regras acompanha a
                    resposta.</strong> Toda decisão publica versão e hash do conjunto de regras que a
                    produziu.
                  </li>
                </ul>
              </SectionCard>
            </>
          )}
        </div>
      </div>
      </PageContent>
    </>
  );
}
