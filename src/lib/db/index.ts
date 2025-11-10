// Arquivo: src/lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Verifica se a variável de ambiente está definida
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não está definida no .env");
}

// O 'postgres' (node-postgres) usa a DATABASE_URL diretamente
const client = postgres(process.env.DATABASE_URL);

// Inicializa o Drizzle com o cliente 'pg' e o schema completo
export const db = drizzle(client, { schema, logger: process.env.NODE_ENV === 'development' });