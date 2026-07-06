import { z } from 'zod/v4'

export const searchMoviesQuerySchema = z.object({
  query: z.string().min(1, 'Parametro "query" é obrigatorio'),
  page: z.coerce.number().int().min(1).default(1),
})

export type SearchMovieQuery = z.infer<typeof searchMoviesQuerySchema>

export interface SimplifiedMovie {
  tmdbId: number
  title: string
  year: number | null
  posterPath: string | null
  overview: string
  voteAverage: number | null
}
