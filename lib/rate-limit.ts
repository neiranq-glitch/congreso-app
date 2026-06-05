import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

function buildLimiter(tokens: number, windowSeconds: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // graceful degrade in dev/local
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(tokens, `${windowSeconds}s`),
  });
}

// Separate limiters per concern so one flow can't exhaust another's budget
const limiters = {
  // Auth-adjacent: registration, tight limit to prevent spam sign-ups
  registration: buildLimiter(5, 300), // 5 per 5 min per IP
  // Booking: logged-in users get more headroom but still bounded
  booking: buildLimiter(30, 60), // 30 per min per user
  // QR scan: staff endpoint, generous but bounded
  qrScan: buildLimiter(120, 60), // 120 per min per staff token
  // General public API reads
  public: buildLimiter(60, 60), // 60 per min per IP
} as const;

type LimiterKey = keyof typeof limiters;

export async function applyRateLimit(
  req: NextRequest,
  limiterKey: LimiterKey,
  identifier?: string
): Promise<NextResponse | null> {
  const limiter = limiters[limiterKey];
  if (!limiter) return null; // no Redis configured → pass through

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const key = identifier ?? ip;

  const { success, limit, reset } = await limiter.limit(key);

  if (!success) {
    return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(reset),
      },
    });
  }

  return null; // allowed — caller continues
}
