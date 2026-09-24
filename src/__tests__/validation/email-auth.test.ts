/**
 * Email authentication validation tests
 * Tests: EmailAuthRequestSchema
 */

import {describe, it} from "vite-plus/test";
import {EmailAuthRequestSchema} from "../../auth/validation/auth";
import {testValidInputs, testInvalidInputs} from "../utils/validation-test-helpers";

describe("EmailAuthRequestSchema", () => {
  describe("Valid inputs", () => {
    it("should accept valid email and password combinations", () => {
      testValidInputs(EmailAuthRequestSchema, [
        {email: "test@example.com", password: "Password123"},
        {email: "user@subdomain.example.com", password: "ValidPass1"},
        {email: "test@example.com", password: "VeryLongPassword123WithManyCharacters"},
        {email: "test+tag@example.com", password: "Password123"},
      ]);
    });
  });

  describe("Invalid inputs", () => {
    it("should reject invalid email formats", () => {
      testInvalidInputs(EmailAuthRequestSchema, [{email: "invalid-email", password: "Password123"}]);
    });

    it("should reject invalid passwords", () => {
      testInvalidInputs(EmailAuthRequestSchema, [
        {email: "test@example.com", password: "Short1"}, // too short
        {email: "test@example.com", password: "lowercase123"}, // no uppercase
        {email: "test@example.com", password: "NoNumberPass"}, // no number
      ]);
    });

    it("should reject missing required fields", () => {
      testInvalidInputs(EmailAuthRequestSchema, [
        {password: "Password123"}, // missing email
        {email: "test@example.com"}, // missing password
      ]);
    });
  });
});
