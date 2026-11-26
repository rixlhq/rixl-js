/**
 * Name validation tests
 * Tests: UpdateNameSchema
 */

import {describe, it} from "vite-plus/test";
import {UpdateNameSchema} from "../../auth/validation/user";
import {testValidInputs, testInvalidInputs} from "../utils/validation-test-helpers";

describe("UpdateNameSchema", () => {
  describe("Valid inputs", () => {
    it("should accept valid name formats", () => {
      testValidInputs(UpdateNameSchema, [
        {full_name: "John Doe"},
        {full_name: "A"}, // single character (minimum)
        {full_name: "a".repeat(30)}, // exactly 30 characters (maximum)
        {full_name: "Jean-Paul O'Brien"}, // with special characters
      ]);
    });
  });

  describe("Invalid inputs", () => {
    it("should reject invalid name formats", () => {
      testInvalidInputs(UpdateNameSchema, [
        {full_name: "a".repeat(31)}, // too long
        {full_name: ""}, // empty
      ]);
    });
  });
});
