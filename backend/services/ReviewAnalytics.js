const pool = require('../config/database');
const { DatabaseError, TransactionError, mapDatabaseError } = require('../utils/errors');
const { analyticsLogger } = require('../utils/logger');

class ReviewAnalytics {
    static CACHE_DURATION_MS = 60 * 60 * 1000;

    static async calculateAverageRating(providerID) {
        try {
            analyticsLogger.debug('Calculating average rating', { providerID });
            
            const query = `
                SELECT AVG(rating) as averageRating
                FROM Review
                WHERE providerID = ? AND (isHidden = FALSE OR isHidden IS NULL)
            `;
            const [rows] = await pool.execute(query, [providerID]);
            const avg = rows[0].averageRating;
            return avg ? parseFloat(avg).toFixed(1) : '0.0';
        } catch (error) {
            analyticsLogger.error('Error calculating average rating', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async getRatingDistribution(providerID) {
        try {
            analyticsLogger.debug('Getting rating distribution', { providerID });
            
            const query = `
                SELECT 
                    rating,
                    COUNT(*) as count
                FROM Review 
                WHERE providerID = ? AND (isHidden = FALSE OR isHidden IS NULL)
                GROUP BY rating
                ORDER BY rating DESC
            `;
            const [rows] = await pool.execute(query, [providerID]);
            
            // Initialize distribution with all ratings (1-5)
            const distribution = {
                5: 0, 4: 0, 3: 0, 2: 0, 1: 0
            };
            
            // Fill in actual counts
            rows.forEach(row => {
                distribution[row.rating] = parseInt(row.count, 10);
            });
            
            return distribution;
        } catch (error) {
            analyticsLogger.error('Error getting rating distribution', { providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }


    static async getRatingTrends(providerID, timeframe = '12months') {
        // Parse timeframe to get number of months
        let months = 12;
        if (timeframe === '3months') months = 3;
        else if (timeframe === '6months') months = 6;
        else if (timeframe === '12months') months = 12;
        else if (typeof timeframe === 'number') months = timeframe;

        const query = `
            SELECT 
                DATE_FORMAT(createdAt, '%Y-%m') as month,
                AVG(rating) as averageRating,
                COUNT(*) as reviewCount
            FROM Review
            WHERE providerID = ? 
                AND (isHidden = FALSE OR isHidden IS NULL)
                AND createdAt >= DATE_SUB(NOW(), INTERVAL ? MONTH)
            GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
            ORDER BY month ASC
        `;
        const [rows] = await pool.execute(query, [providerID, months]);
        
        return rows.map(row => ({
            month: row.month,
            averageRating: parseFloat(row.averageRating).toFixed(1),
            reviewCount: parseInt(row.reviewCount, 10)
        }));
    }

    static async getReviewCountByPeriod(providerID, period = 'all') {
        let dateCondition = '';
        
        switch (period) {
            case '30days':
                dateCondition = 'AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
                break;
            case '6months':
                dateCondition = 'AND createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)';
                break;
            case 'all':
            default:
                dateCondition = '';
                break;
        }

        const query = `
            SELECT COUNT(*) as count
            FROM Review
            WHERE providerID = ? AND (isHidden = FALSE OR isHidden IS NULL) ${dateCondition}
        `;
        const [rows] = await pool.execute(query, [providerID]);
        return parseInt(rows[0].count, 10);
    }

    static async getAllPeriodCounts(providerID) {
        const query = `
            SELECT 
                COUNT(*) as allTime,
                SUM(CASE WHEN createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as last30Days,
                SUM(CASE WHEN createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH) THEN 1 ELSE 0 END) as last6Months
            FROM Review
            WHERE providerID = ? AND (isHidden = FALSE OR isHidden IS NULL)
        `;
        const [rows] = await pool.execute(query, [providerID]);
        
        return {
            last30Days: parseInt(rows[0].last30Days || 0, 10),
            last6Months: parseInt(rows[0].last6Months || 0, 10),
            allTime: parseInt(rows[0].allTime || 0, 10)
        };
    }

    static async getCustomerSatisfactionRate(providerID) {
        const query = `
            SELECT 
                COUNT(*) as totalReviews,
                SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as satisfiedReviews
            FROM Review
            WHERE providerID = ? AND (isHidden = FALSE OR isHidden IS NULL)
        `;
        const [rows] = await pool.execute(query, [providerID]);
        const result = rows[0];
        
        const totalReviews = parseInt(result.totalReviews || 0, 10);
        const satisfiedReviews = parseInt(result.satisfiedReviews || 0, 10);
        
        // if there are at least 10 reviews
        if (totalReviews >= 10) {
            return {
                eligible: true,
                totalReviews,
                satisfiedReviews,
                satisfactionPercentage: Math.round((satisfiedReviews / totalReviews) * 100)
            };
        }
        
        return {
            eligible: false,
            totalReviews,
            satisfiedReviews,
            satisfactionPercentage: null,
            message: 'At least 10 reviews required for satisfaction metrics'
        };
    }

    static async updateCache(providerID) {
        const connection = await pool.getConnection();
        try {
            analyticsLogger.debug('Updating analytics cache', { providerID });
            
            await connection.beginTransaction();

            // Calculate all analytics data
            const [averageRating, distribution, periodCounts] = await Promise.all([
                this.calculateAverageRating(providerID),
                this.getRatingDistribution(providerID),
                this.getAllPeriodCounts(providerID)
            ]);

            // Update or insert analytics cache
            const query = `
                INSERT INTO ReviewAnalytics (providerID, averageRating, totalReviews, ratingDistribution, lastCalculated)
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    averageRating = VALUES(averageRating),
                    totalReviews = VALUES(totalReviews),
                    ratingDistribution = VALUES(ratingDistribution),
                    lastCalculated = NOW()
            `;
            
            await connection.execute(query, [
                providerID,
                parseFloat(averageRating) || 0,
                periodCounts.allTime || 0,
                JSON.stringify(distribution)
            ]);

            await connection.commit();
            
            analyticsLogger.info('Analytics cache updated', { providerID });
            
            return {
                providerID,
                averageRating,
                totalReviews: periodCounts.allTime,
                ratingDistribution: distribution,
                lastCalculated: new Date()
            };
        } catch (error) {
            await connection.rollback();
            analyticsLogger.error('Failed to update analytics cache', { providerID, error: error.message });
            throw new TransactionError('Failed to update analytics cache', error);
        } finally {
            connection.release();
        }
    }

    static async getCachedAnalytics(providerID, forceRefresh = false) {
        if (!forceRefresh) {
            // get cached data first
            const query = `
                SELECT * FROM ReviewAnalytics 
                WHERE providerID = ? AND lastCalculated > DATE_SUB(NOW(), INTERVAL 1 HOUR)
            `;
            const [rows] = await pool.execute(query, [providerID]);
            
            if (rows.length > 0) {
                const cached = rows[0];
                return {
                    providerID: cached.providerID,
                    averageRating: parseFloat(cached.averageRating).toFixed(1),
                    totalReviews: parseInt(cached.totalReviews, 10),
                    ratingDistribution: typeof cached.ratingDistribution === 'string' 
                        ? JSON.parse(cached.ratingDistribution) 
                        : cached.ratingDistribution,
                    lastCalculated: cached.lastCalculated,
                    fromCache: true
                };
            }
        }

        // refresh
        const freshData = await this.updateCache(providerID);
        return { ...freshData, fromCache: false };
    }

    static async invalidateCache(providerID) {
        const query = `
            UPDATE ReviewAnalytics 
            SET lastCalculated = DATE_SUB(NOW(), INTERVAL 2 HOUR)
            WHERE providerID = ?
        `;
        const [result] = await pool.execute(query, [providerID]);
        return result.affectedRows > 0;
    }

    static async generateInsights(providerID) {
        // Fetch all analytics data in parallel for efficiency
        const [
            averageRating,
            distribution,
            trends,
            satisfaction,
            periodCounts
        ] = await Promise.all([
            this.calculateAverageRating(providerID),
            this.getRatingDistribution(providerID),
            this.getRatingTrends(providerID, '12months'),
            this.getCustomerSatisfactionRate(providerID),
            this.getAllPeriodCounts(providerID)
        ]);

        // Calculate total from distribution for validation
        const distributionTotal = Object.values(distribution).reduce((sum, count) => sum + count, 0);

        return {
            summary: {
                averageRating,
                totalReviews: periodCounts.allTime
            },
            ratingDistribution: distribution,
            trends: trends,
            reviewCounts: periodCounts,
            satisfaction: satisfaction,
            metadata: {
                distributionTotal,
                generatedAt: new Date().toISOString()
            }
        };
    }

    static async getDashboardAnalytics(providerID, useCache = true) {
        // Try to get cached basic analytics first
        let basicAnalytics;
        if (useCache) {
            try {
                basicAnalytics = await this.getCachedAnalytics(providerID);
            } catch (error) {
                // fresh
                basicAnalytics = null;
            }
        }

        // Get additional data that's not cached
        const [satisfaction, periodCounts, trends] = await Promise.all([
            this.getCustomerSatisfactionRate(providerID),
            this.getAllPeriodCounts(providerID),
            this.getRatingTrends(providerID, '6months')
        ]);

        // Use cached data if available, otherwise calculate fresh
        const averageRating = basicAnalytics?.averageRating || await this.calculateAverageRating(providerID);
        const distribution = basicAnalytics?.ratingDistribution || await this.getRatingDistribution(providerID);

        return {
            averageRating,
            ratingDistribution: distribution,
            trends: trends,
            reviewCounts: periodCounts,
            satisfaction: satisfaction,
            fromCache: basicAnalytics?.fromCache || false,
            generatedAt: new Date().toISOString()
        };
    }

    static validateDistribution(distribution, totalReviews) {
        const sum = Object.values(distribution).reduce((acc, count) => acc + count, 0);
        return sum === totalReviews;
    }

    static calculateAverageFromDistribution(distribution) {
        let totalRatings = 0;
        let weightedSum = 0;
        
        for (const [rating, count] of Object.entries(distribution)) {
            totalRatings += count;
            weightedSum += parseInt(rating, 10) * count;
        }
        
        if (totalRatings === 0) return '0.0';
        return (weightedSum / totalRatings).toFixed(1);
    }
}

module.exports = ReviewAnalytics;