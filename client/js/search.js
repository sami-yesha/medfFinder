/**
 * MedFinder - Search Module
 * Fetches medicine results from the backend API and renders cards.
 */

// ── Card Template ─────────────────────────────────────────────
function createMedicineCard(result) {
  const { pharmacy, medicine } = result;
  const avail     = medicine.stock.isAvailable;
  const badgeCls  = avail ? 'badge-available' : 'badge-unavailable';
  const badgeTxt  = avail ? '✓ Available' : '✗ Out of Stock';
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
          <span class="info-label">📦 Quantity</span>
          <span class="info-value">${avail ? medicine.stock.quantity + ' units' : '—'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">💰 Price</span>
          <span class="info-value" style="color:var(--primary);font-size:1.05rem;">
            ${medicine.pricing.amount} ${medicine.pricing.currency}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">🏥 Pharmacy</span>
          <span class="info-value">${pharmacy.name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">📍 Address</span>
          <span class="info-value" style="font-size:0.85rem;">${pharmacy.address}</span>
        </div>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
        <a href="${detailUrl}" class="btn-view" style="flex:1;text-align:center;">
          View Details →
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
        <h3 style="color:var(--text-main);margin-bottom:0.5rem;">No Medicine Found</h3>
        <p>Try a different search term.</p>
      </div>`;
    return;
  }
  grid.innerHTML = results.map(createMedicineCard).join('');
}

// ── Search Handler ────────────────────────────────────────────
async function handleSearch(query) {
  const grid = document.getElementById('medicine-grid');
  if (!grid) return;
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">⏳ Searching...</div>`;
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
});
