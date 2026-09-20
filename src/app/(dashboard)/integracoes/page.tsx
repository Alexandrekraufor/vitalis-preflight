import { sql } from "drizzle-orm";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DEFERRED_RULES } from "@/domain/rules/rules.types";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";
import { db } from "@/infrastructure/db/client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Integrações" };

async function databaseIsReachable(): Promise<boolean> {
  try {
    await db().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

interface EndpointProps {
  readonly method: string;
  readonly path: string;
  readonly description: string;
}

function Endpoint({ method, path, description }: EndpointProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-border-subtle px-5 py-3.5 last:border-0">
      <div className="flex items-center gap-2">
        <span className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-xs font-semibold text-accent">
          {method}
        </span>
        <code className="font-mono text-sm text-ink">{path}</code>
      </div>
      <p className="text-sm text-ink-muted">{description}</p>
    </div>
  );
}

function StatusDot({ up, label }: { readonly up: boolean; readonly label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink">
      <span
        aria-hidden
        className={`size-2 rounded-full ${up ? "bg-ready" : "bg-danger"}`}
      />
      {label}: <strong className="font-medium">{up ? "operacional" : "indisponível"}</strong>
    </span>
  );
}

export default async function IntegrationsPage() {
  const services = await appServices();
  await requireUser(services.access, "/integracoes");

  const databaseUp = await databaseIsReachable();

  return (
    <>
      <PageHeader
        title="Integrações"
        description="Os mesmos casos de uso atendem a interface, a API REST e os agentes de IA."
      />

      <Card>
        <CardHeader title="Estado da aplicação" />
        <CardBody className="flex flex-wrap gap-6">
          <StatusDot up label="Aplicação" />
          <StatusDot up={databaseUp} label="PostgreSQL" />
          <span className="text-sm text-ink">
            Regras: <strong className="font-medium">{services.ruleSet.version}</strong>{" "}
            <span className="numeric text-ink-muted" title={services.ruleSet.hash}>
              ({services.ruleSet.hash.slice(0, 12)}…)
            </span>
          </span>
          <span className="text-sm text-ink">
            Interpretação da observação:{" "}
            <strong className="font-medium">{services.observationInterpreter.name}</strong>
          </span>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="API externa de integração"
          description="Para o sistema de gestão e integradores. Exige Authorization: Bearer com a chave VITALIS_API_KEY. Somente leitura e validação — nada aqui altera guias."
        />
        <Endpoint
          method="POST"
          path="/api/v1/guides/validate"
          description="Calcula a decisão de uma guia enviada no corpo, usando os nomes de coluna do CSV. Não cria, não altera e não versiona nenhuma guia: é uma consulta. Responde 200 com a decisão mesmo quando encontra problemas, 400 para JSON inválido, 401 sem credencial e 422 quando a guia não pode ser interpretada."
        />
        <Endpoint
          method="GET"
          path="/api/v1/guides"
          description="Lista guias validadas, com filtros por status, unidade, convênio e busca."
        />
        <Endpoint
          method="GET"
          path="/api/v1/guides/{id}"
          description="Retorna a decisão registrada de uma guia, seus problemas e o histórico de validações."
        />
        <Endpoint
          method="GET"
          path="/api/v1/reports/weekly"
          description="Resumo executivo de uma semana, comparado com a semana anterior."
        />
      </Card>

      <Card>
        <CardHeader
          title="Endpoints internos do painel"
          description="Alcançados pelo navegador com o cookie de sessão, nunca com chave de API. É a única superfície que grava dados operacionais."
        />
        <Endpoint
          method="POST"
          path="/api/internal/imports/csv"
          description="Importa um lote de guias a partir de um CSV, com upsert por id_guia e versionamento por conteúdo. Exige sessão ativa."
        />
        <Endpoint
          method="GET"
          path="/api/internal/guides/export"
          description="Exporta as guias prontas ou as pendências em CSV. Exige sessão ativa."
        />
        <Endpoint
          method="GET"
          path="/api/health"
          description="Público e mínimo: informa apenas se a aplicação e o banco respondem."
        />
      </Card>

      <Card>
        <CardHeader
          title="Servidor MCP"
          description="Streamable HTTP, stateless, autenticado por Bearer. As tools chamam exatamente os mesmos casos de uso da aplicação web."
        />
        <Endpoint
          method="POST"
          path="/mcp"
          description="Endpoint remoto do Model Context Protocol. Exige Authorization: Bearer com a chave VITALIS_MCP_API_KEY; sem ela a resposta é 401 e nem a lista de tools é revelada. Tools disponíveis: consultar_regra_convenio, verificar_guia, consultar_guia e resumo_operacional — todas somente de leitura, nenhuma altera, aprova ou exclui guias."
        />
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
            ingestão — CSV, seed ou uma futura integração — passa pelo mesmo caso de uso, então
            nenhuma regra precisa ser reescrita para ligar o sistema de gestão. Os endpoints do
            sistema da clínica não estão definidos aqui porque ainda não existem; o que existe é
            o ponto de entrada deste lado.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Regras modeladas que ainda não são aplicadas"
          description="Faltam dados para verificá-las sem inventar informação."
        />
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
      </Card>
    </>
  );
}
