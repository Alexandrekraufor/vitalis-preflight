# Build log

Decisões tomadas durante a construção, e os erros corrigidos no caminho. Registro honesto, não retrospectiva higienizada.

## Fase 0 — inspeção

O projeto existente era um `create-next-app` limpo: Next.js 16.3.5 com App Router e React Compiler ligado, React 19.2.8, Tailwind v4, ESLint 9 flat config, `app/` na raiz, `tsconfig` com `strict` básico. Nada de domínio.

Next 16 traz APIs que não podem ser escritas de memória. Antes de qualquer código, li os docs versionados em `node_modules/next/dist/docs/` — route handlers, convenções de arquivo, `params` como `Promise`, pasta `src/`.

**Perfil do dataset, medido antes de assumir qualquer coisa:** 80 guias, 3 unidades, 3 convênios, 5 procedimentos, 2 datas em `DD/MM/AAAA`, 1 valor com vírgula, 13 CID vazios, 4 números de autorização vazios, 2 registros profissionais vazios, 6 sessões acima do limite, 5 procedimentos fora de cobertura, 5 observações relevantes e 4 tipos de observação-ruído. Nenhum valor divergente da tabela de referência — o validador de valor existe e é coberto por teste, mas não dispara neste arquivo.

## Fase 1 — fundação

`app/` movido para `src/app/` com `git mv`, preservando histórico. `tsconfig` recebeu `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`, `noImplicitOverride`, `noFallthroughCasesInSwitch` e `verbatimModuleSyntax`.

**Erro:** coloquei `import "server-only"` em `src/lib/env.ts`. O pacote lança fora da condição `react-server`, o que quebraria Vitest e os scripts `tsx`. **Correção:** o guarda ficou só em `db/client.ts` e nas implementações de infraestrutura; o Vitest resolve `server-only` para o módulo vazio do próprio pacote, e o seed roda com `--conditions=react-server`.

**Erro:** `pnpm add -D vitest tsx` deixou os postinstall do esbuild bloqueados, e nada rodava. **Correção:** `onlyBuiltDependencies: [esbuild]` no `pnpm-workspace.yaml`.

## Fase 2 — domínio

Ordem deliberada: primitivos (`Money` em centavos com marca de tipo, `IsoDate` marcado), depois normalização, depois parsing, depois validadores, depois decisão.

**Decisão:** a normalização corrige apenas notação, e só em colunas de data e de valor. Uma função `isRewritable` deixa isso explícito no código, em vez de depender de os validadores "não mexerem" no resto.

**Decisão:** o parsing estrutural é deliberadamente permissivo com o que está *errado* e rígido com o que é *ininteligível*. Um convênio desconhecido ou um CID ausente vira finding; uma data impossível vira erro estrutural. A consequência prática: a API responde 422 só quando a guia não pode ser interpretada, e 200 com findings em todo o resto.

**Decisão:** cada campo obrigatório tem seu próprio código de finding (`CID_MISSING`, `AUTHORIZATION_NUMBER_MISSING`, …) em vez de um `REQUIRED_FIELD_MISSING` genérico. Consumidores agem sobre um código estável sem interpretar mensagem.

**Decisão:** as duas regras não verificáveis viraram validadores reais que leem `SupplementaryGuideData`. Ficam silenciosos enquanto o dado for `null`, e têm teste que os exercita com o dado presente. Habilitá-las é passar um parâmetro, não escrever código.

## Fase 3 — persistência

**Erro:** a primeira versão de `save()` inseria o `validation_run` antes do upsert da guia. A chave estrangeira estourou na primeira execução do seed (`Key (id_guia)=(G-2608-0001) is not present in table "guides"`). **Correção:** a ordem dentro da transação passou a ser versão → guia → run → findings → ponteiro para o último run.

**Decisão:** `guides.latest_validation_run_id` é um ponteiro denormalizado, escrito na mesma transação, sem chave estrangeira (guias e runs se referenciam mutuamente). Existe para que listar centenas de guias com a decisão atual seja um join indexado. Está comentado no schema.

**Decisão:** o versionamento é por hash do conteúdo normalizado. Verificado na prática: dois seeds seguidos produzem 80 versões e 160 runs — nenhuma versão duplicada, todo histórico de execução preservado.

