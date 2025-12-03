const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticate);

// Get all conversations for current user
router.get('/conversations', chatController.getConversations);

// Get messages for a specific request
router.get('/messages/:requestID', chatController.getMessages);

// Send a new message
router.post('/send', chatController.sendMessage);

// Mark messages as read
router.put('/read/:requestID', chatController.markAsRead);

// Get unread message count
router.get('/unread', chatController.getUnreadCount);

module.exports = router;

