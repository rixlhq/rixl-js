/**
 * Organizations. A route that names an org acts only with a token for that org:
 * call selectOrganization() before getOrganization() or updateOrganization().
 */
import {
  authV1OrganizationServiceGetOrganization,
  authV1OrganizationServiceListOrganizations,
  authV1OrganizationServiceUpdateOrganization,
} from "../generated/sdk.gen";
import type {AuthV1ListOrganizationsResponse} from "../generated/types.gen";
import {apiCall} from "./api/utils";
import {HTTP_STATUS} from "./constants";
import {toRole, toState} from "./membership/mappers";
import type {MembershipRole, MembershipState} from "./membership/types";
import {toOrganization, type Organization} from "./organization-mappers";

export type {Organization} from "./organization-mappers";

/** An org the user belongs to, with their role and membership state in it. */
export interface OrganizationMembership {
  organization: Organization;
  role: MembershipRole;
  state: MembershipState;
}

export interface OrganizationList {
  organizations: OrganizationMembership[];
  /** Empty on the last page. */
  next_page_token: string;
}

export interface ListOrganizationsParams {
  page_size?: number;
  page_token?: string;
}

/** The fields to change. A field left out keeps its value. */
export type OrganizationUpdate = Partial<Pick<Organization, "name" | "slug" | "image_id">>;

// Each updatable field and its field mask path. The mask travels as protojson,
// which takes paths in lowerCamelCase.
const UPDATE_MASK_PATHS = [
  ["name", "name"],
  ["slug", "slug"],
  ["image_id", "imageId"],
] as const;

const toOrganizationList = (data: AuthV1ListOrganizationsResponse): OrganizationList => ({
  organizations: (data.organizations ?? []).map((entry) => ({
    organization: toOrganization(entry.organization),
    role: toRole(entry.role),
    state: toState(entry.state),
  })),
  next_page_token: data.next_page_token ?? "",
});

export const getOrganization = async (orgId: string): Promise<Organization> => {
  return apiCall(
    async () => {
      const {data} = await authV1OrganizationServiceGetOrganization({path: {org_id: orgId}, throwOnError: true});
      return toOrganization(data);
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to view the organization!"),
      [HTTP_STATUS.FORBIDDEN]: () => new Error("Not allowed to view this organization!"),
    }
  );
};

/**
 * The orgs the user belongs to, one page at a time. Any org's token can list
 * them. A tab whose own org is refused (OrgAccessError) has none: call
 * selectOrganization(personalOrgId.get()) first.
 */
export const listOrganizations = async (params?: ListOrganizationsParams): Promise<OrganizationList> => {
  return apiCall(
    async () => {
      const {data} = await authV1OrganizationServiceListOrganizations({
        query: params && {page_size: params.page_size, page_token: params.page_token},
        throwOnError: true,
      });
      return toOrganizationList(data);
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to list organizations!"),
    }
  );
};

export const updateOrganization = async (orgId: string, changes: OrganizationUpdate): Promise<Organization> => {
  return apiCall(
    async () => {
      const changed = UPDATE_MASK_PATHS.filter(([field]) => changes[field] !== undefined);
      if (!changed.length) throw new Error("updateOrganization() needs at least one of name, slug or image_id");

      const {data} = await authV1OrganizationServiceUpdateOrganization({
        path: {org_id: orgId},
        body: {
          organization: Object.fromEntries(changed.map(([field]) => [field, changes[field]])),
          update_mask: changed.map(([, path]) => path).join(","),
        },
        throwOnError: true,
      });
      return toOrganization(data);
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to update the organization!"),
      [HTTP_STATUS.FORBIDDEN]: () => new Error("Not allowed to update this organization!"),
    }
  );
};
