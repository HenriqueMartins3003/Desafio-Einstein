import { CircuitBreaker } from '../../lib/circuit-breaker'
import { TmdbError } from '../../lib/errors'
import { env } from '../../config/env'
import { request } from 'undici'
import { withRetry } from '../../lib/retry'
import { ITmdbSearchResponse } from './interfaces/ISearchResponse'
import { IMovieDetails } from './interfaces/IMovieDetails'

function isRetryable(error: unknown): boolean {
  if (error instanceof TmdbError) {
    return error.isTimeout || (error.originalStatus ?? 0) >= 500
  }
  return true
}

export class TmdbClient {
  private readonly breaker = new CircuitBreaker({
    failureThreshold: env.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    resetTimeoutMs: env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
  })

  private async rawRequest<T>(
    path: string,
    query: Record<string, string> = {}
  ): Promise<T> {
    const url = new URL(`${env.TMDB_BASE_URL}${path}`)
    url.searchParams.set(`language`, `pt-BR`)

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }

    const controller = new AbortController()
    const timeOut = setTimeout(() => controller.abort(), env.TMDB_TIMEOUT_MS)

    try {
      const response = await request(url.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.TMDB_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.statusCode >= 400) {
        const body = await response.body.text()
        throw new TmdbError(
          `TMDB retornou status ${response.statusCode} com a mensagem: ${body}`,
          response.statusCode
        )
      }

      return (await response.body.json()) as T
    } catch (error) {
      if (error instanceof TmdbError) throw error

      const isAbort = error instanceof Error && error.name === 'AbbortError'
      throw new TmdbError(
        isAbort
          ? 'Timeout na chamada ao TMDB'
          : `Falha de rede ao chamar o TMDB ${(error as Error).message}`,
        undefined,
        isAbort
      )
    } finally {
      clearTimeout(timeOut)
    }
  }

  private async resilientRequest<T>(
    path: string,
    query: Record<string, string> = {}
  ): Promise<T> {
    return this.breaker.execute(() =>
      withRetry(() => this.rawRequest<T>(path, query), {
        attempts: env.TMDB_RETRY_ATTEMPTS,
        baseDelayMs: env.TMDB_RETRY_BASE_DELAY_MS,
        shouldRetry: isRetryable,
      })
    )
  }

  async searchMovies(query: string, page = 1): Promise<ITmdbSearchResponse> {
    return this.resilientRequest<ITmdbSearchResponse>('/search/movie', {
      query,
      page: String(page),
    })
  }

  async getMoviesDetails(tmdbId: number): Promise<IMovieDetails> {
    return this.resilientRequest<IMovieDetails>(`/movie/${tmdbId}`)
  }

  async getPopularMovies(page = 1): Promise<ITmdbSearchResponse> {
    return this.resilientRequest<ITmdbSearchResponse>('/movie/popular', {
      page: String(page),
    })
  }

  getCircuiteState() {
    return this.breaker.getState()
  }
}
