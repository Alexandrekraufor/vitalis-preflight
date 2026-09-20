# Modelo de segurança

Este documento descreve as fronteiras de confiança do Vitalis Preflight, o que cada tipo de chamador consegue alcançar, e os resultados dos testes manuais.

## Princípio

**O navegador não é confiável.** Assume-se que qualquer pessoa com acesso à aplicação pode abrir o DevTools, editar o JavaScript, alterar requisições, trocar identificadores, montar um `curl`, manipular cookies não-HttpOnly e ignorar completamente os componentes React.

A consequência prática é que **esconder um botão nunca é o controle**. Toda autorização acontece no servidor, em cada página, cada Server Action e cada route handler, independentemente do que a interface escolheu renderizar. Os testes em `tests/integration/admin-actions.test.ts` chamam as ações de administrador diretamente, com a sessão de um MEMBER, e verificam a recusa — exatamente o que alguém faria pelo DevTools.

## Fronteiras de confiança

```
                         ┌──────────────────────────────┐
  navegador ──cookie───▶ │  páginas + Server Actions    │
  (não confiável)        │  autorização por sessão      │
                         ├──────────────────────────────┤
  integrador ──Bearer──▶ │  /api/v1/*                   │
  (não confiável)        │  leitura e validação         │
                         ├──────────────────────────────┤
  agente MCP ──Bearer──▶ │  /mcp                        │
  (não confiável)        │  4 tools, somente leitura    │
                         ├──────────────────────────────┤
  navegador ──cookie───▶ │  /api/internal/*             │
  (não confiável)        │  única escrita operacional   │
                         └──────────────┬───────────────┘
                                        │ somente servidor
                                        ▼
                                  PostgreSQL
```

O navegador **nunca** fala com o PostgreSQL. O cliente Drizzle vive em `src/infrastructure/db/client.ts`, que importa `server-only`; nenhum Client Component importa `@/infrastructure`, e uma varredura do bundle compilado confirma que nem a connection string, nem as chaves, nem a string `argon2` chegam ao navegador.

O `src/proxy.ts` aplica headers e redireciona quem não tem cookie, **mas não é a fronteira de segurança**: ele roda antes da renderização, não tem acesso ao banco, e só consegue ver se *algum* cookie existe — nunca se é válido. Um cookie forjado passa por ele e é rejeitado pela página, pela ação ou pelo route handler, que resolvem a sessão contra o PostgreSQL.

## O que cada chamador alcança

| Capacidade | Anônimo | MEMBER | ADMIN | REST (Bearer) | MCP (Bearer) |
| --- | :---: | :---: | :---: | :---: | :---: |
| Tela de login e página de convite | ✅ | ✅ | ✅ | — | — |
| `GET /api/health` (só liveness) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Painel, guias, detalhe, relatório | ❌ 307 | ✅ | ✅ | ❌ | ❌ |
| Importar CSV (`/api/internal/imports/csv`) | ❌ 401 | ✅ | ✅ | ❌ 401 | ❌ |
| Exportar CSV (`/api/internal/guides/export`) | ❌ 401 | ✅ | ✅ | ❌ 401 | ❌ |
| Gestão de equipe e convites | ❌ | ❌ 403 | ✅ | ❌ | ❌ |
| Validar guia (`POST /api/v1/guides/validate`) | ❌ 401¹ | — | — | ✅ | ✅ (tool) |
| Ler guias (`GET /api/v1/guides*`) | ❌ 401 | — | — | ✅ | ✅ (tool) |
| Relatório semanal (`/api/v1/reports/weekly`) | ❌ 401 | — | — | ✅ | ✅ (tool) |
| **Alterar, aprovar ou excluir uma guia** | ❌ | ❌ | ❌ | ❌ | ❌ |

¹ A menos que `VITALIS_API_DEMO_MODE=true`, que abre **apenas** esse endpoint e é recusado pelo schema de ambiente em produção.

Note a última linha: **não existe caminho algum** — nem para um administrador — que edite, aprove, corrija ou exclua uma guia. As guias entram por ingestão (CSV ou seed) e são versionadas; nada as modifica em lugar.

## Autenticação

**Escolha:** sessões opacas em banco + `@node-rs/argon2`, em vez de uma biblioteca de auth completa.

