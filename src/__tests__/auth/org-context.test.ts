/**
 * Tab-local org context (openspec: adopt-organization-context, org-token-context).
 * Each tab is its own copy of the SDK with its own sessionStorage; all tabs share
 * the cookie jar, as browser tabs do.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {ACCESS_LIFETIME_SECONDS, PERSONAL_ORG, createFakeAuth, orgOf} from "../setup/fake-auth";
import {LOGOUT_CHANNEL, createTabStorage, openTab, type Tab} from "../setup/tabs";

const mocks = vi.hoisted(() => ({refresh: vi.fn(), userInfo: vi.fn(), login: vi.fn(), apiTypes: undefined as unknown}));

// One ApiError class for every tab, so the fake server's errors pass each tab's instanceof checks.
vi.mock("../../auth/api/types", async (importOriginal) => (mocks.apiTypes ??= await importOriginal()));
vi.mock("../../generated/sdk.gen", () => ({
  authV1TokenServiceRefreshToken: mocks.refresh,
  authV1UserServiceGetUserInfo: mocks.userInfo,
  authV1EmailServiceLogin: mocks.login,
}));

const TAB_ORG_KEY = "__rixl_auth_orgId";

let server: ReturnType<typeof createFakeAuth>;

const signIn = async () => {
  const tab = await openTab();
  tab.use().persistSignInTokens(server.signIn());
  return tab;
};

const expireAccessTokens = () => vi.setSystemTime(Date.now() + ACCESS_LIFETIME_SECONDS * 1000 + 1);

const sentOrgs = () => server.requests.map((request) => request.org_id);

beforeEach(() => {
  vi.useFakeTimers({toFake: ["Date"]});
  server = createFakeAuth();
  mocks.refresh.mockReset().mockImplementation(server.refresh);
  mocks.userInfo.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Each tab has its own org and access token", () => {
  it("Two tabs on different orgs", async () => {
    const first = await signIn();
    const second = await openTab();

    await first.use().selectOrganization("org-a");
    await second.use().selectOrganization("org-b");

    expect(orgOf(await first.use().getToken())).toBe("org-a");
    expect(orgOf(await second.use().getToken())).toBe("org-b");

    expireAccessTokens();
    expect(orgOf(await first.use().getToken())).toBe("org-a");
    expect(orgOf(await second.use().getToken())).toBe("org-b");
    expect(orgOf(await first.use().getToken())).toBe("org-a");
  });

  it("Reload keeps the tab's org", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-b");

    const reloaded = await openTab(tab.storage);
    server.requests.length = 0;

    expect(orgOf(await reloaded.use().getToken())).toBe("org-b");
    expect(sentOrgs()).toEqual(["org-b"]);
  });

  it("keeps the access token out of the shared cookie and sessionStorage", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-b");
    const token = await tab.use().getToken();

    expect(document.cookie).not.toContain(token!);
    expect(document.cookie).not.toContain("__rixl_auth_accessToken");
    // The org, and the sign-in it belongs to.
    expect(tab.storage.length).toBe(2);
    expect(tab.storage.getItem(TAB_ORG_KEY)).toBe("org-b");
  });

  it("drops the tab's org when the user signs out", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-b");

    tab.use().removeTokens();

    expect(tab.storage.getItem(TAB_ORG_KEY)).toBeNull();
    expect(tab.use().orgContext.get()).toBeUndefined();
    await expect(tab.use().getToken()).resolves.toBeUndefined();
  });

  it("keeps working when sessionStorage is blocked", async () => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    const tab = await openTab({...createTabStorage(), getItem: blocked, setItem: blocked, removeItem: blocked});
    tab.use().persistSignInTokens(server.signIn());

    await tab.use().selectOrganization("org-b");
    expireAccessTokens();

    expect(orgOf(await tab.use().getToken())).toBe("org-b");
  });
});

describe("Refresh names the org", () => {
  it("sends the sign-in token's org from a tab that never selected one", async () => {
    await signIn();
    const newTab = await openTab();

    expect(orgOf(await newTab.use().getToken())).toBe(PERSONAL_ORG);
    expect(sentOrgs()).toEqual([PERSONAL_ORG]);
  });

  it("keeps a new tab on the personal org after tokens are reissued on another org", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-b");
    // Connecting a provider or confirming TOTP reissues tokens for the caller's org.
    tab.use().persistTestReissue(server.reissue("org-b"));
    server.requests.length = 0;

    const newTab = await openTab();

    expect(orgOf(await newTab.use().getToken())).toBe(PERSONAL_ORG);
  });

  it("Refresh after another tab rotated", async () => {
    const first = await signIn();
    await first.use().selectOrganization("org-a");
    const second = await openTab();
    await second.use().selectOrganization("org-b");
    const rotatedByOtherTab = second.use().refreshToken.get();
    expireAccessTokens();
    server.requests.length = 0;

    const token = await first.use().getToken();

    expect(orgOf(token)).toBe("org-a");
    expect(server.requests).toEqual([{token_type: "Bearer", refresh_token: rotatedByOtherTab, org_id: "org-a"}]);
  });

  it("never takes another tab's access token while its own is valid", async () => {
    const first = await signIn();
    await first.use().selectOrganization("org-a");
    const ownToken = await first.use().getToken();

    const second = await openTab();
    await second.use().selectOrganization("org-b");

    await expect(first.use().getToken()).resolves.toBe(ownToken);
    expect(first.use().refreshToken.get()).toBe(second.use().refreshToken.get());
  });

  it("retries once with the token another tab rotated while this refresh was in flight", async () => {
    const first = await signIn();
    const second = await openTab();
    await first.use().selectOrganization("org-a");
    expireAccessTokens();
    mocks.refresh.mockImplementationOnce(async (request: Parameters<typeof server.refresh>[0]) => {
      // Without a lock, the other tab's refresh lands first.
      await second.use().selectOrganization("org-b");
      first.use();
      return server.refresh(request);
    });

    expect(orgOf(await first.use().getToken())).toBe("org-a");
    expect(first.use().isLogged.get()).toBe(true);
  });
});

describe("selectOrganization", () => {
  it("Switching org", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-a");
    tab.use().permissions.set(new Set(["videos:read"]));
    tab.use().permissionsResolved.set(true);

    await tab.use().selectOrganization("org-b");

    expect(orgOf(await tab.use().getToken())).toBe("org-b");
    expect(tab.use().orgContext.get()).toEqual({orgId: "org-b", role: "member"});
    expect(tab.use().permissions.get().size).toBe(0);
    expect(tab.use().permissionsResolved.get()).toBe(false);
  });

  it("clears permissions when the same org is selected again, since the role may have changed", async () => {
    const tab = await signIn();
    tab.use().permissionsResolved.set(true);

    await tab.use().selectOrganization(PERSONAL_ORG);

    expect(tab.use().permissionsResolved.get()).toBe(false);
  });

  it.each([
    ["another org", "org-b"],
    ["the same org", "org-a"],
  ])("keeps the permissions an orgContext subscriber resolves when selecting %s", async (_label, orgId) => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-a");
    mocks.userInfo.mockImplementation(async () => {
      // The request interceptor asks for a token before sending.
      await tab.use().getToken();
      return {data: {permissions: ["videos:read"]}};
    });
    tab.use().permissions.set(new Set(["videos:write"]));
    tab.use().permissionsResolved.set(true);
    let resolving: Promise<void> | undefined;
    const unsubscribe = tab.use().orgContext.listen(() => {
      resolving = tab.use().ensurePermissions();
    });

    await tab.use().selectOrganization(orgId);
    await resolving;
    // Later tests sign this tab out too, over the logout channel.
    unsubscribe();

    expect(resolving).toBeDefined();
    expect(tab.use().permissionsResolved.get()).toBe(true);
    expect(tab.use().permissions.get()).toEqual(new Set(["videos:read"]));
  });

  it("runs after a refresh already in flight, so the tab ends on the selected org", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-a");
    expireAccessTokens();

    const [, token] = await Promise.all([
      tab.use().getToken(),
      tab
        .use()
        .selectOrganization("org-b")
        .then(() => tab.use().getToken()),
    ]);

    expect(orgOf(token)).toBe("org-b");
    expect(tab.storage.getItem(TAB_ORG_KEY)).toBe("org-b");
    expect(tab.use().isLogged.get()).toBe(true);
  });

  it("keeps the tab's org when the refresh fails", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-a");
    const token = await tab.use().getToken();
    mocks.refresh.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(tab.use().selectOrganization("org-b")).rejects.toThrow("Failed to fetch");

    await expect(tab.use().getToken()).resolves.toBe(token);
    expect(tab.storage.getItem(TAB_ORG_KEY)).toBe("org-a");
  });

  it("rejects without a sign-in", async () => {
    const tab = await openTab();

    await expect(tab.use().selectOrganization("org-a")).rejects.toMatchObject({status: 401});
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("rejects an empty org ID without sending it", async () => {
    const tab = await signIn();

    await expect(tab.use().selectOrganization("")).rejects.toThrow("organization ID");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(tab.use().isLogged.get()).toBe(true);
  });

  it("rejects when the refresh asks for an action instead of issuing tokens", async () => {
    const tab = await signIn();
    mocks.refresh.mockResolvedValueOnce({data: {access_token: "limited", requires_action: "add_email"}});

    await expect(tab.use().selectOrganization("org-a")).rejects.toThrow("not selected");
    expect(tab.storage.getItem(TAB_ORG_KEY)).toBe(PERSONAL_ORG);
  });
});

describe("Org claims are tab state", () => {
  it("Another tab changes org", async () => {
    const first = await signIn();
    await first.use().selectOrganization("org-a");
    first.use().permissions.set(new Set(["videos:read"]));
    first.use().permissionsResolved.set(true);
    const second = await openTab();

    await second.use().selectOrganization("org-b");
    await first.use().getToken();

    expect(first.use().orgContext.get()).toEqual({orgId: "org-a", role: "member"});
    expect(first.use().permissions.get()).toEqual(new Set(["videos:read"]));
    expect(first.use().permissionsResolved.get()).toBe(true);

    // Not even after the tab adopts the rotated refresh token and refreshes.
    expireAccessTokens();
    await first.use().getToken();
    expect(first.use().orgContext.get()).toEqual({orgId: "org-a", role: "member"});
    expect(first.use().permissionsResolved.get()).toBe(true);
  });

  it("keeps org claims out of the shared user", async () => {
    const tab = await signIn();
    await tab.use().getToken();
    const {user} = await import("../../auth/userStore");

    expect(user.get()).not.toHaveProperty("org_id");
    expect(localStorage.getItem("__rixl_auth_user")).not.toContain("org");
  });

  it("drops permissions when another user signed in on another tab", async () => {
    const first = await signIn();
    await first.use().getToken();
    first.use().permissionsResolved.set(true);
    const second = await openTab();
    second.use().persistSignInTokens(server.signIn("user-2"));
    expireAccessTokens();

    await first.use().getToken();

    expect(first.use().permissionsResolved.get()).toBe(false);
  });

  it("keeps a permission answer whose request triggered the first refresh after a reload", async () => {
    const tab = await signIn();
    const reloaded = await openTab(tab.storage);
    mocks.userInfo.mockImplementation(async () => {
      // The request interceptor asks for a token before sending.
      await reloaded.use().getToken();
      return {data: {permissions: ["videos:read"]}};
    });

    await reloaded.use().resolvePermissions();

    expect(reloaded.use().permissionsResolved.get()).toBe(true);
    expect(reloaded.use().permissions.get()).toEqual(new Set(["videos:read"]));
  });
});

const refusalOf = async (call: Promise<unknown>) => {
  const error = await call.then(
    () => undefined,
    (thrown: unknown) => thrown
  );
  expect(error).toBeInstanceOf(Error);
  const {name, status, reason, orgId} = error as {name: string; status: number; reason: string; orgId: string};
  return {name, status, reason, orgId};
};

const refusal = (reason: string, orgId: string) => ({name: "OrgAccessError", status: 403, reason, orgId});

describe("An unavailable org rejects with its reason", () => {
  it("Selecting an org that removed the user", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-a");
    const token = await tab.use().getToken();
    const heldRefreshToken = tab.use().refreshToken.get();
    server.refusals.set("org-b", "NOT_A_MEMBER");
    server.requests.length = 0;

    expect(await refusalOf(tab.use().selectOrganization("org-b"))).toEqual(refusal("NOT_A_MEMBER", "org-b"));

    await expect(tab.use().getToken()).resolves.toBe(token);
    expect(tab.use().orgContext.get()?.orgId).toBe("org-a");
    expect(tab.use().isLogged.get()).toBe(true);
    expect(tab.use().refreshToken.get()).toBe(heldRefreshToken);
    expect(sentOrgs()).toEqual(["org-b"]);
  });

  it("The tab's org is deleted", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-b");
    server.refusals.set("org-b", "ORG_DELETED");
    expireAccessTokens();

    expect(await refusalOf(tab.use().getToken())).toEqual(refusal("ORG_DELETED", "org-b"));
    expect(tab.use().isLogged.get()).toBe(true);

    await tab.use().selectOrganization(PERSONAL_ORG);
    expect(orgOf(await tab.use().getToken())).toBe(PERSONAL_ORG);
  });

  it("is an ApiError the SDK's status maps leave untouched", async () => {
    const tab = await signIn();
    server.refusals.set("org-b", "MEMBERSHIP_SUSPENDED");
    const error = await tab
      .use()
      .selectOrganization("org-b")
      .catch((thrown: unknown) => thrown);
    const {handleApiError} = await import("../../auth/api/error-handlers");

    expect(error).toBeInstanceOf((await import("../../auth/api/types")).ApiError);
    // A wrapper's own 403 message would hide why the request never left.
    expect(() => handleApiError(error, {403: () => new Error("Cannot leave organization")})).toThrow(error as Error);
  });

  it("keeps a suspended tab on its org, so reinstatement needs no new selection", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-b");
    server.refusals.set("org-b", "MEMBERSHIP_SUSPENDED");
    expireAccessTokens();

    expect(await refusalOf(tab.use().getToken())).toEqual(refusal("MEMBERSHIP_SUSPENDED", "org-b"));
    expect(tab.storage.getItem(TAB_ORG_KEY)).toBe("org-b");

    server.refusals.clear();
    expect(orgOf(await tab.use().getToken())).toBe("org-b");
  });

  // auth-api answers a dead refresh token with 401. Anything else is about the request, not the token.
  it.each([
    ["a 400 for an invalid request", 400, {error: "invalid org_id"}],
    ["a 403 without a reason", 403, {error: "forbidden"}],
    ["a 403 with an unknown reason", 403, {error: "forbidden", reason: "SOMETHING_ELSE"}],
  ])("keeps every tab signed in when selectOrganization() gets %s", async (_label, status, body) => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-a");
    const otherTab = new BroadcastChannel(LOGOUT_CHANNEL);
    const heard = vi.fn();
    otherTab.addEventListener("message", heard);
    const {ApiError} = await import("../../auth/api/types");
    mocks.refresh.mockRejectedValueOnce(new ApiError(body.error, status, "/auth/v1/token", body));

    await expect(tab.use().selectOrganization("not-an-org")).rejects.toMatchObject({name: "ApiError", status});

    expect(tab.use().isLogged.get()).toBe(true);
    expect(tab.use().refreshToken.get()).toBeTruthy();
    expect(orgOf(await tab.use().getToken())).toBe("org-a");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(heard).not.toHaveBeenCalled();
    otherTab.close();
  });

  it("A rejected refresh token signs out this tab", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-a");
    server.revoke();
    expireAccessTokens();

    await expect(tab.use().getToken()).rejects.toMatchObject({name: "ApiError", status: 401});

    expect(tab.use().isLogged.get()).toBe(false);
    expect(tab.use().refreshToken.get()).toBe("");
    expect(tab.storage.getItem(TAB_ORG_KEY)).toBe("org-a");
  });
});

describe("A refused stored org is cleared", () => {
  const reloadAfterLosing = async (reason: string) => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-b");
    server.refusals.set("org-b", reason);
    const reloaded = await openTab(tab.storage);
    server.requests.length = 0;
    return reloaded;
  };

  it("Reload after removal", async () => {
    const tab = await reloadAfterLosing("NOT_A_MEMBER");

    expect(await refusalOf(tab.use().getToken())).toEqual(refusal("NOT_A_MEMBER", "org-b"));

    expect(tab.storage.getItem(TAB_ORG_KEY)).toBeNull();
    expect(tab.use().orgContext.get()).toBeUndefined();
    expect(tab.use().isLogged.get()).toBe(true);
    expect(tab.use().refreshToken.get()).toBeTruthy();
    // It keeps rejecting, without a request and without falling back to another org.
    expect(await refusalOf(tab.use().getToken())).toEqual(refusal("NOT_A_MEMBER", "org-b"));
    const reloadedAgain = await openTab(tab.storage);
    expect(await refusalOf(reloadedAgain.use().getToken())).toEqual(refusal("NOT_A_MEMBER", "org-b"));
    expect(sentOrgs()).toEqual(["org-b"]);
  });

  it("Reload after deletion", async () => {
    const tab = await reloadAfterLosing("ORG_DELETED");

    expect(await refusalOf(tab.use().getToken())).toEqual(refusal("ORG_DELETED", "org-b"));
    expect(tab.storage.getItem(TAB_ORG_KEY)).toBeNull();

    await tab.use().selectOrganization("org-a");
    expireAccessTokens();
    expect(orgOf(await tab.use().getToken())).toBe("org-a");
    expect(tab.storage.getItem("__rixl_auth_orgRefusal")).toBeNull();
  });

  it("A refused live switch keeps the org", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-a");
    server.refusals.set("org-b", "NOT_A_MEMBER");

    await expect(tab.use().selectOrganization("org-b")).rejects.toMatchObject({reason: "NOT_A_MEMBER"});

    expect(tab.use().orgContext.get()?.orgId).toBe("org-a");
    expect(tab.storage.getItem(TAB_ORG_KEY)).toBe("org-a");
  });

  it("keeps the refusal after another org is refused too", async () => {
    const tab = await reloadAfterLosing("NOT_A_MEMBER");
    await expect(tab.use().getToken()).rejects.toMatchObject({orgId: "org-b"});
    server.refusals.set("org-c", "MEMBERSHIP_SUSPENDED");

    await expect(tab.use().selectOrganization("org-c")).rejects.toMatchObject({orgId: "org-c"});

    await expect(tab.use().getToken()).rejects.toMatchObject({orgId: "org-b", reason: "NOT_A_MEMBER"});
  });

  it.each([
    ["signing out", (tab: Tab) => tab.use().removeTokens()],
    ["signing in again", (tab: Tab) => void tab.use().persistSignInTokens(server.signIn())],
  ])("forgets the refusal on %s", async (_label, action) => {
    const tab = await reloadAfterLosing("NOT_A_MEMBER");
    await expect(tab.use().getToken()).rejects.toMatchObject({orgId: "org-b"});

    action(tab);

    await expect(
      tab
        .use()
        .getToken()
        .then(() => "resolved")
    ).resolves.toBe("resolved");
  });
});

describe("Sign-in exposes the last org as a hint", () => {
  const signInResponse = (lastActiveOrgId: string) => ({status: "ok", ...server.signIn(), last_active_org_id: lastActiveOrgId});

  it("Sign-in on a new device", async () => {
    const tab = await openTab();
    mocks.login.mockResolvedValue({data: signInResponse("org-b")});

    await tab.use().loginWithEmail("someone@example.com", "Password123");

    expect(tab.use().orgContext.get()).toEqual({orgId: PERSONAL_ORG, role: "owner"});
    expect(tab.use().lastActiveOrgId.get()).toBe("org-b");
    expect(orgOf(await tab.use().getToken())).toBe(PERSONAL_ORG);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("has no hint when the response carries an empty one", async () => {
    const tab = await openTab();
    // The gateway emits every field.
    mocks.login.mockResolvedValue({data: signInResponse("")});

    await tab.use().loginWithEmail("someone@example.com", "Password123");

    expect(tab.use().lastActiveOrgId.get()).toBeUndefined();
  });

  it("keeps the hint through refreshes and reissued tokens, and drops it on sign-out", async () => {
    const tab = await openTab();
    tab.use().persistSignInTokens(signInResponse("org-b"));

    await tab.use().selectOrganization("org-a");
    tab.use().persistTestReissue(server.reissue("org-a"));
    expect(tab.use().lastActiveOrgId.get()).toBe("org-b");

    tab.use().removeTokens();
    expect(tab.use().lastActiveOrgId.get()).toBeUndefined();
  });

  it("names the personal org, so a tab that lost its org can select it", async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-b");
    server.refusals.set("org-b", "NOT_A_MEMBER");
    const reloaded = await openTab(tab.storage);
    await expect(reloaded.use().getToken()).rejects.toMatchObject({reason: "NOT_A_MEMBER"});

    await reloaded.use().selectOrganization(reloaded.use().personalOrgId.get()!);

    expect(orgOf(await reloaded.use().getToken())).toBe(PERSONAL_ORG);
  });
});
