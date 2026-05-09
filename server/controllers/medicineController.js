/**
 * MedFinder - Medicine Controller
 * Manages medicines embedded inside a Pharmacy document.
 */
const Pharmacy = require('../models/Pharmacy');

// ── POST /api/pharmacies/:id/medicines ───────────────────────
const addMedicine = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacy not found' });

    pharmacy.medicines.push(req.body);
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
    Object.assign(medicine, req.body);
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
