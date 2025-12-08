const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Customer Dashboard - Get basic stats
router.get('/customer', authenticate, authorize('Customer'), async (req, res) => {
    try {
        // This is an empty dashboard - stats will be added later
        res.status(200).json({
            success: true,
            message: 'Customer dashboard data',
            data: {
                user: req.user,
                stats: {
                    activeRequests: 0,
                    completedServices: 0,
                    pendingPayments: 0
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard data',
            error: error.message
        });
    }
});

// Provider Dashboard - Get basic stats
router.get('/provider', authenticate, authorize('Provider'), async (req, res) => {
    try {
        // This is an empty dashboard - stats will be added later
        res.status(200).json({
            success: true,
            message: 'Provider dashboard data',
            data: {
                user: req.user,
                stats: {
                    pendingRequests: 0,
                    activeJobs: 0,
                    completedJobs: 0,
                    totalEarnings: 0
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard data',
            error: error.message
        });
    }
});

module.exports = router;

