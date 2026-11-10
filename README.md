# RAC DRDO Adaptive Interview System

AI-based adaptive interview and candidate screening platform designed for the **Recruitment and Assessment Centre (RAC), Defence Research and Development Organisation (DRDO)**.

- **Part 1**: Database Foundation & Normalized Question Bank (Prisma + PostgreSQL)
- **Part 2**: Skill-Match Suitability Engine & Candidate Screening API (Deterministic, Offline)

---

## Project Structure

```
Applicant Selector Application/
├── client/                     # Placeholder for React + Tailwind CSS UI (Part 3)
│   └── README.md
├── server/                     # Node.js backend foundation & services
│   ├── prisma/
│   │   ├── migrations/         # Prisma migration history
│   │   ├── schema.prisma       # Normalized schema (Parts 1 & 2 models)
│   │   ├── seed.js             # Idempotent seeder for curriculum & post skills
│   │   └── seedData/
│   │       ├── asd.json        # ASD curriculum question bank (20 questions + 3 icebreakers)
│   │       └── posts.json      # Sample post: Scientist 'C' - ASD with 10 weighted skills
│   ├── src/
│   │   ├── app.js              # Express app setup & route mounting
│   │   ├── server.js           # Express HTTP server entry point
│   │   ├── config/
│   │   │   └── skillMatchConfig.js # Score tiers, thresholds & suitability bands
│   │   ├── data/
│   │   │   └── skillSynonyms.json  # 35+ defence & systems engineering abbreviations/synonyms
│   │   ├── db/
│   │   │   └── prismaClient.js # Shared singleton Prisma Client instance
│   │   ├── matchers/
│   │   │   ├── logicMatcher.js     # 4-tier deterministic rule matcher
│   │   │   └── embeddingMatcher.js # Swappable placeholder for dense vector matcher
│   │   ├── routes/
│   │   │   └── skillMatchRoutes.js # Express API routes for skill match & skills ingestion
│   │   ├── services/
│   │   │   ├── questionService.js  # Data-access methods for questions & follow-ups
│   │   │   ├── sessionService.js   # Data-access methods for sessions & responses
│   │   │   └── skillMatchService.js# Weighted scoring, bands & mandatory gap detection
│   │   └── utils/
│   │       └── skillNormalizer.js  # Normalization, stemming & canonicalization
│   ├── scripts/
│   │   ├── testDb.js           # Part 1: Database relational test suite
│   │   └── testSkillMatch.js   # Part 2: 4-scenario skill match test suite
│   ├── .env.example            # Sample environment variables
│   ├── .env                    # Local environment config
│   └── package.json            # Server dependencies & npm scripts
├── .gitignore
├── package.json                # Root convenience proxy scripts
└── README.md
```

---

## Tech Stack

- **Backend**: Node.js (CommonJS, consistent `require`/`module.exports`)
- **Database**: PostgreSQL
- **ORM & Migrations**: Prisma ORM (v6.x)
- **Natural Language Processing**: Deterministic offline Porter Stemmer + Jaccard token overlap (via `natural`)
- **API Framework**: Express.js
- **Frontend Placeholder**: `/client` reserved for React + Tailwind CSS in subsequent parts
- **Strictly Offline & Deterministic**: Zero external AI/LLM/embedding cloud API calls

---

## Prerequisites

1. **Node.js** (v18.x or v20.x recommended)
2. **PostgreSQL** running locally or accessible via network

---

## Step-by-Step Setup Guide

### 1. Create the PostgreSQL Database

Create a new PostgreSQL database named `rac_interview_db`:

```bash
psql -U postgres -c "CREATE DATABASE rac_interview_db;"
```

### 2. Configure Environment Variables

Navigate to the `server/` directory and configure `.env`:

```bash
cd server
cp .env.example .env
```

Edit `server/.env` with your PostgreSQL connection URL:

