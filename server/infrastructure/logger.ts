type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  correlationId?: string;
  service?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

class Logger {
  private serviceName: string;

  constructor(serviceName: string = "api") {
    this.serviceName = serviceName;
  }

  private formatLog(entry: LogEntry): string {
    const { level, message, correlationId, service, timestamp, data } = entry;
    const prefix = correlationId ? `[${correlationId}]` : "";
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    return `${timestamp} ${level.toUpperCase()} [${service}]${prefix} ${message}${dataStr}`;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>, correlationId?: string) {
    const entry: LogEntry = {
      level,
      message,
      correlationId,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      data,
    };

    const formatted = this.formatLog(entry);

    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }

  debug(message: string, data?: Record<string, unknown>, correlationId?: string) {
    this.log("debug", message, data, correlationId);
  }

  info(message: string, data?: Record<string, unknown>, correlationId?: string) {
    this.log("info", message, data, correlationId);
  }

  warn(message: string, data?: Record<string, unknown>, correlationId?: string) {
    this.log("warn", message, data, correlationId);
  }

  error(message: string, data?: Record<string, unknown>, correlationId?: string) {
    this.log("error", message, data, correlationId);
  }

  child(serviceName: string): Logger {
    return new Logger(serviceName);
  }
}

export const logger = new Logger("fooddash");

export const createServiceLogger = (serviceName: string) => logger.child(serviceName);
