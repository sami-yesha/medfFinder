/**
 * MedFinder - Results Map
 * The map beside the result list. One pin per pharmacy in the current results:
 * the cheapest in-stock price when searching, otherwise the pharmacy name;
 * grey when nothing there is in stock. On phones it opens full screen.
 */

let resultsMap = null;
let resultMarkers = {};   // pharmacy _id → Leaflet marker
let resultBounds = null;  // what to fit when the map is (re)shown

const NEAR_ENOUGH_KM = 30; // include the user in the view only when results are this close

function initResultsMap() {
  const el = document.getElementById('results-map');
  if (!el || resultsMap) return;

  resultsMap = L.map(el, { zoomControl: false }).setView([9.03, 38.74], 12);
  L.control.zoom({ position: 'bottomright' }).addTo(resultsMap);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(resultsMap);
}

function pharmacyPopup(pharmacy, rows) {
  const km = Nearby.distanceTo(pharmacy.location);
  const meds = rows.slice(0, 5).map(r => `
    <li class="${r.medicine.stock.isAvailable ? '' : 'is-out'}">
      <span>${escapeHtml(r.medicine.name)}</span>
      <b>${escapeHtml(r.medicine.pricing.amount)} ${escapeHtml(r.medicine.pricing.currency)}</b>
    </li>`).join('');

  return `
    <div class="ds-popup">
      <strong>${escapeHtml(pharmacy.name)}</strong>
      <p>${escapeHtml(pharmacy.address || '')}${km != null ? ` · ${Nearby.formatDistance(km)}` : ''}</p>
      <ul>${meds}</ul>
      <div class="ds-popup-actions">${Nearby.actionButtons(pharmacy)}</div>
    </div>`;
}

function fitResults() {
  if (resultsMap && resultBounds?.length) {
    resultsMap.fitBounds(resultBounds, { padding: [48, 48], maxZoom: 15 });
  }
}

/** Redraw pins for the rows currently shown in the list */
function updateResultsMap(rows, { showPrices = false } = {}) {
  initResultsMap();
  if (!resultsMap) return;

  Object.values(resultMarkers).forEach(m => resultsMap.removeLayer(m));
  resultMarkers = {};

  // Group the rows by pharmacy
  const byPharmacy = new Map();
  rows.forEach(r => {
    if (!r.pharmacy.location?.lat && !r.pharmacy.location?.lng) return;
    if (!byPharmacy.has(r.pharmacy._id)) byPharmacy.set(r.pharmacy._id, { pharmacy: r.pharmacy, rows: [] });
    byPharmacy.get(r.pharmacy._id).rows.push(r);
  });

  const points = [];
  byPharmacy.forEach(({ pharmacy, rows: pharmacyRows }) => {
    const inStock = pharmacyRows.filter(r => r.medicine.stock.isAvailable);
    const cheapest = [...inStock].sort((a, b) => a.medicine.pricing.amount - b.medicine.pricing.amount)[0];
    const label = showPrices && cheapest
      ? `${escapeHtml(cheapest.medicine.pricing.amount)} ${escapeHtml(cheapest.medicine.pricing.currency)}`
      : escapeHtml(pharmacy.name);

    const marker = L.marker([pharmacy.location.lat, pharmacy.location.lng], {
      icon: L.divIcon({
        className: '', iconSize: null, iconAnchor: [0, 0],
        html: `<div class="ds-price-pin ${inStock.length ? '' : 'is-out'}">${label}</div>`
      }),
      riseOnHover: true
    })
      .bindPopup(() => pharmacyPopup(pharmacy, pharmacyRows), { maxWidth: 280, offset: [0, -30] })
      .addTo(resultsMap);

    resultMarkers[pharmacy._id] = marker;
    points.push([pharmacy.location.lat, pharmacy.location.lng]);
  });

  // Show the user too, but only if they're near the results (else the map zooms out to the whole country)
  Nearby.showOnMap(resultsMap);
  const loc = Nearby.location;
  const nearest = loc ? Math.min(...points.map(([lat, lng]) => Nearby.distanceKm(loc, { lat, lng }))) : Infinity;
  if (loc && nearest <= NEAR_ENOUGH_KM) points.push([loc.lat, loc.lng]);

  resultBounds = points;
  fitResults();
}

// ── Phone: full-screen map toggled by the floating button ────
function setMapPanelOpen(open) {
  const panel = document.getElementById('map-panel');
  const fab   = document.getElementById('map-fab');
  if (!panel) return;
  panel.classList.toggle('open', open);
  fab?.classList.toggle('is-open', open);
  document.body.classList.toggle('ds-map-open', open);
  // A map laid out while hidden has no size: recompute, then refit
  setTimeout(() => { resultsMap?.invalidateSize(); if (open) fitResults(); }, 60);
}

const isPhoneLayout = () => window.matchMedia('(max-width: 960px)').matches;

/** Called from a card's map button */
function focusPharmacyOnMap(pharmacyId) {
  const marker = resultMarkers[pharmacyId];
  if (!marker) return;
  if (isPhoneLayout()) setMapPanelOpen(true);
  setTimeout(() => {
    resultsMap.setView(marker.getLatLng(), 16, { animate: true });
    marker.openPopup();
  }, isPhoneLayout() ? 120 : 0);
}

document.addEventListener('DOMContentLoaded', () => {
  initResultsMap();
  document.getElementById('map-fab')?.addEventListener('click', () => {
    setMapPanelOpen(!document.getElementById('map-panel').classList.contains('open'));
  });
  // Leaving the phone layout while the map is open: put things back
  window.matchMedia('(max-width: 960px)').addEventListener('change', e => { if (!e.matches) setMapPanelOpen(false); });
  window.addEventListener('userLocationChanged', () => Nearby.showOnMap(resultsMap));

  // Only offer the floating map button while the results list is on screen
  const results = document.getElementById('results');
  const fab = document.getElementById('map-fab');
  if (results && fab && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => fab.classList.toggle('is-visible', entry.isIntersecting)).observe(results);
  } else {
    fab?.classList.add('is-visible');
  }
});

window.updateResultsMap = updateResultsMap;
window.focusPharmacyOnMap = focusPharmacyOnMap;
