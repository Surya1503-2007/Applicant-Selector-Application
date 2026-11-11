# RAC DRDO Adaptive Interview System

AI-based adaptive interview and candidate screening platform designed for the **Recruitment and Assessment Centre (RAC), Defence Research and Development Organisation (DRDO)**.

- **Part 1**: Database Foundation & Normalized Question Bank (Prisma + PostgreSQL)
- **Part 2**: Skill-Match Suitability Engine & Candidate Screening API (Deterministic, Offline)
- **Part 3**: Answer Scorer Engine, Calibration Suite & Response Scoring API (Deterministic, Offline)

---

## Project Structure

```
Applicant Selector Application/
├── client/                     # Placeholder for React + Tailwind CSS UI (future)
│   └── README.md
├── server/                     # Node.js backend foundation & services
│   ├── prisma/
│   │   ├── migrations/         # Prisma migration history
│   │   ├── schema.prisma       # Normalized schema (Parts 1, 2 & 3 models)
│   │   ├── seed.js             # Idempotent seeder for curriculum & post skills
│   │   └── seedData/
│   │       ├── asd.json        # ASD curriculum question bank (20 questions + 3 icebreakers)
│   │       └── posts.json      # Sample post: Scientist 'C' - ASD with 10 weighted skills
│   ├── src/
│   │   ├── app.js              # Express app setup & route mounting
│   │   ├── server.js           # Express HTTP server entry point
│   │   ├── config/
│   │   │   ├── skillMatchConfig.js # Part 2 score tiers, thresholds & suitability bands
│   │   │   └── scorerConfig.js     # Part 3 weights, verdict thresholds & anti-gaming rules
│   │   ├── data/
│   │   │   ├── skillSynonyms.json  # Defence & systems engineering abbreviations/synonyms
│   │   │   └── sampleAnswers.json  # 25 labelled ASD answers (5 types x 5 questions)
│   │   ├── db/
│   │   │   └── prismaClient.js # Shared singleton Prisma Client instance
│   │   ├── matchers/
│   │   │   ├── logicMatcher.js     # 4-tier deterministic rule matcher
│   │   │   └── embeddingMatcher.js # Swappable placeholder for dense vector matcher
│   │   ├── scorers/
│   │   │   ├── index.js            # Active scorer selector driven by scorerConfig.js
│   │   │   ├── logicScorer.js      # Deterministic TF-IDF + keyword answer scorer
│   │   │   └── embeddingScorer.js  # Swappable placeholder for dense embedding scorer
│   │   ├── routes/
│   │   │   ├── skillMatchRoutes.js # Express API routes for skill match & skills ingestion
│   │   │   └── answerRoutes.js     # Express API route for POST /api/answers
│   │   ├── services/
│   │   │   ├── questionService.js      # Data-access methods for questions & follow-ups
│   │   │   ├── sessionService.js       # Data-access methods for sessions & responses
│   │   │   ├── skillMatchService.js    # Weighted scoring, bands & mandatory gap detection
│   │   │   └── answerScoringService.js # Part 3 evaluation & persistence orchestration
│   │   └── utils/
│   │       └── skillNormalizer.js  # Normalization, synonym expansion, stopword removal & stemming
│   ├── scripts/
│   │   ├── testDb.js               # Part 1: Database relational test suite
│   │   ├── testSkillMatch.js       # Part 2: 4-scenario skill match test suite
│   │   ├── testScorer.js           # Part 3: Sample & edge-case scorer test suite
│   │   ├── calibrateScorer.js      # Part 3: Grid-search calibration advisor (read-only)
│   │   └── testScorePersistence.js # Part 3: DB response persistence & duplicate check
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

## Part 3: Answer Scorer Module

---

## Part 4: Adaptive Interview Engine

### Objective
Run an interview session as a deterministic state‑machine. The engine selects questions based on the candidate’s answer verdicts (IRRELEVANT | PARTIAL | STRONG) and enforces the adaptive ladder:

- **Phase 1 – Icebreakers** – configurable number of ICEBREAKER questions (default 2). They are stored with `NOT_SCORED` and do not affect difficulty.
- **Phase 2 – Technical ladder** – for each topic the flow is:
  - **EASY** → verdict determines whether we stay on EASY, move to MEDIUM, or re‑ask a simplified version.
  - **MEDIUM** → similar logic, moving to HARD on a STRONG verdict.
  - **HARD** → topic finishes on IRRELEVANT/PARTIAL or on STRONG (mastered).
- **Stop conditions** – configurable caps such as `maxQuestions` (default 10), `maxConsecutiveIrrelevant` (default 3), topic‑question caps, and overall pool exhaustion. The engine logs the decision reason and stores it in `DecisionLog`.

All thresholds/caps live in `src/config/engineConfig.js` – no magic numbers elsewhere.

### Core Files
- `src/config/engineConfig.js` – configuration constants.
- `src/engine/adaptiveEngine.js` – pure `decideNext` function implementing the rules, fallback handling, and hard guarantees.
- `src/services/interviewService.js` – orchestrates session lifecycle, calls `adaptiveEngine`, records responses (`isReask` flag), and persists `SessionState` & `DecisionLog`.
- `src/routes/interviewRoutes.js` – Express endpoints:
  - `POST /api/interviews/start` – creates a session and returns the first question.
  - `GET /api/interviews/:sessionId/question` – fetches the current question.
  - `POST /api/interviews/:sessionId/answer` – records answer, runs decision logic, and returns the next question or completion flag.
  - `GET /api/interviews/:sessionId/state` – full interview state + decision log.
  - `POST /api/interviews/:sessionId/end` – early termination.

### Running Tests & Simulation
```bash
# unit‑test suite for decision logic (covers >20 branches)
npm run test:decision

