import {describe, it, expect, beforeEach, vi, afterEach} from "vite-plus/test";
import {permissions, permissionsResolved, hasPermission, clearPermissions} from "../../auth/permissionStore";
import {resolvePermissions, ensurePermissions, invalidatePermissions} from "../../auth/permissions/resolve";
import * as userModule from "../../auth/user";
import type {UserInfo} from "../../auth/user";

const userInfo = (overrides: Partial<UserInfo> = {}): UserInfo => ({
  id: "user-1",
  username: "tester",
  email: "tester@example.com",
  email_verified: true,
  first_name: "Test",
  last_name: "User",
  image_url: "",
  language_code: "en",
  country_code: "US",
  active_org_id: "org-1",
  policies: [],
  permissions: [],
  ...overrides,
});

describe("permission store", () => {
  beforeEach(() => {
    clearPermissions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts empty so every check denies", () => {
    expect(permissions.get().size).toBe(0);
    expect(hasPermission("media:videos:read")).toBe(false);
  });

  it("notifies subscribers when the set changes", () => {
    const seen: number[] = [];
    const unsubscribe = permissions.subscribe((value) => seen.push(value.size));

    permissions.set(new Set(["media:videos:read"]));
    unsubscribe();

    expect(seen.at(-1)).toBe(1);
  });

  it("answers checks against the held set", () => {
    permissions.set(new Set(["media:videos:write"]));

    expect(hasPermission("media:videos:read")).toBe(true);
    expect(hasPermission("media:images:read")).toBe(false);
  });

  it("empties the set on clear", () => {
    permissions.set(new Set(["media:videos:write"]));
    clearPermissions();

    expect(permissions.get().size).toBe(0);
    expect(hasPermission("media:videos:read")).toBe(false);
  });
});

