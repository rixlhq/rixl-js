/**
 * Shared runtime registry tests.
 * The registry is what makes duplicate copies of this package converge on one
 * set of stores, so identity — not just equality — is the thing under test.
 */

import {describe, it, expect, vi} from "vite-plus/test";
import {shared} from "../shared-runtime";

describe("shared", () => {
  it("returns the same value for repeated lookups of one key", () => {
    const first = shared("test.identity", () => ({}));
    const second = shared("test.identity", () => ({}));

    expect(second).toBe(first);
  });

  it("runs the factory only once per key", () => {
    const create = vi.fn(() => ({}));

    shared("test.factory", create);
    shared("test.factory", create);

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("keeps distinct keys independent", () => {
    const a = shared("test.a", () => ({}));
    const b = shared("test.b", () => ({}));

    expect(b).not.toBe(a);
  });

  it("preserves mutations made through any reference", () => {
    const writer = shared("test.mutation", () => ({count: 0}));
    writer.count = 5;

    expect(shared<{count: number}>("test.mutation", () => ({count: 0})).count).toBe(5);
  });

  it("anchors the registry on globalThis so other copies can find it", () => {
    shared("test.anchor", () => "value");

    const registry = (globalThis as Record<symbol, unknown>)[Symbol.for("@rixl/sdk.runtime")];

    expect(registry).toBeDefined();
  });
});
