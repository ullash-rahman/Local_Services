const pool = require('../config/database');

class Payment {
    /**
     * Create a new payment record
     * @param {Object} paymentData - Payment data
     * @param {number} paymentData.requestID - Service request ID
     * @param {number} paymentData.amount - Payment amount (must be positive)
     * @param {Date} paymentData.dueDate - Payment due date
     * @param {string} [paymentData.status='Pending'] - Payment status
     * @returns {Promise<number>} - Created payment ID
     */
    static async create(paymentData) {
        const { requestID, amount, dueDate, status = 'Pending' } = paymentData;
        const query = `
            INSERT INTO Payment (requestID, amount, status, dueDate)
            VALUES (?, ?, ?, ?)
        `;
        const [result] = await pool.execute(query, [requestID, amount, status, dueDate]);
        return result.insertId;
    }

    /**
     * Find payment by ID with full details
     * @param {number} paymentID - Payment ID
     * @returns {Promise<Object|undefined>} - Payment record with service request and user details
     */
    static async findById(paymentID) {
        const query = `
            SELECT 
                p.*,
                sr.customerID,
                sr.providerID,
                sr.category,
                sr.description,
                sr.status as requestStatus,
                sr.serviceDate,
                c.name as customerName,
                c.email as customerEmail,
                c.phone as customerPhone,
                pr.name as providerName,
                pr.email as providerEmail,
                pr.phone as providerPhone
            FROM Payment p
            INNER JOIN ServiceRequest sr ON p.requestID = sr.requestID
            INNER JOIN USER c ON sr.customerID = c.userID
            LEFT JOIN USER pr ON sr.providerID = pr.userID
            WHERE p.paymentID = ?
        `;
        const [rows] = await pool.execute(query, [paymentID]);
        return rows[0];
    }


    /**
     * Find all payments for a provider with optional filters
     * @param {number} providerID - Provider user ID
     * @param {Object} [filters={}] - Optional filters
     * @param {string} [filters.status] - Filter by payment status
     * @param {Date} [filters.startDate] - Filter by start date
     * @param {Date} [filters.endDate] - Filter by end date
     * @param {string} [filters.category] - Filter by service category
     * @param {string} [filters.sortBy='createdAt'] - Sort field
     * @param {string} [filters.sortOrder='DESC'] - Sort order
     * @returns {Promise<Array>} - Array of payment records
     */
    static async findByProvider(providerID, filters = {}) {
        const { status, startDate, endDate, category, sortBy = 'createdAt', sortOrder = 'DESC' } = filters;
        
        let query = `
            SELECT 
                p.*,
                sr.customerID,
                sr.category,
                sr.description,
                sr.status as requestStatus,
                sr.serviceDate,
                c.name as customerName,
                c.email as customerEmail,
                c.phone as customerPhone
            FROM Payment p
            INNER JOIN ServiceRequest sr ON p.requestID = sr.requestID
            INNER JOIN USER c ON sr.customerID = c.userID
            WHERE sr.providerID = ?
        `;
        const params = [providerID];

        if (status) {
            query += ' AND p.status = ?';
            params.push(status);
        }

        if (startDate) {
            query += ' AND p.createdAt >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND p.createdAt <= ?';
            params.push(endDate);
        }

        if (category) {
            query += ' AND sr.category = ?';
            params.push(category);
        }

        // Validate sortBy to prevent SQL injection
        const allowedSortFields = ['createdAt', 'amount', 'status', 'dueDate', 'paymentDate'];
        const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        query += ` ORDER BY p.${safeSortBy} ${safeSortOrder}`;

        const [rows] = await pool.execute(query, params);
        return rows;
    }

