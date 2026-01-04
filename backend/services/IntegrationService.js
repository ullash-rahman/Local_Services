/**
 * IntegrationService - Coordinates cross-feature updates across the platform
 * 
 * This service ensures that when data changes in one feature, all dependent
 * features are automatically updated, providing users with consistent and
 * real-time information.
 */

const pool = require('../config/database');
const Gamification = require('../models/Gamification');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const { analyticsLogger } = require('../utils/logger');

// Points calculation constants (from design document)
const POINTS = {
    // Review-based points
    REVIEW_BASE: 10,
    REVIEW_RATING_MULTIPLIER: 5,  // rating * 5
    REVIEW_REPLY_BONUS: 5,
    
    // Payment-based points
    PAYMENT_BASE: 15,
    PAYMENT_AMOUNT_DIVISOR: 100,  // amount / 100
    PAYMENT_MAX_BONUS: 50,
    
    // Badge thresholds
    BADGES: {
        CENTAURION: 100,      // 100 total points
        ELITE_WORKER: 500,    // 500 total points
        MASTER_PROVIDER: 1000 // 1000 total points
    }
};

// Notification event types for Socket.io
const NOTIFICATION_EVENTS = {
    PAYMENT_STATUS_UPDATE: 'payment_status_update',
    PAYMENT_UPDATE: 'payment_update',
    REVIEW_RECEIVED: 'review_received',
    REVIEW_REPLY: 'review_reply',
    BADGE_EARNED: 'badge_earned',
    RANK_CHANGED: 'rank_changed'
};

class IntegrationService {

    /**
     * Calculate points for a payment
     * Formula: base 15 + min(floor(amount/100), 50)
     * @param {number} amount - Payment amount
     * @returns {number} Points to award
     */
    static calculatePaymentPoints(amount) {
        const bonus = Math.min(Math.floor(amount / POINTS.PAYMENT_AMOUNT_DIVISOR), POINTS.PAYMENT_MAX_BONUS);
        return POINTS.PAYMENT_BASE + bonus;
    }

    /**
     * Calculate points for a review
     * Formula: base 10 + (rating * 5)
     * @param {number} rating - Review rating (1-5)
     * @returns {number} Points to award
     */
    static calculateReviewPoints(rating) {
        return POINTS.REVIEW_BASE + (rating * POINTS.REVIEW_RATING_MULTIPLIER);
    }

