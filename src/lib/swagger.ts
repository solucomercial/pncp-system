// src/lib/swagger.ts
import { z } from 'zod';
import { createDocument } from 'zod-openapi';
import { registerUserSchema, userResponseSchema, errorSchema, licitacaoSchema } from '@/lib/schemas';


// Função para gerar o documento OpenAPI final usando zod-openapi
export const getApiDocs = () => {
  return createDocument({
    openapi: '3.0.0',
    info: {
      title: 'PNCP System API',
      version: '1.0.0',
      description: 'API para consulta e análise de licitações do Portal Nacional de Contratações Públicas (PNCP).',
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Autenticação via JWT obtido no login.'
        },
      },
      schemas: {
        RegisterUser: registerUserSchema,
        UserResponse: userResponseSchema,
        Error: errorSchema,
        Licitacao: licitacaoSchema,
        ResetPasswordRequest: z.object({ email: z.string().email(), secret: z.string() }),
        ResetPasswordResponse: z.object({ message: z.string(), newPassword: z.string() }),
        BuscarLicitacoesRequest: z.object({ filters: z.object({ useGeminiAnalysis: z.boolean(), estado: z.string() }) }),
        BuscarLicitacoesResponse: z.array(licitacaoSchema),
        GenerateReportRequest: z.object({ licitacoes: z.array(licitacaoSchema) }),
        DocxReport: z.string(),
        SyncRequest: z.object({ authorization: z.string() }),
        SyncResponse: z.object({ message: z.string() }),
      }
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
    paths: {
      '/api/auth/register': {
        post: {
          summary: 'Registra um novo usuário',
          tags: ['Autenticação'],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/RegisterUser' } }
            }
          },
          responses: {
            '200': { description: 'Usuário registrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } } } },
            '400': { description: 'Dados inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '403': { description: 'Código de convite inválido', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '409': { description: 'E-mail já cadastrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          }
        }
      },
      '/api/auth/reset-password': {
        post: {
          summary: 'Redefine a senha de um usuário (Admin)',
          tags: ['Autenticação'],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordRequest' } }
            }
          },
          responses: {
            '200': { description: 'Senha redefinida', content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordResponse' } } } },
            '401': { description: 'Não autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'Usuário não encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          }
        }
      },
      '/api/buscar-licitacoes': {
        post: {
          summary: 'Busca e filtra licitações',
          tags: ['Licitações'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/BuscarLicitacoesRequest' } }
            }
          },
          responses: {
            '200': { description: 'Stream de resultados', content: { 'application/json': { schema: { $ref: '#/components/schemas/BuscarLicitacoesResponse' } } } },
            '401': { description: 'Acesso não autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          }
        }
      },
      '/api/generate-report': {
        post: {
          summary: 'Gera um relatório .docx',
          tags: ['Relatórios'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/GenerateReportRequest' } }
            }
          },
          responses: {
            '200': { description: 'Relatório .docx', content: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { schema: { $ref: '#/components/schemas/DocxReport' } } } },
            '401': { description: 'Acesso não autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          }
        }
      },
      '/api/sync': {
        post: {
          summary: 'Sincroniza dados com o PNCP (Cron)',
          tags: ['Sincronização'],
          parameters: [
            {
              name: 'initial_load',
              in: 'query',
              required: false,
              schema: { type: 'boolean' },
              description: 'Carregamento inicial dos dados.'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SyncRequest' } }
            }
          },
          responses: {
            '200': { description: 'Sincronização concluída', content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncResponse' } } } },
            '401': { description: 'Acesso não autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          }
        }
      },
    }
  });
};