const pool = require('../config/database');
const { DatabaseError, ValidationError, mapDatabaseError } = require('../utils/errors');
const { analyticsLogger } = require('../utils/logger');

// Metric types for benchmarking
const METRIC_TYPES = {
    COMPLETION_RATE: 'completion_rate',
    RESPONSE_TIME: 'response_time',
    CUSTOMER_SATISFACTION: 'customer_satisfaction',
    REVENUE: 'revenue',
    CANCELLATION_RATE: 'cancellation_rate',
    RETENTION_RATE: 'retention_rate'
};

class BenchmarkingService {
    static async getPlatformAverages() {
        try {
            analyticsLogger.debug('Getting platform averages');

            // Get completion rate average across all providers
            const completionRateQuery = `
                SELECT 
                    AVG(completion_rate) as avgCompletionRate,
                    COUNT(DISTINCT providerID) as providerCount
                FROM (
                    SELECT 
                        sr.providerID,
                        (COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) * 100.0 / 
                         NULLIF(COUNT(CASE WHEN sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') THEN 1 END), 0)) as completion_rate
                    FROM ServiceRequest sr
                    WHERE sr.providerID IS NOT NULL
                    GROUP BY sr.providerID
                    HAVING COUNT(*) >= 5
                ) as provider_rates
            `;

            // Get average response time across all providers
            const responseTimeQuery = `
                SELECT 
                    AVG(avg_response) as avgResponseTime
                FROM (
                    SELECT 
                        sr.providerID,
                        AVG(TIMESTAMPDIFF(MINUTE, sr.createdAt, sr.updatedAt)) as avg_response
                    FROM ServiceRequest sr
                    WHERE sr.providerID IS NOT NULL
                        AND sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled')
                    GROUP BY sr.providerID
                    HAVING COUNT(*) >= 5
                ) as provider_times
            `;

            // Get average customer satisfaction (rating) across all providers
            const satisfactionQuery = `
                SELECT 
                    AVG(avg_rating) as avgSatisfaction
                FROM (
                    SELECT 
                        sr.providerID,
                        AVG(r.rating) as avg_rating
                    FROM ServiceRequest sr
                    JOIN Review r ON sr.requestID = r.requestID
                    WHERE sr.providerID IS NOT NULL
                    GROUP BY sr.providerID
                    HAVING COUNT(*) >= 3
                ) as provider_ratings
            `;

            // Get average revenue per provider
            const revenueQuery = `
                SELECT 
                    AVG(total_revenue) as avgRevenue
                FROM (
                    SELECT 
                        sr.providerID,
                        SUM(p.amount) as total_revenue
                    FROM ServiceRequest sr
                    JOIN Payment p ON sr.requestID = p.requestID
                    WHERE sr.providerID IS NOT NULL
                        AND p.status = 'Completed'
                    GROUP BY sr.providerID
                    HAVING COUNT(*) >= 5
                ) as provider_revenue
            `;

            // Get average cancellation rate
            const cancellationQuery = `
                SELECT 
                    AVG(cancellation_rate) as avgCancellationRate
                FROM (
                    SELECT 
                        sr.providerID,
                        (COUNT(CASE WHEN sr.status = 'Cancelled' THEN 1 END) * 100.0 / 
                         NULLIF(COUNT(*), 0)) as cancellation_rate
                    FROM ServiceRequest sr
                    WHERE sr.providerID IS NOT NULL
                    GROUP BY sr.providerID
                    HAVING COUNT(*) >= 5
                ) as provider_cancellations
            `;

            const [
                [completionRows],
                [responseRows],
                [satisfactionRows],
                [revenueRows],
                [cancellationRows]
            ] = await Promise.all([
                pool.execute(completionRateQuery),
                pool.execute(responseTimeQuery),
                pool.execute(satisfactionQuery),
                pool.execute(revenueQuery),
                pool.execute(cancellationQuery)
            ]);

            const avgCompletionRate = parseFloat(completionRows[0]?.avgCompletionRate) || 0;
            const providerCount = parseInt(completionRows[0]?.providerCount, 10) || 0;
            const avgResponseTime = parseFloat(responseRows[0]?.avgResponseTime) || 0;
            const avgSatisfaction = parseFloat(satisfactionRows[0]?.avgSatisfaction) || 0;
            const avgRevenue = parseFloat(revenueRows[0]?.avgRevenue) || 0;
            const avgCancellationRate = parseFloat(cancellationRows[0]?.avgCancellationRate) || 0;

            return {
                metrics: {
                    completionRate: {
                        value: parseFloat(avgCompletionRate.toFixed(2)),
                        unit: 'percentage',
                        label: 'Completion Rate'
                    },
                    responseTime: {
                        value: parseFloat(avgResponseTime.toFixed(2)),
                        unit: 'minutes',
                        label: 'Average Response Time',
                        formatted: avgResponseTime < 60 
                            ? `${avgResponseTime.toFixed(0)} min`
                            : `${(avgResponseTime / 60).toFixed(1)} hrs`
                    },
                    customerSatisfaction: {
                        value: parseFloat(avgSatisfaction.toFixed(2)),
                        unit: 'rating',
                        label: 'Customer Satisfaction',
                        maxValue: 5
                    },
                    averageRevenue: {
                        value: parseFloat(avgRevenue.toFixed(2)),
                        unit: 'currency',
                        label: 'Average Revenue',
                        formatted: `$${avgRevenue.toFixed(2)}`
                    },
                    cancellationRate: {
                        value: parseFloat(avgCancellationRate.toFixed(2)),
                        unit: 'percentage',
                        label: 'Cancellation Rate'
                    }
                },
                sampleSize: providerCount,
                calculatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error getting platform averages', { error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getPercentileRankings(providerID) {
        try {
            analyticsLogger.debug('Getting percentile rankings', { providerID });

            // Get provider's completion rate and rank
            const completionRankQuery = `
                SELECT 
                    provider_rate,
                    total_providers,
                    providers_below,
                    ROUND((providers_below * 100.0 / total_providers), 2) as percentile
                FROM (
                    SELECT 
                        (SELECT 
                            (COUNT(CASE WHEN sr2.status = 'Completed' THEN 1 END) * 100.0 / 
                             NULLIF(COUNT(CASE WHEN sr2.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') THEN 1 END), 0))
                         FROM ServiceRequest sr2 WHERE sr2.providerID = ?) as provider_rate,
                        COUNT(DISTINCT sr.providerID) as total_providers,
                        (SELECT COUNT(DISTINCT sr3.providerID)
                         FROM ServiceRequest sr3
                         WHERE sr3.providerID != ?
                         GROUP BY sr3.providerID
                         HAVING (COUNT(CASE WHEN sr3.status = 'Completed' THEN 1 END) * 100.0 / 
                                 NULLIF(COUNT(CASE WHEN sr3.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') THEN 1 END), 0)) <=
                                (SELECT (COUNT(CASE WHEN sr4.status = 'Completed' THEN 1 END) * 100.0 / 
                                         NULLIF(COUNT(CASE WHEN sr4.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') THEN 1 END), 0))
                                 FROM ServiceRequest sr4 WHERE sr4.providerID = ?)
                        ) as providers_below
                    FROM ServiceRequest sr
                    WHERE sr.providerID IS NOT NULL
                ) as rankings
            `;

            // Simplified approach: Get all provider metrics and calculate percentiles
            const allProvidersQuery = `
                SELECT 
                    sr.providerID,
                    (COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) * 100.0 / 
                     NULLIF(COUNT(CASE WHEN sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') THEN 1 END), 0)) as completion_rate,
                    AVG(CASE WHEN sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') 
                        THEN TIMESTAMPDIFF(MINUTE, sr.createdAt, sr.updatedAt) END) as avg_response_time,
                    (COUNT(CASE WHEN sr.status = 'Cancelled' THEN 1 END) * 100.0 / 
                     NULLIF(COUNT(*), 0)) as cancellation_rate
                FROM ServiceRequest sr
                WHERE sr.providerID IS NOT NULL
                GROUP BY sr.providerID
                HAVING COUNT(*) >= 3
            `;

            // Get provider's rating
            const ratingQuery = `
                SELECT 
                    sr.providerID,
                    AVG(r.rating) as avg_rating
                FROM ServiceRequest sr
                JOIN Review r ON sr.requestID = r.requestID
                WHERE sr.providerID IS NOT NULL
                GROUP BY sr.providerID
                HAVING COUNT(*) >= 1
            `;

            const [[allProviders], [ratingData]] = await Promise.all([
                pool.execute(allProvidersQuery),
                pool.execute(ratingQuery)
            ]);

            // Create rating map
            const ratingMap = new Map();
            ratingData.forEach(row => {
                ratingMap.set(row.providerID, parseFloat(row.avg_rating) || 0);
            });

            // Find provider's metrics
            const providerMetrics = allProviders.find(p => p.providerID === providerID);
            const providerRating = ratingMap.get(providerID) || 0;

            if (!providerMetrics) {
                return {
                    providerID,
                    rankings: {
                        completionRate: { value: 0, percentile: 0, rank: 'N/A' },
                        responseTime: { value: 0, percentile: 0, rank: 'N/A' },
                        customerSatisfaction: { value: 0, percentile: 0, rank: 'N/A' },
                        cancellationRate: { value: 0, percentile: 0, rank: 'N/A' }
                    },
                    totalProviders: allProviders.length,
                    message: 'Insufficient data for ranking'
                };
            }

            // Calculate percentiles
            const calculatePercentile = (providers, providerValue, metric, lowerIsBetter = false) => {
                const values = providers.map(p => parseFloat(p[metric]) || 0).filter(v => !isNaN(v));
                if (values.length === 0) return 0;
                
                const belowCount = lowerIsBetter
                    ? values.filter(v => v >= providerValue).length
                    : values.filter(v => v <= providerValue).length;
                
                return Math.round((belowCount / values.length) * 100);
            };

            const completionRate = parseFloat(providerMetrics.completion_rate) || 0;
            const responseTime = parseFloat(providerMetrics.avg_response_time) || 0;
            const cancellationRate = parseFloat(providerMetrics.cancellation_rate) || 0;

            // Calculate percentiles for each metric
            const completionPercentile = calculatePercentile(allProviders, completionRate, 'completion_rate');
            const responsePercentile = calculatePercentile(allProviders, responseTime, 'avg_response_time', true);
            const cancellationPercentile = calculatePercentile(allProviders, cancellationRate, 'cancellation_rate', true);

            // Calculate rating percentile
            const ratingValues = Array.from(ratingMap.values());
            const ratingPercentile = ratingValues.length > 0
                ? Math.round((ratingValues.filter(v => v <= providerRating).length / ratingValues.length) * 100)
                : 0;

            // Determine rank labels
            const getRankLabel = (percentile) => {
                if (percentile >= 90) return 'Top 10%';
                if (percentile >= 75) return 'Top 25%';
                if (percentile >= 50) return 'Above Average';
                if (percentile >= 25) return 'Below Average';
                return 'Bottom 25%';
            };

            return {
                providerID,
                rankings: {
                    completionRate: {
                        value: parseFloat(completionRate.toFixed(2)),
                        percentile: completionPercentile,
                        rank: getRankLabel(completionPercentile),
                        unit: 'percentage'
                    },
                    responseTime: {
                        value: parseFloat(responseTime.toFixed(2)),
                        percentile: responsePercentile,
                        rank: getRankLabel(responsePercentile),
                        unit: 'minutes',
                        formatted: responseTime < 60 
                            ? `${responseTime.toFixed(0)} min`
                            : `${(responseTime / 60).toFixed(1)} hrs`
                    },
                    customerSatisfaction: {
                        value: parseFloat(providerRating.toFixed(2)),
                        percentile: ratingPercentile,
                        rank: getRankLabel(ratingPercentile),
                        unit: 'rating',
                        maxValue: 5
                    },
                    cancellationRate: {
                        value: parseFloat(cancellationRate.toFixed(2)),
                        percentile: cancellationPercentile,
                        rank: getRankLabel(cancellationPercentile),
                        unit: 'percentage',
                        note: 'Lower is better'
                    }
                },
                totalProviders: allProviders.length,
                calculatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error getting percentile rankings', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getYearOverYearComparison(providerID) {
        try {
            analyticsLogger.debug('Getting year-over-year comparison', { providerID });

            // Get current year metrics
            const currentYearQuery = `
                SELECT 
                    COUNT(*) as totalRequests,
                    COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) as completedRequests,
                    COUNT(CASE WHEN sr.status = 'Cancelled' THEN 1 END) as cancelledRequests,
                    COUNT(DISTINCT sr.customerID) as uniqueCustomers,
                    COALESCE(SUM(p.amount), 0) as totalRevenue
                FROM ServiceRequest sr
                LEFT JOIN Payment p ON sr.requestID = p.requestID AND p.status = 'Completed'
                WHERE sr.providerID = ?
                    AND YEAR(sr.createdAt) = YEAR(NOW())
            `;

            // Get previous year metrics
            const previousYearQuery = `
                SELECT 
                    COUNT(*) as totalRequests,
                    COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) as completedRequests,
                    COUNT(CASE WHEN sr.status = 'Cancelled' THEN 1 END) as cancelledRequests,
                    COUNT(DISTINCT sr.customerID) as uniqueCustomers,
                    COALESCE(SUM(p.amount), 0) as totalRevenue
                FROM ServiceRequest sr
                LEFT JOIN Payment p ON sr.requestID = p.requestID AND p.status = 'Completed'
                WHERE sr.providerID = ?
                    AND YEAR(sr.createdAt) = YEAR(NOW()) - 1
            `;

            // Get average rating for current year
            const currentRatingQuery = `
                SELECT AVG(r.rating) as avgRating, COUNT(*) as reviewCount
                FROM Review r
                JOIN ServiceRequest sr ON r.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND YEAR(r.createdAt) = YEAR(NOW())
            `;

            // Get average rating for previous year
            const previousRatingQuery = `
                SELECT AVG(r.rating) as avgRating, COUNT(*) as reviewCount
                FROM Review r
                JOIN ServiceRequest sr ON r.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND YEAR(r.createdAt) = YEAR(NOW()) - 1
            `;

            const [
                [currentYearRows],
                [previousYearRows],
                [currentRatingRows],
                [previousRatingRows]
            ] = await Promise.all([
                pool.execute(currentYearQuery, [providerID]),
                pool.execute(previousYearQuery, [providerID]),
                pool.execute(currentRatingQuery, [providerID]),
                pool.execute(previousRatingQuery, [providerID])
            ]);

            const current = currentYearRows[0];
            const previous = previousYearRows[0];
            const currentRating = currentRatingRows[0];
            const previousRating = previousRatingRows[0];

            // Calculate metrics
            const currentMetrics = {
                totalRequests: parseInt(current.totalRequests, 10) || 0,
                completedRequests: parseInt(current.completedRequests, 10) || 0,
                cancelledRequests: parseInt(current.cancelledRequests, 10) || 0,
                uniqueCustomers: parseInt(current.uniqueCustomers, 10) || 0,
                totalRevenue: parseFloat(current.totalRevenue) || 0,
                avgRating: parseFloat(currentRating.avgRating) || 0,
                reviewCount: parseInt(currentRating.reviewCount, 10) || 0
            };

            const previousMetrics = {
                totalRequests: parseInt(previous.totalRequests, 10) || 0,
                completedRequests: parseInt(previous.completedRequests, 10) || 0,
                cancelledRequests: parseInt(previous.cancelledRequests, 10) || 0,
                uniqueCustomers: parseInt(previous.uniqueCustomers, 10) || 0,
                totalRevenue: parseFloat(previous.totalRevenue) || 0,
                avgRating: parseFloat(previousRating.avgRating) || 0,
                reviewCount: parseInt(previousRating.reviewCount, 10) || 0
            };

            // Calculate percentage changes
            const calculateChange = (current, previous) => {
                if (previous === 0) return current > 0 ? 100 : 0;
                return ((current - previous) / previous) * 100;
            };

            const changes = {
                totalRequests: parseFloat(calculateChange(currentMetrics.totalRequests, previousMetrics.totalRequests).toFixed(2)),
                completedRequests: parseFloat(calculateChange(currentMetrics.completedRequests, previousMetrics.completedRequests).toFixed(2)),
                uniqueCustomers: parseFloat(calculateChange(currentMetrics.uniqueCustomers, previousMetrics.uniqueCustomers).toFixed(2)),
                totalRevenue: parseFloat(calculateChange(currentMetrics.totalRevenue, previousMetrics.totalRevenue).toFixed(2)),
                avgRating: parseFloat((currentMetrics.avgRating - previousMetrics.avgRating).toFixed(2))
            };

            // Calculate completion rates
            const currentCompletionRate = currentMetrics.totalRequests > 0
                ? (currentMetrics.completedRequests / currentMetrics.totalRequests) * 100
                : 0;
            const previousCompletionRate = previousMetrics.totalRequests > 0
                ? (previousMetrics.completedRequests / previousMetrics.totalRequests) * 100
                : 0;

            return {
                providerID,
                currentYear: {
                    year: new Date().getFullYear(),
                    ...currentMetrics,
                    completionRate: parseFloat(currentCompletionRate.toFixed(2)),
                    formattedRevenue: `$${currentMetrics.totalRevenue.toFixed(2)}`
                },
                previousYear: {
                    year: new Date().getFullYear() - 1,
                    ...previousMetrics,
                    completionRate: parseFloat(previousCompletionRate.toFixed(2)),
                    formattedRevenue: `$${previousMetrics.totalRevenue.toFixed(2)}`
                },
                changes: {
                    ...changes,
                    completionRate: parseFloat((currentCompletionRate - previousCompletionRate).toFixed(2))
                },
                trends: {
                    requests: changes.totalRequests > 0 ? 'up' : changes.totalRequests < 0 ? 'down' : 'stable',
                    revenue: changes.totalRevenue > 0 ? 'up' : changes.totalRevenue < 0 ? 'down' : 'stable',
                    customers: changes.uniqueCustomers > 0 ? 'up' : changes.uniqueCustomers < 0 ? 'down' : 'stable',
                    rating: changes.avgRating > 0 ? 'up' : changes.avgRating < 0 ? 'down' : 'stable'
                },
                calculatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error getting year-over-year comparison', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getSeasonalTrends(providerID) {
        try {
            analyticsLogger.debug('Getting seasonal trends', { providerID });

            // Get monthly request distribution across all years
            const monthlyQuery = `
                SELECT 
                    MONTH(sr.createdAt) as month,
                    MONTHNAME(sr.createdAt) as monthName,
                    COUNT(*) as requestCount,
                    COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) as completedCount,
                    COALESCE(SUM(p.amount), 0) as revenue
                FROM ServiceRequest sr
                LEFT JOIN Payment p ON sr.requestID = p.requestID AND p.status = 'Completed'
                WHERE sr.providerID = ?
                GROUP BY MONTH(sr.createdAt), MONTHNAME(sr.createdAt)
                ORDER BY month ASC
            `;

            // Get quarterly breakdown
            const quarterlyQuery = `
                SELECT 
                    QUARTER(sr.createdAt) as quarter,
                    COUNT(*) as requestCount,
                    COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) as completedCount,
                    COALESCE(SUM(p.amount), 0) as revenue
                FROM ServiceRequest sr
                LEFT JOIN Payment p ON sr.requestID = p.requestID AND p.status = 'Completed'
                WHERE sr.providerID = ?
                GROUP BY QUARTER(sr.createdAt)
                ORDER BY quarter ASC
            `;

            // Get day of week distribution
            const dayOfWeekQuery = `
                SELECT 
                    DAYOFWEEK(sr.createdAt) as dayOfWeek,
                    DAYNAME(sr.createdAt) as dayName,
                    COUNT(*) as requestCount
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
                GROUP BY DAYOFWEEK(sr.createdAt), DAYNAME(sr.createdAt)
                ORDER BY dayOfWeek ASC
            `;

            const [[monthlyRows], [quarterlyRows], [dayOfWeekRows]] = await Promise.all([
                pool.execute(monthlyQuery, [providerID]),
                pool.execute(quarterlyQuery, [providerID]),
                pool.execute(dayOfWeekQuery, [providerID])
            ]);

            // Process monthly data
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            const monthlyDistribution = monthNames.map((name, index) => {
                const monthData = monthlyRows.find(r => parseInt(r.month, 10) === index + 1);
                return {
                    month: index + 1,
                    monthName: name,
                    requestCount: monthData ? parseInt(monthData.requestCount, 10) : 0,
                    completedCount: monthData ? parseInt(monthData.completedCount, 10) : 0,
                    revenue: monthData ? parseFloat(monthData.revenue) : 0
                };
            });

            // Calculate total for percentages
            const totalRequests = monthlyDistribution.reduce((sum, m) => sum + m.requestCount, 0);
            monthlyDistribution.forEach(m => {
                m.percentage = totalRequests > 0 
                    ? parseFloat(((m.requestCount / totalRequests) * 100).toFixed(2))
                    : 0;
            });

            // Process quarterly data
            const quarterNames = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
            const quarterlyDistribution = quarterNames.map((name, index) => {
                const quarterData = quarterlyRows.find(r => parseInt(r.quarter, 10) === index + 1);
                return {
                    quarter: index + 1,
                    quarterName: name,
                    requestCount: quarterData ? parseInt(quarterData.requestCount, 10) : 0,
                    completedCount: quarterData ? parseInt(quarterData.completedCount, 10) : 0,
                    revenue: quarterData ? parseFloat(quarterData.revenue) : 0,
                    percentage: totalRequests > 0 && quarterData
                        ? parseFloat(((parseInt(quarterData.requestCount, 10) / totalRequests) * 100).toFixed(2))
                        : 0
                };
            });

            // Process day of week data
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayOfWeekDistribution = dayNames.map((name, index) => {
                const dayData = dayOfWeekRows.find(r => parseInt(r.dayOfWeek, 10) === index + 1);
                return {
                    dayOfWeek: index + 1,
                    dayName: name,
                    requestCount: dayData ? parseInt(dayData.requestCount, 10) : 0,
                    percentage: totalRequests > 0 && dayData
                        ? parseFloat(((parseInt(dayData.requestCount, 10) / totalRequests) * 100).toFixed(2))
                        : 0
                };
            });

            // Identify peak and low seasons
            const sortedMonths = [...monthlyDistribution].sort((a, b) => b.requestCount - a.requestCount);
            const peakMonths = sortedMonths.slice(0, 3).filter(m => m.requestCount > 0);
            const lowMonths = sortedMonths.slice(-3).filter(m => m.requestCount >= 0).reverse();

            const sortedQuarters = [...quarterlyDistribution].sort((a, b) => b.requestCount - a.requestCount);
            const peakQuarter = sortedQuarters[0];
            const lowQuarter = sortedQuarters[sortedQuarters.length - 1];

            // Identify seasonal patterns
            const seasonalPattern = this.identifySeasonalPattern(monthlyDistribution);

            return {
                providerID,
                monthlyDistribution,
                quarterlyDistribution,
                dayOfWeekDistribution,
                peakSeasons: {
                    months: peakMonths.map(m => ({ monthName: m.monthName, requestCount: m.requestCount })),
                    quarter: peakQuarter ? { quarterName: peakQuarter.quarterName, requestCount: peakQuarter.requestCount } : null
                },
                lowSeasons: {
                    months: lowMonths.map(m => ({ monthName: m.monthName, requestCount: m.requestCount })),
                    quarter: lowQuarter ? { quarterName: lowQuarter.quarterName, requestCount: lowQuarter.requestCount } : null
                },
                patterns: seasonalPattern,
                summary: {
                    totalRequests,
                    averageMonthlyRequests: parseFloat((totalRequests / 12).toFixed(2)),
                    seasonalVariation: this.calculateSeasonalVariation(monthlyDistribution)
                },
                calculatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error getting seasonal trends', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static identifySeasonalPattern(monthlyDistribution) {
        const patterns = [];
        
        // Check for summer peak (Jun-Aug)
        const summerAvg = (monthlyDistribution[5].requestCount + monthlyDistribution[6].requestCount + monthlyDistribution[7].requestCount) / 3;
        const winterAvg = (monthlyDistribution[11].requestCount + monthlyDistribution[0].requestCount + monthlyDistribution[1].requestCount) / 3;
        const overallAvg = monthlyDistribution.reduce((sum, m) => sum + m.requestCount, 0) / 12;

        if (summerAvg > overallAvg * 1.2) {
            patterns.push({ type: 'summer_peak', description: 'Higher demand during summer months (Jun-Aug)' });
        }
        if (winterAvg > overallAvg * 1.2) {
            patterns.push({ type: 'winter_peak', description: 'Higher demand during winter months (Dec-Feb)' });
        }
        if (summerAvg < overallAvg * 0.8) {
            patterns.push({ type: 'summer_low', description: 'Lower demand during summer months (Jun-Aug)' });
        }
        if (winterAvg < overallAvg * 0.8) {
            patterns.push({ type: 'winter_low', description: 'Lower demand during winter months (Dec-Feb)' });
        }

        // Check for end-of-year spike
        if (monthlyDistribution[11].requestCount > overallAvg * 1.3) {
            patterns.push({ type: 'year_end_spike', description: 'Increased demand in December' });
        }

        if (patterns.length === 0) {
            patterns.push({ type: 'stable', description: 'Relatively stable demand throughout the year' });
        }

        return patterns;
    }

    static calculateSeasonalVariation(monthlyDistribution) {
        const values = monthlyDistribution.map(m => m.requestCount);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        
        if (mean === 0) return 0;
        
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        // Coefficient of variation as percentage
        return parseFloat(((stdDev / mean) * 100).toFixed(2));
    }


    static async getImprovementSuggestions(providerID) {
        try {
            analyticsLogger.debug('Getting improvement suggestions', { providerID });

            // Get provider's current metrics
            const providerMetricsQuery = `
                SELECT 
                    (COUNT(CASE WHEN sr.status = 'Completed' THEN 1 END) * 100.0 / 
                     NULLIF(COUNT(CASE WHEN sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') THEN 1 END), 0)) as completion_rate,
                    AVG(CASE WHEN sr.status IN ('Accepted', 'In Progress', 'Completed', 'Cancelled') 
                        THEN TIMESTAMPDIFF(MINUTE, sr.createdAt, sr.updatedAt) END) as avg_response_time,
                    (COUNT(CASE WHEN sr.status = 'Cancelled' THEN 1 END) * 100.0 / 
                     NULLIF(COUNT(*), 0)) as cancellation_rate,
                    COUNT(*) as total_requests
                FROM ServiceRequest sr
                WHERE sr.providerID = ?
            `;

            // Get provider's rating
            const ratingQuery = `
                SELECT AVG(r.rating) as avg_rating, COUNT(*) as review_count
                FROM Review r
                JOIN ServiceRequest sr ON r.requestID = sr.requestID
                WHERE sr.providerID = ?
            `;

            // Get platform averages for comparison
            const platformAverages = await this.getPlatformAverages();

            const [[providerRows], [ratingRows]] = await Promise.all([
                pool.execute(providerMetricsQuery, [providerID]),
                pool.execute(ratingQuery, [providerID])
            ]);

            const providerMetrics = {
                completionRate: parseFloat(providerRows[0]?.completion_rate) || 0,
                responseTime: parseFloat(providerRows[0]?.avg_response_time) || 0,
                cancellationRate: parseFloat(providerRows[0]?.cancellation_rate) || 0,
                totalRequests: parseInt(providerRows[0]?.total_requests, 10) || 0,
                avgRating: parseFloat(ratingRows[0]?.avg_rating) || 0,
                reviewCount: parseInt(ratingRows[0]?.review_count, 10) || 0
            };

            const suggestions = [];
            const strengths = [];

            // Compare with platform averages and generate suggestions
            const platformMetrics = platformAverages.metrics;

            // Completion Rate Analysis
            if (providerMetrics.completionRate < platformMetrics.completionRate.value) {
                const gap = platformMetrics.completionRate.value - providerMetrics.completionRate;
                suggestions.push({
                    metric: 'completionRate',
                    priority: gap > 10 ? 'high' : 'medium',
                    currentValue: parseFloat(providerMetrics.completionRate.toFixed(2)),
                    targetValue: parseFloat(platformMetrics.completionRate.value.toFixed(2)),
                    gap: parseFloat(gap.toFixed(2)),
                    title: 'Improve Service Completion Rate',
                    description: `Your completion rate (${providerMetrics.completionRate.toFixed(1)}%) is below the platform average (${platformMetrics.completionRate.value.toFixed(1)}%).`,
                    recommendations: [
                        'Review and improve your service scheduling process',
                        'Communicate proactively with customers about any delays',
                        'Consider declining requests you cannot fulfill',
                        'Set realistic expectations during initial customer contact'
                    ]
                });
            } else {
                strengths.push({
                    metric: 'completionRate',
                    value: parseFloat(providerMetrics.completionRate.toFixed(2)),
                    platformAverage: parseFloat(platformMetrics.completionRate.value.toFixed(2)),
                    description: 'Your completion rate exceeds the platform average'
                });
            }

            // Response Time Analysis
            if (providerMetrics.responseTime > platformMetrics.responseTime.value && platformMetrics.responseTime.value > 0) {
                const gap = providerMetrics.responseTime - platformMetrics.responseTime.value;
                suggestions.push({
                    metric: 'responseTime',
                    priority: gap > 60 ? 'high' : 'medium',
                    currentValue: parseFloat(providerMetrics.responseTime.toFixed(2)),
                    targetValue: parseFloat(platformMetrics.responseTime.value.toFixed(2)),
                    gap: parseFloat(gap.toFixed(2)),
                    title: 'Reduce Response Time',
                    description: `Your average response time (${providerMetrics.responseTime.toFixed(0)} min) is slower than the platform average (${platformMetrics.responseTime.value.toFixed(0)} min).`,
                    recommendations: [
                        'Enable push notifications for new service requests',
                        'Set aside dedicated time slots for responding to inquiries',
                        'Use quick response templates for common questions',
                        'Consider hiring support staff during peak hours'
                    ]
                });
            } else if (platformMetrics.responseTime.value > 0) {
                strengths.push({
                    metric: 'responseTime',
                    value: parseFloat(providerMetrics.responseTime.toFixed(2)),
                    platformAverage: parseFloat(platformMetrics.responseTime.value.toFixed(2)),
                    description: 'Your response time is faster than the platform average'
                });
            }

            // Customer Satisfaction Analysis
            if (providerMetrics.avgRating < platformMetrics.customerSatisfaction.value && providerMetrics.reviewCount > 0) {
                const gap = platformMetrics.customerSatisfaction.value - providerMetrics.avgRating;
                suggestions.push({
                    metric: 'customerSatisfaction',
                    priority: gap > 0.5 ? 'high' : 'medium',
                    currentValue: parseFloat(providerMetrics.avgRating.toFixed(2)),
                    targetValue: parseFloat(platformMetrics.customerSatisfaction.value.toFixed(2)),
                    gap: parseFloat(gap.toFixed(2)),
                    title: 'Improve Customer Satisfaction',
                    description: `Your average rating (${providerMetrics.avgRating.toFixed(1)}) is below the platform average (${platformMetrics.customerSatisfaction.value.toFixed(1)}).`,
                    recommendations: [
                        'Follow up with customers after service completion',
                        'Address negative feedback promptly and professionally',
                        'Ask satisfied customers to leave reviews',
                        'Invest in quality improvements based on feedback themes'
                    ]
                });
            } else if (providerMetrics.reviewCount > 0) {
                strengths.push({
                    metric: 'customerSatisfaction',
                    value: parseFloat(providerMetrics.avgRating.toFixed(2)),
                    platformAverage: parseFloat(platformMetrics.customerSatisfaction.value.toFixed(2)),
                    description: 'Your customer satisfaction rating exceeds the platform average'
                });
            }

            // Cancellation Rate Analysis
            if (providerMetrics.cancellationRate > platformMetrics.cancellationRate.value) {
                const gap = providerMetrics.cancellationRate - platformMetrics.cancellationRate.value;
                suggestions.push({
                    metric: 'cancellationRate',
                    priority: gap > 5 ? 'high' : 'medium',
                    currentValue: parseFloat(providerMetrics.cancellationRate.toFixed(2)),
                    targetValue: parseFloat(platformMetrics.cancellationRate.value.toFixed(2)),
                    gap: parseFloat(gap.toFixed(2)),
                    title: 'Reduce Cancellation Rate',
                    description: `Your cancellation rate (${providerMetrics.cancellationRate.toFixed(1)}%) is higher than the platform average (${platformMetrics.cancellationRate.value.toFixed(1)}%).`,
                    recommendations: [
                        'Confirm appointments 24 hours in advance',
                        'Maintain a waitlist for last-minute cancellations',
                        'Analyze cancellation reasons and address root causes',
                        'Implement a cancellation policy with appropriate notice periods'
                    ]
                });
            } else {
                strengths.push({
                    metric: 'cancellationRate',
                    value: parseFloat(providerMetrics.cancellationRate.toFixed(2)),
                    platformAverage: parseFloat(platformMetrics.cancellationRate.value.toFixed(2)),
                    description: 'Your cancellation rate is lower than the platform average'
                });
            }

            // Low review count suggestion
            if (providerMetrics.reviewCount < 5 && providerMetrics.totalRequests > 10) {
                suggestions.push({
                    metric: 'reviewCount',
                    priority: 'medium',
                    currentValue: providerMetrics.reviewCount,
                    targetValue: 10,
                    gap: 10 - providerMetrics.reviewCount,
                    title: 'Increase Review Count',
                    description: `You have only ${providerMetrics.reviewCount} reviews. More reviews help build trust with potential customers.`,
                    recommendations: [
                        'Send a friendly follow-up message after service completion',
                        'Make it easy for customers to leave reviews',
                        'Respond to all reviews to show engagement',
                        'Offer excellent service that naturally encourages reviews'
                    ]
                });
            }

            // Sort suggestions by priority
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

            return {
                providerID,
                providerMetrics: {
                    completionRate: parseFloat(providerMetrics.completionRate.toFixed(2)),
                    responseTime: parseFloat(providerMetrics.responseTime.toFixed(2)),
                    cancellationRate: parseFloat(providerMetrics.cancellationRate.toFixed(2)),
                    avgRating: parseFloat(providerMetrics.avgRating.toFixed(2)),
                    totalRequests: providerMetrics.totalRequests,
                    reviewCount: providerMetrics.reviewCount
                },
                platformAverages: {
                    completionRate: platformMetrics.completionRate.value,
                    responseTime: platformMetrics.responseTime.value,
                    cancellationRate: platformMetrics.cancellationRate.value,
                    customerSatisfaction: platformMetrics.customerSatisfaction.value
                },
                suggestions,
                strengths,
                summary: {
                    totalSuggestions: suggestions.length,
                    highPriority: suggestions.filter(s => s.priority === 'high').length,
                    mediumPriority: suggestions.filter(s => s.priority === 'medium').length,
                    strengthCount: strengths.length,
                    overallAssessment: suggestions.length === 0 
                        ? 'Excellent! You are performing above platform averages in all key metrics.'
                        : suggestions.filter(s => s.priority === 'high').length > 0
                            ? 'There are high-priority areas that need attention to improve your performance.'
                            : 'You are performing well with some opportunities for improvement.'
                },
                calculatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error getting improvement suggestions', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async compareWithBenchmarks(providerID) {
        try {
            analyticsLogger.debug('Comparing with benchmarks', { providerID });

            const [platformAverages, percentileRankings] = await Promise.all([
                this.getPlatformAverages(),
                this.getPercentileRankings(providerID)
            ]);

            const comparisons = [];
            const rankings = percentileRankings.rankings;

            // Completion Rate comparison
            comparisons.push({
                metric: 'completionRate',
                label: 'Completion Rate',
                providerValue: rankings.completionRate.value,
                platformAverage: platformAverages.metrics.completionRate.value,
                difference: parseFloat((rankings.completionRate.value - platformAverages.metrics.completionRate.value).toFixed(2)),
                percentile: rankings.completionRate.percentile,
                status: rankings.completionRate.value >= platformAverages.metrics.completionRate.value ? 'above' : 'below',
                unit: 'percentage'
            });

            // Response Time comparison (lower is better)
            comparisons.push({
                metric: 'responseTime',
                label: 'Response Time',
                providerValue: rankings.responseTime.value,
                platformAverage: platformAverages.metrics.responseTime.value,
                difference: parseFloat((rankings.responseTime.value - platformAverages.metrics.responseTime.value).toFixed(2)),
                percentile: rankings.responseTime.percentile,
                status: rankings.responseTime.value <= platformAverages.metrics.responseTime.value ? 'above' : 'below',
                unit: 'minutes',
                note: 'Lower is better'
            });

            // Customer Satisfaction comparison
            comparisons.push({
                metric: 'customerSatisfaction',
                label: 'Customer Satisfaction',
                providerValue: rankings.customerSatisfaction.value,
                platformAverage: platformAverages.metrics.customerSatisfaction.value,
                difference: parseFloat((rankings.customerSatisfaction.value - platformAverages.metrics.customerSatisfaction.value).toFixed(2)),
                percentile: rankings.customerSatisfaction.percentile,
                status: rankings.customerSatisfaction.value >= platformAverages.metrics.customerSatisfaction.value ? 'above' : 'below',
                unit: 'rating'
            });

            // Cancellation Rate comparison (lower is better)
            comparisons.push({
                metric: 'cancellationRate',
                label: 'Cancellation Rate',
                providerValue: rankings.cancellationRate.value,
                platformAverage: platformAverages.metrics.cancellationRate.value,
                difference: parseFloat((rankings.cancellationRate.value - platformAverages.metrics.cancellationRate.value).toFixed(2)),
                percentile: rankings.cancellationRate.percentile,
                status: rankings.cancellationRate.value <= platformAverages.metrics.cancellationRate.value ? 'above' : 'below',
                unit: 'percentage',
                note: 'Lower is better'
            });

            // Categorize metrics
            const aboveBenchmark = comparisons.filter(c => c.status === 'above');
            const belowBenchmark = comparisons.filter(c => c.status === 'below');

            return {
                providerID,
                comparisons,
                summary: {
                    aboveBenchmark: aboveBenchmark.map(c => c.label),
                    belowBenchmark: belowBenchmark.map(c => c.label),
                    aboveCount: aboveBenchmark.length,
                    belowCount: belowBenchmark.length,
                    overallPerformance: aboveBenchmark.length >= belowBenchmark.length ? 'above_average' : 'below_average'
                },
                totalProviders: percentileRankings.totalProviders,
                calculatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error comparing with benchmarks', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }
}

module.exports = BenchmarkingService;
