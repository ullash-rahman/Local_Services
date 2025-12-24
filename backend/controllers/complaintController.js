const Complaint = require('../models/Complaint');
const ServiceRequest = require('../models/ServiceRequest');

// Submit a new complaint
exports.submitComplaint = async (req, res) => {
    try {
        const { requestID, description } = req.body;
        const reporterID = req.user.userID;
        const reporterRole = req.user.role;

        if (!requestID || !description) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: requestID, description'
            });
        }

        // Validate that the user is involved in this service request
        const serviceRequest = await ServiceRequest.findById(requestID);
        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        // Check if user is involved in this service
        const isCustomer = serviceRequest.customerID === reporterID;
        const isProvider = serviceRequest.providerID === reporterID;

        if (!isCustomer && !isProvider) {
            return res.status(403).json({
                success: false,
                message: 'You can only submit complaints for services you were involved in'
            });
        }

        // Check if provider is assigned (they must have had a service together)
        if (!serviceRequest.providerID) {
            return res.status(400).json({
                success: false,
                message: 'Cannot submit complaint: Service request does not have an assigned provider'
            });
        }

        // Determine the providerID for the complaint (always the provider from the service)
        const providerID = serviceRequest.providerID;

        // Check if user already submitted a complaint for this request
        const existingComplaint = await Complaint.checkExistingComplaint(requestID, reporterID);
        if (existingComplaint) {
            return res.status(400).json({
                success: false,
                message: 'You have already submitted a complaint for this service request'
            });
        }

        // Create the complaint
        const complaintID = await Complaint.create({
            reporterID,
            providerID,
            requestID,
            description
        });

        res.status(201).json({
            success: true,
            message: 'Complaint submitted successfully',
            data: { complaintID }
        });
    } catch (error) {
        console.error('Error submitting complaint:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting complaint',
            error: error.message
        });
    }
};

// Get all complaints by the current user (complaints they filed)
exports.getMyComplaints = async (req, res) => {
    try {
        const reporterID = req.user.userID;
        const complaints = await Complaint.getByReporter(reporterID);

        res.status(200).json({
            success: true,
            data: complaints
        });
    } catch (error) {
        console.error('Error getting complaints:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving complaints',
            error: error.message
        });
    }
};

// Get complaints against the current user
exports.getComplaintsAgainstMe = async (req, res) => {
    try {
        const userID = req.user.userID;
        const complaints = await Complaint.getAgainstUser(userID);

        res.status(200).json({
            success: true,
            data: complaints
        });
    } catch (error) {
        console.error('Error getting complaints against me:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving complaints',
            error: error.message
        });
    }
};

// Get complaint by ID
exports.getComplaintById = async (req, res) => {
    try {
        const { complaintID } = req.params;
        const userID = req.user.userID;
        const userRole = req.user.role;

        const complaint = await Complaint.findById(complaintID);
        
        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found'
            });
        }

        // Check if user has access to this complaint
        // User can view if: they are the reporter, they are the accused party, or they are admin
        const isReporter = complaint.reporterID === userID;
        const isAccused = (complaint.providerID === userID && complaint.customerID !== userID) || 
                         (complaint.customerID === userID && complaint.providerID !== userID);
        const isAdmin = userRole === 'Admin';

        if (!isReporter && !isAccused && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You do not have permission to view this complaint.'
            });
        }

        res.status(200).json({
            success: true,
            data: complaint
        });
    } catch (error) {
        console.error('Error getting complaint:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving complaint',
            error: error.message
        });
    }
};

// Get complaints for a specific service request
exports.getComplaintsByRequest = async (req, res) => {
    try {
        const { requestID } = req.params;
        const userID = req.user.userID;

        // Verify user is involved in this service request
        const serviceRequest = await ServiceRequest.findById(requestID);
        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        const isCustomer = serviceRequest.customerID === userID;
        const isProvider = serviceRequest.providerID === userID;

        if (!isCustomer && !isProvider && req.user.role !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not involved in this service request.'
            });
        }

        const complaints = await Complaint.getByRequest(requestID);

        res.status(200).json({
            success: true,
            data: complaints
        });
    } catch (error) {
        console.error('Error getting complaints by request:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving complaints',
            error: error.message
        });
    }
};

// Update complaint status (Admin only, or for resolution)
exports.updateComplaintStatus = async (req, res) => {
    try {
        const { complaintID } = req.params;
        const { status, resolutionNotes } = req.body;
        const userRole = req.user.role;

        // Only Admin can update complaint status
        if (userRole !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only administrators can update complaint status.'
            });
        }

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Missing required field: status'
            });
        }

        const validStatuses = ['Pending', 'Under Review', 'Resolved', 'Dismissed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const updatedComplaint = await Complaint.updateStatus(complaintID, status, resolutionNotes);

        res.status(200).json({
            success: true,
            message: 'Complaint status updated successfully',
            data: updatedComplaint
        });
    } catch (error) {
        console.error('Error updating complaint status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating complaint status',
            error: error.message
        });
    }
};

// Get all complaints (Admin only)
exports.getAllComplaints = async (req, res) => {
    try {
        const userRole = req.user.role;
        const { status } = req.query;

        // Only Admin can view all complaints
        if (userRole !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only administrators can view all complaints.'
            });
        }

        const complaints = await Complaint.getAll(status || null);

        res.status(200).json({
            success: true,
            data: complaints
        });
    } catch (error) {
        console.error('Error getting all complaints:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving complaints',
            error: error.message
        });
    }
};