# end‑to‑end interview simulation with four candidate archetypes
npm run test:simulate
```

Both scripts assert the hard guarantees (no duplicate questions, difficulty only increments by one level, re‑ask counted separately, early‑stop conditions).

### Sample API Flow (cURL)
```bash
# 1️⃣ Start interview (candidate & post must exist)
curl -X POST http://localhost:5000/api/interviews/start \
  -H "Content-Type: application/json" \
  -d '{"candidateId":"<candidate-id>","postId":"<post-id>"}'

# 2️⃣ Get current question
curl http://localhost:5000/api/interviews/<session-id>/question

# 3️⃣ Submit answer
curl -X POST http://localhost:5000/api/interviews/<session-id>/answer \
  -H "Content-Type: application/json" \
  -d '{"answerText":"my answer"}'

# 4️⃣ Fetch interview state (includes decision log & end reason)
curl http://localhost:5000/api/interviews/<session-id>/state

# 5️⃣ End interview early (optional)
curl -X POST http://localhost:5000/api/interviews/<session-id>/end \
  -H "Content-Type: application/json" \
  -d '{"reason":"CANDIDATE_STRUGGLING"}'
```

### Tweaking the Engine
All adaptive parameters are in `src/config/engineConfig.js`:
- `ICEBREAKER_COUNT`
- `MAX_QUESTIONS`
- `MAX_CONSECUTIVE_IRRELEVANT`
- `MAX_EASY_PER_TOPIC`, `MAX_MEDIUM_PER_TOPIC`
- `DIFFICULTY_ORDER` (EASY → MEDIUM → HARD)
- fallback strategies, etc.

Update these values and restart the server to apply new behavior.

---

### Objective
Given an interview question and a candidate's free-text answer, deterministically compute an explainable **Relevancy** (`0..1`), **Correctness** (`0..1`), weighted **Answer Score** (`0..1`), and **Verdict** (`IRRELEVANT` | `PARTIAL` | `STRONG`), while enforcing anti-gaming rules and persisting the evaluation to PostgreSQL.

### How Relevancy & Correctness Are Computed
All scoring logic lives in `server/src/scorers/logicScorer.js`, driven exclusively by constants in `server/src/config/scorerConfig.js` and selected via `server/src/scorers/index.js` (`embeddingScorer.js` provides a swappable future placeholder):

1. **Preprocessing & Synonym Expansion (`src/utils/skillNormalizer.js`)**:
   - Expands defence/systems abbreviations in free text using `src/data/skillSynonyms.json` (e.g., `V&V` → `verification and validation`, `TMR` → `system architecture and fault tolerance`, `MIL-STD-1553B`, `DO-178C`, `MC/DC`).
   - Normalizes punctuation, removes stopwords (`natural.stopwords`), and applies Porter stemming (`natural.PorterStemmer`).
   - Builds an in-memory **IDF cache** (`refreshIdf()`) across all questions in PostgreSQL (`questionText + idealAnswer + keywords`).

2. **Relevancy (`0..1`) — Is the answer on-topic for this question?**:
   - Builds the question's **topic vocabulary** (unique stems from `questionText + keywords + idealAnswer`).
   - Computes `topicOverlap` (weighted blend of answer-token precision inside topic vocabulary and topic-vocabulary recall).
   - Computes TF-IDF cosine similarity against `questionText` (`questionSimilarity`) and against `idealAnswer` (`idealAnswerSimilarity`).
   - Blends `topicOverlap` (`0.50`), `questionSimilarity` (`0.20`), and `idealAnswerSimilarity` (`0.30`).

3. **Correctness (`0..1`) — How well does it cover expected content?**:
   - Computes `keywordCoverage`: fraction of question `keywords` matched after stemming and synonym canonicalization, with IDF-weighted partial credit for multi-word keywords where only a subset of tokens match.
   - Blends `keywordCoverage` (`0.65`) and `idealAnswerSimilarity` (`0.35`).

4. **Anti-Gaming & Combination**:
   - `NO_ANSWER`: Empty text or phrases like `"I don't know"`, `"no idea"`, `"pass"` → `0 / 0 / 0`, `IRRELEVANT`.
   - `TOO_SHORT`: Below `MIN_WORD_COUNT` (`6` words) → scores capped.
   - `KEYWORD_STUFFING`: High keyword density combined with very low prose stopword ratio, comma-list structure, or low lexical diversity → penalized by multiplier (`0.45`) and capped.
   - `OFF_TOPIC`: `topicOverlap` below `0.15` → relevancy forced low (`<= 0.15`) and score capped.
   - `LONG_ANSWER_CAPPED`: Very long answers are truncated at `MAX_ANSWER_WORDS` (`250`) and TF is sublinear/capped so padding cannot inflate scores.
   - Final combination: `answerScore = 0.4 * relevancy + 0.6 * correctness`, mapped to `IRRELEVANT` (`< 0.35`), `PARTIAL` (`0.35–0.70`), or `STRONG` (`> 0.70`).
   - `ICEBREAKER` questions with an empty `idealAnswer` are stored with `null` scores and verdict `NOT_SCORED`.

### Running Part 3 Tests & Calibration

1. **Apply the Part 3 Prisma migration** (adds nullable `answerScore`, `verdict`, and `breakdown` columns on `Response`):
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
2. **Run the deterministic scorer test suite** (scores all 25 samples in `src/data/sampleAnswers.json` plus `NO_ANSWER`, `TOO_SHORT`, and long-padding edge cases):
   ```bash
   npm run test:scorer
   ```
3. **Run the read-only grid-search calibration advisor** (evaluates threshold and weight combinations across `sampleAnswers.json` and prints top suggestions without editing `scorerConfig.js`):
   ```bash
   npm run calibrate:scorer
   ```
4. **Run the PostgreSQL persistence test** (creates dummy candidate/session, calls `scoreAndSaveResponse`, checks DB rows, verifies duplicate question rejection, and cleans up):
   ```bash
   npm run test:persistence
   ```

### Score & Save Answer API (`POST /api/answers`)

**cURL Request**:
```bash
curl -X POST http://localhost:5000/api/answers \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "<SESSION_ID>",
    "questionId": "asd-req-e1",
    "answerText": "In avionics systems, functional requirements define system behavior such as trajectory calculations, whereas non-functional requirements specify quality attributes like latency, MTBF reliability, and MIL-STD compliance."
  }'
