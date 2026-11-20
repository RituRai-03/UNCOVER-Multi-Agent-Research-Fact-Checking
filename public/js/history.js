/**
 * UNCOVER - History Controller
 * Search, view, open, and manage saved multi-agent research dossiers.
 */

import { StorageService } from './storage.js';
import { showToast } from './main.js';

let historyItems = [];
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  loadHistory();
});

function initElements() {
  const searchInput = document.getElementById('historySearchInput');
  const clearAllBtn = document.getElementById('clearAllHistoryBtn');
  const modal = document.getElementById('clearHistoryModal');
  const cancelBtn = document.getElementById('cancelClearBtn');
  const confirmBtn = document.getElementById('confirmClearBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderList();
    });
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (modal) modal.style.display = 'flex';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      StorageService.clearAllHistory();
      if (modal) modal.style.display = 'none';
      loadHistory();
      showToast('Research history cleared', 'info');
    });
  }
}

function loadHistory() {
  historyItems = StorageService.getHistory();
  const clearBtn = document.getElementById('clearAllHistoryBtn');
  if (clearBtn) {
    clearBtn.disabled = historyItems.length === 0;
  }
  renderList();
}

function renderList() {
  const container = document.getElementById('historyListContainer');
  if (!container) return;

  const filtered = historyItems.filter(item => {
    if (!searchQuery) return true;
    const title = (item.title || item.query || '').toLowerCase();
    const query = (item.query || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    return title.includes(searchQuery) || query.includes(searchQuery) || cat.includes(searchQuery);
  });

  if (filtered.length === 0) {
    if (historyItems.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: var(--space-12) var(--space-6); background: var(--color-cream-subtle);">
          <div style="font-size: 36px; margin-bottom: var(--space-3); color: var(--color-brown-secondary);">📚</div>
          <h3 style="color: var(--color-brown-dark); margin-bottom: var(--space-2);">No Research History Yet</h3>
          <p style="color: var(--color-brown-secondary); font-size: var(--text-sm); max-width: 440px; margin: 0 auto var(--space-5);">
            You haven't conducted any research investigations yet. Inquiries you search will be automatically corroborated and saved here.
          </p>
          <a href="index.html" class="btn btn-primary btn-sm">
            Start Your First Research
          </a>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: var(--space-8); color: var(--color-brown-secondary); font-size: var(--text-sm);">
          No investigations match "<strong>${escapeHtml(searchQuery)}</strong>".
        </div>
      `;
    }
    return;
  }

  container.innerHTML = filtered.map(item => {
    const isDemo = item.isDemo !== false;
    const stats = item.stats || { sourcesCount: 0, claimsTotal: 0, verifiedCount: 0, disputedCount: 0, confidenceScore: 85 };
    const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'Recent';

    return `
      <div class="card" style="background: var(--color-cream-subtle); border: 1.5px solid var(--color-brown-border); padding: var(--space-5); transition: border-color var(--transition-fast);">
        <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: 8px; margin-bottom: var(--space-2);">
          <div class="flex items-center gap-2">
            <span class="badge ${isDemo ? 'badge-blue' : 'badge-brown'}" style="font-size: 10px;">
              ${isDemo ? '✦ DEMO DATASET' : '● LIVE RECORD'}
            </span>
            ${item.category ? `<span class="badge badge-brown" style="font-size: 10px;">${escapeHtml(item.category)}</span>` : ''}
          </div>
          <span style="font-size: var(--text-xs); color: var(--color-brown-secondary); font-family: var(--font-mono);">${dateStr}</span>
        </div>

        <h3 style="font-size: var(--text-base); color: var(--color-brown-dark); margin-bottom: 4px; line-height: 1.4;">
          <a href="report.html?id=${encodeURIComponent(item.id)}" style="color: inherit; text-decoration: none;">
            ${escapeHtml(item.title || item.query)}
          </a>
        </h3>

        <p style="font-size: var(--text-xs); color: var(--color-brown-secondary); margin-bottom: var(--space-3); line-height: 1.5;">
          Inquiry: "<em>${escapeHtml(item.query)}</em>"
        </p>

        <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: var(--space-3); border-top: 1px dashed var(--color-brown-border); padding-top: var(--space-3);">
          <div class="flex items-center gap-2" style="font-size: var(--text-xs); font-family: var(--font-mono); color: var(--color-brown-secondary);">
            <span style="color: var(--status-verified-text); font-weight: 700;">${stats.verifiedCount || 0} Verified</span>
            <span>&middot;</span>
            <span style="color: var(--status-disputed-text); font-weight: 700;">${stats.disputedCount || 0} Disputed</span>
            <span>&middot;</span>
            <span style="color: var(--color-blue-deep); font-weight: 700;">${stats.confidenceScore || 85}% Conf.</span>
          </div>

          <div class="flex items-center gap-2">
            <a href="report.html?id=${encodeURIComponent(item.id)}" class="btn btn-secondary btn-sm" style="font-size: 12px; padding: 6px 12px;">
              View Report &rarr;
            </a>
            <button class="btn btn-outline btn-sm" data-action="delete-item" data-id="${escapeHtml(item.id)}" style="font-size: 12px; padding: 6px 10px; color: var(--status-disputed-text); border-color: rgba(223, 155, 151, 0.4);" title="Delete investigation">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Bind delete buttons
  container.querySelectorAll('[data-action="delete-item"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) {
        StorageService.deleteResearch(id);
        loadHistory();
        showToast('Investigation removed', 'info');
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
