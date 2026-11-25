import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {
  MembershipRole,
  MembershipState,
  inviteMember,
  listMyInvitations,
  listOrganizationInvitations,
  lookupInvitation,
  publicRespondToInvitation,
  resendMemberInvite,
  respondToMyInvitation,
  revokeInvitation,
} from "@/membership";
import * as initialization from "../../auth/initialization";
import {ApiError} from "../../auth/api/types";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  listForOrg: vi.fn(),
  resend: vi.fn(),
  revoke: vi.fn(),
  lookup: vi.fn(),
  listMine: vi.fn(),
  accept: vi.fn(),
  decline: vi.fn(),
}));

vi.mock("../../generated/sdk.gen", () => ({
  authV1InvitationServiceCreateInvitation: mocks.create,
  authV1InvitationServiceListOrganizationInvitations: mocks.listForOrg,
  authV1InvitationServiceResendInvitation: mocks.resend,
  authV1InvitationServiceRevokeInvitation: mocks.revoke,
  authV1InvitationServiceLookupInvitation: mocks.lookup,
  authV1InvitationServiceListMyInvitations: mocks.listMine,
  authV1InvitationServiceAcceptInvitation: mocks.accept,
  authV1InvitationServiceDeclineInvitation: mocks.decline,
}));

vi.mock("../../auth/authStore", () => ({
  getToken: vi.fn().mockResolvedValue("mock-token"),
}));

const wireOrg = {id: "org123", name: "Test Org", slug: "testorg", image_id: "img1", personal: false, internal: false};

const wireInvitation = {
  id: "inv1",
  org: wireOrg,
  email: "new@example.com",
  role: "MEMBERSHIP_ROLE_ADMIN",
  state: "INVITATION_STATE_PENDING",
  invited_by: {id: "user1", display_name: "Jane Doe"},
  created_at: "2026-11-25T10:00:00Z",
  last_sent_at: "2026-11-25T10:00:00Z",
  resend_available_at: null,
  expires_at: "2026-12-02T10:00:00Z",
};

const invitation = {
  id: "inv1",
  organization: {...wireOrg, created_at: undefined},
  email: "new@example.com",
  role: MembershipRole.ADMIN,
  state: "pending",
  invited_by: {id: "user1", display_name: "Jane Doe"},
  created_at: "2026-11-25T10:00:00Z",
  last_sent_at: "2026-11-25T10:00:00Z",
  resend_available_at: undefined,
  expires_at: "2026-12-02T10:00:00Z",
};

const wireMembership = {
  id: "m1",
  user_id: "user2",
  org_id: "org123",
  role: "MEMBERSHIP_ROLE_MEMBER",
  state: "MEMBERSHIP_STATE_ACTIVE",
  organization: wireOrg,
  joined_at: "2026-11-25T11:00:00Z",
};

