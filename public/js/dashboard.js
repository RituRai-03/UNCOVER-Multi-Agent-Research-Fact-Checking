/**
 * UNCOVER - Research Dashboard Controller
 * Handles inquiry input, depth selection, example selection, 
 * research history persistence (LocalStorage), and Demo Mode integration.
 */

import { APP_CONFIG } from './config.js';
import { StorageService } from './storage.js';
import { DEMO_DATASETS, getDemoDatasetById, getAllDemoDatasets } from './demoData.js';
import { showToast } from './main.js';

// DOM Element References
let inquiryInput;
let charCounter;
let clearBtn;
let startResearchBtn;
let runDemoBtn;
let modeToggle;
let demoBanner;
let historyContainer;
let historySearchInput;
let clearHistoryBtn;
let confirmModal;
let confirmModalActionBtn;
let confirmModalCancelBtn;
let depthOptions;

// Internal Dashboard State
const state = {
  isDemoMode: true,
  depthLevel: 'standard', // 'standard' | 'deep'
  selectedExampleId: null,
  historySearchQuery: ''
};

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  parseUrlParams();
  bindEvents();
  renderHistory();
});

/**
 * Initialize DOM Elements
 */
function initElements() {
  inquiryInput = document.getElementById('inquiryInput');
  charCounter = document.getElementById('charCounter');
  clearBtn = document.getElementById('clearBtn');
  startResearchBtn = document.getElementById('startResearchBtn');
  runDemoBtn = document.getElementById('runDemoBtn');
  modeToggle = document.getElementById('modeToggle');
  demoBanner = document.getElementById('demoBanner');
  historyContainer = document.getElementById('historyContainer');
  historySearchInput = document.getElementById('historySearchInput');
  clearHistoryBtn = document.getElementById('clearHistoryBtn');
  confirmModal = document.getElementById('confirmModal');
  confirmModalActionBtn = document.getElementById('confirmModalActionBtn');
  confirmModalCancelBtn = document.getElementById('confirmModalCancelBtn');
  depthOptions = document.querySelectorAll('.depth-pill-option');
}

/**
 * Parse URL Query Parameters (e.g., ?demo=true or ?topic=...)
 */
function parseUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  
  if (urlParams.get('demo') === 'true' || urlParams.get('demo') === '1') {
    state.isDemoMode = true;
    if (modeToggle) modeToggle.checked = true;
    updateModeUI(true);
  } else {
    // Check saved preference or default to true for frictionless demonstration
    const settings = StorageService.getSettings();
    state.isDemoMode = settings.demoModeDefault !== false;
    if (modeToggle) modeToggle.checked = state.isDemoMode;
    updateModeUI(state.isDemoMode);
  }

  const topicParam = urlParams.get('topic');
  if (topicParam && inquiryInput) {
    inquiryInput.value = decodeURIComponent(topicParam);
    updateCharCounter();
  }
}

/**
 * Bind Event Listeners
 */
function bindEvents() {
  // Input Character Counter & Input Validation
  if (inquiryInput) {
    inquiryInput.addEventListener('input', () => {
      updateCharCounter();
    });
  }

  // Clear Input Button
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (inquiryInput) {
        inquiryInput.value = '';
        inquiryInput.focus();
        updateCharCounter();
        showToast('Inquiry input cleared', 'info', 1800);
      }
    });
  }

  // Mode Toggle (Demo vs Live)
  if (modeToggle) {
    modeToggle.addEventListener('change', (e) => {
      state.isDemoMode = e.target.checked;
      StorageService.saveSettings({ demoModeDefault: state.isDemoMode });
      updateModeUI(state.isDemoMode);
      showToast(state.isDemoMode ? '✦ Demo Mode activated' : 'Live Research Mode activated', 'info');
    });
  }

  // Depth Option Pills
  depthOptions.forEach(pill => {
    pill.addEventListener('click', () => {
      depthOptions.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.depthLevel = pill.getAttribute('data-depth') || 'standard';
    });
  });

  // Example Topic Cards
  const exampleCards = document.querySelectorAll('.example-card');
  exampleCards.forEach(card => {
    card.addEventListener('click', () => {
      const query = card.getAttribute('data-query');
      const exampleId = card.getAttribute('data-id');
      if (inquiryInput && query) {
        inquiryInput.value = query;
        state.selectedExampleId = exampleId;
        updateCharCounter();
        inquiryInput.focus();
        // Smooth scroll to inquiry card
        inquiryInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Example topic loaded', 'info', 2000);
      }
    });
  });

  // Start Research Button
  if (startResearchBtn) {
    startResearchBtn.addEventListener('click', handleStartResearch);
  }

  // Run Demo Button
  if (runDemoBtn) {
    runDemoBtn.addEventListener('click', () => {
      executeDemoRun(state.selectedExampleId || 'demo_solar_capacity_2024');
    });
  }

  // History Search Input
  if (historySearchInput) {
    historySearchInput.addEventListener('input', (e) => {
      state.historySearchQuery = e.target.value.toLowerCase().trim();
      renderHistory();
    });
  }

  // Clear All History Button
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Clear Research History',
        message: 'Are you sure you want to remove all saved research investigations from your browser storage? This cannot be undone.',
        actionText: 'Clear History',
        onConfirm: () => {
          StorageService.clearAllHistory();
          renderHistory();
          showToast('Research history cleared', 'info');
        }
      });
    });
  }

  // Confirm Modal Cancel
  if (confirmModalCancelBtn) {
    confirmModalCancelBtn.addEventListener('click', closeConfirmModal);
  }
}

