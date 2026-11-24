import {authV1EmailServiceLogin, authV1OtpServiceVerifyTotpForLogin} from "../../generated/sdk.gen";
import {EmailAuthRequestSchema, LoginOTPVerifyRequestSchema} from "../validation/auth";
import {validateInput} from "../validation/base";
import {ApiError} from "../api/error-handlers";
import {apiCall} from "../api/utils";
import {persistTokens} from "../api/tokens";
import {HTTP_STATUS} from "../constants";
import type {LoginErrorResponse, TwoFactorAuthMethod, TwoFactorResponse} from "./types";
import type {AuthV1LoginResponse} from "../../generated/types.gen";

/**
 * Maps the AuthV1AuthMethod values returned by the gateway to the SDK's
 * lowercase `TwoFactorAuthMethod` domain type. The proto-shaped enum uses
 * `AUTH_METHOD_*`, but the wire has historically emitted the lowercase
 * short form (`"passkey" | "totp"`) — accept both so we're resilient to
 * either serialization.
 */
function toTwoFactorAuthMethods(methods: AuthV1LoginResponse["authentication"]): TwoFactorAuthMethod[] {
  if (!methods) return [];
  const mapped: TwoFactorAuthMethod[] = [];
  // The gateway may send either serialization (see above), so compare as plain strings.
  for (const m of methods as string[]) {
    if (m === "AUTH_METHOD_PASSKEY" || m === "passkey") {
      mapped.push("passkey");
    } else if (m === "AUTH_METHOD_TOTP" || m === "totp") {
      mapped.push("totp");
    }
  }
  return mapped;
}

export const loginWithEmail = async (email: string, password: string): Promise<void | TwoFactorResponse | LoginErrorResponse> => {
  return apiCall(
    async () => {
      const validatedInput = validateInput(EmailAuthRequestSchema, {email, password});
      try {
        const {data} = await authV1EmailServiceLogin({
          body: validatedInput,
          throwOnError: true,
        });

        return handleLoginResponse(data, email);
      } catch (error) {
        return handleLoginError(error, email);
      }
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Incorrect email or password"),
      [HTTP_STATUS.FORBIDDEN]: () => new Error("Account access is restricted"),
    }
  );
};

export const verifyTOTPForLogin = async (code: string, session_id: string): Promise<void> => {
  return apiCall(
    async () => {
      const validatedInput = validateInput(LoginOTPVerifyRequestSchema, {code, session_id});
      const {data} = await authV1OtpServiceVerifyTotpForLogin({
        body: validatedInput,
        throwOnError: true,
      });

      persistTokens(data);
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Invalid or expired TOTP code"),
    }
  );
};

function handleLoginResponse(data: AuthV1LoginResponse, email: string): void | TwoFactorResponse | LoginErrorResponse {
  switch (data.status) {
    case "ok":
      persistTokens(data);
      return;
    case "2fa_required":
      return {
        session_id: data.session_id!,
        email: email,
        authentication: toTwoFactorAuthMethods(data.authentication),
        passkey_options: data.passkey_options,
      };
    case "email_not_verified":
      return {
        error_code: "email_not_verified",
        message: "Email not verified",
        email: data.email || email,
      };
    default:
      return;
  }
}

interface ApiErrorBody {
  error?: string;
  details?: string;
}

function handleLoginError(error: unknown, email: string): TwoFactorResponse | LoginErrorResponse | never {
  // The client error interceptor wraps every thrown body into an ApiError.
  if (error instanceof ApiError && isApiErrorBody(error.data)) {
    const body = error.data;
    if (body.error === "email_not_verified") {
      return {
        error_code: "email_not_verified",
        message: body.details || "Email not verified",
        email,
      };
    }
    if (body.error === "provider_conflict") {
      return {
        error_code: "provider_conflict",
        message: body.details || "Email registered with different provider",
        email,
      };
    }
  }
  throw error;
}

function isApiErrorBody(error: unknown): error is ApiErrorBody {
  return typeof error === "object" && error !== null && "error" in error;
}
