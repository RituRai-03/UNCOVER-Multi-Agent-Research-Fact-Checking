/**
 * UNCOVER - Firebase Cloud Functions
 * Secure Backend for Gemini AI Reasoning & Tavily Web Grounding
 * 
 * Routes:
 * - POST /api/research (Live multi-agent execution)
 * - GET  /api/health   (Service health & readiness check)
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { executeLivePipeline } = require("./services/pipeline");

// Define secrets in Firebase Secret Manager
const tavilyApiKey = defineSecret("TAVILY_API_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Simple in-memory rate limiter (protects function from abuse)
const ipRequestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute per IP

function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);
  if (!entry || (now - entry.startTime) > RATE_LIMIT_WINDOW_MS) {
    ipRequestCounts.set(ip, { startTime: now, count: 1 });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

/**
 * Main API Handler (Mapped to /api/** via firebase.json)
 */
exports.api = onRequest({
  cors: true,
  secrets: [tavilyApiKey, geminiApiKey],
  timeoutSeconds: 120,
  memory: "512MiB"
}, async (req, res) => {
  // Extract client IP
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown_ip";

  if (isRateLimited(clientIp)) {
    logger.warn(`Rate limit triggered for IP: ${clientIp}`);
    res.status(429).json({
      error: true,
      code: "RATE_LIMITED",
      message: "Too many research requests from this client. Please wait a minute before retrying."
    });
    return;
  }

  // Safe secret retrieval (Secret Manager with process.env fallback for local dev)
  let tavilyKey = null;
  let geminiKey = null;

  try {
    tavilyKey = (tavilyApiKey && typeof tavilyApiKey.value === "function") ? tavilyApiKey.value() : null;
  } catch (e) {
    // Secret not available via params
  }
  if (!tavilyKey) tavilyKey = process.env.TAVILY_API_KEY || null;

  try {
    geminiKey = (geminiApiKey && typeof geminiApiKey.value === "function") ? geminiApiKey.value() : null;
  } catch (e) {
    // Secret not available via params
  }
  if (!geminiKey) geminiKey = process.env.GEMINI_API_KEY || null;

  // Normalize path
  const rawPath = req.path || "/";
  const normalizedPath = rawPath.replace(/^\/api/, "") || "/";

  // =========================================================================
  // ROUTE: GET /health
  // =========================================================================
  if (req.method === "GET" && (normalizedPath === "/health" || normalizedPath === "/")) {
    res.status(200).json({
      status: "ok",
      service: "UNCOVER Multi-Agent Research API",
      version: "1.0.0",
      liveApisReady: Boolean(tavilyKey && geminiKey),
      hasTavilyKey: Boolean(tavilyKey),
      hasGeminiKey: Boolean(geminiKey),
      timestamp: new Date().toISOString()
    });
    return;
  }

  // =========================================================================
  // ROUTE: POST /research
  // =========================================================================
  if (req.method === "POST" && (normalizedPath === "/research" || normalizedPath === "/")) {
    const body = req.body || {};
    const { query, depth = "standard", step = "all", inputData = {} } = body;

    // Validate Query
    if (!query || typeof query !== "string" || !query.trim()) {
      res.status(400).json({
        error: true,
        code: "INVALID_QUERY",
        message: "Research question cannot be empty."
      });
      return;
    }

    const cleanQuery = query.trim();
    if (cleanQuery.length < 3) {
      res.status(400).json({
        error: true,
        code: "QUERY_TOO_SHORT",
        message: "Research question must be at least 3 characters long."
      });
      return;
    }

    if (cleanQuery.length > 500) {
      res.status(400).json({
        error: true,
        code: "QUERY_TOO_LONG",
        message: "Research question exceeds the maximum limit of 500 characters."
      });
      return;
    }

    // Validate Depth
    const validDepths = ["standard", "deep"];
    const activeDepth = validDepths.includes(depth) ? depth : "standard";

    // Validate Step
    const validSteps = ["research", "factchecker", "conflict", "report", "all"];
    const activeStep = validSteps.includes(step) ? step : "all";

    // Check API Keys Presence
    if (!tavilyKey || !geminiKey) {
      const missing = [];
      if (!tavilyKey) missing.push("TAVILY_API_KEY");
      if (!geminiKey) missing.push("GEMINI_API_KEY");

      logger.error("Missing backend API secrets", { missing });

      res.status(503).json({
        error: true,
        code: "MISSING_API_SECRETS",
        message: `Backend API secrets are not configured (${missing.join(", ")}). Configure them via 'firebase functions:secrets:set' or environment variables.`,
        missing
      });
      return;
    }

    // Execute Live Pipeline
    try {
      logger.info(`Starting live pipeline execution: step=${activeStep}, depth=${activeDepth}, query="${cleanQuery.substring(0, 50)}..."`);

      const result = await executeLivePipeline(
        activeStep, 
        cleanQuery, 
        activeDepth, 
        inputData, 
        { tavilyKey, geminiKey }
      );

      res.status(200).json({
        status: "success",
        step: activeStep,
        data: result
      });

    } catch (pipelineErr) {
      logger.error("Pipeline execution failure", { error: pipelineErr.message, code: pipelineErr.code });

      const statusCode = pipelineErr.status || 500;
      res.status(statusCode).json({
        error: true,
        code: pipelineErr.code || "PIPELINE_ERROR",
        message: pipelineErr.message || "An unexpected error occurred during live multi-agent execution."
      });
    }
    return;
  }

  // Fallback 404 / 405
  res.status(404).json({
    error: true,
    code: "NOT_FOUND",
    message: `Endpoint ${req.method} ${req.path} not recognized. Supported endpoints: POST /api/research, GET /api/health`
  });
});
