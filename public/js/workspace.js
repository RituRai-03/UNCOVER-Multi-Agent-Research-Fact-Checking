/**
 * UNCOVER - Research Workspace Controller
 * Minimal, academic progress timeline driving the 4 independent agents.
 */

import { MultiAgentOrchestrator, AgentStatus } from './orchestrator.js';
import { StorageService } from './storage.js';
import { DEMO_DATASETS, getDemoDatasetById, findDemoDatasetByQuery } from './demoData.js';
import { showToast } from './main.js';

let orchestrator;
let currentInvestigationRecord = null;
let autoRedirectTimer = null;

// DOM References
let inquiryQueryEl;
let modeBadgeEl;
let pipelineStatusBadgeEl;
let progressFillEl;
let currentPhaseLabelEl;
let progressPercentLabelEl;
let noticeContainer;
let dossierBanner;
let viewReportBtn;
let redirectCountdownMsg;

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  initCollapsibleLogs();
  initOrchestrator();
  loadAndStartPipeline();
});

function initElements() {
  inquiryQueryEl = document.getElementById('inquiryQueryText');
  modeBadgeEl = document.getElementById('modeBadge');
  pipelineStatusBadgeEl = document.getElementById('pipelineStatusBadge');
  progressFillEl = document.getElementById('workspaceProgressFill');
  currentPhaseLabelEl = document.getElementById('currentPhaseLabel');
  progressPercentLabelEl = document.getElementById('progressPercentLabel');
  noticeContainer = document.getElementById('workspaceNoticeContainer');
  dossierBanner = document.getElementById('dossierReadyBanner');
  viewReportBtn = document.getElementById('viewReportBtn');
  redirectCountdownMsg = document.getElementById('redirectCountdownMsg');
}

/**
 * Handle collapsible activity log toggles
 */
function initCollapsibleLogs() {
  const toggleButtons = document.querySelectorAll('.activity-toggle-btn');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-toggle');
      const box = document.getElementById(targetId);
      const textSpan = btn.querySelector('.toggle-text');
      const arrowSpan = btn.querySelector('.toggle-arrow');

      if (!box) return;

      const isHidden = box.style.display === 'none';
      if (isHidden) {
        box.style.display = 'block';
        if (textSpan) textSpan.textContent = 'Hide details';
        if (arrowSpan) arrowSpan.innerHTML = '&utrif;';
      } else {
        box.style.display = 'none';
        if (textSpan) textSpan.textContent = 'View details';
        if (arrowSpan) arrowSpan.innerHTML = '&dtrif;';
      }
    });
  });
}

/**
 * Initialize Central Orchestrator & Event Listeners
 */
