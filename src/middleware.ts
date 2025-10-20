// src/middleware.ts
import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      // Apenas login e register são públicos
      const publicPaths = ["/login", "/register"];
      const { pathname } = req.nextUrl;

      return !!token || publicPaths.includes(pathname);
    },
  },
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};