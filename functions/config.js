/**
 * UNCOVER - Backend Configuration
 * Centralized settings for AI models, search parameters, and timeouts.
 */

module.exports = {
  // Gemini AI Model Settings
  ai: {
    // Current verified active Gemini model supporting generateContent & structured JSON output
    model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
    temperature: 0.2,
    timeoutMs: 35000
  },

  // Tavily Search Settings
  search: {
    timeoutMs: 25000,
    maxResults: {
      standard: 4,
      deep: 7
    }
  },

  // Service Metadata
  service: {
    name: "UNCOVER Multi-Agent Research API",
    version: "1.0.0"
  }
};
