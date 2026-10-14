import {
  authV1EmailServiceInitiateEmailChange,
  authV1EmailServiceAddEmail,
  authV1EmailServiceVerifyEmail,
  authV1EmailServiceGetUserEmailStatus,
} from "../../generated/sdk.gen";
import {ChangeEmailRequestSchema, ResendEmailRequestSchema, verifyEmailChangeRequestSchema} from "../validation/auth";
import {validateInput} from "../validation/base";
import {apiCall} from "../api/utils";
import {persistTokens} from "../api/tokens";
import {limitedAccessToken} from "../authStore";
import {HTTP_STATUS} from "../constants";
import type {VerificationSentResponse, VerifyEmailResponse, VerifyStatusResponse} from "./types";
import type {EmailVerificationType} from "../types";

export const initiateEmailChange = async (email: string): Promise<void | VerificationSentResponse> => {
  return apiCall(
    async () => {
      const validatedInput = validateInput(ChangeEmailRequestSchema, {new_email: email});
      const {data} = await authV1EmailServiceInitiateEmailChange({
        body: validatedInput,
        throwOnError: true,
      });

      if (data.verification_id) {
        return {
          message: data.message || "Verification code sent",
          verification_id: data.verification_id,
          can_resend_at: data.can_resend_at,
          code_sent: data.code_sent,
        };
      }
    },
    {
      [HTTP_STATUS.BAD_REQUEST]: () => new Error("Invalid email or email already in use"),
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Unauthorized - invalid or missing token"),
      [HTTP_STATUS.TOO_MANY_REQUESTS]: () => new Error("Too many requests - please try again later"),
    }
  );
};

export const addEmail = async (email: string): Promise<void | VerificationSentResponse> => {
  return apiCall(
    async () => {
      const validatedInput = validateInput(ResendEmailRequestSchema, {email});
      // A user who still owes an email holds only the limited token, which
      // getToken() withholds, so this call has to carry it explicitly.
      const limitedToken = limitedAccessToken.get();
      const {data} = await authV1EmailServiceAddEmail({
        body: validatedInput,
        ...(limitedToken && {headers: {Authorization: `Bearer ${limitedToken}`}}),
        throwOnError: true,
      });

      if (data.verification_id) {
        return {
          message: data.message || "Verification code sent",
          verification_id: data.verification_id,
          can_resend_at: data.can_resend_at,
          code_sent: data.code_sent,
        };
      }
    },
    {
      [HTTP_STATUS.BAD_REQUEST]: () => new Error("Invalid email address"),
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Session expired - please login again"),
      [HTTP_STATUS.CONFLICT]: () => new Error("Email address is already in use"),
      [HTTP_STATUS.TOO_MANY_REQUESTS]: () => new Error("Too many requests - please try again later"),
    }
  );
};

export interface VerifyEmailWithCodeParams {
  code: string;
  type: EmailVerificationType;
  verification_id: string;
  new_email: string;
}

const normalizeVerifyEmailArgs = (
  args: [VerifyEmailWithCodeParams] | [string, EmailVerificationType, string, string]
): VerifyEmailWithCodeParams => {
  if (isLegacyVerifyEmailArgs(args)) {
    const [code, type, verification_id, new_email] = args;
    return {code, type, verification_id, new_email};
  }

  return args[0];
};

const isLegacyVerifyEmailArgs = (
  args: [VerifyEmailWithCodeParams] | [string, EmailVerificationType, string, string]
): args is [string, EmailVerificationType, string, string] => typeof args[0] === "string";

export const verifyEmailWithCode = async (
  ...args: [VerifyEmailWithCodeParams] | [string, EmailVerificationType, string, string]
): Promise<void | VerifyEmailResponse> => {
  return apiCall(
    async () => {
      const payload = normalizeVerifyEmailArgs(args);

      validateInput(verifyEmailChangeRequestSchema, payload);
      const {data} = await authV1EmailServiceVerifyEmail({
        body: {code: payload.code, verification_id: payload.verification_id},
        throwOnError: true,
      });

      const tokens = data.tokens;
      persistTokens(tokens);

      return {
        email: data.email || "",
        message: data.message || "Email verified",
        verified: data.verified || false,
        tokens: tokens
          ? {
              access_token: tokens.access_token!,
              refresh_token: tokens.refresh_token!,
              expires_in: Number(tokens.expires_in!),
            }
          : undefined,
      };
    },
    {
      [HTTP_STATUS.BAD_REQUEST]: () => new Error("Invalid code or verification ID"),
    }
  );
};

export const getEmailVerificationStatus = async (): Promise<void | VerifyStatusResponse> => {
  return apiCall(
    async () => {
      const {data} = await authV1EmailServiceGetUserEmailStatus({
        throwOnError: true,
      });

      return {
        email: data.email || "",
        has_email: data.has_email ?? false,
        verified: data.verified || false,
      };
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Unauthorized - invalid or missing token"),
    }
  );
};
