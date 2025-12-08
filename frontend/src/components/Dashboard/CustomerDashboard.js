import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { dashboardService } from '../../services/dashboardService';
import ConversationsList from '../Chat/ConversationsList';
import Chat from '../Chat/Chat';
import './Dashboard.css';

const CustomerDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedConversation, setSelectedConversation] = useState(null);

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
                        <h2>Welcome to Your Dashboard</h2>
                        <p>This is your customer dashboard. Features will be added here.</p>
                    </div>

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

                    <div className="chat-section">
                        <div className="chat-section-header">
                            <h3>Messages</h3>
                        </div>
                        <div className="chat-layout">
                            <ConversationsList
                                onSelectConversation={setSelectedConversation}
                                selectedRequestID={selectedConversation?.requestID}
                            />
                            {selectedConversation ? (
                                <Chat
                                    requestID={selectedConversation.requestID}
                                    otherUserID={selectedConversation.otherUserID}
                                    otherUserName={selectedConversation.otherUserName}
                                    onClose={() => setSelectedConversation(null)}
                                />
                            ) : (
                                <div className="chat-empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                    <p>Select a conversation to start chatting</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CustomerDashboard;

