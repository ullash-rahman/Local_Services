const pool = require('../config/database');
const { DatabaseError, ValidationError, mapDatabaseError } = require('../utils/errors');
const { analyticsLogger } = require('../utils/logger');

/**
 * EarningsService - Core service for calculating and aggregating earnings data
 * for the Daily/Monthly Earnings Dashboard feature.
 */
class EarningsService {
    /**
     * Validate date format (YYYY-MM-DD)
     * @param {string} date - Date string to validate
     * @returns {boolean} True if valid
     */
    static isValidDateFormat(date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) return false;
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
    }

    /**
     * Check if date is in the future
     * @param {string} date - Date string in YYYY-MM-DD format
     * @returns {boolean} True if future date
     */
    static isFutureDate(date) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]; // Get today as YYYY-MM-DD
        return date > todayStr; // Simple string comparison works for YYYY-MM-DD format
    }

    /**
     * Calculate percentage change between two values
     * @param {number} current - Current value
     * @param {number} previous - Previous value
     * @returns {object} Change data with amount, percentage, and trend
     */
    static calculateChange(current, previous) {
        let percentageChange = 0;
        let trend = 'stable';

        if (previous > 0) {
            percentageChange = ((current - previous) / previous) * 100;
        } else if (current > 0) {
            percentageChange = 100;
        }

        if (percentageChange > 0) {
            trend = 'up';
        } else if (percentageChange < 0) {
            trend = 'down';
        }

        return {
            amount: current - previous,
            percentageChange: parseFloat(percentageChange.toFixed(2)),
            trend
        };
    }


    /**
     * Get daily earnings for a specific date
     * @param {number} providerID - Provider's user ID
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<DailyEarnings>} Daily earnings data
     */
    static async getDailyEarnings(providerID, date) {
        try {
            // Validate inputs
            if (!providerID || isNaN(parseInt(providerID))) {
                throw new ValidationError('Invalid provider ID format');
            }

            if (!date || !this.isValidDateFormat(date)) {
                throw new ValidationError('Date must be in YYYY-MM-DD format');
            }

            if (this.isFutureDate(date)) {
                throw new ValidationError('Cannot retrieve earnings for future dates');
            }

            analyticsLogger.debug('Getting daily earnings', { providerID, date });

            // Get earnings for the specified date
            const earningsData = await this.getEarningsForDate(providerID, date);

            // Get previous day date
            const prevDate = new Date(date);
            prevDate.setDate(prevDate.getDate() - 1);
            const previousDayStr = prevDate.toISOString().split('T')[0];

            // Get same day last week
            const lastWeekDate = new Date(date);
            lastWeekDate.setDate(lastWeekDate.getDate() - 7);
            const lastWeekStr = lastWeekDate.toISOString().split('T')[0];

            // Get comparison data
            const [previousDayData, lastWeekData] = await Promise.all([
                this.getEarningsForDate(providerID, previousDayStr),
                this.getEarningsForDate(providerID, lastWeekStr)
            ]);

            return {
                date,
                totalEarnings: earningsData.totalEarnings,
                serviceCount: earningsData.serviceCount,
                categoryBreakdown: earningsData.categoryBreakdown,
                comparison: {
                    previousDay: this.calculateChange(earningsData.totalEarnings, previousDayData.totalEarnings),
                    sameLastWeek: this.calculateChange(earningsData.totalEarnings, lastWeekData.totalEarnings)
                }
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting daily earnings', { providerID, date, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    /**
     * Get earnings data for a specific date (internal helper)
     * @param {number} providerID - Provider's user ID
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<object>} Earnings data for the date
     */
    static async getEarningsForDate(providerID, date) {
        // Query for total earnings and service count
        const summaryQuery = `
            SELECT 
                COALESCE(SUM(p.amount), 0) as totalEarnings,
                COUNT(DISTINCT sr.requestID) as serviceCount
            FROM Payment p
            JOIN ServiceRequest sr ON p.requestID = sr.requestID
            WHERE sr.providerID = ?
                AND p.status = 'Completed'
                AND DATE(p.paymentDate) = ?
        `;

        // Query for category breakdown
        const categoryQuery = `
            SELECT 
                sr.category,
                COALESCE(SUM(p.amount), 0) as earnings,
                COUNT(DISTINCT sr.requestID) as serviceCount
            FROM Payment p
            JOIN ServiceRequest sr ON p.requestID = sr.requestID
            WHERE sr.providerID = ?
                AND p.status = 'Completed'
                AND DATE(p.paymentDate) = ?
            GROUP BY sr.category
            ORDER BY earnings DESC
        `;

        const [[summaryRows], [categoryRows]] = await Promise.all([
            pool.execute(summaryQuery, [providerID, date]),
            pool.execute(categoryQuery, [providerID, date])
        ]);

        const totalEarnings = parseFloat(summaryRows[0].totalEarnings) || 0;
        const serviceCount = parseInt(summaryRows[0].serviceCount, 10) || 0;

        // Build category breakdown with percentages
        const categoryBreakdown = categoryRows.map(row => {
            const earnings = parseFloat(row.earnings) || 0;
            return {
                category: row.category,
                earnings,
                serviceCount: parseInt(row.serviceCount, 10) || 0,
                percentage: totalEarnings > 0 
                    ? parseFloat(((earnings / totalEarnings) * 100).toFixed(2))
                    : 0
            };
        });

        return {
            totalEarnings,
            serviceCount,
            categoryBreakdown
        };
    }


    /**
     * Get daily earnings for a date range with optional category filter
     * @param {number} providerID - Provider's user ID
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     * @param {string[]} categories - Optional category filter
     * @returns {Promise<DailyEarnings[]>} Array of daily earnings summaries
     */
    static async getDailyEarningsRange(providerID, startDate, endDate, categories = []) {
        try {
            // Validate inputs
            if (!providerID || isNaN(parseInt(providerID))) {
                throw new ValidationError('Invalid provider ID format');
            }

            if (!startDate || !this.isValidDateFormat(startDate)) {
                throw new ValidationError('Start date must be in YYYY-MM-DD format');
            }

            if (!endDate || !this.isValidDateFormat(endDate)) {
                throw new ValidationError('End date must be in YYYY-MM-DD format');
            }

            if (new Date(startDate) > new Date(endDate)) {
                throw new ValidationError('Start date must be before or equal to end date');
            }

            analyticsLogger.debug('Getting daily earnings range', { providerID, startDate, endDate, categories });

            // Build category filter condition
            let categoryCondition = '';
            const params = [providerID, startDate, endDate];
            
            if (categories && categories.length > 0) {
                const placeholders = categories.map(() => '?').join(', ');
                categoryCondition = `AND sr.category IN (${placeholders})`;
                params.push(...categories);
            }

            // Query for daily earnings in range
            const query = `
                SELECT 
                    DATE(p.paymentDate) as date,
                    COALESCE(SUM(p.amount), 0) as totalEarnings,
                    COUNT(DISTINCT sr.requestID) as serviceCount
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
                    AND DATE(p.paymentDate) >= ?
                    AND DATE(p.paymentDate) <= ?
                    ${categoryCondition}
                GROUP BY DATE(p.paymentDate)
                ORDER BY date ASC
            `;

            const [rows] = await pool.execute(query, params);

            // Transform results
            return rows.map(row => ({
                date: row.date instanceof Date 
                    ? row.date.toISOString().split('T')[0] 
                    : row.date,
                totalEarnings: parseFloat(row.totalEarnings) || 0,
                serviceCount: parseInt(row.serviceCount, 10) || 0
            }));
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting daily earnings range', { 
                providerID, startDate, endDate, categories, error: error.message 
            });
            throw mapDatabaseError(error);
        }
    }

    /**
     * Get monthly earnings summary
     * @param {number} providerID - Provider's user ID
     * @param {number} year - Year (e.g., 2026)
     * @param {number} month - Month (1-12)
     * @param {string[]} categories - Optional category filter
     * @returns {Promise<MonthlyEarnings>} Monthly earnings data
     */
    static async getMonthlyEarnings(providerID, year, month, categories = []) {
        try {
            // Validate inputs
            if (!providerID || isNaN(parseInt(providerID))) {
                throw new ValidationError('Invalid provider ID format');
            }

            if (!year || isNaN(parseInt(year)) || year < 1900 || year > 2100) {
                throw new ValidationError('Invalid year');
            }

            if (!month || isNaN(parseInt(month)) || month < 1 || month > 12) {
                throw new ValidationError('Month must be between 1 and 12');
            }

            // Check if requested month is in the future
            const now = new Date();
            const requestedDate = new Date(year, month - 1, 1);
            if (requestedDate > now) {
                throw new ValidationError('Cannot retrieve earnings for future dates');
            }

            analyticsLogger.debug('Getting monthly earnings', { providerID, year, month, categories });

            // Calculate date range for the month
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            // Build category filter condition
            let categoryCondition = '';
            const baseParams = [providerID, startDate, endDate];
            
            if (categories && categories.length > 0) {
                const placeholders = categories.map(() => '?').join(', ');
                categoryCondition = `AND sr.category IN (${placeholders})`;
            }

            // Query for monthly summary
            const summaryQuery = `
                SELECT 
                    COALESCE(SUM(p.amount), 0) as totalEarnings,
                    COUNT(DISTINCT sr.requestID) as serviceCount
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
                    AND DATE(p.paymentDate) >= ?
                    AND DATE(p.paymentDate) <= ?
                    ${categoryCondition}
            `;

            // Query for daily breakdown
            const dailyQuery = `
                SELECT 
                    DATE(p.paymentDate) as date,
                    COALESCE(SUM(p.amount), 0) as earnings,
                    COUNT(DISTINCT sr.requestID) as serviceCount
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
                    AND DATE(p.paymentDate) >= ?
                    AND DATE(p.paymentDate) <= ?
                    ${categoryCondition}
                GROUP BY DATE(p.paymentDate)
                ORDER BY date ASC
            `;

            // Query for category breakdown
            const categoryQuery = `
                SELECT 
                    sr.category,
                    COALESCE(SUM(p.amount), 0) as earnings,
                    COUNT(DISTINCT sr.requestID) as serviceCount
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
                    AND DATE(p.paymentDate) >= ?
                    AND DATE(p.paymentDate) <= ?
                    ${categoryCondition}
                GROUP BY sr.category
                ORDER BY earnings DESC
            `;

            const summaryParams = categories.length > 0 ? [...baseParams, ...categories] : baseParams;
            const dailyParams = categories.length > 0 ? [...baseParams, ...categories] : baseParams;
            const categoryParams = categories.length > 0 ? [...baseParams, ...categories] : baseParams;

            const [[summaryRows], [dailyRows], [categoryRows]] = await Promise.all([
                pool.execute(summaryQuery, summaryParams),
                pool.execute(dailyQuery, dailyParams),
                pool.execute(categoryQuery, categoryParams)
            ]);

            const totalEarnings = parseFloat(summaryRows[0].totalEarnings) || 0;
            const serviceCount = parseInt(summaryRows[0].serviceCount, 10) || 0;

            // Build daily breakdown
            const dailyBreakdown = dailyRows.map(row => ({
                date: row.date instanceof Date 
                    ? row.date.toISOString().split('T')[0] 
                    : row.date,
                earnings: parseFloat(row.earnings) || 0,
                serviceCount: parseInt(row.serviceCount, 10) || 0
            }));

            // Calculate average daily earnings
            const daysWithEarnings = dailyBreakdown.length;
            const averageDailyEarnings = daysWithEarnings > 0 
                ? parseFloat((totalEarnings / daysWithEarnings).toFixed(2))
                : 0;

            // Find highest and lowest earning days
            let highestDay = { date: startDate, earnings: 0 };
            let lowestDay = { date: startDate, earnings: 0 };

            if (dailyBreakdown.length > 0) {
                highestDay = dailyBreakdown.reduce((max, day) => 
                    day.earnings > max.earnings ? day : max, dailyBreakdown[0]);
                lowestDay = dailyBreakdown.reduce((min, day) => 
                    day.earnings < min.earnings ? day : min, dailyBreakdown[0]);
            }

            // Build category breakdown with percentages
            const categoryBreakdown = categoryRows.map(row => {
                const earnings = parseFloat(row.earnings) || 0;
                return {
                    category: row.category,
                    earnings,
                    serviceCount: parseInt(row.serviceCount, 10) || 0,
                    percentage: totalEarnings > 0 
                        ? parseFloat(((earnings / totalEarnings) * 100).toFixed(2))
                        : 0
                };
            });

            // Get comparison data
            const comparison = await this.getMonthlyComparison(providerID, year, month, categories);

            return {
                year,
                month,
                totalEarnings,
                serviceCount,
                averageDailyEarnings,
                highestDay: { date: highestDay.date, earnings: highestDay.earnings },
                lowestDay: { date: lowestDay.date, earnings: lowestDay.earnings },
                dailyBreakdown,
                categoryBreakdown,
                comparison
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting monthly earnings', { 
                providerID, year, month, categories, error: error.message 
            });
            throw mapDatabaseError(error);
        }
    }

    /**
     * Get monthly comparison data (internal helper)
     * @param {number} providerID - Provider's user ID
     * @param {number} year - Year
     * @param {number} month - Month (1-12)
     * @param {string[]} categories - Optional category filter
     * @returns {Promise<object>} Comparison data
     */
    static async getMonthlyComparison(providerID, year, month, categories = []) {
        // Calculate previous month
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth < 1) {
            prevMonth = 12;
            prevYear = year - 1;
        }

        // Calculate same month last year
        const lastYearMonth = month;
        const lastYear = year - 1;

        // Get earnings for comparison periods
        const [currentEarnings, prevMonthEarnings, lastYearEarnings] = await Promise.all([
            this.getMonthTotalEarnings(providerID, year, month, categories),
            this.getMonthTotalEarnings(providerID, prevYear, prevMonth, categories),
            this.getMonthTotalEarnings(providerID, lastYear, lastYearMonth, categories)
        ]);

        return {
            previousMonth: this.calculateChange(currentEarnings, prevMonthEarnings),
            sameMonthLastYear: this.calculateChange(currentEarnings, lastYearEarnings)
        };
    }

    /**
     * Get total earnings for a specific month (internal helper)
     * @param {number} providerID - Provider's user ID
     * @param {number} year - Year
     * @param {number} month - Month (1-12)
     * @param {string[]} categories - Optional category filter
     * @returns {Promise<number>} Total earnings for the month
     */
    static async getMonthTotalEarnings(providerID, year, month, categories = []) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        let categoryCondition = '';
        const params = [providerID, startDate, endDate];
        
        if (categories && categories.length > 0) {
            const placeholders = categories.map(() => '?').join(', ');
            categoryCondition = `AND sr.category IN (${placeholders})`;
            params.push(...categories);
        }

        const query = `
            SELECT COALESCE(SUM(p.amount), 0) as totalEarnings
            FROM Payment p
            JOIN ServiceRequest sr ON p.requestID = sr.requestID
            WHERE sr.providerID = ?
                AND p.status = 'Completed'
                AND DATE(p.paymentDate) >= ?
                AND DATE(p.paymentDate) <= ?
                ${categoryCondition}
        `;

        const [rows] = await pool.execute(query, params);
        return parseFloat(rows[0].totalEarnings) || 0;
    }

    /**
     * Get available service categories for a provider
     * @param {number} providerID - Provider's user ID
     * @returns {Promise<string[]>} Array of category names
     */
    static async getProviderCategories(providerID) {
        try {
            if (!providerID || isNaN(parseInt(providerID))) {
                throw new ValidationError('Invalid provider ID format');
            }

            const query = `
                SELECT DISTINCT sr.category
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                ORDER BY sr.category ASC
            `;

            const [rows] = await pool.execute(query, [providerID]);
            return rows.map(row => row.category);
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting provider categories', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }
}

module.exports = EarningsService;
