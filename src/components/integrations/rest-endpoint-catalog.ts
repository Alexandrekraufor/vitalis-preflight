/**
 * The REST surface as it is documented on screen.
 *
 * Every entry here mirrors a handler under `src/app/api`: the parameters are
 * the ones its Zod schema accepts, and the status codes are the ones
 * `src/lib/api-problem.ts` maps. Nothing is aspirational - an endpoint that
 * does not exist does not appear.
 */
export type EndpointAccess = "API_KEY" | "SESSION" | "PUBLIC";

export interface EndpointParameter {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
}

export interface EndpointStatus {
  readonly code: number;
  readonly meaning: string;
}

export interface RestEndpoint {
  readonly id: string;
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly access: EndpointAccess;
  readonly summary: string;
  readonly detail: string;
  readonly parameters: readonly EndpointParameter[];
  readonly statuses: readonly EndpointStatus[];
  readonly rateLimit: string;
  readonly request?: string;
  readonly response: string;
}

const BASE = "http://localhost:3000";

/**
 * The guide used in every example, exported so a test can prove that the
 * payload in the documentation really is a guide this system accepts. A
 * documented request that fails is a failure of ours.
 */
export const GUIDE_EXAMPLE = `{
  "id_guia": "G-2609-0001",
  "unidade": "Centro",
  "data_atendimento": "02/09/2026",
  "paciente": "P-1042",
  "convenio": "Vitalcard",
  "carteirinha": "0881234567",
  "cid": "M54.5",
  "procedimento_codigo": "50000470",
  "procedimento_descricao": "Sessão de fisioterapia musculoesquelética",
  "numero_autorizacao": "AUT900001",
  "autorizacao_validade": "2026-09-30",
  "autorizacao_sessoes_limite": "10",
  "sessao_numero_na_autorizacao": "2",
  "profissional": "Ana Prado",
  "profissional_registro": "CREFITO-3 12345-F",
  "valor": "85,00",
  "data_lancamento": "02/09/2026"
}`;

const VALIDATE_REQUEST = `curl -sS -X POST ${BASE}/api/v1/guides/validate \
  -H "Authorization: Bearer $VITALIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '${GUIDE_EXAMPLE}'`;

const VALIDATE_RESPONSE = `{
  "idGuia": "G-2609-0001",
  "status": "NEEDS_CORRECTION",
  "statusLabel": "Precisa corrigir",
  "canSubmit": false,
  "amountAtRisk": 85,
  "summary": "Corrigir antes do envio: O valor lançado (R$ 85,00) difere da tabela de referência (R$ 62,00).",
  "findings": [
    {
      "code": "AMOUNT_DIFFERS_FROM_REFERENCE",
      "severity": "BLOCKING",
      "field": "valor",
      "message": "O valor lançado (R$ 85,00) difere da tabela de referência (R$ 62,00).",
      "expected": "R$ 62,00",
      "actual": "R$ 85,00",
      "source": "REFERENCE_TABLE",
      "evidence": null,
      "recommendedAction": "Ajustar o valor para a tabela vigente ou justificar a diferença."
    }
  ],
  "recommendedActions": [
    "Ajustar o valor para a tabela vigente ou justificar a diferença."
  ],
  "whyItFell": [
    "O valor lançado (R$ 85,00) difere da tabela de referência (R$ 62,00)."
  ],
  "normalizations": [
    {
      "field": "data_atendimento",
      "kind": "DATE_REFORMATTED",
      "from": "02/09/2026",
      "to": "2026-09-02",
      "reason": "Data no formato DD/MM/AAAA convertida para AAAA-MM-DD."
    },
    {
      "field": "valor",
      "kind": "DECIMAL_SEPARATOR",
      "from": "85,00",
      "to": "85.00",
      "reason": "Vírgula decimal convertida para ponto."
    },
    {
      "field": "data_lancamento",
      "kind": "DATE_REFORMATTED",
      "from": "02/09/2026",
      "to": "2026-09-02",
      "reason": "Data no formato DD/MM/AAAA convertida para AAAA-MM-DD."
    }
  ],
  "observation": null,
  "rules": {
    "version": "agosto/2026",
    "hash": "0d5dd3b113492b9f08b9a644a7b3bd3861d4957ddda351843a70555ea04341c9"
  }
}`;

