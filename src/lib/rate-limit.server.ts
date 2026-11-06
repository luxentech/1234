/**
 * In-memory sliding-window rate limiter for public API endpoints.
 * Protects against brute-force attacks, endpoint flooding, and credential stuffing.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

// Cleanup stale records every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStale(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const threshold = now - windowMs;
  for (const [key, record] of store.entries()) {
    record.timestamps = record.timestamps.filter((ts) => ts > threshold);
    if (record.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

export interface RateLimitOptions {
  windowMs: number; // Window duration in ms
  maxRequests: number; // Max requests allowed within window
  keyPrefix?: string;
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions,
): { allowed: boolean; remaining: number; resetMs: number } {
  cleanupStale(options.windowMs);

  const now = Date.now();
  const key = `${options.keyPrefix || "rl"}:${identifier}`;
  const threshold = now - options.windowMs;

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Filter timestamps within the current window
  record.timestamps = record.timestamps.filter((ts) => ts > threshold);

  if (record.timestamps.length >= options.maxRequests) {
    const oldest = record.timestamps[0] ?? now;
    const resetMs = Math.max(0, oldest + options.windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: options.maxRequests - record.timestamps.length,
    resetMs: options.windowMs,
  };
}

export function getClientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "127.0.0.1"
  );
}
