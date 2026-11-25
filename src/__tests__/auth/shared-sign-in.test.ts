/**
 * What the tabs of one browser share: the refresh token and the sign-in it
 * belongs to (openspec: adopt-organization-context, org-token-context).
 */
import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {ACCESS_LIFETIME_SECONDS, PERSONAL_ORG, claimsOf, createFakeAuth, orgOf} from "../setup/fake-auth";
import {listenForLogout, openTab, type Tab} from "../setup/tabs";

const mocks = vi.hoisted(() => ({
  otp: vi.fn(),
  provider: vi.fn(),
  refresh: vi.fn(),
  userInfo: vi.fn(),
  logout: vi.fn(),
  apiTypes: undefined as unknown,
}));

vi.mock("../../auth/api/types", async (importOriginal) => (mocks.apiTypes ??= await importOriginal()));
vi.mock("../../generated/sdk.gen", () => ({
  authV1OtpServiceVerifyOtp: mocks.otp,
  authV1ProvidersServiceConnectProvider: mocks.provider,
  authV1TokenServiceRefreshToken: mocks.refresh,
  authV1UserServiceGetUserInfo: mocks.userInfo,
  authV1TokenServiceLogout: mocks.logout,
}));

const DAY_MS = 86_400_000;

let server: ReturnType<typeof createFakeAuth>;

const signIn = async () => {
  const tab = await openTab();
  tab.use().persistSignInTokens(server.signIn());
  return tab;
};

const expireAccessTokens = () => vi.setSystemTime(Date.now() + ACCESS_LIFETIME_SECONDS * 1000 + 1);

const cookieNames = () =>
  document.cookie
    .split(";")
    .map((pair) => pair.split("=")[0]!.trim())
    .filter(Boolean)
    .sort();

