const pool = require('../database');

class ServiceBundle {
  // Create a new service bundle
  static async create(bundleData) {
    const { providerID, bundleName, description, servicesIncluded, price, validTill } = bundleData;
    const query = `
      INSERT INTO servicebundle (providerID, bundleName, description, servicesIncluded, price, validTill, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    // Ensure servicesIncluded is an array and convert to JSON
    let servicesJSON;
    try {
      if (Array.isArray(servicesIncluded)) {
        servicesJSON = JSON.stringify(servicesIncluded);
      } else if (typeof servicesIncluded === 'string') {
        try {
          const parsed = JSON.parse(servicesIncluded);
          servicesJSON = JSON.stringify(Array.isArray(parsed) ? parsed : [parsed]);
        } catch (parseError) {
          if (servicesIncluded.includes(',')) {
            const items = servicesIncluded.split(',').map(s => s.trim()).filter(s => s.length > 0);
            servicesJSON = JSON.stringify(items);
          } else {
            servicesJSON = JSON.stringify([servicesIncluded.trim()]);
          }
        }
      } else if (servicesIncluded) {
        servicesJSON = JSON.stringify([servicesIncluded]);
      } else {
        servicesJSON = JSON.stringify([]);
      }
    } catch (err) {
      console.error('Error stringifying servicesIncluded:', err);
      servicesJSON = JSON.stringify([]);
    }

    const priceValue = typeof price === 'string' ? parseFloat(price) : price;
    
    let validTillValue = null;
    if (validTill) {
      if (typeof validTill === 'string' && validTill.match(/^\d{4}-\d{2}-\d{2}$/)) {
        validTillValue = validTill;
      } else {
        try {
          const date = new Date(validTill);
          if (!isNaN(date.getTime())) {
            validTillValue = date.toISOString().split('T');
          }
        } catch (err) {
          console.error('Error parsing validTill date:', err);
        }
      }
    }

    const [result] = await pool.execute(query, [
      providerID,
      bundleName,
      description || null,
      servicesJSON,
      priceValue,
      validTillValue,
      true
    ]);

    return result.insertId;
  }

  // Get bundle by ID
  static async findById(bundleID) {
    const query = `
      SELECT
        sb.*,
        u.name as providerName,
        u.email as providerEmail
      FROM servicebundle sb
      LEFT JOIN user u ON sb.providerID = u.userID
      WHERE sb.bundleID = ?
    `;
    const [rows] = await pool.execute(query, [bundleID]);
    
    if (rows) {
      if (rows.servicesIncluded !== null && rows.servicesIncluded !== undefined) {
        try {
          let parsed;
          const rawValue = rows.servicesIncluded;
          
          if (typeof rawValue === 'string') {
            const trimmed = rawValue.trim();
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
              try {
                parsed = JSON.parse(trimmed);
              } catch (parseErr) {
                parsed = trimmed.length > 0 ? [trimmed] : [];
              }
            } else {
              parsed = trimmed.length > 0 ? [trimmed] : [];
            }
          } else if (Array.isArray(rawValue)) {
            parsed = rawValue;
          } else if (typeof rawValue === 'object' && rawValue !== null) {
            parsed = Object.values(rawValue);
          } else {
            parsed = [String(rawValue)];
          }

          if (Array.isArray(parsed)) {
            rows.servicesIncluded = parsed.filter(item => item && String(item).trim().length > 0);
          } else {
            rows.servicesIncluded = [];
          }
        } catch (err) {
          console.error('Error parsing servicesIncluded:', err);
          rows.servicesIncluded = [];
        }
      } else {
        rows.servicesIncluded = [];
      }
    }
    
    return rows;
  }

  // Get all bundles by provider
  static async getByProvider(providerID, includeInactive = false) {
    let query = `
      SELECT
        sb.*,
        u.name as providerName
      FROM servicebundle sb
      LEFT JOIN user u ON sb.providerID = u.userID
      WHERE sb.providerID = ?
    `;
    const params = [providerID];
    
    if (!includeInactive) {
      query += ' AND sb.isActive = TRUE';
    }
    
    query += ' ORDER BY sb.createdAt DESC';
    const [rows] = await pool.execute(query, params);
    
    return rows.map(row => {
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

  // Get all active bundles
  static async getAllActive(category = null) {
    let query = `
      SELECT
        sb.*,
        u.name as providerName,
        u.email as providerEmail,
        u.phone as providerPhone
      FROM servicebundle sb
      LEFT JOIN user u ON sb.providerID = u.userID
      WHERE sb.isActive = TRUE
      AND (sb.validTill IS NULL OR sb.validTill >= CURDATE())
    `;
    const params = [];
    
    if (category) {
      query += ` AND JSON_SEARCH(sb.servicesIncluded, 'one', ?) IS NOT NULL`;
      params.push(category);
    }
    
    query += ' ORDER BY sb.createdAt DESC';
    const [rows] = await pool.execute(query, params);
    
    return rows.map(row => {
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
      UPDATE servicebundle
      SET ${updates.join(', ')}
      WHERE bundleID = ? AND providerID = ?
    `;
    
    await pool.execute(query, params);
    return await this.findById(bundleID);
  }

  // Delete bundle (soft delete)
  static async remove(bundleID, providerID) {
    const query = `
      UPDATE servicebundle
      SET isActive = FALSE
      WHERE bundleID = ? AND providerID = ?
    `;
    const [result] = await pool.execute(query, [bundleID, providerID]);
    return result.affectedRows > 0;
  }

  // Hard delete bundle
  static async hardDelete(bundleID, providerID) {
    const query = `
      DELETE FROM servicebundle
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
      FROM servicebundle sb
      LEFT JOIN user u ON sb.providerID = u.userID
      WHERE sb.bundleID = ? AND sb.isActive = TRUE
    `;
    const [rows] = await pool.execute(query, [bundleID]);
    
    if (rows) {
      if (rows.servicesIncluded) {
        try {
          if (typeof rows.servicesIncluded === 'string') {
            rows.servicesIncluded = JSON.parse(rows.servicesIncluded);
          }
          if (!Array.isArray(rows.servicesIncluded)) {
            rows.servicesIncluded = [];
          }
        } catch (err) {
          console.error('Error parsing servicesIncluded:', err);
          rows.servicesIncluded = [];
        }
      } else {
        rows.servicesIncluded = [];
      }
    }
    
    return rows;
  }
}

module.exports = ServiceBundle;
