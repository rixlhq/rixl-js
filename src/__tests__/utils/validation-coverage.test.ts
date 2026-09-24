/**
 * Validation Utils Coverage Tests
 * Tests: Edge cases in validation-utils
 */

import {describe, it, expect} from "vite-plus/test";
import {EmailSchema, PasswordSchema, UsernameSchema, validateInput} from "../../auth/validation/base";

describe("Validation Utils - Coverage", () => {
  describe("validateInput", () => {
    it("should throw user-friendly error on validation failure", () => {
      expect(() => {
        validateInput(EmailSchema, "not-an-email");
      }).toThrow();
    });

    it("should throw error for empty email", () => {
      expect(() => {
        validateInput(EmailSchema, "");
      }).toThrow();
    });

    it("should throw error for invalid password", () => {
      expect(() => {
        validateInput(PasswordSchema, "weak");
      }).toThrow();
    });

    it("should pass valid email", () => {
      const result = validateInput(EmailSchema, "test@example.com");
      expect(result).toBe("test@example.com");
    });

    it("should handle non-ValiError exceptions", () => {
      // Test that the function properly rethrows non-ValiError exceptions
      // This covers the else branch in the catch block
      expect(() => {
        validateInput(EmailSchema, 123); // Wrong type will cause error
      }).toThrow();
    });
  });

  describe("UsernameSchema validation", () => {
    it("should reject empty username", () => {
      expect(() => {
        validateInput(UsernameSchema, "");
      }).toThrow();
    });

    it("should reject too short username", () => {
      expect(() => {
        validateInput(UsernameSchema, "abc");
      }).toThrow();
    });

    it("should reject too long username", () => {
      const longUsername = "a".repeat(25);
      expect(() => {
        validateInput(UsernameSchema, longUsername);
      }).toThrow();
    });

    it("should reject username with spaces", () => {
      expect(() => {
        validateInput(UsernameSchema, "user name");
      }).toThrow();
    });

    it("should reject username with special characters", () => {
      expect(() => {
        validateInput(UsernameSchema, "user@name");
      }).toThrow();
    });

    it("should accept valid username with numbers", () => {
      const result = validateInput(UsernameSchema, "user123");
      expect(result).toBe("user123");
    });

    it("should accept valid username with underscores", () => {
      const result = validateInput(UsernameSchema, "user_name");
      expect(result).toBe("user_name");
    });

    it("should accept valid username with periods", () => {
      const result = validateInput(UsernameSchema, "user.name");
      expect(result).toBe("user.name");
    });
  });
});
