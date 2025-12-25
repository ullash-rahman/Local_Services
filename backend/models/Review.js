const pool = require('../config/database');
const { DatabaseError, TransactionError, mapDatabaseError } = require('../utils/errors');
const { dbLogger } = require('../utils/logger');

class Review {


    static async create(reviewData) {
        const { requestID, customerID, providerID, rating, comment } = reviewData;
        
        try {
            dbLogger.debug('Creating review', { requestID, customerID, providerID, rating });
            
            const query = `
                INSERT INTO Review (requestID, customerID, providerID, rating, comment)
                VALUES (?, ?, ?, ?, ?)
            `;
            const [result] = await pool.execute(query, [requestID, customerID, providerID, rating, comment]);
            
            dbLogger.info('Review created successfully', { reviewID: result.insertId, requestID });
            return result.insertId;
        } catch (error) {
            dbLogger.logDbError('create review', error, { requestID, customerID });
            throw mapDatabaseError(error);
        }
    }

    static async findByProvider(providerID, options = {}) {
        const { 
            limit = 10, 
            offset = 0, 
            sortBy = 'createdAt', 
            sortOrder = 'DESC',
            includeHidden = false 
        } = options;

        try {
            dbLogger.debug('Finding reviews by provider', { providerID, limit, offset, sortBy, sortOrder });
            
            let query = `
                SELECT r.*, u.name as customerName
                FROM Review r
                JOIN USER u ON r.customerID = u.userID
                WHERE r.providerID = ?
            `;
            
            const params = [providerID];

            // Filter out hidden reviews unless explicitly requested
            if (!includeHidden) {
                query += ' AND (r.isHidden = FALSE OR r.isHidden IS NULL)';
            }

            // Add sorting
            query += ` ORDER BY r.${sortBy} ${sortOrder}`;
            
            // Add pagination
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const [rows] = await pool.execute(query, params);
            
            dbLogger.debug('Found reviews', { providerID, count: rows.length });
            return rows;
        } catch (error) {
            dbLogger.logDbError('findByProvider', error, { providerID });
            throw mapDatabaseError(error);
        }
    }

    static async findByRequest(requestID) {
        try {
            dbLogger.debug('Finding review by request', { requestID });
            
            const query = `
                SELECT r.*, u.name as customerName, p.name as providerName
                FROM Review r
                JOIN USER u ON r.customerID = u.userID
                JOIN USER p ON r.providerID = p.userID
                WHERE r.requestID = ? AND (r.isHidden = FALSE OR r.isHidden IS NULL)
            `;
            const [rows] = await pool.execute(query, [requestID]);
            return rows[0] || null;
        } catch (error) {
            dbLogger.logDbError('findByRequest', error, { requestID });
            throw mapDatabaseError(error);
        }
    }

    static async findById(reviewID) {
        try {
            dbLogger.debug('Finding review by ID', { reviewID });
            
            const query = `
                SELECT r.*, u.name as customerName, p.name as providerName
                FROM Review r
                JOIN USER u ON r.customerID = u.userID
                JOIN USER p ON r.providerID = p.userID
                WHERE r.reviewID = ?
            `;
            const [rows] = await pool.execute(query, [reviewID]);
            return rows[0] || null;
        } catch (error) {
            dbLogger.logDbError('findById', error, { reviewID });
            throw mapDatabaseError(error);
        }
    }

    static async addReply(reviewID, providerID, replyText) {
        try {
            dbLogger.debug('Adding reply to review', { reviewID, providerID });
            
            const query = `
                UPDATE Review 
                SET reply = ?, replyDate = CURRENT_TIMESTAMP 
                WHERE reviewID = ? AND providerID = ?
            `;
            const [result] = await pool.execute(query, [replyText, reviewID, providerID]);
            
            if (result.affectedRows > 0) {
                dbLogger.info('Reply added successfully', { reviewID, providerID });
            }
            
            return result.affectedRows > 0;
        } catch (error) {
            dbLogger.logDbError('addReply', error, { reviewID, providerID });
            throw mapDatabaseError(error);
        }
    }

    static async getProviderStats(providerID) {
        const query = `
            SELECT 
                COUNT(*) as totalReviews,
                AVG(rating) as averageRating,
                MIN(rating) as minRating,
                MAX(rating) as maxRating,
                COUNT(CASE WHEN rating >= 4 THEN 1 END) as positiveReviews
            FROM Review 
            WHERE providerID = ? AND (isHidden = FALSE OR isHidden IS NULL)
        `;
        const [rows] = await pool.execute(query, [providerID]);
        const stats = rows[0];
        
        // Calculate satisfaction percentage if there are enough reviews
        if (stats.totalReviews >= 10) {
            stats.satisfactionPercentage = Math.round((stats.positiveReviews / stats.totalReviews) * 100);
        }
        
        return stats;
    }

