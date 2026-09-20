import { KeyRound } from "lucide-react";

import type { EvaluationCredential } from "@/application/ports/access-repository.port";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CodeSample } from "@/components/ui/code-sample";
import { apiSurfaceLabel } from "@/domain/access/api-credential";

interface EvaluationAccessProps {
  readonly credentials: readonly EvaluationCredential[];
  readonly baseUrl: string;
  readonly surface: "REST" | "MCP";
}

const GUIDE_EXAMPLE = `{
  "id_guia": "G-AVALIACAO-001",
  "unidade": "Centro",
  "data_atendimento": "20/08/2026",
  "paciente": "P-9999",
  "convenio": "Vitalcard",
  "carteirinha": "0887654321",
  "cid": "M54.5",
  "procedimento_codigo": "50000470",
  "procedimento_descricao": "Sessão de fisioterapia musculoesquelética",
  "numero_autorizacao": "AUT999001",
  "autorizacao_validade": "2026-09-30",
  "autorizacao_sessoes_limite": "10",
  "sessao_numero_na_autorizacao": "3",
  "profissional": "Ana Prado",
  "profissional_registro": "CREFITO-3 12345-F",
  "valor": "62,00",
  "data_lancamento": "21/08/2026"
}`;

const READY_RESPONSE = `{
  "idGuia": "G-AVALIACAO-001",
  "status": "READY_TO_SUBMIT",
  "statusLabel": "Pronta para envio",
  "canSubmit": true,
  "amountAtRisk": 0,
  "summary": "Nenhum problema encontrado nas regras vigentes.",
  "findings": [],
  "recommendedActions": [],
  "whyItFell": [],
  "normalizations": [
    {
      "field": "data_atendimento",
      "kind": "DATE_REFORMATTED",
      "from": "20/08/2026",
      "to": "2026-08-20",
      "reason": "Data no formato DD/MM/AAAA convertida para AAAA-MM-DD."
    },
    {
      "field": "valor",
      "kind": "DECIMAL_SEPARATOR",
      "from": "62,00",
      "to": "62.00",
      "reason": "Vírgula decimal convertida para ponto."
    }
  ],
  "observation": null,
  "rules": { "version": "agosto/2026", "hash": "0d5dd3b113492b9f…" }
}`;

const BLOCKED_RESPONSE = `{
  "idGuia": "G-AVALIACAO-001",
  "status": "NEEDS_CORRECTION",
  "statusLabel": "Precisa corrigir",
  "canSubmit": false,
  "amountAtRisk": 62,
  "summary": "Corrigir antes do envio: A autorização venceu em 10/08/2026, mas o atendimento ocorreu em 20/08/2026.",
  "findings": [
    {
      "code": "AUTHORIZATION_EXPIRED",
      "severity": "BLOCKING",
      "field": "autorizacao_validade",
      "message": "A autorização venceu em 10/08/2026, mas o atendimento ocorreu em 20/08/2026.",
      "expected": "Validade em 20/08/2026 ou depois",
      "actual": "10/08/2026",
      "source": "CONVENTION_RULE",
      "evidence": null,
      "recommendedAction": "Registrar a autorização vigente na data do atendimento antes do envio."
    }
  ],
  "recommendedActions": [
    "Registrar a autorização vigente na data do atendimento antes do envio."
  ],
  "whyItFell": [
    "A autorização venceu em 10/08/2026, mas o atendimento ocorreu em 20/08/2026."
  ],
  "normalizations": [],
  "observation": null,
  "rules": { "version": "agosto/2026", "hash": "0d5dd3b113492b9f…" }
}`;

/**
 * Everything an external reviewer needs to exercise the machine surfaces.
 *
 * The key is shown in full here, and only here, because this credential exists
 * for an assessment: it reads, it cannot write, and it is rotated by running
 * the provisioning script again. Every other key in the system keeps only its
 * digest.
 */
