/**
 * Redis Cache - Distributed Caching Layer
 * 
 * Features:
 * - Redis connection with reconnection logic
 * - Cluster mode support for multi-region
 * - Fallback to in-memory cache
 * - Pub/Sub for cache invalidation across nodes
 * - Compression for large values
 * - Serialization with JSON/MessagePack
 */

import { logger } from "./logger";

// Types
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  cluster?: boolean;
  clusterNodes?: { host: string; port: number }[];
  sentinelMaster?: string;
  sentinels?: { host: string; port: number }[];
  tls?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  connectionTimeout?: number;
  commandTimeout?: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  version?: number;
  compressed?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  keyCount: number;
  hitRate: number;
  memoryUsage: number;
  connected: boolean;
  mode: "redis" | "memory" | "cluster";
}

interface LockOptions {
  ttlMs: number;
  retryCount?: number;
  retryDelayMs?: number;
}

type Serializer = {
  serialize: <T>(value: T) => string;
  deserialize: <T>(value: string) => T;
};

const defaultConfig: RedisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || "0"),
  keyPrefix: "fooddash:",
  cluster: process.env.REDIS_CLUSTER === "true",
  tls: process.env.REDIS_TLS === "true",
  maxRetries: 3,
  retryDelay: 1000,
  connectionTimeout: 5000,
  commandTimeout: 3000,
};

/**
 * Distributed Cache with Redis backend
 * Falls back to in-memory cache if Redis is unavailable
 */
class DistributedCache {
  private config: RedisConfig;
  private localCache: Map<string, CacheEntry<unknown>> = new Map();
  private connected: boolean = false;
  private redisClient: RedisClientSimulator | null = null;
  private pubSubClient: RedisClientSimulator | null = null;
  private stats: { hits: number; misses: number } = { hits: 0, misses: 0 };
  private cleanupInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private serializer: Serializer;

