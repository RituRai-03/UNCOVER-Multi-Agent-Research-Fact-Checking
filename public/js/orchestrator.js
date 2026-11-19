/**
 * UNCOVER - Multi-Agent Orchestration Engine
 * 
 * Coordinates the sequential execution of:
 * 1. Research Agent
 * 2. Fact-Checker Agent
 * 3. Conflict Analyst Agent
 * 4. Report Generator Agent
 * 
 * Manages structured data handoffs, execution states, error recovery,
 * intermediate inspection checkpoints, and lifecycle subscriptions.
 */

import { ResearchAgent } from './agents/ResearchAgent.js';
import { FactCheckerAgent } from './agents/FactCheckerAgent.js';
import { ConflictAnalystAgent } from './agents/ConflictAnalystAgent.js';
import { ReportGeneratorAgent } from './agents/ReportGeneratorAgent.js';

export const AgentStatus = {
  WAITING: "WAITING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
};

export class MultiAgentOrchestrator {
  constructor(config = {}) {
    this.config = config;

    // Instantiate four independent modular agents
    this.agents = {
      research: new ResearchAgent(config),
      factChecker: new FactCheckerAgent(config),
      conflictAnalyst: new ConflictAnalystAgent(config),
      reportGenerator: new ReportGeneratorAgent(config)
    };

    // State machine
    this.resetState();

    // Event listeners map
    this.listeners = new Map();
  }

  /**
   * Reset orchestrator state for a fresh execution
   */
  resetState() {
    this.state = {
      pipelineStatus: "IDLE", // IDLE | RUNNING | COMPLETED | FAILED
      activeAgentId: null,
      currentStep: 0,
      totalSteps: 4,
      startTime: null,
      endTime: null,
      error: null,
      agentStates: {
        agent_research: { status: AgentStatus.WAITING, task: "Awaiting inquiry input...", input: null, output: null, logs: [] },
        agent_factchecker: { status: AgentStatus.WAITING, task: "Awaiting claims & evidence...", input: null, output: null, logs: [] },
        agent_conflict: { status: AgentStatus.WAITING, task: "Awaiting verification outcomes...", input: null, output: null, logs: [] },
        agent_report: { status: AgentStatus.WAITING, task: "Awaiting cross-analysis synthesis...", input: null, output: null, logs: [] }
      },
      finalDossier: null
    };
  }

  /**
   * Subscribe to orchestration events
   * Events: 'state_change', 'agent_start', 'agent_progress', 'agent_complete', 'pipeline_complete', 'error'
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const filtered = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, filtered);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[Orchestrator] Error in event listener for "${event}":`, err);
      }
    });
  }

  /**
   * Main Execution Pipeline
   * @param {Object} options - { query, depth, isDemo, sampleData }
   * @returns {Promise<Object>} Final research dossier
   */
  async runInvestigation(options = {}) {
    const { query, depth = "standard", isDemo = true, sampleData = null } = options;

    if (!query || !query.trim()) {
      const err = new Error("Inquiry query cannot be empty.");
      this.handleError(err, null);
      throw err;
    }

    // Strict Stage 3 gate: Live APIs (Gemini + Tavily) are scheduled for Stage 4.
    // Live mode must NOT silently execute sample data or fake agent completion.
    if (!isDemo || !sampleData) {
      this.resetState();
      this.state.pipelineStatus = "PAUSED";
      const pendingMessage = "Live web search and reasoning APIs are scheduled for Stage 4 integration. Live mode cannot execute without live APIs.";
      
      Object.keys(this.state.agentStates).forEach(id => {
        this.state.agentStates[id].status = AgentStatus.WAITING;
        this.state.agentStates[id].task = "Live API execution pending Stage 4 deployment";
        this.state.agentStates[id].input = { query, mode: "LIVE", liveApisConfigured: false };
        this.state.agentStates[id].output = null;
        this.state.agentStates[id].logs = [
          `[${new Date().toLocaleTimeString()}] Live API integration pending Stage 4 backend deployment.`,
          `[${new Date().toLocaleTimeString()}] Agent execution paused to preserve empirical integrity.`
        ];
      });

      this.emit("live_pending", { message: pendingMessage, query });
      this.emit("state_change", this.getStateSummary());
      return null;
    }

    this.resetState();
    this.state.pipelineStatus = "RUNNING";
    this.state.startTime = Date.now();
    this.emit("state_change", this.getStateSummary());

    try {
      // =====================================================================
      // STAGE 1: RESEARCH AGENT
      // =====================================================================
      this.state.currentStep = 1;
      const researchInput = { query, depth, sampleData };
      const researchOutput = await this.executeAgentStep(
        "agent_research",
        "Formulating queries, gathering sources & extracting claims",
        researchInput,
        async (progressCallback) => {
          return await this.agents.research.execute(researchInput, progressCallback);
        }
      );

      // =====================================================================
      // STAGE 2: FACT-CHECKER AGENT
      // =====================================================================
      this.state.currentStep = 2;
      const factCheckerInput = { query, researchOutput, sampleData };
      const factCheckerOutput = await this.executeAgentStep(
        "agent_factchecker",
        "Corroborating claims against source evidence and assigning truth statuses",
        factCheckerInput,
        async (progressCallback) => {
          return await this.agents.factChecker.execute(factCheckerInput, progressCallback);
        }
      );

      // =====================================================================
      // STAGE 3: CONFLICT ANALYST AGENT
      // =====================================================================
      this.state.currentStep = 3;
      const conflictInput = { query, factCheckerOutput, researchOutput, sampleData };
      const conflictOutput = await this.executeAgentStep(
        "agent_conflict",
        "Scanning for discrepancies in metrics, methodologies, and context",
        conflictInput,
        async (progressCallback) => {
          return await this.agents.conflictAnalyst.execute(conflictInput, progressCallback);
        }
      );

      // =====================================================================
      // STAGE 4: REPORT GENERATOR AGENT
      // =====================================================================
      this.state.currentStep = 4;
      const reportInput = { query, researchOutput, factCheckerOutput, conflictOutput, sampleData };
      const reportOutput = await this.executeAgentStep(
        "agent_report",
        "Synthesizing executive summary, claim hierarchy, citations & conclusion",
        reportInput,
        async (progressCallback) => {
          return await this.agents.reportGenerator.execute(reportInput, progressCallback);
        }
      );

      // =====================================================================
      // COMPLETE PIPELINE ASSEMBLY
      // =====================================================================
      this.state.endTime = Date.now();
      this.state.pipelineStatus = "COMPLETED";

      const finalRecord = {
        id: sampleData && sampleData.id ? sampleData.id : "rec_" + Date.now(),
        isDemo: isDemo,
        demoLabel: isDemo ? "DEMO DATASET" : "LIVE INVESTIGATION",
        disclaimer: isDemo ? (sampleData ? sampleData.disclaimer : "Generated in Demo Mode using empirical reference benchmarks.") : null,
        title: reportOutput.dossierTitle || query,
        query: query,
        category: sampleData ? sampleData.category : "General Research",
        createdAt: new Date().toISOString(),
        executionTimeMs: this.state.endTime - this.state.startTime,
        stats: reportOutput.compiledStats,
        researchAgent: researchOutput,
        factCheckerAgent: factCheckerOutput,
        conflictAnalystAgent: conflictOutput,
        reportGeneratorAgent: reportOutput
      };

      this.state.finalDossier = finalRecord;

      this.emit("pipeline_complete", finalRecord);
      this.emit("state_change", this.getStateSummary());

      return finalRecord;

    } catch (error) {
      this.handleError(error, this.state.activeAgentId);
      throw error;
    }
  }

