/**
 * MedFinder - Price Comparison Module
 * Compares one medicine's price, stock and distance across all pharmacies.
 * Used as a modal on the home page and inline on the details page.
 */

const normalizeName = (name) => String(name || '').trim().toLowerCase();

/** All pharmacies listing exactly this medicine name → [{ pharmacy, medicine, distance }] */
async function fetchComparison(medicineName) {
  const results = await API.search(medicineName);
  const target = normalizeName(medicineName);
  return results
    .filter(r => normalizeName(r.medicine.name) === target)
    .map(r => ({ ...r, distance: Nearby.distanceTo(r.pharmacy.location) }));
}

/** In stock first, then cheapest; distance breaks price ties */
function sortComparison(rows) {
  return [...rows].sort((a, b) =>
    (b.medicine.stock.isAvailable - a.medicine.stock.isAvailable) ||
    (a.medicine.pricing.amount - b.medicine.pricing.amount) ||
    ((a.distance ?? Infinity) - (b.distance ?? Infinity))
  );
}

const formatPrice = (pricing) => `${escapeHtml(pricing.amount)} ${escapeHtml(pricing.currency)}`;

/** HTML for the comparison: summary line + one row per pharmacy */
function renderComparison(rows, { currentPharmacyId = null } = {}) {
  const sorted  = sortComparison(rows);
  const inStock = sorted.filter(r => r.medicine.stock.isAvailable);

  const cheapest = inStock[0];
  const nearest  = inStock.filter(r => r.distance != null).sort((a, b) => a.distance - b.distance)[0];
  const savings  = inStock.length > 1 ? inStock[inStock.length - 1].medicine.pricing.amount - cheapest.medicine.pricing.amount : 0;

  const summary = cheapest
    ? `<div class="compare-summary">
        <strong>${i18n.t('compare.summary', { price: formatPrice(cheapest.medicine.pricing), pharmacy: escapeHtml(cheapest.pharmacy.name) })}</strong>
        ${savings > 0 ? `<span>💰 ${i18n.t('compare.save', { amount: `${escapeHtml(savings)} ${escapeHtml(cheapest.medicine.pricing.currency)}` })}</span>` : ''}
      </div>`
    : `<div class="compare-summary compare-summary-empty">${i18n.t('compare.none_in_stock')}</div>`;

  const row = (r) => {
    const avail = r.medicine.stock.isAvailable;
    const tags = [
      r === cheapest && inStock.length > 1 ? `<span class="compare-tag tag-cheapest">${i18n.t('compare.cheapest')}</span>` : '',
      r === nearest  && inStock.length > 1 ? `<span class="compare-tag tag-nearest">${i18n.t('compare.nearest')}</span>` : '',
      r.pharmacy._id === currentPharmacyId ? `<span class="compare-tag tag-current">${i18n.t('compare.this_pharmacy')}</span>` : ''
    ].join('');

    return `
      <div class="compare-row ${avail ? '' : 'compare-row-out'}">
        <div class="compare-main">
          <div class="compare-pharmacy">🏥 ${escapeHtml(r.pharmacy.name)} ${tags}</div>
          <div class="compare-meta">
            ${r.pharmacy.address ? `📍 ${escapeHtml(r.pharmacy.address)}` : ''}
            ${r.distance != null ? ` · <strong>${i18n.t('near.away', { distance: Nearby.formatDistance(r.distance) })}</strong>` : ''}
          </div>
          <div class="compare-actions">
            ${Nearby.actionButtons(r.pharmacy)}
            ${r.pharmacy._id !== currentPharmacyId
              ? `<a class="btn-chip" href="/pages/details?pharmacyId=${r.pharmacy._id}&medicineId=${r.medicine._id}">${i18n.t('search.view_details')}</a>`
              : ''}
          </div>
        </div>
        <div class="compare-price-col">
          <div class="compare-price">${formatPrice(r.medicine.pricing)}</div>
          <span class="badge ${avail ? 'badge-available' : 'badge-unavailable'}">
            ${avail ? '✓ ' + i18n.t('search.available') : '✗ ' + i18n.t('search.out_of_stock')}
          </span>
        </div>
      </div>`;
  };

  return `${summary}<div class="compare-list">${sorted.map(row).join('')}</div>
    <p class="compare-disclaimer">ℹ️ ${i18n.t('compare.disclaimer')}</p>`;
}

// ── Modal (home page) ─────────────────────────────────────────
function ensureCompareModal() {
  let overlay = document.getElementById('compare-modal');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'compare-modal';
  overlay.className = 'compare-overlay';
  overlay.innerHTML = `
    <div class="compare-modal" role="dialog" aria-modal="true" aria-labelledby="compare-title">
      <div class="compare-modal-header">
        <h2 id="compare-title"></h2>
        <button class="compare-close" aria-label="Close">✕</button>
      </div>
      <div id="compare-body"></div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.style.display = 'none';
    // Keep the page locked if another modal (scan) is still open underneath
    if (![...document.querySelectorAll('.compare-overlay')].some(o => o.style.display === 'flex')) document.body.style.overflow = '';
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('.compare-close').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.style.display === 'flex') close(); });
  return overlay;
}

async function openCompare(medicineName) {
  const overlay = ensureCompareModal();
  const body = overlay.querySelector('#compare-body');
  overlay.querySelector('#compare-title').textContent = i18n.t('compare.title', { name: medicineName });
  body.innerHTML = `<p class="compare-loading">⏳ ${i18n.t('search.searching')}</p>`;
  document.body.appendChild(overlay); // move to front, e.g. when opened from the scan results
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  try {
    body.innerHTML = renderComparison(await fetchComparison(medicineName));
  } catch (err) {
    body.innerHTML = `<p class="compare-loading" style="color:var(--error)">❌ ${escapeHtml(err.message)}</p>`;
  }
}

window.openCompare = openCompare;
window.fetchComparison = fetchComparison;
window.renderComparison = renderComparison;
