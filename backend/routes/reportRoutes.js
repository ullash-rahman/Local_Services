const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const {
    generateReport,
    getTemplates,
    getReportHistory,
    downloadReport,
    scheduleReport,
    cancelScheduledReport
} = require('../controllers/reportController');

router.post('/generate', authenticate, authorize('Provider', 'Admin'), generateReport);

router.get('/templates', authenticate, authorize('Provider', 'Admin'), getTemplates);

router.get('/history/:providerID', authenticate, authorize('Provider', 'Admin'), getReportHistory);

router.get('/download/:reportID', authenticate, authorize('Provider', 'Admin'), downloadReport);

router.post('/schedule', authenticate, authorize('Provider', 'Admin'), scheduleReport);

router.delete('/schedule/:scheduleID', authenticate, authorize('Provider', 'Admin'), cancelScheduledReport);

module.exports = router;
