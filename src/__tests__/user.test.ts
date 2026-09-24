import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {
  updateFullName,
  updateUsername,
  getUserInfo,
  getOTPStatus,
  setupUserOTP,
  verifyUserOTP,
  deleteUserOTP,
  regenerateBackupCodes,
} from "../auth/user";
import {setupAuthTest, cleanupAuthMocks} from "./utils/auth-test-helpers";

const mockPatchAuthV1UsersCurrentName = vi.fn();
const mockPatchAuthV1UsersCurrentUsername = vi.fn();
const mockGetAuthV1Userinfo = vi.fn();
const mockGetAuthV1UsersCurrentTotpStatus = vi.fn();
const mockPostAuthV1UsersCurrentTotpSetup = vi.fn();
const mockPostAuthV1UsersCurrentTotpVerify = vi.fn();
const mockDeleteAuthV1UsersCurrentTotpDelete = vi.fn();
const mockPostAuthV1UsersCurrentTotpBackupCodesRegenerate = vi.fn();

vi.mock("../generated/sdk.gen", () => ({
  authV1UserServiceUpdateName: (...args: unknown[]) => mockPatchAuthV1UsersCurrentName(...args),
  authV1UserServiceUpdateUsername: (...args: unknown[]) => mockPatchAuthV1UsersCurrentUsername(...args),
  authV1UserServiceGetUserInfo: (...args: unknown[]) => mockGetAuthV1Userinfo(...args),
  authV1OtpServiceGetOtpStatus: (...args: unknown[]) => mockGetAuthV1UsersCurrentTotpStatus(...args),
  authV1OtpServiceSetupOtp: (...args: unknown[]) => mockPostAuthV1UsersCurrentTotpSetup(...args),
  authV1OtpServiceVerifyOtp: (...args: unknown[]) => mockPostAuthV1UsersCurrentTotpVerify(...args),
  authV1OtpServiceDeleteOtp: (...args: unknown[]) => mockDeleteAuthV1UsersCurrentTotpDelete(...args),
  authV1OtpServiceRegenerateBackupCodes: (...args: unknown[]) => mockPostAuthV1UsersCurrentTotpBackupCodesRegenerate(...args),
}));

