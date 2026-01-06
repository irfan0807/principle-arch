/**
 * Auth & Identity Service
 * Handles authentication, authorization, and user management
 * 
 * Patterns:
 * - OAuth 2.0 / OpenID Connect
 * - JWT token management
 * - RBAC (Role-Based Access Control)
 * - ABAC (Attribute-Based Access Control)
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { storage } from "../../storage";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import { cache } from "../../infrastructure/cache";
import type { User, UpsertUser } from "@shared/schema";
import * as crypto from "crypto";

// Types
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
}

export interface Permission {
  resource: string;
  action: "create" | "read" | "update" | "delete" | "manage";
}

export type UserRole = "customer" | "restaurant_owner" | "delivery_partner" | "admin";

// Role-Permission mapping (RBAC)
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  customer: [
    { resource: "orders", action: "create" },
    { resource: "orders", action: "read" },
    { resource: "restaurants", action: "read" },
    { resource: "menu", action: "read" },
    { resource: "profile", action: "read" },
    { resource: "profile", action: "update" },
    { resource: "reviews", action: "create" },
  ],
  restaurant_owner: [
    { resource: "restaurants", action: "create" },
    { resource: "restaurants", action: "read" },
    { resource: "restaurants", action: "update" },
    { resource: "menu", action: "manage" },
    { resource: "orders", action: "read" },
    { resource: "orders", action: "update" },
    { resource: "analytics", action: "read" },
    { resource: "profile", action: "read" },
    { resource: "profile", action: "update" },
  ],
  delivery_partner: [
    { resource: "orders", action: "read" },
    { resource: "orders", action: "update" },
    { resource: "deliveries", action: "read" },
    { resource: "deliveries", action: "update" },
    { resource: "profile", action: "read" },
    { resource: "profile", action: "update" },
    { resource: "earnings", action: "read" },
  ],
  admin: [
    { resource: "*", action: "manage" },
  ],
};

// Session store for refresh tokens
const refreshTokenStore = new Map<string, { userId: string; expiresAt: Date }>();

const serviceConfig: ServiceConfig = {
  name: "auth-service",
  version: "1.0.0",
  timeout: 5000,
  retryAttempts: 2,
  circuitBreakerEnabled: true,
};

class AuthIdentityService extends BaseService {
  private jwtSecret: string;
  private accessTokenTTL: number = 3600; // 1 hour
  private refreshTokenTTL: number = 604800; // 7 days

  constructor() {
    super(serviceConfig);
    this.jwtSecret = process.env.JWT_SECRET || "your-super-secret-key-change-in-production";
    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    eventBus.subscribe("user.role_changed", async (data: any) => {
      await this.invalidateCache(`user:${data.userId}:*`);
      this.logger.info(`User role changed, cache invalidated`, { userId: data.userId });
    });
  }

  /**
   * Authenticate user with external identity provider
   */
  async authenticateWithProvider(
    provider: string,
    providerUserId: string,
    userData: {
      email?: string;
      firstName?: string;
      lastName?: string;
      profileImageUrl?: string;
    }
  ): Promise<{ user: User; tokens: AuthToken }> {
    return this.executeWithResilience(async () => {
      // Upsert user
      const user = await storage.upsertUser({
        id: providerUserId,
        email: userData.email || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        profileImageUrl: userData.profileImageUrl || null,
        role: "customer",
      });

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Publish event
      await this.publishEvent("user.authenticated", {
        userId: user.id,
        provider,
        timestamp: new Date(),
      });

      this.logger.info("User authenticated", { userId: user.id, provider });

      return { user, tokens };
    }, "authenticateWithProvider");
  }

  /**
   * Generate JWT tokens
   */
  async generateTokens(user: User): Promise<AuthToken> {
    const permissions = this.getPermissionsForRole(user.role as UserRole);
    
    const payload: Omit<TokenPayload, "iat" | "exp"> = {
      sub: user.id,
      email: user.email || "",
      role: user.role,
      permissions: permissions.map((p) => `${p.resource}:${p.action}`),
    };

    const accessToken = this.createJWT(payload, this.accessTokenTTL);
    const refreshToken = this.createRefreshToken();

    // Store refresh token
    refreshTokenStore.set(refreshToken, {
      userId: user.id,
      expiresAt: new Date(Date.now() + this.refreshTokenTTL * 1000),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTTL,
      tokenType: "Bearer",
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthToken> {
    return this.executeWithResilience(async () => {
      const stored = refreshTokenStore.get(refreshToken);
      
      if (!stored) {
        throw new Error("Invalid refresh token");
      }

      if (stored.expiresAt < new Date()) {
        refreshTokenStore.delete(refreshToken);
        throw new Error("Refresh token expired");
      }

      const user = await storage.getUser(stored.userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Delete old refresh token
      refreshTokenStore.delete(refreshToken);

      // Generate new tokens
      return this.generateTokens(user);
    }, "refreshAccessToken");
  }

  /**
   * Validate JWT token
   */
  validateToken(token: string): TokenPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      
      // Verify expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return null;
      }

      // Verify signature (simplified - use proper library in production)
      const signatureValid = this.verifySignature(parts[0] + "." + parts[1], parts[2]);
      if (!signatureValid) return null;

      return payload as TokenPayload;
    } catch {
      return null;
    }
  }

  /**
   * Revoke tokens (logout)
   */
  async revokeTokens(refreshToken: string): Promise<void> {
    refreshTokenStore.delete(refreshToken);
    this.logger.info("Tokens revoked");
  }

  /**
   * Get user by ID with caching
   */
  async getUser(userId: string): Promise<User | undefined> {
    return this.withCache(
      `user:${userId}`,
      () => storage.getUser(userId),
      600
    );
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, newRole: UserRole): Promise<User | undefined> {
    return this.executeWithResilience(async () => {
      const user = await storage.updateUserRole(userId, newRole);
      
      if (user) {
        await this.invalidateCache(`user:${userId}:*`);
        await this.publishEvent("user.role_changed", {
          userId,
          oldRole: user.role,
          newRole,
          timestamp: new Date(),
        });
      }

      return user;
    }, "updateUserRole");
  }

  /**
   * Check if user has permission (RBAC + ABAC)
   */
  hasPermission(
    userRole: UserRole,
    resource: string,
    action: Permission["action"],
    context?: Record<string, any>
  ): boolean {
    const permissions = ROLE_PERMISSIONS[userRole] || [];
    
    return permissions.some((p) => {
      // Admin has all permissions
      if (p.resource === "*" && p.action === "manage") return true;
      
      // Check specific permission
      if (p.resource === resource && (p.action === action || p.action === "manage")) {
        // ABAC: Check context-based conditions if needed
        if (context) {
          return this.evaluateContextConditions(p, context);
        }
        return true;
      }
      
      return false;
    });
  }

  /**
   * Evaluate ABAC conditions
   */
  private evaluateContextConditions(
    permission: Permission,
    context: Record<string, any>
  ): boolean {
    // Example: Restaurant owner can only update their own restaurant
    if (permission.resource === "restaurants" && permission.action === "update") {
      if (context.ownerId && context.requestingUserId) {
        return context.ownerId === context.requestingUserId;
      }
    }

    // Example: Delivery partner can only update assigned orders
    if (permission.resource === "orders" && permission.action === "update") {
      if (context.assignedPartnerId && context.requestingPartnerId) {
        return context.assignedPartnerId === context.requestingPartnerId;
      }
    }

    return true;
  }

  /**
   * Get permissions for role
   */
  getPermissionsForRole(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Create JWT token
   */
  private createJWT(payload: object, expiresIn: number): string {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    
    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn,
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
    const signature = this.sign(headerB64 + "." + payloadB64);

    return `${headerB64}.${payloadB64}.${signature}`;
  }

  /**
   * Create refresh token
   */
  private createRefreshToken(): string {
    return crypto.randomBytes(64).toString("hex");
  }

  /**
   * Sign data with HMAC
   */
  private sign(data: string): string {
    return crypto
      .createHmac("sha256", this.jwtSecret)
      .update(data)
      .digest("base64url");
  }

  /**
   * Verify signature
   */
  private verifySignature(data: string, signature: string): boolean {
    const expected = this.sign(data);
    const sigBuffer = new Uint8Array(Buffer.from(signature));
    const expBuffer = new Uint8Array(Buffer.from(expected));
    if (sigBuffer.length !== expBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expBuffer);
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<ServiceHealth> {
    const checks = [];
    
    // Check database connection
    try {
      const startTime = Date.now();
      await storage.getUser("health-check");
      checks.push({
        name: "database",
        status: "pass" as const,
        responseTime: Date.now() - startTime,
      });
    } catch {
      checks.push({
        name: "database",
        status: "fail" as const,
        message: "Database connection failed",
      });
    }

    // Check token store
    checks.push({
      name: "token_store",
      status: "pass" as const,
      message: `${refreshTokenStore.size} active refresh tokens`,
    });

    const allPassing = checks.every((c) => c.status === "pass");

    return {
      status: allPassing ? "healthy" : "degraded",
      checks,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date(),
    };
  }
}

export const authIdentityService = new AuthIdentityService();
