import {describe, it, expect} from "vite-plus/test";
import {validateInput} from "../../auth/validation/base";
import {PublicInviteResponseSchema, InviteMemberSchema, UpdateMemberRoleSchema} from "../../auth/validation/membership";

describe("Membership Validation Schemas", () => {
  describe("PublicInviteResponseSchema", () => {
    it("should accept 'accept' state", () => {
      const result = validateInput(PublicInviteResponseSchema, {state: "accept"});
      expect(result).toEqual({state: "accept"});
    });
  });

  describe("InviteMemberSchema", () => {
    it("should validate member invitation", () => {
      const data = {email: "new@example.com", role: "member"};
      const result = validateInput(InviteMemberSchema, data);
      expect(result).toEqual(data);
    });
  });

  describe("UpdateMemberRoleSchema", () => {
    it("should validate role updates", () => {
      expect(validateInput(UpdateMemberRoleSchema, {role: "admin"})).toEqual({role: "admin"});
    });
  });
});