describe("User Management", () => {
  let mocks: ReturnType<typeof setupAuthTest>;

  beforeEach(() => {
    mocks = setupAuthTest();
    mockPatchAuthV1UsersCurrentName.mockReset();
    mockPatchAuthV1UsersCurrentUsername.mockReset();
    mockGetAuthV1Userinfo.mockReset();
    mockGetAuthV1UsersCurrentTotpStatus.mockReset();
    mockPostAuthV1UsersCurrentTotpSetup.mockReset();
    mockPostAuthV1UsersCurrentTotpVerify.mockReset();
    mockDeleteAuthV1UsersCurrentTotpDelete.mockReset();
    mockPostAuthV1UsersCurrentTotpBackupCodesRegenerate.mockReset();
  });

  afterEach(() => {
    cleanupAuthMocks(mocks);
  });

  describe("updateFullName", () => {
    it("should update name successfully", async () => {
      mockPatchAuthV1UsersCurrentName.mockResolvedValue({
        data: {first_name: "John", last_name: "Doe"},
      });

      await updateFullName("John Doe");

      expect(mockPatchAuthV1UsersCurrentName).toHaveBeenCalledWith({
        body: {full_name: "John Doe"},
        throwOnError: true,
      });
    });

    it("should not attempt token refresh (response has no tokens)", async () => {
      mockPatchAuthV1UsersCurrentName.mockResolvedValue({
        data: {first_name: "Jane", last_name: "Smith"},
      });

      await updateFullName("Jane Smith");

      expect(mocks.setTokensSpy).not.toHaveBeenCalled();
    });

    it("should validate name format", async () => {
      await expect(updateFullName("")).rejects.toThrow();
    });

    it("should throw error for rate limiting", async () => {
      mockPatchAuthV1UsersCurrentName.mockRejectedValue({
        error: "too_many_requests",
        code: 429,
      });

      await expect(updateFullName("Valid Name")).rejects.toThrow();
    });
  });

  describe("updateUsername", () => {
    it("should update username successfully", async () => {
      mockPatchAuthV1UsersCurrentUsername.mockResolvedValue({
        data: {username: "newusername"},
      });

      await updateUsername("newusername");

      expect(mockPatchAuthV1UsersCurrentUsername).toHaveBeenCalledWith({
        body: {username: "newusername"},
        throwOnError: true,
      });
    });

    it("should not attempt token refresh (response has no tokens)", async () => {
      mockPatchAuthV1UsersCurrentUsername.mockResolvedValue({
        data: {username: "another_user"},
      });

      await updateUsername("another_user");

      expect(mocks.setTokensSpy).not.toHaveBeenCalled();
    });

    it("should validate username format", async () => {
      await expect(updateUsername("ab")).rejects.toThrow();
    });

    it("should throw error for conflict", async () => {
      mockPatchAuthV1UsersCurrentUsername.mockRejectedValue({
        error: "conflict",
        code: 409,
      });

      await expect(updateUsername("taken_user")).rejects.toThrow();
    });
  });

  describe("getUserInfo", () => {
    it("should map the snake_case wire response to UserInfo", async () => {
      mockGetAuthV1Userinfo.mockResolvedValue({
        data: {
          id: "user-123",
          username: "janedoe",
          email: "jane@example.com",
          email_verified: true,
          first_name: "Jane",
          last_name: "Doe",
          image_url: "https://example.com/jane.jpg",
          language_code: "en",
          country_code: "NG",
          active_org_id: "org-789",
        },
      });

      const result = await getUserInfo();

      expect(mockGetAuthV1Userinfo).toHaveBeenCalledWith({
        query: undefined,
        throwOnError: true,
      });
      expect(result).toEqual({
        id: "user-123",
        username: "janedoe",
        email: "jane@example.com",
        email_verified: true,
        first_name: "Jane",
        last_name: "Doe",
        image_url: "https://example.com/jane.jpg",
        language_code: "en",
        country_code: "NG",
        active_org_id: "org-789",
        policies: [],
        permissions: [],
      });
    });

    it("should pass userId as a query param when provided", async () => {
      mockGetAuthV1Userinfo.mockResolvedValue({data: {id: "user-456"}});

      const result = await getUserInfo("user-456");

      expect(mockGetAuthV1Userinfo).toHaveBeenCalledWith({
        query: {user_id: "user-456"},
        throwOnError: true,
      });
      expect(result.id).toBe("user-456");
    });

    it("should default missing fields to empty values", async () => {
      mockGetAuthV1Userinfo.mockResolvedValue({data: {id: "user-789"}});

      const result = await getUserInfo();

      expect(result).toEqual({
        id: "user-789",
        username: "",
        email: "",
        email_verified: false,
        first_name: "",
        last_name: "",
        image_url: "",
        language_code: "",
        country_code: "",
        active_org_id: "",
        policies: [],
        permissions: [],
      });
    });

    it("should return the policies and permissions userinfo grants", async () => {
      mockGetAuthV1Userinfo.mockResolvedValue({
        data: {
          id: "user-123",
          policies: [{id: "pol-1", name: "Editors", permissions: ["media:videos:write"]}],
          permissions: ["media:videos:write", "media:videos:read"],
        },
      });

      const result = await getUserInfo();

      expect(result.permissions).toEqual(["media:videos:write", "media:videos:read"]);
      expect(result.policies).toHaveLength(1);
      expect(result.policies[0].name).toBe("Editors");
    });

    it("should throw on unauthorized", async () => {
      mockGetAuthV1Userinfo.mockRejectedValue({error: "unauthorized", code: 401});

      await expect(getUserInfo()).rejects.toThrow();
    });
  });

  describe("getOTPStatus", () => {
    it("should return OTP status", async () => {
      mockGetAuthV1UsersCurrentTotpStatus.mockResolvedValue({
        data: {
          is_setup: true,
          created_at: "2024-01-01",
          backup_codes_remaining: 8,
        },
      });

      const result = await getOTPStatus();

      expect(result).toEqual({
        is_setup: true,
        created_at: "2024-01-01",
        backup_codes_remaining: 8,
      });
      expect(mockGetAuthV1UsersCurrentTotpStatus).toHaveBeenCalledWith({
        throwOnError: true,
      });
    });

    it("should handle disabled OTP status", async () => {
      mockGetAuthV1UsersCurrentTotpStatus.mockResolvedValue({
        data: {
          is_setup: false,
        },
      });

      const result = await getOTPStatus();

      expect(result.is_setup).toBe(false);
    });
  });

  describe("setupUserOTP", () => {
    it("should return QR code, secret and backup codes", async () => {
      mockPostAuthV1UsersCurrentTotpSetup.mockResolvedValue({
        data: {
          qr_code_url: "https://example.com/qr.png",
          secret: "JBSWY3DPEHPK3PXP",
          backup_codes: ["code-1", "code-2"],
        },
      });

      const result = await setupUserOTP();

      expect(result).toEqual({
        qrCodeUrl: "https://example.com/qr.png",
        secret: "JBSWY3DPEHPK3PXP",
        backup_codes: ["code-1", "code-2"],
      });
      expect(mockPostAuthV1UsersCurrentTotpSetup).toHaveBeenCalledWith({
        throwOnError: true,
      });
    });

    it("should default backup codes to an empty array", async () => {
      mockPostAuthV1UsersCurrentTotpSetup.mockResolvedValue({
        data: {
          qr_code_url: "https://example.com/qr.png",
          secret: "JBSWY3DPEHPK3PXP",
        },
      });

      const result = await setupUserOTP();

      expect(result).toEqual({
        qrCodeUrl: "https://example.com/qr.png",
        secret: "JBSWY3DPEHPK3PXP",
        backup_codes: [],
      });
    });
  });

  describe("verifyUserOTP", () => {
    it("should verify OTP and set tokens", async () => {
      mockPostAuthV1UsersCurrentTotpVerify.mockResolvedValue({
        data: {
          access_token: "new-token",
          refresh_token: "new-refresh",
          expires_in: 3600,
        },
      });

      await verifyUserOTP("123456");

      expect(mockPostAuthV1UsersCurrentTotpVerify).toHaveBeenCalledWith({
        body: {code: "123456"},
        throwOnError: true,
      });
      expect(mocks.setTokensSpy).toHaveBeenCalledWith("new-token", "new-refresh", 3600);
    });

    it("should validate OTP code format", async () => {
      await expect(verifyUserOTP("")).rejects.toThrow();
    });

    it("should reject non-numeric codes", async () => {
      await expect(verifyUserOTP("abcdef")).rejects.toThrow();
    });
  });

  describe("deleteUserOTP", () => {
    it("should delete OTP successfully", async () => {
      mockDeleteAuthV1UsersCurrentTotpDelete.mockResolvedValue({
        data: {message: "OTP deleted"},
      });

      await expect(deleteUserOTP()).resolves.toBeUndefined();

      expect(mockDeleteAuthV1UsersCurrentTotpDelete).toHaveBeenCalledWith({
        throwOnError: true,
      });
    });

    it("should throw error for unauthorized", async () => {
      mockDeleteAuthV1UsersCurrentTotpDelete.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(deleteUserOTP()).rejects.toThrow();
    });
  });

  describe("regenerateBackupCodes", () => {
    it("should return backup codes", async () => {
      mockPostAuthV1UsersCurrentTotpBackupCodesRegenerate.mockResolvedValue({
        data: {
          backup_codes: ["backup-1", "backup-2"],
        },
      });

      const result = await regenerateBackupCodes();

      expect(result).toEqual({
        backup_codes: ["backup-1", "backup-2"],
      });
      expect(mockPostAuthV1UsersCurrentTotpBackupCodesRegenerate).toHaveBeenCalledWith({
        throwOnError: true,
      });
    });

    it("should pass user_id when provided", async () => {
      mockPostAuthV1UsersCurrentTotpBackupCodesRegenerate.mockResolvedValue({
        data: {
          backup_codes: ["backup-3"],
        },
      });

      const result = await regenerateBackupCodes("user-123");

      expect(result).toEqual({
        backup_codes: ["backup-3"],
      });
      expect(mockPostAuthV1UsersCurrentTotpBackupCodesRegenerate).toHaveBeenCalledWith({
        query: {user_id: "user-123"},
        throwOnError: true,
      });
    });
  });
});
