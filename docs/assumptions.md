# Premissas e limites

O que este sistema **não** conclui, e por quê. Cada item aqui é uma decisão de não inventar informação.

## 1. `prazo_envio_dias` não é verificado

**A regra:** cada convênio aceita guias até N dias depois do atendimento (30 dias para Vitalcard e Plano Bem, 45 para Saúde Interior).

**O dado que falta:** a data em que a guia chegou ao convênio.

**Por que `data_lancamento` não serve:** ela registra o momento em que a recepção digitou a guia no sistema de gestão da clínica. Lançar internamente e enviar ao convênio são dois eventos distintos, e o dataset não diz nada sobre o segundo. Tratar um como o outro produziria guias reprovadas - ou aprovadas - por um prazo que ninguém mediu.

**O que o sistema faz:** o validador existe (`submission-deadline.validator.ts`) e roda assim que receber uma data de envio real através de `SupplementaryGuideData.submittedToConventionAt`. Enquanto esse dado não existir, ele não emite finding algum.

**Como habilitar:** passe `submittedToConventionAt` ao chamar `validateGuide`. O teste que cobre esse caminho já está em `tests/unit/rule-engine.test.ts`.

## 2. `validade_maxima_autorizacao_dias` não é verificada

**A regra:** uma autorização não pode ter validade maior que N dias (30, 45 ou 60, conforme o convênio).

**O dado que falta:** a data de emissão da autorização. O dataset traz apenas `autorizacao_validade`, o último dia de cobertura.

**Por que não dá para derivar:** sem a emissão, qualquer janela seria arbitrária - assumir "emitida N dias antes da validade" torna a regra circular e sempre verdadeira.

**O que o sistema faz:** `authorization-validity-window.validator.ts` está implementado e silencioso até receber `SupplementaryGuideData.authorizationIssuedAt`.

**O que continua sendo verificado:** o vencimento em si. Se `autorizacao_validade < data_atendimento`, a guia é bloqueada.

## 3. Datas `DD/MM/AAAA` são lidas como dia/mês

O dataset traz duas datas fora do padrão: `03/08/2026` e `26/08/2026`. A segunda é inequívoca (26 não é mês). A primeira, isolada, poderia ser 3 de agosto ou 8 de março.

**Decisão:** interpretar como dia/mês, a convenção brasileira, consistente com o restante do arquivo.

**Por que é seguro:** a conversão é registrada como uma normalização auditável (`DATE_REFORMATTED`), aparece na tela da guia, na resposta da API e no banco. Ninguém precisa confiar na decisão - dá para conferir.

Datas impossíveis sob essa leitura (`31/02/2026`) **não** são convertidas: a guia é rejeitada com erro estrutural, em vez de ser "consertada".

## 4. A validade da autorização é inclusiva

`autorizacao_validade = data_atendimento` é válido. Só um atendimento **posterior** ao último dia gera `AUTHORIZATION_EXPIRED`. Está explícito no enunciado das regras e coberto por teste nos dois sentidos.

## 5. Limite de sessões tem dois tetos independentes

Uma sessão pode estourar o limite impresso na própria autorização, o máximo que o convênio permite por autorização, ou ambos. São findings distintos (`AUTHORIZATION_SESSION_LIMIT_EXCEEDED` e `CONVENTION_SESSION_LIMIT_EXCEEDED`) porque a ação é diferente em cada caso.

Quando a autorização registra um limite **acima** do máximo do convênio (por exemplo, 15 sessões em um convênio que permite 10), isso vira `AUTHORIZATION_LIMIT_ABOVE_CONVENTION_MAX` com severidade de revisão: o sistema não sabe qual dos dois números está errado.

## 6. Reavaliação a cada 10 sessões (Vitalcard) não é uma regra separada

A observação do Vitalcard diz: *"Reavaliação médica obrigatória a cada 10 sessões; nova autorização a cada reavaliação."*

Como o limite de sessões por autorização do Vitalcard já é 10, a verificação de sessões cobre o efeito prático dessa regra. Não foi criada uma regra adicional de "reavaliação vencida" porque o dataset não registra reavaliações, e inventar o rastreamento produziria bloqueios sem base.

O texto da observação viaja inteiro nas respostas da API e do MCP, para que um humano ou um agente o leia na íntegra.

