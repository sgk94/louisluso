import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @upstash/ratelimit so the test doesn't need real Redis.
const { limitMock } = vi.hoisted(() => ({
  limitMock: vi.fn().mockResolvedValue({ success: true, remaining: 59 }),
}));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    limit = limitMock;
    static slidingWindow = vi.fn(() => "sliding");
  },
}));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@/lib/env", () => ({
  env: { UPSTASH_REDIS_REST_URL: "x", UPSTASH_REDIS_REST_TOKEN: "y" },
}));

import { rateLimitOrderDetail } from "@/lib/rate-limit";

describe("rateLimitOrderDetail", () => {
  beforeEach(() => limitMock.mockClear());

  it("delegates to the order-detail limiter and returns success+remaining", async () => {
    const result = await rateLimitOrderDetail("user_123");
    expect(limitMock).toHaveBeenCalledWith("user_123");
    expect(result).toEqual({ success: true, remaining: 59 });
  });
});
