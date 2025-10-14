// src/middleware.ts
import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      // Rotas que NÃO exigem autenticação
      const publicPaths = ["/login", "/register"];
      const { pathname } = req.nextUrl;

      // Se o usuário tiver um token (estiver logado), permita sempre o acesso.
      // Se não, só permita se a rota for uma das públicas.
      return !!token || publicPaths.includes(pathname);
    },
  },
  pages: {
    // Redireciona para a página de login se a autorização falhar
    signIn: "/login",
  },
});

// O 'matcher' define quais rotas são afetadas por este middleware.
// A configuração exclui rotas da API, arquivos estáticos e imagens.
export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};