import {describe, it, expect} from "vite-plus/test";
import {validateInput} from "../../auth/validation/base";
import {UpdateUsernameSchema, UpdateNameSchema} from "../../auth/validation/user";

describe("User Validation Schemas", () => {
  describe("UpdateUsernameSchema", () => {
    it("should validate valid username update", () => {
      const data = {username: "newuser123"};
      const result = validateInput(UpdateUsernameSchema, data);
      expect(result).toEqual(data);
    });

    it("should reject invalid usernames", () => {
      expect(() => validateInput(UpdateUsernameSchema, {username: "usr"})).toThrow();
    });
  });

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
