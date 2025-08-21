import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(request: Request) {
 try {
  const body = await request.json();
  const { email, password, name, image } = body;

  if (!email || !password || !name) {
   return new NextResponse("Nome, e-mail e senha são obrigatórios", { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
   where: { email },
  });

  if (existingUser) {
   return new NextResponse("Usuário já existe", { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
   data: {
    name,
    email,
    image,
    password: hashedPassword,
   },
  });

  return NextResponse.json(user);
 } catch (error) {
  console.error("ERRO NO REGISTRO:", error);
  return new NextResponse("Erro interno do servidor", { status: 500 });
 }
}