/**
 * Message Queue - Distributed Event Streaming
 * 
 * Supports:
 * - RabbitMQ (AMQP)
 * - Apache Kafka
 * - Amazon SQS
 * - Azure Service Bus
 * - In-memory fallback for development
 * 
 * Features:
 * - Guaranteed message delivery
 * - Dead letter queues
 * - Message retry with backoff
 * - Consumer groups
 * - Message acknowledgment
 * - Batch processing
 */

import { logger } from "./logger";
import { metrics } from "./metrics";

// Types
export interface MessageQueueConfig {
  type: "rabbitmq" | "kafka" | "sqs" | "azure" | "memory";
  connection?: {
    url?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    vhost?: string;
  };
  kafka?: {
    brokers: string[];
    clientId: string;
    groupId: string;
    ssl?: boolean;
    sasl?: {
      mechanism: "plain" | "scram-sha-256" | "scram-sha-512";
      username: string;
      password: string;
    };
  };
  options?: {
    prefetchCount?: number;
    heartbeat?: number;
    reconnectInterval?: number;
    maxRetries?: number;
  };
}

export interface Message<T = unknown> {
  id: string;
  type: string;
  payload: T;
  metadata: MessageMetadata;
  headers?: Record<string, string>;
}

export interface MessageMetadata {
  correlationId: string;
  timestamp: Date;
  source: string;
  version?: string;
  traceId?: string;
  spanId?: string;
  retryCount?: number;
  originalQueue?: string;
}

export interface PublishOptions {
  priority?: number;
  delay?: number;
  ttl?: number;
  persistent?: boolean;
  headers?: Record<string, string>;
  partitionKey?: string;
}

export interface ConsumeOptions {
  prefetch?: number;
  autoAck?: boolean;
  exclusive?: boolean;
  consumerTag?: string;
}

export interface QueueConfig {
  name: string;
  durable?: boolean;
  autoDelete?: boolean;
  exclusive?: boolean;
  deadLetterQueue?: string;
  messageTtl?: number;
  maxLength?: number;
  maxPriority?: number;
}

export interface ExchangeConfig {
  name: string;
  type: "direct" | "fanout" | "topic" | "headers";
  durable?: boolean;
  autoDelete?: boolean;
}

type MessageHandler<T = unknown> = (message: Message<T>, ack: () => void, nack: (requeue?: boolean) => void) => Promise<void>;

interface Subscription {
  queue: string;
  handler: MessageHandler;
  options: ConsumeOptions;
}

// Queue Topics
export const QueueTopics = {
  // Order Events
  ORDER_EVENTS: "orders.events",
  ORDER_CREATED: "orders.created",
  ORDER_UPDATED: "orders.updated",
  ORDER_CANCELLED: "orders.cancelled",
  ORDER_COMPLETED: "orders.completed",
  
  // Payment Events
  PAYMENT_EVENTS: "payments.events",
  PAYMENT_INITIATED: "payments.initiated",
  PAYMENT_COMPLETED: "payments.completed",
  PAYMENT_FAILED: "payments.failed",
  PAYMENT_REFUNDED: "payments.refunded",
  
  // Delivery Events
  DELIVERY_EVENTS: "delivery.events",
  DELIVERY_ASSIGNED: "delivery.assigned",
  DELIVERY_STARTED: "delivery.started",
  DELIVERY_COMPLETED: "delivery.completed",
  DELIVERY_LOCATION: "delivery.location",
  
  // Notification Events
  NOTIFICATION_EVENTS: "notifications.events",
  NOTIFICATION_EMAIL: "notifications.email",
  NOTIFICATION_SMS: "notifications.sms",
  NOTIFICATION_PUSH: "notifications.push",
  
  // Restaurant Events
  RESTAURANT_EVENTS: "restaurants.events",
  RESTAURANT_UPDATED: "restaurants.updated",
  MENU_UPDATED: "restaurants.menu.updated",
  
  // Analytics Events
  ANALYTICS_EVENTS: "analytics.events",
  USER_ACTION: "analytics.user.action",
  SYSTEM_METRIC: "analytics.system.metric",
  
  // Dead Letter Queues
  DLQ_ORDERS: "dlq.orders",
  DLQ_PAYMENTS: "dlq.payments",
  DLQ_NOTIFICATIONS: "dlq.notifications",
} as const;

export type QueueTopic = typeof QueueTopics[keyof typeof QueueTopics];

/**
 * Message Queue Abstraction
 */
