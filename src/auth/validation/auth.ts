import * as v from "valibot";
import {EmailSchema, PasswordSchema} from "./base";

export const EmailAuthRequestSchema = v.object({
  email: EmailSchema,
  password: PasswordSchema,
});

// Matches auth.v1.RegisterRequest: email, password, country_code?, subscribe_to_blog?
export const RegisterRequestSchema = v.object({
  email: EmailSchema,
  password: PasswordSchema,
  country_code: v.optional(v.string()),
  subscribe_to_blog: v.optional(v.boolean()),
});

export const ResetPasswordRequestSchema = v.object({
  token: v.string(),
  new_password: PasswordSchema,
});

export const LoginOTPVerifyRequestSchema = v.object({
  code: v.pipe(v.string("TOTP or backup code must be text"), v.minLength(1, "TOTP or backup code is required")),
  session_id: v.pipe(v.string("Session ID must be text"), v.minLength(1, "Session ID is required")),
});

export const ResendEmailRequestSchema = v.object({
  email: EmailSchema,
});

export const ChangeEmailRequestSchema = v.object({
  new_email: EmailSchema,
});

export const verifyEmailChangeRequestSchema = v.object({
  code: v.pipe(
    v.string("OTP code must be text"),
    v.minLength(6, "OTP code must be at least 6 characters"),
    v.maxLength(8, "OTP code must be at most 8 characters"),
    v.regex(/^\d+$/, "OTP code must contain only numbers")
  ),
  new_email: v.optional(EmailSchema),
  type: v.union([v.literal("verification"), v.literal("email_change")]),
  verification_id: v.string("Verification ID is required"),
});

/**
 * Social provider schemas
 */
export const ConnectProviderSchema = v.object({
  provider: v.pipe(v.string("Provider must be text"), v.minLength(1, "Provider is required")),
  token: v.pipe(v.string("Token must be text"), v.minLength(1, "Token is required")),
});

/**
 * OTP verification schema (for user OTP operations)
 */
export const VerifyOTPCodeSchema = v.object({
  code: v.pipe(
    v.string("OTP code must be text"),
    v.minLength(6, "OTP code must be at least 6 characters"),
    v.regex(/^\d+$/, "OTP code must contain only numbers")
  ),
});