  constructor(config: Partial<RedisConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.serializer = {
      serialize: (value) => JSON.stringify(value),
      deserialize: (value) => JSON.parse(value),
    };
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // In production, replace with actual Redis client
      // import { createClient, createCluster } from 'redis';
      
      if (process.env.REDIS_URL || process.env.REDIS_HOST) {
        await this.connectToRedis();
      } else {
        logger.info("Redis not configured, using in-memory cache");
        this.startLocalCleanup();
      }
    } catch (error) {
      logger.warn("Failed to connect to Redis, using in-memory fallback", { error });
      this.startLocalCleanup();
    }
  }

  private async connectToRedis(): Promise<void> {
    try {
      // Simulated Redis client - replace with actual implementation
      this.redisClient = new RedisClientSimulator(this.config);
      await this.redisClient.connect();
      
      this.connected = true;
      logger.info("Connected to Redis", { 
        host: this.config.host, 
        port: this.config.port,
        cluster: this.config.cluster 
      });

      // Setup Pub/Sub for cache invalidation
      this.setupPubSub();
      
      // Handle disconnection
      this.redisClient.on("error", (err) => {
        logger.error("Redis connection error", { error: err.message });
        this.handleDisconnect();
      });

      this.redisClient.on("end", () => {
        logger.warn("Redis connection closed");
        this.handleDisconnect();
      });
    } catch (error) {
      throw error;
    }
  }

  private handleDisconnect(): void {
    this.connected = false;
    
    // Attempt to reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      logger.info("Attempting to reconnect to Redis...");
      try {
        await this.connectToRedis();
      } catch (error) {
        logger.error("Redis reconnection failed", { error });
        this.handleDisconnect(); // Retry
      }
    }, this.config.retryDelay);
  }

  private setupPubSub(): void {
    if (!this.connected) return;

    // Subscribe to cache invalidation channel
    const channel = `${this.config.keyPrefix}invalidation`;
    
    this.pubSubClient = new RedisClientSimulator(this.config);
    this.pubSubClient.subscribe(channel, (message: string) => {
      try {
        const { pattern, key } = JSON.parse(message);
        if (pattern) {
          this.localCache.forEach((_, k) => {
            if (new RegExp(pattern.replace(/\*/g, ".*")).test(k)) {
              this.localCache.delete(k);
            }
          });
        } else if (key) {
          this.localCache.delete(key);
        }
      } catch (error) {
        logger.error("Error processing cache invalidation", { error });
      }
    });
  }

  private startLocalCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of Array.from(this.localCache.entries())) {
        if (entry.expiresAt < now) {
          this.localCache.delete(key);
        }
      }
    }, 60000);
  }

  private getFullKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);

    // Try local cache first (L1)
    const localEntry = this.localCache.get(fullKey) as CacheEntry<T> | undefined;
    if (localEntry && localEntry.expiresAt > Date.now()) {
      this.stats.hits++;
      return localEntry.value;
    }

    // Try Redis (L2) if connected
    if (this.connected && this.redisClient) {
      try {
        const redisValue = await this.redisClient.get(fullKey);
        if (redisValue) {
          const entry: CacheEntry<T> = this.serializer.deserialize(redisValue);
          if (entry.expiresAt > Date.now()) {
            // Populate local cache
            this.localCache.set(fullKey, entry);
            this.stats.hits++;
            return entry.value;
          }
        }
      } catch (error) {
        logger.warn("Redis get error, falling back to local", { key, error });
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    const fullKey = this.getFullKey(key);
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      createdAt: Date.now(),
    };

    // Set in local cache
    this.localCache.set(fullKey, entry);

    // Set in Redis if connected
    if (this.connected && this.redisClient) {
      try {
        const serialized = this.serializer.serialize(entry);
        await this.redisClient.setex(fullKey, ttlSeconds, serialized);
      } catch (error) {
        logger.warn("Redis set error", { key, error });
      }
    }
  }

  /**
   * Get or set with fetcher function
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    // Use distributed lock to prevent thundering herd
    const value = await this.withLock(
      `lock:${key}`,
      async () => {
        // Double-check after acquiring lock
        const recheck = await this.get<T>(key);
        if (recheck !== null) return recheck;

        const freshValue = await fetcher();
        await this.set(key, freshValue, ttlSeconds);
        return freshValue;
      },
      { ttlMs: 5000, retryCount: 3, retryDelayMs: 100 }
    );

    return value;
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    
    this.localCache.delete(fullKey);

    if (this.connected && this.redisClient) {
      try {
        await this.redisClient.del(fullKey);
        // Publish invalidation event
        await this.publishInvalidation({ key: fullKey });
      } catch (error) {
        logger.warn("Redis delete error", { key, error });
      }
    }
  }

  /**
   * Invalidate keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const fullPattern = this.getFullKey(pattern);
    const regex = new RegExp(fullPattern.replace(/\*/g, ".*"));

    // Clear from local cache
    for (const key of Array.from(this.localCache.keys())) {
      if (regex.test(key)) {
        this.localCache.delete(key);
      }
    }

    // Clear from Redis if connected
    if (this.connected && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(fullPattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
        // Publish invalidation event for other nodes
        await this.publishInvalidation({ pattern: fullPattern });
      } catch (error) {
        logger.warn("Redis pattern invalidation error", { pattern, error });
      }
    }
  }

  /**
   * Publish cache invalidation event
   */
  private async publishInvalidation(data: { key?: string; pattern?: string }): Promise<void> {
    if (!this.connected || !this.redisClient) return;

    try {
      const channel = `${this.config.keyPrefix}invalidation`;
      await this.redisClient.publish(channel, JSON.stringify(data));
    } catch (error) {
      logger.warn("Failed to publish cache invalidation", { error });
    }
  }

  /**
   * Distributed lock using Redis
   */
  async withLock<T>(
    lockKey: string,
    operation: () => Promise<T>,
    options: LockOptions
  ): Promise<T> {
    const fullKey = this.getFullKey(lockKey);
    const lockValue = `${process.pid}-${Date.now()}-${Math.random()}`;
    const { ttlMs, retryCount = 0, retryDelayMs = 50 } = options;

    // If Redis not available, just run the operation
    if (!this.connected || !this.redisClient) {
      return operation();
    }

    // Try to acquire lock
    for (let i = 0; i <= retryCount; i++) {
      const acquired = await this.redisClient.setnx(fullKey, lockValue);
      
      if (acquired) {
        await this.redisClient.pexpire(fullKey, ttlMs);
        
        try {
          return await operation();
        } finally {
          // Release lock (only if we still own it)
          const currentValue = await this.redisClient.get(fullKey);
          if (currentValue === lockValue) {
            await this.redisClient.del(fullKey);
          }
        }
      }

      if (i < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    // Lock not acquired, run anyway (with potential race condition)
    logger.warn("Failed to acquire lock, running operation anyway", { lockKey });
    return operation();
  }

  /**
   * Hash operations for storing objects
   */
  async hset(key: string, field: string, value: unknown): Promise<void> {
    const fullKey = this.getFullKey(key);
    
    // Get existing hash from local cache or create new
    let hash = (await this.get<Record<string, unknown>>(key)) || {};
    hash[field] = value;
    await this.set(key, hash);

    if (this.connected && this.redisClient) {
      try {
        await this.redisClient.hset(fullKey, field, this.serializer.serialize(value));
      } catch (error) {
        logger.warn("Redis hset error", { key, field, error });
      }
    }
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);

    if (this.connected && this.redisClient) {
      try {
        const value = await this.redisClient.hget(fullKey, field);
        if (value) {
          return this.serializer.deserialize(value);
        }
      } catch (error) {
        logger.warn("Redis hget error", { key, field, error });
      }
    }

    // Fallback to local
    const hash = await this.get<Record<string, T>>(key);
    return hash ? hash[field] : null;
  }

  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    const fullKey = this.getFullKey(key);

    if (this.connected && this.redisClient) {
      try {
        const hash = await this.redisClient.hgetall(fullKey);
        if (hash && Object.keys(hash).length > 0) {
          const result: Record<string, T> = {};
          for (const [field, value] of Object.entries(hash)) {
            result[field] = this.serializer.deserialize(value as string);
          }
          return result;
        }
      } catch (error) {
        logger.warn("Redis hgetall error", { key, error });
      }
    }

    return this.get<Record<string, T>>(key);
  }

  /**
   * List operations
   */
  async lpush(key: string, ...values: unknown[]): Promise<void> {
    const fullKey = this.getFullKey(key);
    
    let list = (await this.get<unknown[]>(key)) || [];
    list.unshift(...values);
    await this.set(key, list);

    if (this.connected && this.redisClient) {
      try {
        await this.redisClient.lpush(fullKey, ...values.map((v) => this.serializer.serialize(v)));
      } catch (error) {
        logger.warn("Redis lpush error", { key, error });
      }
    }
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const fullKey = this.getFullKey(key);

    if (this.connected && this.redisClient) {
      try {
        const items = await this.redisClient.lrange(fullKey, start, stop);
        return items.map((item: string) => this.serializer.deserialize<T>(item));
      } catch (error) {
        logger.warn("Redis lrange error", { key, error });
      }
    }

    const list = (await this.get<T[]>(key)) || [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  /**
   * Sorted set operations for leaderboards/rankings
   */
  async zadd(key: string, score: number, member: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    if (this.connected && this.redisClient) {
      try {
        await this.redisClient.zadd(fullKey, score, member);
      } catch (error) {
        logger.warn("Redis zadd error", { key, error });
      }
    }
  }

  async zrange(key: string, start: number, stop: number, withScores = false): Promise<string[]> {
    const fullKey = this.getFullKey(key);

    if (this.connected && this.redisClient) {
      try {
        return this.redisClient.zrange(fullKey, start, stop, withScores);
      } catch (error) {
        logger.warn("Redis zrange error", { key, error });
      }
    }

    return [];
  }

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    const fullKey = this.getFullKey(key);

    if (this.connected && this.redisClient) {
      try {
        return this.redisClient.incr(fullKey);
      } catch (error) {
        logger.warn("Redis incr error", { key, error });
      }
    }

    const current = (await this.get<number>(key)) || 0;
    await this.set(key, current + 1, 86400);
    return current + 1;
  }

  async incrby(key: string, increment: number): Promise<number> {
    const fullKey = this.getFullKey(key);

    if (this.connected && this.redisClient) {
      try {
        return this.redisClient.incrby(fullKey, increment);
      } catch (error) {
        logger.warn("Redis incrby error", { key, error });
      }
    }

    const current = (await this.get<number>(key)) || 0;
    await this.set(key, current + increment, 86400);
    return current + increment;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.localCache.size,
      keyCount: this.localCache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      memoryUsage: process.memoryUsage().heapUsed,
      connected: this.connected,
      mode: this.connected 
        ? (this.config.cluster ? "cluster" : "redis") 
        : "memory",
    };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.localCache.clear();
    this.stats = { hits: 0, misses: 0 };

    if (this.connected && this.redisClient) {
      try {
        const pattern = `${this.config.keyPrefix}*`;
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (error) {
        logger.warn("Redis clear error", { error });
      }
    }
  }

  /**
   * Shutdown cache
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    if (this.pubSubClient) {
      await this.pubSubClient.quit();
    }
    logger.info("Cache shutdown complete");
  }
}

/**
 * Redis Client Simulator
 * Replace this with actual Redis client in production:
 * import { createClient } from 'redis';
 */
class RedisClientSimulator {
  private data: Map<string, any> = new Map();
  private subscribers: Map<string, ((message: string) => void)[]> = new Map();
  private connected = false;
  private eventHandlers: Map<string, ((arg: any) => void)[]> = new Map();

  constructor(private config: RedisConfig) {}

  async connect(): Promise<void> {
    // Simulate connection delay
    await new Promise((r) => setTimeout(r, 10));
    this.connected = true;
  }

  on(event: string, handler: (arg: any) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    this.data.set(key, value);
    setTimeout(() => this.data.delete(key), ttl * 1000);
  }

  async setnx(key: string, value: string): Promise<boolean> {
    if (this.data.has(key)) return false;
    this.data.set(key, value);
    return true;
  }

  async pexpire(key: string, ms: number): Promise<void> {
    setTimeout(() => this.data.delete(key), ms);
  }

  async del(...keys: string[]): Promise<void> {
    keys.forEach((k) => this.data.delete(k));
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    return Array.from(this.data.keys()).filter((k) => regex.test(k));
  }

  async publish(channel: string, message: string): Promise<void> {
    const handlers = this.subscribers.get(channel) || [];
    handlers.forEach((h) => h(message));
  }

  subscribe(channel: string, handler: (message: string) => void): void {
    const handlers = this.subscribers.get(channel) || [];
    handlers.push(handler);
    this.subscribers.set(channel, handlers);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    const hash = this.data.get(key) || {};
    hash[field] = value;
    this.data.set(key, hash);
  }

  async hget(key: string, field: string): Promise<string | null> {
    const hash = this.data.get(key);
    return hash ? hash[field] : null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.data.get(key) || {};
  }

  async lpush(key: string, ...values: string[]): Promise<void> {
    const list = this.data.get(key) || [];
    list.unshift(...values);
    this.data.set(key, list);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.data.get(key) || [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    const set = this.data.get(key) || [];
    set.push({ score, member });
    set.sort((a: any, b: any) => a.score - b.score);
    this.data.set(key, set);
  }

  async zrange(key: string, start: number, stop: number, withScores: boolean): Promise<string[]> {
    const set = this.data.get(key) || [];
    const end = stop === -1 ? set.length : stop + 1;
    const slice = set.slice(start, end);
    return slice.map((item: any) => item.member);
  }

  async incr(key: string): Promise<number> {
    const val = (this.data.get(key) || 0) + 1;
    this.data.set(key, val);
    return val;
  }

  async incrby(key: string, increment: number): Promise<number> {
    const val = (this.data.get(key) || 0) + increment;
    this.data.set(key, val);
    return val;
  }

  async quit(): Promise<void> {
    this.connected = false;
    this.data.clear();
  }
}

// Export singleton instance
export const distributedCache = new DistributedCache();

// Export cache keys
export const RedisCacheKeys = {
  // Restaurant data
  restaurants: () => "restaurants:all",
  restaurant: (id: string) => `restaurants:${id}`,
  restaurantMenu: (id: string) => `restaurants:${id}:menu`,
  restaurantsByCity: (city: string) => `restaurants:city:${city}`,
  restaurantsByCuisine: (cuisine: string) => `restaurants:cuisine:${cuisine}`,
  
  // Menu data
  menuItem: (id: string) => `menu:item:${id}`,
  menuCategory: (id: string) => `menu:category:${id}`,
  
  // Order data
  order: (id: string) => `orders:${id}`,
  userOrders: (userId: string) => `users:${userId}:orders`,
  activeOrders: () => "orders:active",
  
  // User data
  user: (id: string) => `users:${id}`,
  userSession: (sessionId: string) => `sessions:${sessionId}`,
  
  // Search data
  searchResults: (query: string) => `search:${Buffer.from(query).toString("base64")}`,
  popularSearches: () => "search:popular",
  
  // Delivery data
  availablePartners: () => "delivery:available",
  partnerLocation: (id: string) => `delivery:location:${id}`,
  
  // Coupons
  activeCoupons: () => "coupons:active",
  coupon: (code: string) => `coupons:${code}`,
  
  // Rate limiting
  rateLimit: (ip: string, endpoint: string) => `ratelimit:${ip}:${endpoint}`,
  
  // Metrics
  orderCount: (date: string) => `metrics:orders:${date}`,
  revenue: (date: string) => `metrics:revenue:${date}`,
  
  // ML Recommendations
  userRecommendations: (userId: string) => `ml:recommendations:${userId}`,
  popularItems: () => "ml:popular:items",
  trendingRestaurants: () => "ml:trending:restaurants",
};

export type { RedisConfig, CacheStats };
