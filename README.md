# RAC DRDO Adaptive Interview System (Part 1)

AI-based adaptive interview platform designed for the **Recruitment and Assessment Centre (RAC), Defence Research and Development Organisation (DRDO)**.

In Part 1, the system establishes the **database foundation, relational architecture, question bank schema, and data-access layer** for the initial subject: **Advanced System Development (ASD)**.

---

## Project Structure

```
Applicant Selector Application/
├── client/                     # Placeholder for React + Tailwind CSS UI (Part 2)
│   └── README.md
├── server/                     # Node.js backend foundation
│   ├── prisma/
│   │   ├── migrations/         # Prisma migration history
│   │   ├── schema.prisma       # Normalized PostgreSQL database schema
│   │   ├── seed.js             # Idempotent database seeder
│   │   └── seedData/
│   │       └── asd.json        # ASD subject question bank (4 topics + icebreakers)
│   ├── src/
│   │   ├── db/
│   │   │   └── prismaClient.js # Singleton Prisma client instance
│   │   └── services/
│   │       ├── questionService.js # Data-access methods for questions & follow-ups
│   │       └── sessionService.js  # Data-access methods for sessions & responses
│   ├── scripts/
│   │   └── testDb.js           # Verification test suite
│   ├── .env.example            # Sample environment variables
│   ├── .env                    # Local environment config
│   └── package.json            # Server dependencies & scripts
├── .gitignore
├── package.json                # Root proxy scripts
└── README.md
```

---

## Tech Stack (Part 1)

- **Backend**: Node.js (CommonJS, consistent `require`/`module.exports`)
- **Database**: PostgreSQL
- **ORM & Migrations**: Prisma ORM
- **Frontend Placeholder**: `/client` reserved for React + Tailwind CSS in Part 2

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

Edit `server/.env` with your PostgreSQL credentials:

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

### 5. Seed the Question Bank

Populate the database with the Advanced System Development (ASD) curriculum and icebreaker questions:

```bash
npm run db:seed
```

> **Note**: Seeding is **strictly idempotent**. Running it multiple times will safely update existing records without creating duplicate questions or topics.

### 6. Run the Test Suite

Execute the automated test script to verify database connectivity, relational queries, follow-up linkages, and duplicate question prevention:

```bash
npm run test:db
```

*(You can also run all commands directly from the root project folder: `npm run db:migrate`, `npm run db:seed`, `npm run test:db`).*

---

## Question Bank Design & Architecture

### Normalized Schema (`server/prisma/schema.prisma`)
- **`Subject`**: Academic/technical evaluation domain (`ASD`).
- **`Topic`**: Modular subdivisions under a subject:
  1. Requirements Analysis
  2. System Architecture
  3. Verification & Validation (V&V)
  4. Interface Management
- **`Question`**: Unified model supporting:
  - `difficulty`: `EASY`, `MEDIUM`, `HARD`
  - `levelTag`: `TECHNICAL`, `MANAGERIAL`, `ICEBREAKER`
  - `keywords`: Native PostgreSQL `text[]` array (4–6 domain keywords per question)
  - `parentQId`: Self-referencing link (`Question.parentQuestion` & `Question.followUps`) linking Medium follow-ups to Easy unlocked questions.
  - Optional `topicId` allowing topic-agnostic Icebreaker questions.
- **`Candidate`**: Applicant profile (`name`, `postApplied`, `experienceLevel`).
- **`Session`**: Tracks candidate interviews (`startTime`, `endTime`).
- **`Response`**: Records candidate transcripts, relevancy, correctness, and enforces `@@unique([sessionId, questionId])` to ensure no question is asked twice in the same session.

---

## Available npm Scripts

Inside `server/` (or from the project root):

| Command | Description |
| :--- | :--- |
| `npm run db:migrate` | Runs `prisma migrate dev` to apply pending migrations |
| `npm run db:seed` | Executes `node prisma/seed.js` to seed ASD questions idempotently |
| `npm run db:reset` | Resets database (`prisma migrate reset --force`) and re-seeds |
| `npm run test:db` | Runs `scripts/testDb.js` to test full end-to-end database operations |

---

## Extensibility for Future Subjects

The design is decoupled from hardcoded logic. To add new subjects (e.g., Radar Engineering, Propulsion, Cyber Defence):
1. Create a new JSON data file in `server/prisma/seedData/<new_subject>.json` following the schema structure.
2. Call `seedSubjectData(newSubjectData)` in `server/prisma/seed.js`.
3. Re-run `npm run db:seed`. No schema changes required.

