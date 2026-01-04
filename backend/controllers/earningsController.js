const EarningsService = require('../services/EarningsService');
const EarningsGoalService = require('../services/EarningsGoalService');
const EarningsExportService = require('../services/EarningsExportService');
const { ValidationError } = require('../utils/errors');
const path = require('path');
const fs = require('fs').promises;

/**
 * Helper to validate provider access
 * @param {object} req - Express request object
 * @param {string|number} providerID - Provider ID from params
 * @returns {object} Validation result with valid flag and providerID or error
 */
const validateProviderAccess = (req, providerID) => {
    const parsedProviderID = parseInt(providerID, 10);
    
    if (isNaN(parsedProviderID) || parsedProviderID <= 0) {
        return { valid: false, error: 'Invalid provider ID format', statusCode: 400, errorCode: 'INVALID_PROVIDER' };
    }

    const requestingUserID = req.user?.userID;
    const isOwnEarnings = requestingUserID === parsedProviderID;
    const isAdmin = req.user?.role === 'Admin';

    if (!isOwnEarnings && !isAdmin) {
        return { valid: false, error: 'You can only access your own earnings data', statusCode: 403, errorCode: 'UNAUTHORIZED' };
    }

    return { valid: true, providerID: parsedProviderID };
};

/**
 * Get daily earnings for a specific date
 * GET /api/earnings/:providerID/daily?date=YYYY-MM-DD
 */
const getDailyEarnings = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error,
                errorCode: validation.errorCode
            });
        }

        // Default to today if no date provided
        const date = req.query.date || new Date().toISOString().split('T')[0];

        const dailyEarnings = await EarningsService.getDailyEarnings(validation.providerID, date);

        res.status(200).json({
            success: true,
            data: dailyEarnings
        });
    } catch (error) {
        handleError(res, error, 'fetching daily earnings');
    }
};


/**
 * Get daily earnings for a date range
 * GET /api/earnings/:providerID/daily/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&categories=cat1,cat2
 */
const getDailyEarningsRange = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error,
                errorCode: validation.errorCode
            });
        }

        const { startDate, endDate, categories } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required',
                errorCode: 'INVALID_DATE'
            });
        }

        // Parse categories from comma-separated string
        const categoryFilter = categories ? categories.split(',').map(c => c.trim()).filter(c => c) : [];

        const earningsRange = await EarningsService.getDailyEarningsRange(
            validation.providerID, 
            startDate, 
            endDate, 
            categoryFilter
        );

        res.status(200).json({
            success: true,
            data: earningsRange
        });
    } catch (error) {
        handleError(res, error, 'fetching daily earnings range');
    }
};

/**
 * Get monthly earnings summary
 * GET /api/earnings/:providerID/monthly?year=2026&month=1&categories=cat1,cat2
 */
const getMonthlyEarnings = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error,
                errorCode: validation.errorCode
            });
        }

        // Default to current month if not provided
        const now = new Date();
        const year = parseInt(req.query.year, 10) || now.getFullYear();
        const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);
        const categories = req.query.categories;

        // Parse categories from comma-separated string
        const categoryFilter = categories ? categories.split(',').map(c => c.trim()).filter(c => c) : [];

        const monthlyEarnings = await EarningsService.getMonthlyEarnings(
            validation.providerID, 
            year, 
            month, 
            categoryFilter
        );

        res.status(200).json({
            success: true,
            data: monthlyEarnings
        });
    } catch (error) {
        handleError(res, error, 'fetching monthly earnings');
    }
};

/**
 * Get provider's service categories
 * GET /api/earnings/:providerID/categories
 */
const getProviderCategories = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error,
                errorCode: validation.errorCode
            });
        }

        const categories = await EarningsService.getProviderCategories(validation.providerID);

        res.status(200).json({
            success: true,
            data: categories
        });
    } catch (error) {
        handleError(res, error, 'fetching provider categories');
    }
};


/**
 * Create or update an earnings goal
 * POST /api/earnings/:providerID/goals
 * Body: { goalType: 'daily'|'monthly', targetAmount: number, startDate?: string, endDate?: string }
 */
const setGoal = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error,
                errorCode: validation.errorCode
            });
        }

        const { goalType, targetAmount, startDate, endDate } = req.body;

        if (!goalType || !['daily', 'monthly'].includes(goalType)) {
            return res.status(400).json({
                success: false,
                message: 'Goal type must be "daily" or "monthly"',
                errorCode: 'INVALID_GOAL'
            });
        }

        if (!targetAmount || typeof targetAmount !== 'number' || targetAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Goal amount must be a positive number',
                errorCode: 'INVALID_GOAL'
            });
        }

        const goal = await EarningsGoalService.setGoal(validation.providerID, {
            goalType,
            targetAmount,
            startDate,
            endDate
        });

        res.status(201).json({
            success: true,
            data: goal
        });
    } catch (error) {
        handleError(res, error, 'setting earnings goal');
    }
};

/**
 * Get active goals for a provider
 * GET /api/earnings/:providerID/goals
 */
