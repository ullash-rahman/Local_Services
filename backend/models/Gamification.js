const pool = require('../config/database');

class Gamification {
  static async createOrUpdate(userID) {
    try {
      const checkQuery = 'SELECT * FROM gamification WHERE userID = ?';
      const [existing] = await pool.query(checkQuery, [userID]);

      if (existing.length === 0) {
        const insertQuery = `
          INSERT INTO gamification (userID, totalPoints, monthlyPoints, badgesEarned, consecutiveDays)
          VALUES (?, 0, 0, '[]', 1)
        `;
        return await pool.query(insertQuery, [userID]);
      }
      return existing;
    } catch (error) {
      console.error('Error creating/updating gamification:', error);
      throw error;
    }
  }

  static async addPoints(userID, pointsToAdd) {
    try {
      const query = `
        UPDATE gamification 
        SET totalPoints = totalPoints + ?,
            monthlyPoints = monthlyPoints + ?,
            lastJobDate = NOW()
        WHERE userID = ?
      `;
      await pool.query(query, [pointsToAdd, pointsToAdd, userID]);
      await this.checkBadges(userID);
      return { success: true, pointsAdded: pointsToAdd };
    } catch (error) {
      console.error('Error adding points:', error);
      throw error;
    }
  }

  static async getGamificationData(userID) {
    try {
      const query = `
        SELECT gamificationID, userID, totalPoints, monthlyPoints, badgesEarned, 
               consecutiveDays, lastJobDate, createdAt, updatedAt
        FROM gamification 
        WHERE userID = ?
      `;
      const [rows] = await pool.query(query, [userID]);
      
      if (rows.length === 0) {
        await this.createOrUpdate(userID);
        return await this.getGamificationData(userID);
      }
      
      const data = rows[0];
      if (typeof data.badgesEarned === 'string') {
        data.badgesEarned = JSON.parse(data.badgesEarned);
      }
      
      return data;
    } catch (error) {
      console.error('Error getting gamification data:', error);
      throw error;
    }
  }

  static async getLeaderboard(limit = 50) {
    try {
      const query = `
        SELECT userID, totalPoints, monthlyPoints, badgesEarned,
               ROW_NUMBER() OVER (ORDER BY monthlyPoints DESC) as rank
        FROM gamification 
        ORDER BY monthlyPoints DESC 
        LIMIT ?
      `;
      const [rows] = await pool.query(query, [limit]);
      
      return rows.map(row => ({
        ...row,
        badgesEarned: typeof row.badgesEarned === 'string' ? JSON.parse(row.badgesEarned) : row.badgesEarned || []
      }));
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  static async getMonthlyRanking(userID) {
    try {
      const query = `
        SELECT userID, monthlyPoints, 
               ROW_NUMBER() OVER (ORDER BY monthlyPoints DESC) as rank,
               ROUND((ROW_NUMBER() OVER (ORDER BY monthlyPoints DESC) / 
                      (SELECT COUNT(*) FROM gamification)) * 100, 2) as percentile
        FROM gamification 
        WHERE userID = ?
      `;
      const [rows] = await pool.query(query, [userID]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error getting ranking:', error);
      throw error;
    }
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
      const updateQuery = `UPDATE gamification SET badgesEarned = ? WHERE userID = ?`;
      await pool.query(updateQuery, [badgesJson, userID]);

      return badges;
    } catch (error) {
      console.error('Error checking badges:', error);
      throw error;
    }
  }

  static async resetMonthlyPoints() {
    try {
      const query = `UPDATE gamification SET monthlyPoints = 0, monthlyResetDate = NOW()`;
      const [result] = await pool.query(query);
      return result;
    } catch (error) {
      console.error('Error resetting monthly points:', error);
      throw error;
    }
  }

  static async getHistory(userID, limit = 20) {
    try {
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
      console.error('Error getting history:', error);
      throw error;
    }
  }
}

module.exports = Gamification;