/**
 * Update UI for Demo Mode vs Live Mode
 */
function updateModeUI(isDemo) {
  if (demoBanner) {
    demoBanner.style.display = isDemo ? 'flex' : 'none';
  }
  const modeText = document.getElementById('modeStatusText');
  if (modeText) {
    modeText.textContent = isDemo ? 'DEMO MODE' : 'LIVE READY';
    modeText.style.color = isDemo ? 'var(--color-blue-deep)' : 'var(--color-brown-primary)';
  }
  if (startResearchBtn) {
    startResearchBtn.innerHTML = isDemo
      ? `Run Demo Investigation <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`
      : `Start Live Research <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  }
}

/**
 * Update character counter
 */
function updateCharCounter() {
  if (!inquiryInput || !charCounter) return;
  const len = inquiryInput.value.length;
  charCounter.textContent = `${len} / 500 chars`;
  if (len > 500) {
    charCounter.style.color = '#7D2622';
  } else {
    charCounter.style.color = 'var(--color-brown-secondary)';
  }
}

/**
 * Handle Start Research submission
 */
function handleStartResearch() {
  const query = inquiryInput ? inquiryInput.value.trim() : '';

  if (!query) {
    showToast('Please enter a research question or select an example.', 'warning');
    if (inquiryInput) inquiryInput.focus();
    return;
  }

  const depth = state.depthLevel || 'standard';

  // If in LIVE mode, notify user that live research requires Stage 4 API connection
  if (!state.isDemoMode) {
    openConfirmModal({
      title: 'Live API Integration Pending (Stage 4)',
      message: `Live web research via Tavily Search and factual reasoning via Google Gemini API are scheduled for Stage 4 backend deployment. UNCOVER strictly forbids fabricating live sources or simulating fake agent completion. Would you like to switch to Demo Mode to test the four-agent orchestration workflow using verified reference datasets?`,
      actionText: 'Switch to Demo Mode & Run',
      onConfirm: () => {
        state.isDemoMode = true;
        if (modeToggle) modeToggle.checked = true;
        updateModeUI(true);
        const targetUrl = `workspace.html?query=${encodeURIComponent(query)}&depth=${depth}&demo=true`;
        window.location.href = targetUrl;
      }
    });
    return;
  }

  // Demo Mode: transition directly to workspace
  const targetUrl = `workspace.html?query=${encodeURIComponent(query)}&depth=${depth}&demo=true`;
  window.location.href = targetUrl;
}

/**
 * Execute Demo Run: redirects to workspace with chosen demo ID
 */
function executeDemoRun(demoId) {
  const depth = state.depthLevel || 'standard';
  const targetUrl = `workspace.html?demoId=${encodeURIComponent(demoId)}&depth=${depth}&demo=true`;
  window.location.href = targetUrl;
}

/**
 * Render Research History from LocalStorage
 */
function renderHistory() {
  if (!historyContainer) return;

  const history = StorageService.getHistory();
  const search = state.historySearchQuery;

  // Filter history if search query is entered
  const filtered = search
    ? history.filter(item => 
        (item.title && item.title.toLowerCase().includes(search)) ||
        (item.query && item.query.toLowerCase().includes(search)) ||
        (item.category && item.category.toLowerCase().includes(search))
      )
    : history;

  const countBadge = document.getElementById('historyCountBadge');
  if (countBadge) {
    countBadge.textContent = `${history.length} Saved`;
  }

  // Empty State
  if (filtered.length === 0) {
    if (history.length === 0) {
      historyContainer.innerHTML = `
        <div class="history-empty-card">
          <div class="history-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </div>
          <div class="history-empty-title">No Research Investigations Yet</div>
          <p class="history-empty-desc">
            Enter a research inquiry above or load pre-packaged demonstration datasets to explore UNCOVER's multi-agent fact-checking engine.
          </p>
          <button class="btn btn-accent btn-sm" id="seedDemoDataBtn">
            <span style="color: var(--color-blue-deep); font-weight: bold;">✦</span>
            Seed Sample Research History
          </button>
        </div>
      `;

      const seedBtn = document.getElementById('seedDemoDataBtn');
      if (seedBtn) {
        seedBtn.addEventListener('click', () => {
          getAllDemoDatasets().forEach(item => {
            StorageService.saveResearch({ ...item, id: 'rec_seed_' + item.id });
          });
          renderHistory();
          showToast('Sample research investigations seeded!', 'info');
        });
      }
    } else {
      historyContainer.innerHTML = `
        <div class="history-empty-card">
          <div class="history-empty-title">No Matching Records Found</div>
          <p class="history-empty-desc">No past inquiries match "${search}". Try clearing your search filter.</p>
          <button class="btn btn-outline btn-sm" id="resetHistorySearchBtn">Reset Search</button>
        </div>
      `;
      const resetBtn = document.getElementById('resetHistorySearchBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          if (historySearchInput) historySearchInput.value = '';
          state.historySearchQuery = '';
          renderHistory();
        });
      }
    }
    return;
  }

  // Render list of history items
  historyContainer.innerHTML = filtered.map(item => {
    const formattedDate = formatTimestamp(item.createdAt);
    const stats = item.stats || { sourcesCount: 0, claimsTotal: 0, verifiedCount: 0, disputedCount: 0 };
    const isDemo = item.isDemo !== false;

    return `
      <div class="history-item" data-id="${item.id}">
        <div class="history-item-main">
          <div class="history-item-top">
            <span class="badge ${isDemo ? 'badge-blue' : 'badge-brown'}">
              ${isDemo ? '✦ DEMO DATASET' : '● LIVE RECORD'}
            </span>
            <span class="history-item-time">${formattedDate}</span>
            ${item.category ? `<span class="badge badge-brown" style="font-size: 10px;">${escapeHtml(item.category)}</span>` : ''}
          </div>
          <h4 class="history-item-title">${escapeHtml(item.title || item.query)}</h4>
          <div class="history-item-stats">
            <span><strong>${stats.sourcesCount}</strong> Sources</span>
            <span>•</span>
            <span class="badge badge-status-verified" style="font-size: 11px;">${stats.verifiedCount || 0} Verified</span>
            ${stats.disputedCount ? `<span class="badge badge-status-disputed" style="font-size: 11px;">${stats.disputedCount} Disputed</span>` : ''}
            <span>•</span>
            <span>Confidence: <strong>${stats.confidenceScore || 85}%</strong></span>
          </div>
        </div>
        <div class="history-item-actions">
          <button class="btn btn-primary btn-sm btn-view-dossier" data-id="${item.id}" title="View research dossier">
            View Dossier
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <button class="btn btn-outline btn-sm btn-rerun-item" data-id="${item.id}" title="Load inquiry back into input">
            Re-run
          </button>
          <button class="btn btn-outline btn-sm btn-delete-item" data-id="${item.id}" title="Delete from history" style="color: #7D2622;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Bind History Item Action Handlers
  historyContainer.querySelectorAll('.btn-view-dossier').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const item = StorageService.getResearchById(id);
      if (item) {
        StorageService.setActiveResearch(item);
        window.location.href = `report.html?id=${id}`;
      }
    });
  });

  historyContainer.querySelectorAll('.btn-rerun-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const item = StorageService.getResearchById(id);
      if (item && inquiryInput) {
        inquiryInput.value = item.query || item.title;
        updateCharCounter();
        inquiryInput.focus();
        inquiryInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Inquiry loaded for re-investigation', 'info', 2000);
      }
    });
  });

  historyContainer.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      StorageService.deleteResearch(id);
      renderHistory();
      showToast('Record removed from history', 'info', 2000);
    });
  });
}

/**
 * Confirmation Modal Helper
 */
let currentConfirmAction = null;

function openConfirmModal({ title, message, actionText, onConfirm }) {
  if (!confirmModal) return;
  const titleEl = document.getElementById('confirmModalTitle');
  const msgEl = document.getElementById('confirmModalMessage');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (confirmModalActionBtn) confirmModalActionBtn.textContent = actionText || 'Confirm';

  currentConfirmAction = onConfirm;
  confirmModal.classList.add('open');

  confirmModalActionBtn.onclick = () => {
    if (typeof currentConfirmAction === 'function') {
      currentConfirmAction();
    }
    closeConfirmModal();
  };
}

function closeConfirmModal() {
  if (confirmModal) {
    confirmModal.classList.remove('open');
    currentConfirmAction = null;
  }
}

/**
 * Format ISO Timestamp into human-readable string
 */
function formatTimestamp(isoString) {
  if (!isoString) return 'Recent';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return 'Recent';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
