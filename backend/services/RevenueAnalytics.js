const pool = require('../config/database');
const { DatabaseError, ValidationError, mapDatabaseError } = require('../utils/errors');
const { analyticsLogger } = require('../utils/logger');

// Valid time periods for analytics queries
const VALID_PERIODS = ['7days', '30days', '6months', '1year', 'all'];

class RevenueAnalytics {
    static parsePeriod(period) {
        switch (period) {
            case '7days':
                return { interval: '7 DAY', days: 7 };
            case '30days':
                return { interval: '30 DAY', days: 30 };
            case '6months':
                return { interval: '6 MONTH', days: 180 };
            case '1year':
                return { interval: '1 YEAR', days: 365 };
            case 'all':
            default:
                return { interval: null, days: null };
        }
    }

    static validatePeriod(period) {
        if (period && !VALID_PERIODS.includes(period)) {
            throw new ValidationError(`Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`);
        }
    }

    static async getTotalEarnings(providerID, period = '30days') {
        try {
            this.validatePeriod(period);
            analyticsLogger.debug('Getting total earnings', { providerID, period });

            const { interval, days } = this.parsePeriod(period);
            
            let currentPeriodQuery;
            let previousPeriodQuery;
            const params = [providerID];

            if (interval) {
                // Current period earnings
                currentPeriodQuery = `
                    SELECT COALESCE(SUM(p.amount), 0) as totalEarnings
                    FROM Payment p
                    JOIN ServiceRequest sr ON p.requestID = sr.requestID
                    WHERE sr.providerID = ?
                        AND p.status = 'Completed'
                        AND p.paymentDate >= DATE_SUB(NOW(), INTERVAL ${interval})
                `;

                // Previous period earnings for comparison
                previousPeriodQuery = `
                    SELECT COALESCE(SUM(p.amount), 0) as totalEarnings
                    FROM Payment p
                    JOIN ServiceRequest sr ON p.requestID = sr.requestID
                    WHERE sr.providerID = ?
                        AND p.status = 'Completed'
                        AND p.paymentDate >= DATE_SUB(NOW(), INTERVAL ${days * 2} DAY)
                        AND p.paymentDate < DATE_SUB(NOW(), INTERVAL ${interval})
                `;
            } else {
                // All time earnings
                currentPeriodQuery = `
                    SELECT COALESCE(SUM(p.amount), 0) as totalEarnings
                    FROM Payment p
                    JOIN ServiceRequest sr ON p.requestID = sr.requestID
                    WHERE sr.providerID = ?
                        AND p.status = 'Completed'
                `;
                previousPeriodQuery = null;
            }

            const [currentRows] = await pool.execute(currentPeriodQuery, params);
            const currentEarnings = parseFloat(currentRows[0].totalEarnings) || 0;

            let previousEarnings = 0;
            let percentageChange = null;

            if (previousPeriodQuery) {
                const [previousRows] = await pool.execute(previousPeriodQuery, params);
                previousEarnings = parseFloat(previousRows[0].totalEarnings) || 0;

                if (previousEarnings > 0) {
                    percentageChange = ((currentEarnings - previousEarnings) / previousEarnings) * 100;
                } else if (currentEarnings > 0) {
                    percentageChange = 100; // 100% increase from zero
                } else {
                    percentageChange = 0;
                }
            }

            return {
                period,
                currentPeriod: {
                    totalEarnings: currentEarnings,
                    formattedEarnings: currentEarnings.toFixed(2)
                },
                previousPeriod: previousPeriodQuery ? {
                    totalEarnings: previousEarnings,
                    formattedEarnings: previousEarnings.toFixed(2)
                } : null,
                percentageChange: percentageChange !== null ? parseFloat(percentageChange.toFixed(2)) : null,
                trend: percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'stable'
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting total earnings', { providerID, period, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async getEarningsByCategory(providerID, period = '30days') {
        try {
            this.validatePeriod(period);
            analyticsLogger.debug('Getting earnings by category', { providerID, period });

            const { interval } = this.parsePeriod(period);
            
            let dateCondition = '';
            if (interval) {
                dateCondition = `AND p.paymentDate >= DATE_SUB(NOW(), INTERVAL ${interval})`;
            }

            const query = `
                SELECT 
                    sr.category,
                    COALESCE(SUM(p.amount), 0) as categoryEarnings,
                    COUNT(DISTINCT sr.requestID) as serviceCount
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
                    ${dateCondition}
                GROUP BY sr.category
                ORDER BY categoryEarnings DESC
            `;

            const [rows] = await pool.execute(query, [providerID]);

            // Calculate total for percentage calculation
            const totalEarnings = rows.reduce((sum, row) => sum + parseFloat(row.categoryEarnings), 0);

            const categories = rows.map(row => ({
                category: row.category,
                earnings: parseFloat(row.categoryEarnings),
                formattedEarnings: parseFloat(row.categoryEarnings).toFixed(2),
                serviceCount: parseInt(row.serviceCount, 10),
                percentage: totalEarnings > 0 
                    ? parseFloat(((parseFloat(row.categoryEarnings) / totalEarnings) * 100).toFixed(2))
                    : 0
            }));

            return {
                period,
                totalEarnings,
                formattedTotal: totalEarnings.toFixed(2),
                categories,
                categoryCount: categories.length
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting earnings by category', { providerID, period, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getAverageEarningsPerService(providerID) {
        try {
            analyticsLogger.debug('Getting average earnings per service', { providerID });

            const query = `
                SELECT 
                    COALESCE(AVG(p.amount), 0) as averageEarnings,
                    COALESCE(SUM(p.amount), 0) as totalEarnings,
                    COUNT(DISTINCT sr.requestID) as completedServices
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
            `;

            const [rows] = await pool.execute(query, [providerID]);
            const result = rows[0];

            const averageEarnings = parseFloat(result.averageEarnings) || 0;
            const totalEarnings = parseFloat(result.totalEarnings) || 0;
            const completedServices = parseInt(result.completedServices, 10) || 0;

            return {
                averageEarnings,
                formattedAverage: averageEarnings.toFixed(2),
                totalEarnings,
                formattedTotal: totalEarnings.toFixed(2),
                completedServices
            };
        } catch (error) {
            analyticsLogger.error('Error getting average earnings', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async getRevenueTrends(providerID, period = '30days') {
        try {
            this.validatePeriod(period);
            analyticsLogger.debug('Getting revenue trends', { providerID, period });

            const { interval, days } = this.parsePeriod(period);
            
            // Determine grouping based on period
            let dateFormat;
            let groupBy;
            
            if (period === '7days') {
                dateFormat = '%Y-%m-%d';
                groupBy = 'DATE(p.paymentDate)';
            } else if (period === '30days') {
                dateFormat = '%Y-%m-%d';
                groupBy = 'DATE(p.paymentDate)';
            } else if (period === '6months' || period === '1year') {
                dateFormat = '%Y-%m';
                groupBy = 'DATE_FORMAT(p.paymentDate, "%Y-%m")';
            } else {
                dateFormat = '%Y-%m';
                groupBy = 'DATE_FORMAT(p.paymentDate, "%Y-%m")';
            }

            let dateCondition = '';
            if (interval) {
                dateCondition = `AND p.paymentDate >= DATE_SUB(NOW(), INTERVAL ${interval})`;
            }

            const query = `
                SELECT 
                    DATE_FORMAT(p.paymentDate, '${dateFormat}') as periodLabel,
                    COALESCE(SUM(p.amount), 0) as earnings,
                    COUNT(DISTINCT sr.requestID) as serviceCount
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
                    ${dateCondition}
                GROUP BY ${groupBy}
                ORDER BY periodLabel ASC
            `;

            const [rows] = await pool.execute(query, [providerID]);

            // Calculate running totals and percentage changes
            let previousEarnings = 0;
            const dataPoints = rows.map((row, index) => {
                const earnings = parseFloat(row.earnings);
                let percentageChange = null;
                
                if (index > 0 && previousEarnings > 0) {
                    percentageChange = ((earnings - previousEarnings) / previousEarnings) * 100;
                }
                
                const point = {
                    label: row.periodLabel,
                    earnings,
                    formattedEarnings: earnings.toFixed(2),
                    serviceCount: parseInt(row.serviceCount, 10),
                    percentageChange: percentageChange !== null ? parseFloat(percentageChange.toFixed(2)) : null
                };
                
                previousEarnings = earnings;
                return point;
            });

            // Calculate overall trend
            const totalEarnings = dataPoints.reduce((sum, point) => sum + point.earnings, 0);
            const averageEarnings = dataPoints.length > 0 ? totalEarnings / dataPoints.length : 0;

            return {
                period,
                dataPoints,
                summary: {
                    totalEarnings,
                    formattedTotal: totalEarnings.toFixed(2),
                    averagePerPeriod: parseFloat(averageEarnings.toFixed(2)),
                    dataPointCount: dataPoints.length
                }
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting revenue trends', { providerID, period, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async getPaymentStatus(providerID) {
        try {
            analyticsLogger.debug('Getting payment status', { providerID });

            const query = `
                SELECT 
                    p.status,
                    COALESCE(SUM(p.amount), 0) as totalAmount,
                    COUNT(*) as paymentCount
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                GROUP BY p.status
            `;

            const [rows] = await pool.execute(query, [providerID]);

            // Initialize status breakdown
            const statusBreakdown = {
                pending: { amount: 0, count: 0 },
                completed: { amount: 0, count: 0 },
                failed: { amount: 0, count: 0 },
                refunded: { amount: 0, count: 0 }
            };

            // Fill in actual values
            rows.forEach(row => {
                const status = row.status.toLowerCase();
                if (statusBreakdown[status] !== undefined) {
                    statusBreakdown[status] = {
                        amount: parseFloat(row.totalAmount),
                        count: parseInt(row.paymentCount, 10)
                    };
                }
            });

            // Calculate totals
            const totalAmount = Object.values(statusBreakdown).reduce((sum, s) => sum + s.amount, 0);
            const totalCount = Object.values(statusBreakdown).reduce((sum, s) => sum + s.count, 0);

            return {
                pending: {
                    ...statusBreakdown.pending,
                    formattedAmount: statusBreakdown.pending.amount.toFixed(2),
                    percentage: totalAmount > 0 
                        ? parseFloat(((statusBreakdown.pending.amount / totalAmount) * 100).toFixed(2))
                        : 0
                },
                completed: {
                    ...statusBreakdown.completed,
                    formattedAmount: statusBreakdown.completed.amount.toFixed(2),
                    percentage: totalAmount > 0 
                        ? parseFloat(((statusBreakdown.completed.amount / totalAmount) * 100).toFixed(2))
                        : 0
                },
                failed: {
                    ...statusBreakdown.failed,
                    formattedAmount: statusBreakdown.failed.amount.toFixed(2),
                    percentage: totalAmount > 0 
                        ? parseFloat(((statusBreakdown.failed.amount / totalAmount) * 100).toFixed(2))
                        : 0
                },
                refunded: {
                    ...statusBreakdown.refunded,
                    formattedAmount: statusBreakdown.refunded.amount.toFixed(2),
                    percentage: totalAmount > 0 
                        ? parseFloat(((statusBreakdown.refunded.amount / totalAmount) * 100).toFixed(2))
                        : 0
                },
                summary: {
                    totalAmount,
                    formattedTotal: totalAmount.toFixed(2),
                    totalPayments: totalCount
                }
            };
        } catch (error) {
            analyticsLogger.error('Error getting payment status', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getMonthlyComparison(providerID, months = 12) {
        try {
            analyticsLogger.debug('Getting monthly comparison', { providerID, months });

            // Validate months parameter
            if (months < 1 || months > 24) {
                throw new ValidationError('Months must be between 1 and 24');
            }

            const query = `
                SELECT 
                    DATE_FORMAT(p.paymentDate, '%Y-%m') as month,
                    DATE_FORMAT(p.paymentDate, '%b %Y') as monthLabel,
                    COALESCE(SUM(p.amount), 0) as earnings,
                    COUNT(DISTINCT sr.requestID) as serviceCount,
                    COUNT(DISTINCT sr.customerID) as uniqueCustomers
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
                    AND p.paymentDate >= DATE_SUB(NOW(), INTERVAL ? MONTH)
                GROUP BY DATE_FORMAT(p.paymentDate, '%Y-%m'), DATE_FORMAT(p.paymentDate, '%b %Y')
                ORDER BY month ASC
            `;

            const [rows] = await pool.execute(query, [providerID, months]);

            // Calculate month-over-month changes
            let previousEarnings = 0;
            const monthlyData = rows.map((row, index) => {
                const earnings = parseFloat(row.earnings);
                let monthOverMonthChange = null;
                
                if (index > 0 && previousEarnings > 0) {
                    monthOverMonthChange = ((earnings - previousEarnings) / previousEarnings) * 100;
                } else if (index > 0 && previousEarnings === 0 && earnings > 0) {
                    monthOverMonthChange = 100;
                }
                
                const monthData = {
                    month: row.month,
                    monthLabel: row.monthLabel,
                    earnings,
                    formattedEarnings: earnings.toFixed(2),
                    serviceCount: parseInt(row.serviceCount, 10),
                    uniqueCustomers: parseInt(row.uniqueCustomers, 10),
                    monthOverMonthChange: monthOverMonthChange !== null 
                        ? parseFloat(monthOverMonthChange.toFixed(2)) 
                        : null,
                    trend: monthOverMonthChange > 0 ? 'up' : monthOverMonthChange < 0 ? 'down' : 'stable'
                };
                
                previousEarnings = earnings;
                return monthData;
            });

            // Calculate summary statistics
            const totalEarnings = monthlyData.reduce((sum, m) => sum + m.earnings, 0);
            const averageMonthlyEarnings = monthlyData.length > 0 ? totalEarnings / monthlyData.length : 0;
            const highestMonth = monthlyData.length > 0 
                ? monthlyData.reduce((max, m) => m.earnings > max.earnings ? m : max, monthlyData[0])
                : null;
            const lowestMonth = monthlyData.length > 0 
                ? monthlyData.reduce((min, m) => m.earnings < min.earnings ? m : min, monthlyData[0])
                : null;

            // Calculate year-over-year comparison if we have enough data
            let yearOverYearChange = null;
            if (months >= 12 && monthlyData.length >= 12) {
                const currentYearEarnings = monthlyData.slice(-6).reduce((sum, m) => sum + m.earnings, 0);
                const previousYearEarnings = monthlyData.slice(0, 6).reduce((sum, m) => sum + m.earnings, 0);
                
                if (previousYearEarnings > 0) {
                    yearOverYearChange = ((currentYearEarnings - previousYearEarnings) / previousYearEarnings) * 100;
                }
            }

            return {
                months,
                monthlyData,
                summary: {
                    totalEarnings,
                    formattedTotal: totalEarnings.toFixed(2),
                    averageMonthlyEarnings: parseFloat(averageMonthlyEarnings.toFixed(2)),
                    monthCount: monthlyData.length,
                    highestMonth: highestMonth ? {
                        month: highestMonth.monthLabel,
                        earnings: highestMonth.earnings,
                        formattedEarnings: highestMonth.formattedEarnings
                    } : null,
                    lowestMonth: lowestMonth ? {
                        month: lowestMonth.monthLabel,
                        earnings: lowestMonth.earnings,
                        formattedEarnings: lowestMonth.formattedEarnings
                    } : null,
                    yearOverYearChange: yearOverYearChange !== null 
                        ? parseFloat(yearOverYearChange.toFixed(2)) 
                        : null
                }
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting monthly comparison', { providerID, months, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async getDashboardData(providerID, period = '30days') {
        try {
            analyticsLogger.debug('Getting revenue dashboard data', { providerID, period });

            // Fetch all data in parallel for efficiency
            const [
                totalEarnings,
                earningsByCategory,
                averageEarnings,
                revenueTrends,
                paymentStatus,
                monthlyComparison
            ] = await Promise.all([
                this.getTotalEarnings(providerID, period),
                this.getEarningsByCategory(providerID, period),
                this.getAverageEarningsPerService(providerID),
                this.getRevenueTrends(providerID, period),
                this.getPaymentStatus(providerID),
                this.getMonthlyComparison(providerID, 12)
            ]);

            return {
                period,
                totalEarnings,
                earningsByCategory,
                averageEarnings,
                revenueTrends,
                paymentStatus,
                monthlyComparison,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error getting revenue dashboard', { providerID, period, error: error.message });
            throw error;
        }
    }
}

module.exports = RevenueAnalytics;

