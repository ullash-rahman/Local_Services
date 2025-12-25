const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const chatRoutes = require('./routes/chatRoutes');
const Chat = require('./models/Chat');
const bundleRoutes = require('./routes/bundleRoutes');
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const complaintRoutes = require('./routes/complaintRoutes');

const gamificationRoutes = require('./routes/gamificationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/bundles', bundleRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/complaints', complaintRoutes);
<<<<<<< HEAD

=======
app.use('/api/gamification', gamificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
>>>>>>> b77267040d5438e38ed376b313c1c6d4afea9923

// Health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.path}`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Socket.io authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
        return next(new Error('Authentication error: No token provided'));
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'your-secret-key-change-in-production'
        );
        socket.userID = decoded.userID;
        socket.userRole = decoded.role;
        next();
    } catch (error) {
        next(new Error('Authentication error: Invalid token'));
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userID}`);

    // Join user's personal room for notifications
    socket.join(`user_${socket.userID}`);
    console.log(`User ${socket.userID} joined their notification room`);

    // Join room for a specific request
    socket.on('join_request', (requestID) => {
        socket.join(`request_${requestID}`);
        console.log(`User ${socket.userID} joined request ${requestID}`);
    });

    // Leave room for a specific request
    socket.on('leave_request', (requestID) => {
        socket.leave(`request_${requestID}`);
        console.log(`User ${socket.userID} left request ${requestID}`);
    });

    // Handle new message
    socket.on('send_message', async (data) => {
        try {
            const { requestID, receiverID, messageText } = data;
            const senderID = socket.userID;

            // Save message to database
            const messageID = await Chat.create({
                requestID,
                senderID,
                receiverID,
                messageText
            });

            // Get sender name
            const User = require('./models/User');
            const sender = await User.findById(senderID);

            // Get request for notification
            const ServiceRequest = require('./models/ServiceRequest');
            const request = await ServiceRequest.findById(requestID);

            // Create notification for receiver
            try {
                const Notification = require('./models/Notification');
                await Notification.create({
                    userID: receiverID,
                    requestID: requestID,
                    message: `${sender.name} sent you a message about ${request ? request.category : 'your service request'}`,
                    notificationType: 'message'
                });

                // Emit notification to receiver via Socket.io
                io.to(`user_${receiverID}`).emit('new_notification', {
                    message: `${sender.name} sent you a message`,
                    notificationType: 'message',
                    requestID: requestID
                });
            } catch (notifError) {
                console.error('Error creating message notification:', notifError);
            }

            // Emit to all users in the request room
            const messageData = {
                messageID,
                requestID,
                senderID,
                receiverID,
                messageText,
                timestamp: new Date(),
                isRead: false,
                senderName: sender.name
            };

            io.to(`request_${requestID}`).emit('new_message', messageData);
            io.to(`user_${receiverID}`).emit('new_message', messageData);
        } catch (error) {
            console.error('Error handling message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
        socket.to(`request_${data.requestID}`).emit('user_typing', {
            userID: socket.userID,
            requestID: data.requestID
        });
    });

    // Handle stop typing
    socket.on('stop_typing', (data) => {
        socket.to(`request_${data.requestID}`).emit('user_stop_typing', {
            userID: socket.userID,
            requestID: data.requestID
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userID}`);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Socket.io server initialized`);
});

// Make io available globally for controllers
global.io = io;

module.exports = { app, server, io };
