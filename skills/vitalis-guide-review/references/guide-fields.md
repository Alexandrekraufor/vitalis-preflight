# Campos de uma guia

Os nomes abaixo são os que as tools `verificar_guia` e `consultar_guia` esperam. Use exatamente esses nomes. Omita o que não foi informado.

| Campo | O que é | Como costuma aparecer no texto da recepção |
| --- | --- | --- |
| `id_guia` | Identificador da guia | "guia G-2608-0041", "G2608-0041" |
| `unidade` | Unidade da clínica | "Centro", "Norte", "Sul" |
| `data_atendimento` | Dia da sessão ou consulta | "20/08/2026", "atendimento dia 20/08" |
| `paciente` | Código anônimo do paciente | "P-1026" |
| `convenio` | Convênio | "Vitalcard", "Saúde Interior", "Plano Bem" |
| `carteirinha` | Identificador do paciente no convênio | número longo; **é texto**, pode ter zeros à esquerda |
| `cid` | CID informado | "M79.7", "G81.9" |
| `procedimento_codigo` | Código do procedimento | "50000470", "fisio 50000470" |
| `procedimento_descricao` | Descrição do procedimento | "sessão de fisioterapia musculoesquelética" |
| `numero_autorizacao` | Autorização emitida pelo convênio | "AUT887507" |
| `autorizacao_validade` | Último dia de validade, **inclusive** | "válida até 31/08" |
| `autorizacao_sessoes_limite` | Quantas sessões a autorização cobre | "autorização de 10 sessões" |
| `sessao_numero_na_autorizacao` | Qual sessão é esta | "sessão 7 de 10", "7ª sessão" |
| `profissional` | Nome do profissional | "Bruno Castanho" |
| `profissional_registro` | CREFITO ou CRM | "CREFITO-3 204411-F", "CRM-SP 112390" |
| `valor` | Valor em reais | "R$ 62,00", "62.00", "62" |
| `observacao_recepcao` | Texto livre da recepcionista | copie literalmente, sem resumir |
| `data_lancamento` | Dia em que a guia foi lançada no sistema da clínica | "lancei ontem" não é data — omita |

## Cuidados

**Carteirinha é texto.** Nunca a converta para número: zeros à esquerda somem.

**Validade é inclusiva.** Atendimento no último dia de validade está dentro do prazo.

**A observação vai inteira.** O Vitalis Preflight interpreta o texto livre e precisa da frase original para citar a evidência. Não resuma, não reescreva, não traduza.

**Data incompleta não é data.** "Validade 30/09" sem ano: pergunte o ano ou deixe o campo ausente. Não assuma o ano corrente.

**Descrição não vira código.** Se a pessoa descreveu o procedimento mas não deu o código, deixe `procedimento_codigo` ausente e diga que ele falta. Não procure o código "equivalente".

## Procedimentos conhecidos

Esta lista serve apenas para você reconhecer que um código citado é plausível. A cobertura, o valor e as regras vêm sempre de `consultar_regra_convenio`.

| Código | Descrição |
| --- | --- |
| 50000470 | Sessão de fisioterapia musculoesquelética |
| 50000560 | Sessão de fisioterapia neurofuncional |
| 50000012 | Reavaliação fisioterapêutica |
| 20103301 | Consulta ortopédica |
| 40201015 | Infiltração articular |
