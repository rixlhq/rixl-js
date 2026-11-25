import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {getOrganization, listOrganizations, updateOrganization} from "../../auth/organization";
import {ApiError} from "../../auth/api/types";
import {MembershipRole, MembershipState} from "../../auth/membership/types";
import * as initialization from "../../auth/initialization";

const mocks = vi.hoisted(() => ({get: vi.fn(), list: vi.fn(), update: vi.fn()}));

vi.mock("../../generated/sdk.gen", () => ({
  authV1OrganizationServiceGetOrganization: mocks.get,
  authV1OrganizationServiceListOrganizations: mocks.list,
  authV1OrganizationServiceUpdateOrganization: mocks.update,
}));

// The gateway emits every field.
const wireOrganization = {id: "org-1", name: "Acme", slug: "acme", image_id: "", personal: false, internal: false, created_at: null};
const organization = {...wireOrganization, created_at: undefined};

const failure = (status: number, message = "backend detail") => new ApiError(message, status, "/auth/v1/organizations/org-1");

beforeEach(() => {
  initialization.initDeferred.promise = Promise.resolve();
  mocks.get.mockReset().mockResolvedValue({data: wireOrganization});
  mocks.list.mockReset();
  mocks.update.mockReset().mockResolvedValue({data: wireOrganization});
});

describe("getOrganization", () => {
  it("requests the org and maps it", async () => {
    await expect(getOrganization("org-1")).resolves.toEqual(organization);

    expect(mocks.get).toHaveBeenCalledWith({path: {org_id: "org-1"}, throwOnError: true});
  });

  it.each([
    [401, "User is not authorized to view the organization!"],
    [403, "Not allowed to view this organization!"],
    [500, "backend detail"],
  ])("maps %i to its error", async (status, message) => {
    mocks.get.mockRejectedValue(failure(status));

    await expect(getOrganization("org-1")).rejects.toMatchObject({message, status});
  });
});

describe("listOrganizations", () => {
  it("passes the page parameters and maps each membership", async () => {
    mocks.list.mockResolvedValue({
      data: {
        organizations: [{organization: wireOrganization, role: "MEMBERSHIP_ROLE_ADMIN", state: "MEMBERSHIP_STATE_SUSPENDED"}],
        next_page_token: "next",
      },
    });

    await expect(listOrganizations({page_size: 10, page_token: "this"})).resolves.toEqual({
      organizations: [{organization, role: MembershipRole.ADMIN, state: MembershipState.SUSPENDED}],
      next_page_token: "next",
    });

    expect(mocks.list).toHaveBeenCalledWith({query: {page_size: 10, page_token: "this"}, throwOnError: true});
  });

  it("maps null embedded organization messages without dropping other rows", async () => {
    mocks.list.mockResolvedValue({data: {organizations: [{organization: null}, {organization: wireOrganization}]}});
    const page = await listOrganizations();
    expect(page.organizations.map((row) => row.organization.id)).toEqual(["", "org-1"]);
  });

  it("sends only supported pagination fields", async () => {
    mocks.list.mockResolvedValue({data: {}});
    const query = {page_size: 25, show_deleted: true};
    await listOrganizations(query);
    expect(mocks.list).toHaveBeenCalledWith({query: {page_size: 25}, throwOnError: true});
  });

  it("returns an empty page when there are none", async () => {
    mocks.list.mockResolvedValue({data: {}});

    await expect(listOrganizations()).resolves.toEqual({organizations: [], next_page_token: ""});
    expect(mocks.list).toHaveBeenCalledWith({query: undefined, throwOnError: true});
  });

  it("maps 401 to its error", async () => {
    mocks.list.mockRejectedValue(failure(401));

    await expect(listOrganizations()).rejects.toMatchObject({message: "User is not authorized to list organizations!", status: 401});
  });
});

describe("updateOrganization", () => {
  it.each([
    [{name: "Acme"}, "name"],
    [{slug: "acme"}, "slug"],
    // protojson takes field mask paths in lowerCamelCase and rejects "image_id" with a 400.
    [{image_id: "img-1"}, "imageId"],
    [{name: "Acme", slug: "acme", image_id: "img-1"}, "name,slug,imageId"],
  ])("sends %o with the mask %s", async (changes, mask) => {
    await expect(updateOrganization("org-1", changes)).resolves.toEqual(organization);

    expect(mocks.update).toHaveBeenCalledWith({
      path: {org_id: "org-1"},
      body: {organization: changes, update_mask: mask},
      throwOnError: true,
    });
  });

  it("sends only the fields it can update, from a whole organization too", async () => {
    await updateOrganization("org-1", {...organization, slug: undefined});

    expect(mocks.update.mock.calls[0]![0].body).toEqual({organization: {name: "Acme", image_id: ""}, update_mask: "name,imageId"});
  });

  it("rejects without a field to change", async () => {
    await expect(updateOrganization("org-1", {})).rejects.toThrow("at least one");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([
    [400, "organization slug can change once every 30 days", "organization slug can change once every 30 days"],
    [401, "unauthorized", "User is not authorized to update the organization!"],
    [403, "forbidden", "Not allowed to update this organization!"],
    [409, "organization slug is taken", "organization slug is taken"],
    [409, "update aborted", "update aborted"],
  ])("maps %i to its error", async (status, wireMessage, message) => {
    mocks.update.mockRejectedValue(failure(status, wireMessage));

    await expect(updateOrganization("org-1", {slug: "acme"})).rejects.toMatchObject({message, status});
  });
});
