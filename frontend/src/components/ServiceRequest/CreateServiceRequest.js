import React, { useState } from 'react';
import { serviceRequestService } from '../../services/serviceRequestService';
import './CreateServiceRequest.css';

const CreateServiceRequest = ({ onSuccess, onCancel }) => {
    const [formData, setFormData] = useState({
        category: '',
        description: '',
        serviceDate: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Common service categories
    const categories = [
        'Plumbing',
        'Electrical',
        'Cleaning',
        'Carpentry',
        'Painting',
        'Gardening',
        'Appliance Repair',
        'Moving',
        'Delivery',
        'Other'
    ];

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
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

            const response = await serviceRequestService.createServiceRequest({
                category: formData.category,
                description: formData.description.trim(),
                serviceDate: formData.serviceDate || null
            });

            if (response.success) {
                setSuccess(true);
                // Reset form
                setFormData({
                    category: '',
                    description: '',
                    serviceDate: ''
                });
                
                // Call onSuccess callback after a short delay
                setTimeout(() => {
                    if (onSuccess) {
                        onSuccess(response.data.request);
                    }
                }, 1500);
            } else {
                setError(response.message || 'Failed to create service request');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to create service request';
            setError(errorMessage);
            console.error('Error creating service request:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        }
    };

    return (
        <div className="create-service-request-container">
            <div className="create-service-request-card">
                <h2>Create Service Request</h2>
                
                {success && (
                    <div className="success-message">
                        <span className="success-icon">✓</span>
                        Service request created successfully!
                    </div>
                )}

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
                            onClick={handleCancel}
                            className="btn-cancel"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={loading || success}
                        >
                            {loading ? 'Creating...' : success ? 'Created!' : 'Create Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateServiceRequest;

