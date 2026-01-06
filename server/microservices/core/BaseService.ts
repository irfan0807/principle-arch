/**
 * Base Service Class - Hexagonal Architecture Foundation
 * Implements Ports & Adapters pattern with Clean Architecture principles
 */

import { logger, createServiceLogger } from "../../infrastructure/logger";
import { circuitBreaker } from "../../gateway/circuitBreaker";
import { cache } from "../../infrastructure/cache";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import { metrics } from "../../infrastructure/metrics";

export interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheck[];
  uptime: number;
  timestamp: Date;
}

export interface HealthCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  responseTime?: number;
  message?: string;
}

export interface ServiceConfig {
  name: string;
  version: string;
  timeout: number;
  retryAttempts: number;
  circuitBreakerEnabled: boolean;
}

export abstract class BaseService {
  protected logger: ReturnType<typeof createServiceLogger>;
  protected config: ServiceConfig;
  protected startTime: Date;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.logger = createServiceLogger(config.name);
    this.startTime = new Date();
  }

  /**
   * Execute operation with resilience patterns
   * - Circuit breaker
   * - Retry with exponential backoff
   * - Timeout
   * - Metrics collection
   */
  protected async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const timer = metrics.startTimer(`${this.config.name}.${operationName}`);

    try {
      const result = await circuitBreaker.execute(
        async () => {
          return this.withTimeout(
            this.withRetry(operation, this.config.retryAttempts),
            this.config.timeout
          );
        },
        fallback
      );

      metrics.recordSuccess(`${this.config.name}.${operationName}`);
      return result as T;
    } catch (error) {
      metrics.recordError(`${this.config.name}.${operationName}`);
      this.logger.error(`Operation failed: ${operationName}`, { error });
      throw error;
    } finally {
      timer.end();
    }
  }

  /**
   * Retry with exponential backoff and jitter
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }

      const baseDelay = Math.pow(2, attempt) * 100;
      const jitter = Math.random() * 100;
      const delay = baseDelay + jitter;

      this.logger.warn(`Retry attempt ${attempt}/${maxAttempts}, waiting ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.withRetry(operation, maxAttempts, attempt + 1);
    }
  }

  /**
   * Timeout wrapper
   */
  private async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      operation,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Health check implementation
   */
  abstract checkHealth(): Promise<ServiceHealth>;

  /**
   * Get service metadata
   */
  getMetadata() {
    return {
      name: this.config.name,
      version: this.config.version,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Publish domain event
   */
  protected async publishEvent<T>(eventType: string, data: T, correlationId?: string): Promise<void> {
    await eventBus.publish(eventType, data, correlationId, this.config.name);
    this.logger.info(`Published event: ${eventType}`, { correlationId });
  }

  /**
   * Cache wrapper with cache-aside pattern
   */
  protected async withCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    return cache.getOrSet(key, fetcher, ttlSeconds);
  }

  /**
   * Invalidate cache
   */
  protected async invalidateCache(pattern: string): Promise<void> {
    await cache.invalidatePattern(pattern);
  }
}

/**
 * Service Registry for service discovery
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, BaseService> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  register(service: BaseService): void {
    const metadata = service.getMetadata();
    this.services.set(metadata.name, service);
    logger.info(`Service registered: ${metadata.name} v${metadata.version}`);
  }

  unregister(serviceName: string): void {
    this.services.delete(serviceName);
    logger.info(`Service unregistered: ${serviceName}`);
  }

  getService(serviceName: string): BaseService | undefined {
    return this.services.get(serviceName);
  }

  getAllServices(): Map<string, BaseService> {
    return this.services;
  }

  async healthCheck(): Promise<Map<string, ServiceHealth>> {
    const results = new Map<string, ServiceHealth>();

    for (const [name, service] of Array.from(this.services.entries())) {
      try {
        const health = await service.checkHealth();
        results.set(name, health);
      } catch (error) {
        results.set(name, {
          status: "unhealthy",
          checks: [{ name: "service", status: "fail", message: String(error) }],
          uptime: 0,
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  startHealthChecks(intervalMs: number = 30000): void {
    this.healthCheckInterval = setInterval(async () => {
      const results = await this.healthCheck();
      for (const [name, health] of Array.from(results.entries())) {
        if (health.status !== "healthy") {
          logger.warn(`Service ${name} is ${health.status}`);
        }
      }
    }, intervalMs);
  }

  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export const serviceRegistry = ServiceRegistry.getInstance();
