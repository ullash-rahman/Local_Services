const pool = require('../config/database');

class JobHistory {
    // Create a new job history entry
    static async create(jobData) {
        const { requestID, providerID, customerID, status, completionDate } = jobData;
        const query = `
            INSERT INTO JobHistory (requestID, providerID, customerID, status, completionDate)
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await pool.execute(query, [
            requestID,
            providerID,
            customerID,
            status,
            completionDate || null
        ]);
        return result.insertId;
    }

    // Get job history by ID
    static async findById(jobID) {
        const query = `
            SELECT 
                jh.*,
                sr.category,
                sr.description,
                c.name as customerName,
                c.email as customerEmail,
                c.phone as customerPhone,
                p.name as providerName,
                p.email as providerEmail,
                p.phone as providerPhone
            FROM JobHistory jh
            INNER JOIN ServiceRequest sr ON jh.requestID = sr.requestID
            INNER JOIN USER c ON jh.customerID = c.userID
            INNER JOIN USER p ON jh.providerID = p.userID
            WHERE jh.jobID = ?
        `;
        const [rows] = await pool.execute(query, [jobID]);
        return rows[0];
    }

    // Get all job history by customer
    static async getByCustomer(customerID, status = null) {
        let query = `
            SELECT 
                jh.*,
                sr.category,
                sr.description,
                p.name as providerName,
                p.email as providerEmail,
                p.phone as providerPhone
            FROM JobHistory jh
            INNER JOIN ServiceRequest sr ON jh.requestID = sr.requestID
            INNER JOIN USER p ON jh.providerID = p.userID
            WHERE jh.customerID = ?
        `;
        const params = [customerID];
        
        if (status) {
            query += ' AND jh.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY jh.completionDate DESC, jh.createdAt DESC';
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // Get all job history by provider
    static async getByProvider(providerID, status = null) {
        let query = `
            SELECT 
                jh.*,
                sr.category,
                sr.description,
                c.name as customerName,
                c.email as customerEmail,
                c.phone as customerPhone
            FROM JobHistory jh
            INNER JOIN ServiceRequest sr ON jh.requestID = sr.requestID
            INNER JOIN USER c ON jh.customerID = c.userID
            WHERE jh.providerID = ?
        `;
        const params = [providerID];
        
        if (status) {
            query += ' AND jh.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY jh.completionDate DESC, jh.createdAt DESC';
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // Get job history by requestID
    static async getByRequestID(requestID) {
        const query = `
            SELECT 
                jh.*,
                sr.category,
                sr.description,
                c.name as customerName,
                p.name as providerName
            FROM JobHistory jh
            INNER JOIN ServiceRequest sr ON jh.requestID = sr.requestID
            INNER JOIN USER c ON jh.customerID = c.userID
            INNER JOIN USER p ON jh.providerID = p.userID
            WHERE jh.requestID = ?
            ORDER BY jh.createdAt DESC
        `;
        const [rows] = await pool.execute(query, [requestID]);
        return rows;
    }

    // Get job history statistics for a customer
    static async getCustomerStats(customerID) {
        const query = `
            SELECT 
                COUNT(*) as totalJobs,
                COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completedJobs,
                COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancelledJobs
            FROM JobHistory
            WHERE customerID = ?
        `;
        const [rows] = await pool.execute(query, [customerID]);
        return rows[0];
    }

    // Get job history statistics for a provider
    static async getProviderStats(providerID) {
        const query = `
            SELECT 
                COUNT(*) as totalJobs,
                COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completedJobs,
                COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancelledJobs
            FROM JobHistory
            WHERE providerID = ?
        `;
        const [rows] = await pool.execute(query, [providerID]);
        return rows[0];
    }
}

module.exports = JobHistory;

