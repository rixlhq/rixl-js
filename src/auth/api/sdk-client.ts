import {apiURL} from "../api-url";
import {getToken} from "../authStore";
import {HTTP_STATUS} from "../constants";
import {ApiError} from "./types";
import {addClientInitializer, configureAllClients} from "../../client-registry";
import {shared} from "../../shared-runtime";

interface WireErrorBody {
  error?: string;
  details?: string;
  code?: number;
}

function isWireErrorBody(error: unknown): error is WireErrorBody {
  return typeof error === "object" && error !== null;
}

type TokenResolver = () => Promise<string | undefined>;

// Shared across copies of this package so a duplicate copy cannot end up with a
// second set of interceptors or fall back to session tokens while the copy the
// consumer configured is using a platform/API-key credential.
//
// `tokenResolver` defaults to the end-user session token. `connect()` swaps it
// out via setTokenResolver() when configured with an apiKey or a bare token
// instead, so there is always exactly one credential source feeding the one
// interceptor below, regardless of which mode is active.
const state = shared("sdkClientState", () => ({configured: false, tokenResolver: getToken as TokenResolver}));

export function setTokenResolver(resolver: TokenResolver): void {
  state.tokenResolver = resolver;
}

/**
 * Routes that do not require a Bearer token at the gateway edge. These
 * authenticate via credentials in the request body (or are webhooks verified by
 * signature), so attaching an Authorization header here would make the gateway
 * attempt to validate a stale/absent token and reject the request with 401.
 * Mirrors `publicRoutes` in backend/gateway/internal/routes/routes.go.
 */
const publicRoutes: ReadonlyArray<{method: string; path: string; prefix?: boolean}> = [
  {method: "POST", path: "/auth/v1/token"},
  {method: "POST", path: "/auth/v1/register"},
  {method: "POST", path: "/auth/v1/login"},
  {method: "POST", path: "/auth/v1/email/verify"},
  {method: "POST", path: "/auth/v1/email/verify/resend"},
  {method: "POST", path: "/auth/v1/password/reset"},
  {method: "POST", path: "/auth/v1/password/reset/confirm"},
  {method: "POST", path: "/auth/v1/verify-totp"},
  {method: "POST", path: "/auth/v1/verify-passkey"},
  {method: "POST", path: "/auth/v1/invitations/", prefix: true},
  {method: "POST", path: "/auth/v1/passkey/login/begin"},
  {method: "POST", path: "/auth/v1/passkey/login/finish"},
  {method: "POST", path: "/auth/v1/logout"},
  {method: "POST", path: "/auth/v1/providers/connect"},
  {method: "POST", path: "/auth/v1/blog/unsubscribe/email"},
  {method: "POST", path: "/auth/v1/blog/broadcast"},
  {method: "GET", path: "/media/v1/videos/", prefix: true},
  {method: "GET", path: "/media/v1/images/", prefix: true},
  {method: "GET", path: "/media/v1/languages"},
  {method: "GET", path: "/posts/v1/feeds/", prefix: true},
  {method: "POST", path: "/billing/webhooks/stripe"},
  {method: "POST", path: "/webhooks/storage"},
  {method: "POST", path: "/platform/auth/v1/token"},
  {method: "POST", path: "/platform/auth/v1/refresh"},
];

/**
 * The request's path below the configured API URL, which may carry its own path
 * (`https://example.com/api`). Matched against the full path instead, a public
 * route behind such a prefix would ask for a token, and the refresh request
 * would wait on the very getToken() call that sent it.
 */
function routePath(pathname: string): string {
  const base = new URL(apiURL.get() || "/", "http://base").pathname.replace(/\/+$/, "");
  return base && pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}

function isPublicRoute(method: string, pathname: string): boolean {
  const match = method.toUpperCase();
  return publicRoutes.some(({method: m, path, prefix}) => match === m && (prefix ? pathname.startsWith(path) : pathname === path));
}

export function configureSdkClient(): void {
  if (state.configured) return;
  state.configured = true;

  configureAllClients(apiURL.get());

  apiURL.subscribe((url) => {
    configureAllClients(url);
  });

  addClientInitializer((client) => {
    client.interceptors.request.use(async (request) => {
      if (request.headers.has("Authorization")) {
        return request;
      }
      const {pathname} = new URL(request.url);
      if (isPublicRoute(request.method, routePath(pathname))) {
        return request;
      }
      const token = await state.tokenResolver();
      // Sending the request bare would come back as a gateway 401 indistinguishable
      // from an invalid token, hiding the real cause (no session, or a limited-access
      // flow that withholds full-scope tokens). Fail here instead, with the same
      // status so downstream error maps keyed on 401 still apply.
      if (!token) {
        throw new ApiError("No access token available for an authenticated request", HTTP_STATUS.UNAUTHORIZED, pathname);
      }
      request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    });

    // The generated client throws the parsed error body (a plain object or string),
    // which defeats every instanceof-based status mapping downstream. Wrap it into
    // an ApiError carrying the HTTP status so apiCall error maps and consumers can
    // handle errors by code.
    client.interceptors.error.use((error, response, request) => {
      if (error instanceof Error) {
        return error;
      }
      const body = isWireErrorBody(error) ? error : undefined;
      const status = response?.status ?? body?.code ?? 0;
      const message = body?.error || body?.details || (typeof error === "string" ? error : "Request failed");
      const endpoint = request ? new URL(request.url).pathname : "";
      return new ApiError(message, status, endpoint, error);
    });
  });
}
