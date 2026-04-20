import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { ZOHO_API_BASE_URL: "https://api.example", ZOHO_ORG_ID: "org_1" },
}));
vi.mock("@/lib/zoho/auth", () => ({
  getAccessToken: vi.fn().mockResolvedValue("tok"),
}));

import { zohoFetch } from "@/lib/zoho/client";

describe("zohoFetch instrumentation", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 0, ok: true }), { status: 200 }),
    );
  });
  afterEach(() => {
    logSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  it("emits a structured log line on every successful call", async () => {
    await zohoFetch("/books/v3/estimates");
    expect(logSpy).toHaveBeenCalledTimes(1);
    const arg = logSpy.mock.calls[0][0];
    expect(typeof arg).toBe("string");
    const parsed = JSON.parse(arg);
    expect(parsed).toMatchObject({
      tag: "zoho_call",
      method: "GET",
      endpoint: "/books/v3/estimates",
      status: 200,
    });
    expect(typeof parsed.ms).toBe("number");
    expect(parsed.ms).toBeGreaterThanOrEqual(0);
  });

  it("logs failed calls with the response status", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 429 }));
    await expect(zohoFetch("/books/v3/estimates")).rejects.toThrow();
    const arg = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.status).toBe(429);
  });

  it("returns an empty shape on 204 No Content (zero-match search)", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await zohoFetch<{ data?: unknown[] }>(
      "/crm/v6/Contacts/search",
      { params: { email: "nobody@example.com" } },
    );
    expect(result).toEqual({});
  });

  it("returns an empty shape on 200 with empty body", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("", { status: 200, headers: { "content-length": "0" } }),
    );
    const result = await zohoFetch<{ data?: unknown[] }>(
      "/books/v3/contacts",
    );
    expect(result).toEqual({});
  });
});
