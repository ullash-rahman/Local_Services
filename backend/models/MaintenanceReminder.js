const pool = require('../config/database');

class MaintenanceReminder {
    // Create a new maintenance reminder
    static async create(reminderData) {
        const { customerID, serviceType, lastServiceDate, nextServiceDate, reminderFrequency } = reminderData;
        const query = `
            INSERT INTO MaintenanceReminder (customerID, serviceType, lastServiceDate, nextServiceDate, reminderFrequency, status)
            VALUES (?, ?, ?, ?, ?, 'Active')
        `;
        const [result] = await pool.execute(query, [
            customerID,
            serviceType,
            lastServiceDate,
            nextServiceDate,
            reminderFrequency || 30
        ]);
        return result.insertId;
    }

    // Get reminder by ID
    static async findById(reminderID) {
        const query = `
            SELECT 
                mr.*,
                u.name as customerName,
                u.email as customerEmail,
                u.phone as customerPhone
            FROM MaintenanceReminder mr
            INNER JOIN USER u ON mr.customerID = u.userID
            WHERE mr.reminderID = ?
        `;
        const [rows] = await pool.execute(query, [reminderID]);
        return rows[0];
    }

    // Get all reminders by customer
    static async getByCustomer(customerID, status = null) {
        let query = `
            SELECT 
                mr.*
            FROM MaintenanceReminder mr
            WHERE mr.customerID = ?
        `;
        const params = [customerID];
        
        if (status) {
            query += ' AND mr.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY mr.nextServiceDate ASC';
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // Get upcoming reminders (due within specified days)
    static async getUpcoming(customerID, daysAhead = 7) {
        const query = `
            SELECT 
                mr.*
            FROM MaintenanceReminder mr
            WHERE mr.customerID = ? 
                AND mr.status = 'Active'
                AND mr.nextServiceDate <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
                AND mr.nextServiceDate >= CURDATE()
            ORDER BY mr.nextServiceDate ASC
        `;
        const [rows] = await pool.execute(query, [customerID, daysAhead]);
        return rows;
    }

    // Get overdue reminders
    static async getOverdue(customerID) {
        const query = `
            SELECT 
                mr.*
            FROM MaintenanceReminder mr
            WHERE mr.customerID = ? 
                AND mr.status = 'Active'
                AND mr.nextServiceDate < CURDATE()
            ORDER BY mr.nextServiceDate ASC
        `;
        const [rows] = await pool.execute(query, [customerID]);
        return rows;
    }

    // Update reminder
    static async update(reminderID, customerID, updateData) {
        const { serviceType, lastServiceDate, nextServiceDate, reminderFrequency, status } = updateData;
        
        const updates = [];
        const params = [];
        
        if (serviceType !== undefined) {
            updates.push('serviceType = ?');
            params.push(serviceType);
        }
        if (lastServiceDate !== undefined) {
            updates.push('lastServiceDate = ?');
            params.push(lastServiceDate);
        }
        if (nextServiceDate !== undefined) {
            updates.push('nextServiceDate = ?');
            params.push(nextServiceDate);
        }
        if (reminderFrequency !== undefined) {
            updates.push('reminderFrequency = ?');
            params.push(reminderFrequency);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }
        
        if (updates.length === 0) {
            return await this.findById(reminderID);
        }
        
        params.push(reminderID, customerID);
        
        const query = `
            UPDATE MaintenanceReminder 
            SET ${updates.join(', ')}, updatedAt = NOW()
            WHERE reminderID = ? AND customerID = ?
        `;
        
        await pool.execute(query, params);
        return await this.findById(reminderID);
    }

    // Delete reminder
    static async delete(reminderID, customerID) {
        const query = `
            DELETE FROM MaintenanceReminder 
            WHERE reminderID = ? AND customerID = ?
        `;
        const [result] = await pool.execute(query, [reminderID, customerID]);
        return result.affectedRows > 0;
    }

    // Mark reminder as completed (update lastServiceDate and nextServiceDate)
    static async markAsCompleted(reminderID, customerID, completionDate) {
        const reminder = await this.findById(reminderID);
        if (!reminder || reminder.customerID !== customerID) {
            return null;
        }

        const lastServiceDate = completionDate || new Date().toISOString().split('T')[0];
        const nextServiceDate = new Date(lastServiceDate);
        nextServiceDate.setDate(nextServiceDate.getDate() + reminder.reminderFrequency);

        const query = `
            UPDATE MaintenanceReminder 
            SET lastServiceDate = ?,
                nextServiceDate = ?,
                updatedAt = NOW()
            WHERE reminderID = ? AND customerID = ?
        `;
        
        await pool.execute(query, [
            lastServiceDate,
            nextServiceDate.toISOString().split('T')[0],
            reminderID,
            customerID
        ]);
        
        return await this.findById(reminderID);
    }
}

module.exports = MaintenanceReminder;

