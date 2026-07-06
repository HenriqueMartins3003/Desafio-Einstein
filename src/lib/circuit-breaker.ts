import { CircuitOpenError } from './errors'

type CircutState = 'CLOSED' | 'OPEN'

export interface CircuitBreakerOptions {
  failureThreshold: number
  resetTimeoutMs: number
}

export class CircuitBreaker {
  private state: CircutState = 'CLOSED'
  private falureCount = 0
  private nextAttemptAt = 0

  constructor(private readonly options: CircuitBreakerOptions) {}

  getState(): CircutState {
    return this.state
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptAt) {
        throw new CircuitOpenError()
      }
    }
    try {
      const result = await fn()
      this.OnSuccess()
      return result
    } catch (error) {
      this.OnFailure()
      throw error
    }
  }
  private OnFailure() {
    this.falureCount += 1

    if (this.falureCount >= this.options.failureThreshold) {
      this.state = 'OPEN'
      this.nextAttemptAt = Date.now() + this.options.resetTimeoutMs
    }
  }

  private OnSuccess() {
    this.falureCount = 0
    this.state = 'CLOSED'
  }
}
