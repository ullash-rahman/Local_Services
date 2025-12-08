const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead
} = require('../controllers/notificationController');

// Get all notifications for current user
router.get('/', authenticate, getNotifications);

// Get unread notification count
router.get('/unread/count', authenticate, getUnreadCount);

// Mark notification as read
router.put('/:notificationID/read', authenticate, markAsRead);

// Mark all notifications as read
router.put('/read/all', authenticate, markAllAsRead);

// Delete notification
router.delete('/:notificationID', authenticate, deleteNotification);

// Delete all read notifications
router.delete('/read/all', authenticate, deleteAllRead);

module.exports = router;

