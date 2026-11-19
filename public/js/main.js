/**
 * UNCOVER - Main Global Script
 * UI interactions, mobile drawer, toast system, and navigation
 */

import { APP_CONFIG } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initActiveNavLink();
  initQuickDemoTriggers();
});

/**
 * Mobile navigation toggle
 */
function initMobileNav() {
  const toggleBtn = document.getElementById('mobileMenuBtn');
  const drawer = document.getElementById('mobileNavDrawer');

  if (!toggleBtn || !drawer) return;

  toggleBtn.addEventListener('click', () => {
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      drawer.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    } else {
      drawer.classList.add('open');
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (drawer.classList.contains('open') && !drawer.contains(e.target) && !toggleBtn.contains(e.target)) {
      drawer.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

/**
 * Active navigation link highlighter
 */
function initActiveNavLink() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-item a, .mobile-nav-list a');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/**
 * Handle quick "Launch Demo" triggers across the page
 */
function initQuickDemoTriggers() {
  const demoButtons = document.querySelectorAll('[data-action="launch-demo"]');
  demoButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'workspace.html?demo=true';
    });
  });
}

/**
 * Lightweight Toast Notification System
 * Strict Palette: Brown background, Cream text, Baby Blue accent border
 */
export function showToast(message, type = 'info', duration = 3500) {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'uncover-toast';
  toast.style.cssText = `
    background: ${APP_CONFIG.colors.brownDark};
    color: ${APP_CONFIG.colors.creamIvory};
    border-left: 4px solid ${APP_CONFIG.colors.blueBaby};
    border-radius: 8px;
    padding: 12px 20px;
    font-size: 14px;
    font-family: var(--font-body);
    box-shadow: 0 4px 16px rgba(56, 37, 30, 0.25);
    display: flex;
    align-items: center;
    gap: 12px;
    opacity: 0;
    transform: translateY(10px);
    transition: all 250ms ease;
    pointer-events: auto;
  `;

  toast.innerHTML = `
    <span style="color: ${APP_CONFIG.colors.blueBaby}; font-weight: bold;">✦</span>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Remove toast
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}
