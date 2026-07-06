import { IMovieSummary } from './IMovieSummary'

export interface IMovieDetails extends IMovieSummary {
  genres?: { id: number; name: string }[]
  runtime?: number
}
