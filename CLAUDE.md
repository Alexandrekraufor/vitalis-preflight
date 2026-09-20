@AGENTS.md

# Vitalis Preflight - padrões do projeto

Estas regras valem para qualquer alteração neste repositório.

## Ferramentas

- **pnpm apenas.** Não use npm nem yarn; o lockfile é do pnpm.
- `pnpm verify` (lint + typecheck + test + build) precisa passar antes de considerar algo pronto.
- PostgreSQL local sobe com `pnpm db:up`; migrations com `pnpm db:migrate`.

## TypeScript

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` e `useUnknownInCatchVariables` estão ligados e não devem ser afrouxados.
- **Sem `any`.** Sem `as unknown as`. Sem `!` sem justificativa escrita.
- Prefira union de literais a `enum`.
- Estados importantes são discriminated unions (veja `GuideDecision`).
- Fronteiras públicas (use cases, repositórios, rotas) têm tipo de retorno explícito.
- Nada de `utils.ts` ou `helpers.ts`: o nome do arquivo diz a responsabilidade.

## Camadas

```
app/            rotas Next (UI, Server Actions, HTTP) - sem regra de negócio
components/     apresentação - sem regra de negócio
application/    casos de uso e portas
domain/         regras, tipos e decisões (guides + access)
infrastructure/ banco, arquivos, LLM, CSV, auth, e-mail
mcp/            tools MCP sobre os mesmos casos de uso
```

- **A regra de negócio mora em `domain/` e `application/`.** Um componente React nunca decide se uma guia pode ser enviada.
- **Web, REST e MCP usam os mesmos casos de uso.** Se uma regra precisa existir em dois lugares, ela está no lugar errado.
- `domain/` não importa de `infrastructure/` nem de `app/`.
- Implementações concretas são escolhidas só em `infrastructure/composition-root.ts`.
- `domain/access` (papéis, convites, senha, auditoria) e `domain/guides` são contextos separados: o motor de regras não sabe que usuários existem, e o acesso não sabe o que é um finding. Eles se encontram só nos adaptadores.

## Segurança

- **O navegador não é confiável.** Toda autorização é verificada no servidor, em cada página, cada Server Action e cada route handler. Esconder um botão nunca é o controle.
- `src/proxy.ts` aplica headers e redireciona; **não é fronteira de segurança** e não deve ganhar responsabilidade de autorização.
- **Não existe cadastro público.** Conta nasce de `bootstrap:admin` ou de convite aceito.
- Segredo algum em `NEXT_PUBLIC_*`, em Client Component, em log ou no repositório. Tudo sensível passa por `lib/env.ts`, que importa `server-only`.
- Tokens de sessão e de convite são guardados **hasheados**. Senhas em argon2id.
- Chave de API ausente **fecha** a superfície; nunca a abre.
- **Validar não é ingerir.** `validateGuide` calcula; `importGuides` grava. Não voltar a acoplá-los.
- **MCP é read/validate only.** Não criar tool que edite, aprove, corrija ou exclua nada.
- Toda entrada externa é validada com Zod e tem limite de tamanho.
- Exportação CSV neutraliza fórmulas (`=`, `+`, `-`, `@`).
- Resposta externa nunca carrega stack trace, SQL, caminho de filesystem ou segredo.

## Regras de convênio

- **A versão publicada em `rule_sets` é a fonte da verdade** das regras em tempo de execução. `data/source/regras_convenio.json` é a semente: vale como origem, é publicada como primeira versão num banco vazio, e continua servindo os testes e o seed sem banco.
- **Versão publicada é imutável.** Editar cria rascunho; publicar promove o rascunho e arquiva a anterior. Guia já decidida mantém a versão e o hash que a avaliaram, e reavaliar é uma ação explícita que registra uma validação nova em vez de reescrever a antiga.
- **Mudou regra na tela? Rode `pnpm rules:export` e `pnpm test`.** O arquivo semente é a fixture dos testes; sem exportar, a suíte e o sistema em execução divergem.
- **Os tipos de regra são fechados.** A tela cadastra plano, procedimento, limite e prazo; criar um tipo novo de checagem continua sendo mudança de código, com teste. Documento que não passa no schema do domínio não vira rascunho, quanto mais regra vigente.
- **Nunca invente regra de convênio, código de procedimento, CID ou número de autorização** - nem no código, nem em prompt, nem em documentação.
- O modelo de IA só extrai fatos da observação da recepção; ele nunca decide e toda conclusão carrega evidência textual literal.
- Regras que dependem de dado que o dataset não tem ficam modeladas e desligadas, documentadas em `docs/assumptions.md`.

## Dados

- O payload original é preservado em `guide_versions.raw_payload`. Normalização só corrige notação (data, separador decimal, espaço) e é sempre auditável.
- Valores monetários são inteiros em centavos no domínio (`lib/money.ts`) e `numeric` no banco. **Nunca float.**
- `carteirinha` é string.
- Datas são `IsoDate` (`AAAA-MM-DD`); validade de autorização é inclusiva.

## Testes

- Alterou `domain/` ou `application/`? O teste vem junto.
- Mexeu em autorização? O teste chama a ação/endpoint **diretamente** com a sessão errada - não basta verificar que a UI esconde o botão.
- Testes de rota usam os handlers reais com repositórios in-memory (`tests/fixtures`).
- Não escreva teste preso a markup visual.
- Os casos do dataset fixados em `tests/unit/dataset.test.ts` não devem ser afrouxados para fazer um teste passar.

## Repositório público

- Sem segredo no código, no histórico ou em `.env` commitado. Só `.env.example`.
- Sem `console.log` de depuração, import morto ou código comentado.
- Sem `eslint-disable` ou `ts-ignore` sem um comentário explicando por quê.
- Código e identificadores em inglês; texto de interface, mensagens de finding e nomes de tools MCP em português brasileiro.
- **Proibido travessão.** O caractere de travessão e o de meia-risca não entram em lugar nenhum: nem em código, comentário, texto de interface, mensagem de finding, documentação, commit ou resposta de chat. Use hífen, vírgula, dois-pontos ou parênteses. Regra sem exceção.
