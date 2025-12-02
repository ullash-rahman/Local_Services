const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const authenticate = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided. Access denied.' 
            });
        }

        const decoded = jwt.verify(
            token, 
            process.env.JWT_SECRET || 'your-secret-key-change-in-production'
        );

        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expired. Please login again.' 
            });
        }
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid token. Access denied.' 
        });
    }
};

// Middleware to check user role
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. Insufficient permissions.' 
            });
        }

        next();
    };
};

module.exports = {
    authenticate,
    authorize
};

