const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
const { ValidationError, NotFoundError, AuthorizationError, ConflictError } = require('../utils/errors');

/**
 * PaymentStatusService - Core service for payment status management,
 * overdue detection, and payment statistics.
 */
class PaymentStatusService {
    /**
     * Get payments by provider with optional filters
     * @param {number} providerId - Provider user ID
     * @param {Object} [filters={}] - Optional filters
     * @param {string} [filters.status] - Filter by payment status ('Pending', 'Paid', 'Overdue')
     * @param {Date} [filters.startDate] - Filter by start date
     * @param {Date} [filters.endDate] - Filter by end date
     * @param {string} [filters.category] - Filter by service category
     * @param {string} [filters.sortBy='createdAt'] - Sort field ('createdAt', 'amount', 'status', 'dueDate', 'paymentDate')
     * @param {string} [filters.sortOrder='DESC'] - Sort order ('ASC' or 'DESC')
     * @returns {Promise<Array>} - Array of payment records with service request and customer details
     */
    static async getPaymentsByProvider(providerId, filters = {}) {
        if (!providerId) {
            throw new ValidationError('Provider ID is required');
        }

        // Validate status filter if provided
        if (filters.status && !Object.values(this.STATUSES).includes(filters.status)) {
            throw new ValidationError(`Invalid status filter: ${filters.status}`);
        }

        return await Payment.findByProvider(providerId, filters);
    }

    /**
     * Get payments by customer with optional filters
     * @param {number} customerId - Customer user ID
     * @param {Object} [filters={}] - Optional filters
     * @param {string} [filters.status] - Filter by payment status ('Pending', 'Paid', 'Overdue')
     * @param {Date} [filters.startDate] - Filter by start date
     * @param {Date} [filters.endDate] - Filter by end date
     * @param {string} [filters.sortBy='createdAt'] - Sort field ('createdAt', 'amount', 'status', 'dueDate', 'paymentDate')
     * @param {string} [filters.sortOrder='DESC'] - Sort order ('ASC' or 'DESC')
     * @returns {Promise<Array>} - Array of payment records with service request and provider details
     */
    static async getPaymentsByCustomer(customerId, filters = {}) {
        if (!customerId) {
            throw new ValidationError('Customer ID is required');
        }

        // Validate status filter if provided
        if (filters.status && !Object.values(this.STATUSES).includes(filters.status)) {
            throw new ValidationError(`Invalid status filter: ${filters.status}`);
        }

        return await Payment.findByCustomer(customerId, filters);
    }

    /**
     * Valid payment statuses
     */
    static STATUSES = {
        PENDING: 'Pending',
        PAID: 'Paid',
        OVERDUE: 'Overdue'
    };

    /**
     * Legacy status mappings (for backward compatibility with existing data)
     * Maps legacy status values to current valid statuses
     */
    static LEGACY_STATUS_MAP = {
        'Completed': 'Paid'  // Legacy "Completed" status maps to "Paid"
    };

    /**
     * Valid status transitions map
     * Key: current status, Value: array of valid target statuses
     */
    static VALID_TRANSITIONS = {
        'Pending': ['Paid', 'Overdue'],
        'Overdue': ['Paid'],
        'Paid': [] // No transitions allowed from Paid
    };

    /**
     * Validate if a status transition is allowed
     * @param {string} currentStatus - Current payment status
     * @param {string} newStatus - Target payment status
     * @returns {{ valid: boolean, error?: string }} - Validation result
     */
    static isValidStatusTransition(currentStatus, newStatus) {
        // Normalize legacy status values
        const normalizedCurrentStatus = this.LEGACY_STATUS_MAP[currentStatus] || currentStatus;
        
        // Validate current status is known
        if (!this.VALID_TRANSITIONS.hasOwnProperty(normalizedCurrentStatus)) {
            return {
                valid: false,
                error: `Invalid current status: ${currentStatus}`
            };
        }

        // Validate new status is known
        const allStatuses = Object.values(this.STATUSES);
        if (!allStatuses.includes(newStatus)) {
            return {
                valid: false,
                error: `Invalid target status: ${newStatus}`
            };
        }

        // Check if transition is allowed
        const allowedTransitions = this.VALID_TRANSITIONS[normalizedCurrentStatus];
        if (!allowedTransitions.includes(newStatus)) {
            return {
                valid: false,
                error: `Invalid transition from '${normalizedCurrentStatus}' to '${newStatus}'`
            };
        }

        return { valid: true };
    }

