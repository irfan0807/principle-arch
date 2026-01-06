/**
 * Service Registry & Discovery
 * Manages service registration, discovery, and health aggregation
 * 
 * Patterns:
 * - Service Discovery
 * - Health Check Aggregation
 * - Load Balancing (Round Robin)
 */

import { ServiceHealth } from "../core/BaseService";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import { logger } from "../../infrastructure/logger";
import { metrics } from "../../infrastructure/metrics";

// Types
export interface ServiceInstance {
  id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  protocol: "http" | "https" | "grpc";
  metadata: Record<string, any>;
  healthEndpoint: string;
  status: "healthy" | "unhealthy" | "unknown";
  lastHealthCheck?: Date;
  registeredAt: Date;
  lastHeartbeat: Date;
}

export interface ServiceDefinition {
  name: string;
  instances: ServiceInstance[];
  loadBalancer: LoadBalancer;
}

export interface AggregatedHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  services: {
    name: string;
    status: "healthy" | "degraded" | "unhealthy";
    instances: {
      id: string;
      status: string;
      lastCheck?: Date;
      responseTime?: number;
    }[];
  }[];
  checks: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    totalInstances: number;
    healthyInstances: number;
  };
}

// Load Balancer Interface
interface LoadBalancer {
  select(instances: ServiceInstance[]): ServiceInstance | null;
  report(instanceId: string, success: boolean): void;
}

// Round Robin Load Balancer
class RoundRobinBalancer implements LoadBalancer {
  private currentIndex = 0;

  select(instances: ServiceInstance[]): ServiceInstance | null {
    const healthyInstances = instances.filter(
      (i) => i.status === "healthy" || i.status === "unknown"
    );

    if (healthyInstances.length === 0) return null;

    const instance = healthyInstances[this.currentIndex % healthyInstances.length];
    this.currentIndex++;
    return instance;
  }

  report(_instanceId: string, _success: boolean): void {
    // Round robin doesn't adapt based on success/failure
  }
}

// Weighted Load Balancer with health-aware selection
class WeightedBalancer implements LoadBalancer {
  private weights = new Map<string, number>();
  private successCounts = new Map<string, number>();
  private failureCounts = new Map<string, number>();

  select(instances: ServiceInstance[]): ServiceInstance | null {
    const healthyInstances = instances.filter(
      (i) => i.status === "healthy" || i.status === "unknown"
    );

    if (healthyInstances.length === 0) return null;

    // Calculate weights based on success rate
    let totalWeight = 0;
    const weightedInstances: { instance: ServiceInstance; weight: number }[] = [];

    for (const instance of healthyInstances) {
      const successes = this.successCounts.get(instance.id) || 1;
      const failures = this.failureCounts.get(instance.id) || 0;
      const weight = Math.max(1, (successes / (successes + failures + 1)) * 100);

      this.weights.set(instance.id, weight);
      totalWeight += weight;
      weightedInstances.push({ instance, weight });
    }

    // Random weighted selection
    let random = Math.random() * totalWeight;
    for (const { instance, weight } of weightedInstances) {
      random -= weight;
      if (random <= 0) return instance;
    }

    return weightedInstances[0]?.instance || null;
  }

  report(instanceId: string, success: boolean): void {
    if (success) {
      const current = this.successCounts.get(instanceId) || 0;
      this.successCounts.set(instanceId, current + 1);
    } else {
      const current = this.failureCounts.get(instanceId) || 0;
      this.failureCounts.set(instanceId, current + 1);
    }
  }
}

// Service Registry
class ServiceRegistry {
  private services = new Map<string, ServiceDefinition>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly INSTANCE_TTL = 90000; // 90 seconds

  constructor() {
    this.startHealthChecks();
  }

  /**
   * Register a service instance
   */
  register(instance: Omit<ServiceInstance, "id" | "registeredAt" | "lastHeartbeat" | "status">): string {
    const instanceId = crypto.randomUUID();
    const now = new Date();

    const serviceInstance: ServiceInstance = {
      ...instance,
      id: instanceId,
      status: "unknown",
      registeredAt: now,
      lastHeartbeat: now,
    };

    let service = this.services.get(instance.name);
    if (!service) {
      service = {
        name: instance.name,
        instances: [],
        loadBalancer: new WeightedBalancer(),
      };
      this.services.set(instance.name, service);
    }

    service.instances.push(serviceInstance);

    logger.info("Service instance registered", {
      serviceName: instance.name,
      instanceId,
      host: instance.host,
      port: instance.port,
    });

    metrics.increment("service_registry.registrations");

    eventBus.publish(EventTypes.SERVICE_REGISTERED, {
      type: "service_registered",
      serviceName: instance.name,
      instanceId,
    });

    return instanceId;
  }

