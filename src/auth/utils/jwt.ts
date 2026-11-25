import {decodeJwt} from "jose";
import type {User} from "../types";
import {user} from "../userStore";

/**
 * Decodes a JWT token and extracts user information
 * Uses jose library for modern, secure JWT handling
 * @param token The JWT token to decode
 * @returns The decoded user data or undefined if decoding fails
 */
export const decodeToken = (token: string): User | undefined => {
  try {
    const decodedUser = decodeJwt(token);
    return {
      id: decodedUser.id as string,
      email: decodedUser.email as string,
      first_name: decodedUser.first_name as string,
      last_name: decodedUser.last_name as string,
      username: decodedUser.username as string,
      image_url: decodedUser.image_url as string,
      language_code: decodedUser.language_code as string,
    };
  } catch (error) {
    // Only log in non-test environments to reduce test noise
    if (process.env.NODE_ENV !== "test") {
      console.warn("Failed to decode JWT token. Error: ", error);
    }
    return undefined;
  }
};

export interface OrgClaims {
  userId: string;
  signInId: string;
  orgId: string;
  role: string;
}

/** The claims that say which org an access token is for. */
export const decodeOrgClaims = (token: string): OrgClaims | undefined => {
  try {
    const {
      id,
      sign_in_id: signInId,
      org_id: orgId,
      role,
    } = decodeJwt<Record<"id" | "sign_in_id" | "org_id" | "role", string | undefined>>(token);
    return orgId ? {userId: id ?? "", signInId: signInId ?? "", orgId, role: role ?? ""} : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Decodes a JWT token and sets the user in the store
 * @param token The JWT token to decode
 * @returns True if user was successfully decoded and set, false otherwise
 */
export const decodeAndSetUser = (token: string): boolean => {
  const userData = decodeToken(token);
  if (userData) {
    user.set(userData);
    return true;
  }
  return false;
};

/**
 * Checks if a token is expired based on the expiration timestamp
 * @param expireAt The expiration timestamp in milliseconds
 * @returns True if the token is expired, false otherwise
 */
export const isTokenExpired = (expireAt: number | undefined): boolean => {
  if (!expireAt) return true;
  return Date.now() >= expireAt;
};