**Erro:** scripts em `.ts` com top-level `await` quebraram no `tsx` porque o `package.json` não declara `type: module`. **Correção:** renomeados para `.mts`.

## Fase 4 — REST

**Decisão:** `POST /api/v1/guides/validate` não tem caminho próprio de escrita — ele chama `importGuides` com um único registro e origem `API`. Uma guia que chega pela API aparece no painel com a mesma trilha de auditoria de uma importada.

**Decisão:** o contrato público é declarado como schema Zod (`validationReportSchema`) e o tipo TypeScript é derivado dele. O MCP precisa de um schema de verdade para publicar como `outputSchema`; declarar os dois separadamente seria convite a divergirem.

**Erro:** a primeira versão da rota de listagem tinha chaves em português enquanto a de validação tinha chaves em inglês. **Correção:** todo o contrato público ficou em inglês camelCase, alinhado ao exemplo do enunciado. Texto de interface e nomes de tools MCP continuam em português.

## Fase 5 — interface

**Decisão:** os filtros da lista de guias são um `<form method="get">` em Server Component. O estado do filtro mora na URL, toda visão filtrada é compartilhável, e nada disso precisa de JavaScript no cliente. O único Client Component que toca dados de guia é o upload de CSV.

**Decisão:** status nunca é comunicado só por cor — ícone mais palavra, sempre.

**Erro:** o relatório executivo mostrava uma única guia. A causa não era o relatório: uma guia de teste que enviei pela API tinha data de atendimento "hoje", virou o atendimento mais recente e arrastou a semana padrão para fora dos dados. **Correção:** o comportamento padrão está certo e foi mantido, mas a página ganhou um seletor de período (`?through=`) para não depender de um único registro. A guia de teste foi removida do banco de desenvolvimento.

**Erro de lint:** `no-html-link-for-pages` acusou os links de download, que apontam para route handlers. **Correção:** viraram formulários GET — semanticamente corretos para disparar um download, sem `eslint-disable`.

## Fase 6 — MCP

**Decisão:** `webStandardStreamableHttp` em vez do transporte Express. Ele fala `Request`/`Response` padrão, que é exatamente o que um route handler do Next recebe e devolve. Sem adaptador.

Omitir `sessionIdGenerator` é o que seleciona o modo stateless no SDK — passar `undefined` explicitamente colide com `exactOptionalPropertyTypes`.

**Erro:** tentei registrar as tools em um laço sobre um array com tipo genérico comum. O SDK infere o tipo dos argumentos a partir do schema da própria tool, e essa inferência morre atrás de um genérico. Duas tentativas de contornar com tipos mais espertos falharam. **Correção:** as quatro tools são registradas uma a uma, com o schema visível no ponto de chamada. Quatro linhas repetidas, zero `as`.

**Decisão:** erros das tools são dados, não exceções. `verificar_guia` devolve um campo `erro` legível em vez de estourar — um agente precisa conseguir ler o que deu errado.

## Fase 7 — Skill

A Skill não decide nada. Ela extrai campos, consulta as regras pelo MCP, chama `verificar_guia` e traduz. `references/guide-fields.md` carrega os cuidados que erram na prática: carteirinha é texto, validade é inclusiva, a observação vai inteira e literal, data incompleta não é data, descrição não vira código.

## Fase 8 — fechamento

`pnpm verify` roda lint, typecheck, testes e build. Nenhum `any`, nenhum `eslint-disable`, nenhum `ts-ignore` no código final.

## Ambiguidades levadas ao final

Duas regras dos convênios não podem ser verificadas sem inventar dado, e uma terceira leitura precisou de uma convenção declarada. As três estão em [`assumptions.md`](assumptions.md), com o que falta e como habilitar.

---

# Fase de hardening e polish

## QA: validação estava acoplada à ingestão

`POST /api/v1/guides/validate` chamava `importGuides` e persistia a guia. Era o acoplamento mais sério do projeto: uma consulta com efeito colateral de escrita, alcançável por quem só deveria ler.

**Correção:** o endpoint passou a chamar `validateGuide` (puro em relação a dados operacionais) e a gravar apenas uma linha de auditoria. A ingestão continua em `importGuides`, agora atrás de sessão. Verificado ao vivo: quatro validações, quatro linhas de auditoria, zero guias criadas.

