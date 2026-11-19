/**
 * UNCOVER - Multi-Agent Workspace Controller
 * 
 * Drives the real-time execution UI for the 4 independent agents:
 * - Listens to actual pipeline events from MultiAgentOrchestrator
 * - Updates agent statuses: WAITING, RUNNING, COMPLETED, FAILED
 * - Appends live diagnostic log streams to each agent's console
 * - Populates live claim verification feeds
 * - Provides interactive structured I/O inspection for each agent
 * - Persists completed dossiers to LocalStorage via StorageService
 */

import { MultiAgentOrchestrator, AgentStatus } from './orchestrator.js';
import { StorageService } from './storage.js';
import { DEMO_DATASETS, getDemoDatasetById } from './demoData.js';
import { showToast } from './main.js';

let orchestrator;
let currentInvestigationRecord = null;
let activeInspectAgentId = 'agent_research';
let activeInspectTab = 'output'; // 'input' | 'output' | 'logs'

// DOM References
let inquiryQueryEl;
let modeBadgeEl;
let depthBadgeEl;
let rerunPipelineBtn;
let dossierBanner;
let inspectorModal;
let inspectorModalTitle;
let inspectorCodeBlock;
let inspectorTabs;
let feedContainer;

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  initOrchestrator();
  loadAndStartPipeline();
});

function initElements() {
  inquiryQueryEl = document.getElementById('inquiryQueryText');
  modeBadgeEl = document.getElementById('modeBadge');
  depthBadgeEl = document.getElementById('depthBadge');
  rerunPipelineBtn = document.getElementById('rerunPipelineBtn');
  dossierBanner = document.getElementById('dossierReadyBanner');
  inspectorModal = document.getElementById('inspectorModal');
  inspectorModalTitle = document.getElementById('inspectorModalTitle');
  inspectorCodeBlock = document.getElementById('inspectorCodeBlock');
  inspectorTabs = document.querySelectorAll('.inspector-tab-btn');
  feedContainer = document.getElementById('claimFeedContainer');

  // Inspector Close
  const closeInspectorBtn = document.getElementById('closeInspectorBtn');
  if (closeInspectorBtn) {
    closeInspectorBtn.addEventListener('click', closeInspector);
  }

  // Inspector Tab Switching
  inspectorTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      inspectorTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeInspectTab = tab.getAttribute('data-tab');
      renderInspectorContent();
    });
  });

  // Re-run Button
  if (rerunPipelineBtn) {
    rerunPipelineBtn.addEventListener('click', () => {
      loadAndStartPipeline();
    });
  }

  // Bind Agent Card "Inspect" buttons
  const inspectButtons = document.querySelectorAll('[data-action="inspect-agent"]');
  inspectButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const agentId = btn.getAttribute('data-agent-id');
      openInspector(agentId);
    });
  });
}

/**
 * Initialize Central Orchestrator & Event Subscriptions
 */
function initOrchestrator() {
  orchestrator = new MultiAgentOrchestrator();

  // 1. Global State Change
  orchestrator.on('state_change', (summary) => {
    updatePipelineTracker(summary);
  });

  // 2. Agent Start Event
  orchestrator.on('agent_start', ({ agentId, task }) => {
    setAgentCardState(agentId, AgentStatus.RUNNING, task);
  });

  // 3. Agent Progress Log Event
  orchestrator.on('agent_progress', ({ agentId, message }) => {
    appendAgentLog(agentId, message);
  });

  // 4. Agent Complete Event
  orchestrator.on('agent_complete', ({ agentId, output }) => {
    setAgentCardState(agentId, AgentStatus.COMPLETED, `Completed at ${new Date().toLocaleTimeString()}`);
    updateAgentMetrics(agentId, output);

    if (agentId === 'agent_factchecker' && output.claims) {
      renderClaimsFeed(output.claims);
    }
  });

  // 5. Final Pipeline Complete Event
  orchestrator.on('pipeline_complete', (finalDossier) => {
    currentInvestigationRecord = finalDossier;
    StorageService.saveResearch(finalDossier);
    StorageService.setActiveResearch(finalDossier);
    revealDossierBanner(finalDossier);
    showToast('✦ Multi-Agent Research Dossier Complete!', 'info', 3500);
  });

  // 6. Error Handling
  orchestrator.on('error', ({ message, agentId }) => {
    if (agentId) {
      setAgentCardState(agentId, AgentStatus.FAILED, `Failed: ${message}`);
    }
    showToast(`Error: ${message}`, 'warning', 4000);
  });
}

