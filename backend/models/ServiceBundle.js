const pool = require('../config/database');

class ServiceBundle {
    // Create a new service bundle
    static async create(bundleData) {
        const { providerID, bundleName, description, servicesIncluded, price, validTill } = bundleData;
        const query = `
            INSERT INTO ServiceBundle (providerID, bundleName, description, servicesIncluded, price, validTill, isActive)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        // Ensure servicesIncluded is an array and convert to JSON
        let servicesJSON;
        try {
            if (Array.isArray(servicesIncluded)) {
                // Already an array, stringify it
                servicesJSON = JSON.stringify(servicesIncluded);
            } else if (typeof servicesIncluded === 'string') {
                // If it's a string, try different parsing strategies
                // First, try to parse as JSON
                try {
                    const parsed = JSON.parse(servicesIncluded);
                    servicesJSON = JSON.stringify(Array.isArray(parsed) ? parsed : [parsed]);
                } catch (parseError) {
                    // If JSON parsing fails, check if it's comma-separated
                    if (servicesIncluded.includes(',')) {
                        // Split by comma and trim each item
                        const items = servicesIncluded.split(',').map(s => s.trim()).filter(s => s.length > 0);
                        servicesJSON = JSON.stringify(items);
                    } else {
                        // Single string, create array with one item
                        servicesJSON = JSON.stringify([servicesIncluded.trim()]);
                    }
                }
            } else if (servicesIncluded) {
                // If it's something else (object, number, etc.), wrap in array
                servicesJSON = JSON.stringify([servicesIncluded]);
            } else {
                // Null or undefined, use empty array
                servicesJSON = JSON.stringify([]);
            }
        } catch (err) {
            console.error('Error stringifying servicesIncluded:', err);
            console.error('servicesIncluded value:', servicesIncluded);
            console.error('servicesIncluded type:', typeof servicesIncluded);
            servicesJSON = JSON.stringify([]);
        }
        
        // Ensure price is a number
        const priceValue = typeof price === 'string' ? parseFloat(price) : price;
        
        // Ensure validTill is in correct format (YYYY-MM-DD) or null
        let validTillValue = null;
        if (validTill) {
            // If it's already in YYYY-MM-DD format, use it; otherwise try to parse
            if (typeof validTill === 'string' && validTill.match(/^\d{4}-\d{2}-\d{2}$/)) {
                validTillValue = validTill;
            } else {
                try {
                    const date = new Date(validTill);
                    if (!isNaN(date.getTime())) {
                        validTillValue = date.toISOString().split('T')[0];
                    }
                } catch (err) {
                    console.error('Error parsing validTill date:', err);
                }
            }
        }
        
        // Log what we're about to store
        console.log('Storing servicesJSON:', servicesJSON);
        console.log('servicesJSON type:', typeof servicesJSON);
        
        const [result] = await pool.execute(query, [
            providerID,
            bundleName,
            description || null,
            servicesJSON,
            priceValue,
            validTillValue,
            true
        ]);
        
        // Verify what was stored by reading it back immediately
        const verifyQuery = 'SELECT servicesIncluded FROM ServiceBundle WHERE bundleID = ?';
        const [verifyRows] = await pool.execute(verifyQuery, [result.insertId]);
        if (verifyRows[0]) {
            console.log('Verified stored servicesIncluded:', verifyRows[0].servicesIncluded);
            console.log('Stored type:', typeof verifyRows[0].servicesIncluded);
        }
        
        return result.insertId;
    }

    // Get bundle by ID
    static async findById(bundleID) {
        const query = `
            SELECT 
                sb.*,
                u.name as providerName,
                u.email as providerEmail
            FROM ServiceBundle sb
            LEFT JOIN USER u ON sb.providerID = u.userID
            WHERE sb.bundleID = ?
        `;
        const [rows] = await pool.execute(query, [bundleID]);
        if (rows[0]) {
            // Safely parse JSON field
            if (rows[0].servicesIncluded !== null && rows[0].servicesIncluded !== undefined) {
                try {
                    let parsed;
                    const rawValue = rows[0].servicesIncluded;
                    
                    if (typeof rawValue === 'string') {
                        // Try to parse as JSON
                        const trimmed = rawValue.trim();
                        
                        // Check if it looks like valid JSON (starts with [ or {)
                        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                            try {
                                parsed = JSON.parse(trimmed);
                            } catch (parseErr) {
                                console.warn('Failed to parse JSON in findById, raw value:', trimmed);
                                console.warn('Error:', parseErr.message);
                                // If it's not valid JSON, treat as single value
                                parsed = trimmed.length > 0 ? [trimmed] : [];
                            }
                        } else {
                            // Doesn't look like JSON, treat as single value
                            console.warn('Value does not look like JSON, treating as single value:', trimmed);
                            parsed = trimmed.length > 0 ? [trimmed] : [];
                        }
                    } else if (Array.isArray(rawValue)) {
                        // Already an array (MySQL JSON type sometimes returns as array)
                        parsed = rawValue;
                    } else if (typeof rawValue === 'object' && rawValue !== null) {
                        // Object, try to convert to array
                        parsed = Object.values(rawValue);
                    } else {
                        // Other type, wrap in array
                        parsed = [String(rawValue)];
                    }
                    
                    // Ensure it's an array
                    if (Array.isArray(parsed)) {
                        rows[0].servicesIncluded = parsed.filter(item => item && String(item).trim().length > 0);
                    } else {
                        rows[0].servicesIncluded = [];
                    }
                } catch (err) {
                    console.error('Error parsing servicesIncluded in findById:', err);
                    console.error('Raw servicesIncluded value:', rows[0].servicesIncluded);
                    console.error('Type:', typeof rows[0].servicesIncluded);
                    rows[0].servicesIncluded = [];
                }
            } else {
                rows[0].servicesIncluded = [];
            }
        }
        return rows[0];
    }

    // Get all bundles by provider
    static async getByProvider(providerID, includeInactive = false) {
        let query = `
            SELECT 
                sb.*,
                u.name as providerName
            FROM ServiceBundle sb
            LEFT JOIN USER u ON sb.providerID = u.userID
            WHERE sb.providerID = ?
        `;
        const params = [providerID];
        
        if (!includeInactive) {
            query += ' AND sb.isActive = TRUE';
        }
        
        query += ' ORDER BY sb.createdAt DESC';
        
        const [rows] = await pool.execute(query, params);
        return rows.map(row => {
            // Safely parse JSON field
            if (row.servicesIncluded) {
                try {
                    // If it's already a string, parse it
                    if (typeof row.servicesIncluded === 'string') {
                        row.servicesIncluded = JSON.parse(row.servicesIncluded);
                    }
                    // If it's already an object/array (MySQL JSON type returns as object), use it as is
                    // Otherwise ensure it's an array
                    if (!Array.isArray(row.servicesIncluded)) {
                        row.servicesIncluded = [];
                    }
                } catch (err) {
                    console.error('Error parsing servicesIncluded for bundle', row.bundleID, ':', err);
                    console.error('servicesIncluded value:', row.servicesIncluded);
                    row.servicesIncluded = [];
                }
            } else {
                row.servicesIncluded = [];
            }
            return row;
        });
    }

    // Get all active bundles (for customers to browse)
    static async getAllActive(category = null) {
        let query = `
            SELECT 
                sb.*,
                u.name as providerName,
                u.email as providerEmail,
                u.phone as providerPhone
            FROM ServiceBundle sb
            LEFT JOIN USER u ON sb.providerID = u.userID
            WHERE sb.isActive = TRUE
            AND (sb.validTill IS NULL OR sb.validTill >= CURDATE())
        `;
        const params = [];
        
        // If category filter is provided, check if any service in bundle matches
        if (category) {
            query += ` AND JSON_SEARCH(sb.servicesIncluded, 'one', ?) IS NOT NULL`;
            params.push(category);
        }
        
        query += ' ORDER BY sb.createdAt DESC';
        
        const [rows] = await pool.execute(query, params);
        return rows.map(row => {
            // Safely parse JSON field
            if (row.servicesIncluded) {
                try {
                    if (typeof row.servicesIncluded === 'string') {
                        row.servicesIncluded = JSON.parse(row.servicesIncluded);
                    }
                    if (!Array.isArray(row.servicesIncluded)) {
                        row.servicesIncluded = [];
                    }
                } catch (err) {
                    console.error('Error parsing servicesIncluded:', err);
                    row.servicesIncluded = [];
                }
            } else {
                row.servicesIncluded = [];
            }
            return row;
        });
    }

    // Update bundle
    static async update(bundleID, providerID, updateData) {
        const { bundleName, description, servicesIncluded, price, validTill, isActive } = updateData;
        
        // Build dynamic update query
        const updates = [];
        const params = [];
        
        if (bundleName !== undefined) {
            updates.push('bundleName = ?');
            params.push(bundleName);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (servicesIncluded !== undefined) {
            updates.push('servicesIncluded = ?');
            params.push(JSON.stringify(servicesIncluded));
        }
        if (price !== undefined) {
            updates.push('price = ?');
            params.push(price);
        }
        if (validTill !== undefined) {
            updates.push('validTill = ?');
            params.push(validTill);
        }
        if (isActive !== undefined) {
            updates.push('isActive = ?');
            params.push(isActive);
        }
        
        if (updates.length === 0) {
            return await this.findById(bundleID);
        }
        
        params.push(bundleID, providerID);
        
        const query = `
            UPDATE ServiceBundle 
            SET ${updates.join(', ')}
            WHERE bundleID = ? AND providerID = ?
        `;
        
        await pool.execute(query, params);
        return await this.findById(bundleID);
    }

    // Delete bundle (soft delete by setting isActive to false)
    static async remove(bundleID, providerID) {
        const query = `
            UPDATE ServiceBundle 
            SET isActive = FALSE
            WHERE bundleID = ? AND providerID = ?
        `;
        const [result] = await pool.execute(query, [bundleID, providerID]);
        return result.affectedRows > 0;
    }

    // Hard delete bundle (if needed)
    static async hardDelete(bundleID, providerID) {
        const query = `
            DELETE FROM ServiceBundle 
            WHERE bundleID = ? AND providerID = ?
        `;
        const [result] = await pool.execute(query, [bundleID, providerID]);
        return result.affectedRows > 0;
    }

    // Get bundle details with provider info
    static async getBundleDetails(bundleID) {
        const query = `
            SELECT 
                sb.*,
                u.name as providerName,
                u.email as providerEmail,
                u.phone as providerPhone,
                u.role as providerRole
            FROM ServiceBundle sb
            LEFT JOIN USER u ON sb.providerID = u.userID
            WHERE sb.bundleID = ? AND sb.isActive = TRUE
        `;
        const [rows] = await pool.execute(query, [bundleID]);
        if (rows[0]) {
            // Safely parse JSON field
            if (rows[0].servicesIncluded) {
                try {
                    if (typeof rows[0].servicesIncluded === 'string') {
                        rows[0].servicesIncluded = JSON.parse(rows[0].servicesIncluded);
                    }
                    if (!Array.isArray(rows[0].servicesIncluded)) {
                        rows[0].servicesIncluded = [];
                    }
                } catch (err) {
                    console.error('Error parsing servicesIncluded:', err);
                    rows[0].servicesIncluded = [];
                }
            } else {
                rows[0].servicesIncluded = [];
            }
        }
        return rows[0];
    }
}

module.exports = ServiceBundle;

