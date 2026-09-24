/**
 * Shared test utilities for validation tests
 * Provides reusable validation test patterns
 */

import {expect} from "vite-plus/test";
import {validateInput} from "../../auth/validation/base";

/**
 * Tests that a schema accepts valid input
 */
const expectValidInput = (schema: any, input: any) => {
  const result = validateInput(schema, input);
  expect(result).toEqual(input);
};

/**
 * Tests that a schema rejects invalid input
 */
const expectInvalidInput = (schema: any, input: any) => {
  expect(() => validateInput(schema, input)).toThrow();
};

/**
 * Batch test multiple valid inputs
 */
export const testValidInputs = (schema: any, inputs: any[]) => {
  inputs.forEach((input) => {
    expectValidInput(schema, input);
  });
};

/**
 * Batch test multiple invalid inputs
 */
export const testInvalidInputs = (schema: any, inputs: any[]) => {
  inputs.forEach((input) => {
    expectInvalidInput(schema, input);
  });
};
