import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {listActiveMemberships, listPendingMemberships, listOrganizationMembers, MembershipRole, MembershipState} from "@/membership";
import {setupAuthTest, cleanupAuthMocks} from "../utils/auth-test-helpers";

const mockListMemberships = vi.fn();
const mockListMembershipApplications = vi.fn();
const mockListOrganizationMembers = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1MembershipServiceListMemberships: (...args: unknown[]) => mockListMemberships(...args),
  authV1MembershipServiceListMembershipApplications: (...args: unknown[]) => mockListMembershipApplications(...args),
  authV1MembershipServiceListOrganizationMembers: (...args: unknown[]) => mockListOrganizationMembers(...args),
}));

// Wire shape: the gateway sends snake_case keys with proto enum values.
const wireMembership = (overrides: Record<string, unknown> = {}) => ({
  id: "m1",
  user_id: "user123",
  org_id: "org123",
  role: "MEMBERSHIP_ROLE_ADMIN",
  state: "MEMBERSHIP_STATE_ACTIVE",
  organization_username: "testorg",
  organization_first_name: "Test",
  organization_last_name: "Org",
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
    mockListMembershipApplications.mockReset();
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
          organization_username: "testorg",
          organization_first_name: "Test",
          organization_last_name: "Org",
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
    it("queries the pending state and maps the result", async () => {
      mockListMembershipApplications.mockResolvedValue({
        data: {applications: [wireMembership({state: "MEMBERSHIP_APPLICATION_STATE_PENDING"})]},
      });

      const result = await listPendingMemberships();

      expect(mockListMembershipApplications).toHaveBeenCalledWith({
        query: {state: "MEMBERSHIP_APPLICATION_STATE_PENDING", limit: 25},
        throwOnError: true,
      });
      expect(result[0].state).toBe(MembershipState.PENDING);
    });

    it("returns empty array when no pending memberships", async () => {
      mockListMembershipApplications.mockResolvedValue({data: {applications: []}});

      expect(await listPendingMemberships()).toEqual([]);
    });
  });

  describe("listOrganizationMembers", () => {
    it("maps wire members to the snake_case public shape", async () => {
      mockListOrganizationMembers.mockResolvedValue({data: {members: [wireMember()]}});

      const result = await listOrganizationMembers("org123");

      expect(mockListOrganizationMembers).toHaveBeenCalledWith({
        path: {"user.org_id": "org123"},
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
          invitation_expires_at: undefined,
        },
      ]);
    });

    it("forwards pagination params", async () => {
      mockListOrganizationMembers.mockResolvedValue({data: {members: []}});
      const paginationParams = {limit: 20, offset: 0};

      await listOrganizationMembers("org456", paginationParams);

      expect(mockListOrganizationMembers).toHaveBeenCalledWith({
        path: {"user.org_id": "org456"},
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
