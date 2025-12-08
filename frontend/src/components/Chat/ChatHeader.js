import React, { useState, useEffect } from 'react';
import ConversationsList from './ConversationsList';
import Chat from './Chat';
import './ChatHeader.css';

const ChatHeader = ({ initialConversation = null }) => {
    const [selectedConversation, setSelectedConversation] = useState(initialConversation);
    const [isOpen, setIsOpen] = useState(!!initialConversation);

    // Update when initialConversation changes
    useEffect(() => {
        if (initialConversation) {
            setSelectedConversation(initialConversation);
            setIsOpen(true);
        }
    }, [initialConversation]);

    const handleSelectConversation = (conversation) => {
        setSelectedConversation(conversation);
        setIsOpen(true);
    };

    const handleCloseChat = () => {
        setSelectedConversation(null);
        setIsOpen(false);
    };

    return (
        <div className="chat-header-container">
            <button 
                className="chat-header-button"
                onClick={() => setIsOpen(!isOpen)}
                title="Messages"
            >
                💬 Messages
            </button>

            {isOpen && (
                <div className="chat-header-dropdown">
                    <div className="chat-header-dropdown-header">
                        <h3>Messages</h3>
                        <button 
                            className="chat-header-close-btn"
                            onClick={() => setIsOpen(false)}
                        >
                            ×
                        </button>
                    </div>
                    <div className="chat-header-content">
                        <div className="chat-header-conversations">
                            <ConversationsList
                                onSelectConversation={handleSelectConversation}
                                selectedRequestID={selectedConversation?.requestID}
                            />
                        </div>
                        {selectedConversation ? (
                            <div className="chat-header-chat">
                                <Chat
                                    requestID={selectedConversation.requestID}
                                    otherUserID={selectedConversation.otherUserID}
                                    otherUserName={selectedConversation.otherUserName}
                                    requestCategory={selectedConversation.category}
                                    requestDescription={selectedConversation.requestDescription}
                                    onClose={handleCloseChat}
                                />
                            </div>
                        ) : (
                            <div className="chat-header-empty">
                                <p>Select a conversation to start chatting</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatHeader;

