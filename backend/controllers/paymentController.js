const PaymentStatusService = require('../services/PaymentStatusService');
const Payment = require('../models/Payment');
const IntegrationService = require('../services/IntegrationService');
const { ValidationError, NotFoundError, AuthorizationError, ConflictError } = require('../utils/errors');

/**
 * Helper to validate provider access
 * @param {object} req - Express request object
 * @param {string|number} providerId - Provider ID from params
 * @returns {object} Validation result with valid flag and providerId or error
 */
const validateProviderAccess = (req, providerId) => {
    const parsedProviderId = parseInt(providerId, 10);
    
    if (isNaN(parsedProviderId) || parsedProviderId <= 0) {
        return { valid: false, error: 'Invalid provider ID format', statusCode: 400, errorCode: 'INVALID_PROVIDER' };
    }

    const requestingUserID = req.user?.userID;
    const isOwnData = requestingUserID === parsedProviderId;
    const isAdmin = req.user?.role === 'Admin';

    if (!isOwnData && !isAdmin) {
        return { valid: false, error: 'You can only access your own payment data', statusCode: 403, errorCode: 'FORBIDDEN' };
    }

    return { valid: true, providerId: parsedProviderId };
};

/**
 * Helper to validate customer access
 * @param {object} req - Express request object
 * @param {string|number} customerId - Customer ID from params
 * @returns {object} Validation result with valid flag and customerId or error
 */
const validateCustomerAccess = (req, customerId) => {
    const parsedCustomerId = parseInt(customerId, 10);
    
    if (isNaN(parsedCustomerId) || parsedCustomerId <= 0) {
        return { valid: false, error: 'Invalid customer ID format', statusCode: 400, errorCode: 'INVALID_CUSTOMER' };
    }

    const requestingUserID = req.user?.userID;
    const isOwnData = requestingUserID === parsedCustomerId;
    const isAdmin = req.user?.role === 'Admin';

    if (!isOwnData && !isAdmin) {
        return { valid: false, error: 'You can only access your own payment data', statusCode: 403, errorCode: 'FORBIDDEN' };
    }

    return { valid: true, customerId: parsedCustomerId };
};


/**
 * Parse filter parameters from query string
 * @param {object} query - Express query object
 * @returns {object} Parsed filters
 */
const parseFilters = (query) => {
    const filters = {};
    
    if (query.status) {
        filters.status = query.status;
    }
    
    if (query.startDate) {
        filters.startDate = new Date(query.startDate);
    }
    
    if (query.endDate) {
        filters.endDate = new Date(query.endDate);
    }
    
    if (query.category) {
        filters.category = query.category;
    }
    
    if (query.sortBy) {
        filters.sortBy = query.sortBy;
    }
    
    if (query.sortOrder) {
        filters.sortOrder = query.sortOrder.toUpperCase();
    }
    
    return filters;
};

/**
 * Get all payments for a provider
 * GET /api/payments/provider/:providerId
 */
const getPaymentsByProvider = async (req, res) => {
    try {
        const { providerId } = req.params;
        const validation = validateProviderAccess(req, providerId);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                error: {
                    code: validation.errorCode,
                    message: validation.error
                }
            });
        }

        const filters = parseFilters(req.query);
        const payments = await PaymentStatusService.getPaymentsByProvider(validation.providerId, filters);

        res.status(200).json({
            success: true,
            data: payments
        });
    } catch (error) {
        handleError(res, error, 'fetching provider payments');
    }
};

/**
 * Get all payments for a customer
 * GET /api/payments/customer/:customerId
 */
const getPaymentsByCustomer = async (req, res) => {
    try {
        const { customerId } = req.params;
        const validation = validateCustomerAccess(req, customerId);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                error: {
                    code: validation.errorCode,
                    message: validation.error
                }
            });
        }

        const filters = parseFilters(req.query);
        const payments = await PaymentStatusService.getPaymentsByCustomer(validation.customerId, filters);

        res.status(200).json({
            success: true,
            data: payments
        });
    } catch (error) {
        handleError(res, error, 'fetching customer payments');
    }
};


/**
 * Get payment summary statistics for a provider
 * GET /api/payments/summary/:providerId
 */
const getPaymentSummary = async (req, res) => {
    try {
        const { providerId } = req.params;
        const validation = validateProviderAccess(req, providerId);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                error: {
                    code: validation.errorCode,
                    message: validation.error
                }
            });
        }

        const dateRange = {};
        if (req.query.startDate) {
            dateRange.startDate = req.query.startDate;
        }
        if (req.query.endDate) {
            dateRange.endDate = req.query.endDate;
        }

        const summary = await PaymentStatusService.getPaymentSummary(validation.providerId, dateRange);

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        handleError(res, error, 'fetching payment summary');
    }
};

/**
 * Mark a payment as paid
 * PUT /api/payments/:paymentId/mark-paid
 */
