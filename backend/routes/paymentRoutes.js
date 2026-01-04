const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const {
    getPaymentsByProvider,
    getPaymentsByCustomer,
    getPaymentSummary,
    markPaymentAsPaid,
    checkOverduePayments,
    getPaymentById
} = require('../controllers/paymentController');

// Provider payment endpoints
// GET /api/payments/provider/:providerId - Get all payments for a provider
router.get('/provider/:providerId', authenticate, authorize('Provider', 'Admin'), getPaymentsByProvider);

// GET /api/payments/summary/:providerId - Get payment summary statistics for a provider
router.get('/summary/:providerId', authenticate, authorize('Provider', 'Admin'), getPaymentSummary);

// Customer payment endpoints
// GET /api/payments/customer/:customerId - Get all payments for a customer
router.get('/customer/:customerId', authenticate, authorize('Customer', 'Admin'), getPaymentsByCustomer);

// Payment action endpoints
// PUT /api/payments/:paymentId/mark-paid - Mark a payment as paid
router.put('/:paymentId/mark-paid', authenticate, authorize('Provider', 'Admin'), markPaymentAsPaid);

// POST /api/payments/check-overdue - Check and update overdue payments
router.post('/check-overdue', authenticate, authorize('Provider', 'Admin'), checkOverduePayments);

// Single payment endpoint
// GET /api/payments/:paymentId - Get single payment details
router.get('/:paymentId', authenticate, getPaymentById);

module.exports = router;
