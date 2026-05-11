/**
 * MedFinder - Pharmacy Routes
 */
const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/pharmacyController');

router.get('/seed',   ctrl.seedData);                    // GET /api/pharmacies/seed
router.get('/search', ctrl.searchPharmaciesByLocation);  // GET /api/pharmacies/search?query=

router.get('/',      ctrl.getAllPharmacies);   // GET /api/pharmacies
router.get('/:id',   ctrl.getPharmacyById);   // GET /api/pharmacies/:id
router.post('/',     ctrl.createPharmacy);     // POST /api/pharmacies
router.put('/:id',   ctrl.updatePharmacy);    // PUT /api/pharmacies/:id
router.delete('/:id', ctrl.deletePharmacy);   // DELETE /api/pharmacies/:id

module.exports = router;
