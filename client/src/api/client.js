/**
 * @file client.js
 * @description Centralized, normalized HTTP client for RAC DRDO Adaptive Interview System API.
 * Uses native fetch with standardized error handling and JSON serialization.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Custom normalized API error class.
 */
export class ApiError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {number} status - HTTP status code.
   * @param {any} [data=null] - Server error payload.
   */
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Internal helper for making fetch requests with JSON processing.
 *
 * @private
 * @param {string} endpoint - Relative path (e.g. '/posts').
 * @param {RequestInit} [options={}] - Standard fetch options.
 * @returns {Promise<any>}
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    throw new ApiError(
      'Unable to connect to the interview server. Please verify network connectivity.',
      0,
      networkError
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage =
      (data && typeof data === 'object' && (data.error || data.message || data.details)) ||
      (typeof data === 'string' && data) ||
      `Request failed with HTTP status ${response.status} (${response.statusText})`;

    throw new ApiError(errorMessage, response.status, data);
  }

  return data;
}

// =========================================================================
// Posts API
// =========================================================================

/**
 * Fetches all available recruitment posts.
 *
 * @async
 * @returns {Promise<Array<object>>} List of posts with required skills.
 */
export async function fetchPosts() {
  return request('/posts');
}

/**
 * Fetches a single recruitment post by its unique ID.
 *
 * @async
 * @param {string} postId - Unique ID of the job post.
 * @returns {Promise<object>} Post record including postSkills.
 */
export async function fetchPostById(postId) {
  if (!postId) {
    throw new ApiError('Post ID is required.', 400);
  }
  return request(`/posts/${encodeURIComponent(postId)}`);
}

// =========================================================================
// Candidates API
// =========================================================================

/**
 * Fetches all registered candidate profiles.
 *
 * @async
 * @returns {Promise<Array<object>>} List of candidates with their skills.
 */
export async function fetchCandidates() {
  return request('/candidates');
}

/**
 * Registers a new candidate profile.
 *
 * @async
 * @param {object} params
 * @param {string} params.name - Full name of the candidate.
 * @param {string} params.postApplied - Post title applied for.
 * @param {string} params.experienceLevel - Experience tier (Junior, Mid-Level, Senior, etc.).
 * @returns {Promise<object>} Created candidate profile.
 */
export async function createCandidate({ name, postApplied, experienceLevel }) {
  return request('/candidates', {
    method: 'POST',
    body: JSON.stringify({ name, postApplied, experienceLevel }),
  });
}

/**
 * Fetches candidate profile by ID including skills and interview history.
 *
 * @async
 * @param {string} candidateId - Candidate ID.
 * @returns {Promise<object>} Candidate profile.
 */
export async function fetchCandidateById(candidateId) {
  if (!candidateId) {
    throw new ApiError('Candidate ID is required.', 400);
  }
  return request(`/candidates/${encodeURIComponent(candidateId)}`);
}

/**
 * Ingests and associates an array of skills for a candidate.
 *
 * @async
 * @param {string} candidateId - Candidate ID.
 * @param {string[]} skills - Array of skill name strings.
 * @returns {Promise<{ success: boolean, candidateId: string, count: number, skills: string[] }>}
 */
export async function saveCandidateSkills(candidateId, skills) {
  if (!candidateId) {
    throw new ApiError('Candidate ID is required.', 400);
  }
  return request(`/candidates/${encodeURIComponent(candidateId)}/skills`, {
    method: 'POST',
    body: JSON.stringify({ skills }),
  });
}

// =========================================================================
// Skill-Match API (Part 2)
// =========================================================================

/**
 * Computes suitability match percentage, suitability band, and skill breakdown
 * between candidate skills and required post skills.
 *
 * @async
 * @param {object} params
 * @param {string} params.candidateId - Candidate ID.
 * @param {string} params.postId - Post ID.
 * @returns {Promise<{
 *   matchPercent: number,
 *   band: 'STRONG'|'MODERATE'|'WEAK',
 *   mandatoryGap: boolean,
 *   missingMandatory: string[],
 *   breakdown: Array<{
 *     requiredSkill: string,
 *     weight: number,
 *     isMandatory: boolean,
 *     bestCandidateSkill: string|null,
 *     score: number,
 *     matchType: 'exact'|'synonym'|'partial'|'none'
 *   }>,
 *   strengths: string[],
 *   gaps: string[],
 *   resultId?: string
 * }>}
 */
export async function computeSkillMatch({ candidateId, postId }) {
  if (!candidateId || !postId) {
    throw new ApiError('Both candidateId and postId are required to compute skill match.', 400);
  }
  return request('/skill-match', {
    method: 'POST',
    body: JSON.stringify({ candidateId, postId }),
  });
}

