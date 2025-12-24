const pool = require('../config/database');

class Complaint {
    // Create a new complaint
    static async create(complaintData) {
        const { reporterID, providerID, requestID, description } = complaintData;
        const query = `
            INSERT INTO Complaint (reporterID, providerID, requestID, description, status)
            VALUES (?, ?, ?, ?, 'Pending')
        `;
        const [result] = await pool.execute(query, [reporterID, providerID, requestID, description]);
        return result.insertId;
    }

    // Get complaint by ID
    static async findById(complaintID) {
        const query = `
            SELECT 
                c.complaintID,
                c.reporterID,
                c.providerID,
                c.requestID,
                c.description,
                c.status,
                c.createdAt,
                c.resolvedAt,
                c.resolutionNotes,
                reporter.name as reporterName,
                reporter.role as reporterRole,
                provider.name as providerName,
                sr.customerID,
                customer.name as customerName,
                sr.category as serviceCategory,
                sr.description as serviceDescription
            FROM Complaint c
            INNER JOIN USER reporter ON c.reporterID = reporter.userID
            INNER JOIN USER provider ON c.providerID = provider.userID
            LEFT JOIN ServiceRequest sr ON c.requestID = sr.requestID
            LEFT JOIN USER customer ON sr.customerID = customer.userID
            WHERE c.complaintID = ?
        `;
        const [rows] = await pool.execute(query, [complaintID]);
        return rows[0];
    }

    // Get all complaints by reporter (user who filed the complaint)
    static async getByReporter(reporterID) {
        const query = `
            SELECT 
                c.complaintID,
                c.reporterID,
                c.providerID,
                c.requestID,
                c.description,
                c.status,
                c.createdAt,
                c.resolvedAt,
                c.resolutionNotes,
                provider.name as providerName,
                customer.name as customerName,
                sr.customerID,
                sr.category as serviceCategory,
                CASE 
                    WHEN c.reporterID = sr.customerID THEN provider.name
                    ELSE customer.name
                END as accusedPartyName
            FROM Complaint c
            INNER JOIN ServiceRequest sr ON c.requestID = sr.requestID
            INNER JOIN USER provider ON c.providerID = provider.userID
            LEFT JOIN USER customer ON sr.customerID = customer.userID
            WHERE c.reporterID = ?
            ORDER BY c.createdAt DESC
        `;
        const [rows] = await pool.execute(query, [reporterID]);
        return rows;
    }

    // Get all complaints against a user (provider or customer)
    // Complaints against provider: providerID = userID AND reporterID != userID (reporter is customer)
    // Complaints against customer: customerID = userID AND reporterID != userID (reporter is provider)
    static async getAgainstUser(userID) {
        const query = `
            SELECT 
                c.complaintID,
                c.reporterID,
                c.providerID,
                c.requestID,
                c.description,
                c.status,
                c.createdAt,
                c.resolvedAt,
                c.resolutionNotes,
                reporter.name as reporterName,
                reporter.role as reporterRole,
                sr.customerID,
                customer.name as customerName,
                provider.name as providerName,
                sr.category as serviceCategory
            FROM Complaint c
            INNER JOIN ServiceRequest sr ON c.requestID = sr.requestID
            INNER JOIN USER reporter ON c.reporterID = reporter.userID
            INNER JOIN USER provider ON c.providerID = provider.userID
            LEFT JOIN USER customer ON sr.customerID = customer.userID
            WHERE ((c.providerID = ? AND c.reporterID != ?) OR (sr.customerID = ? AND c.reporterID != ?))
            ORDER BY c.createdAt DESC
        `;
        const [rows] = await pool.execute(query, [userID, userID, userID, userID]);
        return rows;
    }

    // Get all complaints for a specific service request
    static async getByRequest(requestID) {
        const query = `
            SELECT 
                c.complaintID,
                c.reporterID,
                c.providerID,
                c.requestID,
                c.description,
                c.status,
                c.createdAt,
                c.resolvedAt,
                c.resolutionNotes,
                reporter.name as reporterName,
                reporter.role as reporterRole,
                provider.name as providerName,
                sr.customerID,
                customer.name as customerName
            FROM Complaint c
            INNER JOIN USER reporter ON c.reporterID = reporter.userID
            INNER JOIN USER provider ON c.providerID = provider.userID
            LEFT JOIN ServiceRequest sr ON c.requestID = sr.requestID
            LEFT JOIN USER customer ON sr.customerID = customer.userID
            WHERE c.requestID = ?
            ORDER BY c.createdAt DESC
        `;
        const [rows] = await pool.execute(query, [requestID]);
        return rows;
    }

    // Get all complaints (for admin)
    static async getAll(status = null) {
        let query = `
            SELECT 
                c.complaintID,
                c.reporterID,
                c.providerID,
                c.requestID,
                c.description,
                c.status,
                c.createdAt,
                c.resolvedAt,
                c.resolutionNotes,
                reporter.name as reporterName,
                reporter.role as reporterRole,
                provider.name as providerName,
                sr.customerID,
                customer.name as customerName,
                sr.category as serviceCategory
            FROM Complaint c
            INNER JOIN USER reporter ON c.reporterID = reporter.userID
            INNER JOIN USER provider ON c.providerID = provider.userID
            LEFT JOIN ServiceRequest sr ON c.requestID = sr.requestID
            LEFT JOIN USER customer ON sr.customerID = customer.userID
        `;
        const params = [];
        
        if (status) {
            query += ' WHERE c.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY c.createdAt DESC';
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // Update complaint status (for resolution)
    static async updateStatus(complaintID, status, resolutionNotes = null) {
        const updates = ['status = ?'];
        const params = [status];
        
        if (status === 'Resolved' && resolutionNotes) {
            updates.push('resolvedAt = NOW()', 'resolutionNotes = ?');
            params.push(resolutionNotes);
        } else if (status !== 'Resolved') {
            updates.push('resolvedAt = NULL', 'resolutionNotes = NULL');
        }
        
        params.push(complaintID);
        
        const query = `
            UPDATE Complaint 
            SET ${updates.join(', ')}
            WHERE complaintID = ?
        `;
        
        await pool.execute(query, params);
        return await this.findById(complaintID);
    }

    // Check if user is involved in a service request (for validation)
    static async validateServiceInvolvement(requestID, userID) {
        const query = `
            SELECT 
                requestID,
                customerID,
                providerID
            FROM ServiceRequest
            WHERE requestID = ? AND (customerID = ? OR providerID = ?)
        `;
        const [rows] = await pool.execute(query, [requestID, userID, userID]);
        return rows.length > 0 ? rows[0] : null;
    }

    // Check if complaint already exists for a request from this reporter
    static async checkExistingComplaint(requestID, reporterID) {
        const query = `
            SELECT complaintID
            FROM Complaint
            WHERE requestID = ? AND reporterID = ?
        `;
        const [rows] = await pool.execute(query, [requestID, reporterID]);
        return rows.length > 0;
    }
}

module.exports = Complaint;

