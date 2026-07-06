import { FastifyInstance } from 'fastify'
import { MovieService } from './movies.service'
import { searchMoviesQuerySchema } from './movies.schemas'

export async function movieRoutes(app: FastifyInstance) {
  const movieService = new MovieService(app.tmdbClient, app.cache)

  app.get(
    '/movies/search',
    {
      schema: {
        tags: ['movies'],
        summary: 'Busca filmes no TMDB',
        querystring: {
          type: 'object',
          require: ['query'],
          properties: {
            query: { type: 'string' },
            page: { type: 'integer', minimun: 1, default: 1 },
          },
        },
      },
    },
    async (req) => {
      const { query, page } = searchMoviesQuerySchema.parse(req.query)
      return movieService.search(query, page)
    }
  )

  app.get(
    '/movies/popular',
    {
      schema: {
        tags: ['movies'],
        summary: 'Lista filmes populares no TMDB',
      },
    },
    async () => {
      const response = await app.tmdbClient.getPopularMovies()
      return {
        page: response.page,
        totalPages: response.total_pages,
        results: response.results,
      }
    }
  )
}
