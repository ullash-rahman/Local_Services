import React, { useState, useEffect, useCallback, useRef } from 'react';
import { serviceRequestService } from '../../services/serviceRequestService';
import EditServiceRequest from './EditServiceRequest';
import ReviewSubmission from '../Reviews/ReviewSubmission';
import { SERVICE_CATEGORIES, CATEGORY_COLORS } from '../../utils/categories';
import { io } from 'socket.io-client';
import './ServiceRequestList.css';

const ServiceRequestList = ({ userRole = 'Customer', onStartChat, refreshTrigger }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [editingRequest, setEditingRequest] = useState(null);
    const [reviewingRequest, setReviewingRequest] = useState(null);
    const [cancellingRequest, setCancellingRequest] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
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
                // For providers, when statusFilter is 'all', show both:
                // 1. Unaccepted pending requests (can be accepted)
                // 2. Requests accepted by this provider
                // When statusFilter is specific, filter accordingly
                response = await serviceRequestService.getMyServiceRequests(
                    statusParam,
                    categoryParam
                );
            }
            
            console.log('Response received:', response);

            if (response.success) {
                const requests = response.data.requests || [];
                console.log('Setting requests:', requests.length, 'requests');
                console.log('Request categories:', requests.map(r => r.category));
                console.log('Request priorities:', requests.map(r => ({ 
                    id: r.requestID, 
                    category: r.category,
                    status: r.status,
                    priority: r.priorityLevel,
                    priorityType: typeof r.priorityLevel,
                    hasPriority: 'priorityLevel' in r
                })));
                // Debug: Log first request in detail
                if (requests.length > 0) {
                    console.log('First request full object:', JSON.stringify(requests[0], null, 2));
                }
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
    }, [statusFilter, categoryFilter, loadRequests, refreshTrigger]);

    // Real-time status updates via Socket.io
    const requestsRef = useRef(requests);
    
    // Update ref when requests change
    useEffect(() => {
        requestsRef.current = requests;
    }, [requests]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const socketUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001';
        const socket = io(socketUrl, {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('Socket connected for status updates');
            // Join rooms for all current requests using ref
            requestsRef.current.forEach(request => {
                socket.emit('join_request', request.requestID);
            });
        });

        // Listen for status updates
        socket.on('service_status_update', (data) => {
            console.log('Real-time status update received:', data);
            // Update the specific request in the list
            setRequests(prevRequests => 
                prevRequests.map(request => 
                    request.requestID === data.requestID
                        ? { ...request, status: data.status, completionConfirmed: data.completionConfirmed }
                        : request
                )
            );
            // Show a notification
            if (data.status === 'Ongoing') {
                setSuccess('Service has started! Status updated to Ongoing');
            } else if (data.status === 'Completed') {
                setSuccess('Service has been completed!');
            }
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        return () => {
            socket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount, use ref for current requests

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
                setSuccess('Service request deleted successfully');
                loadRequests();
            } else {
                setError(response.message || 'Failed to delete service request');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to delete service request';
            setError(errorMessage);
            console.error('Error deleting service request:', err);
        }
    };

    const handleCancelRequest = async (e) => {
        e.preventDefault();
        if (!cancelReason.trim()) {
            setError('Please provide a cancellation reason');
            return;
        }

        try {
            setError(null);
            const response = await serviceRequestService.cancelServiceRequest(
                cancellingRequest.requestID,
                cancelReason.trim()
            );
            if (response.success) {
                setSuccess('Service request cancelled successfully');
                setCancellingRequest(null);
                setCancelReason('');
                loadRequests();
            } else {
                setError(response.message || 'Failed to cancel service request');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to cancel service request';
            setError(errorMessage);
            console.error('Error cancelling service request:', err);
        }
    };

    const handleStartService = async (requestID) => {
        if (!window.confirm('Are you sure you want to start this service? The status will change to Ongoing and the customer will be notified.')) {
            return;
        }

        try {
            setError(null);
            const response = await serviceRequestService.startService(requestID);
            if (response.success) {
                setSuccess('Service started successfully');
                loadRequests();
            } else {
                setError(response.message || 'Failed to start service');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to start service';
            setError(errorMessage);
            console.error('Error starting service:', err);
        }
    };

    const handleMarkAsCompleted = async (requestID) => {
        if (!window.confirm('Are you sure you want to mark this service as completed? The customer will be notified to confirm.')) {
            return;
        }

        try {
            setError(null);
            const response = await serviceRequestService.markServiceAsCompleted(requestID);
            if (response.success) {
                setSuccess('Service marked as completed successfully');
                loadRequests();
            } else {
                setError(response.message || 'Failed to mark service as completed');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to mark service as completed';
            setError(errorMessage);
            console.error('Error marking service as completed:', err);
        }
    };

    const handleConfirmCompletion = async (requestID) => {
        if (!window.confirm('Are you sure you want to confirm that this service has been completed?')) {
            return;
        }

        try {
            setError(null);
            const response = await serviceRequestService.confirmServiceCompletion(requestID);
            if (response.success) {
                setSuccess('Service completion confirmed successfully');
                loadRequests();
            } else {
                setError(response.message || 'Failed to confirm service completion');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to confirm service completion';
            setError(errorMessage);
            console.error('Error confirming service completion:', err);
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

    if (reviewingRequest) {
        return (
            <div className="service-request-list-container">
                <ReviewSubmission
                    requestID={reviewingRequest.requestID}
                    providerName={reviewingRequest.providerName}
                    onSuccess={() => {
                        setReviewingRequest(null);
                        loadRequests();
                        alert('Thank you for your review!');
                    }}
                    onCancel={() => setReviewingRequest(null)}
                />
            </div>
        );
    }

    return (
        <div className="service-request-list-container">
            <div className="service-request-list-header">
                <h2>
                    {userRole === 'Customer' 
                        ? 'My Service Requests' 
                        : statusFilter === 'Pending'
                            ? 'Available Service Requests (Unaccepted)' 
                            : statusFilter === 'all'
                                ? 'All Requests (Unaccepted + My Accepted)'
                                : 'My Service Requests'}
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
                    {userRole === 'Provider' && (
                        <div className="filter-section">
                            <label>Filter by Status:</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="status-filter"
                            >
                                <option value="all">All (Unaccepted + My Accepted)</option>
                                <option value="Pending">Available (Unaccepted Only)</option>
                                <option value="Accepted">My Accepted</option>
                                <option value="Ongoing">My Ongoing</option>
                                <option value="Completed">My Completed</option>
                                <option value="Cancelled">My Cancelled</option>
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
                    <button onClick={() => setError(null)} className="alert-close">×</button>
                </div>
            )}

            {success && (
                <div className="success-message">
                    <span className="success-icon">✓</span>
                    {success}
                    <button onClick={() => setSuccess(null)} className="alert-close">×</button>
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
                    {requests.map((request) => {
                        // Normalize priorityLevel - handle NULL, undefined, or empty values
                        const priorityLevel = request.priorityLevel || 'Normal';
                        return (
                        <div key={request.requestID} className={`request-card ${priorityLevel === 'Emergency' ? 'priority-emergency' : priorityLevel === 'High' ? 'priority-high' : ''}`}>
                            <div className="request-header">
                                <h3 className="request-category">{request.category}</h3>
                                <div className="header-badges">
                                    {priorityLevel && priorityLevel !== 'Normal' && (
                                        <span className={`priority-badge priority-${priorityLevel.toLowerCase()}`}>
                                            {priorityLevel === 'Emergency' ? '🚨 Emergency' : 'High Priority'}
                                        </span>
                                    )}
                                    <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                                        {request.status}
                                    </span>
                                </div>
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
                                    {request.cancellationReason && (
                                        <div className="detail-item">
                                            <span className="detail-label">Cancellation Reason:</span>
                                            <span className="detail-value" style={{ color: '#d32f2f' }}>
                                                {request.cancellationReason}
                                            </span>
                                        </div>
                                    )}
                                    {(() => {
                                        const priorityLevel = request.priorityLevel || 'Normal';
                                        return (
                                            <div className="detail-item">
                                                <span className="detail-label">Priority:</span>
                                                <span className={`detail-value ${priorityLevel !== 'Normal' ? `priority-${priorityLevel.toLowerCase()}` : ''}`}>
                                                    {priorityLevel === 'Emergency' ? '🚨 Emergency' : priorityLevel}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                    {request.status === 'Completed' && request.completionConfirmed && (
                                        <div className="detail-item">
                                            <span className="detail-label" style={{ color: '#2e7d32' }}>
                                                ✓ Completion Confirmed
                                            </span>
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
                                        <button
                                            onClick={() => setCancellingRequest(request)}
                                            className="btn-cancel"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                )}
                                {userRole === 'Customer' && request.status === 'Completed' && !request.hasReview && (
                                    <button
                                        onClick={() => setReviewingRequest(request)}
                                        className="btn-review"
                                    >
                                        ⭐ Leave Review
                                    </button>
                                )}
                                {userRole === 'Customer' && request.status === 'Completed' && request.hasReview && (
                                    <span className="review-submitted-badge">✓ Review Submitted</span>
                                {userRole === 'Customer' && 
                                 request.status !== 'Pending' && 
                                 request.status !== 'Cancelled' && 
                                 request.status !== 'Completed' && (
                                    <button
                                        onClick={() => setCancellingRequest(request)}
                                        className="btn-cancel"
                                    >
                                        Cancel Request
                                    </button>
                                )}
                                {userRole === 'Customer' && 
                                 request.status === 'Completed' && 
                                 !request.completionConfirmed && (
                                    <button
                                        onClick={() => handleConfirmCompletion(request.requestID)}
                                        className="btn-complete"
                                    >
                                        ✓ Confirm Completion
                                    </button>
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
                                {userRole === 'Provider' && request.status === 'Accepted' && (
                                    <>
                                        <button
                                            onClick={() => handleStartService(request.requestID)}
                                            className="btn-start"
                                        >
                                            ▶ Start Service
                                        </button>
                                        <button
                                            onClick={() => handleStartChat(request)}
                                            className="btn-chat"
                                        >
                                            💬 Message Customer
                                        </button>
                                    </>
                                )}
                                {userRole === 'Provider' && request.status === 'Ongoing' && (
                                    <>
                                        <button
                                            onClick={() => handleMarkAsCompleted(request.requestID)}
                                            className="btn-complete"
                                        >
                                            ✓ Mark as Completed
                                        </button>
                                        <button
                                            onClick={() => handleStartChat(request)}
                                            className="btn-chat"
                                        >
                                            💬 Message Customer
                                        </button>
                                    </>
                                )}
                                {userRole === 'Provider' && 
                                 request.status !== 'Pending' && 
                                 request.status !== 'Accepted' && 
                                 request.status !== 'Ongoing' && (
                                    <button
                                        onClick={() => handleStartChat(request)}
                                        className="btn-chat"
                                    >
                                        💬 Message Customer
                                    </button>
                                )}
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}

            {/* Cancellation Modal */}
            {cancellingRequest && (
                <div className="modal-overlay" onClick={() => {
                    setCancellingRequest(null);
                    setCancelReason('');
                    setError(null);
                }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Cancel Service Request</h3>
                        <p>Please provide a reason for cancelling this service request:</p>
                        <form onSubmit={handleCancelRequest}>
                            <div className="form-group">
                                <textarea
                                    className="form-textarea"
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder="Enter cancellation reason..."
                                    rows="4"
                                    required
                                />
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="btn-cancel">
                                    Confirm Cancellation
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setCancellingRequest(null);
                                        setCancelReason('');
                                        setError(null);
                                    }}
                                    className="btn-submit"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServiceRequestList;