`better-auth@1.7.5` foi avaliado e é compatível com Next 16 e Drizzle 0.45. Foi descartado porque, para ser *invite-only*, exigiria ou `disableSignUp` somado a acesso ao `auth.$context.internalAdapter` (API interna, frágil num repositório público), ou um hook num endpoint de cadastro público; além disso monta `/api/auth/*` com dezenas de endpoints que precisariam ser auditados e travados — aumentando a superfície numa tarefa cujo objetivo é reduzi-la.

Isto **não é criptografia manual**: o KDF é uma biblioteca nativa madura e os tokens vêm do CSPRNG da plataforma. O que foi escrito é gerenciamento de sessão — cerca de 200 linhas auditáveis em `src/infrastructure/auth/`.

### Senhas

- **argon2id**, `m=19456 KiB, t=2, p=1` — os parâmetros recomendados pela OWASP para login interativo.
- O salt é gerado por hash pela biblioteca e embutido no digest: não existe manipulação de salt neste código, logo não há como errá-la.
- Um teste verifica o prefixo `$argon2id$` e os parâmetros no digest produzido, em vez de confiar no padrão da biblioteca.
- Mínimo de 12 caracteres, com uma deny-list curta de senhas óbvias.
- O digest nunca sai do servidor: as leituras de usuário só selecionam `password_hash` quando o adaptador de autenticação o pede pelo nome.

### Sessões

