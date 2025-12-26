import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { dashboardService } from '../../services/dashboardService';
import { reviewService } from '../../services/reviewService';
import ServiceRequestList from '../ServiceRequest/ServiceRequestList';
import ReviewsList from '../Reviews/ReviewsList';
import ChatHeader from '../Chat/ChatHeader';
import NotificationCenter from '../Notifications/NotificationCenter';
import ComplaintSubmission from '../Complaints/ComplaintSubmission';
import ComplaintList from '../Complaints/ComplaintList';
import './Dashboard.css';

const ProviderDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedChatConversation, setSelectedChatConversation] = useState(null);
    const [showComplaintSubmission, setShowComplaintSubmission] = useState(false);
    const [complaintView, setComplaintView] = useState(null);
    const [refreshingAnalytics, setRefreshingAnalytics] = useState(false);

    useEffect(() => {
        // Check authentication
        if (!authService.isAuthenticated()) {
            navigate('/login');
            return;
        }

        const currentUser = authService.getCurrentUser();
        if (currentUser && currentUser.role !== 'Provider') {
            navigate('/login');
            return;
        }

        setUser(currentUser);
        loadDashboardData();

        // Initialize Socket.io for real-time review notifications
        reviewService.initializeSocket();
        
        // Subscribe to new review notifications
        const unsubscribe = reviewService.onNewReview((data) => {
            console.log('New review received:', data);
            loadDashboardData();
        });

        return () => {
            unsubscribe();
            reviewService.disconnectSocket();
        };
    }, [navigate]);

    const loadDashboardData = async () => {
        try {
            const response = await dashboardService.getProviderDashboard();
            if (response.success) {
                setDashboardData(response.data);
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshAnalytics = async () => {
        if (!user?.userID || refreshingAnalytics) return;
        
        setRefreshingAnalytics(true);
        try {
            await reviewService.refreshAnalytics(user.userID);
            await loadDashboardData();
        } catch (error) {
            console.error('Error refreshing analytics:', error);
        } finally {
            setRefreshingAnalytics(false);
        }
    };

    const handleLogout = async () => {
        await authService.logout();
        navigate('/login');
    };

    const renderStarRating = (rating) => {
        const numRating = parseFloat(rating) || 0;
        const fullStars = Math.floor(numRating);
        const hasHalfStar = numRating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        return (
            <span className="star-rating">
                {'★'.repeat(fullStars)}
                {hasHalfStar && '½'}
                {'☆'.repeat(emptyStars)}
            </span>
        );
    };

    if (loading) {
        return <div className="dashboard-loading">Loading...</div>;
    }

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>Provider Dashboard</h1>
                    <div className="header-actions">
                        <ChatHeader initialConversation={selectedChatConversation} />
                        <NotificationCenter />
                        <span className="user-name">Welcome, {user?.name}</span>
                        <button onClick={handleLogout} className="btn-logout">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="dashboard-main">
                <div className="dashboard-content">
                    <div className="welcome-section">
                        <div className="dashboard-nav">
                            <Link to="/dashboard/provider" className="nav-link">
                                Dashboard
                            </Link>
                            <Link to="/dashboard/provider/servicebundle" className="nav-link">
                                Service Bundles
                            </Link>
                            <Link to="/dashboard/provider/analytics" className="nav-link">
                                Analytics
                            </Link>
                            <Link to="/dashboard/provider/manual-bookings" className="nav-link">
                                Manual Bookings
                            </Link>
                            <Link to="/dashboard/provider/availability" className="nav-link">
                                Availability Calendar
                            </Link>
                            <Link to="/gamification" className="nav-link">
                                Gamification
                            </Link>
                        </div>
                        <h2>Welcome to Your Dashboard</h2>
                        <p>Manage your services and track your performance.</p>
                    </div>

                    {dashboardData && (
                        <div className="stats-section">
                            <div className="stat-card">
                                <h3>Pending Requests</h3>
                                <p className="stat-value">{dashboardData.stats.pendingRequests}</p>
                            </div>
                            <div className="stat-card">
                                <h3>Active Jobs</h3>
                                <p className="stat-value">{dashboardData.stats.activeJobs}</p>
                            </div>
                            <div className="stat-card">
                                <h3>Completed Jobs</h3>
                                <p className="stat-value">{dashboardData.stats.completedJobs}</p>
                            </div>
                            <div className="stat-card">
                                <h3>Total Earnings</h3>
                                <p className="stat-value">${dashboardData.stats.totalEarnings}</p>
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: '30px' }}>
                        <ServiceRequestList 
                            userRole="Provider" 
                            onStartChat={(conversation) => setSelectedChatConversation(conversation)}
                        />
                    </div>

                    {/* Complaints Section */}
                    <div style={{ marginBottom: '30px' }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '20px'
                        }}>
                            <h2 style={{ margin: 0 }}>Complaints</h2>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {!showComplaintSubmission && (
                                    <button
                                        onClick={() => setShowComplaintSubmission(true)}
                                        className="btn-create-request"
                                        style={{
                                            padding: '10px 20px',
                                            background: 'linear-gradient(135deg, #5a9fd4 0%, #4a8bc2 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '500'
                                        }}
                                    >
                                        Submit Complaint
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setComplaintView(complaintView === 'my-complaints' ? null : 'my-complaints');
                                        setShowComplaintSubmission(false);
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        background: complaintView === 'my-complaints' ? '#4a8bc2' : '#e0e0e0',
                                        color: complaintView === 'my-complaints' ? 'white' : '#333',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500'
                                    }}
                                >
                                    My Complaints
                                </button>
                                <button
                                    onClick={() => {
                                        setComplaintView(complaintView === 'against-me' ? null : 'against-me');
                                        setShowComplaintSubmission(false);
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        background: complaintView === 'against-me' ? '#4a8bc2' : '#e0e0e0',
                                        color: complaintView === 'against-me' ? 'white' : '#333',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500'
                                    }}
                                >
                                    Complaints Against Me
                                </button>
                            </div>
                        </div>

                        {showComplaintSubmission && (
                            <ComplaintSubmission
                                onSuccess={() => setShowComplaintSubmission(false)}
                                onCancel={() => setShowComplaintSubmission(false)}
                            />
                        )}

                        {complaintView === 'my-complaints' && (
                            <ComplaintList viewType="my-complaints" />
                        )}

                        {complaintView === 'against-me' && (
                            <ComplaintList viewType="against-me" />
                        )}
                    </div>

                    {/* Review Analytics Section */}
                    {dashboardData?.reviewAnalytics && (
                        <div className="review-analytics-section">
                            <div className="section-header">
                                <h3>Review Analytics</h3>
                                <button 
                                    className="btn-refresh-analytics"
                                    onClick={handleRefreshAnalytics}
                                    disabled={refreshingAnalytics}
                                >
                                    {refreshingAnalytics ? 'Refreshing...' : 'Refresh'}
                                </button>
                            </div>
                            
                            <div className="analytics-overview">
                                <div className="analytics-card rating-card">
                                    <h4>Average Rating</h4>
                                    <div className="rating-display">
                                        <span className="rating-value">
                                            {reviewService.formatRating(dashboardData.reviewAnalytics.averageRating)}
                                        </span>
                                        {renderStarRating(dashboardData.reviewAnalytics.averageRating)}
                                    </div>
                                </div>
                                
                                <div className="analytics-card counts-card">
                                    <h4>Review Counts</h4>
                                    <div className="counts-grid">
                                        <div className="count-item">
                                            <span className="count-value">
                                                {dashboardData.reviewAnalytics.reviewCounts?.last30Days || 0}
                                            </span>
                                            <span className="count-label">Last 30 Days</span>
                                        </div>
                                        <div className="count-item">
                                            <span className="count-value">
                                                {dashboardData.reviewAnalytics.reviewCounts?.last6Months || 0}
                                            </span>
                                            <span className="count-label">Last 6 Months</span>
                                        </div>
                                        <div className="count-item">
                                            <span className="count-value">
                                                {dashboardData.reviewAnalytics.reviewCounts?.allTime || 0}
                                            </span>
                                            <span className="count-label">All Time</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {dashboardData.reviewAnalytics.satisfaction?.eligible && (
                                    <div className="analytics-card satisfaction-card">
                                        <h4>Customer Satisfaction</h4>
                                        <div className="satisfaction-display">
                                            <span className="satisfaction-value">
                                                {dashboardData.reviewAnalytics.satisfaction.satisfactionPercentage}%
                                            </span>
                                            <span className="satisfaction-label">4+ Star Reviews</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {dashboardData.reviewAnalytics.ratingDistribution && (
                                <div className="rating-distribution">
                                    <h4>Rating Distribution</h4>
                                    <div className="distribution-bars">
                                        {[5, 4, 3, 2, 1].map(rating => {
                                            const count = dashboardData.reviewAnalytics.ratingDistribution[rating] || 0;
                                            const total = Object.values(dashboardData.reviewAnalytics.ratingDistribution)
                                                .reduce((sum, c) => sum + c, 0);
                                            const percentage = total > 0 ? (count / total) * 100 : 0;
                                            
                                            return (
                                                <div key={rating} className="distribution-row">
                                                    <span className="rating-label">{rating} ★</span>
                                                    <div className="bar-container">
                                                        <div 
                                                            className="bar-fill" 
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                    <span className="count-label">{count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {dashboardData.reviewAnalytics.trends && dashboardData.reviewAnalytics.trends.length > 0 && (
                                <div className="rating-trends">
                                    <h4>Rating Trends (Last 6 Months)</h4>
                                    <div className="trends-chart">
                                        {dashboardData.reviewAnalytics.trends.map((trend, index) => (
                                            <div key={index} className="trend-item">
                                                <div className="trend-bar-container">
                                                    <div 
                                                        className="trend-bar" 
                                                        style={{ height: `${(parseFloat(trend.averageRating) / 5) * 100}%` }}
                                                    >
                                                        <span className="trend-value">{trend.averageRating}</span>
                                                    </div>
                                                </div>
                                                <span className="trend-label">
                                                    {new Date(trend.month + '-01').toLocaleDateString('en-US', { 
                                                        month: 'short' 
                                                    })}
                                                </span>
                                                <span className="trend-count">{trend.reviewCount} reviews</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {user?.userID && (
                        <div style={{ marginTop: '30px' }}>
                            <ReviewsList providerID={user.userID} showReplyForm={true} />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ProviderDashboard;

