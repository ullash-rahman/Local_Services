const pool = require('../config/database');

class Chat {
    // Create a new message
    static async create(messageData) {
        const { requestID, senderID, receiverID, messageText } = messageData;
        const query = `
            INSERT INTO Chat (requestID, senderID, receiverID, messageText)
            VALUES (?, ?, ?, ?)
        `;
        const [result] = await pool.execute(query, [requestID, senderID, receiverID, messageText]);
        return result.insertId;
    }

    // Get all messages for a specific request
    static async getByRequest(requestID) {
        const query = `
            SELECT 
                c.messageID,
                c.requestID,
                c.senderID,
                c.receiverID,
                c.messageText,
                c.timestamp,
                c.isRead,
                u1.name as senderName,
                u2.name as receiverName
            FROM Chat c
            LEFT JOIN USER u1 ON c.senderID = u1.userID
            LEFT JOIN USER u2 ON c.receiverID = u2.userID
            WHERE c.requestID = ?
            ORDER BY c.timestamp ASC
        `;
        const [rows] = await pool.execute(query, [requestID]);
        return rows;
    }

    // Get conversation between two users for a request
    static async getConversation(requestID, user1ID, user2ID) {
        const query = `
            SELECT 
                c.messageID,
                c.requestID,
                c.senderID,
                c.receiverID,
                c.messageText,
                c.timestamp,
                c.isRead,
                u.name as senderName
            FROM Chat c
            LEFT JOIN USER u ON c.senderID = u.userID
            WHERE c.requestID = ?
            AND ((c.senderID = ? AND c.receiverID = ?) OR (c.senderID = ? AND c.receiverID = ?))
            ORDER BY c.timestamp ASC
        `;
        const [rows] = await pool.execute(query, [requestID, user1ID, user2ID, user2ID, user1ID]);
        return rows;
    }

    // Mark messages as read
    static async markAsRead(requestID, receiverID) {
        const query = `
            UPDATE Chat 
            SET isRead = TRUE 
            WHERE requestID = ? AND receiverID = ? AND isRead = FALSE
        `;
        await pool.execute(query, [requestID, receiverID]);
    }

    // Get unread message count for a user
    static async getUnreadCount(userID, requestID = null) {
        let query = `
            SELECT COUNT(*) as count 
            FROM Chat 
            WHERE receiverID = ? AND isRead = FALSE
        `;
        const params = [userID];
        
        if (requestID) {
            query += ' AND requestID = ?';
            params.push(requestID);
        }
        
        const [rows] = await pool.execute(query, params);
        return rows[0].count;
    }

    // Get all conversations for a user (grouped by request)
    static async getUserConversations(userID) {
        const query = `
            SELECT DISTINCT
                c.requestID,
                sr.category,
                sr.description as requestDescription,
                CASE 
                    WHEN sr.customerID = ? THEN u2.name
                    ELSE u1.name
                END as otherUserName,
                CASE 
                    WHEN sr.customerID = ? THEN u2.userID
                    ELSE u1.userID
                END as otherUserID,
                CASE 
                    WHEN sr.customerID = ? THEN 'Customer'
                    ELSE 'Provider'
                END as otherUserRole,
                (SELECT messageText FROM Chat WHERE requestID = c.requestID ORDER BY timestamp DESC LIMIT 1) as lastMessage,
                (SELECT timestamp FROM Chat WHERE requestID = c.requestID ORDER BY timestamp DESC LIMIT 1) as lastMessageTime,
                (SELECT COUNT(*) FROM Chat WHERE requestID = c.requestID AND receiverID = ? AND isRead = FALSE) as unreadCount
            FROM Chat c
            INNER JOIN ServiceRequest sr ON c.requestID = sr.requestID
            LEFT JOIN USER u1 ON sr.customerID = u1.userID
            LEFT JOIN USER u2 ON sr.providerID = u2.userID
            WHERE c.senderID = ? OR c.receiverID = ?
            ORDER BY lastMessageTime DESC
        `;
        const [rows] = await pool.execute(query, [userID, userID, userID, userID, userID, userID]);
        return rows;
    }
}

module.exports = Chat;

