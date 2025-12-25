import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { dashboardService } from '../../services/dashboardService';
import { reviewService } from '../../services/reviewService';
import CreateServiceRequest from '../ServiceRequest/CreateServiceRequest';
import ServiceRequestList from '../ServiceRequest/ServiceRequestList';
import ChatHeader from '../Chat/ChatHeader';
import NotificationCenter from '../Notifications/NotificationCenter';
import ComplaintSubmission from '../Complaints/ComplaintSubmission';
import ComplaintList from '../Complaints/ComplaintList';
import './Dashboard.css';

const CustomerDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showCreateRequest, setShowCreateRequest] = useState(false);
    const [selectedChatConversation, setSelectedChatConversation] = useState(null);
    const [showComplaintSubmission, setShowComplaintSubmission] = useState(false);
    const [complaintView, setComplaintView] = useState(null); // 'my-complaints' or 'against-me'

    useEffect(() => {
        // Check authentication
        if (!authService.isAuthenticated()) {
            navigate('/login');
            return;
        }

        const currentUser = authService.getCurrentUser();
        if (currentUser && currentUser.role !== 'Customer') {
            navigate('/login');
            return;
        }

        setUser(currentUser);
        loadDashboardData();

        // Initialize Socket.io for real-time review notifications
        // Requirements: 2.5 (provider reply notifications)
        reviewService.initializeSocket();
        
        // Subscribe to review reply notifications and content moderation notifications
        const unsubscribe = reviewService.subscribeToReviewNotifications({
            onReviewReply: (data) => {
                console.log('Provider replied to your review:', data);
                // Could show a toast notification here
            },
            onContentModerated: (data) => {
                console.log('Your content was moderated:', data);
                // Could show a toast notification here
            }
        });

        // Cleanup on unmount
        return () => {
            unsubscribe();
            reviewService.disconnectSocket();
        };
    }, [navigate]);

    const loadDashboardData = async () => {
        try {
            const response = await dashboardService.getCustomerDashboard();
            if (response.success) {
                setDashboardData(response.data);
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await authService.logout();
        navigate('/login');
    };

    if (loading) {
        return <div className="dashboard-loading">Loading...</div>;
    }

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>Customer Dashboard</h1>
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
                    {/* Navigation Links */}
                    <div className="dashboard-nav">
                        <Link to="/dashboard/customer" className="nav-link">
                            Dashboard
                        </Link>
                        <Link to="/dashboard/customer/bundles" className="nav-link">
                            Browse Bundles
                        </Link>
                    </div>
                    <div className="welcome-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                        <h2>Welcome to Your Dashboard</h2>
                        <p>This is your customer dashboard. Features will be added here.</p>
                            </div>
                            {!showCreateRequest && (
                                <button 
                                    onClick={() => setShowCreateRequest(true)}
                                    className="btn-create-request"
                                    style={{
                                        padding: '12px 24px',
                                        background: 'linear-gradient(135deg, #5a9fd4 0%, #4a8bc2 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        transition: 'all 0.3s'
                                    }}
                                >
                                    + Create Service Request
                                </button>
                            )}
                        </div>
                    </div>

                    {showCreateRequest && (
                        <div style={{ marginBottom: '30px' }}>
                            <CreateServiceRequest
                                onSuccess={(request) => {
                                    setShowCreateRequest(false);
                                    // Reload dashboard data to update stats
                                    loadDashboardData();
                                }}
                                onCancel={() => setShowCreateRequest(false)}
                            />
                        </div>
                    )}

                    {!showCreateRequest && !showComplaintSubmission && complaintView === null && (
                        <div style={{ marginBottom: '30px' }}>
                            <ServiceRequestList userRole="Customer" />
                        </div>
                    )}

                    {/* Complaints Section */}
                    {!showCreateRequest && (
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
                                    onSuccess={() => {
                                        setShowComplaintSubmission(false);
                                    }}
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
                    )}

                    {dashboardData && (
                        <div className="stats-section">
                            <div className="stat-card">
                                <h3>Active Requests</h3>
                                <p className="stat-value">{dashboardData.stats.activeRequests}</p>
                            </div>
                            <div className="stat-card">
                                <h3>Completed Services</h3>
                                <p className="stat-value">{dashboardData.stats.completedServices}</p>
                            </div>
                            <div className="stat-card">
                                <h3>Pending Payments</h3>
                                <p className="stat-value">{dashboardData.stats.pendingPayments}</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default CustomerDashboard;

