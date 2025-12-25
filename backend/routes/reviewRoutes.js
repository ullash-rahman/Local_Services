const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { 
    submitReview, 
    submitReply, 
    getProviderReviews, 
    getServiceRequestReview,
    getReviewAnalytics,
    refreshAnalyticsCache,
    flagReview,
    moderateReview,
    getFlaggedReviews,
    getModerationAuditLogs,
    getModerationStats,
    getReviewModerationHistory
} = require('../controllers/reviewController');

router.post('/submit', authenticate, authorize('Customer'), submitReview);

router.post('/reply', authenticate, authorize('Provider'), submitReply);

router.get('/provider/:id', getProviderReviews);

router.get('/request/:id', authenticate, getServiceRequestReview);

router.get('/analytics/:id', authenticate, getReviewAnalytics);

router.post('/analytics/:id/refresh', authenticate, refreshAnalyticsCache);

router.post('/flag', authenticate, flagReview);

router.put('/moderate', authenticate, authorize('Admin'), moderateReview);

router.get('/moderation/flagged', authenticate, authorize('Admin'), getFlaggedReviews);

router.get('/moderation/audit', authenticate, authorize('Admin'), getModerationAuditLogs);

router.get('/moderation/stats', authenticate, authorize('Admin'), getModerationStats);

router.get('/moderation/history/:reviewID', authenticate, authorize('Admin'), getReviewModerationHistory);

module.exports = router;
