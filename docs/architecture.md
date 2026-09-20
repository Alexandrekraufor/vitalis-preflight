# Arquitetura

## O problema que a estrutura resolve

Três públicos e um agente consomem a mesma pergunta - *esta guia pode ser enviada?* - por quatro caminhos: a interface web, um upload de CSV, a API REST e o MCP. A única decisão arquitetural que realmente importa aqui é que **existe uma só implementação dessa resposta**, e que os quatro caminhos são adaptadores dela.

## Camadas

```
src/
  app/              rotas Next.js: páginas (RSC), Server Actions e route handlers
  components/       apresentação
  application/      casos de uso + portas (interfaces de repositório)
  domain/           regras, tipos, decisão
    guides/ rules/ conventions/ normalization/ observations/
    access/         papéis, convites, política de senha, auditoria
  infrastructure/   PostgreSQL, arquivos, CSV, LLM, auth, e-mail
  mcp/              tools MCP
  lib/              primitivos sem domínio (dinheiro, data, Result, env, rate limit)
  proxy.ts          headers de segurança e redirect de conveniência
```

A dependência aponta sempre para dentro. `domain/` não conhece Drizzle, Next, Zod-de-HTTP nem provedor de IA. `application/` conhece `domain/` e as portas que ele mesmo declara. `infrastructure/` implementa essas portas.

`infrastructure/composition-root.ts` é o único lugar onde uma implementação concreta é escolhida. Trocar PostgreSQL por outra coisa, ou o interpretador heurístico pelo baseado em modelo, é uma mudança nesse arquivo.

## O fluxo de uma guia

```
entrada bruta (CSV | JSON REST | argumento MCP)
    │
    ▼  normalizeGuideRecord        domain/normalization
notação corrigida + lista auditável de mudanças
    │
    ▼  parseGuide                  domain/guides
guia tipada  ─── ou erro estrutural (422)
    │
    ▼  ObservationInterpreter      domain/observations (porta)
fatos extraídos da observação, com evidência literal
    │
    ▼  runRuleEngine               domain/rules
findings determinísticos + findings reconciliados da observação
    │
    ▼  decide                      domain/guides/validation-result
READY_TO_SUBMIT | NEEDS_CORRECTION | REVIEW_REQUIRED
    │
    ▼  GuideRepository.save        infrastructure/db
versão da guia + run + findings, em uma transação
    │
    ▼  UI · REST · MCP
```

O ponto que sustenta o resto: **as regras determinísticas rodam primeiro e sozinhas**. A interpretação da observação é reconciliada depois, contra o resultado delas. Um modelo de linguagem nunca tem a oportunidade de enfraquecer uma regra - só de acrescentar contexto que as regras não podiam enxergar.

## Onde o auth entra sem contaminar o domínio

Autenticação é um **contexto separado**, não um atributo que atravessa o resto. `domain/access/` conhece papéis, convites, política de senha e auditoria; não sabe o que é um finding. `domain/guides/` e `domain/rules/` não sabem que usuários existem - nenhuma assinatura de caso de uso de validação mudou para acomodar o login.

Os dois contextos se encontram exatamente em um lugar: os adaptadores. Uma página chama `requireUser` antes de chamar `listGuides`; um route handler chama `guardSessionRequest` antes de chamar `importGuides`. O guard devolve um `AuthenticatedUser` que **não é repassado** para o motor de regras.

O único ponto em que o mundo do acesso toca o mundo das guias é a auditoria: importar grava quem importou, validar grava quem perguntou. Isso passa por `AccessRepository.recordAuditEvent`, chamado do adaptador - não de dentro de `importGuides` nem do rule engine.

### Validação e ingestão são caminhos distintos

```
validateGuide(raw, deps)   -> decisão            sem efeito em dados operacionais
importGuides(batch, deps)  -> guias versionadas  única escrita, autorização própria
```

Antes do endurecimento, `POST /api/v1/guides/validate` chamava `importGuides`: perguntar "esta guia está pronta?" criava e versionava a guia. Era acoplamento entre uma consulta e uma mutação, e dava a um integrador com credencial de leitura o poder de escrever.

Hoje o endpoint calcula e grava apenas uma linha de auditoria. Verificado ao vivo: quatro validações da mesma guia inédita produziram quatro linhas em `audit_events` e zero linhas em `guides`.

## Decisões

### A decisão é uma discriminated union, não um booleano

```ts
type GuideDecision =
  | { status: "READY_TO_SUBMIT";  canSubmit: true;  ... }
  | { status: "NEEDS_CORRECTION"; canSubmit: false; blockingFindings: ... }
  | { status: "REVIEW_REQUIRED";  canSubmit: false; reviewFindings: ... };
```

"Não pode ser enviada" se divide em duas situações que geram trabalhos diferentes: um erro objetivo que a recepção corrige, e uma ambiguidade que só uma pessoa resolve. A união impede que `canSubmit` discorde de `status`, e obriga o compilador a apontar todos os pontos de tratamento quando um estado novo aparecer.

Ordem de precedência: **qualquer bloqueio vence qualquer ambiguidade**. Uma guia com autorização vencida *e* observação ambígua precisa primeiro do número correto - discutir o resto antes disso é desperdício.

### Validadores pequenos, com um contrato só

```ts
type Validator = (context: RuleContext) => readonly Finding[];
```