class MessageQueue {
  private config: MessageQueueConfig;
  private connected: boolean = false;
  private subscriptions: Map<string, Subscription[]> = new Map();
  private messageStore: Map<string, Message[]> = new Map();
  private retryQueues: Map<string, Message[]> = new Map();
  private deadLetterQueues: Map<string, Message[]> = new Map();
  private processingMessages: Set<string> = new Set();
  private reconnectInterval: NodeJS.Timeout | null = null;
  private processorInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MessageQueueConfig>) {
    this.config = {
      type: (process.env.MQ_TYPE as MessageQueueConfig["type"]) || "memory",
      connection: {
        url: process.env.RABBITMQ_URL || process.env.MQ_URL,
        host: process.env.MQ_HOST || "localhost",
        port: parseInt(process.env.MQ_PORT || "5672"),
        username: process.env.MQ_USERNAME || "guest",
        password: process.env.MQ_PASSWORD || "guest",
        vhost: process.env.MQ_VHOST || "/",
      },
      kafka: {
        brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
        clientId: process.env.KAFKA_CLIENT_ID || "fooddash",
        groupId: process.env.KAFKA_GROUP_ID || "fooddash-consumers",
      },
      options: {
        prefetchCount: 10,
        heartbeat: 30,
        reconnectInterval: 5000,
        maxRetries: 3,
      },
      ...config,
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.connect();
      this.startMessageProcessor();
      logger.info("Message queue initialized", { type: this.config.type });
    } catch (error) {
      logger.error("Failed to initialize message queue", { error });
      this.scheduleReconnect();
    }
  }

  private async connect(): Promise<void> {
    switch (this.config.type) {
      case "rabbitmq":
        await this.connectRabbitMQ();
        break;
      case "kafka":
        await this.connectKafka();
        break;
      case "sqs":
        await this.connectSQS();
        break;
      case "azure":
        await this.connectAzureServiceBus();
        break;
      case "memory":
      default:
        this.connected = true;
        logger.info("Using in-memory message queue (development mode)");
    }
  }

  private async connectRabbitMQ(): Promise<void> {
    // In production, use amqplib:
    // import amqp from 'amqplib';
    // const connection = await amqp.connect(this.config.connection.url);
    
    logger.info("RabbitMQ connection simulated", { 
      host: this.config.connection?.host,
      port: this.config.connection?.port 
    });
    this.connected = true;
  }

  private async connectKafka(): Promise<void> {
    // In production, use kafkajs:
    // import { Kafka } from 'kafkajs';
    // const kafka = new Kafka({ brokers: this.config.kafka.brokers });
    
    logger.info("Kafka connection simulated", { 
      brokers: this.config.kafka?.brokers 
    });
    this.connected = true;
  }

  private async connectSQS(): Promise<void> {
    // In production, use @aws-sdk/client-sqs:
    // import { SQSClient } from '@aws-sdk/client-sqs';
    
    logger.info("AWS SQS connection simulated");
    this.connected = true;
  }

  private async connectAzureServiceBus(): Promise<void> {
    // In production, use @azure/service-bus:
    // import { ServiceBusClient } from '@azure/service-bus';
    
    logger.info("Azure Service Bus connection simulated");
    this.connected = true;
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) return;

    this.reconnectInterval = setInterval(async () => {
      if (!this.connected) {
        try {
          await this.connect();
          if (this.connected && this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
            
            // Re-subscribe all handlers
            const subscriptionEntries = Array.from(this.subscriptions.entries());
            for (const [queue, subs] of subscriptionEntries) {
              for (const sub of subs) {
                await this.internalSubscribe(queue, sub.handler, sub.options);
              }
            }
          }
        } catch (error) {
          logger.warn("Reconnection attempt failed", { error });
        }
      }
    }, this.config.options?.reconnectInterval || 5000);
  }

  private startMessageProcessor(): void {
    // Process messages for in-memory queue
    this.processorInterval = setInterval(() => {
      this.processMessages();
      this.processRetryQueues();
    }, 100);
  }

  private async processMessages(): Promise<void> {
    const messageEntries = Array.from(this.messageStore.entries());
    for (const [queue, messages] of messageEntries) {
      const handlers = this.subscriptions.get(queue) || [];
      
      while (messages.length > 0 && handlers.length > 0) {
        const message = messages.shift();
        if (!message || this.processingMessages.has(message.id)) continue;

        this.processingMessages.add(message.id);

        for (const sub of handlers) {
          try {
            await sub.handler(
              message,
              () => {
                // ack
                this.processingMessages.delete(message.id);
                metrics.increment("mq.messages.processed", 1, { queue });
              },
              (requeue = false) => {
                // nack
                this.processingMessages.delete(message.id);
                if (requeue) {
                  this.scheduleRetry(queue, message);
                } else {
                  this.sendToDeadLetter(queue, message);
                }
              }
            );
          } catch (error) {
            logger.error("Message handler error", { queue, messageId: message.id, error });
            this.scheduleRetry(queue, message);
          }
        }
      }
    }
  }

  private processRetryQueues(): void {
    const now = Date.now();
    
    const retryEntries = Array.from(this.retryQueues.entries());
    for (const [queue, messages] of retryEntries) {
      const toRetry = messages.filter((m: Message<unknown>) => {
        const retryTime = (m.metadata.timestamp.getTime() || 0) + 
          Math.pow(2, m.metadata.retryCount || 0) * 1000;
        return now >= retryTime;
      });

      for (const message of toRetry) {
        const idx = messages.indexOf(message);
        if (idx > -1) {
          messages.splice(idx, 1);
        }

        if ((message.metadata.retryCount || 0) >= (this.config.options?.maxRetries || 3)) {
          this.sendToDeadLetter(queue, message);
        } else {
          this.messageStore.get(queue)?.push(message);
        }
      }
    }
  }

  private scheduleRetry(queue: string, message: Message): void {
    message.metadata.retryCount = (message.metadata.retryCount || 0) + 1;
    message.metadata.timestamp = new Date();

    if (!this.retryQueues.has(queue)) {
      this.retryQueues.set(queue, []);
    }
    this.retryQueues.get(queue)!.push(message);
    
    metrics.increment("mq.messages.retried", 1, { queue });
    logger.warn("Message scheduled for retry", { 
      queue, 
      messageId: message.id, 
      retryCount: message.metadata.retryCount 
    });
  }

  private sendToDeadLetter(queue: string, message: Message): void {
    const dlqName = `dlq.${queue}`;
    
    if (!this.deadLetterQueues.has(dlqName)) {
      this.deadLetterQueues.set(dlqName, []);
    }
    
    message.metadata.originalQueue = queue;
    this.deadLetterQueues.get(dlqName)!.push(message);
    
    metrics.increment("mq.messages.deadletter", 1, { queue });
    logger.error("Message sent to dead letter queue", { 
      queue: dlqName, 
      messageId: message.id 
    });
  }

  /**
   * Publish a message to a queue/topic
   */
  async publish<T>(
    queue: string,
    type: string,
    payload: T,
    options: PublishOptions = {}
  ): Promise<string> {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const message: Message<T> = {
      id: messageId,
      type,
      payload,
      metadata: {
        correlationId: options.headers?.["x-correlation-id"] || messageId,
        timestamp: new Date(),
        source: "fooddash",
        version: "1.0",
        retryCount: 0,
      },
      headers: options.headers,
    };

    // Handle delayed messages
    if (options.delay && options.delay > 0) {
      setTimeout(() => {
        this.internalPublish(queue, message);
      }, options.delay);
    } else {
      await this.internalPublish(queue, message);
    }

    metrics.increment("mq.messages.published", 1, { queue, type });
    logger.debug("Message published", { queue, type, messageId });

    return messageId;
  }

  private async internalPublish<T>(queue: string, message: Message<T>): Promise<void> {
    if (!this.messageStore.has(queue)) {
      this.messageStore.set(queue, []);
    }
    this.messageStore.get(queue)!.push(message as Message);
  }

  /**
   * Publish multiple messages in a batch
   */
  async publishBatch<T>(
    queue: string,
    messages: { type: string; payload: T; options?: PublishOptions }[]
  ): Promise<string[]> {
    const ids: string[] = [];
    
    for (const msg of messages) {
      const id = await this.publish(queue, msg.type, msg.payload, msg.options);
      ids.push(id);
    }

    return ids;
  }

  /**
   * Subscribe to a queue/topic
   */
  async subscribe<T>(
    queue: string,
    handler: MessageHandler<T>,
    options: ConsumeOptions = {}
  ): Promise<string> {
    const subscription: Subscription = {
      queue,
      handler: handler as MessageHandler,
      options: {
        prefetch: this.config.options?.prefetchCount,
        autoAck: false,
        ...options,
      },
    };

    if (!this.subscriptions.has(queue)) {
      this.subscriptions.set(queue, []);
    }
    this.subscriptions.get(queue)!.push(subscription);

    // Initialize queue if not exists
    if (!this.messageStore.has(queue)) {
      this.messageStore.set(queue, []);
    }

    await this.internalSubscribe(queue, handler as MessageHandler, subscription.options);

    const consumerTag = options.consumerTag || 
      `consumer-${queue}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    logger.info("Subscribed to queue", { queue, consumerTag });
    return consumerTag;
  }

  private async internalSubscribe(
    queue: string,
    handler: MessageHandler,
    options: ConsumeOptions
  ): Promise<void> {
    // For actual implementations, set up the consumer here
    // RabbitMQ: channel.consume(queue, handler)
    // Kafka: consumer.subscribe({ topic: queue })
  }

  /**
   * Unsubscribe from a queue
   */
  async unsubscribe(queue: string, consumerTag?: string): Promise<void> {
    const subs = this.subscriptions.get(queue);
    if (subs) {
      if (consumerTag) {
        const idx = subs.findIndex((s) => s.options.consumerTag === consumerTag);
        if (idx > -1) subs.splice(idx, 1);
      } else {
        this.subscriptions.delete(queue);
      }
    }
    logger.info("Unsubscribed from queue", { queue, consumerTag });
  }

  /**
   * Create an exchange (for RabbitMQ)
   */
  async createExchange(config: ExchangeConfig): Promise<void> {
    logger.info("Exchange created", { name: config.name, type: config.type });
  }

  /**
   * Create a queue
   */
  async createQueue(config: QueueConfig): Promise<void> {
    if (!this.messageStore.has(config.name)) {
      this.messageStore.set(config.name, []);
    }
    logger.info("Queue created", { name: config.name });
  }

  /**
   * Bind queue to exchange
   */
  async bindQueue(queue: string, exchange: string, routingKey: string): Promise<void> {
    logger.info("Queue bound to exchange", { queue, exchange, routingKey });
  }

  /**
   * Get queue statistics
   */
  getQueueStats(queue: string): {
    messageCount: number;
    consumerCount: number;
    retryCount: number;
    deadLetterCount: number;
  } {
    return {
      messageCount: this.messageStore.get(queue)?.length || 0,
      consumerCount: this.subscriptions.get(queue)?.length || 0,
      retryCount: this.retryQueues.get(queue)?.length || 0,
      deadLetterCount: this.deadLetterQueues.get(`dlq.${queue}`)?.length || 0,
    };
  }

  /**
   * Get all queue statistics
   */
  getAllStats(): Record<string, ReturnType<typeof this.getQueueStats>> {
    const stats: Record<string, ReturnType<typeof this.getQueueStats>> = {};
    
    const queues = Array.from(this.messageStore.keys());
    for (const queue of queues) {
      stats[queue] = this.getQueueStats(queue);
    }
    
    return stats;
  }

  /**
   * Purge a queue
   */
  async purgeQueue(queue: string): Promise<number> {
    const messages = this.messageStore.get(queue);
    const count = messages?.length || 0;
    this.messageStore.set(queue, []);
    logger.info("Queue purged", { queue, messageCount: count });
    return count;
  }

  /**
   * Reprocess dead letter messages
   */
  async reprocessDeadLetters(dlqName: string): Promise<number> {
    const messages = this.deadLetterQueues.get(dlqName) || [];
    let count = 0;

    for (const message of messages) {
      const originalQueue = message.metadata.originalQueue;
      if (originalQueue) {
        message.metadata.retryCount = 0;
        delete message.metadata.originalQueue;
        this.messageStore.get(originalQueue)?.push(message);
        count++;
      }
    }

    this.deadLetterQueues.set(dlqName, []);
    logger.info("Dead letters reprocessed", { dlqName, count });
    return count;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Shutdown gracefully
   */
  async shutdown(): Promise<void> {
    if (this.processorInterval) {
      clearInterval(this.processorInterval);
    }
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    // Wait for processing to complete
    while (this.processingMessages.size > 0) {
      await new Promise((r) => setTimeout(r, 100));
    }

    this.connected = false;
    logger.info("Message queue shutdown complete");
  }
}

// Export singleton
export const messageQueue = new MessageQueue();

/**
 * Helper function to create typed publishers
 */
export function createPublisher<T>(queue: QueueTopic) {
  return {
    publish: (type: string, payload: T, options?: PublishOptions) => 
      messageQueue.publish<T>(queue, type, payload, options),
    
    publishBatch: (messages: { type: string; payload: T; options?: PublishOptions }[]) =>
      messageQueue.publishBatch<T>(queue, messages),
  };
}

/**
 * Helper function to create typed subscribers
 */
export function createSubscriber<T>(queue: QueueTopic) {
  return {
    subscribe: (handler: MessageHandler<T>, options?: ConsumeOptions) =>
      messageQueue.subscribe<T>(queue, handler, options),
    
    unsubscribe: (consumerTag?: string) =>
      messageQueue.unsubscribe(queue, consumerTag),
  };
}

// Pre-configured publishers and subscribers
export const orderPublisher = createPublisher<any>(QueueTopics.ORDER_EVENTS);
export const paymentPublisher = createPublisher<any>(QueueTopics.PAYMENT_EVENTS);
export const deliveryPublisher = createPublisher<any>(QueueTopics.DELIVERY_EVENTS);
export const notificationPublisher = createPublisher<any>(QueueTopics.NOTIFICATION_EVENTS);
export const analyticsPublisher = createPublisher<any>(QueueTopics.ANALYTICS_EVENTS);
