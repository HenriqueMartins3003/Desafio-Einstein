import { z } from 'zod'

export const addFavoritesBodySchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
})

export type AddFavoriteBody = z.infer<typeof addFavoritesBodySchema>

export const tmdbIdParamSchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
})

export const setRatingBodySchema = z.object({
  rating: z.coerce
    .number()
    .min(0, 'A nota deve ser maior ou igual a 0')
    .max(10, 'A nota deve ser menor ou igual a 10'),
})

export type SetRatingBody = z.infer<typeof setRatingBodySchema>
