/**
 * UNCOVER - Backend API Client
 * Secure communication with Firebase Cloud Functions (/api/research & /api/health)
 */

import { APP_CONFIG } from './config.js';

/**
 * Call the secure backend research endpoint
 * @param {string} step - "research" | "factchecker" | "conflict" | "report" | "all"
 * @param {string} query - Cleaned research question
 * @param {string} depth - "standard" | "deep"
 * @param {Object} inputData - Structured inputs passed from preceding agents
 * @returns {Promise<Object>} Output payload from the backend agent
 */
export async function callResearchApi(step, query, depth = "standard", inputData = {}) {
  // Determine endpoint URL
  // If served from Firebase Hosting, relative /api/research automatically hits Cloud Function
  let endpoint = "/api/research";
  if (APP_CONFIG.apiBaseUrl && APP_CONFIG.apiBaseUrl !== "/api") {
    endpoint = `${APP_CONFIG.apiBaseUrl.replace(/\/$/, '')}/research`;
  }

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

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err = new Error(result.message || `Backend API error (${response.status})`);
      err.code = result.code || "BACKEND_ERROR";
      err.status = response.status;
      err.missing = result.missing;
      throw err;
    }

    return result.data;

  } catch (error) {
    if (error.code) {
      throw error; // Already formatted backend error
    }

    // Network or connection failure
    const networkErr = new Error(
      `Failed to connect to UNCOVER backend at ${endpoint}. Ensure Firebase Cloud Functions are deployed or emulators are running locally ('npm run serve' or 'firebase emulators:start').`
    );
    networkErr.code = "BACKEND_UNREACHABLE";
    throw networkErr;
  }
}

/**
 * Check backend health and API configuration status
 */
export async function checkBackendHealth() {
  let endpoint = "/api/health";
  if (APP_CONFIG.apiBaseUrl && APP_CONFIG.apiBaseUrl !== "/api") {
    endpoint = `${APP_CONFIG.apiBaseUrl.replace(/\/$/, '')}/health`;
  }

  try {
    const response = await fetch(endpoint, { method: "GET" });
    if (!response.ok) return { online: false, status: response.status };
    const data = await response.json();
    return { online: true, ...data };
  } catch (e) {
    return { online: false, error: e.message };
  }
}
