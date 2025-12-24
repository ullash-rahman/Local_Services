const Gamification = require('../models/Gamification');

exports.addPointsForJobCompletion = async (req, res) => {
  try {
    const { userID, jobId, rating } = req.body;

    if (!userID || !jobId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userID, jobId, rating'
      });
    }

    const basePoints = 10;
    const ratingBonus = Math.round(rating * 5);
    const totalPoints = basePoints + ratingBonus;

    await Gamification.createOrUpdate(userID);
    await Gamification.addPoints(userID, totalPoints);
    const badges = await Gamification.checkBadges(userID);
    const updatedData = await Gamification.getGamificationData(userID);

    res.status(200).json({
      success: true,
      message: 'Points added successfully',
      data: {
        pointsEarned: totalPoints,
        totalPoints: updatedData.totalPoints,
        monthlyPoints: updatedData.monthlyPoints,
        badgesUnlocked: badges
      }
    });

  } catch (error) {
    console.error('Error adding points:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding points',
      error: error.message
    });
  }
};

exports.getGamificationDashboard = async (req, res) => {
  try {
    const { userID } = req.params;
    
    console.log('getGamificationDashboard called with userID:', userID);
    console.log('userID type:', typeof userID);

    if (!userID) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    await Gamification.createOrUpdate(userID);
    const gamificationData = await Gamification.getGamificationData(userID);
    const ranking = await Gamification.getMonthlyRanking(userID);
    const history = await Gamification.getHistory(userID, 10);

    res.status(200).json({
      success: true,
      data: {
        gamification: gamificationData,
        ranking: ranking,
        recentActivity: history
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard',
      error: error.message || 'Unknown error occurred'
    });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const leaderboard = await Gamification.getLeaderboard(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        leaderboard: leaderboard,
        totalProviders: leaderboard.length,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leaderboard',
      error: error.message
    });
  }
};

exports.getProviderRank = async (req, res) => {
  try {
    const { userID } = req.params;

    if (!userID) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const ranking = await Gamification.getMonthlyRanking(userID);
    const data = await Gamification.getGamificationData(userID);

    res.status(200).json({
      success: true,
      data: {
        userID,
        totalPoints: data.totalPoints,
        monthlyPoints: data.monthlyPoints,
        rank: ranking?.rank || 0,
        percentile: ranking?.percentile || 0,
        badges: Array.isArray(data.badgesEarned) ? data.badgesEarned : []
      }
    });

  } catch (error) {
    console.error('Error fetching rank:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rank',
      error: error.message
    });
  }
};

exports.resetMonthlyPoints = async (req, res) => {
  try {
    await Gamification.resetMonthlyPoints();

    res.status(200).json({
      success: true,
      message: 'Monthly points reset successfully'
    });

  } catch (error) {
    console.error('Error resetting points:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting points',
      error: error.message
    });
  }
};
