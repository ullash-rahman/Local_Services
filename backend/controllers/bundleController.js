const ServiceBundle = require('../models/ServiceBundle');

// Create a new service bundle (Provider only)
const createBundle = async (req, res) => {
    try {
        const providerID = req.user.userID;
        const { bundleName, description, servicesIncluded, price, validTill } = req.body;

        console.log('Create bundle request:', {
            providerID,
            bundleName,
            description,
            servicesIncluded,
            servicesIncludedType: typeof servicesIncluded,
            servicesIncludedIsArray: Array.isArray(servicesIncluded),
            price,
            validTill,
            priceType: typeof price
        });

        // Validation
        if (!bundleName || !price) {
            return res.status(400).json({
                success: false,
                message: 'Bundle name and price are required'
            });
        }

        // Handle servicesIncluded - it might come as a string or array
        let servicesArray = servicesIncluded;
        if (typeof servicesIncluded === 'string') {
            // Try to parse as JSON first
            try {
                servicesArray = JSON.parse(servicesIncluded);
            } catch (e) {
                // If not JSON, try splitting by comma
                servicesArray = servicesIncluded.split(',').map(s => s.trim()).filter(s => s.length > 0);
            }
        }
        
        // Ensure it's an array
        if (!Array.isArray(servicesArray)) {
            servicesArray = [servicesArray].filter(s => s && s.toString().trim().length > 0);
        }
        
        // Filter out empty strings
        servicesArray = servicesArray.filter(s => s && s.toString().trim().length > 0);

        if (servicesArray.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one service must be included in the bundle'
            });
        }

        // Convert price to number if it's a string
        const priceNum = typeof price === 'string' ? parseFloat(price) : Number(price);
        
        if (isNaN(priceNum) || priceNum <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Price must be a valid number greater than 0'
            });
        }

        // Create bundle
        const bundleID = await ServiceBundle.create({
            providerID,
            bundleName,
            description,
            servicesIncluded: servicesArray, // Use the processed array
            price: priceNum,
            validTill: validTill || null
        });

        // Try to get the created bundle, but handle errors gracefully
        let bundle;
        try {
            bundle = await ServiceBundle.findById(bundleID);
            // If bundle is null or has issues, create a response object manually
            if (!bundle) {
                bundle = {
                    bundleID,
                    providerID,
                    bundleName,
                    description,
                    servicesIncluded: servicesArray,
                    price: priceNum,
                    validTill: validTill || null,
                    isActive: true
                };
            }
        } catch (findError) {
            console.error('Error fetching created bundle, returning manual object:', findError);
            // If findById fails, return a manually constructed bundle object
            bundle = {
                bundleID,
                providerID,
                bundleName,
                description,
                servicesIncluded: servicesArray,
                price: priceNum,
                validTill: validTill || null,
                isActive: true
            };
        }

        res.status(201).json({
            success: true,
            message: 'Service bundle created successfully',
            data: { bundle }
        });
    } catch (error) {
        console.error('Create bundle error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error code:', error.code);
        console.error('Error sqlMessage:', error.sqlMessage);
        
        // Provide more helpful error messages
        let errorMessage = 'Server error while creating bundle';
        if (error.code === 'ER_NO_SUCH_TABLE') {
            errorMessage = 'Database table not found. Please run the database setup script.';
        } else if (error.code === 'ER_BAD_FIELD_ERROR') {
            errorMessage = 'Database field error. Please check your database schema.';
        } else if (error.code === 'ER_DATA_TOO_LONG') {
            errorMessage = 'Data too long for one of the fields.';
        } else if (error.sqlMessage) {
            errorMessage = `Database error: ${error.sqlMessage}`;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        res.status(500).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? {
                code: error.code,
                sqlMessage: error.sqlMessage,
                stack: error.stack
            } : undefined
        });
    }
};

// Get all bundles by provider
const getMyBundles = async (req, res) => {
    try {
        const providerID = req.user.userID;
        const includeInactive = req.query.includeInactive === 'true';

        const bundles = await ServiceBundle.getByProvider(providerID, includeInactive);

        res.status(200).json({
            success: true,
            data: { bundles }
        });
    } catch (error) {
        console.error('Get my bundles error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error code:', error.code);
        console.error('Error sqlMessage:', error.sqlMessage);
        
        let errorMessage = 'Server error while fetching bundles';
        if (error.code === 'ER_NO_SUCH_TABLE') {
            errorMessage = 'Database table not found. Please run the database setup script.';
        } else if (error.code === 'ER_BAD_FIELD_ERROR') {
            errorMessage = 'Database field error. Please check your database schema.';
        } else if (error.sqlMessage) {
            errorMessage = `Database error: ${error.sqlMessage}`;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        res.status(500).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? {
                code: error.code,
                sqlMessage: error.sqlMessage,
                stack: error.stack
            } : undefined
        });
    }
};

// Get all active bundles (for customers to browse)
const getAllActiveBundles = async (req, res) => {
    try {
        const category = req.query.category || null;

        const bundles = await ServiceBundle.getAllActive(category);

        res.status(200).json({
            success: true,
            data: { bundles }
        });
    } catch (error) {
        console.error('Get all bundles error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching bundles',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get bundle by ID
const getBundleById = async (req, res) => {
    try {
        const { bundleID } = req.params;

        const bundle = await ServiceBundle.getBundleDetails(bundleID);

        if (!bundle) {
            return res.status(404).json({
                success: false,
                message: 'Bundle not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { bundle }
        });
    } catch (error) {
        console.error('Get bundle by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching bundle',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Update bundle
const updateBundle = async (req, res) => {
    try {
        const providerID = req.user.userID;
        const { bundleID } = req.params;
        const updateData = req.body;

        // Verify bundle belongs to provider
        const existingBundle = await ServiceBundle.findById(bundleID);
        if (!existingBundle) {
            return res.status(404).json({
                success: false,
                message: 'Bundle not found'
            });
        }

        if (existingBundle.providerID !== providerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to update this bundle'
            });
        }

        // Validate price if provided
        if (updateData.price !== undefined && updateData.price <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Price must be greater than 0'
            });
        }

        // Validate servicesIncluded if provided
        if (updateData.servicesIncluded !== undefined) {
            if (!Array.isArray(updateData.servicesIncluded) || updateData.servicesIncluded.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one service must be included in the bundle'
                });
            }
        }

        const bundle = await ServiceBundle.update(bundleID, providerID, updateData);

        res.status(200).json({
            success: true,
            message: 'Bundle updated successfully',
            data: { bundle }
        });
    } catch (error) {
        console.error('Update bundle error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating bundle',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Remove bundle (hard delete - permanently deletes from database)
const removeBundle = async (req, res) => {
    try {
        const providerID = req.user.userID;
        const { bundleID } = req.params;

        // Verify bundle belongs to provider
        const existingBundle = await ServiceBundle.findById(bundleID);
        if (!existingBundle) {
            return res.status(404).json({
                success: false,
                message: 'Bundle not found'
            });
        }

        if (existingBundle.providerID !== providerID) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to remove this bundle'
            });
        }

        // Use hardDelete to permanently remove from database
        const deleted = await ServiceBundle.hardDelete(bundleID, providerID);

        if (!deleted) {
            return res.status(500).json({
                success: false,
                message: 'Failed to remove bundle'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Bundle deleted successfully'
        });
    } catch (error) {
        console.error('Remove bundle error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while removing bundle',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    createBundle,
    getMyBundles,
    getAllActiveBundles,
    getBundleById,
    updateBundle,
    removeBundle
};

