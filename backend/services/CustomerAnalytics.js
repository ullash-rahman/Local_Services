const pool = require('../config/database');
const { DatabaseError, ValidationError, mapDatabaseError } = require('../utils/errors');
const { analyticsLogger } = require('../utils/logger');

// Valid time periods for analytics queries
const VALID_PERIODS = ['7days', '30days', '6months', '1year', 'all'];

class CustomerAnalytics {
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

    static async getUniqueCustomerCount(providerID, period = '30days') {
        try {
            this.validatePeriod(period);
            analyticsLogger.debug('Getting unique customer count', { providerID, period });

            const { interval, days } = this.parsePeriod(period);
            
            let dateCondition = '';
            let previousDateCondition = '';
            
            if (interval) {
                dateCondition = `AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL ${interval})`;
                previousDateCondition = `AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL ${days * 2} DAY) AND sr.createdAt < DATE_SUB(NOW(), INTERVAL ${interval})`;
            }

            // Current period unique customers
            const currentQuery = `
                SELECT 
                    COUNT(DISTINCT sr.customerID) as uniqueCustomers,
                    COUNT(*) as totalRequests
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND sr.status = 'Completed'
                    ${dateCondition}
            `;

            const [currentRows] = await pool.execute(currentQuery, [providerID]);
            const uniqueCustomers = parseInt(currentRows[0].uniqueCustomers, 10) || 0;
            const totalRequests = parseInt(currentRows[0].totalRequests, 10) || 0;

            // Previous period for comparison
            let previousUniqueCustomers = null;
            let percentageChange = null;

            if (interval) {
                const previousQuery = `
                    SELECT COUNT(DISTINCT sr.customerID) as uniqueCustomers
                    FROM ServiceRequest sr
                    WHERE sr.providerID = ?
                        AND sr.status = 'Completed'
                        ${previousDateCondition}
                `;

                const [previousRows] = await pool.execute(previousQuery, [providerID]);
                previousUniqueCustomers = parseInt(previousRows[0].uniqueCustomers, 10) || 0;

                if (previousUniqueCustomers > 0) {
                    percentageChange = ((uniqueCustomers - previousUniqueCustomers) / previousUniqueCustomers) * 100;
                } else if (uniqueCustomers > 0) {
                    percentageChange = 100;
                } else {
                    percentageChange = 0;
                }
            }

            return {
                period,
                uniqueCustomers,
                totalRequests,
                averageRequestsPerCustomer: uniqueCustomers > 0 
                    ? parseFloat((totalRequests / uniqueCustomers).toFixed(2))
                    : 0,
                previousPeriod: previousUniqueCustomers !== null ? {
                    uniqueCustomers: previousUniqueCustomers
                } : null,
                percentageChange: percentageChange !== null ? parseFloat(percentageChange.toFixed(2)) : null,
                trend: percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'stable'
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting unique customer count', { providerID, period, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getRetentionRate(providerID) {
        try {
            analyticsLogger.debug('Getting retention rate', { providerID });

            // Get all customers and their request counts
            const query = `
                SELECT 
                    sr.customerID,
                    COUNT(*) as requestCount,
                    MIN(sr.createdAt) as firstRequest,
                    MAX(sr.createdAt) as lastRequest
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND sr.status = 'Completed'
                GROUP BY sr.customerID
            `;

            const [rows] = await pool.execute(query, [providerID]);

            const totalCustomers = rows.length;
            const repeatCustomers = rows.filter(row => parseInt(row.requestCount, 10) > 1).length;
            const oneTimeCustomers = totalCustomers - repeatCustomers;

            // Retention rate = repeat customers / total customers
            const retentionRate = totalCustomers > 0 
                ? (repeatCustomers / totalCustomers) * 100 
                : 0;

            // Calculate average requests per repeat customer
            const repeatCustomerRequests = rows
                .filter(row => parseInt(row.requestCount, 10) > 1)
                .reduce((sum, row) => sum + parseInt(row.requestCount, 10), 0);
            const avgRequestsPerRepeatCustomer = repeatCustomers > 0 
                ? repeatCustomerRequests / repeatCustomers 
                : 0;

            // Calculate customer tenure (average time between first and last request for repeat customers)
            let avgTenureDays = 0;
            const repeatCustomerData = rows.filter(row => parseInt(row.requestCount, 10) > 1);
            if (repeatCustomerData.length > 0) {
                const totalTenure = repeatCustomerData.reduce((sum, row) => {
                    const firstDate = new Date(row.firstRequest);
                    const lastDate = new Date(row.lastRequest);
                    const tenureDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
                    return sum + tenureDays;
                }, 0);
                avgTenureDays = totalTenure / repeatCustomerData.length;
            }

            return {
                totalCustomers,
                repeatCustomers,
                oneTimeCustomers,
                retentionRate: parseFloat(retentionRate.toFixed(2)),
                repeatCustomerPercentage: parseFloat(retentionRate.toFixed(2)),
                oneTimeCustomerPercentage: parseFloat((100 - retentionRate).toFixed(2)),
                averageRequestsPerRepeatCustomer: parseFloat(avgRequestsPerRepeatCustomer.toFixed(2)),
                averageCustomerTenureDays: parseFloat(avgTenureDays.toFixed(1)),
                breakdown: {
                    repeat: {
                        count: repeatCustomers,
                        percentage: parseFloat(retentionRate.toFixed(2))
                    },
                    oneTime: {
                        count: oneTimeCustomers,
                        percentage: parseFloat((100 - retentionRate).toFixed(2))
                    }
                }
            };
        } catch (error) {
            analyticsLogger.error('Error getting retention rate', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async getGeographicDistribution(providerID) {
        try {
            analyticsLogger.debug('Getting geographic distribution', { providerID });

            // Get customer distribution - using phone area codes as proxy for location
            // In production, this would use actual address/location data
            const query = `
                SELECT 
                    SUBSTRING(u.phone, 1, 3) as areaCode,
                    COUNT(DISTINCT sr.customerID) as customerCount,
                    COUNT(*) as requestCount
                FROM ServiceRequest sr
                JOIN USER u ON sr.customerID = u.userID
                WHERE sr.providerID = ?
                    AND sr.status = 'Completed'
                    AND u.phone IS NOT NULL
                    AND LENGTH(u.phone) >= 3
                GROUP BY SUBSTRING(u.phone, 1, 3)
                ORDER BY customerCount DESC
            `;

            const [rows] = await pool.execute(query, [providerID]);

            // Calculate totals
            const totalCustomers = rows.reduce((sum, row) => sum + parseInt(row.customerCount, 10), 0);
            const totalRequests = rows.reduce((sum, row) => sum + parseInt(row.requestCount, 10), 0);

            const regions = rows.map(row => ({
                region: row.areaCode || 'Unknown',
                customerCount: parseInt(row.customerCount, 10),
                requestCount: parseInt(row.requestCount, 10),
                customerPercentage: totalCustomers > 0 
                    ? parseFloat(((parseInt(row.customerCount, 10) / totalCustomers) * 100).toFixed(2))
                    : 0,
                requestPercentage: totalRequests > 0 
                    ? parseFloat(((parseInt(row.requestCount, 10) / totalRequests) * 100).toFixed(2))
                    : 0
            }));

            // Get top regions
            const topRegions = regions.slice(0, 5);

            return {
                totalCustomers,
                totalRequests,
                regionCount: regions.length,
                regions,
                topRegions,
                summary: {
                    mostPopularRegion: topRegions.length > 0 ? topRegions[0] : null,
                    regionConcentration: topRegions.length > 0 
                        ? parseFloat(topRegions.reduce((sum, r) => sum + r.customerPercentage, 0).toFixed(2))
                        : 0
                }
            };
        } catch (error) {
            analyticsLogger.error('Error getting geographic distribution', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getPeakServiceTimes(providerID) {
        try {
            analyticsLogger.debug('Getting peak service times', { providerID });

            // Get request distribution by hour of day
            const hourlyQuery = `
                SELECT 
                    HOUR(sr.createdAt) as hour,
                    COUNT(*) as requestCount
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND sr.status = 'Completed'
                GROUP BY HOUR(sr.createdAt)
                ORDER BY hour ASC
            `;

            // Get request distribution by day of week
            const dailyQuery = `
                SELECT 
                    DAYOFWEEK(sr.createdAt) as dayOfWeek,
                    DAYNAME(sr.createdAt) as dayName,
                    COUNT(*) as requestCount
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND sr.status = 'Completed'
                GROUP BY DAYOFWEEK(sr.createdAt), DAYNAME(sr.createdAt)
                ORDER BY dayOfWeek ASC
            `;

            const [[hourlyRows], [dailyRows]] = await Promise.all([
                pool.execute(hourlyQuery, [providerID]),
                pool.execute(dailyQuery, [providerID])
            ]);

            // Process hourly data
            const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
                hour: i,
                label: `${i.toString().padStart(2, '0')}:00`,
                requestCount: 0
            }));

            hourlyRows.forEach(row => {
                const hour = parseInt(row.hour, 10);
                hourlyDistribution[hour].requestCount = parseInt(row.requestCount, 10);
            });

            // Find peak hours (top 3)
            const sortedHours = [...hourlyDistribution].sort((a, b) => b.requestCount - a.requestCount);
            const peakHours = sortedHours.slice(0, 3).filter(h => h.requestCount > 0);

            // Process daily data
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dailyDistribution = dayNames.map((name, index) => ({
                dayOfWeek: index + 1,
                dayName: name,
                requestCount: 0
            }));

            dailyRows.forEach(row => {
                const dayIndex = parseInt(row.dayOfWeek, 10) - 1;
                dailyDistribution[dayIndex].requestCount = parseInt(row.requestCount, 10);
            });

            // Find peak days (top 3)
            const sortedDays = [...dailyDistribution].sort((a, b) => b.requestCount - a.requestCount);
            const peakDays = sortedDays.slice(0, 3).filter(d => d.requestCount > 0);

            // Calculate totals
            const totalRequests = hourlyDistribution.reduce((sum, h) => sum + h.requestCount, 0);

            // Add percentages
            hourlyDistribution.forEach(h => {
                h.percentage = totalRequests > 0 
                    ? parseFloat(((h.requestCount / totalRequests) * 100).toFixed(2))
                    : 0;
            });

            dailyDistribution.forEach(d => {
                d.percentage = totalRequests > 0 
                    ? parseFloat(((d.requestCount / totalRequests) * 100).toFixed(2))
                    : 0;
            });

            // Categorize time periods
            const morningRequests = hourlyDistribution.slice(6, 12).reduce((sum, h) => sum + h.requestCount, 0);
            const afternoonRequests = hourlyDistribution.slice(12, 18).reduce((sum, h) => sum + h.requestCount, 0);
            const eveningRequests = hourlyDistribution.slice(18, 22).reduce((sum, h) => sum + h.requestCount, 0);
            const nightRequests = totalRequests - morningRequests - afternoonRequests - eveningRequests;

            return {
                totalRequests,
                hourlyDistribution,
                dailyDistribution,
                peakHours: peakHours.map(h => ({
                    hour: h.hour,
                    label: h.label,
                    requestCount: h.requestCount,
                    percentage: h.percentage
                })),
                peakDays: peakDays.map(d => ({
                    dayName: d.dayName,
                    requestCount: d.requestCount,
                    percentage: d.percentage
                })),
                timePeriodBreakdown: {
                    morning: {
                        label: '6AM - 12PM',
                        requestCount: morningRequests,
                        percentage: totalRequests > 0 ? parseFloat(((morningRequests / totalRequests) * 100).toFixed(2)) : 0
                    },
                    afternoon: {
                        label: '12PM - 6PM',
                        requestCount: afternoonRequests,
                        percentage: totalRequests > 0 ? parseFloat(((afternoonRequests / totalRequests) * 100).toFixed(2)) : 0
                    },
                    evening: {
                        label: '6PM - 10PM',
                        requestCount: eveningRequests,
                        percentage: totalRequests > 0 ? parseFloat(((eveningRequests / totalRequests) * 100).toFixed(2)) : 0
                    },
                    night: {
                        label: '10PM - 6AM',
                        requestCount: nightRequests,
                        percentage: totalRequests > 0 ? parseFloat(((nightRequests / totalRequests) * 100).toFixed(2)) : 0
                    }
                },
                summary: {
                    busiestHour: peakHours.length > 0 ? peakHours[0] : null,
                    busiestDay: peakDays.length > 0 ? peakDays[0] : null,
                    busiestTimePeriod: [
                        { name: 'morning', count: morningRequests },
                        { name: 'afternoon', count: afternoonRequests },
                        { name: 'evening', count: eveningRequests },
                        { name: 'night', count: nightRequests }
                    ].sort((a, b) => b.count - a.count)[0]?.name || null
                }
            };
        } catch (error) {
            analyticsLogger.error('Error getting peak service times', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getAcquisitionTrends(providerID, period = '30days') {
        try {
            this.validatePeriod(period);
            analyticsLogger.debug('Getting acquisition trends', { providerID, period });

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
            } else {
                dateFormat = '%Y-%m';
                groupBy = 'DATE_FORMAT(sr.createdAt, "%Y-%m")';
            }

            let dateCondition = '';
            if (interval) {
                dateCondition = `AND sr.createdAt >= DATE_SUB(NOW(), INTERVAL ${interval})`;
            }

            // Get all customers with their first request date for this provider
            const firstRequestQuery = `
                SELECT 
                    sr.customerID,
                    MIN(sr.createdAt) as firstRequestDate
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND sr.status = 'Completed'
                GROUP BY sr.customerID
            `;

            const [firstRequestRows] = await pool.execute(firstRequestQuery, [providerID]);
            
            // Create a map of customer first request dates
            const customerFirstRequest = new Map();
            firstRequestRows.forEach(row => {
                customerFirstRequest.set(row.customerID, new Date(row.firstRequestDate));
            });

            // Get requests within the period
            const requestsQuery = `
                SELECT 
                    DATE_FORMAT(sr.createdAt, '${dateFormat}') as periodLabel,
                    sr.customerID,
                    sr.createdAt
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                    AND sr.status = 'Completed'
                    ${dateCondition}
                ORDER BY sr.createdAt ASC
            `;

            const [requestRows] = await pool.execute(requestsQuery, [providerID]);

            // Group by period and categorize customers
            const periodData = new Map();
            
            requestRows.forEach(row => {
                const periodLabel = row.periodLabel;
                const customerID = row.customerID;
                const requestDate = new Date(row.createdAt);
                const firstDate = customerFirstRequest.get(customerID);
                
                if (!periodData.has(periodLabel)) {
                    periodData.set(periodLabel, {
                        label: periodLabel,
                        newCustomers: new Set(),
                        returningCustomers: new Set(),
                        totalRequests: 0
                    });
                }
                
                const data = periodData.get(periodLabel);
                data.totalRequests++;
                
                // Customer is "new" if their first request is within this period
                // Using same day comparison for simplicity
                const isSameDay = firstDate.toDateString() === requestDate.toDateString();
                const isSameMonth = firstDate.getFullYear() === requestDate.getFullYear() && 
                                   firstDate.getMonth() === requestDate.getMonth();
                
                const isNew = period === '7days' || period === '30days' ? isSameDay : isSameMonth;
                
                if (isNew) {
                    data.newCustomers.add(customerID);
                } else {
                    data.returningCustomers.add(customerID);
                }
            });

            // Convert to array and calculate metrics
            const dataPoints = Array.from(periodData.values()).map(data => {
                const newCount = data.newCustomers.size;
                const returningCount = data.returningCustomers.size;
                const totalCustomers = newCount + returningCount;
                
                return {
                    label: data.label,
                    newCustomers: newCount,
                    returningCustomers: returningCount,
                    totalCustomers,
                    totalRequests: data.totalRequests,
                    newCustomerPercentage: totalCustomers > 0 
                        ? parseFloat(((newCount / totalCustomers) * 100).toFixed(2))
                        : 0,
                    returningCustomerPercentage: totalCustomers > 0 
                        ? parseFloat(((returningCount / totalCustomers) * 100).toFixed(2))
                        : 0
                };
            });

            // Sort by label
            dataPoints.sort((a, b) => a.label.localeCompare(b.label));

            // Calculate summary statistics
            const totalNewCustomers = dataPoints.reduce((sum, d) => sum + d.newCustomers, 0);
            const totalReturningCustomers = dataPoints.reduce((sum, d) => sum + d.returningCustomers, 0);
            const totalCustomers = totalNewCustomers + totalReturningCustomers;
            const totalRequests = dataPoints.reduce((sum, d) => sum + d.totalRequests, 0);

            return {
                period,
                dataPoints,
                summary: {
                    totalNewCustomers,
                    totalReturningCustomers,
                    totalUniqueCustomers: totalCustomers,
                    totalRequests,
                    newCustomerPercentage: totalCustomers > 0 
                        ? parseFloat(((totalNewCustomers / totalCustomers) * 100).toFixed(2))
                        : 0,
                    returningCustomerPercentage: totalCustomers > 0 
                        ? parseFloat(((totalReturningCustomers / totalCustomers) * 100).toFixed(2))
                        : 0,
                    averageNewCustomersPerPeriod: dataPoints.length > 0 
                        ? parseFloat((totalNewCustomers / dataPoints.length).toFixed(2))
                        : 0,
                    dataPointCount: dataPoints.length
                }
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting acquisition trends', { providerID, period, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getCustomerLifetimeValue(providerID) {
        try {
            analyticsLogger.debug('Getting customer lifetime value', { providerID });

            // Get revenue and request data per customer
            const query = `
                SELECT 
                    sr.customerID,
                    u.name as customerName,
                    COUNT(DISTINCT sr.requestID) as totalRequests,
                    COALESCE(SUM(p.amount), 0) as totalRevenue,
                    MIN(sr.createdAt) as firstRequest,
                    MAX(sr.createdAt) as lastRequest,
                    DATEDIFF(MAX(sr.createdAt), MIN(sr.createdAt)) as tenureDays
                FROM ServiceRequest sr
                JOIN USER u ON sr.customerID = u.userID
                LEFT JOIN Payment p ON sr.requestID = p.requestID AND p.status = 'Completed'
                WHERE sr.providerID = ?
                    AND sr.status = 'Completed'
                GROUP BY sr.customerID, u.name
            `;

            const [rows] = await pool.execute(query, [providerID]);

            if (rows.length === 0) {
                return {
                    totalCustomers: 0,
                    averageLifetimeValue: 0,
                    formattedAverageLTV: '0.00',
                    totalRevenue: 0,
                    formattedTotalRevenue: '0.00',
                    averageRequestsPerCustomer: 0,
                    averageTenureDays: 0,
                    customerSegments: {
                        highValue: { count: 0, percentage: 0 },
                        mediumValue: { count: 0, percentage: 0 },
                        lowValue: { count: 0, percentage: 0 }
                    },
                    topCustomers: [],
                    distribution: []
                };
            }

            // Calculate metrics
            const customers = rows.map(row => ({
                customerID: row.customerID,
                customerName: row.customerName,
                totalRequests: parseInt(row.totalRequests, 10),
                totalRevenue: parseFloat(row.totalRevenue) || 0,
                tenureDays: parseInt(row.tenureDays, 10) || 0,
                firstRequest: row.firstRequest,
                lastRequest: row.lastRequest
            }));

            const totalCustomers = customers.length;
            const totalRevenue = customers.reduce((sum, c) => sum + c.totalRevenue, 0);
            const totalRequests = customers.reduce((sum, c) => sum + c.totalRequests, 0);
            const totalTenure = customers.reduce((sum, c) => sum + c.tenureDays, 0);

            // Average lifetime value = total revenue / total customers
            const averageLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
            const averageRequestsPerCustomer = totalCustomers > 0 ? totalRequests / totalCustomers : 0;
            const averageTenureDays = totalCustomers > 0 ? totalTenure / totalCustomers : 0;

            // Segment customers by value
            const sortedByRevenue = [...customers].sort((a, b) => b.totalRevenue - a.totalRevenue);
            const highValueThreshold = averageLifetimeValue * 1.5;
            const lowValueThreshold = averageLifetimeValue * 0.5;

            const highValueCustomers = customers.filter(c => c.totalRevenue >= highValueThreshold);
            const lowValueCustomers = customers.filter(c => c.totalRevenue < lowValueThreshold);
            const mediumValueCustomers = customers.filter(c => 
                c.totalRevenue >= lowValueThreshold && c.totalRevenue < highValueThreshold
            );

            // Top 5 customers by revenue
            const topCustomers = sortedByRevenue.slice(0, 5).map(c => ({
                customerID: c.customerID,
                customerName: c.customerName,
                totalRevenue: c.totalRevenue,
                formattedRevenue: c.totalRevenue.toFixed(2),
                totalRequests: c.totalRequests,
                tenureDays: c.tenureDays
            }));

            // Create value distribution buckets
            const maxRevenue = Math.max(...customers.map(c => c.totalRevenue));
            const bucketSize = maxRevenue > 0 ? maxRevenue / 5 : 1;
            const distribution = Array.from({ length: 5 }, (_, i) => {
                const min = i * bucketSize;
                const max = (i + 1) * bucketSize;
                const count = customers.filter(c => c.totalRevenue >= min && c.totalRevenue < max).length;
                return {
                    range: `$${min.toFixed(0)} - $${max.toFixed(0)}`,
                    min,
                    max,
                    count,
                    percentage: totalCustomers > 0 ? parseFloat(((count / totalCustomers) * 100).toFixed(2)) : 0
                };
            });

            return {
                totalCustomers,
                averageLifetimeValue: parseFloat(averageLifetimeValue.toFixed(2)),
                formattedAverageLTV: averageLifetimeValue.toFixed(2),
                totalRevenue,
                formattedTotalRevenue: totalRevenue.toFixed(2),
                averageRequestsPerCustomer: parseFloat(averageRequestsPerCustomer.toFixed(2)),
                averageTenureDays: parseFloat(averageTenureDays.toFixed(1)),
                averageRevenuePerRequest: totalRequests > 0 
                    ? parseFloat((totalRevenue / totalRequests).toFixed(2))
                    : 0,
                customerSegments: {
                    highValue: {
                        count: highValueCustomers.length,
                        percentage: parseFloat(((highValueCustomers.length / totalCustomers) * 100).toFixed(2)),
                        threshold: parseFloat(highValueThreshold.toFixed(2))
                    },
                    mediumValue: {
                        count: mediumValueCustomers.length,
                        percentage: parseFloat(((mediumValueCustomers.length / totalCustomers) * 100).toFixed(2))
                    },
                    lowValue: {
                        count: lowValueCustomers.length,
                        percentage: parseFloat(((lowValueCustomers.length / totalCustomers) * 100).toFixed(2)),
                        threshold: parseFloat(lowValueThreshold.toFixed(2))
                    }
                },
                topCustomers,
                distribution
            };
        } catch (error) {
            analyticsLogger.error('Error getting customer lifetime value', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async getDashboardData(providerID, period = '30days') {
        try {
            analyticsLogger.debug('Getting customer dashboard data', { providerID, period });

            // Fetch all data in parallel for efficiency
            const [
                uniqueCustomerCount,
                retentionRate,
                geographicDistribution,
                peakServiceTimes,
                acquisitionTrends,
                customerLifetimeValue
            ] = await Promise.all([
                this.getUniqueCustomerCount(providerID, period),
                this.getRetentionRate(providerID),
                this.getGeographicDistribution(providerID),
                this.getPeakServiceTimes(providerID),
                this.getAcquisitionTrends(providerID, period),
                this.getCustomerLifetimeValue(providerID)
            ]);

            return {
                period,
                uniqueCustomerCount,
                retentionRate,
                geographicDistribution,
                peakServiceTimes,
                acquisitionTrends,
                customerLifetimeValue,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error getting customer dashboard', { providerID, period, error: error.message });
            throw error;
        }
    }
}

module.exports = CustomerAnalytics;
