import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { authService } from '../../services/authService';
import { chatService } from '../../services/chatService';
import './Chat.css';

const Chat = ({ requestID, otherUserID, otherUserName, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUser, setTypingUser] = useState(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const currentUser = authService.getCurrentUser();

    // Initialize Socket.io connection
    useEffect(() => {
        const token = authService.getToken();
        if (!token) return;

        const newSocket = io(process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001', {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
            console.log('Socket connected');
            // Join the request room
            if (requestID) {
                newSocket.emit('join_request', requestID);
            }
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        newSocket.on('new_message', (messageData) => {
            setMessages(prev => [...prev, messageData]);
            // Auto-scroll to bottom
            scrollToBottom();
        });

        newSocket.on('user_typing', (data) => {
            if (data.userID !== currentUser.userID) {
                setTypingUser(data.userID);
                setIsTyping(true);
            }
        });

        newSocket.on('user_stop_typing', (data) => {
            if (data.userID !== currentUser.userID) {
                setIsTyping(false);
                setTypingUser(null);
            }
        });

        newSocket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        setSocket(newSocket);

        return () => {
            if (requestID) {
                newSocket.emit('leave_request', requestID);
            }
            newSocket.close();
        };
    }, [requestID, currentUser.userID]);

    // Load messages on mount
    useEffect(() => {
        loadMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestID]);

    // Mark messages as read when component mounts or messages change
    useEffect(() => {
        if (messages.length > 0 && socket) {
            chatService.markAsRead(requestID).catch(err => {
                console.error('Failed to mark messages as read:', err);
            });
        }
    }, [messages.length, requestID, socket]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadMessages = async () => {
        try {
            setLoading(true);
            const response = await chatService.getMessages(requestID);
            if (response.success) {
                setMessages(response.data);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket) return;

        const messageText = newMessage.trim();
        setNewMessage('');

        try {
            // Emit message via Socket.io
            socket.emit('send_message', {
                requestID,
                receiverID: otherUserID,
                messageText
            });

            // Stop typing indicator
            socket.emit('stop_typing', { requestID });
        } catch (error) {
            console.error('Error sending message:', error);
            // Restore message on error
            setNewMessage(messageText);
        }
    };

    const handleTyping = (e) => {
        const value = e.target.value;
        setNewMessage(value);

        if (socket && value.trim()) {
            socket.emit('typing', { requestID });
            
            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Set timeout to stop typing indicator
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('stop_typing', { requestID });
            }, 1000);
        }
    };

    const formatTime = (timestamp) => {
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
            <div className="chat-container">
                <div className="chat-loading">Loading messages...</div>
            </div>
        );
    }

    return (
        <div className="chat-container">
            <div className="chat-header">
                <div className="chat-header-info">
                    <h3>Chat with {otherUserName}</h3>
                    <span className="chat-request-id">Request #{requestID}</span>
                </div>
                {onClose && (
                    <button className="chat-close-btn" onClick={onClose}>×</button>
                )}
            </div>

            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="chat-empty">No messages yet. Start the conversation!</div>
                ) : (
                    messages.map((message) => {
                        const isOwnMessage = message.senderID === currentUser.userID;
                        return (
                            <div
                                key={message.messageID}
                                className={`chat-message ${isOwnMessage ? 'own-message' : 'other-message'}`}
                            >
                                <div className="message-content">
                                    <p>{message.messageText}</p>
                                    <span className="message-time">
                                        {formatTime(message.timestamp)}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                {isTyping && typingUser !== currentUser.userID && (
                    <div className="chat-typing-indicator">
                        <span>{otherUserName} is typing...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    className="chat-input"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={handleTyping}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                        }
                    }}
                />
                <button type="submit" className="chat-send-btn" disabled={!newMessage.trim()}>
                    Send
                </button>
            </form>
        </div>
    );
};

export default Chat;

