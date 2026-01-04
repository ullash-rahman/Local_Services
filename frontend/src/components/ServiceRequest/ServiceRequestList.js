import React, { useState, useEffect, useCallback } from 'react';
import { serviceRequestService } from '../../services/serviceRequestService';
import EditServiceRequest from './EditServiceRequest';
import { SERVICE_CATEGORIES, CATEGORY_COLORS } from '../../utils/categories';
import './ServiceRequestList.css';

const ServiceRequestList = ({ userRole = 'Customer', onStartChat }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingRequest, setEditingRequest] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');

    const loadRequests = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            let response;
            
            const statusParam = statusFilter !== 'all' ? statusFilter : null;
            const categoryParam = categoryFilter !== 'all' ? categoryFilter : null;
            
            console.log('Loading requests with filters:', { userRole, statusFilter, categoryFilter, statusParam, categoryParam });
            
            if (userRole === 'Customer') {
                // Get customer's own requests
                response = await serviceRequestService.getMyServiceRequests(
                    statusParam,
                    categoryParam
                );
            } else {
                // Get all pending requests for providers
                response = await serviceRequestService.getPendingRequests(
                    categoryParam
                );
            }
            
            console.log('Response received:', response);

            if (response.success) {
                const requests = response.data.requests || [];
                console.log('Setting requests:', requests.length, 'requests');
                console.log('Request categories:', requests.map(r => r.category));
                setRequests(requests);
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
    }, [userRole, statusFilter, categoryFilter]);

    useEffect(() => {
        loadRequests();
    }, [statusFilter, categoryFilter, loadRequests]);

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

    const handleAcceptRequest = async (requestID) => {
        if (!window.confirm('Are you sure you want to accept this service request?')) {
            return;
        }

        try {
            const response = await serviceRequestService.acceptServiceRequest(requestID);
            if (response.success) {
                loadRequests();
                alert('Service request accepted successfully!');
            } else {
                alert(response.message || 'Failed to accept service request');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to accept service request';
            alert(errorMessage);
            console.error('Error accepting service request:', err);
        }
    };

    const handleRejectRequest = async (requestID) => {
        if (!window.confirm('Are you sure you want to reject this service request?')) {
            return;
        }

        try {
            const response = await serviceRequestService.rejectServiceRequest(requestID);
            if (response.success) {
                loadRequests();
                alert('Service request rejected');
            } else {
                alert(response.message || 'Failed to reject service request');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to reject service request';
            alert(errorMessage);
            console.error('Error rejecting service request:', err);
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
            'Accepted': 'status-accepted',
            'Ongoing': 'status-ongoing',
            'Completed': 'status-completed',
            'Cancelled': 'status-cancelled',
            'Rejected': 'status-rejected'
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
                <div className="filters-container">
                    {userRole === 'Customer' && (
                        <div className="filter-section">
                            <label>Filter by Status:</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="status-filter"
                            >
                                <option value="all">All Status</option>
                                <option value="Pending">Pending</option>
                                <option value="Accepted">Accepted</option>
                                <option value="Ongoing">Ongoing</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>
                    )}
                    <div className="filter-section">
                        <label>Filter by Category:</label>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="category-filter"
                        >
                            <option value="all">All Categories</option>
                            {SERVICE_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={loadRequests} className="btn-refresh">
                        Refresh
                    </button>
                </div>
            </div>

            {/* Category Filter Chips */}
            <div className="category-filters">
                <div className="category-filters-label">Quick Filter:</div>
                <div className="category-chips">
                    <button
                        type="button"
                        className={`category-chip ${categoryFilter === 'all' ? 'active' : ''}`}
                        onClick={() => {
                            console.log('Quick filter clicked: All');
                            setCategoryFilter('all');
                        }}
                    >
                        All
                    </button>
                    {SERVICE_CATEGORIES.map(category => {
                        const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
                        return (
                            <button
                                key={category}
                                type="button"
                                className={`category-chip ${categoryFilter === category ? 'active' : ''}`}
                                onClick={() => {
                                    console.log('Quick filter clicked:', category);
                                    setCategoryFilter(category);
                                }}
                                style={{
                                    backgroundColor: categoryFilter === category ? colors.bg : '#f5f5f5',
                                    color: categoryFilter === category ? colors.text : '#666',
                                    borderColor: categoryFilter === category ? colors.text : '#ddd'
                                }}
                            >
                                <span className="category-icon">{colors.icon}</span>
                                {category}
                            </button>
                        );
                    })}
                </div>
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
                                {userRole === 'Provider' && request.status === 'Pending' && (
                                    <>
                                        <button
                                            onClick={() => handleAcceptRequest(request.requestID)}
                                            className="btn-accept"
                                        >
                                            ✓ Accept
                                        </button>
                                        <button
                                            onClick={() => handleRejectRequest(request.requestID)}
                                            className="btn-reject"
                                        >
                                            ✗ Reject
                                        </button>
                                    </>
                                )}
                                {userRole === 'Provider' && request.status !== 'Pending' && (
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