Nove validadores independentes, cada um em seu arquivo, cada um testável isoladamente. O motor é um `flatMap` sobre a lista. Acrescentar uma regra é acrescentar um arquivo e uma linha no registro.

### Findings carregam a ação

Cada `Finding` traz `expected`, `actual`, `source`, `evidence` e `recommendedAction`. A consequência é que a resposta da API, a tela "Por que essa guia caiu?" e a resposta da tool MCP são **projeções dos mesmos dados armazenados** - não textos gerados de novo. Uma decisão de agosto continua explicável em dezembro, com as palavras de agosto.

### A IA é uma porta, e só extrai fatos

```ts
interface ObservationInterpreter {
  readonly name: string;
  readonly model: string | null;
  interpret(note: string): Promise<ObservationInterpretation>;
}
```

Duas implementações: `heuristic` (determinística, offline, é o padrão) e `llm` (Anthropic via `TextCompletionClient`, com fallback para a heurística). O tipo de fato é um union fechado - um modelo não pode inventar uma categoria nova de problema. E toda evidência é conferida contra o texto original: um trecho que não esteja literalmente na observação é descartado, e o descarte derruba a confiança e pede revisão.

O nome do interpretador e o modelo usado ficam gravados em cada `validation_run`.

### Dinheiro em centavos, `numeric` no banco

`Money` é um número inteiro de centavos com marca de tipo. R$ 62,00 não é representável em ponto flutuante, e este sistema compara valores cobrados contra uma tabela de referência - um centavo de deriva seria um finding fantasma. No banco, `numeric(12,2)`.

### Datas como `IsoDate` marcado

`YYYY-MM-DD` com marca de tipo. O domínio só raciocina sobre dias; carregar um `Date` traria fuso horário, que aqui é ambiguidade, não precisão. Comparação lexicográfica é cronológica nesse formato.

### Versionamento por conteúdo

Uma guia reimportada só gera nova versão se o hash do payload normalizado mudar. Reimportar o mesmo arquivo não duplica nada; reimportar um arquivo corrigido cria a versão 2 e deixa a decisão da versão 1 intacta no histórico.

Cada `validation_run` guarda `rulesVersion` **e** `rulesHash`: a versão diz qual contrato valia, o hash prova que o arquivo não foi editado depois.

### Uma única porta de escrita

`importGuides` é o único caminho que grava. O upload de CSV, o seed e o `POST /api/v1/guides/validate` passam por ele. Procedência, versionamento e validação se comportam igual venha a guia de onde vier.

### MCP stateless sobre os mesmos casos de uso

`WebStandardStreamableHTTPServerTransport` sem `sessionIdGenerator`: nada é guardado entre requisições, e o transporte fala `Request`/`Response` padrão - exatamente o que um route handler do Next recebe e devolve, sem adaptador.

As quatro tools são somente leitura e chamam os mesmos casos de uso da API REST. Um agente e uma pessoa recebem a mesma resposta sobre a mesma guia porque é literalmente o mesmo código.

## O que deliberadamente não existe

- **Fila, worker, Redis, mensageria.** Validar 80 guias leva milissegundos. Uma fila aqui seria infraestrutura para esconder que não há problema de escala.
- **Camada de serviço genérica, DTOs em três níveis, mapeadores automáticos.** Os casos de uso são funções. A "camada de aplicação" é um diretório de funções com portas explícitas, porque isso é o que dá o desacoplamento - o resto seria cerimônia.
- **Framework de injeção de dependência.** Um arquivo de composição e parâmetros de função resolvem, e os testes injetam repositórios in-memory sem mágica.
- **Cache.** As leituras são diretas e rápidas. O arquivo de regras é lido uma vez por processo, porque é imutável.
- **Biblioteca de autenticação completa.** `better-auth` é compatível com esta stack e foi avaliado; foi descartado porque tornar o cadastro *invite-only* exigiria alcançar API interna dela ou colocar um hook num endpoint público de signup, e porque ela monta dezenas de endpoints que precisariam ser auditados e travados - o oposto do objetivo. O que ficou no lugar não é criptografia manual: argon2id vem de biblioteca nativa e os tokens do CSPRNG da plataforma. O raciocínio completo está em `docs/security.md`.
- **JWT de sessão.** Um token assinado carrega claims que só podem ser revogados esperando expirar. Sessão opaca em banco permite desativar um membro e derrubar todos os dispositivos dele na mesma transação.
- **Redis para rate limit.** Ver `docs/security.md`: a limitação de contar por instância está assumida e documentada.

## Testes

183 testes, sem banco:

- **Unitários** - normalização, parsing, cada validador, interpretação da observação e reconciliação, e o dataset completo com os casos nomeados no enunciado fixados por id.
- **Integração** - os *route handlers reais* (`POST /api/v1/guides/validate`, importação CSV, exportação, detalhe) e o endpoint MCP com um handshake JSON-RPC de verdade, todos contra repositórios in-memory que reproduzem o versionamento por conteúdo.
- **Acesso e segurança** - hashing e sessões, ciclo completo do convite, invariantes da equipe, e as fronteiras: anônimo, MEMBER, ADMIN, Bearer REST e Bearer MCP. As ações de administrador são chamadas diretamente com a sessão de um MEMBER, que é o que alguém faria pelo DevTools.

O banco é substituído; as regras, os handlers e os casos de uso são os de produção.
