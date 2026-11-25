/**
 * The routes the gateway lets a user token call whatever its org: they act on the
 * signed-in account, or on an org the token isn't for. An org reason one of them
 * answers says nothing about the tab's org.
 * Mirrors `accountScopedRoutes` in backend/gateway/internal/routes/account_scoped.go.
 */
const accountScopedRoutes: ReadonlyArray<{method?: string; path: RegExp}> = [
  {method: "POST", path: /^\/auth\/v1\/(token|logout|logout\/all)$/},
  {method: "GET", path: /^\/auth\/v1\/sign-ins$/},
  {method: "DELETE", path: /^\/auth\/v1\/sign-ins\/[^/]+$/},
  {method: "POST", path: /^\/auth\/v1\/sign-ins\/revoke-others$/},
  {path: /^\/auth\/v1\/users\/current(\/|$)/},
  {method: "GET", path: /^\/auth\/v1\/organizations$/},
  {method: "POST", path: /^\/auth\/v1\/invitations\/[^/]+\/(accept|decline)$/},
  {method: "POST", path: /^\/auth\/v1\/invitations\/lookup$/},
];

export const isAccountScopedRoute = (method: string, path: string): boolean =>
  accountScopedRoutes.some((route) => (!route.method || route.method === method.toUpperCase()) && route.path.test(path));
