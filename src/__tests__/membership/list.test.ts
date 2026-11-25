import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {listActiveMemberships, listPendingMemberships, listOrganizationMembers, MembershipRole, MembershipState} from "@/membership";
import {setupAuthTest, cleanupAuthMocks} from "../utils/auth-test-helpers";

const mockListMemberships = vi.fn();
const mockListMyInvitations = vi.fn();
const mockListOrganizationMembers = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1MembershipServiceListMemberships: (...args: unknown[]) => mockListMemberships(...args),
  authV1InvitationServiceListMyInvitations: (...args: unknown[]) => mockListMyInvitations(...args),
  authV1MembershipServiceListOrganizationMembers: (...args: unknown[]) => mockListOrganizationMembers(...args),
}));

// Wire shape: the gateway sends snake_case keys with proto enum values.
const wireMembership = (overrides: Record<string, unknown> = {}) => ({
  id: "m1",
  user_id: "user123",
  org_id: "org123",
  role: "MEMBERSHIP_ROLE_ADMIN",
  state: "MEMBERSHIP_STATE_ACTIVE",
  organization: {id: "org123", name: "Test Org", slug: "testorg", image_id: "img1", personal: false, internal: false},
  joined_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const wireMember = (overrides: Record<string, unknown> = {}) => ({
  id: "mem1",
  user_id: "user456",
  org_id: "org123",
  role: "MEMBERSHIP_ROLE_ADMIN",
  state: "MEMBERSHIP_STATE_ACTIVE",
  username: "john_doe",
  first_name: "John",
  last_name: "Doe",
  joined_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

describe("Membership List Module", () => {
  let mocks: ReturnType<typeof setupAuthTest>;

  beforeEach(() => {
    mocks = setupAuthTest();
    mockListMemberships.mockReset();
    mockListMyInvitations.mockReset();
    mockListOrganizationMembers.mockReset();
  });

  afterEach(() => {
    cleanupAuthMocks(mocks);
  });

  describe("listActiveMemberships", () => {
    it("maps wire memberships to the snake_case public shape", async () => {
      mockListMemberships.mockResolvedValue({data: {memberships: [wireMembership()]}});

      const result = await listActiveMemberships();

      expect(mockListMemberships).toHaveBeenCalledWith({
        query: {state: "MEMBERSHIP_STATE_ACTIVE", limit: 25},
        throwOnError: true,
      });
      expect(result).toEqual([
        {
          id: "m1",
          user_id: "user123",
          org_id: "org123",
          role: MembershipRole.ADMIN,
          state: MembershipState.ACCEPTED,
          joined_at: "2024-01-01T00:00:00Z",
          organization: {
            id: "org123",
            name: "Test Org",
            slug: "testorg",
            image_id: "img1",
            personal: false,
            internal: false,
            created_at: undefined,
          },
        },
      ]);
    });

    it("forwards pagination params", async () => {
      mockListMemberships.mockResolvedValue({data: {memberships: []}});
      const paginationParams = {limit: 10, offset: 0};

      await listActiveMemberships(paginationParams);

      expect(mockListMemberships).toHaveBeenCalledWith({
        query: {state: "MEMBERSHIP_STATE_ACTIVE", limit: 25, ...paginationParams},
        throwOnError: true,
      });
    });

    it("returns empty array when no memberships", async () => {
      mockListMemberships.mockResolvedValue({data: {memberships: []}});

      expect(await listActiveMemberships()).toEqual([]);
    });

    it("maps the member role from its proto value", async () => {
      mockListMemberships.mockResolvedValue({
        data: {memberships: [wireMembership({role: "MEMBERSHIP_ROLE_MEMBER"})]},
      });

      const result = await listActiveMemberships();

      expect(result[0].role).toBe(MembershipRole.MEMBER);
    });
  });

  describe("listPendingMemberships", () => {
    const wireInvitation = {
      id: "inv1",
      org: {id: "org123", name: "Test Org", slug: "testorg", image_id: "img1", personal: false, internal: false},
      role: "MEMBERSHIP_ROLE_ADMIN",
      state: "INVITATION_STATE_PENDING",
      created_at: "2026-11-25T10:00:00Z",
      expires_at: "2026-12-02T10:00:00Z",
    };

    it("shapes the user's invitations as pending memberships", async () => {
      mockListMyInvitations.mockResolvedValue({data: {invitations: [wireInvitation]}});

      const result = await listPendingMemberships();

      expect(mockListMyInvitations).toHaveBeenCalledWith({query: undefined, throwOnError: true});
      expect(result).toEqual([
        {
          id: "inv1",
          org_id: "org123",
          role: MembershipRole.ADMIN,
          state: MembershipState.PENDING,
          organization: {...wireInvitation.org, created_at: undefined},
          created_at: "2026-11-25T10:00:00Z",
          invitation_expires_at: "2026-12-02T10:00:00Z",
        },
      ]);
    });

    it("maps null embedded messages and timestamps to the public defaults", async () => {
      mockListMyInvitations.mockResolvedValue({data: {invitations: [{...wireInvitation, org: null, created_at: null, expires_at: null}]}});

      const [pending] = await listPendingMemberships();

      expect(pending).toMatchObject({
        org_id: "",
        organization: {id: "", name: "", created_at: undefined},
        created_at: undefined,
        invitation_expires_at: undefined,
      });
    });

    it("returns empty array when there are no invitations", async () => {
      mockListMyInvitations.mockResolvedValue({data: {}});

      expect(await listPendingMemberships()).toEqual([]);
    });
  });

  describe("listOrganizationMembers", () => {
    it("maps a suspended membership as suspended", async () => {
      mockListOrganizationMembers.mockResolvedValue({data: {members: [wireMember({state: "MEMBERSHIP_STATE_SUSPENDED"})]}});

      const result = await listOrganizationMembers("org123");

      expect(result[0].state).toBe(MembershipState.SUSPENDED);
    });

    it("maps wire members to the snake_case public shape", async () => {
      mockListOrganizationMembers.mockResolvedValue({data: {members: [wireMember()]}});

      const result = await listOrganizationMembers("org123");

      expect(mockListOrganizationMembers).toHaveBeenCalledWith({
        path: {org_id: "org123"},
        query: undefined,
        throwOnError: true,
      });
      expect(result).toEqual([
        {
          id: "mem1",
          user_id: "user456",
          org_id: "org123",
          role: MembershipRole.ADMIN,
          state: MembershipState.ACCEPTED,
          joined_at: "2024-01-01T00:00:00Z",
          username: "john_doe",
          first_name: "John",
          last_name: "Doe",
        },
      ]);
    });

    it("forwards pagination params", async () => {
      mockListOrganizationMembers.mockResolvedValue({data: {members: []}});
      const paginationParams = {limit: 20, offset: 0};

      await listOrganizationMembers("org456", paginationParams);

      expect(mockListOrganizationMembers).toHaveBeenCalledWith({
        path: {org_id: "org456"},
        query: paginationParams,
        throwOnError: true,
      });
    });

    it("returns empty array when no members", async () => {
      mockListOrganizationMembers.mockResolvedValue({data: {members: []}});

      expect(await listOrganizationMembers("org999")).toEqual([]);
    });
  });
});
