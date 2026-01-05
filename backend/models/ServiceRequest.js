const pool = require('../config/database');

class ServiceRequest {
    // Create a new service request
    static async create(requestData) {
        const { customerID, category, description, serviceDate, priorityLevel } = requestData;
        
        // Use the priorityLevel as-is (already normalized in controller)
        // Only default to 'Normal' if it's truly missing
        const finalPriority = priorityLevel || 'Normal';
        
        console.log('ServiceRequest.create - Model level:', {
            receivedPriorityLevel: priorityLevel,
            finalPriority: finalPriority,
            requestDataKeys: Object.keys(requestData)
        });
        
        const query = `
            INSERT INTO ServiceRequest (customerID, category, description, serviceDate, status, priorityLevel)
            VALUES (?, ?, ?, ?, 'Pending', ?)
        `;
        const [result] = await pool.execute(query, [customerID, category, description, serviceDate || null, finalPriority]);
        
        console.log('ServiceRequest.create - SQL executed. Inserted RequestID:', result.insertId, 'with priorityLevel:', finalPriority);
        
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
                p.phone as providerPhone,
                pay.paymentID,
                pay.amount as paymentAmount,
                pay.status as paymentStatus,
                NULL as paymentDueDate,
                pay.paymentDate,
                pay.paymentMethod
            FROM ServiceRequest sr
            LEFT JOIN USER c ON sr.customerID = c.userID
            LEFT JOIN USER p ON sr.providerID = p.userID
            LEFT JOIN Payment pay ON sr.requestID = pay.requestID
            WHERE sr.requestID = ?
        `;
        const [rows] = await pool.execute(query, [requestID]);
        return rows[0];
    }

    // Get all service requests by customer
    static async getByCustomer(customerID, status = null, category = null) {
        let query = `
            SELECT 
                sr.requestID,
                sr.customerID,
                sr.providerID,
                sr.category,
                sr.description,
                sr.requestDate,
                sr.serviceDate,
                sr.status,
                COALESCE(sr.priorityLevel, 'Normal') as priorityLevel,
                sr.completionConfirmed,
                sr.cancellationReason,
                sr.createdAt,
                sr.updatedAt,
                p.name as providerName,
                p.email as providerEmail,
                CASE WHEN r.reviewID IS NOT NULL THEN 1 ELSE 0 END as hasReview,
                pay.paymentID,
                pay.amount as paymentAmount,
                pay.status as paymentStatus,
                NULL as paymentDueDate,
                pay.paymentDate,
                pay.paymentMethod
            FROM ServiceRequest sr
            LEFT JOIN USER p ON sr.providerID = p.userID
            LEFT JOIN Review r ON sr.requestID = r.requestID
            LEFT JOIN Payment pay ON sr.requestID = pay.requestID
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
        
        const [rows] = await pool.execute(query, params);
        console.log('getByCustomer - Rows returned:', rows.length);
        if (rows.length > 0) {
            console.log('getByCustomer - Sample priorityLevels:', rows.slice(0, 3).map(r => ({ 
                id: r.requestID, 
                status: r.status, 
                priority: r.priorityLevel,
                priorityType: typeof r.priorityLevel 
            })));
        }
        return rows;
    }

    // Get all service requests by provider
    static async getByProvider(providerID, status = null, category = null) {
        let query = `
            SELECT 
                sr.requestID,
                sr.customerID,
                sr.providerID,
                sr.category,
                sr.description,
                sr.requestDate,
                sr.serviceDate,
                sr.status,
                COALESCE(sr.priorityLevel, 'Normal') as priorityLevel,
                sr.completionConfirmed,
                sr.cancellationReason,
                sr.createdAt,
                sr.updatedAt,
                c.name as customerName,
                c.email as customerEmail,
                c.phone as customerPhone,
                pay.paymentID,
                pay.amount as paymentAmount,
                pay.status as paymentStatus,
                NULL as paymentDueDate,
                pay.paymentDate,
                pay.paymentMethod
            FROM ServiceRequest sr
            LEFT JOIN USER c ON sr.customerID = c.userID
            LEFT JOIN Payment pay ON sr.requestID = pay.requestID
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
        console.log('getByProvider - Rows returned:', rows.length);
        if (rows.length > 0) {
            console.log('getByProvider - Sample priorityLevels:', rows.slice(0, 3).map(r => ({ 
                id: r.requestID, 
                category: r.category,
                status: r.status, 
                priority: r.priorityLevel,
                priorityType: typeof r.priorityLevel,
                rawPriority: r.priorityLevel
            })));
            // Log full first row to see all fields
            console.log('getByProvider - First row keys:', Object.keys(rows[0]));
            console.log('getByProvider - First row priorityLevel:', rows[0].priorityLevel);
        }
        return rows;
    }

    // Get all pending service requests (for providers to see available requests)
    static async getPendingRequests(category = null) {
        let query = `
            SELECT 
                sr.requestID,
                sr.customerID,
                sr.providerID,
                sr.category,
                sr.description,
                sr.requestDate,
                sr.serviceDate,
                sr.status,
                COALESCE(sr.priorityLevel, 'Normal') as priorityLevel,
                sr.completionConfirmed,
                sr.cancellationReason,
                sr.createdAt,
                sr.updatedAt,
                c.name as customerName,
                c.email as customerEmail,
                c.phone as customerPhone,
                pay.paymentID,
                pay.amount as paymentAmount,
                pay.status as paymentStatus,
                NULL as paymentDueDate,
                pay.paymentDate,
                pay.paymentMethod
            FROM ServiceRequest sr
            LEFT JOIN USER c ON sr.customerID = c.userID
            LEFT JOIN Payment pay ON sr.requestID = pay.requestID
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
        console.log('getPendingRequests - Rows returned:', rows.length);
        if (rows.length > 0) {
            console.log('getPendingRequests - Sample priorityLevels:', rows.slice(0, 3).map(r => ({ 
                id: r.requestID, 
                priority: r.priorityLevel 
            })));
        }
        return rows;
    }

