const pool = require('../config/database');
const { DatabaseError, ValidationError, mapDatabaseError } = require('../utils/errors');
const { analyticsLogger } = require('../utils/logger');

// Metric types for threshold alerts
const METRIC_TYPES = {
    COMPLETION_RATE: 'completion_rate',
    RESPONSE_TIME: 'response_time',
    CANCELLATION_RATE: 'cancellation_rate',
    RATING: 'rating',
    EARNINGS: 'earnings',
    REQUEST_COUNT: 'request_count'
};

// Comparison operators for alerts
const COMPARISON_OPERATORS = {
    ABOVE: 'above',
    BELOW: 'below',
    EQUALS: 'equals'
};

class RealTimeAnalytics {
    static async getTodayMetrics(providerID) {
        try {
            analyticsLogger.debug('Getting today metrics', { providerID });

            // Get today's service request metrics
            const requestsQuery = `
                SELECT 
                    COUNT(*) as totalRequests,
                    COUNT(CASE WHEN sr.status = 'Pending' THEN 1 END) as pendingRequests,
                    COUNT(CASE WHEN sr.status = 'Accepted' THEN 1 END) as acceptedRequests,
                    COUNT(CASE WHEN sr.status = 'In Progress' THEN 1 END) as inProgressRequests,
                    COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) as completedRequests,
                    COUNT(CASE WHEN sr.status = 'Cancelled' THEN 1 END) as cancelledRequests,
                    COUNT(CASE WHEN sr.status = 'Rejected' THEN 1 END) as rejectedRequests
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND DATE(sr.createdAt) = CURDATE()
            `;

            // Get today's earnings
            const earningsQuery = `
                SELECT 
                    COALESCE(SUM(CASE WHEN p.status = 'Completed' THEN p.amount ELSE 0 END), 0) as completedEarnings,
                    COALESCE(SUM(CASE WHEN p.status = 'Pending' THEN p.amount ELSE 0 END), 0) as pendingEarnings,
                    COUNT(CASE WHEN p.status = 'Completed' THEN 1 END) as completedPayments,
                    COUNT(CASE WHEN p.status = 'Pending' THEN 1 END) as pendingPayments
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND DATE(p.createdAt) = CURDATE()
            `;

            // Get today's new customers (first-time customers)
            const customersQuery = `
                SELECT 
                    COUNT(DISTINCT sr.customerID) as uniqueCustomers,
                    COUNT(DISTINCT CASE 
                        WHEN (SELECT COUNT(*) FROM ServiceRequest sr2 
                              WHERE sr2.customerID = sr.customerID 
                              AND sr2.providerID = sr.providerID 
                              AND sr2.createdAt < sr.createdAt) = 0 
                        THEN sr.customerID 
                    END) as newCustomers
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND DATE(sr.createdAt) = CURDATE()
            `;

            // Get today's reviews and ratings
            const reviewsQuery = `
                SELECT 
                    COUNT(*) as reviewCount,
                    COALESCE(AVG(r.rating), 0) as averageRating,
                    COUNT(CASE WHEN r.rating >= 4 THEN 1 END) as positiveReviews,
                    COUNT(CASE WHEN r.rating <= 2 THEN 1 END) as negativeReviews
                FROM Review r
                WHERE r.providerID = ?
                    AND DATE(r.createdAt) = CURDATE()
            `;

            // Get yesterday's metrics for comparison
            const yesterdayRequestsQuery = `
                SELECT 
                    COUNT(*) as totalRequests,
                    COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) as completedRequests
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND DATE(sr.createdAt) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
            `;

            const yesterdayEarningsQuery = `
                SELECT COALESCE(SUM(p.amount), 0) as totalEarnings
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
                    AND DATE(p.createdAt) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
            `;

            // Execute all queries in parallel
            const [
                [requestsRows],
                [earningsRows],
                [customersRows],
                [reviewsRows],
                [yesterdayRequestsRows],
                [yesterdayEarningsRows]
            ] = await Promise.all([
                pool.execute(requestsQuery, [providerID]),
                pool.execute(earningsQuery, [providerID]),
                pool.execute(customersQuery, [providerID]),
                pool.execute(reviewsQuery, [providerID]),
                pool.execute(yesterdayRequestsQuery, [providerID]),
                pool.execute(yesterdayEarningsQuery, [providerID])
            ]);

            const requests = requestsRows[0];
            const earnings = earningsRows[0];
            const customers = customersRows[0];
            const reviews = reviewsRows[0];
            const yesterdayRequests = yesterdayRequestsRows[0];
            const yesterdayEarnings = yesterdayEarningsRows[0];

            // Parse values
            const todayTotalRequests = parseInt(requests.totalRequests, 10) || 0;
            const todayCompletedRequests = parseInt(requests.completedRequests, 10) || 0;
            const todayCompletedEarnings = parseFloat(earnings.completedEarnings) || 0;
            const yesterdayTotalRequests = parseInt(yesterdayRequests.totalRequests, 10) || 0;
            const yesterdayCompletedRequests = parseInt(yesterdayRequests.completedRequests, 10) || 0;
            const yesterdayTotalEarnings = parseFloat(yesterdayEarnings.totalEarnings) || 0;

            // Calculate percentage changes
            const requestsChange = yesterdayTotalRequests > 0
                ? ((todayTotalRequests - yesterdayTotalRequests) / yesterdayTotalRequests) * 100
                : todayTotalRequests > 0 ? 100 : 0;

            const completedChange = yesterdayCompletedRequests > 0
                ? ((todayCompletedRequests - yesterdayCompletedRequests) / yesterdayCompletedRequests) * 100
                : todayCompletedRequests > 0 ? 100 : 0;

            const earningsChange = yesterdayTotalEarnings > 0
                ? ((todayCompletedEarnings - yesterdayTotalEarnings) / yesterdayTotalEarnings) * 100
                : todayCompletedEarnings > 0 ? 100 : 0;

            return {
                date: new Date().toISOString().split('T')[0],
                requests: {
                    total: todayTotalRequests,
                    pending: parseInt(requests.pendingRequests, 10) || 0,
                    accepted: parseInt(requests.acceptedRequests, 10) || 0,
                    inProgress: parseInt(requests.inProgressRequests, 10) || 0,
                    completed: todayCompletedRequests,
                    cancelled: parseInt(requests.cancelledRequests, 10) || 0,
                    rejected: parseInt(requests.rejectedRequests, 10) || 0,
                    changeFromYesterday: parseFloat(requestsChange.toFixed(2)),
                    trend: requestsChange > 0 ? 'up' : requestsChange < 0 ? 'down' : 'stable'
                },
                earnings: {
                    completed: todayCompletedEarnings,
                    formattedCompleted: todayCompletedEarnings.toFixed(2),
                    pending: parseFloat(earnings.pendingEarnings) || 0,
                    formattedPending: (parseFloat(earnings.pendingEarnings) || 0).toFixed(2),
                    completedPayments: parseInt(earnings.completedPayments, 10) || 0,
                    pendingPayments: parseInt(earnings.pendingPayments, 10) || 0,
                    changeFromYesterday: parseFloat(earningsChange.toFixed(2)),
                    trend: earningsChange > 0 ? 'up' : earningsChange < 0 ? 'down' : 'stable'
                },
                customers: {
                    unique: parseInt(customers.uniqueCustomers, 10) || 0,
                    new: parseInt(customers.newCustomers, 10) || 0,
                    returning: (parseInt(customers.uniqueCustomers, 10) || 0) - (parseInt(customers.newCustomers, 10) || 0)
                },
                reviews: {
                    count: parseInt(reviews.reviewCount, 10) || 0,
                    averageRating: parseFloat(parseFloat(reviews.averageRating).toFixed(2)) || 0,
                    positive: parseInt(reviews.positiveReviews, 10) || 0,
                    negative: parseInt(reviews.negativeReviews, 10) || 0
                },
                comparison: {
                    yesterday: {
                        totalRequests: yesterdayTotalRequests,
                        completedRequests: yesterdayCompletedRequests,
                        earnings: yesterdayTotalEarnings,
                        formattedEarnings: yesterdayTotalEarnings.toFixed(2)
                    },
                    completedRequestsChange: parseFloat(completedChange.toFixed(2))
                },
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error getting today metrics', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async getQueueStatus(providerID) {
        try {
            analyticsLogger.debug('Getting queue status', { providerID });

            // Get pending and in-progress requests (the queue)
            const queueQuery = `
                SELECT 
                    sr.requestID,
                    sr.customerID,
                    sr.category,
                    sr.description,
                    sr.status,
                    sr.priorityLevel,
                    sr.createdAt,
                    sr.serviceDate,
                    u.name as customerName,
                    TIMESTAMPDIFF(MINUTE, sr.createdAt, NOW()) as waitingMinutes
                FROM ServiceRequest sr
                JOIN USER u ON sr.customerID = u.userID
                WHERE sr.providerID = ?
                    AND sr.status IN ('Pending', 'Accepted', 'In Progress')
                ORDER BY 
                    CASE sr.priorityLevel 
                        WHEN 'Urgent' THEN 1 
                        WHEN 'High' THEN 2 
                        WHEN 'Normal' THEN 3 
                        WHEN 'Low' THEN 4 
                        ELSE 5 
                    END,
                    sr.createdAt ASC
            `;

            // Get average response time for today
            const responseTimeQuery = `
                SELECT 
                    AVG(
                        TIMESTAMPDIFF(MINUTE, sr.createdAt, 
                            COALESCE(
                                (SELECT MIN(c.timestamp) FROM Chat c WHERE c.requestID = sr.requestID AND c.senderID = sr.providerID),
                                sr.updatedAt
                            )
                        )
                    ) as avgResponseMinutes,
                    COUNT(*) as responseCount
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND sr.status IN ('Accepted', 'In Progress', 'Completed')
                    AND DATE(sr.createdAt) = CURDATE()
            `;

            // Get unread messages count
            const unreadMessagesQuery = `
                SELECT COUNT(*) as unreadCount
                FROM Chat c
                JOIN ServiceRequest sr ON c.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND c.receiverID = ?
                    AND c.isRead = FALSE
            `;

            const [
                [queueRows],
                [responseTimeRows],
                [unreadMessagesRows]
            ] = await Promise.all([
                pool.execute(queueQuery, [providerID]),
                pool.execute(responseTimeQuery, [providerID]),
                pool.execute(unreadMessagesQuery, [providerID, providerID])
            ]);

            const responseTime = responseTimeRows[0];
            const avgResponseMinutes = parseFloat(responseTime.avgResponseMinutes) || 0;

            // Format response time
            const formatTime = (minutes) => {
                if (minutes < 60) {
                    return { value: minutes, unit: 'minutes', formatted: `${Math.round(minutes)} min` };
                } else if (minutes < 1440) {
                    const hours = minutes / 60;
                    return { value: hours, unit: 'hours', formatted: `${hours.toFixed(1)} hrs` };
                } else {
                    const days = minutes / 1440;
                    return { value: days, unit: 'days', formatted: `${days.toFixed(1)} days` };
                }
            };

            // Process queue items
            const queueItems = queueRows.map(row => ({
                requestID: row.requestID,
                customerID: row.customerID,
                customerName: row.customerName,
                category: row.category,
                description: row.description ? row.description.substring(0, 100) + (row.description.length > 100 ? '...' : '') : '',
                status: row.status,
                priorityLevel: row.priorityLevel,
                createdAt: row.createdAt,
                serviceDate: row.serviceDate,
                waitingTime: formatTime(parseInt(row.waitingMinutes, 10) || 0)
            }));

            // Categorize queue by status
            const pendingItems = queueItems.filter(item => item.status === 'Pending');
            const acceptedItems = queueItems.filter(item => item.status === 'Accepted');
            const inProgressItems = queueItems.filter(item => item.status === 'In Progress');

            // Calculate queue health
            const oldestWaitingMinutes = queueItems.length > 0 
                ? Math.max(...queueItems.map(item => item.waitingTime.value * (item.waitingTime.unit === 'hours' ? 60 : item.waitingTime.unit === 'days' ? 1440 : 1)))
                : 0;
            
            let queueHealth = 'good';
            if (oldestWaitingMinutes > 1440) { // More than 24 hours
                queueHealth = 'critical';
            } else if (oldestWaitingMinutes > 480) { // More than 8 hours
                queueHealth = 'warning';
            }

            return {
                queue: {
                    total: queueItems.length,
                    pending: pendingItems.length,
                    accepted: acceptedItems.length,
                    inProgress: inProgressItems.length,
                    items: queueItems,
                    health: queueHealth
                },
                responseTime: {
                    today: {
                        average: formatTime(avgResponseMinutes),
                        responseCount: parseInt(responseTime.responseCount, 10) || 0
                    }
                },
                unreadMessages: parseInt(unreadMessagesRows[0].unreadCount, 10) || 0,
                summary: {
                    activeRequests: queueItems.length,
                    urgentRequests: queueItems.filter(item => item.priorityLevel === 'Urgent').length,
                    highPriorityRequests: queueItems.filter(item => item.priorityLevel === 'High').length,
                    oldestRequest: queueItems.length > 0 ? queueItems[0] : null
                },
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error getting queue status', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async checkThresholds(providerID) {
        try {
            analyticsLogger.debug('Checking thresholds', { providerID });

            // Get provider's configured alerts
            const alertsQuery = `
                SELECT 
                    alertID,
                    metricType,
                    thresholdValue,
                    comparisonOperator,
                    lastTriggered
                FROM PerformanceAlert
                WHERE providerID = ?
                    AND isActive = TRUE
            `;

            const [alertRows] = await pool.execute(alertsQuery, [providerID]);

            if (alertRows.length === 0) {
                return {
                    hasAlerts: false,
                    configuredAlerts: 0,
                    triggeredAlerts: [],
                    metrics: {},
                    message: 'No performance alerts configured',
                    generatedAt: new Date().toISOString()
                };
            }

            // Get current metrics for comparison
            // Completion rate (last 30 days)
            const completionRateQuery = `
                SELECT 
                    COUNT(CASE WHEN sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') THEN 1 END) as acceptedRequests,
                    COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) as completedRequests
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            `;

            // Average response time (last 30 days)
            const responseTimeQuery = `
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
                    AND sr.status IN ('Accepted', 'In Progress', 'Completed')
                    AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            `;

            // Cancellation rate (last 30 days)
            const cancellationRateQuery = `
                SELECT 
                    COUNT(*) as totalRequests,
                    COUNT(CASE WHEN sr.status = 'Cancelled' THEN 1 END) as cancelledRequests
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            `;

            // Average rating (all time)
            const ratingQuery = `
                SELECT AVG(r.rating) as averageRating
                FROM Review r
                WHERE r.providerID = ?
            `;

            // Today's earnings
            const earningsQuery = `
                SELECT COALESCE(SUM(p.amount), 0) as todayEarnings
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
                    AND DATE(p.createdAt) = CURDATE()
            `;

            // Today's request count
            const requestCountQuery = `
                SELECT COUNT(*) as todayRequests
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND DATE(sr.createdAt) = CURDATE()
            `;

            const [
                [completionRows],
                [responseTimeRows],
                [cancellationRows],
                [ratingRows],
                [earningsRows],
                [requestCountRows]
            ] = await Promise.all([
                pool.execute(completionRateQuery, [providerID]),
                pool.execute(responseTimeQuery, [providerID]),
                pool.execute(cancellationRateQuery, [providerID]),
                pool.execute(ratingQuery, [providerID]),
                pool.execute(earningsQuery, [providerID]),
                pool.execute(requestCountQuery, [providerID])
            ]);

            // Calculate current metric values
            const completion = completionRows[0];
            const acceptedRequests = parseInt(completion.acceptedRequests, 10) || 0;
            const completedRequests = parseInt(completion.completedRequests, 10) || 0;
            const completionRate = acceptedRequests > 0 ? (completedRequests / acceptedRequests) * 100 : 0;

            const avgResponseMinutes = parseFloat(responseTimeRows[0].avgResponseMinutes) || 0;

            const cancellation = cancellationRows[0];
            const totalRequests = parseInt(cancellation.totalRequests, 10) || 0;
            const cancelledRequests = parseInt(cancellation.cancelledRequests, 10) || 0;
            const cancellationRate = totalRequests > 0 ? (cancelledRequests / totalRequests) * 100 : 0;

            const averageRating = parseFloat(ratingRows[0].averageRating) || 0;
            const todayEarnings = parseFloat(earningsRows[0].todayEarnings) || 0;
            const todayRequests = parseInt(requestCountRows[0].todayRequests, 10) || 0;

            // Current metrics map
            const currentMetrics = {
                [METRIC_TYPES.COMPLETION_RATE]: completionRate,
                [METRIC_TYPES.RESPONSE_TIME]: avgResponseMinutes,
                [METRIC_TYPES.CANCELLATION_RATE]: cancellationRate,
                [METRIC_TYPES.RATING]: averageRating,
                [METRIC_TYPES.EARNINGS]: todayEarnings,
                [METRIC_TYPES.REQUEST_COUNT]: todayRequests
            };

            // Check each alert against current metrics
            const triggeredAlerts = [];
            const alertsToUpdate = [];

            for (const alert of alertRows) {
                const currentValue = currentMetrics[alert.metricType];
                if (currentValue === undefined) continue;

                const thresholdValue = parseFloat(alert.thresholdValue);
                let isTriggered = false;

                switch (alert.comparisonOperator) {
                    case COMPARISON_OPERATORS.ABOVE:
                        isTriggered = currentValue > thresholdValue;
                        break;
                    case COMPARISON_OPERATORS.BELOW:
                        isTriggered = currentValue < thresholdValue;
                        break;
                    case COMPARISON_OPERATORS.EQUALS:
                        isTriggered = Math.abs(currentValue - thresholdValue) < 0.01;
                        break;
                }

                if (isTriggered) {
                    triggeredAlerts.push({
                        alertID: alert.alertID,
                        metricType: alert.metricType,
                        thresholdValue,
                        comparisonOperator: alert.comparisonOperator,
                        currentValue: parseFloat(currentValue.toFixed(2)),
                        message: this.generateAlertMessage(alert.metricType, alert.comparisonOperator, thresholdValue, currentValue),
                        severity: this.calculateAlertSeverity(alert.metricType, alert.comparisonOperator, thresholdValue, currentValue),
                        lastTriggered: alert.lastTriggered
                    });
                    alertsToUpdate.push(alert.alertID);
                }
            }

            // Update lastTriggered for triggered alerts
            if (alertsToUpdate.length > 0) {
                const updateQuery = `
                    UPDATE PerformanceAlert 
                    SET lastTriggered = NOW() 
                    WHERE alertID IN (${alertsToUpdate.map(() => '?').join(',')})
                `;
                await pool.execute(updateQuery, alertsToUpdate);
            }

            return {
                hasAlerts: triggeredAlerts.length > 0,
                configuredAlerts: alertRows.length,
                triggeredAlerts,
                triggeredCount: triggeredAlerts.length,
                metrics: {
                    completionRate: parseFloat(completionRate.toFixed(2)),
                    responseTimeMinutes: parseFloat(avgResponseMinutes.toFixed(2)),
                    cancellationRate: parseFloat(cancellationRate.toFixed(2)),
                    averageRating: parseFloat(averageRating.toFixed(2)),
                    todayEarnings: parseFloat(todayEarnings.toFixed(2)),
                    todayRequests
                },
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error checking thresholds', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static generateAlertMessage(metricType, operator, threshold, currentValue) {
        const metricNames = {
            [METRIC_TYPES.COMPLETION_RATE]: 'Completion rate',
            [METRIC_TYPES.RESPONSE_TIME]: 'Response time',
            [METRIC_TYPES.CANCELLATION_RATE]: 'Cancellation rate',
            [METRIC_TYPES.RATING]: 'Average rating',
            [METRIC_TYPES.EARNINGS]: 'Today\'s earnings',
            [METRIC_TYPES.REQUEST_COUNT]: 'Today\'s requests'
        };

        const operatorText = {
            [COMPARISON_OPERATORS.ABOVE]: 'exceeded',
            [COMPARISON_OPERATORS.BELOW]: 'fallen below',
            [COMPARISON_OPERATORS.EQUALS]: 'reached'
        };

        const metricName = metricNames[metricType] || metricType;
        const opText = operatorText[operator] || operator;

        let formattedCurrent = currentValue.toFixed(2);
        let formattedThreshold = threshold.toFixed(2);

        if (metricType === METRIC_TYPES.RESPONSE_TIME) {
            formattedCurrent = `${currentValue.toFixed(0)} minutes`;
            formattedThreshold = `${threshold.toFixed(0)} minutes`;
        } else if (metricType === METRIC_TYPES.EARNINGS) {
            formattedCurrent = `$${currentValue.toFixed(2)}`;
            formattedThreshold = `$${threshold.toFixed(2)}`;
        } else if (metricType === METRIC_TYPES.COMPLETION_RATE || metricType === METRIC_TYPES.CANCELLATION_RATE) {
            formattedCurrent = `${currentValue.toFixed(1)}%`;
            formattedThreshold = `${threshold.toFixed(1)}%`;
        } else if (metricType === METRIC_TYPES.REQUEST_COUNT) {
            formattedCurrent = `${Math.round(currentValue)}`;
            formattedThreshold = `${Math.round(threshold)}`;
        }

        return `${metricName} has ${opText} ${formattedThreshold} (current: ${formattedCurrent})`;
    }

    static calculateAlertSeverity(metricType, operator, threshold, currentValue) {
        const deviation = Math.abs(currentValue - threshold);
        const percentDeviation = threshold > 0 ? (deviation / threshold) * 100 : deviation;

        // For metrics where lower is worse (completion rate, rating)
        const lowerIsWorse = [METRIC_TYPES.COMPLETION_RATE, METRIC_TYPES.RATING, METRIC_TYPES.EARNINGS, METRIC_TYPES.REQUEST_COUNT];
        // For metrics where higher is worse (response time, cancellation rate)
        const higherIsWorse = [METRIC_TYPES.RESPONSE_TIME, METRIC_TYPES.CANCELLATION_RATE];

        if (lowerIsWorse.includes(metricType) && operator === COMPARISON_OPERATORS.BELOW) {
            if (percentDeviation > 30) return 'critical';
            if (percentDeviation > 15) return 'warning';
            return 'info';
        }

        if (higherIsWorse.includes(metricType) && operator === COMPARISON_OPERATORS.ABOVE) {
            if (percentDeviation > 50) return 'critical';
            if (percentDeviation > 25) return 'warning';
            return 'info';
        }

        return 'info';
    }


    static async getRecentActivity(providerID, limit = 20) {
        try {
            analyticsLogger.debug('Getting recent activity', { providerID, limit });

            // Validate limit
            if (limit < 1 || limit > 100) {
                throw new ValidationError('Limit must be between 1 and 100');
            }

            // Get recent reviews
            const reviewsQuery = `
                SELECT 
                    'review' as activityType,
                    r.reviewID as activityID,
                    r.customerID,
                    u.name as customerName,
                    r.rating,
                    r.comment,
                    r.reply,
                    r.createdAt,
                    sr.category,
                    sr.requestID
                FROM Review r
                JOIN USER u ON r.customerID = u.userID
                JOIN ServiceRequest sr ON r.requestID = sr.requestID
                WHERE r.providerID = ?
                ORDER BY r.createdAt DESC
                LIMIT ?
            `;

            // Get recent service request status changes
            const requestsQuery = `
                SELECT 
                    'request' as activityType,
                    sr.requestID as activityID,
                    sr.customerID,
                    u.name as customerName,
                    sr.status,
                    sr.category,
                    sr.updatedAt as createdAt,
                    sr.description
                FROM ServiceRequest sr
                JOIN USER u ON sr.customerID = u.userID
                WHERE sr.providerID = ?
                    AND sr.status IN ('Completed', 'Cancelled', 'Accepted')
                ORDER BY sr.updatedAt DESC
                LIMIT ?
            `;

            // Get recent messages
            const messagesQuery = `
                SELECT 
                    'message' as activityType,
                    c.messageID as activityID,
                    c.senderID as customerID,
                    u.name as customerName,
                    c.messageText,
                    c.timestamp as createdAt,
                    c.isRead,
                    sr.requestID,
                    sr.category
                FROM Chat c
                JOIN USER u ON c.senderID = u.userID
                JOIN ServiceRequest sr ON c.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND c.receiverID = ?
                ORDER BY c.timestamp DESC
                LIMIT ?
            `;

            // Get recent payments
            const paymentsQuery = `
                SELECT 
                    'payment' as activityType,
                    p.paymentID as activityID,
                    sr.customerID,
                    u.name as customerName,
                    p.amount,
                    p.status,
                    p.paymentDate as createdAt,
                    sr.category,
                    sr.requestID
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                JOIN USER u ON sr.customerID = u.userID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
                ORDER BY p.paymentDate DESC
                LIMIT ?
            `;

            const halfLimit = Math.ceil(limit / 2);

            const [
                [reviewRows],
                [requestRows],
                [messageRows],
                [paymentRows]
            ] = await Promise.all([
                pool.execute(reviewsQuery, [providerID, halfLimit]),
                pool.execute(requestsQuery, [providerID, halfLimit]),
                pool.execute(messagesQuery, [providerID, providerID, halfLimit]),
                pool.execute(paymentsQuery, [providerID, halfLimit])
            ]);

            // Process and combine activities
            const activities = [];

            // Process reviews
            reviewRows.forEach(row => {
                activities.push({
                    type: 'review',
                    id: row.activityID,
                    customerID: row.customerID,
                    customerName: row.customerName,
                    timestamp: row.createdAt,
                    data: {
                        rating: row.rating,
                        comment: row.comment,
                        reply: row.reply,
                        category: row.category,
                        requestID: row.requestID
                    },
                    summary: `${row.customerName} left a ${row.rating}-star review${row.comment ? ': "' + row.comment.substring(0, 50) + (row.comment.length > 50 ? '..."' : '"') : ''}`
                });
            });

            // Process requests
            requestRows.forEach(row => {
                const statusMessages = {
                    'Completed': 'completed',
                    'Cancelled': 'cancelled',
                    'Accepted': 'accepted'
                };
                activities.push({
                    type: 'request',
                    id: row.activityID,
                    customerID: row.customerID,
                    customerName: row.customerName,
                    timestamp: row.createdAt,
                    data: {
                        status: row.status,
                        category: row.category,
                        description: row.description ? row.description.substring(0, 100) : ''
                    },
                    summary: `Service request ${statusMessages[row.status] || row.status.toLowerCase()} for ${row.customerName} (${row.category})`
                });
            });

            // Process messages
            messageRows.forEach(row => {
                activities.push({
                    type: 'message',
                    id: row.activityID,
                    customerID: row.customerID,
                    customerName: row.customerName,
                    timestamp: row.createdAt,
                    data: {
                        message: row.messageText ? row.messageText.substring(0, 100) + (row.messageText.length > 100 ? '...' : '') : '',
                        isRead: row.isRead,
                        requestID: row.requestID,
                        category: row.category
                    },
                    summary: `New message from ${row.customerName}: "${row.messageText ? row.messageText.substring(0, 30) + (row.messageText.length > 30 ? '...' : '') : ''}"`
                });
            });

            // Process payments
            paymentRows.forEach(row => {
                activities.push({
                    type: 'payment',
                    id: row.activityID,
                    customerID: row.customerID,
                    customerName: row.customerName,
                    timestamp: row.createdAt,
                    data: {
                        amount: parseFloat(row.amount),
                        formattedAmount: parseFloat(row.amount).toFixed(2),
                        status: row.status,
                        category: row.category,
                        requestID: row.requestID
                    },
                    summary: `Payment of $${parseFloat(row.amount).toFixed(2)} received from ${row.customerName}`
                });
            });

            // Sort all activities by timestamp (most recent first)
            activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Limit to requested number
            const limitedActivities = activities.slice(0, limit);

            // Calculate activity summary
            const reviewCount = limitedActivities.filter(a => a.type === 'review').length;
            const requestCount = limitedActivities.filter(a => a.type === 'request').length;
            const messageCount = limitedActivities.filter(a => a.type === 'message').length;
            const paymentCount = limitedActivities.filter(a => a.type === 'payment').length;
            const unreadMessageCount = limitedActivities.filter(a => a.type === 'message' && !a.data.isRead).length;

            // Get average rating from recent reviews
            const recentReviews = limitedActivities.filter(a => a.type === 'review');
            const avgRecentRating = recentReviews.length > 0
                ? recentReviews.reduce((sum, r) => sum + r.data.rating, 0) / recentReviews.length
                : 0;

            return {
                activities: limitedActivities,
                count: limitedActivities.length,
                summary: {
                    reviews: reviewCount,
                    requests: requestCount,
                    messages: messageCount,
                    payments: paymentCount,
                    unreadMessages: unreadMessageCount,
                    averageRecentRating: parseFloat(avgRecentRating.toFixed(2))
                },
                breakdown: {
                    byType: {
                        review: reviewCount,
                        request: requestCount,
                        message: messageCount,
                        payment: paymentCount
                    }
                },
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting recent activity', { providerID, limit, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async getDashboardData(providerID) {
        try {
            analyticsLogger.debug('Getting real-time dashboard data', { providerID });

            // Fetch all data in parallel for efficiency
            const [
                todayMetrics,
                queueStatus,
                thresholdAlerts,
                recentActivity
            ] = await Promise.all([
                this.getTodayMetrics(providerID),
                this.getQueueStatus(providerID),
                this.checkThresholds(providerID),
                this.getRecentActivity(providerID, 10)
            ]);

            return {
                todayMetrics,
                queueStatus,
                thresholdAlerts,
                recentActivity,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error getting real-time dashboard', { providerID, error: error.message });
            throw error;
        }
    }
}

module.exports = RealTimeAnalytics;

