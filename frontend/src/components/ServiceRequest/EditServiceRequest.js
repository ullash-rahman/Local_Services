import React, { useState, useEffect } from 'react';
import { serviceRequestService } from '../../services/serviceRequestService';
import { SERVICE_CATEGORIES } from '../../utils/categories';
import './CreateServiceRequest.css';

const EditServiceRequest = ({ request, onSuccess, onCancel }) => {
    const [formData, setFormData] = useState({
        category: request.category || '',
        description: request.description || '',
        serviceDate: request.serviceDate ? request.serviceDate.split('T')[0] : ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Use shared categories
    const categories = SERVICE_CATEGORIES;

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (error) setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Validate form
            if (!formData.category) {
                setError('Please select a category');
                setLoading(false);
                return;
            }

            if (!formData.description || formData.description.trim().length < 10) {
                setError('Description must be at least 10 characters long');
                setLoading(false);
                return;
            }

            // Validate date if provided
            if (formData.serviceDate) {
                const selectedDate = new Date(formData.serviceDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                if (selectedDate < today) {
                    setError('Service date cannot be in the past');
                    setLoading(false);
                    return;
                }
            }

            const response = await serviceRequestService.updateServiceRequest(request.requestID, {
                category: formData.category,
                description: formData.description.trim(),
                serviceDate: formData.serviceDate || null
            });

            if (response.success) {
                if (onSuccess) {
                    onSuccess(response.data.request);
                }
            } else {
                setError(response.message || 'Failed to update service request');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to update service request';
            setError(errorMessage);
            console.error('Error updating service request:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-service-request-container">
            <div className="create-service-request-card">
                <h2>Edit Service Request</h2>
                
                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="category">Service Category *</label>
                        <select
                            id="category"
                            name="category"
                            value={formData.category}
                            onChange={handleInputChange}
                            required
                            className="form-select"
                        >
                            <option value="">Select a category</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Description *</label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            required
                            minLength={10}
                            rows={5}
                            placeholder="Describe the service you need in detail (minimum 10 characters)..."
                            className="form-textarea"
                        />
                        <small className="form-help">
                            {formData.description.length}/10 characters minimum
                        </small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="serviceDate">Preferred Service Date (Optional)</label>
                        <input
                            type="date"
                            id="serviceDate"
                            name="serviceDate"
                            value={formData.serviceDate}
                            onChange={handleInputChange}
                            min={new Date().toISOString().split('T')[0]}
                            className="form-input"
                        />
                        <small className="form-help">
                            Leave empty if you don't have a preferred date
                        </small>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="btn-cancel"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={loading}
                        >
                            {loading ? 'Updating...' : 'Update Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditServiceRequest;

