import {
  authV1EmailServiceInitiateEmailChange,
  authV1EmailServiceAddEmail,
  authV1EmailServiceVerifyEmail,
  authV1EmailServiceGetUserEmailStatus,
} from "../../generated/sdk.gen";
import {ChangeEmailRequestSchema, ResendEmailRequestSchema, VerifyEmailCodeSchema} from "../validation/auth";
import {validateInput} from "../validation/base";
import {apiCall} from "../api/utils";
import {client} from "../../generated/client.gen";
import type {AuthV1VerifyEmailResponse} from "../../generated/types.gen";
import {captureSignInContext, isSignInContextCurrent} from "../sign-in-context";
import {ApiError} from "../api/types";
import {persistSignInTokens, reissueTokens} from "../api/tokens";
import {limitedAccessToken} from "../authStore";
import {HTTP_STATUS} from "../constants";
import type {VerificationSentResponse, VerifyEmailResponse, VerifyStatusResponse} from "./types";

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
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Sign-in expired - please log in again"),
      [HTTP_STATUS.CONFLICT]: () => new Error("Email address is already in use"),
      [HTTP_STATUS.TOO_MANY_REQUESTS]: () => new Error("Too many requests - please try again later"),
    }
  );
};

export interface VerifyEmailWithCodeParams {
  verification_id: string;
  code: string;
}

const signupVerificationPath = "/auth/v1/email/verify";
const emailChangeVerificationPath = "/auth/v1/users/current/emails/verify";

const verifiedResponse = (data: AuthV1VerifyEmailResponse, applied: boolean): VerifyEmailResponse => {
  const tokens = applied ? data.tokens : undefined;
  return {
    email: data.email || "",
    message: data.message || "Email verified",
    verified: data.verified || false,
    tokens: tokens
      ? {access_token: tokens.access_token!, refresh_token: tokens.refresh_token!, expires_in: Number(tokens.expires_in)}
      : undefined,
  };
};

const verifyEmailErrors = {
  [HTTP_STATUS.BAD_REQUEST]: () => new Error("Invalid code or verification ID"),
};

/** Verifies a pending signup and starts its sign-in while the initiating browser context is current. */
export const verifyEmailWithCode = (params: VerifyEmailWithCodeParams): Promise<VerifyEmailResponse> =>
  apiCall(async () => {
    const body = validateInput(VerifyEmailCodeSchema, params);
    const context = captureSignInContext();
    const {data} = await authV1EmailServiceVerifyEmail({body, throwOnError: true});

    if (!isSignInContextCurrent(context)) {
      throw new ApiError("The sign-in changed during signup verification", HTTP_STATUS.CONFLICT, signupVerificationPath);
    }
    return verifiedResponse(data, persistSignInTokens(data.tokens));
  }, verifyEmailErrors);

/** Verifies a pending email change and reissues the caller's existing sign-in. */
export const verifyEmailChange = (verificationId: string, code: string): Promise<VerifyEmailResponse> =>
  apiCall(async () => {
    const body = validateInput(VerifyEmailCodeSchema, {verification_id: verificationId, code});
    const {response, applied} = await reissueTokens(
      // Replace with the generated operation once the gateway publishes the #253 route.
      (headers) =>
        client.post<{200: AuthV1VerifyEmailResponse}, unknown, true>({
          url: emailChangeVerificationPath,
          body,
          headers: {...headers, "Content-Type": "application/json"},
          responseStyle: "fields",
          throwOnError: true,
        }),
      ({data}) => data.tokens,
      {allowLimited: true}
    );
    return verifiedResponse(response.data, applied);
  }, verifyEmailErrors);

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
