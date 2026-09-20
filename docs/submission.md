# Submissão - Expert Integrado

Campos do formulário da prova, com o que já pode ser colado e o que ainda
depende de uma ação externa. Nenhuma credencial neste arquivo: senha e chaves
são entregues pelo formulário, nunca pelo repositório.

## URL da solução

**PENDENTE até o deploy na VPS.** O procedimento está em
[`docs/deploy.md`](deploy.md); depois de subir, o valor é `https://<domínio>`.

O avaliador entra pelo login com a conta de avaliação. Não existe cadastro
público: toda conta nasce de convite ou do script de provisionamento.

## Credenciais do avaliador

Conta provisionada por `pnpm seed:evaluator`, com papel `EVALUATOR`.

- E-mail: definido em `EVALUATOR_EMAIL`, informado no formulário.
- Senha: definida em `EVALUATOR_PASSWORD`, informada no formulário.

**Nunca commitadas.** O papel dá acesso de leitura ao produto inteiro e às
chaves de avaliação, e não permite convidar, alterar papéis, editar regras nem
gravar pela API.

## Guia nova pela API

| Campo | Valor |
| --- | --- |
| URL | `https://<domínio>/api/v1/guides/validate` |
| Método | `POST` |
| Headers | `Authorization: Bearer <chave>` e `Content-Type: application/json` |
| Corpo | JSON com os nomes de coluna do CSV |
| Resposta | JSON com `status`, `canSubmit`, `findings`, `recommendedActions`, `normalizations`, `rules` |

A chave de avaliação aparece por inteiro em **Integrações > API REST >
Endpoints**, depois do login, com o `curl` pronto para copiar.

Obrigatórios: `id_guia`, `unidade`, `data_atendimento`, `paciente`, `convenio`,
`procedimento_codigo`. Os demais campos podem faltar, e o que faltar vira
finding, não erro.

Validar **não** grava: a rota calcula a decisão e não cria, altera nem versiona
guia nenhuma. Problema de negócio devolve HTTP 200 com o resultado em `status`;
payload inválido devolve 400 ou 422; sem credencial, 401.

## MCP

| Campo | Valor |
| --- | --- |
| Endpoint | `https://<domínio>/mcp` |
| Transporte | Streamable HTTP, stateless |
| Autenticação | OAuth 2.1 com PKCE, ou Bearer com a chave de avaliação |

Tools publicadas, todas somente de leitura:

- `consultar_regra_convenio` - regras vigentes de um convênio para um procedimento
- `verificar_guia` - decisão e motivo de uma guia, nova ou existente
- `consultar_guia` - decisão registrada, com histórico
- `resumo_operacional` - situação geral, com filtros

A chave MCP fica em **Integrações > MCP > Conectar**, com a configuração de
cliente pronta. Quem preferir não copiar chave nenhuma aponta o cliente para a
URL e autoriza pelo fluxo OAuth com a mesma conta.

## Relatório do Dr. Renato

`https://<domínio>/relatorio/terca`

Filtros de 7, 15, 30 e 90 dias, período próprio, unidade e convênio. Todos os
números são calculados sobre as guias importadas.

## Skill

`skills/vitalis-guide-review/` no repositório.

```bash
mkdir -p ~/.claude/skills
cp -r skills/vitalis-guide-review ~/.claude/skills/
```

Depende do MCP conectado. Exemplo de entrada e de resposta no README.

## Repositório

**PENDENTE até a publicação.**

## Vídeo

**PENDENTE.**

## Horas e ferramentas

Seção "Como fiz" do [README](../README.md). Horas: **PENDENTE**.
