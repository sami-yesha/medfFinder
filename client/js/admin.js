/**
 * MedFinder - Admin Module
 * Two-section dashboard: Pharmacy management + Medicine management.
 * All CRUD goes through the backend API (no localStorage).
 */

// ── State ─────────────────────────────────────────────────────
let pharmacyList = [];         // Last loaded pharmacies (for name lookups)
let selectedPharmacy = null;   // The pharmacy whose medicines are being managed
let editingPharmacyId = null;  // ID when editing a pharmacy
let editingMedicineId = null;  // ID when editing a medicine
let pickerMap = null;          // Leaflet location picker instance

const LOW_STOCK_THRESHOLD = 10;

/** Full-width table row for loading / empty / error messages */
const tableMessage = (iconName, text, cls = '') =>
  `<tr class="table-message ${cls}"><td colspan="5"><span class="ds-empty-icon">${icon(iconName)}</span><p>${text}</p></td></tr>`;

function stockPill(m) {
  if (!m.stock.isAvailable) return `<span class="ds-pill ds-pill-bad">${icon('x')}${i18n.t('stock.out')}</span>`;
  if (m.stock.quantity <= LOW_STOCK_THRESHOLD) return `<span class="ds-pill ds-pill-warn">${icon('triangle-alert')}${i18n.t('stock.low')}</span>`;
  return `<span class="ds-pill ds-pill-ok">${icon('check')}${i18n.t('stock.in')}</span>`;
}

// ══ PHARMACY SECTION ═════════════════════════════════════════

