/**
 * UNCOVER - Multi-Agent Live Pipeline Orchestrator (Backend)
 * Coordinates Tavily search and Gemini structured reasoning across the four agents.
 */

const { searchTavily } = require("./tavily");
const { 
  extractClaimsWithGemini, 
  verifyClaimsWithGemini, 
  analyzeConflictsWithGemini, 
  synthesizeReportWithGemini 
} = require("./gemini");

/**
 * Execute a specific agent step or all steps in sequence
 */
async function executeLivePipeline(step, query, depth, inputData = {}, keys = {}) {
  const { tavilyKey, geminiKey } = keys;

  if (!tavilyKey) {
    const err = new Error("Tavily API key is missing. Please configure TAVILY_API_KEY in Firebase Secret Manager.");
    err.code = "MISSING_TAVILY_KEY";
    err.status = 500;
    throw err;
  }

  if (!geminiKey) {
    const err = new Error("Gemini API key is missing. Please configure GEMINI_API_KEY in Firebase Secret Manager.");
    err.code = "MISSING_GEMINI_KEY";
    err.status = 500;
    throw err;
  }

  const cleanQuery = query ? query.trim() : "";
  if (!cleanQuery) {
    const err = new Error("Research inquiry cannot be empty.");
    err.status = 400;
    throw err;
  }

  // =========================================================================
  // STEP: RESEARCH AGENT
  // =========================================================================
  if (step === "research") {
    const log = [];
    log.push(`Searching indexed web via Tavily Search (depth: ${depth})...`);
    
    // Execute live Tavily search
    const sources = await searchTavily(cleanQuery, {
      apiKey: tavilyKey,
      depth,
      maxResults: depth === "deep" ? 7 : 4
    });

    if (sources.length === 0) {
      log.push("No web results found for exact query; executing broadened search...");
      const broader = cleanQuery.split(/\s+/).slice(0, 5).join(" ");
      const fallbackSources = await searchTavily(broader, {
        apiKey: tavilyKey,
        depth: "basic",
        maxResults: 4
      });
      sources.push(...fallbackSources);
    }

    log.push(`Retrieved ${sources.length} authoritative sources with direct links.`);

    if (sources.length === 0) {
      throw new Error(`Zero search results retrieved for inquiry: "${cleanQuery}". Try rephrasing with specific keywords.`);
    }

    log.push("Extracting discrete empirical claims via Gemini AI...");
    const claims = await extractClaimsWithGemini(cleanQuery, sources, { apiKey: geminiKey });
    log.push(`Extracted ${claims.length} candidate factual claims from source evidence.`);

    return {
      agentId: "agent_research",
      agentName: "Research Agent",
      status: "COMPLETED",
      inputQuery: cleanQuery,
      depthLevel: depth,
      generatedQueries: [cleanQuery],
      sources,
      extractedClaims: claims,
      executionLog: log,
      timestamp: new Date().toISOString()
    };
  }

  // =========================================================================
  // STEP: FACT-CHECKER AGENT
  // =========================================================================
  if (step === "factchecker") {
    const { researchOutput } = inputData;
    if (!researchOutput || !Array.isArray(researchOutput.extractedClaims) || !Array.isArray(researchOutput.sources)) {
      const err = new Error("Fact-Checker requires researchOutput with extracted claims and sources.");
      err.status = 400;
      throw err;
    }

    const log = [];
    log.push(`Verifying ${researchOutput.extractedClaims.length} claims against ${researchOutput.sources.length} sources using Gemini structured reasoning...`);

    const verifiedClaims = await verifyClaimsWithGemini(
      cleanQuery, 
      researchOutput.extractedClaims, 
      researchOutput.sources, 
      { apiKey: geminiKey }
    );

    // Compute aggregated verification statistics
    let verified = 0;
    let partiallyVerified = 0;
    let disputed = 0;
    let unverified = 0;
    let totalScore = 0;

    verifiedClaims.forEach(c => {
      totalScore += c.confidenceScore;
      if (c.status === "VERIFIED") verified++;
      else if (c.status === "PARTIALLY_VERIFIED") partiallyVerified++;
      else if (c.status === "DISPUTED") disputed++;
      else unverified++;
    });

    const total = verifiedClaims.length || 1;
    const overallConfidence = Math.round((totalScore / total) * 100);

    const stats = {
      total: verifiedClaims.length,
      verified,
      partiallyVerified,
      disputed,
      unverified,
      overallConfidence
    };

    log.push(`Verification finalized: ${verified} Verified, ${partiallyVerified} Partially Verified, ${disputed} Disputed, ${unverified} Unverified.`);

    return {
      agentId: "agent_factchecker",
      agentName: "Fact-Checker Agent",
      status: "COMPLETED",
      claims: verifiedClaims,
      stats,
      executionLog: log,
      timestamp: new Date().toISOString()
    };
  }

  // =========================================================================
  // STEP: CONFLICT ANALYST AGENT
  // =========================================================================
  if (step === "conflict") {
    const { factCheckerOutput, researchOutput } = inputData;
    if (!factCheckerOutput || !Array.isArray(factCheckerOutput.claims)) {
      const err = new Error("Conflict Analyst requires factCheckerOutput with claims.");
      err.status = 400;
      throw err;
    }

    const log = [];
    log.push("Scanning evidence matrix for methodological and quantitative discrepancies via Gemini AI...");

    const sources = (researchOutput && researchOutput.sources) || [];
    const conflictResult = await analyzeConflictsWithGemini(
      cleanQuery, 
      factCheckerOutput.claims, 
      sources, 
      { apiKey: geminiKey }
    );

    log.push(`Identified ${conflictResult.conflicts.length} cross-source conflicts. Consensus grade: ${conflictResult.consensusRating}.`);

    return {
      agentId: "agent_conflict",
      agentName: "Conflict Analyst",
      status: "COMPLETED",
      conflicts: conflictResult.conflicts,
      totalConflicts: conflictResult.conflicts.length,
      consensusRating: conflictResult.consensusRating,
      executionLog: log,
      timestamp: new Date().toISOString()
    };
  }

  // =========================================================================
  // STEP: REPORT GENERATOR AGENT
  // =========================================================================
  if (step === "report") {
    const { researchOutput, factCheckerOutput, conflictOutput } = inputData;
    if (!researchOutput || !factCheckerOutput || !conflictOutput) {
      const err = new Error("Report Generator requires outputs from all preceding agents.");
      err.status = 400;
      throw err;
    }

    const log = [];
    log.push("Synthesizing executive briefing dossier via Gemini structured reasoning...");

    const reportData = await synthesizeReportWithGemini(
      cleanQuery,
      researchOutput,
      factCheckerOutput,
      conflictOutput,
      { apiKey: geminiKey }
    );

    // Group claims by status
    const categorized = {
      verified: factCheckerOutput.claims.filter(c => c.status === "VERIFIED"),
      partiallyVerified: factCheckerOutput.claims.filter(c => c.status === "PARTIALLY_VERIFIED"),
      disputed: factCheckerOutput.claims.filter(c => c.status === "DISPUTED"),
      unverified: factCheckerOutput.claims.filter(c => c.status === "UNVERIFIED")
    };

    const compiledStats = {
      sourcesCount: researchOutput.sources.length,
      claimsTotal: factCheckerOutput.claims.length,
      verifiedCount: categorized.verified.length,
      partiallyCount: categorized.partiallyVerified.length,
      disputedCount: categorized.disputed.length,
      unverifiedCount: categorized.unverified.length,
      conflictsCount: conflictOutput.conflicts.length,
      confidenceScore: factCheckerOutput.stats.overallConfidence || 85
    };

    log.push("Executive research dossier compiled with citations and limitations.");

    return {
      agentId: "agent_report",
      agentName: "Report Generator",
      status: "COMPLETED",
      dossierTitle: reportData.dossierTitle,
      query: cleanQuery,
      executiveSummary: reportData.executiveSummary,
      keyFindings: reportData.keyFindings,
      categorizedClaims: categorized,
      conflicts: conflictOutput.conflicts,
      sources: researchOutput.sources,
      limitations: reportData.limitations,
      conclusion: reportData.conclusion,
      compiledStats,
      executionLog: log,
      generatedAt: new Date().toISOString()
    };
  }

  // =========================================================================
  // STEP: ALL (Full pipeline in one execution)
  // =========================================================================
  if (step === "all") {
    const researchOutput = await executeLivePipeline("research", cleanQuery, depth, {}, keys);
    const factCheckerOutput = await executeLivePipeline("factchecker", cleanQuery, depth, { researchOutput }, keys);
    const conflictOutput = await executeLivePipeline("conflict", cleanQuery, depth, { factCheckerOutput, researchOutput }, keys);
    const reportOutput = await executeLivePipeline("report", cleanQuery, depth, { researchOutput, factCheckerOutput, conflictOutput }, keys);

    const finalDossier = {
      id: "live_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      isDemo: false,
      demoLabel: "LIVE RESEARCH",
      disclaimer: null,
      title: reportOutput.dossierTitle || cleanQuery,
      query: cleanQuery,
      category: "Live Investigation",
      createdAt: new Date().toISOString(),
      stats: reportOutput.compiledStats,
      researchAgent: researchOutput,
      factCheckerAgent: factCheckerOutput,
      conflictAnalystAgent: conflictOutput,
      reportGeneratorAgent: reportOutput
    };

    return {
      researchAgent: researchOutput,
      factCheckerAgent: factCheckerOutput,
      conflictAnalystAgent: conflictOutput,
      reportGeneratorAgent: reportOutput,
      finalDossier
    };
  }

  throw new Error(`Unsupported execution step: "${step}". Valid steps: "research", "factchecker", "conflict", "report", "all".`);
}

module.exports = {
  executeLivePipeline
};
