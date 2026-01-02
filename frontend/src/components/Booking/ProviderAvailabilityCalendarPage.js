import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import ProviderAvailabilityCalendar from './ProviderAvailabilityCalendar';
import '../Dashboard/Dashboard.css';

const ProviderAvailabilityCalendarPage = () => {
    const navigate = useNavigate();
    const user = authService.getCurrentUser();

    const handleLogout = async () => {
        await authService.logout();
        navigate('/login');
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>Provider Dashboard</h1>
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
                        <Link to="/dashboard/provider/availability" className="nav-link active">
                            Availability Calendar
                        </Link>
                        <Link to="/gamification" className="nav-link">
                            Gamification
                        </Link>
                    </div>

                    <ProviderAvailabilityCalendar />
                </div>
            </main>
        </div>
    );
};

export default ProviderAvailabilityCalendarPage;