    /**
     * Find all payments for a customer with optional filters
     * @param {number} customerID - Customer user ID
     * @param {Object} [filters={}] - Optional filters
     * @param {string} [filters.status] - Filter by payment status
     * @param {Date} [filters.startDate] - Filter by start date
     * @param {Date} [filters.endDate] - Filter by end date
     * @param {string} [filters.sortBy='createdAt'] - Sort field
     * @param {string} [filters.sortOrder='DESC'] - Sort order
     * @returns {Promise<Array>} - Array of payment records
     */
    static async findByCustomer(customerID, filters = {}) {
        const { status, startDate, endDate, sortBy = 'createdAt', sortOrder = 'DESC' } = filters;
        
        let query = `
            SELECT 
                p.*,
                sr.providerID,
                sr.category,
                sr.description,
                sr.status as requestStatus,
                sr.serviceDate,
                pr.name as providerName,
                pr.email as providerEmail,
                pr.phone as providerPhone
            FROM Payment p
            INNER JOIN ServiceRequest sr ON p.requestID = sr.requestID
            LEFT JOIN USER pr ON sr.providerID = pr.userID
            WHERE sr.customerID = ?
        `;
        const params = [customerID];

        if (status) {
            query += ' AND p.status = ?';
            params.push(status);
        }

        if (startDate) {
            query += ' AND p.createdAt >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND p.createdAt <= ?';
            params.push(endDate);
        }

        // Validate sortBy to prevent SQL injection
        const allowedSortFields = ['createdAt', 'amount', 'status', 'dueDate', 'paymentDate'];
        const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        query += ` ORDER BY p.${safeSortBy} ${safeSortOrder}`;

        const [rows] = await pool.execute(query, params);
        return rows;
    }


    /**
     * Update a payment record
     * @param {number} paymentID - Payment ID
     * @param {Object} updateData - Fields to update
     * @param {number} [updateData.amount] - New amount
     * @param {string} [updateData.status] - New status
     * @param {Date} [updateData.dueDate] - New due date
     * @param {Date} [updateData.paymentDate] - Payment date
     * @param {string} [updateData.paymentMethod] - Payment method
     * @param {string} [updateData.transactionID] - Transaction ID
     * @returns {Promise<Object|undefined>} - Updated payment record
     */
    static async update(paymentID, updateData) {
        const { amount, status, dueDate, paymentDate, paymentMethod, transactionID } = updateData;
        
        const updates = [];
        const params = [];

        if (amount !== undefined) {
            updates.push('amount = ?');
            params.push(amount);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }
        if (dueDate !== undefined) {
            updates.push('dueDate = ?');
            params.push(dueDate);
        }
        if (paymentDate !== undefined) {
            updates.push('paymentDate = ?');
            params.push(paymentDate);
        }
        if (paymentMethod !== undefined) {
            updates.push('paymentMethod = ?');
            params.push(paymentMethod);
        }
        if (transactionID !== undefined) {
            updates.push('transactionID = ?');
            params.push(transactionID);
        }

        if (updates.length === 0) {
            return await this.findById(paymentID);
        }

        params.push(paymentID);
        const query = `UPDATE Payment SET ${updates.join(', ')} WHERE paymentID = ?`;
        await pool.execute(query, params);
        return await this.findById(paymentID);
    }

    /**
     * Update payment status
     * @param {number} paymentID - Payment ID
     * @param {string} newStatus - New status ('Pending', 'Paid', 'Overdue')
     * @returns {Promise<Object|undefined>} - Updated payment record
     */
    static async updateStatus(paymentID, newStatus) {
        const query = 'UPDATE Payment SET status = ? WHERE paymentID = ?';
        await pool.execute(query, [newStatus, paymentID]);
        return await this.findById(paymentID);
    }

    /**
     * Find payment by request ID
     * @param {number} requestID - Service request ID
     * @returns {Promise<Object|undefined>} - Payment record
     */
    static async findByRequestId(requestID) {
        const query = `
            SELECT 
                p.*,
                sr.customerID,
                sr.providerID,
                sr.category,
                sr.description,
                sr.status as requestStatus,
                sr.serviceDate,
                c.name as customerName,
                c.email as customerEmail,
                pr.name as providerName,
                pr.email as providerEmail
            FROM Payment p
            INNER JOIN ServiceRequest sr ON p.requestID = sr.requestID
            INNER JOIN USER c ON sr.customerID = c.userID
            LEFT JOIN USER pr ON sr.providerID = pr.userID
            WHERE p.requestID = ?
        `;
        const [rows] = await pool.execute(query, [requestID]);
        return rows[0];
    }

    /**
     * Find all overdue payments (Pending payments past due date)
     * @param {number} [providerID] - Optional provider ID to filter
     * @returns {Promise<Array>} - Array of overdue payment records
     */
    static async findOverdue(providerID = null) {
        let query = `
            SELECT 
                p.*,
                sr.customerID,
                sr.providerID,
                sr.category,
                sr.description,
                c.name as customerName,
                pr.name as providerName
            FROM Payment p
            INNER JOIN ServiceRequest sr ON p.requestID = sr.requestID
            INNER JOIN USER c ON sr.customerID = c.userID
            LEFT JOIN USER pr ON sr.providerID = pr.userID
            WHERE p.status = 'Pending' AND p.dueDate < CURDATE()
        `;
        const params = [];

        if (providerID) {
            query += ' AND sr.providerID = ?';
            params.push(providerID);
        }

        query += ' ORDER BY p.dueDate ASC';

        const [rows] = await pool.execute(query, params);
        return rows;
    }

