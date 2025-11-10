import { NextResponse } from "next/server";
import { registerUserSchema } from "@/lib/schemas";
import bcryptjs from "bcryptjs";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = registerUserSchema.parse(body)
    const hashedPassword = await bcryptjs.hash(password, 10);
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "Email já cadastrado" },
        { status: 400 }
      );
    }
    
    await db.insert(users).values({
      email: email,
      name: name,
      password: hashedPassword,
    });

    return NextResponse.json({ message: "Usuário criado" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}