    static async getRatingDistribution(providerID) {
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
            distribution[row.rating] = row.count;
        });
        
        return distribution;
    }

    static async getRecentReviews(providerID, limit = 5) {
        const query = `
            SELECT r.*, u.name as customerName
            FROM Review r
            JOIN USER u ON r.customerID = u.userID
            WHERE r.providerID = ? AND (r.isHidden = FALSE OR r.isHidden IS NULL)
            ORDER BY r.createdAt DESC
            LIMIT ?
        `;
        const [rows] = await pool.execute(query, [providerID, limit]);
        return rows;
    }

    static async getReviewCountByPeriod(providerID, period = 'all') {
        let dateCondition = '';
        
        switch (period) {
            case '30days':
                dateCondition = 'AND r.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
                break;
            case '6months':
                dateCondition = 'AND r.createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)';
                break;
            case 'all':
            default:
                dateCondition = '';
                break;
        }

        const query = `
            SELECT COUNT(*) as count
            FROM Review r
            WHERE r.providerID = ? AND (r.isHidden = FALSE OR r.isHidden IS NULL) ${dateCondition}
        `;
        const [rows] = await pool.execute(query, [providerID]);
        return rows[0].count;
    }

    static async getRatingTrends(providerID, months = 12) {
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
            reviewCount: row.reviewCount
        }));
    }

    static async getCustomerSatisfactionRate(providerID) {
        const query = `
            SELECT 
                COUNT(*) as totalReviews,
                COUNT(CASE WHEN rating >= 4 THEN 1 END) as satisfiedReviews
            FROM Review
            WHERE providerID = ? AND (isHidden = FALSE OR isHidden IS NULL)
        `;
        const [rows] = await pool.execute(query, [providerID]);
        const result = rows[0];
        
        // Only calculate satisfaction if there are at least 10 reviews
        if (result.totalReviews >= 10) {
            return {
                eligible: true,
                totalReviews: result.totalReviews,
                satisfiedReviews: result.satisfiedReviews,
                satisfactionPercentage: Math.round((result.satisfiedReviews / result.totalReviews) * 100)
            };
        }
        
        return {
            eligible: false,
            totalReviews: result.totalReviews,
            satisfiedReviews: result.satisfiedReviews,
            satisfactionPercentage: null,
            message: 'At least 10 reviews required for satisfaction metrics'
        };
    }

    static async updateAnalyticsCache(providerID) {
        const connection = await pool.getConnection();
        try {
            dbLogger.debug('Updating analytics cache', { providerID });
            
            await connection.beginTransaction();

            // Get current statistics
            const stats = await this.getProviderStats(providerID);
            const distribution = await this.getRatingDistribution(providerID);

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
                stats.averageRating || 0,
                stats.totalReviews || 0,
                JSON.stringify(distribution)
            ]);

            await connection.commit();
            
            dbLogger.info('Analytics cache updated', { providerID });
            
            return {
                providerID,
                averageRating: stats.averageRating || 0,
                totalReviews: stats.totalReviews || 0,
                ratingDistribution: distribution,
                lastCalculated: new Date()
            };
        } catch (error) {
            await connection.rollback();
            dbLogger.logDbError('updateAnalyticsCache', error, { providerID });
            throw new TransactionError('Failed to update analytics cache', error);
        } finally {
            connection.release();
        }
    }

    static async getCachedAnalytics(providerID, forceRefresh = false) {
        if (!forceRefresh) {
            // Try to get cached data first
            const query = `
                SELECT * FROM ReviewAnalytics 
                WHERE providerID = ? AND lastCalculated > DATE_SUB(NOW(), INTERVAL 1 HOUR)
            `;
            const [rows] = await pool.execute(query, [providerID]);
            
            if (rows.length > 0) {
                const cached = rows[0];
                return {
                    providerID: cached.providerID,
                    averageRating: parseFloat(cached.averageRating),
                    totalReviews: cached.totalReviews,
                    ratingDistribution: JSON.parse(cached.ratingDistribution),
                    lastCalculated: cached.lastCalculated
                };
            }
        }

        // Cache is stale or doesn't exist, refresh it
        return await this.updateAnalyticsCache(providerID);
    }

    static async generateInsights(providerID) {
        const [
            stats,
            distribution,
            trends,
            satisfaction,
            last30Days,
            last6Months,
            allTime
        ] = await Promise.all([
            this.getProviderStats(providerID),
            this.getRatingDistribution(providerID),
            this.getRatingTrends(providerID, 12),
            this.getCustomerSatisfactionRate(providerID),
            this.getReviewCountByPeriod(providerID, '30days'),
            this.getReviewCountByPeriod(providerID, '6months'),
            this.getReviewCountByPeriod(providerID, 'all')
        ]);

        return {
            summary: {
                averageRating: stats.averageRating ? parseFloat(stats.averageRating).toFixed(1) : '0.0',
                totalReviews: stats.totalReviews || 0,
                minRating: stats.minRating,
                maxRating: stats.maxRating
            },
            ratingDistribution: distribution,
            trends: trends,
            satisfaction: satisfaction,
            reviewCounts: {
                last30Days,
                last6Months,
                allTime
            },
            generatedAt: new Date()
        };
    }

    static async flagContent(reviewID, reason) {
        const connection = await pool.getConnection();
        try {
            dbLogger.debug('Flagging content', { reviewID, reason });
            
            await connection.beginTransaction();

            const updateQuery = `
                UPDATE Review 
                SET isModerated = TRUE, moderationReason = ?
                WHERE reviewID = ?
            `;
            await connection.execute(updateQuery, [reason, reviewID]);

            const moderationQuery = `
                INSERT INTO ReviewModeration (reviewID, moderatorID, action, reason)
                VALUES (?, ?, 'flag', ?)
            `;
            await connection.execute(moderationQuery, [reviewID, 1, reason]); // Using 1 as system moderator

            await connection.commit();
            
            dbLogger.info('Content flagged successfully', { reviewID });
            return true;
        } catch (error) {
            await connection.rollback();
            dbLogger.logDbError('flagContent', error, { reviewID });
            throw new TransactionError('Failed to flag content', error);
        } finally {
            connection.release();
        }
    }

    static async moderateContent(reviewID, action, moderatorID, reason = null) {
        const connection = await pool.getConnection();
        try {
            dbLogger.debug('Moderating content', { reviewID, action, moderatorID });
            
            await connection.beginTransaction();

            // Update review based on action
            let updateQuery = '';
            let updateParams = [];

            switch (action) {
                case 'approve':
                    updateQuery = `
                        UPDATE Review 
                        SET isModerated = TRUE, isHidden = FALSE, moderationReason = NULL
                        WHERE reviewID = ?
                    `;
                    updateParams = [reviewID];
                    break;
                case 'hide':
                    updateQuery = `
                        UPDATE Review 
                        SET isModerated = TRUE, isHidden = TRUE, moderationReason = ?
                        WHERE reviewID = ?
                    `;
                    updateParams = [reason, reviewID];
                    break;
                case 'remove':
                    updateQuery = `
                        UPDATE Review 
                        SET isModerated = TRUE, isHidden = TRUE, moderationReason = ?
                        WHERE reviewID = ?
                    `;
                    updateParams = [reason, reviewID];
                    break;
                default:
                    throw new Error('Invalid moderation action');
            }

            await connection.execute(updateQuery, updateParams);

            // Create moderation record
            const moderationQuery = `
                INSERT INTO ReviewModeration (reviewID, moderatorID, action, reason)
                VALUES (?, ?, ?, ?)
            `;
            await connection.execute(moderationQuery, [reviewID, moderatorID, action, reason]);

            await connection.commit();
            
            dbLogger.info('Content moderated successfully', { reviewID, action, moderatorID });
            return true;
        } catch (error) {
            await connection.rollback();
            dbLogger.logDbError('moderateContent', error, { reviewID, action });
            throw new TransactionError('Failed to moderate content', error);
        } finally {
            connection.release();
        }
    }

    static async getModerationHistory(reviewID) {
        const query = `
            SELECT rm.*, u.name as moderatorName
            FROM ReviewModeration rm
            JOIN USER u ON rm.moderatorID = u.userID
            WHERE rm.reviewID = ?
            ORDER BY rm.moderatedAt DESC
        `;
        const [rows] = await pool.execute(query, [reviewID]);
        return rows;
    }

    static async getFlaggedReviews(options = {}) {
        const { 
            limit = 20, 
            offset = 0,
            status = 'pending' // 'pending', 'all', 'hidden', 'approved'
        } = options;

        let whereClause = '';
        switch (status) {
            case 'pending':
                whereClause = 'WHERE r.isModerated = TRUE AND r.isHidden = FALSE';
                break;
            case 'hidden':
                whereClause = 'WHERE r.isHidden = TRUE';
                break;
            case 'approved':
                whereClause = 'WHERE r.isModerated = TRUE AND r.isHidden = FALSE AND r.moderationReason IS NULL';
                break;
            case 'all':
            default:
                whereClause = 'WHERE r.isModerated = TRUE OR r.isHidden = TRUE';
                break;
        }

        const query = `
            SELECT r.*, 
                   c.name as customerName, 
                   p.name as providerName,
                   (SELECT COUNT(*) FROM ReviewModeration rm WHERE rm.reviewID = r.reviewID) as moderationCount
            FROM Review r
            JOIN USER c ON r.customerID = c.userID
            JOIN USER p ON r.providerID = p.userID
            ${whereClause}
            ORDER BY r.createdAt DESC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await pool.execute(query, [limit, offset]);
        return rows;
    }

    static async getFlaggedReviewsCount(status = 'pending') {
        let whereClause = '';
        switch (status) {
            case 'pending':
                whereClause = 'WHERE isModerated = TRUE AND isHidden = FALSE';
                break;
            case 'hidden':
                whereClause = 'WHERE isHidden = TRUE';
                break;
            case 'approved':
                whereClause = 'WHERE isModerated = TRUE AND isHidden = FALSE AND moderationReason IS NULL';
                break;
            case 'all':
            default:
                whereClause = 'WHERE isModerated = TRUE OR isHidden = TRUE';
                break;
        }

        const query = `SELECT COUNT(*) as count FROM Review ${whereClause}`;
        const [rows] = await pool.execute(query);
        return rows[0].count;
    }

    static async getModerationAuditLogs(options = {}) {
        const { 
            limit = 50, 
            offset = 0,
            action = null,
            moderatorID = null
        } = options;

        let query = `
            SELECT rm.*, 
                   u.name as moderatorName,
                   r.rating,
                   r.comment,
                   c.name as reviewAuthorName
            FROM ReviewModeration rm
            JOIN USER u ON rm.moderatorID = u.userID
            JOIN Review r ON rm.reviewID = r.reviewID
            JOIN USER c ON r.customerID = c.userID
            WHERE 1=1
        `;
        const params = [];

        if (action) {
            query += ' AND rm.action = ?';
            params.push(action);
        }

        if (moderatorID) {
            query += ' AND rm.moderatorID = ?';
            params.push(moderatorID);
        }

        query += ' ORDER BY rm.moderatedAt DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await pool.execute(query, params);
        return rows;
    }

    static async getModerationStats() {
        const query = `
            SELECT 
                COUNT(CASE WHEN isModerated = TRUE AND isHidden = FALSE THEN 1 END) as pendingCount,
                COUNT(CASE WHEN isHidden = TRUE THEN 1 END) as hiddenCount,
                COUNT(CASE WHEN isModerated = TRUE AND isHidden = FALSE AND moderationReason IS NULL THEN 1 END) as approvedCount,
                (SELECT COUNT(*) FROM ReviewModeration WHERE moderatedAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as actionsLast24h,
                (SELECT COUNT(*) FROM ReviewModeration WHERE moderatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as actionsLast7Days
            FROM Review
        `;
        const [rows] = await pool.execute(query);
        return rows[0];
    }

    static async canCustomerReview(customerID, requestID) {
        // Check if service is completed and customer hasn't already reviewed
        const query = `
            SELECT 
                sr.status,
                sr.customerID,
                COUNT(r.reviewID) as existingReviews
            FROM ServiceRequest sr
            LEFT JOIN Review r ON sr.requestID = r.requestID AND r.customerID = ?
            WHERE sr.requestID = ? AND sr.customerID = ?
            GROUP BY sr.requestID, sr.status, sr.customerID
        `;
        const [rows] = await pool.execute(query, [customerID, requestID, customerID]);
        
        if (rows.length === 0) return false;
        
        const result = rows[0];
        return result.status === 'Completed' && result.existingReviews === 0;
    }

    static async canProviderReply(providerID, reviewID) {
        const query = `
            SELECT providerID, reply
            FROM Review
            WHERE reviewID = ? AND providerID = ?
        `;
        const [rows] = await pool.execute(query, [reviewID, providerID]);
        
        if (rows.length === 0) return false;
        
        // Provider can reply if they haven't replied yet
        return rows[0].reply === null || rows[0].reply === '';
    }

    static async incrementHelpfulCount(reviewID) {
        const query = `
            UPDATE Review 
            SET helpfulCount = helpfulCount + 1
            WHERE reviewID = ?
        `;
        const [result] = await pool.execute(query, [reviewID]);
        return result.affectedRows > 0;
    }

    static async getTotalReviewCount(providerID) {
        const query = `
            SELECT COUNT(*) as count
            FROM Review
            WHERE providerID = ? AND (isHidden = FALSE OR isHidden IS NULL)
        `;
        const [rows] = await pool.execute(query, [providerID]);
        return rows[0].count;
    }

    static async getAverageRating(providerID) {
        const query = `
            SELECT AVG(rating) as averageRating
            FROM Review
            WHERE providerID = ? AND (isHidden = FALSE OR isHidden IS NULL)
        `;
        const [rows] = await pool.execute(query, [providerID]);
        const avg = rows[0].averageRating;
        return avg ? parseFloat(avg).toFixed(1) : '0.0';
    }
}

module.exports = Review;