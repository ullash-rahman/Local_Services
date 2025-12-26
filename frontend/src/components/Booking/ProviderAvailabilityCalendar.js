import React, { useState, useEffect } from 'react';
import { availabilityService } from '../../services/availabilityService';
import './ProviderAvailabilityCalendar.css';

const ProviderAvailabilityCalendar = () => {
    const [availability, setAvailability] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Common time slots
    const timeSlots = [
        '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
        '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
        '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00'
    ];

    useEffect(() => {
        loadAvailability();
    }, [startDate, endDate]);

    const loadAvailability = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await availabilityService.getMyAvailability(startDate || null, endDate || null);
            if (response.success) {
                setAvailability(response.data.availability || []);
            } else {
                setError(response.message || 'Failed to load availability');
            }
        } catch (err) {
            const errorMessage = err.message || err.response?.data?.message || 'Failed to load availability';
            if (!errorMessage.includes('not found')) {
                setError(errorMessage);
            }
            setAvailability([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (e) => {
        setSelectedDate(e.target.value);
    };

    const handleTimeSlotToggle = async (date, timeSlot, currentAvailable) => {
        try {
            setError(null);
            await availabilityService.setAvailability(date, timeSlot, !currentAvailable);
            setSuccess(`Availability ${!currentAvailable ? 'set' : 'removed'} successfully`);
            setTimeout(() => setSuccess(null), 3000);
            loadAvailability();
        } catch (err) {
            setError(err.message || err.response?.data?.message || 'Failed to update availability');
        }
    };

    const handleBulkSet = async (e) => {
        e.preventDefault();
        if (!selectedDate) {
            setError('Please select a date');
            return;
        }

        const selectedSlots = Array.from(e.target.elements)
            .filter(el => el.type === 'checkbox' && el.checked)
            .map(el => el.value);

        if (selectedSlots.length === 0) {
            setError('Please select at least one time slot');
            return;
        }

        try {
            setError(null);
            await availabilityService.bulkSetAvailability(selectedDate, selectedSlots, true);
            setSuccess('Availability set successfully for selected time slots');
            setTimeout(() => setSuccess(null), 3000);
            setSelectedDate('');
            loadAvailability();
        } catch (err) {
            setError(err.message || err.response?.data?.message || 'Failed to set availability');
        }
    };

    const handleDeleteDate = async (date) => {
        if (!window.confirm(`Are you sure you want to remove all availability for ${date}?`)) {
            return;
        }

        try {
            setError(null);
            await availabilityService.deleteAvailability(date);
            setSuccess('Availability removed successfully');
            setTimeout(() => setSuccess(null), 3000);
            loadAvailability();
        } catch (err) {
            setError(err.message || err.response?.data?.message || 'Failed to delete availability');
        }
    };

    const getAvailabilityForDate = (date) => {
        return availability.filter(a => a.date === date);
    };

    const isSlotAvailable = (date, timeSlot) => {
        const slot = availability.find(a => a.date === date && a.timeSlot === timeSlot);
        return slot && slot.available === 1;
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

    if (loading && availability.length === 0) {
        return <div className="availability-loading">Loading availability...</div>;
    }

    return (
        <div className="availability-calendar-container">
            <div className="availability-header">
                <h2>My Availability Calendar</h2>
                <p>Set your available days and time slots</p>
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

            <div className="availability-controls">
                <div className="view-toggle">
                    <button
                        className={viewMode === 'calendar' ? 'active' : ''}
                        onClick={() => setViewMode('calendar')}
                    >
                        Calendar View
                    </button>
                    <button
                        className={viewMode === 'list' ? 'active' : ''}
                        onClick={() => setViewMode('list')}
                    >
                        List View
                    </button>
                </div>

                <div className="date-range-filter">
                    <label>
                        Start Date:
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            min={getMinDate()}
                        />
                    </label>
                    <label>
                        End Date:
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={getMinDate()}
                        />
                    </label>
                    {(startDate || endDate) && (
                        <button onClick={() => { setStartDate(''); setEndDate(''); }}>
                            Clear Filter
                        </button>
                    )}
                </div>
            </div>

            <div className="availability-set-form">
                <h3>Set Availability for a Date</h3>
                <form onSubmit={handleBulkSet}>
                    <div className="form-group">
                        <label htmlFor="selectedDate">Select Date *</label>
                        <input
                            type="date"
                            id="selectedDate"
                            value={selectedDate}
                            onChange={handleDateChange}
                            min={getMinDate()}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Select Time Slots *</label>
                        <div className="time-slots-grid">
                            {timeSlots.map(slot => (
                                <label key={slot} className="time-slot-checkbox">
                                    <input
                                        type="checkbox"
                                        value={slot}
                                        defaultChecked={selectedDate && isSlotAvailable(selectedDate, slot)}
                                    />
                                    <span>{slot}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button type="submit" className="btn-submit">
                        Set Availability
                    </button>
                </form>
            </div>

            {viewMode === 'calendar' ? (
                <div className="availability-calendar-view">
                    <h3>Your Availability</h3>
                    {getUniqueDates().length === 0 ? (
                        <div className="empty-state">
                            <p>No availability set. Use the form above to set your availability.</p>
                        </div>
                    ) : (
                        <div className="availability-dates-list">
                            {getUniqueDates().map(date => {
                                const dateAvailability = getAvailabilityForDate(date);
                                const availableSlots = dateAvailability.filter(a => a.available === 1);
                                return (
                                    <div key={date} className="availability-date-card">
                                        <div className="date-header">
                                            <h4>{new Date(date).toLocaleDateString('en-US', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}</h4>
                                            <button
                                                onClick={() => handleDeleteDate(date)}
                                                className="btn-delete"
                                            >
                                                Remove All
                                            </button>
                                        </div>
                                        <div className="time-slots-list">
                                            {availableSlots.length === 0 ? (
                                                <p className="no-slots">No available time slots</p>
                                            ) : (
                                                availableSlots.map(slot => (
                                                    <div key={slot.availabilityID} className="time-slot-item">
                                                        <span>{slot.timeSlot}</span>
                                                        <button
                                                            onClick={() => handleTimeSlotToggle(date, slot.timeSlot, slot.available)}
                                                            className="btn-toggle"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="availability-list-view">
                    <h3>All Availability</h3>
                    {availability.length === 0 ? (
                        <div className="empty-state">
                            <p>No availability set. Use the form above to set your availability.</p>
                        </div>
                    ) : (
                        <table className="availability-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Time Slot</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {availability
                                    .filter(a => a.available === 1)
                                    .map(item => (
                                        <tr key={item.availabilityID}>
                                            <td>{new Date(item.date).toLocaleDateString()}</td>
                                            <td>{item.timeSlot}</td>
                                            <td>
                                                <span className="status-badge status-available">Available</span>
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => handleTimeSlotToggle(item.date, item.timeSlot, item.available)}
                                                    className="btn-toggle"
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProviderAvailabilityCalendar;

