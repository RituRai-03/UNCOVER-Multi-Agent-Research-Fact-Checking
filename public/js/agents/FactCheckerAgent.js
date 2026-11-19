/**
 * UNCOVER - Fact-Checker Agent Module
 * 
 * Responsibilities:
 * 1. Rigorously evaluate individual claims against the gathered evidence corpus.
 * 2. Cross-corroborate against primary institutional and peer-reviewed sources.
 * 3. Identify explicit supporting and contradicting evidence quotations.
 * 4. Assign one of 4 strict statuses:
 *    - VERIFIED: Directly confirmed by concordant reputable sources.
 *    - PARTIALLY VERIFIED: Core premise supported, but key caveats or figures diverge.
 *    - DISPUTED: Contradicted by authoritative evidence or severe methodological discord.
 *    - UNVERIFIED: Insufficient or zero empirical corroboration found.
 * 5. Provide an evidence-dependent rationale for every claim decision.
 * 6. Return structured verification output for the Conflict Analyst Agent.
 */

import { callResearchApi } from '../apiClient.js';

export class FactCheckerAgent {
  constructor(config = {}) {
    this.agentId = "agent_factchecker";
    this.name = "Fact-Checker Agent";
    this.role = "Claim Verification & Evidence Corroboration";
    this.config = config;
  }

  /**
   * Execute Fact-Checker Agent phase
   * @param {Object} input - { query, depth, researchOutput, sampleData }
   * @param {Function} onProgress - Progress event callback
   * @returns {Promise<Object>} Structured verification output
   */
  async execute(input, onProgress = () => {}) {
    const { query, depth = "standard", researchOutput, sampleData = null } = input;

    if (!researchOutput || !Array.isArray(researchOutput.extractedClaims)) {
      throw new Error("[FactCheckerAgent] Research Agent output with extracted claims is required.");
    }

    const executionLog = [];
    const log = (msg) => {
      executionLog.push(msg);
      onProgress({ step: "FACTCHECK_PROGRESS", message: msg });
    };

    const claims = researchOutput.extractedClaims;
    const sources = researchOutput.sources || [];

    log(`Beginning verification of ${claims.length} claims against ${sources.length} sources...`);

    // =========================================================================
    // 1. DEMO MODE PATH
    // =========================================================================
    if (sampleData) {
      const verifiedClaims = [];

      for (let i = 0; i < claims.length; i++) {
        const claim = claims[i];
        log(`Scrutinizing Claim #${i + 1}: "${claim.statement.substring(0, 60)}..."`);

        const evaluatedClaim = this.evaluateClaimAgainstEvidence(claim, sources, sampleData);
        verifiedClaims.push(evaluatedClaim);

        log(`Claim #${i + 1} status assigned: [${evaluatedClaim.status}] (Certainty: ${(evaluatedClaim.confidenceScore * 100).toFixed(0)}%)`);
      }

      const stats = this.calculateVerificationStats(verifiedClaims);
      log(`Verification completed: ${stats.verified} Verified, ${stats.partiallyVerified} Partially Verified, ${stats.disputed} Disputed, ${stats.unverified} Unverified.`);

      return {
        agentId: this.agentId,
        agentName: this.name,
        status: "COMPLETED",
        claims: verifiedClaims,
        stats,
        executionLog,
        timestamp: new Date().toISOString()
      };
    }

    // =========================================================================
    // 2. LIVE MODE PATH (Firebase Cloud Functions: Gemini AI)
    // =========================================================================
    log("Dispatching claims to Gemini AI for evidence-anchored verification...");

    const result = await callResearchApi("factchecker", query, depth, {
      researchOutput
    });

    if (result.executionLog && Array.isArray(result.executionLog)) {
      result.executionLog.forEach(l => log(l));
    }

    log(`Live verification complete: ${result.stats.verified} Verified, ${result.stats.partiallyVerified} Partially Verified, ${result.stats.disputed} Disputed, ${result.stats.unverified} Unverified.`);

    return {
      agentId: this.agentId,
      agentName: this.name,
      status: "COMPLETED",
      claims: result.claims,
      stats: result.stats,
      executionLog,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Evaluate a single claim against available source evidence (Demo Mode)
   */
  evaluateClaimAgainstEvidence(claim, sources, sampleData) {
    if (sampleData && sampleData.factCheckerAgent && Array.isArray(sampleData.factCheckerAgent.claims)) {
      const matched = sampleData.factCheckerAgent.claims.find(c => 
        c.id === claim.id || 
        c.statement.toLowerCase().trim() === claim.statement.toLowerCase().trim()
      );

      if (matched) {
        return {
          id: matched.id || claim.id,
          statement: matched.statement,
          status: matched.status,
          confidenceScore: matched.confidenceScore || 0.90,
          rationale: matched.rationale || "Verified against indexed institutional evidence.",
          supportingSources: matched.supportingSources || [],
          contradictingSources: matched.contradictingSources || [],
          evidenceQuotes: matched.evidenceQuotes || []
        };
      }
    }

    throw new Error("[FactCheckerAgent] Live claim verification requires backend integration.");
  }

  /**
   * Aggregate statistics (Demo Mode)
   */
  calculateVerificationStats(claims) {
    let verified = 0;
    let partiallyVerified = 0;
    let disputed = 0;
    let unverified = 0;
    let totalConfidence = 0;

    claims.forEach(c => {
      totalConfidence += c.confidenceScore || 0.8;
      switch (c.status) {
        case "VERIFIED": verified++; break;
        case "PARTIALLY_VERIFIED": partiallyVerified++; break;
        case "DISPUTED": disputed++; break;
        default: unverified++; break;
      }
    });

    const total = claims.length || 1;
    const overallConfidence = Math.round((totalConfidence / total) * 100);

    return {
      total: claims.length,
      verified,
      partiallyVerified,
      disputed,
      unverified,
      overallConfidence
    };
  }
}
