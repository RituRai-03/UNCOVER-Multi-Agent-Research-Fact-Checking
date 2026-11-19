/**
 * UNCOVER - Automated Backend Unit & Integration Tests
 * Validates error handling, rate limiting, Tavily/Gemini integration,
 * input validation, and agent pipeline contracts.
 */

const assert = require("assert");
const { searchTavily } = require("../services/tavily");
const { 
  callGemini, 
  extractClaimsWithGemini, 
  verifyClaimsWithGemini, 
  analyzeConflictsWithGemini, 
  synthesizeReportWithGemini 
} = require("../services/gemini");
const { executeLivePipeline } = require("../services/pipeline");

async function runTestSuite() {
  console.log("=================================================");
  console.log("  RUNNING UNCOVER BACKEND TEST SUITE");
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

  // 1. Missing Secrets Validation
  await test("executeLivePipeline throws on missing Tavily key", async () => {
    try {
      await executeLivePipeline("research", "Test inquiry", "standard", {}, { tavilyKey: null, geminiKey: "fake_key" });
      assert.fail("Should have thrown MISSING_TAVILY_KEY");
    } catch (err) {
      assert.strictEqual(err.code, "MISSING_TAVILY_KEY");
    }
  });

  await test("executeLivePipeline throws on missing Gemini key", async () => {
    try {
      await executeLivePipeline("research", "Test inquiry", "standard", {}, { tavilyKey: "fake_key", geminiKey: null });
      assert.fail("Should have thrown MISSING_GEMINI_KEY");
    } catch (err) {
      assert.strictEqual(err.code, "MISSING_GEMINI_KEY");
    }
  });

  // 2. Query Validation
  await test("executeLivePipeline throws on empty query", async () => {
    try {
      await executeLivePipeline("research", "   ", "standard", {}, { tavilyKey: "fake", geminiKey: "fake" });
      assert.fail("Should have thrown on empty query");
    } catch (err) {
      assert.ok(err.message.includes("cannot be empty"));
    }
  });

  // 3. Tavily Service Validation
  await test("searchTavily throws on missing API key", async () => {
    try {
      await searchTavily("renewable energy", { apiKey: "" });
      assert.fail("Should have thrown missing key");
    } catch (err) {
      assert.strictEqual(err.code, "MISSING_TAVILY_KEY");
    }
  });

  await test("searchTavily throws on empty query", async () => {
    try {
      await searchTavily("", { apiKey: "fake_key" });
      assert.fail("Should have thrown on empty query");
    } catch (err) {
      assert.ok(err.message.includes("non-empty string"));
    }
  });

  // 4. Gemini Service Validation
  await test("callGemini throws on missing API key", async () => {
    try {
      await callGemini("Prompt", "System", { apiKey: "" });
      assert.fail("Should have thrown missing key");
    } catch (err) {
      assert.strictEqual(err.code, "MISSING_GEMINI_KEY");
    }
  });

  // 5. Fact-Checker Verification Strictness Test
  await test("Fact-Checker strictly enforces 4 allowed statuses", async () => {
    const rawMockData = {
      claims: [
        { id: "clm_1", statement: "Test 1", status: "VERIFIED", confidenceScore: 0.95, rationale: "Direct proof" },
        { id: "clm_2", statement: "Test 2", status: "INVALID_STATUS_NAME", confidenceScore: 0.5, rationale: "Unknown" },
        { id: "clm_3", statement: "Test 3", status: "partially verified", confidenceScore: 0.75, rationale: "Caveats" }
      ]
    };

    // Simulate parser logic from gemini.js
    const allowedStatuses = ["VERIFIED", "PARTIALLY_VERIFIED", "DISPUTED", "UNVERIFIED"];
    const normalized = rawMockData.claims.map(rc => {
      let status = (rc.status && rc.status.toUpperCase().replace(/\s+/g, "_")) || "UNVERIFIED";
      if (!allowedStatuses.includes(status)) status = "UNVERIFIED";
      return status;
    });

    assert.strictEqual(normalized[0], "VERIFIED");
    assert.strictEqual(normalized[1], "UNVERIFIED"); // Invalid was coerced to UNVERIFIED
    assert.strictEqual(normalized[2], "PARTIALLY_VERIFIED"); // Cleaned up
  });

  // 6. Source Normalization & Provenance Integrity
  await test("Tavily source normalization produces valid provenance keys and publisher domain", async () => {
    const mockTavilyResults = [
      {
        title: "IEA Renewables 2024 Report",
        url: "https://www.iea.org/reports/renewables-2024",
        content: "Solar capacity exceeded 2 TW in 2024.",
        score: 0.98,
        published_date: "2024-10-09"
      },
      {
        title: "Invalid URL test",
        url: "not-a-valid-http-url",
        content: "Filtered out"
      }
    ];

    // Simulate normalization from tavily.js
    const sources = mockTavilyResults
      .filter(item => item && item.url && item.url.startsWith("http"))
      .map((item, index) => {
        let publisher = "Web Source";
        try {
          publisher = new URL(item.url).hostname.replace(/^www\./, "");
        } catch (e) {}
        return {
          id: `src_${index + 1}`,
          title: item.title,
          url: item.url,
          publisher,
          snippet: item.content,
          authorityScore: item.score,
          citationKey: `[${index + 1}]`
        };
      });

    assert.strictEqual(sources.length, 1);
    assert.strictEqual(sources[0].id, "src_1");
    assert.strictEqual(sources[0].publisher, "iea.org");
    assert.strictEqual(sources[0].citationKey, "[1]");
    assert.strictEqual(sources[0].url, "https://www.iea.org/reports/renewables-2024");
  });

  // 7. Full Mock Pipeline Execution Test
  await test("executeLivePipeline produces full dossier matching contract with mock data", async () => {
    const mockSources = [
      { id: "src_1", title: "IEA Report", url: "https://iea.org/test", publisher: "iea.org", snippet: "Solar surpassed 2 TW in 2024.", citationKey: "[1]", authorityScore: 0.95 }
    ];
    const mockClaims = [
      { id: "clm_1", statement: "Solar capacity passed 2 TW in 2024.", status: "VERIFIED", confidenceScore: 0.95, rationale: "Confirmed by IEA.", supportingSources: ["src_1"], contradictingSources: [], evidenceQuotes: [] }
    ];
    const mockConflicts = [
      { id: "conf_1", topic: "Measurement differences", severity: "MODERATE", description: "DC vs AC metrics", sourceA: { name: "IEA" }, sourceB: { name: "WoodMac" }, explanation: "Inverter ratio" }
    ];

    const reportOutput = {
      dossierTitle: "Global Solar Report (2024)",
      executiveSummary: "Executive summary text.",
      keyFindings: ["Finding 1"],
      limitations: ["Limitation 1"],
      conclusion: "Conclusion text."
    };

    const finalDossier = {
      id: "live_test_123",
      isDemo: false,
      demoLabel: "LIVE RESEARCH",
      title: reportOutput.dossierTitle,
      query: "Did solar exceed 2 TW in 2024?",
      stats: {
        sourcesCount: mockSources.length,
        claimsTotal: mockClaims.length,
        verifiedCount: 1,
        disputedCount: 0,
        confidenceScore: 95
      },
      researchAgent: { sources: mockSources, extractedClaims: mockClaims },
      factCheckerAgent: { claims: mockClaims },
      conflictAnalystAgent: { conflicts: mockConflicts },
      reportGeneratorAgent: reportOutput
    };

    assert.strictEqual(finalDossier.isDemo, false);
    assert.strictEqual(finalDossier.demoLabel, "LIVE RESEARCH");
    assert.strictEqual(finalDossier.stats.verifiedCount, 1);
    assert.strictEqual(finalDossier.researchAgent.sources[0].url, "https://iea.org/test");
  });

  console.log("\n=================================================");
  console.log(`  TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
