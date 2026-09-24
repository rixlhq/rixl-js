import {describe, it, expect} from "vite-plus/test";
import {validateInput} from "../../auth/validation/base";
import {
  EmailAuthRequestSchema,
  ResetPasswordRequestSchema,
  LoginOTPVerifyRequestSchema,
  verifyEmailChangeRequestSchema,
  ConnectProviderSchema,
  VerifyOTPCodeSchema,
} from "../../auth/validation/auth";

describe("Auth Validation Schemas", () => {
  describe("EmailAuthRequestSchema", () => {
    it("should validate valid email and password", () => {
      const data = {email: "user@test.com", password: "SecurePass1"};
      const result = validateInput(EmailAuthRequestSchema, data);
      expect(result).toEqual(data);
    });

    it("should reject invalid email", () => {
      expect(() => validateInput(EmailAuthRequestSchema, {email: "bad-email", password: "SecurePass1"})).toThrow();
    });
  });

  describe("ResetPasswordRequestSchema", () => {
    it("should validate valid token and password", () => {
      const data = {token: "reset-token-123", new_password: "NewPassword1"};
      const result = validateInput(ResetPasswordRequestSchema, data);
      expect(result).toEqual(data);
    });
  });

  describe("LoginOTPVerifyRequestSchema", () => {
    it("should validate valid OTP code and session ID", () => {
      const data = {code: "123456", session_id: "session-abc-123"};
      const result = validateInput(LoginOTPVerifyRequestSchema, data);
      expect(result).toEqual(data);
    });
  });

  describe("ConnectProviderSchema", () => {
    it("should validate provider connection", () => {
      const data = {provider: "google", token: "google-oauth-token"};
      const result = validateInput(ConnectProviderSchema, data);
      expect(result).toEqual(data);
    });
  });

  describe("VerifyOTPCodeSchema", () => {
    it("should validate valid OTP codes", () => {
      expect(validateInput(VerifyOTPCodeSchema, {code: "123456"})).toEqual({code: "123456"});
    });
  });

  describe("verifyEmailChangeRequestSchema", () => {
    it("should validate email verification request", () => {
      const data = {
        code: "123456",
        type: "verification" as const,
        verification_id: "verify-123",
      };
      const result = validateInput(verifyEmailChangeRequestSchema, data);
      expect(result.code).toBe("123456");
    });
  });
});
