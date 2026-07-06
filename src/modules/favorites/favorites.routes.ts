import { FastifyInstance } from 'fastify'
import { FavoritesRepository } from './favorites.repository'
import { FavoritesService } from './favorites.service'
import {
  addFavoritesBodySchema,
  setRatingBodySchema,
  tmdbIdParamSchema,
} from './favorites.schemas'

export async function favoritesRoutes(app: FastifyInstance) {
  const repository = new FavoritesRepository(app.prisma)
  const service = new FavoritesService(
    repository,
    app.tmdbClient,
    app.cache,
    app.log
  )

  app.post(
    '/favorites',
    {
      schema: {
        tags: ['favorites'],
        summary: 'Adciona um filme a lista de favoritos',
        body: {
          type: 'object',
          required: ['tmdbId'],
          properties: { tmdbId: { type: 'integer' } },
        },
      },
    },
    async (req, reply) => {
      const { tmdbId } = addFavoritesBodySchema.parse(req.body)
      const favorite = await service.addFavorites(tmdbId)
      return reply.code(201).send(favorite)
    }
  )

  app.get(
    '/favorites',
    {
      schema: {
        tags: ['favorites'],
        summary:
          'Lista os filmes favoritos com dados do TMDB (fallback com dados em cache)',
      },
    },
    async () => service.listFavorites()
  )

  app.delete(
    '/favorites/:tmdbId',
    {
      schema: {
        tags: ['favorites'],
        summary: 'Remove um filme da lsita de favoritos',
        params: {
          type: 'object',
          properties: { tmdbId: { type: 'integer' } },
        },
      },
    },
    async (req, reply) => {
      const { tmdbId } = tmdbIdParamSchema.parse(req.params)
      await service.removeFavorites(tmdbId)
      return reply.code(204).send()
    }
  )

  app.patch(
    '/favorites/:tmdbId/rating',
    {
      schema: {
        tags: ['favorites'],
        summary: 'Avalia um filme de 0 a 10 já assistido',
        params: {
          type: 'object',
          properties: { tmdbId: { type: 'integer' } },
        },
        body: {
          type: 'object',
          required: ['rating'],
          properties: { rating: { type: 'number', minimum: 0, maximum: 10 } },
        },
      },
    },
    async (req) => {
      const { tmdbId } = tmdbIdParamSchema.parse(req.params)
      const { rating } = setRatingBodySchema.parse(req.body)
      return service.rateMovie(tmdbId, rating)
    }
  )
  app.patch(
    '/favorites/:tmdbId/watched',
    {
      schema: {
        tags: ['favorites'],
        summary: 'Marca um filme favorito como assistido',
        params: {
          type: 'object',
          properties: { tmdbId: { type: 'integer' } },
        },
      },
    },
    async (req) => {
      const { tmdbId } = tmdbIdParamSchema.parse(req.params)
      return service.markAsWatched(tmdbId)
    }
  )
}
