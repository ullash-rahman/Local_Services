import React, { useState, useEffect } from 'react';
import { manualBookingService } from '../../services/manualBookingService';
import CustomerBookingCalendar from './CustomerBookingCalendar';
import { SERVICE_CATEGORIES, CATEGORY_COLORS } from '../../utils/categories';
import './ManualBooking.css';

const ManualBooking = () => {
    const [providers, setProviders] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingProviders, setLoadingProviders] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [cancellingBooking, setCancellingBooking] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState('all');

    const [formData, setFormData] = useState({
        providerID: '',
        category: '',
        description: '',
        scheduledDate: '',
        scheduledTime: '',
        serviceDate: '',
        priorityLevel: 'Normal'
    });

    const [cancelFormData, setCancelFormData] = useState({
        cancellationReason: ''
    });

    // Use shared categories
    const categories = SERVICE_CATEGORIES;

    useEffect(() => {
        loadProviders();
        loadBookings();
    }, []);

    const loadProviders = async () => {
        try {
            setLoadingProviders(true);
            setError(null); // Clear any previous errors
            console.log('=== Loading providers ===');
            const response = await manualBookingService.getProviders();
            console.log('=== Providers response ===', response);
            console.log('Response success:', response?.success);
            console.log('Response data:', response?.data);
            console.log('Response providers array:', response?.data?.providers);
            
            if (response && response.success) {
                const providersList = response.data?.providers || [];
                console.log('=== Providers loaded ===', providersList.length, 'providers');
                console.log('Providers list:', providersList);
                setProviders(providersList);
                if (providersList.length === 0) {
                    console.warn('No providers found in database');
                    setError('No providers are available in the system. Please contact support.');
                } else {
                    // Clear error if providers are loaded successfully
                    setError(null);
                }
            } else {
                const errorMsg = response?.message || 'Failed to load providers';
                console.error('Response indicates failure:', errorMsg);
                setError(errorMsg);
            }
        } catch (err) {
            console.error('=== Error loading providers ===', err);
            console.error('Error details:', {
                message: err.message,
                response: err.response,
                responseData: err.response?.data,
                stack: err.stack
            });
            const errorMessage = err.message || err.response?.data?.message || err.response?.data?.error || 'Failed to load providers';
            setError(errorMessage);
        } finally {
            setLoadingProviders(false);
        }
    };

    const loadBookings = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await manualBookingService.getMyManualBookings();
            if (response.success) {
                setBookings(response.data.bookings || []);
            } else {
                setError(response.message || 'Failed to load bookings');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to load bookings';
            if (!errorMessage.includes('not found')) {
                setError(errorMessage);
            }
            setBookings([]);
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
        if (error) setError(null);
    };

    const handleCancelInputChange = (e) => {
        const { name, value } = e.target;
        setCancelFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Note: handleSubmit is no longer needed as booking is handled by CustomerBookingCalendar
    // This function is kept for potential future use but not currently called

    const handleCancelBooking = async (e) => {
        e.preventDefault();
        setError(null);

        if (!cancelFormData.cancellationReason || cancelFormData.cancellationReason.trim().length === 0) {
            setError('Please provide a cancellation reason');
            return;
        }

        try {
            const response = await manualBookingService.cancelManualBooking(
                cancellingBooking.bookingID,
                cancelFormData.cancellationReason.trim()
            );
            if (response.success) {
                setSuccess('Booking cancelled successfully');
                loadBookings();
                setCancellingBooking(null);
                setCancelFormData({ cancellationReason: '' });
            } else {
                setError(response.message || 'Failed to cancel booking');
            }
        } catch (err) {
            setError(err.message || err.response?.data?.message || 'Failed to cancel booking');
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

    const formatTime = (timeString) => {
        if (!timeString) return 'N/A';
        return timeString;
    };

    const getStatusClass = (status) => {
        const statusLower = status?.toLowerCase() || '';
        if (statusLower === 'accepted') return 'status-accepted';
        if (statusLower === 'ongoing') return 'status-ongoing';
        if (statusLower === 'completed') return 'status-completed';
        if (statusLower === 'cancelled') return 'status-cancelled';
        return 'status-pending';
    };

    if (loading && bookings.length === 0) {
        return <div className="manual-booking-loading">Loading...</div>;
    }

    return (
        <div className="manual-booking-container">
            <div className="manual-booking-header">
                <h2>Manual Booking System</h2>
                <p>Book directly with your preferred provider</p>
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

            <div className="manual-booking-actions">
                <button 
                    onClick={() => {
                        setShowCreateForm(!showCreateForm);
                        setError(null);
                        setSuccess(null);
                    }} 
                    className="btn-submit"
                >
                    {showCreateForm ? 'Cancel' : '+ Create New Manual Booking'}
                </button>
            </div>

            {showCreateForm && (
                <div className="create-service-request-card">
                    <h2>Create Manual Booking</h2>
                    <div className="form-group">
                        <label htmlFor="providerID">Select Preferred Provider *</label>
                        {loadingProviders ? (
                            <div className="loading-message">Loading providers...</div>
                        ) : providers.length === 0 ? (
                            <div className="error-message" style={{ padding: '10px', marginTop: '5px' }}>
                                No providers are available. Please contact support.
                            </div>
                        ) : (
                            <>
                                <select
                                    id="providerID"
                                    name="providerID"
                                    className="form-select"
                                    value={formData.providerID}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">-- Select Provider --</option>
                                    {providers.map(provider => (
                                        <option key={provider.userID} value={provider.userID}>
                                            {provider.name} {provider.verified ? '✓ (Verified)' : ' (Unverified)'}
                                        </option>
                                    ))}
                                </select>
                                <span className="form-help">Select a provider to view their availability calendar. Verified providers are marked with ✓.</span>
                            </>
                        )}
                    </div>

                    {formData.providerID && (
                        <div className="provider-availability-section">
                            <h4>Provider Availability Calendar</h4>
                            <CustomerBookingCalendar
                                providerID={formData.providerID}
                                providerName={providers.find(p => p.userID === formData.providerID)?.name}
                                onBookingCreated={loadBookings}
                            />
                        </div>
                    )}

                    <div className="form-actions" style={{ marginTop: '20px' }}>
                        <button 
                            type="button" 
                            onClick={() => {
                                setShowCreateForm(false);
                                setFormData({
                                    providerID: '',
                                    category: '',
                                    description: '',
                                    scheduledDate: '',
                                    scheduledTime: '',
                                    serviceDate: '',
                                    priorityLevel: 'Normal'
                                });
                                setError(null);
                            }}
                            className="btn-cancel"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="manual-booking-list">
                <div className="bookings-header">
                    <h3>My Manual Bookings</h3>
                    <div className="category-filter-section">
                        <label>Filter by Category:</label>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="category-filter-select"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Category Filter Chips */}
                <div className="category-filters">
                    <div className="category-chips">
                        <button
                            className={`category-chip ${categoryFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setCategoryFilter('all')}
                        >
                            All
                        </button>
                        {categories.map(category => {
                            const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
                            return (
                                <button
                                    key={category}
                                    className={`category-chip ${categoryFilter === category ? 'active' : ''}`}
                                    onClick={() => setCategoryFilter(category)}
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

                {bookings.length === 0 ? (
                    <div className="empty-state">
                        <p>No manual bookings found. Create your first booking above!</p>
                    </div>
                ) : (
                    <div className="bookings-grid">
                        {bookings
                            .filter(booking => categoryFilter === 'all' || booking.category === categoryFilter)
                            .map(booking => (
                            <div key={booking.bookingID} className="booking-card">
                                <div className="booking-header">
                                    <h4>{booking.category}</h4>
                                    <span className={`status-badge ${getStatusClass(booking.requestStatus)}`}>
                                        {booking.requestStatus}
                                    </span>
                                </div>
                                <div className="booking-details">
                                    <p><strong>Provider:</strong> {booking.providerName}</p>
                                    <p><strong>Description:</strong> {booking.description}</p>
                                    <p><strong>Scheduled Date:</strong> {formatDate(booking.scheduledDate)}</p>
                                    {booking.scheduledTime && (
                                        <p><strong>Time:</strong> {formatTime(booking.scheduledTime)}</p>
                                    )}
                                    {booking.priorityLevel && booking.priorityLevel !== 'Normal' && (
                                        <p><strong>Priority:</strong> {booking.priorityLevel}</p>
                                    )}
                                    {booking.cancellationReason && (
                                        <p className="cancellation-reason">
                                            <strong>Cancellation Reason:</strong> {booking.cancellationReason}
                                        </p>
                                    )}
                                </div>
                                {booking.requestStatus !== 'Cancelled' && (
                                    <div className="booking-actions">
                                        <button
                                            onClick={() => setCancellingBooking(booking)}
                                            className="btn-cancel"
                                        >
                                            Cancel Booking
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {cancellingBooking && (
                <div className="modal-overlay" onClick={() => {
                    setCancellingBooking(null);
                    setCancelFormData({ cancellationReason: '' });
                    setError(null);
                }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Cancel Booking</h3>
                        <p>Please provide a reason for cancelling this booking:</p>
                        <form onSubmit={handleCancelBooking}>
                            <div className="form-group">
                                <textarea
                                    name="cancellationReason"
                                    className="form-textarea"
                                    value={cancelFormData.cancellationReason}
                                    onChange={handleCancelInputChange}
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
                                        setCancellingBooking(null);
                                        setCancelFormData({ cancellationReason: '' });
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

export default ManualBooking;
