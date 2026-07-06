import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors'

export default fp(async (app: FastifyInstance) => {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(422).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados invalidos',
        details: error.flatten().fieldErrors,
      })
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.code,
        message: error.message,
      })
    }

    if ((error as { code?: string }).code === 'P2025') {
      return reply
        .code(404)
        .send({ error: 'NOT_FOUND', message: 'Recurso não encontrado' })
    }

    request.log.error(error)

    return reply.code(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno inesperado',
    })
  })
})
