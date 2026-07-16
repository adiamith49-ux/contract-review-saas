import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/admin(.*)",   // admin has its own separate auth
]);

// ─── Domain split ──────────────────────────────────────────────────────────────
// contralyne.com      → marketing/landing page ONLY (good for SEO; marketing
//                       team never touches the application)
// app.contralyne.com  → the application (dashboard, contracts, admin, auth)
// Any other host (localhost, vercel previews) → everything served as before.

const LANDING_HOSTS = new Set(
  (process.env.NEXT_PUBLIC_LANDING_HOSTS ?? "contralyne.com,www.contralyne.com")
    .split(",").map(h => h.trim()).filter(Boolean),
);
const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST ?? "app.contralyne.com";

export default clerkMiddleware(async (auth, req) => {
  // req.nextUrl.hostname is unreliable behind proxies — use the Host header
  const host = (req.headers.get("host") ?? req.nextUrl.hostname).split(":")[0].toLowerCase();
  const path = req.nextUrl.pathname;

  // Root domain: serve the landing page only — every app path moves to the subdomain
  if (LANDING_HOSTS.has(host)) {
    if (path !== "/") {
      const url = req.nextUrl.clone();
      url.hostname = APP_HOST;
      url.port = "";
      return NextResponse.redirect(url, 308);
    }
    return; // landing page is public
  }

  // App subdomain has no landing page: "/" goes straight to the dashboard
  // (Clerk bounces signed-out visitors to /sign-in from there)
  if (host === APP_HOST && path === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (!isPublicRoute(req)) {
    const { userId } = auth();
    if (!userId) {
      return auth().redirectToSignIn({ returnBackUrl: req.url });
    }
  }

  // Keep the application out of search engines — only the landing page should rank
  if (host === APP_HOST) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
