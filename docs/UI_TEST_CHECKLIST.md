# RAC DRDO AI Interview System — Comprehensive UI Testing Checklist

This document provides the standard operating test manual and verification checklist for the **Recruitment and Assessment Centre (RAC), DRDO Adaptive Interview System** frontend interface (Part 6: Dashboard, Setup Wizard, Interview Room, Examiner View, Dossier Reports & Recruitment Rankings).

---

## 1. End-to-End Core Workflow Checklist

| # | Test Case | Steps | Expected Result | Status |
| :-: | :--- | :--- | :--- | :-: |
| **1** | **Open Dashboard** | Navigate to `http://localhost:5173/` | RAC DRDO header with tricolor accent and Ashoka/DRDO crest loads; metric counters and Recent Interviews table display with clean loading state. | [x] PASS |
| **2** | **Start a New Interview** | Click "Start New Assessment" card or Header navigation link | System navigates to `/setup` displaying Phase 1 of the 3-step setup wizard. | [x] PASS |
| **3** | **Select a Post** | In Step 1, browse the grid of posts (`Scientist 'C' - ASD`, etc.) and click a post card | Selected post card highlights with deep navy border, checkmark icon, and displays competency requirements and weights. "Continue to Candidate Details" activates. | [x] PASS |
| **4** | **Enter Candidate Details** | Click "Continue to Candidate Details"; fill in Candidate Name and select Experience Tier from dropdown | Fields populate correctly; target post banner appears at the top. | [x] PASS |
| **5** | **Add and Remove Candidate Skills** | In the Competencies input, type a skill (e.g. `Avionics`) and press Enter or click suggestion chip. Click remove icon (×) on a chip | Chips are added to the list without duplicates; removing a chip updates state immediately. | [x] PASS |
| **6** | **Save Candidate** | Click "Proceed to Skill Match" | Calls `POST /api/candidates` and `POST /api/candidates/:id/skills`; spinner displays; navigates to Step 3 upon creation. | [x] PASS |
| **7** | **View Skill-Match Gauge & Breakdown** | Observe Step 3 presentation | Semicircular pure-SVG gauge animates to exact match percentage; band badge (`STRONG`, `MODERATE`, `WEAK`), strengths list, gaps list, and breakdown table render with match types (`Exact`, `Synonym`, `Partial`, `No Match`). | [x] PASS |
| **8** | **Test WEAK Band Confirmation** | Select or input skills yielding &lt; 50% match; click "Start Interview Session" | Confirmation dialog (`ConfirmDialog`) opens with warning: "The candidate suitability evaluation returned a WEAK classification... Do you wish to override and initiate the live assessment session?" | [x] PASS |
| **9** | **Test Mandatory-Gap Warning** | Provide skills omitting a mandatory requirement (e.g. omit `DO-178C`); observe Step 3 | Prominent rose-colored alert banner displays listing missing mandatory competencies with boardroom override notice. | [x] PASS |
| **10** | **Start Interview** | Click "Start Interview Session" (or confirm override) | Calls `createSession(candidateId)`; toast notification displays; navigates to `/interview/:sessionId`. | [x] PASS |
| **11** | **Answer Three Questions in Candidate View** | In default Candidate View, type responses into the textarea and click "Submit & Proceed to Next" for 3 successive questions | Each question is recorded; neutral transition message "Thank you. Next question..." appears; question counter increments (e.g. Q1 → Q2 → Q3); word count reflects live typing. | [x] PASS |
| **12** | **Verify No Scores or Verdicts Appear in Candidate View** | Inspect the screen in Candidate View during and after submissions | **SECURITY VERIFIED**: Zero scores, zero relevancy percentages, zero verdicts, zero difficulty tags, zero engine decisions, zero keywords, and zero flags appear. | [x] PASS |
| **13** | **Refresh During an Active Interview** | Press browser reload (<kbd>F5</kbd> / <kbd>Cmd+R</kbd>) while viewing an unanswered question | Page reloads without error; identical pending question is retrieved from `GET /api/interviews/:sessionId/question`; question is not skipped or altered. | [x] PASS |
| **14** | **Verify Same Pending Question Displayed** | Compare question ID and text before and after reload | Question remains 100% identical. Session state is preserved. | [x] PASS |
| **15** | **Double-Click Submit** | Enter an answer and rapidly double-click the "Submit & Proceed to Next" button | Submit button is immediately disabled (`isSubmitting === true`), submit lock ref blocks duplicate execution; only one HTTP request is sent. | [x] PASS |
| **16** | **Verify Duplicate Submission Prevented** | Check network inspector / database response rows | Single response is saved; duplicate unique constraint rejection (`409 Conflict`) is prevented. | [x] PASS |
| **17** | **Toggle Examiner Mode** | Click "Examiner Mode" toggle in the interview room header | Toggle turns gold ("Examiner Mode ON"); examiner telemetry side panel smoothly slides into view; preference is persisted in `localStorage`. | [x] PASS |
| **18** | **Verify Examiner-Only Information Appears** | Inspect the Examiner Telemetry side panel | Relevancy %, Correctness %, Weighted Answer Score %, Verdict badge (`STRONG` / `PARTIAL` / `IRRELEVANT`), matched keywords in green, missing keywords in red, engine action/reason, and live `ProgressStrip` render. | [x] PASS |
| **19** | **End Interview Early** | Click "End Early" button in header | Early termination modal opens with mandatory justification textarea. | [x] PASS |
| **20** | **Verify Termination Reason** | Type termination reason (e.g. "Candidate withdrew due to medical emergency") and click "Confirm Early Termination" | Calls `POST /api/interviews/:sessionId/terminate`; marks session ended; navigates to completion screen with termination indicator. | [x] PASS |
| **21** | **Open Completion Screen** | Observe `/interview/:sessionId/done` | Dignified, neutral completion message displays: "Interview completed. Thank you." No scores or verdicts disclosed to candidate. "Examiner: View Report" button is available. | [x] PASS |
| **22** | **Open Report** | Click "Examiner: View Report" | System navigates to `/report/:sessionId`; full dossier loads. | [x] PASS |
| **23** | **Verify Report Summary & Topic Scores** | Inspect top summary cards and topic proficiency section | Overall score (e.g. 78/100), recommendation badge (`SUITABLE` / `BORDERLINE` / `NOT_SUITABLE`), Skill-Match %, Interview Score %, Relevancy %, and horizontal topic bars (`TopicBar`) display with highest difficulty reached. | [x] PASS |
| **24** | **Expand Question Rows** | Click question rows in the Question Evaluation Log table | Row expands showing full candidate transcript, matched keywords, missing keywords, and flags. Clicking again collapses row. | [x] PASS |
| **25** | **Inspect Decision Timeline** | Scroll to Adaptive Interview Decision Log (Audit Trail) | Chronological step-by-step Markov transitions and difficulty calibration reasons are displayed with timestamps. | [x] PASS |
| **26** | **Save Board Remarks** | Enter committee remarks into Presiding Board Remarks textarea and click "Save Remarks to Dossier" | Toast confirmation displays; remarks are saved via `POST /api/reports/:sessionId/remarks` and persist across reloads. | [x] PASS |
| **27** | **Override Recommendation** | Click "Modify Recommendation" in the override box; select a new recommendation (e.g. `BORDERLINE` → `SUITABLE`), enter justification, and submit | Override commits via `POST /api/reports/:sessionId/override`; recommendation badge updates; purple "Overridden" tag appears with author and timestamp. | [x] PASS |
| **28** | **Verify Audit Information** | Review the updated Board Decision card in the report summary | Card reflects final recommendation while displaying original system recommendation and full override audit details. | [x] PASS |
| **29** | **Regenerate Report** | Click "Regenerate Report" in action bar; confirm in modal | Calls `POST /api/reports/:sessionId/regenerate`; report version increments (e.g. `v1.0` → `v1.1`); toast confirms success; prior remarks and overrides are retained. | [x] PASS |
| **30** | **Print / Save as PDF** | Click "Print / Save as PDF" button | Browser print dialog opens with `@media print` layout: navigation and action buttons hidden, backgrounds white, card breaks avoided, board sign-off section visible. | [x] PASS |
| **31** | **Open Rankings** | Click "Rankings & Reports" in the top navigation or navigate to `/reports` | Comprehensive recruitment rankings table loads displaying all assessed candidates, posts, overall scores, recommendations, and dates. | [x] PASS |
| **32** | **Filter and Sort Rankings** | Select a specific post in the post filter; change recommendation filter; click "Score Order" button to toggle ASC/DESC | Table updates immediately in real-time; clicking any row navigates directly to that candidate's dossier (`/report/:sessionId`). | [x] PASS |

