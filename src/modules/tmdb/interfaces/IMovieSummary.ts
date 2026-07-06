export interface IMovieSummary {
  id: number
  title: string
  release_date?: string
  poster_path?: string | null
  overview?: string
  vote_average?: number
}
