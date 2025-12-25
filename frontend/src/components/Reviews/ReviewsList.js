import React, { useState, useEffect, useCallback } from 'react';
import { reviewService } from '../../services/reviewService';
import { authService } from '../../services/authService';
import './Reviews.css';

const ReviewsList = ({ providerID, showReplyForm = true }) => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0
    });
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [submittingReply, setSubmittingReply] = useState(false);
    const [replyError, setReplyError] = useState(null);

    const user = authService.getCurrentUser();
    const isProvider = user?.role === 'Provider';
    const isOwnProfile = user?.userID === providerID;

    // Fetch reviews
    const fetchReviews = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await reviewService.getProviderReviews(providerID, {
                page,
                limit: 5,
                sortBy: 'createdAt',
                sortOrder: 'DESC'
            });

            if (response.success) {
                setReviews(response.data.reviews || []);
                setPagination({
                    currentPage: response.data.pagination?.currentPage || 1,
                    totalPages: response.data.pagination?.totalPages || 1,
                    totalItems: response.data.pagination?.totalItems || 0
                });
            }
        } catch (err) {
            console.error('Error fetching reviews:', err);
            setError('Failed to load reviews');
        } finally {
            setLoading(false);
        }
    }, [providerID]);

    useEffect(() => {
        if (providerID) {
            fetchReviews(1);
        }
    }, [providerID, fetchReviews]);

    // Handle reply submission
    const handleSubmitReply = async (reviewID) => {
        if (!replyText.trim()) {
            setReplyError('Reply cannot be empty');
            return;
        }

        if (replyText.length > 300) {
            setReplyError('Reply must be 300 characters or less');
            return;
        }

        try {
            setSubmittingReply(true);
            setReplyError(null);

            const response = await reviewService.submitReply({
                reviewID,
                replyText: replyText.trim()
            });

            if (response.success) {
                // Update the review in the list with the new reply
                setReviews(prevReviews => 
                    prevReviews.map(review => 
                        review.reviewID === reviewID 
                            ? { ...review, reply: replyText.trim(), replyDate: new Date().toISOString() }
                            : review
                    )
                );
                setReplyingTo(null);
                setReplyText('');
            }
        } catch (err) {
            console.error('Error submitting reply:', err);
            setReplyError(err.response?.data?.message || 'Failed to submit reply');
        } finally {
            setSubmittingReply(false);
        }
    };

    // Render star rating
    const renderStars = (rating) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <span key={i} className={`star ${i <= rating ? 'filled' : 'empty'}`}>
                    {i <= rating ? '★' : '☆'}
                </span>
            );
        }
        return <span className="stars-container">{stars}</span>;
    };

    // Format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading && reviews.length === 0) {
        return (
            <div className="reviews-list-container">
                <h3>Customer Reviews</h3>
                <div className="reviews-loading">Loading reviews...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="reviews-list-container">
                <h3>Customer Reviews</h3>
                <div className="reviews-error">{error}</div>
            </div>
        );
    }

    return (
        <div className="reviews-list-container">
            <div className="reviews-header">
                <h3>Customer Reviews</h3>
                <span className="reviews-count">{pagination.totalItems} reviews</span>
            </div>

            {reviews.length === 0 ? (
                <div className="no-reviews">
                    <span className="no-reviews-icon">📝</span>
                    <p>No reviews yet</p>
                </div>
            ) : (
                <>
                    <div className="reviews-list">
                        {reviews.map(review => (
                            <div key={review.reviewID} className="review-card">
                                <div className="review-header">
                                    <div className="reviewer-info">
                                        <span className="reviewer-name">{review.customerName}</span>
                                        <span className="review-date">{formatDate(review.createdAt)}</span>
                                    </div>
                                    <div className="review-rating">
                                        {renderStars(review.rating)}
                                        <span className="rating-value">{review.rating}.0</span>
                                    </div>
                                </div>

                                {review.comment && (
                                    <div className="review-comment">
                                        <p>{review.comment}</p>
                                    </div>
                                )}

                                {/* Provider Reply */}
                                {review.reply && (
                                    <div className="provider-reply">
                                        <div className="reply-header">
                                            <span className="reply-label">Provider Response</span>
                                            {review.replyDate && (
                                                <span className="reply-date">{formatDate(review.replyDate)}</span>
                                            )}
                                        </div>
                                        <p className="reply-text">{review.reply}</p>
                                    </div>
                                )}

                                {/* Reply Form (only for provider viewing their own reviews) */}
                                {showReplyForm && isProvider && isOwnProfile && !review.reply && (
                                    <div className="reply-section">
                                        {replyingTo === review.reviewID ? (
                                            <div className="reply-form">
                                                <textarea
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    placeholder="Write your reply (max 300 characters)..."
                                                    maxLength={300}
                                                    rows={3}
                                                />
                                                <div className="reply-form-footer">
                                                    <span className="char-count">{replyText.length}/300</span>
                                                    {replyError && <span className="reply-error">{replyError}</span>}
                                                    <div className="reply-actions">
                                                        <button 
                                                            className="btn-cancel"
                                                            onClick={() => {
                                                                setReplyingTo(null);
                                                                setReplyText('');
                                                                setReplyError(null);
                                                            }}
                                                            disabled={submittingReply}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            className="btn-submit-reply"
                                                            onClick={() => handleSubmitReply(review.reviewID)}
                                                            disabled={submittingReply || !replyText.trim()}
                                                        >
                                                            {submittingReply ? 'Submitting...' : 'Submit Reply'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <button 
                                                className="btn-reply"
                                                onClick={() => setReplyingTo(review.reviewID)}
                                            >
                                                Reply to this review
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="reviews-pagination">
                            <button
                                className="pagination-btn"
                                onClick={() => fetchReviews(pagination.currentPage - 1)}
                                disabled={pagination.currentPage === 1 || loading}
                            >
                                ← Previous
                            </button>
                            <span className="pagination-info">
                                Page {pagination.currentPage} of {pagination.totalPages}
                            </span>
                            <button
                                className="pagination-btn"
                                onClick={() => fetchReviews(pagination.currentPage + 1)}
                                disabled={pagination.currentPage === pagination.totalPages || loading}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ReviewsList;
