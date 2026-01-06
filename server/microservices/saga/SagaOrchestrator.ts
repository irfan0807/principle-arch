/**
 * Saga Orchestrator
 * Implements distributed transaction coordination using the Saga pattern
 * 
 * Patterns:
 * - Saga Pattern for distributed transactions
 * - Orchestration-based saga (vs choreography)
 * - Compensation for rollback
 * - Event logging for auditability
 */

import { logger, createServiceLogger } from "../../infrastructure/logger";
import { eventBus } from "../../infrastructure/eventBus";
import { metrics } from "../../infrastructure/metrics";
import * as crypto from "crypto";

const sagaLogger = createServiceLogger("saga-orchestrator");

// Types
export interface SagaStep<TContext = any, TResult = any> {
  name: string;
  execute: (context: TContext, previousResults: Record<string, any>) => Promise<TResult>;
  compensate: (context: TContext, result: TResult, previousResults: Record<string, any>) => Promise<void>;
  timeout?: number;
  retries?: number;
}

export interface SagaDefinition<TContext = any> {
  name: string;
  steps: SagaStep<TContext>[];
  onComplete?: (context: TContext, results: Record<string, any>) => Promise<void>;
  onFail?: (context: TContext, error: Error, completedSteps: string[]) => Promise<void>;
}

export interface SagaExecution {
  id: string;
  sagaName: string;
  status: "running" | "completed" | "compensating" | "failed" | "compensated";
  currentStep: string;
  startedAt: Date;
  completedAt?: Date;
  context: any;
  results: Record<string, any>;
  completedSteps: string[];
  failedStep?: string;
  error?: string;
}

export interface SagaResult<T = any> {
  success: boolean;
  executionId: string;
  data?: T;
  error?: string;
  completedSteps: string[];
  compensatedSteps?: string[];
}

/**
 * Saga Orchestrator - Manages distributed transactions
 */
class SagaOrchestratorClass {
  private sagas: Map<string, SagaDefinition> = new Map();
  private executions: Map<string, SagaExecution> = new Map();
  private defaultTimeout: number = 30000;
  private defaultRetries: number = 3;

  /**
   * Register a saga definition
   */
  register(saga: SagaDefinition): void {
    if (this.sagas.has(saga.name)) {
      sagaLogger.warn(`Saga ${saga.name} already registered, overwriting`);
    }
    this.sagas.set(saga.name, saga);
    sagaLogger.info(`Saga registered: ${saga.name}`, { steps: saga.steps.map(s => s.name) });
  }

  /**
   * Execute a saga
   */
  async execute<TContext, TResult = Record<string, any>>(
    sagaName: string,
    context: TContext
  ): Promise<SagaResult<TResult>> {
    const saga = this.sagas.get(sagaName);
    if (!saga) {
      throw new Error(`Saga not found: ${sagaName}`);
    }

    const executionId = this.generateExecutionId();
    const timer = metrics.startTimer(`saga.${sagaName}`);

    const execution: SagaExecution = {
      id: executionId,
      sagaName,
      status: "running",
      currentStep: "",
      startedAt: new Date(),
      context,
      results: {},
      completedSteps: [],
    };

    this.executions.set(executionId, execution);

    sagaLogger.info(`Saga started: ${sagaName}`, { executionId });

    try {
      // Execute steps sequentially
      for (const step of saga.steps) {
        execution.currentStep = step.name;
        
        sagaLogger.debug(`Executing step: ${step.name}`, { executionId });
        
        const result = await this.executeStep(step, context, execution.results);
        execution.results[step.name] = result;
        execution.completedSteps.push(step.name);
      }

      // Saga completed successfully
      execution.status = "completed";
      execution.completedAt = new Date();

      if (saga.onComplete) {
        await saga.onComplete(context, execution.results);
      }

      metrics.recordSuccess(`saga.${sagaName}`);
      sagaLogger.info(`Saga completed: ${sagaName}`, { executionId });

      return {
        success: true,
        executionId,
        data: execution.results as TResult,
        completedSteps: execution.completedSteps,
      };
    } catch (error) {
      const err = error as Error;
      execution.status = "compensating";
      execution.failedStep = execution.currentStep;
      execution.error = err.message;

      sagaLogger.error(`Saga failed at step ${execution.currentStep}: ${sagaName}`, {
        executionId,
        error: err.message,
      });

      // Compensate completed steps in reverse order
      const compensatedSteps = await this.compensate(saga, context, execution);

      execution.status = "compensated";
      execution.completedAt = new Date();

      if (saga.onFail) {
        await saga.onFail(context, err, execution.completedSteps);
      }

      metrics.recordError(`saga.${sagaName}`);

      return {
        success: false,
        executionId,
        error: err.message,
        completedSteps: execution.completedSteps,
        compensatedSteps,
      };
    } finally {
      timer.end();
    }
  }

