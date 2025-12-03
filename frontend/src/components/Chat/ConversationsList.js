import React, { useState, useEffect } from 'react';
import { chatService } from '../../services/chatService';
import './Chat.css';

const ConversationsList = ({ onSelectConversation, selectedRequestID }) => {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadConversations();
        // Refresh conversations every 30 seconds
        const interval = setInterval(loadConversations, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadConversations = async () => {
        try {
            const response = await chatService.getConversations();
            if (response.success) {
                setConversations(response.data);
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="conversations-list">
                <div className="chat-loading">Loading conversations...</div>
            </div>
        );
    }

    if (conversations.length === 0) {
        return (
            <div className="conversations-list">
                <div className="chat-empty">No conversations yet</div>
            </div>
        );
    }

    return (
        <div className="conversations-list">
            {conversations.map((conv) => (
                <div
                    key={conv.requestID}
                    className={`conversation-item ${selectedRequestID === conv.requestID ? 'selected' : ''}`}
                    onClick={() => onSelectConversation(conv)}
                >
                    <div className="conversation-header">
                        <span className="conversation-name">{conv.otherUserName}</span>
                        <span className="conversation-time">{formatTime(conv.lastMessageTime)}</span>
                    </div>
                    <div className="conversation-preview">{conv.lastMessage}</div>
                    <div className="conversation-meta">
                        <span className="conversation-category">{conv.category}</span>
                        {conv.unreadCount > 0 && (
                            <span className="unread-badge">{conv.unreadCount}</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ConversationsList;

