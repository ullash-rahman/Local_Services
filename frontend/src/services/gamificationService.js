import api from './api';
import { io } from 'socket.io-client';
import { authService } from './authService';

// Socket.io instance for gamification notifications
let gamificationSocket = null;

// Event listeners registry for cleanup
const eventListeners = new Map();

/**
 * Gamification Service
 * Handles gamification data fetching and real-time event notifications
 * for badge_earned and rank_changed events
 * Requirements: 5.4, 5.5
 */
export const gamificationService = {
  /**
   * Initialize socket connection for gamification events
   * @returns {Socket|null} Socket instance or null if no auth token
   */
  initializeSocket: () => {
    const token = authService.getToken();
    if (!token) {
      console.warn('Cannot initialize gamification socket: No auth token');
      return null;
    }

    // Don't create duplicate connections
    if (gamificationSocket && gamificationSocket.connected) {
      return gamificationSocket;
    }

    const socketUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

    gamificationSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    gamificationSocket.on('connect', () => {
      console.log('Gamification socket connected');
    });

    gamificationSocket.on('disconnect', (reason) => {
      console.log('Gamification socket disconnected:', reason);
    });

    gamificationSocket.on('connect_error', (error) => {
      console.error('Gamification socket connection error:', error.message);
    });

    return gamificationSocket;
  },

  /**
   * Get the current socket instance
   * @returns {Socket|null} Socket instance
   */
  getSocket: () => {
    return gamificationSocket;
  },

  /**
   * Disconnect and cleanup socket connection
   */
  disconnectSocket: () => {
    if (gamificationSocket) {
      // Remove all registered event listeners
      eventListeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => {
          gamificationSocket.off(event, callback);
        });
      });
      eventListeners.clear();

      gamificationSocket.disconnect();
      gamificationSocket = null;
      console.log('Gamification socket disconnected and cleaned up');
    }
  },

  /**
   * Subscribe to badge_earned events
   * Requirement: 5.4 - WHEN a badge is earned, THE Gamification_System SHALL emit a real-time notification
   * @param {Function} callback - Callback function to handle badge earned events
   * @returns {Function} Unsubscribe function
   */
  onBadgeEarned: (callback) => {
    if (!gamificationSocket) {
      gamificationService.initializeSocket();
    }

    const handler = (data) => {
      if (data.notificationType === 'badge_earned') {
        callback({
          badgeName: data.badgeName,
          totalBadges: data.totalBadges,
          userID: data.userID,
          message: data.message,
          timestamp: new Date()
        });
      }
    };

    gamificationSocket?.on('new_notification', handler);

    // Track listener for cleanup
    if (!eventListeners.has('new_notification')) {
      eventListeners.set('new_notification', []);
    }
    eventListeners.get('new_notification').push(handler);

    // Return unsubscribe function
    return () => {
      gamificationSocket?.off('new_notification', handler);
      const listeners = eventListeners.get('new_notification');
      if (listeners) {
        const index = listeners.indexOf(handler);
        if (index > -1) listeners.splice(index, 1);
      }
    };
  },

  /**
   * Subscribe to rank_changed events
   * Requirement: 5.5 - WHEN a provider's rank changes significantly (top 10), THE Gamification_System SHALL emit a congratulatory notification
   * @param {Function} callback - Callback function to handle rank changed events
   * @returns {Function} Unsubscribe function
   */
  onRankChanged: (callback) => {
    if (!gamificationSocket) {
      gamificationService.initializeSocket();
    }

    const handler = (data) => {
      if (data.notificationType === 'rank_changed') {
        callback({
          newRank: data.newRank,
          previousRank: data.previousRank,
          userID: data.userID,
          message: data.message,
          timestamp: new Date()
        });
      }
    };

    gamificationSocket?.on('new_notification', handler);

    // Track listener for cleanup
    if (!eventListeners.has('new_notification')) {
      eventListeners.set('new_notification', []);
    }
    eventListeners.get('new_notification').push(handler);

    // Return unsubscribe function
    return () => {
      gamificationSocket?.off('new_notification', handler);
      const listeners = eventListeners.get('new_notification');
      if (listeners) {
        const index = listeners.indexOf(handler);
        if (index > -1) listeners.splice(index, 1);
      }
    };
  },

  /**
   * Subscribe to all gamification events with a single call
   * @param {Object} handlers - Object containing callback handlers
   * @param {Function} handlers.onBadgeEarned - Callback for badge earned events
   * @param {Function} handlers.onRankChanged - Callback for rank changed events
   * @returns {Function} Unsubscribe function for all events
   */
  subscribeToGamificationEvents: (handlers = {}) => {
    const unsubscribers = [];

    if (handlers.onBadgeEarned) {
      unsubscribers.push(gamificationService.onBadgeEarned(handlers.onBadgeEarned));
    }
    if (handlers.onRankChanged) {
      unsubscribers.push(gamificationService.onRankChanged(handlers.onRankChanged));
    }

    // Return function to unsubscribe from all
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  },

  /**
   * Get user's gamification dashboard
   * @param {number} userID - User ID
   * @returns {Promise<Object>} Dashboard data including points, badges, and rank
   */
  getDashboard: async (userID) => {
    try {
      const response = await api.get(`/gamification/dashboard/${userID}`);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching gamification dashboard:', error);
      throw new Error(error.response?.data?.message || 'Error fetching dashboard');
    }
  },

  /**
   * Get leaderboard
   * @param {number} limit - Maximum number of entries to return
   * @returns {Promise<Array>} Leaderboard entries
   */
  getLeaderboard: async (limit = 50) => {
    try {
      const response = await api.get(`/gamification/leaderboard`, {
        params: { limit }
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch leaderboard');
    }
  },

  /**
   * Get user's rank
   * @param {number} userID - User ID
   * @returns {Promise<Object>} User rank data
   */
  getUserRank: async (userID) => {
    try {
      const response = await api.get(`/gamification/rank/${userID}`);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching user rank:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch user rank');
    }
  },

  /**
   * Add points for job completion
   * @param {number} userID - User ID
   * @param {number} jobId - Job/Service Request ID
   * @param {number} rating - Rating received
   * @returns {Promise<Object>} Updated gamification data
   */
  addPointsForJobCompletion: async (userID, jobId, rating) => {
    try {
      const response = await api.post(`/gamification/add-points`, {
        userID,
        jobId,
        rating
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error adding points:', error);
      throw new Error(error.response?.data?.message || 'Failed to add points');
    }
  },

  /**
   * Format badge name for display
   * @param {string} badgeName - Badge name in snake_case or camelCase
   * @returns {string} Formatted badge name
   */
  formatBadgeName: (badgeName) => {
    if (!badgeName) return '';
    return badgeName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  },

  /**
   * Get badge icon based on badge name
   * @param {string} badgeName - Badge name
   * @returns {string} Emoji icon for the badge
   */
  getBadgeIcon: (badgeName) => {
    const badgeIcons = {
      'centaurion': '🏅',
      'elite_worker': '⭐',
      'master_provider': '👑',
      'first_review': '📝',
      'top_rated': '🌟',
      'earnings_1000': '💰',
      'earnings_5000': '💎',
      'earnings_10000': '🏆'
    };
    return badgeIcons[badgeName?.toLowerCase()] || '🎖️';
  },

  /**
   * Get rank display text
   * @param {number} rank - Rank number
   * @returns {string} Formatted rank text
   */
  getRankDisplay: (rank) => {
    if (!rank || rank <= 0) return 'Unranked';
    if (rank === 1) return '🥇 1st';
    if (rank === 2) return '🥈 2nd';
    if (rank === 3) return '🥉 3rd';
    return `#${rank}`;
  }
};

// Legacy exports for backward compatibility
export const getGamificationDashboard = gamificationService.getDashboard;
export const getLeaderboard = gamificationService.getLeaderboard;
export const getUserRank = gamificationService.getUserRank;
export const addPointsForJobCompletion = gamificationService.addPointsForJobCompletion;

export default gamificationService;
