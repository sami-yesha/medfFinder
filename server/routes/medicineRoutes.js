/**
 * MedFinder - Medicine Routes
 * Mounted at /api — so full paths are /api/pharmacies/:id/medicines/...
 */
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/medicineController');
const { requireAdmin } = require('../middleware/auth');

// Search is here so it resolves before :id catch-all
router.get('/search', require('../controllers/pharmacyController').searchMedicines);

router.post('/pharmacies/:id/medicines',                         requireAdmin, ctrl.addMedicine);
router.put('/pharmacies/:pharmacyId/medicines/:medicineId',      requireAdmin, ctrl.updateMedicine);
router.delete('/pharmacies/:pharmacyId/medicines/:medicineId',   requireAdmin, ctrl.deleteMedicine);

module.exports = router;
