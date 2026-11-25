/**
 * The gateway refuses every org route with an org reason once the token's org is
 * unavailable, while the token is still unexpired (gateway
 * internal/middleware/authentication.go). These tests use the real generated
 * client and interceptors; only fetch is faked.
 */
import {describe, it, expect, beforeAll, beforeEach, vi} from "vite-plus/test";
import {ACCESS_LIFETIME_SECONDS, PERSONAL_ORG, createFakeAuth, orgOf} from "../setup/fake-auth";
import {resetSharedRuntime} from "../setup/shared-runtime-reset";
import {createMockJWT} from "../utils/test-helpers";

const BASE_URL = "https://api.test.invalid";
const TAB_ORG_KEY = "__rixl_auth_orgId";

const mocks = vi.hoisted(() => ({apiTypes: undefined as unknown}));
vi.mock("../../auth/api/types", async (importOriginal) => (mocks.apiTypes ??= await importOriginal()));

let server: ReturnType<typeof createFakeAuth>;
/** Orgs the gateway holds to be unavailable, with the reason it gives. */
let unavailable: Map<string, string>;
/** Paths answered with an org reason whatever the token's org, as for another org the route acts on. */
let refusedPaths: Map<string, string>;
let tokenRequests: number;
let deferRefresh: (() => Promise<void>) | undefined;
let leaveReply: (() => Promise<Response>) | undefined;
let emailReply: ((request: Request) => Promise<Response>) | undefined;
let deferResponse: (() => Promise<void>) | undefined;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {status, headers: {"Content-Type": "application/json"}});

const refreshRoute = async (request: Request): Promise<Response> => {
  tokenRequests += 1;
  try {
    const {data} = await server.refresh({body: await request.json()});
    await deferRefresh?.();
    return json(200, data);
  } catch (error) {
    const {status, data} = error as {status: number; data: unknown};
    return json(status, data);
  }
};

const fakeFetch = async (input: unknown): Promise<Response> => {
  const request = input as Request;
  const {pathname} = new URL(request.url);
  if (pathname === "/auth/v1/token") return refreshRoute(request);
  if (pathname === "/auth/v1/logout") return json(200, {});
  if (pathname.endsWith("/members/current") && request.method === "DELETE" && leaveReply) return leaveReply();
  if (pathname.endsWith("/verify") && emailReply) return emailReply(request);
  const targetReason = refusedPaths.get(pathname);
  if (targetReason) return json(403, {error: "forbidden", reason: targetReason});

  const org = orgOf(request.headers.get("Authorization")?.slice("Bearer ".length));
  // Listing the user's orgs is account-scoped: it works whatever the token's org.
  const reason = pathname === "/auth/v1/organizations" ? undefined : unavailable.get(org ?? "");
  // An empty reason stands for a plain 403.
  if (reason !== undefined) {
    await deferResponse?.();
    return json(403, {error: "forbidden", reason: reason || undefined});
  }
  if (pathname === "/auth/v1/userinfo") return json(200, {id: "user-1", permissions: ["videos:write"]});
  return json(200, {id: org});
};

const loadSdk = async () => {
  resetSharedRuntime();
  vi.resetModules();
  vi.stubGlobal("fetch", fakeFetch);
  const sdk = await import("../../index");
  const {persistSignInTokens} = await import("../../auth/api/tokens");
  await sdk.connect({baseUrl: BASE_URL, auth: {}});
  persistSignInTokens(server.signIn());
  return sdk;
};

const onOrgB = async () => {
  const sdk = await loadSdk();
  await sdk.selectOrganization("org-b");
  tokenRequests = 0;
  return sdk;
};

const thrownBy = (call: Promise<unknown>): Promise<unknown> =>
  call.then(
    () => undefined,
    (error: unknown) => error
  );

beforeAll(async () => {
  await import("../../index");
}, 30_000);

beforeEach(() => {
  server = createFakeAuth();
  unavailable = new Map();
  refusedPaths = new Map();
  deferResponse = undefined;
  leaveReply = undefined;
  emailReply = undefined;
  deferRefresh = undefined;
  tokenRequests = 0;
});

