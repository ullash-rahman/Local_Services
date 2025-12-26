import React, { useState, useEffect } from 'react';
import { availabilityService } from '../../services/availabilityService';
import { manualBookingService } from '../../services/manualBookingService';
import './CustomerBookingCalendar.css';

const CustomerBookingCalendar = ({ providerID, providerName }) => {
    const [availability, setAvailability] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
    const [showBookingForm, setShowBookingForm] = useState(false);
    const [bookingFormData, setBookingFormData] = useState({
        category: '',
        description: '',
        scheduledTime: '',
        serviceDate: '',
        priorityLevel: 'Normal'
    });

    // Common time slots
    const timeSlots = [
        '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
        '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
        '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00'
    ];

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

    useEffect(() => {
        if (providerID) {
            loadProviderAvailability();
        }
    }, [providerID]);

    const loadProviderAvailability = async () => {
        try {
            setLoading(true);
            setError(null);
            // Get availability for next 30 days
            const today = new Date();
            const endDate = new Date(today);
            endDate.setDate(today.getDate() + 30);
            
            const response = await availabilityService.getProviderAvailability(
                providerID,
                today.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0]
            );
            if (response.success) {
                setAvailability(response.data.availability || []);
            } else {
                setError(response.message || 'Failed to load provider availability');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to load provider availability';
            if (!errorMessage.includes('not found')) {
                setError(errorMessage);
            }
            setAvailability([]);
        } finally {
            setLoading(false);
        }
    };

    const getAvailabilityForDate = (date) => {
        return availability.filter(a => a.date === date && a.available === 1);
    };

    const handleDateClick = (date) => {
        const dateAvailability = getAvailabilityForDate(date);
        if (dateAvailability.length > 0) {
            setSelectedDate(date);
            setShowBookingForm(true);
        } else {
            setError('Provider is not available on this date');
        }
    };

    const handleTimeSlotSelect = (timeSlot) => {
        setSelectedTimeSlot(timeSlot);
        setBookingFormData(prev => ({
            ...prev,
            scheduledTime: timeSlot.split('-')[0] // Use start time
        }));
    };

    const handleBookingFormChange = (e) => {
        const { name, value } = e.target;
        setBookingFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!selectedDate) {
            setError('Please select a date');
            return;
        }

        if (!bookingFormData.category) {
            setError('Please select a service category');
            return;
        }

        if (!bookingFormData.description || bookingFormData.description.trim().length < 10) {
            setError('Description must be at least 10 characters long');
            return;
        }

        try {
            const response = await manualBookingService.createManualBooking({
                providerID,
                category: bookingFormData.category,
                description: bookingFormData.description.trim(),
                scheduledDate: selectedDate,
                scheduledTime: bookingFormData.scheduledTime || null,
                serviceDate: bookingFormData.serviceDate || selectedDate,
                priorityLevel: bookingFormData.priorityLevel
            });

            if (response.success) {
                setSuccess('Booking created successfully!');
                setShowBookingForm(false);
                setSelectedDate('');
                setSelectedTimeSlot('');
                setBookingFormData({
                    category: '',
                    description: '',
                    scheduledTime: '',
                    serviceDate: '',
                    priorityLevel: 'Normal'
                });
                setTimeout(() => {
                    if (window.location.pathname.includes('manual-bookings')) {
                        window.location.reload();
                    }
                }, 2000);
            } else {
                setError(response.message || 'Failed to create booking');
            }
        } catch (err) {
            setError(err.message || err.response?.data?.message || 'Failed to create booking');
        }
    };

    // Get unique dates from availability
    const getUniqueDates = () => {
        const dates = [...new Set(availability.map(a => a.date))];
        return dates.sort();
    };

    // Get min date (today)
    const getMinDate = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    };

    if (loading) {
        return <div className="booking-calendar-loading">Loading provider availability...</div>;
    }

    return (
        <div className="customer-booking-calendar-container">
            <div className="booking-calendar-header">
                <h2>Book with {providerName || 'Provider'}</h2>
                <p>Select an available date and time slot to book</p>
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

            {availability.length === 0 ? (
                <div className="empty-state">
                    <p>This provider has not set their availability yet.</p>
                </div>
            ) : (
                <div className="availability-calendar-grid">
                    {getUniqueDates().map(date => {
                        const dateAvailability = getAvailabilityForDate(date);
                        return (
                            <div key={date} className="availability-date-card">
                                <div className="date-header">
                                    <h4>{new Date(date).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric'
                                    })}</h4>
                                    <span className="slots-count">{dateAvailability.length} slots</span>
                                </div>
                                <div className="time-slots-grid">
                                    {dateAvailability.map(slot => (
                                        <button
                                            key={slot.availabilityID}
                                            className={`time-slot-btn ${selectedDate === date && selectedTimeSlot === slot.timeSlot ? 'selected' : ''}`}
                                            onClick={() => {
                                                handleDateClick(date);
                                                handleTimeSlotSelect(slot.timeSlot);
                                            }}
                                        >
                                            {slot.timeSlot}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showBookingForm && (
                <div className="modal-overlay" onClick={() => {
                    setShowBookingForm(false);
                    setError(null);
                }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Create Booking</h3>
                        <p><strong>Date:</strong> {new Date(selectedDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}</p>
                        {selectedTimeSlot && (
                            <p><strong>Time Slot:</strong> {selectedTimeSlot}</p>
                        )}

                        <form onSubmit={handleBookingSubmit}>
                            <div className="form-group">
                                <label htmlFor="category">Service Category *</label>
                                <select
                                    id="category"
                                    name="category"
                                    className="form-select"
                                    value={bookingFormData.category}
                                    onChange={handleBookingFormChange}
                                    required
                                >
                                    <option value="">-- Select Category --</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="description">Service Description *</label>
                                <textarea
                                    id="description"
                                    name="description"
                                    className="form-textarea"
                                    value={bookingFormData.description}
                                    onChange={handleBookingFormChange}
                                    placeholder="Describe the service you need (minimum 10 characters)..."
                                    rows="4"
                                    required
                                />
                                <span className="form-help">Minimum 10 characters required</span>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="serviceDate">Service Date</label>
                                    <input
                                        type="date"
                                        id="serviceDate"
                                        name="serviceDate"
                                        className="form-input"
                                        value={bookingFormData.serviceDate}
                                        onChange={handleBookingFormChange}
                                        min={getMinDate()}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="priorityLevel">Priority Level</label>
                                    <select
                                        id="priorityLevel"
                                        name="priorityLevel"
                                        className="form-select"
                                        value={bookingFormData.priorityLevel}
                                        onChange={handleBookingFormChange}
                                    >
                                        <option value="Normal">Normal</option>
                                        <option value="High">High</option>
                                        <option value="Emergency">Emergency</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn-submit">
                                    Create Booking
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowBookingForm(false);
                                        setError(null);
                                    }}
                                    className="btn-cancel"
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

export default CustomerBookingCalendar;

