import { next } from '@vercel/functions';

const REALM = 'RANIBET Private Test';

function unauthorizedResponse() {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Cache-Control': 'no-store'
    }
  });
}

function addSecurityHeaders(response) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://accounts.google.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://gdntslyfogqzvzevcbnl.supabase.co https://accounts.google.com https://apis.google.com https://*.googleapis.com",
      "frame-src https://accounts.google.com https://*.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ')
  );
  return response;
}

function parseBasicAuth(headerValue) {
  if (!headerValue || !headerValue.startsWith('Basic ')) return null;
  try {
    const decoded = atob(headerValue.slice(6));
    const separator = decoded.indexOf(':');
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

export default function middleware(request) {
  const expectedUser = process.env.PRIVATE_TEST_USER;
  const expectedPass = process.env.PRIVATE_TEST_PASS;
  const response = next();

  if (expectedUser && expectedPass) {
    const provided = parseBasicAuth(request.headers.get('authorization'));
    const isAuthorized =
      provided?.username === expectedUser &&
      provided?.password === expectedPass;

    if (!isAuthorized) return addSecurityHeaders(unauthorizedResponse());
  }

  return addSecurityHeaders(response);
}

export const config = {
  matcher: '/(.*)',
  runtime: 'nodejs'
};
