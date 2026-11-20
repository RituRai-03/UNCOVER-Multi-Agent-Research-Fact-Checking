/**
 * UNCOVER - Final Report Controller
 * Complete academic report layout, claim verification, conflict analysis,
 * references, copy-to-clipboard, and print/PDF support.
 */

import { StorageService } from './storage.js';
import { getDemoDatasetById, DEMO_DATASETS } from './demoData.js';
import { showToast } from './main.js';

let activeRecord = null;

document.addEventListener('DOMContentLoaded', () => {
  initReport();
  initActions();
});

function initReport() {
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('id');

  if (reportId) {
    activeRecord = StorageService.getResearchById(reportId);
    if (!activeRecord) {
      activeRecord = getDemoDatasetById(reportId);
    }
  }

  if (!activeRecord) {
    activeRecord = StorageService.getActiveResearch() || DEMO_DATASETS[0];
  }

  renderReport(activeRecord);
}

function initActions() {
  const copyBtn = document.getElementById('copyReportBtn');
  const printBtn = document.getElementById('printReportBtn');

  if (copyBtn) {
    copyBtn.addEventListener('click', handleCopyReport);
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

/**
 * Render the Complete Academic Research Dossier
 */
function renderReport(record) {
  const container = document.getElementById('reportContentArea');
  if (!container || !record) return;

  const isDemo = record.isDemo !== false;
  const stats = record.stats || { sourcesCount: 0, claimsTotal: 0, verifiedCount: 0, disputedCount: 0, confidenceScore: 85 };
  const report = record.reportGeneratorAgent || {};
  const claims = (record.factCheckerAgent && record.factCheckerAgent.claims) || [];
  const conflicts = (record.conflictAnalystAgent && record.conflictAnalystAgent.conflicts) || [];
  const sources = (record.researchAgent && record.researchAgent.sources) || [];

  const dateStr = record.createdAt ? new Date(record.createdAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric'
  }) : 'Published Report';

  // Format Claims list
  const claimsHtml = claims.length > 0 ? claims.map((c, idx) => {
    const statusMeta = mapStatus(c.status);
    const quotes = Array.isArray(c.evidenceQuotes) ? c.evidenceQuotes : [];

    return `
      <div class="claim-item-card">
        <div class="claim-header-row">
          <span class="badge ${statusMeta.badgeClass}">
            ${statusMeta.label}
          </span>
          <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-brown-secondary);">
            Evidence Certainty: ${(c.confidenceScore * 100).toFixed(0)}%
          </span>
        </div>

        <div class="claim-statement">
          Claim #${idx + 1}: &ldquo;${escapeHtml(c.statement)}&rdquo;
        </div>

        <div class="claim-rationale">
          <strong>Verification Assessment:</strong> ${escapeHtml(c.rationale || 'Evaluated against primary retrieved evidence.')}
        </div>

        ${quotes.length > 0 ? quotes.map(q => `
          <div class="claim-quote-box">
            &ldquo;${escapeHtml(q.quote)}&rdquo;
            <span style="font-style: normal; font-weight: 700; margin-left: 6px;">[${escapeHtml(q.sourceId)}]</span>
          </div>
        `).join('') : ''}
      </div>
    `;
  }).join('') : `<p class="report-p" style="color: var(--color-brown-secondary);">No individual claims cataloged.</p>`;

  // Format Conflicts section
  let conflictsHtml = '';
  if (conflicts && conflicts.length > 0) {
    conflictsHtml = conflicts.map((conf, idx) => `
      <div class="conflict-item-card">
        <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: 8px; margin-bottom: 6px;">
          <span class="badge badge-status-disputed" style="font-size: 11px;">
            DISCREPANCY #${idx + 1}: ${escapeHtml(conf.topic)}
          </span>
          <span class="badge badge-brown" style="font-size: 10px;">SEVERITY: ${conf.severity || 'MODERATE'}</span>
        </div>

        <p class="report-p" style="margin-bottom: var(--space-3); font-size: var(--text-xs);">
          ${escapeHtml(conf.description)}
        </p>

        <div class="conflict-positions-grid">
          <div class="conflict-pos-box">
            <div style="font-size: 11px; font-weight: 700; color: var(--color-brown-primary); margin-bottom: 3px;">
              ${escapeHtml(conf.sourceA ? conf.sourceA.name : 'Perspective A')}
            </div>
            <div style="font-size: 11.5px; color: var(--color-brown-dark); line-height: 1.5;">
              ${escapeHtml(conf.sourceA ? conf.sourceA.position : 'Data position A')}
            </div>
          </div>
          <div class="conflict-pos-box">
            <div style="font-size: 11px; font-weight: 700; color: var(--color-brown-primary); margin-bottom: 3px;">
              ${escapeHtml(conf.sourceB ? conf.sourceB.name : 'Perspective B')}
            </div>
            <div style="font-size: 11.5px; color: var(--color-brown-dark); line-height: 1.5;">
              ${escapeHtml(conf.sourceB ? conf.sourceB.position : 'Data position B')}
            </div>
          </div>
        </div>

        <div style="font-size: 11px; color: var(--color-brown-secondary); border-top: 1px dashed var(--color-brown-border); padding-top: 6px; line-height: 1.5;">
          <strong>Methodological Root Cause:</strong> ${escapeHtml(conf.explanation || 'Variation arising from divergent measurement methodologies or baseline dates.')}
        </div>
      </div>
    `).join('');
  } else {
    conflictsHtml = `
      <div style="background: var(--color-cream-subtle); border: 1px solid var(--color-brown-border); border-radius: var(--radius-sm); padding: var(--space-4); font-size: var(--text-xs); color: var(--color-brown-secondary); line-height: 1.6;">
        <strong>Concordance Observed:</strong> No significant cross-source empirical contradictions or methodological disputes were detected among the retrieved evidence sources.
      </div>
    `;
  }

  // Format References
  const referencesHtml = sources.length > 0 ? sources.map((src, i) => `
    <div class="reference-row">
      <div class="reference-key">${src.citationKey || `[${i + 1}]`}</div>
      <div class="reference-main">
        <a href="${src.url}" target="_blank" rel="noopener noreferrer" class="reference-link">
          ${escapeHtml(src.title)} &nearr;
        </a>
        <div class="reference-meta">
          ${escapeHtml(src.publisher || 'Web Domain')} ${src.publishDate ? `&middot; ${src.publishDate}` : ''} &middot; Authority: ${((src.authorityScore || 0.9) * 100).toFixed(0)}%
        </div>
        ${src.snippet ? `<div class="reference-snippet">&ldquo;${escapeHtml(src.snippet)}&rdquo;</div>` : ''}
      </div>
    </div>
  `).join('') : `<p class="report-p" style="color: var(--color-brown-secondary);">No references indexed.</p>`;

  // Assemble Complete Academic Paper HTML
  container.innerHTML = `
    <!-- Top Metadata Line -->
    <div class="report-header-meta">
      <div class="flex items-center gap-2">
        <span class="badge ${isDemo ? 'badge-blue' : 'badge-brown'}">
          ${isDemo ? '✦ DEMO DATASET' : '● LIVE RESEARCH RECORD'}
        </span>
        ${record.category ? `<span class="badge badge-brown">${escapeHtml(record.category)}</span>` : ''}
      </div>
      <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-brown-secondary);">${dateStr}</span>
    </div>

    <!-- Title & Inquiry Heading -->
    <h1 class="report-main-title">
      ${escapeHtml(record.title || report.dossierTitle || record.query)}
    </h1>
    <div class="report-inquiry-sub">
      <strong>Research Inquiry:</strong> &ldquo;<em>${escapeHtml(record.query)}</em>&rdquo;
    </div>

    ${isDemo && record.disclaimer ? `
      <div style="background: var(--color-blue-pale); border-left: 3px solid var(--color-blue-deep); padding: 10px 14px; border-radius: var(--radius-xs); margin-bottom: var(--space-6); font-size: 11.5px; color: var(--color-brown-dark); line-height: 1.5;">
        <strong>Empirical Disclosure:</strong> ${escapeHtml(record.disclaimer)}
      </div>
    ` : ''}

    <!-- Metrics Summary Bar -->
    <div class="report-stats-grid">
      <div>
        <div class="report-stat-num">${stats.sourcesCount || sources.length}</div>
        <div class="report-stat-label">Authoritative Sources</div>
      </div>
      <div>
        <div class="report-stat-num" style="color: var(--status-verified-text);">${stats.verifiedCount || 0}</div>
        <div class="report-stat-label">Supported Claims</div>
      </div>
      <div>
        <div class="report-stat-num" style="color: var(--status-disputed-text);">${stats.disputedCount || 0}</div>
        <div class="report-stat-label">Contradicted Claims</div>
      </div>
      <div>
        <div class="report-stat-num" style="color: var(--color-blue-deep);">${stats.confidenceScore || 85}%</div>
        <div class="report-stat-label">Evidence Certainty</div>
      </div>
    </div>

    <!-- SECTION A: Executive Summary -->
    <section class="report-section">
      <h2 class="report-section-title">
        <span class="section-idx">01</span>
        Executive Summary
      </h2>
      <p class="report-p">
        ${escapeHtml(report.executiveSummary || 'Synthesis under compilation based on verified claims and source evidence.')}
      </p>
    </section>

    <!-- SECTION B: Key Corroborated Findings -->
    <section class="report-section">
      <h2 class="report-section-title">
        <span class="section-idx">02</span>
        Key Empirical Findings
      </h2>
      ${report.keyFindings && report.keyFindings.length > 0 ? report.keyFindings.map(f => `
        <div class="finding-item">
          ${escapeHtml(f)}
        </div>
      `).join('') : `
        <p class="report-p" style="color: var(--color-brown-secondary);">Evidence points analyzed across referenced sources.</p>
      `}
    </section>

    <!-- SECTION C: Claim Verification -->
    <section class="report-section">
      <h2 class="report-section-title">
        <span class="section-idx">03</span>
        Claim Verification & Evidence Corroboration
      </h2>
      <div style="display: flex; flex-direction: column; gap: var(--space-3);">
        ${claimsHtml}
      </div>
    </section>

    <!-- SECTION D: Conflicting Evidence -->
    <section class="report-section">
      <h2 class="report-section-title">
        <span class="section-idx">04</span>
        Conflicting Evidence & Methodology Analysis
      </h2>
      <div>
        ${conflictsHtml}
      </div>
    </section>

    <!-- SECTION E: Research Limitations -->
    <section class="report-section">
      <h2 class="report-section-title">
        <span class="section-idx">05</span>
        Research Limitations & Boundary Conditions
      </h2>
      ${report.limitations && report.limitations.length > 0 ? `
        <ul style="padding-left: var(--space-5); font-size: var(--text-xs); color: var(--color-brown-dark); line-height: 1.7; display: flex; flex-direction: column; gap: 6px;">
          ${report.limitations.map(lim => `<li>${escapeHtml(lim)}</li>`).join('')}
        </ul>
      ` : `
        <p class="report-p" style="font-size: var(--text-xs); color: var(--color-brown-secondary);">Findings are subject to public web indexing depth and available peer-reviewed publication windows.</p>
      `}
    </section>

    <!-- SECTION F: Conclusion -->
    <section class="report-section">
      <h2 class="report-section-title">
        <span class="section-idx">06</span>
        Balanced Synthesis & Conclusion
      </h2>
      <p class="report-p" style="font-size: var(--text-sm); line-height: 1.75;">
        ${escapeHtml(report.conclusion || 'Balanced evidence-first synthesis concluded without ungrounded extrapolation.')}
      </p>
    </section>

    <!-- SECTION G: Authoritative References -->
    <section class="report-section" style="margin-bottom: 0;">
      <h2 class="report-section-title">
        <span class="section-idx">07</span>
        Traceable References & Provenance
      </h2>
      <div style="display: flex; flex-direction: column;">
        ${referencesHtml}
      </div>
    </section>
  `;
}

/**
 * Copy Report to Clipboard as Clean Markdown
 */
function handleCopyReport() {
  if (!activeRecord) return;

  const report = activeRecord.reportGeneratorAgent || {};
  const claims = (activeRecord.factCheckerAgent && activeRecord.factCheckerAgent.claims) || [];
  const conflicts = (activeRecord.conflictAnalystAgent && activeRecord.conflictAnalystAgent.conflicts) || [];
  const sources = (activeRecord.researchAgent && activeRecord.researchAgent.sources) || [];

  let md = `# UNCOVER RESEARCH REPORT: ${activeRecord.title || activeRecord.query}\n`;
  md += `Inquiry: "${activeRecord.query}"\n`;
  md += `Date: ${new Date(activeRecord.createdAt || Date.now()).toLocaleDateString()}\n`;
  md += `Certainty Score: ${activeRecord.stats?.confidenceScore || 85}%\n\n`;

  md += `## 1. Executive Summary\n${report.executiveSummary || ''}\n\n`;

  md += `## 2. Key Empirical Findings\n`;
  (report.keyFindings || []).forEach(f => {
    md += `- ${f}\n`;
  });
  md += `\n`;

  md += `## 3. Claim Verification\n`;
  claims.forEach((c, idx) => {
    md += `### Claim #${idx + 1}: ${c.statement}\n`;
    md += `- Status: ${c.status}\n`;
    md += `- Certainty: ${(c.confidenceScore * 100).toFixed(0)}%\n`;
    md += `- Assessment: ${c.rationale}\n\n`;
  });

  md += `## 4. Conflicting Evidence\n`;
  if (conflicts.length > 0) {
    conflicts.forEach((conf, idx) => {
      md += `### Conflict #${idx + 1}: ${conf.topic}\n`;
      md += `${conf.description}\n`;
      md += `- ${conf.sourceA?.name || 'A'}: ${conf.sourceA?.position || ''}\n`;
      md += `- ${conf.sourceB?.name || 'B'}: ${conf.sourceB?.position || ''}\n`;
      md += `- Explanation: ${conf.explanation}\n\n`;
    });
  } else {
    md += `No substantial cross-source empirical conflicts detected.\n\n`;
  }

  md += `## 5. Research Limitations\n`;
  (report.limitations || []).forEach(lim => {
    md += `- ${lim}\n`;
  });
  md += `\n`;

  md += `## 6. Conclusion\n${report.conclusion || ''}\n\n`;

  md += `## 7. Traceable References\n`;
  sources.forEach((s, idx) => {
    md += `[${idx + 1}] ${s.title} (${s.publisher || 'Web'})\n    ${s.url}\n`;
  });

  navigator.clipboard.writeText(md).then(() => {
    showToast('✦ Report copied to clipboard as Markdown!', 'info', 2500);
  }).catch(err => {
    console.warn('Clipboard write failed:', err);
    showToast('Failed to copy to clipboard', 'warning');
  });
}

/**
 * Status mapping to academic labels
 */
function mapStatus(status) {
  const norm = (status || '').toUpperCase().replace(/\s+/g, '_');
  switch (norm) {
    case 'VERIFIED':
    case 'SUPPORTED':
      return { label: 'SUPPORTED', badgeClass: 'badge-status-verified' };
    case 'PARTIALLY_VERIFIED':
    case 'PARTIALLY_SUPPORTED':
      return { label: 'PARTIALLY SUPPORTED', badgeClass: 'badge-status-partially' };
    case 'DISPUTED':
    case 'CONTRADICTED':
      return { label: 'CONTRADICTED', badgeClass: 'badge-status-disputed' };
    case 'UNVERIFIED':
    case 'INSUFFICIENT_EVIDENCE':
    default:
      return { label: 'INSUFFICIENT EVIDENCE', badgeClass: 'badge-status-unverified' };
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
