import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),
  REDIS_URL: z.string().min(1, 'REDIS_URL é obrigatório'),

  TMDB_ACCESS_TOKEN: z.string().min(1, 'TMDB_ACCESS_TOKEN é obrigatório'),
  TMDB_BASE_URL: z.string().default('https://api.themoviedb.org/3'),

  CACHE_TTL_SECONDS: z.coerce.number().default(300),
  TMDB_TIMEOUT_MS: z.coerce.number().default(5000),
  TMDB_RETRY_ATTEMPTS: z.coerce.number().default(3),
  TMDB_RETRY_BASE_DELAY_MS: z.coerce.number().default(200),

  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().default(5),
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: z.coerce.number().default(30000),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', parsed.error.issues)
  process.exit(1)
}

export const env = parsed.data
