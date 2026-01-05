import api from './api';
import { io } from 'socket.io-client';
import { formatCurrency as formatCurrencyUtil, getCurrencySymbol } from '../utils/currency';
import { authService } from './authService';

// Socket.io instance for payment notifications
let paymentSocket = null;

// Event listeners registry for cleanup
const eventListeners = new Map();

/**
 * Payment Service
 * API client methods for all payment endpoints and helper functions for data formatting
 * Synchronized with Earnings, Analytics, and Gamification features
 * Includes real-time payment status update notifications
 * Requirements: 5.1
 */
export const paymentService = {
    // ==================== Socket Management ====================

    /**
     * Initialize socket connection for payment events
     * @returns {Socket|null} Socket instance or null if no auth token
     */
    initializeSocket: () => {
        const token = authService.getToken();
        if (!token) {
            console.warn('Cannot initialize payment socket: No auth token');
            return null;
        }

        // Don't create duplicate connections
        if (paymentSocket && paymentSocket.connected) {
            return paymentSocket;
        }

        const socketUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

        paymentSocket = io(socketUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        paymentSocket.on('connect', () => {
            console.log('Payment socket connected');
        });

        paymentSocket.on('disconnect', (reason) => {
            console.log('Payment socket disconnected:', reason);
        });

        paymentSocket.on('connect_error', (error) => {
            console.error('Payment socket connection error:', error.message);
        });

        return paymentSocket;
    },

    /**
     * Get the current socket instance
     * @returns {Socket|null} Socket instance
     */
    getSocket: () => {
        return paymentSocket;
    },

    /**
     * Disconnect and cleanup socket connection
     */
    disconnectSocket: () => {
        if (paymentSocket) {
            // Remove all registered event listeners
            eventListeners.forEach((callbacks, event) => {
                callbacks.forEach(callback => {
                    paymentSocket.off(event, callback);
                });
            });
            eventListeners.clear();

            paymentSocket.disconnect();
            paymentSocket = null;
            console.log('Payment socket disconnected and cleaned up');
        }
    },

    /**
     * Subscribe to payment_status_update events
     * Requirement: 5.1 - WHEN a payment status changes, THE Payment_System SHALL emit a real-time notification to the customer
     * @param {Function} callback - Callback function to handle payment status update events
     * @returns {Function} Unsubscribe function
     */
    onPaymentStatusUpdate: (callback) => {
        if (!paymentSocket) {
            paymentService.initializeSocket();
        }

        const handler = (data) => {
            if (data.notificationType === 'payment_status_update' || data.notificationType === 'payment_update') {
                callback({
                    paymentID: data.paymentID,
                    requestID: data.requestID,
                    status: data.status,
                    previousStatus: data.previousStatus,
                    amount: data.amount,
                    message: data.message,
                    timestamp: new Date()
                });
            }
        };

        paymentSocket?.on('new_notification', handler);

        // Track listener for cleanup
        if (!eventListeners.has('new_notification')) {
            eventListeners.set('new_notification', []);
        }
        eventListeners.get('new_notification').push(handler);

        // Return unsubscribe function
        return () => {
            paymentSocket?.off('new_notification', handler);
            const listeners = eventListeners.get('new_notification');
            if (listeners) {
                const index = listeners.indexOf(handler);
                if (index > -1) listeners.splice(index, 1);
            }
        };
    },

    /**
     * Subscribe to payment overdue notifications
     * Requirement: 8.3 - WHEN a payment becomes overdue, THE Payment_System SHALL emit a notification
     * @param {Function} callback - Callback function to handle overdue payment events
     * @returns {Function} Unsubscribe function
     */
    onPaymentOverdue: (callback) => {
        if (!paymentSocket) {
            paymentService.initializeSocket();
        }

        const handler = (data) => {
            if (data.notificationType === 'payment_overdue') {
                callback({
                    paymentID: data.paymentID,
                    requestID: data.requestID,
                    amount: data.amount,
                    dueDate: data.dueDate,
                    message: data.message,
                    timestamp: new Date()
                });
            }
        };

        paymentSocket?.on('new_notification', handler);

        // Track listener for cleanup
        if (!eventListeners.has('new_notification')) {
            eventListeners.set('new_notification', []);
        }
        eventListeners.get('new_notification').push(handler);

        // Return unsubscribe function
        return () => {
            paymentSocket?.off('new_notification', handler);
            const listeners = eventListeners.get('new_notification');
            if (listeners) {
                const index = listeners.indexOf(handler);
                if (index > -1) listeners.splice(index, 1);
            }
        };
    },

    /**
     * Subscribe to all payment events with a single call
     * @param {Object} handlers - Object containing callback handlers
     * @param {Function} handlers.onPaymentStatusUpdate - Callback for payment status update events
     * @param {Function} handlers.onPaymentOverdue - Callback for payment overdue events
     * @returns {Function} Unsubscribe function for all events
     */
    subscribeToPaymentEvents: (handlers = {}) => {
        const unsubscribers = [];

        if (handlers.onPaymentStatusUpdate) {
            unsubscribers.push(paymentService.onPaymentStatusUpdate(handlers.onPaymentStatusUpdate));
        }
        if (handlers.onPaymentOverdue) {
            unsubscribers.push(paymentService.onPaymentOverdue(handlers.onPaymentOverdue));
        }

        // Return function to unsubscribe from all
        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
    },
    // ==================== Provider Payments ====================

    /**
     * Get all payments for a provider with optional filters
     * @param {number} providerId - Provider's user ID
     * @param {Object} filters - Optional filters
     * @param {string} filters.status - Filter by status ('Pending', 'Paid', 'Overdue')
     * @param {string} filters.startDate - Start date in YYYY-MM-DD format
     * @param {string} filters.endDate - End date in YYYY-MM-DD format
     * @param {string} filters.category - Filter by service category
     * @param {string} filters.sortBy - Sort field ('date', 'amount', 'status')
     * @param {string} filters.sortOrder - Sort order ('asc', 'desc')
     * @returns {Promise<Payment[]>} Array of payment records
     */
    getPaymentsByProvider: async (providerId, filters = {}) => {
        const params = new URLSearchParams();
        
        if (filters.status) {
            params.append('status', filters.status);
        }
        if (filters.startDate) {
            params.append('startDate', filters.startDate);
        }
        if (filters.endDate) {
            params.append('endDate', filters.endDate);
        }
        if (filters.category) {
            params.append('category', filters.category);
        }
        if (filters.sortBy) {
            params.append('sortBy', filters.sortBy);
        }
        if (filters.sortOrder) {
            params.append('sortOrder', filters.sortOrder);
        }

        const queryString = params.toString();
        const url = `/payments/provider/${providerId}${queryString ? `?${queryString}` : ''}`;
        
        try {
            const response = await api.get(url);
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data?.error?.message || 'Failed to fetch provider payments');
        } catch (error) {
            console.error('getPaymentsByProvider error:', error.response?.data || error.message);
            throw error;
        }
    },


    // ==================== Customer Payments ====================

    /**
     * Get all payments for a customer with optional filters
     * @param {number} customerId - Customer's user ID
     * @param {Object} filters - Optional filters
     * @param {string} filters.status - Filter by status ('Pending', 'Paid', 'Overdue')
     * @param {string} filters.startDate - Start date in YYYY-MM-DD format
     * @param {string} filters.endDate - End date in YYYY-MM-DD format
     * @returns {Promise<Payment[]>} Array of payment records
     */
    getPaymentsByCustomer: async (customerId, filters = {}) => {
        const params = new URLSearchParams();
        
        if (filters.status) {
            params.append('status', filters.status);
        }
        if (filters.startDate) {
            params.append('startDate', filters.startDate);
        }
        if (filters.endDate) {
            params.append('endDate', filters.endDate);
        }

        const queryString = params.toString();
        const url = `/payments/customer/${customerId}${queryString ? `?${queryString}` : ''}`;
        
        console.log('getPaymentsByCustomer - Calling URL:', url);
        console.log('getPaymentsByCustomer - Customer ID:', customerId);
        console.log('getPaymentsByCustomer - Full URL will be:', `http://localhost:5001/api${url}`);
        
        try {
            const response = await api.get(url);
            console.log('getPaymentsByCustomer - Response:', response.data);
            if (response.data && response.data.success) {
                return response.data.data || [];
            }
            throw new Error(response.data?.error?.message || 'Failed to fetch customer payments');
        } catch (error) {
            console.error('getPaymentsByCustomer error:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                url: error.config?.url,
                fullUrl: error.config?.baseURL + error.config?.url
            });
            throw error;
        }
    },

    // ==================== Payment Summary ====================

    /**
     * Get payment summary statistics for a provider
     * @param {number} providerId - Provider's user ID
     * @param {Object} dateRange - Optional date range filter
     * @param {string} dateRange.startDate - Start date in YYYY-MM-DD format
     * @param {string} dateRange.endDate - End date in YYYY-MM-DD format
     * @returns {Promise<PaymentSummary>} Payment summary statistics
     */
    getPaymentSummary: async (providerId, dateRange = {}) => {
        const params = new URLSearchParams();
        
        if (dateRange.startDate) {
            params.append('startDate', dateRange.startDate);
        }
        if (dateRange.endDate) {
            params.append('endDate', dateRange.endDate);
        }

        const queryString = params.toString();
        const url = `/payments/summary/${providerId}${queryString ? `?${queryString}` : ''}`;
        
        try {
            const response = await api.get(url);
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data?.error?.message || 'Failed to fetch payment summary');
        } catch (error) {
            console.error('getPaymentSummary error:', error.response?.data || error.message);
            throw error;
        }
    },


    // ==================== Payment Actions ====================

    /**
     * Mark a payment as paid
     * @param {number} paymentId - Payment ID
     * @param {string} paymentMethod - Optional payment method (e.g., 'Cash', 'Card', 'Transfer')
     * @returns {Promise<Payment>} Updated payment record
     */
    markAsPaid: async (paymentId, paymentMethod = null) => {
        const url = `/payments/${paymentId}/mark-paid`;
        const body = paymentMethod ? { paymentMethod } : {};
        
        try {
            const response = await api.put(url, body);
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data?.error?.message || 'Failed to mark payment as paid');
        } catch (error) {
            console.error('markAsPaid error:', error.response?.data || error.message);
            throw error;
        }
    },

    /**
     * Check and update overdue payments
     * @param {number} providerId - Optional provider ID to check only their payments
     * @returns {Promise<{overdueCount: number, updatedPayments: Payment[]}>} Result of overdue check
     */
    checkOverduePayments: async (providerId = null) => {
        const url = '/payments/check-overdue';
        const body = providerId ? { providerId } : {};
        
        try {
            const response = await api.post(url, body);
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data?.error?.message || 'Failed to check overdue payments');
        } catch (error) {
            console.error('checkOverduePayments error:', error.response?.data || error.message);
            throw error;
        }
    },

    // ==================== Single Payment ====================

    /**
     * Get single payment details by ID
     * @param {number} paymentId - Payment ID
     * @returns {Promise<Payment>} Payment record with full details
     */
    getPaymentById: async (paymentId) => {
        const url = `/payments/${paymentId}`;
        
        try {
            const response = await api.get(url);
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data?.error?.message || 'Failed to fetch payment details');
        } catch (error) {
            console.error('getPaymentById error:', error.response?.data || error.message);
            throw error;
        }
    },


    // ==================== Helper Functions ====================

    /**
     * Format currency value using centralized BDT configuration
     * @param {number} value - Amount to format
     * @returns {string} Formatted currency string in BDT
     */
    formatCurrency: (value) => {
        return formatCurrencyUtil(value);
    },

    /**
     * Format percentage value
     * @param {number} value - Percentage value
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted percentage string
     */
    formatPercentage: (value, decimals = 1) => {
        if (value === null || value === undefined) return '0%';
        return `${parseFloat(value).toFixed(decimals)}%`;
    },

    /**
     * Format date for display
     * @param {string|Date} dateValue - Date to format
     * @param {Object} options - Intl.DateTimeFormat options
     * @returns {string} Formatted date string
     */
    formatDate: (dateValue, options = {}) => {
        if (!dateValue) return '';
        
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        const date = typeof dateValue === 'string' 
            ? new Date(dateValue + (dateValue.includes('T') ? '' : 'T00:00:00'))
            : dateValue;
            
        return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(date);
    },

    /**
     * Get status color class for styling
     * @param {string} status - Payment status ('Pending', 'Paid', 'Overdue')
     * @returns {string} CSS class name for the status
     */
    getStatusColorClass: (status) => {
        switch (status) {
            case 'Paid':
                return 'status-paid';
            case 'Overdue':
                return 'status-overdue';
            case 'Pending':
            default:
                return 'status-pending';
        }
    },

    /**
     * Get status color for inline styling
     * @param {string} status - Payment status ('Pending', 'Paid', 'Overdue')
     * @returns {string} CSS color value
     */
    getStatusColor: (status) => {
        switch (status) {
            case 'Paid':
                return '#28a745'; // Green
            case 'Overdue':
                return '#dc3545'; // Red
            case 'Pending':
            default:
                return '#ffc107'; // Yellow
        }
    },

    /**
     * Get status background color for badges
     * @param {string} status - Payment status ('Pending', 'Paid', 'Overdue')
     * @returns {string} CSS background color value
     */
    getStatusBackgroundColor: (status) => {
        switch (status) {
            case 'Paid':
                return '#d4edda'; // Light green
            case 'Overdue':
                return '#f8d7da'; // Light red
            case 'Pending':
            default:
                return '#fff3cd'; // Light yellow
        }
    },


    /**
     * Check if a payment is overdue based on due date
     * @param {string|Date} dueDate - Payment due date
     * @returns {boolean} True if payment is past due date
     */
    isOverdue: (dueDate) => {
        if (!dueDate) return false;
        const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
        return due < new Date();
    },

    /**
     * Get days until due or days overdue
     * @param {string|Date} dueDate - Payment due date
     * @returns {Object} Object with days count and isOverdue flag
     */
    getDueDateInfo: (dueDate) => {
        if (!dueDate) return { days: 0, isOverdue: false, label: '' };
        
        const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return {
                days: Math.abs(diffDays),
                isOverdue: true,
                label: `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`
            };
        } else if (diffDays === 0) {
            return {
                days: 0,
                isOverdue: false,
                label: 'Due today'
            };
        } else {
            return {
                days: diffDays,
                isOverdue: false,
                label: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`
            };
        }
    },

    /**
     * Calculate total amount from payments array
     * @param {Payment[]} payments - Array of payment records
     * @returns {number} Total amount
     */
    calculateTotalAmount: (payments) => {
        if (!payments || !Array.isArray(payments)) return 0;
        return payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    },

    /**
     * Calculate total outstanding (Pending + Overdue)
     * @param {PaymentSummary} summary - Payment summary object
     * @returns {number} Total outstanding amount
     */
    calculateTotalOutstanding: (summary) => {
        if (!summary) return 0;
        const pendingAmount = summary.pending?.amount || 0;
        const overdueAmount = summary.overdue?.amount || 0;
        return pendingAmount + overdueAmount;
    },

    /**
     * Get date string in YYYY-MM-DD format
     * @param {Date} date - Date object
     * @returns {string} Date string in YYYY-MM-DD format
     */
    toDateString: (date) => {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Get today's date string in YYYY-MM-DD format
     * @returns {string} Today's date string
     */
    getTodayString: () => {
        return paymentService.toDateString(new Date());
    },

    /**
     * Get date range for last N days
     * @param {number} days - Number of days
     * @returns {Object} Object with startDate and endDate strings
     */
    getLastNDaysRange: (days) => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        return {
            startDate: paymentService.toDateString(startDate),
            endDate: paymentService.toDateString(endDate)
        };
    },

    /**
     * Get date range for current month
     * @returns {Object} Object with startDate and endDate strings
     */
    getCurrentMonthRange: () => {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        return {
            startDate: paymentService.toDateString(startDate),
            endDate: paymentService.toDateString(endDate)
        };
    },

    /**
     * Payment status options for filters
     */
    statusOptions: [
        { value: '', label: 'All Statuses' },
        { value: 'Pending', label: 'Pending' },
        { value: 'Paid', label: 'Paid' },
        { value: 'Overdue', label: 'Overdue' }
    ],

    /**
     * Payment method options
     */
    paymentMethodOptions: [
        { value: 'Cash', label: 'Cash' },
        { value: 'Card', label: 'Card' },
        { value: 'Transfer', label: 'Bank Transfer' },
        { value: 'Check', label: 'Check' },
        { value: 'Other', label: 'Other' }
    ]
};

export default paymentService;
