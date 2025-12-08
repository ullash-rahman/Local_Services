import React, { useState, useEffect } from 'react';
import { notificationService } from '../../services/notificationService';
import { io } from 'socket.io-client';
import { authService } from '../../services/authService';
import './NotificationCenter.css';

const NotificationCenter = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        loadNotifications();
        loadUnreadCount();
        const socketCleanup = setupSocketConnection();

        // Refresh notifications every 30 seconds
        const interval = setInterval(() => {
            loadNotifications();
            loadUnreadCount();
        }, 30000);

        return () => {
            clearInterval(interval);
            if (socketCleanup) {
                socketCleanup();
            }
            if (socket) {
                socket.close();
            }
        };
    }, []);

    const setupSocketConnection = () => {
        const token = authService.getToken();
        if (!token) return;

        const newSocket = io(process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001', {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
            console.log('Notification socket connected');
        });

        newSocket.on('disconnect', () => {
            console.log('Notification socket disconnected');
        });

        newSocket.on('new_notification', (data) => {
            console.log('New notification received:', data);
            // Reload notifications and unread count
            loadNotifications();
            loadUnreadCount();
        });

        newSocket.on('error', (error) => {
            console.error('Notification socket error:', error);
        });

        setSocket(newSocket);

        return () => {
            if (newSocket) {
                newSocket.close();
            }
        };
    };

    const loadNotifications = async () => {
        try {
            const response = await notificationService.getNotifications();
            if (response.success) {
                setNotifications(response.data.notifications || []);
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadUnreadCount = async () => {
        try {
            const response = await notificationService.getUnreadCount();
            if (response.success) {
                setUnreadCount(response.data.unreadCount || 0);
            }
        } catch (error) {
            console.error('Error loading unread count:', error);
        }
    };

    const handleMarkAsRead = async (notificationID) => {
        try {
            await notificationService.markAsRead(notificationID);
            loadNotifications();
            loadUnreadCount();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            loadNotifications();
            loadUnreadCount();
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const handleDelete = async (notificationID) => {
        try {
            await notificationService.deleteNotification(notificationID);
            loadNotifications();
            loadUnreadCount();
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return date.toLocaleDateString();
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'message':
                return '💬';
            case 'request_accepted':
                return '✅';
            default:
                return '🔔';
        }
    };

    return (
        <div className="notification-center-container">
            <button 
                className="notification-bell-button"
                onClick={() => setIsOpen(!isOpen)}
                title="Notifications"
            >
                🔔
                {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    <div className="notification-header">
                        <h3>Notifications</h3>
                        <div className="notification-header-actions">
                            {notifications.some(n => !n.readStatus) && (
                                <button 
                                    className="mark-all-read-btn"
                                    onClick={handleMarkAllAsRead}
                                >
                                    Mark all as read
                                </button>
                            )}
                            <button 
                                className="notification-close-btn"
                                onClick={() => setIsOpen(false)}
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    <div className="notification-list">
                        {loading ? (
                            <div className="notification-loading">Loading notifications...</div>
                        ) : notifications.length === 0 ? (
                            <div className="notification-empty">No notifications</div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.notificationID}
                                    className={`notification-item ${!notification.readStatus ? 'unread' : ''}`}
                                    onClick={() => {
                                        if (!notification.readStatus) {
                                            handleMarkAsRead(notification.notificationID);
                                        }
                                    }}
                                >
                                    <div className="notification-icon">
                                        {getNotificationIcon(notification.notificationType)}
                                    </div>
                                    <div className="notification-content">
                                        <p className="notification-message">{notification.message}</p>
                                        <span className="notification-time">
                                            {formatTime(notification.date)}
                                        </span>
                                        {notification.requestCategory && (
                                            <span className="notification-category">
                                                {notification.requestCategory}
                                            </span>
                                        )}
                                    </div>
                                    <div className="notification-actions">
                                        {!notification.readStatus && (
                                            <span className="unread-dot"></span>
                                        )}
                                        <button
                                            className="delete-notification-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(notification.notificationID);
                                            }}
                                            title="Delete"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;

