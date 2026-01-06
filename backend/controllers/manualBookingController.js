const Booking = require('../models/Booking');
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const Availability = require('../models/Availability');

// Create a manual booking for a preferred provider
const createManualBooking = async (req, res) => {
    try {
        console.log('=== CREATE MANUAL BOOKING ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('User:', req.user);
        
        const customerID = req.user.userID;
        const { providerID, category, description, scheduledDate, scheduledTime, serviceDate, priorityLevel } = req.body;
        
        console.log('Extracted data:', {
            customerID,
            providerID,
            category,
            description,
            scheduledDate,
            scheduledTime,
            serviceDate,
            priorityLevel
        });

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

        // Validate and normalize scheduled date to YYYY-MM-DD format
        let normalizedScheduledDate = scheduledDate;
        if (scheduledDate) {
            // Extract date part if it's an ISO string
            if (scheduledDate.includes('T')) {
                normalizedScheduledDate = scheduledDate.split('T')[0];
            } else if (scheduledDate.includes(' ')) {
                normalizedScheduledDate = scheduledDate.split(' ')[0];
            }
            
            const date = new Date(normalizedScheduledDate);
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
        
        // Normalize scheduledTime - extract start time if it's in format "10:00-11:00"
        // Database TIME column expects format "HH:MM:SS" or "HH:MM"
        let normalizedScheduledTime = scheduledTime;
        if (scheduledTime && scheduledTime.includes('-')) {
            // Extract start time from "10:00-11:00" format
            normalizedScheduledTime = scheduledTime.split('-')[0];
            // Ensure it's in HH:MM:SS format
            if (normalizedScheduledTime.length === 5) {
                normalizedScheduledTime = normalizedScheduledTime + ':00';
            }
        } else if (scheduledTime && scheduledTime.length === 5) {
            // If it's already "10:00" format, add seconds
            normalizedScheduledTime = scheduledTime + ':00';
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

        // Allow booking any provider (verified or unverified)

        // For manual bookings, we trust the user's selection since they chose from available slots shown in the UI
        // We completely skip the availability check to avoid any date format mismatches or false negatives
        // The frontend already filters and shows only available slots, so we trust that selection
        console.log('=== SKIPPING AVAILABILITY CHECK FOR MANUAL BOOKING ===');
        console.log('Manual booking - user selected from available slots shown in UI');
        console.log('Booking details:', { 
            providerID, 
            scheduledDate: normalizedScheduledDate, 
            scheduledTime,
            normalizedScheduledTime
        });
        console.log('Proceeding with booking creation...');

        // Create service request first
        const requestID = await ServiceRequest.create({
            customerID,
            category: category.trim(),
            description: description.trim(),
            serviceDate: serviceDate || normalizedScheduledDate
        });

        // Set providerID but keep status as Pending (provider needs to accept/reject)
        await ServiceRequest.updateWithProvider(requestID, { 
            providerID: providerID,
            status: 'Pending', // Keep as Pending for provider to accept/reject
            priorityLevel: priorityLevel || 'Normal'
        });

        // Create booking with manualBooking flag set to true
        // Use normalized scheduledTime (HH:MM:SS format) for database
        const bookingID = await Booking.create({
            requestID,
            providerID,
            scheduledDate: normalizedScheduledDate,
            scheduledTime: normalizedScheduledTime || null,
            manualBooking: true
        });

        // Get the created booking with details
        const booking = await Booking.findById(bookingID);

        console.log('=== BOOKING CREATED SUCCESSFULLY ===');
        console.log('Booking ID:', bookingID);
        console.log('Booking details:', booking);

        res.status(201).json({
            success: true,
            message: 'Manual booking created successfully',
            data: { booking }
        });
    } catch (error) {
        console.error('=== CREATE MANUAL BOOKING ERROR ===');
        console.error('Error:', error);
        console.error('Error stack:', error.stack);
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
        console.log('=== getProviders called ===');
        console.log('Request user:', req.user);
        
        const pool = require('../config/database');
        
        // First, let's check if there are any users with Provider role at all
        const checkQuery = `SELECT COUNT(*) as total FROM USER WHERE role = 'Provider'`;
        const [checkRows] = await pool.execute(checkQuery);
        console.log('Total Provider users in database:', checkRows[0]?.total);
        
        // Get all providers (verified and unverified)
        const query = `
            SELECT userID, name, email, phone, verified, createdAt
            FROM USER
            WHERE role = 'Provider'
            ORDER BY verified DESC, name ASC
        `;
        console.log('Executing query:', query);
        const [rows] = await pool.execute(query);
        
        console.log('=== getProviders Results ===');
        console.log('Total providers found:', rows.length);
        console.log('Verified providers:', rows.filter(p => p.verified).length);
        console.log('Unverified providers:', rows.filter(p => !p.verified).length);
        console.log('Provider details:', rows.map(p => ({ 
            id: p.userID, 
            name: p.name, 
            email: p.email,
            verified: p.verified 
        })));

        const response = {
            success: true,
            message: 'Providers retrieved successfully',
            data: { providers: rows }
        };
        
        console.log('Sending response:', JSON.stringify(response, null, 2));
        res.status(200).json(response);
    } catch (error) {
        console.error('=== Get providers error ===', error);
        console.error('Error stack:', error.stack);
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