- Token de 256 bits do CSPRNG, entregue no cookie; **o banco guarda apenas o SHA-256**. Um dump da tabela `sessions` não pode ser reproduzido como login — há teste para isso.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` sempre que `APP_URL` é https, expiração de 8 horas.
- `HttpOnly` é o que transforma um eventual XSS em defacement em vez de roubo de sessão. `SameSite=Lax` é a defesa CSRF de todo formulário da aplicação, somada à verificação de origem que o Next faz nas Server Actions.
- Expiração e situação da conta fazem parte da **query** de lookup, não de uma checagem que algum call site poderia esquecer.
- Desativar um membro apaga todas as suas sessões na mesma operação: ele perde o acesso imediatamente, não quando o cookie vencer.

### Cadastro

Não existe. Nenhuma página pública de criação de conta, nenhum endpoint de signup. Só há dois caminhos para uma linha aparecer em `users`:

1. `pnpm bootstrap:admin`, que exige acesso ao shell do deployment;
2. aceitar um convite válido.

## Convites

- Token de 256 bits do CSPRNG. **O banco guarda apenas o hash** — nem um administrador com acesso ao PostgreSQL consegue recuperar um link pendente e usá-lo.
- Uso único, com expiração de 7 dias.
- O e-mail da conta vem **do convite armazenado**, nunca do formulário: quem tem o link só consegue criar a conta para a qual ele foi emitido.
- A aceitação é reivindicada por um `UPDATE ... WHERE status = 'PENDING'`, tornando-a atômica: duas requisições correndo sobre o mesmo token produzem exatamente uma conta.
- Convite revogado, já aceito, expirado ou inexistente: todos recusados, cada um com sua mensagem.
- Em produção o link **não** volta para a interface. Fora de produção ele aparece para o administrador porque não há provedor de e-mail configurado, e o `ConsoleInvitationMailer` se recusa a rodar em produção justamente para não despejar credenciais de uso único em logs.

## API externa (`/api/v1/*`)

`Authorization: Bearer <VITALIS_API_KEY>`.

- Comparação em tempo constante sobre digests de tamanho fixo — uma checagem de tamanho antecipada vazaria o comprimento da chave esperada.
- **Chave ausente fecha a superfície, não a abre.** Uma variável de ambiente não configurada nunca pode ser o que publica uma API.
- A resposta 401 é idêntica para credencial ausente e credencial errada, e não diz se existe chave configurada.
- Rate limit de janela fixa em memória: 60 req/min para `validate`, 120 req/min para os demais. **Limitação conhecida e assumida:** com várias instâncias atrás de um balanceador, cada uma conta separadamente, e o limite efetivo multiplica pelo número de instâncias. Não foi introduzido Redis só para isso.

### Modo demo

`VITALIS_API_DEMO_MODE=true` abre `POST /api/v1/guides/validate` — e nada mais — sem credencial, para que um avaliador possa exercitar o validador a partir de um formulário. O endpoint é uma computação pura sobre o payload que o chamador já tem: não lê guia armazenada, não grava guia nenhuma, e devolve apenas o que foi enviado mais as regras publicadas. O schema de ambiente **recusa o boot** se ele estiver ligado com `NODE_ENV=production`.

## MCP (`/mcp`)

`Authorization: Bearer <VITALIS_MCP_API_KEY>`.

A autenticação acontece **antes** de o SDK ver a requisição: um chamador não autorizado não chega nem à descoberta de tools — não descobre quais existem, muito menos chama uma. Há teste verificando que a resposta 401 não contém nenhum nome de tool.

As quatro tools são `consultar_regra_convenio`, `consultar_guia`, `verificar_guia` e `resumo_operacional`. Todas declaram `readOnlyHint: true`, todas dizem na própria descrição que não alteram nada, e **nenhuma tool de escrita existe** — não há `editar_guia`, `excluir_guia`, `corrigir_guia`, `aprovar_guia` nem `alterar_regra` para ser chamada por engano ou de propósito. Um teste percorre a lista publicada e falha se qualquer nome casar com um verbo de escrita.

Mesmo autenticado, um cliente MCP consulta, valida e resume. A credencial não confere poder administrativo de espécie alguma.

### Efeitos colaterais de cada tool

| Tool | Lê | Escreve | Efeito colateral |
| --- | --- | --- | --- |
| `consultar_regra_convenio` | arquivo de regras em memória | — | nenhum |
| `consultar_guia` | `guides`, `guide_versions`, `validation_runs`, `validation_findings` | — | nenhum |
| `verificar_guia` | idem, quando recebe `id_guia` | — | nenhum; com `guia` inline não toca no banco |
| `resumo_operacional` | `guides` + último `validation_run` | — | nenhum |

## Validação separada de ingestão

Antes deste endurecimento, `POST /api/v1/guides/validate` chamava `importGuides` e **persistia a guia**. Um integrador perguntando "esta guia está pronta?" alterava os dados operacionais da clínica.

Agora:

- `validateGuide(...)` calcula a decisão. É puro em relação aos dados operacionais.
- `importGuides(...)` ingere e versiona. É o único caminho de escrita, alcançável apenas com sessão.

O endpoint de validação grava **uma linha de auditoria** — quem perguntou, sobre qual id, e qual foi a decisão — porque "alguém rodou o validador" vale ser reconstituível. Isso é telemetria sobre uma requisição, não uma mudança em uma guia. Verificado ao vivo: quatro validações de `G-TEST-0001` produziram quatro linhas de auditoria e **zero** linhas em `guides`.

## Entrada maliciosa

| Vetor | Defesa |
| --- | --- |
| Corpo JSON gigante | 64 KB, contados byte a byte enquanto chegam — `Content-Length` não é confiável |
| Upload CSV gigante | 5 MB, verificado no header e no `File.size` |
| CSV com muitas linhas | teto de 20.000 linhas |
| Campos extras no payload | ignorados; o parser lê as 18 colunas que conhece e nada mais |
| Prototype pollution | o parser constrói um objeto novo a partir de colunas conhecidas; `__proto__` no payload não alcança nada (com teste) |
| **CSV injection na exportação** | células iniciadas por `=`, `+`, `-`, `@`, tab ou CR recebem apóstrofo inicial; Excel e Sheets exibem o texto e nunca o avaliam |
| Download interpretado no navegador | `Content-Disposition: attachment` com nome fixo e `X-Content-Type-Options: nosniff` |
| Path traversal no upload | o nome do arquivo é só um rótulo gravado junto ao registro de importação; nada toca o filesystem |
| SQL injection | Drizzle parametrizado; nenhum nome de tabela ou coluna vem do usuário |
| Open redirect no `next=` do login | só caminhos que começam com `/` e não com `//` |
| Enumeração de usuários | mensagem única no login; o caminho de falha executa um hash descartável para igualar o tempo de resposta |

## Erros e logs

Nenhuma resposta externa carrega stack trace, SQL, `DATABASE_URL`, caminho de filesystem, exceção interna ou segredo. `withProblemDetails` converte qualquer exceção inesperada em um 500 com código estável e mensagem segura, e registra o detalhe apenas no servidor. Há teste: um repositório que falha com `"connection refused at 10.0.0.7:5432"` produz um corpo que não contém nem o IP nem a porta.

Os logs não recebem senha, token de sessão, token de convite, header `Authorization` nem cookie. A auditoria de login falho grava o endereço tentado, nunca a senha (com teste). A validação de ambiente imprime nomes de variáveis e motivos, jamais valores.

## Headers

Aplicados em `src/proxy.ts`:

- **`Content-Security-Policy`** com nonce por requisição e `strict-dynamic`. `'unsafe-eval'` só existe em desenvolvimento, onde o React o usa para reconstruir stacks.
- **`style-src 'self' 'unsafe-inline'`** — a única flexibilização, deliberada: o `next/font` injeta declarações `@font-face` inline e uma folha de estilo não executa. Scripts continuam sob nonce.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `X-Frame-Options: DENY` e `frame-ancestors 'none'`
- `Strict-Transport-Security` **somente** quando a requisição chega por https — enviá-lo de um servidor local em HTTP envenenaria o `localhost` do navegador para todos os outros projetos da máquina.

## Auditoria

`audit_events` registra: login realizado, login falho, logout, convite criado, convite revogado, convite aceito, membro desativado, membro reativado, permissão alterada, importação executada e validação solicitada.

O campo `metadata` guarda identificadores e desfechos. **Nunca** token, senha, valor de sessão ou header de autorização.

## Testes de segurança

Automatizados — 55 casos em `tests/integration/access.test.ts`, `admin-actions.test.ts` e `api-boundaries.test.ts`.

Manuais, executados com `curl` contra o servidor de desenvolvimento:

| # | Teste | Esperado | Observado |
| --- | --- | --- | --- |
| A | `GET /` sem cookie | redirect para login | `307` → `/login?next=%2F` ✅ |
| A | `GET /guias` sem cookie | redirect para login | `307` → `/login?next=%2Fguias` ✅ |
| A | `GET /configuracoes/equipe` sem cookie | redirect para login | `307` → `/login?next=%2Fconfiguracoes%2Fequipe` ✅ |
| B | Endpoint de admin com sessão MEMBER | recusa no servidor | ação retorna "Esta ação é restrita a administradores."; convite não criado ✅ |
| B | `/configuracoes/equipe` com sessão MEMBER | tela de acesso restrito | "Acesso restrito" renderizado; item some da navegação ✅ |
| C | Convite expirado / revogado / reutilizado | recusa com motivo | os quatro motivos recusados, cada um com sua mensagem ✅ |
| D | `POST /mcp` sem `Authorization` | `401`, sem revelar tools | `401`; corpo não contém nome de tool algum ✅ |
| E | REST externo sem credencial | `401` | `validate`, `guides`, `reports/weekly` → `401` ✅ |
| E | REST com a chave do MCP (e vice-versa) | `401` | `401` nos dois sentidos ✅ |
| F | Payload com campos extras (`role`, `canSubmit`, `__proto__`) | ignorados | `200`, decisão correta, campos extras ausentes do retorno ✅ |
| G | `GET /api/v1/guides/G-NAO-EXISTE` | `404` | `404` ✅ |
| H | Upload acima do limite | `413` | `413 PAYLOAD_TOO_LARGE` ✅ |
| I | CSV com `=CMD(...)` na exportação | neutralizado | célula sai como `'=CMD(...)`, inerte no Excel ✅ |
| J | Erro interno | sem stack trace | `500 INTERNAL_ERROR`; IP e porta ausentes do corpo ✅ |
| — | Bundle do navegador | sem segredos | 0 ocorrências de chave, connection string, `argon2` ou `password_hash` em 29 arquivos ✅ |

## Limitações conhecidas

1. **Rate limit em memória.** Só protege uma instância. Várias instâncias multiplicam o limite efetivo. Um store compartilhado é o próximo passo se isso for para produção com réplicas.
2. **Sem 2FA** e sem fluxo de recuperação de senha. Uma senha perdida hoje se resolve com um novo convite emitido por um administrador.
3. **Sem rotação de sessão por atividade.** A sessão expira em 8 horas a partir do login; não é estendida por uso nem rotacionada periodicamente.
4. **Auditoria não é imutável.** `audit_events` é uma tabela comum; alguém com acesso ao banco pode alterá-la. Append-only real exigiria permissões de banco ou destino externo.
5. **CSP com `style-src 'unsafe-inline'`.** Documentado acima; removê-lo exige um nonce nos estilos do `next/font`.
6. **`/api/health` é público.** Responde apenas se aplicação e banco estão de pé — sem versão, sem hash, sem contagens.
7. **Chave de API única, sem escopos nem rotação.** Adequado a um desafio; um ambiente real quereria credenciais por integrador, com escopo e revogação.
