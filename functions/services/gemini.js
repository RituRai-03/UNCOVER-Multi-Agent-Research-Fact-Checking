/**
 * UNCOVER - Google Gemini API Integration
 * Structured reasoning, claim verification, conflict analysis & report synthesis
 */

const config = require("../config");

const DEFAULT_MODEL = config.ai.model;

/**
 * Call Gemini API with structured JSON output enforcement
 */
async function callGemini(userPrompt, systemInstruction, options = {}) {
  const { 
    apiKey, 
    model = DEFAULT_MODEL, 
    temperature = config.ai.temperature || 0.2 
  } = options;

  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    const error = new Error("Gemini API key is missing or not configured in Firebase Cloud Functions.");
    error.code = "MISSING_GEMINI_KEY";
    throw error;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }]
      }
    ],
    generationConfig: {
      temperature,
      responseMimeType: "application/json"
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }

      const errMessage = errorData.error ? errorData.error.message : response.statusText;
      const err = new Error(`Gemini API error (${response.status}): ${errMessage}`);
      err.status = response.status;
      if (response.status === 400 && errMessage.includes("API key not valid")) {
        err.code = "INVALID_GEMINI_KEY";
      } else if (response.status === 429) {
        err.code = "GEMINI_RATE_LIMITED";
      }
      throw err;
    }

    const data = await response.json();

    // Check safety refusals or empty candidate
    const candidate = data.candidates && data.candidates[0];
    if (!candidate) {
      const finishReason = data.promptFeedback ? JSON.stringify(data.promptFeedback) : "No candidate returned";
      throw new Error(`Gemini returned empty candidate. Feedback: ${finishReason}`);
    }

    if (candidate.finishReason === "SAFETY") {
      throw new Error("Gemini request was blocked by safety filters.");
    }

    const rawText = candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;
    if (!rawText) {
      throw new Error("Gemini returned empty content text.");
    }

    // Parse JSON
    try {
      const cleaned = rawText.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[Gemini] Failed to parse JSON response:", rawText);
      throw new Error(`Invalid JSON returned by Gemini: ${parseErr.message}`);
    }

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      const timeoutErr = new Error("Gemini API request timed out after 35 seconds.");
      timeoutErr.code = "GEMINI_TIMEOUT";
      throw timeoutErr;
    }
    throw error;
  }
}

/**
 * AGENT 1 HELPER: Extract testable factual claims from retrieved sources
 */
async function extractClaimsWithGemini(query, sources, options) {
  const systemInstruction = `You are the Research Agent for UNCOVER, an evidence-based fact-checking system.
Your job is to read real web sources and extract discrete, testable empirical claims regarding the user's research question.
Do NOT invent claims that are not mentioned in the sources.
Do NOT assume facts not supported by the retrieved text.
Return ONLY valid JSON matching this schema:
{
  "claims": [
    {
      "id": "clm_1",
      "statement": "Clear factual assertion extracted from text",
      "sourceReferences": ["src_1", "src_2"]
    }
  ]
}`;

  const sourcesContext = sources.map(s => 
    `Source ID: ${s.id}\nTitle: ${s.title}\nPublisher: ${s.publisher}\nSnippet/Content: ${s.snippet}\nURL: ${s.url}`
  ).join("\n---\n");

  const prompt = `Research Question: "${query}"

Retrieved Web Evidence:
${sourcesContext}

Extract 3 to 6 distinct, testable factual claims from the evidence above.`;

  const parsed = await callGemini(prompt, systemInstruction, options);
  const claims = Array.isArray(parsed.claims) ? parsed.claims : [];

  return claims.map((c, i) => ({
    id: c.id || `clm_${i + 1}`,
    statement: (c.statement && c.statement.trim()) || "Unspecified assertion.",
    sourceReferences: Array.isArray(c.sourceReferences) ? c.sourceReferences : []
  }));
}

/**
 * AGENT 2 HELPER: Rigorously verify claims against collected sources
 */
