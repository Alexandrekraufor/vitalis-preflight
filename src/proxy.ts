import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-side request handling: security headers, and a courtesy redirect for
 * visitors without a session cookie.
 *
 * **This is not the security boundary.** Proxy runs before rendering and has no
 * database, so all it can see is whether *some* cookie is present — never
 * whether it is valid, unexpired, or attached to an active account. A forged
 * cookie sails straight through here and is rejected by the page, the action or
 * the route handler, each of which resolves the session against PostgreSQL.
 * Removing this file would cost a nicer redirect and nothing else.
 */
const SESSION_COOKIE = "vitalis_session";

/** Paths a signed-out visitor is allowed to reach. */
const PUBLIC_PREFIXES = ["/login", "/invite", "/api/", "/mcp", "/_next", "/favicon.ico"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function securityHeaders(nonce: string, isDevelopment: boolean): Record<string, string> {
  const contentSecurityPolicy = [
    "default-src 'self'",
    // `strict-dynamic` lets the nonced Next bootstrap load the chunks it needs
    // without whitelisting paths. `unsafe-eval` is React's dev-time stack
    // reconstruction only; production never gets it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // Next injects the font-face declarations for next/font inline, and a
    // stylesheet cannot execute, so styles are allowed inline while scripts
    // are not. This is the one relaxation in the policy and it is deliberate.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  return {
    "Content-Security-Policy": contentSecurityPolicy,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Nothing in this application uses these; denying them shrinks what an
    // injected script could ask the browser for.
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "X-Frame-Options": "DENY",
  };
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";
  const headers = securityHeaders(nonce, isDevelopment);

  const { pathname } = request.nextUrl;
  const hasCookie = request.cookies.has(SESSION_COOKIE);

  const response =
    isPublic(pathname) || hasCookie
      ? NextResponse.next({
          request: {
            headers: new Headers([
              ...request.headers.entries(),
              ["x-nonce", nonce],
              ["Content-Security-Policy", headers["Content-Security-Policy"] ?? ""],
            ]),
          },
        })
      : NextResponse.redirect(
          new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url),
        );

  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }

  // HSTS only makes sense once the origin is actually served over TLS;
  // sending it from a local HTTP dev server would poison the browser for
  // localhost across every project on the machine.
  if (request.nextUrl.protocol === "https:") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
