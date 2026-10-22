import * as v from "valibot";
import {EmailSchema, PasswordSchema} from "./base";

export const EmailAuthRequestSchema = /* @__PURE__ */ v.object({
  email: EmailSchema,
  password: PasswordSchema,
});

// Matches auth.v1.RegisterRequest: email, password, country_code?, subscribe_to_blog?
export const RegisterRequestSchema = /* @__PURE__ */ v.object({
  email: EmailSchema,
  password: PasswordSchema,
  country_code: /* @__PURE__ */ v.optional(/* @__PURE__ */ v.string()),
  subscribe_to_blog: /* @__PURE__ */ v.optional(/* @__PURE__ */ v.boolean()),
});

export const ResetPasswordRequestSchema = /* @__PURE__ */ v.object({
  token: /* @__PURE__ */ v.string(),
  new_password: PasswordSchema,
});

export const LoginOTPVerifyRequestSchema = /* @__PURE__ */ v.object({
  code: /* @__PURE__ */ v.pipe(
    /* @__PURE__ */ v.string("TOTP or backup code must be text"),
    /* @__PURE__ */ v.minLength(1, "TOTP or backup code is required")
  ),
  session_id: /* @__PURE__ */ v.pipe(
    /* @__PURE__ */ v.string("Session ID must be text"),
    /* @__PURE__ */ v.minLength(1, "Session ID is required")
  ),
});

export const ResendEmailRequestSchema = /* @__PURE__ */ v.object({
  email: EmailSchema,
});

export const ChangeEmailRequestSchema = /* @__PURE__ */ v.object({
  new_email: EmailSchema,
});

export const verifyEmailChangeRequestSchema = /* @__PURE__ */ v.object({
  code: /* @__PURE__ */ v.pipe(
    /* @__PURE__ */ v.string("OTP code must be text"),
    /* @__PURE__ */ v.minLength(6, "OTP code must be at least 6 characters"),
    /* @__PURE__ */ v.maxLength(8, "OTP code must be at most 8 characters"),
    /* @__PURE__ */ v.regex(/^\d+$/, "OTP code must contain only numbers")
  ),
  new_email: /* @__PURE__ */ v.optional(EmailSchema),
  type: /* @__PURE__ */ v.union([/* @__PURE__ */ v.literal("verification"), /* @__PURE__ */ v.literal("email_change")]),
  verification_id: /* @__PURE__ */ v.string("Verification ID is required"),
});

/**
 * Social provider schemas
 */
export const ConnectProviderSchema = /* @__PURE__ */ v.object({
  provider: /* @__PURE__ */ v.pipe(
    /* @__PURE__ */ v.string("Provider must be text"),
    /* @__PURE__ */ v.minLength(1, "Provider is required")
  ),
  token: /* @__PURE__ */ v.pipe(/* @__PURE__ */ v.string("Token must be text"), /* @__PURE__ */ v.minLength(1, "Token is required")),
});

/**
 * OTP verification schema (for user OTP operations)
 */
export const VerifyOTPCodeSchema = /* @__PURE__ */ v.object({
  code: /* @__PURE__ */ v.pipe(
    /* @__PURE__ */ v.string("OTP code must be text"),
    /* @__PURE__ */ v.minLength(6, "OTP code must be at least 6 characters"),
    /* @__PURE__ */ v.regex(/^\d+$/, "OTP code must contain only numbers")
  ),
});
