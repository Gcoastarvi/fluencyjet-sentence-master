-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" VARCHAR(100);

-- CreateTable
CREATE TABLE "TypingQuiz" (
    "id" SERIAL NOT NULL,
    "ta" TEXT NOT NULL,
    "en" TEXT NOT NULL,
    "lesson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TypingQuiz_pkey" PRIMARY KEY ("id")
);
