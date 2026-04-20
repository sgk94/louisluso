import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    ZOHO_API_BASE_URL: "https://www.zohoapis.com",
    ZOHO_ORG_ID: "test-org-123",
  },
}));

vi.mock("@/lib/zoho/auth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("mock-access-token"),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("zohoFetch", () => {
  let zohoFetch: typeof import("@/lib/zoho/client").zohoFetch;

  beforeEach(async () => {
    vi.resetModules();
    mockFetch.mockReset();

    const mod = await import("@/lib/zoho/client");
    zohoFetch = mod.zohoFetch;
  });

  it("makes authenticated GET request with correct URL and headers", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );

    const result = await zohoFetch("/inventory/v1/items");

    expect(result).toEqual({ items: [] });
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://www.zohoapis.com/inventory/v1/items");
    expect(options.method).toBe("GET");
    expect(options.headers).toEqual(
      expect.objectContaining({
        Authorization: "Zoho-oauthtoken mock-access-token",
        "X-com-zoho-inventory-organizationid": "test-org-123",
      }),
    );
  });

  it("makes POST request with JSON body", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ item: { id: "123" } }), { status: 200 }),
    );

    const body = { name: "Test Item", rate: 100 };
    const result = await zohoFetch("/inventory/v1/items", {
      method: "POST",
      body,
    });

    expect(result).toEqual({ item: { id: "123" } });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify(body));
    expect(options.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
      }),
    );
  });

  it("appends query params to URL", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );

    await zohoFetch("/inventory/v1/items", {
      params: { page: "1", per_page: "25" },
    });

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/inventory/v1/items");
    expect(parsed.searchParams.get("page")).toBe("1");
    expect(parsed.searchParams.get("per_page")).toBe("25");
  });

  it("throws ZohoApiError on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("Rate limit exceeded", { status: 429 }),
    );

    await expect(zohoFetch("/inventory/v1/items")).rejects.toThrow(
      "Zoho API request failed",
    );
  });

  it("uses correct org header for books paths", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ salesorders: [] }), { status: 200 }),
    );

    await zohoFetch("/books/v3/salesorders");

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toEqual(
      expect.objectContaining({
        "X-com-zoho-books-organizationid": "test-org-123",
      }),
    );
  });

  it("uses correct org header for crm paths", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    await zohoFetch("/crm/v6/Contacts");

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toEqual(
      expect.objectContaining({
        "X-com-zoho-crm-organizationid": "test-org-123",
      }),
    );
  });

  it("throws on Zoho 200 response with error code", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 57, message: "Not authorized" }), { status: 200 }),
    );

    await expect(zohoFetch("/inventory/v1/items")).rejects.toThrow(
      "Zoho API request failed",
    );
  });
});
