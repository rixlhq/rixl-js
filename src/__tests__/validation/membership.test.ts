import {describe, it, expect} from "vite-plus/test";
import {validateInput} from "../../auth/validation/base";
import {UpdateMemberRoleSchema} from "../../auth/validation/membership";

describe("Membership Validation Schemas", () => {
  describe("UpdateMemberRoleSchema", () => {
    it("should validate role updates", () => {
      expect(validateInput(UpdateMemberRoleSchema, {role: "admin"})).toEqual({role: "admin"});
    });
  });
});
