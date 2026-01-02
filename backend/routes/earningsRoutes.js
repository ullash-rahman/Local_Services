const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const {
    getDailyEarnings,
    getDailyEarningsRange,
    getMonthlyEarnings,
    getProviderCategories,
    setGoal,
    getActiveGoals,
    getGoalProgress,
    deleteGoal,
    exportEarnings
} = require('../controllers/earningsController');

// Daily earnings endpoints
router.get('/:providerID/daily', authenticate, authorize('Provider', 'Admin'), getDailyEarnings);
router.get('/:providerID/daily/range', authenticate, authorize('Provider', 'Admin'), getDailyEarningsRange);

// Monthly earnings endpoint
router.get('/:providerID/monthly', authenticate, authorize('Provider', 'Admin'), getMonthlyEarnings);

// Categories endpoint
router.get('/:providerID/categories', authenticate, authorize('Provider', 'Admin'), getProviderCategories);

// Goals endpoints
router.post('/:providerID/goals', authenticate, authorize('Provider', 'Admin'), setGoal);
router.get('/:providerID/goals', authenticate, authorize('Provider', 'Admin'), getActiveGoals);
router.get('/:providerID/goals/:goalID/progress', authenticate, authorize('Provider', 'Admin'), getGoalProgress);
router.delete('/:providerID/goals/:goalID', authenticate, authorize('Provider', 'Admin'), deleteGoal);

// Export endpoint
router.get('/:providerID/export', authenticate, authorize('Provider', 'Admin'), exportEarnings);

module.exports = router;
