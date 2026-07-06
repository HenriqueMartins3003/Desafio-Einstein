import { describe, expect, it, vi, beforeEach } from 'vitest'
import { FavoritesService } from '../src/modules/favorites/favorites.service'
import { FavoritesRepository } from '../src/modules/favorites/favorites.repository'
import { TmdbClient } from '../src/modules/tmdb/tmdb.client'
import { CacheService } from '../src/lib/cache'
import { ConflitError, NotFoundError, ValidationError } from '../src/lib/errors'

function buildFavorite(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'uuid-1',
    tmdbId: 550,
    title: 'Fight Club',
    year: 1999,
    posterPath: '/poster.jpg',
    overview: 'Sinopse',
    watched: false,
    watchedAt: null,
    rating: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('FavoritesService', () => {
  let repository: FavoritesRepository
  let tmdbClient: TmdbClient
  let cache: CacheService
  let logger: { warn: ReturnType<typeof vi.fn> }
  let service: FavoritesService

  beforeEach(() => {
    repository = {
      findByTmdbId: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      markWatched: vi.fn(),
      setRating: vi.fn(),
    } as unknown as FavoritesRepository

    tmdbClient = {
      getMoviesDetails: vi.fn(),
    } as unknown as TmdbClient

    cache = {
      getOrSet: vi.fn((_key: string, fetcher: () => Promise<unknown>) =>
        fetcher()
      ),
    } as unknown as CacheService

    logger = { warn: vi.fn() }

    service = new FavoritesService(
      repository,
      tmdbClient,
      cache,
      logger as never
    )
  })

  describe('Regra: Duplicidade', () => {
    it('lança ConflictError ao tentar favoritar um filme já favoritado', async () => {
      ;(repository.findByTmdbId as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildFavorite()
      )

      await expect(service.addFavorites(550)).rejects.toBeInstanceOf(
        ConflitError
      )
      expect(tmdbClient.getMoviesDetails).not.toHaveBeenCalled()
    })

    it('permite favoritar um filme novo, buscando detalhes no TMDB', async () => {
      ;(repository.findByTmdbId as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      )
      ;(
        tmdbClient.getMoviesDetails as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 550,
        title: 'Fight Club',
        release_date: '1999-10-15',
        poster_path: '/poster.jpg',
        overview: 'Sinopse',
      })
      ;(repository.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildFavorite()
      )

      await service.addFavorites(550)

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tmdbId: 550,
          title: 'Fight Club',
          year: 1999,
        })
      )
    })
  })

  describe('Regra: Avaliação Restrita', () => {
    it('lança ValidationError ao avaliar filme não assistido', async () => {
      ;(repository.findByTmdbId as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildFavorite({ watched: false })
      )

      await expect(service.rateMovie(550, 8)).rejects.toBeInstanceOf(
        ValidationError
      )
      expect(repository.setRating).not.toHaveBeenCalled()
    })

    it('permite avaliar filme já assistido', async () => {
      ;(repository.findByTmdbId as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildFavorite({ watched: true })
      )
      ;(repository.setRating as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildFavorite({ watched: true, rating: 8.5 })
      )

      const result = await service.rateMovie(550, 8.5)

      expect(repository.setRating).toHaveBeenCalledWith(550, 8.5)
      expect(result.rating).toBe(8.5)
    })

    it('lança NotFoundError ao avaliar filme que não está nos favoritos', async () => {
      ;(repository.findByTmdbId as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      )

      await expect(service.rateMovie(999, 5)).rejects.toBeInstanceOf(
        NotFoundError
      )
    })
  })

  describe('Regra: Nota Válida', () => {
    it.each([-1, 10.1, 11, -0.5])(
      'rejeita nota fora do intervalo: %s',
      async (rating) => {
        ;(
          repository.findByTmdbId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(buildFavorite({ watched: true }))

        await expect(service.rateMovie(550, rating)).rejects.toBeInstanceOf(
          ValidationError
        )
      }
    )

    it.each([0, 5.5, 10])(
      'aceita nota dentro do intervalo: %s',
      async (rating) => {
        ;(
          repository.findByTmdbId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(buildFavorite({ watched: true }))
        ;(repository.setRating as ReturnType<typeof vi.fn>).mockResolvedValue(
          buildFavorite()
        )

        await expect(service.rateMovie(550, rating)).resolves.toBeDefined()
      }
    )
  })

  describe('Regra: Resiliência ao TMDB na listagem', () => {
    it('retorna dados locais (degradado) quando o TMDB falha, sem lançar erro', async () => {
      ;(repository.findAll as ReturnType<typeof vi.fn>).mockResolvedValue([
        buildFavorite(),
      ])
      ;(cache.getOrSet as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('TMDB indisponível')
      )

      const result = await service.listFavorites()

      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('local')
      expect(result[0].title).toBe('Fight Club')
      expect(logger.warn).toHaveBeenCalled()
    })

    it('retorna dados enriquecidos do TMDB quando disponível', async () => {
      ;(repository.findAll as ReturnType<typeof vi.fn>).mockResolvedValue([
        buildFavorite(),
      ])
      ;(cache.getOrSet as ReturnType<typeof vi.fn>).mockImplementation(
        (_key: string, fetcher: () => Promise<unknown>) => fetcher()
      )
      ;(
        tmdbClient.getMoviesDetails as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 550,
        title: 'Fight Club (Atualizado)',
        release_date: '1999-10-15',
        poster_path: '/poster.jpg',
        overview: 'Sinopse atualizada',
      })

      const result = await service.listFavorites()

      expect(result[0].source).toBe('tmdb')
      expect(result[0].title).toBe('Fight Club (Atualizado)')
    })
  })

  describe('Marcar como Assistido', () => {
    it('lança NotFoundError se o filme não é favorito', async () => {
      ;(repository.findByTmdbId as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      )
      await expect(service.markAsWatched(999)).rejects.toBeInstanceOf(
        NotFoundError
      )
    })

    it('marca como assistido registrando a data', async () => {
      ;(repository.findByTmdbId as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildFavorite()
      )
      ;(repository.markWatched as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildFavorite({ watched: true, watchedAt: new Date() })
      )

      const result = await service.markAsWatched(550)

      expect(repository.markWatched).toHaveBeenCalledWith(550, expect.any(Date))
      expect(result.watched).toBe(true)
    })
  })

  describe('Remover Favorito', () => {
    it('lança NotFoundError ao remover filme que não é favorito', async () => {
      ;(repository.findByTmdbId as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      )
      await expect(service.removeFavorites(999)).rejects.toBeInstanceOf(
        NotFoundError
      )
    })

    it('remove um favorito existente', async () => {
      ;(repository.findByTmdbId as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildFavorite()
      )
      await service.removeFavorites(550)
      expect(repository.delete).toHaveBeenCalledWith(550)
    })
  })
})
