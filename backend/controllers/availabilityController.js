const Availability = require('../models/Availability');
const User = require('../models/User');

// Set availability for a provider (Provider only)
const setAvailability = async (req, res) => {
    try {
        const providerID = req.user.userID;
        const { date, timeSlot, available } = req.body;

        // Validation
        if (!date || !timeSlot) {
            return res.status(400).json({
                success: false,
                message: 'Date and time slot are required'
            });
        }

        // Validate date format
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        // Validate date is not in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = new Date(dateObj);
        selectedDate.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
            return res.status(400).json({
                success: false,
                message: 'Cannot set availability for past dates'
            });
        }

        // Validate time slot format (e.g., "09:00-10:00" or "Morning", "Afternoon", "Evening")
        if (typeof timeSlot !== 'string' || timeSlot.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid time slot format'
            });
        }

        // Set availability
        await Availability.setAvailability(
            providerID,
            date,
            timeSlot.trim(),
            available !== undefined ? available : true
        );

        res.status(200).json({
            success: true,
            message: 'Availability set successfully',
            data: {
                providerID,
                date,
                timeSlot: timeSlot.trim(),
                available: available !== undefined ? available : true
            }
        });
    } catch (error) {
        console.error('Set availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while setting availability',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Bulk set availability for multiple time slots (Provider only)
const bulkSetAvailability = async (req, res) => {
    try {
        const providerID = req.user.userID;
        const { date, timeSlots, available } = req.body;

        // Validation
        if (!date || !timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Date and time slots array are required'
            });
        }

        // Validate date format
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        // Validate date is not in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = new Date(dateObj);
        selectedDate.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
            return res.status(400).json({
                success: false,
                message: 'Cannot set availability for past dates'
            });
        }

        // Validate time slots
        const validTimeSlots = timeSlots.filter(ts => typeof ts === 'string' && ts.trim().length > 0);
        if (validTimeSlots.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid time slots provided'
            });
        }

        // Bulk set availability
        await Availability.bulkSetAvailability(
            providerID,
            date,
            validTimeSlots.map(ts => ts.trim()),
            available !== undefined ? available : true
        );

        res.status(200).json({
            success: true,
            message: 'Availability set successfully for multiple time slots',
            data: {
                providerID,
                date,
                timeSlots: validTimeSlots.map(ts => ts.trim()),
                available: available !== undefined ? available : true
            }
        });
    } catch (error) {
        console.error('Bulk set availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while setting availability',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get availability for the current provider (Provider only)
const getMyAvailability = async (req, res) => {
    try {
        const providerID = req.user.userID;
        const { startDate, endDate } = req.query;

        let availability;

        if (startDate && endDate) {
            // Get availability for date range
            availability = await Availability.getByProviderAndDateRange(providerID, startDate, endDate);
        } else {
            // Get all availability
            availability = await Availability.getByProvider(providerID);
        }

        res.status(200).json({
            success: true,
            message: 'Availability retrieved successfully',
            data: { availability }
        });
    } catch (error) {
        console.error('Get availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving availability',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get availability for a specific provider (Customer can view)
const getProviderAvailability = async (req, res) => {
    try {
        const { providerID } = req.params;
        const { startDate, endDate } = req.query;

        // Verify provider exists and is a Provider
        const provider = await User.findById(providerID);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        if (provider.role !== 'Provider') {
            return res.status(400).json({
                success: false,
                message: 'User is not a provider'
            });
        }

        let availability;

        if (startDate && endDate) {
            // Get availability for date range
            availability = await Availability.getByProviderAndDateRange(providerID, startDate, endDate);
        } else {
            // Get availability for next 30 days by default
            const today = new Date();
            const endDateDefault = new Date(today);
            endDateDefault.setDate(today.getDate() + 30);
            availability = await Availability.getByProviderAndDateRange(
                providerID,
                today.toISOString().split('T')[0],
                endDateDefault.toISOString().split('T')[0]
            );
        }

        res.status(200).json({
            success: true,
            message: 'Provider availability retrieved successfully',
            data: { availability, provider: { name: provider.name, email: provider.email } }
        });
    } catch (error) {
        console.error('Get provider availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving provider availability',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Delete availability for a provider (Provider only)
const deleteAvailability = async (req, res) => {
    try {
        const providerID = req.user.userID;
        const { date, timeSlot } = req.body;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date is required'
            });
        }

        let deleted = false;

        if (timeSlot) {
            // Delete specific time slot
            deleted = await Availability.deleteAvailability(providerID, date, timeSlot);
        } else {
            // Delete all time slots for the date
            deleted = await Availability.deleteByDate(providerID, date);
        }

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Availability not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Availability deleted successfully'
        });
    } catch (error) {
        console.error('Delete availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting availability',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get available providers for a specific date and time slot (Customer can view)
const getAvailableProviders = async (req, res) => {
    try {
        const { date, timeSlot } = req.query;

        if (!date || !timeSlot) {
            return res.status(400).json({
                success: false,
                message: 'Date and time slot are required'
            });
        }

        const providers = await Availability.getAvailableProviders(date, timeSlot);

        res.status(200).json({
            success: true,
            message: 'Available providers retrieved successfully',
            data: { providers }
        });
    } catch (error) {
        console.error('Get available providers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving available providers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    setAvailability,
    bulkSetAvailability,
    getMyAvailability,
    getProviderAvailability,
    deleteAvailability,
    getAvailableProviders
};

