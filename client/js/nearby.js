/**
 * MedFinder - Nearby Module
 * User location, distance math, and directions/call links.
 * The location is kept in sessionStorage so the details page can reuse it.
 */

const LOCATION_KEY = 'medfinder_user_location';

const Nearby = {
  /** { lat, lng } or null */
  get location() {
    try { return JSON.parse(sessionStorage.getItem(LOCATION_KEY) || 'null'); }
    catch { return null; }
  },

  setLocation(loc) {
    try {
      if (loc) sessionStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
      else sessionStorage.removeItem(LOCATION_KEY);
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('userLocationChanged', { detail: loc }));
  },

  /** Ask the browser for the user's position; resolves { lat, lng } or rejects with a translated message */
  request() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error(i18n.t('near.unsupported')));
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          this.setLocation(loc);
          resolve(loc);
        },
        () => reject(new Error(i18n.t('near.denied'))),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  },

  /** Great-circle distance in km between two { lat, lng } points (haversine) */
  distanceKm(a, b) {
    if (!a || !b || (!b.lat && !b.lng)) return null;
    const rad = d => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  },

  /** Distance from the user to a pharmacy location, or null when unknown */
  distanceTo(pharmacyLocation) {
    return this.distanceKm(this.location, pharmacyLocation);
  },

  /** "850 m" / "1.2 km" / "35 km" */
  formatDistance(km) {
    if (km == null) return '';
    if (km < 1) return `${Math.max(10, Math.round(km * 100) * 10)} m`;
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  },

  /** Small "1.2 km away" pill, or '' when the user location is unknown */
  distanceBadge(pharmacyLocation) {
    const km = this.distanceTo(pharmacyLocation);
    if (km == null) return '';
    return `<span class="distance-badge">${icon('navigation')} ${i18n.t('near.away', { distance: this.formatDistance(km) })}</span>`;
  },

  /** Google Maps turn-by-turn link (opens the Maps app on phones) */
  directionsUrl(pharmacyLocation) {
    if (!pharmacyLocation?.lat && !pharmacyLocation?.lng) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${pharmacyLocation.lat},${pharmacyLocation.lng}`;
  },

  /** tel: link with only dialable characters, or null */
  telUrl(phone) {
    const digits = String(phone || '').replace(/[^\d+]/g, '');
    return digits ? `tel:${digits}` : null;
  },

  /** Directions + Call buttons for a pharmacy */
  actionButtons(pharmacy) {
    const dir = this.directionsUrl(pharmacy.location);
    const tel = this.telUrl(pharmacy.phone);
    return `
      ${dir ? `<a class="btn-chip" href="${dir}" target="_blank" rel="noopener">${icon('navigation-2')}${i18n.t('near.directions')}</a>` : ''}
      ${tel ? `<a class="btn-chip" href="${tel}">${icon('phone')}${i18n.t('near.call')}</a>` : ''}`;
  },

  /** Drop (or move) a "You are here" marker on a Leaflet map */
  showOnMap(map) {
    const loc = this.location;
    if (!map || !loc) return null;
    if (map._userMarker) map.removeLayer(map._userMarker);
    map._userMarker = L.circleMarker([loc.lat, loc.lng], {
      radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1
    }).bindPopup(`<b>${i18n.t('near.you_are_here')}</b>`).addTo(map);
    return map._userMarker;
  }
};

window.Nearby = Nearby;
