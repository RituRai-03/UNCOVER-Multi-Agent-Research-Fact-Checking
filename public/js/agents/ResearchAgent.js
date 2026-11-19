/**
 * UNCOVER - Research Agent Module
 * 
 * Responsibilities:
 * 1. Understand and semantically decompose the research inquiry.
 * 2. Formulate precise Boolean and multi-angle search queries.
 * 3. Ingest and organize source evidence supplied to it (Tavily search in Live mode).
 * 4. Extract atomic, testable factual claims with provenance metadata (Gemini in Live mode).
 * 5. Return structured, serializable findings for the Fact-Checker Agent.
 */

import { callResearchApi } from '../apiClient.js';

export class ResearchAgent {
  constructor(config = {}) {
    this.agentId = "agent_research";
    this.name = "Research Agent";
    this.role = "Information Discovery & Claim Extraction";
    this.config = config;
  }

  /**
   * Execute Research Agent phase
   * @param {Object} input - { query, depth, sampleData }
   * @param {Function} onProgress - Progress event callback (step, message)
   * @returns {Promise<Object>} Structured research output
   */
  async execute(input, onProgress = () => { }) {
    const { query, depth = "standard", sampleData = null } = input;

    if (!query || typeof query !== "string" || !query.trim()) {
      throw new Error("[ResearchAgent] Valid research query string is required.");
    }

    const executionLog = [];
    const log = (msg) => {
      executionLog.push(msg);
      onProgress({ step: "RESEARCH_PROGRESS", message: msg });
    };

    log(`Inquiry received: "${query.trim()}"`);

    // =========================================================================
    // 1. DEMO MODE PATH
    // =========================================================================
    if (sampleData) {
      log("Deconstructing inquiry into semantic angles and factual sub-premises...");
      const deconstructedAspects = this.deconstructInquiry(query);

      log(`Generating targeted search queries (depth: ${depth})...`);
      const generatedQueries = this.generateSearchQueries(query, deconstructedAspects, depth);
      log(`Formulated ${generatedQueries.length} search queries across primary institutional registries.`);

      log("Ingesting and normalizing source evidence from reference corpus...");
      const sources = this.extractSources(query, sampleData);
      log(`Aggregated ${sources.length} authoritative source records with citation keys.`);

      log("Extracting atomic factual claims with provenance anchors...");
      const extractedClaims = this.extractClaims(query, sources, sampleData);
      log(`Extracted ${extractedClaims.length} distinct empirical claims for cross-examination.`);

      return {
        agentId: this.agentId,
        agentName: this.name,
        status: "COMPLETED",
        inputQuery: query,
        depthLevel: depth,
        deconstructedAspects,
        generatedQueries,
        sources,
        extractedClaims,
        executionLog,
        timestamp: new Date().toISOString()
      };
    }

    // =========================================================================
    // 2. LIVE RESEARCH MODE (Firebase Cloud Functions: Tavily + Gemini)
    // =========================================================================
    log("Connecting to Firebase Cloud Functions backend...");
    log(`Executing live Tavily web search (depth: ${depth})...`);

    const result = await callResearchApi("research", query, depth, {});

    if (result.executionLog && Array.isArray(result.executionLog)) {
      result.executionLog.forEach(l => log(l));
    }

    log(`Live research grounded: ${result.sources.length} sources indexed, ${result.extractedClaims.length} claims extracted.`);

    return {
      agentId: this.agentId,
      agentName: this.name,
      status: "COMPLETED",
      inputQuery: query,
      depthLevel: depth,
      generatedQueries: result.generatedQueries || [query],
      sources: result.sources || [],
      extractedClaims: result.extractedClaims || [],
      executionLog,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Deconstruct inquiry into structural inquiry branches (Demo Mode)
   */
  deconstructInquiry(query) {
    const lower = query.toLowerCase();
    const aspects = [];

    if (lower.includes("surpass") || lower.includes("exceed") || lower.includes("milestone") || lower.includes("terawatt")) {
      aspects.push({ aspect: "Quantitative Threshold Verification", focus: "Absolute measurement and milestone confirmation" });
    }
    if (lower.includes("estimate") || lower.includes("conflict") || lower.includes("dispute") || lower.includes("discrepancy")) {
      aspects.push({ aspect: "Inter-Agency Discrepancy", focus: "Conflicting estimates across analytical methodologies" });
    }
    if (lower.includes("china") || lower.includes("global") || lower.includes("manufacturer")) {
      aspects.push({ aspect: "Geographic & Industrial Distribution", focus: "Supply-chain concentration and regional share" });
    }

    if (aspects.length === 0) {
      aspects.push(
        { aspect: "Empirical Grounding", focus: "Peer-reviewed literature and baseline verification" },
        { aspect: "Methodological Divergence", focus: "Contrasting definitions across institutional frameworks" }
      );
    }

    return aspects;
  }

  /**
   * Formulate search query strings (Demo Mode)
   */
  generateSearchQueries(query, aspects, depth) {
    const cleaned = query.replace(/[?.,!"]/g, "").trim();
    const baseQueries = [
      `${cleaned} official statistics`,
      `${cleaned} peer reviewed study methodology`,
      `${cleaned} conflicting estimates`
    ];

    if (depth === "deep") {
      baseQueries.push(
        `${cleaned} counter evidence limitations`,
        `${cleaned} historical dataset comparison`
      );
    }

    return baseQueries;
  }

  /**
   * Ingest and normalize source evidence (Demo Mode)
   */
  extractSources(query, sampleData) {
    if (sampleData && sampleData.researchAgent && Array.isArray(sampleData.researchAgent.sources)) {
      return sampleData.researchAgent.sources.map((src, index) => ({
        id: src.id || `src_${index + 1}`,
        title: src.title || "Untitled Source",
        url: src.url || "https://example.org/source",
        publisher: src.publisher || "Independent Institution",
        publishDate: src.publishDate || "2024-01-01",
        snippet: src.snippet || "",
        authorityScore: src.authorityScore || 0.90,
        citationKey: src.citationKey || `[${index + 1}]`
      }));
    }

    throw new Error("[ResearchAgent] Live web search requires backend integration.");
  }

  /**
   * Extract atomic testable claims (Demo Mode)
   */
  extractClaims(query, sources, sampleData) {
    if (sampleData && sampleData.factCheckerAgent && Array.isArray(sampleData.factCheckerAgent.claims)) {
      return sampleData.factCheckerAgent.claims.map((clm, index) => ({
        id: clm.id || `clm_${index + 1}`,
        statement: clm.statement,
        sourceReferences: clm.supportingSources || []
      }));
    }

    throw new Error("[ResearchAgent] Live claim extraction requires backend integration.");
  }
}
