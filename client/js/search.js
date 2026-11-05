/**
 * MedFinder - Search Module
 * Fetches medicine results from the backend API, renders result cards,
 * and keeps the results map in sync.
 */

const LOW_STOCK_THRESHOLD = 10; // units at or below this show "Low stock"

// ── State ─────────────────────────────────────────────────────
let lastResults  = [];            // Raw results from the last search
let lastQuery    = '';
let sortMode     = 'recommended'; // 'recommended' | 'nearest' | 'cheapest'
let inStockOnly  = false;
let nameCounts   = {};            // normalized medicine name → pharmacies listing it
let cheapestIds  = new Set();     // medicine _ids that are the cheapest in-stock offer for their name
let searchSeq    = 0;             // ignores responses from searches that were superseded
let popularShown = false;         // popular searches are built once, from the first full listing

const POPULAR_COUNT = 4;

// ── Card Template ─────────────────────────────────────────────
function stockPill(medicine) {
  if (!medicine.stock.isAvailable) {
    return `<span class="ds-pill ds-pill-bad">${icon('x')}${i18n.t('stock.out')}</span>`;
  }
  if (medicine.stock.quantity <= LOW_STOCK_THRESHOLD) {
    return `<span class="ds-pill ds-pill-warn">${icon('triangle-alert')}${i18n.t('stock.low')}</span>`;
  }
  return `<span class="ds-pill ds-pill-ok">${icon('check')}${i18n.t('stock.in')}</span>`;
}

function createMedicineCard(result) {
  const { pharmacy, medicine } = result;
  const avail        = medicine.stock.isAvailable;
  const detailUrl    = `/pages/details?pharmacyId=${pharmacy._id}&medicineId=${medicine._id}`;
  const compareCount = nameCounts[normalizeName(medicine.name)] || 0;
  const km           = Nearby.distanceTo(pharmacy.location);
  const directions   = Nearby.directionsUrl(pharmacy.location);
  const tel          = Nearby.telUrl(pharmacy.phone);
  const area         = pharmacy.address ? ` · ${escapeHtml(pharmacy.address)}` : '';

  return `
    <article class="ds-card ${avail ? '' : 'is-out'}" role="listitem">
      <h3 class="ds-card-name">${escapeHtml(medicine.name)}</h3>
      <div class="ds-card-price"><b>${escapeHtml(medicine.pricing.amount)}</b><small>${escapeHtml(medicine.pricing.currency)}</small></div>
      <div class="ds-card-pharmacy">${icon('store')}<span><strong>${escapeHtml(pharmacy.name)}</strong>${area}</span></div>
      <div class="ds-card-meta">
        ${stockPill(medicine)}
        ${km != null ? `<span class="ds-pill ds-pill-info">${icon('navigation')}${Nearby.formatDistance(km)}</span>` : ''}
        ${cheapestIds.has(medicine._id) ? `<span class="ds-pill ds-pill-brand">${icon('trophy')}${i18n.t('compare.cheapest')}</span>` : ''}
      </div>
      <div class="ds-card-actions">
        ${directions ? `<a class="ds-btn ds-btn-ghost ds-btn-sm" href="${directions}" target="_blank" rel="noopener">${icon('navigation-2')}${i18n.t('near.directions')}</a>` : ''}
        ${tel ? `<a class="ds-btn ds-btn-ghost ds-btn-sm ds-btn-icon" href="${tel}" aria-label="${i18n.t('near.call')}" title="${i18n.t('near.call')}">${icon('phone')}</a>` : ''}
        <button class="ds-btn ds-btn-ghost ds-btn-sm ds-btn-icon" data-map="${pharmacy._id}" aria-label="${i18n.t('map.show_map')}" title="${i18n.t('map.show_map')}">${icon('map')}</button>
        <a class="ds-link" href="${detailUrl}">${i18n.t('card.details')}${icon('chevron-right')}</a>
        <span class="ds-spacer"></span>
        ${compareCount > 1
          ? `<button class="ds-btn ds-btn-soft ds-btn-sm" data-compare="${escapeHtml(medicine.name)}">${icon('scale')}${i18n.t('compare.prices', { count: compareCount })}</button>`
          : ''}
      </div>
    </article>`;
}