function initOrchestrator() {
  orchestrator = new MultiAgentOrchestrator();

  // 1. Pipeline State Change
  orchestrator.on('state_change', (summary) => {
    updateProgressUI(summary);
  });

  // 2. Agent Start
  orchestrator.on('agent_start', ({ agentId, task }) => {
    setAgentRowState(agentId, 'running', 'RUNNING', task || 'Processing empirical data...');
  });

  // 3. Agent Progress Log
  orchestrator.on('agent_progress', ({ agentId, message }) => {
    appendAgentLog(agentId, message);
    updateAgentMessage(agentId, message);
  });

  // 4. Agent Complete
  orchestrator.on('agent_complete', ({ agentId, output }) => {
    setAgentRowState(agentId, 'completed', 'COMPLETED', `Completed at ${new Date().toLocaleTimeString()}`);
  });

  // 5. Final Pipeline Complete
  orchestrator.on('pipeline_complete', (finalDossier) => {
    currentInvestigationRecord = finalDossier;

    // Persist to storage
    StorageService.saveResearch(finalDossier);
    StorageService.setActiveResearch(finalDossier);

    // Update UI
    if (pipelineStatusBadgeEl) {
      pipelineStatusBadgeEl.textContent = 'COMPLETED';
      pipelineStatusBadgeEl.className = 'badge badge-status-verified';
    }
    if (progressFillEl) progressFillEl.style.width = '100%';
    if (progressPercentLabelEl) progressPercentLabelEl.textContent = '100%';
    if (currentPhaseLabelEl) currentPhaseLabelEl.textContent = 'Multi-agent corroboration and synthesis finished.';

    revealDossierBanner(finalDossier);
    showToast('✦ Research Dossier Complete!', 'info', 3000);
  });

  // 6. Error Handling
  orchestrator.on('error', ({ message, agentId }) => {
    if (agentId) {
      setAgentRowState(agentId, 'failed', 'FAILED', `Error: ${message}`);
    }
    if (pipelineStatusBadgeEl) {
      pipelineStatusBadgeEl.textContent = 'HALTED';
      pipelineStatusBadgeEl.className = 'badge badge-status-disputed';
    }
    showToast(`Execution halted: ${message}`, 'warning', 4500);
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
  const isDemo = urlParams.get('demo') === 'true' || urlParams.get('demo') === '1';

  const query = queryParam ? decodeURIComponent(queryParam).trim() : '';

  // Clear notice & banner
  if (noticeContainer) noticeContainer.innerHTML = '';
  if (dossierBanner) dossierBanner.style.display = 'none';
  resetAllRows();

  // Validate Query Presence
  if (!query && !demoIdParam) {
    if (noticeContainer) {
      noticeContainer.innerHTML = `
        <div class="card" style="margin-bottom: var(--space-6); text-align: center; padding: var(--space-8);">
          <h3 style="color: var(--color-brown-dark); margin-bottom: var(--space-2);">No Research Inquiry Entered</h3>
          <p style="color: var(--color-brown-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
            Please enter a research topic or question from the homepage search to initiate an investigation.
          </p>
          <a href="index.html" class="btn btn-primary btn-sm">Return to Search</a>
        </div>
      `;
    }
    return;
  }

  // =========================================================================
  // 1. LIVE MODE PATH (Firebase Cloud Functions: Tavily + Gemini)
  // =========================================================================
  if (!isDemo) {
    if (inquiryQueryEl) inquiryQueryEl.textContent = `"${query}"`;
    if (modeBadgeEl) {
      modeBadgeEl.textContent = '● LIVE RESEARCH';
      modeBadgeEl.className = 'badge badge-brown';
    }

    try {
      await orchestrator.runInvestigation({
        query,
        depth: depthParam,
        isDemo: false,
        sampleData: null
      });
    } catch (err) {
      console.error('[Workspace] Live pipeline execution halted:', err);

      let title = 'Live Research Pipeline Halted';
      let desc = err.message || 'An unexpected error occurred during execution.';

      if (err.code === 'MISSING_API_SECRETS') {
        title = 'Backend API Secrets Required';
        desc = 'The Firebase backend is running, but TAVILY_API_KEY or GEMINI_API_KEY is not configured in Firebase Secret Manager. Set them using "firebase functions:secrets:set" or test offline using Demo Mode.';
      } else if (err.code === 'BACKEND_UNREACHABLE') {
        title = 'Backend Cloud Function Unreachable';
        desc = 'Could not reach /api/research. Ensure Firebase Cloud Functions are deployed or emulators are running locally.';
      } else if (err.code === 'TAVILY_RATE_LIMITED' || err.code === 'GEMINI_RATE_LIMITED') {
        title = 'API Rate Limit Reached';
        desc = 'Provider rate limit encountered. Please wait a moment before retrying.';
      }

      if (noticeContainer) {
        noticeContainer.innerHTML = `
          <div class="card" style="margin-bottom: var(--space-6); border-left: 4px solid var(--status-disputed-border); background: var(--status-disputed-bg);">
            <div class="flex items-center justify-between" style="margin-bottom: var(--space-2); flex-wrap: wrap; gap: 8px;">
              <span class="badge badge-status-disputed">PIPELINE EXECUTION HALTED</span>
              <span style="font-family: var(--font-mono); font-size: 11px; color: var(--status-disputed-text);">${err.code || 'ERROR'}</span>
            </div>
            <h3 style="color: var(--status-disputed-text); margin-bottom: 6px; font-size: var(--text-base);">${escapeHtml(title)}</h3>
            <p style="color: var(--color-brown-dark); font-size: var(--text-xs); line-height: 1.6; margin-bottom: var(--space-4);">
              ${escapeHtml(desc)}
            </p>
            <div class="flex items-center gap-3" style="flex-wrap: wrap;">
              <a href="workspace.html?query=${encodeURIComponent(query)}&demo=true" class="btn btn-secondary btn-sm" style="font-size: 12px;">
                ✦ Run in Demo Mode Instead
              </a>
              <button class="btn btn-outline btn-sm" onclick="location.reload()" style="font-size: 12px;">
                Retry
              </button>
              <a href="index.html" class="btn btn-outline btn-sm" style="font-size: 12px;">
                &larr; New Search
              </a>
            </div>
          </div>
        `;
      }
    }
    return;
  }

  // =========================================================================
  // 2. DEMO MODE PATH (Verified Reference Datasets)
  // =========================================================================
  let sampleData = null;

  if (demoIdParam) {
    sampleData = getDemoDatasetById(demoIdParam);
  } else if (query) {
    sampleData = findDemoDatasetByQuery(query);
  } else {
    sampleData = DEMO_DATASETS[0];
  }

  // If in Demo mode but query is completely unmapped
  if (!sampleData && query) {
    if (inquiryQueryEl) inquiryQueryEl.textContent = `"${query}"`;
    if (modeBadgeEl) {
      modeBadgeEl.textContent = '✦ DEMO MODE';
      modeBadgeEl.className = 'badge badge-blue';
    }

    if (noticeContainer) {
      noticeContainer.innerHTML = `
        <div class="card" style="margin-bottom: var(--space-6); background: var(--color-cream-subtle); border: 1.5px solid var(--color-brown-border);">
          <div class="flex items-center justify-between" style="margin-bottom: var(--space-2); flex-wrap: wrap; gap: 8px;">
            <span class="badge badge-blue">✦ DEMO ENVIRONMENT</span>
            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-brown-secondary);">SELECT VERIFIED BENCHMARK</span>
          </div>
          <h3 style="color: var(--color-brown-dark); margin-bottom: 4px; font-size: var(--text-base);">
            Choose a Verified Demonstration Scenario
          </h3>
          <p style="color: var(--color-brown-secondary); font-size: var(--text-xs); line-height: 1.5; margin-bottom: var(--space-4);">
            Demo Mode runs on authentic pre-compiled empirical literature. No dataset matches "<em>${escapeHtml(query)}</em>". Select a verified scenario below:
          </p>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px;">
            <a href="workspace.html?demoId=demo_ai_education&demo=true" class="btn btn-secondary btn-sm" style="text-align: left; justify-content: flex-start; padding: 10px 12px;">
              <div>
                <div style="font-size: 10px; color: var(--color-brown-primary); font-weight: 700;">EDUCATION & AI</div>
                <div style="font-size: 12px; font-weight: 600;">Generative AI in Education</div>
              </div>
            </a>
            <a href="workspace.html?demoId=demo_solar_capacity_2024&demo=true" class="btn btn-secondary btn-sm" style="text-align: left; justify-content: flex-start; padding: 10px 12px;">
              <div>
                <div style="font-size: 10px; color: var(--color-brown-primary); font-weight: 700;">ENERGY & CLIMATE</div>
                <div style="font-size: 12px; font-weight: 600;">Global Solar 2 TW Milestone</div>
              </div>
            </a>
            <a href="workspace.html?demoId=demo_social_media_attention&demo=true" class="btn btn-secondary btn-sm" style="text-align: left; justify-content: flex-start; padding: 10px 12px;">
              <div>
                <div style="font-size: 10px; color: var(--color-brown-primary); font-weight: 700;">COGNITIVE SCIENCE</div>
                <div style="font-size: 12px; font-weight: 600;">Social Media & Attention Span</div>
              </div>
            </a>
            <a href="workspace.html?demoId=demo_quantum_supremacy&demo=true" class="btn btn-secondary btn-sm" style="text-align: left; justify-content: flex-start; padding: 10px 12px;">
              <div>
                <div style="font-size: 10px; color: var(--color-brown-primary); font-weight: 700;">TECH & PHYSICS</div>
                <div style="font-size: 12px; font-weight: 600;">Quantum Advantage Status</div>
              </div>
            </a>
          </div>
        </div>
      `;
    }
    return;
  }

  const activeQuery = sampleData.query;
  if (inquiryQueryEl) inquiryQueryEl.textContent = `"${activeQuery}"`;
  if (modeBadgeEl) {
    modeBadgeEl.textContent = '✦ DEMO DATASET';
    modeBadgeEl.className = 'badge badge-blue';
  }

  try {
    await orchestrator.runInvestigation({
      query: activeQuery,
      depth: depthParam,
      isDemo: true,
      sampleData
    });
  } catch (err) {
    console.error('[Workspace] Demo orchestration error:', err);
  }
}

/**
 * Update Progress Bar and Status based on Orchestrator summary
 */
function updateProgressUI(summary) {
  const step = summary.currentStep || 0;
  const pct = Math.min(Math.round((step / 4) * 100), 100);

  if (progressFillEl) {
    progressFillEl.style.width = `${Math.max(pct, 5)}%`;
  }
  if (progressPercentLabelEl) {
    progressPercentLabelEl.textContent = `${pct}%`;
  }

  const phaseLabels = [
    'Initializing investigation...',
    '01. Research Agent: Searching authoritative web evidence...',
    '02. Fact-Checker Agent: Corroborating claims against source snippets...',
    '03. Conflict Analyst: Identifying cross-source discrepancies...',
    '04. Report Generator: Synthesizing final intelligence dossier...'
  ];

  if (currentPhaseLabelEl) {
    currentPhaseLabelEl.textContent = phaseLabels[step] || 'Synthesizing report...';
  }

  if (pipelineStatusBadgeEl && summary.pipelineStatus === 'RUNNING') {
    pipelineStatusBadgeEl.textContent = 'RUNNING';
    pipelineStatusBadgeEl.className = 'badge badge-blue';
  }
}

/**
 * Set State for a single timeline row
 */
function setAgentRowState(agentId, stateClass, statusLabel, message) {
  const row = document.getElementById(`row_${agentId}`);
  const statusTag = document.getElementById(`status_${agentId}`);
  const msgEl = document.getElementById(`msg_${agentId}`);

  if (row) {
    row.className = `agent-timeline-row state-${stateClass}`;
  }
  if (statusTag) {
    statusTag.textContent = statusLabel;
  }
  if (msgEl && message) {
    msgEl.textContent = message;
  }
}

function updateAgentMessage(agentId, message) {
  const msgEl = document.getElementById(`msg_${agentId}`);
  if (msgEl && message) {
    msgEl.textContent = message;
  }
}

function appendAgentLog(agentId, message) {
  const logStream = document.getElementById(`logs_${agentId}`);
  if (!logStream) return;

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logStream.appendChild(entry);
  logStream.scrollTop = logStream.scrollHeight;
}

function resetAllRows() {
  const ids = ['agent_research', 'agent_factchecker', 'agent_conflict', 'agent_report'];
  ids.forEach(id => {
    setAgentRowState(id, 'pending', 'PENDING', 'Awaiting preceding stage...');
    const logStream = document.getElementById(`logs_${id}`);
    if (logStream) logStream.innerHTML = '<div class="log-entry text-muted">Ready for execution stream...</div>';
  });
}

/**
 * Reveal Final Completion Card and handle auto-redirect
 */
function revealDossierBanner(dossier) {
  if (!dossierBanner) return;

  dossierBanner.style.display = 'block';
  dossierBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const reportUrl = `report.html?id=${encodeURIComponent(dossier.id)}`;
  if (viewReportBtn) {
    viewReportBtn.href = reportUrl;
  }

  // Smooth automatic transition so the user gets their report seamlessly
  let countdown = 2;
  if (redirectCountdownMsg) {
    redirectCountdownMsg.textContent = `Opening report automatically in ${countdown}s...`;
  }

  autoRedirectTimer = setInterval(() => {
    countdown -= 1;
    if (countdown <= 0) {
      clearInterval(autoRedirectTimer);
      window.location.href = reportUrl;
    } else {
      if (redirectCountdownMsg) {
        redirectCountdownMsg.textContent = `Opening report automatically in ${countdown}s...`;
      }
    }
  }, 1000);

  // If user clicks button directly, clear auto-redirect
  if (viewReportBtn) {
    viewReportBtn.addEventListener('click', () => {
      clearInterval(autoRedirectTimer);
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
