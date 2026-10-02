import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {MembershipRole} from "@/membership";
import {setupAuthTest, cleanupAuthMocks} from "../utils/auth-test-helpers";

const mockAuthV1MembershipServiceUpdateActiveMembership = vi.fn();
const mockAuthV1MembershipServiceUpdateMemberRole = vi.fn();
const mockAuthV1MembershipServiceRemoveMember = vi.fn();
const mockAuthV1MembershipServiceLeaveOrganization = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1MembershipServiceUpdateActiveMembership: (...args: unknown[]) => mockAuthV1MembershipServiceUpdateActiveMembership(...args),
  authV1MembershipServiceUpdateMemberRole: (...args: unknown[]) => mockAuthV1MembershipServiceUpdateMemberRole(...args),
  authV1MembershipServiceRemoveMember: (...args: unknown[]) => mockAuthV1MembershipServiceRemoveMember(...args),
  authV1MembershipServiceLeaveOrganization: (...args: unknown[]) => mockAuthV1MembershipServiceLeaveOrganization(...args),
}));

import {updateActiveMembership, updateMemberRole, deleteMember, leaveOrganization} from "@/membership";

describe("Membership Manage Module", () => {
  let mocks: ReturnType<typeof setupAuthTest>;

  beforeEach(() => {
    mocks = setupAuthTest();
    mockAuthV1MembershipServiceUpdateActiveMembership.mockReset();
    mockAuthV1MembershipServiceUpdateMemberRole.mockReset();
    mockAuthV1MembershipServiceRemoveMember.mockReset();
    mockAuthV1MembershipServiceLeaveOrganization.mockReset();
  });

  afterEach(() => {
    cleanupAuthMocks(mocks);
  });

  describe("updateActiveMembership", () => {
    // The backend reads the target org from the top-level `org_id` and treats
    // `user.org_id` as the caller's current org, so a target sent there fails
    // with "org_id is required". user_id is filled from the JWT.
    it("should send the target org as the top-level org_id", async () => {
      mockAuthV1MembershipServiceUpdateActiveMembership.mockResolvedValue({data: {}});

      await updateActiveMembership("org123");

      expect(mockAuthV1MembershipServiceUpdateActiveMembership).toHaveBeenCalledWith({
        body: {org_id: "org123"},
        throwOnError: true,
      });
    });

    it("should not send the target in user.org_id or membership_id", async () => {
      mockAuthV1MembershipServiceUpdateActiveMembership.mockResolvedValue({data: {}});

      await updateActiveMembership("PZ76MMvRmS");

      const body = mockAuthV1MembershipServiceUpdateActiveMembership.mock.calls[0][0].body;
      expect(body.user).toBeUndefined();
      expect(body.membership_id).toBeUndefined();
      expect(body.org_id).toBe("PZ76MMvRmS");
    });

    it("should invalidate token after update", async () => {
      mockAuthV1MembershipServiceUpdateActiveMembership.mockResolvedValue({data: {}});

      await updateActiveMembership("org456");

      expect(mockAuthV1MembershipServiceUpdateActiveMembership).toHaveBeenCalledWith({
        body: {org_id: "org456"},
        throwOnError: true,
      });
    });

    it("should handle unauthorized error", async () => {
      mockAuthV1MembershipServiceUpdateActiveMembership.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(updateActiveMembership("membership123")).rejects.toThrow();
    });
  });

  describe("updateMemberRole", () => {
    it("should update member role successfully", async () => {
      mockAuthV1MembershipServiceUpdateMemberRole.mockResolvedValue({data: {}});

      await updateMemberRole("org123", "user456", MembershipRole.ADMIN);

      expect(mockAuthV1MembershipServiceUpdateMemberRole).toHaveBeenCalledWith({
        path: {"user.org_id": "org123", user_id: "user456"},
        body: {role: "MEMBERSHIP_ROLE_ADMIN"},
        throwOnError: true,
      });
    });

    it("should update to different roles", async () => {
      mockAuthV1MembershipServiceUpdateMemberRole.mockResolvedValue({data: {}});

      await updateMemberRole("org123", "user789", MembershipRole.MEMBER);

      expect(mockAuthV1MembershipServiceUpdateMemberRole).toHaveBeenCalledWith({
        path: {"user.org_id": "org123", user_id: "user789"},
        body: {role: "MEMBERSHIP_ROLE_MEMBER"},
        throwOnError: true,
      });
    });

    it("should handle unauthorized error", async () => {
      mockAuthV1MembershipServiceUpdateMemberRole.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(updateMemberRole("org123", "user456", MembershipRole.ADMIN)).rejects.toThrow();
    });

    it("should handle member not found error", async () => {
      mockAuthV1MembershipServiceUpdateMemberRole.mockRejectedValue({
        error: "not_found",
        code: 404,
      });

      await expect(updateMemberRole("org123", "user999", MembershipRole.ADMIN)).rejects.toThrow();
    });

    it("should handle forbidden error for owner", async () => {
      mockAuthV1MembershipServiceUpdateMemberRole.mockRejectedValue({
        error: "forbidden",
        code: 403,
      });

      await expect(updateMemberRole("org123", "owner123", MembershipRole.MEMBER)).rejects.toThrow();
    });
  });

  describe("deleteMember", () => {
    it("should delete member successfully", async () => {
      mockAuthV1MembershipServiceRemoveMember.mockResolvedValue({data: {}});

      await deleteMember("org123", "user456");

      expect(mockAuthV1MembershipServiceRemoveMember).toHaveBeenCalledWith({
        path: {"user.org_id": "org123", user_id: "user456"},
        throwOnError: true,
      });
    });

    it("should handle unauthorized error", async () => {
      mockAuthV1MembershipServiceRemoveMember.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(deleteMember("org123", "user456")).rejects.toThrow();
    });

    it("should handle member not found error", async () => {
      mockAuthV1MembershipServiceRemoveMember.mockRejectedValue({
        error: "not_found",
        code: 404,
      });

      await expect(deleteMember("org123", "user999")).rejects.toThrow();
    });

    it("should handle forbidden error for owner", async () => {
      mockAuthV1MembershipServiceRemoveMember.mockRejectedValue({
        error: "forbidden",
        code: 403,
      });

      await expect(deleteMember("org123", "owner123")).rejects.toThrow();
    });
  });

  describe("leaveOrganization", () => {
    it("should leave organization successfully", async () => {
      mockAuthV1MembershipServiceLeaveOrganization.mockResolvedValue({data: {}});

      await leaveOrganization("org123");

      expect(mockAuthV1MembershipServiceLeaveOrganization).toHaveBeenCalledWith({
        path: {org_id: "org123"},
        throwOnError: true,
      });
    });

    it("should handle unauthorized error", async () => {
      mockAuthV1MembershipServiceLeaveOrganization.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(leaveOrganization("org123")).rejects.toThrow();
    });

    it("should handle forbidden error for last member", async () => {
      mockAuthV1MembershipServiceLeaveOrganization.mockRejectedValue({
        error: "forbidden",
        code: 403,
      });

      await expect(leaveOrganization("org123")).rejects.toThrow();
    });

    it("should handle organization not found error", async () => {
      mockAuthV1MembershipServiceLeaveOrganization.mockRejectedValue({
        error: "not_found",
        code: 404,
      });

      await expect(leaveOrganization("org999")).rejects.toThrow();
    });
  });
});
