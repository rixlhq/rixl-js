/** Interface for login verify OTP*/
export interface LoginOTPVerifyRequest {
  code: string;
  session_id: string;
}

export interface RegistrationResponse {
  message: string;
  verification_id: string;
  email_verification_sent?: boolean;
  user_id?: string;
}

export interface VerificationSentResponse {
  message: string;
  verification_id: string;
  can_resend_at?: string;
  code_sent?: boolean;
}

interface Token {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface VerifyEmailResponse {
  email: string;
  message: string;
  verified: boolean;
  tokens?: Token;
}

export interface VerifyStatusResponse {
  email: string;
  has_email: boolean;
  verified: boolean;
}

/**
 * Login error response for special cases that require UI action.
 * `provider_exchange_failed` is the catch-all for a provider login the gateway
 * rejected for any other reason; its `message` carries the gateway's own text.
 */
export type LoginErrorCode = "email_not_verified" | "provider_conflict" | "provider_exchange_failed";

export interface LoginErrorResponse {
  error_code: LoginErrorCode;
  message: string;
  email: string;
}

/**
 * OAuth 2.0 error response from token endpoint
 */
export interface OAuth2ErrorResponse {
  // `string & {}` keeps "invalid_grant" in editor suggestions; a bare `| string` absorbs it.
  error: "invalid_grant" | (string & {});
  error_description: string;
}

export type TwoFactorAuthMethod = "passkey" | "totp";

export interface TwoFactorResponse {
  session_id: string;
  email: string;
  authentication: TwoFactorAuthMethod[];
  /** WebAuthn PublicKeyCredentialRequestOptions as base64-encoded JSON (spec `format: byte`). */
  passkey_options?: string;
}
