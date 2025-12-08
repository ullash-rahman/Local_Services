const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const {
    createServiceRequest,
    getServiceRequestById,
    getMyServiceRequests,
    getPendingRequests,
    updateServiceRequest,
    deleteServiceRequest,
    getServiceRequestsByCategory,
    acceptServiceRequest,
    rejectServiceRequest
} = require('../controllers/serviceRequestController');

// Create service request (Customer only)
router.post('/create', authenticate, authorize('Customer'), createServiceRequest);

// Get pending requests (Provider only) - MUST come before /:requestID route
router.get('/pending/all', authenticate, authorize('Provider'), getPendingRequests);

// Get service requests by category - MUST come before /:requestID route
router.get('/category/:category', authenticate, getServiceRequestsByCategory);

// Accept service request (Provider only) - MUST come before /:requestID route
router.post('/:requestID/accept', authenticate, authorize('Provider'), acceptServiceRequest);

// Reject service request (Provider only) - MUST come before /:requestID route
router.post('/:requestID/reject', authenticate, authorize('Provider'), rejectServiceRequest);

// Get my service requests (Customer or Provider)
router.get('/', authenticate, getMyServiceRequests);

// Get service request by ID (authenticated users) - MUST be last
router.get('/:requestID', authenticate, getServiceRequestById);

// Update service request (Customer only)
router.put('/:requestID', authenticate, authorize('Customer'), updateServiceRequest);

// Delete service request (Customer only)
router.delete('/:requestID', authenticate, authorize('Customer'), deleteServiceRequest);

module.exports = router;

