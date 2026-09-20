# Deploy em VPS

O alvo é uma VPS comum com Docker. A aplicação sobe em contêiner, o PostgreSQL
sobe ao lado dela numa rede interna, e um proxy reverso no host termina o TLS.
Nada aqui prende o projeto a um provedor.

## O que fica exposto

| Componente | Porta | Alcance |
| --- | --- | --- |
| Proxy reverso (nginx, Caddy, Traefik) | 80, 443 | internet |
| Aplicação | 3000 | `127.0.0.1` apenas |
| PostgreSQL | 5432 | rede do compose apenas |

O banco **não** tem `ports:` no compose de produção, só `expose:`. Ele é
alcançável pelos contêineres e por mais ninguém. A aplicação publica em
`127.0.0.1:3000`, então nem ela responde direto na interface pública: quem
atende a internet é o proxy.

## 1. Preparar a máquina

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker "$USER"   # reentre na sessão depois disto
```

Firewall permitindo apenas o que precisa:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2. Clonar e configurar

```bash
git clone <url-do-repositorio> vitalis-preflight
cd vitalis-preflight
cp .env.example .env.production
```

Edite `.env.production`. O mínimo:

```bash
APP_URL=https://seu-dominio.com.br
POSTGRES_USER=vitalis
POSTGRES_PASSWORD=<senha forte>
POSTGRES_DB=vitalis_preflight
DATABASE_URL=postgres://vitalis:<senha forte>@postgres:5432/vitalis_preflight
```

Note o host `postgres`: dentro do compose, o banco é alcançado pelo nome do
serviço, não por `localhost`.

Credenciais opcionais de deploy, para integração servidor a servidor:

```bash
openssl rand -base64 48   # VITALIS_API_KEY
openssl rand -base64 48   # VITALIS_MCP_API_KEY
```

`APP_URL` precisa ser o endereço https real: é dele que saem o emissor OAuth, o
`resource` dos tokens MCP e a marcação `Secure` do cookie de sessão.

`VITALIS_API_DEMO_MODE` é fixado em `false` no compose, e o schema de ambiente
recusa ligá-lo em produção.

## 3. Subir

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

A ordem é garantida pelo compose: o banco sobe, o passo `migrate` aplica as
migrations e termina, e só então a aplicação inicia. `restart: unless-stopped`
cobre reboot da VPS; o healthcheck bate em `/api/health` a cada 30 segundos.

## 4. Criar o primeiro acesso

Não existe cadastro público: a primeira conta nasce por script.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  run --rm migrate pnpm exec tsx --conditions=react-server scripts/bootstrap-admin.mts
```

O script pergunta e-mail, nome e senha, sem eco.

## 5. Carregar as guias

Entre em `https://seu-dominio.com.br/importar` e suba o CSV. O mesmo caminho da
avaliação, sem script de carga.

## 6. Proxy reverso

Exemplo com nginx. Qualquer proxy serve, desde que repasse o host original.

```nginx
server {
  listen 443 ssl http2;
  server_name seu-dominio.com.br;

  ssl_certificate     /etc/letsencrypt/live/seu-dominio.com.br/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com.br/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
  }
}

server {
  listen 80;
  server_name seu-dominio.com.br;
  return 301 https://$host$request_uri;
}
```

Com Caddy, duas linhas dão no mesmo e o certificado é automático:

```
seu-dominio.com.br {
  reverse_proxy 127.0.0.1:3000
}
```

A aplicação já envia HSTS, CSP com nonce, `X-Frame-Options`, `nosniff`,
`Referrer-Policy` e `Permissions-Policy`. O proxy não precisa acrescentar nada.

## 7. Conta de avaliação

Quando alguém de fora precisar avaliar o sistema:

```bash
# em .env.production
EVALUATOR_EMAIL=avaliacao@exemplo.com
EVALUATOR_PASSWORD=<senha forte, nunca commitada>
```

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  run --rm migrate pnpm exec tsx --conditions=react-server scripts/provision-evaluator.mts
```

Cria a conta com papel `EVALUATOR` e gera duas chaves de leitura, REST e MCP,
que essa pessoa copia dentro do painel em **Integrações**. Rodar de novo
atualiza a senha e rotaciona as chaves, sem duplicar nada.

## Operação

```bash
# logs
docker compose -f docker-compose.prod.yml logs -f app

# atualizar depois de um git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# backup do banco
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U vitalis vitalis_preflight > backup-$(date +%F).sql
```

## O que não fazer

- Não publicar a porta 5432. O compose de produção não a publica; não acrescente.
- Não colocar segredo em `docker-compose.prod.yml`. Ele é versionado; o
  `.env.production` não é.
- Não ligar `VITALIS_API_DEMO_MODE` em produção. O schema de ambiente recusa.
- Não servir a aplicação em http. Sem https, o cookie de sessão perde o `Secure`
  e o fluxo OAuth do MCP não fecha.
