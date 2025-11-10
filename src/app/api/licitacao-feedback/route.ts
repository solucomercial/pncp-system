import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { relevanciaFeedback } from "@/lib/db/schema";

const feedbackSchema = z.object({
  licitacaoPncpId: z.string().min(1, "ID da licitação é obrigatório"),
  voto: z.union([z.literal(1), z.literal(-1)]),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    // @ts-ignore
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    // @ts-ignore
    const userId = session.user.id as string;

    const body = await req.json();
    const validation = feedbackSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }
    
    const { licitacaoPncpId, voto } = validation.data;

    const result = await db.insert(relevanciaFeedback)
      .values({
        userId: userId,
        licitacaoPncpId: licitacaoPncpId,
        voto: voto,
      })
      .onConflictDoUpdate({
        target: [relevanciaFeedback.userId, relevanciaFeedback.licitacaoPncpId], 
        set: {
          voto: voto, 
        }
      })
      .returning();

    return NextResponse.json(result[0], { status: 200 });

  } catch (error) {
    console.error("Erro ao registrar feedback:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}