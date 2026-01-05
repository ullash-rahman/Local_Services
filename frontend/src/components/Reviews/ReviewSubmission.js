import React, { useState } from 'react';
import { reviewService } from '../../services/reviewService';
import './Reviews.css';

/**
 * ReviewSubmission - Component for customers to submit reviews after service completion
 * Props:
 * - requestID: The service request ID to review
 * - providerName: Name of the provider being reviewed
 * - onSuccess: Callback when review is submitted successfully
 * - onCancel: Callback to close the form
 */
const ReviewSubmission = ({ requestID, providerName, onSuccess, onCancel }) => {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (rating === 0) {
            setError('Please select a rating');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            const response = await reviewService.submitReview({
                requestID,
                rating,
                comment: comment.trim() || null
            });

            if (response.success) {
                if (onSuccess) {
                    onSuccess(response.data.review);
                }
            }
        } catch (err) {
            console.error('Error submitting review:', err);
            setError(err.response?.data?.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const renderStarSelector = () => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <button
                    key={i}
                    type="button"
                    className={`star-btn ${i <= (hoverRating || rating) ? 'filled' : 'empty'}`}
                    onClick={() => setRating(i)}
                    onMouseEnter={() => setHoverRating(i)}
                    onMouseLeave={() => setHoverRating(0)}
                >
                    {i <= (hoverRating || rating) ? '★' : '☆'}
                </button>
            );
        }
        return stars;
    };

    const getRatingText = () => {
        const texts = {
            1: 'Poor',
            2: 'Fair',
            3: 'Good',
            4: 'Very Good',
            5: 'Excellent'
        };
        return texts[hoverRating || rating] || 'Select rating';
    };

    return (
        <div className="review-submission-container">
            <div className="review-submission-header">
                <h3>Leave a Review</h3>
                {providerName && (
                    <p className="provider-info">Rate your experience with {providerName}</p>
                )}
            </div>

            <form onSubmit={handleSubmit} className="review-form">
                <div className="rating-selector">
                    <label>Your Rating:</label>
                    <div className="stars-selector">
                        {renderStarSelector()}
                    </div>
                    <span className="rating-text">{getRatingText()}</span>
                </div>

                <div className="comment-section">
                    <label htmlFor="review-comment">Your Review (Optional):</label>
                    <textarea
                        id="review-comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Share your experience with this service..."
                        maxLength={500}
                        rows={4}
                    />
                    <span className="char-count">{comment.length}/500</span>
                </div>

                {error && (
                    <div className="review-error">
                        {error}
                    </div>
                )}

                <div className="review-actions">
                    <button
                        type="button"
                        className="btn-cancel"
                        onClick={onCancel}
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn-submit-review"
                        disabled={submitting || rating === 0}
                    >
                        {submitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ReviewSubmission;