```

**Response (201 Created)**:
```json
{
  "responseId": "7d8c1f2b-1234-4a5b-9c8d-0123456789ab",
  "sessionId": "<SESSION_ID>",
  "questionId": "asd-req-e1",
  "relevancy": 0.7295,
  "correctness": 0.9208,
  "answerScore": 0.8443,
  "verdict": "STRONG",
  "breakdown": {
    "matchedKeywords": [
      "functional requirements",
      "non-functional requirements",
      "avionics systems",
      "system behavior",
      "quality attributes"
    ],
    "partialKeywords": [],
    "missingKeywords": [],
    "keywordCoverage": 1,
    "idealAnswerSimilarity": 0.7738,
    "questionSimilarity": 0.3634,
    "topicOverlap": 0.8494,
    "wordCount": 25,
    "stopwordRatio": 0.1852,
    "keywordDensity": 0.4074,
    "flags": []
  }
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
| `npm run test:scorer` | Runs Part 3 answer scorer & edge-case test suite (`scripts/testScorer.js`) |
| `npm run calibrate:scorer` | Runs Part 3 grid-search calibration advisor (`scripts/calibrateScorer.js`) |
| `npm run test:persistence` | Runs Part 3 DB persistence & duplicate rejection suite (`scripts/testScorePersistence.js`) |