    /**
     * Calculate due date based on service completion date
     * @param {Date|string} completionDate - Service completion date
     * @param {number} [overduePeriodDays=7] - Number of days until payment is overdue
     * @returns {Date} - Calculated due date
     */
    static calculateDueDate(completionDate, overduePeriodDays = 7) {
        const completion = new Date(completionDate);
        
        if (isNaN(completion.getTime())) {
            throw new ValidationError('Invalid completion date');
        }

        if (typeof overduePeriodDays !== 'number' || overduePeriodDays < 0) {
            throw new ValidationError('Overdue period must be a non-negative number');
        }

        const dueDate = new Date(completion);
        dueDate.setDate(dueDate.getDate() + overduePeriodDays);
        return dueDate;
    }

    /**
     * Create a payment record for a completed service
     * @param {number} requestId - Service request ID
     * @param {number} amount - Payment amount (must be positive)
     * @param {number} [overduePeriodDays=7] - Number of days until payment is overdue
     * @returns {Promise<Object>} - Created payment record with full details
     * @throws {ValidationError} - If amount is not positive
     * @throws {NotFoundError} - If requestID does not exist
     */
    static async createPaymentForService(requestId, amount, overduePeriodDays = 7) {
        // Validate amount is positive (also handles NaN, null, undefined, non-numbers)
        if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
            throw new ValidationError('Amount must be a positive number');
        }

        // Validate requestID exists
        const serviceRequest = await ServiceRequest.findById(requestId);
        if (!serviceRequest) {
            throw new NotFoundError('ServiceRequest', requestId);
        }

        // Calculate due date based on service completion date or current date
        const completionDate = serviceRequest.serviceDate || new Date();
        const dueDate = this.calculateDueDate(completionDate, overduePeriodDays);

        // Create payment with initial status 'Pending'
        const paymentId = await Payment.create({
            requestID: requestId,
            amount: amount,
            dueDate: dueDate,
            status: this.STATUSES.PENDING
        });

