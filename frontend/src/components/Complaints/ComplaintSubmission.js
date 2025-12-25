import React, { useState, useEffect } from 'react';
import { complaintService } from '../../services/complaintService';
import { serviceRequestService } from '../../services/serviceRequestService';
import './Complaint.css';

const ComplaintSubmission = ({ onSuccess, onCancel }) => {
    const [serviceRequests, setServiceRequests] = useState([]);
    const [selectedRequestID, setSelectedRequestID] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        loadEligibleRequests();
    }, []);

    const loadEligibleRequests = async () => {
        try {
            setLoading(true);
            setError(null);
            // Get all service requests where provider is assigned (they had a service together)
            const response = await serviceRequestService.getMyServiceRequests();
            if (response.success) {
                // Filter to only show requests with assigned providers
                const eligibleRequests = (response.data.requests || []).filter(
                    req => req.providerID !== null && req.providerID !== undefined
                );
                setServiceRequests(eligibleRequests);
            }
        } catch (err) {
            setError(err.message || 'Failed to load service requests');
            console.error('Error loading service requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedRequestID) {
            setError('Please select a service request');
            return;
        }

        if (!description.trim()) {
            setError('Please provide a description for your complaint');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);
            setSuccess(null);

            const response = await complaintService.submitComplaint(selectedRequestID, description);
            
            if (response.success) {
                setSuccess('Complaint submitted successfully!');
                setDescription('');
                setSelectedRequestID('');
                
                // Call success callback after a short delay
                setTimeout(() => {
                    if (onSuccess) {
                        onSuccess();
                    }
                }, 1500);
            } else {
                setError(response.message || 'Failed to submit complaint');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to submit complaint';
            setError(errorMessage);
            console.error('Error submitting complaint:', err);
        } finally {
            setSubmitting(false);
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

    const selectedRequest = serviceRequests.find(req => req.requestID.toString() === selectedRequestID);

    if (loading) {
        return <div className="complaint-loading">Loading service requests...</div>;
    }

    return (
        <div className="complaint-submission-container">
            <div className="complaint-submission-header">
                <h2>Submit a Complaint</h2>
                {onCancel && (
                    <button onClick={onCancel} className="btn-close">×</button>
                )}
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {success && (
                <div className="success-message">
                    {success}
                </div>
            )}

            {serviceRequests.length === 0 ? (
                <div className="empty-requests">
                    <p>No eligible service requests found.</p>
                    <p className="empty-hint">
                        You can only submit complaints for services where a provider was assigned.
                    </p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="complaint-form">
                    <div className="form-group">
                        <label htmlFor="requestID">
                            Select Service Request <span className="required">*</span>
                        </label>
                        <select
                            id="requestID"
                            value={selectedRequestID}
                            onChange={(e) => setSelectedRequestID(e.target.value)}
                            className="form-select"
                            required
                        >
                            <option value="">-- Select a service request --</option>
                            {serviceRequests.map((request) => (
                                <option key={request.requestID} value={request.requestID}>
                                    {request.category} - {formatDate(request.serviceDate || request.requestDate)} 
                                    {request.providerName && ` (Provider: ${request.providerName})`}
                                </option>
                            ))}
                        </select>
                        {selectedRequest && (
                            <div className="selected-request-info">
                                <p><strong>Category:</strong> {selectedRequest.category}</p>
                                <p><strong>Description:</strong> {selectedRequest.description}</p>
                                <p><strong>Provider:</strong> {selectedRequest.providerName || 'N/A'}</p>
                                <p><strong>Status:</strong> {selectedRequest.status}</p>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">
                            Complaint Description <span className="required">*</span>
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="form-textarea"
                            rows="6"
                            placeholder="Please describe the issue or concern you have regarding this service..."
                            required
                        />
                        <small className="form-hint">
                            Provide a detailed description of your complaint. This will help us investigate and resolve the issue.
                        </small>
                    </div>

                    <div className="form-actions">
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={submitting}
                        >
                            {submitting ? 'Submitting...' : 'Submit Complaint'}
                        </button>
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="btn-cancel"
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            )}
        </div>
    );
};

export default ComplaintSubmission;

