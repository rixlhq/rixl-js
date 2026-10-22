import * as v from "valibot";

/**
 * 🛡️ INPUT VALIDATION UTILITY
 * Validates data before API calls and throws user-friendly errors
 */
export const validateInput = <T>(schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>, data: unknown): T => {
  try {
    return v.parse(schema, data);
  } catch (error) {
    if (error instanceof v.ValiError) {
      const firstError = error.issues[0];
      throw new Error(firstError.message);
    }
    throw error;
  }
};

export const EmailSchema = /* @__PURE__ */ v.pipe(
  /* @__PURE__ */ v.string("Email must be text"),
  /* @__PURE__ */ v.email("Please enter a valid email address"),
  /* @__PURE__ */ v.minLength(1, "Email is required")
);

export const PasswordSchema = /* @__PURE__ */ v.pipe(
  /* @__PURE__ */ v.string("Password must be text"),
  /* @__PURE__ */ v.minLength(8, "Password must be at least 8 characters long"),
  /* @__PURE__ */ v.regex(/[A-Z]/, "Password must contain at least one uppercase letter"),
  /* @__PURE__ */ v.regex(/[a-z]/, "Password must contain at least one lowercase letter"),
  /* @__PURE__ */ v.regex(/[0-9]/, "Password must contain at least one number")
);

/**
 * Username validation schema
 * - Must be 4-24 characters
 * - Only letters, numbers, underscores, and periods
 */
export const UsernameSchema = /* @__PURE__ */ v.pipe(
  /* @__PURE__ */ v.string("Username must be text"),
  /* @__PURE__ */ v.minLength(4, "Username must be 4-24 characters long"),
  /* @__PURE__ */ v.maxLength(24, "Username must be 4-24 characters long"),
  /* @__PURE__ */ v.regex(/^[a-z0-9_.]+$/, "Username can only contain lowercase letters, numbers, dots and underscores")
);

/**
 * Name validation schema
 * - Must be 1-30 characters
 */
export const NameSchema = /* @__PURE__ */ v.pipe(
  /* @__PURE__ */ v.string("Name must be text"),
  /* @__PURE__ */ v.minLength(1, "Name must be 1-30 characters long"),
  /* @__PURE__ */ v.maxLength(30, "Name must be 1-30 characters long")
);

/**
 * Domain validation schema
 * - Must be lowercase
 * - Must contain at least one dot
 * - Only alphanumeric characters, hyphens, and dots
 * - Cannot start or end with hyphen in any part
 */
export const DomainSchema = /* @__PURE__ */ v.pipe(
  /* @__PURE__ */ v.string("Domain must be text"),
  /* @__PURE__ */ v.trim(),
  /* @__PURE__ */ v.toLowerCase(),
  /* @__PURE__ */ v.minLength(1, "Domain is required"),
  /* @__PURE__ */ v.regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
    "Invalid domain format. Please enter a valid domain like company.com"
  )
);
