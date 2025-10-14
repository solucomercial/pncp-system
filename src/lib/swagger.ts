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
            content: {
              'application/json': { schema: registerUserSchema }
            }
          },
          responses: {
            '200': { description: 'Usuário registrado', content: { 'application/json': { schema: userResponseSchema } } },
            '400': { description: 'Dados inválidos', content: { 'application/json': { schema: errorSchema } } },
            '403': { description: 'Código de convite inválido' },
            '409': { description: 'E-mail já cadastrado' },
          }
        }
      },
      '/api/auth/reset-password': {
        post: {
          summary: 'Redefine a senha de um usuário (Admin)',
          tags: ['Autenticação'],
          requestBody: {
            content: {
              'application/json': { schema: z.object({ email: z.string().email(), secret: z.string() }) }
            }
          },
          responses: {
            '200': { description: 'Senha redefinida', content: { 'application/json': { schema: z.object({ message: z.string(), newPassword: z.string() }) } } },
            '401': { description: 'Não autorizado' },
            '404': { description: 'Usuário não encontrado' },
          }
        }
      },
      '/api/buscar-licitacoes': {
        post: {
          summary: 'Busca e filtra licitações',
          tags: ['Licitações'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            content: {
              'application/json': { schema: z.object({ filters: z.object({ useGeminiAnalysis: z.boolean(), estado: z.string() }) }) }
            }
          },
          responses: {
            '200': { description: 'Stream de resultados', content: { 'application/json': { schema: z.array(licitacaoSchema) } } },
            '401': { description: 'Acesso não autorizado' },
          }
        }
      },
      '/api/generate-report': {
        post: {
          summary: 'Gera um relatório .docx',
          tags: ['Relatórios'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            content: {
              'application/json': { schema: z.object({ licitacoes: z.array(licitacaoSchema) }) }
            }
          },
          responses: {
            '200': { description: 'Relatório .docx', content: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { schema: z.string() } } },
            '401': { description: 'Acesso não autorizado' },
          }
        }
      },
      '/api/sync': {
        post: {
          summary: 'Sincroniza dados com o PNCP (Cron)',
          tags: ['Sincronização'],
          parameters: [
            { name: 'initial_load', in: 'query', schema: { type: 'boolean' } }
          ],
          requestBody: {
            content: {
              'application/json': { schema: z.object({ authorization: z.string() }) }
            }
          },
          responses: {
            '200': { description: 'Sincronização concluída' },
            '401': { description: 'Acesso não autorizado' },
          }
        }
      },
    }
  });
};