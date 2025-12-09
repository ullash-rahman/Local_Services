import React, { useState, useEffect } from 'react';
import './Gamification.css';
import * as gamificationService from '../../services/gamificationService';
import { authService } from '../../services/authService';

const Gamification = () => {
  const user = authService.getCurrentUser();
  const userID = user?.userID;
  const [dashboardData, setDashboardData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
// eslint-disable-next-line
  useEffect(() => {
    if (userID) {
      loadGamificationData();
    }
  }, [userID]);

  const loadGamificationData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard data
      const dashboardResult = await gamificationService.getGamificationDashboard(userID);
      const actualData = dashboardResult?.gamification || dashboardResult;
      setDashboardData(actualData);

      // Fetch leaderboard
      const leaderboardResult = await gamificationService.getLeaderboard(50);
      setLeaderboard(leaderboardResult.leaderboard || []);
    } catch (err) {
      setError(err.message || 'Failed to load gamification data');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };
  const getTier = (points) => {
    if (points >= 1000) return 'Master';
    if (points >= 500) return 'Elite';
    if (points >= 100) return 'Advanced';
    return 'Beginner';
  };

  if (loading) {
    return (
      <div className="gamification-container">
        <div className="loading">Loading gamification data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gamification-container">
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={loadGamificationData} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="gamification-container">
        <p>No gamification data available</p>
      </div>
    );
  }

  const { gamification, ranking } = dashboardData;
  const stats = gamification?.[0] || {};
  const userRanking = ranking?.[0] || {};

  return (
    <div className="gamification-container">
      {/* Stats Section */}
      <div className="gamification-section stats-section">
        <h2 className="section-title">🏆 Your Stats</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Points</div>
            <div className="stat-value">{stats.totalPoints || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monthly Points</div>
            <div className="stat-value">{stats.monthlyPoints || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Rank</div>
            <div className="stat-value">#{userRanking.rank || 'N/A'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Percentile</div>
            <div className="stat-value">{userRanking.percentile || 0}%</div>
          </div>
        </div>
      </div>

      {/* Tier Badge */}
      <div className="gamification-section tier-section">
        <div className="tier-badge">
          <h3>Tier: <span className="tier-name">{stats.tier || 'Bronze'}</span></h3>
          <p className="tier-message">Keep earning points to reach higher tiers! 🚀</p>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="gamification-section leaderboard-section">
        <h2 className="section-title">🎯 Leaderboard</h2>
        {leaderboard.length > 0 ? (
          <div className="leaderboard-wrapper">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="rank-col">Rank</th>
                  <th className="user-col">User</th>
                  <th className="points-col">Points</th>
                  <th className="tier-col">Tier</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((user, index) => (
                  <tr
                    key={index}
                    className={`leaderboard-row ${user.userID === userID ? 'current-user' : ''}`}
                  >
                    <td className="rank-col">#{index + 1}</td>
                    <td className="user-col">
                      {user.userID === userID ? `You (ID: ${user.userID})` : `User ${user.userID}`}
                    </td>
                    <td className="points-col">{user.totalPoints}</td>
                    <td className="tier-col">{getTier(user.totalPoints)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="no-data">No leaderboard data yet</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="gamification-section actions-section">
        <button onClick={loadGamificationData} className="refresh-btn">
          🔄 Refresh Stats
        </button>
      </div>
    </div>
  );
};

export default Gamification;
