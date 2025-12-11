/*
  Warnings:

  - You are about to drop the column `content` on the `Lesson` table. All the data in the column will be lost.
  - You are about to drop the column `lessonId` on the `Lesson` table. All the data in the column will be lost.
  - You are about to drop the column `xpValue` on the `Lesson` table. All the data in the column will be lost.
  - You are about to drop the `TypingQuiz` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Lesson` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Lesson` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Lesson` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Lesson_lessonId_key";

-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "content",
DROP COLUMN "lessonId",
DROP COLUMN "xpValue",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'beginner',
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "TypingQuiz";

-- CreateTable
CREATE TABLE "Quiz" (
    "id" SERIAL NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'typing',
    "prompt" TEXT,
    "data" JSONB,
    "xpReward" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_slug_key" ON "Lesson"("slug");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
