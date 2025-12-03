const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register new user
const register = async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;

        // Validation
        if (!name || !email || !password || !role) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide all required fields' 
            });
        }

        // Validate role
        if (!['Customer', 'Provider', 'Admin'].includes(role)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid role. Must be Customer, Provider, or Admin' 
            });
        }

        // Check if email already exists
        const emailExists = await User.emailExists(email);
        if (emailExists) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email already registered' 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const userID = await User.create({
            name,
            email,
            password: hashedPassword,
            phone: phone || null,
            role
        });

        // Get created user (without password)
        const user = await User.findById(userID);

        // Generate JWT token
        const token = jwt.sign(
            { userID: user.userID, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user,
                token
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        
        // Check for database connection errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
            return res.status(500).json({ 
                success: false, 
                message: 'Database connection failed. Please check your database credentials in backend/.env',
                error: 'Database connection error'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Login user
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide email and password' 
            });
        }

        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userID: user.userID, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '7d' }
        );

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: userWithoutPassword,
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login',
            error: error.message 
        });
    }
};

// Logout user (client-side token removal, but we can also blacklist tokens)
const logout = async (req, res) => {
    try {
        // In a stateless JWT system, logout is handled client-side by removing the token
        // Optionally, you can implement token blacklisting here
        res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during logout',
            error: error.message 
        });
    }
};

// Get current user profile
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userID);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        res.status(200).json({
            success: true,
            data: { user }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error',
            error: error.message 
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    getProfile
};