describe("An org refusal on a request made with the tab's token", () => {
  it.each(["NOT_A_MEMBER", "ORG_DELETED"])("is an OrgAccessError that takes the tab off its org: %s", async (reason) => {
    const sdk = await onOrgB();
    unavailable.set("org-b", reason);
    server.refusals.set("org-b", reason);

    const error = await thrownBy(sdk.getOrganization("org-b"));

    expect(error).toBeInstanceOf(sdk.OrgAccessError);
    expect(error).toBeInstanceOf(sdk.ApiError);
    expect(error).toMatchObject({status: 403, reason, orgId: "org-b", data: {error: "forbidden", reason}});
    expect(sdk.orgContext.get()).toBeUndefined();
    expect(sdk.orgRefusal.get()).toEqual({reason, orgId: "org-b"});
    expect(sessionStorage.getItem(TAB_ORG_KEY)).toBeNull();
    expect(sdk.isLogged.get()).toBe(true);
    // The refused token isn't handed out again, and no other org is picked.
    await expect(sdk.getToken()).rejects.toMatchObject({name: "OrgAccessError", reason, orgId: "org-b"});
    expect(tokenRequests).toBe(0);

    await sdk.selectOrganization(PERSONAL_ORG);
    expect(orgOf(await sdk.getToken())).toBe(PERSONAL_ORG);
  });

  it("keeps a suspended tab's org, and has the next getToken() ask again", async () => {
    const sdk = await onOrgB();
    await sdk.resolvePermissions();
    expect(sdk.hasPermission("videos:write")).toBe(true);
    unavailable.set("org-b", "MEMBERSHIP_SUSPENDED");
    server.refusals.set("org-b", "MEMBERSHIP_SUSPENDED");

    await expect(sdk.getOrganization("org-b")).rejects.toMatchObject({name: "OrgAccessError", reason: "MEMBERSHIP_SUSPENDED"});

    expect(sessionStorage.getItem(TAB_ORG_KEY)).toBe("org-b");
    expect(sdk.orgRefusal.get()).toEqual({reason: "MEMBERSHIP_SUSPENDED", orgId: "org-b"});
    // It has no token, so orgContext names no org: orgRefusal says which one it keeps.
    expect(sdk.orgContext.get()).toBeUndefined();
    expect(sdk.hasPermission("videos:write")).toBe(false);
    expect(sdk.permissionsResolved.get()).toBe(false);
    await expect(sdk.getToken()).rejects.toMatchObject({name: "OrgAccessError", reason: "MEMBERSHIP_SUSPENDED"});
    expect(tokenRequests).toBe(1);

    unavailable.clear();
    server.refusals.clear();
    expect(orgOf(await sdk.getToken())).toBe("org-b");
    expect(sdk.orgRefusal.get()).toBeUndefined();
    expect(sdk.orgContext.get()?.orgId).toBe("org-b");
  });

  it("shows the same for a suspension the next refresh reports", async () => {
    const sdk = await onOrgB();
    server.refusals.set("org-b", "MEMBERSHIP_SUSPENDED");
    vi.setSystemTime(Date.now() + ACCESS_LIFETIME_SECONDS * 1000 + 1);

    await expect(sdk.getToken()).rejects.toMatchObject({reason: "MEMBERSHIP_SUSPENDED"});

    expect(sdk.orgContext.get()).toBeUndefined();
    expect(sdk.orgRefusal.get()).toEqual({reason: "MEMBERSHIP_SUSPENDED", orgId: "org-b"});
    expect(sessionStorage.getItem(TAB_ORG_KEY)).toBe("org-b");
  });

  it.each(["NOT_A_MEMBER", "ORG_DELETED"])("completes a switch after the old org reports %s", async (reason) => {
    const sdk = await onOrgB();
    const started = Promise.withResolvers<void>();
    const deliver = Promise.withResolvers<void>();
    deferRefresh = () => {
      started.resolve();
      return deliver.promise;
    };
    const selected = thrownBy(sdk.selectOrganization("org-c"));
    await started.promise;
    unavailable.set("org-b", reason);
    await expect(sdk.getOrganization("org-b")).rejects.toMatchObject({reason});
    expect(sdk.orgContext.get()).toBeUndefined();

    deliver.resolve();
    await expect(selected).resolves.toBeUndefined();
    expect(sdk.orgContext.get()?.orgId).toBe("org-c");
    expect(sdk.orgRefusal.get()).toBeUndefined();
    expect(tokenRequests).toBe(1);
  });

  it("dismisses a suspended refusal when the refresh token is rejected", async () => {
    const sdk = await onOrgB();
    unavailable.set("org-b", "MEMBERSHIP_SUSPENDED");
    await expect(sdk.getOrganization("org-b")).rejects.toMatchObject({reason: "MEMBERSHIP_SUSPENDED"});
    const notified = vi.fn();
    const stop = sdk.orgRefusal.listen(notified);
    try {
      server.revoke();
      await expect(sdk.getToken()).rejects.toMatchObject({status: 401});
      expect(sdk.isLogged.get()).toBe(false);
      expect(sdk.orgRefusal.get()).toBeUndefined();
      expect(notified).toHaveBeenCalledWith(undefined, expect.objectContaining({orgId: "org-b"}), undefined);
      expect(sessionStorage.getItem(TAB_ORG_KEY)).toBe("org-b");
    } finally {
      stop();
    }
  });

  it("keeps the replacement token when the same org was reselected before an older refusal arrived", async () => {
    const sdk = await onOrgB();
    const arrive = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    deferResponse = () => {
      started.resolve();
      return arrive.promise;
    };
    unavailable.set("org-b", "NOT_A_MEMBER");

    const oldRequest = thrownBy(sdk.getOrganization("org-b"));
    await started.promise;
    unavailable.clear();
    await sdk.selectOrganization("org-b");
    const replacement = await sdk.getToken();
    arrive.resolve();

    expect(await oldRequest).toMatchObject({status: 403});
    expect(sdk.orgRefusal.get()).toBeUndefined();
    expect(sdk.orgContext.get()?.orgId).toBe("org-b");
    expect(await sdk.getToken()).toBe(replacement);
  });

  it("reaches a caller of resolvePermissions() and of a generated function", async () => {
    const sdk = await onOrgB();
    unavailable.set("org-b", "NOT_A_MEMBER");
    const {authV1OrganizationServiceGetOrganization} = sdk;

    const [first, second] = await Promise.all([
      thrownBy(sdk.resolvePermissions()),
      thrownBy(authV1OrganizationServiceGetOrganization({path: {org_id: "org-b"}, throwOnError: true})),
    ]);

    expect(first).toMatchObject({name: "OrgAccessError", orgId: "org-b"});
    expect(second).toMatchObject({name: "OrgAccessError", orgId: "org-b"});
  });
});