describe("Membership Invite Module", () => {
  beforeEach(() => {
    initialization.initDeferred.promise = Promise.resolve();
    for (const mock of Object.values(mocks)) mock.mockReset().mockResolvedValue({data: {}});
  });

  describe("inviteMember", () => {
    it.each([
      [MembershipRole.MEMBER, "MEMBERSHIP_ROLE_MEMBER"],
      [MembershipRole.ADMIN, "MEMBERSHIP_ROLE_ADMIN"],
    ] as const)("creates a %s invitation for the email", async (role, wireRole) => {
      await expect(inviteMember("org123", " new@example.com ", role)).resolves.toBeUndefined();

      expect(mocks.create).toHaveBeenCalledWith({
        path: {org_id: "org123"},
        body: {email: "new@example.com", role: wireRole},
        throwOnError: true,
      });
    });

    it("rejects a username before sending anything", async () => {
      await expect(inviteMember("org123", "newuser", MembershipRole.MEMBER)).rejects.toThrow("Please enter a valid email address");
      expect(mocks.create).not.toHaveBeenCalled();
    });
  });

  describe("listOrganizationInvitations", () => {
    it("asks for the server's default state and maps the page", async () => {
      mocks.listForOrg.mockResolvedValue({data: {invitations: [wireInvitation], next_page_token: "next"}});

      await expect(listOrganizationInvitations("org123")).resolves.toEqual({invitations: [invitation], next_page_token: "next"});

      expect(mocks.listForOrg).toHaveBeenCalledWith({path: {org_id: "org123"}, query: undefined, throwOnError: true});
    });

    it("sends the state filter and page", async () => {
      await listOrganizationInvitations("org123", {state: "revoked", page_size: 10, page_token: "p2"});

      expect(mocks.listForOrg).toHaveBeenCalledWith({
        path: {org_id: "org123"},
        query: {state: "INVITATION_STATE_REVOKED", page_size: 10, page_token: "p2"},
        throwOnError: true,
      });
    });
  });

  describe("resendMemberInvite", () => {
    it("resends by invitation ID", async () => {
      await expect(resendMemberInvite("org123", "inv1")).resolves.toBeUndefined();

      expect(mocks.resend).toHaveBeenCalledWith({path: {org_id: "org123", invitation_id: "inv1"}, throwOnError: true});
    });
  });

  describe("revokeInvitation", () => {
    it("revokes by invitation ID", async () => {
      await expect(revokeInvitation("org123", "inv1")).resolves.toBeUndefined();

      expect(mocks.revoke).toHaveBeenCalledWith({path: {org_id: "org123", invitation_id: "inv1"}, throwOnError: true});
    });
  });

  describe("lookupInvitation", () => {
    it("sends the token in the body and maps a pending invitation", async () => {
      mocks.lookup.mockResolvedValue({
        data: {
          state: "INVITATION_STATE_PENDING",
          org_name: "Test Org",
          org_image_id: "img1",
          role: "MEMBERSHIP_ROLE_ADMIN",
          inviter_display_name: "Jane Doe",
          email: "new@example.com",
          expires_at: "2026-12-02T10:00:00Z",
        },
      });

      await expect(lookupInvitation("tok")).resolves.toEqual({
        state: "pending",
        org_name: "Test Org",
        org_image_id: "img1",
        role: MembershipRole.ADMIN,
        inviter_display_name: "Jane Doe",
        email: "new@example.com",
        expires_at: "2026-12-02T10:00:00Z",
      });

      expect(mocks.lookup).toHaveBeenCalledWith({body: {token: "tok"}, throwOnError: true});
    });

    it("reports only the state of a closed invitation", async () => {
      mocks.lookup.mockResolvedValue({
        data: {state: "INVITATION_STATE_EXPIRED", role: "MEMBERSHIP_ROLE_UNSPECIFIED", expires_at: null},
      });

      await expect(lookupInvitation("tok")).resolves.toEqual({
        state: "expired",
        org_name: "",
        org_image_id: "",
        role: undefined,
        inviter_display_name: "",
        email: "",
        expires_at: undefined,
      });
    });
  });

  describe("listMyInvitations", () => {
    it("maps the recipient's page", async () => {
      mocks.listMine.mockResolvedValue({data: {invitations: [{...wireInvitation, invited_by: null}], next_page_token: ""}});

      await expect(listMyInvitations({page_size: 5})).resolves.toEqual({
        invitations: [{...invitation, invited_by: undefined}],
        next_page_token: "",
      });

      expect(mocks.listMine).toHaveBeenCalledWith({query: {page_size: 5, page_token: undefined}, throwOnError: true});
    });
  });

  describe.each([
    ["publicRespondToInvitation", publicRespondToInvitation, {token: "secret"}, "secret"],
    ["respondToMyInvitation", respondToMyInvitation, {invitation_id: "inv1"}, "inv1"],
  ] as const)("%s", (_name, respond, body, target) => {
    it("accepts and resolves with the membership", async () => {
      mocks.accept.mockResolvedValue({data: wireMembership});

      await expect(respond(target, MembershipState.ACCEPT)).resolves.toMatchObject({
        org_id: "org123",
        role: MembershipRole.MEMBER,
        state: MembershipState.ACCEPTED,
      });

      expect(mocks.accept).toHaveBeenCalledWith({body, throwOnError: true});
      expect(mocks.decline).not.toHaveBeenCalled();
    });

    it("declines and resolves with nothing", async () => {
      await expect(respond(target, MembershipState.DECLINE)).resolves.toBeUndefined();

      expect(mocks.decline).toHaveBeenCalledWith({body, throwOnError: true});
      expect(mocks.accept).not.toHaveBeenCalled();
    });

    it("rejects an empty target before sending anything", async () => {
      await expect(respond("", MembershipState.ACCEPT)).rejects.toThrow("is required");
      expect(mocks.accept).not.toHaveBeenCalled();
    });

    it.each([
      [400, "invitation has expired", "INVITATION_EXPIRED"],
      [403, "forbidden", "INVITATION_EMAIL_MISMATCH"],
    ])("passes a %i refusal through with its reason", async (status, message, reason) => {
      const refusal = new ApiError(message, status, "/auth/v1/invitations/accept", {error: message, reason});
      mocks.accept.mockRejectedValue(refusal);

      await expect(respond(target, MembershipState.ACCEPT)).rejects.toBe(refusal);
    });
  });

  const wrappers = [
    ["inviteMember", mocks.create, () => inviteMember("org123", "new@example.com", MembershipRole.MEMBER)],
    ["listOrganizationInvitations", mocks.listForOrg, () => listOrganizationInvitations("org123")],
    ["resendMemberInvite", mocks.resend, () => resendMemberInvite("org123", "inv1")],
    ["revokeInvitation", mocks.revoke, () => revokeInvitation("org123", "inv1")],
    ["listMyInvitations", mocks.listMine, () => listMyInvitations()],
    ["publicRespondToInvitation", mocks.accept, () => publicRespondToInvitation("tok", MembershipState.ACCEPT)],
  ] as const;

  it.each(wrappers)("%s explains a 401 and keeps the body", async (_name, request, call) => {
    request.mockRejectedValue(new ApiError("unauthorized", 401, "/auth/v1", {error: "unauthorized"}));

    await expect(call()).rejects.toMatchObject({
      status: 401,
      data: {error: "unauthorized"},
      message: expect.stringContaining("!"),
    });
  });

  it.each([
    ["resendMemberInvite", mocks.resend, () => resendMemberInvite("org123", "inv1")],
    ["revokeInvitation", mocks.revoke, () => revokeInvitation("org123", "inv1")],
    ["lookupInvitation", mocks.lookup, () => lookupInvitation("tok")],
    ["publicRespondToInvitation", mocks.decline, () => publicRespondToInvitation("tok", MembershipState.DECLINE)],
  ] as const)("%s reports a missing invitation", async (_name, request, call) => {
    request.mockRejectedValue(new ApiError("not found", 404, "/auth/v1"));

    await expect(call()).rejects.toThrow("Invitation not found!");
  });

  // A conflict or a send limit has several causes, and only the reason says which.
  it.each([
    [409, "conflict", "INVITATION_PENDING"],
    [429, "too many requests", "INVITATION_ORG_DAILY_LIMIT"],
  ])("inviteMember passes a %i through with its reason", async (status, message, reason) => {
    const refusal = new ApiError(message, status, "/auth/v1/organizations/org123/invitations", {error: message, reason});
    mocks.create.mockRejectedValue(refusal);

    await expect(inviteMember("org123", "new@example.com", MembershipRole.MEMBER)).rejects.toBe(refusal);
  });
});
