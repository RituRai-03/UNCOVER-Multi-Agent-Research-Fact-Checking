/**
 * UNCOVER - Global Configuration & Constants
 * Multi-Agent Research & Fact-Checking Platform
 * PromptWars X Agent X 2.0 | Problem Statement PS03
 */

export const APP_CONFIG = {
  name: "UNCOVER",
  tagline: "Go Beyond Information. Uncover the Truth.",
  version: "1.0.0",
  hackathon: "PromptWars X Agent X 2.0",
  problemStatement: "PS03",
  
  // Strict Brand Colors (60% Brown, 30% Cream, 10% Baby Blue)
  colors: {
    brownDark: "#38251E",
    brownPrimary: "#654332",
    brownSecondary: "#896750",
    creamBase: "#F5EBDD",
    creamIvory: "#FFFDF8",
    blueBaby: "#A9D5E8",
    bluePale: "#DCECF2"
  },

  // Environment Detection
  get isLocal() {
    if (typeof window === "undefined") return true;
    const { hostname, protocol } = window.location;
    return hostname === "localhost" || hostname === "127.0.0.1" || protocol === "file:";
  },

  // Backend API URL (Smart Dynamic Resolver for Local Emulator & Production)
  get apiBaseUrl() {
    if (typeof window === "undefined") {
      return "http://127.0.0.1:5001/uncover-multi-agent/us-central1/api";
    }

    // 1. Local development (Live Server on 5500, npm start on 3000, etc.)
    // Always use 127.0.0.1 to guarantee IPv4 connection to the Functions emulator on Windows
    if (this.isLocal) {
      return "http://127.0.0.1:5001/uncover-multi-agent/us-central1/api";
    }

    // 2. Production (Vercel, custom domain): use clean relative path '/api' (proxied to Render backend)
    return "/api";
  },

  // LocalStorage Keys
  storageKeys: {
    history: "uncover_research_history_v1",
    activeResearch: "uncover_active_research_v1",
    settings: "uncover_user_settings_v1",
    theme: "uncover_theme_preference"
  },

  // Status Class Mappings
  statusTypes: {
    VERIFIED: {
      label: "Verified",
      class: "badge-status-verified",
      description: "Corroborated by high-authority primary and secondary evidence."
    },
    PARTIALLY_VERIFIED: {
      label: "Partially Verified",
      class: "badge-status-partially",
      description: "General premise supported, but key caveats, figures, or conditions differ."
    },
    DISPUTED: {
      label: "Disputed",
      class: "badge-status-disputed",
      description: "Direct contradictions or disputed methodology detected across reliable sources."
    },
    UNVERIFIED: {
      label: "Unverified",
      class: "badge-status-unverified",
      description: "Insufficient empirical evidence or zero corroborating authoritative sources found."
    }
  },

  // 4 Core Agent Profiles
  agents: {
    RESEARCH: {
      id: "agent_research",
      name: "Research Agent",
      role: "Information Discovery & Source Gathering",
      icon: "search",
      description: "Deconstructs inquiries into targeted queries, queries real web sources via Tavily, and parses core factual claims with full provenance."
    },
    FACT_CHECKER: {
      id: "agent_factchecker",
      name: "Fact-Checker Agent",
      role: "Claim Corroboration & Evidence Cross-Referencing",
      icon: "check-circle",
      description: "Scrutinizes extracted claims against collected source evidence, isolates supporting vs contradicting text, and assigns strict truth statuses."
    },
    CONFLICT_ANALYST: {
      id: "agent_conflict",
      name: "Conflict Analyst",
      role: "Discrepancy & Methodology Detection",
      icon: "git-diff",
      description: "Pinpoints discrepancies, conflicting statistics, divergent timeframes, and ideological or commercial biases across sources."
    },
    REPORT_GENERATOR: {
      id: "agent_report",
      name: "Report Generator",
      role: "Synthesis & Editorial Assembly",
      icon: "file-text",
      description: "Synthesizes multi-agent outputs into an executive-grade, fully cited intelligence dossier equipped with PDF, copy, and print exports."
    }
  }
};