const LIST_RESPONSE = `{
  "total": 30,
  "guides": [
    {
      "idGuia": "G-2608-0028",
      "unit": "Norte",
      "convention": "Saúde Interior",
      "patient": "P-1042",
      "procedureCode": "50000470",
      "procedureDescription": "Sessão de fisioterapia musculoesquelética",
      "appointmentDate": "2026-08-27",
      "amount": 62,
      "status": "NEEDS_CORRECTION",
      "amountAtRisk": 62,
      "primaryFindingCode": "AUTHORIZATION_EXPIRED",
      "primaryFinding": "A autorização venceu em 18/08/2026, mas o atendimento ocorreu em 27/08/2026.",
      "validatedAt": "2026-09-20T03:24:49.584Z"
    }
  ]
}`;

const DETAIL_RESPONSE = `{
  "guide": {
    "id_guia": "G-2608-0028",
    "unidade": "Norte",
    "data_atendimento": "2026-08-27",
    "convenio": "Saúde Interior",
    "carteirinha": "984531678",
    "procedimento_codigo": "50000470",
    "numero_autorizacao": "AUT457263",
    "autorizacao_validade": "2026-08-18",
    "valor": "62.00"
  },
  "status": "NEEDS_CORRECTION",
  "statusLabel": "Precisa corrigir",
  "canSubmit": false,
  "amountAtRisk": 62,
  "summary": "Corrigir antes do envio: A autorização venceu em 18/08/2026, mas o atendimento ocorreu em 27/08/2026.",
  "whyItFell": ["A autorização venceu em 18/08/2026, mas o atendimento ocorreu em 27/08/2026."],
  "findings": [
    {
      "code": "AUTHORIZATION_EXPIRED",
      "severity": "BLOCKING",
      "field": "autorizacao_validade",
      "expected": "Validade em 27/08/2026 ou depois",
      "actual": "18/08/2026"
    }
  ],
  "recommendedActions": ["Registrar a autorização vigente na data do atendimento antes do envio."],
  "normalizations": [],
  "observation": { "interpreter": "heuristic", "model": null },
  "rules": { "version": "agosto/2026", "hash": "c52a5a00…" },
  "validatedAt": "2026-09-20T03:24:49.584Z",
  "history": [
    {
      "id": "6e74f7df-f8d3-4756-beb7-9afc8a2ee62b",
      "status": "NEEDS_CORRECTION",
      "versionNumber": 1,
      "rulesVersion": "agosto/2026",
      "amountAtRisk": 62,
      "completedAt": "2026-09-20T03:24:49.584Z"
    }
  ]
}`;

const INGEST_RESPONSE = `{
  "importId": "342e2988-3815-4067-8caf-db974eb43753",
  "received": 1,
  "imported": 1,
  "rejected": 0,
  "newVersions": 1,
  "normalizations": 3,
  "results": [
    {
      "idGuia": "G-2609-0001",
      "status": "NEEDS_CORRECTION",
      "statusLabel": "Precisa corrigir",
      "canSubmit": false,
      "amountAtRisk": 85,
      "summary": "Corrigir antes do envio: O valor lançado (R$ 85,00) difere da tabela de referência (R$ 62,00).",
      "findings": [
        {
          "code": "AMOUNT_DIFFERS_FROM_REFERENCE",
          "severity": "BLOCKING",
          "field": "valor",
          "message": "O valor lançado (R$ 85,00) difere da tabela de referência (R$ 62,00).",
          "expected": "R$ 62,00",
          "actual": "R$ 85,00",
          "source": "REFERENCE_TABLE",
          "evidence": null,
          "recommendedAction": "Ajustar o valor para a tabela vigente ou justificar a diferença."
        }
      ],
      "recommendedActions": ["Ajustar o valor para a tabela vigente ou justificar a diferença."],
      "whyItFell": ["O valor lançado (R$ 85,00) difere da tabela de referência (R$ 62,00)."],
      "normalizations": [
        {
          "field": "data_atendimento",
          "kind": "DATE_REFORMATTED",
          "from": "02/09/2026",
          "to": "2026-09-02",
          "reason": "Data no formato DD/MM/AAAA convertida para AAAA-MM-DD."
        }
      ],
      "observation": null,
      "rules": { "version": "agosto/2026", "hash": "0d5dd3b113492b9f08b9a644a7b3bd3861d4957ddda351843a70555ea04341c9" },
      "versionNumber": 1,
      "createdNewVersion": true
    }
  ],
  "rejectedRecords": []
}`;

