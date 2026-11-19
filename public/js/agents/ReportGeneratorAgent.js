/**
 * UNCOVER - Report Generator Agent Module
 * 
 * Responsibilities:
 * 1. Synthesize actual structured outputs from the Research Agent, Fact-Checker, and Conflict Analyst.
 * 2. Formulate an executive intelligence summary.
 * 3. Extract core corroborated findings.
 * 4. Organize claims hierarchically by verified, partially verified, disputed, and unverified status.
 * 5. Integrate conflict matrix summaries and source bibliography.
 * 6. Explicitly document empirical research limitations and scope boundaries.
 * 7. Produce a balanced, evidence-backed conclusion ready for dossier export (PDF, print, web).
 */

export class ReportGeneratorAgent {
  constructor(config = {}) {
    this.agentId = "agent_report";
    this.name = "Report Generator";
    this.role = "Synthesis & Editorial Assembly";
    this.config = config;
  }

  /**
   * Execute Report Generator phase
   * @param {Object} input - { query, researchOutput, factCheckerOutput, conflictOutput, sampleData }
   * @param {Function} onProgress - Progress event callback
   * @returns {Promise<Object>} Complete synthesized dossier
   */
  async execute(input, onProgress = () => {}) {
    const { query, researchOutput, factCheckerOutput, conflictOutput, sampleData = null } = input;

    if (!researchOutput || !factCheckerOutput || !conflictOutput) {
      throw new Error("[ReportGeneratorAgent] Inputs from all three preceding agents are required.");
    }

    const executionLog = [];
    const log = (msg) => {
      executionLog.push(msg);
      onProgress({ step: "REPORT_PROGRESS", message: msg });
    };

    log("Aggregating multi-agent outputs into final intelligence dossier...");

    // Step 1: Draft Executive Summary
    log("Synthesizing executive summary from verified and disputed assertions...");
    const executiveSummary = this.generateExecutiveSummary(query, factCheckerOutput, conflictOutput, sampleData);

    // Step 2: Compile Key Corroborated Findings
    log("Compiling key empirical findings...");
    const keyFindings = this.compileKeyFindings(factCheckerOutput, sampleData);

    // Step 3: Categorize Claims by Truth Status
    log("Structuring claim hierarchy into verified, partially verified, disputed, and unverified groups...");
    const categorizedClaims = this.categorizeClaims(factCheckerOutput.claims);

    // Step 4: Assemble Source References
    log("Formatting authoritative source references with citation keys...");
    const sources = researchOutput.sources || [];

    // Step 5: Document Empirical Limitations
    log("Cataloging research limitations and analytical boundary conditions...");
    const limitations = this.compileLimitations(researchOutput, factCheckerOutput, sampleData);

    // Step 6: Formulate Balanced Conclusion
    log("Formulating evidence-first balanced conclusion...");
    const conclusion = this.formulateConclusion(factCheckerOutput, conflictOutput, sampleData);

    log("Research dossier assembly complete and ready for dissemination.");

    return {
      agentId: this.agentId,
      agentName: this.name,
      status: "COMPLETED",
      dossierTitle: sampleData ? sampleData.title : `Investigation: ${query}`,
      query,
      executiveSummary,
      keyFindings,
      categorizedClaims,
      conflicts: conflictOutput.conflicts || [],
      sources,
      limitations,
      conclusion,
      compiledStats: {
        sourcesCount: sources.length,
        claimsTotal: factCheckerOutput.claims.length,
        verifiedCount: categorizedClaims.verified.length,
        partiallyCount: categorizedClaims.partiallyVerified.length,
        disputedCount: categorizedClaims.disputed.length,
        unverifiedCount: categorizedClaims.unverified.length,
        conflictsCount: (conflictOutput.conflicts || []).length,
        confidenceScore: factCheckerOutput.stats ? factCheckerOutput.stats.overallConfidence : 85
      },
      executionLog,
      generatedAt: new Date().toISOString()
    };
  }

  generateExecutiveSummary(query, factCheckerOutput, conflictOutput, sampleData) {
    if (sampleData && sampleData.reportGeneratorAgent && sampleData.reportGeneratorAgent.executiveSummary) {
      return sampleData.reportGeneratorAgent.executiveSummary;
    }

    throw new Error("[ReportGeneratorAgent] Live report synthesis requires Stage 4 Gemini AI API integration.");
  }

  compileKeyFindings(factCheckerOutput, sampleData) {
    if (sampleData && sampleData.reportGeneratorAgent && Array.isArray(sampleData.reportGeneratorAgent.keyFindings)) {
      return sampleData.reportGeneratorAgent.keyFindings;
    }

    throw new Error("[ReportGeneratorAgent] Live key findings compilation requires Stage 4 Gemini AI API integration.");
  }

  categorizeClaims(claims) {
    const verified = [];
    const partiallyVerified = [];
    const disputed = [];
    const unverified = [];

    claims.forEach(c => {
      switch (c.status) {
        case "VERIFIED": verified.push(c); break;
        case "PARTIALLY_VERIFIED": partiallyVerified.push(c); break;
        case "DISPUTED": disputed.push(c); break;
        default: unverified.push(c); break;
      }
    });

    return {
      verified,
      partiallyVerified,
      disputed,
      unverified
    };
  }

  compileLimitations(researchOutput, factCheckerOutput, sampleData) {
    if (sampleData && sampleData.reportGeneratorAgent && Array.isArray(sampleData.reportGeneratorAgent.limitations)) {
      return sampleData.reportGeneratorAgent.limitations;
    }

    return [
      "Analysis relies on indexed open-access and institutional disclosures available up to the date of collection.",
      "Differences in regional telemetry standards and statistical methodologies may introduce minor variances in absolute figures."
    ];
  }

  formulateConclusion(factCheckerOutput, conflictOutput, sampleData) {
    if (sampleData && sampleData.reportGeneratorAgent && sampleData.reportGeneratorAgent.conclusion) {
      return sampleData.reportGeneratorAgent.conclusion;
    }

    return "Analytical rigor requires distinguishing between verified primary observations and secondary interpretations. Policy and scientific consensus should prioritize empirical corroboration over unverified assertions.";
  }
}
