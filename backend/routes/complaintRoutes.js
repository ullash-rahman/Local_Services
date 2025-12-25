const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const { authenticate } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticate);

// Submit a new complaint
router.post('/submit', complaintController.submitComplaint);

// Get all complaints filed by the current user (MUST come before /:complaintID)
router.get('/my-complaints', complaintController.getMyComplaints);

// Get complaints against the current user (MUST come before /:complaintID)
router.get('/against-me', complaintController.getComplaintsAgainstMe);

// Get complaints for a specific service request (MUST come before /:complaintID)
router.get('/request/:requestID', complaintController.getComplaintsByRequest);

// Get all complaints (Admin only) - MUST come before /:complaintID
router.get('/', complaintController.getAllComplaints);

// Get complaint by ID (parameterized route - must be last)
router.get('/:complaintID', complaintController.getComplaintById);

// Update complaint status (Admin only)
router.put('/:complaintID/status', complaintController.updateComplaintStatus);

module.exports = router;

