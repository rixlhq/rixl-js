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

export const EmailSchema = v.pipe(
  v.string("Email must be text"),
  v.email("Please enter a valid email address"),
  v.minLength(1, "Email is required")
);

export const PasswordSchema = v.pipe(
  v.string("Password must be text"),
  v.minLength(8, "Password must be at least 8 characters long"),
  v.regex(/[A-Z]/, "Password must contain at least one uppercase letter"),
  v.regex(/[a-z]/, "Password must contain at least one lowercase letter"),
  v.regex(/[0-9]/, "Password must contain at least one number")
);

/**
 * Username validation schema
 * - Must be 4-24 characters
 * - Only letters, numbers, underscores, and periods
 */
export const UsernameSchema = v.pipe(
  v.string("Username must be text"),
  v.minLength(4, "Username must be 4-24 characters long"),
  v.maxLength(24, "Username must be 4-24 characters long"),
  v.regex(/^[a-z0-9_.]+$/, "Username can only contain lowercase letters, numbers, dots and underscores")
);

/**
 * Name validation schema
 * - Must be 1-30 characters
 */
export const NameSchema = v.pipe(
  v.string("Name must be text"),
  v.minLength(1, "Name must be 1-30 characters long"),
  v.maxLength(30, "Name must be 1-30 characters long")
);

/**
 * Domain validation schema
 * - Must be lowercase
 * - Must contain at least one dot
 * - Only alphanumeric characters, hyphens, and dots
 * - Cannot start or end with hyphen in any part
 */
export const DomainSchema = v.pipe(
  v.string("Domain must be text"),
  v.trim(),
  v.toLowerCase(),
  v.minLength(1, "Domain is required"),
  v.regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
    "Invalid domain format. Please enter a valid domain like company.com"
  )
);
