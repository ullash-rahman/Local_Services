const Chat = require('../models/Chat');
const { authenticate } = require('../middleware/authMiddleware');

// Get all messages for a request
exports.getMessages = async (req, res) => {
    try {
        const { requestID } = req.params;
        const userID = req.user.userID;

        // Verify user is part of this request
        const messages = await Chat.getByRequest(requestID);
        
        // Check if user is sender or receiver
        const userInvolved = messages.some(msg => 
            msg.senderID === userID || msg.receiverID === userID
        );

        if (messages.length > 0 && !userInvolved) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not part of this conversation.'
            });
        }

        res.status(200).json({
            success: true,
            data: messages
        });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving messages',
            error: error.message
        });
    }
};

// Send a new message
exports.sendMessage = async (req, res) => {
    try {
        const { requestID, receiverID, messageText } = req.body;
        const senderID = req.user.userID;

        if (!requestID || !receiverID || !messageText) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: requestID, receiverID, messageText'
            });
        }

        const messageID = await Chat.create({
            requestID,
            senderID,
            receiverID,
            messageText
        });

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: { messageID }
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending message',
            error: error.message
        });
    }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
    try {
        const { requestID } = req.params;
        const receiverID = req.user.userID;

        await Chat.markAsRead(requestID, receiverID);

        res.status(200).json({
            success: true,
            message: 'Messages marked as read'
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating read status',
            error: error.message
        });
    }
};

// Get unread message count
exports.getUnreadCount = async (req, res) => {
    try {
        const userID = req.user.userID;
        const { requestID } = req.query;

        const count = await Chat.getUnreadCount(userID, requestID || null);

        res.status(200).json({
            success: true,
            data: { unreadCount: count }
        });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving unread count',
            error: error.message
        });
    }
};

// Get all conversations for the current user
exports.getConversations = async (req, res) => {
    try {
        const userID = req.user.userID;

        const conversations = await Chat.getUserConversations(userID);

        res.status(200).json({
            success: true,
            data: conversations
        });
    } catch (error) {
        console.error('Error getting conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving conversations',
            error: error.message
        });
    }
};

