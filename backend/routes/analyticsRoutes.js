const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const {
    getDashboard,
    getRevenueAnalytics,
    getPerformanceMetrics,
    getCustomerAnalytics,
    getBenchmarks,
    getRealTimeMetrics,
    refreshAnalytics
} = require('../controllers/analyticsController');

router.get('/dashboard/:providerID', authenticate, authorize('Provider', 'Admin'), getDashboard);

router.get('/revenue/:providerID', authenticate, authorize('Provider', 'Admin'), getRevenueAnalytics);

router.get('/performance/:providerID', authenticate, authorize('Provider', 'Admin'), getPerformanceMetrics);

router.get('/customers/:providerID', authenticate, authorize('Provider', 'Admin'), getCustomerAnalytics);

router.get('/benchmarks/:providerID', authenticate, authorize('Provider', 'Admin'), getBenchmarks);

router.get('/realtime/:providerID', authenticate, authorize('Provider', 'Admin'), getRealTimeMetrics);

router.post('/refresh/:providerID', authenticate, authorize('Provider', 'Admin'), refreshAnalytics);

module.exports = router;