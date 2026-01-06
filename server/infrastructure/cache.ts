type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class InMemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of Array.from(this.cache.entries())) {
        if (entry.expiresAt < now) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await fetcher();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    for (const key of Array.from(this.cache.keys())) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  // Alias for invalidate
  delete(key: string): void {
    this.cache.delete(key);
  }

  // Check if key exists
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export const cache = new InMemoryCache();

export const CacheKeys = {
  restaurants: () => "restaurants:all",
  restaurant: (id: string) => `restaurant:${id}`,
  restaurantMenu: (id: string) => `restaurant:${id}:menu`,
  menuItem: (id: string) => `menuItem:${id}`,
  activeCoupons: () => "coupons:active",
  coupon: (code: string) => `coupon:${code}`,
  userOrders: (userId: string) => `user:${userId}:orders`,
  order: (orderId: string) => `order:${orderId}`,
  availablePartners: () => "partners:available",
  search: (query: string) => `search:${query}`,
};