/**
 * The gateway's account-scoped routes (internal/routes/account_scoped.go) don't
 * require the token's org, so a reason they answer with isn't about it.
 */
describe("Managing membership", () => {
  it("keeps an ordinary 403 message for each membership action", async () => {
    const sdk = await onOrgB();
    refusedPaths.set("/auth/v1/organizations/org-c/members/current", "generic");
    refusedPaths.set("/auth/v1/organizations/org-c/members/user-2", "generic");
    for (const action of [
      () => sdk.leaveOrganization("org-c"),
      () => sdk.deleteMember("org-c", "user-2"),
      () => sdk.updateMemberRole("org-c", "user-2", "member"),
    ]) {
      await expect(action()).rejects.toMatchObject({name: "ApiError", status: 403, message: "forbidden"});
    }
    expect(sdk.orgContext.get()?.orgId).toBe("org-b");
  });

  it("keeps a voluntary leave rather than an older refusal", async () => {
    const sdk = await onOrgB();
    const started = Promise.withResolvers<void>();
    const response = Promise.withResolvers<Response>();
    leaveReply = () => {
      started.resolve();
      return response.promise;
    };
    const left = sdk.leaveOrganization("org-b");
    await started.promise;
    unavailable.set("org-b", "NOT_A_MEMBER");
    try {
      await expect(sdk.getOrganization("org-b")).rejects.toMatchObject({reason: "NOT_A_MEMBER"});
    } finally {
      response.resolve(json(200, {}));
      await left;
    }
    expect(sdk.orgRefusal.get()).toBeUndefined();
    expect(sdk.orgSelectionRequired.get()).toBe(true);
    await expect(sdk.getToken()).resolves.toBeUndefined();
  });

  it("clears the org on voluntary leave and waits for another selection without a refusal", async () => {
    const sdk = await onOrgB();
    await sdk.resolvePermissions();

    await sdk.leaveOrganization("org-b");

    expect(sdk.orgContext.get()).toBeUndefined();
    expect(sdk.orgRefusal.get()).toBeUndefined();
    expect(sdk.permissionsResolved.get()).toBe(false);
    await expect(sdk.getToken()).resolves.toBeUndefined();
    expect(tokenRequests).toBe(0);
    expect(sdk.isLogged.get()).toBe(true);

    resetSharedRuntime();
    vi.resetModules();
    const reloaded = await import("../../index");
    await expect(reloaded.connect({baseUrl: BASE_URL, auth: {}})).resolves.toBeUndefined();
    expect(reloaded.isLogged.get()).toBe(true);
    expect(reloaded.orgSelectionRequired.get()).toBe(true);
    expect(reloaded.orgRefusal.get()).toBeUndefined();
    expect(tokenRequests).toBe(0);
    await reloaded.selectOrganization(PERSONAL_ORG);
    expect(orgOf(await reloaded.getToken())).toBe(PERSONAL_ORG);
    expect(reloaded.orgSelectionRequired.get()).toBe(false);
  });
});

