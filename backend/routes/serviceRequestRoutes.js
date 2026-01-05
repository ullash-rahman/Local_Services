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
    rejectServiceRequest,
    completeServiceRequest
    cancelServiceRequest,
    startService,
    markServiceAsCompleted,
    confirmServiceCompletion
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

// Complete service request (Provider only) - marks service as completed
router.post('/:requestID/complete', authenticate, authorize('Provider'), completeServiceRequest);
// Cancel service request (Customer only) - MUST come before /:requestID route
router.post('/:requestID/cancel', authenticate, authorize('Customer'), cancelServiceRequest);

// Start service (Provider only) - Change status from Accepted to Ongoing - MUST come before /:requestID route
router.post('/:requestID/start', authenticate, authorize('Provider'), startService);

// Mark service as completed (Provider only) - MUST come before /:requestID route
router.post('/:requestID/complete', authenticate, authorize('Provider'), markServiceAsCompleted);

// Confirm service completion (Customer only) - MUST come before /:requestID route
router.post('/:requestID/confirm-completion', authenticate, authorize('Customer'), confirmServiceCompletion);

// Get my service requests (Customer or Provider)
router.get('/', authenticate, getMyServiceRequests);

// Get service request by ID (authenticated users) - MUST be last
router.get('/:requestID', authenticate, getServiceRequestById);

// Update service request (Customer only)
router.put('/:requestID', authenticate, authorize('Customer'), updateServiceRequest);

// Delete service request (Customer only)
router.delete('/:requestID', authenticate, authorize('Customer'), deleteServiceRequest);

module.exports = router;

