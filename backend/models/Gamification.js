const pool = require('../config/database');

class Gamification {
  // Cache table name to avoid repeated checks
  static _tableName = null;

  static async getTableName() {
    if (this._tableName) {
      return this._tableName;
    }

    // Try Gamification first
    try {
      await pool.query('SELECT 1 FROM Gamification LIMIT 1');
      this._tableName = 'Gamification';
      return this._tableName;
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        // Try lowercase
        try {
          await pool.query('SELECT 1 FROM gamification LIMIT 1');
          this._tableName = 'gamification';
          return this._tableName;
        } catch (e) {
          throw new Error('Gamification table not found in database');
        }
      }
      throw error;
    }
  }

  static async createOrUpdate(userID) {
    try {
      if (!userID) {
        throw new Error('userID is required');
      }
      
      // Convert userID to integer if it's a string
      const userIdInt = parseInt(userID, 10);
      if (isNaN(userIdInt)) {
        throw new Error(`Invalid userID: ${userID}`);
      }

      const tableName = await this.getTableName();
      const checkQuery = `SELECT * FROM ${tableName} WHERE userID = ?`;
      const [existing] = await pool.query(checkQuery, [userIdInt]);

      if (existing.length === 0) {
        // Use actual column names from database schema
        const insertQuery = `
          INSERT INTO ${tableName} (userID, totalPoints, currentMonthPoints, badges, monthlyRank)
          VALUES (?, 0, 0, '[]', 0)
        `;
        return await pool.query(insertQuery, [userIdInt]);
      }
      return existing;
    } catch (error) {
      console.error('Error creating/updating gamification:', error);
      console.error('SQL Error Code:', error.code);
      console.error('SQL Error Message:', error.sqlMessage);
      console.error('userID received:', userID);
      console.error('Full Error:', error);
      throw new Error(`Database error: ${error.sqlMessage || error.message}`);
    }
  }

  static async addPoints(userID, pointsToAdd) {
    try {
      const tableName = await this.getTableName();
      const userIdInt = parseInt(userID, 10);
      const query = `
        UPDATE ${tableName} 
        SET totalPoints = totalPoints + ?,
            currentMonthPoints = currentMonthPoints + ?
        WHERE userID = ?
      `;
      await pool.query(query, [pointsToAdd, pointsToAdd, userIdInt]);
      await this.checkBadges(userID);
      await this.updateMonthlyRank();
      return { success: true, pointsAdded: pointsToAdd };
    } catch (error) {
      console.error('Error adding points:', error);
      throw error;
    }
  }

  static async getGamificationData(userID) {
    try {
      // Ensure user exists first
      await this.createOrUpdate(userID);
      
      const tableName = await this.getTableName();
      const userIdInt = parseInt(userID, 10);
      const query = `
        SELECT gamificationID, userID, totalPoints, 
               COALESCE(currentMonthPoints, 0) as monthlyPoints, 
               COALESCE(badges, '[]') as badgesEarned, 
               COALESCE(monthlyRank, 0) as monthlyRank, 
               lastUpdated as updatedAt
        FROM ${tableName} 
        WHERE userID = ?
      `;
      const [rows] = await pool.query(query, [userIdInt]);
      
      if (rows.length === 0) {
        // Create and return default data
        await this.createOrUpdate(userID);
        const [newRows] = await pool.query(query, [userID]);
        if (newRows.length === 0) {
          throw new Error('Failed to create gamification record');
        }
        return this.formatGamificationData(newRows[0]);
      }
      
      return this.formatGamificationData(rows[0]);
    } catch (error) {
      console.error('Error getting gamification data:', error);
      throw error;
    }
  }

  static formatGamificationData(data) {
    // Parse badges JSON if it's a string
    let badges = [];
    if (typeof data.badgesEarned === 'string') {
      try {
        badges = JSON.parse(data.badgesEarned);
      } catch (e) {
        badges = [];
      }
    } else if (Array.isArray(data.badgesEarned)) {
      badges = data.badgesEarned;
    }
    
    return {
      gamificationID: data.gamificationID,
      userID: data.userID,
      totalPoints: data.totalPoints || 0,
      monthlyPoints: data.monthlyPoints || 0,
      badgesEarned: badges,
      consecutiveDays: 1, // Default value
      tier: this.getTierFromPoints(data.totalPoints || 0),
      updatedAt: data.updatedAt
    };
  }

  static async getLeaderboard(limit = 50) {
    try {
      const tableName = await this.getTableName();
      // Join with USER table to get user names
      const query = `
        SELECT 
          g1.userID, 
          g1.totalPoints, 
          g1.currentMonthPoints as monthlyPoints, 
          g1.badges as badgesEarned,
          u.name as userName,
          (SELECT COUNT(*) + 1 
           FROM ${tableName} g2 
           WHERE g2.currentMonthPoints > g1.currentMonthPoints) as \`rank\`
        FROM ${tableName} g1
        LEFT JOIN USER u ON g1.userID = u.userID
        ORDER BY g1.currentMonthPoints DESC 
        LIMIT ?
      `;
      const [rows] = await pool.query(query, [limit]);
      
      return rows.map(row => {
        let badges = [];
        if (typeof row.badgesEarned === 'string') {
          try {
            badges = JSON.parse(row.badgesEarned);
          } catch (e) {
            badges = [];
          }
        } else if (Array.isArray(row.badgesEarned)) {
          badges = row.badgesEarned;
        }
        return {
          ...row,
          badgesEarned: badges
        };
      });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  static async getMonthlyRanking(userID) {
    try {
      // First, ensure the user exists in the table
      await this.createOrUpdate(userID);
      
      const tableName = await this.getTableName();
      const userIdInt = parseInt(userID, 10);
      
      // Get total count and user's data
      const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM ${tableName}`);
      const totalUsers = countRows[0]?.total || 1;
      
      // Get user's monthly points
      const [userRows] = await pool.query(
        `SELECT userID, currentMonthPoints as monthlyPoints FROM ${tableName} WHERE userID = ?`,
        [userIdInt]
      );
      
      if (!userRows || userRows.length === 0) {
        return { userID, monthlyPoints: 0, rank: 0, percentile: 0 };
      }
      
      const userPoints = userRows[0].monthlyPoints || 0;
      
      // Calculate rank by counting how many users have more points
      // (Alternative approach that works on older MySQL versions)
      const [rankRows] = await pool.query(
        `SELECT COUNT(*) + 1 as userRank 
         FROM ${tableName} 
         WHERE currentMonthPoints > ?`,
        [userPoints]
      );
      
      const userRank = rankRows[0]?.userRank || totalUsers;
      
      // Calculate percentile
      const percentile = totalUsers > 0 
        ? Math.round((userRank / totalUsers) * 100 * 100) / 100 
        : 0;
      
      // Update the monthlyRank in the database for future use
      const tableNameForUpdate = await this.getTableName();
      await pool.query(
        `UPDATE ${tableNameForUpdate} SET monthlyRank = ? WHERE userID = ?`,
        [userRank, userIdInt]
      );
      
      return {
        userID: userIdInt,
        monthlyPoints: userPoints,
        rank: userRank,
        percentile: percentile
      };
    } catch (error) {
      console.error('Error getting ranking:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        sqlMessage: error.sqlMessage
      });
      throw error;
    }
  }

  static async updateMonthlyRank() {
    try {
      // This method is no longer needed as we calculate rank on-the-fly
      // Keeping it for backward compatibility but making it a no-op
      return;
    } catch (error) {
      console.error('Error updating monthly rank:', error);
      // Don't throw, just log
    }
  }

  static getTierFromPoints(points) {
    if (points >= 1000) return 'Master';
    if (points >= 500) return 'Elite';
    if (points >= 100) return 'Advanced';
    return 'Beginner';
  }

  static async checkBadges(userID) {
    try {
      const data = await this.getGamificationData(userID);
      
      if (!data) return [];

      const badges = [];

      if (data.totalPoints >= 100) badges.push('centaurion');
      if (data.totalPoints >= 500) badges.push('elite_worker');
      if (data.totalPoints >= 1000) badges.push('master_provider');
      if (data.consecutiveDays >= 7) badges.push('week_warrior');
      if (data.consecutiveDays >= 30) badges.push('month_master');

      const badgesJson = JSON.stringify(badges);
      const tableName = await this.getTableName();
      const userIdInt = parseInt(userID, 10);
      const updateQuery = `UPDATE ${tableName} SET badges = ? WHERE userID = ?`;
      await pool.query(updateQuery, [badgesJson, userIdInt]);

      return badges;
    } catch (error) {
      console.error('Error checking badges:', error);
      throw error;
    }
  }

  static async resetMonthlyPoints() {
    try {
      const tableName = await this.getTableName();
      const query = `UPDATE ${tableName} SET currentMonthPoints = 0, monthlyRank = 0`;
      const [result] = await pool.query(query);
      return result;
    } catch (error) {
      console.error('Error resetting monthly points:', error);
      throw error;
    }
  }

  static async getHistory(userID, limit = 20) {
    try {
      // Check if gamification_history table exists, if not return empty array
      const [tables] = await pool.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = 'gamification_history'
      `);
      
      if (tables[0].count === 0) {
        // Table doesn't exist, return empty array
        return [];
      }

      const query = `
        SELECT historyID, userID, action, pointsEarned, description, createdAt
        FROM gamification_history 
        WHERE userID = ? 
        ORDER BY createdAt DESC 
        LIMIT ?
      `;
      const [rows] = await pool.query(query, [userID, limit]);
      return rows || [];
    } catch (error) {
      // If table doesn't exist or any error, return empty array instead of throwing
      console.error('Error getting history (returning empty):', error.message);
      return [];
    }
  }
}

module.exports = Gamification;
