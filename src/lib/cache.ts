import Redis from 'ioredis'
import { env } from '../config/env'

export class CacheService {
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key)

    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  async set(
    key: string,
    value: unknown,
    ttlSeconds = env.CACHE_TTL_SECONDS
  ): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = env.CACHE_TTL_SECONDS
  ): Promise<T> {
    const cached = await this.get<T>(key)

    if (cached !== null) return cached

    const fresh = await fetcher()
    await this.set(key, fresh, ttlSeconds)
    return fresh
  }
}