const getActiveGoals = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error,
                errorCode: validation.errorCode
            });
        }

        const goals = await EarningsGoalService.getActiveGoals(validation.providerID);

        res.status(200).json({
            success: true,
            data: goals
        });
    } catch (error) {
        handleError(res, error, 'fetching active goals');
    }
};

/**
 * Get goal progress
 * GET /api/earnings/:providerID/goals/:goalID/progress
 */
const getGoalProgress = async (req, res) => {
    try {
        const { providerID, goalID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error,
                errorCode: validation.errorCode
            });
        }

        const parsedGoalID = parseInt(goalID, 10);
        if (isNaN(parsedGoalID) || parsedGoalID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid goal ID format',
                errorCode: 'INVALID_GOAL'
            });
        }

        const progress = await EarningsGoalService.getGoalProgress(validation.providerID, parsedGoalID);

        res.status(200).json({
            success: true,
            data: progress
        });
    } catch (error) {
        handleError(res, error, 'fetching goal progress');
    }
};

/**
 * Delete a goal
 * DELETE /api/earnings/:providerID/goals/:goalID
 */
const deleteGoal = async (req, res) => {
    try {
        const { providerID, goalID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error,
                errorCode: validation.errorCode
            });
        }

        const parsedGoalID = parseInt(goalID, 10);
        if (isNaN(parsedGoalID) || parsedGoalID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid goal ID format',
                errorCode: 'INVALID_GOAL'
            });
        }

        await EarningsGoalService.deleteGoal(validation.providerID, parsedGoalID);

        res.status(200).json({
            success: true,
            message: 'Goal deleted successfully'
        });
    } catch (error) {
        handleError(res, error, 'deleting goal');
    }
};


/**
 * Export earnings data as CSV
 * GET /api/earnings/:providerID/export?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&categories=cat1,cat2
 */
const exportEarnings = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error,
                errorCode: validation.errorCode
            });
        }

        const { startDate, endDate, categories } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required',
                errorCode: 'INVALID_DATE'
            });
        }

        // Parse categories from comma-separated string
        const categoryFilter = categories ? categories.split(',').map(c => c.trim()).filter(c => c) : [];

        const exportResult = await EarningsExportService.generateCSVExport(
            validation.providerID,
            startDate,
            endDate,
            categoryFilter
        );

        // Handle no data case
        if (!exportResult.success) {
            return res.status(200).json({
                success: false,
                message: exportResult.message,
                data: {
                    recordCount: 0,
                    dateRange: exportResult.dateRange
                }
            });
        }

        // Read the file and send as download
        const fileContent = await fs.readFile(exportResult.filePath, 'utf8');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`);
        res.status(200).send(fileContent);
    } catch (error) {
        handleError(res, error, 'exporting earnings');
    }
};

/**
 * Central error handler for earnings controller
 * @param {object} res - Express response object
 * @param {Error} error - Error object
 * @param {string} operation - Description of the operation that failed
 */
const handleError = (res, error, operation) => {
    console.error(`Error ${operation}:`, { error: error.message });

    // Handle validation errors from services
    if (error instanceof ValidationError || error.errorType === 'VALIDATION_ERROR') {
        const statusCode = error.statusCode || 400;
        let errorCode = 'VALIDATION_ERROR';
        
        // Map specific validation messages to error codes
        if (error.message.includes('provider ID')) {
            errorCode = 'INVALID_PROVIDER';
        } else if (error.message.includes('Date must be') || error.message.includes('date')) {
            errorCode = 'INVALID_DATE';
        } else if (error.message.includes('Month must be')) {
            errorCode = 'INVALID_MONTH';
        } else if (error.message.includes('future')) {
            errorCode = 'FUTURE_DATE';
        } else if (error.message.includes('Goal') || error.message.includes('goal')) {
            errorCode = error.message.includes('not found') ? 'GOAL_NOT_FOUND' : 'INVALID_GOAL';
        }

        return res.status(statusCode).json({
            success: false,
            message: error.message,
            errorCode
        });
    }

    // Handle not found errors
    if (error.errorType === 'NOT_FOUND_ERROR' || error.statusCode === 404) {
        return res.status(404).json({
            success: false,
            message: error.message,
            errorCode: error.message.includes('Provider') ? 'PROVIDER_NOT_FOUND' : 'GOAL_NOT_FOUND'
        });
    }

    // Handle database errors
    if (error.errorType === 'DATABASE_ERROR' || error.code?.startsWith('ER_')) {
        return res.status(500).json({
            success: false,
            message: 'Database operation failed',
            errorCode: 'DATABASE_ERROR'
        });
    }

    // Handle export failures
    if (error.message?.includes('export') || error.message?.includes('Export')) {
        return res.status(500).json({
            success: false,
            message: 'Failed to generate export file',
            errorCode: 'EXPORT_FAILED'
        });
    }

    // Default server error
    res.status(500).json({
        success: false,
        message: `Server error while ${operation}`,
        errorCode: 'INTERNAL_ERROR',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
};

module.exports = {
    getDailyEarnings,
    getDailyEarningsRange,
    getMonthlyEarnings,
    getProviderCategories,
    setGoal,
    getActiveGoals,
    getGoalProgress,
    deleteGoal,
    exportEarnings
};
