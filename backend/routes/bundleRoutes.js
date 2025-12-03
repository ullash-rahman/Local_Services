const express = require('express');
const router = express.Router();
const bundleController = require('../controllers/bundleController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// IMPORTANT: Specific routes must come BEFORE parameterized routes
// Get all active bundles (public - customers can browse)
router.get('/browse', bundleController.getAllActiveBundles);

// Provider routes (require authentication and Provider role)
// These specific routes must come before /:bundleID
router.post('/create', authenticate, authorize('Provider'), bundleController.createBundle);
router.get('/my-bundles', authenticate, authorize('Provider'), bundleController.getMyBundles);

// Parameterized routes (must come after specific routes)
// Get bundle by ID (public - for viewing details)
router.get('/:bundleID', bundleController.getBundleById);
router.put('/:bundleID', authenticate, authorize('Provider'), bundleController.updateBundle);
router.delete('/:bundleID', authenticate, authorize('Provider'), bundleController.removeBundle);

module.exports = router;

