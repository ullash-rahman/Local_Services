const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamificationController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/add-points', gamificationController.addPointsForJobCompletion);

router.get('/dashboard/:userID', gamificationController.getGamificationDashboard);

router.get('/leaderboard', gamificationController.getLeaderboard);

router.get('/rank/:userID', gamificationController.getProviderRank);

router.post('/reset-monthly', authenticate, gamificationController.resetMonthlyPoints);

module.exports = router;
