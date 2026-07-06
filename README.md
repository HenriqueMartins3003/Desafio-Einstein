# Desafio Técnico – Favoritos de Filmes (TMDB)

API REST que integra com o The Movie Database (TMDB) (https://www.themoviedb.org) para buscar filmes, favoritá-los, marcá-los como assistidos e avaliá-los.

---

## Stack

| Camada          | Tecnologia           | Justificativa                                                                             |
| --------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| Runtime         | Node.js + TypeScript | Requisito do desafio; tipagem estática reduz bugs em contratos de API                     |
| Framework       | Fastify v5           | Schema-first, serialização mais rápida que Express, suporte nativo a plugins e Swagger    |
| ORM             | Prisma               | Type-safety completo, migrations versionadas, Desenvolvimento mais fluido (otimo DX)      |
| Banco           | PostgreSQL 16        | Relacional robusto; `tmdbId` único garante integridade sem lógica extra                   |
| Cache           | Redis 7 + ioredis    | Time To Live(TTL) configurável por chave; persistência além do processo                   |
| HTTP client     | undici               | Nativo do Node.js, zero dependências externas, suporte a `AbortController` para timeout   |
| Validação       | Zod                  | Valida env vars e request bodies com mensagens de erro descritivas                        |
| Testes          | Vitest               | API idêntica ao Jest, extremamente rápido com suporte nativo a ESM/TypeScript             |
| Package manager | Yarn                 | Instalação determinística via `yarn.lock`, cache local eficiente e comandos mais concisos |

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose
- [Node.js](https://nodejs.org) >= 20 (apenas para desenvolvimento local)
- [Yarn](https://yarnpkg.com) >= 1.22 — recomendado como gerenciador de pacotes (`npm install -g yarn`)
- Conta gratuita no [TMDB](https://www.themoviedb.org) com um **API Read Access Token** (v4)

---

## Configuração

### 1. Variáveis de ambiente

Copie o arquivo de exemplo e preencha os valores:

```bash
cp .env.example .env
```

Edite o `.env` e defina `TMDB_ACCESS_TOKEN` com o seu **API Read Access Token**, disponível em:
`themoviedb.org → Configurações → API → API Read Access Token (v4 auth)`

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tmdb_challenge?schema=public
REDIS_URL=redis://localhost:6379

TMDB_ACCESS_TOKEN=seu_token_aqui
TMDB_BASE_URL=https://api.themoviedb.org/3

CACHE_TTL_SECONDS=300
TMDB_TIMEOUT_MS=5000
TMDB_RETRY_ATTEMPTS=3
TMDB_RETRY_BASE_DELAY_MS=200

CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT_MS=30000
```

---

## Execução

### Via Docker Compose (recomendado)

Sobe todos os serviços (API, PostgreSQL e Redis), aplica as migrations e inicia a aplicação:

```bash
docker compose up --build -d
```

Para acompanhar os logs:

```bash
docker compose logs -f api
```

Para parar:

```bash
docker compose down
```

### Desenvolvimento local

Requer PostgreSQL e Redis rodando. Pode rodar os serviços de infraestrutura via Docker usando o mesmo compose já criado:

```bash
docker compose up postgres redis -d
```

Instale as dependências e aplique as migrations:

```bash
yarn install
yarn prisma:migrate
```

Inicie em modo watch:

```bash
yarn dev
```

---

## Documentação da API

Com a aplicação rodando, acesse o Swagger em:

```
http://localhost:3000/docs
```

### Endpoints disponíveis

| Método   | Rota                          | Descrição                                  |
| -------- | ----------------------------- | ------------------------------------------ |
| `GET`    | `/movies/search?query=&page=` | Busca filmes no TMDB                       |
| `GET`    | `/movies/popular`             | Lista filmes populares                     |
| `POST`   | `/favorites`                  | Adiciona filme aos favoritos               |
| `GET`    | `/favorites`                  | Lista favoritos com dados enriquecidos     |
| `DELETE` | `/favorites/:tmdbId`          | Remove um favorito                         |
| `PATCH`  | `/favorites/:tmdbId/watched`  | Marca filme como assistido                 |
| `PATCH`  | `/favorites/:tmdbId/rating`   | Avalia um filme assistido (0–10)           |
| `GET`    | `/health`                     | Health check com estado do Circuit Breaker |

---

## Testes

```bash
# Execução única
yarn test

# Modo watch
yarn test:watch
```

Os testes cobrem:

- **`FavoritesService`** — todas as regras de negócio: duplicidade, avaliação restrita, nota válida, resiliência ao TMDB
- **`CircuitBreaker`** — transições CLOSED → OPEN → CLOSED (com fake timers)
- **`withRetry`** — backoff exponencial, tentativas esgotadas, sucesso intermediário

---

## Decisões Técnicas

### undici no lugar de axios ou fetch nativo

O `undici` é o cliente HTTP subjacente do próprio Node.js, sem dependências transitivas. Oferece suporte explícito a `AbortController` para timeout preciso e é ligeiramente mais performático que o `fetch` global em cargas altas.

### Retry e Circuit Breaker implementados do zero

Optei por não adicionar bibliotecas como `opossum` ou `async-retry`. As implementações próprias têm cerca de 30–50 linhas cada, são totalmente auditáveis e evitam dependências com APIs que mudam entre versões. O trade-off é que não implementei o estado `HALF_OPEN` no Circuit Breaker — após o `resetTimeoutMs`, a primeira chamada bem-sucedida fecha o circuito diretamente.

### Fastify com schema inline + Zod

O Fastify usa JSON Schema para validação e serialização automática. Zod é usado em paralelo para validar env vars na inicialização (`process.exit(1)` se falhar) e nos handlers onde a coerção de tipos é necessária. A duplicação de schema é intencional: JSON Schema serve a documentação, Zod serve à segurança de tipos em runtime.

### Autenticação via Bearer Token (TMDB v4)

A integração usa `Authorization: Bearer <token>` no header em vez de `api_key` na query string (padrão v3). Além de seguir a especificação atual da TMDB, evita que o token apareça em logs de acesso de servidores e histórico de proxies. A variável `TMDB_ACCESS_TOKEN` corresponde ao **API Read Access Token** gerado no painel da TMDB.

### Fallback degradado na listagem de favoritos

Quando o TMDB falha durante a listagem, cada filme é retornado com `source: "local"` usando os dados persistidos no banco, sem propagar o erro para o cliente. O campo `source` permite ao frontend sinalizar visualmente que os dados podem estar desatualizados.

---

## Diferenciais Implementados

- **Cache com TTL** — Redis com TTL configurável via `CACHE_TTL_SECONDS` (padrão 5 min)
- **Retry com backoff exponencial + jitter** — evita thundering herd em falhas transitórias do TMDB
- **Circuit Breaker** — abre após N falhas consecutivas e bloqueia chamadas durante o período de reset
- **Logs estruturados** — Pino (built-in do Fastify) com `pino-pretty` em desenvolvimento e JSON em produção
- **Swagger/OpenAPI** — documentação interativa em `/docs`

---

## O que melhoraria com mais tempo

- **Estado HALF_OPEN no Circuit Breaker** — permitiria uma chamada de sondagem antes de fechar o circuito completamente, reduzindo o risco de reabrir imediatamente
- **Testes de integração** — cobertura dos endpoints com banco e Redis reais usando Testcontainers
- **Rate limiting** — respeitar os limites de requisições da TMDB (40 req/10s) com fila interna
- **Paginação na listagem de favoritos** — a listagem atual retorna todos os registros; com muitos favoritos, isso se torna um problema
- **Autenticação** — sem autenticação, os favoritos são globais; um sistema real precisaria de usuários com JWT ou sessão