/**
 * Retrieves the latest persisted skill match result for a candidate and post.
 *
 * @async
 * @param {string} candidateId - Candidate ID.
 * @param {string} postId - Post ID.
 * @returns {Promise<object>} Persisted SkillMatchResult record.
 */
export async function fetchLatestSkillMatch(candidateId, postId) {
  if (!candidateId || !postId) {
    throw new ApiError('Both candidateId and postId are required.', 400);
  }
  return request(`/candidates/${encodeURIComponent(candidateId)}/skills-match/${encodeURIComponent(postId)}`);
}

// =========================================================================
// Sessions API (Part 1 & 6)
// =========================================================================

/**
 * Fetches recent interview sessions for dashboard display.
 *
 * @async
 * @returns {Promise<Array<object>>} List of interview sessions.
 */
export async function fetchSessions() {
  return request('/sessions');
}

/**
 * Creates a bare interview session for a candidate.
 * DEPRECATED: this does not initialise the adaptive engine. Use startInterview() instead.
 * Remove once SetupWizardPage no longer imports it.
 *
 * @async
 * @param {string} candidateId - Candidate ID.
 * @returns {Promise<object>} Created session record with id and candidate.
 */
export async function createSession(candidateId) {
  if (!candidateId) {
    throw new ApiError('Candidate ID is required to create an interview session.', 400);
  }
  return request('/sessions', {
    method: 'POST',
    body: JSON.stringify({ candidateId }),
  });
}

/**
 * Retrieves interview session details by session ID.
 *
 * @async
 * @param {string} sessionId - Session ID.
 * @returns {Promise<object>} Full session record including candidate and responses.
 */
export async function fetchSessionById(sessionId) {
  if (!sessionId) {
    throw new ApiError('Session ID is required.', 400);
  }
  return request(`/sessions/${encodeURIComponent(sessionId)}`);
}

// =========================================================================
// Adaptive Interview Room API (Part 4 & 6)
// =========================================================================

/**
 * Starts an adaptive interview: creates the session, runs the skill match,
 * initialises SessionState and returns the first question.
 *
 * @async
 * @param {object} params
 * @param {string} params.candidateId - Candidate ID.
 * @param {string} params.postId - Post ID.
 * @returns {Promise<{ sessionId: string, candidateId: string, postId: string,
 *   skillMatchSummary: object, firstQuestion: object }>}
 */
export async function startInterview({ candidateId, postId }) {
  if (!candidateId || !postId) {
    throw new ApiError('Both candidateId and postId are required to start an interview.', 400);
  }
  return request('/interviews/start', {
    method: 'POST',
    body: JSON.stringify({ candidateId, postId }),
  });
}

/**
 * Retrieves the current pending question for an active interview session.
 * Refresh-safe: returns identical question until an answer is submitted.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @returns {Promise<object>} { sessionId, phase, isComplete, endReason, question }
 */
export async function fetchInterviewQuestion(sessionId) {
  if (!sessionId) {
    throw new ApiError('Session ID is required to fetch interview question.', 400);
  }
  return request(`/interviews/${encodeURIComponent(sessionId)}/question`);
}

/**
 * Submits an answer to the pending question. The server scores it, runs the adaptive
 * engine and returns { scoring, decision, nextQuestion, interviewComplete, endReason }.
 *
 * @async
 * @param {object} params
 * @param {string} params.sessionId - Interview session ID.
 * @param {string} params.answerText - Candidate free-text answer.
 * @returns {Promise<object>}
 */
