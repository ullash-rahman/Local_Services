const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const {
    setAvailability,
    bulkSetAvailability,
    getMyAvailability,
    getProviderAvailability,
    deleteAvailability,
    getAvailableProviders
} = require('../controllers/availabilityController');

// All routes require authentication
router.use(authenticate);

// Provider routes - MUST come before parameterized routes
router.post('/set', authorize('Provider'), setAvailability);
router.post('/bulk-set', authorize('Provider'), bulkSetAvailability);
router.get('/my-availability', authorize('Provider'), getMyAvailability);
router.delete('/delete', authorize('Provider'), deleteAvailability);

// Customer routes - view provider availability
router.get('/available-providers', authorize('Customer'), getAvailableProviders);
router.get('/provider/:providerID', getProviderAvailability); // Available to all authenticated users

module.exports = router;

