const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const ReviewAnalytics = require('../services/ReviewAnalytics');
const ServiceRequest = require('../models/ServiceRequest');
const Payment = require('../models/Payment');

// Customer Dashboard - Get basic stats
router.get('/customer', authenticate, authorize('Customer'), async (req, res) => {
    try {
        const customerID = req.user.userID;
        
        // Get active requests (Pending, Accepted, Ongoing)
        const activeRequests = await ServiceRequest.getByCustomer(customerID);
        const activeCount = activeRequests.filter(r => 
            ['Pending', 'Accepted', 'Ongoing'].includes(r.status)
        ).length;
        
        // Get completed services
        const completedRequests = await ServiceRequest.getByCustomer(customerID, 'Completed');
        const completedCount = completedRequests.filter(r => 
            r.status === 'Completed' && r.completionConfirmed
        ).length;
        
        // Get pending payments
        const payments = await Payment.findByCustomer(customerID, { status: 'Pending' });
        const pendingPaymentsCount = payments.filter(p => p.status === 'Pending').length;
        
        res.status(200).json({
            success: true,
            message: 'Customer dashboard data',
            data: {
                user: req.user,
                stats: {
                    activeRequests: activeCount,
                    completedServices: completedCount,
                    pendingPayments: pendingPaymentsCount
                }
            }
        });
    } catch (error) {
        console.error('Error fetching customer dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard data',
            error: error.message
        });
    }
});

// Provider Dashboard with review analytics
router.get('/provider', authenticate, authorize('Provider'), async (req, res) => {
    try {
        const providerID = req.user.userID;
        
        // Get pending requests (unaccepted)
        const pendingRequests = await ServiceRequest.getPendingRequests();
        const pendingCount = pendingRequests.length;
        
        // Get active jobs (Accepted, Ongoing)
        const providerRequests = await ServiceRequest.getByProvider(providerID);
        const activeJobs = providerRequests.filter(r => 
            ['Accepted', 'Ongoing'].includes(r.status)
        ).length;
        
        // Get completed jobs
        const completedJobs = providerRequests.filter(r => 
            r.status === 'Completed'
        ).length;
        
        // Calculate total earnings from completed payments
        const payments = await Payment.findByProvider(providerID, { status: 'Paid' });
        const totalEarnings = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        
        let reviewAnalytics = null;
        try {
            reviewAnalytics = await ReviewAnalytics.getDashboardAnalytics(providerID, true);
        } catch (analyticsError) {
            console.error('Error fetching review analytics:', analyticsError);
        }

        res.status(200).json({
            success: true,
            message: 'Provider dashboard data',
            data: {
                user: req.user,
                stats: {
                    pendingRequests: pendingCount,
                    activeJobs: activeJobs,
                    completedJobs: completedJobs,
                    totalEarnings: totalEarnings
                },
                reviewAnalytics: reviewAnalytics ? {
                    averageRating: reviewAnalytics.averageRating,
                    ratingDistribution: reviewAnalytics.ratingDistribution,
                    trends: reviewAnalytics.trends,
                    reviewCounts: reviewAnalytics.reviewCounts,
                    satisfaction: reviewAnalytics.satisfaction
                } : null
            }
        });
    } catch (error) {
        console.error('Error fetching provider dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard data',
            error: error.message
        });
    }
});

module.exports = router;