function skeletonCards(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="ds-card ds-skeleton" aria-hidden="true">
      <span class="ds-sk ds-sk-title"></span><span class="ds-sk ds-sk-price"></span>
      <span class="ds-sk ds-sk-line"></span>
      <span class="ds-sk ds-sk-pills"></span>
    </div>`).join('');
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
  document.querySelectorAll('.ds-chip[data-sort]').forEach(chip => {
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

function updateResultsHeader(count) {
  const title = document.getElementById('results-title');
  const total = document.getElementById('results-count');
  if (title) {
    title.textContent = lastQuery
      ? i18n.t('results.for', { query: lastQuery })
      : (Nearby.location ? i18n.t('results.near_you') : i18n.t('results.all'));
  }
  if (total) total.textContent = count === 1 ? i18n.t('results.count_one') : i18n.t('results.count', { count });
}

// ── Render List ───────────────────────────────────────────────
function renderCards(results) {
  const grid = document.getElementById('medicine-grid');
  if (!grid) return;

  lastResults = results;
  nameCounts = {};
  const cheapestByName = {};
  results.forEach(r => {
    const key = normalizeName(r.medicine.name);
    nameCounts[key] = (nameCounts[key] || 0) + 1;
    if (r.medicine.stock.isAvailable && (!cheapestByName[key] || r.medicine.pricing.amount < cheapestByName[key].pricing.amount)) {
      cheapestByName[key] = r.medicine;
    }
  });
  // Only tag "Cheapest" when there's something to be cheaper than
  cheapestIds = new Set(Object.entries(cheapestByName)
    .filter(([key]) => nameCounts[key] > 1)
    .map(([, med]) => med._id));

  if (!popularShown && !lastQuery) {
    popularShown = true;
    renderPopular(results);
  }

  results = applySortAndFilter(results);
  updateResultsHeader(results.length);
  if (typeof updateResultsMap === 'function') updateResultsMap(results, { showPrices: !!lastQuery });

  if (!results.length) {
    grid.innerHTML = `
      <div class="ds-empty">
        <span class="ds-empty-icon">${icon('search-x')}</span>
        <h3>${i18n.t('search.no_medicine_found')}</h3>
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
  const seq = ++searchSeq;
  lastQuery = query.trim();
  grid.innerHTML = skeletonCards();
  try {
    const results = await API.search(lastQuery);
    if (seq === searchSeq) renderCards(results);
  } catch (err) {
    if (seq === searchSeq) {
      grid.innerHTML = `<div class="ds-empty ds-empty-error"><span class="ds-empty-icon">${icon('x')}</span><p>${escapeHtml(err.message)}</p></div>`;
    }
  }
}

/**
 * "Popular:" shortcuts from the medicines actually in the database —
 * the names stocked by the most pharmacies — so every shortcut leads to results.
 */
function renderPopular(results) {
  const box  = document.getElementById('popular');
  const list = document.getElementById('popular-list');
  if (!box || !list) return;

  const byName = new Map();
  results.forEach(r => {
    const key = normalizeName(r.medicine.name);
    const entry = byName.get(key) || { name: r.medicine.name.trim(), pharmacies: 0, inStock: 0 };
    entry.pharmacies++;
    if (r.medicine.stock.isAvailable) entry.inStock++;
    byName.set(key, entry);
  });

  const top = [...byName.values()]
    .filter(e => e.inStock > 0)
    .sort((a, b) => (b.pharmacies - a.pharmacies) || (b.inStock - a.inStock) || a.name.localeCompare(b.name))
    .slice(0, POPULAR_COUNT);

  // Show names capitalized ("paracetamol" → "Paracetamol"); search is case-insensitive anyway
  const label = name => name.charAt(0).toUpperCase() + name.slice(1);
  list.innerHTML = top.map(e => `<button type="button" data-popular="${escapeHtml(e.name)}">${escapeHtml(label(e.name))}</button>`).join('');
  box.hidden = top.length === 0;
}

/** Put a query in the search box and run it (used by popular chips and the scan modal) */
function searchFor(query) {
  const input = document.getElementById('hero-search');
  if (input) input.value = query;
  handleSearch(query);
  document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
}
window.searchFor = searchFor;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('medicine-grid');
  if (!grid) return;
  if (Nearby.location) sortMode = 'nearest';
  updateSortChips();
  grid.innerHTML = skeletonCards();

  // Initial load — all medicines (after translations, so card labels aren't raw keys)
  await i18n.init();
  handleSearch('');

  const input = document.getElementById('hero-search');
  let debounce;
  input?.addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => handleSearch(e.target.value), 300);
  });
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      clearTimeout(debounce);
      handleSearch(input.value);
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  document.getElementById('popular-list')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-popular]');
    if (btn) searchFor(btn.dataset.popular);
  });

  // Sort / filter chips
  document.querySelectorAll('.ds-chip[data-sort]').forEach(chip => {
    chip.addEventListener('click', () => setSortMode(chip.dataset.sort));
  });
  document.getElementById('chip-in-stock')?.addEventListener('click', () => {
    inStockOnly = !inStockOnly;
    updateSortChips();
    renderCards(lastResults);
  });

  // Card buttons (delegated so names never go inside inline JS)
  grid.addEventListener('click', e => {
    const compareBtn = e.target.closest('[data-compare]');
    if (compareBtn) return openCompare(compareBtn.dataset.compare);
    const mapBtn = e.target.closest('[data-map]');
    if (mapBtn) focusPharmacyOnMap(mapBtn.dataset.map);
  });

  // Location found or cleared → jump to nearest-first, or back to the default order
  window.addEventListener('userLocationChanged', e => {
    sortMode = e.detail ? 'nearest' : 'recommended';
    updateSortChips();
    renderCards(lastResults);
  });

  // Re-render in the new language without refetching
  window.addEventListener('languageChanged', () => renderCards(lastResults));
});
