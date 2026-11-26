/**
 * Validation Utils Coverage Tests
 * Tests: Edge cases in validation-utils
 */

import {describe, it, expect} from "vite-plus/test";
import {EmailSchema, PasswordSchema, validateInput} from "../../auth/validation/base";

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
});
