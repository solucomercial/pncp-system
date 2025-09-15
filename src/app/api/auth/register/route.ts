import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(request: Request) {
 try {
  const body = await request.json();
  const { email, password, name, invitationCode } = body;

  const secretCode = process.env.REGISTRATION_INVITE_CODE;

  if (!secretCode) {
   console.error("ERRO CRÍTICO: A variável de ambiente REGISTRATION_INVITE_CODE não está definida.");
   return new NextResponse(
    JSON.stringify({ message: "A funcionalidade de registo está temporariamente desativada." }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
   );
  }

  if (!email || !password || !name || !invitationCode) {
   return new NextResponse(
    JSON.stringify({ message: "Todos os campos são obrigatórios." }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
   );
  }

  // Validação do código de convite
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

  return NextResponse.json(user);

 } catch (error) {
  console.error("ERRO NO REGISTO:", error);
  return new NextResponse(
   JSON.stringify({ message: "Erro interno do servidor." }),
   { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
 }
}