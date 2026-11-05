/**
 * MedFinder - Search Module
 * Fetches medicine results from the backend API and renders cards.
 */

// ── State ─────────────────────────────────────────────────────
let lastResults = [];          // Raw results from the last search
let sortMode    = 'recommended'; // 'recommended' | 'nearest' | 'cheapest'
let inStockOnly = false;
let nameCounts  = {};          // normalized medicine name → pharmacies listing it

// ── Card Template ─────────────────────────────────────────────
function createMedicineCard(result) {
  const { pharmacy, medicine } = result;
  const avail     = medicine.stock.isAvailable;
  const badgeCls  = avail ? 'badge-available' : 'badge-unavailable';
  const badgeTxt  = avail ? `✓ ${i18n.t('search.available')}` : `✗ ${i18n.t('search.out_of_stock')}`;
  const detailUrl = `/pages/details?pharmacyId=${pharmacy._id}&medicineId=${medicine._id}`;
  const compareCount = nameCounts[normalizeName(medicine.name)] || 0;

  return `
    <div class="card" role="listitem">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(medicine.name)}</h3>
        <span class="badge ${badgeCls}">${badgeTxt}</span>
      </div>
      ${Nearby.distanceBadge(pharmacy.location)}
      <p class="card-desc">${escapeHtml(medicine.description)}</p>
      <div class="card-info">
        <div class="info-item">
          <span class="info-label">📦 ${i18n.t('search.quantity')}</span>
          <span class="info-value">${avail ? escapeHtml(medicine.stock.quantity) + ' ' + i18n.t('search.units') : '—'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">💰 ${i18n.t('search.price')}</span>
          <span class="info-value" style="color:var(--primary);font-size:1.05rem;">
            ${escapeHtml(medicine.pricing.amount)} ${escapeHtml(medicine.pricing.currency)}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">🏥 ${i18n.t('search.pharmacy')}</span>
          <span class="info-value">${escapeHtml(pharmacy.name)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">📍 ${i18n.t('search.address')}</span>
          <span class="info-value" style="font-size:0.85rem;">${escapeHtml(pharmacy.address)}</span>
        </div>
      </div>
      <div class="card-actions">
        ${Nearby.actionButtons(pharmacy)}
        <button class="btn-chip" onclick="openPharmacyPopup('${pharmacy._id}')">🗺️ ${i18n.t('nav.map')}</button>
      </div>
      <div style="display:flex;gap:0.5rem;">
        <a href="${detailUrl}" class="btn-view" style="flex:1;text-align:center;">
          ${i18n.t('search.view_details')}
        </a>
        ${compareCount > 1
          ? `<button class="btn-view btn-compare" data-compare="${escapeHtml(medicine.name)}">⚖️ ${i18n.t('compare.button', { count: compareCount })}</button>`
          : ''}
      </div>
    </div>
  `;
}

// ── Sort & Filter ─────────────────────────────────────────────
function applySortAndFilter(results) {
  let rows = inStockOnly ? results.filter(r => r.medicine.stock.isAvailable) : [...results];
  const dist  = r => Nearby.distanceTo(r.pharmacy.location) ?? Infinity;
  const avail = r => r.medicine.stock.isAvailable ? 1 : 0;

  if (sortMode === 'nearest') {
    rows.sort((a, b) => (avail(b) - avail(a)) || (dist(a) - dist(b)));
  } else if (sortMode === 'cheapest') {
    rows.sort((a, b) => (avail(b) - avail(a)) || (a.medicine.pricing.amount - b.medicine.pricing.amount) || (dist(a) - dist(b)));
  }
  return rows; // 'recommended' keeps the server order (in stock first)
}

function updateSortChips() {
  document.querySelectorAll('.sort-chip[data-sort]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.sort === sortMode);
  });
  document.getElementById('chip-in-stock')?.classList.toggle('active', inStockOnly);
}

async function setSortMode(mode) {
  if (mode === 'nearest' && !Nearby.location) {
    try { await Nearby.request(); }
    catch (err) { return showToast(err.message, 'error'); }
  }
  sortMode = mode;
  updateSortChips();
  renderCards(lastResults);
}

// ── Render Grid ───────────────────────────────────────────────
function renderCards(results) {
  const grid = document.getElementById('medicine-grid');
  if (!grid) return;

  lastResults = results;
  nameCounts = {};
  results.forEach(r => {
    const key = normalizeName(r.medicine.name);
    nameCounts[key] = (nameCounts[key] || 0) + 1;
  });
  results = applySortAndFilter(results);

  if (!results.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:4rem 2rem;color:var(--text-muted);">
        <div style="font-size:4rem;margin-bottom:1rem;">🔍</div>
        <h3 style="color:var(--text-main);margin-bottom:0.5rem;">${i18n.t('search.no_medicine_found')}</h3>
        <p>${i18n.t('search.try_different')}</p>
      </div>`;
    return;
  }
  grid.innerHTML = results.map(createMedicineCard).join('');
}

// ── Search Handler ────────────────────────────────────────────
async function handleSearch(query) {
  const grid = document.getElementById('medicine-grid');
  if (!grid) return;
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">⏳ ${i18n.t('search.searching')}</div>`;
  try {
    const results = await API.search(query);
    renderCards(results);
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--error);">❌ ${escapeHtml(err.message)}</div>`;
  }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('medicine-grid');
  if (!grid) return;
  if (Nearby.location) sortMode = 'nearest';
  updateSortChips();

  // Initial load — all medicines (after translations, so card labels aren't raw keys)
  await i18n.init();
  handleSearch('');

  // Bind search inputs (hero + section)
  const inputs = document.querySelectorAll('.search-bar, #search-input');
  let debounce;
  inputs.forEach(input => {
    input.addEventListener('input', e => {
      inputs.forEach(i => { if (i !== e.target) i.value = e.target.value; });
      clearTimeout(debounce);
      debounce = setTimeout(() => handleSearch(e.target.value), 300);
    });
  });

  // Sort / filter chips
  document.querySelectorAll('.sort-chip[data-sort]').forEach(chip => {
    chip.addEventListener('click', () => setSortMode(chip.dataset.sort));
  });
  document.getElementById('chip-in-stock')?.addEventListener('click', () => {
    inStockOnly = !inStockOnly;
    updateSortChips();
    renderCards(lastResults);
  });

  // Compare buttons (delegated so medicine names never go inside inline JS)
  grid.addEventListener('click', e => {
    const btn = e.target.closest('[data-compare]');
    if (btn) openCompare(btn.dataset.compare);
  });

  // Location found or cleared → jump to nearest-first, or back to the default order
  window.addEventListener('userLocationChanged', e => {
    sortMode = e.detail ? 'nearest' : 'recommended';
    updateSortChips();
    renderCards(lastResults);
  });

  // Listen for language changes to re-render
  window.addEventListener('languageChanged', () => {
    const query = document.getElementById('search-input')?.value || '';
    handleSearch(query);
  });
});

