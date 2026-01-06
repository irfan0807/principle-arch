/**
 * Multi-Region Configuration & Geographic Distribution
 * 
 * Features:
 * - Region-aware routing
 * - Data replication configuration
 * - Latency-based routing
 * - Failover management
 * - Geographic load balancing
 * - Region-specific caching
 */

import { logger } from "./logger";
import { metrics } from "./metrics";
import { distributedCache } from "./redisCache";

// Types
export interface Region {
  id: string;
  name: string;
  code: string; // e.g., "us-east-1", "eu-west-1", "ap-south-1"
  displayName: string;
  timezone: string;
  currency: string;
  language: string;
  isActive: boolean;
  isPrimary: boolean;
  endpoints: RegionEndpoints;
  config: RegionConfig;
  healthStatus: HealthStatus;
  lastHealthCheck: Date;
}

export interface RegionEndpoints {
  api: string;
  websocket: string;
  cdn: string;
  database: {
    read: string;
    write: string;
  };
  cache: string;
  messageQueue: string;
}

export interface RegionConfig {
  maxLatencyMs: number;
  failoverRegions: string[];
  replicationLag: number;
  features: string[];
  rateLimits: {
    requestsPerSecond: number;
    burstSize: number;
  };
  cacheConfig: {
    ttlMultiplier: number;
    maxSize: number;
  };
}

type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface GeoLocation {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
}

export interface RoutingDecision {
  selectedRegion: Region;
  latency: number;
  reason: string;
  fallbackRegions: Region[];
}

export interface ReplicationConfig {
  sourceRegion: string;
  targetRegions: string[];
  mode: "sync" | "async";
  tables: string[];
  conflictResolution: "source-wins" | "target-wins" | "timestamp";
  maxLagSeconds: number;
}