    /**
     * Handle payment completion event
     * Triggers: Earnings update, Analytics refresh, Gamification points
     * @param {number} paymentID - The completed payment ID
     * @param {number} providerID - The provider who received payment
     * @param {number} amount - Payment amount
     * @returns {Promise<Object>} Results of all triggered updates
     */
    static async onPaymentCompleted(paymentID, providerID, amount) {
        const results = {
            paymentID,
            providerID,
            amount,
            updates: []
        };

        try {
            analyticsLogger.info('Processing payment completion', { paymentID, providerID, amount });

            // 1. Award gamification points for payment
            try {
                const points = this.calculatePaymentPoints(amount);
                await Gamification.createOrUpdate(providerID);
                await Gamification.addPoints(providerID, points);
                results.updates.push({ 
                    feature: 'gamification', 
                    status: 'success', 
                    pointsAwarded: points 
                });
                analyticsLogger.debug('Gamification points awarded', { providerID, points });
            } catch (error) {
                analyticsLogger.error('Failed to award gamification points', { providerID, error: error.message });
                results.updates.push({ 
                    feature: 'gamification', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            // 2. Refresh analytics cache (earnings are automatically updated via Payment table)
            try {
                // The earnings dashboard queries Payment table directly,
                // so no explicit refresh is needed. We just log the event.
                await this.logIntegrationEvent('payment_completed', paymentID, providerID, null, {
                    amount,
                    paymentDate: new Date().toISOString()
                });
                results.updates.push({ 
                    feature: 'analytics', 
                    status: 'success' 
                });
            } catch (error) {
                analyticsLogger.error('Failed to log analytics event', { providerID, error: error.message });
                results.updates.push({ 
                    feature: 'analytics', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            // 3. Check for earnings milestones and award badges
            try {
                await this.checkEarningsMilestones(providerID);
                results.updates.push({ 
                    feature: 'badges', 
                    status: 'success' 
                });
            } catch (error) {
                analyticsLogger.error('Failed to check earnings milestones', { providerID, error: error.message });
                results.updates.push({ 
                    feature: 'badges', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            // 4. Emit real-time notification
            try {
                await this.emitPaymentNotification(paymentID, providerID, amount);
                results.updates.push({ 
                    feature: 'notification', 
                    status: 'success' 
                });
            } catch (error) {
                analyticsLogger.error('Failed to emit payment notification', { providerID, error: error.message });
                results.updates.push({ 
                    feature: 'notification', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            analyticsLogger.info('Payment completion processed', { paymentID, results });
            return results;
        } catch (error) {
            analyticsLogger.error('Error processing payment completion', { paymentID, error: error.message });
            throw error;
        }
    }

    /**
     * Check and award earnings milestone badges
     * @param {number} providerID - Provider ID
     */
    static async checkEarningsMilestones(providerID) {
        // Get total earnings for the provider
        const query = `
            SELECT COALESCE(SUM(p.amount), 0) as totalEarnings
            FROM Payment p
            JOIN ServiceRequest sr ON p.requestID = sr.requestID
            WHERE sr.providerID = ? AND p.status IN ('Paid', 'Completed')
        `;
        const [rows] = await pool.execute(query, [providerID]);
        const totalEarnings = parseFloat(rows[0].totalEarnings) || 0;

        // Check milestones and award badges
        const milestones = [
            { threshold: 1000, badge: 'earnings_1k' },
            { threshold: 5000, badge: 'earnings_5k' },
            { threshold: 10000, badge: 'earnings_10k' }
        ];

        const gamificationData = await Gamification.getGamificationData(providerID);
        const currentBadges = gamificationData.badgesEarned || [];

        for (const milestone of milestones) {
            if (totalEarnings >= milestone.threshold && !currentBadges.includes(milestone.badge)) {
                // Award the badge
                currentBadges.push(milestone.badge);
                const tableName = await Gamification.getTableName();
                await pool.execute(
                    `UPDATE ${tableName} SET badges = ? WHERE userID = ?`,
                    [JSON.stringify(currentBadges), providerID]
                );

                // Emit badge earned notification
                this.emitBadgeNotification(providerID, milestone.badge, currentBadges.length);
            }
        }
    }

    /**
     * Emit payment notification via Socket.io
     * @param {number} paymentID - Payment ID
     * @param {number} providerID - Provider ID
     * @param {number} amount - Payment amount
     */
    static async emitPaymentNotification(paymentID, providerID, amount) {
        // Get payment details for customer notification
        const payment = await Payment.findById(paymentID);
        if (!payment) return;

        const customerID = payment.customerID;

        // Create database notification for customer
        await Notification.create({
            userID: customerID,
            requestID: payment.requestID,
            message: `Your payment of ৳${amount} has been marked as paid`,
            notificationType: 'payment'
        });

        // Emit Socket.io event if available
        if (global.io) {
            global.io.to(`user_${customerID}`).emit(NOTIFICATION_EVENTS.PAYMENT_STATUS_UPDATE, {
                paymentID,
                status: 'Paid',
                amount,
                message: `Payment of ৳${amount} completed`
            });

            global.io.to(`user_${providerID}`).emit(NOTIFICATION_EVENTS.PAYMENT_UPDATE, {
                paymentID,
                status: 'Paid',
                amount,
                message: `You received a payment of ৳${amount}`
            });
        }
    }

    /**
     * Emit badge earned notification
     * @param {number} providerID - Provider ID
     * @param {string} badgeName - Badge name
     * @param {number} totalBadges - Total badges count
     */
    static async emitBadgeNotification(providerID, badgeName, totalBadges) {
        // Create database notification
        await Notification.create({
            userID: providerID,
            message: `Congratulations! You earned the "${badgeName}" badge!`,
            notificationType: 'badge'
        });

        // Emit Socket.io event if available
        if (global.io) {
            global.io.to(`user_${providerID}`).emit(NOTIFICATION_EVENTS.BADGE_EARNED, {
                badgeName,
                totalBadges,
                message: `You earned the "${badgeName}" badge!`
            });
        }
    }

    /**
     * Log integration event for audit and retry purposes
     * @param {string} eventType - Type of event
     * @param {number} sourceID - Source record ID
     * @param {number} providerID - Provider ID
     * @param {number|null} customerID - Customer ID (optional)
     * @param {Object} metadata - Additional event data
     */
    static async logIntegrationEvent(eventType, sourceID, providerID, customerID = null, metadata = {}) {
        try {
            // Check if IntegrationEvent table exists
            const [tables] = await pool.query(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'IntegrationEvent'
            `);

            if (tables[0].count > 0) {
                const query = `
                    INSERT INTO IntegrationEvent (eventType, sourceID, providerID, customerID, metadata, status)
                    VALUES (?, ?, ?, ?, ?, 'processed')
                `;
                await pool.execute(query, [eventType, sourceID, providerID, customerID, JSON.stringify(metadata)]);
            }
        } catch (error) {
            // Log but don't throw - this is non-critical
            analyticsLogger.warn('Failed to log integration event', { eventType, sourceID, error: error.message });
        }
    }


    /**
     * Handle review submission event
     * Triggers: Analytics cache update, Gamification points, Notification
     * @param {number} reviewID - The new review ID
     * @param {number} providerID - The reviewed provider
     * @param {number} rating - Review rating (1-5)
     * @returns {Promise<Object>} Results of all triggered updates
     */
    static async onReviewSubmitted(reviewID, providerID, rating) {
        const results = {
            reviewID,
            providerID,
            rating,
            updates: []
        };

        try {
            analyticsLogger.info('Processing review submission', { reviewID, providerID, rating });

            // 1. Award gamification points for review
            try {
                const points = this.calculateReviewPoints(rating);
                await Gamification.createOrUpdate(providerID);
                await Gamification.addPoints(providerID, points);
                results.updates.push({ 
                    feature: 'gamification', 
                    status: 'success', 
                    pointsAwarded: points 
                });
                analyticsLogger.debug('Review points awarded', { providerID, points, rating });
            } catch (error) {
                analyticsLogger.error('Failed to award review points', { providerID, error: error.message });
                results.updates.push({ 
                    feature: 'gamification', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            // 2. Update analytics cache
            try {
                await Review.updateAnalyticsCache(providerID);
                results.updates.push({ 
                    feature: 'analytics', 
                    status: 'success' 
                });
                analyticsLogger.debug('Analytics cache updated', { providerID });
            } catch (error) {
                analyticsLogger.error('Failed to update analytics cache', { providerID, error: error.message });
                results.updates.push({ 
                    feature: 'analytics', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            // 3. Check badges after points update
            try {
                await Gamification.checkBadges(providerID);
                results.updates.push({ 
                    feature: 'badges', 
                    status: 'success' 
                });
            } catch (error) {
                analyticsLogger.error('Failed to check badges', { providerID, error: error.message });
                results.updates.push({ 
                    feature: 'badges', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            // 4. Emit real-time notification to provider
            try {
                await this.emitReviewNotification(reviewID, providerID, rating);
                results.updates.push({ 
                    feature: 'notification', 
                    status: 'success' 
                });
            } catch (error) {
                analyticsLogger.error('Failed to emit review notification', { providerID, error: error.message });
                results.updates.push({ 
                    feature: 'notification', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            // 5. Log integration event
            try {
                const review = await Review.findById(reviewID);
                await this.logIntegrationEvent('review_submitted', reviewID, providerID, review?.customerID, {
                    rating,
                    submittedAt: new Date().toISOString()
                });
            } catch (error) {
                analyticsLogger.warn('Failed to log review event', { reviewID, error: error.message });
            }

            analyticsLogger.info('Review submission processed', { reviewID, results });
            return results;
        } catch (error) {
            analyticsLogger.error('Error processing review submission', { reviewID, error: error.message });
            throw error;
        }
    }

    /**
     * Emit review notification via Socket.io
     * @param {number} reviewID - Review ID
     * @param {number} providerID - Provider ID
     * @param {number} rating - Review rating
     */
    static async emitReviewNotification(reviewID, providerID, rating) {
        const review = await Review.findById(reviewID);
        if (!review) return;

        const customerName = review.customerName || 'A customer';

        // Create database notification for provider
        await Notification.create({
            userID: providerID,
            requestID: review.requestID,
            message: `${customerName} left you a ${rating}-star review`,
            notificationType: 'review'
        });

        // Emit Socket.io event if available
        if (global.io) {
            global.io.to(`user_${providerID}`).emit(NOTIFICATION_EVENTS.REVIEW_RECEIVED, {
                reviewID,
                rating,
                customerName,
                message: `${customerName} left you a ${rating}-star review`
            });
        }
    }


    /**
     * Handle review reply event
     * Triggers: Gamification points, Notification
     * @param {number} reviewID - The review ID
     * @param {number} providerID - The provider who replied
     * @param {number} customerID - The customer to notify
     * @returns {Promise<Object>} Results of all triggered updates
     */
    static async onReviewReplied(reviewID, providerID, customerID) {
        const results = {
            reviewID,
            providerID,
            customerID,
            updates: []
        };

        try {
            analyticsLogger.info('Processing review reply', { reviewID, providerID, customerID });

            // 1. Award bonus points for engagement
            try {
                await Gamification.createOrUpdate(providerID);
                await Gamification.addPoints(providerID, POINTS.REVIEW_REPLY_BONUS);
                results.updates.push({ 
                    feature: 'gamification', 
                    status: 'success', 
                    pointsAwarded: POINTS.REVIEW_REPLY_BONUS 
                });
                analyticsLogger.debug('Reply bonus points awarded', { providerID, points: POINTS.REVIEW_REPLY_BONUS });
            } catch (error) {
                analyticsLogger.error('Failed to award reply points', { providerID, error: error.message });
                results.updates.push({ 
                    feature: 'gamification', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            // 2. Check badges after points update
            try {
                await Gamification.checkBadges(providerID);
                results.updates.push({ 
                    feature: 'badges', 
                    status: 'success' 
                });
            } catch (error) {
                analyticsLogger.error('Failed to check badges', { providerID, error: error.message });
                results.updates.push({ 
                    feature: 'badges', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            // 3. Emit real-time notification to customer
            try {
                await this.emitReplyNotification(reviewID, providerID, customerID);
                results.updates.push({ 
                    feature: 'notification', 
                    status: 'success' 
                });
            } catch (error) {
                analyticsLogger.error('Failed to emit reply notification', { customerID, error: error.message });
                results.updates.push({ 
                    feature: 'notification', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            // 4. Log integration event
            try {
                await this.logIntegrationEvent('review_replied', reviewID, providerID, customerID, {
                    repliedAt: new Date().toISOString()
                });
            } catch (error) {
                analyticsLogger.warn('Failed to log reply event', { reviewID, error: error.message });
            }

            analyticsLogger.info('Review reply processed', { reviewID, results });
            return results;
        } catch (error) {
            analyticsLogger.error('Error processing review reply', { reviewID, error: error.message });
            throw error;
        }
    }

    /**
     * Emit review reply notification via Socket.io
     * @param {number} reviewID - Review ID
     * @param {number} providerID - Provider ID
     * @param {number} customerID - Customer ID
     */
    static async emitReplyNotification(reviewID, providerID, customerID) {
        const review = await Review.findById(reviewID);
        if (!review) return;

        const providerName = review.providerName || 'The provider';

        // Create database notification for customer
        await Notification.create({
            userID: customerID,
            requestID: review.requestID,
            message: `${providerName} replied to your review`,
            notificationType: 'review_reply'
        });

        // Emit Socket.io event if available
        if (global.io) {
            global.io.to(`user_${customerID}`).emit(NOTIFICATION_EVENTS.REVIEW_REPLY, {
                reviewID,
                providerName,
                message: `${providerName} replied to your review`
            });
        }
    }


    /**
     * Handle service completion event
     * Triggers: Payment creation, Review eligibility
     * @param {number} requestID - The completed service request
     * @returns {Promise<Object>} Results of all triggered updates
     */
    static async onServiceCompleted(requestID) {
        const results = {
            requestID,
            updates: []
        };

        try {
            analyticsLogger.info('Processing service completion', { requestID });

            // Get service request details
            const ServiceRequest = require('../models/ServiceRequest');
            const request = await ServiceRequest.findById(requestID);
            
            if (!request) {
                throw new Error(`Service request ${requestID} not found`);
            }

            const { providerID, customerID } = request;

            // 1. Create payment record if not exists
            try {
                const existingPayment = await Payment.findByRequestId(requestID);
                
                if (!existingPayment) {
                    // Calculate default amount based on service category or use a default
                    const defaultAmount = await this.getDefaultServiceAmount(request.category);
                    
                    // Set due date to 7 days from now
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + 7);

                    const paymentID = await Payment.create({
                        requestID,
                        amount: defaultAmount,
                        dueDate: dueDate.toISOString().split('T')[0],
                        status: 'Pending'
                    });

                    results.updates.push({ 
                        feature: 'payment', 
                        status: 'success', 
                        action: 'created',
                        paymentID 
                    });
                    analyticsLogger.debug('Payment record created', { requestID, paymentID });
                } else {
                    results.updates.push({ 
                        feature: 'payment', 
                        status: 'success', 
                        action: 'exists',
                        paymentID: existingPayment.paymentID 
                    });
                    analyticsLogger.debug('Payment record already exists', { requestID, paymentID: existingPayment.paymentID });
                }
            } catch (error) {
                analyticsLogger.error('Failed to create payment record', { requestID, error: error.message });
                results.updates.push({ 
                    feature: 'payment', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            // 2. Notify customer that they can now leave a review
            try {
                await Notification.create({
                    userID: customerID,
                    requestID,
                    message: `Your service has been completed! Please leave a review for your provider.`,
                    notificationType: 'review_eligible'
                });

                // Emit Socket.io event if available
                if (global.io) {
                    global.io.to(`user_${customerID}`).emit('service_completed', {
                        requestID,
                        message: 'Your service has been completed! You can now leave a review.',
                        canReview: true
                    });
                }

                results.updates.push({ 
                    feature: 'notification', 
                    status: 'success' 
                });
            } catch (error) {
                analyticsLogger.error('Failed to send completion notification', { customerID, error: error.message });
                results.updates.push({ 
                    feature: 'notification', 
                    status: 'failed', 
                    error: error.message 
                });
            }

            // 3. Log integration event
            try {
                await this.logIntegrationEvent('service_completed', requestID, providerID, customerID, {
                    completedAt: new Date().toISOString(),
                    category: request.category
                });
            } catch (error) {
                analyticsLogger.warn('Failed to log service completion event', { requestID, error: error.message });
            }

            analyticsLogger.info('Service completion processed', { requestID, results });
            return results;
        } catch (error) {
            analyticsLogger.error('Error processing service completion', { requestID, error: error.message });
            throw error;
        }
    }

    /**
     * Get default service amount based on category
     * @param {string} category - Service category
     * @returns {Promise<number>} Default amount
     */
    static async getDefaultServiceAmount(category) {
        // Try to get average amount from existing payments in this category
        try {
            const query = `
                SELECT AVG(p.amount) as avgAmount
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.category = ? AND p.status IN ('Paid', 'Completed')
            `;
            const [rows] = await pool.execute(query, [category]);
            const avgAmount = parseFloat(rows[0].avgAmount);
            
            if (avgAmount && avgAmount > 0) {
                return Math.round(avgAmount);
            }
        } catch (error) {
            analyticsLogger.warn('Failed to get average amount for category', { category, error: error.message });
        }

        // Default amount if no historical data
        return 500; // 500 BDT default
    }

    /**
     * Check and emit rank change notification if provider enters top 10
     * @param {number} providerID - Provider ID
     */
    static async checkRankChange(providerID) {
        try {
            const ranking = await Gamification.getMonthlyRanking(providerID);
            
            if (ranking.rank <= 10) {
                // Provider is in top 10
                await Notification.create({
                    userID: providerID,
                    message: `Congratulations! You're now ranked #${ranking.rank} this month!`,
                    notificationType: 'rank'
                });

                if (global.io) {
                    global.io.to(`user_${providerID}`).emit(NOTIFICATION_EVENTS.RANK_CHANGED, {
                        newRank: ranking.rank,
                        monthlyPoints: ranking.monthlyPoints,
                        message: `You're now ranked #${ranking.rank} this month!`
                    });
                }
            }
        } catch (error) {
            analyticsLogger.warn('Failed to check rank change', { providerID, error: error.message });
        }
    }
}

// Export the service and constants for testing
module.exports = IntegrationService;
module.exports.POINTS = POINTS;
module.exports.NOTIFICATION_EVENTS = NOTIFICATION_EVENTS;
