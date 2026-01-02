const pool = require('../config/database');
const { DatabaseError, ValidationError, mapDatabaseError } = require('../utils/errors');
const { analyticsLogger } = require('../utils/logger');
const EarningsService = require('./EarningsService');

/**
 * EarningsGoalService - Service for managing earnings goals
 * Feature: earnings-dashboard
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */
class EarningsGoalService {
    /**
     * Validate goal type
     * @param {string} goalType - Goal type to validate
     * @returns {boolean} True if valid
     */
    static isValidGoalType(goalType) {
        return ['daily', 'monthly'].includes(goalType);
    }

    /**
     * Validate target amount
     * @param {number} amount - Amount to validate
     * @returns {boolean} True if valid
     */
    static isValidTargetAmount(amount) {
        return typeof amount === 'number' && amount > 0 && isFinite(amount);
    }

    /**
     * Validate date format (YYYY-MM-DD)
     * @param {string} date - Date string to validate
     * @returns {boolean} True if valid
     */
    static isValidDateFormat(date) {
        if (!date) return false;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) return false;
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
    }

    /**
     * Get default dates based on goal type
     * @param {string} goalType - 'daily' or 'monthly'
     * @returns {object} Object with startDate and endDate
     */
    static getDefaultDates(goalType) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (goalType === 'daily') {
            const dateStr = today.toISOString().split('T')[0];
            return { startDate: dateStr, endDate: dateStr };
        } else {
            // Monthly: first day to last day of current month
            const year = today.getFullYear();
            const month = today.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            return {
                startDate: firstDay.toISOString().split('T')[0],
                endDate: lastDay.toISOString().split('T')[0]
            };
        }
    }


    /**
     * Create or update an earnings goal
     * @param {number} providerID - Provider's user ID
     * @param {object} goalData - Goal configuration
     * @param {string} goalData.goalType - 'daily' or 'monthly'
     * @param {number} goalData.targetAmount - Target earnings amount
     * @param {string} [goalData.startDate] - Optional start date (YYYY-MM-DD)
     * @param {string} [goalData.endDate] - Optional end date (YYYY-MM-DD)
     * @returns {Promise<EarningsGoal>} Created/updated goal
     */
    static async setGoal(providerID, goalData) {
        try {
            // Validate provider ID
            if (!providerID || isNaN(parseInt(providerID))) {
                throw new ValidationError('Invalid provider ID format');
            }

            // Validate goal type
            if (!goalData || !this.isValidGoalType(goalData.goalType)) {
                throw new ValidationError('Goal type must be "daily" or "monthly"');
            }

            // Validate target amount
            if (!this.isValidTargetAmount(goalData.targetAmount)) {
                throw new ValidationError('Goal amount must be a positive number');
            }

            // Get dates (use defaults if not provided)
            const defaults = this.getDefaultDates(goalData.goalType);
            const startDate = goalData.startDate || defaults.startDate;
            const endDate = goalData.endDate || defaults.endDate;

            // Validate date formats if provided
            if (goalData.startDate && !this.isValidDateFormat(goalData.startDate)) {
                throw new ValidationError('Start date must be in YYYY-MM-DD format');
            }
            if (goalData.endDate && !this.isValidDateFormat(goalData.endDate)) {
                throw new ValidationError('End date must be in YYYY-MM-DD format');
            }

            // Validate date range
            if (new Date(startDate) > new Date(endDate)) {
                throw new ValidationError('Start date must be before or equal to end date');
            }

            analyticsLogger.debug('Setting earnings goal', { providerID, goalData });

            // Check if an active goal of this type already exists for the same period
            const existingGoalQuery = `
                SELECT goalID FROM EarningsGoal
                WHERE providerID = ?
                    AND goalType = ?
                    AND isActive = TRUE
                    AND startDate = ?
                    AND endDate = ?
            `;
            const [existingRows] = await pool.execute(existingGoalQuery, [
                providerID, goalData.goalType, startDate, endDate
            ]);

            let goalID;
            const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

            if (existingRows.length > 0) {
                // Update existing goal
                goalID = existingRows[0].goalID;
                const updateQuery = `
                    UPDATE EarningsGoal
                    SET targetAmount = ?, updatedAt = ?
                    WHERE goalID = ?
                `;
                await pool.execute(updateQuery, [goalData.targetAmount, now, goalID]);
            } else {
                // Create new goal
                const insertQuery = `
                    INSERT INTO EarningsGoal (providerID, goalType, targetAmount, startDate, endDate, isActive, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, TRUE, ?, ?)
                `;
                const [result] = await pool.execute(insertQuery, [
                    providerID, goalData.goalType, goalData.targetAmount, startDate, endDate, now, now
                ]);
                goalID = result.insertId;
            }

            // Return the created/updated goal
            return this.getGoalById(goalID);
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error setting earnings goal', { providerID, goalData, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    /**
     * Get a goal by ID (internal helper)
     * @param {number} goalID - Goal ID
     * @returns {Promise<EarningsGoal>} Goal data
     */
    static async getGoalById(goalID) {
        const query = `
            SELECT goalID, providerID, goalType, targetAmount, startDate, endDate, isActive, createdAt, updatedAt
            FROM EarningsGoal
            WHERE goalID = ?
        `;
        const [rows] = await pool.execute(query, [goalID]);
        
        if (rows.length === 0) {
            throw new ValidationError('Goal not found');
        }

        const row = rows[0];
        return {
            goalID: row.goalID,
            providerID: row.providerID,
            goalType: row.goalType,
            targetAmount: parseFloat(row.targetAmount),
            startDate: row.startDate instanceof Date 
                ? row.startDate.toISOString().split('T')[0] 
                : row.startDate,
            endDate: row.endDate instanceof Date 
                ? row.endDate.toISOString().split('T')[0] 
                : row.endDate,
            isActive: Boolean(row.isActive),
            createdAt: row.createdAt instanceof Date 
                ? row.createdAt.toISOString() 
                : row.createdAt,
            updatedAt: row.updatedAt instanceof Date 
                ? row.updatedAt.toISOString() 
                : row.updatedAt
        };
    }

    /**
     * Get active goals for a provider
     * @param {number} providerID - Provider's user ID
     * @returns {Promise<EarningsGoal[]>} Active goals
     */
    static async getActiveGoals(providerID) {
        try {
            // Validate provider ID
            if (!providerID || isNaN(parseInt(providerID))) {
                throw new ValidationError('Invalid provider ID format');
            }

            analyticsLogger.debug('Getting active goals', { providerID });

            const query = `
                SELECT goalID, providerID, goalType, targetAmount, startDate, endDate, isActive, createdAt, updatedAt
                FROM EarningsGoal
                WHERE providerID = ?
                    AND isActive = TRUE
                ORDER BY goalType ASC, startDate DESC
            `;
            const [rows] = await pool.execute(query, [providerID]);

            return rows.map(row => ({
                goalID: row.goalID,
                providerID: row.providerID,
                goalType: row.goalType,
                targetAmount: parseFloat(row.targetAmount),
                startDate: row.startDate instanceof Date 
                    ? row.startDate.toISOString().split('T')[0] 
                    : row.startDate,
                endDate: row.endDate instanceof Date 
                    ? row.endDate.toISOString().split('T')[0] 
                    : row.endDate,
                isActive: Boolean(row.isActive),
                createdAt: row.createdAt instanceof Date 
                    ? row.createdAt.toISOString() 
                    : row.createdAt,
                updatedAt: row.updatedAt instanceof Date 
                    ? row.updatedAt.toISOString() 
                    : row.updatedAt
            }));
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting active goals', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    /**
     * Calculate progress toward a goal
     * @param {number} providerID - Provider's user ID
     * @param {number} goalID - Goal ID
     * @returns {Promise<GoalProgress>} Progress data
     */
    static async getGoalProgress(providerID, goalID) {
        try {
            // Validate provider ID
            if (!providerID || isNaN(parseInt(providerID))) {
                throw new ValidationError('Invalid provider ID format');
            }

            // Validate goal ID
            if (!goalID || isNaN(parseInt(goalID))) {
                throw new ValidationError('Invalid goal ID format');
            }

            analyticsLogger.debug('Getting goal progress', { providerID, goalID });

            // Get the goal
            const goalQuery = `
                SELECT goalID, providerID, goalType, targetAmount, startDate, endDate, isActive
                FROM EarningsGoal
                WHERE goalID = ? AND providerID = ?
            `;
            const [goalRows] = await pool.execute(goalQuery, [goalID, providerID]);

            if (goalRows.length === 0) {
                throw new ValidationError('Goal not found');
            }

            const goal = goalRows[0];
            const targetAmount = parseFloat(goal.targetAmount);
            const startDate = goal.startDate instanceof Date 
                ? goal.startDate.toISOString().split('T')[0] 
                : goal.startDate;
            const endDate = goal.endDate instanceof Date 
                ? goal.endDate.toISOString().split('T')[0] 
                : goal.endDate;

            // Calculate current earnings for the goal period
            const currentAmount = await this.calculateEarningsForPeriod(providerID, startDate, endDate);

            // Calculate progress percentage
            const progressPercentage = targetAmount > 0 
                ? parseFloat(((currentAmount / targetAmount) * 100).toFixed(2))
                : 0;

            // Determine if goal is achieved
            const isAchieved = currentAmount >= targetAmount;

            // Calculate remaining amount
            const remainingAmount = Math.max(0, parseFloat((targetAmount - currentAmount).toFixed(2)));

            // Calculate days remaining
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endDateObj = new Date(endDate);
            endDateObj.setHours(0, 0, 0, 0);
            const daysRemaining = Math.max(0, Math.ceil((endDateObj - today) / (1000 * 60 * 60 * 24)));

            return {
                goalID: goal.goalID,
                targetAmount,
                currentAmount: parseFloat(currentAmount.toFixed(2)),
                progressPercentage,
                isAchieved,
                remainingAmount,
                daysRemaining
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting goal progress', { providerID, goalID, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    /**
     * Calculate total earnings for a date period (internal helper)
     * @param {number} providerID - Provider's user ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Promise<number>} Total earnings for the period
     */
    static async calculateEarningsForPeriod(providerID, startDate, endDate) {
        const query = `
            SELECT COALESCE(SUM(p.amount), 0) as totalEarnings
            FROM Payment p
            JOIN ServiceRequest sr ON p.requestID = sr.requestID
            WHERE sr.providerID = ?
                AND p.status = 'Completed'
                AND DATE(p.paymentDate) >= ?
                AND DATE(p.paymentDate) <= ?
        `;
        const [rows] = await pool.execute(query, [providerID, startDate, endDate]);
        return parseFloat(rows[0].totalEarnings) || 0;
    }


    /**
     * Delete a goal
     * @param {number} providerID - Provider's user ID
     * @param {number} goalID - Goal ID
     * @returns {Promise<boolean>} Success status
     */
    static async deleteGoal(providerID, goalID) {
        try {
            // Validate provider ID
            if (!providerID || isNaN(parseInt(providerID))) {
                throw new ValidationError('Invalid provider ID format');
            }

            // Validate goal ID
            if (!goalID || isNaN(parseInt(goalID))) {
                throw new ValidationError('Invalid goal ID format');
            }

            analyticsLogger.debug('Deleting goal', { providerID, goalID });

            // Check if goal exists and belongs to provider
            const checkQuery = `
                SELECT goalID FROM EarningsGoal
                WHERE goalID = ? AND providerID = ?
            `;
            const [checkRows] = await pool.execute(checkQuery, [goalID, providerID]);

            if (checkRows.length === 0) {
                throw new ValidationError('Goal not found');
            }

            // Soft delete by setting isActive to false
            const deleteQuery = `
                UPDATE EarningsGoal
                SET isActive = FALSE, updatedAt = ?
                WHERE goalID = ? AND providerID = ?
            `;
            const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
            await pool.execute(deleteQuery, [now, goalID, providerID]);

            return true;
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error deleting goal', { providerID, goalID, error: error.message });
            throw mapDatabaseError(error);
        }
    }
}

module.exports = EarningsGoalService;