  /**
   * Deregister a service instance
   */
  deregister(serviceName: string, instanceId: string): boolean {
    const service = this.services.get(serviceName);
    if (!service) return false;

    const index = service.instances.findIndex((i) => i.id === instanceId);
    if (index === -1) return false;

    service.instances.splice(index, 1);

    if (service.instances.length === 0) {
      this.services.delete(serviceName);
    }

    logger.info("Service instance deregistered", {
      serviceName,
      instanceId,
    });

    metrics.increment("service_registry.deregistrations");

    return true;
  }

  /**
   * Send heartbeat for an instance
   */
  heartbeat(serviceName: string, instanceId: string): boolean {
    const service = this.services.get(serviceName);
    if (!service) return false;

    const instance = service.instances.find((i) => i.id === instanceId);
    if (!instance) return false;

    instance.lastHeartbeat = new Date();
    return true;
  }

  /**
   * Discover service instances
   */
  discover(serviceName: string): ServiceInstance[] {
    const service = this.services.get(serviceName);
    if (!service) return [];

    return service.instances.filter(
      (i) => i.status === "healthy" || i.status === "unknown"
    );
  }

  /**
   * Get a single instance using load balancer
   */
  getInstance(serviceName: string): ServiceInstance | null {
    const service = this.services.get(serviceName);
    if (!service) return null;

    return service.loadBalancer.select(service.instances);
  }

  /**
   * Report request result for load balancing
   */
  reportResult(serviceName: string, instanceId: string, success: boolean): void {
    const service = this.services.get(serviceName);
    if (service) {
      service.loadBalancer.report(instanceId, success);
    }
  }

  /**
   * Get all registered services
   */
  getAllServices(): { name: string; instanceCount: number; healthyCount: number }[] {
    return Array.from(this.services.values()).map((service) => ({
      name: service.name,
      instanceCount: service.instances.length,
      healthyCount: service.instances.filter((i) => i.status === "healthy").length,
    }));
  }

