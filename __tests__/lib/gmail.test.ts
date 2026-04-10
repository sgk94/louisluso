import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({}),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(function () {
        return { setCredentials: vi.fn() };
      }),
    },
    gmail: vi.fn().mockReturnValue({
      users: { messages: { send: mockSend } },
    }),
  },
}));
vi.mock("@/lib/env", () => ({
  env: {
    GMAIL_CLIENT_ID: "test-id",
    GMAIL_CLIENT_SECRET: "test-secret",
    GMAIL_REFRESH_TOKEN: "test-token",
  },
}));

import { sendEmail } from "@/lib/gmail";

describe("sendEmail", () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it("sends an email with basic fields", async () => {
    await sendEmail({ to: "dealer@example.com", subject: "Test", body: "Hello" });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const raw = mockSend.mock.calls[0][0].requestBody.raw;
    const decoded = Buffer.from(raw, "base64url").toString();
    expect(decoded).toContain("To: dealer@example.com");
    expect(decoded).toContain("Subject: Test");
    expect(decoded).toContain("Hello");
  });

  it("includes Reply-To header when provided", async () => {
    await sendEmail({ to: "dealer@example.com", subject: "Test", body: "Hello", replyTo: "customer@example.com" });
    const raw = mockSend.mock.calls[0][0].requestBody.raw;
    const decoded = Buffer.from(raw, "base64url").toString();
    expect(decoded).toContain("Reply-To: customer@example.com");
  });

  it("includes BCC header when provided", async () => {
    await sendEmail({ to: "dealer@example.com", subject: "Test", body: "Hello", bcc: ["admin@louisluso.com"] });
    const raw = mockSend.mock.calls[0][0].requestBody.raw;
    const decoded = Buffer.from(raw, "base64url").toString();
    expect(decoded).toContain("Bcc: admin@louisluso.com");
  });

  it("supports multiple BCC recipients", async () => {
    await sendEmail({ to: "dealer@example.com", subject: "Test", body: "Hello", bcc: ["admin@louisluso.com", "ken@louisluso.com"] });
    const raw = mockSend.mock.calls[0][0].requestBody.raw;
    const decoded = Buffer.from(raw, "base64url").toString();
    expect(decoded).toContain("Bcc: admin@louisluso.com, ken@louisluso.com");
  });

  it("omits BCC header when not provided", async () => {
    await sendEmail({ to: "dealer@example.com", subject: "Test", body: "Hello" });
    const raw = mockSend.mock.calls[0][0].requestBody.raw;
    const decoded = Buffer.from(raw, "base64url").toString();
    expect(decoded).not.toContain("Bcc:");
  });
});
