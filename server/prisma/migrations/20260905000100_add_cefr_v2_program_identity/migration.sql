-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "cefrLevel" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramVersion" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "versionKey" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Program_slug_key" ON "Program"("slug");

-- CreateIndex
CREATE INDEX "Program_languageId_idx" ON "Program"("languageId");

-- CreateIndex
CREATE INDEX "ProgramVersion_programId_idx" ON "ProgramVersion"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramVersion_programId_versionKey_key"
ON "ProgramVersion"("programId", "versionKey");

-- AddForeignKey
ALTER TABLE "Program"
ADD CONSTRAINT "Program_languageId_fkey"
FOREIGN KEY ("languageId") REFERENCES "Language"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramVersion"
ADD CONSTRAINT "ProgramVersion_programId_fkey"
FOREIGN KEY ("programId") REFERENCES "Program"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
