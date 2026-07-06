import { PrismaClient } from '@prisma/client'

export interface FavoriteRecord {
  id: string
  tmdbId: number
  title: string
  year: number | null
  posterPath: string | null
  overview: string | null
  watched: boolean
  watchedAt: Date | null
  rating: number | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateFavoriteInput {
  tmdbId: number
  title: string
  year: number | null
  posterPath: string | null
  overview: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): FavoriteRecord {
  return {
    ...row,
    rating:
      row.rating === null || row.rating === undefined
        ? null
        : Number(row.rating),
  }
}

export class FavoritesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTmdbId(tmdbId: number): Promise<FavoriteRecord | null> {
    const row = await this.prisma.favorite.findUnique({ where: { tmdbId } })
    return row ? toDomain(row) : null
  }

  async findAll(): Promise<FavoriteRecord[]> {
    const rows = await this.prisma.favorite.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toDomain)
  }

  async create(data: CreateFavoriteInput): Promise<FavoriteRecord> {
    const row = await this.prisma.favorite.create({ data })
    return toDomain(row)
  }

  async delete(tmdbId: number): Promise<FavoriteRecord> {
    const row = await this.prisma.favorite.delete({ where: { tmdbId } })
    return toDomain(row)
  }

  async markWatched(tmdbId: number, watchedAt: Date): Promise<FavoriteRecord> {
    const row = await this.prisma.favorite.update({
      where: { tmdbId },
      data: { watched: true, watchedAt },
    })

    return toDomain(row)
  }

  async setRating(tmdbId: number, rating: number): Promise<FavoriteRecord> {
    const row = await this.prisma.favorite.update({
      where: { tmdbId },
      data: { rating },
    })
    return toDomain(row)
  }
}
