import api from './api';
import { io } from 'socket.io-client';
import { authService } from './authService';

// Socket.io instance for review notifications
let reviewSocket = null;

// Event listeners registry for cleanup
const eventListeners = new Map();

export const reviewService = {

    initializeSocket: () => {
        const token = authService.getToken();
        if (!token) {
            console.warn('Cannot initialize review socket: No auth token');
            return null;
        }

        // Don't create duplicate connections
        if (reviewSocket && reviewSocket.connected) {
            return reviewSocket;
        }

        const socketUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';
        
        reviewSocket = io(socketUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        reviewSocket.on('connect', () => {
            console.log('Review socket connected');
        });

        reviewSocket.on('disconnect', (reason) => {
            console.log('Review socket disconnected:', reason);
        });

        reviewSocket.on('connect_error', (error) => {
            console.error('Review socket connection error:', error.message);
        });

        return reviewSocket;
    },

    getSocket: () => {
        return reviewSocket;
    },

    disconnectSocket: () => {
        if (reviewSocket) {
            // Remove all registered event listeners
            eventListeners.forEach((callbacks, event) => {
                callbacks.forEach(callback => {
                    reviewSocket.off(event, callback);
                });
            });
            eventListeners.clear();
            
            reviewSocket.disconnect();
            reviewSocket = null;
            console.log('Review socket disconnected and cleaned up');
        }
    },

    onNewReview: (callback) => {
        if (!reviewSocket) {
            reviewService.initializeSocket();
        }

        const handler = (data) => {
            if (data.notificationType === 'review_received') {
                callback({
                    reviewID: data.reviewID,
                    requestID: data.requestID,
                    message: data.message,
                    timestamp: new Date()
                });
            }
        };

        reviewSocket?.on('new_notification', handler);
        
        // Track listener for cleanup
        if (!eventListeners.has('new_notification')) {
            eventListeners.set('new_notification', []);
        }
        eventListeners.get('new_notification').push(handler);

        // Return unsubscribe function
        return () => {
            reviewSocket?.off('new_notification', handler);
            const listeners = eventListeners.get('new_notification');
            if (listeners) {
                const index = listeners.indexOf(handler);
                if (index > -1) listeners.splice(index, 1);
            }
        };
    },

    onReviewReply: (callback) => {
        if (!reviewSocket) {
            reviewService.initializeSocket();
        }

        const handler = (data) => {
            if (data.notificationType === 'review_reply') {
                callback({
                    reviewID: data.reviewID,
                    requestID: data.requestID,
                    message: data.message,
                    timestamp: new Date()
                });
            }
        };

        reviewSocket?.on('new_notification', handler);
        
        // Track listener for cleanup
        if (!eventListeners.has('new_notification')) {
            eventListeners.set('new_notification', []);
        }
        eventListeners.get('new_notification').push(handler);

        // Return unsubscribe function
        return () => {
            reviewSocket?.off('new_notification', handler);
            const listeners = eventListeners.get('new_notification');
            if (listeners) {
                const index = listeners.indexOf(handler);
                if (index > -1) listeners.splice(index, 1);
            }
        };
    },

    onContentModerated: (callback) => {
        if (!reviewSocket) {
            reviewService.initializeSocket();
        }

        const handler = (data) => {
            if (data.notificationType === 'content_moderated') {
                callback({
                    reviewID: data.reviewID,
                    message: data.message,
                    reason: data.reason,
                    timestamp: new Date()
                });
            }
        };

        reviewSocket?.on('new_notification', handler);
        
        // Track listener for cleanup
        if (!eventListeners.has('new_notification')) {
            eventListeners.set('new_notification', []);
        }
        eventListeners.get('new_notification').push(handler);

        // Return unsubscribe function
        return () => {
            reviewSocket?.off('new_notification', handler);
            const listeners = eventListeners.get('new_notification');
            if (listeners) {
                const index = listeners.indexOf(handler);
                if (index > -1) listeners.splice(index, 1);
            }
        };
    },

    onContentFlagged: (callback) => {
        if (!reviewSocket) {
            reviewService.initializeSocket();
        }

        const handler = (data) => {
            if (data.notificationType === 'content_flagged') {
                callback({
                    reviewID: data.reviewID,
                    message: data.message,
                    timestamp: new Date()
                });
            }
        };

        reviewSocket?.on('new_notification', handler);
        
        // Track listener for cleanup
        if (!eventListeners.has('new_notification')) {
            eventListeners.set('new_notification', []);
        }
        eventListeners.get('new_notification').push(handler);

        // Return unsubscribe function
        return () => {
            reviewSocket?.off('new_notification', handler);
            const listeners = eventListeners.get('new_notification');
            if (listeners) {
                const index = listeners.indexOf(handler);
                if (index > -1) listeners.splice(index, 1);
            }
        };
    },

    subscribeToReviewNotifications: (handlers = {}) => {
        const unsubscribers = [];

        if (handlers.onNewReview) {
            unsubscribers.push(reviewService.onNewReview(handlers.onNewReview));
        }
        if (handlers.onReviewReply) {
            unsubscribers.push(reviewService.onReviewReply(handlers.onReviewReply));
        }
        if (handlers.onContentModerated) {
            unsubscribers.push(reviewService.onContentModerated(handlers.onContentModerated));
        }
        if (handlers.onContentFlagged) {
            unsubscribers.push(reviewService.onContentFlagged(handlers.onContentFlagged));
        }

        // Return function to unsubscribe from all
        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
    },

    submitReview: async (reviewData) => {
        const response = await api.post('/reviews/submit', reviewData);
        return response.data;
    },

    submitReply: async (replyData) => {
        const response = await api.post('/reviews/reply', replyData);
        return response.data;
    },

    getProviderReviews: async (providerID, options = {}) => {
        const params = new URLSearchParams();
        
        if (options.page) params.append('page', options.page);
        if (options.limit) params.append('limit', options.limit);
        if (options.sortBy) params.append('sortBy', options.sortBy);
        if (options.sortOrder) params.append('sortOrder', options.sortOrder);

        const queryString = params.toString();
        const url = `/reviews/provider/${providerID}${queryString ? `?${queryString}` : ''}`;
        
        const response = await api.get(url);
        return response.data;
    },

    getServiceRequestReview: async (requestID) => {
        const response = await api.get(`/reviews/request/${requestID}`);
        return response.data;
    },

    getReviewAnalytics: async (providerID, options = {}) => {
        const params = new URLSearchParams();
        
        if (options.refresh) params.append('refresh', 'true');
        if (options.timeframe) params.append('timeframe', options.timeframe);

        const queryString = params.toString();
        const url = `/reviews/analytics/${providerID}${queryString ? `?${queryString}` : ''}`;
        
        const response = await api.get(url);
        return response.data;
    },

    getDashboardAnalytics: async (providerID) => {
        return await reviewService.getReviewAnalytics(providerID, { 
            refresh: false,
            timeframe: '6months'
        });
    },

    refreshAnalytics: async (providerID) => {
        const response = await api.post(`/reviews/analytics/${providerID}/refresh`);
        return response.data;
    },

    flagReview: async (reviewID, reason) => {
        const response = await api.post('/reviews/flag', { reviewID, reason });
        return response.data;
    },

    moderateReview: async (reviewID, action, reason = null) => {
        const response = await api.put('/reviews/moderate', { reviewID, action, reason });
        return response.data;
    },

    getFlaggedReviews: async (options = {}) => {
        const params = new URLSearchParams();
        
        if (options.page) params.append('page', options.page);
        if (options.limit) params.append('limit', options.limit);
        if (options.status) params.append('status', options.status);

        const queryString = params.toString();
        const url = `/reviews/moderation/flagged${queryString ? `?${queryString}` : ''}`;
        
        const response = await api.get(url);
        return response.data;
    },

    getModerationAuditLogs: async (options = {}) => {
        const params = new URLSearchParams();
        
        if (options.page) params.append('page', options.page);
        if (options.limit) params.append('limit', options.limit);
        if (options.action) params.append('action', options.action);
        if (options.moderatorID) params.append('moderatorID', options.moderatorID);

        const queryString = params.toString();
        const url = `/reviews/moderation/audit${queryString ? `?${queryString}` : ''}`;
        
        const response = await api.get(url);
        return response.data;
    },

    getModerationStats: async () => {
        const response = await api.get('/reviews/moderation/stats');
        return response.data;
    },

    getReviewModerationHistory: async (reviewID) => {
        const response = await api.get(`/reviews/moderation/history/${reviewID}`);
        return response.data;
    },

    formatRating: (rating) => {
        if (rating === null || rating === undefined) return '0.0';
        return parseFloat(rating).toFixed(1);
    },

    calculateSatisfactionPercentage: (analytics) => {
        if (!analytics?.satisfaction?.eligible) {
            return null;
        }
        return analytics.satisfaction.satisfactionPercentage;
    },

    getRatingDistributionArray: (distribution) => {
        if (!distribution) return [];
        
        return [
            { rating: 5, count: distribution[5] || 0 },
            { rating: 4, count: distribution[4] || 0 },
            { rating: 3, count: distribution[3] || 0 },
            { rating: 2, count: distribution[2] || 0 },
            { rating: 1, count: distribution[1] || 0 }
        ];
    },

    formatTrendsForChart: (trends) => {
        if (!trends || !Array.isArray(trends)) return [];
        
        return trends.map(trend => ({
            month: trend.month,
            rating: parseFloat(trend.averageRating),
            reviewCount: trend.reviewCount,
            label: new Date(trend.month + '-01').toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short' 
            })
        }));
    },

    getReviewCountSummary: (reviewCounts) => {
        if (!reviewCounts) return 'No reviews yet';
        
        const { allTime, last30Days, last6Months } = reviewCounts;
        
        if (allTime === 0) return 'No reviews yet';
        if (allTime === 1) return '1 review';
        
        let summary = `${allTime} reviews`;
        if (last30Days > 0) {
            summary += ` (${last30Days} in last 30 days)`;
        }
        
        return summary;
    },

    getModerationActionText: (action) => {
        const actionTexts = {
            'approve': 'Approved',
            'hide': 'Hidden',
            'remove': 'Removed',
            'flag': 'Flagged'
        };
        return actionTexts[action] || action;
    },

    getModerationStatusClass: (review) => {
        if (review.isHidden) return 'status-hidden';
        if (review.isModerated && !review.moderationReason) return 'status-approved';
        if (review.isModerated) return 'status-pending';
        return 'status-normal';
    }
};

export default reviewService;