/**
 * Load parameters and execute pipeline
 */
async function loadAndStartPipeline() {
  const urlParams = new URLSearchParams(window.location.search);
  const queryParam = urlParams.get('query');
  const demoIdParam = urlParams.get('demoId');
  const depthParam = urlParams.get('depth') || 'standard';
  const isDemo = urlParams.get('demo') !== 'false';

  const noticeContainer = document.getElementById('workspaceNoticeContainer');
  const query = queryParam ? decodeURIComponent(queryParam).trim() : '';

  // Clear previous state
  if (feedContainer) feedContainer.innerHTML = '';
  if (dossierBanner) dossierBanner.classList.remove('active');
  resetAllAgentCards();

  // =========================================================================
  // 1. LIVE MODE HANDLING (Stage 4 Pending Gate)
  // =========================================================================
  if (!isDemo) {
    if (inquiryQueryEl) inquiryQueryEl.textContent = query ? `"${query}"` : '"Live Research Inquiry"';
    if (modeBadgeEl) {
      modeBadgeEl.textContent = '● LIVE MODE (STAGE 4 PENDING)';
      modeBadgeEl.className = 'badge badge-brown';
    }
    if (depthBadgeEl) depthBadgeEl.textContent = depthParam === 'deep' ? 'DEEP CHECK' : 'STANDARD CHECK';

    // Show prominent Stage 4 Notice
    if (noticeContainer) {
      noticeContainer.innerHTML = `
        <div class="card card-brown" style="margin-bottom: var(--space-6); border-left: 4px solid var(--color-blue-baby);">
          <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-2);">
            <span class="badge badge-blue">● LIVE RESEARCH MODE (STAGE 4 PENDING)</span>
            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-blue-baby);">STAGE 4 INTEGRATION REQUIRED</span>
          </div>
          <h3 style="color: var(--color-cream-ivory); margin-bottom: var(--space-2); font-size: var(--text-lg);">
            Live Research Pipeline Pending Stage 4 Integration
          </h3>
          <p style="color: var(--color-cream-base); font-size: var(--text-sm); line-height: 1.6; margin-bottom: var(--space-4);">
            Live web search with the Tavily Search API and autonomous reasoning with Google Gemini API are scheduled for Stage 4 backend deployment via Firebase Cloud Functions. UNCOVER strictly adheres to empirical integrity and does not simulate or fabricate live research findings.
          </p>
          <div class="flex items-center gap-3" style="flex-wrap: wrap;">
            <a href="workspace.html?demo=true" class="btn btn-accent btn-sm">
              ✦ Switch to Demo Mode & Run Pipeline
            </a>
            <a href="dashboard.html" class="btn btn-outline btn-sm" style="color: var(--color-cream-ivory); border-color: rgba(245, 235, 221, 0.4);">
              ← Return to Dashboard
            </a>
          </div>
        </div>
      `;
    }

    // Set agents to WAITING with explicit task description (no fake completion!)
    const agentIds = ['agent_research', 'agent_factchecker', 'agent_conflict', 'agent_report'];
    agentIds.forEach(id => {
      setAgentCardState(id, AgentStatus.WAITING, 'Live API integration pending Stage 4 deployment');
      const consoleBox = document.getElementById(`${id}_console`);
      if (consoleBox) {
        consoleBox.innerHTML = `
          <div class="console-entry text-muted">[${new Date().toLocaleTimeString()}] Live API integration pending Stage 4 deployment.</div>
          <div class="console-entry text-muted">[${new Date().toLocaleTimeString()}] Agent execution paused to preserve empirical integrity.</div>
        `;
      }
      const metric = document.getElementById(`${id}_metric`);
      if (metric) metric.textContent = 'Pending Stage 4';
    });

    // Update Tracker
    document.querySelectorAll('.pipeline-step-item').forEach(item => {
      item.classList.remove('active', 'completed');
      const statusEl = item.querySelector('.pipeline-step-status');
      if (statusEl) statusEl.textContent = 'PENDING';
    });

    if (feedContainer) {
      feedContainer.innerHTML = `
        <div style="text-align: center; padding: var(--space-6); color: var(--color-brown-secondary); font-size: var(--text-sm);">
          Live claim evidence feed will activate in Stage 4 once live Tavily Search and Gemini AI are connected.
        </div>
      `;
    }

    return; // Stop execution: DO NOT run sample data or pretend agents completed!
  }

  // =========================================================================
  // 2. DEMO MODE HANDLING
  // =========================================================================
  let sampleData = null;

  if (demoIdParam) {
    sampleData = getDemoDatasetById(demoIdParam);
  } else if (query) {
    // Check keyword match in existing verified demo datasets
    const qLower = query.toLowerCase();
    sampleData = DEMO_DATASETS.find(d => {
      const titleLower = d.title.toLowerCase();
      const topicLower = d.query.toLowerCase();
      const catLower = d.category.toLowerCase();
      return (
        (qLower.includes('solar') && (titleLower.includes('solar') || topicLower.includes('solar'))) ||
        (qLower.includes('quantum') && (titleLower.includes('quantum') || topicLower.includes('quantum'))) ||
        ((qLower.includes('sodium') || qLower.includes('salt')) && (titleLower.includes('sodium') || topicLower.includes('sodium'))) ||
        titleLower.includes(qLower) ||
        topicLower.includes(qLower) ||
        catLower.includes(qLower)
      );
    });
  } else {
    sampleData = DEMO_DATASETS[0];
  }

  // If in Demo mode but query does not match any pre-packaged dataset:
  if (!sampleData && query) {
    if (inquiryQueryEl) inquiryQueryEl.textContent = `"${query}"`;
    if (modeBadgeEl) modeBadgeEl.textContent = '✦ DEMO MODE';
    if (depthBadgeEl) depthBadgeEl.textContent = depthParam === 'deep' ? 'DEEP CHECK' : 'STANDARD CHECK';

    if (noticeContainer) {
      noticeContainer.innerHTML = `
        <div class="card" style="margin-bottom: var(--space-6); background: var(--color-cream-ivory); border: 1.5px solid var(--color-brown-border);">
          <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-2);">
            <span class="badge badge-blue">✦ DEMO ENVIRONMENT</span>
            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-brown-secondary);">SELECT VERIFIED BENCHMARK</span>
          </div>
          <h3 style="color: var(--color-brown-dark); margin-bottom: var(--space-2); font-size: var(--text-lg);">
            Choose a Verified Demonstration Scenario
          </h3>
          <p style="color: var(--color-brown-light); font-size: var(--text-sm); line-height: 1.6; margin-bottom: var(--space-4);">
            Demo Mode operates strictly on verified empirical reference datasets. No pre-packaged dataset exists for "<em>${escapeHtml(query)}</em>". Select one of UNCOVER's 3 verified scenarios below to run the multi-agent pipeline:
          </p>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-3);">
            <a href="workspace.html?demoId=demo_solar_capacity_2024&demo=true" class="btn btn-secondary btn-sm" style="text-align: left; justify-content: flex-start; padding: 12px 16px;">
              <div>
                <div style="font-size: 11px; color: var(--color-brown-primary); font-weight: bold;">ENERGY & CLIMATE</div>
                <div style="font-size: 13px; font-weight: 600;">Global Solar Capacity 2.0 TW Milestone (2024)</div>
              </div>
            </a>
            <a href="workspace.html?demoId=demo_quantum_supremacy&demo=true" class="btn btn-secondary btn-sm" style="text-align: left; justify-content: flex-start; padding: 12px 16px;">
              <div>
                <div style="font-size: 11px; color: var(--color-brown-primary); font-weight: bold;">TECH & PHYSICS</div>
                <div style="font-size: 13px; font-weight: 600;">Quantum Computational Advantage Status</div>
              </div>
            </a>
            <a href="workspace.html?demoId=demo_dietary_sodium&demo=true" class="btn btn-secondary btn-sm" style="text-align: left; justify-content: flex-start; padding: 12px 16px;">
              <div>
                <div style="font-size: 11px; color: var(--color-brown-primary); font-weight: bold;">PUBLIC HEALTH</div>
                <div style="font-size: 13px; font-weight: 600;">Dietary Sodium Reduction & J-Curve Debate</div>
              </div>
            </a>
          </div>
        </div>
      `;
    }

    const agentIds = ['agent_research', 'agent_factchecker', 'agent_conflict', 'agent_report'];
    agentIds.forEach(id => {
      setAgentCardState(id, AgentStatus.WAITING, 'Select a verified demonstration scenario above to begin');
    });

    if (feedContainer) {
      feedContainer.innerHTML = `
        <div style="text-align: center; padding: var(--space-6); color: var(--color-brown-secondary); font-size: var(--text-sm);">
          Select a verified scenario above to execute the four-agent corroboration feed.
        </div>
      `;
    }
    return;
  }

  // Clear notice container when running a valid demo scenario
  if (noticeContainer) noticeContainer.innerHTML = '';

  const activeQuery = sampleData ? sampleData.query : (query || DEMO_DATASETS[0].query);

  if (inquiryQueryEl) inquiryQueryEl.textContent = `"${activeQuery}"`;
  if (modeBadgeEl) modeBadgeEl.textContent = '✦ DEMO PIPELINE';
  if (depthBadgeEl) depthBadgeEl.textContent = depthParam === 'deep' ? 'DEEP CHECK' : 'STANDARD CHECK';

  // Execute genuine 4-agent demo orchestration
  try {
    await orchestrator.runInvestigation({
      query: activeQuery,
      depth: depthParam,
      isDemo: true,
      sampleData
    });
  } catch (err) {
    console.error('[Workspace] Orchestration run error:', err);
  }
}

