-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "answerScore" DOUBLE PRECISION,
ADD COLUMN     "breakdown" JSONB,
ADD COLUMN     "verdict" TEXT;

