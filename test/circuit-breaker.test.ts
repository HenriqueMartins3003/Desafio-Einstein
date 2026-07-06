import { describe, expect, it, vi } from 'vitest'
import { CircuitBreaker } from '../src/lib/circuit-breaker'
import { CircuitOpenError } from '../src/lib/errors'

describe('CircuitBreaker', () => {
  it('permanece CLOSED enquanto as chamadas têm sucesso', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
    })
    const fn = vi.fn().mockResolvedValue('ok')

    await breaker.execute(fn)
    await breaker.execute(fn)

    expect(breaker.getState()).toBe('CLOSED')
  })

  it('abre o circuito após atingir o threshold de falhas consecutivas', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
    })
    const failing = vi.fn().mockRejectedValue(new Error('boom'))

    await expect(breaker.execute(failing)).rejects.toThrow('boom')
    await expect(breaker.execute(failing)).rejects.toThrow('boom')

    expect(breaker.getState()).toBe('OPEN')
  })

  it('rejeita imediatamente com CircuitOpenError quando OPEN, sem chamar fn', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 10_000,
    })
    const failing = vi.fn().mockRejectedValue(new Error('boom'))

    await expect(breaker.execute(failing)).rejects.toThrow('boom')
    expect(breaker.getState()).toBe('OPEN')

    const shouldNotRun = vi.fn().mockResolvedValue('should not run')
    await expect(breaker.execute(shouldNotRun)).rejects.toBeInstanceOf(
      CircuitOpenError
    )
    expect(shouldNotRun).not.toHaveBeenCalled()
  })

  it('fecha novamente após sucesso em HALF_OPEN, passado o resetTimeout', async () => {
    vi.useFakeTimers()
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
    })

    await expect(
      breaker.execute(() => Promise.reject(new Error('boom')))
    ).rejects.toThrow()
    expect(breaker.getState()).toBe('OPEN')

    vi.advanceTimersByTime(1001)

    await breaker.execute(() => Promise.resolve('ok'))
    expect(breaker.getState()).toBe('CLOSED')

    vi.useRealTimers()
  })
})
