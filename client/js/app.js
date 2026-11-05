/**
 * MedFinder - App Module
 * Global utilities: Dark mode, Toast notifications, Active Nav.
 */

// ── Dark Mode ─────────────────────────────────────────────────
// Icon for the toggle: sun/moon SVGs where icons.js is loaded, emoji elsewhere
const themeIcon = (theme) => typeof icon === 'function'
  ? icon(theme === 'dark' ? 'sun' : 'moon')
  : (theme === 'dark' ? '☀️' : '🌙');

function initDarkMode() {
  const saved = localStorage.getItem('medfinder_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('dark-mode-toggle');
  if (btn) {
    btn.innerHTML = themeIcon(saved);
    btn.addEventListener('click', toggleDarkMode);
  }
}

function toggleDarkMode() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('medfinder_theme', next);
  const btn = document.getElementById('dark-mode-toggle');
  if (btn) btn.innerHTML = themeIcon(next);
}

// ── HTML Escaping ─────────────────────────────────────────────
// Use for every server/user value interpolated into innerHTML or Leaflet popups
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Toast Notifications ───────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('notifications');
  if (!container) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || '💬'}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(120%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Active Nav ────────────────────────────────────────────────
function setActiveNav() {
  const page = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === page);
  });
}

// ── Mobile Nav Toggle ─────────────────────────────────────────
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');
  hamburger?.addEventListener('click', () => navLinks?.classList.toggle('nav-open'));
}

// ── Init on DOM ready ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  setActiveNav();
  initMobileNav();
});
