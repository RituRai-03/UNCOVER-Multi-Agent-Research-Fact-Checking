/**
 * UNCOVER - Backend API Client
 * Secure communication with Firebase Cloud Functions (/api/research & /api/health)
 * Features resilient multi-candidate endpoint resolution for local emulator & production.
 */

import { APP_CONFIG } from './config.js';

let cachedWorkingBaseUrl = null;

/**
 * Get prioritized candidate base URLs for connecting to Cloud Functions / Render Backend
 */
function getCandidateBaseUrls() {
  if (cachedWorkingBaseUrl) {
    return [cachedWorkingBaseUrl];
  }

  const primary = APP_CONFIG.apiBaseUrl ? APP_CONFIG.apiBaseUrl.replace(/\/$/, '') : '';
  const candidates = [];

  if (primary) candidates.push(primary);

  // In production (Vercel, custom domain), NEVER target localhost or local IPv4
  if (!APP_CONFIG.isLocal) {
    if (!candidates.includes("/api")) candidates.push("/api");
    const liveRenderBase = "https://uncover-backend-d8tn.onrender.com/api";
    if (!candidates.includes(liveRenderBase)) candidates.push(liveRenderBase);
    return candidates;
  }

  // Fallbacks for local emulator & standalone server (Local development only)
  const localV4 = "http://127.0.0.1:5001/uncover-multi-agent/us-central1/api";
  const localHost = "http://localhost:5001/uncover-multi-agent/us-central1/api";
  const localStandalone = "http://127.0.0.1:5055/api";

  if (!candidates.includes(localV4)) candidates.push(localV4);
  if (!candidates.includes(localHost)) candidates.push(localHost);
  if (!candidates.includes(localStandalone)) candidates.push(localStandalone);
  if (!candidates.includes("/api")) candidates.push("/api");

  return candidates;
}

/**
 * Call the secure backend research endpoint with resilient fallback
 * @param {string} step - "research" | "factchecker" | "conflict" | "report" | "all"
 * @param {string} query - Cleaned research question
 * @param {string} depth - "standard" | "deep"
 * @param {Object} inputData - Structured inputs passed from preceding agents
 * @returns {Promise<Object>} Output payload from the backend agent
 */
export async function callResearchApi(step, query, depth = "standard", inputData = {}) {
  const candidateBases = getCandidateBaseUrls();
  let lastNetworkError = null;

  for (const baseUrl of candidateBases) {
    const endpoint = `${baseUrl.replace(/\/$/, '')}/research`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          step,
          query,
          depth,
          inputData
        })
      });

      // If we got a response from the server, this endpoint is reachable!
      cachedWorkingBaseUrl = baseUrl;

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const err = new Error(result.message || `Backend API error (${response.status})`);
        err.code = result.code || "BACKEND_ERROR";
        err.status = response.status;
        err.missing = result.missing;
        err.endpoint = endpoint;
        throw err;
      }

      return result.data;

    } catch (error) {
      if (error.code) {
        // This is a valid application-level response from the backend (e.g. 503 MISSING_API_SECRETS or 400 INVALID_QUERY)
        throw error;
      }

      // Network-level connection failure for this candidate URL
      lastNetworkError = error;
    }
  }

  // If ALL candidates failed with network errors
  const testedEndpoints = candidateBases.map(b => `${b}/research`).join(", ");
  const networkErr = new Error(
    `Failed to connect to UNCOVER backend. Tested endpoints: [${testedEndpoints}]. Ensure Firebase Cloud Functions emulator is running ('npx firebase-tools emulators:start --only functions --project uncover-multi-agent').`
  );
  networkErr.code = "BACKEND_UNREACHABLE";
  networkErr.cause = lastNetworkError;
  throw networkErr;
}

/**
 * Check backend health and API configuration status
 */
export async function checkBackendHealth() {
  const candidateBases = getCandidateBaseUrls();

  for (const baseUrl of candidateBases) {
    const endpoint = `${baseUrl.replace(/\/$/, '')}/health`;
    try {
      const response = await fetch(endpoint, { method: "GET" });
      if (response.ok) {
        cachedWorkingBaseUrl = baseUrl;
        const data = await response.json();
        return { online: true, endpoint, ...data };
      }
    } catch (e) {
      // Try next candidate
    }
  }

  return { online: false, error: "No candidate endpoint responded to health check." };
}
