// src/lib/schemas.ts
import { z } from 'zod';

// --- Schemas para Autenticação ---

// Schema para o corpo (body) da rota de registro
export const registerUserSchema = z.object({
  name: z.string().min(1, { message: "O nome é obrigatório." }),
  email: z.string().email({ message: "Formato de e-mail inválido." }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
  invitationCode: z.string().min(1, { message: "O código de convite é obrigatório." }),
});

// Schema para a resposta do usuário (sem a senha)
export const userResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  image: z.string().nullable(),
  emailVerified: z.date().nullable(),
});

// Schema de erro genérico
export const errorSchema = z.object({
  message: z.string(),
});


// --- Schemas para Licitações e Relatórios ---

export const licitacaoSchema = z.object({
    numeroControlePNCP: z.string(),
    objetoCompra: z.string(),
    modalidadeNome: z.string(),
    valorTotalEstimado: z.number().nullable(),
    dataPublicacaoPncp: z.string(),
    orgaoEntidade: z.object({
        razaoSocial: z.string(),
    }),
    unidadeOrgao: z.object({
        municipioNome: z.string(),
        ufSigla: z.string(),
    }),
});