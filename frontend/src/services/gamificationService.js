import api from './api';

// Get user's gamification dashboard
export const getGamificationDashboard = async (userID) => {
  try {
    const response = await api.get(`/gamification/dashboard/${userID}`);
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching gamification dashboard:', error);
    throw new Error(error.response?.data?.message || 'Error fetching dashboard');
  }
};

// Get leaderboard
export const getLeaderboard = async (limit = 50) => {
  try {
    const response = await api.get(`/gamification/leaderboard`, {
      params: { limit }
    });
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch leaderboard');
  }
};

// Get user's rank
export const getUserRank = async (userID) => {
  try {
    const response = await api.get(`/gamification/rank/${userID}`);
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching user rank:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch user rank');
  }
};

// Add points for job completion
export const addPointsForJobCompletion = async (userID, jobId, rating) => {
  try {
    const response = await api.post(`/gamification/add-points`, {
      userID,
      jobId,
      rating
    });
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error adding points:', error);
    throw new Error(error.response?.data?.message || 'Failed to add points');
  }
};
