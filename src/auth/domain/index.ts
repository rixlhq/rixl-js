import {
  authV1DomainServiceGetDomainStatus,
  authV1DomainServiceCreateDomainVerification,
  authV1DomainServiceCheckDomainVerification,
  authV1DomainServiceSetDomainSuggestJoin,
  authV1DomainServiceRemoveDomain,
} from "../../generated/sdk.gen";
import {apiCall} from "../api/utils";
import {ApiError} from "../api/types";
import {HTTP_STATUS} from "../constants";
import {validateInput} from "../validation/base";
import {AddDomainSchema, UpdateSuggestJoinSchema} from "../validation/domain";
import {toDomainResponse, toSuggestJoinSetting} from "./mappers";
import type {DomainResponse, SuggestJoinSetting} from "./types";

export * from "./types";

export const getDomainStatus = async (orgId: string): Promise<DomainResponse | null> => {
  return apiCall(
    async () => {
      try {
        const {data} = await authV1DomainServiceGetDomainStatus({
          path: {org_id: orgId},
          throwOnError: true,
        });
        return toDomainResponse(data);
      } catch (error) {
        // The client's error interceptor wraps every failed response in an ApiError with the HTTP status.
        if (error instanceof ApiError && error.status === HTTP_STATUS.NOT_FOUND) {
          return null;
        }
        throw error;
      }
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Not authorized to view domain settings"),
    }
  );
};

export const initiateDomainVerification = async (orgId: string, domain: string): Promise<DomainResponse> => {
  return apiCall(
    async () => {
      const requestBody = validateInput(AddDomainSchema, {domain});
      const {data} = await authV1DomainServiceCreateDomainVerification({
        path: {org_id: orgId},
        body: requestBody,
        throwOnError: true,
      });
      return toDomainResponse(data);
    },
    {
      [HTTP_STATUS.BAD_REQUEST]: () => new Error("Invalid domain format or public domains like gmail.com are not allowed"),
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Not authorized to configure domain settings"),
    }
  );
};

export const checkDomainVerification = async (orgId: string): Promise<DomainResponse> => {
  return apiCall(
    async () => {
      const {data} = await authV1DomainServiceCheckDomainVerification({
        path: {org_id: orgId},
        throwOnError: true,
      });
      return toDomainResponse(data);
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Not authorized to check domain verification"),
    }
  );
};

/** Sets whether users with an email on the verified domain are offered to join the org. */
export const updateSuggestJoin = async (orgId: string, enabled: boolean): Promise<SuggestJoinSetting> => {
  return apiCall(
    async () => {
      const requestBody = validateInput(UpdateSuggestJoinSchema, {enabled});
      const {data} = await authV1DomainServiceSetDomainSuggestJoin({
        path: {org_id: orgId},
        body: requestBody,
        throwOnError: true,
      });
      return toSuggestJoinSetting(data);
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Not authorized to update join suggestion settings"),
    }
  );
};

export const removeDomain = async (orgId: string): Promise<void> => {
  return apiCall(
    async () => {
      await authV1DomainServiceRemoveDomain({
        path: {org_id: orgId},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Not authorized to remove domain"),
    }
  );
};
