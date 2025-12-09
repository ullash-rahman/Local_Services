import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { dashboardService } from '../../services/dashboardService';
import ServiceRequestList from '../ServiceRequest/ServiceRequestList';
import ChatHeader from '../Chat/ChatHeader';
import NotificationCenter from '../Notifications/NotificationCenter';
import './Dashboard.css';

const ProviderDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedChatConversation, setSelectedChatConversation] = useState(null);

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
            <header className="dashboard-header">j
                <div className="header-content">
                    <h1>Provider Dashboard</h1>
                    <div className="header-actions">
                        <ChatHeader initialConversation={selectedChatConversation} />
                        <NotificationCenter />
                        <span className="user-name">Welcome, <span onClick={() => navigate('/gamification')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>{user?.name}</span></span>
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
                </div>
            </main>
        </div>
    );
};

export default ProviderDashboard;

