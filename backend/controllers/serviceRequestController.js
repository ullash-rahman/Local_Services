const ServiceRequest = require('../models/ServiceRequest');
const JobHistory = require('../models/JobHistory');
const MaintenanceReminder = require('../models/MaintenanceReminder');
const pool = require('../config/database');

// Create a new service request (Customer only)
const createServiceRequest = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const { category, description, serviceDate, priorityLevel } = req.body;
        
        console.log('=== CREATE SERVICE REQUEST ===');
        console.log('Full req.body:', JSON.stringify(req.body, null, 2));
        console.log('Extracted priorityLevel:', priorityLevel);
        console.log('priorityLevel type:', typeof priorityLevel);
        console.log('priorityLevel === "Emergency":', priorityLevel === 'Emergency');
        console.log('priorityLevel === "High":', priorityLevel === 'High');
        console.log('priorityLevel === "Normal":', priorityLevel === 'Normal');

        // Validation
        if (!category || !description) {
            return res.status(400).json({
                success: false,
                message: 'Category and description are required'
            });
        }

        if (description.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Description must be at least 10 characters long'
            });
        }

        // Validate serviceDate if provided
        if (serviceDate) {
            const date = new Date(serviceDate);
            if (isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid service date format'
                });
            }
            // Check if date is in the past (allow today)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDate = new Date(date);
            selectedDate.setHours(0, 0, 0, 0);
            if (selectedDate < today) {
                return res.status(400).json({
                    success: false,
                    message: 'Service date cannot be in the past'
                });
            }
        }

        // Validate and normalize priorityLevel - trim and check exact match
        const validPriorities = ['Normal', 'High', 'Emergency'];
        const trimmedPriority = priorityLevel ? String(priorityLevel).trim() : null;
        const normalizedPriority = (trimmedPriority && validPriorities.includes(trimmedPriority)) 
            ? trimmedPriority 
            : 'Normal';
        
        console.log('=== PRIORITY NORMALIZATION ===');
        console.log('Raw priorityLevel from body:', priorityLevel);
        console.log('Trimmed priorityLevel:', trimmedPriority);
        console.log('Is in validPriorities?', trimmedPriority ? validPriorities.includes(trimmedPriority) : false);
        console.log('Final normalizedPriority:', normalizedPriority);
        console.log('Valid priorities list:', validPriorities);

        // Create service request - pass the normalized priority directly
        const requestID = await ServiceRequest.create({
            customerID,
            category,
            description: description.trim(),
            serviceDate: serviceDate || null,
            priorityLevel: normalizedPriority  // Pass the already-normalized value
        });

        console.log('Service request created with ID:', requestID, 'Priority:', normalizedPriority);

        // Get the created request
        const request = await ServiceRequest.findById(requestID);
        
        console.log('Created request priorityLevel from DB:', request?.priorityLevel);
        console.log('Created request full object keys:', request ? Object.keys(request) : 'null');

        res.status(201).json({
            success: true,
            message: 'Service request created successfully',
            data: { request }
        });
    } catch (error) {
        console.error('Create service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating service request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get service request by ID
const getServiceRequestById = async (req, res) => {
    try {
        const { requestID } = req.params;
        const userID = req.user.userID;
        const userRole = req.user.role;

        const request = await ServiceRequest.findById(requestID);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        // Check authorization: Customer can only see their own requests, Provider can see assigned requests
        if (userRole === 'Customer' && request.customerID !== userID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view this request'
            });
        }

        if (userRole === 'Provider' && request.providerID !== userID && request.providerID !== null) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view this request'
            });
        }

        res.status(200).json({
            success: true,
            data: { request }
        });
    } catch (error) {
        console.error('Get service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching service request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get all service requests for current user
const getMyServiceRequests = async (req, res) => {
    try {
        const userID = req.user.userID;
        const userRole = req.user.role;
        const status = req.query.status || null;
        const category = req.query.category || null;

        console.log('getMyServiceRequests - Query params:', { userID, userRole, status, category });

        let requests;
        if (userRole === 'Customer') {
            requests = await ServiceRequest.getByCustomer(userID, status, category);
        } else if (userRole === 'Provider') {
            // For providers, when status is 'all' or null, show both unaccepted and accepted requests
            // When status is specific, use the appropriate method
            if (!status || status === 'all') {
                requests = await ServiceRequest.getProviderRequests(userID, null, category);
            } else {
                requests = await ServiceRequest.getProviderRequests(userID, status, category);
            }
        } else {
            return res.status(403).json({
                success: false,
                message: 'Invalid role for this operation'
            });
        }

        console.log('getMyServiceRequests - Returning', requests.length, 'requests');
        if (requests.length > 0) {
            console.log('Sample request categories:', requests.slice(0, 3).map(r => r.category));
            console.log('Sample request priorities:', requests.slice(0, 3).map(r => ({ 
                id: r.requestID, 
                category: r.category,
                status: r.status, 
                priority: r.priorityLevel,
                hasPriority: 'priorityLevel' in r,
                priorityType: typeof r.priorityLevel
            })));
            // Log full first request to see all fields
            if (requests[0]) {
                console.log('First request priorityLevel:', requests[0].priorityLevel);
                console.log('First request all keys:', Object.keys(requests[0]));
            }
        }

        res.status(200).json({
            success: true,
            data: { requests }
        });
    } catch (error) {
        console.error('Get my service requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching service requests',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get pending service requests (for providers)
const getPendingRequests = async (req, res) => {
    try {
        const category = req.query.category || null;
        const requests = await ServiceRequest.getPendingRequests(category);

        res.status(200).json({
            success: true,
            data: { requests }
        });
    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching pending requests',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Update service request (Customer only, only if status is Pending)
const updateServiceRequest = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const { requestID } = req.params;
        const updateData = req.body;

        // Verify request exists and belongs to customer
        const existingRequest = await ServiceRequest.findById(requestID);
        if (!existingRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        if (existingRequest.customerID !== customerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to update this request'
            });
        }

        // Only allow updates if status is Pending
        if (existingRequest.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'Cannot update service request that is not in Pending status'
            });
        }

        // Validate description if provided
        if (updateData.description !== undefined && updateData.description.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Description must be at least 10 characters long'
            });
        }

        // Validate serviceDate if provided
        if (updateData.serviceDate) {
            const date = new Date(updateData.serviceDate);
            if (isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid service date format'
                });
            }
            // Check if date is in the past (allow today)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDate = new Date(date);
            selectedDate.setHours(0, 0, 0, 0);
            if (selectedDate < today) {
                return res.status(400).json({
                    success: false,
                    message: 'Service date cannot be in the past'
                });
            }
        }

        const request = await ServiceRequest.update(requestID, customerID, updateData);

        res.status(200).json({
            success: true,
            message: 'Service request updated successfully',
            data: { request }
        });
    } catch (error) {
        console.error('Update service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating service request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Delete service request (Customer only, only if status is Pending)
const deleteServiceRequest = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const { requestID } = req.params;

        // Verify request exists and belongs to customer
        const existingRequest = await ServiceRequest.findById(requestID);
        if (!existingRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        if (existingRequest.customerID !== customerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this request'
            });
        }

        const deleted = await ServiceRequest.delete(requestID, customerID);

        if (!deleted) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete service request that is not in Pending status'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Service request deleted successfully'
        });
    } catch (error) {
        console.error('Delete service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting service request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get service requests by category
const getServiceRequestsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const requests = await ServiceRequest.getByCategory(category);

        res.status(200).json({
            success: true,
            data: { requests }
        });
    } catch (error) {
        console.error('Get service requests by category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching service requests',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Accept service request (Provider only)
const acceptServiceRequest = async (req, res) => {
    try {
        console.log('Accept service request called:', req.params);
        const providerID = req.user.userID;
        const { requestID } = req.params;

        // Verify request exists and is pending
        const request = await ServiceRequest.findById(requestID);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        if (request.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'Service request is not in Pending status'
            });
        }

        if (request.providerID !== null) {
            return res.status(400).json({
                success: false,
                message: 'Service request has already been accepted by another provider'
            });
        }

        // Accept the request
        const accepted = await ServiceRequest.acceptRequest(requestID, providerID);

        if (!accepted) {
            return res.status(400).json({
                success: false,
                message: 'Failed to accept service request. It may have been accepted by another provider.'
            });
        }

        // Get updated request
        const updatedRequest = await ServiceRequest.findById(requestID);

        // Create notification for customer
        try {
            const Notification = require('../models/Notification');
            const User = require('../models/User');
            const provider = await User.findById(providerID);
            
            if (!provider) {
                console.error('Provider not found:', providerID);
            } else {
                const notification = await Notification.create({
                    userID: request.customerID,
                    requestID: requestID,
                    message: `${provider.name} has accepted your service request for ${request.category}`,
                    notificationType: 'request_accepted'
                });

                console.log('Notification created:', notification);

                // Emit notification via Socket.io if available
                if (global.io) {
                    global.io.to(`user_${request.customerID}`).emit('new_notification', {
                        message: `${provider.name} has accepted your service request`,
                        notificationType: 'request_accepted',
                        requestID: requestID
                    });
                    console.log('Notification emitted to user:', request.customerID);
                } else {
                    console.warn('Socket.io not available for notification emission');
                }
            }
        } catch (notifError) {
            console.error('Error creating accept notification:', notifError);
            // Don't fail the accept if notification fails
        }

        res.status(200).json({
            success: true,
            message: 'Service request accepted successfully',
            data: { request: updatedRequest }
        });
    } catch (error) {
        console.error('Accept service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while accepting service request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Reject service request (Provider only)
const rejectServiceRequest = async (req, res) => {
    try {
        const { requestID } = req.params;

        // Verify request exists and is pending
        const request = await ServiceRequest.findById(requestID);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        if (request.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'Service request is not in Pending status'
            });
        }

        // Reject the request
        const rejected = await ServiceRequest.rejectRequest(requestID);

        if (!rejected) {
            return res.status(400).json({
                success: false,
                message: 'Failed to reject service request'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Service request rejected'
        });
    } catch (error) {
        console.error('Reject service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while rejecting service request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Cancel service request (Customer only) - with cancellation reason
const cancelServiceRequest = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const { requestID } = req.params;
        const { cancellationReason } = req.body;

        if (!cancellationReason || cancellationReason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cancellation reason is required'
            });
        }

        // Verify request exists and belongs to customer
        const request = await ServiceRequest.findById(requestID);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        if (request.customerID !== customerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to cancel this request'
            });
        }

        if (request.status === 'Completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel a completed service request'
            });
        }

        if (request.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Service request is already cancelled'
            });
        }

        // Cancel the request
        const cancelled = await ServiceRequest.cancelRequest(requestID, customerID, cancellationReason.trim());

        if (!cancelled) {
            return res.status(400).json({
                success: false,
                message: 'Failed to cancel service request. It may have already been completed or cancelled.'
            });
        }

        const updatedRequest = await ServiceRequest.findById(requestID);

        // Create notification for provider if request was accepted
        if (request.providerID) {
            try {
                const Notification = require('../models/Notification');
                const notification = await Notification.create({
                    userID: request.providerID,
                    requestID: requestID,
                    message: `Service request for ${request.category} has been cancelled by the customer`,
                    notificationType: 'request_cancelled'
                });

                if (global.io) {
                    global.io.to(`user_${request.providerID}`).emit('new_notification', {
                        message: `Service request has been cancelled`,
                        notificationType: 'request_cancelled',
                        requestID: requestID
                    });
                }
            } catch (notifError) {
                console.error('Error creating cancel notification:', notifError);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Service request cancelled successfully',
            data: { request: updatedRequest }
        });
    } catch (error) {
        console.error('Cancel service request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while cancelling service request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Mark service as completed (Provider only)
const markServiceAsCompleted = async (req, res) => {
    try {
        const providerID = req.user.userID;
        const { requestID } = req.params;

        // Verify request exists and belongs to provider
        const request = await ServiceRequest.findById(requestID);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        if (request.providerID !== providerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to mark this service as completed'
            });
        }

        if (request.status !== 'Accepted' && request.status !== 'Ongoing') {
            return res.status(400).json({
                success: false,
                message: 'Service request must be in Accepted or Ongoing status to mark as completed'
            });
        }

        // Mark as completed
        const completed = await ServiceRequest.markAsCompleted(requestID, providerID);

        if (!completed) {
            return res.status(400).json({
                success: false,
                message: 'Failed to mark service as completed'
            });
        }

        // Create or update ServiceCompletion record
        try {
            const checkQuery = `SELECT completionID FROM ServiceCompletion WHERE requestID = ?`;
            const [existing] = await pool.execute(checkQuery, [requestID]);
            
            if (existing.length > 0) {
                const updateQuery = `
                    UPDATE ServiceCompletion 
                    SET providerConfirmation = TRUE, 
                        completionDate = CURDATE(),
                        updatedAt = NOW()
                    WHERE requestID = ?
                `;
                await pool.execute(updateQuery, [requestID]);
            } else {
                const insertQuery = `
                    INSERT INTO ServiceCompletion (requestID, providerConfirmation, completionDate)
                    VALUES (?, TRUE, CURDATE())
                `;
                await pool.execute(insertQuery, [requestID]);
            }
        } catch (completionError) {
            console.error('Error creating completion record:', completionError);
            // Continue even if completion record fails
        }

        // Create job history entry
        try {
            await JobHistory.create({
                requestID: requestID,
                providerID: providerID,
                customerID: request.customerID,
                status: 'Completed',
                completionDate: new Date().toISOString().split('T')[0]
            });
        } catch (historyError) {
            console.error('Error creating job history:', historyError);
            // Continue even if job history creation fails
        }

        const updatedRequest = await ServiceRequest.findById(requestID);

        // Create notification for customer
        try {
            const Notification = require('../models/Notification');
            const User = require('../models/User');
            const provider = await User.findById(providerID);
            
            if (provider) {
                const notification = await Notification.create({
                    userID: request.customerID,
                    requestID: requestID,
                    message: `${provider.name} has marked the service for ${request.category} as completed. Please confirm completion.`,
                    notificationType: 'service_completed'
                });

                // Emit real-time status update via Socket.io
                if (global.io) {
                    // Emit status update to customer
                    global.io.to(`user_${request.customerID}`).emit('service_status_update', {
                        requestID: requestID,
                        status: 'Completed',
                        message: 'Service has been marked as completed'
                    });
                    
                    // Emit to request room
                    global.io.to(`request_${requestID}`).emit('service_status_update', {
                        requestID: requestID,
                        status: 'Completed',
                        message: 'Service has been marked as completed'
                    });
                    
                    // Emit notification
                    global.io.to(`user_${request.customerID}`).emit('new_notification', {
                        message: `Service has been marked as completed`,
                        notificationType: 'service_completed',
                        requestID: requestID
                    });
                }
            }
        } catch (notifError) {
            console.error('Error creating completion notification:', notifError);
        }

        res.status(200).json({
            success: true,
            message: 'Service marked as completed successfully',
            data: { request: updatedRequest }
        });
    } catch (error) {
        console.error('Mark service as completed error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while marking service as completed',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Confirm service completion (Customer only)
const confirmServiceCompletion = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const { requestID } = req.params;

        // Verify request exists and belongs to customer
        const request = await ServiceRequest.findById(requestID);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        if (request.customerID !== customerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to confirm this service completion'
            });
        }

        if (request.status !== 'Completed') {
            return res.status(400).json({
                success: false,
                message: 'Service request must be in Completed status to confirm completion'
            });
        }

        if (request.completionConfirmed) {
            return res.status(400).json({
                success: false,
                message: 'Service completion has already been confirmed'
            });
        }

        // Confirm completion
        const confirmed = await ServiceRequest.confirmCompletion(requestID, customerID);

        if (!confirmed) {
            return res.status(400).json({
                success: false,
                message: 'Failed to confirm service completion'
            });
        }

        // Update ServiceCompletion record
        try {
            const checkQuery = `SELECT completionID FROM ServiceCompletion WHERE requestID = ?`;
            const [existing] = await pool.execute(checkQuery, [requestID]);
            
            if (existing.length > 0) {
                const updateQuery = `
                    UPDATE ServiceCompletion 
                    SET customerConfirmation = TRUE, 
                        updatedAt = NOW()
                    WHERE requestID = ?
                `;
                await pool.execute(updateQuery, [requestID]);
            } else {
                const insertQuery = `
                    INSERT INTO ServiceCompletion (requestID, customerConfirmation, providerConfirmation, completionDate)
                    VALUES (?, TRUE, TRUE, CURDATE())
                `;
                await pool.execute(insertQuery, [requestID]);
            }
        } catch (completionError) {
            console.error('Error updating completion record:', completionError);
            // Continue even if completion record fails
        }

        // Check if this is a repeat service and create/update maintenance reminder
        try {
            // Check if customer has previous completed services of the same category
            // Check both JobHistory and ServiceRequest to be thorough
            const previousServicesQuery = `
                SELECT COUNT(*) as count 
                FROM ServiceRequest sr
                WHERE sr.customerID = ? 
                    AND sr.category = ?
                    AND sr.status = 'Completed'
                    AND sr.completionConfirmed = TRUE
                    AND sr.requestID != ?
            `;
            const [previousServices] = await pool.execute(previousServicesQuery, [
                request.customerID,
                request.category,
                requestID
            ]);

            // If this is a repeat service (customer had this service before), create/update maintenance reminder
            if (previousServices[0].count > 0) {
                const completionDate = new Date().toISOString().split('T')[0];
                const nextServiceDate = new Date();
                nextServiceDate.setDate(nextServiceDate.getDate() + 30); // Default 30 days

                // Check if reminder already exists for this service type
                const existingReminderQuery = `
                    SELECT reminderID 
                    FROM MaintenanceReminder 
                    WHERE customerID = ? 
                        AND serviceType = ? 
                        AND status = 'Active'
                    LIMIT 1
                `;
                const [existingReminders] = await pool.execute(existingReminderQuery, [
                    request.customerID,
                    request.category
                ]);

                if (existingReminders.length > 0) {
                    // Update existing reminder
                    const reminderID = existingReminders[0].reminderID;
                    await MaintenanceReminder.markAsCompleted(reminderID, request.customerID, completionDate);
                } else {
                    // Create new reminder
                    await MaintenanceReminder.create({
                        customerID: request.customerID,
                        serviceType: request.category,
                        lastServiceDate: completionDate,
                        nextServiceDate: nextServiceDate.toISOString().split('T')[0],
                        reminderFrequency: 30
                    });
                }
            }
        } catch (reminderError) {
            console.error('Error creating/updating maintenance reminder:', reminderError);
            // Continue even if reminder creation fails
        }

        const updatedRequest = await ServiceRequest.findById(requestID);

        // Create notification for provider
        if (request.providerID) {
            try {
                const Notification = require('../models/Notification');
                const notification = await Notification.create({
                    userID: request.providerID,
                    requestID: requestID,
                    message: `Customer has confirmed completion of service request for ${request.category}`,
                    notificationType: 'completion_confirmed'
                });

                if (global.io) {
                    global.io.to(`user_${request.providerID}`).emit('new_notification', {
                        message: `Service completion confirmed by customer`,
                        notificationType: 'completion_confirmed',
                        requestID: requestID
                    });
                }
            } catch (notifError) {
                console.error('Error creating confirmation notification:', notifError);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Service completion confirmed successfully',
            data: { request: updatedRequest }
        });
    } catch (error) {
        console.error('Confirm service completion error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while confirming service completion',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Start service (Provider only) - Change status from Accepted to Ongoing
const startService = async (req, res) => {
    try {
        const providerID = req.user.userID;
        const { requestID } = req.params;

        // Verify request exists and belongs to provider
        const request = await ServiceRequest.findById(requestID);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        if (request.providerID !== providerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to start this service'
            });
        }

        if (request.status !== 'Accepted') {
            return res.status(400).json({
                success: false,
                message: 'Service request must be in Accepted status to start'
            });
        }

        // Start the service (change to Ongoing)
        const started = await ServiceRequest.startService(requestID, providerID);

        if (!started) {
            return res.status(400).json({
                success: false,
                message: 'Failed to start service. It may have already been started or completed.'
            });
        }

        const updatedRequest = await ServiceRequest.findById(requestID);

        // Create notification for customer
        try {
            const Notification = require('../models/Notification');
            const User = require('../models/User');
            const provider = await User.findById(providerID);
            
            if (provider) {
                const notification = await Notification.create({
                    userID: request.customerID,
                    requestID: requestID,
                    message: `${provider.name} has started working on your service request for ${request.category}`,
                    notificationType: 'service_started'
                });

                // Emit real-time status update via Socket.io
                if (global.io) {
                    // Emit to customer
                    global.io.to(`user_${request.customerID}`).emit('service_status_update', {
                        requestID: requestID,
                        status: 'Ongoing',
                        message: 'Service has started'
                    });
                    
                    // Emit to request room
                    global.io.to(`request_${requestID}`).emit('service_status_update', {
                        requestID: requestID,
                        status: 'Ongoing',
                        message: 'Service has started'
                    });
                    
                    // Emit notification
                    global.io.to(`user_${request.customerID}`).emit('new_notification', {
                        message: `Service has started`,
                        notificationType: 'service_started',
                        requestID: requestID
                    });
                }
            }
        } catch (notifError) {
            console.error('Error creating start notification:', notifError);
        }

        res.status(200).json({
            success: true,
            message: 'Service started successfully',
            data: { request: updatedRequest }
        });
    } catch (error) {
        console.error('Start service error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while starting service',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    createServiceRequest,
    getServiceRequestById,
    getMyServiceRequests,
    getPendingRequests,
    updateServiceRequest,
    deleteServiceRequest,
    getServiceRequestsByCategory,
    acceptServiceRequest,
    rejectServiceRequest,
    cancelServiceRequest,
    startService,
    markServiceAsCompleted,
    confirmServiceCompletion
};

