import api from './api';

export const historyService = {
    // Get job history for current user
    getJobHistory: async (status = null) => {
        try {
            const url = status 
                ? `/history?status=${status}`
                : '/history';
            const response = await api.get(url);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch job history' };
        }
    },

    // Get job history by ID
    getJobHistoryById: async (jobID) => {
        try {
            const response = await api.get(`/history/${jobID}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch job history' };
        }
    },

    // Get job history statistics
    getJobHistoryStats: async () => {
        try {
            const response = await api.get('/history/stats');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch job history statistics' };
        }
    }
};

