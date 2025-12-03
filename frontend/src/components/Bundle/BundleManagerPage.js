import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import BundleManager from './BundleManager';
import '../Dashboard/Dashboard.css';

const BundleManagerPage = () => {
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
                        <Link to="/dashboard/provider/servicebundle" className="nav-link active">
                            Service Bundles
                        </Link>
                    </div>

                    <BundleManager />
                </div>
            </main>
        </div>
    );
};

export default BundleManagerPage;

