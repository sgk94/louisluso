import { describe, it, expect } from "vitest";
import { contactSchema } from "@/lib/schemas/contact";

describe("contactSchema", () => {
  it("validates a complete contact form", () => {
    const result = contactSchema.safeParse({
      name: "John Doe", email: "john@example.com", phone: "555-1234",
      subject: "General Inquiry", message: "Hello, I have a question.",
    });
    expect(result.success).toBe(true);
  });

  it("allows phone to be empty", () => {
    const result = contactSchema.safeParse({
      name: "John Doe", email: "john@example.com", phone: "",
      subject: "General Inquiry", message: "Hello",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = contactSchema.safeParse({
      name: "", email: "john@example.com", subject: "General Inquiry", message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = contactSchema.safeParse({
      name: "John", email: "not-an-email", subject: "General Inquiry", message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid subject", () => {
    const result = contactSchema.safeParse({
      name: "John", email: "john@example.com", subject: "Invalid Subject", message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty message", () => {
    const result = contactSchema.safeParse({
      name: "John", email: "john@example.com", subject: "General Inquiry", message: "",
    });
    expect(result.success).toBe(false);
  });
});
