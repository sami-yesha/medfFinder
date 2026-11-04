/**
 * MedFinder - Medicine Controller
 * Manages medicines embedded inside a Pharmacy document.
 */
const Pharmacy = require('../models/Pharmacy');

// Only these medicine fields may be set from a request body
const pickMedicineInfo = ({ name, description, stock, pricing } = {}) => {
  const info = {};
  if (name        !== undefined) info.name        = String(name);
  if (description !== undefined) info.description = String(description);
  if (stock   !== undefined) info.stock   = { quantity: Number(stock?.quantity) || 0, isAvailable: stock?.isAvailable === true };
  if (pricing !== undefined) info.pricing = { amount: Number(pricing?.amount) || 0, currency: String(pricing?.currency || 'ETB') };
  return info;
};

// ── POST /api/pharmacies/:id/medicines ───────────────────────
const addMedicine = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacy not found' });

    pharmacy.medicines.push(pickMedicineInfo(req.body));
    await pharmacy.save();
    const added = pharmacy.medicines[pharmacy.medicines.length - 1];
    res.status(201).json(added);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ── PUT /api/pharmacies/:pharmacyId/medicines/:medicineId ────
const updateMedicine = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.pharmacyId);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacy not found' });

    const medicine = pharmacy.medicines.id(req.params.medicineId);
    if (!medicine) return res.status(404).json({ message: 'Medicine not found' });

    // Merge update fields
    Object.assign(medicine, pickMedicineInfo(req.body));
    await pharmacy.save();
    res.json(medicine);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ── DELETE /api/pharmacies/:pharmacyId/medicines/:medicineId ─
const deleteMedicine = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.pharmacyId);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacy not found' });

    const medicine = pharmacy.medicines.id(req.params.medicineId);
    if (!medicine) return res.status(404).json({ message: 'Medicine not found' });

    medicine.deleteOne();
    await pharmacy.save();
    res.json({ message: 'Medicine deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { addMedicine, updateMedicine, deleteMedicine };
