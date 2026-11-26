import {describe, it, expect} from "vite-plus/test";
import {validateInput, EmailSchema, PasswordSchema, NameSchema, DomainSchema} from "../../auth/validation/base";

describe("Base Validation Schemas", () => {
  describe("validateInput", () => {
    it("should validate and return valid data", () => {
      const result = validateInput(EmailSchema, "test@example.com");
      expect(result).toBe("test@example.com");
    });

    it("should throw error for invalid data", () => {
      expect(() => validateInput(EmailSchema, "invalid-email")).toThrow();
    });

    it("should throw user-friendly error message", () => {
      expect(() => validateInput(EmailSchema, "bad")).toThrow("Please enter a valid email address");
    });
  });

  describe("EmailSchema", () => {
    it("should accept valid email addresses", () => {
      expect(validateInput(EmailSchema, "user@example.com")).toBe("user@example.com");
      expect(validateInput(EmailSchema, "test.user@domain.co.uk")).toBe("test.user@domain.co.uk");
      expect(validateInput(EmailSchema, "name+tag@email.com")).toBe("name+tag@email.com");
    });

    it("should reject invalid email formats", () => {
      expect(() => validateInput(EmailSchema, "notanemail")).toThrow();
      expect(() => validateInput(EmailSchema, "@example.com")).toThrow();
      expect(() => validateInput(EmailSchema, "user@")).toThrow();
    });

    it("should reject empty email", () => {
      expect(() => validateInput(EmailSchema, "")).toThrow();
    });
  });

  describe("PasswordSchema", () => {
    it("should accept valid passwords", () => {
      expect(validateInput(PasswordSchema, "Password123")).toBe("Password123");
    });

    it("should reject passwords shorter than 8 characters", () => {
      expect(() => validateInput(PasswordSchema, "Pass1")).toThrow("Password must be at least 8 characters long");
    });

    it("should reject passwords without uppercase letter", () => {
      expect(() => validateInput(PasswordSchema, "password123")).toThrow("Password must contain at least one uppercase letter");
    });
  });

  describe("NameSchema", () => {
    it("should accept valid names", () => {
      expect(validateInput(NameSchema, "John")).toBe("John");
    });

    it("should reject empty names", () => {
      expect(() => validateInput(NameSchema, "")).toThrow("Name must be 1-30 characters long");
    });
  });

  describe("DomainSchema", () => {
    it("should accept valid domains", () => {
      expect(validateInput(DomainSchema, "example.com")).toBe("example.com");
      expect(validateInput(DomainSchema, "sub.domain.org")).toBe("sub.domain.org");
    });

    it("should reject invalid domains", () => {
      expect(() => validateInput(DomainSchema, "not-a-domain")).toThrow();
      expect(() => validateInput(DomainSchema, "domain..com")).toThrow();
    });
  });
});