describe("resolvePermissions", () => {
  beforeEach(() => {
    clearPermissions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("populates the store from userinfo", async () => {
    vi.spyOn(userModule, "getUserInfo").mockResolvedValue(userInfo({permissions: ["media:videos:read", "media:images:write"]}));

    await resolvePermissions();

    expect(permissions.get()).toEqual(new Set(["media:videos:read", "media:images:write"]));
    expect(hasPermission("media:images:read")).toBe(true);
  });

  it("empties the set when userinfo grants nothing", async () => {
    permissions.set(new Set(["media:videos:write"]));
    vi.spyOn(userModule, "getUserInfo").mockResolvedValue(userInfo({permissions: []}));

    await resolvePermissions();

    expect(permissions.get().size).toBe(0);
  });

  it("replaces rather than merges, so a revoked grant disappears", async () => {
    permissions.set(new Set(["media:videos:write", "billing:subscription:write"]));
    vi.spyOn(userModule, "getUserInfo").mockResolvedValue(userInfo({permissions: ["media:videos:write"]}));

    await resolvePermissions();

    expect(hasPermission("billing:subscription:write")).toBe(false);
  });

  it("propagates failure and leaves the held set untouched", async () => {
    permissions.set(new Set(["media:videos:write"]));
    vi.spyOn(userModule, "getUserInfo").mockRejectedValue(new Error("network down"));

    await expect(resolvePermissions()).rejects.toThrow("network down");
    expect(hasPermission("media:videos:write")).toBe(true);
  });
});

describe("permissionsResolved", () => {
  beforeEach(() => {
    clearPermissions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is false before any resolution", () => {
    expect(permissionsResolved.get()).toBe(false);
  });

  it("becomes true once permissions resolve, even when the user holds none", async () => {
    vi.spyOn(userModule, "getUserInfo").mockResolvedValue(userInfo({permissions: []}));

    await resolvePermissions();

    expect(permissionsResolved.get()).toBe(true);
    expect(permissions.get().size).toBe(0);
  });

  it("stays false when resolution fails, so a guard does not act on a non-answer", async () => {
    vi.spyOn(userModule, "getUserInfo").mockRejectedValue(new Error("userinfo down"));

    await expect(resolvePermissions()).rejects.toThrow();

    expect(permissionsResolved.get()).toBe(false);
  });

  it("resets on sign-out", async () => {
    vi.spyOn(userModule, "getUserInfo").mockResolvedValue(userInfo({permissions: ["media:videos:read"]}));
    await resolvePermissions();

    clearPermissions();

    expect(permissionsResolved.get()).toBe(false);
  });
});

describe("ensurePermissions", () => {
  beforeEach(() => {
    clearPermissions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when nothing has been loaded yet", async () => {
    const spy = vi.spyOn(userModule, "getUserInfo").mockResolvedValue(userInfo({permissions: ["media:videos:read"]}));

    await ensurePermissions();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(hasPermission("media:videos:read")).toBe(true);
  });

  it("does not re-request once resolved", async () => {
    const spy = vi.spyOn(userModule, "getUserInfo").mockResolvedValue(userInfo({permissions: []}));
    await ensurePermissions();

    await ensurePermissions();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("shares one request across concurrent callers", async () => {
    const spy = vi.spyOn(userModule, "getUserInfo").mockResolvedValue(userInfo({permissions: []}));

    await Promise.all([ensurePermissions(), ensurePermissions(), ensurePermissions()]);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed resolution", async () => {
    const spy = vi
      .spyOn(userModule, "getUserInfo")
      .mockRejectedValueOnce(new Error("userinfo down"))
      .mockResolvedValue(userInfo({permissions: ["media:videos:read"]}));

    await expect(ensurePermissions()).rejects.toThrow();
    await ensurePermissions();

    expect(spy).toHaveBeenCalledTimes(2);
    expect(hasPermission("media:videos:read")).toBe(true);
  });
});

describe("organization switch", () => {
  beforeEach(() => {
    clearPermissions();
    invalidatePermissions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("discards a response that started before the switch", async () => {
    let releaseOld: (v: UserInfo) => void = () => undefined;
    vi.spyOn(userModule, "getUserInfo").mockReturnValueOnce(
      new Promise<UserInfo>((resolve) => {
        releaseOld = resolve;
      })
    );

    // Resolution for the previous organization begins…
    const stale = resolvePermissions();

    // …then the user switches, invalidating it, and the old response lands late.
    invalidatePermissions();
    releaseOld(userInfo({permissions: ["media:images:read"]}));
    await stale;

    // The old organization's grants must not appear as the new one's.
    expect(permissions.get().size).toBe(0);
    expect(permissionsResolved.get()).toBe(false);
  });

  it("keeps the newer answer when a stale one lands after it", async () => {
    let releaseOld: (v: UserInfo) => void = () => undefined;
    vi.spyOn(userModule, "getUserInfo").mockReturnValueOnce(
      new Promise<UserInfo>((resolve) => {
        releaseOld = resolve;
      })
    );
    const stale = resolvePermissions();

    invalidatePermissions();
    vi.spyOn(userModule, "getUserInfo").mockResolvedValue(userInfo({permissions: ["media:videos:read"]}));
    await resolvePermissions();

    releaseOld(userInfo({permissions: ["media:images:read"]}));
    await stale;

    expect(permissions.get()).toEqual(new Set(["media:videos:read"]));
  });

  it("re-requests after invalidation even though a set was already resolved", async () => {
    const spy = vi.spyOn(userModule, "getUserInfo").mockResolvedValue(userInfo({permissions: []}));
    await ensurePermissions();

    clearPermissions();
    invalidatePermissions();
    await ensurePermissions();

    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("sign-out", () => {
  beforeEach(() => {
    clearPermissions();
    invalidatePermissions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("discards a response that started before a sign-out", async () => {
    let release: (v: UserInfo) => void = () => undefined;
    vi.spyOn(userModule, "getUserInfo").mockReturnValueOnce(
      new Promise<UserInfo>((resolve) => {
        release = resolve;
      })
    );

    const stale = resolvePermissions();

    // `removeTokens` clears the set; the response for the ended session lands after.
    clearPermissions();
    release(userInfo({permissions: ["media:images:read"]}));
    await stale;

    expect(permissions.get().size).toBe(0);
    expect(permissionsResolved.get()).toBe(false);
  });

  it("re-requests after a sign-out rather than joining the ended session's request", async () => {
    let release: (v: UserInfo) => void = () => undefined;
    const spy = vi
      .spyOn(userModule, "getUserInfo")
      .mockReturnValueOnce(
        new Promise<UserInfo>((resolve) => {
          release = resolve;
        })
      )
      .mockResolvedValue(userInfo({permissions: ["media:videos:read"]}));

    const stale = ensurePermissions();
    clearPermissions();
    release(userInfo({permissions: ["media:images:read"]}));
    await stale;

    await ensurePermissions();

    expect(spy).toHaveBeenCalledTimes(2);
    expect(permissions.get()).toEqual(new Set(["media:videos:read"]));
  });
});
