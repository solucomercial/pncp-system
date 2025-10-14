// src/app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { registerUserSchema } from "@/lib/schemas";

const prisma = new PrismaClient();

export async function POST(request: Request) {
 try {
  const body = await request.json();
  
  // Valida o corpo da requisição com o schema Zod
  const validation = registerUserSchema.safeParse(body);
  if (!validation.success) {
   return new NextResponse(
    JSON.stringify({ message: "Dados inválidos.", errors: validation.error.flatten() }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
   );
  }

  const { email, password, name, invitationCode } = validation.data;

  const secretCode = process.env.REGISTRATION_INVITE_CODE;

  if (!secretCode) {
   console.error("ERRO CRÍTICO: A variável de ambiente REGISTRATION_INVITE_CODE não está definida.");
   return new NextResponse(
    JSON.stringify({ message: "A funcionalidade de registo está temporariamente desativada." }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
   );
  }

  if (invitationCode !== secretCode) {
   return new NextResponse(
    JSON.stringify({ message: "Código de convite inválido." }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
   );
  }

  const existingUser = await prisma.user.findUnique({
   where: { email },
  });

  if (existingUser) {
   return new NextResponse(
    JSON.stringify({ message: "Um utilizador com este e-mail já existe." }),
    { status: 409, headers: { 'Content-Type': 'application/json' } }
   );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
   data: {
    name,
    email,
    password: hashedPassword,
   },
  });

  // Remove a senha antes de enviar a resposta
const { password: _, ...userWithoutPassword } = user;

  return NextResponse.json(userWithoutPassword);

 } catch (error) {
  console.error("ERRO NO REGISTO:", error);
  return new NextResponse(
   JSON.stringify({ message: "Erro interno do servidor." }),
   { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
 }
}