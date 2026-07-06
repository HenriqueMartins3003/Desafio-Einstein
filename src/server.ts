import { buildApp } from './app'
import { env } from './config/env'

async function main() {
  const app = await buildApp()

  try {
    await app.listen({ port: env.PORT, host: '0.0.0' })
    app.log.info(`Docs disponivel em http://localhost:${env.PORT}/docs`)
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

main()
