import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {DomainStatus} from "@/domain";
import * as initialization from "../../auth/initialization";

const mockAuthV1DomainServiceGetDomainStatus = vi.fn();
const mockAuthV1DomainServiceCreateDomainVerification = vi.fn();
const mockAuthV1DomainServiceCheckDomainVerification = vi.fn();
const mockAuthV1DomainServiceSetDomainAutoJoin = vi.fn();
const mockAuthV1DomainServiceRemoveDomain = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1DomainServiceGetDomainStatus: (...args: unknown[]) => mockAuthV1DomainServiceGetDomainStatus(...args),
  authV1DomainServiceCreateDomainVerification: (...args: unknown[]) => mockAuthV1DomainServiceCreateDomainVerification(...args),
  authV1DomainServiceCheckDomainVerification: (...args: unknown[]) => mockAuthV1DomainServiceCheckDomainVerification(...args),
  authV1DomainServiceSetDomainAutoJoin: (...args: unknown[]) => mockAuthV1DomainServiceSetDomainAutoJoin(...args),
  authV1DomainServiceRemoveDomain: (...args: unknown[]) => mockAuthV1DomainServiceRemoveDomain(...args),
}));

import {getDomainStatus, initiateDomainVerification, checkDomainVerification, updateAutoJoin, removeDomain} from "@/domain";

