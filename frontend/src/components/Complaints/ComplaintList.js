import React, { useState, useEffect } from 'react';
import { complaintService } from '../../services/complaintService';
import ComplaintDetails from './ComplaintDetails';
import './Complaint.css';

const ComplaintList = ({ viewType = 'my-complaints' }) => {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        loadComplaints();
    }, [viewType, statusFilter]);

    const loadComplaints = async () => {
        try {
            setLoading(true);
            setError(null);
            let response;

            if (viewType === 'my-complaints') {
                response = await complaintService.getMyComplaints();
            } else if (viewType === 'against-me') {
                response = await complaintService.getComplaintsAgainstMe();
            } else {
                response = await complaintService.getAllComplaints();
            }

            if (response.success) {
                let filteredComplaints = response.data || [];
                
                // Apply status filter
                if (statusFilter !== 'all') {
                    filteredComplaints = filteredComplaints.filter(
                        complaint => complaint.status === statusFilter
                    );
                }
                
                setComplaints(filteredComplaints);
            } else {
                setError(response.message || 'Failed to load complaints');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to load complaints';
            setError(errorMessage);
            console.error('Error loading complaints:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (complaint) => {
        setSelectedComplaint(complaint);
    };

    const handleCloseDetails = () => {
        setSelectedComplaint(null);
        loadComplaints(); // Refresh list after viewing details
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not specified';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadgeClass = (status) => {
        const statusClasses = {
            'Pending': 'status-pending',
            'Under Review': 'status-under-review',
            'Resolved': 'status-resolved',
            'Dismissed': 'status-dismissed'
        };
        return statusClasses[status] || 'status-default';
    };

    const getViewTitle = () => {
        switch (viewType) {
            case 'my-complaints':
                return 'My Complaints';
            case 'against-me':
                return 'Complaints Against Me';
            case 'all':
                return 'All Complaints';
            default:
                return 'Complaints';
        }
    };

    if (selectedComplaint) {
        return (
            <ComplaintDetails
                complaint={selectedComplaint}
                onClose={handleCloseDetails}
                onRefresh={loadComplaints}
            />
        );
    }

    if (loading) {
        return <div className="complaint-loading">Loading complaints...</div>;
    }

    return (
        <div className="complaint-list-container">
            <div className="complaint-list-header">
                <h2>{getViewTitle()}</h2>
                <div className="complaint-list-controls">
                    <div className="filter-section">
                        <label>Filter by Status:</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="status-filter"
                        >
                            <option value="all">All</option>
                            <option value="Pending">Pending</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Dismissed">Dismissed</option>
                        </select>
                    </div>
                    <button onClick={loadComplaints} className="btn-refresh">
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {complaints.length === 0 ? (
                <div className="empty-complaints">
                    <p>No complaints found.</p>
                    {viewType === 'my-complaints' && (
                        <p className="empty-hint">You haven't submitted any complaints yet.</p>
                    )}
                    {viewType === 'against-me' && (
                        <p className="empty-hint">No complaints have been filed against you.</p>
                    )}
                </div>
            ) : (
                <div className="complaints-grid">
                    {complaints.map((complaint) => (
                        <div key={complaint.complaintID} className="complaint-card">
                            <div className="complaint-header">
                                <h3 className="complaint-id">Complaint #{complaint.complaintID}</h3>
                                <span className={`status-badge ${getStatusBadgeClass(complaint.status)}`}>
                                    {complaint.status}
                                </span>
                            </div>

                            <div className="complaint-body">
                                <p className="complaint-description">
                                    {complaint.description.length > 150
                                        ? `${complaint.description.substring(0, 150)}...`
                                        : complaint.description}
                                </p>

                                <div className="complaint-details">
                                    <div className="detail-item">
                                        <span className="detail-label">Service Category:</span>
                                        <span className="detail-value">
                                            {complaint.serviceCategory || 'N/A'}
                                        </span>
                                    </div>
                                    {viewType === 'my-complaints' && (
                                        <div className="detail-item">
                                            <span className="detail-label">Against:</span>
                                            <span className="detail-value">
                                                {complaint.accusedPartyName || complaint.providerName || 'N/A'}
                                            </span>
                                        </div>
                                    )}
                                    {viewType === 'against-me' && (
                                        <div className="detail-item">
                                            <span className="detail-label">Filed by:</span>
                                            <span className="detail-value">
                                                {complaint.reporterName || 'N/A'}
                                            </span>
                                        </div>
                                    )}
                                    <div className="detail-item">
                                        <span className="detail-label">Submitted:</span>
                                        <span className="detail-value">
                                            {formatDate(complaint.createdAt)}
                                        </span>
                                    </div>
                                    {complaint.resolvedAt && (
                                        <div className="detail-item">
                                            <span className="detail-label">Resolved:</span>
                                            <span className="detail-value">
                                                {formatDate(complaint.resolvedAt)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="complaint-actions">
                                <button
                                    onClick={() => handleViewDetails(complaint)}
                                    className="btn-view-details"
                                >
                                    View Details
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ComplaintList;

