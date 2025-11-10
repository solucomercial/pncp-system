// Arquivo: drizzle.config.ts
import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// Carrega as variáveis de ambiente (DATABASE_URL)
dotenv.config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não está definida no .env");
}

export default {
  schema: "./src/lib/db/schema.ts", // Caminho para o nosso schema
  out: "./drizzle", // Pasta de saída para as migrações
  dialect: "postgresql", // Especifica o dialeto
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config;