/**
 * Update the Top Progress Tracker Bar
 */
function updatePipelineTracker(summary) {
  const stepItems = document.querySelectorAll('.pipeline-step-item');
  const current = summary.currentStep;

  stepItems.forEach((item, idx) => {
    const stepNum = idx + 1;
    item.classList.remove('active', 'completed');

    if (summary.pipelineStatus === 'COMPLETED' || stepNum < current) {
      item.classList.add('completed');
      const statusEl = item.querySelector('.pipeline-step-status');
      if (statusEl) statusEl.textContent = 'DONE';
    } else if (stepNum === current && summary.pipelineStatus === 'RUNNING') {
      item.classList.add('active');
      const statusEl = item.querySelector('.pipeline-step-status');
      if (statusEl) statusEl.textContent = 'EXECUTING';
    } else {
      const statusEl = item.querySelector('.pipeline-step-status');
      if (statusEl) statusEl.textContent = 'QUEUED';
    }
  });
}

/**
 * Reset all visual cards to WAITING
 */
function resetAllAgentCards() {
  const agentIds = ['agent_research', 'agent_factchecker', 'agent_conflict', 'agent_report'];
  agentIds.forEach(id => {
    setAgentCardState(id, AgentStatus.WAITING, 'Awaiting pipeline dispatch...');
    const consoleBox = document.getElementById(`${id}_console`);
    if (consoleBox) consoleBox.innerHTML = '<div class="console-entry text-muted">Ready for execution stream...</div>';
    const metricsBadge = document.getElementById(`${id}_metric`);
    if (metricsBadge) metricsBadge.textContent = '0 items';
  });
}

