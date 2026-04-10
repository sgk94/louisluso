import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/dealers/route";

describe("GET /api/dealers", () => {
  it("returns all mock dealers", async () => {
    const request = new Request("http://localhost/api/dealers");
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.dealers).toBeDefined();
    expect(data.dealers.length).toBeGreaterThanOrEqual(10);
  });

  it("each dealer has required fields", async () => {
    const request = new Request("http://localhost/api/dealers");
    const response = await GET(request);
    const data = await response.json();
    for (const dealer of data.dealers) {
      expect(dealer.id).toBeTruthy();
      expect(dealer.name).toBeTruthy();
      expect(dealer.coordinates.lat).toBeDefined();
      expect(dealer.coordinates.lng).toBeDefined();
    }
  });
});