  /**
   * Get service details
   */
  getService(serviceName: string): ServiceDefinition | undefined {
    return this.services.get(serviceName);
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
      this.evictStaleInstances();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform health checks on all instances
   */
  private async performHealthChecks(): Promise<void> {
    const checkPromises: Promise<void>[] = [];

    for (const service of Array.from(this.services.values())) {
      for (const instance of service.instances) {
        checkPromises.push(this.checkInstanceHealth(instance));
      }
    }

    await Promise.allSettled(checkPromises);
  }

  /**
   * Check health of a single instance
   */
  private async checkInstanceHealth(instance: ServiceInstance): Promise<void> {
    const startTime = Date.now();
    const url = `${instance.protocol}://${instance.host}:${instance.port}${instance.healthEndpoint}`;

    try {
      // Simulated health check (would use actual HTTP call)
      // const response = await fetch(url, { timeout: 5000 });
      // const healthy = response.ok;

      // For demonstration, simulate healthy status
      instance.status = "healthy";
      instance.lastHealthCheck = new Date();

      metrics.observe(
        "service_registry.health_check_duration",
        Date.now() - startTime
      );
    } catch (error) {
      instance.status = "unhealthy";
      instance.lastHealthCheck = new Date();

      logger.warn("Health check failed", {
        serviceName: instance.name,
        instanceId: instance.id,
        host: instance.host,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Remove instances that haven't sent heartbeat
   */
  private evictStaleInstances(): void {
    const now = Date.now();

    for (const [serviceName, service] of Array.from(this.services.entries())) {
      const staleInstances = service.instances.filter(
        (i) => now - i.lastHeartbeat.getTime() > this.INSTANCE_TTL
      );

      for (const instance of staleInstances) {
        this.deregister(serviceName, instance.id);
        logger.info("Evicted stale instance", {
          serviceName,
          instanceId: instance.id,
        });
      }
    }
  }

  /**
   * Stop health checks
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

// Health Aggregator
class HealthAggregator {
  private serviceHealthCheckers = new Map<string, () => Promise<ServiceHealth>>();

  /**
   * Register a health check function for a service
   */
  registerHealthCheck(
    serviceName: string,
    healthChecker: () => Promise<ServiceHealth>
  ): void {
    this.serviceHealthCheckers.set(serviceName, healthChecker);
  }

  /**
   * Deregister a health check
   */
  deregisterHealthCheck(serviceName: string): void {
    this.serviceHealthCheckers.delete(serviceName);
  }

  /**
   * Get aggregated health status
   */
  async getAggregatedHealth(): Promise<AggregatedHealth> {
    const services: AggregatedHealth["services"] = [];
    let healthyServices = 0;
    let degradedServices = 0;
    let unhealthyServices = 0;
    let totalInstances = 0;
    let healthyInstances = 0;

    const healthPromises = Array.from(this.serviceHealthCheckers.entries()).map(
      async ([name, checker]) => {
        try {
          const startTime = Date.now();
          const health = await checker();
          const responseTime = Date.now() - startTime;

          totalInstances++;

          let status: "healthy" | "degraded" | "unhealthy";
          if (health.status === "healthy") {
            status = "healthy";
            healthyServices++;
            healthyInstances++;
          } else if (health.status === "degraded") {
            status = "degraded";
            degradedServices++;
          } else {
            status = "unhealthy";
            unhealthyServices++;
          }

          services.push({
            name,
            status,
            instances: [
              {
                id: "primary",
                status: health.status,
                lastCheck: health.timestamp,
                responseTime,
              },
            ],
          });
        } catch (error) {
          totalInstances++;
          unhealthyServices++;
          services.push({
            name,
            status: "unhealthy",
            instances: [
              {
                id: "primary",
                status: "error",
                lastCheck: new Date(),
              },
            ],
          });
        }
      }
    );

    await Promise.allSettled(healthPromises);

    // Determine overall status
    let overall: "healthy" | "degraded" | "unhealthy";
    if (unhealthyServices > 0) {
      overall = "unhealthy";
    } else if (degradedServices > 0) {
      overall = "degraded";
    } else {
      overall = "healthy";
    }

    return {
      overall,
      timestamp: new Date(),
      services,
      checks: {
        totalServices: this.serviceHealthCheckers.size,
        healthyServices,
        degradedServices,
        unhealthyServices,
        totalInstances,
        healthyInstances,
      },
    };
  }

  /**
   * Check if a specific service is healthy
   */
  async isServiceHealthy(serviceName: string): Promise<boolean> {
    const checker = this.serviceHealthCheckers.get(serviceName);
    if (!checker) return false;

    try {
      const health = await checker();
      return health.status === "healthy";
    } catch {
      return false;
    }
  }

  /**
   * Get liveness probe result
   */
  async getLiveness(): Promise<{ status: "ok" | "fail"; timestamp: Date }> {
    // Liveness just checks if the service is running
    return {
      status: "ok",
      timestamp: new Date(),
    };
  }

  /**
   * Get readiness probe result
   */
  async getReadiness(): Promise<{
    status: "ok" | "fail";
    timestamp: Date;
    details?: Record<string, boolean>;
  }> {
    const health = await this.getAggregatedHealth();
    const isReady = health.overall !== "unhealthy";

    const details: Record<string, boolean> = {};
    for (const service of health.services) {
      details[service.name] = service.status !== "unhealthy";
    }

    return {
      status: isReady ? "ok" : "fail",
      timestamp: new Date(),
      details,
    };
  }
}

// Singleton instances
export const serviceRegistry = new ServiceRegistry();
export const healthAggregator = new HealthAggregator();

// Register all services
import { authIdentityService } from "../auth/AuthIdentityService";
import { restaurantService } from "../restaurant/RestaurantService";
import { menuService } from "../menu/MenuService";
import { orderService } from "../order/OrderService";
import { deliveryPartnerService } from "../delivery/DeliveryPartnerService";
import { paymentService } from "../payment/PaymentService";
import { notificationService } from "../notification/NotificationService";
import { searchDiscoveryService } from "../search/SearchDiscoveryService";
import { analyticsService } from "../analytics/AnalyticsService";
import { adminService } from "../admin/AdminService";

// Register health checks for all services
export function initializeServiceRegistry(): void {
  // Register health checks
  healthAggregator.registerHealthCheck("auth-identity-service", () =>
    authIdentityService.checkHealth()
  );
  healthAggregator.registerHealthCheck("restaurant-service", () =>
    restaurantService.checkHealth()
  );
  healthAggregator.registerHealthCheck("menu-service", () =>
    menuService.checkHealth()
  );
  healthAggregator.registerHealthCheck("order-service", () =>
    orderService.checkHealth()
  );
  healthAggregator.registerHealthCheck("delivery-partner-service", () =>
    deliveryPartnerService.checkHealth()
  );
  healthAggregator.registerHealthCheck("payment-service", () =>
    paymentService.checkHealth()
  );
  healthAggregator.registerHealthCheck("notification-service", () =>
    notificationService.checkHealth()
  );
  healthAggregator.registerHealthCheck("search-discovery-service", () =>
    searchDiscoveryService.checkHealth()
  );
  healthAggregator.registerHealthCheck("analytics-service", () =>
    analyticsService.checkHealth()
  );
  healthAggregator.registerHealthCheck("admin-service", () =>
    adminService.checkHealth()
  );

  // Register service instances (simulated local instances)
  const services = [
    { name: "auth-identity-service", port: 3001 },
    { name: "restaurant-service", port: 3002 },
    { name: "menu-service", port: 3003 },
    { name: "order-service", port: 3004 },
    { name: "delivery-partner-service", port: 3005 },
    { name: "payment-service", port: 3006 },
    { name: "notification-service", port: 3007 },
    { name: "search-discovery-service", port: 3008 },
    { name: "analytics-service", port: 3009 },
    { name: "admin-service", port: 3010 },
  ];

  for (const svc of services) {
    serviceRegistry.register({
      name: svc.name,
      version: "1.0.0",
      host: "localhost",
      port: svc.port,
      protocol: "http",
      metadata: {},
      healthEndpoint: "/health",
    });
  }

  logger.info("Service registry initialized", {
    serviceCount: services.length,
  });
}
