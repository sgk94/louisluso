import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/webhooks/zoho/route";

describe("POST /api/webhooks/zoho (stub)", () => {
  it("accepts and logs any payload, returns 200", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const req = new Request("http://test/api/webhooks/zoho", {
      method: "POST",
      body: JSON.stringify({ event: "estimate.accepted", data: { id: "x" } }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("returns 200 even on malformed JSON (Zoho retries on non-2xx)", async () => {
    const req = new Request("http://test/api/webhooks/zoho", {
      method: "POST",
      body: "{garbage",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
