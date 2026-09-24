import {describe, it, expect} from "vite-plus/test";
import {validateInput} from "../../auth/validation/base";
import {AddDomainSchema, UpdateAutoJoinSchema} from "../../auth/validation/domain";

describe("Domain Validation Schemas", () => {
  describe("AddDomainSchema", () => {
    it("should validate valid domain additions", () => {
      const data = {domain: "company.com"};
      const result = validateInput(AddDomainSchema, data);
      expect(result).toEqual(data);
    });

    it("should reject invalid domain formats", () => {
      expect(() => validateInput(AddDomainSchema, {domain: "invalid_domain"})).toThrow();
    });
  });

  describe("UpdateAutoJoinSchema", () => {
    it("should validate boolean auto-join setting", () => {
      expect(validateInput(UpdateAutoJoinSchema, {enabled: true})).toEqual({enabled: true});
      expect(validateInput(UpdateAutoJoinSchema, {enabled: false})).toEqual({enabled: false});
    });

    it("should reject non-boolean values", () => {
      expect(() => validateInput(UpdateAutoJoinSchema, {enabled: "true"} as any)).toThrow();
    });
  });
});
