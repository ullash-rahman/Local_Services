import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { dashboardService } from '../../services/dashboardService';
import ServiceRequestList from '../ServiceRequest/ServiceRequestList';
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
    const [complaintView, setComplaintView] = useState(null); // 'my-complaints' or 'against-me'

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
                        {/* Navigation Links */}
                      <div className="dashboard-nav">
                        <Link to="/dashboard/provider" className="nav-link">
                            Dashboard
                        </Link>
                        <Link to="/dashboard/provider/servicebundle" className="nav-link">
                            Service Bundles
                        </Link>
                      </div>
                        <h2>Welcome to Your Dashboard</h2>
                        <p>This is your provider dashboard. Features will be added here.</p>
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
                </div>
            </main>
        </div>
    );
};

export default ProviderDashboard;

