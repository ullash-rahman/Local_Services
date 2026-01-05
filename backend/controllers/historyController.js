const JobHistory = require('../models/JobHistory');

// Get job history for current user
const getJobHistory = async (req, res) => {
    try {
        const userID = req.user.userID;
        const userRole = req.user.role;
        const status = req.query.status || null;

        let history;
        if (userRole === 'Customer') {
            history = await JobHistory.getByCustomer(userID, status);
        } else if (userRole === 'Provider') {
            history = await JobHistory.getByProvider(userID, status);
        } else {
            return res.status(403).json({
                success: false,
                message: 'Invalid role for this operation'
            });
        }

        res.status(200).json({
            success: true,
            data: { history }
        });
    } catch (error) {
        console.error('Get job history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching job history',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get job history by ID
const getJobHistoryById = async (req, res) => {
    try {
        const { jobID } = req.params;
        const userID = req.user.userID;
        const userRole = req.user.role;

        const job = await JobHistory.findById(jobID);

        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job history not found'
            });
        }

        // Check authorization
        if (userRole === 'Customer' && job.customerID !== userID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view this job history'
            });
        }

        if (userRole === 'Provider' && job.providerID !== userID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view this job history'
            });
        }

        res.status(200).json({
            success: true,
            data: { job }
        });
    } catch (error) {
        console.error('Get job history by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching job history',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get job history statistics
const getJobHistoryStats = async (req, res) => {
    try {
        const userID = req.user.userID;
        const userRole = req.user.role;

        let stats;
        if (userRole === 'Customer') {
            stats = await JobHistory.getCustomerStats(userID);
        } else if (userRole === 'Provider') {
            stats = await JobHistory.getProviderStats(userID);
        } else {
            return res.status(403).json({
                success: false,
                message: 'Invalid role for this operation'
            });
        }

        res.status(200).json({
            success: true,
            data: { stats }
        });
    } catch (error) {
        console.error('Get job history stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching job history statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    getJobHistory,
    getJobHistoryById,
    getJobHistoryStats
};

