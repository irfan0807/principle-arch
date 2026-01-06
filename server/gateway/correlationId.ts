/**
 * Correlation ID Middleware
 * Tracks requests across distributed services
 */

import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { AsyncLocalStorage } from "async_hooks";

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      requestId: string;
    }
  }
}

// Async local storage for correlation context
interface CorrelationContext {
  correlationId: string;
  requestId: string;
  startTime: number;
  userId?: string;
}

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = 
    (req.headers["x-correlation-id"] as string) || 
    (req.headers["x-request-id"] as string) || 
    randomUUID();

  const requestId = randomUUID();

  req.correlationId = correlationId;
  req.requestId = requestId;
  res.setHeader("x-correlation-id", correlationId);
  res.setHeader("x-request-id", requestId);

  const context: CorrelationContext = {
    correlationId,
    requestId,
    startTime: Date.now(),
    userId: (req as any).user?.id,
  };

  correlationStorage.run(context, () => {
    next();
  });
}

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

export function getRequestId(): string | undefined {
  return correlationStorage.getStore()?.requestId;
}

export function setCorrelationId(correlationId: string): void {
  const store = correlationStorage.getStore();
  if (store) {
    store.correlationId = correlationId;
  }
}

export function getForwardHeaders(): Record<string, string> {
  const context = correlationStorage.getStore();
  if (!context) {
    return {};
  }

  return {
    "x-correlation-id": context.correlationId,
    "x-request-id": context.requestId,
    ...(context.userId && { "x-user-id": context.userId }),
  };
}
