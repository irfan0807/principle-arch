/**
 * Metrics Infrastructure for Observability
 * Prometheus-style metrics collection
 */

interface MetricEntry {
  name: string;
  type: "counter" | "gauge" | "histogram" | "summary";
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
}

interface HistogramBucket {
  le: number;
  count: number;
}

interface Timer {
  end: () => void;
}

class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private labels: Map<string, Record<string, string>> = new Map();

  // Histogram buckets (in ms)
  private defaultBuckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  /**
   * Increment counter
   */
  increment(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    this.labels.set(key, labels);
  }

  /**
   * Set gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
    this.labels.set(key, labels);
  }

  /**
   * Observe histogram value
   */
  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
    this.labels.set(key, labels);
  }

  /**
   * Alias for observe - record histogram value
   */
  histogram(name: string, value: number, labels: Record<string, string> = {}): void {
    this.observe(name, value, labels);
  }

  /**
   * Start a timer for latency measurement
   */
  startTimer(name: string, labels: Record<string, string> = {}): Timer {
    const startTime = Date.now();
    return {
      end: () => {
        const duration = Date.now() - startTime;
        this.observe(`${name}.duration_ms`, duration, labels);
      },
    };
  }

  /**
   * Record success
   */
  recordSuccess(name: string, labels: Record<string, string> = {}): void {
    this.increment(`${name}.success`, 1, labels);
  }

  /**
   * Record error
   */
  recordError(name: string, labels: Record<string, string> = {}): void {
    this.increment(`${name}.error`, 1, labels);
  }

  /**
   * Record request
   */
  recordRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
  ): void {
    const labels = { method, path, status: statusCode.toString() };
    this.increment("http_requests_total", 1, labels);
    this.observe("http_request_duration_ms", durationMs, labels);
  }

  /**
   * Build metric key with labels
   */
  private buildKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Get histogram percentile
   */
  private getPercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get histogram buckets
   */
  private getHistogramBuckets(values: number[], buckets: number[] = this.defaultBuckets): HistogramBucket[] {
    return buckets.map((le) => ({
      le,
      count: values.filter((v) => v <= le).length,
    }));
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of Array.from(this.counters.entries())) {
      lines.push(`# TYPE ${key.split("{")[0]} counter`);
      lines.push(`${key} ${value}`);
    }

    // Gauges
    for (const [key, value] of Array.from(this.gauges.entries())) {
      lines.push(`# TYPE ${key.split("{")[0]} gauge`);
      lines.push(`${key} ${value}`);
    }

    // Histograms
    for (const [key, values] of Array.from(this.histograms.entries())) {
      const baseName = key.split("{")[0];
      const labelsStr = key.includes("{") ? key.slice(key.indexOf("{") + 1, -1) : "";
      
      lines.push(`# TYPE ${baseName} histogram`);
      
      const buckets = this.getHistogramBuckets(values);
      for (const bucket of buckets) {
        const bucketLabels = labelsStr ? `${labelsStr},le="${bucket.le}"` : `le="${bucket.le}"`;
        lines.push(`${baseName}_bucket{${bucketLabels}} ${bucket.count}`);
      }
      
      lines.push(`${baseName}_sum${labelsStr ? `{${labelsStr}}` : ""} ${values.reduce((a: number, b: number) => a + b, 0)}`);
      lines.push(`${baseName}_count${labelsStr ? `{${labelsStr}}` : ""} ${values.length}`);
    }

    return lines.join("\n");
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, { count: number; sum: number; p50: number; p95: number; p99: number }>;
  } {
    const result: any = {
      counters: {},
      gauges: {},
      histograms: {},
    };

    for (const [key, value] of Array.from(this.counters.entries())) {
      result.counters[key] = value;
    }

    for (const [key, value] of Array.from(this.gauges.entries())) {
      result.gauges[key] = value;
    }

    for (const [key, values] of Array.from(this.histograms.entries())) {
      result.histograms[key] = {
        count: values.length,
        sum: values.reduce((a: number, b: number) => a + b, 0),
        p50: this.getPercentile(values, 50),
        p95: this.getPercentile(values, 95),
        p99: this.getPercentile(values, 99),
      };
    }

    return result;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.labels.clear();
  }
}

export const metrics = new MetricsCollector();

/**
 * SLI/SLO tracking
 */
export interface SLO {
  name: string;
  target: number;
  window: "1h" | "24h" | "7d" | "30d";
}

export class SLOTracker {
  private slos: SLO[] = [];
  private measurements: Map<string, { success: number; total: number }> = new Map();

  register(slo: SLO): void {
    this.slos.push(slo);
    this.measurements.set(slo.name, { success: 0, total: 0 });
  }

  record(sloName: string, success: boolean): void {
    const m = this.measurements.get(sloName);
    if (m) {
      m.total++;
      if (success) m.success++;
    }
  }

  getStatus(): Array<{ slo: SLO; current: number; budget: number; budgetRemaining: number }> {
    return this.slos.map((slo) => {
      const m = this.measurements.get(slo.name) || { success: 0, total: 0 };
      const current = m.total > 0 ? (m.success / m.total) * 100 : 100;
      const budget = (1 - slo.target / 100) * 100;
      const budgetRemaining = budget - (100 - current);

      return {
        slo,
        current,
        budget,
        budgetRemaining,
      };
    });
  }
}

export const sloTracker = new SLOTracker();

// Metrics endpoint helper
export const metricsEndpoint = () => metrics.exportPrometheus();

// Register common SLOs
sloTracker.register({ name: "order_creation_success_rate", target: 99.9, window: "24h" });
sloTracker.register({ name: "payment_success_rate", target: 99.5, window: "24h" });
sloTracker.register({ name: "api_availability", target: 99.9, window: "7d" });
sloTracker.register({ name: "order_latency_p99_under_500ms", target: 99.0, window: "24h" });
