import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {MembershipRole} from "@/membership";
import {setupAuthTest, cleanupAuthMocks} from "../utils/auth-test-helpers";

const mockAuthV1MembershipServiceUpdateMember = vi.fn();
const mockAuthV1MembershipServiceRemoveMember = vi.fn();
const mockAuthV1MembershipServiceLeaveOrganization = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1MembershipServiceUpdateMember: (...args: unknown[]) => mockAuthV1MembershipServiceUpdateMember(...args),
  authV1MembershipServiceRemoveMember: (...args: unknown[]) => mockAuthV1MembershipServiceRemoveMember(...args),
  authV1MembershipServiceLeaveOrganization: (...args: unknown[]) => mockAuthV1MembershipServiceLeaveOrganization(...args),
}));

import {updateMemberRole, leaveOrganization} from "@/membership";

describe("Membership Manage Module", () => {
  let mocks: ReturnType<typeof setupAuthTest>;

  beforeEach(() => {
    mocks = setupAuthTest();
    mockAuthV1MembershipServiceUpdateMember.mockReset();
    mockAuthV1MembershipServiceRemoveMember.mockReset();
    mockAuthV1MembershipServiceLeaveOrganization.mockReset();
  });

  afterEach(() => {
    cleanupAuthMocks(mocks);
  });

  describe("updateMemberRole", () => {
    it("should update member role successfully", async () => {
      mockAuthV1MembershipServiceUpdateMember.mockResolvedValue({data: {}});

      await updateMemberRole("org123", "user456", MembershipRole.ADMIN);

      expect(mockAuthV1MembershipServiceUpdateMember).toHaveBeenCalledWith({
        path: {org_id: "org123", user_id: "user456"},
        body: {role: "MEMBERSHIP_ROLE_ADMIN", update_mask: "role"},
        throwOnError: true,
      });
    });

    it("should update to different roles", async () => {
      mockAuthV1MembershipServiceUpdateMember.mockResolvedValue({data: {}});

      await updateMemberRole("org123", "user789", MembershipRole.MEMBER);

      expect(mockAuthV1MembershipServiceUpdateMember).toHaveBeenCalledWith({
        path: {org_id: "org123", user_id: "user789"},
        body: {role: "MEMBERSHIP_ROLE_MEMBER", update_mask: "role"},
        throwOnError: true,
      });
    });

    it("should handle unauthorized error", async () => {
      mockAuthV1MembershipServiceUpdateMember.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(updateMemberRole("org123", "user456", MembershipRole.ADMIN)).rejects.toThrow();
    });

    it("should handle member not found error", async () => {
      mockAuthV1MembershipServiceUpdateMember.mockRejectedValue({
        error: "not_found",
        code: 404,
      });

      await expect(updateMemberRole("org123", "user999", MembershipRole.ADMIN)).rejects.toThrow();
    });

    it("should handle forbidden error for owner", async () => {
      mockAuthV1MembershipServiceUpdateMember.mockRejectedValue({
        error: "forbidden",
        code: 403,
      });

      await expect(updateMemberRole("org123", "owner123", MembershipRole.MEMBER)).rejects.toThrow();
    });
  });

  describe("leaveOrganization", () => {
    it("should leave organization successfully", async () => {
      mockAuthV1MembershipServiceLeaveOrganization.mockResolvedValue({data: {}});

      await leaveOrganization("org123");

      expect(mockAuthV1MembershipServiceLeaveOrganization).toHaveBeenCalledWith({
        path: {org_id: "org123"},
        responseStyle: "fields",
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