---

## 2. Edge Case & Negative Path Verification Checklist

| # | Scenario | Test Steps | Expected Result | Status |
| :-: | :--- | :--- | :--- | :-: |
| **E1** | **API Unavailable / Network Down** | Stop backend or input invalid port | Centralized API client normalizes error; `ErrorState` component renders with "Unable to connect to the interview server" and a retry button. No unhandled promise rejections or white-screen crashes. | [x] PASS |
| **E2** | **Empty API Response** | Query empty database tables | `EmptyState` component renders with clean government-styled graphic and clear call-to-action (e.g. "Start New Interview"). | [x] PASS |
| **E3** | **Invalid Candidate Input** | Submit candidate setup with blank name or 0 skills | Form validation halts submission; field-specific red helper text displays ("Full candidate name is required", "Please enter at least one verified skill"); toast warning appears. | [x] PASS |
| **E4** | **WEAK Band Override** | Weak applicant (&lt; 50%) is selected | Start Interview button remains permanently enabled; clicking it opens `ConfirmDialog` requiring examiner explicit confirmation before creating session. | [x] PASS |
| **E5** | **Mandatory Skill Gap** | Candidate possesses skills but lacks a post mandatory skill | Prominent red warning banner alerts board; override confirmation required to launch session; interview creation is not blocked. | [x] PASS |
| **E6** | **Refresh Mid-Interview** | Reload browser multiple times during question 4 | Engine preserves pending question; question counter remains at 4; timer continues; no duplicate questions or skipped questions. | [x] PASS |
| **E7** | **Double Submission Prevention** | Rapidly press Enter and double-click Submit | Button disables; `submitLockRef` suppresses re-entry; single answer is sent to backend. | [x] PASS |
| **E8** | **Early Termination Handling** | Terminate session at Question 2 | Session status switches to COMPLETED; completion page flags administrative end; report shows "Terminated Early" warning banner with examiner reason. | [x] PASS |
| **E9** | **Candidate-Mode Data Leakage** | Inspect DOM and React component tree in Candidate View | Automated test `scripts/testCandidateProtection.js` confirms zero examiner telemetry (scores, verdicts, keywords, flags, decisions) rendered in candidate mode. | [x] PASS |

