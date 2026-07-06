import { CacheService } from '../../lib/cache'
import { IMovieDetails } from '../tmdb/interfaces/IMovieDetails'
import { IMovieSummary } from '../tmdb/interfaces/IMovieSummary'
import { TmdbClient } from '../tmdb/tmdb.client'
import { SimplifiedMovie } from './movies.schemas'

export function toSimplifiedMovie(
  movie: IMovieSummary | IMovieDetails
): SimplifiedMovie {
  return {
    tmdbId: movie.id,
    title: movie.title,
    year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
    posterPath: movie.poster_path ?? null,
    overview: movie.overview ?? '',
    voteAverage: movie.vote_average ?? null,
  }
}

export class MovieService {
  constructor(
    private readonly tmdbClient: TmdbClient,
    private readonly cache: CacheService
  ) {}

  async search(query: string, page: number) {
    const cacheKey = `tmdb:search:${query.toLowerCase()}:${page}`

    const respose = await this.cache.getOrSet(cacheKey, () =>
      this.tmdbClient.searchMovies(query, page)
    )

    return {
      page: respose.page,
      totalPages: respose.total_pages,
      totalResults: respose.total_results,
      results: respose.results,
    }
  }

  async getDetails(tmdbId: number) {
    const cachekey = `tmdb:movie:${tmdbId}`
    return this.cache.getOrSet(cachekey, () =>
      this.tmdbClient.getMoviesDetails(tmdbId)
    )
  }
}
