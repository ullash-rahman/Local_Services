const pool = require('../config/database');

// Points calculation constants (from design document)
const POINTS = {
  // Payment-based points
  PAYMENT_BASE: 15,
  PAYMENT_AMOUNT_DIVISOR: 100,  // amount / 100
  PAYMENT_MAX_BONUS: 50,
  
  // Review-based points
  REVIEW_BASE: 10,
  REVIEW_RATING_MULTIPLIER: 5,  // rating * 5
  REVIEW_REPLY_BONUS: 5
};

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

  /**
   * Calculate points for a payment
   * Formula: base 15 + min(floor(amount/100), 50)
   * @param {number} amount - Payment amount
   * @returns {number} Points to award
   */
  static calculatePaymentPoints(amount) {
    const bonus = Math.min(Math.floor(amount / POINTS.PAYMENT_AMOUNT_DIVISOR), POINTS.PAYMENT_MAX_BONUS);
    return POINTS.PAYMENT_BASE + bonus;
  }

  /**
   * Add payment points to a user
   * Calculates points using the payment formula and adds them
   * @param {number} userID - User ID
   * @param {number} amount - Payment amount
   * @returns {Promise<Object>} Result with points added
   */
  static async addPaymentPoints(userID, amount) {
    try {
      const points = this.calculatePaymentPoints(amount);
      await this.createOrUpdate(userID);
      const result = await this.addPoints(userID, points);
      return { 
        success: true, 
        pointsAdded: points,
        amount: amount,
        formula: `15 + min(floor(${amount}/100), 50) = ${points}`
      };
    } catch (error) {
      console.error('Error adding payment points:', error);
      throw error;
    }
  }

  /**
   * Add reply bonus points to a user
   * Awards 5 bonus points for replying to a review
   * @param {number} userID - User ID
   * @returns {Promise<Object>} Result with points added
   */
  static async addReplyPoints(userID) {
    try {
      await this.createOrUpdate(userID);
      const result = await this.addPoints(userID, POINTS.REVIEW_REPLY_BONUS);
      return { 
        success: true, 
        pointsAdded: POINTS.REVIEW_REPLY_BONUS,
        reason: 'review_reply_bonus'
      };
    } catch (error) {
      console.error('Error adding reply points:', error);
      throw error;
    }
  }

  /**
   * Check and award earnings milestone badges
   * Awards badges at 1000, 5000, 10000 BDT total earnings
   * @param {number} userID - User ID (provider)
   * @param {number} totalEarnings - Total earnings amount in BDT
   * @returns {Promise<Object>} Result with any new badges awarded
   */
  static async checkEarningsMilestones(userID, totalEarnings) {
    try {
      const milestones = [
        { threshold: 1000, badge: 'earnings_1k' },
        { threshold: 5000, badge: 'earnings_5k' },
        { threshold: 10000, badge: 'earnings_10k' }
      ];

      const gamificationData = await this.getGamificationData(userID);
      const currentBadges = gamificationData.badgesEarned || [];
      const newBadges = [];

      for (const milestone of milestones) {
        if (totalEarnings >= milestone.threshold && !currentBadges.includes(milestone.badge)) {
          currentBadges.push(milestone.badge);
          newBadges.push(milestone.badge);
        }
      }

      if (newBadges.length > 0) {
        const tableName = await this.getTableName();
        const userIdInt = parseInt(userID, 10);
        await pool.query(
          `UPDATE ${tableName} SET badges = ? WHERE userID = ?`,
          [JSON.stringify(currentBadges), userIdInt]
        );
      }

      return {
        success: true,
        totalEarnings,
        currentBadges,
        newBadgesAwarded: newBadges
      };
    } catch (error) {
      console.error('Error checking earnings milestones:', error);
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
      
      // Get total count and user's data including previous rank
      const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM ${tableName}`);
      const totalUsers = countRows[0]?.total || 1;
      
      // Get user's monthly points and previous rank
      const [userRows] = await pool.query(
        `SELECT userID, currentMonthPoints as monthlyPoints, COALESCE(monthlyRank, 0) as previousRank FROM ${tableName} WHERE userID = ?`,
        [userIdInt]
      );
      
      if (!userRows || userRows.length === 0) {
        return { userID, monthlyPoints: 0, rank: 0, previousRank: 0, percentile: 0 };
      }
      
      const userPoints = userRows[0].monthlyPoints || 0;
      const previousRank = userRows[0].previousRank || 0;
      
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
      
      // Check if provider entered top 10 and emit notification
      if (userRank <= 10 && (previousRank === 0 || previousRank > 10)) {
        await this.emitRankChangeNotification(userIdInt, userRank, previousRank, userPoints);
      }
      
      return {
        userID: userIdInt,
        monthlyPoints: userPoints,
        rank: userRank,
        previousRank: previousRank,
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

  /**
   * Emit rank change notification when provider enters top 10
   * @param {number} userID - User ID
   * @param {number} newRank - New rank position
   * @param {number} previousRank - Previous rank position
   * @param {number} monthlyPoints - Current monthly points
   */
  static async emitRankChangeNotification(userID, newRank, previousRank, monthlyPoints) {
    const Notification = require('./Notification');
    
    try {
      // Create database notification
      await Notification.create({
        userID: userID,
        message: `Congratulations! You're now ranked #${newRank} this month!`,
        notificationType: 'rank'
      });

      // Emit Socket.io event if available
      if (global.io) {
        global.io.to(`user_${userID}`).emit('rank_changed', {
          newRank,
          previousRank,
          monthlyPoints,
          message: `You're now ranked #${newRank} this month!`
        });
      }
    } catch (error) {
      console.error('Error emitting rank change notification:', error);
      // Don't throw - notification failure shouldn't break the ranking update
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
      
      if (!data) return { badges: [], newBadges: [] };

      const currentBadges = data.badgesEarned || [];
      const newBadges = [];
      const allBadges = [...currentBadges];

      // Check point-based badges
      const pointBadges = [
        { threshold: 100, badge: 'centaurion' },
        { threshold: 500, badge: 'elite_worker' },
        { threshold: 1000, badge: 'master_provider' }
      ];

      for (const { threshold, badge } of pointBadges) {
        if (data.totalPoints >= threshold && !allBadges.includes(badge)) {
          allBadges.push(badge);
          newBadges.push(badge);
        }
      }

      // Check consecutive days badges
      if (data.consecutiveDays >= 7 && !allBadges.includes('week_warrior')) {
        allBadges.push('week_warrior');
        newBadges.push('week_warrior');
      }
      if (data.consecutiveDays >= 30 && !allBadges.includes('month_master')) {
        allBadges.push('month_master');
        newBadges.push('month_master');
      }

      // Update badges in database
      const badgesJson = JSON.stringify(allBadges);
      const tableName = await this.getTableName();
      const userIdInt = parseInt(userID, 10);
      const updateQuery = `UPDATE ${tableName} SET badges = ? WHERE userID = ?`;
      await pool.query(updateQuery, [badgesJson, userIdInt]);

      // Emit badge earned notifications for new badges
      if (newBadges.length > 0) {
        await this.emitBadgeNotifications(userID, newBadges, allBadges.length);
      }

      return { badges: allBadges, newBadges };
    } catch (error) {
      console.error('Error checking badges:', error);
      throw error;
    }
  }

  /**
   * Emit badge earned notifications for newly awarded badges
   * @param {number} userID - User ID
   * @param {Array<string>} newBadges - Array of newly earned badge names
   * @param {number} totalBadges - Total badges count
   */
  static async emitBadgeNotifications(userID, newBadges, totalBadges) {
    const Notification = require('./Notification');
    
    for (const badgeName of newBadges) {
      try {
        // Create database notification
        await Notification.create({
          userID: userID,
          message: `Congratulations! You earned the "${badgeName}" badge!`,
          notificationType: 'badge'
        });

        // Emit Socket.io event if available
        if (global.io) {
          global.io.to(`user_${userID}`).emit('badge_earned', {
            badgeName,
            totalBadges,
            message: `You earned the "${badgeName}" badge!`
          });
        }
      } catch (error) {
        console.error(`Error emitting badge notification for ${badgeName}:`, error);
        // Continue with other badges even if one fails
      }
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
module.exports.POINTS = POINTS;
