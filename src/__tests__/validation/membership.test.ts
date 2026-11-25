import {describe, it, expect} from "vite-plus/test";
import {validateInput} from "../../auth/validation/base";
import {PublicInviteResponseSchema, InviteMemberSchema, UpdateMemberRoleSchema, ResendInviteSchema} from "../../auth/validation/membership";

describe("Membership Validation Schemas", () => {
  describe("PublicInviteResponseSchema", () => {
    it("should accept 'accept' state", () => {
      const result = validateInput(PublicInviteResponseSchema, {state: "accept"});
      expect(result).toEqual({state: "accept"});
    });
  });

  describe("InviteMemberSchema", () => {
    it("should validate member invitation", () => {
      const data = {username: "newmember", role: "member"};
      const result = validateInput(InviteMemberSchema, data);
      expect(result).toEqual(data);
    });
  });

  describe("UpdateMemberRoleSchema", () => {
    it("should validate role updates", () => {
      expect(validateInput(UpdateMemberRoleSchema, {role: "admin"})).toEqual({role: "admin"});
    });
  });

  describe("ResendInviteSchema", () => {
    it("should validate user ID", () => {
      const result = validateInput(ResendInviteSchema, {user_id: "user-123-456"});
      expect(result).toEqual({user_id: "user-123-456"});
    });
  });
});
