const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const {
    createManualBooking,
    getMyManualBookings,
    getManualBookingById,
    updateManualBooking,
    cancelManualBooking,
    getProviders,
    getPendingManualBookings,
    acceptManualBooking,
    rejectManualBooking
} = require('../controllers/manualBookingController');

// Get list of providers (available to all authenticated users)
router.get('/providers', authenticate, getProviders);

// Provider routes for manual bookings - MUST come before /:bookingID routes
router.get('/pending', authenticate, authorize('Provider'), getPendingManualBookings);
router.post('/:bookingID/accept', authenticate, authorize('Provider'), acceptManualBooking);
router.post('/:bookingID/reject', authenticate, authorize('Provider'), rejectManualBooking);

// Get all manual bookings (Customer only) - MUST come before /:bookingID route
router.get('/my-bookings', authenticate, authorize('Customer'), getMyManualBookings);

// Create manual booking (Customer only)
router.post('/create', authenticate, authorize('Customer'), createManualBooking);

// Cancel manual booking (Customer only) - MUST come before /:bookingID route
router.post('/:bookingID/cancel', authenticate, authorize('Customer'), cancelManualBooking);

// Get specific manual booking (Customer only)
router.get('/:bookingID', authenticate, authorize('Customer'), getManualBookingById);

// Update manual booking (Customer only)
router.put('/:bookingID', authenticate, authorize('Customer'), updateManualBooking);

module.exports = router;
