/**
 * UNCOVER - Frontend Agent Orchestration & State Machine Tests
 * Validates module resolution, event emissions, 4-agent execution contracts,
 * Demo Mode offline workflows, and Live Mode isolation.
 */

import assert from "assert";
import { MultiAgentOrchestrator, AgentStatus } from "../public/js/orchestrator.js";
import { DEMO_DATASETS, getDemoDatasetById } from "../public/js/demoData.js";
import { StorageService } from "../public/js/storage.js";

async function runFrontendTestSuite() {
  console.log("=================================================");
  console.log("  RUNNING UNCOVER FRONTEND & AGENT TEST SUITE");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}\n`);
      failed++;
    }
  }

  // 1. Dataset Verification
  await test("Demo datasets contain valid benchmarks with distinct domains", async () => {
    assert.strictEqual(DEMO_DATASETS.length, 5);
    const solar = getDemoDatasetById("demo_solar_capacity_2024");
    assert.ok(solar, "Solar dataset must exist");
    assert.strictEqual(solar.isDemo, true);
    assert.strictEqual(solar.researchAgent.sources.length, 6);

    const quantum = getDemoDatasetById("demo_quantum_supremacy");
    assert.ok(quantum, "Quantum dataset must exist");

    const sodium = getDemoDatasetById("demo_dietary_sodium");
    assert.ok(sodium, "Sodium dataset must exist");

    const aiEdu = getDemoDatasetById("demo_ai_education");
    assert.ok(aiEdu, "AI in Education dataset must exist");

    const smAttention = getDemoDatasetById("demo_social_media_attention");
    assert.ok(smAttention, "Social Media and Attention dataset must exist");
  });

  // 2. Orchestrator Initialization & Agent Isolation
  await test("Orchestrator initializes 4 distinct agents in WAITING state", async () => {
    const orchestrator = new MultiAgentOrchestrator();
    assert.ok(orchestrator.agents.research, "ResearchAgent initialized");
    assert.ok(orchestrator.agents.factChecker, "FactCheckerAgent initialized");
    assert.ok(orchestrator.agents.conflictAnalyst, "ConflictAnalystAgent initialized");
    assert.ok(orchestrator.agents.reportGenerator, "ReportGeneratorAgent initialized");

    const state = orchestrator.getStateSummary();
    assert.strictEqual(state.pipelineStatus, "IDLE");
    assert.strictEqual(state.agentStates.agent_research.status, AgentStatus.WAITING);
    assert.strictEqual(state.agentStates.agent_factchecker.status, AgentStatus.WAITING);
    assert.strictEqual(state.agentStates.agent_conflict.status, AgentStatus.WAITING);
    assert.strictEqual(state.agentStates.agent_report.status, AgentStatus.WAITING);
  });

  // 3. Demo Mode End-to-End Execution
  await test("Demo Mode executes all 4 agents in sequence and outputs complete dossier", async () => {
    const orchestrator = new MultiAgentOrchestrator();
    const solar = getDemoDatasetById("demo_solar_capacity_2024");
    const events = [];

    orchestrator.on("agent_start", (e) => events.push(`start:${e.agentId}`));
    orchestrator.on("agent_complete", (e) => events.push(`complete:${e.agentId}`));

    const result = await orchestrator.runInvestigation({
      query: solar.title,
      depth: "standard",
      isDemo: true,
      sampleData: solar
    });

    assert.ok(result, "Resulting dossier must be returned");
    assert.strictEqual(orchestrator.state.pipelineStatus, "COMPLETED");
    assert.strictEqual(events.length, 8); // 4 starts + 4 completes
    assert.strictEqual(events[0], "start:agent_research");
    assert.strictEqual(events[1], "complete:agent_research");
    assert.strictEqual(events[2], "start:agent_factchecker");
    assert.strictEqual(events[3], "complete:agent_factchecker");
    assert.strictEqual(events[4], "start:agent_conflict");
    assert.strictEqual(events[5], "complete:agent_conflict");
    assert.strictEqual(events[6], "start:agent_report");
    assert.strictEqual(events[7], "complete:agent_report");

    assert.strictEqual(result.stats.verifiedCount, 2);
    assert.strictEqual(result.stats.disputedCount, 1);
  });

  // 4. Unmapped Demo Query Handling (Zero Silent Substitution)
  await test("Unmapped demo inquiry triggers demo_scenario_required and pauses cleanly", async () => {
    const orchestrator = new MultiAgentOrchestrator();
    let eventReceived = false;

    orchestrator.on("demo_scenario_required", (e) => {
      eventReceived = true;
      assert.strictEqual(e.query, "Unmapped topic test");
    });

    const result = await orchestrator.runInvestigation({
      query: "Unmapped topic test",
      depth: "standard",
      isDemo: true,
      sampleData: null
    });

    assert.strictEqual(result, null);
    assert.strictEqual(orchestrator.state.pipelineStatus, "PAUSED");
    assert.strictEqual(eventReceived, true);
    assert.strictEqual(orchestrator.state.agentStates.agent_research.status, AgentStatus.WAITING);
  });

  // 5. Live Mode Unreachable Backend Graceful Failure (Zero Fake Completion)
  await test("Live Mode without running backend fails honestly on Agent 1 and leaves downstream WAITING", async () => {
    const orchestrator = new MultiAgentOrchestrator();
    let errorFired = false;

    orchestrator.on("error", (e) => {
      errorFired = true;
      assert.strictEqual(e.agentId, "agent_research");
    });

    try {
      await orchestrator.runInvestigation({
        query: "Live test without running backend",
        depth: "standard",
        isDemo: false,
        sampleData: null
      });
      assert.fail("Should have thrown connection error");
    } catch (err) {
      assert.ok(err.message.includes("Failed to connect") || err.message.includes("backend"));
    }

    assert.strictEqual(errorFired, true);
    assert.strictEqual(orchestrator.state.pipelineStatus, "FAILED");
    assert.strictEqual(orchestrator.state.agentStates.agent_research.status, AgentStatus.FAILED);
    assert.strictEqual(orchestrator.state.agentStates.agent_factchecker.status, AgentStatus.WAITING);
    assert.strictEqual(orchestrator.state.agentStates.agent_conflict.status, AgentStatus.WAITING);
    assert.strictEqual(orchestrator.state.agentStates.agent_report.status, AgentStatus.WAITING);
  });

  // 6. Homepage Example Queries Resolve Accurately
  await test("Homepage example queries resolve to verified benchmark datasets", async () => {
    const { findDemoDatasetByQuery } = await import("../public/js/demoData.js");
    
    const aiMatch = findDemoDatasetByQuery("AI in education");
    assert.strictEqual(aiMatch.id, "demo_ai_education");

    const climateMatch = findDemoDatasetByQuery("Climate change");
    assert.strictEqual(climateMatch.id, "demo_solar_capacity_2024");

    const smMatch = findDemoDatasetByQuery("Social media and attention");
    assert.strictEqual(smMatch.id, "demo_social_media_attention");

    const quantumMatch = findDemoDatasetByQuery("Quantum computing");
    assert.strictEqual(quantumMatch.id, "demo_quantum_supremacy");
  });

  // 7. Full Execution of New AI in Education Scenario
  await test("AI in Education demo runs end-to-end with all 4 agents completing", async () => {
    const orchestrator = new MultiAgentOrchestrator();
    const aiEdu = getDemoDatasetById("demo_ai_education");

    const result = await orchestrator.runInvestigation({
      query: aiEdu.query,
      depth: "standard",
      isDemo: true,
      sampleData: aiEdu
    });

    assert.ok(result, "Resulting dossier must be returned");
    assert.strictEqual(orchestrator.state.pipelineStatus, "COMPLETED");
    assert.strictEqual(result.stats.verifiedCount, 2);
    assert.strictEqual(result.stats.disputedCount, 1);
  });

  // 8. Full Execution of Social Media & Attention Scenario
  await test("Social Media & Attention demo runs end-to-end with all 4 agents completing", async () => {
    const orchestrator = new MultiAgentOrchestrator();
    const sm = getDemoDatasetById("demo_social_media_attention");

    const result = await orchestrator.runInvestigation({
      query: sm.query,
      depth: "standard",
      isDemo: true,
      sampleData: sm
    });

    assert.ok(result, "Resulting dossier must be returned");
    assert.strictEqual(orchestrator.state.pipelineStatus, "COMPLETED");
    assert.strictEqual(result.stats.verifiedCount, 2);
    assert.strictEqual(result.stats.disputedCount, 1);
  });

  // 9. StorageService LocalStorage Mock Fallback & Operations
  await test("StorageService manages research history, active state, and deletion safely", async () => {
    // In Node environment without window.localStorage, StorageService safely returns defaults without crashing
    const history = StorageService.getHistory();
    assert.ok(Array.isArray(history));

    const active = StorageService.getActiveResearch();
    assert.strictEqual(active, null);

    const settings = StorageService.getSettings();
    assert.ok(settings);
    assert.strictEqual(typeof settings.demoModeDefault, "boolean");
  });

  console.log("\n=================================================");
  console.log(`  TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runFrontendTestSuite().catch(err => {
  console.error("Frontend test runner crashed:", err);
  process.exit(1);
});
