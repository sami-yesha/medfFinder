/**
 * MedFinder - Location Search Module
 * Finds pharmacies by address text (stored MongoDB data only).
 * Uses Leaflet.js (already loaded) to plot results on the main map.
 */

// ── State ────────────────────────────────────────────────────
let locationMarkers = [];      // Leaflet markers for location results
let locationMapRef  = null;    // Shared reference to mapInstance from map.js

// ── Card Template ────────────────────────────────────────────
function createPharmacyCard(ph, index) {
  const availBadge = ph.availableCount > 0
    ? `<span class="loc-badge loc-badge-avail">✓ ${ph.availableCount} ${i18n.t('location.in_stock')}</span>`
    : `<span class="loc-badge loc-badge-none">${i18n.t('location.no_stock')}</span>`;

  return `
    <div class="loc-card" id="loc-card-${index}" role="listitem">
      <div class="loc-card-header">
        <div>
          <h3 class="loc-card-title">🏥 ${ph.name}</h3>
          <p class="loc-card-address">📍 ${ph.address || i18n.t('location.addr_not_avail')}</p>
        </div>
        ${availBadge}
      </div>
      <div class="loc-card-info">
        <span class="loc-info-item">📞 ${ph.phone || i18n.t('location.phone_not_avail')}</span>
        <span class="loc-info-item">💊 ${ph.medicineCount === 1 ? i18n.t('location.one_med_listed') : i18n.t('location.meds_listed', { count: ph.medicineCount })}</span>
      </div>
      <div class="loc-card-actions">
        <button
          class="loc-btn-map"
          onclick="focusLocationMarker(${index})"
          title="${i18n.t('location.view_on_map')}">
          📍 ${i18n.t('location.view_on_map')}
        </button>
        <a href="/pages/details?pharmacyId=${ph._id}" class="loc-btn-details">
          ${i18n.t('location.view_details')}
        </a>
      </div>
    </div>`;
}

// ── Clear location markers from map ─────────────────────────
function clearLocationMarkers() {
  if (!locationMapRef) return;
  locationMarkers.forEach(m => locationMapRef.removeLayer(m));
  locationMarkers = [];
}

// ── Plot markers for location results ───────────────────────
function plotLocationMarkers(pharmacies) {
  clearLocationMarkers();
  if (!locationMapRef) return;

  const bounds = [];

  pharmacies.forEach((ph, index) => {
    if (!ph.location?.lat || !ph.location?.lng) return;

    const popup = `
      <div style="font-family:Inter,sans-serif;min-width:190px;">
        <h4 style="margin:0 0 .35rem;color:#4f46e5;">🏥 ${ph.name}</h4>
        <p style="margin:0 0 .2rem;font-size:.82rem;color:#64748b;">📍 ${ph.address}</p>
        <p style="margin:0 0 .55rem;font-size:.82rem;color:#64748b;">📞 ${ph.phone || '—'}</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:.55rem;">
        <p style="font-size:.82rem;font-weight:600;">
          💊 ${ph.medicineCount} ${i18n.t('nav.medicines')} &nbsp;|&nbsp;
          <span style="color:${ph.availableCount > 0 ? '#22c55e' : '#ef4444'}">
            ${ph.availableCount > 0 ? '✓ ' + ph.availableCount + ' ' + i18n.t('location.in_stock') : '✗ ' + i18n.t('location.none_in_stock')}
          </span>
        </p>
      </div>`;

    const marker = L.marker([ph.location.lat, ph.location.lng])
      .bindPopup(popup, { maxWidth: 260 })
      .addTo(locationMapRef);

    locationMarkers.push(marker);
    bounds.push([ph.location.lat, ph.location.lng]);
  });

  if (bounds.length > 0) {
    try {
      locationMapRef.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
    } catch (_) {}
  }
}

// ── Focus a specific marker from a card button ───────────────
function focusLocationMarker(index) {
  const marker = locationMarkers[index];
  if (!marker || !locationMapRef) return;
  document.getElementById('pharmacies-section')?.scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => {
    locationMapRef.setView(marker.getLatLng(), 16, { animate: true });
    marker.openPopup();
  }, 400);
}
window.focusLocationMarker = focusLocationMarker;

// ── Render pharmacy cards ────────────────────────────────────
function renderLocationCards(pharmacies, query) {
  const grid = document.getElementById('location-grid');
  const count = document.getElementById('location-count');
  if (!grid) return;

  if (!pharmacies.length) {
    grid.innerHTML = `
      <div class="loc-empty">
        <div class="loc-empty-icon">📍</div>
        <h3>${i18n.t('location.no_pharm_found')}</h3>
        <p>${i18n.t('location.no_results')}</p>
      </div>`;
    if (count) count.textContent = i18n.t('location.found_count', { count: 0 });
    return;
  }

  grid.innerHTML = pharmacies.map((ph, i) => createPharmacyCard(ph, i)).join('');
  if (count) count.textContent = pharmacies.length === 1 ? i18n.t('location.found_one') : i18n.t('location.found_count', { count: pharmacies.length });
}

// ── Main search handler ──────────────────────────────────────
async function handleLocationSearch(query) {
  const grid    = document.getElementById('location-grid');
  const count   = document.getElementById('location-count');
  const spinner = document.getElementById('location-spinner');

  if (!grid) return;

  // Show loading
  if (spinner) spinner.style.display = 'block';
  if (count)   count.textContent = i18n.t('location.searching');
  grid.innerHTML = '';

  try {
    const pharmacies = await API.searchPharmaciesByLocation(query);

    // Wire map ref on first use (map.js must be loaded first)
    if (!locationMapRef && typeof mapInstance !== 'undefined') {
      locationMapRef = mapInstance;
    }

    renderLocationCards(pharmacies, query);
    plotLocationMarkers(pharmacies);

    // Scroll down to map if there are results
    if (pharmacies.length > 0) {
      setTimeout(() => {
        document.getElementById('pharmacies-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 600);
    }
  } catch (err) {
    grid.innerHTML = `<div class="loc-empty"><p style="color:var(--error)">❌ ${err.message}</p></div>`;
    if (count) count.textContent = 'Error';
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const searchBtn   = document.getElementById('loc-search-btn');
  const searchInput = document.getElementById('loc-search-input');
  const clearBtn    = document.getElementById('loc-clear-btn');

  if (!searchBtn || !searchInput) return;

  let debounceTimer = null;
  const DEBOUNCE_MS = 400;

  const doSearch = () => {
    const q = searchInput.value.trim();
    toggleClear();
    if (q) handleLocationSearch(q);
  };

  const toggleClear = () => {
    if (clearBtn) clearBtn.style.display = searchInput.value.trim() ? '' : 'none';
  };

  // Live search as user types (debounced)
  searchInput.addEventListener('input', () => {
    toggleClear();
    clearTimeout(debounceTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) return;          // wait for at least 2 chars
    debounceTimer = setTimeout(() => handleLocationSearch(q), DEBOUNCE_MS);
  });

  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { clearTimeout(debounceTimer); doSearch(); }
  });

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      document.getElementById('location-grid').innerHTML = '';
      document.getElementById('location-count').textContent = '';
      clearLocationMarkers();
      clearBtn.style.display = 'none';
      // Restore all pharmacy markers
      if (typeof initPharmaciesMap === 'function' && !document.getElementById('map')._leaflet_id) {
        initPharmaciesMap();
      }
    });
  }
});