beforeEach(() => {
  vi.useFakeTimers({toFake: ["Date"]});
  server = createFakeAuth();
  mocks.refresh.mockReset().mockImplementation(server.refresh);
  mocks.userInfo.mockReset().mockResolvedValue({data: {permissions: ["videos:read"]}});
  mocks.logout.mockReset().mockResolvedValue({data: {}});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("A refresh token without an org to refresh into", () => {
  /** The cookies a browser signed in before the org split holds. */
  const storePreCutoverCookies = () => {
    for (const [name, value] of Object.entries({refreshToken: "pre-cutover", accessToken: "old-access", expireAt: "1", isLogged: "true"})) {
      document.cookie = `__rixl_auth_${name}=${value}; path=/`;
    }
  };

  it("ends signed out with cookies from before the cutover, without a request", async () => {
    storePreCutoverCookies();
    const otherTabs = listenForLogout();
    const tab = await openTab();

    await expect(tab.use().getToken()).resolves.toBeUndefined();

    expect(tab.use().isLogged.get()).toBe(false);
    expect(cookieNames()).toEqual([]);
    expect(server.requests).toEqual([]);
    expect(await otherTabs.announced()).toEqual([]);
    otherTabs.close();
  });

  it("makes selectOrganization() reject as signed out", async () => {
    storePreCutoverCookies();
    const tab = await openTab();

    await expect(tab.use().selectOrganization("org-a")).rejects.toMatchObject({status: 401});

    expect(tab.use().isLogged.get()).toBe(false);
    expect(cookieNames()).toEqual([]);
    expect(server.requests).toEqual([]);
  });

  it("keeps the personal org as long as the refresh token, past the cookie lifetime", async () => {
    const tab = await signIn();
    const signedInAt = Date.now();
    for (const day of [10, 20, 29, 35]) {
      vi.setSystemTime(signedInAt + day * DAY_MS);
      await tab.use().getToken();
    }
    expect(cookieNames()).toContain("__rixl_auth_personalOrgId");
    expect(cookieNames()).toContain("__rixl_auth_isLogged");

    const newTab = await openTab();

    expect(orgOf(await newTab.use().getToken())).toBe(PERSONAL_ORG);
    expect(newTab.use().isLogged.get()).toBe(true);
  });
});

const sentOrgs = () => server.requests.map((request) => request.org_id);

/** Holds back the answer to the next refresh, after the server has handled it. */
const delayNextRefresh = () => {
  let deliver!: () => void;
  const delivered = new Promise<void>((resolve) => (deliver = resolve));
  mocks.refresh.mockImplementationOnce(async (request: Parameters<typeof server.refresh>[0]) => {
    const answer = await server.refresh(request);
    await delivered;
    return answer;
  });
  return deliver;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("Tab state belongs to one sign-in", () => {
  /** A tab of user-1 on org-shared, with permissions and a profile held. */
  const tabOfFirstAccount = async () => {
    const tab = await signIn();
    await tab.use().selectOrganization("org-shared");
    await tab.use().resolvePermissions();
    return tab;
  };

  const signInAs = async (userId: string) => {
    const tab = await openTab();
    tab.use().persistSignInTokens(server.signIn(userId));
    server.requests.length = 0;
    return tab;
  };

  it("never uses the previous account's token or org after another tab signs in", async () => {
    const tab = await tabOfFirstAccount();
    await signInAs("user-2");

    const token = await tab.use().getToken();

    expect(claimsOf(token)).toMatchObject({id: "user-2", org_id: PERSONAL_ORG});
    expect(sentOrgs()).toEqual([PERSONAL_ORG]);
    expect(tab.use().orgContext.get()?.orgId).toBe(PERSONAL_ORG);
    expect(tab.use().permissionsResolved.get()).toBe(false);
    expect(tab.use().user.get()?.id).toBe("user-2");
    expect(localStorage.getItem("__rixl_auth_user")).toContain("user-2");
  });

  it("does the same when the user signs in again, which is another sign-in", async () => {
    const tab = await tabOfFirstAccount();
    await signInAs("user-1");

    expect(orgOf(await tab.use().getToken())).toBe(PERSONAL_ORG);
    expect(sentOrgs()).toEqual([PERSONAL_ORG]);
  });

  it.each([
    ["its stored org", async () => {}],
    [
      "the org it had lost",
      async (tab: Tab) => {
        server.refusals.set("org-shared", "NOT_A_MEMBER");
        expireAccessTokens();
        await expect(tab.use().getToken()).rejects.toMatchObject({reason: "NOT_A_MEMBER"});
      },
    ],
  ])("drops %s when a restored tab finds another account signed in", async (_label, prepare) => {
    const tab = await tabOfFirstAccount();
    await prepare(tab);
    // The account changes while this tab isn't running.
    await signInAs("user-2");

    const restored = await openTab(tab.storage);

    expect(claimsOf(await restored.use().getToken())).toMatchObject({id: "user-2", org_id: PERSONAL_ORG});
    expect(sentOrgs()).toEqual([PERSONAL_ORG]);
  });

  it("keeps its org on a reload within the same sign-in", async () => {
    const tab = await tabOfFirstAccount();
    const other = await openTab();
    await other.use().selectOrganization("org-b");

    const reloaded = await openTab(tab.storage);

    expect(orgOf(await reloaded.use().getToken())).toBe("org-shared");
  });

  it("re-resolves permissions before trusting the previous account's", async () => {
    const tab = await tabOfFirstAccount();
    await signInAs("user-2");
    mocks.userInfo.mockClear();

    await tab.use().ensurePermissions();

    expect(mocks.userInfo).toHaveBeenCalledTimes(1);
  });

  it("keeps the answer when resolvePermissions() is what finds the other account", async () => {
    const tab = await tabOfFirstAccount();
    await signInAs("user-2");
    tab.use();
    mocks.userInfo.mockImplementation(async () => {
      // The request interceptor asks for a token before sending.
      await tab.use().getToken();
      return {data: {permissions: ["videos:write"]}};
    });

    await tab.use().resolvePermissions();

    expect(tab.use().permissionsResolved.get()).toBe(true);
    expect(tab.use().permissions.get()).toEqual(new Set(["videos:write"]));
  });

  it("doesn't send the previous account's access token on logout", async () => {
    const tab = await tabOfFirstAccount();
    const other = await signInAs("user-2");
    const currentRefreshToken = other.use().refreshToken.get();

    await tab.use().logout();

    expect(mocks.logout.mock.calls[0]![0].body).toEqual({token: undefined, refresh_token: currentRefreshToken});
  });

  it("discards a refresh that returns after another account signed in", async () => {
    const tab = await tabOfFirstAccount();
    expireAccessTokens();
    const deliver = delayNextRefresh();
    const pending = tab
      .use()
      .getToken()
      .catch((error: unknown) => error);
    await settle();
    const other = await signInAs("user-2");
    const currentRefreshToken = other.use().refreshToken.get();

    deliver();

    await expect(pending).resolves.toMatchObject({message: expect.stringContaining("sign-in changed")});
    expect(document.cookie).toContain(`__rixl_auth_refreshToken=${currentRefreshToken}`);
    expect(claimsOf(await tab.use().getToken())).toMatchObject({id: "user-2"});
  });

  it("discards a refresh that returns after signing out", async () => {
    const tab = await tabOfFirstAccount();
    expireAccessTokens();
    const deliver = delayNextRefresh();
    const pending = tab
      .use()
      .getToken()
      .catch(() => {});
    await settle();

    tab.use().removeTokens();
    deliver();
    await pending;

    expect(tab.use().isLogged.get()).toBe(false);
    expect(cookieNames()).toEqual([]);
  });

  it("doesn't apply a refusal that returns after another account signed in", async () => {
    const tab = await tabOfFirstAccount();
    expireAccessTokens();
    let refuse!: () => void;
    const refused = new Promise<void>((resolve) => (refuse = resolve));
    mocks.refresh.mockImplementationOnce(async () => {
      await refused;
      const {ApiError} = await import("../../auth/api/types");
      throw new ApiError("forbidden", 403, "/auth/v1/token", {error: "forbidden", reason: "NOT_A_MEMBER"});
    });
    const pending = tab
      .use()
      .getToken()
      .catch(() => {});
    await settle();
    await signInAs("user-2");

    refuse();
    await pending;

    expect(claimsOf(await tab.use().getToken())).toMatchObject({id: "user-2", org_id: PERSONAL_ORG});
  });
});

describe("Logout is bound to its sign-in", () => {
  it("preserves a different sign-in made while an earlier logout is pending", async () => {
    const old = await signIn();
    const other = await openTab();
    const sent = Promise.withResolvers<void>();
    const complete = Promise.withResolvers<{data: object}>();
    mocks.logout.mockImplementationOnce(() => {
      sent.resolve();
      return complete.promise;
    });
    const pending = old.use().logout();
    await sent.promise;
    const next = server.signIn("user-2");
    other.use().persistSignInTokens(next);
    const loggedOut = vi.fn();
    const stop = other.use().isLogged.listen(loggedOut);
    try {
      old.use();
      complete.resolve({data: {}});
      await pending;
      await settle();
      expect(document.cookie).toContain(`__rixl_auth_refreshToken=${next.refresh_token}`);
      expect(loggedOut).not.toHaveBeenCalled();
      expect(claimsOf(await other.use().getToken()).id).toBe("user-2");
    } finally {
      stop();
    }
  });

  it.each(["the current tab", "another tab"])("signs out while a refresh in %s is still open", async (holder) => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const rotating = await signIn();
    const exiting = holder === "the current tab" ? rotating : await openTab();
    const lock = vi.fn((_name: string, _options: unknown, task: () => Promise<void>) => task());
    vi.stubGlobal("navigator", {locks: {request: lock}});
    expireAccessTokens();
    const deliver = delayNextRefresh();
    const rotated = rotating
      .use()
      .getToken()
      .catch((error: unknown) => error);
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());

    const ended = exiting.use().logout();
    try {
      expect(exiting.use().isLogged.get()).toBe(false);
      expect(cookieNames()).toEqual([]);
      await expect(ended).resolves.toEqual({revoked: true});
      expect(lock).toHaveBeenCalledOnce();
      expect(mocks.logout.mock.calls[0]?.[0].body.refresh_token).toBe("refresh-1");
      const reloaded = await openTab();
      expect(reloaded.use().isLogged.get()).toBe(false);
      await expect(reloaded.use().getToken()).resolves.toBeUndefined();
    } finally {
      rotating.use();
      deliver();
      await rotated;
      await ended;
    }
    expect(await rotated).toMatchObject({message: "The sign-in changed during the refresh"});
    expect(cookieNames()).toEqual([]);
  });

  it("reports logout of a limited-access flow to markerless tabs only", async () => {
    const exiting = await openTab();
    const limited = await openTab();
    const marked = await openTab();
    exiting.use().setLimitedAccessState("limited-a", "add_email");
    limited.use().setLimitedAccessState("limited-b", "add_email");

    const ended = exiting.use().logout();
    marked.use().persistSignInTokens(server.signIn());
    await ended;
    await vi.waitFor(() => expect(limited.use().isLogged.get()).toBe(false));
    expect(limited.use().limitedAccessToken.get()).toBeNull();
    expect(marked.use().isLogged.get()).toBe(true);
  });

  it("revokes and announces the full sign-in replaced by limited access", async () => {
    const full = await signIn();
    const entering = await openTab();

    entering.use().setLimitedAccessState("next-limited-token", "add_email");

    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.logout.mock.calls[0]?.[0].body.refresh_token).toBe("refresh-1");
    await vi.waitFor(() => expect(full.use().isLogged.get()).toBe(false));
    expect(entering.use().limitedAccessToken.get()).toBe("next-limited-token");
    expect(entering.use().isLogged.get()).toBe(true);
  });

  it.each([false, true])("uses and rotates a new sign-in while the previous refresh is open (Web Locks: %s)", async (withLocks) => {
    const tab = await signIn();
    const pendingLocks = new Map<string, Promise<void>>();
    const request = vi.fn((name: string, _options: unknown, task: () => Promise<void>) => {
      const current = (pendingLocks.get(name) ?? Promise.resolve()).then(task);
      pendingLocks.set(
        name,
        current.catch(() => undefined)
      );
      return current;
    });
    vi.stubGlobal("navigator", {locks: withLocks ? {request} : undefined});
    expireAccessTokens();
    const deliver = delayNextRefresh();
    const old = tab
      .use()
      .getToken()
      .catch((error: unknown) => error);
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    await tab.use().logout();
    tab.use().persistSignInTokens(server.signIn("user-2"));
    const current = vi.fn();
    const switching = tab.use().getToken().then(claimsOf).then(current, current);
    const selected = tab
      .use()
      .selectOrganization("org-c")
      .catch((error: unknown) => error);
    try {
      await vi.waitFor(() => expect(current).toHaveBeenCalledWith(expect.objectContaining({id: "user-2"})));
      await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(2));
      await expect(selected).resolves.toBeUndefined();
      if (withLocks) expect(pendingLocks.size).toBe(2);
    } finally {
      deliver();
      await old;
      await switching.catch(() => undefined);
      await selected;
    }
    expect(claimsOf(await tab.use().getToken())).toMatchObject({id: "user-2", org_id: "org-c"});
  });

  it("does not show a previous refusal when a limited-access flow starts", async () => {
    const tab = await signIn();
    tab.use().dropRefusedOrg({reason: "MEMBERSHIP_SUSPENDED", orgId: PERSONAL_ORG});
    server.revoke();
    expireAccessTokens();
    await expect(tab.use().getToken()).rejects.toMatchObject({status: 401});

    tab.use().setLimitedAccessState("limited-next", "add_email");

    expect(tab.use().orgRefusal.get()).toBeUndefined();
    expect(tab.use().limitedAccessToken.get()).toBe("limited-next");
  });
});

