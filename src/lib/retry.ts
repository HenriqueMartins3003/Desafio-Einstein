export interface RetryOptions {
  attempts: number
  baseDelayMs: number
  shouldRetry?: (error: unknown) => boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { attempts, baseDelayMs, shouldRetry = () => true } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      const isLastAttempt = attempt === attempts
      if (isLastAttempt || shouldRetry(error)) {
        throw error
      }

      const exponencial = baseDelayMs * 2 ** (attempt - 1)
      const jitter = Math.random() * baseDelayMs
      await sleep(exponencial + jitter)
    }
  }
  throw lastError
}
