import {describe, it, expect} from "vite-plus/test";
import {validateInput} from "../../auth/validation/base";
import {UpdateNameSchema} from "../../auth/validation/user";

describe("User Validation Schemas", () => {
  describe("UpdateNameSchema", () => {
    it("should validate valid name update", () => {
      const data = {full_name: "John Doe"};
      const result = validateInput(UpdateNameSchema, data);
      expect(result).toEqual(data);
    });

    it("should reject invalid names", () => {
      expect(() => validateInput(UpdateNameSchema, {full_name: ""})).toThrow();
    });
  });
});