const GROUPED_REPORT_RESPONSE = `{
  "groupBy": "unit",
  "reports": [
    {
      "period": { "from": "2026-07-30", "through": "2026-08-28" },
      "days": 30,
      "scope": { "unit": "Centro", "convention": null },
      "problemShare": 0.37037037037037035,
      "summary": {
        "total": 27,
        "readyToSubmit": 17,
        "needsCorrection": 9,
        "reviewRequired": 1,
        "amountAtRisk": 750,
        "amountProtected": 1138,
        "amountBilled": 1888,
        "topProblems": [
          {
            "code": "AUTHORIZATION_EXPIRED",
            "label": "Autorização vencida",
            "guides": 3,
            "amountAtRisk": 202
          }
        ],
        "byUnit": [
          {
            "unit": "Centro",
            "total": 27,
            "readyToSubmit": 17,
            "needsCorrection": 9,
            "reviewRequired": 1,
            "amountAtRisk": 750,
            "topConvention": "Vitalcard"
          }
        ],
        "byConvention": [
          {
            "convention": "Vitalcard",
            "total": 14,
            "readyToSubmit": 9,
            "needsCorrection": 4,
            "reviewRequired": 1,
            "amountAtRisk": 440,
            "amountBilled": 1066
          }
        ]
      },
      "previous": null,
      "portfolioGuides": 27
    }
  ]
}`;

const WEEKLY_RESPONSE = `{
  "period": { "from": "2026-08-24", "through": "2026-08-30" },
  "days": 7,
  "scope": { "unit": null, "convention": null },
  "problemShare": 0.25925925925925924,
  "summary": {
    "total": 27,
    "readyToSubmit": 20,
    "needsCorrection": 6,
    "reviewRequired": 1,
    "amountAtRisk": 470,
    "amountProtected": 1381,
    "amountBilled": 1851,
    "topProblems": [
      {
        "code": "AUTHORIZATION_EXPIRED",
        "label": "Autorização vencida",
        "guides": 3,
        "amountAtRisk": 186
      }
    ],
    "byUnit": [
      {
        "unit": "Centro",
        "total": 9,
        "readyToSubmit": 8,
        "needsCorrection": 0,
        "reviewRequired": 1,
        "amountAtRisk": 90,
        "topConvention": "Vitalcard"
      }
    ],
    "byConvention": [
      {
        "convention": "Vitalcard",
        "total": 14,
        "readyToSubmit": 9,
        "needsCorrection": 4,
        "reviewRequired": 1,
        "amountAtRisk": 440,
        "amountBilled": 1066
      }
    ]
  },
  "previous": { "guidesChecked": 21, "problemShare": 0.5238095238095238, "amountAtRisk": 770 },
  "portfolioGuides": 80
}`;

