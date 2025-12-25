import api from './api';
import reviewService from './reviewService';

export const dashboardService = {
    // Get customer dashboard data
    getCustomerDashboard: async () => {
        const response = await api.get('/dashboard/customer');
        return response.data;
    },

    // Get provider dashboard data
    getProviderDashboard: async () => {
        const response = await api.get('/dashboard/provider');
        return response.data;
    },

    // analytics
    getEnhancedProviderDashboard: async (providerID) => {
        try {
            const [dashboardResponse, analyticsResponse] = await Promise.all([
                api.get('/dashboard/provider'),
                reviewService.getReviewAnalytics(providerID, { timeframe: '12months' })
            ]);

            return {
                ...dashboardResponse.data,
                detailedAnalytics: analyticsResponse.data
            };
        } catch (error) {
            console.error('Error fetching enhanced dashboard:', error);
            const response = await api.get('/dashboard/provider');
            return response.data;
        }
    }
};