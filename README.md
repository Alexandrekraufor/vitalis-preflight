# Vitalis Preflight

Camada de prevenção que confere as guias de convênio da Clínica Vitalis **antes** do envio.

> Nenhuma guia segue para o convênio sem passar pelo preflight.

---

## O problema

A recepção lança guias no sistema de gestão. A conferência acontece tarde e manualmente, e o erro só aparece quando o convênio glosa — quando o dinheiro já foi perdido e o retrabalho já é maior.

Três pessoas precisam de respostas diferentes sobre os mesmos dados:

| Quem | Pergunta |
| --- | --- |
| Recepção | Esta guia está pronta? Se não, o que eu corrijo? |
| Carla, gerente | Quais são as exceções que eu preciso trabalhar hoje, e quanto valem? |
| Dr. Renato, proprietário | Quanto estamos protegendo, qual o erro mais comum, como estão as unidades? |
| Agentes de IA | As mesmas perguntas, via MCP. |

## A solução

Cada guia passa por um motor determinístico de regras dos convênios e recebe uma de três decisões:

| Estado | Na tela | Significado |
| --- | --- | --- |
| `READY_TO_SUBMIT` | Pronta para envio | Nenhum problema nas regras vigentes |
| `NEEDS_CORRECTION` | Precisa corrigir | Problema objetivo, corrigível antes do envio |
| `REVIEW_REQUIRED` | Revisão humana | Dados contraditórios ou situação que uma regra não resolve |

Com o dataset que acompanha o projeto (80 guias de agosto/2026):

```
80 guias importadas
48 prontas para envio
30 precisam correção
 2 precisam revisão
 3 normalizações automáticas
```

Esses números são calculados, não fixos. Importe um arquivo diferente e eles mudam.

## Como rodar