async function verifyClaimsWithGemini(query, claims, sources, options) {
  const systemInstruction = `You are the Fact-Checker Agent for UNCOVER.
Evaluate each claim STRICTLY against the provided source evidence.
CRITICAL RULES:
1. Assign ONLY one of these four exact statuses:
   - "VERIFIED": Directly confirmed by credible source evidence with concordant figures/context.
   - "PARTIALLY_VERIFIED": General premise supported, but key caveats, metrics, or nuances diverge.
   - "DISPUTED": Direct contradiction, refuted claim, or major analytical conflict found.
   - "UNVERIFIED": Insufficient or zero direct corroboration in the collected sources.
2. Do NOT verify a claim from your own internal memory if the provided sources do not support it.
3. For every claim, extract exact supporting or refuting quotes from the snippets where available.
4. Provide a clear, evidence-based rationale.
5. Provide a confidenceScore between 0.50 and 0.99.

Return ONLY valid JSON matching this schema:
{
  "claims": [
    {
      "id": "clm_1",
      "statement": "...",
      "status": "VERIFIED" | "PARTIALLY_VERIFIED" | "DISPUTED" | "UNVERIFIED",
      "confidenceScore": 0.95,
      "rationale": "Why this status was assigned based strictly on the evidence.",
      "supportingSources": ["src_1"],
      "contradictingSources": [],
      "evidenceQuotes": [
        { "sourceId": "src_1", "quote": "exact quote from snippet" }
      ]
    }
  ]
}`;

  const sourcesText = sources.map(s => `[${s.id}] (${s.publisher}): "${s.snippet}"`).join("\n");
  const claimsText = claims.map(c => `Claim ID: ${c.id}\nStatement: ${c.statement}`).join("\n\n");

  const prompt = `Research Question: "${query}"

Evidence Corpus:
${sourcesText}

Extracted Claims To Verify:
${claimsText}`;

  const parsed = await callGemini(prompt, systemInstruction, options);
  const rawClaims = Array.isArray(parsed.claims) ? parsed.claims : [];

  const allowedStatuses = ["VERIFIED", "PARTIALLY_VERIFIED", "DISPUTED", "UNVERIFIED"];

  return rawClaims.map((rc, idx) => {
    let status = (rc.status && rc.status.toUpperCase().replace(/\s+/g, "_")) || "UNVERIFIED";
    if (!allowedStatuses.includes(status)) {
      status = "UNVERIFIED";
    }

    const conf = typeof rc.confidenceScore === "number" ? Math.min(Math.max(rc.confidenceScore, 0.4), 0.99) : 0.85;

    return {
      id: rc.id || `clm_${idx + 1}`,
      statement: rc.statement || claims[idx]?.statement || "Unspecified claim",
      status,
      confidenceScore: parseFloat(conf.toFixed(2)),
      rationale: rc.rationale || "Evaluated against retrieved source snippets.",
      supportingSources: Array.isArray(rc.supportingSources) ? rc.supportingSources : [],
      contradictingSources: Array.isArray(rc.contradictingSources) ? rc.contradictingSources : [],
      evidenceQuotes: Array.isArray(rc.evidenceQuotes) ? rc.evidenceQuotes : []
    };
  });
}

/**
 * AGENT 3 HELPER: Detect and explain cross-source conflicts
 */
