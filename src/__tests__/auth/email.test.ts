import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {initiateEmailChange, verifyEmailWithCode, getEmailVerificationStatus, addEmail} from "@/auth/email";
import {setupAuthTest, cleanupAuthMocks} from "../utils/auth-test-helpers";
import {createMockJWT} from "../utils/test-helpers";

const mockPutAuthV1UsersCurrentEmailsChange = vi.fn();
const mockPostAuthV1UsersCurrentEmails = vi.fn();
const mockPostAuthV1EmailVerify = vi.fn();
const mockGetAuthV1UsersCurrentEmailsStatus = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1EmailServiceInitiateEmailChange: (...args: unknown[]) => mockPutAuthV1UsersCurrentEmailsChange(...args),
  authV1EmailServiceAddEmail: (...args: unknown[]) => mockPostAuthV1UsersCurrentEmails(...args),
  authV1EmailServiceVerifyEmail: (...args: unknown[]) => mockPostAuthV1EmailVerify(...args),
  authV1EmailServiceGetUserEmailStatus: (...args: unknown[]) => mockGetAuthV1UsersCurrentEmailsStatus(...args),
}));

describe("Email Functions", () => {
  let mocks: ReturnType<typeof setupAuthTest>;

  beforeEach(() => {
    mocks = setupAuthTest();
    mockPutAuthV1UsersCurrentEmailsChange.mockReset();
    mockPostAuthV1UsersCurrentEmails.mockReset();
    mockPostAuthV1EmailVerify.mockReset();
    mockGetAuthV1UsersCurrentEmailsStatus.mockReset();
  });

  afterEach(() => {
    cleanupAuthMocks(mocks);
  });

  describe("initiateEmailChange", () => {
    it("should initiate email change successfully", async () => {
      mockPutAuthV1UsersCurrentEmailsChange.mockResolvedValue({
        data: {
          verification_id: "verify-789",
          message: "Email change initiated",
        },
      });

      const result = await initiateEmailChange("newemail@example.com");

      expect(mockPutAuthV1UsersCurrentEmailsChange).toHaveBeenCalledWith({
        body: {new_email: "newemail@example.com"},
        throwOnError: true,
      });
      expect(result).toEqual({
        verification_id: "verify-789",
        message: "Email change initiated",
      });
    });

    it("should throw error when email already in use", async () => {
      mockPutAuthV1UsersCurrentEmailsChange.mockRejectedValue({
        error: "bad_request",
        code: 400,
      });

      await expect(initiateEmailChange("existing@example.com")).rejects.toThrow();
    });

    it("should throw error for unauthorized user", async () => {
      mockPutAuthV1UsersCurrentEmailsChange.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(initiateEmailChange("test@example.com")).rejects.toThrow();
    });

    it("should validate email format", async () => {
      await expect(initiateEmailChange("invalid-email")).rejects.toThrow();
    });
  });

  describe("verifyEmailWithCode", () => {
    it("should verify email with code successfully", async () => {
      mockPostAuthV1EmailVerify.mockResolvedValue({
        data: {
          email: "test@example.com",
          message: "Email verified",
          verified: true,
        },
      });

      const result = await verifyEmailWithCode("123456", "email_change", "verify-123", "test@example.com");

      expect(mockPostAuthV1EmailVerify).toHaveBeenCalledWith({
        body: {code: "123456", verification_id: "verify-123"},
        throwOnError: true,
      });
      expect(result).toEqual({
        email: "test@example.com",
        message: "Email verified",
        verified: true,
        tokens: undefined,
      });
    });

    it("should set tokens when returned in response", async () => {
      const mockToken = createMockJWT();
      mockPostAuthV1EmailVerify.mockResolvedValue({
        data: {
          email: "test@example.com",
          message: "Email verified",
          verified: true,
          tokens: {
            access_token: mockToken,
            refresh_token: "refresh-123",
            expires_in: 3600,
          },
        },
      });

      await verifyEmailWithCode("123456", "verification", "verify-123", "test@example.com");

      expect(mocks.setTokensSpy).toHaveBeenCalledWith(mockToken, "refresh-123", 3600);
    });

    it("should not set tokens when not returned in response", async () => {
      mockPostAuthV1EmailVerify.mockResolvedValue({
        data: {
          email: "test@example.com",
          message: "Email verified",
          verified: true,
        },
      });

      await verifyEmailWithCode("123456", "email_change", "verify-123", "test@example.com");

      expect(mocks.setTokensSpy).not.toHaveBeenCalled();
    });

    it("should throw error for invalid code", async () => {
      mockPostAuthV1EmailVerify.mockRejectedValue({
        error: "bad_request",
        code: 400,
      });

      await expect(verifyEmailWithCode("000000", "email_change", "verify-123", "test@example.com")).rejects.toThrow();
    });

    it("should accept object params format", async () => {
      mockPostAuthV1EmailVerify.mockResolvedValue({
        data: {
          email: "test@example.com",
          message: "Email verified",
          verified: true,
        },
      });

      await verifyEmailWithCode({
        code: "123456",
        type: "email_change",
        verification_id: "verify-123",
        new_email: "test@example.com",
      });

      expect(mockPostAuthV1EmailVerify).toHaveBeenCalledWith({
        body: {code: "123456", verification_id: "verify-123"},
        throwOnError: true,
      });
    });
  });

  describe("addEmail", () => {
    it("should add email successfully", async () => {
      mockPostAuthV1UsersCurrentEmails.mockResolvedValue({
        data: {
          verification_id: "verify-123",
          message: "Verification email sent",
        },
      });

      const result = await addEmail("newemail@example.com");

      expect(mockPostAuthV1UsersCurrentEmails).toHaveBeenCalledWith({
        body: {email: "newemail@example.com"},
        throwOnError: true,
      });
      expect(result).toEqual({
        verification_id: "verify-123",
        message: "Verification email sent",
      });
    });

    it("should throw error for invalid email format", async () => {
      await expect(addEmail("invalid-email")).rejects.toThrow();
    });

    it("should throw error for bad request from API", async () => {
      mockPostAuthV1UsersCurrentEmails.mockRejectedValue({
        error: "bad_request",
        code: 400,
      });

      await expect(addEmail("test@example.com")).rejects.toThrow();
    });

    it("should throw error when email already in use", async () => {
      mockPostAuthV1UsersCurrentEmails.mockRejectedValue({
        error: "conflict",
        code: 409,
      });

      await expect(addEmail("existing@example.com")).rejects.toThrow();
    });

    it("should throw error for rate limit exceeded", async () => {
      mockPostAuthV1UsersCurrentEmails.mockRejectedValue({
        error: "too_many_requests",
        code: 429,
      });

      await expect(addEmail("test@example.com")).rejects.toThrow();
    });
  });

  describe("getEmailVerificationStatus", () => {
    it("should get email verification status successfully", async () => {
      mockGetAuthV1UsersCurrentEmailsStatus.mockResolvedValue({
        data: {
          verified: true,
          email: "test@example.com",
          has_email: true,
        },
      });

      const result = await getEmailVerificationStatus();

      expect(mockGetAuthV1UsersCurrentEmailsStatus).toHaveBeenCalledWith({
        throwOnError: true,
      });
      expect(result).toEqual({verified: true, email: "test@example.com", has_email: true});
    });

    it("should throw error for unauthorized user", async () => {
      mockGetAuthV1UsersCurrentEmailsStatus.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(getEmailVerificationStatus()).rejects.toThrow();
    });
  });
});
