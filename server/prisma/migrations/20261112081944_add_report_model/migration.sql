-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "configSnapshot" JSONB NOT NULL,
    "skillMatchPercent" DOUBLE PRECISION NOT NULL,
    "skillMatchBand" TEXT NOT NULL,
    "mandatoryGap" BOOLEAN NOT NULL,
    "missingMandatory" JSONB NOT NULL,
    "interviewScore" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "systemRecommendation" TEXT NOT NULL,
    "finalRecommendation" TEXT NOT NULL,
    "terminatedEarly" BOOLEAN NOT NULL DEFAULT false,
    "endReason" TEXT,
    "questionRelevancyScore" DOUBLE PRECISION NOT NULL,
    "questionRelevancyBand" TEXT NOT NULL,
    "topicScores" JSONB NOT NULL,
    "questionTable" JSONB NOT NULL,
    "difficultyProgression" JSONB NOT NULL,
    "flags" JSONB NOT NULL,
    "decisionLog" JSONB NOT NULL,
    "boardRemarks" TEXT,
    "overriddenBy" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_sessionId_idx" ON "Report"("sessionId");

-- CreateIndex
CREATE INDEX "Report_candidateId_idx" ON "Report"("candidateId");

-- CreateIndex
CREATE INDEX "Report_postId_idx" ON "Report"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_sessionId_version_key" ON "Report"("sessionId", "version");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
