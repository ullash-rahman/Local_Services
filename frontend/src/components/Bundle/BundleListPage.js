import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import BundleList from './BundleList';
import '../Dashboard/Dashboard.css';

const BundleListPage = () => {
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
                        <Link to="/dashboard/customer/bundles" className="nav-link active">
                            Browse Bundles
                        </Link>
                        <Link to="/dashboard/customer/manual-bookings" className="nav-link">
                            Manual Bookings
                        </Link>
                    </div>

                    <div className="bundles-section">
                        <h2>Browse Service Bundles</h2>
                        <p>Explore service packages offered by providers</p>
                        <BundleList />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default BundleListPage;