export const REST_ENDPOINTS: readonly RestEndpoint[] = [
  {
    id: "validate",
    method: "POST",
    path: "/api/v1/guides/validate",
    access: "API_KEY",
    summary: "Calcula a decisão de uma guia sem gravar nada.",
    detail:
      "Recebe uma guia nos nomes de coluna do CSV e devolve a decisão do motor determinístico. Seis campos são obrigatórios para a guia ser interpretada: id_guia, unidade, data_atendimento, paciente, convenio e procedimento_codigo. Todo o resto pode vir vazio, nulo ou ausente, e o que faltar vira finding em vez de erro.  Não cria, não atualiza e não versiona nenhuma guia - chamar mil vezes não muda um byte dos dados operacionais. Campos desconhecidos são ignorados em vez de rejeitados. Datas são aceitas em AAAA-MM-DD ou DD/MM/AAAA e valores com ponto ou vírgula; a conversão volta declarada em normalizations. Encontrar problema é o endpoint funcionando: a resposta é 200 mesmo quando a guia está bloqueada.",
    parameters: [
      {
        name: "corpo",
        type: "objeto JSON",
        required: true,
        description:
          "As 18 colunas da guia. Qualquer campo pode faltar - campo obrigatório ausente vira finding, não erro.",
      },
      { name: "Content-Type", type: "header", required: true, description: "application/json" },
    ],
    statuses: [
      { code: 200, meaning: "Preflight executado. Leia status e findings para saber o resultado." },
      { code: 400, meaning: "INVALID_JSON ou INVALID_PAYLOAD - o corpo não é um objeto JSON legível." },
      { code: 401, meaning: "UNAUTHORIZED - credencial ausente ou inválida." },
      { code: 413, meaning: "PAYLOAD_TOO_LARGE - corpo acima de 64 KB." },
      { code: 422, meaning: "UNPROCESSABLE_GUIDE - o payload não pôde ser interpretado como guia." },
      { code: 429, meaning: "RATE_LIMITED - veja o header Retry-After." },
    ],
    rateLimit: "60 requisições por minuto, por origem.",
    request: VALIDATE_REQUEST,
    response: VALIDATE_RESPONSE,
  },
  {
    id: "ingest",
    method: "POST",
    path: "/api/v1/guides",
    access: "API_KEY",
    summary: "Injeta guias do sistema de gestão e devolve a decisão de cada uma.",
    detail:
      "Aceita um objeto ou um array de até 500 guias, nos nomes de coluna do CSV. Seis campos são obrigatórios para a guia ser interpretada: id_guia, unidade, data_atendimento, paciente, convenio e procedimento_codigo. Todo o resto pode vir vazio, nulo ou ausente, e o que faltar vira finding em vez de erro. Uma linha que não puder ser interpretada volta em rejectedRecords com o índice dentro do lote, o id e o campo que faltou, e não derruba o restante. Passa pelo mesmo caso de uso do upload de CSV, com upsert por id_guia e versionamento por conteúdo: reenviar a mesma guia não duplica nem cria versão nova. A resposta traz a decisão de cada guia que entrou e o motivo de cada uma que não entrou, então o sistema chamador age na hora, sem precisar consultar depois. Exige chave com permissão de escrita.",
    parameters: [
      {
        name: "corpo",
        type: "objeto ou array de objetos",
        required: true,
        description: "As 18 colunas de cada guia. Campo obrigatório ausente vira finding, não erro.",
      },
      { name: "Content-Type", type: "header", required: true, description: "application/json" },
    ],
    statuses: [
      { code: 201, meaning: "Lote inteiro aceito." },
      { code: 207, meaning: "Parte do lote entrou; rejectedRecords diz o que faltou em cada linha." },
      { code: 400, meaning: "INVALID_JSON ou INVALID_PAYLOAD - o corpo não é guia nem lista de guias." },
      { code: 401, meaning: "UNAUTHORIZED - credencial ausente ou inválida." },
      { code: 403, meaning: "FORBIDDEN - a chave existe, mas não tem permissão de escrita." },
      { code: 413, meaning: "PAYLOAD_TOO_LARGE - corpo acima de 2 MB ou mais de 500 guias." },
      { code: 429, meaning: "RATE_LIMITED - veja o header Retry-After." },
    ],
    rateLimit: "30 requisições por minuto, por origem.",
    request: `curl -sS -X POST ${BASE}/api/v1/guides \
  -H "Authorization: Bearer $VITALIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[${GUIDE_EXAMPLE}]'`,
    response: INGEST_RESPONSE,
  },
  {
    id: "guides",
    method: "GET",
    path: "/api/v1/guides",
    access: "API_KEY",
    summary: "Lista as guias já validadas, com filtros.",
    detail:
      "Devolve a decisão registrada de cada guia, da data de atendimento mais recente para a mais antiga. É a mesma leitura que alimenta a tela de Guias.",
    parameters: [
      {
        name: "status",
        type: "READY_TO_SUBMIT | NEEDS_CORRECTION | REVIEW_REQUIRED",
        required: false,
        description: "Filtra pela decisão gravada.",
      },
      {
        name: "unit",
        type: "Centro | Norte | Sul",
        required: false,
        description: "Filtra pela unidade da clínica.",
      },
      {
        name: "convention",
        type: "string",
        required: false,
        description: "Nome do convênio, exatamente como nas regras vigentes.",
      },
      {
        name: "search",
        type: "string",
        required: false,
        description: "Busca parcial no id da guia ou no código do paciente.",
      },
      {
        name: "from",
        type: "AAAA-MM-DD",
        required: false,
        description: "Primeiro dia da janela de atendimento, inclusive.",
      },
      {
        name: "through",
        type: "AAAA-MM-DD",
        required: false,
        description: "Último dia da janela de atendimento, inclusive.",
      },
      {
        name: "limit",
        type: "inteiro 1-1000",
        required: false,
        description: "Teto de linhas. Padrão: 1000.",
      },
    ],
    statuses: [
      { code: 200, meaning: "Lista devolvida, possivelmente vazia." },
      { code: 400, meaning: "INVALID_PAYLOAD - parâmetro fora do domínio aceito." },
      { code: 401, meaning: "UNAUTHORIZED - credencial ausente ou inválida." },
      { code: 429, meaning: "RATE_LIMITED - veja o header Retry-After." },
    ],
    rateLimit: "120 requisições por minuto, por origem.",
    request: `curl -sS "http://localhost:3000/api/v1/guides?status=NEEDS_CORRECTION&unit=Norte&limit=50" \\
  -H "Authorization: Bearer $VITALIS_API_KEY"`,
    response: LIST_RESPONSE,
  },
  {
    id: "guide-detail",
    method: "GET",
    path: "/api/v1/guides/{id}",
    access: "API_KEY",
    summary: "Retorna uma guia registrada, com findings e histórico.",
    detail:
      "Mostra a decisão como ela foi gravada - não reexecuta as regras. A resposta traz a guia normalizada, o porquê da decisão, as ações recomendadas, as normalizações aplicadas na entrada e o histórico de validações, versão a versão.",
    parameters: [
      {
        name: "id",
        type: "string no caminho",
        required: true,
        description: "Identificador da guia. Ex.: G-2608-0028.",
      },
    ],
    statuses: [
      { code: 200, meaning: "Guia encontrada." },
      { code: 401, meaning: "UNAUTHORIZED - credencial ausente ou inválida." },
      { code: 404, meaning: "NOT_FOUND - não existe guia com esse id." },
      { code: 429, meaning: "RATE_LIMITED - veja o header Retry-After." },
    ],
    rateLimit: "120 requisições por minuto, por origem.",
    request: `curl -sS http://localhost:3000/api/v1/guides/G-2608-0028 \\
  -H "Authorization: Bearer $VITALIS_API_KEY"`,
    response: DETAIL_RESPONSE,
  },
  {
    id: "reports",
    method: "GET",
    path: "/api/v1/reports",
    access: "API_KEY",
    summary: "Relatório executivo de qualquer período, inteiro ou fatiado.",
    detail:
      "Uma chamada responde pela clínica toda, por uma unidade, por um convênio, ou por todas as fatias de uma vez com group_by. Cada relatório carrega a própria comparação com a janela anterior do mesmo tamanho, então um array de relatórios é utilizável sem o integrador refazer conta. Valores em reais.",
    parameters: [
      {
        name: "days",
        type: "inteiro 1-366",
        required: false,
        description: "Tamanho da janela. Padrão: 7. Ignorado quando from é informado.",
      },
      {
        name: "from",
        type: "AAAA-MM-DD",
        required: false,
        description: "Primeiro dia da janela. Com through, define o tamanho.",
      },
      {
        name: "through",
        type: "AAAA-MM-DD",
        required: false,
        description: "Último dia da janela. Sem ele, usa o atendimento mais recente.",
      },
      {
        name: "unit",
        type: "Centro | Norte | Sul",
        required: false,
        description: "Recorta o relatório inteiro por unidade.",
      },
      {
        name: "convention",
        type: "string",
        required: false,
        description: "Recorta o relatório inteiro por convênio.",
      },
      {
        name: "group_by",
        type: "unit | convention",
        required: false,
        description: "Devolve um array com um relatório por unidade ou por convênio.",
      },
    ],
    statuses: [
      { code: 200, meaning: "Relatório devolvido. period é null quando ainda não há guias validadas." },
      { code: 400, meaning: "INVALID_PAYLOAD - data fora do formato ou unidade inexistente." },
      { code: 401, meaning: "UNAUTHORIZED - credencial ausente ou inválida." },
      { code: 429, meaning: "RATE_LIMITED - veja o header Retry-After." },
    ],
    rateLimit: "120 requisições por minuto, por origem.",
    request: `curl -sS "${BASE}/api/v1/reports?days=30&group_by=unit" \
  -H "Authorization: Bearer $VITALIS_API_KEY"`,
    response: GROUPED_REPORT_RESPONSE,
  },
  {
    id: "weekly",
    method: "GET",
    path: "/api/v1/reports/weekly",
    access: "API_KEY",
    summary: "Atalho para a semana: o mesmo relatório com days=7.",
    detail:
      "A mesma apuração do relatório executivo da tela: quantas guias foram verificadas, quantas passaram, o valor em risco e o protegido, os problemas mais frequentes e a comparação entre unidades. Valores em reais.",
    parameters: [
      {
        name: "through",
        type: "AAAA-MM-DD",
        required: false,
        description:
          "Último dia da semana desejada. Sem o parâmetro, usa a semana mais recente com guias.",
      },
    ],
    statuses: [
      { code: 200, meaning: "Relatório devolvido. period é null quando ainda não há guias validadas." },
      { code: 400, meaning: "INVALID_PAYLOAD - through não é uma data AAAA-MM-DD." },
      { code: 401, meaning: "UNAUTHORIZED - credencial ausente ou inválida." },
      { code: 429, meaning: "RATE_LIMITED - veja o header Retry-After." },
    ],
    rateLimit: "120 requisições por minuto, por origem.",
    request: `curl -sS "http://localhost:3000/api/v1/reports/weekly?through=2026-08-30" \\
  -H "Authorization: Bearer $VITALIS_API_KEY"`,
    response: WEEKLY_RESPONSE,
  },
];

