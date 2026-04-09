import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    ZOHO_CLIENT_ID: "test-client-id",
    ZOHO_CLIENT_SECRET: "test-client-secret",
    ZOHO_REFRESH_TOKEN: "test-refresh-token",
    ZOHO_API_BASE_URL: "https://www.zohoapis.com",
  },
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockTokenResponse(
  overrides: Partial<{ access_token: string; expires_in: number }> = {},
): Response {
  return {
    ok: true,
    json: async () => ({
      access_token: "zoho-access-token-123",
      expires_in: 3600,
      token_type: "Bearer",
      ...overrides,
    }),
  } as Response;
}

describe("Zoho auth", () => {
  let getAccessToken: typeof import("@/lib/zoho/auth").getAccessToken;
  let clearTokenCache: typeof import("@/lib/zoho/auth").clearTokenCache;

  beforeEach(async () => {
    vi.resetModules();
    mockFetch.mockReset();

    const mod = await import("@/lib/zoho/auth");
    getAccessToken = mod.getAccessToken;
    clearTokenCache = mod.clearTokenCache;
  });

  it("fetches new access token using refresh token", async () => {
    mockFetch.mockResolvedValueOnce(mockTokenResponse());

    const token = await getAccessToken();

    expect(token).toBe("zoho-access-token-123");
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://accounts.zoho.com/oauth/v2/token");
    expect(options.method).toBe("POST");

    const body = new URLSearchParams(options.body as string);
    expect(body.get("refresh_token")).toBe("test-refresh-token");
    expect(body.get("client_id")).toBe("test-client-id");
    expect(body.get("client_secret")).toBe("test-client-secret");
    expect(body.get("grant_type")).toBe("refresh_token");
  });

  it("returns cached token on subsequent calls", async () => {
    mockFetch.mockResolvedValueOnce(mockTokenResponse());

    const token1 = await getAccessToken();
    const token2 = await getAccessToken();

    expect(token1).toBe("zoho-access-token-123");
    expect(token2).toBe("zoho-access-token-123");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("refreshes token when expired", async () => {
    mockFetch.mockResolvedValueOnce(mockTokenResponse({ expires_in: 0 }));
    mockFetch.mockResolvedValueOnce(
      mockTokenResponse({ access_token: "new-token-456" }),
    );

    const token1 = await getAccessToken();
    expect(token1).toBe("zoho-access-token-123");

    const token2 = await getAccessToken();
    expect(token2).toBe("new-token-456");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws on failed token refresh", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response);

    await expect(getAccessToken()).rejects.toThrow(
      "Zoho token refresh failed: 401 Unauthorized",
    );
  });
});
