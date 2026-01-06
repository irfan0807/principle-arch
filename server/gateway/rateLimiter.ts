import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipFailedRequests?: boolean;
  message?: string;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private options: Required<RateLimiterOptions>;

  constructor(options: RateLimiterOptions) {
    this.options = {
      windowMs: options.windowMs,
      maxRequests: options.maxRequests,
      keyGenerator: options.keyGenerator || ((req) => req.ip || "unknown"),
      skipFailedRequests: options.skipFailedRequests || false,
      message: options.message || "Too many requests, please try again later.",
    };

    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.store.entries())) {
      if (entry.resetAt < now) {
        this.store.delete(key);
      }
    }
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.options.keyGenerator(req);
      const now = Date.now();

      let entry = this.store.get(key);

      if (!entry || entry.resetAt < now) {
        entry = {
          count: 0,
          resetAt: now + this.options.windowMs,
        };
      }

      entry.count++;
      this.store.set(key, entry);

      const remaining = Math.max(0, this.options.maxRequests - entry.count);
      const resetTime = Math.ceil((entry.resetAt - now) / 1000);

      res.setHeader("X-RateLimit-Limit", this.options.maxRequests);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("X-RateLimit-Reset", resetTime);

      if (entry.count > this.options.maxRequests) {
        res.setHeader("Retry-After", resetTime);
        return res.status(429).json({
          error: "Too Many Requests",
          message: this.options.message,
          retryAfter: resetTime,
        });
      }

      next();
    };
  }
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: "Too many API requests, please try again in a minute.",
});

export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Too many authentication attempts, please try again later.",
});

export const orderRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: "Too many order requests, please slow down.",
});

// Unified rate limiter export for microservices API
export const rateLimiter = {
  standard: apiRateLimiter.middleware(),
  strict: authRateLimiter.middleware(),
  order: orderRateLimiter.middleware(),
};