  /**
   * Helper to execute a single agent with live state tracking
   */
  async executeAgentStep(agentId, taskDescription, agentInput, executeFn) {
    this.state.activeAgentId = agentId;
    const agentState = this.state.agentStates[agentId];
    agentState.status = AgentStatus.RUNNING;
    agentState.task = taskDescription;
    agentState.input = agentInput;

    this.emit("agent_start", { agentId, task: taskDescription, input: agentInput });
    this.emit("state_change", this.getStateSummary());

    // Progress reporter passed to the agent
    const onProgress = (prog) => {
      if (prog.message) {
        agentState.logs.push(prog.message);
      }
      this.emit("agent_progress", { agentId, ...prog });
      this.emit("state_change", this.getStateSummary());
    };

    try {
      const output = await executeFn(onProgress);

      agentState.status = AgentStatus.COMPLETED;
      agentState.task = `Completed successfully at ${new Date().toLocaleTimeString()}`;
      agentState.output = output;

      this.emit("agent_complete", { agentId, output });
      this.emit("state_change", this.getStateSummary());

      return output;
    } catch (err) {
      agentState.status = AgentStatus.FAILED;
      agentState.task = `Failed: ${err.message}`;
      agentState.error = err.message;
      throw err;
    }
  }

  /**
   * Central error handler
   */
  handleError(error, activeAgentId) {
    this.state.pipelineStatus = "FAILED";
    this.state.error = error.message || "An unexpected error occurred in the multi-agent pipeline.";

    if (activeAgentId && this.state.agentStates[activeAgentId]) {
      this.state.agentStates[activeAgentId].status = AgentStatus.FAILED;
    }

    this.emit("error", {
      message: this.state.error,
      agentId: activeAgentId,
      stack: error.stack
    });
    this.emit("state_change", this.getStateSummary());
  }

  /**
   * Get inspection payload for a specific agent
   */
  getAgentInspection(agentId) {
    const agState = this.state.agentStates[agentId];
    if (!agState) return null;

    return {
      agentId,
      status: agState.status,
      task: agState.task,
      logs: agState.logs,
      input: agState.input,
      output: agState.output
    };
  }

  /**
   * Summary state object for UI updates
   */
  getStateSummary() {
    return {
      pipelineStatus: this.state.pipelineStatus,
      activeAgentId: this.state.activeAgentId,
      currentStep: this.state.currentStep,
      totalSteps: this.state.totalSteps,
      agentStates: { ...this.state.agentStates },
      error: this.state.error
    };
  }
}
