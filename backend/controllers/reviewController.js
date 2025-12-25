const Review = require('../models/Review');
const ReviewValidator = require('../services/ReviewValidator');
const ReviewAnalytics = require('../services/ReviewAnalytics');
const Notification = require('../models/Notification');

const submitReview = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const { requestID, rating, comment } = req.body;

        // Validate required fields
        if (!requestID) {
            return res.status(400).json({
                success: false,
                message: 'Service request ID is required'
            });
        }

        // Parse requestID to integer
        const parsedRequestID = parseInt(requestID, 10);
        if (isNaN(parsedRequestID) || parsedRequestID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid service request ID'
            });
        }

        // Validate review eligibility
        const eligibility = await ReviewValidator.validateReviewEligibility(customerID, parsedRequestID);
        if (!eligibility.eligible) {
            // Determine appropriate status code based on reason
            let statusCode = 400;
            if (eligibility.reason === 'Service request not found') {
                statusCode = 404;
            } else if (eligibility.reason === 'Only customers who received this service can submit reviews') {
                statusCode = 403;
            } else if (eligibility.reason === 'You have already reviewed this service') {
                statusCode = 409;
            }
            
            return res.status(statusCode).json({
                success: false,
                message: eligibility.reason
            });
        }

        const contentValidation = ReviewValidator.validateReviewContent(rating, comment);
        if (!contentValidation.valid) {
            return res.status(400).json({
                success: false,
                message: contentValidation.errors[0],
                errors: contentValidation.errors
            });
        }

        // Sanitize comment if provided
        const sanitizedComment = comment ? ReviewValidator.sanitizeContent(comment) : null;

        // Create the review
        const reviewID = await Review.create({
            requestID: parsedRequestID,
            customerID,
            providerID: eligibility.providerID,
            rating,
            comment: sanitizedComment
        });

        // Get the created review for response
        const createdReview = await Review.findById(reviewID);

        // Create notification for provider about new review
        try {
            const User = require('../models/User');
            const customer = await User.findById(customerID);
            
            await Notification.create({
                userID: eligibility.providerID,
                requestID: parsedRequestID,
                message: `${customer.name} left a ${rating}-star review for your service`,
                notificationType: 'review_received'
            });

            // Emit real-time notification via Socket.io if available
            if (global.io) {
                global.io.to(`user_${eligibility.providerID}`).emit('new_notification', {
                    message: `${customer.name} left a ${rating}-star review`,
                    notificationType: 'review_received',
                    requestID: parsedRequestID,
                    reviewID
                });
            }
        } catch (notifError) {
            console.error('Error creating review notification:', notifError);
        }

        // Update analytics cache for the provider
        try {
            await ReviewAnalytics.updateCache(eligibility.providerID);
        } catch (cacheError) {
            console.error('Error updating analytics cache:', cacheError);
        }

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            data: {
                review: createdReview
            }
        });
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while submitting review',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const submitReply = async (req, res) => {
    try {
        const providerID = req.user.userID;
        const { reviewID, replyText } = req.body;

        // Validate required fields
        if (!reviewID) {
            return res.status(400).json({
                success: false,
                message: 'Review ID is required'
            });
        }

        // Parse reviewID to integer
        const parsedReviewID = parseInt(reviewID, 10);
        if (isNaN(parsedReviewID) || parsedReviewID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid review ID'
            });
        }

        // Validate reply content
        const contentValidation = ReviewValidator.validateReplyContent(replyText);
        if (!contentValidation.valid) {
            return res.status(400).json({
                success: false,
                message: contentValidation.errors[0],
                errors: contentValidation.errors
            });
        }

        // Validate reply permission
        const permission = await ReviewValidator.validateReplyPermission(providerID, parsedReviewID);
        if (!permission.authorized) {
            // Determine appropriate status code based on reason
            let statusCode = 400;
            if (permission.reason === 'Review not found') {
                statusCode = 404;
            } else if (permission.reason === 'Only the service provider can reply to this review') {
                statusCode = 403;
            } else if (permission.reason === 'You have already replied to this review') {
                statusCode = 409;
            }
            
            return res.status(statusCode).json({
                success: false,
                message: permission.reason
            });
        }

        // Sanitize reply text
        const sanitizedReplyText = ReviewValidator.sanitizeContent(replyText);

        // Add the reply
        const success = await Review.addReply(parsedReviewID, providerID, sanitizedReplyText);

        if (!success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to submit reply'
            });
        }

        // Get the updated review for response
        const updatedReview = await Review.findById(parsedReviewID);

        // Create notification for customer about provider reply
        try {
            const User = require('../models/User');
            const provider = await User.findById(providerID);
            
            await Notification.create({
                userID: updatedReview.customerID,
                requestID: updatedReview.requestID,
                message: `${provider.name} replied to your review`,
                notificationType: 'review_reply'
            });

            // Emit real-time notification via Socket.io if available
            if (global.io) {
                global.io.to(`user_${updatedReview.customerID}`).emit('new_notification', {
                    message: `${provider.name} replied to your review`,
                    notificationType: 'review_reply',
                    requestID: updatedReview.requestID,
                    reviewID: parsedReviewID
                });
            }
        } catch (notifError) {
            console.error('Error creating reply notification:', notifError);
            // Don't fail the reply submission if notification fails
        }

        res.status(200).json({
            success: true,
            message: 'Reply submitted successfully',
            data: {
                review: updatedReview
            }
        });
    } catch (error) {
        console.error('Submit reply error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while submitting reply',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getProviderReviews = async (req, res) => {
    try {
        const { id: providerID } = req.params;
        
        // Parse and validate provider ID
        const parsedProviderID = parseInt(providerID, 10);
        if (isNaN(parsedProviderID) || parsedProviderID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid provider ID'
            });
        }

        // Get pagination parameters from query string
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const offset = (page - 1) * limit;

        // Get sorting parameters (default: most recent first)
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = (req.query.sortOrder || 'DESC').toUpperCase();

        // Validate sort parameters
        const allowedSortFields = ['createdAt', 'rating'];
        const allowedSortOrders = ['ASC', 'DESC'];
        
        const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const validSortOrder = allowedSortOrders.includes(sortOrder) ? sortOrder : 'DESC';

        // Get reviews with pagination
        const reviews = await Review.findByProvider(parsedProviderID, {
            limit,
            offset,
            sortBy: validSortBy,
            sortOrder: validSortOrder,
            includeHidden: false
        });

        // Get total count for pagination
        const totalReviews = await Review.getTotalReviewCount(parsedProviderID);

        // Get average rating with one decimal precision
        const averageRating = await Review.getAverageRating(parsedProviderID);

        // Format reviews for response
        const formattedReviews = reviews.map(review => ({
            reviewID: review.reviewID,
            rating: review.rating,
            comment: review.comment,
            customerName: review.customerName,
            createdAt: review.createdAt,
            reply: review.reply,
            replyDate: review.replyDate,
            helpfulCount: review.helpfulCount || 0
        }));

        // Build response
        const response = {
            success: true,
            data: {
                providerID: parsedProviderID,
                averageRating: averageRating,                 totalReviews: totalReviews,                   reviews: formattedReviews,                    pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalReviews / limit),
                    totalItems: totalReviews,
                    itemsPerPage: limit,
                    hasNextPage: page < Math.ceil(totalReviews / limit),
                    hasPreviousPage: page > 1
                }
            }
        };

        // Add message for no reviews case
        if (totalReviews === 0) {
            response.data.message = 'No reviews yet';
        }

        res.status(200).json(response);
    } catch (error) {
        console.error('Get provider reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching reviews',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getServiceRequestReview = async (req, res) => {
    try {
        const { id: requestID } = req.params;
        
        // Parse and validate request ID
        const parsedRequestID = parseInt(requestID, 10);
        if (isNaN(parsedRequestID) || parsedRequestID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid service request ID'
            });
        }

        // Get review for the service request
        const review = await Review.findByRequest(parsedRequestID);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'No review found for this service request'
            });
        }

        // Format review for response
        const formattedReview = {
            reviewID: review.reviewID,
            requestID: review.requestID,
            rating: review.rating,
            comment: review.comment,
            customerID: review.customerID,
            customerName: review.customerName,
            providerID: review.providerID,
            providerName: review.providerName,
            createdAt: review.createdAt,
            reply: review.reply,
            replyDate: review.replyDate,
            helpfulCount: review.helpfulCount || 0
        };

        res.status(200).json({
            success: true,
            data: {
                review: formattedReview
            }
        });
    } catch (error) {
        console.error('Get service request review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching review',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getReviewAnalytics = async (req, res) => {
    try {
        const { id: providerID } = req.params;
        
        // Parse and validate provider ID
        const parsedProviderID = parseInt(providerID, 10);
        if (isNaN(parsedProviderID) || parsedProviderID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid provider ID'
            });
        }

        // Check if user is requesting their own analytics or is an admin
        const requestingUserID = req.user?.userID;
        const isOwnAnalytics = requestingUserID === parsedProviderID;
        const isAdmin = req.user?.role === 'Admin';

        // Only allow providers to view their own analytics or admins to view any
        if (!isOwnAnalytics && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'You can only view your own analytics'
            });
        }

        const useCache = req.query.refresh !== 'true';
        const timeframe = req.query.timeframe || '6months';

        const analytics = await ReviewAnalytics.getDashboardAnalytics(parsedProviderID, useCache);

        const trends = await ReviewAnalytics.getRatingTrends(parsedProviderID, timeframe);

        res.status(200).json({
            success: true,
            data: {
                providerID: parsedProviderID,
                averageRating: analytics.averageRating,                           ratingDistribution: analytics.ratingDistribution,                 trends: trends,                                                   reviewCounts: analytics.reviewCounts,                             satisfaction: analytics.satisfaction,                             metadata: {
                    fromCache: analytics.fromCache,
                    generatedAt: analytics.generatedAt,
                    timeframe
                }
            }
        });
    } catch (error) {
        console.error('Get review analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const refreshAnalyticsCache = async (req, res) => {
    try {
        const { id: providerID } = req.params;
        
        // Parse and validate provider ID
        const parsedProviderID = parseInt(providerID, 10);
        if (isNaN(parsedProviderID) || parsedProviderID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid provider ID'
            });
        }

        // Check if user is requesting their own analytics refresh or is an admin
        const requestingUserID = req.user?.userID;
        const isOwnAnalytics = requestingUserID === parsedProviderID;
        const isAdmin = req.user?.role === 'Admin';

        // Only allow providers to refresh their own analytics or admins to refresh any
        if (!isOwnAnalytics && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'You can only refresh your own analytics'
            });
        }

        // Force refresh the analytics cache
        const refreshedAnalytics = await ReviewAnalytics.updateCache(parsedProviderID);

        res.status(200).json({
            success: true,
            message: 'Analytics cache refreshed successfully',
            data: {
                providerID: parsedProviderID,
                averageRating: refreshedAnalytics.averageRating,
                totalReviews: refreshedAnalytics.totalReviews,
                ratingDistribution: refreshedAnalytics.ratingDistribution,
                lastCalculated: refreshedAnalytics.lastCalculated,
                refreshedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Refresh analytics cache error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while refreshing analytics cache',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const flagReview = async (req, res) => {
    try {
        const reporterID = req.user.userID;
        const { reviewID, reason } = req.body;

        // Validate required fields
        if (!reviewID) {
            return res.status(400).json({
                success: false,
                message: 'Review ID is required'
            });
        }

        if (!reason || (typeof reason === 'string' && reason.trim().length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Reason for flagging is required'
            });
        }

        // Parse reviewID to integer
        const parsedReviewID = parseInt(reviewID, 10);
        if (isNaN(parsedReviewID) || parsedReviewID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid review ID'
            });
        }

        // Check if review exists
        const review = await Review.findById(parsedReviewID);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check if review is already hidden
        if (review.isHidden) {
            return res.status(409).json({
                success: false,
                message: 'This review has already been hidden'
            });
        }

        // Sanitize reason
        const sanitizedReason = ReviewValidator.sanitizeContent(reason);

        // Flag the content
        await Review.flagContent(parsedReviewID, sanitizedReason);

        try {
            // Get admin users to notify
            const pool = require('../config/database');
            const [admins] = await pool.execute(
                'SELECT userID FROM USER WHERE role = ?',
                ['Admin']
            );

            for (const admin of admins) {
                await Notification.create({
                    userID: admin.userID,
                    requestID: review.requestID,
                    message: `A review has been flagged for moderation: "${sanitizedReason.substring(0, 50)}..."`,
                    notificationType: 'content_flagged'
                });

                // Emit real-time notification via Socket.io if available
                if (global.io) {
                    global.io.to(`user_${admin.userID}`).emit('new_notification', {
                        message: 'A review has been flagged for moderation',
                        notificationType: 'content_flagged',
                        reviewID: parsedReviewID
                    });
                }
            }
        } catch (notifError) {
            console.error('Error creating flag notification:', notifError);
            // Don't fail the flagging if notification fails
        }

        res.status(200).json({
            success: true,
            message: 'Review has been flagged for moderation',
            data: {
                reviewID: parsedReviewID,
                flaggedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Flag review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while flagging review',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const moderateReview = async (req, res) => {
    try {
        const moderatorID = req.user.userID;
        const { reviewID, action, reason } = req.body;

        // Validate required fields
        if (!reviewID) {
            return res.status(400).json({
                success: false,
                message: 'Review ID is required'
            });
        }

        if (!action) {
            return res.status(400).json({
                success: false,
                message: 'Moderation action is required'
            });
        }

        // Validate action
        const validActions = ['approve', 'hide', 'remove'];
        if (!validActions.includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid moderation action. Must be one of: approve, hide, remove'
            });
        }

        // Require reason for hide/remove actions
        if ((action === 'hide' || action === 'remove') && (!reason || reason.trim().length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Reason is required for hide/remove actions'
            });
        }

        // Parse reviewID to integer
        const parsedReviewID = parseInt(reviewID, 10);
        if (isNaN(parsedReviewID) || parsedReviewID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid review ID'
            });
        }

        // Check if review exists
        const review = await Review.findById(parsedReviewID);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Sanitize reason if provided
        const sanitizedReason = reason ? ReviewValidator.sanitizeContent(reason) : null;

        // Perform moderation action
        await Review.moderateContent(parsedReviewID, action, moderatorID, sanitizedReason);

        // Notify content author if content is hidden/removed
        if (action === 'hide' || action === 'remove') {
            try {
                const actionText = action === 'hide' ? 'hidden' : 'removed';
                await Notification.create({
                    userID: review.customerID,
                    requestID: review.requestID,
                    message: `Your review has been ${actionText} by a moderator. Reason: ${sanitizedReason}`,
                    notificationType: 'content_moderated'
                });

                // Emit real-time notification via Socket.io if available
                if (global.io) {
                    global.io.to(`user_${review.customerID}`).emit('new_notification', {
                        message: `Your review has been ${actionText} by a moderator`,
                        notificationType: 'content_moderated',
                        reviewID: parsedReviewID,
                        reason: sanitizedReason
                    });
                }
            } catch (notifError) {
                console.error('Error creating moderation notification:', notifError);
                // Don't fail the moderation if notification fails
            }
        }

        res.status(200).json({
            success: true,
            message: `Review has been ${action === 'approve' ? 'approved' : action === 'hide' ? 'hidden' : 'removed'}`,
            data: {
                reviewID: parsedReviewID,
                action,
                reason: sanitizedReason,
                moderatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Moderate review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while moderating review',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getFlaggedReviews = async (req, res) => {
    try {
        // Get pagination parameters
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const offset = (page - 1) * limit;
        const status = req.query.status || 'pending';

        // Validate status
        const validStatuses = ['pending', 'all', 'hidden', 'approved'];
        const validStatus = validStatuses.includes(status) ? status : 'pending';

        // Get flagged reviews
        const reviews = await Review.getFlaggedReviews({
            limit,
            offset,
            status: validStatus
        });

        // Get total count for pagination
        const totalCount = await Review.getFlaggedReviewsCount(validStatus);

        // Format reviews for response
        const formattedReviews = reviews.map(review => ({
            reviewID: review.reviewID,
            rating: review.rating,
            comment: review.comment,
            reply: review.reply,
            customerID: review.customerID,
            customerName: review.customerName,
            providerID: review.providerID,
            providerName: review.providerName,
            createdAt: review.createdAt,
            isModerated: review.isModerated,
            isHidden: review.isHidden,
            moderationReason: review.moderationReason,
            moderationCount: review.moderationCount
        }));

        res.status(200).json({
            success: true,
            data: {
                reviews: formattedReviews,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalCount / limit),
                    totalItems: totalCount,
                    itemsPerPage: limit,
                    hasNextPage: page < Math.ceil(totalCount / limit),
                    hasPreviousPage: page > 1
                },
                filter: {
                    status: validStatus
                }
            }
        });
    } catch (error) {
        console.error('Get flagged reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching flagged reviews',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getModerationAuditLogs = async (req, res) => {
    try {
        // Get pagination parameters
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const offset = (page - 1) * limit;

        // Get filter parameters
        const action = req.query.action || null;
        const moderatorID = req.query.moderatorID ? parseInt(req.query.moderatorID, 10) : null;

        // Validate action if provided
        const validActions = ['approve', 'hide', 'remove', 'flag'];
        const validAction = action && validActions.includes(action) ? action : null;

        // Get audit logs
        const logs = await Review.getModerationAuditLogs({
            limit,
            offset,
            action: validAction,
            moderatorID
        });

        // Format logs for response
        const formattedLogs = logs.map(log => ({
            moderationID: log.moderationID,
            reviewID: log.reviewID,
            moderatorID: log.moderatorID,
            moderatorName: log.moderatorName,
            action: log.action,
            reason: log.reason,
            moderatedAt: log.moderatedAt,
            reviewRating: log.rating,
            reviewComment: log.comment,
            reviewAuthorName: log.reviewAuthorName
        }));

        res.status(200).json({
            success: true,
            data: {
                logs: formattedLogs,
                pagination: {
                    currentPage: page,
                    itemsPerPage: limit,
                    hasMore: logs.length === limit
                },
                filters: {
                    action: validAction,
                    moderatorID
                }
            }
        });
    } catch (error) {
        console.error('Get moderation audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching audit logs',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getModerationStats = async (req, res) => {
    try {
        const stats = await Review.getModerationStats();

        res.status(200).json({
            success: true,
            data: {
                pendingCount: stats.pendingCount || 0,
                hiddenCount: stats.hiddenCount || 0,
                approvedCount: stats.approvedCount || 0,
                actionsLast24h: stats.actionsLast24h || 0,
                actionsLast7Days: stats.actionsLast7Days || 0,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Get moderation stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching moderation statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getReviewModerationHistory = async (req, res) => {
    try {
        const { reviewID } = req.params;

        // Parse and validate review ID
        const parsedReviewID = parseInt(reviewID, 10);
        if (isNaN(parsedReviewID) || parsedReviewID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid review ID'
            });
        }

        // Check if review exists
        const review = await Review.findById(parsedReviewID);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Get moderation history
        const history = await Review.getModerationHistory(parsedReviewID);

        // Format history for response
        const formattedHistory = history.map(record => ({
            moderationID: record.moderationID,
            moderatorID: record.moderatorID,
            moderatorName: record.moderatorName,
            action: record.action,
            reason: record.reason,
            moderatedAt: record.moderatedAt
        }));

        res.status(200).json({
            success: true,
            data: {
                reviewID: parsedReviewID,
                review: {
                    rating: review.rating,
                    comment: review.comment,
                    customerName: review.customerName,
                    isHidden: review.isHidden,
                    isModerated: review.isModerated,
                    moderationReason: review.moderationReason
                },
                history: formattedHistory
            }
        });
    } catch (error) {
        console.error('Get review moderation history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching moderation history',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    submitReview,
    submitReply,
    getProviderReviews,
    getServiceRequestReview,
    getReviewAnalytics,
    refreshAnalyticsCache,
    flagReview,
    moderateReview,
    getFlaggedReviews,
    getModerationAuditLogs,
    getModerationStats,
    getReviewModerationHistory
};