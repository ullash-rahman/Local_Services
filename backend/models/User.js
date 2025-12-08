const pool = require('../database');

class User {
  // Create a new user (register)
  static async create(userData) {
    const { name, email, password, phone, role } = userData;
    const query = `
      INSERT INTO user (name, email, password, phone, role, verified)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(query, [name, email, password, phone, role, false]);
    return result.insertId;
  }

  // Find user by email
  static async findByEmail(email) {
    const query = 'SELECT * FROM user WHERE email = ?';
    const [rows] = await pool.execute(query, [email]);
    return rows;
  }

  // Find user by ID
  static async findById(userID) {
    const query = 'SELECT userID, name, email, phone, role, verified, createdAt FROM user WHERE userID = ?';
    const [rows] = await pool.execute(query, [userID]);
    return rows;
  }

  // Update user profile
  static async updateProfile(userID, updateData) {
    const { name, phone } = updateData;
    const query = 'UPDATE user SET name = ?, phone = ? WHERE userID = ?';
    await pool.execute(query, [name, phone, userID]);
    return await this.findById(userID);
  }

  // Check if email exists
  static async emailExists(email) {
    const query = 'SELECT COUNT(*) as count FROM user WHERE email = ?';
    const [rows] = await pool.execute(query, [email]);
    return rows.count > 0;
  }
}

module.exports = User;
