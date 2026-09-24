import {describe, it, expect} from "vite-plus/test";
import {matches} from "../../auth/permissions/matcher";

const held = (...values: string[]): ReadonlySet<string> => new Set(values);

describe("matches", () => {
  it("accepts an exact match", () => {
    expect(matches(held("media:videos:read"), "media:videos:read")).toBe(true);
  });

  it("denies when the set is empty", () => {
    expect(matches(held(), "media:videos:read")).toBe(false);
  });

  it("denies a permission held only for another resource", () => {
    expect(matches(held("media:images:write"), "media:videos:read")).toBe(false);
  });

  it("denies a permission held only for another service", () => {
    expect(matches(held("org:videos:write"), "media:videos:read")).toBe(false);
  });

  describe("write implies read", () => {
    it("write satisfies a read check", () => {
      expect(matches(held("media:videos:write"), "media:videos:read")).toBe(true);
    });

    it("read does not satisfy a write check", () => {
      expect(matches(held("media:videos:read"), "media:videos:write")).toBe(false);
    });

    it("write on one resource does not grant read on another", () => {
      expect(matches(held("media:videos:write"), "media:images:read")).toBe(false);
    });
  });

  describe("registry coverage", () => {
    const RESOURCES = [
      "org:members",
      "org:domains",
      "org:policies",
      "media:videos",
      "media:images",
      "media:files",
      "media:feeds",
      "media:posts",
      "project:projects",
      "billing:subscription",
      "credentials:apikeys",
      "credentials:clientauth",
    ];

    it.each(RESOURCES)("%s:write satisfies its own read", (resource) => {
      expect(matches(held(`${resource}:write`), `${resource}:read`)).toBe(true);
    });

    it.each(RESOURCES)("%s:read does not satisfy its own write", (resource) => {
      expect(matches(held(`${resource}:read`), `${resource}:write`)).toBe(false);
    });

    it("analytics is read-only in the registry and still resolves", () => {
      expect(matches(held("analytics:events:read"), "analytics:events:read")).toBe(true);
      expect(matches(held(), "analytics:events:read")).toBe(false);
    });
  });

  describe("unrecognized shapes", () => {
    it("matches a separator-less permission only exactly", () => {
      expect(matches(held("superuser"), "superuser")).toBe(true);
      expect(matches(held("write"), "superuser")).toBe(false);
    });

    it("resolves a two-segment grammar on the last separator", () => {
      expect(matches(held("videos:write"), "videos:read")).toBe(true);
    });

    it("resolves a four-segment grammar on the last separator", () => {
      expect(matches(held("media:eu:videos:write"), "media:eu:videos:read")).toBe(true);
      expect(matches(held("media:us:videos:write"), "media:eu:videos:read")).toBe(false);
    });

    it("fails closed on a verb the registry has not defined here", () => {
      expect(matches(held("media:videos:write"), "media:videos:delete")).toBe(false);
    });

    it("treats a held verb outside the hierarchy as no wider than itself", () => {
      expect(matches(held("media:videos:admin"), "media:videos:read")).toBe(false);
      expect(matches(held("media:videos:manage"), "media:videos:write")).toBe(false);
      expect(matches(held("media:videos:admin"), "media:videos:admin")).toBe(true);
    });
  });
});
