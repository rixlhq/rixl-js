import {authV1MembershipServiceUpdateMember, authV1MembershipServiceLeaveOrganization} from "../../generated/sdk.gen";
import {apiCall} from "../api/utils";
import {signInMarkerOf} from "../sign-in-cookies";
import {decodeOrgClaims} from "../utils/jwt";
import {leaveTabOrg} from "../tab-org";
import {HTTP_STATUS} from "../constants";
import type {AssignableRole} from "./types";
import {validateInput} from "../validation/base";
import {ROLE_TO_PROTO} from "./mappers";
import {UpdateMemberRoleSchema} from "../validation/membership";

export const updateMemberRole = async (orgId: string, userId: string, role: AssignableRole): Promise<void> => {
  return apiCall(
    async () => {
      const validated = validateInput(UpdateMemberRoleSchema, {role});
      await authV1MembershipServiceUpdateMember({
        path: {org_id: orgId, user_id: userId},
        body: {role: ROLE_TO_PROTO[validated.role], update_mask: "role"},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to update member roles!"),
      [HTTP_STATUS.NOT_FOUND]: () => new Error("Member not found!"),
    }
  );
};

export const leaveOrganization = async (orgId: string): Promise<void> => {
  return apiCall(
    async () => {
      const {request} = await authV1MembershipServiceLeaveOrganization({
        path: {org_id: orgId},
        responseStyle: "fields",
        throwOnError: true,
      });

      const bearer = request?.headers.get("Authorization")?.replace(/^Bearer /, "");
      const claims = bearer && decodeOrgClaims(bearer);
      if (claims && claims.orgId === orgId) leaveTabOrg(orgId, signInMarkerOf(claims));
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to leave an organization!"),
      [HTTP_STATUS.NOT_FOUND]: () => new Error("Organization not found!"),
    }
  );
};
