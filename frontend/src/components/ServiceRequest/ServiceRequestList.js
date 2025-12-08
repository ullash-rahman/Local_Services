import React, { useState, useEffect } from 'react';
import { serviceRequestService } from '../../services/serviceRequestService';
import EditServiceRequest from './EditServiceRequest';
import './ServiceRequestList.css';

const ServiceRequestList = ({ userRole = 'Customer', onStartChat }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingRequest, setEditingRequest] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        loadRequests();
    }, [statusFilter]);

    const loadRequests = async () => {
        try {
            setLoading(true);
            setError(null);
            let response;
            
            if (userRole === 'Customer') {
                // Get customer's own requests
                response = await serviceRequestService.getMyServiceRequests(
                    statusFilter !== 'all' ? statusFilter : null
                );
            } else {
                // Get all pending requests for providers
                response = await serviceRequestService.getPendingRequests();
            }

            if (response.success) {
                setRequests(response.data.requests || []);
            } else {
                setError(response.message || 'Failed to load service requests');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to load service requests';
            setError(errorMessage);
            console.error('Error loading service requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (request) => {
        setEditingRequest(request);
    };

    const handleEditSuccess = () => {
        setEditingRequest(null);
        loadRequests();
    };

    const handleEditCancel = () => {
        setEditingRequest(null);
    };

    const handleStartChat = (request) => {
        if (onStartChat) {
            onStartChat({
                requestID: request.requestID,
                otherUserID: request.customerID,
                otherUserName: request.customerName,
                category: request.category,
                description: request.description
            });
        }
    };

    const handleDelete = async (requestID) => {
        if (!window.confirm('Are you sure you want to delete this service request? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await serviceRequestService.deleteServiceRequest(requestID);
            if (response.success) {
                loadRequests();
            } else {
                alert(response.message || 'Failed to delete service request');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to delete service request';
            alert(errorMessage);
            console.error('Error deleting service request:', err);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not specified';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getStatusBadgeClass = (status) => {
        const statusClasses = {
            'Pending': 'status-pending',
            'Ongoing': 'status-ongoing',
            'Completed': 'status-completed',
            'Cancelled': 'status-cancelled'
        };
        return statusClasses[status] || 'status-default';
    };

    if (loading) {
        return <div className="service-request-loading">Loading service requests...</div>;
    }

    if (editingRequest) {
        return (
            <EditServiceRequest
                request={editingRequest}
                onSuccess={handleEditSuccess}
                onCancel={handleEditCancel}
            />
        );
    }

    return (
        <div className="service-request-list-container">
            <div className="service-request-list-header">
                <h2>
                    {userRole === 'Customer' ? 'My Service Requests' : 'Available Service Requests'}
                </h2>
                {userRole === 'Customer' && (
                    <div className="filter-section">
                        <label>Filter by Status:</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="status-filter"
                        >
                            <option value="all">All</option>
                            <option value="Pending">Pending</option>
                            <option value="Ongoing">Ongoing</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                )}
                <button onClick={loadRequests} className="btn-refresh">
                    Refresh
                </button>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {requests.length === 0 ? (
                <div className="empty-requests">
                    <p>No service requests found.</p>
                    {userRole === 'Customer' && (
                        <p className="empty-hint">Create a new service request to get started!</p>
                    )}
                </div>
            ) : (
                <div className="requests-grid">
                    {requests.map((request) => (
                        <div key={request.requestID} className="request-card">
                            <div className="request-header">
                                <h3 className="request-category">{request.category}</h3>
                                <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                                    {request.status}
                                </span>
                            </div>

                            <div className="request-body">
                                <p className="request-description">{request.description}</p>
                                
                                <div className="request-details">
                                    <div className="detail-item">
                                        <span className="detail-label">Request Date:</span>
                                        <span className="detail-value">{formatDate(request.requestDate)}</span>
                                    </div>
                                    {request.serviceDate && (
                                        <div className="detail-item">
                                            <span className="detail-label">Service Date:</span>
                                            <span className="detail-value">{formatDate(request.serviceDate)}</span>
                                        </div>
                                    )}
                                    {userRole === 'Provider' && request.customerName && (
                                        <div className="detail-item">
                                            <span className="detail-label">Customer:</span>
                                            <span className="detail-value">{request.customerName}</span>
                                        </div>
                                    )}
                                    {request.providerName && (
                                        <div className="detail-item">
                                            <span className="detail-label">Provider:</span>
                                            <span className="detail-value">{request.providerName}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="request-actions">
                                {userRole === 'Customer' && request.status === 'Pending' && (
                                    <>
                                        <button
                                            onClick={() => handleEdit(request)}
                                            className="btn-edit"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(request.requestID)}
                                            className="btn-delete"
                                        >
                                            Delete
                                        </button>
                                    </>
                                )}
                                {userRole === 'Provider' && (
                                    <button
                                        onClick={() => handleStartChat(request)}
                                        className="btn-chat"
                                    >
                                        💬 Message Customer
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ServiceRequestList;

