-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EXAMINER');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "aspectKeywords" TEXT[],
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'BANK',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "SessionState" ADD COLUMN     "expertQueue" JSONB;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateAccess" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertQuestionScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "avgRelevancy" DOUBLE PRECISION NOT NULL,
    "countAsked" INTEGER NOT NULL,
    "countLowFit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpertQuestionScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateAccess_sessionId_key" ON "CandidateAccess"("sessionId");

-- CreateIndex
CREATE INDEX "ExpertQuestionScore_userId_idx" ON "ExpertQuestionScore"("userId");

-- CreateIndex
CREATE INDEX "ExpertQuestionScore_sessionId_idx" ON "ExpertQuestionScore"("sessionId");

-- CreateIndex
CREATE INDEX "ExpertQuestionScore_questionId_idx" ON "ExpertQuestionScore"("questionId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateAccess" ADD CONSTRAINT "CandidateAccess_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