export async function submitAnswer({ sessionId, answerText }) {
  if (!sessionId) {
    throw new ApiError('Session ID is required to submit an answer.', 400);
  }
  return request(`/interviews/${encodeURIComponent(sessionId)}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answerText }),
  });
}

/**
 * Retrieves the interview state snapshot and DecisionLog audit trail.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @returns {Promise<object>} State and decision log.
 */
export async function fetchInterviewState(sessionId) {
  if (!sessionId) {
    throw new ApiError('Session ID is required.', 400);
  }
  return request(`/interviews/${encodeURIComponent(sessionId)}/state`);
}

/**
 * Concludes an interview session early with examiner rationale.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @param {string} reason - Examiner termination reason.
 * @returns {Promise<object>} Termination confirmation.
 */
export async function terminateInterviewEarly(sessionId, reason) {
  if (!sessionId) {
    throw new ApiError('Session ID is required.', 400);
  }
  return request(`/interviews/${encodeURIComponent(sessionId)}/end`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// =========================================================================
// Reports & Rankings API (Part 5 & 6)
// =========================================================================

/**
 * Retrieves the candidate evaluation dossier for a completed or active session.
 *
 * @async
 * @param {string} sessionId - Session ID.
 * @returns {Promise<object>} Comprehensive candidate report dossier.
 */
export async function fetchReport(sessionId) {
  if (!sessionId) {
    throw new ApiError('Session ID is required to fetch report.', 400);
  }
  return request(`/reports/${encodeURIComponent(sessionId)}`);
}

/**
 * Saves board remarks for a candidate dossier.
 *
 * @async
 * @param {string} sessionId - Session ID.
 * @param {string} remarks - Examiner committee remarks.
 * @returns {Promise<object>}
 */
export async function saveBoardRemarks(sessionId, remarks) {
  if (!sessionId) {
    throw new ApiError('Session ID is required.', 400);
  }
  return request(`/reports/${encodeURIComponent(sessionId)}/remarks`, {
    method: 'POST',
    body: JSON.stringify({ remarks }),
  });
}

/**
 * Records an examiner recommendation override.
 *
 * @async
 * @param {string} sessionId - Session ID.
 * @param {object} params
 * @param {string} params.finalRecommendation - SUITABLE | BORDERLINE | NOT_SUITABLE
 * @param {string} params.reason - Mandatory justification
 * @param {string} [params.overriddenBy] - Examiner name / title
 * @returns {Promise<object>}
 */
export async function overrideRecommendation(sessionId, { finalRecommendation, reason, overriddenBy }) {
  if (!sessionId) {
    throw new ApiError('Session ID is required.', 400);
  }
  return request(`/reports/${encodeURIComponent(sessionId)}/override`, {
    method: 'POST',
    body: JSON.stringify({ finalRecommendation, reason, overriddenBy }),
  });
}

/**
 * Regenerates the report, incrementing the version while preserving data.
 *
 * @async
 * @param {string} sessionId - Session ID.
 * @returns {Promise<object>} Updated report dossier.
 */
export async function regenerateReport(sessionId) {
  if (!sessionId) {
    throw new ApiError('Session ID is required.', 400);
  }
  return request(`/reports/${encodeURIComponent(sessionId)}/regenerate`, {
    method: 'POST',
  });
}

/**
 * Retrieves all evaluated candidate dossiers for the Recruitment Rankings view.
 *
 * @async
 * @returns {Promise<Array<object>>} List of candidate reports with overall scores and recommendations.
 */
export async function fetchRankings() {
  return request('/reports');
}

// =========================================================================
// Question Bank & Expert Injections API (Part 7C)
// =========================================================================

/**
 * Retrieves questions from the question bank.
 *
 * @async
 * @param {object} [filters={}]
 * @returns {Promise<Array<object>>}
 */
export async function fetchQuestions(filters = {}) {
  const query = new URLSearchParams(filters).toString();
  return request(`/questions${query ? `?${query}` : ''}`);
}

/**
 * Creates a question in the bank.
 *
 * @async
 * @param {object} questionData
 * @returns {Promise<object>}
 */
export async function createQuestion(questionData) {
  return request('/questions', {
    method: 'POST',
    body: JSON.stringify(questionData),
  });
}

/**
 * Updates a question in the bank.
 *
 * @async
 * @param {string} id
 * @param {object} questionData
 * @returns {Promise<object>}
 */
export async function updateQuestion(id, questionData) {
  return request(`/questions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(questionData),
  });
}

/**
 * Archives a question.
 *
 * @async
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function archiveQuestion(id) {
  return request(`/questions/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
  });
}

/**
 * Previews relevancy of a proposed question.
 *
 * @async
 * @param {object} previewData
 * @returns {Promise<{ score: number, band: string, isLowFit: boolean, candidateFit: number, postFit: number }>}
 */
export async function previewQuestionRelevancy(previewData) {
  return request('/questions/relevancy-preview', {
    method: 'POST',
    body: JSON.stringify(previewData),
  });
}

/**
 * Injects an expert-authored question into an active interview.
 *
 * @async
 * @param {string} sessionId
 * @param {object} questionData
 * @returns {Promise<object>}
 */
export async function injectExpertQuestion(sessionId, questionData) {
  return request(`/interviews/${encodeURIComponent(sessionId)}/expert-question`, {
    method: 'POST',
    body: JSON.stringify(questionData),
  });
}

/**
 * Server health check probe.
 *
 * @async
 * @returns {Promise<{ status: string, service: string }>}
 */
export async function checkHealth() {
  const url = `${API_BASE_URL.replace(/\/api$/, '')}/health`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError('Health check failed', res.status);
  return res.json();
}