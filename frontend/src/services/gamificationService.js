const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Get user's gamification dashboard
export const getGamificationDashboard = async (userID) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gamification/dashboard/${userID}`);
    if (!response.ok) {
      throw new Error('Failed to fetch gamification dashboard');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching gamification dashboard:', error);
    throw error;
  }
};

// Get leaderboard
export const getLeaderboard = async (limit = 50) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gamification/leaderboard?limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to fetch leaderboard');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
};

// Get user's rank
export const getUserRank = async (userID) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gamification/rank/${userID}`);
    if (!response.ok) {
      throw new Error('Failed to fetch user rank');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching user rank:', error);
    throw error;
  }
};

// Add points for job completion
export const addPointsForJobCompletion = async (userID, jobId, rating) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gamification/add-points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userID,
        jobId,
        rating,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to add points');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error adding points:', error);
    throw error;
  }
};
