const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const {
    getMaintenanceReminders,
    getUpcomingReminders,
    getOverdueReminders,
    getMaintenanceReminderById,
    createMaintenanceReminder,
    updateMaintenanceReminder,
    deleteMaintenanceReminder,
    markReminderAsCompleted
} = require('../controllers/maintenanceController');

// Get upcoming reminders - MUST come before /:reminderID route
router.get('/upcoming', authenticate, authorize('Customer'), getUpcomingReminders);

// Get overdue reminders - MUST come before /:reminderID route
router.get('/overdue', authenticate, authorize('Customer'), getOverdueReminders);

// Get all maintenance reminders (Customer only)
router.get('/', authenticate, authorize('Customer'), getMaintenanceReminders);

// Create maintenance reminder (Customer only)
router.post('/', authenticate, authorize('Customer'), createMaintenanceReminder);

// Mark reminder as completed - MUST come before /:reminderID route
router.post('/:reminderID/complete', authenticate, authorize('Customer'), markReminderAsCompleted);

// Get maintenance reminder by ID (Customer only)
router.get('/:reminderID', authenticate, authorize('Customer'), getMaintenanceReminderById);

// Update maintenance reminder (Customer only)
router.put('/:reminderID', authenticate, authorize('Customer'), updateMaintenanceReminder);

// Delete maintenance reminder (Customer only)
router.delete('/:reminderID', authenticate, authorize('Customer'), deleteMaintenanceReminder);

module.exports = router;