    /**
     * Update multiple payments to Overdue status
     * @param {Array<number>} paymentIDs - Array of payment IDs to update
     * @returns {Promise<number>} - Number of updated records
     */
    static async markAsOverdue(paymentIDs) {
        if (!paymentIDs || paymentIDs.length === 0) {
            return 0;
        }

        const placeholders = paymentIDs.map(() => '?').join(', ');
        const query = `UPDATE Payment SET status = 'Overdue' WHERE paymentID IN (${placeholders}) AND status = 'Pending'`;
        const [result] = await pool.execute(query, paymentIDs);
        return result.affectedRows;
    }

    /**
     * Delete a payment record
     * @param {number} paymentID - Payment ID
     * @returns {Promise<boolean>} - True if deleted
     */
    static async delete(paymentID) {
        const query = 'DELETE FROM Payment WHERE paymentID = ?';
        const [result] = await pool.execute(query, [paymentID]);
        return result.affectedRows > 0;
    }

    /**
     * Get payment summary statistics for a provider
     * @param {number} providerID - Provider user ID
     * @param {Object} [dateRange={}] - Optional date range
     * @param {Date} [dateRange.startDate] - Start date
     * @param {Date} [dateRange.endDate] - End date
     * @returns {Promise<Object>} - Summary statistics
     */
    static async getSummary(providerID, dateRange = {}) {
        const { startDate, endDate } = dateRange;
        
        let query = `
            SELECT 
                p.status,
                COUNT(*) as count,
                COALESCE(SUM(p.amount), 0) as totalAmount
            FROM Payment p
            INNER JOIN ServiceRequest sr ON p.requestID = sr.requestID
            WHERE sr.providerID = ?
        `;
        const params = [providerID];

        if (startDate) {
            query += ' AND p.createdAt >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND p.createdAt <= ?';
            params.push(endDate);
        }

        query += ' GROUP BY p.status';

        const [rows] = await pool.execute(query, params);
        
        // Initialize summary with default values
        const summary = {
            pending: { count: 0, amount: 0 },
            paid: { count: 0, amount: 0 },
            overdue: { count: 0, amount: 0 },
            totalOutstanding: 0,
            collectionRate: 0,
            dateRange: { start: startDate || null, end: endDate || null }
        };

        // Populate from query results
        let totalCount = 0;
        rows.forEach(row => {
            const statusKey = row.status.toLowerCase();
            if (summary[statusKey]) {
                summary[statusKey].count = row.count;
                summary[statusKey].amount = parseFloat(row.totalAmount);
            }
            totalCount += row.count;
        });

        // Calculate derived values
        summary.totalOutstanding = summary.pending.amount + summary.overdue.amount;
        summary.collectionRate = totalCount > 0 
            ? (summary.paid.count / totalCount) * 100 
            : 0;

        return summary;
    }
    /**
     * Migrate legacy 'Completed' status to proper payment statuses
     * @returns {Promise<Object>} - Migration results
     */
    static async migrateCompletedStatus() {
        const results = {
            toOverdue: 0,
            toPaid: 0,
            toPending: 0
        };

        // Update 'Completed' payments that are past due date to 'Overdue'
        const [overdueResult] = await pool.execute(`
            UPDATE Payment 
            SET status = 'Overdue' 
            WHERE status = 'Completed' 
              AND dueDate < CURDATE()
              AND paymentDate IS NULL
        `);
        results.toOverdue = overdueResult.affectedRows;

        // Update 'Completed' payments that have been paid to 'Paid'
        const [paidResult] = await pool.execute(`
            UPDATE Payment 
            SET status = 'Paid' 
            WHERE status = 'Completed' 
              AND paymentDate IS NOT NULL
        `);
        results.toPaid = paidResult.affectedRows;

        // Update remaining 'Completed' to 'Pending'
        const [pendingResult] = await pool.execute(`
            UPDATE Payment 
            SET status = 'Pending' 
            WHERE status = 'Completed'
        `);
        results.toPending = pendingResult.affectedRows;

        return results;
    }
}

module.exports = Payment;
