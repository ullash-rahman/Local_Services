import React, { useState, useEffect } from 'react';
import { bundleService } from '../../services/bundleService';
import './Bundle.css';

const BundleManager = () => {
    const [bundles, setBundles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingBundle, setEditingBundle] = useState(null);

    const [formData, setFormData] = useState({
        bundleName: '',
        description: '',
        servicesIncluded: [''],
        price: '',
        validTill: ''
    });

    useEffect(() => {
        loadBundles();
    }, []);

    const loadBundles = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await bundleService.getMyBundles(true); // Include inactive
            if (response.success) {
                setBundles(response.data.bundles || []);
            } else {
                // If no bundles, just set empty array, don't show error
                if (response.message && response.message.includes('Bundle not found')) {
                    setBundles([]);
                } else {
                    setError(response.message || 'Failed to load bundles');
                }
            }
        } catch (err) {
            // Better error handling - don't show "Bundle not found" for empty lists
            const errorMessage = err.message || err.response?.data?.message || 'Failed to load bundles';
            // Only show error if it's a real error, not just "no bundles found"
            if (errorMessage.includes('Bundle not found')) {
                // This is likely just an empty list, set empty array
                setBundles([]);
            } else {
                setError(errorMessage);
            }
            console.error('Error loading bundles:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleServiceChange = (index, value) => {
        const newServices = [...formData.servicesIncluded];
        newServices[index] = value;
        setFormData(prev => ({
            ...prev,
            servicesIncluded: newServices
        }));
    };

    const addServiceField = () => {
        setFormData(prev => ({
            ...prev,
            servicesIncluded: [...prev.servicesIncluded, '']
        }));
    };

    const removeServiceField = (index) => {
        if (formData.servicesIncluded.length > 1) {
            const newServices = formData.servicesIncluded.filter((_, i) => i !== index);
            setFormData(prev => ({
                ...prev,
                servicesIncluded: newServices
            }));
        }
    };

    const resetForm = () => {
        setFormData({
            bundleName: '',
            description: '',
            servicesIncluded: [''],
            price: '',
            validTill: ''
        });
        setShowCreateForm(false);
        setEditingBundle(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const services = formData.servicesIncluded.filter(s => s.trim() !== '');
        if (services.length === 0) {
            alert('Please add at least one service');
            return;
        }

        try {
            const bundleData = {
                bundleName: formData.bundleName,
                description: formData.description || null,
                servicesIncluded: services,
                price: parseFloat(formData.price),
                validTill: formData.validTill || null
            };

            if (editingBundle) {
                await bundleService.updateBundle(editingBundle.bundleID, bundleData);
            } else {
                await bundleService.createBundle(bundleData);
            }
            
            resetForm();
            loadBundles();
        } catch (err) {
            // The bundleService throws error.response?.data, so err is already the response data object
            // Also handle if it's still an axios error object
            let errorMessage = 'Failed to save bundle';
            
            console.log('Caught error type:', typeof err);
            console.log('Caught error:', err);
            
            if (err && typeof err === 'object') {
                // Try different possible error message locations
                errorMessage = err.message || err.error || err.response?.data?.message || err.response?.data?.error || JSON.stringify(err);
            } else if (typeof err === 'string') {
                errorMessage = err;
            }
            
            // Show detailed error in alert
            alert(`Error: ${errorMessage}\n\nCheck browser console (F12) for more details.`);
            console.error('Error saving bundle - Full error:', err);
            console.error('Error saving bundle - Stringified:', JSON.stringify(err, null, 2));
            
            // Also set error state to show in UI
            setError(errorMessage);
        }
    };

    const handleEdit = (bundle) => {
        setEditingBundle(bundle);
        setFormData({
            bundleName: bundle.bundleName,
            description: bundle.description || '',
            servicesIncluded: bundle.servicesIncluded && bundle.servicesIncluded.length > 0 
                ? bundle.servicesIncluded 
                : [''],
            price: bundle.price.toString(),
            validTill: bundle.validTill ? bundle.validTill.split('T')[0] : ''
        });
        setShowCreateForm(true);
    };

    const handleDelete = async (bundleID) => {
        if (!window.confirm('Are you sure you want to remove this bundle?')) {
            return;
        }

        try {
            await bundleService.removeBundle(bundleID);
            loadBundles();
        } catch (err) {
            alert(err.message || 'Failed to remove bundle');
            console.error('Error removing bundle:', err);
        }
    };

    const handleToggleActive = async (bundle) => {
        try {
            await bundleService.updateBundle(bundle.bundleID, {
                isActive: !bundle.isActive
            });
            loadBundles();
        } catch (err) {
            alert(err.message || 'Failed to update bundle');
            console.error('Error updating bundle:', err);
        }
    };

    if (loading) {
        return <div className="bundle-loading">Loading...</div>;
    }

    return (
        <div className="bundle-manager">
            <div className="bundle-manager-header">
                <h2>Service Bundle Manager</h2>
                <button 
                    className="btn-create-bundle"
                    onClick={() => {
                        resetForm();
                        setShowCreateForm(true);
                    }}
                >
                    + Create New Bundle
                </button>
            </div>

            {error && (
                <div className="bundle-error">Error: {error}</div>
            )}

            {showCreateForm && (
                <div className="bundle-form-container">
                    <h3>{editingBundle ? 'Edit Bundle' : 'Create New Bundle'}</h3>
                    <form onSubmit={handleSubmit} className="bundle-form">
                        <div className="form-group">
                            <label>Bundle Name *</label>
                            <input
                                type="text"
                                name="bundleName"
                                value={formData.bundleName}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows="3"
                            />
                        </div>

                        <div className="form-group">
                            <label>Services Included *</label>
                            {formData.servicesIncluded.map((service, index) => (
                                <div key={index} className="service-input-group">
                                    <input
                                        type="text"
                                        value={service}
                                        onChange={(e) => handleServiceChange(index, e.target.value)}
                                        placeholder="Service name"
                                        required
                                    />
                                    {formData.servicesIncluded.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeServiceField(index)}
                                            className="btn-remove-service"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={addServiceField}
                                className="btn-add-service"
                            >
                                + Add Service
                            </button>
                        </div>

                        <div className="form-group">
                            <label>Price ($) *</label>
                            <input
                                type="number"
                                name="price"
                                value={formData.price}
                                onChange={handleInputChange}
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Valid Until (Optional)</label>
                            <input
                                type="date"
                                name="validTill"
                                value={formData.validTill}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn-submit">
                                {editingBundle ? 'Update Bundle' : 'Create Bundle'}
                            </button>
                            <button type="button" onClick={resetForm} className="btn-cancel">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bundle-list-manager">
                {bundles.length === 0 ? (
                    <div className="bundle-empty">No bundles created yet. Create your first bundle!</div>
                ) : (
                    bundles.map((bundle) => (
                        <div 
                            key={bundle.bundleID} 
                            className={`bundle-card-manager ${!bundle.isActive ? 'inactive' : ''}`}
                        >
                            <div className="bundle-header">
                                <div>
                                    <h3 className="bundle-name">{bundle.bundleName}</h3>
                                    {!bundle.isActive && <span className="status-badge inactive">Inactive</span>}
                                    {bundle.isActive && <span className="status-badge active">Active</span>}
                                </div>
                                <span className="bundle-price">${bundle.price}</span>
                            </div>
                            
                            {bundle.description && (
                                <p className="bundle-description">{bundle.description}</p>
                            )}
                            
                            <div className="bundle-services">
                                <strong>Services Included:</strong>
                                <ul>
                                    {bundle.servicesIncluded && bundle.servicesIncluded.map((service, index) => (
                                        <li key={index}>{service}</li>
                                    ))}
                                </ul>
                            </div>
                            
                            {bundle.validTill && (
                                <div className="bundle-validity">
                                    Valid until: {new Date(bundle.validTill).toLocaleDateString()}
                                </div>
                            )}
                            
                            <div className="bundle-actions">
                                <button
                                    onClick={() => handleEdit(bundle)}
                                    className="btn-edit"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleToggleActive(bundle)}
                                    className={bundle.isActive ? "btn-deactivate" : "btn-activate"}
                                >
                                    {bundle.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                    onClick={() => handleDelete(bundle.bundleID)}
                                    className="btn-delete"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default BundleManager;

