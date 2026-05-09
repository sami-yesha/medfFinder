/**
 * MedFinder - Map Module
 * Leaflet.js integration: pharmacy markers fetched from API.
 */

let mapInstance = null;
const pharmacyMarkers = {}; // name → Leaflet marker

// ── Main Pharmacies Map (home page) ───────────────────────────
async function initPharmaciesMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl || mapInstance) return;

  mapInstance = L.map('map').setView([9.03, 38.74], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(mapInstance);

  try {
    const pharmacies = await API.getPharmacies();
    pharmacies.forEach(ph => {
      if (!ph.location?.lat || !ph.location?.lng) return;

      const available = ph.medicines.filter(m => m.stock.isAvailable);
      const medList = available.length
        ? available.map(m => `<li>💊 ${m.name} — <b>${m.pricing.amount} ${m.pricing.currency}</b></li>`).join('')
        : '<li style="color:#ef4444">No medicines in stock</li>';

      const popup = `
        <div style="font-family:Inter,sans-serif;min-width:200px;">
          <h4 style="margin:0 0 .4rem;color:#4f46e5;">🏥 ${ph.name}</h4>
          <p style="margin:0 0 .2rem;font-size:.85rem;color:#64748b;">📍 ${ph.address}</p>
          <p style="margin:0 0 .7rem;font-size:.85rem;color:#64748b;">📞 ${ph.phone}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:.7rem;">
          <p style="font-weight:600;font-size:.85rem;margin-bottom:.4rem;">Available Medicines:</p>
          <ul style="margin:0;padding:0;list-style:none;font-size:.85rem;">${medList}</ul>
        </div>`;

      const marker = L.marker([ph.location.lat, ph.location.lng])
        .bindPopup(popup, { maxWidth: 280 })
        .addTo(mapInstance);

      pharmacyMarkers[ph.name] = marker;
    });
  } catch (err) {
    console.error('Map load error:', err.message);
  }
}

/** Called from search cards' "View on Map" button */
function openPharmacyPopup(name) {
  const marker = pharmacyMarkers[name];
  if (marker && mapInstance) {
    document.getElementById('pharmacies-section')?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
      mapInstance.setView(marker.getLatLng(), 15, { animate: true });
      marker.openPopup();
    }, 400);
  }
}

// ── Detail Page Mini-Map ───────────────────────────────────────
function initDetailMap(lat, lng, pharmacyName) {
  const el = document.getElementById('detail-map');
  if (!el) return;
  const m = L.map('detail-map').setView([lat, lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(m);
  L.marker([lat, lng]).bindPopup(`<b>🏥 ${pharmacyName}</b>`).addTo(m).openPopup();
}

// ── Admin Location Picker Map ─────────────────────────────────
function initLocationPickerMap(initLat, initLng) {
  const el = document.getElementById('location-picker-map');
  if (!el) return null;

  // Destroy previous instance
  if (el._leaflet_id) { el._leaflet_id = null; el.innerHTML = ''; }

  const lat  = initLat || 9.03;
  const lng  = initLng || 38.74;
  const zoom = (initLat && initLng) ? 15 : 13;

  const picker = L.map('location-picker-map').setView([lat, lng], zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(picker);

  let marker = null;
  if (initLat && initLng) {
    marker = L.marker([initLat, initLng]).addTo(picker);
    updateCoordDisplay(initLat, initLng);
  }

  picker.on('click', e => {
    const { lat, lng } = e.latlng;
    if (marker) picker.removeLayer(marker);
    marker = L.marker([lat, lng]).addTo(picker);
    document.getElementById('med-lat').value = lat.toFixed(6);
    document.getElementById('med-lng').value = lng.toFixed(6);
    updateCoordDisplay(lat, lng);
  });

  return picker;
}

function updateCoordDisplay(lat, lng) {
  const el = document.getElementById('coord-display');
  if (el) {
    el.textContent = `📍 Selected: ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
    el.style.color = 'var(--secondary)';
  }
}

// ── Auto-init on home page ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('map')) initPharmaciesMap();
});
