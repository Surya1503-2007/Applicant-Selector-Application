-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostSkill" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSkill" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillMatchResult" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "matchPercent" DOUBLE PRECISION NOT NULL,
    "band" TEXT NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillMatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_subjectId_idx" ON "Post"("subjectId");

-- CreateIndex
CREATE INDEX "PostSkill_postId_idx" ON "PostSkill"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostSkill_postId_skillName_key" ON "PostSkill"("postId", "skillName");

-- CreateIndex
CREATE INDEX "CandidateSkill_candidateId_idx" ON "CandidateSkill"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateSkill_candidateId_skillName_key" ON "CandidateSkill"("candidateId", "skillName");

-- CreateIndex
CREATE INDEX "SkillMatchResult_candidateId_idx" ON "SkillMatchResult"("candidateId");

-- CreateIndex
CREATE INDEX "SkillMatchResult_postId_idx" ON "SkillMatchResult"("postId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSkill" ADD CONSTRAINT "PostSkill_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMatchResult" ADD CONSTRAINT "SkillMatchResult_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMatchResult" ADD CONSTRAINT "SkillMatchResult_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