```env
DATABASE_URL="postgresql://<USERNAME>:<PASSWORD>@localhost:5432/rac_interview_db?schema=public"
```

*(If running Postgres on a custom port like 5433, adjust the port accordingly).*

### 3. Install Dependencies

Install dependencies in the `server` directory:

```bash
cd server
npm install
```

### 4. Run Database Migrations

Apply the normalized schema migrations to create all tables, enums, indexes, and constraints:

```bash
npm run db:migrate
```

### 5. Seed Database

Populate the question bank (ASD curriculum) and the sample job post (`Scientist 'C' - Advanced System Development`):

```bash
npm run db:seed
```

> **Note**: Seeding is **strictly idempotent**. Running it multiple times safely updates existing records without creating duplicates.

### 6. Run Verification Test Suites

#### Part 1: Database Foundation & Adaptive Question Chain Test
```bash
npm run test:db
```

#### Part 2: Skill-Match Suitability Engine Test
```bash
npm run test:skillmatch
```

*(You can also run all commands directly from the root project folder: `npm run db:migrate`, `npm run db:seed`, `npm run test:db`, `npm run test:skillmatch`).*

---

## Part 2: Skill-Match Suitability Module

### Objective
Given a job post's required skills and a candidate's declared/verified skills, compute an explainable **Skill-Match Percentage (0–100%)**, assign a **Suitability Band**, and flag any **Mandatory Skill Gaps** without hard-rejecting the candidate.

### Core Workflow

```
Candidate Skills + Post Required Skills
                  │
                  ▼
       [Skill Normalization]
      (Lowercase, trim, strip punctuation,
       Porter stemming, abbreviation expansion)
                  │
                  ▼
        [Swappable Matcher]
       (logicMatcher.js / embeddingMatcher.js)
       - Exact post-normalization: 1.0 ('exact')
       - Synonym / acronym match: 0.95 ('synonym')
       - Stem Jaccard overlap: 0..0.85 ('partial')
       - No match: 0.0 ('none')
                  │
                  ▼
     [Weighted Aggregator & Rules]
     - matchPercent = 100 * Σ(weight_i * best_i) / Σ(weight_i)
     - Skill covered if best_i >= 0.50
     - Mandatory gap flagged if any mandatory skill is uncovered (<0.50)
     - Bands: STRONG (>=70), MODERATE (40-69), WEAK (<40)
                  │
                  ▼
        [Persistence & API]
     (Saved in SkillMatchResult table & returned via Express)
```

### Configuration Constants (`src/config/skillMatchConfig.js`)
All thresholds, weights, and bands are centralized with **zero magic numbers**:
- `SCORES.EXACT`: `1.0`
- `SCORES.SYNONYM`: `0.95`
- `SCORES.PARTIAL_MAX`: `0.85`
- `SCORES.NONE`: `0.0`
- `THRESHOLDS.SKILL_COVERED`: `0.50`
- `THRESHOLDS.PARTIAL_MIN_SIMILARITY`: `0.15`
- `BANDS.STRONG.min`: `70%`
- `BANDS.MODERATE.min`: `40%`

### Domain Synonym & Abbreviation Dictionary (`src/data/skillSynonyms.json`)
Covers 35+ defense R&D, systems engineering, and military standards:
- `MBSE` ↔ `Model-Based Systems Engineering`
- `V&V` ↔ `Verification and Validation`
- `ICD` ↔ `Interface Control Document`
- `SRS` ↔ `Software Requirements Specification`
- `RTM` ↔ `Requirements Analysis & Traceability`
- `MIL-STD-1553B` ↔ `MIL-STD-1553B Avionics Bus`
- `ARINC 429` ↔ `ARINC 429 Avionics Bus`
- `RTOS` ↔ `Real-Time Operating Systems`
- `HIL` / `SIL` / `MIL` ↔ `Hardware/Software/Model-in-the-Loop Simulation`
- `TMR` ↔ `Triple Modular Redundancy & Fault Tolerance`
- `DO-178C` ↔ `DO-178C Safety-Critical Software`
- `ESS` / `MIL-STD-810` ↔ `Environmental Stress Screening`
- `GNC` ↔ `Guidance Navigation and Control`
- `MOSA` ↔ `Modular Open Systems Approach`
- `AESA` ↔ `Active Electronically Scanned Array`