describe("Email verification keeps its initiating context", () => {
  it.each(["signed in", "signed out"])(
    "discards signup verification started while %s if logout happens before it answers",
    async (initial) => {
      const sdk = await onOrgB();
      if (initial === "signed out") await sdk.logout();
      const started = Promise.withResolvers<void>();
      const response = Promise.withResolvers<Response>();
      emailReply = () => {
        started.resolve();
        return response.promise;
      };
      const params = {verification_id: "signup-1", code: "123456"};
      const verified = thrownBy(sdk.verifyEmailWithCode(params));
      await started.promise;
      await sdk.logout();
      response.resolve(json(200, {verified: true, tokens: server.signIn()}));

      await expect(verified).resolves.toMatchObject({name: "ApiError", status: 409});
      expect(sdk.isLogged.get()).toBe(false);
      expect(document.cookie).not.toContain("__rixl_auth_refreshToken");
    }
  );

  it.each(["full", "limited"])("does not restore %s credentials after a late email-change response", async (kind) => {
    const sdk = await onOrgB();
    const {setLimitedAccessState} = await import("../../auth/authStore");
    const orgId = kind === "limited" ? PERSONAL_ORG : "org-b";
    if (kind === "limited") setLimitedAccessState(server.signIn().access_token, "add_email");
    const tokens = server.reissue(orgId);
    const started = Promise.withResolvers<void>();
    const response = Promise.withResolvers<Response>();
    emailReply = () => {
      started.resolve();
      return response.promise;
    };
    const changed = sdk.verifyEmailChange("change-1", "123456");
    await started.promise;
    await sdk.logout();
    response.resolve(json(200, {verified: true, tokens}));

    await expect(changed).resolves.toMatchObject({verified: true, tokens: undefined});
    expect(sdk.isLogged.get()).toBe(false);
    expect(document.cookie).not.toContain("__rixl_auth_refreshToken");
  });

  it.each(["full", "limited"])("verifies an email change using %s credentials and keeps the sign-in", async (kind) => {
    const sdk = await onOrgB();
    const {setLimitedAccessState} = await import("../../auth/authStore");
    const orgId = kind === "limited" ? PERSONAL_ORG : "org-b";
    const bearer = kind === "limited" ? server.signIn().access_token : await sdk.getToken();
    if (kind === "limited") setLimitedAccessState(bearer!, "add_email");
    emailReply = async (request) => {
      expect(new URL(request.url).pathname).toBe("/auth/v1/users/current/emails/verify");
      expect(request.headers.get("Authorization")).toBe(`Bearer ${bearer}`);
      expect(await request.json()).toEqual({verification_id: "change-1", code: "123456"});
      return json(200, {verified: true, tokens: server.reissue(orgId)});
    };

    await expect(sdk.verifyEmailChange("change-1", "123456")).resolves.toMatchObject({verified: true});
    expect(sdk.orgContext.get()?.orgId).toBe(orgId);
    expect(sdk.requiresAction.get()).toBeNull();
  });
});