export const INTERNAL_ENDPOINTS: readonly RestEndpoint[] = [
  {
    id: "import-csv",
    method: "POST",
    path: "/api/internal/imports/csv",
    access: "SESSION",
    summary: "Importa um lote de guias a partir de um CSV.",
    detail:
      "A única superfície que grava dados operacionais. Faz upsert por id_guia e versiona por conteúdo: reenviar o mesmo arquivo não cria versão nova. Alcançada pelo navegador com o cookie de sessão - chave de API não abre esta porta.",
    parameters: [
      {
        name: "arquivo",
        type: "multipart/form-data",
        required: true,
        description: "CSV de até 5 MB e 20.000 linhas.",
      },
    ],
    statuses: [
      { code: 200, meaning: "Importação concluída; o corpo traz o que entrou e o que foi normalizado." },
      { code: 401, meaning: "UNAUTHORIZED - sem sessão válida." },
      { code: 413, meaning: "PAYLOAD_TOO_LARGE - arquivo acima do limite." },
      { code: 422, meaning: "INVALID_FILE - o CSV não pôde ser lido." },
    ],
    rateLimit: "Compartilha o limite da sessão do painel.",
    response: `{ "imported": 80, "newVersions": 3, "unchanged": 77, "normalizations": 3 }`,
  },
  {
    id: "export",
    method: "GET",
    path: "/api/internal/guides/export",
    access: "SESSION",
    summary: "Exporta guias prontas ou pendências em CSV.",
    detail:
      "Gera o CSV que a recepção abre no Excel. Fórmulas são neutralizadas na saída: um campo iniciado por =, +, - ou @ é prefixado, para que a planilha não execute o conteúdo de uma guia.",
    parameters: [
      {
        name: "status",
        type: "READY_TO_SUBMIT | NEEDS_CORRECTION | REVIEW_REQUIRED",
        required: false,
        description: "Recorta a exportação por decisão.",
      },
    ],
    statuses: [
      { code: 200, meaning: "CSV devolvido como text/csv." },
      { code: 401, meaning: "UNAUTHORIZED - sem sessão válida." },
    ],
    rateLimit: "Compartilha o limite da sessão do painel.",
    response: `id_guia,unidade,convenio,status,valor_em_risco,problemas
G-2608-0028,Norte,Saúde Interior,NEEDS_CORRECTION,62.00,AUTHORIZATION_EXPIRED`,
  },
  {
    id: "health",
    method: "GET",
    path: "/api/health",
    access: "PUBLIC",
    summary: "Liveness mínimo, sem credencial.",
    detail:
      "Diz apenas se a aplicação responde, se o banco responde e se as regras carregaram. Versão e hash das regras são detalhe operacional e ficam atrás da autenticação.",
    parameters: [],
    statuses: [
      { code: 200, meaning: "ok - aplicação e banco respondem." },
      { code: 503, meaning: "degraded - banco fora ou regras não carregadas." },
    ],
    rateLimit: "Sem limite dedicado.",
    request: "curl -sS http://localhost:3000/api/health",
    response: `{ "status": "ok", "database": "up", "rules": "loaded", "checkedAt": "2026-09-20T03:24:49.584Z" }`,
  },
];
