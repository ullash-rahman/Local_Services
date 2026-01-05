import React, { useState, useEffect } from 'react';
import { maintenanceService } from '../../services/maintenanceService';
import './MaintenanceReminders.css';

const MaintenanceReminders = () => {
    const [reminders, setReminders] = useState([]);
    const [upcomingReminders, setUpcomingReminders] = useState([]);
    const [overdueReminders, setOverdueReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'upcoming', 'overdue'
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        serviceType: '',
        lastServiceDate: '',
        nextServiceDate: '',
        reminderFrequency: 30
    });
    const [formError, setFormError] = useState(null);

    useEffect(() => {
        loadReminders();
        loadUpcomingReminders();
        loadOverdueReminders();
    }, []);

    const loadReminders = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await maintenanceService.getMaintenanceReminders();
            if (response.success) {
                setReminders(response.data.reminders || []);
            }
        } catch (err) {
            console.error('Error loading reminders:', err);
            setError(err.message || 'Failed to load maintenance reminders');
        } finally {
            setLoading(false);
        }
    };

    const loadUpcomingReminders = async () => {
        try {
            const response = await maintenanceService.getUpcomingReminders(7);
            if (response.success) {
                setUpcomingReminders(response.data.reminders || []);
            }
        } catch (err) {
            console.error('Error loading upcoming reminders:', err);
        }
    };

    const loadOverdueReminders = async () => {
        try {
            const response = await maintenanceService.getOverdueReminders();
            if (response.success) {
                setOverdueReminders(response.data.reminders || []);
            }
        } catch (err) {
            console.error('Error loading overdue reminders:', err);
        }
    };

    const handleCreateReminder = async (e) => {
        e.preventDefault();
        setFormError(null);

        try {
            const response = await maintenanceService.createMaintenanceReminder(formData);
            if (response.success) {
                setShowCreateModal(false);
                setFormData({
                    serviceType: '',
                    lastServiceDate: '',
                    nextServiceDate: '',
                    reminderFrequency: 30
                });
                loadReminders();
                loadUpcomingReminders();
                loadOverdueReminders();
            }
        } catch (err) {
            setFormError(err.message || 'Failed to create reminder');
        }
    };

    const handleMarkAsCompleted = async (reminderID) => {
        try {
            const response = await maintenanceService.markReminderAsCompleted(reminderID);
            if (response.success) {
                loadReminders();
                loadUpcomingReminders();
                loadOverdueReminders();
            }
        } catch (err) {
            console.error('Error marking reminder as completed:', err);
            alert(err.message || 'Failed to mark reminder as completed');
        }
    };

    const handleDeleteReminder = async (reminderID) => {
        if (!window.confirm('Are you sure you want to delete this reminder?')) {
            return;
        }

        try {
            const response = await maintenanceService.deleteMaintenanceReminder(reminderID);
            if (response.success) {
                loadReminders();
                loadUpcomingReminders();
                loadOverdueReminders();
            }
        } catch (err) {
            console.error('Error deleting reminder:', err);
            alert(err.message || 'Failed to delete reminder');
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

    const getDaysUntil = (dateString) => {
        if (!dateString) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(dateString);
        targetDate.setHours(0, 0, 0, 0);
        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const getDisplayReminders = () => {
        switch (activeTab) {
            case 'upcoming':
                return upcomingReminders;
            case 'overdue':
                return overdueReminders;
            default:
                return reminders.filter(r => r.status === 'Active');
        }
    };

    const displayReminders = getDisplayReminders();

    return (
        <div className="maintenance-reminders-container">
            <div className="maintenance-header">
                <div>
                    <h2>Maintenance Reminders</h2>
                    <p className="header-description">Track and manage your recurring service reminders</p>
                </div>
                <button 
                    className="btn-create"
                    onClick={() => setShowCreateModal(true)}
                >
                    + Create Reminder
                </button>
            </div>

            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                >
                    All ({reminders.filter(r => r.status === 'Active').length})
                </button>
                <button
                    className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`}
                    onClick={() => setActiveTab('upcoming')}
                >
                    Upcoming ({upcomingReminders.length})
                </button>
                <button
                    className={`tab ${activeTab === 'overdue' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overdue')}
                >
                    Overdue ({overdueReminders.length})
                </button>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading reminders...</p>
                </div>
            ) : displayReminders.length === 0 ? (
                <div className="empty-state">
                    <p>No maintenance reminders found</p>
                    <p className="empty-hint">
                        {activeTab === 'all' 
                            ? 'Create a reminder to track your recurring services'
                            : `No ${activeTab} reminders at this time`
                        }
                    </p>
                </div>
            ) : (
                <div className="reminders-list">
                    {displayReminders.map((reminder) => {
                        const daysUntil = getDaysUntil(reminder.nextServiceDate);
                        const isOverdue = daysUntil !== null && daysUntil < 0;
                        const isUpcoming = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;

                        return (
                            <div 
                                key={reminder.reminderID} 
                                className={`reminder-card ${isOverdue ? 'overdue' : ''} ${isUpcoming ? 'upcoming' : ''}`}
                            >
                                <div className="reminder-header">
                                    <div>
                                        <h3 className="service-type">{reminder.serviceType}</h3>
                                        <span className={`status-badge status-${reminder.status.toLowerCase()}`}>
                                            {reminder.status}
                                        </span>
                                    </div>
                                    {isOverdue && (
                                        <span className="overdue-badge">Overdue</span>
                                    )}
                                    {isUpcoming && !isOverdue && (
                                        <span className="upcoming-badge">Due Soon</span>
                                    )}
                                </div>
                                <div className="reminder-body">
                                    <div className="reminder-details">
                                        <div className="detail-item">
                                            <span className="detail-label">Last Service:</span>
                                            <span className="detail-value">{formatDate(reminder.lastServiceDate)}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Next Service:</span>
                                            <span className="detail-value highlight">{formatDate(reminder.nextServiceDate)}</span>
                                            {daysUntil !== null && (
                                                <span className={`days-indicator ${isOverdue ? 'overdue' : ''}`}>
                                                    ({isOverdue ? `${Math.abs(daysUntil)} days overdue` : `${daysUntil} days`})
                                                </span>
                                            )}
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Frequency:</span>
                                            <span className="detail-value">{reminder.reminderFrequency} days</span>
                                        </div>
                                    </div>
                                    <div className="reminder-actions">
                                        <button
                                            className="btn-action btn-complete"
                                            onClick={() => handleMarkAsCompleted(reminder.reminderID)}
                                        >
                                            Mark as Completed
                                        </button>
                                        <button
                                            className="btn-action btn-delete"
                                            onClick={() => handleDeleteReminder(reminder.reminderID)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Create Maintenance Reminder</h3>
                            <button 
                                className="modal-close"
                                onClick={() => setShowCreateModal(false)}
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleCreateReminder} className="modal-form">
                            {formError && (
                                <div className="error-message">{formError}</div>
                            )}
                            <div className="form-group">
                                <label>Service Type *</label>
                                <input
                                    type="text"
                                    value={formData.serviceType}
                                    onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                                    required
                                    placeholder="e.g., HVAC Maintenance, Car Service"
                                />
                            </div>
                            <div className="form-group">
                                <label>Last Service Date *</label>
                                <input
                                    type="date"
                                    value={formData.lastServiceDate}
                                    onChange={(e) => setFormData({ ...formData, lastServiceDate: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Next Service Date *</label>
                                <input
                                    type="date"
                                    value={formData.nextServiceDate}
                                    onChange={(e) => setFormData({ ...formData, nextServiceDate: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Reminder Frequency (days)</label>
                                <input
                                    type="number"
                                    value={formData.reminderFrequency}
                                    onChange={(e) => setFormData({ ...formData, reminderFrequency: parseInt(e.target.value) || 30 })}
                                    min="1"
                                    placeholder="30"
                                />
                            </div>
                            <div className="modal-actions">
                                <button 
                                    type="button" 
                                    className="btn-secondary"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Create Reminder
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenanceReminders;

