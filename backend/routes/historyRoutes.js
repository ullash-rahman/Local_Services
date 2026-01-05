const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const {
    getJobHistory,
    getJobHistoryById,
    getJobHistoryStats
} = require('../controllers/historyController');

// Get job history (Customer or Provider)
router.get('/', authenticate, getJobHistory);

// Get job history statistics
router.get('/stats', authenticate, getJobHistoryStats);

// Get job history by ID
router.get('/:jobID', authenticate, getJobHistoryById);

module.exports = router;

