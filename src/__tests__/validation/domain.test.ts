import {describe, it, expect} from "vite-plus/test";
import {validateInput} from "../../auth/validation/base";
import {AddDomainSchema, UpdateSuggestJoinSchema} from "../../auth/validation/domain";

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

  describe("UpdateSuggestJoinSchema", () => {
    it("should validate boolean join suggestion setting", () => {
      expect(validateInput(UpdateSuggestJoinSchema, {enabled: true})).toEqual({enabled: true});
      expect(validateInput(UpdateSuggestJoinSchema, {enabled: false})).toEqual({enabled: false});
    });

    it("should reject non-boolean values", () => {
      expect(() => validateInput(UpdateSuggestJoinSchema, {enabled: "true"} as any)).toThrow();
    });
  });
});
