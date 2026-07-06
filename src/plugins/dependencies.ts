import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { env } from '../config/env'
import { CacheService } from '../lib/cache'
import { TmdbClient } from '../modules/tmdb/tmdb.client'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    redis: Redis
    cache: CacheService
    tmdbClient: TmdbClient
  }
}

export default fp(async (app: FastifyInstance) => {
  const prisma = new PrismaClient()
  const redis = new Redis(env.REDIS_URL)
  const cache = new CacheService(redis)
  const tmdbClient = new TmdbClient()

  app.decorate('prisma', prisma)
  app.decorate('redis', redis)
  app.decorate('cache', cache)
  app.decorate('tmdbClient', tmdbClient)

  app.addHook('onClose', async () => {
    await prisma.$disconnect()
    redis.disconnect()
  })
})
