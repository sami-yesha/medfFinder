/**
 * MedFinder - Pharmacy Controller
 * Handles all pharmacy CRUD and cross-pharmacy medicine search.
 */
const Pharmacy = require('../models/Pharmacy');

// ── GET /api/pharmacies ──────────────────────────────────────
const getAllPharmacies = async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find().sort({ name: 1 });
    res.json(pharmacies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/pharmacies/:id ──────────────────────────────────
const getPharmacyById = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacy not found' });
    res.json(pharmacy);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/pharmacies ─────────────────────────────────────
const createPharmacy = async (req, res) => {
  try {
    const pharmacy = new Pharmacy(req.body);
    const saved = await pharmacy.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ── PUT /api/pharmacies/:id ──────────────────────────────────
// Updates only pharmacy info fields (NOT medicines array)
const updatePharmacy = async (req, res) => {
  try {
    const { medicines, ...info } = req.body; // strip medicines
    const pharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      { $set: info },
      { new: true, runValidators: true }
    );
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacy not found' });
    res.json(pharmacy);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ── DELETE /api/pharmacies/:id ───────────────────────────────
const deletePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findByIdAndDelete(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacy not found' });
    res.json({ message: `"${pharmacy.name}" deleted.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/search?medicine=query ──────────────────────────
// Searches medicines across ALL pharmacies
const searchMedicines = async (req, res) => {
  try {
    const query = (req.query.medicine || '').trim();
    let pharmacies;

    if (!query) {
      pharmacies = await Pharmacy.find();
    } else {
      const rx = new RegExp(query, 'i');
      pharmacies = await Pharmacy.find({
        medicines: { $elemMatch: { $or: [{ name: rx }, { description: rx }] } }
      });
    }

    // Flatten: one result object per matching medicine
    const results = [];
    pharmacies.forEach(ph => {
      const meds = query
        ? ph.medicines.filter(m => new RegExp(query, 'i').test(m.name) || new RegExp(query, 'i').test(m.description))
        : ph.medicines;

      meds.forEach(med => {
        results.push({
          pharmacy: {
            _id: ph._id,
            name: ph.name,
            address: ph.address,
            phone: ph.phone,
            location: ph.location
          },
          medicine: med
        });
      });
    });

    // Sort: available first
    results.sort((a, b) => (b.medicine.stock.isAvailable ? 1 : 0) - (a.medicine.stock.isAvailable ? 1 : 0));
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/seed ────────────────────────────────────────────
// Seeds sample data if DB is empty (one-time use)
const seedData = async (req, res) => {
  try {
    const count = await Pharmacy.countDocuments();
    if (count > 0) return res.json({ message: 'Database already has data — seed skipped.' });

    await Pharmacy.insertMany([
      {
        name: 'ABC Pharmacy', address: 'Addis Ababa, Bole', phone: '+251912345678',
        location: { lat: 9.0248, lng: 38.7807 },
        medicines: [
          { name: 'Paracetamol', description: 'Pain relief for fever, headache, and body pain.', stock: { quantity: 50, isAvailable: true }, pricing: { amount: 25, currency: 'ETB' } },
          { name: 'Ibuprofen', description: 'NSAID for pain, fever, and inflammation relief.', stock: { quantity: 75, isAvailable: true }, pricing: { amount: 40, currency: 'ETB' } },
          { name: 'Amoxicillin', description: 'Antibiotic for bacterial infections.', stock: { quantity: 0, isAvailable: false }, pricing: { amount: 85, currency: 'ETB' } }
        ]
      },
      {
        name: 'Health Pharmacy', address: 'Addis Ababa, Kazanchis', phone: '+251911987654',
        location: { lat: 9.0226, lng: 38.7611 },
        medicines: [
          { name: 'Amoxicillin', description: 'Antibiotic used to treat bacterial infections.', stock: { quantity: 30, isAvailable: true }, pricing: { amount: 90, currency: 'ETB' } },
          { name: 'Atorvastatin', description: 'Statin to lower cholesterol and reduce heart disease risk.', stock: { quantity: 45, isAvailable: true }, pricing: { amount: 110, currency: 'ETB' } },
          { name: 'Metformin', description: 'Controls blood sugar levels in type 2 diabetes.', stock: { quantity: 120, isAvailable: true }, pricing: { amount: 60, currency: 'ETB' } }
        ]
      },
      {
        name: 'City Medicals', address: 'Addis Ababa, Piassa', phone: '+251922556677',
        location: { lat: 9.0361, lng: 38.7499 },
        medicines: [
          { name: 'Omeprazole', description: 'Proton pump inhibitor for acid reflux and ulcers.', stock: { quantity: 200, isAvailable: true }, pricing: { amount: 35, currency: 'ETB' } },
          { name: 'Metformin', description: 'Oral diabetes medicine for blood sugar control.', stock: { quantity: 80, isAvailable: true }, pricing: { amount: 55, currency: 'ETB' } }
        ]
      },
      {
        name: 'Zion Drugstore', address: 'Addis Ababa, CMC', phone: '+251933112233',
        location: { lat: 9.0485, lng: 38.8019 },
        medicines: [
          { name: 'Ciprofloxacin', description: 'Broad-spectrum antibiotic effective against bacteria.', stock: { quantity: 0, isAvailable: false }, pricing: { amount: 150, currency: 'ETB' } },
          { name: 'Diazepam', description: 'Benzodiazepine for anxiety, muscle spasms, and seizures.', stock: { quantity: 0, isAvailable: false }, pricing: { amount: 200, currency: 'ETB' } },
          { name: 'Paracetamol', description: 'Pain relief and fever reducer.', stock: { quantity: 100, isAvailable: true }, pricing: { amount: 20, currency: 'ETB' } }
        ]
      }
    ]);

    const inserted = await Pharmacy.countDocuments();
    res.json({ message: `✅ Seeded ${inserted} pharmacies with sample medicines.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getAllPharmacies, getPharmacyById, createPharmacy, updatePharmacy, deletePharmacy, searchMedicines, seedData };
