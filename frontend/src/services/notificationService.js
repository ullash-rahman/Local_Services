import api from './api';

export const notificationService = {
    // Get all notifications for current user
    getNotifications: async (unreadOnly = false) => {
        try {
            const url = unreadOnly 
                ? '/notifications?unreadOnly=true'
                : '/notifications';
            const response = await api.get(url);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch notifications' };
        }
    },

    // Get unread notification count
    getUnreadCount: async () => {
        try {
            const response = await api.get('/notifications/unread/count');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch unread count' };
        }
    },

    // Mark notification as read
    markAsRead: async (notificationID) => {
        try {
            const response = await api.put(`/notifications/${notificationID}/read`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to mark notification as read' };
        }
    },

    // Mark all notifications as read
    markAllAsRead: async () => {
        try {
            const response = await api.put('/notifications/read/all');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to mark all notifications as read' };
        }
    },

    // Delete notification
    deleteNotification: async (notificationID) => {
        try {
            const response = await api.delete(`/notifications/${notificationID}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to delete notification' };
        }
    },

    // Delete all read notifications
    deleteAllRead: async () => {
        try {
            const response = await api.delete('/notifications/read/all');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to delete read notifications' };
        }
    }
};

