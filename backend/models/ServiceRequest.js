const pool = require('../config/database');

class ServiceRequest {
    // Create a new service request
    static async create(requestData) {
        const { customerID, category, description, serviceDate } = requestData;
        const query = `
            INSERT INTO ServiceRequest (customerID, category, description, serviceDate, status, priorityLevel)
            VALUES (?, ?, ?, ?, 'Pending', 'Normal')
        `;
        const [result] = await pool.execute(query, [customerID, category, description, serviceDate || null]);
        return result.insertId;
    }

    // Get service request by ID
    static async findById(requestID) {
        const query = `
            SELECT 
                sr.*,
                c.name as customerName,
                c.email as customerEmail,
                c.phone as customerPhone,
                p.name as providerName,
                p.email as providerEmail,
                p.phone as providerPhone
            FROM ServiceRequest sr
            LEFT JOIN USER c ON sr.customerID = c.userID
            LEFT JOIN USER p ON sr.providerID = p.userID
            WHERE sr.requestID = ?
        `;
        const [rows] = await pool.execute(query, [requestID]);
        return rows[0];
    }

    // Get all service requests by customer
    static async getByCustomer(customerID, status = null, category = null) {
        let query = `
            SELECT 
                sr.*,
                p.name as providerName,
                p.email as providerEmail
            FROM ServiceRequest sr
            LEFT JOIN USER p ON sr.providerID = p.userID
            WHERE sr.customerID = ?
        `;
        const params = [customerID];
        
        if (status) {
            query += ' AND sr.status = ?';
            params.push(status);
        }
        
        if (category) {
            // Normalize category for comparison (trim)
            const normalizedCategory = category.trim();
            // Simple equality comparison (MySQL is case-insensitive by default for most collations)
            query += ' AND sr.category = ?';
            params.push(normalizedCategory);
        }
        
        query += ' ORDER BY sr.createdAt DESC';
        
        console.log('getByCustomer - SQL Query:', query);
        console.log('getByCustomer - Params:', params);
        console.log('getByCustomer - Original category:', category);
        console.log('getByCustomer - Normalized category:', category ? category.trim() : null);
        const [rows] = await pool.execute(query, params);
        console.log('getByCustomer - Rows returned:', rows.length);
        if (rows.length > 0) {
            console.log('getByCustomer - All categories in results:', rows.map(r => `"${r.category}"`));
        } else {
            console.log('getByCustomer - No rows returned for category:', category);
        }
        return rows;
    }

