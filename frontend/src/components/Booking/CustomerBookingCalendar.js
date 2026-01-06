import React, { useState, useEffect } from 'react';
import { availabilityService } from '../../services/availabilityService';
import { manualBookingService } from '../../services/manualBookingService';
import { SERVICE_CATEGORIES } from '../../utils/categories';
import './CustomerBookingCalendar.css';

const CustomerBookingCalendar = ({ providerID, providerName, onBookingCreated }) => {
    const [availability, setAvailability] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [submitting, setSubmitting] = useState(false);
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

    // Note: timeSlots removed as we get them from availability API

    // Use shared categories
    const categories = SERVICE_CATEGORIES;

    useEffect(() => {
        if (providerID) {
            loadProviderAvailability();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                // Normalize dates to YYYY-MM-DD format
                const normalizedAvailability = (response.data.availability || []).map(a => ({
                    ...a,
                    date: a.date ? (a.date.includes('T') ? a.date.split('T')[0] : a.date.split(' ')[0]) : a.date
                }));
                setAvailability(normalizedAvailability);
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
        // Normalize date for comparison
        const normalizedDate = date ? (date.includes('T') ? date.split('T')[0] : date.split(' ')[0]) : date;
        return availability.filter(a => {
            const normalizedADate = a.date ? (a.date.includes('T') ? a.date.split('T')[0] : a.date.split(' ')[0]) : a.date;
            return normalizedADate === normalizedDate && a.available === 1;
        });
    };

    const handleDateClick = (date) => {
        const dateAvailability = getAvailabilityForDate(date);
        if (dateAvailability.length > 0) {
            // Normalize date to YYYY-MM-DD format
            const normalizedDate = date ? (date.includes('T') ? date.split('T')[0] : date.split(' ')[0]) : date;
            setSelectedDate(normalizedDate);
            setShowBookingForm(true);
            // Initialize serviceDate with selected date
            setBookingFormData(prev => ({
                ...prev,
                serviceDate: normalizedDate
            }));
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
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        console.log('=== HANDLE BOOKING SUBMIT CALLED ===');
        console.log('Event:', e);
        console.log('Submitting state:', submitting);
        
        if (submitting) {
            console.log('Already submitting, ignoring...');
            return;
        }
        
        setError(null);
        setSuccess(null);
        setSubmitting(true);

        console.log('Form submission started');
        console.log('Form data:', {
            selectedDate,
            selectedTimeSlot,
            bookingFormData,
            providerID
        });

        if (!selectedDate) {
            setError('Please select a date');
            setSubmitting(false);
            return;
        }

        if (!bookingFormData.category) {
            setError('Please select a service category');
            setSubmitting(false);
            return;
        }

        if (!bookingFormData.description || bookingFormData.description.trim().length < 10) {
            setError('Description must be at least 10 characters long');
            setSubmitting(false);
            return;
        }

        if (!providerID) {
            setError('Provider ID is missing');
            setSubmitting(false);
            return;
        }

        try {
            // Use the full time slot (e.g., "10:00-11:00") from selectedTimeSlot
            // This ensures we use the exact format stored in the availability table
            const timeSlotToSend = selectedTimeSlot || null;
            
            // Ensure date is in YYYY-MM-DD format
            // Handle both ISO string format and YYYY-MM-DD format
            let formattedDate = selectedDate;
            if (selectedDate) {
                if (selectedDate.includes('T')) {
                    // ISO string format - extract date part
                    formattedDate = selectedDate.split('T')[0];
                } else if (selectedDate.includes(' ')) {
                    // Date with time - extract date part
                    formattedDate = selectedDate.split(' ')[0];
                } else {
                    // Already in YYYY-MM-DD format
                    formattedDate = selectedDate;
                }
            }
            
            let formattedServiceDate = formattedDate;
            if (bookingFormData.serviceDate) {
                if (bookingFormData.serviceDate.includes('T')) {
                    formattedServiceDate = bookingFormData.serviceDate.split('T')[0];
                } else if (bookingFormData.serviceDate.includes(' ')) {
                    formattedServiceDate = bookingFormData.serviceDate.split(' ')[0];
                } else {
                    formattedServiceDate = bookingFormData.serviceDate;
                }
            }
            
            const bookingPayload = {
                providerID,
                category: bookingFormData.category,
                description: bookingFormData.description.trim(),
                scheduledDate: formattedDate,
                scheduledTime: timeSlotToSend,
                serviceDate: formattedServiceDate,
                priorityLevel: bookingFormData.priorityLevel
            };

            console.log('Sending booking request:', bookingPayload);
            
            const response = await manualBookingService.createManualBooking(bookingPayload);
            
            console.log('Booking response:', response);

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
                // Call callback to refresh bookings list if provided
                if (onBookingCreated) {
                    setTimeout(() => {
                        onBookingCreated();
                    }, 1000);
                } else if (window.location.pathname.includes('manual-bookings')) {
                    // Fallback to page reload if no callback provided
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                }
            } else {
                setError(response.message || 'Failed to create booking');
            }
        } catch (err) {
            console.error('=== BOOKING ERROR ===');
            console.error('Error object:', err);
            console.error('Error message:', err.message);
            console.error('Error response:', err.response);
            console.error('Error response data:', err.response?.data);
            console.error('Error stack:', err.stack);
            
            const errorMessage = err.response?.data?.message || err.message || 'Failed to create booking';
            console.error('Setting error message:', errorMessage);
            setError(errorMessage);
        } finally {
            console.log('Setting submitting to false');
            setSubmitting(false);
        }
    };

    // Get unique dates from availability
    const getUniqueDates = () => {
        // Normalize dates and get unique ones
        const normalizedDates = availability.map(a => {
            const date = a.date;
            return date ? (date.includes('T') ? date.split('T')[0] : date.split(' ')[0]) : date;
        });
        const dates = [...new Set(normalizedDates)];
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
                <div className="booking-form-section">
                    <div className="booking-form-header">
                        <h3>Create Booking</h3>
                        <button
                            type="button"
                            onClick={() => {
                                setShowBookingForm(false);
                                setSelectedDate('');
                                setSelectedTimeSlot('');
                                setError(null);
                                setBookingFormData({
                                    category: '',
                                    description: '',
                                    scheduledTime: '',
                                    serviceDate: '',
                                    priorityLevel: 'Normal'
                                });
                            }}
                            className="close-form-btn"
                            aria-label="Close form"
                        >
                            ×
                        </button>
                    </div>
                    <div className="booking-form-info">
                        <p><strong>Date:</strong> {new Date(selectedDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}</p>
                        {selectedTimeSlot && (
                            <p><strong>Time Slot:</strong> {selectedTimeSlot}</p>
                        )}
                    </div>

                    <form 
                        onSubmit={(e) => {
                            console.log('Form onSubmit triggered!');
                            handleBookingSubmit(e);
                        }} 
                        className="booking-form"
                        noValidate
                    >
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
                            <button 
                                type="button"
                                className="btn-submit" 
                                disabled={submitting}
                                onClick={(e) => {
                                    console.log('=== BUTTON CLICKED DIRECTLY ===');
                                    console.log('Event:', e);
                                    console.log('Submitting:', submitting);
                                    console.log('Form data:', { selectedDate, selectedTimeSlot, bookingFormData, providerID });
                                    
                                    // Manually trigger form submission
                                    const form = e.target.closest('form');
                                    if (form) {
                                        console.log('Found form, triggering submit');
                                        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                                        form.dispatchEvent(submitEvent);
                                    } else {
                                        console.log('No form found, calling handleBookingSubmit directly');
                                        handleBookingSubmit(e);
                                    }
                                }}
                            >
                                {submitting ? 'Creating...' : 'Create Booking'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowBookingForm(false);
                                    setSelectedDate('');
                                    setSelectedTimeSlot('');
                                    setError(null);
                                    setBookingFormData({
                                        category: '',
                                        description: '',
                                        scheduledTime: '',
                                        serviceDate: '',
                                        priorityLevel: 'Normal'
                                    });
                                }}
                                className="btn-cancel"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default CustomerBookingCalendar;