// Region definitions
const REGIONS: Region[] = [
  {
    id: "us-east-1",
    name: "US East",
    code: "us-east-1",
    displayName: "US East (N. Virginia)",
    timezone: "America/New_York",
    currency: "USD",
    language: "en-US",
    isActive: true,
    isPrimary: true,
    endpoints: {
      api: "https://api-us-east.fooddash.com",
      websocket: "wss://ws-us-east.fooddash.com",
      cdn: "https://cdn-us-east.fooddash.com",
      database: {
        read: "postgres://read-us-east.fooddash.com:5432/fooddash",
        write: "postgres://write-us-east.fooddash.com:5432/fooddash",
      },
      cache: "redis://cache-us-east.fooddash.com:6379",
      messageQueue: "amqp://mq-us-east.fooddash.com:5672",
    },
    config: {
      maxLatencyMs: 100,
      failoverRegions: ["us-west-2", "eu-west-1"],
      replicationLag: 0,
      features: ["all"],
      rateLimits: {
        requestsPerSecond: 10000,
        burstSize: 20000,
      },
      cacheConfig: {
        ttlMultiplier: 1,
        maxSize: 10000,
      },
    },
    healthStatus: "healthy",
    lastHealthCheck: new Date(),
  },
  {
    id: "us-west-2",
    name: "US West",
    code: "us-west-2",
    displayName: "US West (Oregon)",
    timezone: "America/Los_Angeles",
    currency: "USD",
    language: "en-US",
    isActive: true,
    isPrimary: false,
    endpoints: {
      api: "https://api-us-west.fooddash.com",
      websocket: "wss://ws-us-west.fooddash.com",
      cdn: "https://cdn-us-west.fooddash.com",
      database: {
        read: "postgres://read-us-west.fooddash.com:5432/fooddash",
        write: "postgres://write-us-east.fooddash.com:5432/fooddash", // Write to primary
      },
      cache: "redis://cache-us-west.fooddash.com:6379",
      messageQueue: "amqp://mq-us-west.fooddash.com:5672",
    },
    config: {
      maxLatencyMs: 100,
      failoverRegions: ["us-east-1", "ap-northeast-1"],
      replicationLag: 50,
      features: ["all"],
      rateLimits: {
        requestsPerSecond: 8000,
        burstSize: 16000,
      },
      cacheConfig: {
        ttlMultiplier: 1,
        maxSize: 8000,
      },
    },
    healthStatus: "healthy",
    lastHealthCheck: new Date(),
  },
  {
    id: "eu-west-1",
    name: "Europe",
    code: "eu-west-1",
    displayName: "EU West (Ireland)",
    timezone: "Europe/Dublin",
    currency: "EUR",
    language: "en-GB",
    isActive: true,
    isPrimary: false,
    endpoints: {
      api: "https://api-eu-west.fooddash.com",
      websocket: "wss://ws-eu-west.fooddash.com",
      cdn: "https://cdn-eu-west.fooddash.com",
      database: {
        read: "postgres://read-eu-west.fooddash.com:5432/fooddash",
        write: "postgres://write-us-east.fooddash.com:5432/fooddash",
      },
      cache: "redis://cache-eu-west.fooddash.com:6379",
      messageQueue: "amqp://mq-eu-west.fooddash.com:5672",
    },
    config: {
      maxLatencyMs: 80,
      failoverRegions: ["us-east-1", "ap-south-1"],
      replicationLag: 100,
      features: ["all", "gdpr"],
      rateLimits: {
        requestsPerSecond: 6000,
        burstSize: 12000,
      },
      cacheConfig: {
        ttlMultiplier: 1.2,
        maxSize: 6000,
      },
    },
    healthStatus: "healthy",
    lastHealthCheck: new Date(),
  },
  {
    id: "ap-south-1",
    name: "Asia Pacific South",
    code: "ap-south-1",
    displayName: "Asia Pacific (Mumbai)",
    timezone: "Asia/Kolkata",
    currency: "INR",
    language: "en-IN",
    isActive: true,
    isPrimary: false,
    endpoints: {
      api: "https://api-ap-south.fooddash.com",
      websocket: "wss://ws-ap-south.fooddash.com",
      cdn: "https://cdn-ap-south.fooddash.com",
      database: {
        read: "postgres://read-ap-south.fooddash.com:5432/fooddash",
        write: "postgres://write-us-east.fooddash.com:5432/fooddash",
      },
      cache: "redis://cache-ap-south.fooddash.com:6379",
      messageQueue: "amqp://mq-ap-south.fooddash.com:5672",
    },
    config: {
      maxLatencyMs: 150,
      failoverRegions: ["ap-southeast-1", "eu-west-1"],
      replicationLag: 200,
      features: ["all"],
      rateLimits: {
        requestsPerSecond: 5000,
        burstSize: 10000,
      },
      cacheConfig: {
        ttlMultiplier: 1.5,
        maxSize: 5000,
      },
    },
    healthStatus: "healthy",
    lastHealthCheck: new Date(),
  },
  {
    id: "ap-northeast-1",
    name: "Asia Pacific Northeast",
    code: "ap-northeast-1",
    displayName: "Asia Pacific (Tokyo)",
    timezone: "Asia/Tokyo",
    currency: "JPY",
    language: "ja-JP",
    isActive: true,
    isPrimary: false,
    endpoints: {
      api: "https://api-ap-northeast.fooddash.com",
      websocket: "wss://ws-ap-northeast.fooddash.com",
      cdn: "https://cdn-ap-northeast.fooddash.com",
      database: {
        read: "postgres://read-ap-northeast.fooddash.com:5432/fooddash",
        write: "postgres://write-us-east.fooddash.com:5432/fooddash",
      },
      cache: "redis://cache-ap-northeast.fooddash.com:6379",
      messageQueue: "amqp://mq-ap-northeast.fooddash.com:5672",
    },
    config: {
      maxLatencyMs: 100,
      failoverRegions: ["ap-south-1", "us-west-2"],
      replicationLag: 150,
      features: ["all"],
      rateLimits: {
        requestsPerSecond: 5000,
        burstSize: 10000,
      },
      cacheConfig: {
        ttlMultiplier: 1.3,
        maxSize: 5000,
      },
    },
    healthStatus: "healthy",
    lastHealthCheck: new Date(),
  },
];

// Region coordinates for distance calculation
const REGION_COORDINATES: Record<string, GeoLocation> = {
  "us-east-1": { latitude: 37.4316, longitude: -78.6569 },    // Virginia
  "us-west-2": { latitude: 45.8399, longitude: -119.7006 },   // Oregon
  "eu-west-1": { latitude: 53.3498, longitude: -6.2603 },     // Ireland
  "ap-south-1": { latitude: 19.0760, longitude: 72.8777 },    // Mumbai
  "ap-northeast-1": { latitude: 35.6762, longitude: 139.6503 }, // Tokyo
  "ap-southeast-1": { latitude: 1.3521, longitude: 103.8198 }, // Singapore
};

/**
 * Multi-Region Manager
 */
class MultiRegionManager {
  private regions: Map<string, Region> = new Map();
  private currentRegion: Region | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private replicationConfigs: Map<string, ReplicationConfig> = new Map();

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Load regions
    for (const region of REGIONS) {
      this.regions.set(region.id, region);
    }

    // Determine current region from environment
    const regionId = process.env.REGION || process.env.AWS_REGION || "us-east-1";
    this.currentRegion = this.regions.get(regionId) || this.regions.get("us-east-1")!;

    // Start health checks
    this.startHealthChecks();

    // Initialize replication configs
    this.initializeReplication();

