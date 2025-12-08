const pool = require('../config/database');

class Notification {
    // Create a new notification
    static async create(notificationData) {
        const { userID, requestID, message, notificationType } = notificationData;
        const query = `
            INSERT INTO Notification (userID, requestID, message, notificationType)
            VALUES (?, ?, ?, ?)
        `;
        const [result] = await pool.execute(query, [userID, requestID || null, message, notificationType || null]);
        return result.insertId;
    }

    // Get notification by ID
    static async findById(notificationID) {
        const query = `
            SELECT 
                n.*,
                sr.category as requestCategory,
                sr.description as requestDescription
            FROM Notification n
            LEFT JOIN ServiceRequest sr ON n.requestID = sr.requestID
            WHERE n.notificationID = ?
        `;
        const [rows] = await pool.execute(query, [notificationID]);
        return rows[0];
    }

    // Get all notifications for a user
    static async getByUser(userID, unreadOnly = false) {
        let query = `
            SELECT 
                n.*,
                sr.category as requestCategory,
                sr.description as requestDescription
            FROM Notification n
            LEFT JOIN ServiceRequest sr ON n.requestID = sr.requestID
            WHERE n.userID = ?
        `;
        const params = [userID];
        
        if (unreadOnly) {
            query += ' AND n.readStatus = FALSE';
        }
        
        query += ' ORDER BY n.date DESC';
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // Get unread notification count for a user
    static async getUnreadCount(userID) {
        const query = `
            SELECT COUNT(*) as count 
            FROM Notification 
            WHERE userID = ? AND readStatus = FALSE
        `;
        const [rows] = await pool.execute(query, [userID]);
        return rows[0].count;
    }

    // Mark notification as read
    static async markAsRead(notificationID, userID) {
        const query = `
            UPDATE Notification 
            SET readStatus = TRUE 
            WHERE notificationID = ? AND userID = ?
        `;
        const [result] = await pool.execute(query, [notificationID, userID]);
        return result.affectedRows > 0;
    }

    // Mark all notifications as read for a user
    static async markAllAsRead(userID) {
        const query = `
            UPDATE Notification 
            SET readStatus = TRUE 
            WHERE userID = ? AND readStatus = FALSE
        `;
        const [result] = await pool.execute(query, [userID]);
        return result.affectedRows;
    }

    // Delete notification
    static async delete(notificationID, userID) {
        const query = `
            DELETE FROM Notification 
            WHERE notificationID = ? AND userID = ?
        `;
        const [result] = await pool.execute(query, [notificationID, userID]);
        return result.affectedRows > 0;
    }

    // Delete all read notifications for a user
    static async deleteAllRead(userID) {
        const query = `
            DELETE FROM Notification 
            WHERE userID = ? AND readStatus = TRUE
        `;
        const [result] = await pool.execute(query, [userID]);
        return result.affectedRows;
    }
}

module.exports = Notification;

