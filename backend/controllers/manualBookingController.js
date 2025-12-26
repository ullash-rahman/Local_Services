const Booking = require('../models/Booking');
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const Availability = require('../models/Availability');

// Create a manual booking for a preferred provider
const createManualBooking = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const { providerID, category, description, scheduledDate, scheduledTime, serviceDate, priorityLevel } = req.body;

        // Validation
        if (!providerID || !category || !description || !scheduledDate) {
            return res.status(400).json({
                success: false,
                message: 'Provider ID, category, description, and scheduled date are required'
            });
        }

        if (description.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Description must be at least 10 characters long'
            });
        }

        // Validate scheduled date
        if (scheduledDate) {
            const date = new Date(scheduledDate);
            if (isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid scheduled date format'
                });
            }
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDate = new Date(date);
            selectedDate.setHours(0, 0, 0, 0);
            if (selectedDate < today) {
                return res.status(400).json({
                    success: false,
                    message: 'Scheduled date cannot be in the past'
                });
            }
        }

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
                message: 'Selected user is not a provider'
            });
        }

        // Check if provider is verified
        if (!provider.verified) {
            return res.status(400).json({
                success: false,
                message: 'Provider is not verified'
            });
        }

        // Check provider availability if timeSlot is provided
        if (scheduledTime) {
            // Convert scheduledTime to timeSlot format (e.g., "09:00" -> "09:00-10:00" or use as-is)
            const timeSlot = scheduledTime.length === 5 ? scheduledTime : scheduledTime;
            const isAvailable = await Availability.isAvailable(providerID, scheduledDate, timeSlot);
            
            if (!isAvailable) {
                return res.status(400).json({
                    success: false,
                    message: 'Provider is not available at the selected date and time. Please check provider availability calendar.'
                });
            }
        } else {
            // If no specific time, check if provider has any availability on that date
            const dateAvailability = await Availability.getByProviderAndDate(providerID, scheduledDate);
            if (dateAvailability.length === 0 || !dateAvailability.some(a => a.available)) {
                return res.status(400).json({
                    success: false,
                    message: 'Provider is not available on the selected date. Please check provider availability calendar.'
                });
            }
        }

        // Create service request first
        const requestID = await ServiceRequest.create({
            customerID,
            category: category.trim(),
            description: description.trim(),
            serviceDate: serviceDate || scheduledDate
        });

        // Set providerID but keep status as Pending (provider needs to accept/reject)
        await ServiceRequest.updateWithProvider(requestID, { 
            providerID: providerID,
            status: 'Pending', // Keep as Pending for provider to accept/reject
            priorityLevel: priorityLevel || 'Normal'
        });

        // Create booking with manualBooking flag set to true
        const bookingID = await Booking.create({
            requestID,
            providerID,
            scheduledDate,
            scheduledTime: scheduledTime || null,
            manualBooking: true
        });

        // Get the created booking with details
        const booking = await Booking.findById(bookingID);

        res.status(201).json({
            success: true,
            message: 'Manual booking created successfully',
            data: { booking }
        });
    } catch (error) {
        console.error('Create manual booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating manual booking',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get all manual bookings for the current customer
const getMyManualBookings = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const bookings = await Booking.getByCustomer(customerID, true);

        res.status(200).json({
            success: true,
            message: 'Manual bookings retrieved successfully',
            data: { bookings }
        });
    } catch (error) {
        console.error('Get manual bookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving manual bookings',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get a specific manual booking by ID
const getManualBookingById = async (req, res) => {
    try {
        const { bookingID } = req.params;
        const customerID = req.user.userID;

        const booking = await Booking.findById(bookingID);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Verify the booking belongs to the customer
        if (booking.customerID !== customerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view this booking'
            });
        }

        // Verify it's a manual booking
        if (!booking.manualBooking) {
            return res.status(400).json({
                success: false,
                message: 'This is not a manual booking'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Manual booking retrieved successfully',
            data: { booking }
        });
    } catch (error) {
        console.error('Get manual booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving manual booking',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Update a manual booking
const updateManualBooking = async (req, res) => {
    try {
        const { bookingID } = req.params;
        const customerID = req.user.userID;
        const { scheduledDate, scheduledTime } = req.body;

        // Get the booking first
        const booking = await Booking.findById(bookingID);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Verify the booking belongs to the customer
        if (booking.customerID !== customerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to update this booking'
            });
        }

        // Verify it's a manual booking
        if (!booking.manualBooking) {
            return res.status(400).json({
                success: false,
                message: 'This is not a manual booking'
            });
        }

        // Validate scheduled date if provided
        if (scheduledDate) {
            const date = new Date(scheduledDate);
            if (isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid scheduled date format'
                });
            }
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDate = new Date(date);
            selectedDate.setHours(0, 0, 0, 0);
            if (selectedDate < today) {
                return res.status(400).json({
                    success: false,
                    message: 'Scheduled date cannot be in the past'
                });
            }
        }

        // Update the booking
        const updatedBooking = await Booking.update(bookingID, {
            scheduledDate,
            scheduledTime
        });

        res.status(200).json({
            success: true,
            message: 'Manual booking updated successfully',
            data: { booking: updatedBooking }
        });
    } catch (error) {
        console.error('Update manual booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating manual booking',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Cancel a manual booking
const cancelManualBooking = async (req, res) => {
    try {
        const { bookingID } = req.params;
        const customerID = req.user.userID;
        const { cancellationReason } = req.body;

        if (!cancellationReason || cancellationReason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cancellation reason is required'
            });
        }

        // Get the booking first
        const booking = await Booking.findById(bookingID);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Verify the booking belongs to the customer
        if (booking.customerID !== customerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to cancel this booking'
            });
        }

        // Verify it's a manual booking
        if (!booking.manualBooking) {
            return res.status(400).json({
                success: false,
                message: 'This is not a manual booking'
            });
        }

        // Update booking with cancellation reason
        await Booking.update(bookingID, { cancellationReason: cancellationReason.trim() });

        // Update service request status to Cancelled
        await ServiceRequest.update(booking.requestID, customerID, { status: 'Cancelled' });

        const updatedBooking = await Booking.findById(bookingID);

        res.status(200).json({
            success: true,
            message: 'Manual booking cancelled successfully',
            data: { booking: updatedBooking }
        });
    } catch (error) {
        console.error('Cancel manual booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while cancelling manual booking',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get list of providers (for selecting preferred provider)
const getProviders = async (req, res) => {
    try {
        const pool = require('../config/database');
        const query = `
            SELECT userID, name, email, phone, verified, createdAt
            FROM USER
            WHERE role = 'Provider' AND verified = TRUE
            ORDER BY name ASC
        `;
        const [rows] = await pool.execute(query);

        res.status(200).json({
            success: true,
            message: 'Providers retrieved successfully',
            data: { providers: rows }
        });
    } catch (error) {
        console.error('Get providers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving providers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get pending manual bookings for the current provider
const getPendingManualBookings = async (req, res) => {
    try {
        const providerID = req.user.userID;
        const bookings = await Booking.getByProvider(providerID, true);

        // Filter to only pending bookings
        const pendingBookings = bookings.filter(booking => booking.requestStatus === 'Pending');

        res.status(200).json({
            success: true,
            message: 'Pending manual bookings retrieved successfully',
            data: { bookings: pendingBookings }
        });
    } catch (error) {
        console.error('Get pending manual bookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving pending manual bookings',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Accept a manual booking (Provider only)
const acceptManualBooking = async (req, res) => {
    try {
        const { bookingID } = req.params;
        const providerID = req.user.userID;

        // Get the booking first
        const booking = await Booking.findById(bookingID);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Verify the booking belongs to the provider
        if (booking.providerID !== providerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to accept this booking'
            });
        }

        // Verify it's a manual booking
        if (!booking.manualBooking) {
            return res.status(400).json({
                success: false,
                message: 'This is not a manual booking'
            });
        }

        // Verify status is Pending
        if (booking.requestStatus !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'This booking is not pending. It has already been accepted or rejected.'
            });
        }

        // Accept the booking
        const accepted = await ServiceRequest.acceptManualBooking(booking.requestID, providerID);
        if (!accepted) {
            return res.status(400).json({
                success: false,
                message: 'Failed to accept booking. It may have already been processed.'
            });
        }

        // Get updated booking
        const updatedBooking = await Booking.findById(bookingID);

        res.status(200).json({
            success: true,
            message: 'Manual booking accepted successfully',
            data: { booking: updatedBooking }
        });
    } catch (error) {
        console.error('Accept manual booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while accepting manual booking',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Reject a manual booking (Provider only)
const rejectManualBooking = async (req, res) => {
    try {
        const { bookingID } = req.params;
        const providerID = req.user.userID;

        // Get the booking first
        const booking = await Booking.findById(bookingID);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Verify the booking belongs to the provider
        if (booking.providerID !== providerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to reject this booking'
            });
        }

        // Verify it's a manual booking
        if (!booking.manualBooking) {
            return res.status(400).json({
                success: false,
                message: 'This is not a manual booking'
            });
        }

        // Verify status is Pending
        if (booking.requestStatus !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'This booking is not pending. It has already been accepted or rejected.'
            });
        }

        // Reject the booking
        const rejected = await ServiceRequest.rejectManualBooking(booking.requestID, providerID);
        if (!rejected) {
            return res.status(400).json({
                success: false,
                message: 'Failed to reject booking. It may have already been processed.'
            });
        }

        // Get updated booking
        const updatedBooking = await Booking.findById(bookingID);

        res.status(200).json({
            success: true,
            message: 'Manual booking rejected successfully',
            data: { booking: updatedBooking }
        });
    } catch (error) {
        console.error('Reject manual booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while rejecting manual booking',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    createManualBooking,
    getMyManualBookings,
    getManualBookingById,
    updateManualBooking,
    cancelManualBooking,
    getProviders,
    getPendingManualBookings,
    acceptManualBooking,
    rejectManualBooking
};
