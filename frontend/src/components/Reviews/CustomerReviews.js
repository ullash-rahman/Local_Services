import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { reviewService } from '../../services/reviewService';
import NotificationCenter from '../Notifications/NotificationCenter';
import ChatHeader from '../Chat/ChatHeader';
import './CustomerReviews.css';

const CustomerReviews = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0
    });
    const [expandedReview, setExpandedReview] = useState(null);
    const [threadReplies, setThreadReplies] = useState({});
    const [replyText, setReplyText] = useState('');
    const [submittingReply, setSubmittingReply] = useState(false);
    const [replyError, setReplyError] = useState(null);

    useEffect(() => {
        if (!authService.isAuthenticated()) {
            navigate('/login');
            return;
        }

        const currentUser = authService.getCurrentUser();
        if (currentUser?.role !== 'Customer') {
            navigate('/login');
            return;
        }

        setUser(currentUser);
        loadReviews(currentUser.userID);
    }, [navigate]);

    const loadReviews = async (customerID, page = 1) => {
        try {
            setLoading(true);
            setError(null);
            const response = await reviewService.getCustomerReviews(customerID, {
                page,
                limit: 10,
                sortBy: 'createdAt',
                sortOrder: 'DESC'
            });

            if (response.success) {
                setReviews(response.data.reviews || []);
                setPagination(response.data.pagination || {
                    currentPage: 1,
                    totalPages: 1,
                    totalItems: 0
                });
            }
        } catch (err) {
            console.error('Error loading reviews:', err);
            setError('Failed to load reviews');
        } finally {
            setLoading(false);
        }
    };

    const loadReviewThread = async (reviewID) => {
        try {
            const response = await reviewService.getReviewThread(reviewID);
            if (response.success) {
                setThreadReplies(prev => ({
                    ...prev,
                    [reviewID]: response.data.thread || []
                }));
            }
        } catch (err) {
            console.error('Error loading review thread:', err);
        }
    };

    const handleExpandReview = async (reviewID) => {
        if (expandedReview === reviewID) {
            setExpandedReview(null);
        } else {
            setExpandedReview(reviewID);
            if (!threadReplies[reviewID]) {
                await loadReviewThread(reviewID);
            }
        }
        setReplyText('');
        setReplyError(null);
    };

    const handleSubmitReply = async (reviewID) => {
        if (!replyText.trim()) {
            setReplyError('Please enter a reply');
            return;
        }

        try {
            setSubmittingReply(true);
            setReplyError(null);
            
            const response = await reviewService.submitThreadReply(reviewID, replyText.trim());
            
            if (response.success) {
                // Reload the thread to show the new reply
                await loadReviewThread(reviewID);
                setReplyText('');
            }
        } catch (err) {
            console.error('Error submitting reply:', err);
            setReplyError(err.response?.data?.message || 'Failed to submit reply');
        } finally {
            setSubmittingReply(false);
        }
    };

    const handlePageChange = (newPage) => {
        if (user) {
            loadReviews(user.userID, newPage);
        }
    };

    const handleLogout = async () => {
        await authService.logout();
        navigate('/login');
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderStars = (rating) => {
        return '★'.repeat(rating) + '☆'.repeat(5 - rating);
    };

    if (loading && reviews.length === 0) {
        return <div className="reviews-loading">Loading your reviews...</div>;
    }

    return (
        <div className="customer-reviews-container">
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>My Reviews</h1>
                    <div className="header-actions">
                        <ChatHeader />
                        <NotificationCenter />
                        <span className="user-name">Welcome, {user?.name}</span>
                        <button onClick={handleLogout} className="btn-logout">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="reviews-main">
                <div className="reviews-content">
                    <div className="dashboard-nav">
                        <Link to="/dashboard/customer" className="nav-link">Dashboard</Link>
                        <Link to="/dashboard/customer/bundles" className="nav-link">Browse Bundles</Link>
                        <Link to="/dashboard/customer/payments" className="nav-link">Payments</Link>
                        <Link to="/dashboard/customer/reviews" className="nav-link active">My Reviews</Link>
                        <Link to="/dashboard/customer/history" className="nav-link">Job History</Link>
                    </div>

                    <div className="reviews-section">
                        <h2>Reviews You've Written</h2>
                        <p className="reviews-subtitle">
                            See all the reviews you've submitted and continue conversations with providers
                        </p>

                        {error && <div className="error-message">{error}</div>}

                        {reviews.length === 0 ? (
                            <div className="no-reviews">
                                <p>You haven't written any reviews yet.</p>
                                <p>After completing a service, you can leave a review for your provider.</p>
                            </div>
                        ) : (
                            <div className="reviews-list">
                                {reviews.map((review) => (
                                    <div key={review.reviewID} className={`review-card ${expandedReview === review.reviewID ? 'expanded' : ''}`}>
                                        <div className="review-header">
                                            <div className="review-service-info">
                                                <span className="service-category">{review.serviceCategory}</span>
                                                <span className="provider-name">Provider: {review.providerName}</span>
                                            </div>
                                            <div className="review-rating">
                                                <span className="stars">{renderStars(review.rating)}</span>
                                                <span className="rating-number">{review.rating}/5</span>
                                            </div>
                                        </div>

                                        <div className="review-body">
                                            <p className="review-comment">{review.comment || 'No comment provided'}</p>
                                            <span className="review-date">Reviewed on {formatDate(review.createdAt)}</span>
                                        </div>

                                        {/* Provider's initial reply (legacy) */}
                                        {review.reply && (
                                            <div className="provider-reply">
                                                <div className="reply-header">
                                                    <span className="reply-icon">💬</span>
                                                    <span className="reply-label">{review.providerName}'s Response:</span>
                                                    <span className="reply-date">{formatDate(review.replyDate)}</span>
                                                </div>
                                                <p className="reply-text">{review.reply}</p>
                                            </div>
                                        )}

                                        {/* Expand/Collapse button for conversation */}
                                        {review.reply && (
                                            <button 
                                                className="expand-thread-btn"
                                                onClick={() => handleExpandReview(review.reviewID)}
                                            >
                                                {expandedReview === review.reviewID ? '▲ Hide' : '▼ Reply'}
                                            </button>
                                        )}

                                        {/* Expanded conversation thread */}
                                        {expandedReview === review.reviewID && (
                                            <div className="conversation-thread">
                                                {/* Thread replies */}
                                                {threadReplies[review.reviewID]?.length > 0 && (
                                                    <div className="thread-replies">
                                                        {threadReplies[review.reviewID].map((reply) => (
                                                            <div 
                                                                key={reply.replyID} 
                                                                className={`thread-reply ${reply.userRole.toLowerCase()}`}
                                                            >
                                                                <div className="thread-reply-header">
                                                                    <span className="thread-reply-author">
                                                                        {reply.userRole === 'Customer' ? '👤' : '🔧'} {reply.userName}
                                                                    </span>
                                                                    <span className="thread-reply-date">{formatDate(reply.createdAt)}</span>
                                                                </div>
                                                                <p className="thread-reply-text">{reply.replyText}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Reply input */}
                                                <div className="reply-input-section">
                                                    <textarea
                                                        value={replyText}
                                                        onChange={(e) => setReplyText(e.target.value)}
                                                        placeholder="Write your reply..."
                                                        className="reply-textarea"
                                                        maxLength={1000}
                                                        disabled={submittingReply}
                                                    />
                                                    <div className="reply-input-footer">
                                                        <span className="char-count">{replyText.length}/1000</span>
                                                        {replyError && <span className="reply-error">{replyError}</span>}
                                                        <button
                                                            onClick={() => handleSubmitReply(review.reviewID)}
                                                            disabled={submittingReply || !replyText.trim()}
                                                            className="submit-reply-btn"
                                                        >
                                                            {submittingReply ? 'Sending...' : 'Send Reply'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {pagination.totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                                    disabled={!pagination.hasPreviousPage}
                                    className="pagination-btn"
                                >
                                    Previous
                                </button>
                                <span className="pagination-info">
                                    Page {pagination.currentPage} of {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                                    disabled={!pagination.hasNextPage}
                                    className="pagination-btn"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CustomerReviews;
