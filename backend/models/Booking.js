const pool = require('../config/database');

class Booking {
    // Create a new booking
    static async create(bookingData) {
        const { requestID, providerID, scheduledDate, scheduledTime, manualBooking } = bookingData;
        const query = `
            INSERT INTO Booking (requestID, providerID, scheduledDate, scheduledTime, manualBooking)
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await pool.execute(query, [
            requestID,
            providerID,
            scheduledDate,
            scheduledTime || null,
            manualBooking !== undefined ? manualBooking : false
        ]);
        return result.insertId;
    }

    // Get booking by ID
    static async findById(bookingID) {
        const query = `
            SELECT 
                b.*,
                sr.customerID,
                sr.category,
                sr.description,
                sr.status as requestStatus,
                sr.priorityLevel,
                c.name as customerName,
                c.email as customerEmail,
                c.phone as customerPhone,
                p.name as providerName,
                p.email as providerEmail,
                p.phone as providerPhone
            FROM Booking b
            INNER JOIN ServiceRequest sr ON b.requestID = sr.requestID
            INNER JOIN USER c ON sr.customerID = c.userID
            INNER JOIN USER p ON b.providerID = p.userID
            WHERE b.bookingID = ?
        `;
        const [rows] = await pool.execute(query, [bookingID]);
        return rows[0];
    }

    // Get booking by requestID
    static async findByRequestID(requestID) {
        const query = `
            SELECT 
                b.*,
                sr.customerID,
                sr.category,
                sr.description,
                sr.status as requestStatus,
                p.name as providerName,
                p.email as providerEmail,
                p.phone as providerPhone
            FROM Booking b
            INNER JOIN ServiceRequest sr ON b.requestID = sr.requestID
            INNER JOIN USER p ON b.providerID = p.userID
            WHERE b.requestID = ?
        `;
        const [rows] = await pool.execute(query, [requestID]);
        return rows[0];
    }

    // Get all bookings by customer
    static async getByCustomer(customerID, manualOnly = false) {
        let query = `
            SELECT 
                b.*,
                sr.customerID,
                sr.category,
                sr.description,
                sr.status as requestStatus,
                sr.priorityLevel,
                p.name as providerName,
                p.email as providerEmail,
                p.phone as providerPhone
            FROM Booking b
            INNER JOIN ServiceRequest sr ON b.requestID = sr.requestID
            INNER JOIN USER p ON b.providerID = p.userID
            WHERE sr.customerID = ?
        `;
        const params = [customerID];
        
        if (manualOnly) {
            query += ' AND b.manualBooking = TRUE';
        }
        
        query += ' ORDER BY b.scheduledDate DESC, b.createdAt DESC';
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // Get all bookings by provider
    static async getByProvider(providerID, manualOnly = false) {
        let query = `
            SELECT 
                b.*,
                sr.customerID,
                sr.category,
                sr.description,
                sr.status as requestStatus,
                sr.priorityLevel,
                c.name as customerName,
                c.email as customerEmail,
                c.phone as customerPhone
            FROM Booking b
            INNER JOIN ServiceRequest sr ON b.requestID = sr.requestID
            INNER JOIN USER c ON sr.customerID = c.userID
            WHERE b.providerID = ?
        `;
        const params = [providerID];
        
        if (manualOnly) {
            query += ' AND b.manualBooking = TRUE';
        }
        
        query += ' ORDER BY b.scheduledDate DESC, b.createdAt DESC';
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // Update booking
    static async update(bookingID, updateData) {
        const { scheduledDate, scheduledTime, cancellationReason } = updateData;
        
        const updates = [];
        const params = [];
        
        if (scheduledDate !== undefined) {
            updates.push('scheduledDate = ?');
            params.push(scheduledDate);
        }
        if (scheduledTime !== undefined) {
            updates.push('scheduledTime = ?');
            params.push(scheduledTime);
        }
        if (cancellationReason !== undefined) {
            updates.push('cancellationReason = ?');
            params.push(cancellationReason);
        }
        
        if (updates.length === 0) {
            return await this.findById(bookingID);
        }
        
        params.push(bookingID);
        const query = `UPDATE Booking SET ${updates.join(', ')} WHERE bookingID = ?`;
        await pool.execute(query, params);
        return await this.findById(bookingID);
    }

    // Delete booking
    static async delete(bookingID) {
        const query = 'DELETE FROM Booking WHERE bookingID = ?';
        const [result] = await pool.execute(query, [bookingID]);
        return result.affectedRows > 0;
    }
}

module.exports = Booking;
