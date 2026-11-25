import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {
  MembershipRole,
  MembershipState,
  acceptInvitation,
  createInvitation,
  listMyInvitations,
  listOrganizationInvitations,
  lookupInvitation,
  resendInvitation,
} from "@/membership";
import * as initialization from "../../auth/initialization";
import {ApiError} from "../../auth/api/types";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  listForOrg: vi.fn(),
  resend: vi.fn(),
  lookup: vi.fn(),
  listMine: vi.fn(),
  accept: vi.fn(),
}));

vi.mock("../../generated/sdk.gen", () => ({
  authV1InvitationServiceCreateInvitation: mocks.create,
  authV1InvitationServiceListOrganizationInvitations: mocks.listForOrg,
  authV1InvitationServiceResendInvitation: mocks.resend,
  authV1InvitationServiceLookupInvitation: mocks.lookup,
  authV1InvitationServiceListMyInvitations: mocks.listMine,
  authV1InvitationServiceAcceptInvitation: mocks.accept,
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

  describe("createInvitation", () => {
    it.each([
      [MembershipRole.MEMBER, "MEMBERSHIP_ROLE_MEMBER"],
      [MembershipRole.ADMIN, "MEMBERSHIP_ROLE_ADMIN"],
    ] as const)("creates a %s invitation and resolves with it", async (role, wireRole) => {
      mocks.create.mockResolvedValue({data: wireInvitation});

      await expect(createInvitation("org123", "new@example.com", role)).resolves.toEqual(invitation);

      expect(mocks.create).toHaveBeenCalledWith({
        path: {org_id: "org123"},
        body: {email: "new@example.com", role: wireRole},
        throwOnError: true,
      });
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

  describe("resendInvitation", () => {
    it("resends by invitation ID and resolves with the invitation", async () => {
      mocks.resend.mockResolvedValue({data: wireInvitation});

      await expect(resendInvitation("org123", "inv1")).resolves.toEqual(invitation);

      expect(mocks.resend).toHaveBeenCalledWith({path: {org_id: "org123", invitation_id: "inv1"}, throwOnError: true});
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

  describe("acceptInvitation", () => {
    it.each([{token: "secret"}, {invitation_id: "inv1"}])("accepts %o and resolves with the membership", async (target) => {
      mocks.accept.mockResolvedValue({data: wireMembership});

      await expect(acceptInvitation(target)).resolves.toMatchObject({
        org_id: "org123",
        role: MembershipRole.MEMBER,
        state: MembershipState.ACTIVE,
      });

      expect(mocks.accept).toHaveBeenCalledWith({body: target, throwOnError: true});
    });
  });

  // The gateway's status, message and reason are the caller's to act on.
  it.each([
    [
      "createInvitation",
      mocks.create,
      409,
      "INVITATION_PENDING",
      () => createInvitation("org123", "new@example.com", MembershipRole.MEMBER),
    ],
    ["listOrganizationInvitations", mocks.listForOrg, 401, undefined, () => listOrganizationInvitations("org123")],
    ["resendInvitation", mocks.resend, 429, "INVITATION_ORG_DAILY_LIMIT", () => resendInvitation("org123", "inv1")],
    ["lookupInvitation", mocks.lookup, 404, undefined, () => lookupInvitation("tok")],
    ["listMyInvitations", mocks.listMine, 401, undefined, () => listMyInvitations()],
    ["acceptInvitation", mocks.accept, 403, "INVITATION_EMAIL_MISMATCH", () => acceptInvitation({token: "tok"})],
  ] as const)("%s rejects with the refusal as it came", async (_name, request, status, reason, call) => {
    const refusal = new ApiError("refused", status, "/auth/v1", {error: "refused", reason});
    request.mockRejectedValue(refusal);

    await expect(call()).rejects.toBe(refusal);
  });
});
