import { IMovieSummary } from './IMovieSummary'

export interface ITmdbSearchResponse {
  page: number
  total_pages: number
  total_results: null
  results: IMovieSummary[]
}
