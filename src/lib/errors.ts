export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = `BAD_REQUEST`
  ) {
    super(message)
    this.name = `AppError`
  }
}

export class NotFoundError extends AppError {
  constructor(message = `Recurso náo encontrado`) {
    super(message, 404, `NOT_FOUND`)
  }
}

export class ConflitError extends AppError {
  constructor(message = `Conflito de estado`) {
    super(message, 409, `CONFLICT`)
  }
}

export class ValidationError extends AppError {
  constructor(message = `Dados inválidos`) {
    super(message, 422, `VALIDATION_ERROR`)
  }
}

export class TmdbError extends AppError {
  constructor(
    message: string,
    public originalStatus?: number,
    public isTimeout: boolean = false
  ) {
    super(
      message,
      originalStatus && originalStatus < 500 ? originalStatus : 502,
      `TMDB_ERROR`
    )
  }
}

export class CircuitOpenError extends AppError {
  constructor(message = `TMDB indisponível no momento`) {
    super(message, 503, `CIRCUIT_OPEN`)
  }
}
