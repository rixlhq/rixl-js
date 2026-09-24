import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {MembershipRole, MembershipState} from "@/membership";
import * as initialization from "../../auth/initialization";

const mockInviteMember = vi.fn();
const mockResendInvitation = vi.fn();
const mockAcceptInvitation = vi.fn();
const mockDeclineInvitation = vi.fn();
const mockUpdateMembershipState = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1MembershipServiceInviteMember: (...args: unknown[]) => mockInviteMember(...args),
  authV1MembershipServiceResendInvitation: (...args: unknown[]) => mockResendInvitation(...args),
  authV1MembershipServiceAcceptInvitation: (...args: unknown[]) => mockAcceptInvitation(...args),
  authV1MembershipServiceDeclineInvitation: (...args: unknown[]) => mockDeclineInvitation(...args),
  authV1MembershipServiceUpdateMembershipState: (...args: unknown[]) => mockUpdateMembershipState(...args),
}));

vi.mock("../../auth/authStore", () => ({
  getToken: vi.fn().mockResolvedValue("mock-token"),
}));

import {inviteMember, resendMemberInvite, respondToInvitation, publicRespondToInvitation} from "@/membership";

describe("Membership Invite Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initialization.initDeferred.promise = Promise.resolve();
    mockInviteMember.mockReset();
    mockResendInvitation.mockReset();
    mockAcceptInvitation.mockReset();
    mockDeclineInvitation.mockReset();
    mockUpdateMembershipState.mockReset();
  });

  describe("inviteMember", () => {
    it("should invite a member successfully", async () => {
      mockInviteMember.mockResolvedValue({data: {}});

      await inviteMember("org123", "newuser", MembershipRole.MEMBER);

      expect(mockInviteMember).toHaveBeenCalledWith({
        path: {"user.org_id": "org123"},
        body: {username: "newuser", role: "MEMBERSHIP_ROLE_MEMBER"},
        throwOnError: true,
      });
    });

    it("should handle unauthorized error", async () => {
      mockInviteMember.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(inviteMember("org123", "newuser", MembershipRole.MEMBER)).rejects.toThrow();
    });

    it("should handle user not found error", async () => {
      mockInviteMember.mockRejectedValue({
        error: "not_found",
        code: 404,
      });

      await expect(inviteMember("org123", "nonexistent", MembershipRole.MEMBER)).rejects.toThrow();
    });

    it("should handle user already exists error", async () => {
      mockInviteMember.mockRejectedValue({
        error: "conflict",
        code: 409,
      });

      await expect(inviteMember("org123", "existinguser", MembershipRole.MEMBER)).rejects.toThrow();
    });

    it("should work with different roles", async () => {
      mockInviteMember.mockResolvedValue({data: {}});

      await inviteMember("org123", "admin", MembershipRole.ADMIN);

      expect(mockInviteMember).toHaveBeenCalledWith({
        path: {"user.org_id": "org123"},
        body: {username: "admin", role: "MEMBERSHIP_ROLE_ADMIN"},
        throwOnError: true,
      });
    });
  });

  describe("resendMemberInvite", () => {
    it("should resend invite successfully", async () => {
      mockResendInvitation.mockResolvedValue({data: {}});

      await resendMemberInvite("org123", "user456");

      expect(mockResendInvitation).toHaveBeenCalledWith({
        path: {"user.org_id": "org123"},
        body: {user_id: "user456"},
        throwOnError: true,
      });
    });

    it("should handle unauthorized error", async () => {
      mockResendInvitation.mockRejectedValue({
        error: "unauthorized",
        code: 401,
      });

      await expect(resendMemberInvite("org123", "user456")).rejects.toThrow();
    });

    it("should handle user not found error", async () => {
      mockResendInvitation.mockRejectedValue({
        error: "not_found",
        code: 404,
      });

      await expect(resendMemberInvite("org123", "user456")).rejects.toThrow();
    });

    it("should handle conflict error", async () => {
      mockResendInvitation.mockRejectedValue({
        error: "conflict",
        code: 409,
      });

      await expect(resendMemberInvite("org123", "user456")).rejects.toThrow();
    });
  });

  describe("respondToInvitation", () => {
    it("should accept invitation successfully", async () => {
      mockUpdateMembershipState.mockResolvedValue({data: {}});

      await respondToInvitation("org123", MembershipState.ACCEPTED);

      expect(mockUpdateMembershipState).toHaveBeenCalledWith({
        path: {"user.org_id": "org123"},
        body: {state: "MEMBERSHIP_APPLICATION_STATE_APPROVED"},
        throwOnError: true,
      });
    });

    it("should decline invitation successfully", async () => {
      mockUpdateMembershipState.mockResolvedValue({data: {}});

      await respondToInvitation("org123", MembershipState.DECLINED);

      expect(mockUpdateMembershipState).toHaveBeenCalledWith({
        path: {"user.org_id": "org123"},
        body: {state: "MEMBERSHIP_APPLICATION_STATE_DECLINED"},
        throwOnError: true,
      });
    });

    it("should handle unauthorized error", async () => {
      mockUpdateMembershipState.mockRejectedValue({error: "unauthorized", code: 401});

      await expect(respondToInvitation("org123", MembershipState.ACCEPTED)).rejects.toThrow();
    });

    it("should handle invite not found error", async () => {
      mockUpdateMembershipState.mockRejectedValue({error: "not_found", code: 404});

      await expect(respondToInvitation("org123", MembershipState.ACCEPTED)).rejects.toThrow();
    });
  });

  describe("publicRespondToInvitation", () => {
    it("should accept public invitation successfully", async () => {
      mockAcceptInvitation.mockResolvedValue({data: {}});

      await publicRespondToInvitation("invite-token-123", MembershipState.ACCEPT);

      expect(mockAcceptInvitation).toHaveBeenCalledWith({
        path: {token: "invite-token-123"},
        throwOnError: true,
      });
    });

    it("should decline public invitation successfully", async () => {
      mockDeclineInvitation.mockResolvedValue({data: {}});

      await publicRespondToInvitation("invite-token-456", MembershipState.DECLINE);

      expect(mockDeclineInvitation).toHaveBeenCalledWith({
        path: {token: "invite-token-456"},
        throwOnError: true,
      });
    });

    it("should handle invalid token error", async () => {
      mockAcceptInvitation.mockRejectedValue({
        error: "bad_request",
        code: 400,
      });

      await expect(publicRespondToInvitation("invalid-token", MembershipState.ACCEPT)).rejects.toThrow();
    });

    it("should work with different tokens", async () => {
      mockAcceptInvitation.mockResolvedValue({data: {}});

      await publicRespondToInvitation("another-token-789", MembershipState.ACCEPT);

      expect(mockAcceptInvitation).toHaveBeenCalledWith({
        path: {token: "another-token-789"},
        throwOnError: true,
      });
    });
  });
});