    // Get all requests for provider: unaccepted (pending) + accepted by this provider
    static async getProviderRequests(providerID, status = null, category = null) {
        let baseCondition;
        const params = [];
        
        // Handle status filter
        if (status) {
            if (status === 'Pending') {
                // Only show unaccepted pending requests
                baseCondition = `sr.status = 'Pending' AND sr.providerID IS NULL`;
                // No params needed for this condition
            } else {
                // Only show provider's requests with this specific status
                baseCondition = `sr.providerID = ? AND sr.status = ?`;
                params.push(providerID);
                params.push(status);
            }
        } else {
            // No status filter: show both unaccepted pending and provider's accepted requests
            baseCondition = `(sr.status = 'Pending' AND sr.providerID IS NULL) OR (sr.providerID = ?)`;
            params.push(providerID);
        }
        
        // Handle category filter - apply to both parts of OR condition
        let whereClause = baseCondition;
        if (category) {
            const normalizedCategory = category.trim().toLowerCase();
            // Wrap base condition in parentheses and apply category filter
            whereClause = `(${baseCondition}) AND LOWER(TRIM(sr.category)) = ?`;
            params.push(normalizedCategory);
        }
        
        // Build final query
        const query = `
            SELECT 
                sr.requestID,
                sr.customerID,
                sr.providerID,
                sr.category,
                sr.description,
                sr.requestDate,
                sr.serviceDate,
                sr.status,
                COALESCE(sr.priorityLevel, 'Normal') as priorityLevel,
                sr.completionConfirmed,
                sr.cancellationReason,
                sr.createdAt,
                sr.updatedAt,
                c.name as customerName,
                c.email as customerEmail,
                c.phone as customerPhone,
                pay.paymentID,
                pay.amount as paymentAmount,
                pay.status as paymentStatus,
                NULL as paymentDueDate,
                pay.paymentDate,
                pay.paymentMethod
            FROM ServiceRequest sr
            LEFT JOIN USER c ON sr.customerID = c.userID
            LEFT JOIN Payment pay ON sr.requestID = pay.requestID
            WHERE ${whereClause}
            ORDER BY 
                CASE COALESCE(sr.priorityLevel, 'Normal')
                    WHEN 'Emergency' THEN 1
                    WHEN 'High' THEN 2
                    WHEN 'Normal' THEN 3
                    ELSE 4
                END,
                sr.createdAt DESC
        `;
        
        const [rows] = await pool.execute(query, params);
        console.log('getProviderRequests - Query:', query);
        console.log('getProviderRequests - Params:', params);
        console.log('getProviderRequests - Rows returned:', rows.length);
        if (rows.length > 0) {
            console.log('getProviderRequests - Sample:', rows.slice(0, 3).map(r => ({ 
                id: r.requestID, 
                category: r.category,
                status: r.status,
                providerID: r.providerID,
                priority: r.priorityLevel
            })));
        }
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

    // Update service request status
    static async updateStatus(requestID, status) {
        const query = `UPDATE ServiceRequest SET status = ? WHERE requestID = ?`;
        const [result] = await pool.execute(query, [status, requestID]);
        return result.affectedRows > 0;
    }

    // Cancel service request (Customer only) - with cancellation reason
    static async cancelRequest(requestID, customerID, cancellationReason) {
        const query = `
            UPDATE ServiceRequest 
            SET status = 'Cancelled', cancellationReason = ?
            WHERE requestID = ? AND customerID = ? AND status NOT IN ('Completed', 'Cancelled')
        `;
        const [result] = await pool.execute(query, [cancellationReason, requestID, customerID]);
        return result.affectedRows > 0;
    }

    // Start service (Provider only) - Change status from Accepted to Ongoing
    static async startService(requestID, providerID) {
        const query = `
            UPDATE ServiceRequest 
            SET status = 'Ongoing'
            WHERE requestID = ? AND providerID = ? AND status = 'Accepted'
        `;
        const [result] = await pool.execute(query, [requestID, providerID]);
        return result.affectedRows > 0;
    }

    // Mark service as completed by provider
    static async markAsCompleted(requestID, providerID) {
        const query = `
            UPDATE ServiceRequest 
            SET status = 'Completed'
            WHERE requestID = ? AND providerID = ? AND status IN ('Accepted', 'Ongoing')
        `;
        const [result] = await pool.execute(query, [requestID, providerID]);
        return result.affectedRows > 0;
    }

    // Confirm service completion (Customer only)
    static async confirmCompletion(requestID, customerID) {
        const query = `
            UPDATE ServiceRequest 
            SET completionConfirmed = TRUE
            WHERE requestID = ? AND customerID = ? AND status = 'Completed'
        `;
        const [result] = await pool.execute(query, [requestID, customerID]);
        return result.affectedRows > 0;
    }
}

module.exports = ServiceRequest;

