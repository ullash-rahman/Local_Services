const pool = require('../config/database');
const { DatabaseError, mapDatabaseError } = require('../utils/errors');
const { validatorLogger } = require('../utils/logger');

class ReviewValidator {

    static async validateReviewEligibility(customerID, requestID) {
        // Validate input parameters
        if (!customerID || !Number.isInteger(customerID) || customerID <= 0) {
            validatorLogger.warn('Invalid customer ID provided', { customerID });
            return { eligible: false, reason: 'Invalid customer ID' };
        }
        if (!requestID || !Number.isInteger(requestID) || requestID <= 0) {
            validatorLogger.warn('Invalid request ID provided', { requestID });
            return { eligible: false, reason: 'Invalid request ID' };
        }

        try {
            validatorLogger.debug('Validating review eligibility', { customerID, requestID });
            
            // Check if service request exists and get its details
            const serviceQuery = `
                SELECT sr.requestID, sr.customerID, sr.providerID, sr.status
                FROM ServiceRequest sr
                WHERE sr.requestID = ?
            `;
            const [serviceRows] = await pool.execute(serviceQuery, [requestID]);

            if (serviceRows.length === 0) {
                validatorLogger.debug('Service request not found', { requestID });
                return { eligible: false, reason: 'Service request not found' };
            }

            const serviceRequest = serviceRows[0];

            // Check if the customer is the original requester
            if (serviceRequest.customerID !== customerID) {
                validatorLogger.debug('Customer not authorized for this service', { customerID, requestID });
                return { 
                    eligible: false, 
                    reason: 'Only customers who received this service can submit reviews' 
                };
            }

            // Check if service is completed
            if (serviceRequest.status !== 'Completed') {
                validatorLogger.debug('Service not completed', { requestID, status: serviceRequest.status });
                return { 
                    eligible: false, 
                    reason: 'Reviews can only be submitted for completed services' 
                };
            }

            // Check for existing review
            const existingReviewQuery = `
                SELECT reviewID FROM Review 
                WHERE requestID = ? AND customerID = ?
            `;
            const [existingReviews] = await pool.execute(existingReviewQuery, [requestID, customerID]);

            if (existingReviews.length > 0) {
                validatorLogger.debug('Duplicate review attempt', { customerID, requestID });
                return { 
                    eligible: false, 
                    reason: 'You have already reviewed this service' 
                };
            }

            validatorLogger.debug('Review eligibility validated', { customerID, requestID, eligible: true });
            return { 
                eligible: true, 
                providerID: serviceRequest.providerID 
            };
        } catch (error) {
            validatorLogger.error('Database error during eligibility check', error);
            throw mapDatabaseError(error);
        }
    }

    static validateReviewContent(rating, comment) {
        const errors = [];

        // Validate rating
        if (rating === undefined || rating === null) {
            errors.push('Rating is required');
        } else if (!Number.isInteger(rating)) {
            errors.push('Rating must be an integer');
        } else if (rating < 1 || rating > 5) {
            errors.push('Rating must be between 1 and 5 stars');
        }

        // Validate comment if provided
        if (comment !== undefined && comment !== null && comment !== '') {
            // Check for whitespace-only content
            if (typeof comment === 'string' && comment.trim().length === 0) {
                errors.push('Review cannot contain only whitespace');
            }
            // Check length
            if (typeof comment === 'string' && comment.length > 500) {
                errors.push('Review exceeds 500 character limit');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static validateReplyContent(replyText) {
        const errors = [];

        // Reply text is required
        if (replyText === undefined || replyText === null || replyText === '') {
            errors.push('Reply text is required');
            return { valid: false, errors };
        }

        // Check for whitespace-only content
        if (typeof replyText === 'string' && replyText.trim().length === 0) {
            errors.push('Reply cannot contain only whitespace');
        }

        // Check length
        if (typeof replyText === 'string' && replyText.length > 300) {
            errors.push('Reply exceeds 300 character limit');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static async validateReplyPermission(providerID, reviewID) {
        // Validate input parameters
        if (!providerID || !Number.isInteger(providerID) || providerID <= 0) {
            validatorLogger.warn('Invalid provider ID provided', { providerID });
            return { authorized: false, reason: 'Invalid provider ID' };
        }
        if (!reviewID || !Number.isInteger(reviewID) || reviewID <= 0) {
            validatorLogger.warn('Invalid review ID provided', { reviewID });
            return { authorized: false, reason: 'Invalid review ID' };
        }

        try {
            validatorLogger.debug('Validating reply permission', { providerID, reviewID });
            
            // Get review details
            const reviewQuery = `
                SELECT reviewID, providerID, reply
                FROM Review
                WHERE reviewID = ?
            `;
            const [reviewRows] = await pool.execute(reviewQuery, [reviewID]);

            if (reviewRows.length === 0) {
                validatorLogger.debug('Review not found', { reviewID });
                return { authorized: false, reason: 'Review not found' };
            }

            const review = reviewRows[0];

            // Check if provider is the one who delivered the service
            if (review.providerID !== providerID) {
                validatorLogger.debug('Provider not authorized for this review', { providerID, reviewID });
                return { 
                    authorized: false, 
                    reason: 'Only the service provider can reply to this review' 
                };
            }

            // Check if reply already exists
            if (review.reply !== null && review.reply !== '') {
                validatorLogger.debug('Duplicate reply attempt', { providerID, reviewID });
                return { 
                    authorized: false, 
                    reason: 'You have already replied to this review' 
                };
            }

            validatorLogger.debug('Reply permission validated', { providerID, reviewID, authorized: true });
            return { authorized: true };
        } catch (error) {
            validatorLogger.error('Database error during permission check', error);
            throw mapDatabaseError(error);
        }
    }

    static sanitizeContent(text) {
        if (text === null || text === undefined) {
            return null;
        }

        if (typeof text !== 'string') {
            return String(text);
        }

        // Basic HTML entity encoding for common XSS vectors
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .trim();
    }

    static async checkDuplicateReview(customerID, requestID) {
        // Validate input parameters
        if (!customerID || !Number.isInteger(customerID) || customerID <= 0) {
            validatorLogger.warn('Invalid customer ID for duplicate check', { customerID });
            throw new Error('Invalid customer ID');
        }
        if (!requestID || !Number.isInteger(requestID) || requestID <= 0) {
            validatorLogger.warn('Invalid request ID for duplicate check', { requestID });
            throw new Error('Invalid request ID');
        }

        try {
            validatorLogger.debug('Checking for duplicate review', { customerID, requestID });
            
            const query = `
                SELECT reviewID FROM Review 
                WHERE requestID = ? AND customerID = ?
            `;
            const [rows] = await pool.execute(query, [requestID, customerID]);

            if (rows.length > 0) {
                validatorLogger.debug('Duplicate review found', { customerID, requestID, reviewID: rows[0].reviewID });
                return { exists: true, reviewID: rows[0].reviewID };
            }

            return { exists: false };
        } catch (error) {
            validatorLogger.error('Database error during duplicate check', error);
            throw mapDatabaseError(error);
        }
    }
}

module.exports = ReviewValidator;
