/**
 * Shared type definitions for the auth library
 */

/**
 * Entity types that can be updated (name/username)
 */
export type EntityUpdateType = "name" | "username";

/**
 * Email verification types
 */
export type EmailVerificationType = "verification" | "email_change";

/**
 * Cookie SameSite attribute values
 */
export type CookieSameSite = "strict" | "Strict" | "lax" | "Lax" | "none" | "None" | undefined;

/**
 * User type definition based on JWT payload
 */
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  image_url: string;
  language_code: string;
  org_id: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
}

export interface LimitedScopeTokenResponse {
  access_token: string;
  token_type?: string;
  requires_action: string;
}

/**
 * Actions that may be required from the user
 */
export type RequiresAction = "add_email" | null;
