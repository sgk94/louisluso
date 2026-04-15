import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLimit } = vi.hoisted(() => ({ mockLimit: vi.fn() }));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn(() => "sliding-window-config");
    limit = mockLimit;
  },
}));
vi.mock("@upstash/redis", () => ({ Redis: vi.fn() }));
vi.mock("@/lib/env", () => ({
  env: { UPSTASH_REDIS_REST_URL: "http://redis", UPSTASH_REDIS_REST_TOKEN: "token" },
}));

import { rateLimitQuotesList } from "@/lib/rate-limit";

describe("rateLimitQuotesList", () => {
  beforeEach(() => {
    mockLimit.mockReset();
  });

  it("returns success true when limit not exceeded", async () => {
    mockLimit.mockResolvedValueOnce({ success: true, remaining: 29 });
    const result = await rateLimitQuotesList("user-abc");
    expect(result).toEqual({ success: true, remaining: 29 });
    expect(mockLimit).toHaveBeenCalledWith("user-abc");
  });

  it("returns success false when limit exceeded", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 });
    const result = await rateLimitQuotesList("user-abc");
    expect(result).toEqual({ success: false, remaining: 0 });
  });
});
