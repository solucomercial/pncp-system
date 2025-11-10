import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  boolean,
  decimal,
  customType,
  uuid,
  uniqueIndex, 
} from "drizzle-orm/pg-core";
import { sql } from 'drizzle-orm';

const vector = customType<{ data: number[] }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        console.error("Falha ao parsear vetor do DB:", e);
        return [];
      }
    }
    if (Array.isArray(value)) {
      return value;
    }
    return [];
  },
});

export const users = pgTable("user", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name"),
  email: text("email").notNull().unique(),
  password: text("password"),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const pncpLicitacao = pgTable("PncpLicitacao", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(), 
  numeroControlePNCP: text("numeroControlePNCP").notNull().unique(),
  cnpjOrgao: text("cnpjOrgao").notNull(),
  orgao: text("orgao"),
  anoCompra: integer("anoCompra").notNull(),
  sequencialCompra: integer("sequencialCompra").notNull(),
  modalidade: text("modalidade"),
  numeroProcesso: text("numeroProcesso"),
  objetoCompra: text("objetoCompra").notNull(),
  valorEstimado: decimal("valorEstimado", { precision: 19, scale: 2 }),
  dataPublicacaoPNCP: timestamp("dataPublicacaoPNCP", { mode: "date" }).notNull(),
  dataAtualizacao: timestamp("dataAtualizacao", { mode: "date" }).notNull(),
  situacao: text("situacao"),
  linkSistemaOrigem: text("linkSistemaOrigem"),
  linkPNCP: text("linkPNCP"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).$onUpdate(() => new Date()),
  iaResumo: text("iaResumo"),
  iaPalavrasChave: text("iaPalavrasChave").array(),
  unidadeOrgao: text("unidadeOrgao"),
  municipio: text("municipio"),
  uf: text("uf"),
  modoDisputa: text("modoDisputa"),
  criterioJulgamento: text("criterioJulgamento"),
  informacaoComplementar: text("informacaoComplementar"),
  aceitaJustificativa: boolean("aceitaJustificativa"),
  niSolicitante: text("niSolicitante"),
  dataAutorizacao: timestamp("dataAutorizacao", { mode: "date" }),
  justificativaPresencial: text("justificativaPresencial"),
  grauRelevanciaIA: text("grauRelevanciaIA"),
  justificativaRelevanciaIA: text("justificativaRelevanciaIA"),
});

export const syncLog = pgTable("SyncLog", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  date: timestamp("date", { mode: "date" }).notNull().unique(),
  status: text("status").notNull(),
  startTime: timestamp("startTime", { mode: "date" }).notNull(),
  endTime: timestamp("endTime", { mode: "date" }),
  recordsFetched: integer("recordsFetched").default(0),
  errorMessage: text("errorMessage"),
});

export const licitacaoDocumento = pgTable("LicitacaoDocumento", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  licitacaoPncpId: text("licitacaoPncpId").notNull().references(() => pncpLicitacao.numeroControlePNCP, { onDelete: "cascade" }),
  nomeArquivo: text("nomeArquivo").notNull(),
  textoChunk: text("textoChunk").notNull(),
  embedding: vector("embedding").notNull(),
});

export const relevanciaFeedback = pgTable("RelevanciaFeedback", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  voto: integer("voto").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  licitacaoPncpId: text("licitacaoPncpId").notNull().references(() => pncpLicitacao.numeroControlePNCP, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
}, (table) => {
  return {
    userLicitacaoUniq: uniqueIndex("user_licitacao_uniq_idx").on(table.userId, table.licitacaoPncpId),
  };
});