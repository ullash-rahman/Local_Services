import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { historyService } from '../../services/historyService';
import { authService } from '../../services/authService';
import './JobHistory.css';

const JobHistory = () => {
    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [error, setError] = useState(null);

    useEffect(() => {
        loadJobHistory();
        loadStats();
    }, [statusFilter]);

    const loadJobHistory = async () => {
        try {
            setLoading(true);
            setError(null);
            const status = statusFilter === 'all' ? null : statusFilter;
            const response = await historyService.getJobHistory(status);
            if (response.success) {
                setHistory(response.data.history || []);
            }
        } catch (err) {
            console.error('Error loading job history:', err);
            setError(err.message || 'Failed to load job history');
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const response = await historyService.getJobHistoryStats();
            if (response.success) {
                setStats(response.data.stats);
            }
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getStatusClass = (status) => {
        const statusLower = status?.toLowerCase() || '';
        return `status-badge status-${statusLower}`;
    };

    const user = authService.getCurrentUser();
    const isCustomer = user?.role === 'Customer';

    const dashboardPath = isCustomer ? '/dashboard/customer' : '/dashboard/provider';

    return (
        <div className="job-history-container">
            <div className="job-history-header">
                <Link to={dashboardPath} className="back-link" style={{ marginBottom: '10px', display: 'inline-block' }}>
                    ← Back to Dashboard
                </Link>
                <h2>Job History</h2>
                <p className="header-description">View your completed service jobs and track your service history</p>
            </div>

            {stats && (
                <div className="stats-section">
                    <div className="stat-card">
                        <span className="stat-label">Total Jobs</span>
                        <span className="stat-value">{stats.totalJobs || 0}</span>
                    </div>
                    <div className="stat-card completed">
                        <span className="stat-label">Completed</span>
                        <span className="stat-value">{stats.completedJobs || 0}</span>
                    </div>
                    <div className="stat-card cancelled">
                        <span className="stat-label">Cancelled</span>
                        <span className="stat-value">{stats.cancelledJobs || 0}</span>
                    </div>
                </div>
            )}

            <div className="filter-section">
                <label>Filter by Status:</label>
                <select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="filter-select"
                >
                    <option value="all">All Statuses</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                </select>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading job history...</p>
                </div>
            ) : history.length === 0 ? (
                <div className="empty-state">
                    <p>No job history found</p>
                    <p className="empty-hint">Your completed jobs will appear here</p>
                </div>
            ) : (
                <div className="history-list">
                    {history.map((job) => (
                        <div key={job.jobID} className="history-card">
                            <div className="history-header">
                                <div>
                                    <h3 className="job-category">{job.category}</h3>
                                    <span className={getStatusClass(job.status)}>
                                        {job.status}
                                    </span>
                                </div>
                                <div className="job-date">
                                    {formatDate(job.completionDate)}
                                </div>
                            </div>
                            <div className="history-body">
                                <p className="job-description">{job.description}</p>
                                <div className="job-details">
                                    {isCustomer ? (
                                        <>
                                            <div className="detail-item">
                                                <span className="detail-label">Provider:</span>
                                                <span className="detail-value">{job.providerName}</span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="detail-label">Provider Email:</span>
                                                <span className="detail-value">{job.providerEmail}</span>
                                            </div>
                                            {job.providerPhone && (
                                                <div className="detail-item">
                                                    <span className="detail-label">Provider Phone:</span>
                                                    <span className="detail-value">{job.providerPhone}</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="detail-item">
                                                <span className="detail-label">Customer:</span>
                                                <span className="detail-value">{job.customerName}</span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="detail-label">Customer Email:</span>
                                                <span className="detail-value">{job.customerEmail}</span>
                                            </div>
                                            {job.customerPhone && (
                                                <div className="detail-item">
                                                    <span className="detail-label">Customer Phone:</span>
                                                    <span className="detail-value">{job.customerPhone}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default JobHistory;