async function loadPharmacies() {
  const tbody = document.getElementById('pharmacy-tbody');
  if (!tbody) return;
  tbody.innerHTML = tableMessage('loader-circle', i18n.t('admin.loading'), 'is-loading');

  try {
    const pharmacies = await API.getPharmacies();
    pharmacyList = pharmacies;
    updateStats(pharmacies);

    if (!pharmacies.length) {
      tbody.innerHTML = tableMessage('store', i18n.t('admin.no_pharms'));
      return;
    }

    tbody.innerHTML = pharmacies.map(ph => `
      <tr>
        <td data-label="${i18n.t('admin.name')}"><strong>${escapeHtml(ph.name)}</strong></td>
        <td data-label="${i18n.t('admin.address')}" class="cell-muted">${escapeHtml(ph.address || '—')}</td>
        <td data-label="${i18n.t('admin.phone')}">${escapeHtml(ph.phone || '—')}</td>
        <td data-label="${i18n.t('admin.medicines')}"><span class="ds-pill ds-pill-brand">${icon('pill')}${ph.medicines.length}</span></td>
        <td data-label="${i18n.t('admin.actions')}" class="col-actions">
          <div class="actions">
            <button class="ds-btn ds-btn-soft ds-btn-sm" onclick="openMedicinesPanel('${ph._id}')">${icon('pill')}${i18n.t('admin.manage_meds')}</button>
            <button class="ds-btn ds-btn-ghost ds-btn-sm ds-btn-icon" onclick="openPharmacyModal('${ph._id}')" title="${i18n.t('admin.edit')}" aria-label="${i18n.t('admin.edit')}">${icon('pencil')}</button>
            <button class="ds-btn ds-btn-ghost ds-btn-sm ds-btn-icon btn-danger" onclick="handleDeletePharmacy('${ph._id}')" title="${i18n.t('admin.delete')}" aria-label="${i18n.t('admin.delete')}">${icon('trash-2')}</button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = tableMessage('circle-x', escapeHtml(err.message), 'is-error');
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
  document.getElementById('pharmacy-modal-title').textContent = id ? i18n.t('admin.title_edit_pharm') : i18n.t('admin.title_add_pharm');
  document.getElementById('ph-name').value    = '';
  document.getElementById('ph-address').value = '';
  document.getElementById('ph-phone').value   = '';
  document.getElementById('ph-lat').value     = '';
  document.getElementById('ph-lng').value     = '';
  const coordEl = document.getElementById('coord-display');
  coordEl.textContent = i18n.t('admin.click_map');   // don't show the previous pharmacy's pin
  coordEl.classList.remove('is-set');

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
  if (!data.name) return showToast(i18n.t('admin.ph_name_label'), 'error');
  if (!data.location.lat && !data.location.lng) return showToast(i18n.t('admin.click_map'), 'error');

  try {
    if (editingPharmacyId) {
      await API.updatePharmacy(editingPharmacyId, data);
      showToast(`"${data.name}" updated!`);
    } else {
      await API.createPharmacy(data);
      showToast(`"${data.name}" created!`);
    }
    closePharmacyModal();
    loadPharmacies();
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleDeletePharmacy(id) {
  const name = pharmacyList.find(p => p._id === id)?.name || '';
  if (!confirm(i18n.t('admin.confirm_del_ph', { name }))) return;
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
    tbody.innerHTML = tableMessage('pill', i18n.t('admin.no_meds'));
    return;
  }

  tbody.innerHTML = medicines.map(m => `
    <tr>
      <td data-label="${i18n.t('admin.medicines')}"><strong>${escapeHtml(m.name)}</strong>${m.description ? `<small class="cell-sub">${escapeHtml(m.description)}</small>` : ''}</td>
      <td data-label="${i18n.t('admin.status')}">${stockPill(m)}</td>
      <td data-label="${i18n.t('admin.qty')}">${escapeHtml(m.stock.quantity)}</td>
      <td data-label="${i18n.t('admin.price')}"><strong>${escapeHtml(m.pricing.amount)} ${escapeHtml(m.pricing.currency)}</strong></td>
      <td data-label="${i18n.t('admin.actions')}" class="col-actions">
        <div class="actions">
          <button class="ds-btn ds-btn-ghost ds-btn-sm ds-btn-icon" onclick="openMedicineModal('${m._id}')" title="${i18n.t('admin.edit')}" aria-label="${i18n.t('admin.edit')}">${icon('pencil')}</button>
          <button class="ds-btn ds-btn-ghost ds-btn-sm ds-btn-icon btn-danger" onclick="handleDeleteMedicine('${m._id}')" title="${i18n.t('admin.delete')}" aria-label="${i18n.t('admin.delete')}">${icon('trash-2')}</button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Medicine Modal ────────────────────────────────────────────
function openMedicineModal(medicineId = null) {
  editingMedicineId = medicineId;
  document.getElementById('medicine-modal-title').textContent = medicineId ? i18n.t('admin.title_edit_med') : i18n.t('admin.title_add_med');

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
      showToast(`"${data.name}" updated!`);
    } else {
      await API.addMedicine(selectedPharmacy._id, data);
      showToast(`"${data.name}" added!`);
    }
    closeMedicineModal();
    // Refresh medicines panel
    selectedPharmacy = await API.getPharmacyById(selectedPharmacy._id);
    renderMedicinesTable(selectedPharmacy.medicines);
    loadPharmacies(); // refresh stats
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleDeleteMedicine(medicineId) {
  const name = selectedPharmacy?.medicines.find(m => m._id === medicineId)?.name || '';
  if (!confirm(i18n.t('admin.confirm_del_med', { name }))) return;
  try {
    await API.deleteMedicine(selectedPharmacy._id, medicineId);
    showToast(`"${name}" deleted.`);
    selectedPharmacy = await API.getPharmacyById(selectedPharmacy._id);
    renderMedicinesTable(selectedPharmacy.medicines);
    loadPharmacies();
  } catch (err) { showToast(err.message, 'error'); }
}

// ── Auth Guard ────────────────────────────────────────────────
// The server enforces auth on every write; this only avoids showing the page to logged-out users
function checkAuth() {
  if (!getAdminSession()?.token) window.location.href = '/pages/login';
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
document.addEventListener('DOMContentLoaded', async () => {
  await i18n.init();
  checkAuth();
  initAdminSidebar();

  // Re-render table on language change
  window.addEventListener('languageChanged', () => {
    loadPharmacies();
    if (selectedPharmacy) renderMedicinesTable(selectedPharmacy.medicines);
  });

  // Show admin name
  const admin = getAdminSession() || {};
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