    logger.info("Multi-region manager initialized", { 
      currentRegion: this.currentRegion?.id,
      activeRegions: Array.from(this.regions.values()).filter(r => r.isActive).length,
    });
  }

  private initializeReplication(): void {
    // Configure data replication
    const replicationConfig: ReplicationConfig = {
      sourceRegion: "us-east-1",
      targetRegions: ["us-west-2", "eu-west-1", "ap-south-1", "ap-northeast-1"],
      mode: "async",
      tables: [
        "users",
        "restaurants",
        "menu_items",
        "menu_categories",
        "coupons",
      ],
      conflictResolution: "timestamp",
      maxLagSeconds: 30,
    };

    this.replicationConfigs.set("primary-replication", replicationConfig);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      const regions = Array.from(this.regions.values());
      for (const region of regions) {
        await this.checkRegionHealth(region);
      }
    }, 30000); // Every 30 seconds
  }

  private async checkRegionHealth(region: Region): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Simulate health check (in production, actually ping the endpoints)
      const isHealthy = Math.random() > 0.05; // 95% healthy
      const latency = Math.random() * 50 + 10; // 10-60ms

      region.lastHealthCheck = new Date();
      
      if (isHealthy && latency < region.config.maxLatencyMs * 2) {
        if (latency > region.config.maxLatencyMs) {
          region.healthStatus = "degraded";
        } else {
          region.healthStatus = "healthy";
        }
      } else {
        region.healthStatus = "unhealthy";
        logger.warn("Region unhealthy", { regionId: region.id, latency });
      }

      metrics.observe("region.health.latency", latency, { region: region.id });
      metrics.setGauge("region.health.status", 
        region.healthStatus === "healthy" ? 1 : region.healthStatus === "degraded" ? 0.5 : 0,
        { region: region.id }
      );

    } catch (error) {
      region.healthStatus = "unhealthy";
      logger.error("Health check failed", { regionId: region.id, error });
    }
  }

  /**
   * Get the best region for a request based on user location
   */
  async routeRequest(userLocation: GeoLocation): Promise<RoutingDecision> {
    const timer = metrics.startTimer("region.routing");

    try {
      const healthyRegions = Array.from(this.regions.values())
        .filter(r => r.isActive && r.healthStatus !== "unhealthy");

      if (healthyRegions.length === 0) {
        throw new Error("No healthy regions available");
      }

      // Calculate distance to each region
      const regionsWithDistance = healthyRegions.map(region => {
        const coords = REGION_COORDINATES[region.id];
        const distance = coords 
          ? this.calculateDistance(userLocation, coords)
          : Infinity;
        
        // Estimate latency based on distance (rough approximation)
        const estimatedLatency = Math.min(300, distance / 100 + 20);
        
        return {
          region,
          distance,
          estimatedLatency,
          score: this.calculateRegionScore(region, distance, estimatedLatency),
        };
      });

      // Sort by score (lower is better)
      regionsWithDistance.sort((a, b) => a.score - b.score);

      const best = regionsWithDistance[0];
      const fallbacks = regionsWithDistance.slice(1, 4).map(r => r.region);

      const decision: RoutingDecision = {
        selectedRegion: best.region,
        latency: best.estimatedLatency,
        reason: this.getRoutingReason(best.region, best.distance),
        fallbackRegions: fallbacks,
      };

      logger.debug("Routing decision made", { 
        userLocation,
        selectedRegion: decision.selectedRegion.id,
        latency: decision.latency,
      });

      return decision;
    } finally {
      timer.end();
    }
  }

  private calculateRegionScore(
    region: Region,
    distance: number,
    latency: number
  ): number {
    let score = 0;

    // Distance factor (40%)
    score += (distance / 10000) * 40;

    // Health status factor (30%)
    if (region.healthStatus === "degraded") score += 15;
    if (region.healthStatus === "unhealthy") score += 30;

    // Replication lag factor (20%)
    score += (region.config.replicationLag / 10);

    // Primary region bonus (10%)
    if (!region.isPrimary) score += 5;

    return score;
  }

  private getRoutingReason(region: Region, distance: number): string {
    if (region.isPrimary && distance < 2000) {
      return "Closest primary region";
    }
    if (distance < 1000) {
      return "Closest regional endpoint";
    }
    if (region.healthStatus === "healthy") {
      return "Best available healthy region";
    }
    return "Failover region selected";
  }

  /**
   * Get current region
   */
  getCurrentRegion(): Region | null {
    return this.currentRegion;
  }

  /**
   * Get all active regions
   */
  getActiveRegions(): Region[] {
    return Array.from(this.regions.values()).filter(r => r.isActive);
  }

  /**
   * Get healthy regions
   */
  getHealthyRegions(): Region[] {
    return Array.from(this.regions.values())
      .filter(r => r.isActive && r.healthStatus !== "unhealthy");
  }

  /**
   * Get region by ID
   */
  getRegion(regionId: string): Region | undefined {
    return this.regions.get(regionId);
  }

  /**
   * Get primary region
   */
  getPrimaryRegion(): Region | undefined {
    return Array.from(this.regions.values()).find(r => r.isPrimary);
  }

  /**
   * Check if current region is primary
   */
  isPrimaryRegion(): boolean {
    return this.currentRegion?.isPrimary || false;
  }

  /**
   * Get write endpoint (always primary)
   */
  getWriteEndpoint(): string {
    const primary = this.getPrimaryRegion();
    return primary?.endpoints.database.write || "";
  }

  /**
   * Get read endpoint for current region
   */
  getReadEndpoint(): string {
    return this.currentRegion?.endpoints.database.read || this.getWriteEndpoint();
  }

  /**
   * Get region-specific cache key
   */
  getRegionalCacheKey(key: string): string {
    return `${this.currentRegion?.id || "default"}:${key}`;
  }

  /**
   * Invalidate cache across all regions
   */
  async invalidateCacheGlobally(pattern: string): Promise<void> {
    for (const region of this.getActiveRegions()) {
      try {
        // In production, use cross-region pub/sub or SQS
        const cacheKey = `${region.id}:${pattern}`;
        await distributedCache.invalidatePattern(cacheKey);
        logger.debug("Cache invalidated", { region: region.id, pattern });
      } catch (error) {
        logger.warn("Failed to invalidate cache in region", { 
          region: region.id, 
          error 
        });
      }
    }
  }

  /**
   * Get failover region
   */
  getFailoverRegion(): Region | null {
    if (!this.currentRegion) return null;

    const failoverIds = this.currentRegion.config.failoverRegions;
    for (const id of failoverIds) {
      const region = this.regions.get(id);
      if (region && region.isActive && region.healthStatus === "healthy") {
        return region;
      }
    }

    // If no configured failover is healthy, find any healthy region
    return this.getHealthyRegions().find(r => r.id !== this.currentRegion?.id) || null;
  }

  /**
   * Trigger failover to another region
   */
  async failover(reason: string): Promise<Region | null> {
    const failoverRegion = this.getFailoverRegion();
    
    if (!failoverRegion) {
      logger.error("No failover region available", { reason });
      return null;
    }

    logger.warn("Initiating failover", {
      fromRegion: this.currentRegion?.id,
      toRegion: failoverRegion.id,
      reason,
    });

    metrics.increment("region.failover", 1, { 
      from: this.currentRegion?.id || "unknown",
      to: failoverRegion.id,
    });

    // Mark current region as unhealthy
    if (this.currentRegion) {
      this.currentRegion.healthStatus = "unhealthy";
    }

    // Switch to failover region
    this.currentRegion = failoverRegion;

    return failoverRegion;
  }

  /**
   * Get region-specific configuration
   */
  getRegionConfig<K extends keyof RegionConfig>(key: K): RegionConfig[K] | undefined {
    return this.currentRegion?.config[key];
  }

  /**
   * Get rate limits for current region
   */
  getRateLimits(): { requestsPerSecond: number; burstSize: number } {
    return this.currentRegion?.config.rateLimits || {
      requestsPerSecond: 1000,
      burstSize: 2000,
    };
  }

  /**
   * Check if a feature is enabled in current region
   */
  isFeatureEnabled(feature: string): boolean {
    const features = this.currentRegion?.config.features || [];
    return features.includes("all") || features.includes(feature);
  }

  /**
   * Get replication status
   */
  getReplicationStatus(): {
    sourceRegion: string;
    targetRegions: { id: string; lag: number; status: string }[];
  } {
    const primary = this.getPrimaryRegion();
    const targets = this.getActiveRegions()
      .filter(r => !r.isPrimary)
      .map(r => ({
        id: r.id,
        lag: r.config.replicationLag,
        status: r.healthStatus,
      }));

    return {
      sourceRegion: primary?.id || "unknown",
      targetRegions: targets,
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(loc1: GeoLocation, loc2: GeoLocation): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(loc2.latitude - loc1.latitude);
    const dLon = this.toRad(loc2.longitude - loc1.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(loc1.latitude)) *
        Math.cos(this.toRad(loc2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Get region statistics
   */
  getStats(): {
    currentRegion: string;
    totalRegions: number;
    healthyRegions: number;
    degradedRegions: number;
    unhealthyRegions: number;
  } {
    const regions = Array.from(this.regions.values());
    return {
      currentRegion: this.currentRegion?.id || "unknown",
      totalRegions: regions.length,
      healthyRegions: regions.filter(r => r.healthStatus === "healthy").length,
      degradedRegions: regions.filter(r => r.healthStatus === "degraded").length,
      unhealthyRegions: regions.filter(r => r.healthStatus === "unhealthy").length,
    };
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    logger.info("Multi-region manager shutdown");
  }
}

// Export singleton
export const multiRegionManager = new MultiRegionManager();
