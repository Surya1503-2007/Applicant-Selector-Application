-- DropIndex
DROP INDEX "Response_sessionId_questionId_key";

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "simplifiedText" TEXT;

-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "isReask" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SessionState" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "currentTopicId" TEXT,
    "currentDifficulty" "Difficulty",
    "currentQuestionId" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'ICEBREAKER',
    "technicalCount" INTEGER NOT NULL DEFAULT 0,
    "icebreakerCount" INTEGER NOT NULL DEFAULT 0,
    "consecutiveIrrelevant" INTEGER NOT NULL DEFAULT 0,
    "topicProgress" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "questionId" TEXT,
    "verdict" TEXT,
    "fromDifficulty" TEXT,
    "toDifficulty" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionState_sessionId_key" ON "SessionState"("sessionId");

-- CreateIndex
CREATE INDEX "DecisionLog_sessionId_idx" ON "DecisionLog"("sessionId");

-- CreateIndex
CREATE INDEX "DecisionLog_sessionId_step_idx" ON "DecisionLog"("sessionId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "Response_sessionId_questionId_isReask_key" ON "Response"("sessionId", "questionId", "isReask");

-- AddForeignKey
ALTER TABLE "SessionState" ADD CONSTRAINT "SessionState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLog" ADD CONSTRAINT "DecisionLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