  /**
   * Execute a single step with retries and timeout
   */
  private async executeStep<TContext, TResult>(
    step: SagaStep<TContext, TResult>,
    context: TContext,
    previousResults: Record<string, any>
  ): Promise<TResult> {
    const timeout = step.timeout || this.defaultTimeout;
    const maxRetries = step.retries || this.defaultRetries;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.withTimeout(
          step.execute(context, previousResults),
          timeout
        );
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 100 + Math.random() * 100;
          sagaLogger.warn(`Step ${step.name} failed, retrying in ${delay}ms`, {
            attempt,
            maxRetries,
            error: lastError.message,
          });
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error(`Step ${step.name} failed after ${maxRetries} attempts`);
  }

  /**
   * Compensate completed steps in reverse order
   */
  private async compensate(
    saga: SagaDefinition,
    context: any,
    execution: SagaExecution
  ): Promise<string[]> {
    const compensatedSteps: string[] = [];
    const stepsToCompensate = [...execution.completedSteps].reverse();

    sagaLogger.info(`Starting compensation for ${stepsToCompensate.length} steps`);

    for (const stepName of stepsToCompensate) {
      const step = saga.steps.find((s) => s.name === stepName);
      if (!step) continue;

      try {
        sagaLogger.debug(`Compensating step: ${stepName}`);
        await step.compensate(context, execution.results[stepName], execution.results);
        compensatedSteps.push(stepName);
        sagaLogger.debug(`Step compensated: ${stepName}`);
      } catch (error) {
        sagaLogger.error(`Compensation failed for step ${stepName}`, {
          error: (error as Error).message,
        });
        // Continue with other compensations even if one fails
      }
    }

    return compensatedSteps;
  }

  /**
   * Get saga execution status
   */
  getExecution(executionId: string): SagaExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions for a saga
   */
  getExecutions(sagaName: string): SagaExecution[] {
    return Array.from(this.executions.values()).filter(
      (e) => e.sagaName === sagaName
    );
  }

  /**
   * Timeout wrapper
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Delay helper
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `saga_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  /**
   * Cleanup old executions
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;

    for (const [id, execution] of Array.from(this.executions.entries())) {
      if (execution.completedAt && execution.completedAt.getTime() < cutoff) {
        this.executions.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      sagaLogger.info(`Cleaned up ${removed} old saga executions`);
    }
  }
}

export const sagaOrchestrator = new SagaOrchestratorClass();

/**
 * Pre-defined saga builders for common workflows
 */
export class SagaBuilder<TContext> {
  private steps: SagaStep<TContext>[] = [];
  private name: string;
  private onCompleteFn?: (context: TContext, results: Record<string, any>) => Promise<void>;
  private onFailFn?: (context: TContext, error: Error, completedSteps: string[]) => Promise<void>;

  constructor(name: string) {
    this.name = name;
  }

  addStep(
    name: string,
    execute: SagaStep<TContext>["execute"],
    compensate: SagaStep<TContext>["compensate"],
    options: { timeout?: number; retries?: number } = {}
  ): SagaBuilder<TContext> {
    this.steps.push({
      name,
      execute,
      compensate,
      timeout: options.timeout,
      retries: options.retries,
    });
    return this;
  }

  onComplete(fn: (context: TContext, results: Record<string, any>) => Promise<void>): SagaBuilder<TContext> {
    this.onCompleteFn = fn;
    return this;
  }

  onFail(fn: (context: TContext, error: Error, completedSteps: string[]) => Promise<void>): SagaBuilder<TContext> {
    this.onFailFn = fn;
    return this;
  }

  build(): SagaDefinition<TContext> {
    return {
      name: this.name,
      steps: this.steps,
      onComplete: this.onCompleteFn,
      onFail: this.onFailFn,
    };
  }

  register(): void {
    sagaOrchestrator.register(this.build());
  }
}
