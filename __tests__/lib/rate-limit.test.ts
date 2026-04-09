import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLimit = vi.fn();
const mockRatelimitConstructor = vi.fn();

vi.mock("@upstash/redis", () => {
  return {
    Redis: class MockRedis {
      constructor() {
        // no-op
      }
    },
  };
});

vi.mock("@upstash/ratelimit", () => {
  class MockRatelimit {
    limit = mockLimit;
    constructor(...args: unknown[]) {
      mockRatelimitConstructor(...args);
    }
    static slidingWindow = vi.fn().mockReturnValue("sliding-window-config");
  }
  return { Ratelimit: MockRatelimit };
});

vi.mock("@/lib/env", () => ({
  env: {
    UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-redis-token",
  },
}));

describe("rateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns success and remaining for allowed requests", async () => {
    mockLimit.mockResolvedValue({ success: true, remaining: 9 });

    const { rateLimit } = await import("@/lib/rate-limit");
    const result = await rateLimit("test-user-123");

    expect(result).toEqual({ success: true, remaining: 9 });
    expect(mockLimit).toHaveBeenCalledWith("test-user-123");
  });

  it("returns failure when rate limit is exceeded", async () => {
    mockLimit.mockResolvedValue({ success: false, remaining: 0 });

    const { rateLimit } = await import("@/lib/rate-limit");
    const result = await rateLimit("test-user-456");

    expect(result).toEqual({ success: false, remaining: 0 });
    expect(mockLimit).toHaveBeenCalledWith("test-user-456");
  });

  it("creates Ratelimit with correct configuration", async () => {
    mockLimit.mockResolvedValue({ success: true, remaining: 9 });

    await import("@/lib/rate-limit");

    expect(mockRatelimitConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: "louisluso:ratelimit",
      })
    );
  });
});
