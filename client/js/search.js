/**
 * MedFinder - Search Module
 * Fetches medicine results from the backend API and renders cards.
 */

// ── Card Template ─────────────────────────────────────────────
function createMedicineCard(result) {
  const { pharmacy, medicine } = result;
  const avail     = medicine.stock.isAvailable;
  const badgeCls  = avail ? 'badge-available' : 'badge-unavailable';
  const badgeTxt  = avail ? `✓ ${i18n.t('search.available')}` : `✗ ${i18n.t('search.out_of_stock')}`;
  const detailUrl = `/pages/details?pharmacyId=${pharmacy._id}&medicineId=${medicine._id}`;

  return `
    <div class="card" role="listitem">
      <div class="card-header">
        <h3 class="card-title">${medicine.name}</h3>
        <span class="badge ${badgeCls}">${badgeTxt}</span>
      </div>
      <p class="card-desc">${medicine.description}</p>
      <div class="card-info">
        <div class="info-item">
          <span class="info-label">📦 ${i18n.t('search.quantity')}</span>
          <span class="info-value">${avail ? medicine.stock.quantity + ' ' + i18n.t('search.units') : '—'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">💰 ${i18n.t('search.price')}</span>
          <span class="info-value" style="color:var(--primary);font-size:1.05rem;">
            ${medicine.pricing.amount} ${medicine.pricing.currency}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">🏥 ${i18n.t('search.pharmacy')}</span>
          <span class="info-value">${pharmacy.name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">📍 ${i18n.t('search.address')}</span>
          <span class="info-value" style="font-size:0.85rem;">${pharmacy.address}</span>
        </div>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
        <a href="${detailUrl}" class="btn-view" style="flex:1;text-align:center;">
          ${i18n.t('search.view_details')}
        </a>
        <button class="btn-view"
          onclick="openPharmacyPopup('${pharmacy.name}')"
          style="flex:0 0 auto;padding:0.75rem 1rem;background:var(--bg-main);color:var(--text-muted);border-color:var(--border);"
          title="View on map">📍</button>
      </div>
    </div>
  `;
}

// ── Render Grid ───────────────────────────────────────────────
function renderCards(results) {
  const grid = document.getElementById('medicine-grid');
  if (!grid) return;

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
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--error);">❌ ${err.message}</div>`;
  }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('medicine-grid')) return;

  // Initial load — all medicines
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

  // Listen for language changes to re-render
  window.addEventListener('languageChanged', () => {
    const query = document.getElementById('search-input')?.value || '';
    handleSearch(query);
  });
});

