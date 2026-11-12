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
 * Internal helper for making fetch requests with timeout and JSON processing.
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
 * Creates a new interview session for a candidate.
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
// Answers API (Part 3)
// =========================================================================

/**
 * Evaluates and records a candidate's answer for a question within a session.
 *
 * @async
 * @param {object} params
 * @param {string} params.sessionId - Interview session ID.
 * @param {string} params.questionId - Question ID.
 * @param {string} params.answerText - Candidate free-text transcript.
 * @returns {Promise<object>} Scored response result.
 */
export async function submitAnswer({ sessionId, questionId, answerText }) {
  return request('/answers', {
    method: 'POST',
    body: JSON.stringify({ sessionId, questionId, answerText }),
  });
}

// =========================================================================
// Adaptive Interview Room API (Part 4 & 6)
// =========================================================================

/**
 * Retrieves the current pending question for an active interview session.
 * Refresh-safe: returns identical question until an answer is submitted.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @returns {Promise<object>} Question payload or completion signal.
 */
export async function fetchInterviewQuestion(sessionId) {
  if (!sessionId) {
    throw new ApiError('Session ID is required to fetch interview question.', 400);
  }
  return request(`/interviews/${encodeURIComponent(sessionId)}/question`);
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
  return request(`/interviews/${encodeURIComponent(sessionId)}/terminate`, {
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

