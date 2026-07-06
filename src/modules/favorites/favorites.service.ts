import { FastifyBaseLogger } from 'fastify'
import { CacheService } from '../../lib/cache'
import { TmdbClient } from '../tmdb/tmdb.client'
import { FavoritesRepository } from './favorites.repository'
import { ConflitError, NotFoundError, ValidationError } from '../../lib/errors'
import { toSimplifiedMovie } from '../movies/movies.service'

export interface EnrichedFavorites {
  tmdbId: number
  title: string
  year: number | null
  posterPath: string | null
  overview: string | null
  watched: boolean
  watchedAt: Date | null
  rating: number | null
  source: 'tmdb' | 'local'
}

export class FavoritesService {
  constructor(
    private readonly repositroy: FavoritesRepository,
    private readonly tmdbClient: TmdbClient,
    private readonly cache: CacheService,
    private readonly logger: FastifyBaseLogger
  ) {}

  async addFavorites(tmdbId: number) {
    const existing = await this.repositroy.findByTmdbId(tmdbId)
    if (existing) {
      throw new ConflitError(`O filme ${tmdbId} já está nos favoritos`)
    }

    const details = await this.cache.getOrSet(`tmdb:movie:${tmdbId}`, () =>
      this.tmdbClient.getMoviesDetails(tmdbId)
    )
    const simplified = toSimplifiedMovie(details)

    return this.repositroy.create({
      tmdbId: simplified.tmdbId,
      title: simplified.title,
      year: simplified.year,
      posterPath: simplified.posterPath,
      overview: simplified.overview,
    })
  }

  async removeFavorites(tmdbId: number) {
    const existing = await this.repositroy.findByTmdbId(tmdbId)

    if (!existing)
      throw new NotFoundError(`Filme ${tmdbId} não está na lista de favoritos`)

    await this.repositroy.delete(tmdbId)
  }

  async listFavorites(): Promise<EnrichedFavorites[]> {
    const favorites = await this.repositroy.findAll()

    return Promise.all(
      favorites.map(async (favorite) => {
        try {
          const details = await this.cache.getOrSet(
            `tmdb:movie:${favorite.tmdbId}`,
            () => this.tmdbClient.getMoviesDetails(favorite.tmdbId)
          )
          const simplified = toSimplifiedMovie(details)

          return {
            tmdbId: favorite.tmdbId,
            title: simplified.title,
            year: simplified.year,
            posterPath: simplified.posterPath,
            overview: simplified.overview,
            watched: favorite.watched,
            watchedAt: favorite.watchedAt,
            rating: favorite.rating,
            source: 'tmdb' as const,
          }
        } catch (error) {
          this.logger.warn(
            { err: error, tmdbId: favorite.tmdbId },
            'TMDB Indisponivel, Retornado dados locais'
          )
        }
        return {
          tmdbId: favorite.tmdbId,
          title: favorite.title,
          year: favorite.year,
          posterPath: favorite.posterPath,
          overview: favorite.overview,
          watched: favorite.watched,
          watchedAt: favorite.watchedAt,
          rating: favorite.rating,
          source: 'local' as const,
        }
      })
    )
  }
  async markAsWatched(tmdbId: number) {
    const existing = await this.repositroy.findByTmdbId(tmdbId)
    if (!existing) {
      throw new NotFoundError(`Filme ${tmdbId} não está nos favoritos`)
    }
    return this.repositroy.markWatched(tmdbId, new Date())
  }

  async rateMovie(tmdbId: number, rating: number) {
    if (rating < 0 || rating > 10) {
      throw new ValidationError('A nota deve estar entre 0 e 10')
    }

    const existing = await this.repositroy.findByTmdbId(tmdbId)
    if (!existing) {
      throw new NotFoundError(`Filme ${tmdbId} não está nos favoritos`)
    }

    if (!existing.watched) {
      throw new ValidationError(
        'Só é possível avaliar filmes já marcados como assistidos'
      )
    }

    return this.repositroy.setRating(tmdbId, rating)
  }
}
