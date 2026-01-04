import React, { useState, useEffect } from 'react';
import { manualBookingService } from '../../services/manualBookingService';
import './ManualBooking.css';

const ProviderManualBookings = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        loadBookings();
    }, []);

    const loadBookings = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await manualBookingService.getPendingManualBookings();
            if (response.success) {
                setBookings(response.data.bookings || []);
            } else {
                setError(response.message || 'Failed to load pending bookings');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to load pending bookings';
            if (!errorMessage.includes('not found')) {
                setError(errorMessage);
            }
            setBookings([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (bookingID) => {
        if (!window.confirm('Are you sure you want to accept this manual booking?')) {
            return;
        }

        try {
            setError(null);
            setSuccess(null);
            const response = await manualBookingService.acceptManualBooking(bookingID);
            if (response.success) {
                setSuccess('Booking accepted successfully!');
                loadBookings();
            } else {
                setError(response.message || 'Failed to accept booking');
            }
        } catch (err) {
            setError(err.message || err.response?.data?.message || 'Failed to accept booking');
        }
    };

    const handleReject = async (bookingID) => {
        if (!window.confirm('Are you sure you want to reject this manual booking?')) {
            return;
        }

        try {
            setError(null);
            setSuccess(null);
            const response = await manualBookingService.rejectManualBooking(bookingID);
            if (response.success) {
                setSuccess('Booking rejected successfully!');
                loadBookings();
            } else {
                setError(response.message || 'Failed to reject booking');
            }
        } catch (err) {
            setError(err.message || err.response?.data?.message || 'Failed to reject booking');
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

    if (loading) {
        return <div className="manual-booking-loading">Loading...</div>;
    }

    return (
        <div className="manual-booking-container">
            <div className="manual-booking-header">
                <h2>Pending Manual Bookings</h2>
                <p>Review and accept or reject manual bookings from customers</p>
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

            <div className="manual-booking-list">
                {bookings.length === 0 ? (
                    <div className="empty-state">
                        <p>No pending manual bookings at this time.</p>
                    </div>
                ) : (
                    <div className="bookings-grid">
                        {bookings.map(booking => (
                            <div key={booking.bookingID} className="booking-card">
                                <div className="booking-header">
                                    <h4>{booking.category}</h4>
                                    <span className="status-badge status-pending">
                                        {booking.requestStatus}
                                    </span>
                                </div>
                                <div className="booking-details">
                                    <p><strong>Customer:</strong> {booking.customerName}</p>
                                    <p><strong>Description:</strong> {booking.description}</p>
                                    <p><strong>Scheduled Date:</strong> {formatDate(booking.scheduledDate)}</p>
                                    {booking.scheduledTime && (
                                        <p><strong>Time:</strong> {formatTime(booking.scheduledTime)}</p>
                                    )}
                                    {booking.priorityLevel && booking.priorityLevel !== 'Normal' && (
                                        <p><strong>Priority:</strong> 
                                            <span className={`priority-${booking.priorityLevel.toLowerCase()}`}>
                                                {booking.priorityLevel}
                                            </span>
                                        </p>
                                    )}
                                    {booking.serviceDate && (
                                        <p><strong>Service Date:</strong> {formatDate(booking.serviceDate)}</p>
                                    )}
                                </div>
                                <div className="booking-actions">
                                    <button
                                        onClick={() => handleAccept(booking.bookingID)}
                                        className="btn-submit"
                                        style={{ marginRight: '10px' }}
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => handleReject(booking.bookingID)}
                                        className="btn-cancel"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProviderManualBookings;

