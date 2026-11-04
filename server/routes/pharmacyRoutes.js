/**
 * MedFinder - Pharmacy Routes
 */
const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/pharmacyController');
const { requireAdmin } = require('../middleware/auth');

router.post('/seed',  requireAdmin, ctrl.seedData);      // POST /api/pharmacies/seed
router.get('/search', ctrl.searchPharmaciesByLocation);  // GET /api/pharmacies/search?query=

router.get('/',      ctrl.getAllPharmacies);   // GET /api/pharmacies
router.get('/:id',   ctrl.getPharmacyById);   // GET /api/pharmacies/:id
router.post('/',     requireAdmin, ctrl.createPharmacy);     // POST /api/pharmacies
router.put('/:id',   requireAdmin, ctrl.updatePharmacy);    // PUT /api/pharmacies/:id
router.delete('/:id', requireAdmin, ctrl.deletePharmacy);   // DELETE /api/pharmacies/:id

module.exports = router;
