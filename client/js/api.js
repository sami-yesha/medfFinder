/**
 * MedFinder - API Client Module
 * All fetch() calls to the Express backend live here.
 * Uses relative base URL so it works regardless of port.
 */

const BASE = '/api';

const SESSION_KEY = 'medfinder_admin';

/** Admin session saved by the login page: { email, token } */
function getAdminSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}

/** Generic fetch wrapper with error handling */
async function request(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const session = getAdminSession();
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  const res = await fetch(`${BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    // Expired or invalid admin token — drop it and send admins back to login
    if (res.status === 401 && session?.token) {
      sessionStorage.removeItem(SESSION_KEY);
      if (window.location.pathname.startsWith('/pages/admin')) window.location.href = '/pages/login';
    }
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

// ── Pharmacies ────────────────────────────────────────────────
const API = {
  // Admin login → { token, email, expiresIn }
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),

  // Get all pharmacies (with their medicines[])
  getPharmacies: () => request('/pharmacies'),

  // Get one pharmacy by ID
  getPharmacyById: (id) => request(`/pharmacies/${id}`),

  // Create a new pharmacy
  createPharmacy: (data) => request('/pharmacies', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Update pharmacy info (name, address, phone, location)
  updatePharmacy: (id, data) => request(`/pharmacies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  // Delete a pharmacy (and all its medicines)
  deletePharmacy: (id) => request(`/pharmacies/${id}`, { method: 'DELETE' }),

  // ── Medicines ─────────────────────────────────────────────
  // Add medicine to a pharmacy
  addMedicine: (pharmacyId, data) => request(`/pharmacies/${pharmacyId}/medicines`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Update a medicine inside a pharmacy
  updateMedicine: (pharmacyId, medicineId, data) =>
    request(`/pharmacies/${pharmacyId}/medicines/${medicineId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Delete a medicine from a pharmacy
  deleteMedicine: (pharmacyId, medicineId) =>
    request(`/pharmacies/${pharmacyId}/medicines/${medicineId}`, { method: 'DELETE' }),

  // ── Search ────────────────────────────────────────────────
  // Cross-pharmacy medicine search → [{pharmacy, medicine}]
  search: (query = '') => request(`/search?medicine=${encodeURIComponent(query)}`),

  // Location-based pharmacy search → [{_id, name, address, phone, location, medicineCount, availableCount}]
  searchPharmaciesByLocation: (query = '') => request(`/pharmacies/search?query=${encodeURIComponent(query)}`),

  // One-time database seed (admin only)
  seed: () => request('/pharmacies/seed', { method: 'POST' })
};

// Make API globally available (all pages include this file)
window.API = API;
window.getAdminSession = getAdminSession;