describe("Token responses belong to the sign-in that requested them", () => {
  const startReissue = async (tab: Tab, operation: "otp" | "provider") => {
    const started = Promise.withResolvers<void>();
    const response = Promise.withResolvers<void>();
    mocks[operation].mockImplementationOnce(() => {
      const data = server.reissue(PERSONAL_ORG);
      started.resolve();
      return response.promise.then(() => ({data}));
    });
    const pending =
      operation === "otp" ? tab.use().verifyUserOTP("123456") : tab.use().connectSocialInternal("google", {token: "credential"});
    await started.promise;
    return {deliver: response.resolve, pending};
  };

  it.each(["otp", "provider"] as const)("preserves a new sign-in after a late %s response", async (operation) => {
    const first = await signIn();
    const second = await openTab();
    const {deliver, pending} = await startReissue(first, operation);
    const next = server.signIn("user-2");
    second.use().persistSignInTokens(next);
    first.use();
    deliver();
    await pending;

    expect(document.cookie).toContain(`__rixl_auth_refreshToken=${next.refresh_token}`);
    expect(claimsOf(await first.use().getToken()).id).toBe("user-2");
  });

  it("keeps the browser signed out after a late reissue", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const first = await signIn();
    const second = await openTab();
    const {deliver, pending} = await startReissue(first, "otp");
    await second.use().logout();
    first.use();
    deliver();
    await pending;

    expect(cookieNames()).toEqual([]);
    expect(await first.use().getToken()).toBeUndefined();
  });

  it("does not restore a sign-in when a late refresh misses another tab's logout", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const first = await signIn();
    const second = await openTab();
    expireAccessTokens();
    const deliver = delayNextRefresh();
    const pending = first.use().getToken();
    const result = pending.catch((error: unknown) => error);
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());

    await second.use().logout();
    first.use();
    deliver();

    expect(await result).toMatchObject({message: "The sign-in changed during the refresh"});
    expect(cookieNames()).toEqual([]);
    expect(await first.use().getToken()).toBeUndefined();
  });

  it("does not restore an ended sign-in when a tab that loaded signed out selects an org first", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const loadedSignedOut = await openTab();
    const other = await signIn();
    const deliver = delayNextRefresh();
    const result = loadedSignedOut
      .use()
      .selectOrganization("org-a")
      .catch((error: Error) => error.message);
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());

    other.use().removeTokens();
    loadedSignedOut.use();
    deliver();

    await expect(result).resolves.toBe("The sign-in changed during the refresh");
    expect(cookieNames()).toEqual([]);
    await expect(loadedSignedOut.use().getToken()).resolves.toBeUndefined();
  });

  it("keeps the in-memory sign-in when this tab cannot read cookies", async () => {
    const tab = await openTab();
    const cookies = vi.spyOn(document, "cookie", "get").mockReturnValue("");
    try {
      tab.use().persistSignInTokens(server.signIn());
      expireAccessTokens();
      expect(orgOf(await tab.use().getToken())).toBe(PERSONAL_ORG);
    } finally {
      cookies.mockRestore();
    }
  });

  it("does not rotate its own refresh token again when the server returns another org", async () => {
    const tab = await signIn();
    mocks.refresh.mockResolvedValueOnce({data: server.reissue("other-org")});

    await expect(tab.use().selectOrganization("requested-org")).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
      message: expect.stringContaining("requested organization"),
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(tab.use().orgContext.get()?.orgId).toBe(PERSONAL_ORG);
  });

  it("adopts only the refresh token when the reissue bearer is for a former org", async () => {
    const first = await signIn();
    const second = await openTab();
    const deliverSwitch = delayNextRefresh();
    const switched = first.use().selectOrganization("org-b");
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());

    mocks.otp.mockImplementationOnce(({headers}: {headers: Record<string, string>}) => ({
      data: server.reissue(orgOf(headers["Authorization"]?.slice("Bearer ".length))!),
    }));
    const reissued = first.use().verifyUserOTP("123456");
    await new Promise((resolve) => setTimeout(resolve, 0));
    deliverSwitch();
    await switched;
    await reissued;

    expect(first.use().orgContext.get()?.orgId).toBe("org-b");
    expect(orgOf(await first.use().getToken())).toBe("org-b");
    expect(orgOf(await second.use().getToken())).toBe(PERSONAL_ORG);
    expect(server.requests.at(-1)?.refresh_token).toBe("refresh-3");
  });

  it("queues an org switch behind reissue and refreshes with the rotated token", async () => {
    const first = await signIn();
    const second = await openTab();
    const lock = vi.fn((_name: string, _options: unknown, task: () => Promise<void>) => task());
    vi.stubGlobal("navigator", {locks: {request: lock}});
    const {deliver, pending} = await startReissue(first, "otp");
    const switchOrg = first.use().selectOrganization("org-b");
    const switched = switchOrg.catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const sentWhileReissuePending = mocks.refresh.mock.calls.length;
    deliver();
    await pending;
    expect(await switched).toBeUndefined();

    expect(sentWhileReissuePending).toBe(0);
    expect(lock).toHaveBeenCalledTimes(2);
    expect(orgOf(await first.use().getToken())).toBe("org-b");
    expect(orgOf(await second.use().getToken())).toBe(PERSONAL_ORG);
  });
});

