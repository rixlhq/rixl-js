/**
 * Initialization Tests
 * Tests: createDeferred, initDeferred
 */

import {describe, it, expect, vi} from "vite-plus/test";
import {createDeferred} from "../auth/initialization";

describe("Initialization", () => {
  describe("createDeferred", () => {
    it("should create a deferred promise object", () => {
      const deferred = createDeferred();

      expect(deferred).toHaveProperty("promise");
      expect(deferred).toHaveProperty("resolve");
      expect(deferred).toHaveProperty("reject");
      expect(deferred.promise).toBeInstanceOf(Promise);
      expect(typeof deferred.resolve).toBe("function");
      expect(typeof deferred.reject).toBe("function");
    });

    it("should resolve the promise when resolve is called", async () => {
      const deferred = createDeferred();
      let resolved = false;

      deferred.promise.then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);
      deferred.resolve();

      await deferred.promise;
      expect(resolved).toBe(true);
    });

    it("should reject the promise when reject is called", async () => {
      const deferred = createDeferred();
      const error = new Error("Test error");
      let rejected = false;

      deferred.promise.catch((err) => {
        rejected = true;
        expect(err).toBe(error);
      });

      expect(rejected).toBe(false);
      deferred.reject(error);

      try {
        await deferred.promise;
      } catch {
        // Expected
      }

      expect(rejected).toBe(true);
    });

    it("should allow awaiting the promise before resolve", async () => {
      const deferred = createDeferred();

      setTimeout(() => {
        deferred.resolve();
      }, 10);

      await expect(deferred.promise).resolves.toBeUndefined();
    });

    it("should allow multiple awaits on the same promise", async () => {
      const deferred = createDeferred();
      deferred.resolve();

      await expect(deferred.promise).resolves.toBeUndefined();
      await expect(deferred.promise).resolves.toBeUndefined();
      await expect(deferred.promise).resolves.toBeUndefined();
    });

    it("should create independent deferred instances", () => {
      const deferred1 = createDeferred();
      const deferred2 = createDeferred();

      expect(deferred1.promise).not.toBe(deferred2.promise);
      expect(deferred1.resolve).not.toBe(deferred2.resolve);
      expect(deferred1.reject).not.toBe(deferred2.reject);
    });

    it("should handle reject with no reason", async () => {
      const deferred = createDeferred();

      deferred.reject();

      await expect(deferred.promise).rejects.toBeUndefined();
    });

    it("should handle reject with string reason", async () => {
      const deferred = createDeferred();

      deferred.reject("Something went wrong");

      await expect(deferred.promise).rejects.toBe("Something went wrong");
    });

    it("should handle reject with custom object", async () => {
      const deferred = createDeferred();
      const customError = {code: 500, message: "Server error"};

      deferred.reject(customError);

      await expect(deferred.promise).rejects.toEqual(customError);
    });
  });

  describe("initDeferred", () => {
    // A second evaluation of the module stands in for a second copy of the
    // package, which is what a bundler produces when it inlines the SDK into an
    // optimized dependency.
    const loadSecondCopy = async () => {
      vi.resetModules();
      return (await import("../auth/initialization")).initDeferred;
    };

    it("hands every copy of the package the same deferred", async () => {
      const first = (await import("../auth/initialization")).initDeferred;

      expect(await loadSecondCopy()).toBe(first);
    });

    it("lets a copy that never ran connect() observe initialization", async () => {
      const other = await loadSecondCopy();
      const observed = other.promise.then(() => "settled");

      (await import("../auth/initialization")).initDeferred.resolve();

      await expect(observed).resolves.toBe("settled");
    });
  });
});
