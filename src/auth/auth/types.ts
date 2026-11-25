export interface RegistrationResponse {
  message: string;
  verification_id: string;
  email_verification_sent?: boolean;
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
  /** auth-api stores an account's email only once it is verified. */
  has_email: boolean;
}

/**
 * Login error response for special cases that require UI action.
 * `provider_exchange_failed` is the catch-all for a provider login the gateway
 * rejected for any other reason; its `message` carries the gateway's own text.
 */
export type LoginErrorCode = "provider_conflict" | "provider_exchange_failed";

export interface LoginErrorResponse {
  error_code: LoginErrorCode;
  message: string;
}

export type TwoFactorAuthMethod = "passkey" | "totp";

export interface TwoFactorResponse {
  challenge_id: string;
  email: string;
  authentication: TwoFactorAuthMethod[];
  /** WebAuthn PublicKeyCredentialRequestOptions as base64-encoded JSON (spec `format: byte`). */
  passkey_options?: string;
}
