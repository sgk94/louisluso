import { describe, it, expect } from "vitest";
import { partnerLabelForEstimateStatus } from "@/lib/zoho/books";

describe("partnerLabelForEstimateStatus", () => {
  it("maps draft to Pending Review", () => {
    expect(partnerLabelForEstimateStatus("draft")).toBe("Pending Review");
  });
  it("maps sent to Pending Review", () => {
    expect(partnerLabelForEstimateStatus("sent")).toBe("Pending Review");
  });
  it("maps accepted to Confirmed", () => {
    expect(partnerLabelForEstimateStatus("accepted")).toBe("Confirmed");
  });
  it("maps declined to Declined", () => {
    expect(partnerLabelForEstimateStatus("declined")).toBe("Declined");
  });
  it("maps expired to Expired", () => {
    expect(partnerLabelForEstimateStatus("expired")).toBe("Expired");
  });
  it("maps invoiced to Order Placed", () => {
    expect(partnerLabelForEstimateStatus("invoiced")).toBe("Order Placed");
  });
  it("title-cases unknown statuses as fallback", () => {
    expect(partnerLabelForEstimateStatus("on_hold")).toBe("On_hold");
    expect(partnerLabelForEstimateStatus("")).toBe("");
  });
});
