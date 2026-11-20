/**
 * UNCOVER - Google Scholar-Inspired Homepage Controller
 * Handles direct research search, validation, example topic triggers,
 * and demo mode toggle state.
 */

import { StorageService } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
  initSearch();
  initDemoToggle();
  initExamplePills();
});

function initSearch() {
  const form = document.getElementById('scholarSearchForm');
  const input = document.getElementById('scholarSearchInput');
  const clearBtn = document.getElementById('scholarClearBtn');
  const errorBanner = document.getElementById('scholarErrorBanner');
  const submitBtn = document.getElementById('scholarSubmitBtn');

  if (!form || !input) return;

  // Toggle clear button on input
  input.addEventListener('input', () => {
    if (clearBtn) {
      clearBtn.style.display = input.value.trim().length > 0 ? 'flex' : 'none';
    }
    hideError();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      input.focus();
      clearBtn.style.display = 'none';
      hideError();
    });
  }

  // Handle Form Submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    executeSearch();
  });

  function executeSearch() {
    const rawQuery = input.value.trim();

    // 1. Validation
    if (!rawQuery) {
      showError('Please enter a research topic, question, or claim to investigate.');
      input.focus();
      return;
    }

    if (rawQuery.length < 3) {
      showError('Research query must be at least 3 characters long.');
      input.focus();
      return;
    }

    if (rawQuery.length > 500) {
      showError('Research query cannot exceed 500 characters.');
      input.focus();
      return;
    }

    // 2. Loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
      const textSpan = submitBtn.querySelector('.btn-text');
      if (textSpan) textSpan.textContent = 'Searching...';
    }

    // 3. Determine Demo vs Live Mode
    const demoCheckbox = document.getElementById('demoModeCheckbox');
    const isDemo = demoCheckbox ? demoCheckbox.checked : false;

    // 4. Navigate directly to Agent Workspace
    const encoded = encodeURIComponent(rawQuery);
    const targetUrl = `workspace.html?query=${encoded}&demo=${isDemo}&depth=standard`;
    window.location.href = targetUrl;
  }

  function showError(msg) {
    if (errorBanner) {
      errorBanner.textContent = msg;
      errorBanner.style.display = 'block';
    }
  }

  function hideError() {
    if (errorBanner) {
      errorBanner.style.display = 'none';
      errorBanner.textContent = '';
    }
  }
}

/**
 * Demo Mode Toggle handling
 */
function initDemoToggle() {
  const checkbox = document.getElementById('demoModeCheckbox');
  const label = document.getElementById('demoModeLabel');
  if (!checkbox) return;

  // Load user preference or default to false (live first, with clean demo option)
  const settings = StorageService.getSettings();
  checkbox.checked = settings.demoModeDefault === true;
  updateLabel(checkbox.checked);

  checkbox.addEventListener('change', () => {
    StorageService.saveSettings({ demoModeDefault: checkbox.checked });
    updateLabel(checkbox.checked);
  });

  function updateLabel(isDemo) {
    if (label) {
      label.textContent = isDemo ? '✦ Demo Mode' : 'Live Research';
      label.style.color = isDemo ? 'var(--color-blue-deep)' : 'var(--color-brown-primary)';
    }
  }
}

/**
 * Clickable Example Search Topics
 */
function initExamplePills() {
  const pills = document.querySelectorAll('.scholar-example-pill');
  const input = document.getElementById('scholarSearchInput');
  const form = document.getElementById('scholarSearchForm');
  const clearBtn = document.getElementById('scholarClearBtn');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const q = pill.getAttribute('data-query');
      if (!q || !input) return;

      input.value = q;
      if (clearBtn) clearBtn.style.display = 'flex';
      input.focus();

      // Submit immediately for effortless research flow:
      // OPEN WEBSITE -> ENTER TOPIC / CLICK -> SEARCH -> AGENTS WORK
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
  });
}
