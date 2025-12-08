const Notification = require('../models/Notification');

// Get all notifications for current user
const getNotifications = async (req, res) => {
    try {
        const userID = req.user.userID;
        const unreadOnly = req.query.unreadOnly === 'true';

        const notifications = await Notification.getByUser(userID, unreadOnly);

        res.status(200).json({
            success: true,
            data: { notifications }
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching notifications',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
    try {
        const userID = req.user.userID;
        const count = await Notification.getUnreadCount(userID);

        res.status(200).json({
            success: true,
            data: { unreadCount: count }
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching unread count',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Mark notification as read
const markAsRead = async (req, res) => {
    try {
        const userID = req.user.userID;
        const { notificationID } = req.params;

        const updated = await Notification.markAsRead(notificationID, userID);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating notification',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
    try {
        const userID = req.user.userID;
        const count = await Notification.markAllAsRead(userID);

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read',
            data: { updatedCount: count }
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating notifications',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Delete notification
const deleteNotification = async (req, res) => {
    try {
        const userID = req.user.userID;
        const { notificationID } = req.params;

        const deleted = await Notification.delete(notificationID, userID);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting notification',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Delete all read notifications
const deleteAllRead = async (req, res) => {
    try {
        const userID = req.user.userID;
        const count = await Notification.deleteAllRead(userID);

        res.status(200).json({
            success: true,
            message: 'All read notifications deleted',
            data: { deletedCount: count }
        });
    } catch (error) {
        console.error('Delete all read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting notifications',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead
};

