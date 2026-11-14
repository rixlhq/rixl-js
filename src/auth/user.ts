import {
  authV1UserServiceUpdateName,
  authV1UserServiceUpdateUsername,
  authV1UserServiceGetUserInfo,
  authV1OtpServiceGetOtpStatus,
  authV1OtpServiceSetupOtp,
  authV1OtpServiceVerifyOtp,
  authV1OtpServiceDeleteOtp,
  authV1OtpServiceRegenerateBackupCodes,
} from "../generated/sdk.gen";
import type {AuthV1Policy, AuthV1UserInfo} from "../generated/types.gen";
import {validateInput} from "./validation/base";
import {UpdateNameSchema, UpdateUsernameSchema} from "./validation/user";
import {VerifyOTPCodeSchema} from "./validation/auth";
import {apiCall} from "./api/utils";
import {persistTokens} from "./api/tokens";
import {HTTP_STATUS} from "./constants";

export interface OTPSetup {
  qrCodeUrl: string;
  secret: string;
  backup_codes?: string[];
}

export interface OTPStatusResponse {
  is_setup: boolean;
  created_at?: string;
  message?: string;
  backup_codes_remaining?: number;
}

export interface BackupCodes {
  backup_codes: string[];
}

export interface OTPVerification {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  email_verified: boolean;
  first_name: string;
  last_name: string;
  image_url: string;
  language_code: string;
  country_code: string;
  active_org_id: string;
  /** Policies attached to this user in the active organization. */
  policies: AuthV1Policy[];
  /** Effective permissions granted by those policies. */
  permissions: string[];
}

// The gateway omits empty fields; UserInfo always has them, as "" or [].
const text = (value?: string | null): string => value ?? "";

function toUserInfo(data: AuthV1UserInfo): UserInfo {
  return {
    id: text(data.id),
    username: text(data.username),
    email: text(data.email),
    email_verified: data.email_verified ?? false,
    first_name: text(data.first_name),
    last_name: text(data.last_name),
    image_url: text(data.image_url),
    language_code: text(data.language_code),
    country_code: text(data.country_code),
    active_org_id: text(data.active_org_id),
    policies: data.policies ?? [],
    permissions: data.permissions ?? [],
  };
}

export const getUserInfo = async (userId?: string): Promise<UserInfo> => {
  return apiCall(
    async () => {
      const {data} = await authV1UserServiceGetUserInfo({
        query: userId ? {user_id: userId} : undefined,
        throwOnError: true,
      });

      return toUserInfo(data);
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Token is missing or invalid; user is not authenticated."),
    }
  );
};

export const updateFullName = async (fullName: string): Promise<void> => {
  return apiCall(
    async () => {
      const validatedInput = validateInput(UpdateNameSchema, {full_name: fullName});
      await authV1UserServiceUpdateName({
        body: validatedInput,
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.BAD_REQUEST]: () => new Error("Invalid name format"),
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to update name"),
      [HTTP_STATUS.TOO_MANY_REQUESTS]: () => new Error("Name can only be changed once every 7 days."),
    }
  );
};

export const updateUsername = async (username: string): Promise<void> => {
  return apiCall(
    async () => {
      const validatedInput = validateInput(UpdateUsernameSchema, {username});
      await authV1UserServiceUpdateUsername({
        body: validatedInput,
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.BAD_REQUEST]: () => new Error("Invalid username format"),
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to update username"),
      [HTTP_STATUS.CONFLICT]: () => new Error("Username is not unique. Choose another one!"),
      [HTTP_STATUS.TOO_MANY_REQUESTS]: () => new Error("Username can only be changed once every 30 days."),
    }
  );
};

export const getOTPStatus = async (): Promise<OTPStatusResponse> => {
  return apiCall(
    async () => {
      const {data} = await authV1OtpServiceGetOtpStatus({
        throwOnError: true,
      });

      return {
        is_setup: data.is_setup ?? false,
        created_at: data.created_at,
        backup_codes_remaining: data.backup_codes_remaining,
      };
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Token is missing or invalid; user is not authenticated."),
    }
  );
};

export const setupUserOTP = async (): Promise<OTPSetup> => {
  return apiCall(
    async () => {
      const {data} = await authV1OtpServiceSetupOtp({
        throwOnError: true,
      });

      return {
        qrCodeUrl: data.qr_code_url || "",
        secret: data.secret || "",
        backup_codes: data.backup_codes ?? [],
      };
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Token is missing or invalid; user is not authenticated."),
    }
  );
};

export const verifyUserOTP = async (code: string): Promise<void> => {
  return apiCall(
    async () => {
      const validatedBody = validateInput(VerifyOTPCodeSchema, {code});
      const {data} = await authV1OtpServiceVerifyOtp({
        body: validatedBody,
        throwOnError: true,
      });

      persistTokens(data);
    },
    {
      [HTTP_STATUS.BAD_REQUEST]: () => new Error("Invalid request format"),
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Token is missing or invalid; user is not authenticated."),
    }
  );
};

export const deleteUserOTP = async (): Promise<void> => {
  return apiCall(
    async () => {
      await authV1OtpServiceDeleteOtp({
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Token is missing or invalid; user is not authenticated."),
    }
  );
};

export const regenerateBackupCodes = async (userId?: string): Promise<BackupCodes> => {
  return apiCall(
    async () => {
      const {data} = await authV1OtpServiceRegenerateBackupCodes({
        query: userId ? {user_id: userId} : undefined,
        throwOnError: true,
      });

      return {
        backup_codes: data.backup_codes ?? [],
      };
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Token is missing or invalid; user is not authenticated."),
    }
  );
};
