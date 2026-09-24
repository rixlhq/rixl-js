import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {sendPasswordResetEmail, confirmPasswordReset} from "@/auth/password";
import {setupAuthTest, cleanupAuthMocks} from "../utils/auth-test-helpers";

const mockPostAuthV1PasswordReset = vi.fn();
const mockPostAuthV1PasswordResetConfirm = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1EmailServiceSendPasswordReset: (...args: unknown[]) => mockPostAuthV1PasswordReset(...args),
  authV1EmailServiceResetPassword: (...args: unknown[]) => mockPostAuthV1PasswordResetConfirm(...args),
}));

describe("Password Functions", () => {
  let mocks: ReturnType<typeof setupAuthTest>;

  beforeEach(() => {
    mocks = setupAuthTest();
    mockPostAuthV1PasswordReset.mockReset();
    mockPostAuthV1PasswordResetConfirm.mockReset();
  });

  afterEach(() => {
    cleanupAuthMocks(mocks);
  });

  describe("sendPasswordResetEmail", () => {
    it("should send password reset email", async () => {
      mockPostAuthV1PasswordReset.mockResolvedValue({
        data: {message: "Reset email sent"},
      });

      await sendPasswordResetEmail("test@example.com");

      expect(mockPostAuthV1PasswordReset).toHaveBeenCalledWith({
        body: {email: "test@example.com"},
        throwOnError: true,
      });
    });

    it("should throw error for invalid email format", async () => {
      await expect(sendPasswordResetEmail("invalid-email")).rejects.toThrow();
    });

    it("should throw error for bad request", async () => {
      mockPostAuthV1PasswordReset.mockRejectedValue({
        error: "bad_request",
        code: 400,
      });

      await expect(sendPasswordResetEmail("test@example.com")).rejects.toThrow();
    });
  });

  describe("confirmPasswordReset", () => {
    it("should confirm password reset successfully", async () => {
      mockPostAuthV1PasswordResetConfirm.mockResolvedValue({
        data: {message: "Password reset"},
      });

      await confirmPasswordReset("reset-token-123", "NewPassword123");

      expect(mockPostAuthV1PasswordResetConfirm).toHaveBeenCalledWith({
        body: {token: "reset-token-123", new_password: "NewPassword123"},
        throwOnError: true,
      });
    });

    it("should throw error for invalid token or password", async () => {
      mockPostAuthV1PasswordResetConfirm.mockRejectedValue({
        error: "bad_request",
        code: 400,
      });

      await expect(confirmPasswordReset("invalid-token", "NewPass123")).rejects.toThrow();
    });

    it("should validate password requirements", async () => {
      await expect(confirmPasswordReset("token", "short")).rejects.toThrow();
    });
  });
});
