import React, { useState, useEffect } from 'react';
import { complaintService } from '../../services/complaintService';
import { authService } from '../../services/authService';
import './Complaint.css';

const ComplaintDetails = ({ complaint, onClose, onRefresh }) => {
    const [fullComplaint, setFullComplaint] = useState(complaint);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState(complaint.status);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [updating, setUpdating] = useState(false);
    const currentUser = authService.getCurrentUser();
    const isAdmin = currentUser?.role === 'Admin';

    useEffect(() => {
        if (complaint.complaintID) {
            loadFullDetails();
        }
    }, [complaint.complaintID]);

    const loadFullDetails = async () => {
        try {
            setLoading(true);
            const response = await complaintService.getComplaintById(complaint.complaintID);
            if (response.success) {
                setFullComplaint(response.data);
                setStatus(response.data.status);
            }
        } catch (err) {
            setError(err.message || 'Failed to load complaint details');
            console.error('Error loading complaint details:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (e) => {
        e.preventDefault();
        
        if (!status) {
            setError('Please select a status');
            return;
        }

        try {
            setUpdating(true);
            setError(null);

            const response = await complaintService.updateComplaintStatus(
                fullComplaint.complaintID,
                status,
                resolutionNotes || null
            );

            if (response.success) {
                setFullComplaint(response.data);
                if (onRefresh) {
                    onRefresh();
                }
                alert('Complaint status updated successfully!');
            } else {
                setError(response.message || 'Failed to update complaint status');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to update complaint status';
            setError(errorMessage);
            console.error('Error updating complaint status:', err);
        } finally {
            setUpdating(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not specified';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
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

    if (loading) {
        return <div className="complaint-loading">Loading complaint details...</div>;
    }

    const complaintData = fullComplaint || complaint;

    return (
        <div className="complaint-details-container">
            <div className="complaint-details-header">
                <h2>Complaint Details</h2>
                <button onClick={onClose} className="btn-close">×</button>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="complaint-details-content">
                <div className="complaint-info-section">
                    <div className="info-row">
                        <span className="info-label">Complaint ID:</span>
                        <span className="info-value">#{complaintData.complaintID}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Status:</span>
                        <span className={`status-badge ${getStatusBadgeClass(complaintData.status)}`}>
                            {complaintData.status}
                        </span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Submitted:</span>
                        <span className="info-value">{formatDate(complaintData.createdAt)}</span>
                    </div>
                    {complaintData.resolvedAt && (
                        <div className="info-row">
                            <span className="info-label">Resolved:</span>
                            <span className="info-value">{formatDate(complaintData.resolvedAt)}</span>
                        </div>
                    )}
                </div>

                <div className="complaint-service-section">
                    <h3>Service Information</h3>
                    <div className="info-row">
                        <span className="info-label">Service Category:</span>
                        <span className="info-value">
                            {complaintData.serviceCategory || 'N/A'}
                        </span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Service Description:</span>
                        <span className="info-value">
                            {complaintData.serviceDescription || 'N/A'}
                        </span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Provider:</span>
                        <span className="info-value">
                            {complaintData.providerName || 'N/A'}
                        </span>
                    </div>
                    {complaintData.customerName && (
                        <div className="info-row">
                            <span className="info-label">Customer:</span>
                            <span className="info-value">
                                {complaintData.customerName}
                            </span>
                        </div>
                    )}
                </div>

                <div className="complaint-parties-section">
                    <h3>Parties Involved</h3>
                    <div className="info-row">
                        <span className="info-label">Complaint Filed by:</span>
                        <span className="info-value">
                            {complaintData.reporterName} ({complaintData.reporterRole})
                        </span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Against:</span>
                        <span className="info-value">
                            {complaintData.reporterRole === 'Customer' 
                                ? complaintData.providerName 
                                : complaintData.customerName}
                        </span>
                    </div>
                </div>

                <div className="complaint-description-section">
                    <h3>Complaint Description</h3>
                    <div className="complaint-description-text">
                        {complaintData.description}
                    </div>
                </div>

                {complaintData.resolutionNotes && (
                    <div className="complaint-resolution-section">
                        <h3>Resolution Notes</h3>
                        <div className="resolution-notes-text">
                            {complaintData.resolutionNotes}
                        </div>
                    </div>
                )}

                {isAdmin && (
                    <div className="complaint-admin-section">
                        <h3>Admin Actions</h3>
                        <form onSubmit={handleStatusUpdate} className="admin-form">
                            <div className="form-group">
                                <label htmlFor="status">Update Status:</label>
                                <select
                                    id="status"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="form-select"
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="Under Review">Under Review</option>
                                    <option value="Resolved">Resolved</option>
                                    <option value="Dismissed">Dismissed</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="resolutionNotes">Resolution Notes:</label>
                                <textarea
                                    id="resolutionNotes"
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                    className="form-textarea"
                                    rows="4"
                                    placeholder="Enter resolution notes (optional)"
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn-update-status"
                                disabled={updating}
                            >
                                {updating ? 'Updating...' : 'Update Status'}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            <div className="complaint-details-actions">
                <button onClick={onClose} className="btn-close-details">
                    Close
                </button>
            </div>
        </div>
    );
};

export default ComplaintDetails;

