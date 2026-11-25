/**
 * A change of sign-in touches several stores and cookies. No subscriber may hear
 * of it halfway: ensurePermissions() reads the cookies as the truth. These tests
 * use the package root and the real generated client; only fetch is faked.
 */
import {describe, it, expect, beforeAll, beforeEach, afterEach, vi} from "vite-plus/test";
import {ACCESS_LIFETIME_SECONDS, PERSONAL_ORG, claimsOf, createFakeAuth} from "../setup/fake-auth";
import {resetSharedRuntime} from "../setup/shared-runtime-reset";
import {createTabStorage} from "../setup/tabs";

const BASE_URL = "https://api.test.invalid";
const COOKIE_PREFIX = "__rixl_auth_";
const ROTATION_SETTLE_MS = 1000;

const mocks = vi.hoisted(() => ({apiTypes: undefined as unknown}));
vi.mock("../../auth/api/types", async (importOriginal) => (mocks.apiTypes ??= await importOriginal()));

let server: ReturnType<typeof createFakeAuth>;
/** The account the next login answers with, and the refresh token it was given. */
let nextUser: string;
let issuedAtLogin: string;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {status, headers: {"Content-Type": "application/json"}});

const fakeFetch = async (input: unknown): Promise<Response> => {
  const request = input as Request;
  const {pathname} = new URL(request.url);
  if (pathname === "/auth/v1/login") {
    const tokens = server.signIn(nextUser);
    issuedAtLogin = tokens.refresh_token;
    return json(200, {status: "ok", ...tokens});
  }
  if (pathname === "/auth/v1/token") {
    try {
      return json(200, (await server.refresh({body: await request.json()})).data);
    } catch (error) {
      const {status, data} = error as {status: number; data: unknown};
      return json(status, data);
    }
  }
  if (pathname === "/auth/v1/userinfo") return json(200, {permissions: ["videos:read"]});
  return json(200, {});
};

/** Loads the package as a page load would. */
const loadPage = async () => {
  resetSharedRuntime();
  vi.resetModules();
  vi.stubGlobal("sessionStorage", createTabStorage());
  vi.stubGlobal("fetch", fakeFetch);
  const sdk = await import("../../index");
  await sdk.connect({baseUrl: BASE_URL, auth: {}});
  return sdk;
};

type Page = Awaited<ReturnType<typeof loadPage>>;

const logIn = async (page: Page, userId: string) => {
  nextUser = userId;
  await page.loginWithEmail(`${userId}@example.com`, "Password123!");
};

const storedCookies = (): Partial<Record<string, string>> =>
  Object.fromEntries(
    document.cookie
      .split(";")
      .map((pair) => pair.trim())
      .filter((pair) => pair.startsWith(COOKIE_PREFIX))
      .map((pair) => {
        const separator = pair.indexOf("=");
        return [pair.slice(COOKIE_PREFIX.length, separator), decodeURIComponent(pair.slice(separator + 1))];
      })
  );

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const expireAccessTokens = () => vi.setSystemTime(Date.now() + ACCESS_LIFETIME_SECONDS * 1000 + 1);

/** The subscriber the SDK supports, without a guard against the cleared org. */
const resolveOnOrgChange = (page: Page) => page.orgContext.listen(() => void page.ensurePermissions().catch(() => undefined));

/** The page, the cookies and a new page all hold the sign-in `signIn`, and it still refreshes. */
const expectSignedInAs = async (page: Page, userId: string, signIn: string) => {
  expect(storedCookies()).toMatchObject({
    refreshToken: issuedAtLogin,
    signIn: `${userId}:${signIn}`,
    personalOrgId: PERSONAL_ORG,
    isLogged: "true",
  });
  expect(page.isLogged.get()).toBe(true);
  expect(page.orgContext.get()?.orgId).toBe(PERSONAL_ORG);
  await vi.waitFor(() => expect(page.permissionsResolved.get()).toBe(true));

  expireAccessTokens();
  expect(claimsOf(await page.getToken())).toMatchObject({id: userId, org_id: PERSONAL_ORG});
  expect(storedCookies()["signIn"]).toBe(`${userId}:${signIn}`);
  const newPage = await loadPage();
  expect(claimsOf(await newPage.getToken())).toMatchObject({id: userId, org_id: PERSONAL_ORG});
};

beforeAll(async () => {
  await import("../../index");
}, 30_000);

beforeEach(() => {
  vi.useFakeTimers({toFake: ["Date"]});
  server = createFakeAuth();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Signing in while an orgContext subscriber calls ensurePermissions()", () => {
  it.each(["user-1", "user-2"])("keeps the sign-in of %s made after a logout in the same page", async (userId) => {
    const page = await loadPage();
    resolveOnOrgChange(page);
    await logIn(page, "user-1");
    await page.logout();
    await settle();

    await logIn(page, userId);

    await expectSignedInAs(page, userId, "sign-in-2");
  });

  it.each(["user-1", "user-2"])(
    "keeps the sign-in of %s made after a refused refresh",
    async (userId) => {
      const page = await loadPage();
      resolveOnOrgChange(page);
      await logIn(page, "user-1");
      server.revoke();
      expireAccessTokens();
      await expect(page.getToken()).rejects.toMatchObject({status: 401});
      await settle();

      await logIn(page, userId);

      await expectSignedInAs(page, userId, "sign-in-2");
    },
    10_000
  );

  it.each(["user-1", "user-2"])("keeps the sign-in of %s made on a tab another tab rotated past", async (userId) => {
    const stale = await loadPage();
    await logIn(stale, "user-1");
    resolveOnOrgChange(stale);
    const other = await loadPage();
    await other.getToken();

    await logIn(stale, userId);

    await expectSignedInAs(stale, userId, "sign-in-2");
  });

  it("keeps the new sign-in when another tab has signed in as a different user", async () => {
    const loginPage = await loadPage();
    resolveOnOrgChange(loginPage);
    await logIn(await loadPage(), "user-1");

    await logIn(loginPage, "user-2");

    await expectSignedInAs(loginPage, "user-2", "sign-in-2");
  });

  it("keeps the new sign-in when a signed-in tab hasn't yet seen another user's", async () => {
    const stale = await loadPage();
    await logIn(stale, "user-1");
    resolveOnOrgChange(stale);
    await logIn(await loadPage(), "user-2");

    await logIn(stale, "user-3");

    await expectSignedInAs(stale, "user-3", "sign-in-3");
  });
});

describe("Signing out while a subscriber calls ensurePermissions()", () => {
  it.each(["orgContext", "accessToken", "isLogged"] as const)(
    "leaves the tab signed out when %s is the store it listens to",
    async (name) => {
      const page = await loadPage();
      await logIn(page, "user-1");
      const {accessToken} = await import("../../auth/token-atoms");
      const store = name === "accessToken" ? accessToken : page[name];
      const seenLoggedIn: boolean[] = [];
      store.listen(() => {
        void page.ensurePermissions().catch(() => undefined);
        seenLoggedIn.push(page.isLogged.get());
      });
      const {removeTokens} = await import("../../auth/authStore");

      removeTokens();
      await settle();

      expect(seenLoggedIn).not.toContain(true);
      expect(page.isLogged.get()).toBe(false);
      const {refreshToken} = await import("../../auth/token-atoms");
      expect(refreshToken.get() || "").toBe("");
      expect(storedCookies()).toEqual({});
    }
  );
});