        // Return the full payment record
        return await Payment.findById(paymentId);
    }

    /**
     * Check and update overdue payments
     * Finds all Pending payments with dueDate < current date and updates them to Overdue
     * @param {number} [providerId=null] - Optional provider ID to filter (null for all providers)
     * @returns {Promise<{ count: number, payments: Array }>} - Count of updated payments and the updated payment records
     */
    static async checkOverduePayments(providerId = null) {
        // Find all pending payments that are past their due date
        const overduePayments = await Payment.findOverdue(providerId);

        if (overduePayments.length === 0) {
            return { count: 0, payments: [] };
        }

        // Extract payment IDs
        const paymentIDs = overduePayments.map(p => p.paymentID);

        // Update all overdue payments to 'Overdue' status
        const updatedCount = await Payment.markAsOverdue(paymentIDs);

        // Emit overdue notifications for each payment
        await this.emitOverdueNotifications(overduePayments);

        // Return the count and the payments that were updated
        return {
            count: updatedCount,
            payments: overduePayments
        };
    }

    /**
     * Emit overdue payment notifications to both provider and customer
     * @param {Array} overduePayments - Array of overdue payment records
     */
    static async emitOverdueNotifications(overduePayments) {
        const Notification = require('../models/Notification');

        for (const payment of overduePayments) {
            const { paymentID, providerID, customerID, amount, customerName, providerName } = payment;

            try {
                // Notify provider
                if (providerID) {
                    await Notification.create({
                        userID: providerID,
                        requestID: payment.requestID,
                        message: `Payment of ৳${amount} from ${customerName || 'customer'} is now overdue`,
                        notificationType: 'payment_overdue'
                    });

                    // Emit Socket.io event to provider
                    if (global.io) {
                        global.io.to(`user_${providerID}`).emit('payment_overdue', {
                            paymentID,
                            amount,
                            customerName: customerName || 'Customer',
                            message: `Payment of ৳${amount} is now overdue`
                        });
                    }
                }

                // Notify customer
                if (customerID) {
                    await Notification.create({
                        userID: customerID,
                        requestID: payment.requestID,
                        message: `Your payment of ৳${amount} to ${providerName || 'provider'} is now overdue. Please make the payment soon.`,
                        notificationType: 'payment_overdue'
                    });

                    // Emit Socket.io event to customer
                    if (global.io) {
                        global.io.to(`user_${customerID}`).emit('payment_overdue', {
                            paymentID,
                            amount,
                            providerName: providerName || 'Provider',
                            message: `Your payment of ৳${amount} is now overdue`
                        });
                    }
                }
            } catch (error) {
                console.error(`Error emitting overdue notification for payment ${paymentID}:`, error);
                // Continue with other payments even if one fails
            }
        }
    }

    /**
     * Get payment summary statistics for a provider
     * @param {number} providerId - Provider user ID
     * @param {Object} [dateRange={}] - Optional date range filter
     * @param {Date|string} [dateRange.startDate] - Start date for filtering
     * @param {Date|string} [dateRange.endDate] - End date for filtering
     * @returns {Promise<Object>} - Payment summary statistics
     * @returns {Object} returns.pending - Pending payments stats { count, amount }
     * @returns {Object} returns.paid - Paid payments stats { count, amount }
     * @returns {Object} returns.overdue - Overdue payments stats { count, amount }
     * @returns {number} returns.totalOutstanding - Sum of pending and overdue amounts
     * @returns {number} returns.collectionRate - Percentage of paid payments (0-100)
     * @returns {Object} returns.dateRange - Applied date range { start, end }
     * @throws {ValidationError} - If providerId is not provided
     */
    static async getPaymentSummary(providerId, dateRange = {}) {
        if (!providerId) {
            throw new ValidationError('Provider ID is required');
        }

        // Normalize date range
        const normalizedDateRange = {};
        if (dateRange.startDate) {
            normalizedDateRange.startDate = new Date(dateRange.startDate);
        }
        if (dateRange.endDate) {
            normalizedDateRange.endDate = new Date(dateRange.endDate);
        }

        return await Payment.getSummary(providerId, normalizedDateRange);
    }

    /**
     * Mark a payment as paid
     * @param {number} paymentId - Payment ID
     * @param {number} providerId - Provider user ID (for authorization)
     * @param {string} [paymentMethod=null] - Optional payment method
     * @returns {Promise<Object>} - Updated payment record with full details
     * @throws {NotFoundError} - If payment does not exist
     * @throws {AuthorizationError} - If payment does not belong to provider
     * @throws {ConflictError} - If payment is already paid
     * @throws {ValidationError} - If status transition is invalid
     */
    static async markAsPaid(paymentId, providerId, paymentMethod = null) {
        // Validate paymentId
        if (!paymentId) {
            throw new ValidationError('Payment ID is required');
        }

        // Validate providerId
        if (!providerId) {
            throw new ValidationError('Provider ID is required');
        }

        // Find the payment
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            throw new NotFoundError('Payment', paymentId);
        }

        // Validate payment belongs to provider
        if (payment.providerID !== providerId) {
            throw new AuthorizationError('You do not have permission to update this payment');
        }

        // Check if payment is already paid
        if (payment.status === this.STATUSES.PAID) {
            throw new ConflictError('Payment is already marked as paid');
        }

        // Validate status transition
        const transitionResult = this.isValidStatusTransition(payment.status, this.STATUSES.PAID);
        if (!transitionResult.valid) {
            throw new ValidationError(transitionResult.error);
        }

        // Update payment to Paid status
        const paymentDate = new Date();
        const updatedPayment = await Payment.update(paymentId, {
            status: this.STATUSES.PAID,
            paymentDate: paymentDate,
            paymentMethod: paymentMethod
        });

        return updatedPayment;
    }
}

module.exports = PaymentStatusService;