/** None of what a refresh depends on, nor what says the browser is signed in. */
const expectNoStoredSignIn = () => {
  for (const name of ["refreshToken", "signIn", "personalOrgId", "isLogged"]) {
    expect(cookieNames()).not.toContain(`__rixl_auth_${name}`);
  }
};

describe("A refused refresh token ends the stored sign-in", () => {
  it.each([
    ["getToken()", (tab: Tab) => tab.use().getToken()],
    ["selectOrganization()", (tab: Tab) => tab.use().selectOrganization("org-a")],
  ])("starts signed out on every reload, without a request, after %s was refused", async (_label, refresh) => {
    const tab = await signIn();
    server.revoke();
    expireAccessTokens();
    await expect(refresh(tab)).rejects.toMatchObject({status: 401});
    const sent = server.requests.length;

    expectNoStoredSignIn();
    for (let reload = 1; reload <= 3; reload++) {
      const reloaded = await openTab(tab.storage);
      expect(reloaded.use().isLogged.get()).toBe(false);
      await expect(reloaded.use().getToken()).resolves.toBeUndefined();
    }
    expect(server.requests).toHaveLength(sent);
  });

  it("keeps a newer refresh token another tab stored for the sign-in", async () => {
    const tab = await signIn();
    const other = await openTab();
    expireAccessTokens();
    const refuse = Promise.withResolvers<void>();
    mocks.refresh.mockImplementationOnce(async (request: Parameters<typeof server.refresh>[0]) => {
      await refuse.promise;
      return server.refresh(request);
    });
    const refused = tab
      .use()
      .getToken()
      .then(orgOf, (error: {status?: number}) => error.status);
    await settle();
    await other.use().getToken();

    tab.use();
    refuse.resolve();

    await expect(refused).resolves.toBe(PERSONAL_ORG);
    expect(cookieNames()).toContain("__rixl_auth_refreshToken");
  });
});

