/**
 * Simple in-memory rate limiter to prevent API abuse.
 * Tracks requests per IP address with a sliding window approach.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if a request should be rate limited.
 * @param ip - Client IP address
 * @param maxRequests - Maximum requests allowed within the window
 * @param windowMs - Time window in milliseconds
 * @returns true if request should be allowed, false if rate limited
 */
export function checkRateLimit(ip: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetTime) {
    // New entry or window expired
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  // Increment counter
  if (entry.count < maxRequests) {
    entry.count++;
    return true;
  }

  // Rate limit exceeded
  return false;
}

/**
 * Get remaining requests for an IP.
 */
export function getRemainingRequests(ip: string, maxRequests = 10): number {
  const entry = rateLimitStore.get(ip);
  if (!entry || Date.now() > entry.resetTime) {
    return maxRequests;
  }
  return Math.max(0, maxRequests - entry.count);
}

/**
 * Get reset time for an IP (in milliseconds from now).
 */
export function getResetTime(ip: string): number {
  const entry = rateLimitStore.get(ip);
  if (!entry) {
    return 0;
  }
  const timeUntilReset = entry.resetTime - Date.now();
  return Math.max(0, timeUntilReset);
}

/**
 * Clean up old entries periodically (call this in a job or interval).
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
