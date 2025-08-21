import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const authOptions: AuthOptions = {
 adapter: PrismaAdapter(prisma),
 providers: [
  CredentialsProvider({
   name: "Credentials",
   credentials: {
    email: { label: "Email", type: "text" },
    password: { label: "Password", type: "password" },
   },
   async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) {
     throw new Error("Credenciais inválidas");
    }

    const user = await prisma.user.findUnique({
     where: { email: credentials.email },
    });

    if (!user || !user.password) {
     throw new Error("Usuário não encontrado ou senha não configurada");
    }

    const isPasswordCorrect = await bcrypt.compare(
     credentials.password,
     user.password
    );

    if (isPasswordCorrect) {
     return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
     };
    }

    throw new Error("E-mail ou senha incorretos");
   },
  }),
 ],
 callbacks: {
  async jwt({ token, user }) {
   if (user) {
    token.id = user.id;
    token.name = user.name;
    token.email = user.email;
    token.picture = user.image;
   }
   return token;
  },
  async session({ session, token }) {
   if (session.user) {
    session.user.name = token.name;
    session.user.email = token.email ?? undefined;
    session.user.image = token.picture;
   }
   return session;
  },
 },
 session: {
  strategy: "jwt",
 },
 secret: process.env.AUTH_SECRET,
 pages: {
  signIn: "/login",
  error: "/login/erro",
 },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };