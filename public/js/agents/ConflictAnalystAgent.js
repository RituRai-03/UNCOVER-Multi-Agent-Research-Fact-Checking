/**
 * UNCOVER - Conflict Analyst Agent Module
 * 
 * Responsibilities:
 * 1. Cross-examine claims and findings across diverse source records.
 * 2. Detect discrepancies in dates, definitions, methodologies, context, and operational scope.
 * 3. Distinguish genuine empirical contradictions from technical measurement variations.
 * 4. Detail opposing institutional positions in a structured confrontation matrix.
 * 5. Provide an explanatory diagnostic for why authoritative sources diverge.
 * 6. Return structured conflict records for the Report Generator Agent.
 */

import { callResearchApi } from '../apiClient.js';

export class ConflictAnalystAgent {
  constructor(config = {}) {
    this.agentId = "agent_conflict";
    this.name = "Conflict Analyst";
    this.role = "Discrepancy & Methodology Detection";
    this.config = config;
  }

  /**
   * Execute Conflict Analyst phase
   * @param {Object} input - { query, depth, factCheckerOutput, researchOutput, sampleData }
   * @param {Function} onProgress - Progress event callback
   * @returns {Promise<Object>} Structured conflict output
   */
  async execute(input, onProgress = () => {}) {
    const { query, depth = "standard", factCheckerOutput, researchOutput, sampleData = null } = input;

    if (!factCheckerOutput || !Array.isArray(factCheckerOutput.claims)) {
      throw new Error("[ConflictAnalystAgent] Fact-Checker output is required.");
    }

    const executionLog = [];
    const log = (msg) => {
      executionLog.push(msg);
      onProgress({ step: "CONFLICT_PROGRESS", message: msg });
    };

    log("Scanning claim matrix and source bibliographies for institutional divergence...");

    // =========================================================================
    // 1. DEMO MODE PATH
    // =========================================================================
    if (sampleData) {
      const conflicts = this.identifyConflicts(factCheckerOutput, researchOutput, sampleData, log);
      const consensusRating = this.assessConsensus(conflicts, factCheckerOutput.claims);

      log(`Conflict analysis finalized: ${conflicts.length} structural discrepancies identified. Consensus grade: ${consensusRating}.`);

      return {
        agentId: this.agentId,
        agentName: this.name,
        status: "COMPLETED",
        conflicts,
        totalConflicts: conflicts.length,
        consensusRating,
        executionLog,
        timestamp: new Date().toISOString()
      };
    }

    // =========================================================================
    // 2. LIVE MODE PATH (Firebase Cloud Functions: Gemini AI)
    // =========================================================================
    log("Dispatching verification matrix to Gemini AI for cross-source discrepancy analysis...");

    const result = await callResearchApi("conflict", query, depth, {
      factCheckerOutput,
      researchOutput
    });

    if (result.executionLog && Array.isArray(result.executionLog)) {
      result.executionLog.forEach(l => log(l));
    }

    log(`Live conflict analysis complete: ${result.totalConflicts} discrepancies detected. Consensus rating: ${result.consensusRating}.`);

    return {
      agentId: this.agentId,
      agentName: this.name,
      status: "COMPLETED",
      conflicts: result.conflicts || [],
      totalConflicts: result.totalConflicts || 0,
      consensusRating: result.consensusRating || "HIGH_CONSENSUS",
      executionLog,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Identify conflicts between sources and claims (Demo Mode)
   */
  identifyConflicts(factCheckerOutput, researchOutput, sampleData, log) {
    if (sampleData && sampleData.conflictAnalystAgent && Array.isArray(sampleData.conflictAnalystAgent.conflicts)) {
      return sampleData.conflictAnalystAgent.conflicts.map((conf, idx) => {
        log(`Cataloging Conflict #${idx + 1}: [${conf.topic}] (Severity: ${conf.severity})`);
        return {
          id: conf.id || `conf_${idx + 1}`,
          topic: conf.topic,
          severity: conf.severity || "MODERATE",
          description: conf.description,
          sourceA: conf.sourceA,
          sourceB: conf.sourceB,
          explanation: conf.explanation
        };
      });
    }

    throw new Error("[ConflictAnalystAgent] Live conflict analysis requires backend integration.");
  }

  /**
   * Determine overall consensus rating (Demo Mode)
   */
  assessConsensus(conflicts, claims) {
    if (conflicts.length === 0) return "HIGH_CONSENSUS";
    const hasHighSeverity = conflicts.some(c => c.severity === "HIGH");
    if (hasHighSeverity || conflicts.length >= 2) return "DEEPLY_CONTESTED";
    return "MODERATE_DISPUTES";
  }
}