describe("An org reason from an account-scoped route", () => {
  const expectTabUnchanged = async (sdk: Awaited<ReturnType<typeof loadSdk>>, token: string | undefined) => {
    expect(sdk.orgContext.get()?.orgId).toBe("org-b");
    expect(sdk.orgRefusal.get()).toBeUndefined();
    expect(sessionStorage.getItem(TAB_ORG_KEY)).toBe("org-b");
    expect(await sdk.getToken()).toBe(token);
    expect(tokenRequests).toBe(0);
  };

  it.each(["ACCEPT", "DECLINE"] as const)("about the invited org leaves the tab on its own: %s", async (state) => {
    const sdk = await onOrgB();
    const token = await sdk.getToken();
    refusedPaths.set(`/auth/v1/invitations/invite-token/${state.toLowerCase()}`, "ORG_DELETED");

    const error = await thrownBy(sdk.publicRespondToInvitation("invite-token", sdk.MembershipState[state]));

    expect(error).toMatchObject({name: "ApiError", status: 403, data: {reason: "ORG_DELETED"}});
    await expectTabUnchanged(sdk, token);
  });

  it.each([
    "GET /auth/v1/organizations",
    "GET /auth/v1/sign-ins",
    "DELETE /auth/v1/sign-ins/sign-in-9",
    "POST /auth/v1/sign-ins/revoke-others",
    "POST /auth/v1/logout/all",
    "GET /auth/v1/users/current",
    "POST /auth/v1/users/current/invitations/accept",
  ])("reaches the caller of %s as it came", async (route) => {
    const sdk = await onOrgB();
    const token = await sdk.getToken();
    const [method, url] = route.split(" ") as ["GET" | "POST" | "DELETE", string];
    refusedPaths.set(url, "NOT_A_MEMBER");

    const error = await thrownBy(sdk.client.request({method, url, throwOnError: true}));

    expect(error).toMatchObject({name: "ApiError", status: 403, data: {reason: "NOT_A_MEMBER"}});
    await expectTabUnchanged(sdk, token);
  });

  it.each(["POST /auth/v1/organizations", "GET /auth/v1/organizations/org-b/members", "GET /auth/v1/sign-ins/sign-in-9"])(
    "doesn't cover %s, which needs the token's org",
    async (route) => {
      const sdk = await onOrgB();
      const [method, url] = route.split(" ") as ["GET" | "POST", string];
      refusedPaths.set(url, "NOT_A_MEMBER");

      const error = await thrownBy(sdk.client.request({method, url, throwOnError: true}));

      expect(error).toMatchObject({name: "OrgAccessError", orgId: "org-b"});
      expect(sdk.orgContext.get()).toBeUndefined();
    }
  );

  it("is recognised behind an API URL that carries a path", async () => {
    const sdk = await onOrgB();
    await sdk.connect({baseUrl: `${BASE_URL}/api`});
    refusedPaths.set("/api/auth/v1/sign-ins", "NOT_A_MEMBER");

    const error = await thrownBy(sdk.client.request({method: "GET", url: "/auth/v1/sign-ins", throwOnError: true}));

    expect(error).toMatchObject({name: "ApiError", status: 403});
    expect(sdk.orgContext.get()?.orgId).toBe("org-b");
  });
});

describe("A tab whose org is refused", () => {
  it.each(["NOT_A_MEMBER", "MEMBERSHIP_SUSPENDED"])("lists organizations only after selecting an org it can use: %s", async (reason) => {
    const sdk = await onOrgB();
    unavailable.set("org-b", reason);
    server.refusals.set("org-b", reason);
    await thrownBy(sdk.getOrganization("org-b"));

    await expect(sdk.listOrganizations()).rejects.toMatchObject({name: "OrgAccessError", reason, orgId: "org-b"});

    await sdk.selectOrganization(sdk.personalOrgId.get()!);
    await expect(sdk.listOrganizations()).resolves.toEqual({organizations: [], next_page_token: ""});
  });
});

describe("Other 403s", () => {
  const getWith = async (sdk: Awaited<ReturnType<typeof loadSdk>>, token: string) =>
    thrownBy(
      sdk.authV1OrganizationServiceGetOrganization({
        path: {org_id: "org-b"},
        headers: {Authorization: `Bearer ${token}`},
        throwOnError: true,
      })
    );

  it.each([
    ["no reason", ""],
    ["a reason that isn't about the org", "SOMETHING_ELSE"],
  ])("stay plain ApiErrors with %s", async (_label, reason) => {
    const sdk = await onOrgB();
    unavailable.set("org-b", reason);

    await expect(sdk.getOrganization("org-b")).rejects.toMatchObject({name: "ApiError", status: 403});

    expect(sessionStorage.getItem(TAB_ORG_KEY)).toBe("org-b");
    expect(orgOf(await sdk.getToken())).toBe("org-b");
    expect(tokenRequests).toBe(0);
  });

  it.each([
    ["another org's token", {id: "user-1", sign_in_id: "sign-in-1", org_id: "org-x"}],
    ["another sign-in's token", {id: "user-2", sign_in_id: "sign-in-9", org_id: "org-b"}],
  ])("leave the tab alone when the request carried %s", async (_label, claims) => {
    const sdk = await onOrgB();
    const token = createMockJWT(claims);
    unavailable.set(claims.org_id, "NOT_A_MEMBER");

    expect(await getWith(sdk, token)).toMatchObject({name: "ApiError", status: 403});

    expect(sdk.orgContext.get()?.orgId).toBe("org-b");
    expect(sessionStorage.getItem(TAB_ORG_KEY)).toBe("org-b");
  });
});

describe("The package root", () => {
  it("exports ApiError, which every API rejection is", async () => {
    const sdk = await onOrgB();
    unavailable.set("org-b", "");

    expect(sdk.ApiError).toBeTypeOf("function");
    expect(await thrownBy(sdk.getOrganization("org-b"))).toBeInstanceOf(sdk.ApiError);
  });
});
