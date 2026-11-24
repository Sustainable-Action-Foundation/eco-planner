# Auth and sessions

## Login is a mailed link, nothing else
There are no passwords, verification steps or reset flows. A mailed link is the only way in, and the first link for a new address creates the account.

- `POST /api/login-link` requests a link, `PATCH` redeems it (`src/app/api/login-link/route.ts`). The form is shared by `/login` and `/signup` (`src/components/form/forms/login.tsx`, `variant` prop).
- The token is stored hashed (`LoginTokens.token_hash`, `src/lib/authToken.ts`), lives 15 minutes and travels in the URL fragment (`/login/link#t=...`), so it reaches neither server logs nor referrers. It is redeemed only by an explicit request from the interstitial page, so mail scanners that open links do not consume it.
- The request answers with the same generic message for every address, and does its work in `after()`: neither the text nor the timing reveals whether an account exists. Throttled requests get the same answer.
- One pending link per address. It is written with a single upsert on the unique `email`; a delete followed by an insert deadlocks when several addresses ask at once.
- There is no code in the mail. A code would only help cross-device logins; add one if users ask.
- New accounts are enrolled by e-mail domain (`enrollmentFor` in `src/lib/enrollment.ts`).

Gotchas:
- The interstitial's effect must stay idempotent: React strict mode re-runs it after the fragment has been scrubbed.
- The throttle keys on the **last** hop of `X-Forwarded-For`, because the reverse proxy in front of the app appends to that header. The app must not be reachable around the proxy, or the header can be forged; the compose files publish the port on loopback only.
- Render mail texts before `after()`, with the requester's translator; only the lookups, the row and the send are deferred.
- Every user creation must set `username_lower`.

## Onboarding and names
- A redeemed link sends anyone without a name to `/welcome`, which asks once for first and last name (`PATCH /api/user`).
- `displayName()` in `src/functions/personName.ts` shows "First Last" and falls back to the username. Use it wherever a person is named. The username stays the URL slug.

## Session lifetime and revocation
- A login lasts 30 days, or a year with "remember me" (`sessionOptionsFor` in `src/lib/session.ts`). Why: occasional users should not have to log in every time, and long cookies then need a kill switch.
- The cookie is stateless (iron-session). `Users.session_version` is written into it; `getSession()` treats a cookie with an older version, or for a deleted user, as anonymous. "Log out everywhere" (`POST /api/logout { everywhere: true }`) bumps the version. Super admins can do the same for another user.
- **`getSession` vs `readSession`.** Code that trusts `session.user` calls `getSession` (checked, one memoized lookup per request). `readSession` skips the check and is only for the proxy and for the routes that issue or destroy sessions. Never `save()` a session returned by `getSession`.
- When changing lifetimes, set iron-session's `ttl` together with `cookieOptions.maxAge`. A `maxAge` alone leaves the seal at its 14-day default and logs users out early.

## The proxy
`src/proxy.ts` sends anonymous visitors away from create/edit pages and signed-in visitors away from the login page.
- It reads the cookie unchecked on every request. Only on pages whose redirect depends on the login does it check the cookie against the database, and it deletes a stale cookie there. Without that, a stale cookie passes the proxy while every page sees an anonymous visitor: create pages render empty and `/login` bounces back to `/`.
- That check is memoized for a minute per user (`isSessionCurrentForProxy`), because production prefetches every create/edit link on a page. `forgetProxySession` must be called wherever `session_version` is bumped, so revocation stays immediate. The memo is in memory and single-instance, like the rate limiters.
- When touching the proxy or revocation, run the query-budget canary against a production build; see [testing.md](testing.md).

## Mail
`src/mailClient.ts` sends through Microsoft Graph with client credentials; the variables are listed in [`README.md`](../../README.md#setup). Under `TEST_ENVIRONMENT=testing` nothing is sent and the last mail per recipient can be read back through `/api/test/outbox`.

## Test-only login
`POST /api/test/login` exists only under `TEST_ENVIRONMENT=testing`. Suites sign in through it because the link throttle could never take hundreds of logins; the link flow has its own specs.