Requisitos: Node 20+, pnpm e Docker.

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm seed
pnpm bootstrap:admin   # cria o primeiro administrador (pergunta e-mail, nome e senha)
pnpm dev
```

A aplicação sobe em <http://localhost:3000>. **Não existe cadastro aberto**: entre com a conta criada pelo `bootstrap:admin` e convide o resto da equipe em *Configurações -> Equipe*.

Para exercitar a API externa e o MCP, gere as credenciais e coloque no `.env`:

```bash
openssl rand -base64 48   # VITALIS_API_KEY
openssl rand -base64 48   # VITALIS_MCP_API_KEY
```

### Scripts

| Comando | O que faz |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `typecheck` / `test` / `test:watch` | Qualidade |
| `pnpm verify` | lint + typecheck + test + build |
| `pnpm db:up` / `db:down` | PostgreSQL 16 via Docker Compose |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Drizzle |
| `pnpm seed` | Importa `data/source/guias.csv` pelo mesmo caminho da tela de upload |
| `pnpm bootstrap:admin` | Cria o primeiro administrador (único caminho sem convite) |

## Telas

| Rota | Para quem |
| --- | --- |
| `/` | Operação: verificadas, prontas, a corrigir, em revisão, valor em risco, causas, unidades, fila de trabalho |
| `/guias` | Lista filtrável por status, unidade, convênio e busca |
| `/guias/[id]` | Decisão, **por que essa guia caiu**, problemas com evidência, dados, normalizações, versão das regras, histórico |
| `/importar` | Upload de CSV, resumo da importação e exportação das prontas / pendências |
| `/relatorio/terca` | Relatório executivo da semana, com comparação com a anterior |
| `/integracoes` | Endpoints, estado do banco e das regras, e o que ainda não é validado |
| `/configuracoes/equipe` | **Só administradores.** Membros, níveis, convites pendentes |
| `/login` · `/invite/[token]` | Entrada e aceite de convite, sem navegação |

## Acesso e autenticação

A aplicação web é privada. **Não existe cadastro público** — nenhuma página de criar conta, nenhum endpoint de signup. Uma conta só nasce de duas formas: `pnpm bootstrap:admin`, que exige acesso ao shell, ou o aceite de um convite válido.

| | |
| --- | --- |
| Login | E-mail + senha, sessão no servidor |
| Senhas | argon2id (`m=19456, t=2, p=1`), salt por hash, mínimo de 12 caracteres |
| Sessão | Token de 256 bits no cookie; o banco guarda só o SHA-256 |
| Cookie | `HttpOnly`, `SameSite=Lax`, `Secure` em https, 8 horas |
| Convite | Token de uso único, hasheado no banco, expira em 7 dias |

### Papéis

| | ADMIN | MEMBER |
| --- | :---: | :---: |
| Visão geral, guias, detalhe, relatório, integrações | sim | sim |
| Importar e exportar CSV | sim | sim |
| Convidar, revogar, desativar, alterar permissão | sim | não (403) |

A autorização acontece **no servidor**, em cada página, cada Server Action e cada endpoint. Esconder um botão não é o controle: um MEMBER que chame a ação de administrador diretamente recebe recusa, e há teste para exatamente isso.

### Convites

1. Um administrador informa e-mail e nível em *Configurações -> Equipe*.
2. O sistema gera um token aleatório, guarda apenas o hash e entrega o link ao `InvitationMailerPort`.
3. A pessoa abre `/invite/<token>`, define nome e senha, e a conta é criada **com o e-mail do convite** — o formulário não pode trocá-lo.
4. O convite é marcado como aceito e não funciona mais.

Sem provedor de e-mail configurado, o adaptador de desenvolvimento imprime o link no log do servidor e a interface o mostra ao administrador para copiar. Em produção esse caminho é recusado: o link existe apenas na mensagem entregue. Trocar por Resend, SES ou SMTP é implementar `InvitationMailer` e apontar o composition root.

O modelo completo de ameaças, com a matriz de acesso e os testes manuais, está em [`docs/security.md`](docs/security.md).

## API REST

Duas superfícies distintas, com modelos de acesso distintos.

### Externa — `/api/v1/*`

Para integradores. Exige `Authorization: Bearer <VITALIS_API_KEY>`. **Somente leitura e validação.** Sem a variável configurada a superfície fica fechada, não aberta.

Contrato estável em JSON. Os mesmos códigos de problema que aparecem na interface.

| Método | Rota | |
| --- | --- | --- |
| `POST` | `/api/v1/guides/validate` | Valida uma guia enviada no corpo |
| `GET` | `/api/v1/guides` | Lista com filtros `status`, `unit`, `convention`, `search`, `limit` |
| `GET` | `/api/v1/guides/{id}` | Decisão registrada, problemas e histórico |
| `GET` | `/api/v1/reports/weekly` | Resumo executivo (`?through=AAAA-MM-DD`) |

### Interna — `/api/internal/*`

Alcançada pelo navegador com o cookie de sessão, nunca com chave de API. É a **única** superfície que grava dados operacionais.

| Método | Rota | |
| --- | --- | --- |
| `POST` | `/api/internal/imports/csv` | Importa um lote de guias (sessão ativa) |
| `GET` | `/api/internal/guides/export?kind=ready\|pending` | CSV das prontas ou das pendências |

`GET /api/health` é público e mínimo: diz apenas se a aplicação e o banco respondem.

### Validar não é ingerir

`POST /api/v1/guides/validate` **calcula uma decisão e não persiste guia alguma**. Um integrador pode consultá-lo à vontade sem tocar nos dados da clínica. A ingestão é um caminho próprio (`importGuides`, usado pelo upload de CSV e pelo seed) com autorização própria.

O que o endpoint grava é **uma linha de auditoria** — quem perguntou, sobre qual id, e qual foi a decisão. Isso é telemetria sobre uma requisição, não uma alteração em uma guia.

### Validando uma guia

O corpo usa os nomes de coluna do CSV. Datas em `AAAA-MM-DD` ou `DD/MM/AAAA`, valores com ponto ou vírgula.

```bash
curl -X POST http://localhost:3000/api/v1/guides/validate \
  -H "authorization: Bearer $VITALIS_API_KEY" \
  -H 'content-type: application/json' \
  -d '{
    "id_guia": "G-NOVA-0001",
    "unidade": "Centro",
    "data_atendimento": "20/08/2026",
    "paciente": "P-9999",
    "convenio": "Vitalcard",
    "carteirinha": "884410270",
    "procedimento_codigo": "50000470",
    "numero_autorizacao": "AUT887507",
    "autorizacao_validade": "2026-08-14",
    "autorizacao_sessoes_limite": "10",
    "sessao_numero_na_autorizacao": "3",
    "profissional_registro": "CREFITO-3 204411-F",
    "valor": "62,00",
    "data_lancamento": "2026-08-21"
  }'
```

```jsonc
{
  "idGuia": "G-NOVA-0001",
  "status": "NEEDS_CORRECTION",
  "canSubmit": false,
  "amountAtRisk": 62,
  "summary": "Corrigir antes do envio: Vitalcard exige CID, e o campo está vazio. (+1 pendência)",
  "findings": [
    {
      "code": "CID_MISSING",
      "severity": "BLOCKING",
      "field": "cid",
      "message": "Vitalcard exige CID, e o campo está vazio.",
      "expected": "Campo preenchido",
      "actual": null,
      "source": "CONVENTION_RULE",
      "evidence": null,
      "recommendedAction": "Preencher CID antes do envio."
    }
    // ...
  ],
  "recommendedActions": ["Preencher CID antes do envio.", "..."],
  "whyItFell": ["..."],
  "normalizations": [
    { "field": "valor", "kind": "DECIMAL_SEPARATOR", "from": "62,00", "to": "62.00", "reason": "..." }
  ],
  "observation": null,
  "rules": { "version": "agosto/2026", "hash": "c52a5a00…" }
}
```

**Códigos HTTP:** `200` sempre que o preflight rodou — inclusive quando encontrou problemas, porque encontrar problemas é o endpoint funcionando. `400` para JSON inválido ou corpo que não é objeto. `401` sem credencial válida. `413` acima de 64 KB. `422` quando a guia não pode ser interpretada (data impossível, unidade inexistente), com detalhe por campo. `429` acima de 60 requisições por minuto. Nenhum stack trace sai da aplicação.

**Modo demo:** `VITALIS_API_DEMO_MODE=true` abre *apenas* este endpoint sem credencial, para que o validador possa ser exercitado a partir de um formulário. Ele não lê guia armazenada nem grava nenhuma. O schema de ambiente recusa o boot se estiver ligado em produção.

## MCP

Servidor remoto no mesmo projeto, em `POST /mcp`, usando o SDK oficial com **Streamable HTTP stateless**. As tools chamam os mesmos casos de uso da aplicação web — um agente e uma pessoa recebem a mesma resposta sobre a mesma guia.

Exige `Authorization: Bearer <VITALIS_MCP_API_KEY>`. A autenticação acontece antes de o SDK ver a requisição: sem credencial, o chamador recebe `401` e **não descobre sequer quais tools existem**.

| Tool | Para quê |
| --- | --- |
| `consultar_regra_convenio` | Cobertura, valor de referência, campos obrigatórios, limite de sessões, prazo e a observação oficial da regra |
| `verificar_guia` | Executa o preflight de uma guia enviada inline ou de um `id_guia` já registrado |
| `consultar_guia` | Lê a decisão registrada de uma guia, com problemas, evidências e histórico |
| `resumo_operacional` | Totais, valor em risco, valor protegido, causas, unidades e fila de trabalho |

Todas declaram `readOnlyHint: true` e dizem na própria descrição que não alteram nada. **Nenhuma tool de escrita existe** — não há `editar_guia`, `excluir_guia`, `corrigir_guia`, `aprovar_guia` nem `alterar_regra` para ser chamada. Um teste percorre a lista publicada e falha se qualquer nome casar com um verbo de escrita.

Mesmo autenticado, um cliente MCP consulta, valida e resume. A credencial não confere poder administrativo algum.

### Conectando um cliente

```jsonc
{
  "mcpServers": {
    "vitalis-preflight": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer SUA_VITALIS_MCP_API_KEY" }
    }
  }
}
```

No Claude Code:

```bash
claude mcp add --transport http vitalis-preflight http://localhost:3000/mcp --header "Authorization: Bearer $VITALIS_MCP_API_KEY"
```

## Agent Skill

`skills/vitalis-guide-review/` contém uma Skill portátil: a pessoa cola os dados da guia como a recepção escreveu, e a Skill organiza os campos, consulta as regras pelo MCP, chama `verificar_guia` e responde **OK**, **PENDENTE** ou **REVISÃO HUMANA** com motivo, o que corrigir e o próximo passo. Ela nunca inventa regra nem completa dado ausente.

Para instalar no Claude Code:

```bash
mkdir -p ~/.claude/skills
cp -r skills/vitalis-guide-review ~/.claude/skills/
```

Em outros clientes compatíveis, copie a pasta para o diretório de skills do cliente. A Skill depende do servidor MCP acima estar conectado — é dele que vêm as regras.

## Arquitetura

```
src/
  app/              rotas Next.js: páginas (RSC) e route handlers
  components/       apresentação
  application/      casos de uso + portas
  domain/           regras, tipos, decisão
  infrastructure/   PostgreSQL, CSV, regras em arquivo, LLM
  mcp/              tools MCP
  lib/              dinheiro, datas, Result, env
```

Web, REST e MCP são adaptadores sobre os mesmos casos de uso. Nenhuma regra de negócio é implementada duas vezes, e nenhuma vive dentro de um componente React.

O detalhe completo — o fluxo de uma guia, por que a decisão é uma discriminated union, por que a IA é uma porta que só extrai fatos, e o que deliberadamente não existe no projeto — está em [`docs/architecture.md`](docs/architecture.md).

## Como as regras são tratadas

`data/source/regras_convenio.json` é a **única** fonte da verdade. Toda validação carrega a versão (`agosto/2026`) e o hash SHA-256 do arquivo, gravados em cada execução: a versão diz qual contrato valia, o hash prova que o arquivo não foi editado depois.

O modelo de IA nunca cria regra. Ele apenas extrai fatos da observação livre da recepção, dentro de um conjunto fechado de tipos, e cada fato carrega um trecho **literal** da observação — um trecho que não esteja no texto original é descartado antes de chegar a qualquer decisão.

Normalização automática só corrige notação: `DD/MM/AAAA` → `AAAA-MM-DD`, vírgula decimal → ponto, espaço em excesso, string vazia → ausente. CID, código de procedimento, convênio, profissional, número de autorização, validade e conteúdo clínico **nunca** são reescritos. Toda mudança é registrada e aparece na tela da guia, na resposta da API e no banco.

## Testes

```bash
pnpm test
```

183 testes, sem precisar de banco:

- **Unitários** — normalização (ISO, `DD/MM/AAAA`, ponto, vírgula), cada validador (autorização no último dia e vencida, campos obrigatórios por convênio, limites de sessão, cobertura, valor, descrição, convênio e procedimento desconhecidos), interpretação da observação e as 80 guias do dataset, com `G-2608-0030`, `G-2608-0039`, `G-2608-0041` e `G-2608-0069` fixados por id.
- **Integração** — os route handlers reais de `POST /api/v1/guides/validate`, importação e exportação CSV, e o endpoint MCP com handshake JSON-RPC, contra repositórios in-memory.
- **Acesso e segurança** — 55 casos: hashing argon2id e sessões, ciclo completo do convite (expirado, revogado, reutilizado, e-mail trocado), invariantes da equipe, e as fronteiras de anônimo, MEMBER, ADMIN, Bearer REST e Bearer MCP. As ações de administrador são invocadas **diretamente** com a sessão de um MEMBER, que é o que alguém faria pelo DevTools.

Há teste explícito de que observações irrelevantes ("chegou 10 min atrasado", "pediu recibo") não viram erro.

## Limitações conhecidas

Duas regras dos convênios **não** são aplicadas porque o dataset não traz o dado necessário:

- **`prazo_envio_dias`** exige a data de envio ao convênio. `data_lancamento` é o lançamento no sistema da clínica — outro evento.
- **`validade_maxima_autorizacao_dias`** exige a data de emissão da autorização, que não existe no dataset.

As duas estão implementadas e desligadas: passam a valer assim que o dado chegar por `SupplementaryGuideData`, sem reescrever nada. Ambas já têm teste.

O detalhe de cada limite, e de toda decisão de *não* concluir algo, está em [`docs/assumptions.md`](docs/assumptions.md).

Do lado de segurança, as limitações assumidas são: rate limit em memória (só protege uma instância), ausência de 2FA e de recuperação de senha, sessão sem rotação por atividade, e `audit_events` como tabela comum em vez de append-only. Todas estão justificadas em [`docs/security.md`](docs/security.md).

## Decisões principais

1. **Um só motor de validação.** Web, CSV, REST e MCP são adaptadores. Regra duplicada é regra que vai divergir.
2. **Três estados, não um booleano.** "Precisa corrigir" e "precisa de decisão humana" geram trabalhos diferentes.
3. **Regras determinísticas primeiro, IA depois.** O modelo extrai fatos; a reconciliação com as regras é código. Um modelo nunca enfraquece uma regra.
4. **Toda conclusão é rastreável.** Dados de entrada, normalizações, regras usadas com versão e hash, findings com evidência, participação da IA e decisão final ficam gravados. A explicação na tela é montada a partir dos findings armazenados, não gerada depois.
5. **Nada é inventado.** Nem código de procedimento, nem CID, nem regra, nem data de envio.
6. **Validar não é ingerir.** Perguntar se uma guia está pronta não altera dado operacional nenhum.
7. **O navegador não é confiável.** Toda autorização é verificada no servidor; esconder um botão nunca é o controle.

## Documentação

- [`docs/architecture.md`](docs/architecture.md) — camadas, fluxo e decisões técnicas
- [`docs/security.md`](docs/security.md) — fronteiras de confiança, matriz de acesso, testes de segurança
- [`docs/assumptions.md`](docs/assumptions.md) — o que o dataset não permite concluir
- [`docs/build-log.md`](docs/build-log.md) — decisões e correções durante a construção
- [`CLAUDE.md`](CLAUDE.md) — padrões permanentes do repositório
