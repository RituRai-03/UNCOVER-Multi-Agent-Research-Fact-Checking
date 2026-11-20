/**
 * UNCOVER - Standalone Node.js Express Server for Render / Production
 * Reuses the existing multi-agent research pipeline (Tavily + Gemini)
 * Completely independent of Firebase Functions, enabling ₹0 zero-budget deployment.
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const config = require("./config");
const { executeLivePipeline } = require("./services/pipeline");

// Automatically load local .env files if present (for local standalone testing)
function loadLocalEnv(filename) {
  try {
    const fullPath = path.resolve(__dirname, filename);
    if (!fs.existsSync(fullPath)) return;
    const lines = fs.readFileSync(fullPath, "utf8").split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {}
}
loadLocalEnv(".env.local");
loadLocalEnv(".env");

const app = express();

// Middleware: Body parser
app.use(express.json({ limit: "10mb" }));

// Middleware: Permissive CORS
app.use(cors({ origin: true, credentials: true }));

app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
  res.set("Access-Control-Max-Age", "3600");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// Simple in-memory rate limiter (protects server from abuse)
const ipRequestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 40; // 40 requests per minute per IP

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

// Helper: Retrieve API secrets safely
function getApiKeys() {
  const tavilyKey = process.env.TAVILY_API_KEY || null;
  const geminiKey = process.env.GEMINI_API_KEY || null;
  return { tavilyKey, geminiKey };
}

// Health check handler
function handleHealthCheck(req, res) {
  const { tavilyKey, geminiKey } = getApiKeys();
  res.status(200).json({
    status: "ok",
    service: config.service?.name || "UNCOVER Multi-Agent Research API",
    version: config.service?.version || "1.0.0",
    aiModel: config.ai?.model || "gemini-3.1-flash-lite",
    platform: "standalone-express",
    liveApisReady: Boolean(tavilyKey && geminiKey),
    hasTavilyKey: Boolean(tavilyKey),
    hasGeminiKey: Boolean(geminiKey),
    timestamp: new Date().toISOString()
  });
}

// Research handler
async function handleResearch(req, res) {
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown_ip";

  if (isRateLimited(clientIp)) {
    console.warn(`[Server] Rate limit triggered for IP: ${clientIp}`);
    return res.status(429).json({
      error: true,
      code: "RATE_LIMITED",
      message: "Too many research requests from this client. Please wait a minute before retrying."
    });
  }

  const { query, depth = "standard", step = "all", inputData = {} } = req.body || {};

  // Validate Query
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({
      error: true,
      code: "INVALID_QUERY",
      message: "Research question cannot be empty."
    });
  }

  const cleanQuery = query.trim();
  if (cleanQuery.length < 3) {
    return res.status(400).json({
      error: true,
      code: "QUERY_TOO_SHORT",
      message: "Research question must be at least 3 characters long."
    });
  }

  if (cleanQuery.length > 500) {
    return res.status(400).json({
      error: true,
      code: "QUERY_TOO_LONG",
      message: "Research question exceeds the maximum limit of 500 characters."
    });
  }

  // Validate Depth & Step
  const validDepths = ["standard", "deep"];
  const activeDepth = validDepths.includes(depth) ? depth : "standard";

  const validSteps = ["research", "factchecker", "conflict", "report", "all"];
  const activeStep = validSteps.includes(step) ? step : "all";

  // Check API Keys
  const { tavilyKey, geminiKey } = getApiKeys();
  if (!tavilyKey || !geminiKey) {
    const missing = [];
    if (!tavilyKey) missing.push("TAVILY_API_KEY");
    if (!geminiKey) missing.push("GEMINI_API_KEY");

    console.warn("[Server] Missing backend API secrets:", missing);
    return res.status(503).json({
      error: true,
      code: "MISSING_API_SECRETS",
      message: `Backend API secrets are not configured (${missing.join(", ")}). Configure them in Render Environment Variables.`,
      missing
    });
  }

  // Execute Live Pipeline
  try {
    console.log(`[Server] Starting live pipeline: step=${activeStep}, depth=${activeDepth}, query="${cleanQuery.substring(0, 45)}..."`);

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

  } catch (err) {
    console.error("[Server] Pipeline execution error:", err.message);
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      error: true,
      code: err.code || "PIPELINE_ERROR",
      message: err.message || "An unexpected error occurred during live multi-agent execution."
    });
  }
}

// Register endpoints across both clean and prefixed paths
app.get("/api/health", handleHealthCheck);
app.get("/health", handleHealthCheck);
app.get("/", handleHealthCheck);

app.post("/api/research", handleResearch);
app.post("/research", handleResearch);

// 404 handler for unrecognized routes
app.use((req, res) => {
  res.status(404).json({
    error: true,
    code: "NOT_FOUND",
    message: `Endpoint ${req.method} ${req.path} not recognized. Supported endpoints: POST /api/research, GET /api/health`
  });
});

// Start Server
const PORT = process.env.PORT || 5001;
const HOST = "0.0.0.0";

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`=================================================`);
    console.log(`  UNCOVER Standalone Server Running`);
    console.log(`  URL: http://${HOST}:${PORT}`);
    console.log(`  Health: http://${HOST}:${PORT}/api/health`);
    console.log(`  AI Model: ${config.ai?.model || "gemini-3.1-flash-lite"}`);
    console.log(`=================================================`);
  });
}

module.exports = app;
