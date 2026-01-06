type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailure: Date | null;
  state: CircuitState;
}

class CircuitBreaker<T> {
  private state: CircuitState = "closed";
  private failures: number = 0;
  private successes: number = 0;
  private lastFailure: Date | null = null;
  private nextAttempt: Date | null = null;
  private halfOpenAttempts: number = 0;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 30000,
      halfOpenRequests: options.halfOpenRequests || 3,
    };
  }

  async execute(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.state === "open") {
      if (this.nextAttempt && new Date() >= this.nextAttempt) {
        this.state = "half-open";
        this.halfOpenAttempts = 0;
      } else {
        if (fallback) {
          return fallback();
        }
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === "half-open") {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.options.halfOpenRequests) {
        this.reset();
      }
    }
    this.successes++;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.state === "half-open") {
      this.trip();
    } else if (this.failures >= this.options.failureThreshold) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = "open";
    this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
  }

  private reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.halfOpenAttempts = 0;
    this.nextAttempt = null;
  }

  getStats(): CircuitStats {
    return {
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      state: this.state,
    };
  }

  getState(): CircuitState {
    return this.state;
  }

  isOpen(): boolean {
    return this.state === "open";
  }

  forceOpen(): void {
    this.trip();
  }

  forceClose(): void {
    this.reset();
  }
}

export type CircuitBreakerState = CircuitState;

export const paymentCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 60000,
  halfOpenRequests: 2,
});

export const externalServiceCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenRequests: 3,
});

// Default circuit breaker instance
export const circuitBreaker = externalServiceCircuitBreaker;

export { CircuitBreaker };
