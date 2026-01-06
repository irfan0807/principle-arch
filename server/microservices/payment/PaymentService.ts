/**
 * Payment Service
 * Handles payment processing with PayPal and other providers
 * 
 * Patterns:
 * - Idempotency for payment operations
 * - Event-driven notifications
 * - Circuit breaker for external calls
 * - Retry with exponential backoff
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { storage } from "../../storage";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";

// Types
export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "refunded";
export type PaymentMethod = "paypal" | "stripe" | "card" | "wallet" | "cod";

export interface PaymentIntent {
  id: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  idempotencyKey: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentRequest {
  orderId: string;
  customerId: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  idempotencyKey: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  approvalUrl?: string;
  message?: string;
  transactionId?: string;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number; // Partial refund if specified
  reason: string;
  idempotencyKey: string;
}

const serviceConfig: ServiceConfig = {
  name: "payment-service",
  version: "1.0.0",
  timeout: 30000, // Longer timeout for payment providers
  retryAttempts: 3,
  circuitBreakerEnabled: true,
};

// In-memory payment store (replace with database in production)
const paymentStore = new Map<string, PaymentIntent>();
const idempotencyStore = new Map<string, { paymentId: string; result: PaymentResult }>();

class PaymentService extends BaseService {
  private paypalClientId: string;
  private paypalClientSecret: string;
  private environment: "sandbox" | "production";

  constructor() {
    super(serviceConfig);
    this.paypalClientId = process.env.PAYPAL_CLIENT_ID || "";
    this.paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
    this.environment = (process.env.PAYPAL_ENV as "sandbox" | "production") || "sandbox";
    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    // Listen for payment initiation requests
    eventBus.subscribe(EventTypes.PAYMENT_INITIATED, async (data: any) => {
      try {
        await this.createPayment({
          orderId: data.orderId,
          customerId: data.customerId,
          amount: parseFloat(data.amount),
          method: data.paymentMethod || "paypal",
          idempotencyKey: `payment_${data.orderId}_${Date.now()}`,
        });
      } catch (error) {
        this.logger.error("Payment initiation failed", { orderId: data.orderId, error });
      }
    });
  }

  /**
   * Create a payment intent
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
    return this.executeWithResilience(async () => {
      // Check idempotency
      const existing = idempotencyStore.get(request.idempotencyKey);
      if (existing) {
        this.logger.info("Returning existing payment (idempotent)", { paymentId: existing.paymentId });
        return existing.result;
      }

      // Create payment intent
      const payment: PaymentIntent = {
        id: this.generatePaymentId(),
        orderId: request.orderId,
        customerId: request.customerId,
        amount: request.amount,
        currency: request.currency || "USD",
        method: request.method,
        status: "pending",
        idempotencyKey: request.idempotencyKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      paymentStore.set(payment.id, payment);

      let result: PaymentResult;

      // Route to appropriate payment provider
      switch (request.method) {
        case "paypal":
          result = await this.processPayPalPayment(payment, request.returnUrl, request.cancelUrl);
          break;
        case "cod":
          result = await this.processCODPayment(payment);
          break;
        default:
          result = await this.processMockPayment(payment);
      }

      // Store for idempotency
      idempotencyStore.set(request.idempotencyKey, { paymentId: payment.id, result });

      // Publish event based on result
      if (result.success) {
        await this.publishEvent(EventTypes.PAYMENT_SUCCESS, {
          paymentId: payment.id,
          orderId: payment.orderId,
          customerId: payment.customerId,
          amount: payment.amount,
          transactionId: result.transactionId,
        });
      }

      return result;
    }, "createPayment");
  }

  /**
   * Process PayPal payment
   */
  private async processPayPalPayment(
    payment: PaymentIntent,
    returnUrl?: string,
    cancelUrl?: string
  ): Promise<PaymentResult> {
    // PayPal API integration would go here
    // Using mock implementation for now
    
    payment.status = "processing";
    payment.updatedAt = new Date();
    paymentStore.set(payment.id, payment);

    // In production, this would create a PayPal order and return approval URL
    const mockApprovalUrl = `https://www.sandbox.paypal.com/checkoutnow?token=${payment.id}`;

    return {
      success: true,
      paymentId: payment.id,
      status: "processing",
      approvalUrl: mockApprovalUrl,
      message: "Redirect user to approval URL",
    };
  }

  /**
   * Process Cash on Delivery
   */
  private async processCODPayment(payment: PaymentIntent): Promise<PaymentResult> {
    payment.status = "pending";
    payment.updatedAt = new Date();
    paymentStore.set(payment.id, payment);

    // COD payments are marked complete on delivery
    return {
      success: true,
      paymentId: payment.id,
      status: "pending",
      message: "Cash on delivery - payment pending",
    };
  }

  /**
   * Process mock payment (for testing)
   */
  private async processMockPayment(payment: PaymentIntent): Promise<PaymentResult> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 90% success rate for testing
    const success = Math.random() > 0.1;

    if (success) {
      payment.status = "completed";
      payment.providerPaymentId = `mock_${Date.now()}`;
    } else {
      payment.status = "failed";
    }

    payment.updatedAt = new Date();
    paymentStore.set(payment.id, payment);

    return {
      success,
      paymentId: payment.id,
      status: payment.status,
      transactionId: payment.providerPaymentId,
      message: success ? "Payment successful" : "Payment failed",
    };
  }

  /**
   * Capture PayPal payment (after user approval)
   */
  async capturePayPalPayment(paymentId: string, paypalOrderId: string): Promise<PaymentResult> {
    return this.executeWithResilience(async () => {
      const payment = paymentStore.get(paymentId);
      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status !== "processing") {
        throw new Error(`Invalid payment status for capture: ${payment.status}`);
      }

      // In production, capture the PayPal payment
      // Mock success for now
      payment.status = "completed";
      payment.providerOrderId = paypalOrderId;
      payment.updatedAt = new Date();
      paymentStore.set(payment.id, payment);

      await this.publishEvent(EventTypes.PAYMENT_SUCCESS, {
        paymentId: payment.id,
        orderId: payment.orderId,
        customerId: payment.customerId,
        amount: payment.amount,
        transactionId: paypalOrderId,
      });

      this.logger.info("PayPal payment captured", { paymentId, paypalOrderId });

      return {
        success: true,
        paymentId: payment.id,
        status: "completed",
        transactionId: paypalOrderId,
        message: "Payment captured successfully",
      };
    }, "capturePayPalPayment");
  }

  /**
   * Process refund
   */
  async refund(request: RefundRequest): Promise<PaymentResult> {
    return this.executeWithResilience(async () => {
      // Check idempotency
      const idempotencyKey = `refund_${request.idempotencyKey}`;
      const existing = idempotencyStore.get(idempotencyKey);
      if (existing) {
        return existing.result;
      }

      const payment = paymentStore.get(request.paymentId);
      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status !== "completed") {
        throw new Error(`Cannot refund payment with status: ${payment.status}`);
      }

      const refundAmount = request.amount || payment.amount;

      // Process refund with provider
      // Mock implementation
      payment.status = "refunded";
      payment.metadata = {
        ...payment.metadata,
        refundAmount,
        refundReason: request.reason,
        refundedAt: new Date(),
      };
      payment.updatedAt = new Date();
      paymentStore.set(payment.id, payment);

      const result: PaymentResult = {
        success: true,
        paymentId: payment.id,
        status: "refunded",
        message: `Refunded ${refundAmount} ${payment.currency}`,
      };

      idempotencyStore.set(idempotencyKey, { paymentId: payment.id, result });

      await this.publishEvent(EventTypes.PAYMENT_REFUNDED, {
        paymentId: payment.id,
        orderId: payment.orderId,
        customerId: payment.customerId,
        refundAmount,
        reason: request.reason,
      });

      this.logger.info("Payment refunded", { paymentId: payment.id, amount: refundAmount });

      return result;
    }, "refund");
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<PaymentIntent | undefined> {
    return paymentStore.get(paymentId);
  }

  /**
   * Get payment by order ID
   */
  async getPaymentByOrder(orderId: string): Promise<PaymentIntent | undefined> {
    for (const payment of Array.from(paymentStore.values())) {
      if (payment.orderId === orderId) {
        return payment;
      }
    }
    return undefined;
  }

  /**
   * Get payments by customer
   */
  async getPaymentsByCustomer(customerId: string): Promise<PaymentIntent[]> {
    const payments: PaymentIntent[] = [];
    for (const payment of Array.from(paymentStore.values())) {
      if (payment.customerId === customerId) {
        payments.push(payment);
      }
    }
    return payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Mark COD payment as completed (on delivery)
   */
  async completeCODPayment(orderId: string): Promise<PaymentResult> {
    return this.executeWithResilience(async () => {
      const payment = await this.getPaymentByOrder(orderId);
      if (!payment) {
        throw new Error("Payment not found for order");
      }

      if (payment.method !== "cod") {
        throw new Error("Not a COD payment");
      }

      payment.status = "completed";
      payment.updatedAt = new Date();
      paymentStore.set(payment.id, payment);

      await this.publishEvent(EventTypes.PAYMENT_SUCCESS, {
        paymentId: payment.id,
        orderId: payment.orderId,
        customerId: payment.customerId,
        amount: payment.amount,
      });

      return {
        success: true,
        paymentId: payment.id,
        status: "completed",
        message: "COD payment collected",
      };
    }, "completeCODPayment");
  }

  /**
   * Generate unique payment ID
   */
  private generatePaymentId(): string {
    return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<ServiceHealth> {
    const checks = [];

    // Check PayPal configuration
    if (this.paypalClientId && this.paypalClientSecret) {
      checks.push({
        name: "paypal_config",
        status: "pass" as const,
        message: `Environment: ${this.environment}`,
      });
    } else {
      checks.push({
        name: "paypal_config",
        status: "warn" as const,
        message: "PayPal credentials not configured",
      });
    }

    // Check payment store
    checks.push({
      name: "payment_store",
      status: "pass" as const,
      message: `${paymentStore.size} payments tracked`,
    });

    // Check idempotency store
    checks.push({
      name: "idempotency_store",
      status: "pass" as const,
      message: `${idempotencyStore.size} idempotency keys stored`,
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

export const paymentService = new PaymentService();
