import Fastify from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { env } from './config/env'
import dependencies from './plugins/dependencies'
import errorHandler from './plugins/error-handler'
import { movieRoutes } from './modules/movies/movies.routes'
import { favoritesRoutes } from './modules/favorites/favorites.routes'

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
    ajv: {
      customOptions: {
        strict: false,
      },
    },
  })

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Desafio TMDB',
        description:
          'Api de integracao com o TMDB - funcoes de buscar salvar assistidos e avaliacao',
        version: '1.0.0',
      },
      tags: [
        {
          name: 'movies',
          description: 'Busca e detalhes de filmes (proxy TMDB)',
        },
        {
          name: 'favorites',
          description: 'Favoritos, assistidos e avaliações',
        },
        { name: 'health', description: 'Health check' },
      ],
    },
  })

  await app.register(swaggerUi, { routePrefix: '/docs' })

  await app.register(dependencies)
  await app.register(errorHandler)

  app.get(
    '/health',
    { schema: { tags: ['health'], summary: 'Health check' } },
    async () => ({
      status: 'ok',
      tmdbCircuitState: app.tmdbClient.getCircuiteState(),
    })
  )

  await app.register(movieRoutes)
  await app.register(favoritesRoutes)

  return app
}
