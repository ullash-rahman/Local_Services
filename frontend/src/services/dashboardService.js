import api from './api';

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
    }
};

