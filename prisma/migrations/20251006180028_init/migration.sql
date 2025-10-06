-- CreateTable
CREATE TABLE "public"."Licitacao" (
    "id" TEXT NOT NULL,
    "numeroControlePNCP" TEXT NOT NULL,
    "numeroCompra" TEXT NOT NULL,
    "anoCompra" INTEGER NOT NULL,
    "processo" TEXT,
    "modalidadeNome" TEXT NOT NULL,
    "modoDisputaNome" TEXT,
    "situacaoCompraNome" TEXT NOT NULL,
    "objetoCompra" TEXT NOT NULL,
    "informacaoComplementar" TEXT,
    "valorTotalEstimado" DOUBLE PRECISION,
    "valorTotalHomologado" DOUBLE PRECISION,
    "dataAberturaProposta" TIMESTAMP(3),
    "dataEncerramentoProposta" TIMESTAMP(3),
    "dataPublicacaoPncp" TIMESTAMP(3) NOT NULL,
    "dataInclusao" TIMESTAMP(3) NOT NULL,
    "dataAtualizacao" TIMESTAMP(3) NOT NULL,
    "cnpjOrgaoEntidade" TEXT NOT NULL,
    "razaoSocialOrgaoEntidade" TEXT NOT NULL,
    "codigoUnidadeOrgao" TEXT NOT NULL,
    "nomeUnidadeOrgao" TEXT NOT NULL,
    "municipioNomeUnidadeOrgao" TEXT NOT NULL,
    "ufSiglaUnidadeOrgao" TEXT NOT NULL,
    "linkSistemaOrigem" TEXT,
    "srp" BOOLEAN NOT NULL,
    "amparoLegalNome" TEXT,
    "sequencialCompra" INTEGER,
    "linkProcessoEletronico" TEXT,
    "tipoInstrumentoConvocatorioNome" TEXT,
    "dataAtualizacaoGlobal" TIMESTAMP(3),

    CONSTRAINT "Licitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "password" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Licitacao_numeroControlePNCP_key" ON "public"."Licitacao"("numeroControlePNCP");

-- CreateIndex
CREATE INDEX "Licitacao_dataPublicacaoPncp_idx" ON "public"."Licitacao"("dataPublicacaoPncp");

-- CreateIndex
CREATE INDEX "Licitacao_ufSiglaUnidadeOrgao_idx" ON "public"."Licitacao"("ufSiglaUnidadeOrgao");

-- CreateIndex
CREATE INDEX "Licitacao_modalidadeNome_idx" ON "public"."Licitacao"("modalidadeNome");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
