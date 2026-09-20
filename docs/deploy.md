# Deploy em VPS

O alvo é a VPS que já roda Docker Swarm com Portainer e Traefik. O Vitalis
entra como mais uma stack ao lado das que já estão lá, sem tocar em nenhuma
delas e sem disputar nome com nenhuma delas.

A stack inteira está em [`docker-stack.yml`](../docker-stack.yml): aplicação,
banco e migrations.

## Por que tudo se chama vitalis-alguma-coisa

A VPS já tem outro Postgres, outro app, outro tudo. Nome de serviço no Swarm
vira nome de DNS dentro da rede, então dois serviços chamados `postgres` em
stacks diferentes são duas armadilhas esperando alguém conectar no banco
errado. Aqui os três serviços são `vitalis-postgres`, `vitalis-migrate` e
`vitalis-app`, o volume é `vitalis-postgres-data`, e os roteadores do Traefik
são `vitalis-app`. Nada neste projeto responde por um nome genérico.

A rede privada se chama `internal` dentro do arquivo porque o Swarm a publica
como `vitalis_internal`, prefixada pelo nome da stack. Já o volume é externo, e
volume externo não ganha prefixo do Swarm: por isso ele carrega o `vitalis-` no
próprio nome.

## Rede

| Rede | Origem | Quem entra |
| --- | --- | --- |
| `network_swarm_public` | já existe na VPS, é a do Traefik | só o `vitalis-app` |
| `vitalis_internal` | criada por esta stack | os três serviços |

É a mesma `network_swarm_public` que o Traefik já usa (`--providers.swarm.network=network_swarm_public`)
e a mesma em que as outras stacks publicam. O `vitalis-app` entra nela para o
Traefik enxergá-lo, e só por isso.

## O que fica exposto

| Componente | Alcance |
| --- | --- |
| Traefik | internet, 80 e 443 |
| `vitalis-app` | só pelo Traefik, porta 3000 dentro da rede |
| `vitalis-postgres` | só a rede `vitalis_internal` |

O banco não tem `ports:` e não entra na rede pública. Ele não publica porta no
host e não é alcançável nem pelas outras stacks da VPS.

## 1. Build e push das imagens

O Swarm não constrói imagem, ele puxa. Duas imagens, da sua máquina:

```bash
docker build -t kraufort/vitalis-preflight:1.0.0 -f Dockerfile .
docker build -t kraufort/vitalis-preflight-migrate:1.0.0 -f Dockerfile.migrate .
docker push kraufort/vitalis-preflight:1.0.0
docker push kraufort/vitalis-preflight-migrate:1.0.0
```

## 2. Criar o volume, na VPS

```bash
docker volume create vitalis-postgres-data
```

Volume externo de propósito: derrubar e recriar a stack não leva o banco junto.

## 3. Apontar o DNS

Um único registro A, `vitalis-app.api-hub.me`, para o IP da VPS, sem proxy do
Cloudflare. O Traefik emite o certificado sozinho pelo `letsencryptresolver`
no primeiro acesso.

Um host só atende tudo: painel, `/api/v1`, `/mcp` e os metadados OAuth. Eles
precisam compartilhar a origem, porque o emissor OAuth e o `resource` do token
MCP saem os dois do `APP_URL`.

## 4. Subir a stack

Portainer, **Stacks**, **Add stack**, nome `vitalis`, e cole o conteúdo de
`docker-stack.yml`. O domínio já está preenchido como `vitalis-app.api-hub.me`.
Antes de dar deploy, troque no próprio editor:

| Onde está | Troque por |
| --- | --- |
| `senha-do-postgres` | a senha do banco, nos três lugares em que aparece |
| `kraufort` | seu usuário do registry, nas duas imagens |

As linhas que terminam em `=` são opcionais: cole o valor na frente do sinal de
igual ou deixe em branco. Em branco significa não configurado, e a stack sobe
assim mesmo.

O `APP_URL` precisa ser o endereço https real. É dele que saem o emissor OAuth,
o `resource` dos tokens MCP e a marcação `Secure` do cookie de sessão. Sem
https o cookie perde o `Secure` e o fluxo OAuth do MCP não fecha, e o schema de
ambiente recusa subir em produção com `http://`.

No primeiro deploy o `vitalis-app` pode reiniciar uma ou duas vezes enquanto o
`vitalis-migrate` aplica o schema. É esperado. O `vitalis-migrate` termina e
fica como concluído: ele roda uma vez e sai.

## 5. Criar o primeiro acesso

Não existe cadastro público: a primeira conta nasce por script, e o script vive
na imagem de migrations.

```bash
docker run --rm -it \
  --network vitalis_internal \
  -e DATABASE_URL=postgres://vitalis:senha-do-postgres@vitalis-postgres:5432/vitalis_preflight \
  kraufort/vitalis-preflight-migrate:1.0.0 \
  pnpm exec tsx --conditions=react-server scripts/bootstrap-admin.mts
```

Pergunta e-mail, nome e senha, sem eco.

## 6. Carregar as guias

Entre em `https://vitalis-app.api-hub.me/importar` e suba o CSV. O mesmo caminho da
avaliação, sem script de carga.

## 7. Conta de avaliação

Quando alguém de fora precisar avaliar o sistema:

```bash
docker run --rm \
  --network vitalis_internal \
  -e DATABASE_URL=postgres://vitalis:senha-do-postgres@vitalis-postgres:5432/vitalis_preflight \
  -e EVALUATOR_EMAIL=email-do-avaliador \
  -e EVALUATOR_PASSWORD=senha-do-avaliador \
  kraufort/vitalis-preflight-migrate:1.0.0 \
  pnpm exec tsx --conditions=react-server scripts/provision-evaluator.mts
```

Cria a conta com papel `EVALUATOR` e gera duas chaves de leitura, REST e MCP,
que essa pessoa copia dentro do painel em **Integrações**. Rodar de novo
atualiza a senha e rotaciona as chaves, sem duplicar nada.

## Operação

```bash
# logs
docker service logs -f vitalis_vitalis-app

# atualizar depois de um build e push novos
docker service update --image kraufort/vitalis-preflight:1.0.1 vitalis_vitalis-app

# backup do banco
docker exec $(docker ps -q -f name=vitalis_vitalis-postgres) \
  pg_dump -U vitalis vitalis_preflight > backup-$(date +%F).sql
```

## O que não fazer

- Não publicar a porta 5432. A stack não publica; não acrescente `ports:` ao
  `vitalis-postgres`.
- Não colocar o `vitalis-postgres` na `network_swarm_public`. Lá ele passa a ser
  alcançável por toda stack da VPS.
- Não deixar a senha real no arquivo versionado. Ela é colada no editor do
  Portainer, que guarda a stack fora do repositório.
- Não ligar `VITALIS_API_DEMO_MODE` em produção. O schema de ambiente recusa.
- Não servir a aplicação em http.