const markPaymentAsPaid = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const parsedPaymentId = parseInt(paymentId, 10);
        
        if (isNaN(parsedPaymentId) || parsedPaymentId <= 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PAYMENT_ID',
                    message: 'Invalid payment ID format'
                }
            });
        }

        const providerId = req.user?.userID;
        if (!providerId) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                }
            });
        }

        const { paymentMethod } = req.body;
        const updatedPayment = await PaymentStatusService.markAsPaid(parsedPaymentId, providerId, paymentMethod || null);

        // Trigger IntegrationService for cross-feature updates
        // This handles: earnings update, analytics refresh, gamification points, notifications
        try {
            const payment = await Payment.findById(parsedPaymentId);
            if (payment && payment.providerID && payment.amount) {
                await IntegrationService.onPaymentCompleted(
                    parsedPaymentId,
                    payment.providerID,
                    parseFloat(payment.amount)
                );
            }
        } catch (integrationError) {
            console.error('Error in IntegrationService.onPaymentCompleted:', integrationError);
            // Don't fail the payment update if integration fails
        }

        res.status(200).json({
            success: true,
            data: updatedPayment,
            message: 'Payment marked as paid successfully'
        });
    } catch (error) {
        handleError(res, error, 'marking payment as paid');
    }
};


/**
 * Check and update overdue payments
 * POST /api/payments/check-overdue
 */
const checkOverduePayments = async (req, res) => {
    try {
        // Optional providerId filter - if provided, only check that provider's payments
        const { providerId } = req.body;
        let parsedProviderId = null;

        if (providerId) {
            parsedProviderId = parseInt(providerId, 10);
            if (isNaN(parsedProviderId) || parsedProviderId <= 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_PROVIDER_ID',
                        message: 'Invalid provider ID format'
                    }
                });
            }

            // If providerId is specified, validate access
            const requestingUserID = req.user?.userID;
            const isOwnData = requestingUserID === parsedProviderId;
            const isAdmin = req.user?.role === 'Admin';

            if (!isOwnData && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'You can only check overdue payments for your own account'
                    }
                });
            }
        } else {
            // If no providerId, only admins can check all payments
            if (req.user?.role !== 'Admin') {
                // Non-admin users can only check their own payments
                parsedProviderId = req.user?.userID;
            }
        }

        const result = await PaymentStatusService.checkOverduePayments(parsedProviderId);

        res.status(200).json({
            success: true,
            data: {
                overdueCount: result.count,
                updatedPayments: result.payments
            },
            message: result.count > 0 
                ? `${result.count} payment(s) marked as overdue`
                : 'No overdue payments found'
        });
    } catch (error) {
        handleError(res, error, 'checking overdue payments');
    }
};

/**
 * Get single payment details
 * GET /api/payments/:paymentId
 */
const getPaymentById = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const parsedPaymentId = parseInt(paymentId, 10);
        
        if (isNaN(parsedPaymentId) || parsedPaymentId <= 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PAYMENT_ID',
                    message: 'Invalid payment ID format'
                }
            });
        }

        const payment = await Payment.findById(parsedPaymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: `Payment with ID ${parsedPaymentId} not found`
                }
            });
        }

        // Check authorization - user must be the provider, customer, or admin
        const requestingUserID = req.user?.userID;
        const isProvider = payment.providerID === requestingUserID;
        const isCustomer = payment.customerID === requestingUserID;
        const isAdmin = req.user?.role === 'Admin';

        if (!isProvider && !isCustomer && !isAdmin) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to view this payment'
                }
            });
        }

        res.status(200).json({
            success: true,
            data: payment
        });
    } catch (error) {
        handleError(res, error, 'fetching payment details');
    }
};


/**
 * Central error handler for payment controller
 * @param {object} res - Express response object
 * @param {Error} error - Error object
 * @param {string} operation - Description of the operation that failed
 */
const handleError = (res, error, operation) => {
    console.error(`Error ${operation}:`, { error: error.message });

    // Handle validation errors
    if (error instanceof ValidationError || error.errorType === 'VALIDATION_ERROR') {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_STATUS',
                message: error.message,
                details: null
            }
        });
    }

    // Handle not found errors
    if (error instanceof NotFoundError || error.errorType === 'NOT_FOUND_ERROR') {
        return res.status(404).json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: error.message,
                details: null
            }
        });
    }

    // Handle authorization errors
    if (error instanceof AuthorizationError || error.errorType === 'AUTHORIZATION_ERROR') {
        return res.status(403).json({
            success: false,
            error: {
                code: 'FORBIDDEN',
                message: error.message,
                details: null
            }
        });
    }

    // Handle conflict errors (e.g., already paid)
    if (error instanceof ConflictError || error.errorType === 'CONFLICT_ERROR') {
        return res.status(409).json({
            success: false,
            error: {
                code: 'ALREADY_PAID',
                message: error.message,
                details: null
            }
        });
    }

    // Handle database errors
    if (error.errorType === 'DATABASE_ERROR' || error.code?.startsWith('ER_')) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'DB_ERROR',
                message: 'Database operation failed',
                details: null
            }
        });
    }

    // Default server error
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: `Server error while ${operation}`,
            details: process.env.NODE_ENV === 'development' ? error.message : null
        }
    });
};

module.exports = {
    getPaymentsByProvider,
    getPaymentsByCustomer,
    getPaymentSummary,
    markPaymentAsPaid,
    checkOverduePayments,
    getPaymentById
};
