/**
 * MedFinder - API Client Module
 * All fetch() calls to the Express backend live here.
 * Uses relative base URL so it works regardless of port.
 */

const BASE = '/api';

/** Generic fetch wrapper with error handling */
async function request(endpoint, options = {}) {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ── Pharmacies ────────────────────────────────────────────────
const API = {
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

  // One-time database seed
  seed: () => request('/pharmacies/seed')
};

// Make API globally available (all pages include this file)
window.API = API;