describe("A rejected refresh that may be a rotation race", () => {
  const SETTLE_MS = 1000;
  const LOCK_WAIT_MS = 10_000;
  const LATE_ROTATION_MS = 61_000;

  /** A browser whose lock is always free, so each refresh holds it. */
  const stubFreeLock = () =>
    vi.stubGlobal("navigator", {locks: {request: (_name: string, _options: unknown, task: () => Promise<void>) => task()}});

  /** Tabs on org-a, org-b and org-c, all with expired access tokens, in a browser without Web Locks. */
  const threeTabsWithoutLocks = async () => {
    vi.stubGlobal("navigator", {locks: undefined});
    const first = await signIn();
    const second = await openTab();
    const third = await openTab();
    await first.use().selectOrganization("org-a");
    await second.use().selectOrganization("org-b");
    await third.use().selectOrganization("org-c");
    expireAccessTokens();
    vi.useFakeTimers({toFake: ["Date", "setTimeout", "clearTimeout"], now: Date.now()});
    return {first, second, third};
  };

  const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

  /** `second` is refused while `first`'s successful refresh is still on its way. */
  const loseTheRace = async () => {
    const tabs = await threeTabsWithoutLocks();
    const loggedOut: string[] = [];
    for (const [name, tab] of Object.entries(tabs)) tab.use().isLogged.listen((value) => void (value || loggedOut.push(name)));
    const deliverWinner = delayNextRefresh();
    const winner = tabs.first.use().getToken();
    await tick();
    const loser = tabs.second
      .use()
      .getToken()
      .then(orgOf, (error: {status?: number}) => error.status);
    await tick();
    return {...tabs, winner, loser, deliverWinner, loggedOut};
  };

  it("recovers in the same call when the winner's token arrives within the settle time", async () => {
    const {second, winner, loser, deliverWinner, loggedOut} = await loseTheRace();

    deliverWinner();
    await winner;
    second.use();
    await tick(SETTLE_MS);

    await expect(loser).resolves.toBe("org-b");
    expect(loggedOut).toEqual([]);
  });

  it("keeps the winner's token when this tab takes it up during the settle wait", async () => {
    const {second, winner, loser, deliverWinner} = await loseTheRace();

    deliverWinner();
    await winner;
    await second.use().ensurePermissions();
    await tick(SETTLE_MS);

    await expect(loser).resolves.toBe("org-b");
    expect(cookieNames()).toContain("__rixl_auth_refreshToken");
  });

  it.each([
    ["the user logged out", async (tab: Tab) => tab.use().logout()],
    ["a rotation can no longer be on its way", async () => void vi.setSystemTime(Date.now() + LATE_ROTATION_MS)],
  ])("doesn't restore the sign-in once %s", async (_label, happen) => {
    const {first, third, winner, loser, deliverWinner} = await loseTheRace();
    const outcome = winner.catch((error: Error) => error.message);
    await tick(SETTLE_MS);
    await expect(loser).resolves.toBe(401);

    await happen(third);
    first.use();
    deliverWinner();

    await expect(outcome).resolves.toBe("The sign-in changed during the refresh");
    expect(cookieNames()).toEqual([]);
  });

  it("signs out no other tab, and every tab recovers, when the winner is slower than that", async () => {
    const announced = listenForLogout();
    const {first, second, third, winner, loser, deliverWinner, loggedOut} = await loseTheRace();

    await tick(SETTLE_MS);
    await expect(loser).resolves.toBe(401);
    // Until the winner is heard from, the refused token reads as dead.
    expectNoStoredSignIn();
    await expect(second.use().getToken()).resolves.toBeUndefined();
    first.use().adoptStoredRefreshToken();
    deliverWinner();
    await winner;

    expect(loggedOut).toEqual(["second"]);
    expect(orgOf(await third.use().getToken())).toBe("org-c");
    // The loser takes the winner's token up and is still on its own org.
    expect(orgOf(await second.use().getToken())).toBe("org-b");
    expect(second.use().isLogged.get()).toBe(true);
    vi.useRealTimers();
    expect(await announced.announced()).toEqual([]);
    const newTab = await openTab();
    expect(orgOf(await newTab.use().getToken())).toBe(PERSONAL_ORG);
    announced.close();
  });

  it("retains the tab's selection across reload while a winning response is in flight", async () => {
    const {first, second, winner, loser, deliverWinner} = await loseTheRace();
    await tick(SETTLE_MS);
    await expect(loser).resolves.toBe(401);
    const restored = await openTab(second.storage);
    await expect(restored.use().getToken()).resolves.toBeUndefined();

    first.use();
    deliverWinner();
    await winner;

    expect(orgOf(await restored.use().getToken())).toBe("org-b");
  });

  it("retains a lost org across reload while the refusal marker matches", async () => {
    const {first, third, winner, loser, deliverWinner} = await loseTheRace();
    await tick(SETTLE_MS);
    await expect(loser).resolves.toBe(401);
    third.use().dropRefusedOrg({reason: "ORG_DELETED", orgId: "org-c"});
    const restored = await openTab(third.storage);
    await expect(restored.use().getToken()).resolves.toBeUndefined();
    expect(restored.use().orgRefusal.get()).toBeUndefined();

    first.use();
    deliverWinner();
    await winner;

    await expect(restored.use().getToken()).rejects.toMatchObject({reason: "ORG_DELETED", orgId: "org-c"});
    expect(restored.use().orgRefusal.get()).toEqual({reason: "ORG_DELETED", orgId: "org-c"});
  });

  it("announces nothing when the token is dead and there is no lock", async () => {
    const announced = listenForLogout();
    const {first} = await threeTabsWithoutLocks();
    server.revoke();

    const refused = first
      .use()
      .getToken()
      .catch((error: {status?: number}) => error.status);
    await tick(SETTLE_MS);

    await expect(refused).resolves.toBe(401);
    expect(first.use().isLogged.get()).toBe(false);
    await expect(first.use().getToken()).resolves.toBeUndefined();
    expectNoStoredSignIn();
    vi.useRealTimers();
    expect(await announced.announced()).toEqual([]);
    announced.close();
  });

  it("does not announce when a queued refresher times out during the current holder's turn", async () => {
    const {first, second, third} = await threeTabsWithoutLocks();
    const announced = listenForLogout();
    const firstDone = Promise.withResolvers<void>();
    const waiter = Promise.withResolvers<void>();
    const taskUnderLock = (_name: string, _options: unknown, task: () => Promise<void>) => task();
    const lock = vi
      .fn(taskUnderLock)
      .mockImplementationOnce(async (_name, _options, task) => {
        await task();
        firstDone.resolve();
      })
      .mockImplementationOnce(async (_name, _options, task) => {
        await firstDone.promise;
        second.use();
        await task();
      })
      .mockImplementationOnce(async () => {
        await waiter.promise;
        throw new DOMException("Lock wait expired", "TimeoutError");
      });
    vi.stubGlobal("navigator", {locks: {request: lock}});

    const deliverFirst = delayNextRefresh();
    const firstRefresh = first.use().getToken();
    await tick();
    const loser = second
      .use()
      .getToken()
      .then(orgOf, (error: {status?: number}) => error.status);
    const winner = third.use().getToken();
    await tick(8000);

    const loserMaySend = Promise.withResolvers<void>();
    mocks.refresh.mockImplementationOnce(async (request: Parameters<typeof server.refresh>[0]) => {
      await loserMaySend.promise;
      return server.refresh(request);
    });
    first.use();
    deliverFirst();
    await firstRefresh;
    await tick(LOCK_WAIT_MS - 8000);

    const deliverWinner = delayNextRefresh();
    third.use();
    waiter.resolve();
    await tick();
    second.use();
    loserMaySend.resolve();
    await tick();
    await tick(SETTLE_MS);
    expect(await loser).toBe(401);

    third.use();
    deliverWinner();
    expect(orgOf(await winner)).toBe("org-c");
    expect(lock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
    expect(await announced.announced()).toEqual([]);
    announced.close();
  });

  it("doesn't announce when the refresh outlived the time other tabs wait for the lock", async () => {
    stubFreeLock();
    const tab = await signIn();
    const announced = listenForLogout();
    expireAccessTokens();
    server.revoke();
    mocks.refresh.mockImplementationOnce(async (request: Parameters<typeof server.refresh>[0]) => {
      // By now a waiting tab has given up and refreshed without the lock.
      vi.setSystemTime(Date.now() + LOCK_WAIT_MS);
      return server.refresh(request);
    });
    vi.useFakeTimers({toFake: ["Date", "setTimeout", "clearTimeout"], now: Date.now()});

    const refused = tab
      .use()
      .getToken()
      .catch((error: {status?: number}) => error.status);
    await tick(SETTLE_MS);

    await expect(refused).resolves.toBe(401);
    vi.useRealTimers();
    expect(await announced.announced()).toEqual([]);
    announced.close();
  });
});
