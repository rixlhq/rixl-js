import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {updateOrgName, updateOrgUsername} from "../auth/organization";
import * as initialization from "../auth/initialization";

const mockAuthV1MembershipServiceUpdateOrgName = vi.fn();
const mockAuthV1MembershipServiceUpdateOrgUsername = vi.fn();

vi.mock("../generated/sdk.gen", () => ({
  authV1MembershipServiceUpdateOrgName: (...args: unknown[]) => mockAuthV1MembershipServiceUpdateOrgName(...args),
  authV1MembershipServiceUpdateOrgUsername: (...args: unknown[]) => mockAuthV1MembershipServiceUpdateOrgUsername(...args),
}));

describe("Organization Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initialization.initDeferred.promise = Promise.resolve();
    mockAuthV1MembershipServiceUpdateOrgName.mockReset();
    mockAuthV1MembershipServiceUpdateOrgUsername.mockReset();
  });

  describe("updateOrgName", () => {
    it("should update org name successfully", async () => {
      mockAuthV1MembershipServiceUpdateOrgName.mockResolvedValue({data: {}});

      await updateOrgName("New Org Name", "org123");

      expect(mockAuthV1MembershipServiceUpdateOrgName).toHaveBeenCalledWith({
        path: {"user.org_id": "org123"},
        body: {full_name: "New Org Name"},
        throwOnError: true,
      });
    });

    it("should handle valid organization names", async () => {
      mockAuthV1MembershipServiceUpdateOrgName.mockResolvedValue({data: {}});

      await expect(updateOrgName("Valid Organization", "org456")).resolves.toBeUndefined();
    });

    it("should handle errors", async () => {
      mockAuthV1MembershipServiceUpdateOrgName.mockRejectedValue({error: "unauthorized", code: 401});

      await expect(updateOrgName("Test Org", "org789")).rejects.toThrow();
    });

    it("should handle different organization IDs", async () => {
      mockAuthV1MembershipServiceUpdateOrgName.mockResolvedValue({data: {}});

      await updateOrgName("Org Name", "org-abc-123");

      expect(mockAuthV1MembershipServiceUpdateOrgName).toHaveBeenCalledWith({
        path: {"user.org_id": "org-abc-123"},
        body: {full_name: "Org Name"},
        throwOnError: true,
      });
    });

    it("should validate name format", async () => {
      await expect(updateOrgName("", "org123")).rejects.toThrow();
    });
  });

  describe("updateOrgUsername", () => {
    it("should update org username successfully", async () => {
      mockAuthV1MembershipServiceUpdateOrgUsername.mockResolvedValue({data: {}});

      await updateOrgUsername("neworgusername", "org123");

      expect(mockAuthV1MembershipServiceUpdateOrgUsername).toHaveBeenCalledWith({
        path: {"user.org_id": "org123"},
        body: {username: "neworgusername"},
        throwOnError: true,
      });
    });

    it("should handle valid organization usernames", async () => {
      mockAuthV1MembershipServiceUpdateOrgUsername.mockResolvedValue({data: {}});

      await expect(updateOrgUsername("valid_org_user", "org456")).resolves.toBeUndefined();
    });

    it("should handle errors", async () => {
      mockAuthV1MembershipServiceUpdateOrgUsername.mockRejectedValue({error: "conflict", code: 409});

      await expect(updateOrgUsername("takenusername", "org789")).rejects.toThrow();
    });

    it("should handle different organization IDs", async () => {
      mockAuthV1MembershipServiceUpdateOrgUsername.mockResolvedValue({data: {}});

      await updateOrgUsername("orguser", "org-xyz-789");

      expect(mockAuthV1MembershipServiceUpdateOrgUsername).toHaveBeenCalledWith({
        path: {"user.org_id": "org-xyz-789"},
        body: {username: "orguser"},
        throwOnError: true,
      });
    });

    it("should validate username format", async () => {
      await expect(updateOrgUsername("ab", "org123")).rejects.toThrow();
    });
  });
});
