import { NextResponse, type NextRequest } from 'next/server';
import { isSessionCurrentForProxy, readSession, SessionCookieName } from '@/lib/session';
import { cookies } from 'next/headers';

/**
 * Matches creation and editing pages, with or without trailing slashes.
 * For example, "/roadmap/create" or "/action/[actionId]/edit/"
 * Also matches the page for editing historical data for goals; "/goal/[goalId]/historical-data/edit"
 */
const createOrEditRegEx = /\/(create|edit|historical-data)\/?$/;

/** Matches strings starting with /@ or /%40 (URL-encoded @) */
const userIndicatorRegEx = /^\/(@|%40)/;

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isCreateOrEdit = createOrEditRegEx.test(pathname);
  // The link interstitial is exempt from the login-page rule: redeeming a login link
  // replaces the session, which is how you switch accounts.
  const isAuthPage = (pathname.startsWith('/login') && !pathname.startsWith('/login/link')) || pathname.startsWith('/signup');

  // Unchecked read on every request. Only the pages whose redirects depend on the login
  // also check the cookie against the database (one indexed lookup, memoized for a minute
  // since production prefetches every create/edit link on a page): a cookie whose user is
  // gone, or whose session was revoked, would otherwise pass here while every page treats
  // the visitor as anonymous — create pages render empty, /login bounces back to /.
  const { user } = await readSession(await cookies());
  const claimsLogin = user?.isLoggedIn === true;
  const isLoggedIn = claimsLogin && (isCreateOrEdit || isAuthPage)
    ? await isSessionCurrentForProxy(user.id, user.sessionVersion ?? 0)
    : claimsLogin;
  const staleCookie = claimsLogin && !isLoggedIn;

  // Redirect away from the login and signup pages if already logged in
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Redirect away from creation and editing pages if not logged in
  if (isCreateOrEdit && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url);
    // Save the current page as the "from" query parameter so we can redirect back after logging in
    loginUrl.searchParams.set('from', pathname);
    const response = NextResponse.redirect(loginUrl);
    if (staleCookie) response.cookies.delete(SessionCookieName);
    return response;
  }

  // Silently redirect from "/@username" to "/user/@username"
  if (userIndicatorRegEx.test(pathname)) {
    const newUrl = new URL(`/user${pathname}`, req.url);
    newUrl.search = req.nextUrl.search;
    return NextResponse.rewrite(newUrl);
  }
  // If we add for example # or $ to go to organisation pages or something, we can do it in a similar way to the above user rewrite

  const response = NextResponse.next();
  // A stale cookie reaching the login page is dropped, so the visitor logs in as anyone would
  if (staleCookie) response.cookies.delete(SessionCookieName);
  return response;
}