async function analyzeConflictsWithGemini(query, verifiedClaims, sources, options) {
  const systemInstruction = `You are the Conflict Analyst Agent for UNCOVER.
Compare the claims and source evidence to identify genuine disagreements, differing statistics, chronological mismatches, scope variations, or methodology clashes.
CRITICAL: Do NOT invent conflicts if sources agree. If no meaningful conflict exists, return an empty array of conflicts.
Return ONLY valid JSON:
{
  "conflicts": [
    {
      "id": "conf_1",
      "topic": "Concise topic of disagreement",
      "severity": "LOW" | "MODERATE" | "HIGH",
      "description": "What specifically disagrees between sources.",
      "sourceA": { "sourceId": "src_1", "name": "Publisher/Source A", "position": "Position A" },
      "sourceB": { "sourceId": "src_2", "name": "Publisher/Source B", "position": "Position B" },
      "explanation": "Why they diverge (e.g. baseline dates, definitions, measurement units, methodology)."
    }
  ],
  "consensusRating": "HIGH_CONSENSUS" | "MODERATE_DISPUTES" | "DEEPLY_CONTESTED"
}`;

  const sourcesSummary = sources.map(s => `[${s.id}] ${s.publisher}: "${s.snippet}"`).join("\n");
  const claimsSummary = verifiedClaims.map(c => `[${c.status}] ${c.statement} (Rationale: ${c.rationale})`).join("\n");

  const prompt = `Research Question: "${query}"

Evidence Sources:
${sourcesSummary}

Verified Claims:
${claimsSummary}

Identify any genuine empirical discrepancies or conflicting assertions between sources.`;

  const parsed = await callGemini(prompt, systemInstruction, options);
  const conflicts = Array.isArray(parsed.conflicts) ? parsed.conflicts : [];

  const validSeverities = ["LOW", "MODERATE", "HIGH"];

  const normalizedConflicts = conflicts.map((conf, idx) => ({
    id: conf.id || `conf_${idx + 1}`,
    topic: conf.topic || "Discrepancy in Evidence Reporting",
    severity: validSeverities.includes(conf.severity) ? conf.severity : "MODERATE",
    description: conf.description || "Divergence noted across source metrics.",
    sourceA: conf.sourceA || { sourceId: "src_1", name: "Source A", position: "Observation A" },
    sourceB: conf.sourceB || { sourceId: "src_2", name: "Source B", position: "Observation B" },
    explanation: conf.explanation || "Differences attributable to varying parameters or reporting baselines."
  }));

  const consensusRating = parsed.consensusRating || (normalizedConflicts.length > 0 ? "MODERATE_DISPUTES" : "HIGH_CONSENSUS");

  return {
    conflicts: normalizedConflicts,
    consensusRating
  };
}

/**
 * AGENT 4 HELPER: Synthesize final executive dossier
 */
async function synthesizeReportWithGemini(query, researchData, factCheckerData, conflictData, options) {
  const systemInstruction = `You are the Report Generator Agent for UNCOVER.
Synthesize the verified evidence, claim statuses, conflict analysis, and sources into an executive research dossier.
CRITICAL RULES:
1. Do NOT fabricate citations or facts not in the evidence.
2. Distinguish verified facts from disputed claims.
3. Formulate an objective, evidence-first summary and clear conclusion.
4. List empirical limitations (e.g. search scope, reliance on snippets, dates).

Return ONLY valid JSON matching this schema:
{
  "dossierTitle": "Concise Executive Dossier Title",
  "executiveSummary": "Comprehensive summary paragraph grounded in verified claims.",
  "keyFindings": [
    "Key takeaway 1 with status context",
    "Key takeaway 2"
  ],
  "limitations": [
    "Limitation 1 regarding evidence availability or snippet depth",
    "Limitation 2"
  ],
  "conclusion": "Balanced concluding synthesis."
}`;

  const prompt = `Research Question: "${query}"

Indexed Sources (${researchData.sources.length} sources):
${researchData.sources.map(s => `- ${s.citationKey} ${s.title} (${s.publisher})`).join("\n")}

Claim Verification Results:
${factCheckerData.claims.map(c => `- [${c.status}] ${c.statement} (Certainty: ${(c.confidenceScore * 100).toFixed(0)}%)`).join("\n")}

Conflicts Identified (${(conflictData.conflicts || []).length} conflicts):
${(conflictData.conflicts || []).map(cf => `- [${cf.severity}] ${cf.topic}: ${cf.explanation}`).join("\n")}

Synthesize the final research report.`;

  const parsed = await callGemini(prompt, systemInstruction, options);

  return {
    dossierTitle: parsed.dossierTitle || `Research Dossier: ${query}`,
    executiveSummary: parsed.executiveSummary || "Dossier synthesized from real-time web grounding and verified claims.",
    keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
    limitations: Array.isArray(parsed.limitations) ? parsed.limitations : ["Relies on indexed public web results and available snippets."],
    conclusion: parsed.conclusion || "Evidence-based synthesis complete."
  };
}

module.exports = {
  callGemini,
  extractClaimsWithGemini,
  verifyClaimsWithGemini,
  analyzeConflictsWithGemini,
  synthesizeReportWithGemini
};
