import {authV1EmailServiceLogin, authV1OtpServiceVerifyTotpForLogin} from "../../generated/sdk.gen";
import {EmailAuthRequestSchema, LoginOTPVerifyRequestSchema} from "../validation/auth";
import {validateInput} from "../validation/base";
import {apiCall} from "../api/utils";
import {persistSignInTokens} from "../api/tokens";
import {HTTP_STATUS} from "../constants";
import type {TwoFactorAuthMethod, TwoFactorResponse} from "./types";
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

export const loginWithEmail = async (email: string, password: string): Promise<void | TwoFactorResponse> => {
  return apiCall(
    async () => {
      const validatedInput = validateInput(EmailAuthRequestSchema, {email, password});
      const {data} = await authV1EmailServiceLogin({
        body: validatedInput,
        throwOnError: true,
      });

      return handleLoginResponse(data, email);
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Incorrect email or password"),
      [HTTP_STATUS.FORBIDDEN]: () => new Error("Account access is restricted"),
    }
  );
};

export const verifyTOTPForLogin = async (code: string, challengeId: string): Promise<void> => {
  return apiCall(
    async () => {
      const validatedInput = validateInput(LoginOTPVerifyRequestSchema, {code, challenge_id: challengeId});
      const {data} = await authV1OtpServiceVerifyTotpForLogin({
        body: validatedInput,
        throwOnError: true,
      });

      persistSignInTokens(data);
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Invalid or expired TOTP code"),
    }
  );
};

function handleLoginResponse(data: AuthV1LoginResponse, email: string): void | TwoFactorResponse {
  switch (data.status) {
    case "ok":
      persistSignInTokens(data);
      return;
    case "2fa_required":
      return {
        challenge_id: data.challenge_id!,
        email: email,
        authentication: toTwoFactorAuthMethods(data.authentication),
        passkey_options: data.passkey_options,
      };
    default:
      return;
  }
}