---

## Express REST API Guide

Start the API server:

```bash
npm start
# Server listens on port 5000 (or process.env.PORT)
```

### 1. Ingest Candidate Skills
**Endpoint**: `POST /api/candidates/:id/skills`

**cURL Request**:
```bash
curl -X POST http://localhost:5000/api/candidates/<CANDIDATE_ID>/skills \
  -H "Content-Type: application/json" \
  -d '{
    "skills": [
      "MBSE",
      "V&V",
      "MIL-STD-1553B",
      "Requirements Traceability Matrix",
      "RTOS",
      "DO-178C"
    ]
  }'
```

**Response (201 Created)**:
```json
{
  "success": true,
  "candidateId": "4d51fc7d-c00d-4493-b44a-2da3a5601cd3",
  "count": 6,
  "skills": [
    "MBSE",
    "V&V",
    "MIL-STD-1553B",
    "Requirements Traceability Matrix",
    "RTOS",
    "DO-178C"
  ]
}
```

### 2. Compute Skill Match
**Endpoint**: `POST /api/skill-match`

**cURL Request**:
```bash
curl -X POST http://localhost:5000/api/skill-match \
  -H "Content-Type: application/json" \
  -d '{
    "candidateId": "<CANDIDATE_ID>",
    "postId": "post-asd-sc-c"
  }'
```

**Response (200 OK)**:
```json
{
  "matchPercent": 95,
  "band": "STRONG",
  "mandatoryGap": false,
  "missingMandatory": [],
  "breakdown": [
    {
      "requiredSkill": "Model-Based Systems Engineering (MBSE)",
      "weight": 5,
      "isMandatory": true,
      "bestCandidateSkill": "MBSE",
      "score": 0.95,
      "matchType": "synonym"
    },
    {
      "requiredSkill": "Requirements Analysis & Traceability",
      "weight": 5,
      "isMandatory": true,
      "bestCandidateSkill": "Requirements Traceability Matrix",
      "score": 0.95,
      "matchType": "synonym"
    },
    {
      "requiredSkill": "Verification and Validation (V&V)",
      "weight": 5,
      "isMandatory": true,
      "bestCandidateSkill": "V&V",
      "score": 0.95,
      "matchType": "synonym"
    },
    {
      "requiredSkill": "MIL-STD-1553B Avionics Bus Architecture",
      "weight": 4,
      "isMandatory": true,
      "bestCandidateSkill": "MIL-STD-1553B",
      "score": 0.95,
      "matchType": "synonym"
    }
  ],
  "strengths": [
    "Model-Based Systems Engineering (MBSE)",
    "Requirements Analysis & Traceability",
    "Verification and Validation (V&V)",
    "MIL-STD-1553B Avionics Bus Architecture"
  ],
  "gaps": [],
  "resultId": "4c61e507-be77-47ae-931e-e11f06b709b4"
}
```

---

## Available npm Scripts

| Command | Description |
| :--- | :--- |
| `npm start` | Launches the Express API server on port 5000 |
| `npm run db:migrate` | Runs `prisma migrate dev` to apply pending migrations |
| `npm run db:seed` | Idempotently seeds question bank and post skills |
| `npm run db:reset` | Drops, re-migrates, and seeds the database |
| `npm run test:db` | Runs Part 1 relational test suite (`scripts/testDb.js`) |
| `npm run test:skillmatch` | Runs Part 2 4-scenario skill match test suite (`scripts/testSkillMatch.js`) |
