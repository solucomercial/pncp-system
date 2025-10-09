// src/app/api/auth/reset-password/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const RESET_SECRET = process.env.PASSWORD_RESET_SECRET;

// Função para gerar uma senha aleatória segura
function generateRandomPassword(length = 12) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
}

export async function POST(request: Request) {
    // Validação inicial do segredo
    if (!RESET_SECRET) {
        console.error("ERRO CRÍTICO: A variável de ambiente RESET_PASSWORD_SECRET não está definida.");
        return new NextResponse(
            JSON.stringify({ message: "Funcionalidade de reset de senha desativada." }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        const body = await request.json();
        const { email, secret } = body;

        // Validação dos dados recebidos
        if (!email || !secret) {
            return new NextResponse(
                JSON.stringify({ message: "Email e segredo são obrigatórios." }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validação do segredo de autorização
        if (secret !== RESET_SECRET) {
            return new NextResponse(
                JSON.stringify({ message: "Segredo de autorização inválido." }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Procura o usuário pelo email
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return new NextResponse(
                JSON.stringify({ message: "Usuário não encontrado com este email." }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Gera e hasheia a nova senha
        const newPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Atualiza o usuário no banco de dados com a nova senha
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
            },
        });

        // Retorna a nova senha (em texto plano) para o administrador
        return NextResponse.json({
            message: `Senha para o usuário ${user.email} foi redefinida com sucesso.`,
            newPassword: newPassword, // IMPORTANTE: Anote esta senha!
        });

    } catch (error) {
        console.error("ERRO NO RESET DE SENHA:", error);
        return new NextResponse(
            JSON.stringify({ message: "Erro interno do servidor." }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}