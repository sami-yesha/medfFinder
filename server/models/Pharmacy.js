/**
 * MedFinder - Pharmacy Mongoose Model
 * Architecture: Pharmacy owns an embedded medicines[] array.
 */
const mongoose = require('mongoose');

// ── Embedded Medicine Schema ────────────────────────────────
const MedicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Medicine name is required'],
    trim: true
  },
  description: { type: String, default: '' },
  stock: {
    quantity:    { type: Number, default: 0, min: 0 },
    isAvailable: { type: Boolean, default: false }
  },
  pricing: {
    amount:   { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'ETB' }
  }
}, { _id: true });

// ── Pharmacy Schema ─────────────────────────────────────────
const PharmacySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Pharmacy name is required'],
    trim: true
  },
  address:  { type: String, default: '' },
  phone:    { type: String, default: '' },
  location: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  },
  medicines: [MedicineSchema]
}, { timestamps: true });

module.exports = mongoose.model('Pharmacy', PharmacySchema);
