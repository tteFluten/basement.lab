import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - login
     * - api/auth (NextAuth)
     * - api/setup-password (secret-protected, no session)
     * - _next (Next.js internals)
     * - favicon, static files
     */
    "/((?!login|api/auth|api/setup-password|_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
