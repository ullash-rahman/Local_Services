const MaintenanceReminder = require('../models/MaintenanceReminder');
const Notification = require('../models/Notification');

// Get maintenance reminders for current customer
const getMaintenanceReminders = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const status = req.query.status || null;

        const reminders = await MaintenanceReminder.getByCustomer(customerID, status);

        res.status(200).json({
            success: true,
            data: { reminders }
        });
    } catch (error) {
        console.error('Get maintenance reminders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching maintenance reminders',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get upcoming maintenance reminders
const getUpcomingReminders = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const daysAhead = parseInt(req.query.daysAhead) || 7;

        const reminders = await MaintenanceReminder.getUpcoming(customerID, daysAhead);

        res.status(200).json({
            success: true,
            data: { reminders }
        });
    } catch (error) {
        console.error('Get upcoming reminders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching upcoming reminders',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get overdue maintenance reminders
const getOverdueReminders = async (req, res) => {
    try {
        const customerID = req.user.userID;

        const reminders = await MaintenanceReminder.getOverdue(customerID);

        res.status(200).json({
            success: true,
            data: { reminders }
        });
    } catch (error) {
        console.error('Get overdue reminders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching overdue reminders',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get maintenance reminder by ID
const getMaintenanceReminderById = async (req, res) => {
    try {
        const { reminderID } = req.params;
        const customerID = req.user.userID;

        const reminder = await MaintenanceReminder.findById(reminderID);

        if (!reminder) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance reminder not found'
            });
        }

        if (reminder.customerID !== customerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view this reminder'
            });
        }

        res.status(200).json({
            success: true,
            data: { reminder }
        });
    } catch (error) {
        console.error('Get maintenance reminder by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching maintenance reminder',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Create maintenance reminder
const createMaintenanceReminder = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const { serviceType, lastServiceDate, nextServiceDate, reminderFrequency } = req.body;

        // Validation
        if (!serviceType || !lastServiceDate || !nextServiceDate) {
            return res.status(400).json({
                success: false,
                message: 'Service type, last service date, and next service date are required'
            });
        }

        // Validate dates
        const lastDate = new Date(lastServiceDate);
        const nextDate = new Date(nextServiceDate);
        if (isNaN(lastDate.getTime()) || isNaN(nextDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        if (nextDate <= lastDate) {
            return res.status(400).json({
                success: false,
                message: 'Next service date must be after last service date'
            });
        }

        const reminderID = await MaintenanceReminder.create({
            customerID,
            serviceType,
            lastServiceDate,
            nextServiceDate,
            reminderFrequency: reminderFrequency || 30
        });

        const reminder = await MaintenanceReminder.findById(reminderID);

        res.status(201).json({
            success: true,
            message: 'Maintenance reminder created successfully',
            data: { reminder }
        });
    } catch (error) {
        console.error('Create maintenance reminder error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating maintenance reminder',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Update maintenance reminder
const updateMaintenanceReminder = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const { reminderID } = req.params;
        const updateData = req.body;

        // Verify reminder exists and belongs to customer
        const existingReminder = await MaintenanceReminder.findById(reminderID);
        if (!existingReminder) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance reminder not found'
            });
        }

        if (existingReminder.customerID !== customerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to update this reminder'
            });
        }

        // Validate dates if provided
        if (updateData.lastServiceDate) {
            const lastDate = new Date(updateData.lastServiceDate);
            if (isNaN(lastDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid last service date format'
                });
            }
        }

        if (updateData.nextServiceDate) {
            const nextDate = new Date(updateData.nextServiceDate);
            if (isNaN(nextDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid next service date format'
                });
            }
        }

        const reminder = await MaintenanceReminder.update(reminderID, customerID, updateData);

        res.status(200).json({
            success: true,
            message: 'Maintenance reminder updated successfully',
            data: { reminder }
        });
    } catch (error) {
        console.error('Update maintenance reminder error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating maintenance reminder',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Delete maintenance reminder
const deleteMaintenanceReminder = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const { reminderID } = req.params;

        // Verify reminder exists and belongs to customer
        const existingReminder = await MaintenanceReminder.findById(reminderID);
        if (!existingReminder) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance reminder not found'
            });
        }

        if (existingReminder.customerID !== customerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this reminder'
            });
        }

        const deleted = await MaintenanceReminder.delete(reminderID, customerID);

        if (!deleted) {
            return res.status(400).json({
                success: false,
                message: 'Failed to delete maintenance reminder'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Maintenance reminder deleted successfully'
        });
    } catch (error) {
        console.error('Delete maintenance reminder error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting maintenance reminder',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Mark maintenance reminder as completed
const markReminderAsCompleted = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const { reminderID } = req.params;
        const { completionDate } = req.body;

        // Verify reminder exists and belongs to customer
        const existingReminder = await MaintenanceReminder.findById(reminderID);
        if (!existingReminder) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance reminder not found'
            });
        }

        if (existingReminder.customerID !== customerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to update this reminder'
            });
        }

        // Validate completion date if provided
        if (completionDate) {
            const date = new Date(completionDate);
            if (isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid completion date format'
                });
            }
        }

        const reminder = await MaintenanceReminder.markAsCompleted(reminderID, customerID, completionDate);

        if (!reminder) {
            return res.status(400).json({
                success: false,
                message: 'Failed to mark reminder as completed'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Maintenance reminder marked as completed successfully',
            data: { reminder }
        });
    } catch (error) {
        console.error('Mark reminder as completed error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while marking reminder as completed',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    getMaintenanceReminders,
    getUpcomingReminders,
    getOverdueReminders,
    getMaintenanceReminderById,
    createMaintenanceReminder,
    updateMaintenanceReminder,
    deleteMaintenanceReminder,
    markReminderAsCompleted
};

