import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendEmail } = vi.hoisted(() => ({ mockSendEmail: vi.fn() }));

vi.mock("@/lib/gmail", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/env", () => ({
  env: { PORTAL_SIGNUP_URL: "https://louisluso.com/sign-up" },
}));

import { sendPartnerInvite } from "@/lib/portal/invite";

const CONTACT = {
  Email: "dealer@store.com",
  First_Name: "Jane",
  Last_Name: "Doe",
  Account_Name: "Doe Optical",
};

describe("sendPartnerInvite", () => {
  beforeEach(() => {
    mockSendEmail.mockReset().mockResolvedValue(undefined);
  });

  it("sends email to the contact with expected subject + body", async () => {
    const result = await sendPartnerInvite(CONTACT);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const args = mockSendEmail.mock.calls[0][0];
    expect(args.to).toBe("dealer@store.com");
    expect(args.subject).toBe("Welcome to the LOUISLUSO Partner Portal");
    expect(args.body).toContain("Jane");
    expect(args.body).toContain("dealer@store.com");
    expect(args.body).toContain("https://louisluso.com/sign-up");
    expect(result.dryRun).toBe(false);
  });

  it("falls back to 'Partner' when first name is missing", async () => {
    await sendPartnerInvite({ ...CONTACT, First_Name: "" });
    const body = mockSendEmail.mock.calls[0][0].body;
    expect(body).toContain("Hi Partner,");
  });

  it("dryRun returns rendered content without calling sendEmail", async () => {
    const result = await sendPartnerInvite(CONTACT, { dryRun: true });

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.subject).toBe("Welcome to the LOUISLUSO Partner Portal");
    expect(result.body).toContain("Jane");
  });

  it("propagates sendEmail errors", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("gmail down"));
    await expect(sendPartnerInvite(CONTACT)).rejects.toThrow("gmail down");
  });
});
