/**
 * UNCOVER - Firebase Cloud Functions
 * Secure Backend for Gemini 1.5/2.5 AI & Tavily Search API
 * 
 * Note: Full multi-agent API endpoints will be wired in Stage 4.
 */

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// Health check endpoint
exports.health = onRequest({ cors: true }, (req, res) => {
  logger.info("Health check ping received", { structuredData: true });
  res.status(200).json({
    status: "ok",
    service: "UNCOVER Multi-Agent Research API",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});
