const pool = require('../config/database');
const { DatabaseError, ValidationError, mapDatabaseError } = require('../utils/errors');
const { analyticsLogger } = require('../utils/logger');

// Valid time periods for analytics queries
const VALID_PERIODS = ['7days', '30days', '6months', '1year', 'all'];

// Valid service request statuses
const REQUEST_STATUSES = {
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    REJECTED: 'Rejected'
};

class PerformanceAnalytics {
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

    static async getCompletionRate(providerID, period = '30days') {
        try {
            this.validatePeriod(period);
            analyticsLogger.debug('Getting completion rate', { providerID, period });

            const { interval, days } = this.parsePeriod(period);
            
            let dateCondition = '';
            let previousDateCondition = '';
            
            if (interval) {
                dateCondition = `AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL ${interval})`;
                previousDateCondition = `AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL ${days * 2} DAY) AND sr.createdAt < DATE_SUB(NOW(), INTERVAL ${interval})`;
            }

            // Current period query
            const currentQuery = `
                SELECT 
                    COUNT(CASE WHEN sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') THEN 1 END) as acceptedRequests,
                    COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) as completedRequests,
                    COUNT(*) as totalRequests
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    ${dateCondition}
            `;

            const [currentRows] = await pool.execute(currentQuery, [providerID]);
            const current = currentRows[0];

            const acceptedRequests = parseInt(current.acceptedRequests, 10) || 0;
            const completedRequests = parseInt(current.completedRequests, 10) || 0;
            const totalRequests = parseInt(current.totalRequests, 10) || 0;

            // Completion rate = completed / accepted (only count requests that were accepted)
            const completionRate = acceptedRequests > 0 
                ? (completedRequests / acceptedRequests) * 100 
                : 0;

            // Previous period for comparison
            let previousCompletionRate = null;
            let percentageChange = null;

            if (interval) {
                const previousQuery = `
                    SELECT 
                        COUNT(CASE WHEN sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') THEN 1 END) as acceptedRequests,
                        COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) as completedRequests
                    FROM ServiceRequest sr
                    WHERE sr.providerID = ?
                        ${previousDateCondition}
                `;

                const [previousRows] = await pool.execute(previousQuery, [providerID]);
                const previous = previousRows[0];

                const prevAccepted = parseInt(previous.acceptedRequests, 10) || 0;
                const prevCompleted = parseInt(previous.completedRequests, 10) || 0;

                previousCompletionRate = prevAccepted > 0 
                    ? (prevCompleted / prevAccepted) * 100 
                    : 0;

                if (previousCompletionRate > 0) {
                    percentageChange = completionRate - previousCompletionRate;
                } else if (completionRate > 0) {
                    percentageChange = completionRate;
                } else {
                    percentageChange = 0;
                }
            }

            return {
                period,
                completionRate: parseFloat(completionRate.toFixed(2)),
                acceptedRequests,
                completedRequests,
                totalRequests,
                previousPeriod: previousCompletionRate !== null ? {
                    completionRate: parseFloat(previousCompletionRate.toFixed(2))
                } : null,
                percentageChange: percentageChange !== null ? parseFloat(percentageChange.toFixed(2)) : null,
                trend: percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'stable'
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting completion rate', { providerID, period, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getAverageResponseTime(providerID, period = '30days') {
        try {
            this.validatePeriod(period);
            analyticsLogger.debug('Getting average response time', { providerID, period });

            const { interval, days } = this.parsePeriod(period);
            
            let dateCondition = '';
            let previousDateCondition = '';
            
            if (interval) {
                dateCondition = `AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL ${interval})`;
                previousDateCondition = `AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL ${days * 2} DAY) AND sr.createdAt < DATE_SUB(NOW(), INTERVAL ${interval})`;
            }

            // Calculate response time as the time between request creation and first chat message from provider
            // or the time between request creation and status change to 'Accepted'
            const currentQuery = `
                SELECT 
                    AVG(
                        TIMESTAMPDIFF(MINUTE, sr.createdAt, 
                            COALESCE(
                                (SELECT MIN(c.timestamp) FROM Chat c WHERE c.requestID = sr.requestID AND c.senderID = sr.providerID),
                                sr.updatedAt
                            )
                        )
                    ) as avgResponseMinutes,
                    COUNT(*) as responseCount,
                    MIN(
                        TIMESTAMPDIFF(MINUTE, sr.createdAt, 
                            COALESCE(
                                (SELECT MIN(c.timestamp) FROM Chat c WHERE c.requestID = sr.requestID AND c.senderID = sr.providerID),
                                sr.updatedAt
                            )
                        )
                    ) as minResponseMinutes,
                    MAX(
                        TIMESTAMPDIFF(MINUTE, sr.createdAt, 
                            COALESCE(
                                (SELECT MIN(c.timestamp) FROM Chat c WHERE c.requestID = sr.requestID AND c.senderID = sr.providerID),
                                sr.updatedAt
                            )
                        )
                    ) as maxResponseMinutes
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled')
                    ${dateCondition}
            `;

            const [currentRows] = await pool.execute(currentQuery, [providerID]);
            const current = currentRows[0];

            const avgResponseMinutes = parseFloat(current.avgResponseMinutes) || 0;
            const responseCount = parseInt(current.responseCount, 10) || 0;
            const minResponseMinutes = parseFloat(current.minResponseMinutes) || 0;
            const maxResponseMinutes = parseFloat(current.maxResponseMinutes) || 0;

            // Convert to hours if > 60 minutes
            const formatResponseTime = (minutes) => {
                if (minutes < 60) {
                    return { value: minutes, unit: 'minutes', formatted: `${minutes.toFixed(0)} min` };
                } else if (minutes < 1440) {
                    const hours = minutes / 60;
                    return { value: hours, unit: 'hours', formatted: `${hours.toFixed(1)} hrs` };
                } else {
                    const days = minutes / 1440;
                    return { value: days, unit: 'days', formatted: `${days.toFixed(1)} days` };
                }
            };

            // Previous period for comparison
            let previousAvgResponse = null;
            let percentageChange = null;

            if (interval) {
                const previousQuery = `
                    SELECT 
                        AVG(
                            TIMESTAMPDIFF(MINUTE, sr.createdAt, 
                                COALESCE(
                                    (SELECT MIN(c.timestamp) FROM Chat c WHERE c.requestID = sr.requestID AND c.senderID = sr.providerID),
                                    sr.updatedAt
                                )
                            )
                        ) as avgResponseMinutes
                    FROM ServiceRequest sr
                    WHERE sr.providerID = ?
                        AND sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled')
                        ${previousDateCondition}
                `;

                const [previousRows] = await pool.execute(previousQuery, [providerID]);
                previousAvgResponse = parseFloat(previousRows[0].avgResponseMinutes) || 0;

                if (previousAvgResponse > 0) {
                    // For response time, negative change is good (faster response)
                    percentageChange = ((avgResponseMinutes - previousAvgResponse) / previousAvgResponse) * 100;
                }
            }

            return {
                period,
                averageResponseTime: {
                    minutes: parseFloat(avgResponseMinutes.toFixed(2)),
                    ...formatResponseTime(avgResponseMinutes)
                },
                responseCount,
                minResponseTime: formatResponseTime(minResponseMinutes),
                maxResponseTime: formatResponseTime(maxResponseMinutes),
                previousPeriod: previousAvgResponse !== null ? {
                    minutes: parseFloat(previousAvgResponse.toFixed(2)),
                    ...formatResponseTime(previousAvgResponse)
                } : null,
                percentageChange: percentageChange !== null ? parseFloat(percentageChange.toFixed(2)) : null,
                // For response time, lower is better, so trend is inverted
                trend: percentageChange < 0 ? 'improved' : percentageChange > 0 ? 'slower' : 'stable'
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting average response time', { providerID, period, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getRequestVolumeTrends(providerID, period = '30days') {
        try {
            this.validatePeriod(period);
            analyticsLogger.debug('Getting request volume trends', { providerID, period });

            const { interval } = this.parsePeriod(period);
            
            // Determine grouping based on period
            let dateFormat;
            let groupBy;
            
            if (period === '7days') {
                dateFormat = '%Y-%m-%d';
                groupBy = 'DATE(sr.createdAt)';
            } else if (period === '30days') {
                dateFormat = '%Y-%m-%d';
                groupBy = 'DATE(sr.createdAt)';
            } else if (period === '6months' || period === '1year') {
                dateFormat = '%Y-%m';
                groupBy = 'DATE_FORMAT(sr.createdAt, "%Y-%m")';
            } else {
                dateFormat = '%Y-%m';
                groupBy = 'DATE_FORMAT(sr.createdAt, "%Y-%m")';
            }

            let dateCondition = '';
            if (interval) {
                dateCondition = `AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL ${interval})`;
            }

            const query = `
                SELECT 
                    DATE_FORMAT(sr.createdAt, '${dateFormat}') as periodLabel,
                    COUNT(*) as totalRequests,
                    COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) as completedRequests,
                    COUNT(CASE WHEN sr.status = 'Cancelled' THEN 1 END) as cancelledRequests,
                    COUNT(CASE WHEN sr.status = 'Pending' THEN 1 END) as pendingRequests,
                    COUNT(CASE WHEN sr.status IN ('Accepted', 'In Progress') THEN 1 END) as activeRequests
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    ${dateCondition}
                GROUP BY ${groupBy}
                ORDER BY periodLabel ASC
            `;

            const [rows] = await pool.execute(query, [providerID]);

            // Calculate trends and changes
            let previousTotal = 0;
            const dataPoints = rows.map((row, index) => {
                const totalRequests = parseInt(row.totalRequests, 10);
                let percentageChange = null;
                
                if (index > 0 && previousTotal > 0) {
                    percentageChange = ((totalRequests - previousTotal) / previousTotal) * 100;
                }
                
                const point = {
                    label: row.periodLabel,
                    totalRequests,
                    completedRequests: parseInt(row.completedRequests, 10),
                    cancelledRequests: parseInt(row.cancelledRequests, 10),
                    pendingRequests: parseInt(row.pendingRequests, 10),
                    activeRequests: parseInt(row.activeRequests, 10),
                    percentageChange: percentageChange !== null ? parseFloat(percentageChange.toFixed(2)) : null
                };
                
                previousTotal = totalRequests;
                return point;
            });

            // Calculate summary statistics
            const totalRequests = dataPoints.reduce((sum, point) => sum + point.totalRequests, 0);
            const totalCompleted = dataPoints.reduce((sum, point) => sum + point.completedRequests, 0);
            const totalCancelled = dataPoints.reduce((sum, point) => sum + point.cancelledRequests, 0);
            const averagePerPeriod = dataPoints.length > 0 ? totalRequests / dataPoints.length : 0;

            // Find peak and lowest periods
            const peakPeriod = dataPoints.length > 0 
                ? dataPoints.reduce((max, p) => p.totalRequests > max.totalRequests ? p : max, dataPoints[0])
                : null;
            const lowestPeriod = dataPoints.length > 0 
                ? dataPoints.reduce((min, p) => p.totalRequests < min.totalRequests ? p : min, dataPoints[0])
                : null;

            return {
                period,
                dataPoints,
                summary: {
                    totalRequests,
                    totalCompleted,
                    totalCancelled,
                    averagePerPeriod: parseFloat(averagePerPeriod.toFixed(2)),
                    dataPointCount: dataPoints.length,
                    peakPeriod: peakPeriod ? {
                        label: peakPeriod.label,
                        requests: peakPeriod.totalRequests
                    } : null,
                    lowestPeriod: lowestPeriod ? {
                        label: lowestPeriod.label,
                        requests: lowestPeriod.totalRequests
                    } : null
                }
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting request volume trends', { providerID, period, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getCancellationMetrics(providerID, period = '30days') {
        try {
            this.validatePeriod(period);
            analyticsLogger.debug('Getting cancellation metrics', { providerID, period });

            const { interval, days } = this.parsePeriod(period);
            
            let dateCondition = '';
            let previousDateCondition = '';
            
            if (interval) {
                dateCondition = `AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL ${interval})`;
                previousDateCondition = `AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL ${days * 2} DAY) AND sr.createdAt < DATE_SUB(NOW(), INTERVAL ${interval})`;
            }

            // Get cancellation rate and reasons
            const currentQuery = `
                SELECT 
                    COUNT(*) as totalRequests,
                    COUNT(CASE WHEN sr.status = 'Cancelled' THEN 1 END) as cancelledRequests,
                    sr.cancellationReason,
                    COUNT(CASE WHEN sr.status = 'Cancelled' AND sr.cancellationReason IS NOT NULL THEN 1 END) as reasonedCancellations
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    ${dateCondition}
                GROUP BY sr.cancellationReason
            `;

            const [currentRows] = await pool.execute(currentQuery, [providerID]);

            // Aggregate totals
            let totalRequests = 0;
            let cancelledRequests = 0;
            const reasonsMap = new Map();

            currentRows.forEach(row => {
                totalRequests += parseInt(row.totalRequests, 10);
                const cancelled = parseInt(row.cancelledRequests, 10);
                cancelledRequests += cancelled;
                
                if (row.cancellationReason && cancelled > 0) {
                    const reason = row.cancellationReason || 'Unspecified';
                    reasonsMap.set(reason, (reasonsMap.get(reason) || 0) + cancelled);
                }
            });

            // Calculate cancellation rate
            const cancellationRate = totalRequests > 0 
                ? (cancelledRequests / totalRequests) * 100 
                : 0;

            // Format reasons breakdown
            const reasons = Array.from(reasonsMap.entries())
                .map(([reason, count]) => ({
                    reason,
                    count,
                    percentage: cancelledRequests > 0 
                        ? parseFloat(((count / cancelledRequests) * 100).toFixed(2))
                        : 0
                }))
                .sort((a, b) => b.count - a.count);

            // Add 'Unspecified' for cancellations without reasons
            const specifiedCount = reasons.reduce((sum, r) => sum + r.count, 0);
            const unspecifiedCount = cancelledRequests - specifiedCount;
            if (unspecifiedCount > 0) {
                reasons.push({
                    reason: 'Unspecified',
                    count: unspecifiedCount,
                    percentage: parseFloat(((unspecifiedCount / cancelledRequests) * 100).toFixed(2))
                });
            }

            // Previous period for comparison
            let previousCancellationRate = null;
            let percentageChange = null;

            if (interval) {
                const previousQuery = `
                    SELECT 
                        COUNT(*) as totalRequests,
                        COUNT(CASE WHEN sr.status = 'Cancelled' THEN 1 END) as cancelledRequests
                    FROM ServiceRequest sr
                    WHERE sr.providerID = ?
                        ${previousDateCondition}
                `;

                const [previousRows] = await pool.execute(previousQuery, [providerID]);
                const prevTotal = parseInt(previousRows[0].totalRequests, 10) || 0;
                const prevCancelled = parseInt(previousRows[0].cancelledRequests, 10) || 0;

                previousCancellationRate = prevTotal > 0 
                    ? (prevCancelled / prevTotal) * 100 
                    : 0;

                // For cancellation rate, negative change is good (fewer cancellations)
                percentageChange = cancellationRate - previousCancellationRate;
            }

            return {
                period,
                cancellationRate: parseFloat(cancellationRate.toFixed(2)),
                cancelledRequests,
                totalRequests,
                reasons,
                previousPeriod: previousCancellationRate !== null ? {
                    cancellationRate: parseFloat(previousCancellationRate.toFixed(2))
                } : null,
                percentageChange: percentageChange !== null ? parseFloat(percentageChange.toFixed(2)) : null,
                // For cancellation rate, lower is better
                trend: percentageChange < 0 ? 'improved' : percentageChange > 0 ? 'worsened' : 'stable'
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting cancellation metrics', { providerID, period, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getMetricsByCategory(providerID) {
        try {
            analyticsLogger.debug('Getting metrics by category', { providerID });

            const query = `
                SELECT 
                    sr.category,
                    COUNT(*) as totalRequests,
                    COUNT(CASE WHEN sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') THEN 1 END) as acceptedRequests,
                    COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) as completedRequests,
                    COUNT(CASE WHEN sr.status = 'Cancelled' THEN 1 END) as cancelledRequests,
                    AVG(CASE WHEN r.rating IS NOT NULL THEN r.rating END) as averageRating,
                    COUNT(DISTINCT r.reviewID) as reviewCount,
                    AVG(
                        CASE WHEN sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') THEN
                            TIMESTAMPDIFF(MINUTE, sr.createdAt, sr.updatedAt)
                        END
                    ) as avgResponseMinutes
                FROM ServiceRequest sr
                LEFT JOIN Review r ON sr.requestID = r.requestID
                WHERE sr.providerID = ?
                GROUP BY sr.category
                ORDER BY totalRequests DESC
            `;

            const [rows] = await pool.execute(query, [providerID]);

            const categories = rows.map(row => {
                const totalRequests = parseInt(row.totalRequests, 10);
                const acceptedRequests = parseInt(row.acceptedRequests, 10);
                const completedRequests = parseInt(row.completedRequests, 10);
                const cancelledRequests = parseInt(row.cancelledRequests, 10);
                const avgResponseMinutes = parseFloat(row.avgResponseMinutes) || 0;

                // Calculate rates
                const completionRate = acceptedRequests > 0 
                    ? (completedRequests / acceptedRequests) * 100 
                    : 0;
                const cancellationRate = totalRequests > 0 
                    ? (cancelledRequests / totalRequests) * 100 
                    : 0;

                return {
                    category: row.category,
                    totalRequests,
                    acceptedRequests,
                    completedRequests,
                    cancelledRequests,
                    completionRate: parseFloat(completionRate.toFixed(2)),
                    cancellationRate: parseFloat(cancellationRate.toFixed(2)),
                    averageRating: row.averageRating ? parseFloat(parseFloat(row.averageRating).toFixed(2)) : null,
                    reviewCount: parseInt(row.reviewCount, 10),
                    averageResponseTime: {
                        minutes: parseFloat(avgResponseMinutes.toFixed(2)),
                        formatted: avgResponseMinutes < 60 
                            ? `${avgResponseMinutes.toFixed(0)} min`
                            : avgResponseMinutes < 1440
                                ? `${(avgResponseMinutes / 60).toFixed(1)} hrs`
                                : `${(avgResponseMinutes / 1440).toFixed(1)} days`
                    }
                };
            });

            // Calculate overall totals
            const totalRequests = categories.reduce((sum, c) => sum + c.totalRequests, 0);
            const totalCompleted = categories.reduce((sum, c) => sum + c.completedRequests, 0);
            const totalCancelled = categories.reduce((sum, c) => sum + c.cancelledRequests, 0);

            // Find best and worst performing categories
            const bestCategory = categories.length > 0 
                ? categories.reduce((best, c) => c.completionRate > best.completionRate ? c : best, categories[0])
                : null;
            const worstCategory = categories.length > 0 
                ? categories.reduce((worst, c) => c.completionRate < worst.completionRate ? c : worst, categories[0])
                : null;

            return {
                categories,
                summary: {
                    categoryCount: categories.length,
                    totalRequests,
                    totalCompleted,
                    totalCancelled,
                    overallCompletionRate: totalRequests > 0 
                        ? parseFloat(((totalCompleted / totalRequests) * 100).toFixed(2))
                        : 0,
                    bestPerformingCategory: bestCategory ? {
                        category: bestCategory.category,
                        completionRate: bestCategory.completionRate
                    } : null,
                    worstPerformingCategory: worstCategory ? {
                        category: worstCategory.category,
                        completionRate: worstCategory.completionRate
                    } : null
                }
            };
        } catch (error) {
            analyticsLogger.error('Error getting metrics by category', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getPerformanceSummary(providerID, period = '30days') {
        try {
            this.validatePeriod(period);
            analyticsLogger.debug('Getting performance summary', { providerID, period });

            const { interval } = this.parsePeriod(period);
            
            let dateCondition = '';
            if (interval) {
                dateCondition = `AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL ${interval})`;
            }

            // Get comprehensive metrics in a single query
            const summaryQuery = `
                SELECT 
                    COUNT(*) as totalRequests,
                    COUNT(CASE WHEN sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') THEN 1 END) as acceptedRequests,
                    COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) as completedRequests,
                    COUNT(CASE WHEN sr.status = 'Cancelled' THEN 1 END) as cancelledRequests,
                    COUNT(CASE WHEN sr.status = 'Pending' THEN 1 END) as pendingRequests,
                    COUNT(CASE WHEN sr.status IN ('Accepted', 'In Progress') THEN 1 END) as activeRequests,
                    COUNT(DISTINCT sr.customerID) as uniqueCustomers
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    ${dateCondition}
            `;

            // Get satisfaction metrics from reviews
            const satisfactionQuery = `
                SELECT 
                    AVG(r.rating) as averageRating,
                    COUNT(*) as totalReviews,
                    COUNT(CASE WHEN r.rating >= 4 THEN 1 END) as positiveReviews,
                    COUNT(CASE WHEN r.rating <= 2 THEN 1 END) as negativeReviews,
                    COUNT(CASE WHEN r.rating = 5 THEN 1 END) as fiveStarReviews,
                    COUNT(CASE WHEN r.rating = 4 THEN 1 END) as fourStarReviews,
                    COUNT(CASE WHEN r.rating = 3 THEN 1 END) as threeStarReviews,
                    COUNT(CASE WHEN r.rating = 2 THEN 1 END) as twoStarReviews,
                    COUNT(CASE WHEN r.rating = 1 THEN 1 END) as oneStarReviews
                FROM Review r
                JOIN ServiceRequest sr ON r.requestID = sr.requestID
                WHERE sr.providerID = ?
                    ${dateCondition.replace('sr.createdAt', 'r.createdAt')}
            `;

            const [[summaryRows], [satisfactionRows]] = await Promise.all([
                pool.execute(summaryQuery, [providerID]),
                pool.execute(satisfactionQuery, [providerID])
            ]);

            const summary = summaryRows[0];
            const satisfaction = satisfactionRows[0];

            const totalRequests = parseInt(summary.totalRequests, 10) || 0;
            const acceptedRequests = parseInt(summary.acceptedRequests, 10) || 0;
            const completedRequests = parseInt(summary.completedRequests, 10) || 0;
            const cancelledRequests = parseInt(summary.cancelledRequests, 10) || 0;
            const pendingRequests = parseInt(summary.pendingRequests, 10) || 0;
            const activeRequests = parseInt(summary.activeRequests, 10) || 0;
            const uniqueCustomers = parseInt(summary.uniqueCustomers, 10) || 0;

            const totalReviews = parseInt(satisfaction.totalReviews, 10) || 0;
            const averageRating = parseFloat(satisfaction.averageRating) || 0;
            const positiveReviews = parseInt(satisfaction.positiveReviews, 10) || 0;
            const negativeReviews = parseInt(satisfaction.negativeReviews, 10) || 0;

            // Calculate rates
            const completionRate = acceptedRequests > 0 
                ? (completedRequests / acceptedRequests) * 100 
                : 0;
            const cancellationRate = totalRequests > 0 
                ? (cancelledRequests / totalRequests) * 100 
                : 0;
            const satisfactionRate = totalReviews > 0 
                ? (positiveReviews / totalReviews) * 100 
                : 0;

            // Rating distribution
            const ratingDistribution = {
                5: parseInt(satisfaction.fiveStarReviews, 10) || 0,
                4: parseInt(satisfaction.fourStarReviews, 10) || 0,
                3: parseInt(satisfaction.threeStarReviews, 10) || 0,
                2: parseInt(satisfaction.twoStarReviews, 10) || 0,
                1: parseInt(satisfaction.oneStarReviews, 10) || 0
            };

            // Calculate performance score (weighted average of key metrics)
            // Weights: completion rate (40%), satisfaction rate (40%), low cancellation (20%)
            const performanceScore = (
                (completionRate * 0.4) +
                (satisfactionRate * 0.4) +
                ((100 - cancellationRate) * 0.2)
            );

            return {
                period,
                requestMetrics: {
                    totalRequests,
                    acceptedRequests,
                    completedRequests,
                    cancelledRequests,
                    pendingRequests,
                    activeRequests,
                    uniqueCustomers
                },
                rates: {
                    completionRate: parseFloat(completionRate.toFixed(2)),
                    cancellationRate: parseFloat(cancellationRate.toFixed(2)),
                    satisfactionRate: parseFloat(satisfactionRate.toFixed(2))
                },
                satisfaction: {
                    averageRating: parseFloat(averageRating.toFixed(2)),
                    totalReviews,
                    positiveReviews,
                    negativeReviews,
                    ratingDistribution
                },
                performanceScore: parseFloat(performanceScore.toFixed(2)),
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting performance summary', { providerID, period, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async getDashboardData(providerID, period = '30days') {
        try {
            analyticsLogger.debug('Getting performance dashboard data', { providerID, period });

            // Fetch all data in parallel for efficiency
            const [
                completionRate,
                averageResponseTime,
                requestVolumeTrends,
                cancellationMetrics,
                metricsByCategory,
                performanceSummary
            ] = await Promise.all([
                this.getCompletionRate(providerID, period),
                this.getAverageResponseTime(providerID, period),
                this.getRequestVolumeTrends(providerID, period),
                this.getCancellationMetrics(providerID, period),
                this.getMetricsByCategory(providerID),
                this.getPerformanceSummary(providerID, period)
            ]);

            return {
                period,
                completionRate,
                averageResponseTime,
                requestVolumeTrends,
                cancellationMetrics,
                metricsByCategory,
                performanceSummary,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error getting performance dashboard', { providerID, period, error: error.message });
            throw error;
        }
    }
}

module.exports = PerformanceAnalytics;