describe("Domain Management Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initialization.initDeferred.promise = Promise.resolve();
    mockAuthV1DomainServiceGetDomainStatus.mockReset();
    mockAuthV1DomainServiceCreateDomainVerification.mockReset();
    mockAuthV1DomainServiceCheckDomainVerification.mockReset();
    mockAuthV1DomainServiceSetDomainAutoJoin.mockReset();
    mockAuthV1DomainServiceRemoveDomain.mockReset();
  });

  describe("getDomainStatus", () => {
    it("should get domain status successfully", async () => {
      // The gateway nests pending/verified under status with a shared auto_join flag
      const wireResponse = {
        present: true,
        id: "domain123",
        domain: "company.com",
        status: {
          auto_join: true,
          verified: {verified_at: "2026-01-20T00:00:00Z"},
        },
      };
      mockAuthV1DomainServiceGetDomainStatus.mockResolvedValue({data: wireResponse});

      const result = await getDomainStatus("org123");

      expect(mockAuthV1DomainServiceGetDomainStatus).toHaveBeenCalledWith({
        path: {org_id: "org123"},
        throwOnError: true,
      });
      expect(result).toEqual({
        present: true,
        id: "domain123",
        domain: "company.com",
        status: DomainStatus.VERIFIED,
        verified_at: "2026-01-20T00:00:00Z",
        auto_join: true,
      });
    });

    it("should return null when no domain is found (404)", async () => {
      mockAuthV1DomainServiceGetDomainStatus.mockRejectedValue({
        error: "not_found",
        code: 404,
      });

      const result = await getDomainStatus("org123");

      expect(result).toBeNull();
    });

    it("should return pending domain with verification token", async () => {
      const wireResponse = {
        present: true,
        id: "domain123",
        domain: "company.com",
        status: {
          auto_join: false,
          pending: {
            verification_token: "rixl-domain-verification=abc123",
            expires_at: "2026-01-30T00:00:00Z",
          },
        },
      };
      mockAuthV1DomainServiceGetDomainStatus.mockResolvedValue({data: wireResponse});

      const result = await getDomainStatus("org123");

      expect(result).toEqual({
        present: true,
        id: "domain123",
        domain: "company.com",
        status: DomainStatus.PENDING,
        verification_token: "rixl-domain-verification=abc123",
        expires_at: "2026-01-30T00:00:00Z",
        auto_join: false,
      });
      expect(result?.verification_token).toBe("rixl-domain-verification=abc123");
    });

    it("should handle unauthorized error", async () => {
      mockAuthV1DomainServiceGetDomainStatus.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(getDomainStatus("org123")).rejects.toThrow();
    });
  });

  describe("initiateDomainVerification", () => {
    it("should initiate domain verification successfully", async () => {
      const wireResponse = {
        present: true,
        id: "domain123",
        domain: "company.com",
        status: {
          auto_join: false,
          pending: {
            verification_token: "rixl-domain-verification=abc123",
            expires_at: "2026-01-30T00:00:00Z",
          },
        },
      };
      mockAuthV1DomainServiceCreateDomainVerification.mockResolvedValue({data: wireResponse});

      const result = await initiateDomainVerification("org123", "company.com");

      expect(mockAuthV1DomainServiceCreateDomainVerification).toHaveBeenCalledWith({
        path: {"user.org_id": "org123"},
        body: {domain: "company.com"},
        throwOnError: true,
      });
      expect(result).toEqual({
        present: true,
        id: "domain123",
        domain: "company.com",
        status: DomainStatus.PENDING,
        verification_token: "rixl-domain-verification=abc123",
        expires_at: "2026-01-30T00:00:00Z",
        auto_join: false,
      });
    });

    it("should handle validation error for invalid domain format", async () => {
      await expect(initiateDomainVerification("org123", "invalid")).rejects.toThrow("Invalid domain format");
    });

    it("should handle bad request error for public domain", async () => {
      mockAuthV1DomainServiceCreateDomainVerification.mockRejectedValue({
        error: "bad_request",
        code: 400,
      });

      await expect(initiateDomainVerification("org123", "gmail.com")).rejects.toThrow();
    });

    it("should handle forbidden error for non-enterprise plan", async () => {
      mockAuthV1DomainServiceCreateDomainVerification.mockRejectedValue({
        error: "forbidden",
        code: 403,
      });

      await expect(initiateDomainVerification("org123", "company.com")).rejects.toThrow();
    });

    it("should handle conflict error for already claimed domain", async () => {
      mockAuthV1DomainServiceCreateDomainVerification.mockRejectedValue({
        error: "conflict",
        code: 409,
      });

      await expect(initiateDomainVerification("org123", "claimed.com")).rejects.toThrow();
    });

    it("should handle unauthorized error", async () => {
      mockAuthV1DomainServiceCreateDomainVerification.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(initiateDomainVerification("org123", "company.com")).rejects.toThrow();
    });
  });

  describe("checkDomainVerification", () => {
    it("should check domain verification successfully and return verified status", async () => {
      const wireResponse = {
        present: true,
        id: "domain123",
        domain: "company.com",
        status: {
          auto_join: false,
          verified: {verified_at: "2026-01-20T00:00:00Z"},
        },
      };
      mockAuthV1DomainServiceCheckDomainVerification.mockResolvedValue({
        data: wireResponse,
      });

      const result = await checkDomainVerification("org123");

      expect(mockAuthV1DomainServiceCheckDomainVerification).toHaveBeenCalledWith({
        path: {org_id: "org123"},
        throwOnError: true,
      });
      expect(result).toEqual({
        present: true,
        id: "domain123",
        domain: "company.com",
        status: DomainStatus.VERIFIED,
        verified_at: "2026-01-20T00:00:00Z",
        auto_join: false,
      });
      expect(result.status).toBe(DomainStatus.VERIFIED);
    });

    it("should return pending status when DNS check fails", async () => {
      const wireResponse = {
        present: true,
        id: "domain123",
        domain: "company.com",
        status: {
          pending: {
            verification_token: "rixl-domain-verification=abc123",
            expires_at: "2026-01-30T00:00:00Z",
          },
        },
      };
      mockAuthV1DomainServiceCheckDomainVerification.mockResolvedValue({
        data: wireResponse,
      });

      const result = await checkDomainVerification("org123");

      expect(result.status).toBe(DomainStatus.PENDING);
    });

    it("should handle bad request error for DNS lookup failure", async () => {
      mockAuthV1DomainServiceCheckDomainVerification.mockRejectedValue({
        error: "bad_request",
        code: 400,
      });

      await expect(checkDomainVerification("org123")).rejects.toThrow();
    });

    it("should handle not found error when no pending request exists", async () => {
      mockAuthV1DomainServiceCheckDomainVerification.mockRejectedValue({
        error: "not_found",
        code: 404,
      });

      await expect(checkDomainVerification("org123")).rejects.toThrow();
    });

    it("should handle unauthorized error", async () => {
      mockAuthV1DomainServiceCheckDomainVerification.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(checkDomainVerification("org123")).rejects.toThrow();
    });

    it("should handle forbidden error", async () => {
      mockAuthV1DomainServiceCheckDomainVerification.mockRejectedValue({
        error: "forbidden",
        code: 403,
      });

      await expect(checkDomainVerification("org123")).rejects.toThrow();
    });
  });

  describe("updateAutoJoin", () => {
    it("should enable auto-join successfully", async () => {
      const mockResponse = {enabled: true};
      mockAuthV1DomainServiceSetDomainAutoJoin.mockResolvedValue({data: mockResponse});

      const result = await updateAutoJoin("org123", true);

      expect(mockAuthV1DomainServiceSetDomainAutoJoin).toHaveBeenCalledWith({
        path: {"user.org_id": "org123"},
        body: {enabled: true},
        throwOnError: true,
      });
      expect(result).toEqual(mockResponse);
    });

    it("should disable auto-join successfully", async () => {
      const mockResponse = {enabled: false};
      mockAuthV1DomainServiceSetDomainAutoJoin.mockResolvedValue({data: mockResponse});

      const result = await updateAutoJoin("org123", false);

      expect(mockAuthV1DomainServiceSetDomainAutoJoin).toHaveBeenCalledWith({
        path: {"user.org_id": "org123"},
        body: {enabled: false},
        throwOnError: true,
      });
      expect(result).toEqual(mockResponse);
    });

    it("should handle forbidden error for non-enterprise plan", async () => {
      mockAuthV1DomainServiceSetDomainAutoJoin.mockRejectedValue({
        error: "forbidden",
        code: 403,
      });

      await expect(updateAutoJoin("org123", true)).rejects.toThrow();
    });

    it("should handle not found error when no verified domain exists", async () => {
      mockAuthV1DomainServiceSetDomainAutoJoin.mockRejectedValue({
        error: "not_found",
        code: 404,
      });

      await expect(updateAutoJoin("org123", true)).rejects.toThrow();
    });

    it("should handle unauthorized error", async () => {
      mockAuthV1DomainServiceSetDomainAutoJoin.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(updateAutoJoin("org123", true)).rejects.toThrow();
    });
  });

  describe("removeDomain", () => {
    it("should remove domain successfully", async () => {
      mockAuthV1DomainServiceRemoveDomain.mockResolvedValue({data: {}});

      await removeDomain("org123");

      expect(mockAuthV1DomainServiceRemoveDomain).toHaveBeenCalledWith({
        path: {org_id: "org123"},
        throwOnError: true,
      });
    });

    it("should handle not found error when no verified domain exists", async () => {
      mockAuthV1DomainServiceRemoveDomain.mockRejectedValue({
        error: "not_found",
        code: 404,
      });

      await expect(removeDomain("org123")).rejects.toThrow();
    });

    it("should handle unauthorized error", async () => {
      mockAuthV1DomainServiceRemoveDomain.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(removeDomain("org123")).rejects.toThrow();
    });

    it("should work with different organization IDs", async () => {
      mockAuthV1DomainServiceRemoveDomain.mockResolvedValue({data: {}});

      await removeDomain("org456");

      expect(mockAuthV1DomainServiceRemoveDomain).toHaveBeenCalledWith({
        path: {org_id: "org456"},
        throwOnError: true,
      });
    });
  });
});
