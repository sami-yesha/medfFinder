/**
 * MedFinder - Admin Module
 * Two-section dashboard: Pharmacy management + Medicine management.
 * All CRUD goes through the backend API (no localStorage).
 */

// ── State ─────────────────────────────────────────────────────
let selectedPharmacy = null;   // The pharmacy whose medicines are being managed
let editingPharmacyId = null;  // ID when editing a pharmacy
let editingMedicineId = null;  // ID when editing a medicine
let pickerMap = null;          // Leaflet location picker instance

// ══ PHARMACY SECTION ═════════════════════════════════════════

async function loadPharmacies() {
  const tbody = document.getElementById('pharmacy-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">⏳ Loading...</td></tr>`;

  try {
    const pharmacies = await API.getPharmacies();
    updateStats(pharmacies);

    if (!pharmacies.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:3rem;color:var(--text-muted);">
        <div style="font-size:2rem;margin-bottom:.5rem;">🏥</div>
        <p>No pharmacies yet. Click "Add Pharmacy" to get started.</p>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = pharmacies.map(ph => `
      <tr>
        <td><strong>${ph.name}</strong></td>
        <td style="font-size:.85rem;color:var(--text-muted);">${ph.address}</td>
        <td>${ph.phone || '—'}</td>
        <td><span class="badge badge-available">${ph.medicines.length} medicines</span></td>
        <td>
          <div class="actions">
            <button class="btn-action btn-edit"   onclick="openPharmacyModal('${ph._id}')" title="Edit">✏️</button>
            <button class="btn-action"
              onclick="openMedicinesPanel('${ph._id}')"
              style="color:var(--primary);border-color:var(--primary);"
              title="Manage Medicines">💊</button>
            <button class="btn-action btn-delete" onclick="handleDeletePharmacy('${ph._id}','${ph.name}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--error);">❌ ${err.message}</td></tr>`;
  }
}

function updateStats(pharmacies) {
  const totalMeds = pharmacies.reduce((s, p) => s + p.medicines.length, 0);
  const available = pharmacies.reduce((s, p) => s + p.medicines.filter(m => m.stock.isAvailable).length, 0);
  document.getElementById('stat-pharmacies').textContent = pharmacies.length;
  document.getElementById('stat-total').textContent      = totalMeds;
  document.getElementById('stat-avail').textContent      = available;
  document.getElementById('stat-out').textContent        = totalMeds - available;
}

// ── Pharmacy Modal ────────────────────────────────────────────
async function openPharmacyModal(id = null) {
  editingPharmacyId = id;
  document.getElementById('pharmacy-modal-title').textContent = id ? 'Edit Pharmacy' : 'Add Pharmacy';
  document.getElementById('ph-name').value    = '';
  document.getElementById('ph-address').value = '';
  document.getElementById('ph-phone').value   = '';
  document.getElementById('ph-lat').value     = '';
  document.getElementById('ph-lng').value     = '';

  let initLat = null, initLng = null;
  if (id) {
    try {
      const ph = await API.getPharmacyById(id);
      document.getElementById('ph-name').value    = ph.name;
      document.getElementById('ph-address').value = ph.address;
      document.getElementById('ph-phone').value   = ph.phone;
      document.getElementById('ph-lat').value     = ph.location?.lat || '';
      document.getElementById('ph-lng').value     = ph.location?.lng || '';
      initLat = ph.location?.lat; initLng = ph.location?.lng;
    } catch (err) { showToast(err.message, 'error'); return; }
  }

  document.getElementById('pharmacy-modal').style.display = 'flex';
  requestAnimationFrame(() => { pickerMap = initLocationPickerMap(initLat, initLng); });
}

function closePharmacyModal() {
  document.getElementById('pharmacy-modal').style.display = 'none';
  document.getElementById('pharmacy-form').reset();
  if (pickerMap) { pickerMap.remove(); pickerMap = null; }
  const el = document.getElementById('location-picker-map');
  if (el) el.innerHTML = '';
  editingPharmacyId = null;
}

async function handlePharmacySubmit(e) {
  e.preventDefault();
  const data = {
    name:     document.getElementById('ph-name').value.trim(),
    address:  document.getElementById('ph-address').value.trim(),
    phone:    document.getElementById('ph-phone').value.trim(),
    location: {
      lat: parseFloat(document.getElementById('ph-lat').value) || 0,
      lng: parseFloat(document.getElementById('ph-lng').value) || 0
    }
  };
  if (!data.name) return showToast('Pharmacy name is required.', 'error');
  if (!data.location.lat && !data.location.lng) return showToast('Please select a location on the map.', 'error');

  try {
    if (editingPharmacyId) {
      await API.updatePharmacy(editingPharmacyId, data);
      showToast(`"${data.name}" updated! ✅`);
    } else {
      await API.createPharmacy(data);
      showToast(`"${data.name}" created! ✅`);
    }
    closePharmacyModal();
    loadPharmacies();
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleDeletePharmacy(id, name) {
  if (!confirm(`Delete "${name}" and ALL its medicines?`)) return;
  try {
    await API.deletePharmacy(id);
    showToast(`"${name}" deleted.`);
    if (selectedPharmacy?._id === id) closeMedicinesPanel();
    loadPharmacies();
  } catch (err) { showToast(err.message, 'error'); }
}

// ══ MEDICINE SECTION ═════════════════════════════════════════

async function openMedicinesPanel(pharmacyId) {
  try {
    selectedPharmacy = await API.getPharmacyById(pharmacyId);
  } catch (err) { return showToast(err.message, 'error'); }

  document.getElementById('section-pharmacies').style.display = 'none';
  document.getElementById('section-medicines').style.display  = 'block';
  document.getElementById('med-section-title').textContent    = selectedPharmacy.name;
  renderMedicinesTable(selectedPharmacy.medicines);
}

function closeMedicinesPanel() {
  selectedPharmacy = null;
  document.getElementById('section-medicines').style.display  = 'none';
  document.getElementById('section-pharmacies').style.display = 'block';
}

function renderMedicinesTable(medicines) {
  const tbody = document.getElementById('medicine-tbody');
  if (!tbody) return;

  if (!medicines.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:3rem;color:var(--text-muted);">
      <div style="font-size:2rem;margin-bottom:.5rem;">💊</div>
      <p>No medicines yet. Click "Add Medicine".</p>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = medicines.map(m => `
    <tr>
      <td><strong>${m.name}</strong><br><small style="color:var(--text-muted);">${m.description}</small></td>
      <td><span class="badge ${m.stock.isAvailable ? 'badge-available' : 'badge-unavailable'}">
        ${m.stock.isAvailable ? '✓ Available' : '✗ Out of Stock'}
      </span></td>
      <td>${m.stock.quantity}</td>
      <td><strong>${m.pricing.amount} ${m.pricing.currency}</strong></td>
      <td>
        <div class="actions">
          <button class="btn-action btn-edit"   onclick="openMedicineModal('${m._id}')" title="Edit">✏️</button>
          <button class="btn-action btn-delete" onclick="handleDeleteMedicine('${m._id}','${m.name}')" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Medicine Modal ────────────────────────────────────────────
function openMedicineModal(medicineId = null) {
  editingMedicineId = medicineId;
  document.getElementById('medicine-modal-title').textContent = medicineId ? 'Edit Medicine' : 'Add Medicine';

  if (medicineId) {
    const m = selectedPharmacy.medicines.find(x => x._id === medicineId);
    if (!m) return;
    document.getElementById('med-name').value        = m.name;
    document.getElementById('med-description').value = m.description;
    document.getElementById('med-quantity').value    = m.stock.quantity;
    document.getElementById('med-available').value   = m.stock.isAvailable ? 'true' : 'false';
    document.getElementById('med-price').value       = m.pricing.amount;
    document.getElementById('med-currency').value    = m.pricing.currency;
  } else {
    document.getElementById('medicine-form').reset();
  }
  document.getElementById('medicine-modal').style.display = 'flex';
}

function closeMedicineModal() {
  document.getElementById('medicine-modal').style.display = 'none';
  document.getElementById('medicine-form').reset();
  editingMedicineId = null;
}

async function handleMedicineSubmit(e) {
  e.preventDefault();
  const qty = parseInt(document.getElementById('med-quantity').value) || 0;
  const isAvailable = document.getElementById('med-available').value === 'true';
  const data = {
    name:        document.getElementById('med-name').value.trim(),
    description: document.getElementById('med-description').value.trim(),
    stock:   { quantity: qty, isAvailable: isAvailable && qty > 0 },
    pricing: {
      amount:   parseFloat(document.getElementById('med-price').value) || 0,
      currency: document.getElementById('med-currency').value || 'ETB'
    }
  };
  if (!data.name) return showToast('Medicine name is required.', 'error');

  try {
    if (editingMedicineId) {
      await API.updateMedicine(selectedPharmacy._id, editingMedicineId, data);
      showToast(`"${data.name}" updated! ✅`);
    } else {
      await API.addMedicine(selectedPharmacy._id, data);
      showToast(`"${data.name}" added! ✅`);
    }
    closeMedicineModal();
    // Refresh medicines panel
    selectedPharmacy = await API.getPharmacyById(selectedPharmacy._id);
    renderMedicinesTable(selectedPharmacy.medicines);
    loadPharmacies(); // refresh stats
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleDeleteMedicine(medicineId, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  try {
    await API.deleteMedicine(selectedPharmacy._id, medicineId);
    showToast(`"${name}" deleted.`);
    selectedPharmacy = await API.getPharmacyById(selectedPharmacy._id);
    renderMedicinesTable(selectedPharmacy.medicines);
    loadPharmacies();
  } catch (err) { showToast(err.message, 'error'); }
}

// ── Auth Guard ────────────────────────────────────────────────
function checkAuth() {
  if (!sessionStorage.getItem('medfinder_admin')) window.location.href = '/pages/login';
}

function handleLogout() {
  sessionStorage.removeItem('medfinder_admin');
  showToast('Logged out.'); 
  setTimeout(() => { window.location.href = '/pages/login'; }, 800);
}

// ── Sidebar Toggle (Mobile) ───────────────────────────────────
function initAdminSidebar() {
  const hamburger = document.getElementById('hamburger-admin');
  const sidebar   = document.querySelector('.sidebar');
  const overlay   = document.getElementById('sidebar-overlay');

  const toggle = () => {
    sidebar?.classList.toggle('active');
    overlay?.classList.toggle('active');
  };

  hamburger?.addEventListener('click', toggle);
  overlay?.addEventListener('click', toggle);
  
  // Close sidebar when clicking links on mobile
  document.querySelectorAll('.sidebar-nav-item').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) toggle();
    });
  });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initAdminSidebar();

  // Show admin name
  const admin = JSON.parse(sessionStorage.getItem('medfinder_admin') || '{}');
  const nameEl = document.getElementById('admin-name');
  if (nameEl && admin.email) nameEl.textContent = admin.email.split('@')[0];

  loadPharmacies();

  // Pharmacy form
  document.getElementById('pharmacy-form')?.addEventListener('submit', handlePharmacySubmit);
  document.getElementById('add-pharmacy-btn')?.addEventListener('click', () => openPharmacyModal());
  document.getElementById('close-pharmacy-modal')?.addEventListener('click', closePharmacyModal);
  document.getElementById('cancel-pharmacy-btn')?.addEventListener('click', closePharmacyModal);

  // Medicine form
  document.getElementById('medicine-form')?.addEventListener('submit', handleMedicineSubmit);
  document.getElementById('add-medicine-btn')?.addEventListener('click', () => openMedicineModal());
  document.getElementById('close-medicine-modal')?.addEventListener('click', closeMedicineModal);
  document.getElementById('cancel-medicine-btn')?.addEventListener('click', closeMedicineModal);

  // Back to pharmacies
  document.getElementById('back-to-pharmacies')?.addEventListener('click', closeMedicinesPanel);

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  // Close modals on overlay click
  document.getElementById('pharmacy-modal')?.addEventListener('click', e => {
    if (e.target.id === 'pharmacy-modal') closePharmacyModal();
  });
  document.getElementById('medicine-modal')?.addEventListener('click', e => {
    if (e.target.id === 'medicine-modal') closeMedicineModal();
  });

  // Table search filter
  document.getElementById('table-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#pharmacy-tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
});
