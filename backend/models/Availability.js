const pool = require('../config/database');

class Availability {
    // Set or update availability for a provider on a specific date and time slot
    static async setAvailability(providerID, date, timeSlot, available = true) {
        const query = `
            INSERT INTO Availability (providerID, date, timeSlot, available)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE available = ?, updatedAt = CURRENT_TIMESTAMP
        `;
        await pool.execute(query, [providerID, date, timeSlot, available, available]);
    }

    // Get availability for a provider on a specific date
    static async getByProviderAndDate(providerID, date) {
        const query = `
            SELECT * FROM Availability
            WHERE providerID = ? AND date = ?
            ORDER BY timeSlot ASC
        `;
        const [rows] = await pool.execute(query, [providerID, date]);
        return rows;
    }

    // Get availability for a provider within a date range
    static async getByProviderAndDateRange(providerID, startDate, endDate) {
        const query = `
            SELECT * FROM Availability
            WHERE providerID = ? AND date >= ? AND date <= ?
            ORDER BY date ASC, timeSlot ASC
        `;
        const [rows] = await pool.execute(query, [providerID, startDate, endDate]);
        return rows;
    }

    // Check if provider is available on a specific date and time slot
    static async isAvailable(providerID, date, timeSlot) {
        const query = `
            SELECT available FROM Availability
            WHERE providerID = ? AND date = ? AND timeSlot = ?
        `;
        const [rows] = await pool.execute(query, [providerID, date, timeSlot]);
        return rows.length > 0 && rows[0].available === 1;
    }

    // Get all availability for a provider
    static async getByProvider(providerID) {
        const query = `
            SELECT * FROM Availability
            WHERE providerID = ?
            ORDER BY date ASC, timeSlot ASC
        `;
        const [rows] = await pool.execute(query, [providerID]);
        return rows;
    }

    // Delete availability for a provider on a specific date and time slot
    static async deleteAvailability(providerID, date, timeSlot) {
        const query = `
            DELETE FROM Availability
            WHERE providerID = ? AND date = ? AND timeSlot = ?
        `;
        const [result] = await pool.execute(query, [providerID, date, timeSlot]);
        return result.affectedRows > 0;
    }

    // Delete all availability for a provider on a specific date
    static async deleteByDate(providerID, date) {
        const query = `
            DELETE FROM Availability
            WHERE providerID = ? AND date = ?
        `;
        const [result] = await pool.execute(query, [providerID, date]);
        return result.affectedRows > 0;
    }

    // Bulk set availability (for setting multiple time slots at once)
    static async bulkSetAvailability(providerID, date, timeSlots, available = true) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            for (const timeSlot of timeSlots) {
                await connection.execute(
                    `INSERT INTO Availability (providerID, date, timeSlot, available)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE available = ?, updatedAt = CURRENT_TIMESTAMP`,
                    [providerID, date, timeSlot, available, available]
                );
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Get available providers for a specific date and time slot
    static async getAvailableProviders(date, timeSlot) {
        const query = `
            SELECT DISTINCT u.userID, u.name, u.email, u.phone
            FROM USER u
            INNER JOIN Availability a ON u.userID = a.providerID
            WHERE u.role = 'Provider' 
            AND u.verified = TRUE
            AND a.date = ?
            AND a.timeSlot = ?
            AND a.available = TRUE
            ORDER BY u.name ASC
        `;
        const [rows] = await pool.execute(query, [date, timeSlot]);
        return rows;
    }
}

module.exports = Availability;