## 7. Consulta médica no Plano Bem

O Plano Bem não cobre consulta médica e a observação da regra diz que consulta "é faturada como particular". O sistema emite `PROCEDURE_NOT_COVERED` (bloqueante) e repassa a observação na mensagem - mas **não** refatura a guia como particular. Mudar a forma de faturamento é decisão comercial, não de validação.

## 8. Remarcação de sessão não invalida autorização

A guia `G-2608-0016` traz *"Sessão remarcada de 12/08 para hoje, autorização era da data original."*

Nenhuma regra dos três convênios trata remarcação. O sistema registra um finding informativo (`SESSION_RESCHEDULED_NOTE`, severidade `INFO`), que aparece na tela e **não altera a decisão**. A validade da autorização continua sendo verificada contra `data_atendimento`, como em qualquer outra guia.

## 9. Faturamento particular pedido pelo paciente

`G-2608-0039` traz *"Paciente pediu para faturar como particular, não quer usar o convênio."* A guia não tem nenhum problema estrutural.

O sistema marca `REVIEW_REQUIRED`, não `NEEDS_CORRECTION`: não há nada a corrigir nos dados. Há uma decisão comercial a tomar, e ela é de uma pessoa.

## 10. Procedimento contraditado pela observação

`G-2608-0069` diz que o procedimento realizado foi drenagem linfática, enquanto o código lançado é de consulta ortopédica.

O sistema marca `REVIEW_REQUIRED` e **não sugere o código correto**. Drenagem linfática não está na tabela de procedimentos das regras vigentes; deduzir um código seria inventar informação clínica e contratual.

## 11. Convênio desconhecido

Um convênio fora do arquivo de regras gera `UNKNOWN_CONVENTION` com severidade de revisão, e **nenhuma outra regra de convênio é aplicada** - não há regra a aplicar. O sistema não assume o comportamento de um convênio parecido.

## 12. Observação que o interpretador não reconhece

O interpretador heurístico conhece os padrões relevantes e também uma lista de observações operacionais corriqueiras (atraso, recibo, confirmação por WhatsApp, exame anexado), que explicitamente **não** geram findings.

Uma observação fora desses dois conjuntos produz `NOTE_REQUIRES_HUMAN_REVIEW`. É deliberadamente conservador: um heurístico que não entendeu o texto deve dizer isso, não fingir que o texto era irrelevante. O interpretador baseado em modelo cobre o caso geral com mais alcance, e descarta qualquer fato cuja evidência não esteja literalmente na observação.

## 13. O período do relatório executivo

O relatório semanal agrupa por `data_atendimento`, não por `data_lancamento`, porque é a data do evento clínico. Por padrão mostra a semana que termina no atendimento mais recente registrado; a data final é ajustável na própria tela e via `?through=AAAA-MM-DD`.

## 14. Volume

As agregações dos painéis são feitas em memória sobre a lista de guias. É adequado para a ordem de grandeza deste caso (dezenas a poucos milhares de guias) e mantém a lógica testável sem banco. Acima disso, o lugar de mover para SQL é `application/reports/` - nenhuma regra de negócio muda.

## 15. Validar uma guia não a registra

`POST /api/v1/guides/validate` responde com uma decisão e **não cria a guia**. Uma guia enviada por ali não aparece no painel.

Isso é deliberado e foi uma correção: antes, validar ingeria. Misturar as duas coisas significava que consultar alterava dados operacionais, e que uma credencial de leitura podia escrever. A ingestão tem caminho próprio (upload de CSV, seed) e autorização própria.

A consequência prática: para ver uma guia no painel, importe-a. Para saber se ela passaria, valide-a.

## 16. O primeiro administrador não é semeado

Não existe conta padrão, nem senha inicial no repositório. A primeira identidade vem de `pnpm bootstrap:admin`, que exige acesso ao shell do deployment. Um repositório público com um administrador semeado seria um administrador conhecido por todo mundo.

## 17. O e-mail de um convite não pode ser trocado

Quem abre `/invite/<token>` define nome e senha, mas não o endereço: ele vem do convite armazenado. Sem isso, um link vazado permitiria criar conta para qualquer endereço, inclusive o de alguém que já trabalha na clínica.