O teste que dizia "stores the guide so it is retrievable afterwards" foi invertido para "does not ingest the guide it was asked to validate" — a asserção antiga descrevia justamente o comportamento errado.

## Escolha da biblioteca de autenticação

Avaliei `better-auth@1.7.5`, que declara suporte a `next ^16` e `drizzle-orm ^0.45.2` — exatamente estas versões. Descartei por três motivos concretos: tornar o cadastro invite-only exigiria `disableSignUp` somado a `auth.$context.internalAdapter` (API interna, frágil em repositório público) ou um hook num endpoint de signup público; ela monta `/api/auth/*` com dezenas de endpoints que eu teria de auditar e travar, aumentando a superfície numa tarefa cujo objetivo era reduzi-la; e reexporta `zod` e `better-call` da raiz, conflitando com o zod 4.6.5 já usado.

Ficaram sessões opacas em banco com `@node-rs/argon2`. Não é criptografia manual — o KDF é biblioteca nativa madura, os tokens vêm do CSPRNG — e são cerca de 200 linhas auditáveis que encaixam nos ports/adapters existentes.

## Erros corrigidos no caminho

**`forbidden()` e `unauthorized()` do Next são experimentais.** Exigem `experimental.authInterrupts` no `next.config.ts`. Troquei por `redirect()` (estável) para visitantes anônimos e por um componente explícito de acesso restrito para quem está autenticado sem permissão. A propriedade de segurança é idêntica e o build não depende de flag experimental.

**Os guards liam o cookie por `cookies()`, que só existe dentro de uma requisição Next.** Isso tornava os route handlers intestáveis sem simular o storage assíncrono. Separei em dois: `readSessionToken()` via `cookies()` para Server Components e Actions, e `readSessionTokenFromRequest(request)` para route handlers, que já têm o `Request`. Além de testável, é mais explícito.

**Exportei constantes de um módulo `"use server"`.** `INITIAL_LOGIN_STATE`, `INITIAL_TEAM_STATE` e `INITIAL_ACCEPT_STATE` estavam em `actions.ts`. Um módulo `"use server"` só pode exportar funções async; o que voltava para o cliente era uma referência de servidor, não o objeto. O sintoma foi um `role="alert"` vazio renderizando no login. Movidos para módulos `*-state.ts` próprios.

**`Algorithm.Argon2id` é um const enum ambiente**, inacessível com `verbatimModuleSyntax`. Em vez de um número mágico ou um cast, deixei o padrão da biblioteca (que é argon2id) e escrevi um teste que verifica o prefixo `$argon2id$` e os parâmetros `m=19456,t=2,p=1` no digest produzido — a propriedade, não a constante.

**A comparação de segredos vazava o comprimento.** A primeira versão fazia `if (a.length !== b.length) return false` antes do `timingSafeEqual`. Passei a hashear os dois lados e comparar buffers de tamanho fixo.

**O digest de tempo constante era hard-coded.** Um digest argon2 inválido falharia no parse e retornaria cedo — exatamente a diferença de tempo que ele existia para eliminar. Agora é gerado uma vez por processo a partir de um valor aleatório.

**Ao parar o servidor de desenvolvimento, meu filtro de processos casou com outros `next dev` da máquina** e derrubou um app não relacionado do usuário. Nenhum arquivo foi tocado, mas o filtro deveria ter sido restrito ao diretório do projeto.

## Fronteiras reorganizadas

`/api/v1/*` virou superfície externa de leitura e validação, com Bearer. A importação e a exportação de CSV saíram de lá e viraram `/api/internal/*`, alcançáveis com cookie de sessão. O resultado é que a única superfície capaz de gravar dado operacional é a que o navegador de um membro autenticado usa — nenhuma chave de API escreve.

`/api/health` deixou de publicar a versão e o hash das regras: é um endpoint sem autenticação e isso é detalhe operacional.

## CSP

Segui o guia versionado do Next (nonce por requisição via `proxy.ts`, `strict-dynamic`). A única flexibilização é `style-src 'unsafe-inline'`, porque o `next/font` injeta `@font-face` inline e uma folha de estilo não executa. Está documentado em `docs/security.md` em vez de ser escondido.