    // Get all service requests by provider
    static async getByProvider(providerID, status = null, category = null) {
        let query = `
            SELECT 
                sr.*,
                c.name as customerName,
                c.email as customerEmail,
                c.phone as customerPhone
            FROM ServiceRequest sr
            LEFT JOIN USER c ON sr.customerID = c.userID
            WHERE sr.providerID = ?
        `;
        const params = [providerID];
        
        if (status) {
            query += ' AND sr.status = ?';
            params.push(status);
        }
        
        if (category) {
            // Normalize category for comparison (trim and lowercase)
            const normalizedCategory = category.trim().toLowerCase();
            query += ' AND LOWER(TRIM(sr.category)) = ?';
            params.push(normalizedCategory);
        }
        
        query += ' ORDER BY sr.createdAt DESC';
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // Get all pending service requests (for providers to see available requests)
    static async getPendingRequests(category = null) {
        let query = `
            SELECT 
                sr.*,
                c.name as customerName,
                c.email as customerEmail,
                c.phone as customerPhone
            FROM ServiceRequest sr
            LEFT JOIN USER c ON sr.customerID = c.userID
            WHERE sr.status = 'Pending' AND sr.providerID IS NULL
        `;
        const params = [];
        
        if (category) {
            // Normalize category for comparison (trim and lowercase)
            const normalizedCategory = category.trim().toLowerCase();
            query += ' AND LOWER(TRIM(sr.category)) = ?';
            params.push(normalizedCategory);
        }
        
        query += ' ORDER BY sr.createdAt DESC';
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // Update service request
    static async update(requestID, customerID, updateData) {
        const { category, description, serviceDate, status, priorityLevel } = updateData;
        
        // Build dynamic update query
        const updates = [];
        const params = [];
        
        if (category !== undefined) {
            updates.push('category = ?');
            params.push(category);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (serviceDate !== undefined) {
            updates.push('serviceDate = ?');
            params.push(serviceDate);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }
        if (priorityLevel !== undefined) {
            updates.push('priorityLevel = ?');
            params.push(priorityLevel);
        }
        
        if (updates.length === 0) {
            return await this.findById(requestID);
        }
        
        params.push(requestID, customerID);
        
        const query = `
            UPDATE ServiceRequest 
            SET ${updates.join(', ')}
            WHERE requestID = ? AND customerID = ?
        `;
        
        await pool.execute(query, params);
        return await this.findById(requestID);
    }

    // Delete service request (only if status is Pending)
    static async delete(requestID, customerID) {
        const query = `
            DELETE FROM ServiceRequest 
            WHERE requestID = ? AND customerID = ? AND status = 'Pending'
        `;
        const [result] = await pool.execute(query, [requestID, customerID]);
        return result.affectedRows > 0;
    }

    // Get service requests by category
    static async getByCategory(category) {
        const query = `
            SELECT 
                sr.*,
                c.name as customerName,
                c.email as customerEmail,
                p.name as providerName
            FROM ServiceRequest sr
            LEFT JOIN USER c ON sr.customerID = c.userID
            LEFT JOIN USER p ON sr.providerID = p.userID
            WHERE sr.category = ?
            ORDER BY sr.createdAt DESC
        `;
        const [rows] = await pool.execute(query, [category]);
        return rows;
    }

    // Accept service request (Provider only)
    static async acceptRequest(requestID, providerID) {
        const query = `
            UPDATE ServiceRequest 
            SET providerID = ?, status = 'Accepted'
            WHERE requestID = ? AND status = 'Pending' AND providerID IS NULL
        `;
        const [result] = await pool.execute(query, [providerID, requestID]);
        return result.affectedRows > 0;
    }

    // Reject service request (Provider only) - just update status, don't assign provider
    static async rejectRequest(requestID) {
        const query = `
            UPDATE ServiceRequest 
            SET status = 'Rejected'
            WHERE requestID = ? AND status = 'Pending'
        `;
        const [result] = await pool.execute(query, [requestID]);
        return result.affectedRows > 0;
    }

    // Accept manual booking (Provider only) - providerID is already set, just update status
    static async acceptManualBooking(requestID, providerID) {
        const query = `
            UPDATE ServiceRequest 
            SET status = 'Accepted'
            WHERE requestID = ? AND providerID = ? AND status = 'Pending'
        `;
        const [result] = await pool.execute(query, [requestID, providerID]);
        return result.affectedRows > 0;
    }

    // Reject manual booking (Provider only) - providerID is already set, just update status
    static async rejectManualBooking(requestID, providerID) {
        const query = `
            UPDATE ServiceRequest 
            SET status = 'Rejected'
            WHERE requestID = ? AND providerID = ? AND status = 'Pending'
        `;
        const [result] = await pool.execute(query, [requestID, providerID]);
        return result.affectedRows > 0;
    }

    // Update service request with providerID (for manual bookings)
    static async updateWithProvider(requestID, updateData) {
        const { providerID, status, priorityLevel } = updateData;
        
        const updates = [];
        const params = [];
        
        if (providerID !== undefined) {
            updates.push('providerID = ?');
            params.push(providerID);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }
        if (priorityLevel !== undefined) {
            updates.push('priorityLevel = ?');
            params.push(priorityLevel);
        }
        
        if (updates.length === 0) {
            return await this.findById(requestID);
        }
        
        params.push(requestID);
        const query = `UPDATE ServiceRequest SET ${updates.join(', ')} WHERE requestID = ?`;
        await pool.execute(query, params);
        return await this.findById(requestID);
    }
}

module.exports = ServiceRequest;

