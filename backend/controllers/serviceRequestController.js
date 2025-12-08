const ServiceRequest = require('../models/ServiceRequest');

// Create a new service request (Customer only)
const createServiceRequest = async (req, res) => {
    try {
        const customerID = req.user.userID;
        const { category, description, serviceDate } = req.body;

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

        // Create service request
        const requestID = await ServiceRequest.create({
            customerID,
            category,
            description: description.trim(),
            serviceDate: serviceDate || null
        });

        // Get the created request
        const request = await ServiceRequest.findById(requestID);

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

        let requests;
        if (userRole === 'Customer') {
            requests = await ServiceRequest.getByCustomer(userID, status);
        } else if (userRole === 'Provider') {
            requests = await ServiceRequest.getByProvider(userID, status);
        } else {
            return res.status(403).json({
                success: false,
                message: 'Invalid role for this operation'
            });
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

module.exports = {
    createServiceRequest,
    getServiceRequestById,
    getMyServiceRequests,
    getPendingRequests,
    updateServiceRequest,
    deleteServiceRequest,
    getServiceRequestsByCategory
};