/**
 * Set Card visual status & task text
 */
function setAgentCardState(agentId, status, taskDescription) {
  const card = document.getElementById(`${agentId}_card`);
  if (!card) return;

  card.classList.remove('status-waiting', 'status-running', 'status-completed', 'status-failed');
  card.classList.add(`status-${status.toLowerCase()}`);

  const badge = card.querySelector('.agent-status-badge');
  if (badge) badge.textContent = status;

  const taskBanner = card.querySelector('.agent-task-banner');
  if (taskBanner) taskBanner.textContent = taskDescription;
}

/**
 * Append live log entries into the agent's console box
 */
function appendAgentLog(agentId, message) {
  const consoleBox = document.getElementById(`${agentId}_console`);
  if (!consoleBox) return;

  // Clear placeholder if first entry
  if (consoleBox.querySelector('.text-muted')) {
    consoleBox.innerHTML = '';
  }

  const entry = document.createElement('div');
  entry.className = 'console-entry';
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="highlight">[${time}]</span> ${escapeHtml(message)}`;
  consoleBox.appendChild(entry);
  consoleBox.scrollTop = consoleBox.scrollHeight;
}

/**
 * Update agent metrics badge
 */
function updateAgentMetrics(agentId, output) {
  const metricEl = document.getElementById(`${agentId}_metric`);
  if (!metricEl || !output) return;

  switch (agentId) {
    case 'agent_research':
      metricEl.textContent = `${output.sources ? output.sources.length : 0} Sources | ${output.extractedClaims ? output.extractedClaims.length : 0} Claims`;
      break;
    case 'agent_factchecker':
      metricEl.textContent = `${output.stats ? output.stats.verified : 0} Verified | ${output.stats ? output.stats.disputed : 0} Disputed`;
      break;
    case 'agent_conflict':
      metricEl.textContent = `${output.totalConflicts || 0} Conflicts Found`;
      break;
    case 'agent_report':
      metricEl.textContent = `Score: ${output.compiledStats ? output.compiledStats.confidenceScore : 85}%`;
      break;
  }
}

/**
 * Render Claims Feed as Fact-Checker produces claims
 */
function renderClaimsFeed(claims) {
  if (!feedContainer || !Array.isArray(claims)) return;

  feedContainer.innerHTML = claims.map((c, idx) => `
    <div class="claim-feed-card">
      <div class="claim-feed-top">
        <span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span>
        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-brown-secondary);">
          Certainty: ${(c.confidenceScore * 100).toFixed(0)}%
        </span>
      </div>
      <div class="claim-feed-statement">
        Claim #${idx + 1}: "${escapeHtml(c.statement)}"
      </div>
      <div class="claim-feed-rationale">
        <strong>Evidence Rationale:</strong> ${escapeHtml(c.rationale)}
      </div>
    </div>
  `).join('');
}

/**
 * Reveal the Dossier Ready Banner upon completion
 */
function revealDossierBanner(dossier) {
  if (!dossierBanner) return;

  const titleEl = document.getElementById('dossierBannerTitle');
  const summaryEl = document.getElementById('dossierBannerSummary');
  const viewDossierBtn = document.getElementById('viewDossierBtn');

  if (titleEl) titleEl.textContent = dossier.title || 'Research Dossier Synthesized';
  if (summaryEl && dossier.reportGeneratorAgent) {
    summaryEl.textContent = dossier.reportGeneratorAgent.executiveSummary || 'Executive summary ready for inspection.';
  }

  if (viewDossierBtn) {
    viewDossierBtn.onclick = () => {
      window.location.href = `report.html?id=${dossier.id}`;
    };
  }

  dossierBanner.classList.add('active');
  dossierBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Inspector Modal: Inspect Agent Input/Output JSON
 */
function openInspector(agentId) {
  if (!inspectorModal || !orchestrator) return;
  activeInspectAgentId = agentId;

  const names = {
    agent_research: 'Research Agent',
    agent_factchecker: 'Fact-Checker Agent',
    agent_conflict: 'Conflict Analyst Agent',
    agent_report: 'Report Generator Agent'
  };

  if (inspectorModalTitle) {
    inspectorModalTitle.textContent = `Inspect I/O: ${names[agentId] || agentId}`;
  }

  renderInspectorContent();
  inspectorModal.classList.add('open');
}

function closeInspector() {
  if (inspectorModal) inspectorModal.classList.remove('open');
}

function renderInspectorContent() {
  if (!inspectorCodeBlock || !orchestrator) return;
  const inspection = orchestrator.getAgentInspection(activeInspectAgentId);

  if (!inspection) {
    inspectorCodeBlock.textContent = '// No inspection data available for this agent.';
    return;
  }

  let dataToDisplay;
  if (activeInspectTab === 'input') {
    dataToDisplay = inspection.input || { message: 'Agent input has not been dispatched yet.' };
  } else if (activeInspectTab === 'output') {
    dataToDisplay = inspection.output || { message: 'Agent output has not completed yet.' };
  } else {
    dataToDisplay = inspection.logs || [];
  }

  inspectorCodeBlock.textContent = JSON.stringify(dataToDisplay, null, 2);
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'VERIFIED': return 'badge-status-verified';
    case 'PARTIALLY_VERIFIED': return 'badge-status-partially';
    case 'DISPUTED': return 'badge-status-disputed';
    default: return 'badge-status-unverified';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
