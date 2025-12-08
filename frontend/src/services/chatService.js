import axios from 'axios';
import { authService } from './authService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Create axios instance with auth token
const getAuthHeaders = () => {
    const token = authService.getToken();
    return {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
};

export const chatService = {
    // Get all conversations for current user
    getConversations: async () => {
        try {
            const response = await axios.get(
                `${API_URL}/chat/conversations`,
                getAuthHeaders()
            );
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch conversations' };
        }
    },

    // Get messages for a specific request
    getMessages: async (requestID) => {
        try {
            const response = await axios.get(
                `${API_URL}/chat/messages/${requestID}`,
                getAuthHeaders()
            );
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch messages' };
        }
    },

    // Send a message (also handled via Socket.io, but this is for REST fallback)
    sendMessage: async (requestID, receiverID, messageText) => {
        try {
            const response = await axios.post(
                `${API_URL}/chat/send`,
                { requestID, receiverID, messageText },
                getAuthHeaders()
            );
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to send message' };
        }
    },

    // Mark messages as read
    markAsRead: async (requestID) => {
        try {
            const response = await axios.put(
                `${API_URL}/chat/read/${requestID}`,
                {},
                getAuthHeaders()
            );
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to mark messages as read' };
        }
    },

    // Get unread message count
    getUnreadCount: async (requestID = null) => {
        try {
            const url = requestID 
                ? `${API_URL}/chat/unread?requestID=${requestID}`
                : `${API_URL}/chat/unread`;
            const response = await axios.get(url, getAuthHeaders());
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to get unread count' };
        }
    }
};

