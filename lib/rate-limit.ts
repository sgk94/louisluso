import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  prefix: "louisluso:ratelimit",
});

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

export async function rateLimit(
  identifier: string
): Promise<RateLimitResult> {
  const { success, remaining } = await limiter.limit(identifier);
  return { success, remaining };
}

const dealerContactLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "louisluso:dealer-contact",
});

export async function rateLimitDealerContact(
  identifier: string
): Promise<RateLimitResult> {
  const { success, remaining } = await dealerContactLimiter.limit(identifier);
  return { success, remaining };
}

const quoteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "louisluso:quote",
});

export async function rateLimitQuote(
  identifier: string
): Promise<RateLimitResult> {
  const { success, remaining } = await quoteLimiter.limit(identifier);
  return { success, remaining };
}

const quotesListLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "5 m"),
  prefix: "louisluso:quotes-list",
});

export async function rateLimitQuotesList(
  identifier: string
): Promise<RateLimitResult> {
  const { success, remaining } = await quotesListLimiter.limit(identifier);
  return { success, remaining };
}

const orderDetailLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "5 m"),
  prefix: "louisluso:order-detail",
});

export async function rateLimitOrderDetail(
  identifier: string
): Promise<RateLimitResult> {
  const { success, remaining } = await orderDetailLimiter.limit(identifier);
  return { success, remaining };
}

const zohoWebhookLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "5 m"),
  prefix: "louisluso:zoho-webhook",
});

export async function rateLimitZohoWebhook(
  identifier: string
): Promise<RateLimitResult> {
  const { success, remaining } = await zohoWebhookLimiter.limit(identifier);
  return { success, remaining };
}

const quoteFallbackLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "louisluso:quote-fallback",
});

export async function rateLimitQuoteFallback(
  identifier: string,
): Promise<RateLimitResult> {
  const { success, remaining } = await quoteFallbackLimiter.limit(identifier);
  return { success, remaining };
}