export function EvaluationAccess({ credentials, baseUrl, surface }: EvaluationAccessProps) {
  const credential = credentials.find((entry) => entry.surface === surface) ?? null;

  if (credential === null) {
    return (
      <Card>
        <CardHeader
          title="Chave de avaliação"
          description="Nenhuma credencial de avaliação provisionada nesta instalação."
        />
        <CardBody className="text-sm leading-relaxed text-ink-muted">
          Rode <code className="font-mono text-xs text-ink">pnpm seed:evaluator</code> no servidor
          para criar a conta de avaliação e gerar as chaves de leitura.
        </CardBody>
      </Card>
    );
  }

  const curl =
    surface === "REST"
      ? `curl -sS -X POST ${baseUrl}/api/v1/guides/validate \\
  -H "Authorization: Bearer ${credential.secret}" \\
  -H "Content-Type: application/json" \\
  -d '${GUIDE_EXAMPLE}'`
      : `curl -sS -X POST ${baseUrl}/mcp \\
  -H "Authorization: Bearer ${credential.secret}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`;

  return (
    <Card>
      <CardHeader
        title={`Chave de avaliação · ${apiSurfaceLabel(credential.surface)}`}
        description="Credencial de leitura, criada para avaliação. Não grava nada e pode ser rotacionada a qualquer momento."
      />

      <CardBody className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-lg border border-brand/25 bg-brand-soft px-4 py-3">
          <KeyRound aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
          <p className="text-sm leading-relaxed text-ink">
            Esta é a única chave do sistema exibida por inteiro na tela, porque existe para ser
            usada por quem está avaliando. As chaves de produção são guardadas apenas como digest
            e aparecem uma única vez, no momento da criação.
          </p>
        </div>

        <CodeSample caption="Chave" code={credential.secret} />

        {surface === "REST" ? (
          <>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Endpoint
                </dt>
                <dd className="font-mono text-xs text-ink">
                  {baseUrl}/api/v1/guides/validate
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Método
                </dt>
                <dd className="font-mono text-xs text-ink">POST</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Content-Type
                </dt>
                <dd className="font-mono text-xs text-ink">application/json</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Authorization
                </dt>
                <dd className="font-mono text-xs text-ink">Bearer &lt;chave acima&gt;</dd>
              </div>
            </dl>

            <CodeSample caption="Chamada completa" code={curl} />
            <CodeSample caption="Guia de exemplo" language="json" code={GUIDE_EXAMPLE} />
            <CodeSample
              caption="Resposta quando a guia passa"
              language="json"
              code={READY_RESPONSE}
            />
            <CodeSample
              caption="Resposta quando a guia trava (autorizacao_validade em 2026-08-10)"
              language="json"
              code={BLOCKED_RESPONSE}
            />

            <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-ink-muted">
              <li>
                <strong className="font-medium text-ink">Validar não persiste.</strong> Esta rota
                calcula a decisão e não cria, altera nem versiona guia alguma.
              </li>
              <li>
                <strong className="font-medium text-ink">Problema de negócio devolve 200.</strong>{" "}
                Encontrar pendência é a rota funcionando; a decisão está em{" "}
                <code className="font-mono text-xs text-ink">status</code>.
              </li>
              <li>
                <strong className="font-medium text-ink">Payload inválido devolve erro HTTP.</strong>{" "}
                400 para JSON quebrado, 422 quando o corpo não pode ser lido como guia, 401 sem
                credencial.
              </li>
            </ul>
          </>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Endpoint
                </dt>
                <dd className="font-mono text-xs text-ink">{baseUrl}/mcp</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Transporte
                </dt>
                <dd className="font-mono text-xs text-ink">Streamable HTTP, stateless</dd>
              </div>
            </dl>

            <CodeSample caption="Listar as tools" code={curl} />
            <CodeSample
              caption="Cliente MCP com esta chave"
              language="json"
              code={JSON.stringify(
                {
                  mcpServers: {
                    "vitalis-preflight": {
                      type: "http",
                      url: `${baseUrl}/mcp`,
                      headers: { Authorization: `Bearer ${credential.secret}` },
                    },
                  },
                },
                null,
                2,
              )}
            />
            <p className="text-sm leading-relaxed text-ink-muted">
              Quem preferir não copiar chave nenhuma pode apontar o cliente para{" "}
              <code className="font-mono text-xs text-ink">{baseUrl}/mcp</code> e seguir o fluxo
              OAuth: o cliente se registra sozinho e pede autorização nesta mesma conta.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
